import fs from "node:fs/promises";
import path from "node:path";

const DATA_ROOT = process.env.OPS_DATA_ROOT || path.join(process.cwd(), "data");
const FILE = path.join(DATA_ROOT, "line-event-dedupe.json");
const MAX_ENTRIES = 5000;
const TTL_MS = 24 * 60 * 60 * 1000;

type DedupeMap = Record<string, number>;

async function readMap(): Promise<DedupeMap> {
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw) as DedupeMap;
  } catch {
    return {};
  }
}

async function writeMap(map: DedupeMap) {
  await fs.mkdir(DATA_ROOT, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(map), "utf-8");
}

export async function isDuplicateAndMark(eventId?: string) {
  if (!eventId) return false;

  const now = Date.now();
  const map = await readMap();

  for (const [k, ts] of Object.entries(map)) {
    if (now - ts > TTL_MS) {
      delete map[k];
    }
  }

  const duplicated = Boolean(map[eventId]);
  map[eventId] = now;

  const keys = Object.keys(map);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => map[a] - map[b])
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((k) => delete map[k]);
  }

  await writeMap(map);
  return duplicated;
}
