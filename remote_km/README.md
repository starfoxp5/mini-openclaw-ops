# Remote Keyboard/Mouse Switch (MacBook -> Mac mini)

This is a small LAN tool to use your MacBook as keyboard/mouse input for your Mac mini,
without iCloud or screen sharing.

It does **not** stream video. Your mini still uses its own two monitors.

## What it does

- `sender.py` (run on MacBook): captures keyboard/mouse events.
- `receiver.py` (run on Mac mini): receives events and injects them as local input.
- Toggle forwarding with hotkey: `Control + Option + Command + R`.

When forwarding is ON, captured input is suppressed locally on the MacBook and sent to mini.

## Requirements

- Python 3.10+
- Same LAN for both Macs
- Install dependency on both machines:

```bash
python3 -m pip install pyobjc-framework-Quartz
```

## One-click launcher (.command)

I already added two launcher files in this folder:

- `start_receiver.command` (run on Mac mini)
- `start_sender.command` (run on MacBook)

How to use:

1. First run: double-click `start_receiver.command` on Mac mini, enter shared secret.
2. First run: double-click `start_sender.command` on MacBook, enter mini IP + same shared secret.
3. Toggle forwarding with `Control + Option + Command + R`.
4. Next runs: just double-click both files, no prompt needed.

Saved config files:

- Receiver: `.receiver.conf`
- Sender: `.sender.conf`
- Delete these files to re-enter IP/secret.

If macOS blocks running it:

- Right-click file -> Open
- Or run once in Terminal:

```bash
xattr -d com.apple.quarantine ./start_receiver.command ./start_sender.command
```

## Security

Traffic is signed with HMAC-SHA256 using your shared secret.
Use a long random secret.

## 1) Run receiver on Mac mini

```bash
cd /path/to/remote_km
python3 receiver.py --bind 0.0.0.0 --port 5005 --secret "CHANGE_ME_LONG_SECRET"
```

## 2) Run sender on MacBook

```bash
cd /path/to/remote_km
python3 sender.py --target <MAC_MINI_IP> --port 5005 --secret "CHANGE_ME_LONG_SECRET"
```

Example:

```bash
python3 sender.py --target 192.168.1.13 --port 5005 --secret "CHANGE_ME_LONG_SECRET"
```

## Accessibility permission (important)

On both Macs, allow input control for your Python host process:

- System Settings -> Privacy & Security -> Accessibility
- Add/enable Terminal (or your Python app)

Without this, event tap/injection will fail.

## Notes

- If mini has multiple displays, receiver maps normalized coordinates to the union bounds.
- Mouse scroll and left/right/middle click are supported.
- Modifier keys are supported via flags-changed handling.
