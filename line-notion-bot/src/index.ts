import "dotenv/config";
import express from "express";
import { verifyLineSignature } from "./line/verifySignature.js";
import { handleLineEvent } from "./line/handlers.js";
import { startCrons } from "./scheduler/cron.js";
import { validateEnv } from "./config/env.js";
import { getHealthSnapshot } from "./monitoring/health.js";
import { startHealthSummaryCron } from "./monitoring/summary.js";
import { markError, markWebhookEvent } from "./monitoring/metrics.js";
import { buildOpsRouter } from "./ops/webhook.js";

const app = express();
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString();
  }
}));

app.get("/healthz", (_req, res) => {
  res.status(200).send("ok");
});

app.get("/health/deep", async (_req, res) => {
  const snapshot = await getHealthSnapshot();
  const code = snapshot.status === "ok" ? 200 : 503;
  res.status(code).json(snapshot);
});

app.post("/line/webhook", async (req: any, res) => {
  markWebhookEvent();
  const signature = req.headers["x-line-signature"] as string | undefined;
  const secret = process.env.LINE_CHANNEL_SECRET || "";
  if (!verifyLineSignature(req.rawBody || "", signature, secret)) {
    markError();
    return res.status(401).send("invalid signature");
  }

  res.status(200).send("ok");

  const events = req.body?.events ?? [];
  for (const event of events) {
    try {
      await handleLineEvent(event);
    } catch (e) {
      markError();
      console.error("handle event error", e);
    }
  }
});

app.use("/ops", buildOpsRouter());

const port = Number(process.env.PORT || 3000);
validateEnv();
app.listen(port, () => {
  console.log(`line-notion-bot listening on :${port}`);
});
startCrons();
startHealthSummaryCron();
