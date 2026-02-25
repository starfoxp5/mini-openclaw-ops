import { BookingError, asError } from "./errors.js";
import type { ReasonType } from "./types.js";

const RELAY_ACTION = "請在目標分頁點 OpenClaw Browser Relay，確認徽章為 ON。";

export interface ClassifiedFailure {
  reason_type: Exclude<ReasonType, "none">;
  next_one_action: string;
  message: string;
}

export function relayActionMessage() {
  return RELAY_ACTION;
}

export function classifyFailure(input: unknown): ClassifiedFailure {
  const error = asError(input);
  const message = error.message ?? "";
  const lower = message.toLowerCase();
  if (error instanceof BookingError && error.code === "RELAY_OFF") {
    return {
      reason_type: "transport_failure",
      next_one_action: RELAY_ACTION,
      message
    };
  }
  if (lower.includes("fields are required")) {
    return {
      reason_type: "validation_error",
      next_one_action: "請補齊必填欄位後重新執行。",
      message
    };
  }
  if (message.includes("Element") && lower.includes("not found")) {
    return {
      reason_type: "ui_drift",
      next_one_action: "請更新頁面元素定位（selector）或確認頁面文案是否改版。",
      message
    };
  }
  if (lower.includes("tab not found") || message.includes("Can't reach browser control service")) {
    return {
      reason_type: "transport_failure",
      next_one_action: "請確認瀏覽器分頁與 Relay 連線，再重試。",
      message
    };
  }
  if (
    message.includes("額滿") ||
    message.includes("不可預約") ||
    lower.includes("business rule") ||
    message.includes("商業規則")
  ) {
    return {
      reason_type: "business_rule",
      next_one_action: "請改選其他可預約時段或場地。",
      message
    };
  }
  return {
    reason_type: "transport_failure",
    next_one_action: "請確認網路與瀏覽器控制服務，再重試。",
    message
  };
}
