import fs from "node:fs/promises";
import path from "node:path";

const DATA_ROOT = process.env.OPS_DATA_ROOT || path.join(process.cwd(), "data");
const EVENT_FILE = path.join(DATA_ROOT, "ops-events.ndjson");

export interface OpsEvent {
  id: string;
  type: string;
  createdAt: string;
  source: string;
  payload: Record<string, unknown>;
}

function eventId() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export async function appendOpsEvent(input: Omit<OpsEvent, "id" | "createdAt">): Promise<OpsEvent> {
  await fs.mkdir(DATA_ROOT, { recursive: true });
  const event: OpsEvent = {
    id: eventId(),
    createdAt: new Date().toISOString(),
    ...input
  };
  await fs.appendFile(EVENT_FILE, `${JSON.stringify(event)}\n`, "utf-8");
  return event;
}
