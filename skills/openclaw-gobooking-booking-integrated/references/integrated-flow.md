# Integrated Flow Mapping

## Goal

Merge these two styles:

- Legacy governance (`FIONA_預約SOP.md`): collect fields, pre-submit confirmation, explicit submit consent.
- New execution skill (`openclaw-gobooking-booking`): precise gobooking.tw step handling.

## Mapping

1. Legacy "collect required info" -> Integrated steps 1-2
2. Legacy "confirm before send" -> Integrated step 3
3. New "site booking flow" -> Integrated steps 4-9
4. New "coupon Search -> Apply" -> Integrated step 7 (mandatory order)
5. New "0 TWD auto-submit" -> Integrated step 10 (exception path)
6. Legacy "failure alternatives" -> Integrated Safety Rules

## Decision Logic

- If user wants strict manual approval: use `preview-only`.
- If user provided coupon and total becomes exactly `0 TWD`: allow direct submit.
- Otherwise require explicit confirmation before `確認付款`.
