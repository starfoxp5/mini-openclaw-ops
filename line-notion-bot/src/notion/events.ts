import type { ParsedEvent } from "../types.js";
import { EVENTS_PROPS } from "./schemas.js";
import { getNotionClient } from "./client.js";
import { notionEnabled } from "../config/env.js";

function eventId() {
  return `EV-${Date.now()}`;
}

export async function createEvent(parsed: ParsedEvent, userId: string) {
  if (!notionEnabled()) {
    return;
  }
  const db = process.env.NOTION_EVENTS_DB_ID;
  if (!db) throw new Error("Missing NOTION_EVENTS_DB_ID");

  const notion = getNotionClient();
  const properties: any = {
    [EVENTS_PROPS.title]: { title: [{ text: { content: eventId() } }] },
    [EVENTS_PROPS.eventType]: { select: { name: parsed.type } },
    [EVENTS_PROPS.oldEta]: parsed.oldEta ? { date: { start: parsed.oldEta } } : undefined,
    [EVENTS_PROPS.newEta]: parsed.newEta ? { date: { start: parsed.newEta } } : undefined,
    [EVENTS_PROPS.messageText]: { rich_text: [{ text: { content: parsed.rawText.slice(0, 1800) } }] },
    [EVENTS_PROPS.source]: { select: { name: "LINE" } },
    [EVENTS_PROPS.createdBy]: { rich_text: [{ text: { content: userId } }] }
  };

  await notion.pages.create({
    parent: { database_id: db },
    properties
  });
}
