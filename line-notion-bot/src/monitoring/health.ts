import { getNotionClient } from "../notion/client.js";
import { getMetrics } from "./metrics.js";
import { notionEnabled, providerHealthConfig } from "../config/env.js";

export interface HealthSnapshot {
  status: "ok" | "degraded";
  generatedAt: string;
  checks: Record<string, { status: "ok" | "degraded"; detail: string }>;
  metrics: ReturnType<typeof getMetrics>;
}

function keyStatus(value?: string) {
  if (!value) return "missing";
  if (value.startsWith("sk-") || value.startsWith("gsk_") || value.startsWith("claude-")) {
    return "set";
  }
  return "set";
}

async function notionCheck() {
  if (!notionEnabled()) {
    return { status: "degraded" as const, detail: "notion disabled (env not complete)" };
  }
  try {
    const notion = getNotionClient();
    await notion.users.me({});
    return { status: "ok" as const, detail: "notion reachable" };
  } catch (error) {
    return { status: "degraded" as const, detail: `notion error: ${String(error)}` };
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
    status: (missingAll ? "degraded" : "ok") as "ok" | "degraded",
    detail
  };
}

export async function getHealthSnapshot(): Promise<HealthSnapshot> {
  const metrics = getMetrics();
  const checks: HealthSnapshot["checks"] = {
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
