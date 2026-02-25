import { dataFile, nowIso, readJsonFile, writeJsonFile } from "./common.js";

export interface TrackingRecord {
  carrier: string;
  trackingNo: string;
  status: string;
  location?: string;
  updatedAt: string;
  history: Array<{ at: string; status: string; location?: string }>;
}

interface LogisticsStore {
  trackings: TrackingRecord[];
}

const STORE_FILE = dataFile("logistics.json");

async function loadStore(): Promise<LogisticsStore> {
  return readJsonFile<LogisticsStore>(STORE_FILE, { trackings: [] });
}

async function saveStore(store: LogisticsStore) {
  await writeJsonFile(STORE_FILE, store);
}

function mockStatus(trackingNo: string) {
  const seed = trackingNo.length % 4;
  if (seed === 0) return "IN_TRANSIT";
  if (seed === 1) return "CUSTOMS_CLEARANCE";
  if (seed === 2) return "OUT_FOR_DELIVERY";
  return "DELIVERED";
}

export async function fetchTrackingStatus(input: { carrier: string; trackingNo: string }) {
  const useMock = (process.env.LOGISTICS_USE_MOCK || "true") === "true";
  if (useMock) {
    return {
      carrier: input.carrier,
      trackingNo: input.trackingNo,
      status: mockStatus(input.trackingNo),
      location: "TW"
    };
  }

  throw new Error("real carrier API not configured yet");
}

export async function updateTracking(input: { carrier: string; trackingNo: string }) {
  const store = await loadStore();
  const latest = await fetchTrackingStatus(input);
  const now = nowIso();
  let rec = store.trackings.find((t) => t.carrier === input.carrier && t.trackingNo === input.trackingNo);
  let changed = false;

  if (!rec) {
    rec = {
      carrier: latest.carrier,
      trackingNo: latest.trackingNo,
      status: latest.status,
      location: latest.location,
      updatedAt: now,
      history: [{ at: now, status: latest.status, location: latest.location }]
    };
    store.trackings.push(rec);
    changed = true;
  } else if (rec.status !== latest.status || rec.location !== latest.location) {
    rec.status = latest.status;
    rec.location = latest.location;
    rec.updatedAt = now;
    rec.history.push({ at: now, status: latest.status, location: latest.location });
    changed = true;
  }

  await saveStore(store);
  return { record: rec, changed };
}

export async function allTrackings() {
  const store = await loadStore();
  return store.trackings;
}
