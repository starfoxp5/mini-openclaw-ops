# line-notion-bot (MVP)

LINE 群組 Bot：把群組訊息解析成訂單/交期/出貨事件，寫入 Notion，並在每天 15:00 / 17:00 自動推播。

## Scope
- 同群雙公司別：`Yangtai`、`RedDot`
- 金額口徑：`未稅 (Amount ExTax)`
- 事件類型：`RECEIVED` / `FACTORY_ORDERED` / `ETA_CONFIRMED` / `ETA_CHANGED` / `PLANNED_SHIP` / `SHIPPED`
- 解析策略：`關鍵字分類 + Regex 抽欄位 + confidence`（>=0.75 自動入帳）
- Ops base（Phase 1）：Secrets 驗證、health checks、每日健康摘要、Webhook/文件模板與打包

## Project Structure
- `/src/index.ts`: webhook server + `/line/webhook` + `/healthz`
- `/src/line/*`: LINE 驗簽、reply/push、事件處理
- `/src/parser/*`: classify/extract/confidence/company mapping
- `/src/notion/*`: Notion schema constants + CRUD
- `/src/scheduler/*`: 15:00 待出推播、17:00 日結/月結
- `/src/monitoring/*`: 健康檢查、每日健康摘要、runtime metrics
- `/src/ops/*`: 通用 webhook、追溯事件存檔、模板文件產生、`/pack` 打包
- `/templates/*`: 報價/催交/出貨/RMA 模板
- `/tests/*`: parser fixtures tests（20 句）

## Environment
複製 `.env.example` 成 `.env` 並填入：
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `TARGET_GROUP_ID`（推播目標群組）
- `NOTION_TOKEN`
- `NOTION_ORDERS_DB_ID`
- `NOTION_SHIPMENTS_DB_ID`
- `NOTION_EVENTS_DB_ID`
- `OPS_WEBHOOK_TOKEN`（建議一定要設）

## Notion Databases
建立 3 個資料庫，並把 integration 分享進去。

### Orders properties
- `Order ID` (Title)
- `Company` (Select: `Yangtai`, `RedDot`)
- `Customer` (Rich text)
- `Customer PO` (Rich text)
- `Brand` (Select)
- `Model` (Rich text)
- `Qty` (Number)
- `Amount ExTax` (Number)
- `Status` (Select: `Received`, `FactoryOrdered`, `ETAConfirmed`, `ReadyToShip`, `Shipped`, `Closed`, `NeedInfo`)
- `Current ETA` (Date)
- `Owner` (Rich text or People)
- `Line Group ID` (Rich text)
- `Created By` (Rich text)

### Shipments properties
- `Shipment ID` (Title)
- `Ship Date` (Date)
- `Company` (Select)
- `Customer` (Rich text)
- `Amount ExTax` (Number)
- `Ship Doc No` (Rich text)
- `Carrier` (Select)
- `Tracking No` (Rich text)

### Events properties
- `Event ID` (Title)
- `Event Type` (Select)
- `Old ETA` (Date)
- `New ETA` (Date)
- `Message Text` (Rich text)
- `Source` (Select)
- `Created By` (Rich text)

## Run
```bash
npm install
npm run dev
```

## LINE Webhook
- URL: `POST /line/webhook`
- 驗簽：`x-line-signature`
- Webhook 先回 `200`，再背景處理每筆 event。
- 指令入口（員工極簡）：
  - `/book <客戶> <YYYY-MM-DD> <HH:MM> <HH:MM>`
  - `/order <orderNo> <客戶> [型號] [數量] [YYYY-MM-DD]`
  - `/eta <orderNo> <YYYY-MM-DD>`
  - `/track <carrier> <trackingNo>`
  - `/pack <orderNo>`
  - `/fiona <內容>`（轉發給 Fiona）

## Ops Webhook (Phase 1)
- URL: `POST /ops/webhook`
- Header: `Authorization: Bearer $OPS_WEBHOOK_TOKEN`（若未設定 token 則不驗證）
- 功能：
  - 收 webhook 事件並寫入 `data/ops-events.ndjson`
  - `type=order.created` 時可自動產生模板文件
  - `type=system.restart` 可記錄重啟次數到健康摘要
  - 營運 API（booking/order/logistics）：
    - `POST /ops/bookings/create`
    - `GET /ops/bookings/slots?date=YYYY-MM-DD&durationMinutes=60`
    - `POST /ops/orders/intake`
    - `POST /ops/orders/eta`
    - `GET /ops/orders/:orderNo`
    - `POST /ops/logistics/track`
    - `GET /ops/logistics`

範例：
```bash
curl -X POST http://localhost:3000/ops/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPS_WEBHOOK_TOKEN" \
  -d '{
    "type":"order.created",
    "source":"telegram",
    "customer":"Acme",
    "orderNo":"PO-2026-001",
    "templateKinds":["quote","eta_followup"],
    "vars":{"model":"M4-32G","qty":"10","amount_ex_tax":"199000","eta":"2026-03-15"}
  }'
```

## 文件規範 (Phase 1)
- 根目錄：`ops-docs/`
- 分類：`orders/`、`quotes/`、`shipping/`、`rma/`、`packs/`
- 檔名：`YYYY-MM-DD_<customer>_<orderNo>_<kind>.md`
- 每份文件會有同名 `.trace.json`，可追溯來源欄位

打包指令（回傳 manifest 路徑）：
```bash
curl -X POST http://localhost:3000/ops/pack/PO-2026-001 \
  -H "Authorization: Bearer $OPS_WEBHOOK_TOKEN"
```

## Health / 監控 (Phase 1)
- `GET /healthz`: liveness
- `GET /health/deep`: webhook/scheduler/provider/notion 狀態與 runtime metrics
- 每日健康摘要排程：`HEALTH_SUMMARY_CRON`（預設 20:00, Asia/Taipei）
- 推播目標：`HEALTH_REPORT_TARGET_GROUP_ID`（未設則使用 `TARGET_GROUP_ID`）

## Fiona Direct Bridge (LINE -> Fiona)
- 可用 `/fiona ...` 指令轉發訊息給 Fiona。
- 若 `FIONA_LINE_DIRECT_MODE=true`，一般文字（非 slash command）會直接轉發 Fiona。
- 媒體/檔案（image/video/audio/file）會下載到 `data/line-media/` 後一併轉發。
- 需設定：
  - `FIONA_BRIDGE_ENABLED=true`
  - `FIONA_BRIDGE_URL=<你的 Fiona ingress endpoint>`
  - `FIONA_BRIDGE_TOKEN=<可選>`

## Schedules (Asia/Taipei)
- `15:00`：待出貨提醒（Orders 篩選）
- `17:00`：今日出貨 + 本月累計（Shipments 聚合）
- `19:00`：明日預約提醒（Booking）
- 每 30 分鐘：物流輪詢（有狀態變更才推播）

## Message Handling Rules
- `confidence >= 0.75`：自動入帳
- `0.5 <= confidence < 0.75`：先存 `NeedInfo`，回覆補資料模板
- `< 0.5`：不正式入帳，回覆最短模板

## Minimal Templates (for low-confidence fallback)
- 訂單：`客戶 型號 金額(未稅)`
- 交期：`原廠單號 YYYY/MM/DD`
- 出貨：`客戶 金額(未稅) 物流單號`

## Tests
```bash
npm test
```

## Security Notes
- 不要把任何 API key 寫進程式碼或 repo。
- 建議使用 Zeabur Secrets / Docker secrets / CI secrets 管理金鑰。
- 第三方 Skill/套件安裝前，先確認來源、權限需求、連外行為。
