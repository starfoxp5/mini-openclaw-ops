import { dataFile, nowIso, readJsonFile, writeJsonFile } from "./common.js";

export interface BookingRecord {
  id: string;
  customer: string;
  date: string;
  start: string;
  end: string;
  bufferMinutes: number;
  status: "confirmed" | "cancelled";
  source: string;
  createdAt: string;
}

interface BookingStore {
  records: BookingRecord[];
}

const STORE_FILE = dataFile("bookings.json");

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(v: number) {
  const h = Math.floor(v / 60);
  const m = v % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

async function loadStore(): Promise<BookingStore> {
  return readJsonFile<BookingStore>(STORE_FILE, { records: [] });
}

async function saveStore(store: BookingStore) {
  await writeJsonFile(STORE_FILE, store);
}

function bookingId() {
  return `BK-${Date.now()}`;
}

export async function findConflicts(input: {
  date: string;
  start: string;
  end: string;
  bufferMinutes: number;
}) {
  const store = await loadStore();
  const start = toMinutes(input.start) - input.bufferMinutes;
  const end = toMinutes(input.end) + input.bufferMinutes;

  return store.records.filter((r) => {
    if (r.status !== "confirmed" || r.date !== input.date) return false;
    const s = toMinutes(r.start) - r.bufferMinutes;
    const e = toMinutes(r.end) + r.bufferMinutes;
    return overlap(start, end, s, e);
  });
}

export async function suggestAlternativeSlots(input: {
  date: string;
  durationMinutes: number;
  bufferMinutes: number;
  windowStart?: string;
  windowEnd?: string;
}) {
  const ws = toMinutes(input.windowStart ?? "09:00");
  const we = toMinutes(input.windowEnd ?? "18:00");
  const slots: Array<{ start: string; end: string }> = [];

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
    if (slots.length >= 3) break;
  }

  return slots;
}

export async function createBooking(input: {
  customer: string;
  date: string;
  start: string;
  end: string;
  bufferMinutes?: number;
  source?: string;
}) {
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
    return { ok: false as const, conflicts, alternatives };
  }

  const store = await loadStore();
  const record: BookingRecord = {
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
  return { ok: true as const, record };
}

export async function bookingsForDate(date: string) {
  const store = await loadStore();
  return store.records.filter((r) => r.date === date && r.status === "confirmed");
}
