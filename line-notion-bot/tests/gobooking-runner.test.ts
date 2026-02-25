import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { MockBrowserAdapter } from "../src/gobooking/adapter.js";
import { runBookingFlow } from "../src/gobooking/runner.js";
import type { BookingInput } from "../src/gobooking/types.js";

const dataRoot = path.join(process.cwd(), "data");

const baseInput: BookingInput = {
  customer_name: "邱志奇",
  phone: "0968092870",
  email: "as52024430@gmail.com",
  court: "A場",
  date: "2026-03-26",
  time_slot: "22:00-23:00",
  discount_code: "energy0258"
};

describe("gobooking runner", () => {
  beforeEach(async () => {
    await fs.rm(dataRoot, { recursive: true, force: true });
  });

  it("success case", async () => {
    const adapter = new MockBrowserAdapter({ relayOn: true });
    const result = await runBookingFlow(baseInput, adapter);

    expect(result.output.result).toBe("success");
    expect(result.output.reason_type).toBe("none");
    expect(result.output.last_success_step).toBe("verify");
    expect(result.summary.logs.length).toBeGreaterThan(0);
  });

  it("validation_error case", async () => {
    const adapter = new MockBrowserAdapter({ relayOn: true });
    const bad = { ...baseInput, email: "" };
    const result = await runBookingFlow(bad, adapter);

    expect(result.output.result).toBe("failed");
    expect(result.output.reason_type).toBe("validation_error");
    expect(result.output.failed_step).toBe("parse");
  });

  it("ui_drift case retries and then fails", async () => {
    const adapter = new MockBrowserAdapter({
      relayOn: true,
      failByStepAttempt: {
        "select_time:1": "Element \"開始時間\" not found",
        "select_time:2": "Element \"開始時間\" not found",
        "select_time:3": "Element \"開始時間\" not found"
      }
    });
    const result = await runBookingFlow(baseInput, adapter);

    expect(result.output.result).toBe("failed");
    expect(result.output.reason_type).toBe("ui_drift");
    expect(result.output.failed_step).toBe("select_time");
    const failures = result.summary.logs.filter((v) => v.step === "select_time" && v.result === "failed");
    expect(failures.length).toBe(3);
  });

  it("transport_failure stops on second occurrence", async () => {
    const adapter = new MockBrowserAdapter({
      relayOn: true,
      failByStepAttempt: {
        "open_page:1": "tab not found",
        "open_page:2": "tab not found"
      }
    });
    const result = await runBookingFlow(baseInput, adapter);

    expect(result.output.result).toBe("failed");
    expect(result.output.reason_type).toBe("transport_failure");
    expect(result.output.failed_step).toBe("open_page");
    const failures = result.summary.logs.filter((v) => v.step === "open_page" && v.result === "failed");
    expect(failures.length).toBe(2);
  });

  it("relay off returns fixed next action", async () => {
    const adapter = new MockBrowserAdapter({ relayOn: false });
    const result = await runBookingFlow(baseInput, adapter);

    expect(result.output.result).toBe("failed");
    expect(result.output.reason_type).toBe("transport_failure");
    expect(result.output.next_one_action).toBe(
      "請在目標分頁點 OpenClaw Browser Relay，確認徽章為 ON。"
    );
  });
});
