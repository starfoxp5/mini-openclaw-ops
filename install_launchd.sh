#!/bin/zsh
set -euo pipefail

WORKDIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_LABEL="com.fionaaibot.openclaw.watchdog"
TARGET_PLIST="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
TEMPLATE="$WORKDIR/launchd/${PLIST_LABEL}.plist.template"
RUNDIR="$HOME/.openclaw-watchdog"

if [[ ! -f "$WORKDIR/config.json" ]]; then
  echo "config.json not found in $WORKDIR"
  echo "Run: cp config.openclaw.m4-32g.json config.json"
  exit 1
fi

PYTHON_BIN="$(command -v python3 || true)"
if [[ -z "$PYTHON_BIN" ]]; then
  echo "python3 not found"
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$RUNDIR"

cp "$WORKDIR/watchdog.py" "$RUNDIR/watchdog.py"
cp "$WORKDIR/config.json" "$RUNDIR/config.json"

sed \
  -e "s|__PYTHON_BIN__|$PYTHON_BIN|g" \
  -e "s|__WORKDIR__|$WORKDIR|g" \
  -e "s|__RUNDIR__|$RUNDIR|g" \
  "$TEMPLATE" > "$TARGET_PLIST"

launchctl bootout "gui/$(id -u)/$PLIST_LABEL" >/dev/null 2>&1 || true
launchctl enable "gui/$(id -u)/$PLIST_LABEL"
launchctl bootstrap "gui/$(id -u)" "$TARGET_PLIST"
launchctl kickstart -k "gui/$(id -u)/$PLIST_LABEL"

echo "Installed and started: $PLIST_LABEL"
echo "Plist: $TARGET_PLIST"
echo "Run dir: $RUNDIR"
