import type { webhook } from "@line/bot-sdk";
import { parseMessage } from "../parser/index.js";
import { getLastCompany, setLastCompany } from "../state/userCompany.js";
import { createOrderFromParsed } from "../notion/orders.js";
import { createEvent } from "../notion/events.js";
import { createShipment } from "../notion/shipments.js";
import { replyText } from "./reply.js";
import { markError, markProcessedEvent } from "../monitoring/metrics.js";
import { createBooking } from "../ops/modules/booking.js";
import { getOrder, updateOrderEta, upsertOrder } from "../ops/modules/order.js";
import { updateTracking } from "../ops/modules/logistics.js";
import { packOrderDocuments } from "../ops/filesystem.js";
import { isDuplicateAndMark } from "./dedupe.js";
import { sendToFiona } from "../bridge/fiona.js";
import { downloadAndSaveLineMedia } from "./media.js";

function missingTemplate(type: string) {
  if (type === "RECEIVED") return "請補：客戶 型號 金額(未稅)。例如：王先生 E3MH 120000";
  if (type === "ETA_CONFIRMED" || type === "ETA_CHANGED") return "請補：原廠單號 YYYY/MM/DD。例如：33038172 2026/04/10";
  if (type === "SHIPPED") return "請補：客戶 金額(未稅) 物流單號。例如：王先生 120000 123456789";
  return "請補最短格式：客戶 型號 金額(未稅)。";
}

function buildSuccessMessage(orderId: string, parsed: { company?: string; customer?: string; amountExTax?: number }) {
  return `✅ 已記錄 ${orderId}${parsed.company ? `｜公司：${parsed.company}` : ""}${parsed.customer ? `｜客戶：${parsed.customer}` : ""}${parsed.amountExTax ? `｜未稅：${parsed.amountExTax.toLocaleString()}` : ""}`;
}

