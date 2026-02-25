import { Router } from "express";
import { appendOpsEvent } from "./storage.js";
import { generateTemplatedDocument, packOrderDocuments } from "./filesystem.js";
import { markError, markProcessedEvent, markRestartEvent, markWebhookEvent } from "../monitoring/metrics.js";
import { bookingsForDate, createBooking, suggestAlternativeSlots } from "./modules/booking.js";
import { getOrder, updateOrderEta, upsertOrder } from "./modules/order.js";
import { allTrackings, updateTracking } from "./modules/logistics.js";

type Kind = "quote" | "eta_followup" | "shipping_notice" | "rma";

function authorized(authHeader?: string) {
  const token = process.env.OPS_WEBHOOK_TOKEN;
  if (!token) return true;
  return authHeader === `Bearer ${token}`;
}

export function buildOpsRouter() {
  const router = Router();

  router.post("/webhook", async (req, res) => {
    if (!authorized(req.headers.authorization)) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    markWebhookEvent();
    const body = (req.body ?? {}) as {
      type?: string;
      source?: string;
      customer?: string;
      orderNo?: string;
      templateKinds?: Kind[];
      vars?: Record<string, string>;
      payload?: Record<string, unknown>;
    };

    if (!body.type) {
      markError();
      return res.status(400).json({ ok: false, error: "missing type" });
    }

    try {
      const event = await appendOpsEvent({
        type: body.type,
        source: body.source ?? "webhook",
        payload: body.payload ?? body
      });

      const files: Array<{ docPath: string; tracePath: string }> = [];
      if (body.type === "order.created" && body.customer && body.orderNo) {
        const kinds = body.templateKinds ?? ["quote", "eta_followup"];
        for (const kind of kinds) {
          files.push(
            await generateTemplatedDocument({
              kind,
              customer: body.customer,
              orderNo: body.orderNo,
              vars: body.vars ?? {}
            })
          );
        }
      }

      if (body.type === "system.restart") {
        markRestartEvent();
      }

      markProcessedEvent();
      return res.status(200).json({ ok: true, event, files });
    } catch (error) {
      markError();
      return res.status(500).json({ ok: false, error: String(error) });
    }
  });

  router.post("/bookings/create", async (req, res) => {
    if (!authorized(req.headers.authorization)) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const body = req.body ?? {};
    if (!body.customer || !body.date || !body.start || !body.end) {
      return res.status(400).json({ ok: false, error: "customer/date/start/end required" });
    }
    try {
      const result = await createBooking({
        customer: String(body.customer),
        date: String(body.date),
        start: String(body.start),
        end: String(body.end),
        bufferMinutes: body.bufferMinutes ? Number(body.bufferMinutes) : undefined,
        source: "ops-webhook"
      });
      markProcessedEvent();
      return res.status(200).json(result);
    } catch (error) {
      markError();
      return res.status(500).json({ ok: false, error: String(error) });
    }
  });

  router.get("/bookings/slots", async (req, res) => {
    if (!authorized(req.headers.authorization)) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const date = String(req.query.date ?? "");
    const duration = Number(req.query.durationMinutes ?? 60);
    if (!date) return res.status(400).json({ ok: false, error: "date required" });
    const slots = await suggestAlternativeSlots({
      date,
      durationMinutes: duration,
      bufferMinutes: Number(process.env.BOOKING_BUFFER_MINUTES || 15)
    });
    return res.status(200).json({ ok: true, slots });
  });

  router.post("/orders/intake", async (req, res) => {
    if (!authorized(req.headers.authorization)) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const body = req.body ?? {};
    if (!body.orderNo || !body.customer || !body.sourceRef) {
      return res.status(400).json({ ok: false, error: "orderNo/customer/sourceRef required" });
    }
    try {
      const order = await upsertOrder({
        orderNo: String(body.orderNo),
        customer: String(body.customer),
        model: body.model ? String(body.model) : undefined,
        qty: body.qty ? Number(body.qty) : undefined,
        promisedEta: body.promisedEta ? String(body.promisedEta) : undefined,
        sourceType: String(body.sourceType ?? "webhook"),
        sourceRef: String(body.sourceRef)
      });
      markProcessedEvent();
      return res.status(200).json({ ok: true, order });
    } catch (error) {
      markError();
      return res.status(500).json({ ok: false, error: String(error) });
    }
  });

  router.post("/orders/eta", async (req, res) => {
    if (!authorized(req.headers.authorization)) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const body = req.body ?? {};
    if (!body.orderNo || !body.eta || !body.sourceRef) {
      return res.status(400).json({ ok: false, error: "orderNo/eta/sourceRef required" });
    }
    try {
      const order = await updateOrderEta({
        orderNo: String(body.orderNo),
        eta: String(body.eta),
        sourceType: String(body.sourceType ?? "webhook"),
        sourceRef: String(body.sourceRef),
        note: body.note ? String(body.note) : undefined
      });
      markProcessedEvent();
      return res.status(200).json({ ok: true, order });
    } catch (error) {
      markError();
      return res.status(500).json({ ok: false, error: String(error) });
    }
  });

  router.get("/orders/:orderNo", async (req, res) => {
    if (!authorized(req.headers.authorization)) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const order = await getOrder(req.params.orderNo);
    return res.status(order ? 200 : 404).json({ ok: Boolean(order), order });
  });

  router.post("/logistics/track", async (req, res) => {
    if (!authorized(req.headers.authorization)) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const body = req.body ?? {};
    if (!body.carrier || !body.trackingNo) {
      return res.status(400).json({ ok: false, error: "carrier/trackingNo required" });
    }
    try {
      const result = await updateTracking({
        carrier: String(body.carrier),
        trackingNo: String(body.trackingNo)
      });
      markProcessedEvent();
      return res.status(200).json({ ok: true, ...result });
    } catch (error) {
      markError();
      return res.status(500).json({ ok: false, error: String(error) });
    }
  });

  router.get("/logistics", async (req, res) => {
    if (!authorized(req.headers.authorization)) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const list = await allTrackings();
    return res.status(200).json({ ok: true, trackings: list });
  });

  router.get("/bookings/:date", async (req, res) => {
    if (!authorized(req.headers.authorization)) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const records = await bookingsForDate(req.params.date);
    return res.status(200).json({ ok: true, records });
  });

  router.post("/pack/:orderNo", async (req, res) => {
    if (!authorized(req.headers.authorization)) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const orderNo = req.params.orderNo;
    if (!orderNo) {
      return res.status(400).json({ ok: false, error: "missing orderNo" });
    }

    try {
      const result = await packOrderDocuments(orderNo);
      markProcessedEvent();
      return res.status(200).json({ ok: true, ...result });
    } catch (error) {
      markError();
      return res.status(500).json({ ok: false, error: String(error) });
    }
  });

  return router;
}
