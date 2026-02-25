export type Company = "Yangtai" | "RedDot";

export type EventType =
  | "RECEIVED"
  | "FACTORY_ORDERED"
  | "ETA_CONFIRMED"
  | "ETA_CHANGED"
  | "PLANNED_SHIP"
  | "SHIPPED"
  | "LOGISTICS_UPDATED"
  | "UNKNOWN";

export interface ParsedEvent {
  type: EventType;
  company?: Company;
  customer?: string;
  customerPo?: string;
  factoryOrderNo?: string;
  model?: string;
  qty?: number;
  amountExTax?: number;
  oldEta?: string;
  newEta?: string;
  plannedShipDate?: string;
  shipDate?: string;
  carrier?: string;
  trackingNo?: string;
  shipDocNo?: string;
  confidence: number;
  missingFields: string[];
  rawText: string;
}
