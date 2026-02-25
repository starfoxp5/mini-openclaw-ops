import { dataFile, nowIso, readJsonFile, writeJsonFile } from "./common.js";
const STORE_FILE = dataFile("logistics.json");
async function loadStore() {
    return readJsonFile(STORE_FILE, { trackings: [] });
}
async function saveStore(store) {
    await writeJsonFile(STORE_FILE, store);
}
function mockStatus(trackingNo) {
    const seed = trackingNo.length % 4;
    if (seed === 0)
        return "IN_TRANSIT";
    if (seed === 1)
        return "CUSTOMS_CLEARANCE";
    if (seed === 2)
        return "OUT_FOR_DELIVERY";
    return "DELIVERED";
}
export async function fetchTrackingStatus(input) {
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
export async function updateTracking(input) {
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
    }
    else if (rec.status !== latest.status || rec.location !== latest.location) {
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
