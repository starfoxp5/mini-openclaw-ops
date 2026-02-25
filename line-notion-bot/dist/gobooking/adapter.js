import fs from "node:fs/promises";
import path from "node:path";
import { BookingError } from "./errors.js";
function parseFailureMap(raw) {
    if (!raw)
        return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed;
    }
    catch {
        return {};
    }
}
export class MockBrowserAdapter {
    config;
    attempts = new Map();
    constructor(config) {
        this.config = {
            relayOn: config?.relayOn ?? process.env.GBOOKING_RELAY_ON !== "0",
            failByStepAttempt: config?.failByStepAttempt ?? parseFailureMap(process.env.GBOOKING_FAIL_MAP),
            screenshotDir: config?.screenshotDir ?? path.join(process.cwd(), "data", "gobooking", "screenshots")
        };
    }
    async ensureRelayOn(profile) {
        if (profile !== "chrome") {
            throw new BookingError("INVALID_PROFILE", "Only chrome profile is allowed");
        }
        if (!this.config.relayOn) {
            throw new BookingError("RELAY_OFF", "Relay is OFF");
        }
    }
    async openPage(input) {
        this.failIfNeeded("open_page");
        if (!input.court.trim()) {
            throw new Error("fields are required: court");
        }
    }
    async selectDate(input) {
        this.failIfNeeded("select_date");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
            throw new Error("fields are required: date");
        }
    }
    async selectTime(input) {
        this.failIfNeeded("select_time");
        if (!input.time_slot.includes("-")) {
            throw new Error("fields are required: time_slot");
        }
    }
    async fillContact(input) {
        this.failIfNeeded("fill_contact");
        if (!input.customer_name || !input.phone || !input.email) {
            throw new Error("fields are required");
        }
    }
    async applyDiscount(_input) {
        this.failIfNeeded("apply_discount");
    }
    async create(_input) {
        this.failIfNeeded("create");
    }
    async confirmTerms(_input) {
        this.failIfNeeded("confirm_terms");
    }
    async verify(_input) {
        this.failIfNeeded("verify");
    }
    async refreshSnapshot(_step) {
        return;
    }
    async captureScreenshot(runId) {
        const file = path.join(this.config.screenshotDir, `${runId}.txt`);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, `mock screenshot for ${runId}\n`, "utf-8");
        return file;
    }
    failIfNeeded(step) {
        const attempt = (this.attempts.get(step) ?? 0) + 1;
        this.attempts.set(step, attempt);
        const key = `${step}:${attempt}`;
        const msg = this.config.failByStepAttempt[key];
        if (msg) {
            throw new Error(msg);
        }
    }
}
