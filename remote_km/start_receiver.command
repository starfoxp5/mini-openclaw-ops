#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Remote KM: Mini Receiver ==="
echo "Project: $SCRIPT_DIR"
echo

CONFIG_FILE="$SCRIPT_DIR/.receiver.conf"
PORT="${PORT:-50555}"
SECRET=""

if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

if [[ -z "${SECRET:-}" ]]; then
  echo "First-time setup:"
  read "SECRET?Enter shared secret (must match sender): "
  if [[ -z "$SECRET" ]]; then
    echo "Secret cannot be empty."
    read -k 1 "?Press any key to close..."
    echo
    exit 1
  fi
  cat > "$CONFIG_FILE" <<EOF
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
echo "Starting receiver on 0.0.0.0:${PORT}"
echo "If you need to change secret, delete: $CONFIG_FILE"
echo "Keep this window open while controlling the mini."
echo
python3 "$SCRIPT_DIR/receiver.py" --bind 0.0.0.0 --port "$PORT" --secret "$SECRET"
