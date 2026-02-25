#!/bin/zsh
set -euo pipefail

PLIST_LABEL="com.fionaaibot.openclaw.watchdog"
TARGET_PLIST="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"

launchctl bootout "gui/$(id -u)/$PLIST_LABEL" >/dev/null 2>&1 || true
launchctl disable "gui/$(id -u)/$PLIST_LABEL" >/dev/null 2>&1 || true
rm -f "$TARGET_PLIST"

echo "Uninstalled: $PLIST_LABEL"
