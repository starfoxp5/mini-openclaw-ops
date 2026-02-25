import { getNotionClient } from "../notion/client.js";
import { getMetrics } from "./metrics.js";
import { notionEnabled, providerHealthConfig } from "../config/env.js";
function keyStatus(value) {
    if (!value)
        return "missing";
    if (value.startsWith("sk-") || value.startsWith("gsk_") || value.startsWith("claude-")) {
        return "set";
    }
    return "set";
}
async function notionCheck() {
    if (!notionEnabled()) {
        return { status: "degraded", detail: "notion disabled (env not complete)" };
    }
    try {
        const notion = getNotionClient();
        await notion.users.me({});
        return { status: "ok", detail: "notion reachable" };
    }
    catch (error) {
        return { status: "degraded", detail: `notion error: ${String(error)}` };
    }
}
function providerCheck() {
    const cfg = providerHealthConfig();
    const detail = [
        `preferred=${cfg.preferred}:${keyStatus(cfg.openaiKey)}`,
        `fallback=${cfg.fallback}:${keyStatus(cfg.anthropicKey)}`,
        `google=${keyStatus(cfg.googleKey)}`
    ].join(" ");
    const missingAll = !cfg.openaiKey && !cfg.anthropicKey && !cfg.googleKey;
    return {
        status: (missingAll ? "degraded" : "ok"),
        detail
    };
}
export async function getHealthSnapshot() {
    const metrics = getMetrics();
    const checks = {
        webhook: {
            status: metrics.lastWebhookAt ? "ok" : "degraded",
            detail: metrics.lastWebhookAt ? `last=${metrics.lastWebhookAt}` : "no events yet"
        },
        scheduler: {
            status: metrics.lastCronAt ? "ok" : "degraded",
            detail: metrics.lastCronAt ? `last=${metrics.lastCronAt}` : "no cron run yet"
        },
        provider: providerCheck(),
        notion: await notionCheck()
    };
    const status = Object.values(checks).some((item) => item.status === "degraded") ? "degraded" : "ok";
    return {
        status,
        generatedAt: new Date().toISOString(),
        checks,
        metrics
    };
}
