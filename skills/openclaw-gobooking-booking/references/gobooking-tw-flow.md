# GoBooking TW Flow Reference

## Screen-to-Step Mapping

Use this mapping to align actions with the user's screenshots.

1. Court list screen
- Identify rows like `活力一館『A』場`, `活力一館『B』場`, `活力一館『C』場`, `活力二館『J』場`.
- Timeline bars indicate selectable windows.
- Enter via `打球去` or court detail.

2. Court detail screen
- Confirm court name and location.
- Tap `立即預約 Booking`.

3. Booking panel screen
- Header shows court and hourly price.
- Fields:
  - `STEP 1 - 預約方案 Plan`
  - `STEP 2 - 預約日期 Date`
  - `開始時間 Start`
  - `結束時間 End`
- CTA: `立即預約 Booking`.

4. Booking application form (`申請預定 Booking`)
- `付款人資訊 Payer Info` required
- `付款人姓名 Name` must be formatted as `原姓名（Agent名）` for identification
- `聯絡人資訊 Contact Info` required (supports `同付款人`)
- `備註 Remark` optional
- `優惠代碼 Coupon` optional, then click `Search`
- After coupon detail appears, click `Apply` to apply discount
- `付款方式 Payment Info` required

5. Order summary page
- Validate: court, plan, time, price, discount, total
- Warning: cannot cancel/change within 48 hours
- CTA: `確認付款 Confirm`

6. Terms modal
- Buttons: `取消 Cancel` / `確認條款 Confirm`

7. Success toast/dialog
- Message: `付款完成，前往查看預約明細`

## Validation Checkpoints

At each checkpoint, stop and report mismatch immediately.

- Checkpoint A: Court identity matches user target.
- Checkpoint B: Date and start/end time match user request.
- Checkpoint C: Plan matches requested plan.
- Checkpoint D: Price calculation reasonable for duration.
- Checkpoint E: Coupon workflow completed in order: `Search` -> coupon content appears -> `Apply`.
- Checkpoint F: Final total confirmed by user before submission.
- Checkpoint G: Auto-submit allowed only when coupon is user-provided, applied, and total is exactly `0 TWD`.
- Checkpoint H: Payer name includes agent suffix in parentheses.

## Recovery Rules

- If element text differs slightly (Chinese/English bilingual), match by both label variants.
- If selected time slot disappears:
  - Refresh once.
  - Re-open court row and attempt same slot once.
  - If still unavailable, request fallback from user.
- If coupon invalid:
  - Continue without coupon only after user approval.
- If coupon searched but not applied:
  - Do not proceed to final submission.
  - Re-open coupon section and click `Apply`.
- If payment form rejects data:
  - Re-check required fields and formatting:
    - Phone: digits only
    - Email: `name@domain`
    - Card number: digits/spaces accepted by UI
    - Expiry: month/year both selected
    - CCV: 3 digits
  - If payer name exceeds field length:
    - Keep payer name intact first.
    - Append shortest agent suffix that fits, such as `（F）` or `（M）`.

## Privacy and Safety

- Never persist raw card number/CCV in files or chat logs.
- Mask sensitive fields in summaries.
- Default behavior is pre-submit stop at `確認付款 Confirm` unless user explicitly asks to finish payment now.
- Exception: allow direct submission when coupon is user-provided in the same run and discount makes `總價 Total = 0 TWD`.
