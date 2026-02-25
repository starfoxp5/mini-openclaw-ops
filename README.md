# OpenClaw 模型守護程式（記憶體過載自動切換/重啟/通知）

這個專案提供 `watchdog.py`，可在以下情況自動執行復原流程：
- 記憶體使用率超過門檻
- 健康檢查連續失敗

復原流程：
1. 切換到下一個備援模型
2. 重啟模型服務
3. 發送通知

## 1) 準備設定檔

```bash
cp config.openclaw.m4-32g.json config.json
```

`config.openclaw.m4-32g.json` 已預設：
- `Mac mini M4 32GB RAM` 的建議門檻（`84%`）
- 你的 3 個模型與 RAM 估算（`gpt-oss:20b` / `deepseek-r1:8b` / `qwen3-vl:4b`）
- `full/balanced/safe` 三個掛載檔位（profiles）
- 記憶體過載時優先切到更省 RAM 的檔位

請確認 `config.json`：
- `models`: 模型與 RAM 預估
- `profiles`: 同時掛載組合（例如 full 一次掛三個）
- `switch.command`: 你的 profile 切換命令（可用 `{profile}`、`{models_spaced}`、`{models_csv}`）
- `restart.command`: 你的重啟命令
- `emergency_fallback`: 重啟失敗時切到 Gemini 的緊急備援命令
- `notification.webhook_url` 或 `notification.command`: 你的通知方式

## 2) 先做乾跑驗證

```bash
python3 watchdog.py -c config.json --dry-run
```

## 3) 正式執行

```bash
python3 watchdog.py -c config.json
```

## 3.1) 開機自動執行（launchd）

安裝並立即啟動：

```bash
./install_launchd.sh
```

安裝時會把 `watchdog.py` 與 `config.json` 複製到 `~/.openclaw-watchdog/` 再由 launchd 執行（避免 Desktop 權限問題）。
之後若你改了 `config.json`，請再跑一次 `./install_launchd.sh` 套用新設定。

查看狀態：

```bash
launchctl print "gui/$(id -u)/com.fionaaibot.openclaw.watchdog"
```

停止並移除：

```bash
./uninstall_launchd.sh
```

## 4) 建議先調整的參數

- `memory_threshold_percent`: 建議先從 `85~92` 測
- `consecutive_health_fail_limit`: 建議 `2~5`
- `cooldown_sec`: 防止重複切換，建議至少 `60`

## 備註

- `switch.command` / `restart.command` / `notification.command` 都是陣列命令格式。
- `emergency_fallback.enabled=true` 時，若發生 `restart command failed`，會自動執行 Gemini 備援命令。
- 如果你的環境是 macOS，程式會使用 `vm_stat` 與系統頁面資訊估算記憶體使用率。
- 如果 OpenClaw CLI 不支援 `profile apply`，請改成你實際可用的掛載命令。
- 日誌預設寫到 `watchdog.log`。
