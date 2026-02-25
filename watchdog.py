#!/usr/bin/env python3
import argparse
import json
import os
import platform
import re
import shlex
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class State:
    current_model_index: int = 0
    current_profile_index: int = 0
    last_action_ts: float = 0.0
    health_fail_count: int = 0


@dataclass
class ModelSpec:
    name: str
    ram_gb: Optional[float] = None


@dataclass
class ProfileSpec:
    name: str
    models: List[str]
    ram_gb: Optional[float] = None


class Watchdog:
    def __init__(self, config: Dict[str, Any], dry_run: bool = False):
        self.config = config
        self.dry_run = dry_run
        self.state = State(current_model_index=0)

        models = self.config.get("models", [])
        profiles = self.config.get("profiles", [])
        if not models and not profiles:
            raise ValueError("config.models must not be empty")

        self.models: List[ModelSpec] = self.parse_models(models)
        self.profiles: List[ProfileSpec] = self.parse_profiles(profiles)
        self.interval_sec = int(self.config.get("interval_sec", 5))
        self.memory_threshold_percent = float(self.config.get("memory_threshold_percent", 90))
        self.consecutive_health_fail_limit = int(self.config.get("consecutive_health_fail_limit", 3))
        self.cooldown_sec = int(self.config.get("cooldown_sec", 60))
        self.log_file = self.config.get("log_file", "watchdog.log")
        self.prefer_lower_memory_on_overload = bool(self.config.get("prefer_lower_memory_on_overload", True))

        if self.profiles:
            self.state.current_profile_index = self.find_initial_profile_index()
            self.log(f"profile mode enabled, start profile={self.current_profile().name}")

    def log(self, msg: str) -> None:
        line = f"[{datetime.now().isoformat(timespec='seconds')}] {msg}"
        print(line, flush=True)
        try:
            Path(self.log_file).parent.mkdir(parents=True, exist_ok=True)
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(line + "\n")
        except OSError:
            pass

    def run_command(self, cmd: List[str], timeout: int = 30) -> subprocess.CompletedProcess:
        pretty = " ".join(shlex.quote(c) for c in cmd)
        if self.dry_run:
            self.log(f"[DRY-RUN] command: {pretty}")
            return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="", stderr="")
        try:
            return subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False,
            )
        except FileNotFoundError as e:
            return subprocess.CompletedProcess(args=cmd, returncode=127, stdout="", stderr=str(e))

    def parse_models(self, raw_models: List[Any]) -> List[ModelSpec]:
        parsed: List[ModelSpec] = []
        for item in raw_models:
            if isinstance(item, str):
                parsed.append(ModelSpec(name=item, ram_gb=None))
                continue
            if isinstance(item, dict):
                name = item.get("name")
                if not name:
                    raise ValueError("each model object requires name")
                ram = item.get("ram_gb")
                parsed.append(ModelSpec(name=name, ram_gb=float(ram) if ram is not None else None))
                continue
            raise ValueError("config.models entries must be string or object")
        return parsed

    def parse_profiles(self, raw_profiles: List[Any]) -> List[ProfileSpec]:
        parsed: List[ProfileSpec] = []
        for item in raw_profiles:
            if not isinstance(item, dict):
                raise ValueError("config.profiles entries must be object")
            name = item.get("name")
            models = item.get("models")
            if not name or not isinstance(models, list) or not models:
                raise ValueError("each profile requires name and non-empty models")
            ram = item.get("ram_gb")
            if ram is None:
                ram = 0.0
                for model_name in models:
                    for m in self.models:
                        if m.name == model_name and m.ram_gb is not None:
                            ram += m.ram_gb
                            break
                if ram == 0.0:
                    ram = None
            parsed.append(ProfileSpec(name=name, models=models, ram_gb=float(ram) if ram is not None else None))
        return parsed

    def find_initial_profile_index(self) -> int:
        configured = self.config.get("initial_profile")
        if configured:
            for idx, p in enumerate(self.profiles):
                if p.name == configured:
                    return idx
        return 0

    def fill_cmd(self, cmd: List[str], model: Optional[str] = None, message: Optional[str] = None) -> List[str]:
        out: List[str] = []
        for part in cmd:
            part = part.replace("{model}", model or "")
            part = part.replace("{message}", message or "")
            out.append(part)
        return out

    def fill_cmd_with_profile(self, cmd: List[str], profile: ProfileSpec) -> List[str]:
        out: List[str] = []
        models_csv = ",".join(profile.models)
        models_spaced = " ".join(shlex.quote(m) for m in profile.models)
        for part in cmd:
            part = part.replace("{profile}", profile.name)
            part = part.replace("{models_csv}", models_csv)
            part = part.replace("{models_spaced}", models_spaced)
            out.append(part)
        return out

    def memory_usage_percent(self) -> float:
        # Linux path
        meminfo = Path("/proc/meminfo")
        if meminfo.exists():
            values: Dict[str, int] = {}
            with open(meminfo, "r", encoding="utf-8") as f:
                for line in f:
                    key, val = line.split(":", 1)
                    values[key.strip()] = int(val.strip().split()[0])
            total = values.get("MemTotal")
            available = values.get("MemAvailable")
            if total and available is not None:
                return (1 - available / total) * 100

        # macOS fallback via vm_stat + sysctl
        if platform.system() == "Darwin":
            vm_proc = subprocess.run(["vm_stat"], capture_output=True, text=True, check=False)
            if vm_proc.returncode == 0:
                try:
                    page_size = int(os.sysconf("SC_PAGE_SIZE"))
                    mem_total = int(os.sysconf("SC_PHYS_PAGES")) * page_size
                    pages: Dict[str, int] = {}
                    for raw in vm_proc.stdout.splitlines():
                        if ":" not in raw:
                            continue
                        k, v = raw.split(":", 1)
                        m = re.search(r"([0-9][0-9,]*)", v)
                        if not m:
                            continue
                        pages[k.strip()] = int(m.group(1).replace(",", ""))
                    free_like = (
                        pages.get("Pages free", 0)
                        + pages.get("Pages speculative", 0)
                        + pages.get("Pages inactive", 0)
                    )
                    used = max(mem_total - free_like * page_size, 0)
                    return used / mem_total * 100
                except ValueError:
                    pass

        raise RuntimeError("Cannot determine memory usage on this system")

    def health_ok(self) -> bool:
        hc = self.config.get("health_check", {})

        cmd = hc.get("command")
        if cmd:
            res = self.run_command(cmd, timeout=int(hc.get("timeout_sec", 15)))
            if res.returncode != 0:
                self.log(f"health command failed rc={res.returncode}, stderr={res.stderr.strip()}")
                return False

        url = hc.get("url")
        if url:
            timeout = int(hc.get("timeout_sec", 15))
            method = hc.get("method", "GET").upper()
            req = urllib.request.Request(url=url, method=method)
            try:
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    code = getattr(resp, "status", 200)
                    if code >= 400:
                        self.log(f"health url failed status={code}")
                        return False
            except Exception as e:  # noqa: BLE001
                self.log(f"health url exception: {e}")
                return False

        return True

    def notify(self, title: str, detail: str) -> None:
        message = f"{title}\n{detail}"
        ncfg = self.config.get("notification", {})

        webhook = ncfg.get("webhook_url")
        if webhook:
            data = json.dumps({"text": message}).encode("utf-8")
            req = urllib.request.Request(
                url=webhook,
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            try:
                if self.dry_run:
                    self.log(f"[DRY-RUN] webhook POST to {webhook}: {message}")
                else:
                    urllib.request.urlopen(req, timeout=10).read()
            except urllib.error.URLError as e:
                self.log(f"notify webhook failed: {e}")

        cmd = ncfg.get("command")
        if cmd:
            formatted = self.fill_cmd(cmd, message=message)
            res = self.run_command(formatted, timeout=20)
            if res.returncode != 0:
                self.log(f"notify command failed rc={res.returncode}, stderr={res.stderr.strip()}")

    def current_model(self) -> ModelSpec:
        return self.models[self.state.current_model_index]

    def current_profile(self) -> ProfileSpec:
        return self.profiles[self.state.current_profile_index]

    def pick_target_model_index(self, reason: str) -> int:
        cur = self.state.current_model_index

        # On memory overload, prefer moving to the lightest model to quickly lower pressure.
        if reason == "memory_overload" and self.prefer_lower_memory_on_overload:
            with_ram: List[Tuple[int, float]] = []
            for idx, model in enumerate(self.models):
                if model.ram_gb is not None:
                    with_ram.append((idx, model.ram_gb))
            if with_ram:
                lightest_idx, _ = sorted(with_ram, key=lambda p: p[1])[0]
                if lightest_idx != cur:
                    return lightest_idx

        return (cur + 1) % len(self.models)

    def pick_target_profile_index(self, reason: str) -> int:
        cur = self.state.current_profile_index
        if reason == "memory_overload" and self.prefer_lower_memory_on_overload:
            cur_ram = self.current_profile().ram_gb
            if cur_ram is not None:
                candidates: List[Tuple[int, float]] = []
                for idx, p in enumerate(self.profiles):
                    if p.ram_gb is not None and p.ram_gb < cur_ram:
                        candidates.append((idx, p.ram_gb))
                if candidates:
                    return sorted(candidates, key=lambda p: p[1])[0][0]
        return (cur + 1) % len(self.profiles)

    def switch_model(self, reason: str) -> str:
        self.state.current_model_index = self.pick_target_model_index(reason)
        target = self.models[self.state.current_model_index].name
        scfg = self.config.get("switch", {})
        cmd = scfg.get("command")
        if cmd:
            formatted = self.fill_cmd(cmd, model=target)
            res = self.run_command(formatted, timeout=int(scfg.get("timeout_sec", 30)))
            if res.returncode != 0:
                raise RuntimeError(f"switch command failed rc={res.returncode}, stderr={res.stderr.strip()}")
        self.log(f"switched model -> {target}")
        return target

    def switch_profile(self, reason: str) -> str:
        self.state.current_profile_index = self.pick_target_profile_index(reason)
        target = self.current_profile()
        scfg = self.config.get("switch", {})
        cmd = scfg.get("command")
        if cmd:
            formatted = self.fill_cmd_with_profile(cmd, target)
            res = self.run_command(formatted, timeout=int(scfg.get("timeout_sec", 30)))
            if res.returncode != 0:
                raise RuntimeError(f"switch command failed rc={res.returncode}, stderr={res.stderr.strip()}")
        self.log(f"switched profile -> {target.name} models={','.join(target.models)}")
        return target.name

    def restart_service(self) -> None:
        rcfg = self.config.get("restart", {})
        cmd = rcfg.get("command")
        if not cmd:
            self.log("restart.command is empty, skip restart")
            return
        res = self.run_command(cmd, timeout=int(rcfg.get("timeout_sec", 60)))
        if res.returncode != 0:
            raise RuntimeError(f"restart command failed rc={res.returncode}, stderr={res.stderr.strip()}")
        self.log("service restart completed")

    def activate_emergency_fallback(self, reason: str) -> bool:
        ecfg = self.config.get("emergency_fallback", {})
        if not ecfg or not ecfg.get("enabled", False):
            return False

        label = ecfg.get("name", "gemini")
        cmd = ecfg.get("command")
        if not cmd:
            self.log("emergency_fallback.command is empty, skip fallback")
            return False

        self.log(f"emergency fallback start -> {label} ({reason})")
        res = self.run_command(cmd, timeout=int(ecfg.get("timeout_sec", 30)))
        if res.returncode != 0:
            self.log(f"emergency fallback command failed rc={res.returncode}, stderr={res.stderr.strip()}")
            return False

        restart_cmd = ecfg.get("restart_command")
        if restart_cmd:
            rres = self.run_command(restart_cmd, timeout=int(ecfg.get("restart_timeout_sec", 60)))
            if rres.returncode != 0:
                self.log(
                    f"emergency fallback restart failed rc={rres.returncode}, stderr={rres.stderr.strip()}"
                )
                return False

        self.log(f"emergency fallback activated -> {label}")
        return True

    def should_cooldown(self) -> bool:
        return time.time() - self.state.last_action_ts < self.cooldown_sec

    def recover(self, reason: str, mem_percent: Optional[float] = None) -> None:
        if self.should_cooldown():
            self.log(f"in cooldown ({self.cooldown_sec}s), skip recovery. reason={reason}")
            return

        cur = self.current_model().name
        before = f"model={cur}"
        if self.profiles:
            cur = self.current_profile().name
            before = f"profile={cur}"
        if mem_percent is not None:
            before += f", memory={mem_percent:.2f}%"
        self.log(f"recovery start: {reason}, {before}")

        err: Optional[str] = None
        target = cur
        try:
            if self.profiles:
                target = self.switch_profile(reason=reason)
            else:
                target = self.switch_model(reason=reason)
            self.restart_service()
        except Exception as e:  # noqa: BLE001
            err = str(e)
            self.log(f"recovery error: {err}")
            if "restart command failed" in err:
                ok = self.activate_emergency_fallback("restart_failed")
                if ok:
                    self.notify(
                        "[Watchdog] Emergency fallback activated",
                        "restart failed; switched to emergency fallback (gemini/openclaw).",
                    )

        self.state.last_action_ts = time.time()
        if err:
            self.notify(
                "[Watchdog] Recovery failed",
                f"reason={reason}; from={cur}; to={target}; error={err}",
            )
        else:
            self.notify(
                "[Watchdog] Recovery completed",
                f"reason={reason}; from={cur}; to={target}",
            )

    def loop(self) -> None:
        self.log("watchdog started")
        while True:
            try:
                mem = self.memory_usage_percent()
            except Exception as e:  # noqa: BLE001
                self.log(f"memory monitor error: {e}")
                mem = None

            if mem is not None:
                self.log(f"memory usage={mem:.2f}%")
                if mem >= self.memory_threshold_percent:
                    self.recover("memory_overload", mem_percent=mem)

            ok = self.health_ok()
            if ok:
                self.state.health_fail_count = 0
            else:
                self.state.health_fail_count += 1
                self.log(f"health fail count={self.state.health_fail_count}")
                if self.state.health_fail_count >= self.consecutive_health_fail_limit:
                    self.recover("health_check_failed")
                    self.state.health_fail_count = 0

            time.sleep(self.interval_sec)


def load_config(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main() -> int:
    parser = argparse.ArgumentParser(description="Memory + model watchdog")
    parser.add_argument("-c", "--config", default="config.json", help="config json path")
    parser.add_argument("--dry-run", action="store_true", help="print actions without changing system")
    args = parser.parse_args()

    if not Path(args.config).exists():
        print(f"config not found: {args.config}", file=sys.stderr)
        return 2

    cfg = load_config(args.config)
    watchdog = Watchdog(cfg, dry_run=args.dry_run)
    watchdog.loop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
