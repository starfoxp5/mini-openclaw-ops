import cron from "node-cron";
import { pushText } from "../line/reply.js";
import { getHealthSnapshot } from "./health.js";
import { markCronRun, markError } from "./metrics.js";

function toSummaryText(snapshot: Awaited<ReturnType<typeof getHealthSnapshot>>) {
  const checks = Object.entries(snapshot.checks)
    .map(([name, item]) => `- ${name}: ${item.status} (${item.detail})`)
    .join("\n");

  return [
    `# OpenClaw Daily Health ${snapshot.generatedAt.slice(0, 10)}`,
    `status: ${snapshot.status}`,
    `events: webhook=${snapshot.metrics.webhookEvents}, processed=${snapshot.metrics.processedEvents}`,
    `errors: ${snapshot.metrics.errors}, restarts: ${snapshot.metrics.restartEvents}`,
    checks
  ].join("\n");
}

export function startHealthSummaryCron() {
  const target = process.env.HEALTH_REPORT_TARGET_GROUP_ID || process.env.TARGET_GROUP_ID;
  if (!target) return;

  const timezone = process.env.TZ || "Asia/Taipei";
  const schedule = process.env.HEALTH_SUMMARY_CRON || "0 20 * * *";
  cron.schedule(
    schedule,
    async () => {
      markCronRun();
      try {
        const snapshot = await getHealthSnapshot();
        await pushText(target, toSummaryText(snapshot));
      } catch (error) {
        markError();
        console.error("health summary failed", error);
      }
    },
    { timezone }
  );
}
