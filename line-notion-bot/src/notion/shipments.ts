import type { ParsedEvent } from "../types.js";
import { SHIPMENTS_PROPS } from "./schemas.js";
import { getNotionClient } from "./client.js";
import { notionEnabled } from "../config/env.js";

function shipmentId() {
  return `SH-${Date.now()}`;
}

export async function createShipment(parsed: ParsedEvent) {
  if (!notionEnabled()) {
    return;
  }
  const db = process.env.NOTION_SHIPMENTS_DB_ID;
  if (!db) throw new Error("Missing NOTION_SHIPMENTS_DB_ID");

  const notion = getNotionClient();
  const properties: any = {
    [SHIPMENTS_PROPS.title]: { title: [{ text: { content: shipmentId() } }] },
    [SHIPMENTS_PROPS.shipDate]: { date: { start: parsed.shipDate ?? new Date().toISOString().slice(0, 10) } },
    [SHIPMENTS_PROPS.company]: parsed.company ? { select: { name: parsed.company } } : undefined,
    [SHIPMENTS_PROPS.customer]: parsed.customer ? { rich_text: [{ text: { content: parsed.customer } }] } : undefined,
    [SHIPMENTS_PROPS.amountExTax]: parsed.amountExTax !== undefined ? { number: parsed.amountExTax } : undefined,
    [SHIPMENTS_PROPS.shipDocNo]: parsed.shipDocNo ? { rich_text: [{ text: { content: parsed.shipDocNo } }] } : undefined,
    [SHIPMENTS_PROPS.carrier]: parsed.carrier ? { select: { name: parsed.carrier } } : undefined,
    [SHIPMENTS_PROPS.trackingNo]: parsed.trackingNo ? { rich_text: [{ text: { content: parsed.trackingNo } }] } : undefined
  };

  await notion.pages.create({
    parent: { database_id: db },
    properties
  });
}

export async function queryShipmentsByDateRange(start: string, end: string) {
  if (!notionEnabled()) {
    return [];
  }
  const db = process.env.NOTION_SHIPMENTS_DB_ID;
  if (!db) throw new Error("Missing NOTION_SHIPMENTS_DB_ID");

  const notion = getNotionClient();
  const res = await notion.databases.query({
    database_id: db,
    filter: {
      and: [
        { property: SHIPMENTS_PROPS.shipDate, date: { on_or_after: start } },
        { property: SHIPMENTS_PROPS.shipDate, date: { on_or_before: end } }
      ]
    },
    page_size: 100
  });

  return res.results;
}
