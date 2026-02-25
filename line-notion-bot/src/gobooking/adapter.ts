import fs from "node:fs/promises";
import path from "node:path";
import { BookingError } from "./errors.js";
import type { BookingStep, NormalizedRequest } from "./types.js";

export interface BrowserAdapter {
  ensureRelayOn(profile: "chrome"): Promise<void>;
  openPage(input: NormalizedRequest): Promise<void>;
  selectDate(input: NormalizedRequest): Promise<void>;
  selectTime(input: NormalizedRequest): Promise<void>;
  fillContact(input: NormalizedRequest): Promise<void>;
  applyDiscount(input: NormalizedRequest): Promise<void>;
  create(input: NormalizedRequest): Promise<void>;
  confirmTerms(input: NormalizedRequest): Promise<void>;
  verify(input: NormalizedRequest): Promise<void>;
  refreshSnapshot(step: BookingStep): Promise<void>;
  captureScreenshot(runId: string): Promise<string>;
}

interface MockConfig {
  relayOn: boolean;
  failByStepAttempt: Record<string, string>;
  screenshotDir: string;
}

function parseFailureMap(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed;
  } catch {
    return {};
  }
}

export class MockBrowserAdapter implements BrowserAdapter {
  private readonly config: MockConfig;
  private attempts = new Map<string, number>();

  constructor(config?: Partial<MockConfig>) {
    this.config = {
      relayOn: config?.relayOn ?? process.env.GBOOKING_RELAY_ON !== "0",
      failByStepAttempt: config?.failByStepAttempt ?? parseFailureMap(process.env.GBOOKING_FAIL_MAP),
      screenshotDir: config?.screenshotDir ?? path.join(process.cwd(), "data", "gobooking", "screenshots")
    };
  }

  async ensureRelayOn(profile: "chrome"): Promise<void> {
    if (profile !== "chrome") {
      throw new BookingError("INVALID_PROFILE", "Only chrome profile is allowed");
    }
    if (!this.config.relayOn) {
      throw new BookingError("RELAY_OFF", "Relay is OFF");
    }
  }

  async openPage(input: NormalizedRequest): Promise<void> {
    this.failIfNeeded("open_page");
    if (!input.court.trim()) {
      throw new Error("fields are required: court");
    }
  }

  async selectDate(input: NormalizedRequest): Promise<void> {
    this.failIfNeeded("select_date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new Error("fields are required: date");
    }
  }

  async selectTime(input: NormalizedRequest): Promise<void> {
    this.failIfNeeded("select_time");
    if (!input.time_slot.includes("-")) {
      throw new Error("fields are required: time_slot");
    }
  }

  async fillContact(input: NormalizedRequest): Promise<void> {
    this.failIfNeeded("fill_contact");
    if (!input.customer_name || !input.phone || !input.email) {
      throw new Error("fields are required");
    }
  }

  async applyDiscount(_input: NormalizedRequest): Promise<void> {
    this.failIfNeeded("apply_discount");
  }

  async create(_input: NormalizedRequest): Promise<void> {
    this.failIfNeeded("create");
  }

  async confirmTerms(_input: NormalizedRequest): Promise<void> {
    this.failIfNeeded("confirm_terms");
  }

  async verify(_input: NormalizedRequest): Promise<void> {
    this.failIfNeeded("verify");
  }

  async refreshSnapshot(_step: BookingStep): Promise<void> {
    return;
  }

  async captureScreenshot(runId: string): Promise<string> {
    const file = path.join(this.config.screenshotDir, `${runId}.txt`);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, `mock screenshot for ${runId}\n`, "utf-8");
    return file;
  }

  private failIfNeeded(step: BookingStep) {
    const attempt = (this.attempts.get(step) ?? 0) + 1;
    this.attempts.set(step, attempt);
    const key = `${step}:${attempt}`;
    const msg = this.config.failByStepAttempt[key];
    if (msg) {
      throw new Error(msg);
    }
  }
}
