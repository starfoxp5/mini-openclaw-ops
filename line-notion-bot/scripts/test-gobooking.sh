#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[0/4] build"
npm run build >/tmp/gobooking-build.log

echo "[1/4] success"
node dist/gobooking/cli.js --input samples/gobooking/input.success.json >/tmp/gobooking-success.json
cat /tmp/gobooking-success.json

echo "[2/4] validation_error"
node -e 'const fs=require("fs");const p="samples/gobooking/input.validation.json";const x={customer_name:"邱志奇",phone:"0968092870",email:"",court:"A場",date:"2026-03-26",time_slot:"22:00-23:00",discount_code:"energy0258"};fs.writeFileSync(p,JSON.stringify(x,null,2));'
node dist/gobooking/cli.js --input samples/gobooking/input.validation.json >/tmp/gobooking-validation.json || true
cat /tmp/gobooking-validation.json

echo "[3/4] ui_drift"
GBOOKING_FAIL_MAP='{"select_time:1":"Element 開始時間 not found","select_time:2":"Element 開始時間 not found","select_time:3":"Element 開始時間 not found"}' \
node dist/gobooking/cli.js --input samples/gobooking/input.success.json >/tmp/gobooking-ui-drift.json || true
cat /tmp/gobooking-ui-drift.json

echo "[4/4] transport_failure"
GBOOKING_FAIL_MAP='{"open_page:1":"tab not found","open_page:2":"tab not found"}' \
node dist/gobooking/cli.js --input samples/gobooking/input.success.json >/tmp/gobooking-transport.json || true
cat /tmp/gobooking-transport.json

echo "done"
