---
name: openclaw-gobooking-booking
description: Automate gobooking.tw court reservation workflow for OpenClaw, including court selection, plan/date/time selection, payer/contact form fill, coupon check, and pre-payment review. Use when user asks to book badminton courts online on gobooking.tw (e.g., 活力羽球館 A/B/C/J/Q/K 場), compare available slots, apply coupon, and either stop before payment or auto-submit when coupon reduces total to 0 TWD.
---

# OpenClaw GoBooking Booking

Use this skill to execute a stable, repeatable booking flow on `gobooking.tw`.

## Required Inputs

Collect these inputs before starting:

- Venue: example `活力一館『A』場`
- Booking date: `YYYY/MM/DD`
- Start time and end time: `HH:MM`
- Plan: default `單次預約方案`
- Payer info: `name`, `phone`, `email`
- Contact info: either `同付款人` or separate `name`, `phone`, `email`
- Coupon code (optional)
- Payment method: default `信用卡付款`
- Final action policy: `preview-only` (default) or `submit-payment`

If any required input is missing, ask only for the missing fields.

## Execution Rules

- Follow page labels exactly; prioritize Traditional Chinese labels when present.
- After every major step, verify the page state before proceeding.
- Never click final payment/confirm buttons unless user explicitly requests submission in the current turn.
- Allow automatic final submission only when all are true:
- User provided coupon code in this run.
- Coupon is successfully applied (must click `Search` then `Apply`).
- Summary `總價 Total` equals `0 TWD`.
- Never expose full card number or CCV in logs; mask as `****`.
- Always write payer name as `原姓名（Agent名）` in `付款人資訊 Name` for traceability.
- Use the active agent name (e.g., `Fiona`, `Mia`, `Alaric`) as `Agent名`.
- If slot becomes unavailable, retry with user-approved fallback options only.

## Workflow

1. Open list page and locate target court row (example: `活力一館『A』場`).
2. Check timeline bar availability for target hours.
3. Enter court detail page and click `立即預約 Booking`.
4. In booking panel:
- Set `STEP 1 - 預約方案` to target plan (usually `單次預約方案`).
- Set `STEP 2 - 預約日期`.
- Set `開始時間 Start` and `結束時間 End`.
- Verify subtotal/total section updates as expected.
5. Click first `立即預約 Booking` to open `申請預定 Booking` form.
6. Fill `付款人資訊 Payer Info` required fields.
- In `姓名 Name`, input `payer_name（agent_name）` (example: `王小明（Fiona）`).
- If the field has a strict max length, keep the original payer name and append shortest agent tag allowed (example: `（F）`), then report the fallback in result.
7. Fill `聯絡人資訊 Contact Info` (toggle `同付款人` when requested).
8. Fill optional `訂單備註 Remark` and `優惠代碼 Coupon`.
- If coupon is provided, press `Search`, wait until coupon content/result appears, then press `Apply`.
- Verify discount and `總價 Total` are updated after `Apply`.
9. Fill `付款方式 Payment Info` fields.
10. Open order summary page and verify:
- Court/plan/time exactly match request
- Price, discount, total are expected
- Cancellation warning shown (48-hour rule)
11. Click `確認付款 Confirm` only when one is true:
- final action policy is `submit-payment` and user confirms now, or
- auto-submit condition is satisfied (coupon provided + applied + total 0 TWD).
12. If Terms modal appears, click `確認條款 Confirm` under the same policy as step 11.
13. Confirm completion when success message appears: `付款完成，前往查看預約明細`.

## Result Contract

Return a concise result block:

- Status: `completed`, `needs-user-confirmation`, or `failed`
- Court + date + time
- Plan + payment method
- Price breakdown: base/discount/total
- Action taken: `stopped-before-final-confirm` or `submitted`
- Next required user action (if any)

## References

- Read [references/gobooking-tw-flow.md](references/gobooking-tw-flow.md) for field labels, validation checkpoints, and recovery handling.
