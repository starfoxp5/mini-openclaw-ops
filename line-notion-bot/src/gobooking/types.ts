export type ReasonType =
  | "none"
  | "validation_error"
  | "ui_drift"
  | "transport_failure"
  | "business_rule";

export type BookingStep =
  | "parse"
  | "open_page"
  | "select_date"
  | "select_time"
  | "fill_contact"
  | "apply_discount"
  | "create"
  | "confirm_terms"
  | "verify"
  | "report";

export interface BookingInput {
  customer_name: string;
  phone: string;
  email: string;
  court: string;
  date: string;
  time_slot: string;
  discount_code?: string;
}

export interface BookingOutput {
  result: "success" | "failed";
  reason_type: ReasonType;
  last_success_step: BookingStep | "";
  failed_step: BookingStep | "";
  next_one_action: string;
}

export interface StepLog {
  step: BookingStep;
  action: string;
  result: "success" | "failed";
  duration_ms: number;
  started_at: string;
  ended_at: string;
  attempt: number;
  detail?: string;
}

export interface ExecutionSummary {
  run_id: string;
  profile: "chrome";
  input: BookingInput;
  output: BookingOutput;
  logs: StepLog[];
  started_at: string;
  ended_at: string;
  total_duration_ms: number;
  last_failure_screenshot: string;
}

export interface NormalizedRequest extends BookingInput {
  start_time: string;
  end_time: string;
}
