#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Remote KM: MacBook Sender ==="
echo "Project: $SCRIPT_DIR"
echo

CONFIG_FILE="$SCRIPT_DIR/.sender.conf"
PORT="${PORT:-50555}"
TARGET=""
SECRET=""

if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

if [[ -z "${TARGET:-}" || -z "${SECRET:-}" ]]; then
  echo "First-time setup:"
  read "TARGET?Enter Mac mini LAN IP (example 192.168.1.50): "
  read "SECRET?Enter shared secret (must match receiver): "
  if [[ -z "$TARGET" || -z "$SECRET" ]]; then
    echo "IP and secret cannot be empty."
    read -k 1 "?Press any key to close..."
    echo
    exit 1
  fi
  cat > "$CONFIG_FILE" <<EOF
TARGET='$TARGET'
SECRET='$SECRET'
PORT='${PORT}'
EOF
  chmod 600 "$CONFIG_FILE"
  echo "Saved config to $CONFIG_FILE"
fi

echo
echo "Installing dependency if needed..."
python3 -m pip install -q -r "$SCRIPT_DIR/requirements.txt"

echo
echo "Starting sender -> ${TARGET}:${PORT}"
echo "Toggle forwarding with Control+Option+Command+R"
echo "If you need to change IP/secret, delete: $CONFIG_FILE"
echo "Keep this window open while sending input."
echo
python3 "$SCRIPT_DIR/sender.py" --target "$TARGET" --port "$PORT" --secret "$SECRET"
