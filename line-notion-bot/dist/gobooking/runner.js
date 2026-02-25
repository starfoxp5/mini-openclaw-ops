import fs from "node:fs/promises";
import path from "node:path";
import { classifyFailure } from "./classifier.js";
import { BookingError } from "./errors.js";
const STEP_SEQUENCE = [
    "parse",
    "open_page",
    "select_date",
    "select_time",
    "fill_contact",
    "apply_discount",
    "create",
    "confirm_terms",
    "verify",
    "report"
];
const MAX_RETRIES = 2;
const ACTION_TIMEOUT_MS = 15_000;
function now() {
    return new Date().toISOString();
}
function elapsedMs(start) {
    return Date.now() - start;
}
function runId() {
    return `gobooking-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}
function parseTimeSlot(slot) {
    const parts = slot.split("-");
    if (parts.length !== 2) {
        throw new Error("fields are required: time_slot");
    }
    const [start, end] = parts.map((p) => p.trim());
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
        throw new Error("fields are required: time_slot");
    }
    return { start, end };
}
function withTimeout(promise, timeoutMs, step) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new BookingError("ACTION_TIMEOUT", `tab not found: step ${step} timed out`, step));
        }, timeoutMs);
        promise
            .then((value) => {
            clearTimeout(timer);
            resolve(value);
        })
            .catch((error) => {
            clearTimeout(timer);
            reject(error);
        });
    });
}
export async function runBookingFlow(input, adapter) {
    const startedAt = now();
    const started = Date.now();
    const run_id = runId();
    const logs = [];
    let lastFailureScreenshot = "";
    let normalized = null;
    let lastSuccessStep = "";
    let transportFailureCount = 0;
    const buildSummary = async (output) => {
        const summary = {
            run_id,
            profile: "chrome",
            input,
            output,
            logs,
            started_at: startedAt,
            ended_at: now(),
            total_duration_ms: elapsedMs(started),
            last_failure_screenshot: lastFailureScreenshot
        };
        await persistSummary(summary);
        return summary;
    };
    for (const step of STEP_SEQUENCE) {
        if (step === "report") {
            const output = {
                result: "success",
                reason_type: "none",
                last_success_step: "verify",
                failed_step: "",
                next_one_action: ""
            };
            logs.push({
                step: "report",
                action: "emit_execution_summary",
                result: "success",
                duration_ms: 0,
                started_at: now(),
                ended_at: now(),
                attempt: 1
            });
            const summary = await buildSummary(output);
            return { output, summary };
        }
        const maxAttempts = MAX_RETRIES + 1;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const stepStartAt = now();
            const begin = Date.now();
            try {
                await executeStep(step, input, normalized, adapter);
                if (step === "parse") {
                    normalized = normalizeInput(input);
                }
                logs.push({
                    step,
                    action: actionLabel(step),
                    result: "success",
                    duration_ms: elapsedMs(begin),
                    started_at: stepStartAt,
                    ended_at: now(),
                    attempt
                });
                lastSuccessStep = step;
                break;
            }
            catch (error) {
                const classified = classifyFailure(error);
                if (classified.reason_type === "transport_failure") {
                    transportFailureCount += 1;
                }
                logs.push({
                    step,
                    action: actionLabel(step),
                    result: "failed",
                    duration_ms: elapsedMs(begin),
                    started_at: stepStartAt,
                    ended_at: now(),
                    attempt,
                    detail: classified.message
                });
                const shouldRetryUiDrift = classified.reason_type === "ui_drift" && attempt < maxAttempts;
                if (shouldRetryUiDrift) {
                    await adapter.refreshSnapshot(step);
                    continue;
                }
                const shouldRetryNonTransport = classified.reason_type !== "transport_failure" && attempt < maxAttempts;
                if (shouldRetryNonTransport) {
                    continue;
                }
                if (classified.reason_type === "transport_failure" && transportFailureCount < 2 && attempt < maxAttempts) {
                    continue;
                }
                try {
                    lastFailureScreenshot = await adapter.captureScreenshot(run_id);
                }
                catch {
                    lastFailureScreenshot = "";
                }
                const output = {
                    result: "failed",
                    reason_type: classified.reason_type,
                    last_success_step: lastSuccessStep,
                    failed_step: step,
                    next_one_action: classified.next_one_action
                };
                const summary = await buildSummary(output);
                return { output, summary };
            }
        }
    }
    const output = {
        result: "failed",
        reason_type: "transport_failure",
        last_success_step: lastSuccessStep,
        failed_step: "report",
        next_one_action: "請重試任務。"
    };
    const summary = await buildSummary(output);
    return { output, summary };
}
function normalizeInput(input) {
    const required = ["customer_name", "phone", "email", "court", "date", "time_slot"];
    for (const key of required) {
        if (!input[key] || String(input[key]).trim() === "") {
            throw new Error("fields are required");
        }
    }
    const { start, end } = parseTimeSlot(input.time_slot);
    return {
        ...input,
        customer_name: input.customer_name.trim(),
        phone: input.phone.trim(),
        email: input.email.trim(),
        court: input.court.trim(),
        date: input.date.trim(),
        time_slot: input.time_slot.trim(),
        discount_code: (input.discount_code ?? "").trim(),
        start_time: start,
        end_time: end
    };
}
async function executeStep(step, input, normalized, adapter) {
    switch (step) {
        case "parse":
            normalizeInput(input);
            return;
        case "open_page":
            await withTimeout(adapter.ensureRelayOn("chrome"), ACTION_TIMEOUT_MS, step);
            await withTimeout(adapter.openPage(assertNormalized(normalized)), ACTION_TIMEOUT_MS, step);
            return;
        case "select_date":
            await withTimeout(adapter.selectDate(assertNormalized(normalized)), ACTION_TIMEOUT_MS, step);
            return;
        case "select_time":
            await withTimeout(adapter.selectTime(assertNormalized(normalized)), ACTION_TIMEOUT_MS, step);
            return;
        case "fill_contact":
            await withTimeout(adapter.fillContact(assertNormalized(normalized)), ACTION_TIMEOUT_MS, step);
            return;
        case "apply_discount":
            await withTimeout(adapter.applyDiscount(assertNormalized(normalized)), ACTION_TIMEOUT_MS, step);
            return;
        case "create":
            await withTimeout(adapter.create(assertNormalized(normalized)), ACTION_TIMEOUT_MS, step);
            return;
        case "confirm_terms":
            await withTimeout(adapter.confirmTerms(assertNormalized(normalized)), ACTION_TIMEOUT_MS, step);
            return;
        case "verify":
            await withTimeout(adapter.verify(assertNormalized(normalized)), ACTION_TIMEOUT_MS, step);
            return;
        case "report":
            return;
    }
}
function assertNormalized(value) {
    if (!value) {
        throw new Error("fields are required");
    }
    return value;
}
function actionLabel(step) {
    switch (step) {
        case "parse":
            return "validate_input_contract";
        case "open_page":
            return "open_gobooking_page";
        case "select_date":
            return "select_booking_date";
        case "select_time":
            return "select_booking_time";
        case "fill_contact":
            return "fill_contact_info";
        case "apply_discount":
            return "apply_discount_code";
        case "create":
            return "create_booking";
        case "confirm_terms":
            return "confirm_terms_modal";
        case "verify":
            return "verify_booking_result";
        case "report":
            return "emit_execution_summary";
    }
}
async function persistSummary(summary) {
    const dir = path.join(process.cwd(), "data", "gobooking", "runs");
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${summary.run_id}.json`);
    await fs.writeFile(file, JSON.stringify(summary, null, 2), "utf-8");
}
