import fs from "node:fs/promises";
import path from "node:path";
const DATA_ROOT = process.env.OPS_DATA_ROOT || path.join(process.cwd(), "data");
const EVENT_FILE = path.join(DATA_ROOT, "ops-events.ndjson");
function eventId() {
    return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
export async function appendOpsEvent(input) {
    await fs.mkdir(DATA_ROOT, { recursive: true });
    const event = {
        id: eventId(),
        createdAt: new Date().toISOString(),
        ...input
    };
    await fs.appendFile(EVENT_FILE, `${JSON.stringify(event)}\n`, "utf-8");
    return event;
}