function normalizeDate(raw?: string) {
  if (!raw) return undefined;
  const m = raw.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (!m) return undefined;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

async function handleCommand(input: {
  text: string;
  replyToken: string;
  sourceRef: string;
  userId: string;
  groupId: string;
  timestamp: number;
}) {
  const { text, replyToken, sourceRef, userId, groupId, timestamp } = input;
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();

  if (cmd === "/fiona") {
    const forwarded = text.replace(/^\/fiona\s*/i, "").trim();
    if (!forwarded) {
      await replyText(replyToken, "用法：/fiona <你要 Fiona 處理的內容>");
      return true;
    }
    const result = await sendToFiona({
      target: process.env.FIONA_BRIDGE_TARGET || "fiona",
      channel: "line",
      userId,
      groupId,
      text: forwarded,
      timestamp,
      sourceRef
    });
    if (result.ok) {
      await replyText(replyToken, result.replyText || "✅ 已轉給 Fiona");
    } else {
      await replyText(replyToken, `⚠️ Fiona 轉發失敗：${result.reason}`);
    }
    return true;
  }

  if (cmd === "/book") {
    const [customer, dateRaw, start, end] = [parts[1], parts[2], parts[3], parts[4]];
    const date = normalizeDate(dateRaw);
    if (!customer || !date || !start || !end) {
      await replyText(replyToken, "用法：/book <客戶> <YYYY-MM-DD> <HH:MM> <HH:MM>");
      return true;
    }
    const result = await createBooking({ customer, date, start, end, source: "line-command" });
    if (result.ok) {
      await replyText(replyToken, `✅ 預約成功 ${result.record.id}｜${date} ${start}-${end}`);
    } else {
      const alts = result.alternatives.map((s) => `${s.start}-${s.end}`).join("、") || "無";
      await replyText(replyToken, `⚠️ 時段衝突，建議替代：${alts}`);
    }
    return true;
  }

  if (cmd === "/order") {
    const [orderNo, customer, model, qtyRaw, etaRaw] = [parts[1], parts[2], parts[3], parts[4], parts[5]];
    const eta = normalizeDate(etaRaw);
    if (!orderNo || !customer) {
      await replyText(replyToken, "用法：/order <orderNo> <客戶> [型號] [數量] [YYYY-MM-DD]");
      return true;
    }
    const order = await upsertOrder({
      orderNo,
      customer,
      model,
      qty: qtyRaw ? Number(qtyRaw) : undefined,
      promisedEta: eta,
      sourceType: "line-command",
      sourceRef
    });
    await replyText(replyToken, `✅ 訂單已入庫 ${order.orderNo}｜ETA: ${order.latestEta ?? "N/A"}`);
    return true;
  }

  if (cmd === "/eta") {
    const [orderNo, etaRaw] = [parts[1], parts[2]];
    const eta = normalizeDate(etaRaw);
    if (!orderNo || !eta) {
      await replyText(replyToken, "用法：/eta <orderNo> <YYYY-MM-DD>");
      return true;
    }
    const order = await updateOrderEta({
      orderNo,
      eta,
      sourceType: "line-command",
      sourceRef
    });
    await replyText(replyToken, `✅ ETA 已更新 ${order.orderNo} -> ${eta}（含來源證據）`);
    return true;
  }

  if (cmd === "/track") {
    const [carrier, trackingNo] = [parts[1], parts[2]];
    if (!carrier || !trackingNo) {
      await replyText(replyToken, "用法：/track <carrier> <trackingNo>");
      return true;
    }
    const result = await updateTracking({ carrier, trackingNo });
    await replyText(replyToken, `📦 ${carrier} ${trackingNo}｜${result.record.status}${result.changed ? "（已變更）" : ""}`);
    return true;
  }

  if (cmd === "/pack") {
    const orderNo = parts[1];
    if (!orderNo) {
      await replyText(replyToken, "用法：/pack <orderNo>");
      return true;
    }
    const order = await getOrder(orderNo);
    const packed = await packOrderDocuments(orderNo);
    await replyText(replyToken, `🗂️ 已打包 ${orderNo}（${packed.count} files）${order ? `｜客戶:${order.customer}` : ""}\n${packed.packDir}`);
    return true;
  }

  return false;
}

export async function handleLineEvent(event: webhook.Event) {
  if (event.type !== "message") return;

  try {
    const eventId = (event as webhook.MessageEvent).webhookEventId;
    if (await isDuplicateAndMark(eventId)) {
      markProcessedEvent();
      return;
    }

    const source = event.source;
    const userId = source?.userId ?? "unknown";
    const groupId = source?.type === "group" ? source.groupId : "direct";
    const replyToken = event.replyToken ?? "";
    const sourceRef = `line:${userId}:${event.timestamp}`;

    if (event.message.type !== "text") {
      const supportedTypes = ["image", "video", "audio", "file"];
      if (!supportedTypes.includes(event.message.type)) {
        await replyText(replyToken, `已收到 ${event.message.type}，目前僅支援 image/video/audio/file 轉給 Fiona。`);
        markProcessedEvent();
        return;
      }

      const media = await downloadAndSaveLineMedia(event.message.id);
      const fileName = event.message.type === "file" ? event.message.fileName : undefined;
      const result = await sendToFiona({
        target: process.env.FIONA_BRIDGE_TARGET || "fiona",
        channel: "line",
        userId,
        groupId,
        timestamp: event.timestamp,
        sourceRef,
        text: `[LINE ${event.message.type}] ${fileName || ""}`.trim(),
        attachments: [
          {
            kind: event.message.type,
            filePath: media.filePath,
            contentType: media.contentType,
            size: media.size,
            fileName
          }
        ]
      });
      if (result.ok) {
        await replyText(replyToken, result.replyText || "✅ 附件已轉給 Fiona");
      } else {
        await replyText(replyToken, `⚠️ 附件轉發 Fiona 失敗：${result.reason}`);
      }
      markProcessedEvent();
      return;
    }

    const text = event.message.text.trim();
    const fionaDirect = (process.env.FIONA_LINE_DIRECT_MODE || "false") === "true";

    if (await handleCommand({ text, replyToken, sourceRef, userId, groupId, timestamp: event.timestamp })) {
      markProcessedEvent();
      return;
    }

    if (fionaDirect && !text.startsWith("/")) {
      const result = await sendToFiona({
        target: process.env.FIONA_BRIDGE_TARGET || "fiona",
        channel: "line",
        userId,
        groupId,
        text,
        timestamp: event.timestamp,
        sourceRef
      });
      if (result.ok) {
        await replyText(replyToken, result.replyText || "✅ 已轉給 Fiona");
      } else {
        await replyText(replyToken, `⚠️ Fiona 轉發失敗：${result.reason}`);
      }
      markProcessedEvent();
      return;
    }

    const parsed = parseMessage(text, getLastCompany(userId));
    if (parsed.company) setLastCompany(userId, parsed.company);

    await createEvent(parsed, userId);

    if (parsed.confidence < 0.5) {
      await replyText(replyToken, `🔴 辨識信心不足。${missingTemplate(parsed.type)}`);
      markProcessedEvent();
      return;
    }

    if (parsed.type === "SHIPPED") {
      await createShipment(parsed);
    }

    const orderId = await createOrderFromParsed(parsed, groupId, userId);

    if (parsed.confidence < 0.75) {
      await replyText(
        replyToken,
        `🟡 已先暫存 ${orderId}，缺欄位：${parsed.missingFields.join(", ") || "請檢查"}。${missingTemplate(parsed.type)}`
      );
      markProcessedEvent();
      return;
    }

    await replyText(replyToken, buildSuccessMessage(orderId, parsed));
    markProcessedEvent();
  } catch (error) {
    markError();
    try {
      if ("replyToken" in event && event.replyToken) {
        await replyText(event.replyToken, "已收到訊息，但暫時處理失敗，請稍後再試一次。");
      }
    } catch {
      // ignore nested reply error
    }
    console.error("handleLineEvent failed", error);
  }
}
