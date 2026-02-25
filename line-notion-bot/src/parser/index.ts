import { classifyEventType } from "./classify.js";
import { extractFields } from "./extract.js";
import { inferCompany } from "./companyMap.js";
import { scoreAndMissing } from "./confidence.js";
import type { Company, ParsedEvent } from "../types.js";

export function parseMessage(text: string, lastCompany?: Company): ParsedEvent {
  const type = classifyEventType(text);
  const base = extractFields(type, text);
  const company = inferCompany(text, lastCompany);
  const merged = { ...base, company };
  const { confidence, missingFields } = scoreAndMissing(type, merged);
  return { type, ...merged, confidence, missingFields };
}
