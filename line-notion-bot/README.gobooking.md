# gobooking.tw 自動預約執行器

本模組提供固定契約、狀態機、錯誤分類、重試策略與可觀測性，支援長期維運需求。

## 安裝

```bash
npm install
```

## 執行

```bash
npm run gobooking:run -- --input samples/gobooking/input.success.json
```

- `stdout` 會輸出固定 schema 的最終結果 JSON。
- `stderr` 會輸出 execution summary。
- summary 檔案會落在 `data/gobooking/runs/<run_id>.json`。
- 失敗時會保留最後截圖路徑於 summary 的 `last_failure_screenshot`。

## 固定狀態機

`parse -> open_page -> select_date -> select_time -> fill_contact -> apply_discount -> create -> confirm_terms -> verify -> report`

每步都紀錄：
- `step`
- `action`
- `result`
- `duration_ms`

## 錯誤分類規則

- `fields are required` -> `validation_error`
- `Element ... not found` -> `ui_drift`（先 refresh snapshot 再重試）
- `tab not found` 或 `Can't reach browser control service` -> `transport_failure`
- 額滿/不可預約/商業規則限制 -> `business_rule`

## 重試策略

- 同一步最多重試 2 次（總嘗試 3 次）。
- `ui_drift`：每次失敗先 `refreshSnapshot` 再重試。
- `transport_failure`：同任務第 2 次即停止並輸出 failure JSON。
- 所有步驟都有 timeout，避免無限等待。

## Relay 約束

- profile 固定為 `chrome`。
- Relay 未 ON 時，`next_one_action` 固定為：
  - `請在目標分頁點 OpenClaw Browser Relay，確認徽章為 ON。`

## 常見錯誤

- `validation_error`：輸入欄位空值或 `time_slot` 格式錯誤。
- `ui_drift`：頁面元素文案/結構改版，需更新 selector。
- `transport_failure`：Relay 斷線或 browser control service 無法連線。
- `business_rule`：時段不可預約、額滿等商業限制。

## 測試

1. 單跑 gobooking 測試

```bash
npm run test:gobooking
```

2. 跑四類案例腳本（success / validation_error / ui_drift / transport_failure）

```bash
npm run gobooking:testscript
```
