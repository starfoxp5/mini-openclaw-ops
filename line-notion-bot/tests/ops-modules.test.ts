import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

const dataRoot = path.join(process.cwd(), "data");

async function resetData() {
  await fs.rm(dataRoot, { recursive: true, force: true });
}

describe("ops modules", () => {
  beforeEach(async () => {
    await resetData();
  });

  it("booking conflict and alternatives", async () => {
    const { createBooking } = await import("../src/ops/modules/booking.js");
    const first = await createBooking({
      customer: "Acme",
      date: "2026-02-26",
      start: "10:00",
      end: "11:00"
    });
    expect(first.ok).toBe(true);

    const second = await createBooking({
      customer: "Acme",
      date: "2026-02-26",
      start: "10:30",
      end: "11:30"
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.alternatives.length).toBeGreaterThan(0);
    }
  });

  it("order ETA keeps source evidence", async () => {
    const { upsertOrder, updateOrderEta, getOrder } = await import("../src/ops/modules/order.js");
    await upsertOrder({
      orderNo: "PO-001",
      customer: "Acme",
      promisedEta: "2026-03-01",
      sourceType: "line",
      sourceRef: "msg-1"
    });
    await updateOrderEta({
      orderNo: "PO-001",
      eta: "2026-03-10",
      sourceType: "mail",
      sourceRef: "mail-22"
    });

    const order = await getOrder("PO-001");
    expect(order?.latestEta).toBe("2026-03-10");
    expect(order?.sourceEvidence.length).toBeGreaterThanOrEqual(2);
  });

  it("logistics tracking updates", async () => {
    const { updateTracking } = await import("../src/ops/modules/logistics.js");
    const result = await updateTracking({ carrier: "DHL", trackingNo: "DHL12345678" });
    expect(result.record.status.length).toBeGreaterThan(0);
  });
});
