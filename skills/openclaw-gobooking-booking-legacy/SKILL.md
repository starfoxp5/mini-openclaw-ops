---
name: openclaw-gobooking-booking-legacy
description: Preserve and execute the original OpenClaw booking process for gobooking.tw based on Fiona existing SOP and early badminton booking draft. Use when team wants original behavior with required detail collection, pre-submit confirmation, and execution only after explicit user confirmation.
---

# OpenClaw GoBooking Booking Legacy

Use this skill to keep the original team-authored booking style.

## Source of Truth

- `~/.openclaw/workspace-alaric/FIONA_預約SOP.md`
- `~/.openclaw/workspace-mia/memory/skill-draft-badminton.md`

## Required Inputs

- Court (e.g., `A場`)
- Date
- Time
- Name
- Phone
- Email
- Discount code (if provided by user)

Ask follow-up questions for missing fields.

## Original Workflow

1. Confirm user booking intent and collect required inputs.
2. Present a pre-submit summary and request explicit confirmation (`確認送出`).
3. Open gobooking.tw target court page.
4. Select plan/date/time.
5. Fill payer/contact information.
6. Enter discount code and apply site coupon actions if available.
7. Move to confirmation page.
8. Only submit after user confirmation.
9. Report result with success/failure and next steps.

## Safety Rules

- Do not submit without explicit user confirmation.
- For payment/personal data actions, reconfirm before final submission.
- If booking fails, provide at least two alternatives (time or court).

## Output Format

- Status
- Court/date/time
- What was submitted
- If failed: reason + two alternatives

## References

- Read [references/original-flow.md](references/original-flow.md) for preserved SOP text and legacy behavior notes.
