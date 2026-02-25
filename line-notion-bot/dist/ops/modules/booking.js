import { dataFile, nowIso, readJsonFile, writeJsonFile } from "./common.js";
const STORE_FILE = dataFile("bookings.json");
function toMinutes(t) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
}
function fromMinutes(v) {
    const h = Math.floor(v / 60);
    const m = v % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function overlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
}
async function loadStore() {
    return readJsonFile(STORE_FILE, { records: [] });
}
async function saveStore(store) {
    await writeJsonFile(STORE_FILE, store);
}
function bookingId() {
    return `BK-${Date.now()}`;
}
export async function findConflicts(input) {
    const store = await loadStore();
    const start = toMinutes(input.start) - input.bufferMinutes;
    const end = toMinutes(input.end) + input.bufferMinutes;
    return store.records.filter((r) => {
        if (r.status !== "confirmed" || r.date !== input.date)
            return false;
        const s = toMinutes(r.start) - r.bufferMinutes;
        const e = toMinutes(r.end) + r.bufferMinutes;
        return overlap(start, end, s, e);
    });
}
export async function suggestAlternativeSlots(input) {
    const ws = toMinutes(input.windowStart ?? "09:00");
    const we = toMinutes(input.windowEnd ?? "18:00");
    const slots = [];
    for (let p = ws; p + input.durationMinutes <= we; p += 30) {
        const start = fromMinutes(p);
        const end = fromMinutes(p + input.durationMinutes);
        const conflicts = await findConflicts({
            date: input.date,
            start,
            end,
            bufferMinutes: input.bufferMinutes
        });
        if (conflicts.length === 0) {
            slots.push({ start, end });
        }
        if (slots.length >= 3)
            break;
    }
    return slots;
}
export async function createBooking(input) {
    const buffer = input.bufferMinutes ?? Number(process.env.BOOKING_BUFFER_MINUTES || 15);
    const conflicts = await findConflicts({
        date: input.date,
        start: input.start,
        end: input.end,
        bufferMinutes: buffer
    });
    if (conflicts.length > 0) {
        const duration = Math.max(30, toMinutes(input.end) - toMinutes(input.start));
        const alternatives = await suggestAlternativeSlots({
            date: input.date,
            durationMinutes: duration,
            bufferMinutes: buffer
        });
        return { ok: false, conflicts, alternatives };
    }
    const store = await loadStore();
    const record = {
        id: bookingId(),
        customer: input.customer,
        date: input.date,
        start: input.start,
        end: input.end,
        bufferMinutes: buffer,
        status: "confirmed",
        source: input.source ?? "api",
        createdAt: nowIso()
    };
    store.records.push(record);
    await saveStore(store);
    return { ok: true, record };
}
export async function bookingsForDate(date) {
    const store = await loadStore();
    return store.records.filter((r) => r.date === date && r.status === "confirmed");
}
