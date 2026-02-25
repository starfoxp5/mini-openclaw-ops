import type { EventType, ParsedEvent } from "../types.js";

type ParsedCore = Omit<ParsedEvent, "type" | "confidence" | "missingFields">;
type RequiredField = keyof ParsedCore;

const REQUIRED_FIELDS: Record<EventType, RequiredField[]> = {
  RECEIVED: ["customer", "model", "amountExTax"],
  FACTORY_ORDERED: ["model", "qty"],
  ETA_CONFIRMED: ["factoryOrderNo", "newEta"],
  ETA_CHANGED: ["factoryOrderNo", "newEta"],
  PLANNED_SHIP: ["plannedShipDate"],
  SHIPPED: ["customer", "amountExTax"],
  LOGISTICS_UPDATED: ["trackingNo"],
  UNKNOWN: []
};

export function scoreAndMissing(type: EventType, parsed: ParsedCore): Pick<ParsedEvent, "confidence" | "missingFields"> {
  let score = type === "UNKNOWN" ? 0 : 0.3;
  const required = REQUIRED_FIELDS[type];
  const missing: string[] = [];

  if (!required.length) return { confidence: score, missingFields: missing };

  const unit = 0.6 / required.length;
  for (const key of required) {
    if (parsed[key] !== undefined && parsed[key] !== "") {
      score += unit;
    } else {
      missing.push(String(key));
    }
  }

  if (parsed.company) score += 0.1;
  if (type === "ETA_CHANGED" && parsed.oldEta && parsed.newEta && parsed.oldEta === parsed.newEta) score -= 0.2;

  return { confidence: Math.max(0, Math.min(1, score)), missingFields: missing };
}
