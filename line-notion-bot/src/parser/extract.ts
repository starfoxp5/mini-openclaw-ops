import type { EventType, ParsedEvent } from "../types.js";

function parseNumber(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function normalizeDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const m = raw.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (!m) return undefined;
  const y = m[1];
  const mm = m[2].padStart(2, "0");
  const dd = m[3].padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

export function extractFields(type: EventType, text: string): Omit<ParsedEvent, "type" | "confidence" | "missingFields"> {
  const amount = parseNumber(text.match(/(?:金額|\$|NT\$|TWD)\s*([\d,]+)/i)?.[1] ?? text.match(/\b([\d,]{4,})\b/)?.[1]);
  const factoryOrderNo = text.match(/(?:原廠單號|order\s*#?)\s*([A-Za-z0-9\-]{6,})/i)?.[1] ?? text.match(/\b(\d{6,10})\b/)?.[1];
  const customerPo = text.match(/(?:PO#?|客戶PO#?)\s*([A-Za-z0-9\-]+)/i)?.[1];
  const model = text.match(/(?:型號)\s*([A-Za-z0-9\-]+)/i)?.[1] ?? text.match(/\b([A-Za-z]{1,5}\d[A-Za-z0-9\-]*)\b/)?.[1];
  const qty = parseNumber(text.match(/x\s*(\d+)/i)?.[1] ?? text.match(/(?:數量)\s*(\d+)/i)?.[1]);
  const trackingNo = text.match(/(?:單號|tracking)\s*([A-Za-z0-9\-]{6,})/i)?.[1] ?? text.match(/\b([A-Za-z0-9]{8,16})\b/)?.[1];
  const carrier = text.match(/(黑貓|新竹|順豐|DHL|FedEx|UPS)/i)?.[1];
  const customer = text.match(/(?:客戶)\s*([\u4e00-\u9fa5A-Za-z0-9_\-]+)/)?.[1] ?? text.split(/\s+/)[0];

  const dateMatches = [...text.matchAll(/(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/g)].map((m) => normalizeDate(m[1])).filter(Boolean) as string[];
  const arrow = text.match(/(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})\s*(?:->|→)\s*(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/);

  let oldEta: string | undefined;
  let newEta: string | undefined;
  if (arrow) {
    oldEta = normalizeDate(arrow[1]);
    newEta = normalizeDate(arrow[2]);
  } else if (dateMatches[0]) {
    newEta = dateMatches[0];
  }

  const plannedShipDate = type === "PLANNED_SHIP" ? dateMatches[0] : undefined;
  const shipDate = type === "SHIPPED" ? dateMatches[0] : undefined;

  return {
    rawText: text,
    customer: customer || undefined,
    customerPo,
    factoryOrderNo,
    model,
    qty,
    amountExTax: amount,
    oldEta,
    newEta,
    plannedShipDate,
    shipDate,
    carrier,
    trackingNo,
    shipDocNo: text.match(/(?:出貨單|ship\s*doc)\s*([A-Za-z0-9\-]+)/i)?.[1]
  };
}
