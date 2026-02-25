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
function missingTemplate(type) {
    if (type === "RECEIVED")
        return "請補：客戶 型號 金額(未稅)。例如：王先生 E3MH 120000";
    if (type === "ETA_CONFIRMED" || type === "ETA_CHANGED")
        return "請補：原廠單號 YYYY/MM/DD。例如：33038172 2026/04/10";
    if (type === "SHIPPED")
        return "請補：客戶 金額(未稅) 物流單號。例如：王先生 120000 123456789";
    return "請補最短格式：客戶 型號 金額(未稅)。";
}
function buildSuccessMessage(orderId, parsed) {
    return `✅ 已記錄 ${orderId}${parsed.company ? `｜公司：${parsed.company}` : ""}${parsed.customer ? `｜客戶：${parsed.customer}` : ""}${parsed.amountExTax ? `｜未稅：${parsed.amountExTax.toLocaleString()}` : ""}`;
}
function normalizeDate(raw) {
    if (!raw)
        return undefined;
    const m = raw.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (!m)
        return undefined;
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}
async function handleCommand(text, replyToken, sourceRef) {
    const parts = text.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
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
        }
        else {
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
export async function handleLineEvent(event) {
    if (event.type !== "message" || event.message.type !== "text")
        return;
    try {
        const text = event.message.text.trim();
        const source = event.source;
        const userId = source?.userId ?? "unknown";
        const groupId = source?.type === "group" ? source.groupId : "direct";
        const replyToken = event.replyToken ?? "";
        const sourceRef = `line:${userId}:${new Date().toISOString()}`;
        if (await handleCommand(text, replyToken, sourceRef)) {
            markProcessedEvent();
            return;
        }
        const parsed = parseMessage(text, getLastCompany(userId));
        if (parsed.company)
            setLastCompany(userId, parsed.company);
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
            await replyText(replyToken, `🟡 已先暫存 ${orderId}，缺欄位：${parsed.missingFields.join(", ") || "請檢查"}。${missingTemplate(parsed.type)}`);
            markProcessedEvent();
            return;
        }
        await replyText(replyToken, buildSuccessMessage(orderId, parsed));
        markProcessedEvent();
    }
    catch (error) {
        markError();
        throw error;
    }
}
