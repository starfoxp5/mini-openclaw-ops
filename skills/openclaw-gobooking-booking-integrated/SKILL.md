---
name: openclaw-gobooking-booking-integrated
description: Integrate the team original Fiona booking SOP with newer gobooking.tw execution rules. Use when OpenClaw should keep original confirmation discipline while running precise court-booking flow with coupon search then apply, payer name agent suffix, and optional auto-submit only when total is 0 TWD.
---

# OpenClaw GoBooking Booking Integrated

Use this skill when you want both: original SOP governance and reliable site-level execution.

## Required Inputs

- Venue/court (e.g., `活力一館『A』場`)
- Date (`YYYY/MM/DD`)
- Start time / end time (`HH:MM`)
- Payer name/phone/email
- Contact info (same as payer or separate)
- Coupon code (optional)
- Final action policy: `preview-only` or `submit-payment`

## Integrated Workflow

1. Collect required fields from user.
2. Generate pre-submit summary in Fiona SOP style.
3. Require explicit user confirmation before entering external submit phase.
4. Open gobooking.tw and select target court/date/time.
5. Fill payer info; set payer name to `原姓名（Agent名）`.
6. Fill contact info and optional remark.
7. If coupon exists: click `Search` -> wait coupon content appears -> click `Apply`.
8. Verify discount and total after `Apply`.
9. Open summary page and verify court/time/price/discount/total.
10. Submit rules:
- Default: stop before final confirm and ask user.
- Allow direct submission when coupon is user-provided, applied, and total is `0 TWD`.
11. If terms modal appears, confirm terms under the same submit rule.
12. Return structured result.

## Key Checks

- Do not proceed if coupon was searched but not applied.
- Do not proceed if summary total does not match expected result.
- If slot unavailable, retry once; otherwise ask user for fallback.

## Safety Rules

- Never log full card number or CCV.
- Do not submit with missing required fields.
- On failure, provide at least two alternatives.

## References

- Read [references/integrated-flow.md](references/integrated-flow.md) for mapping from legacy SOP to strict execution steps.
