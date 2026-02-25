import cron from "node-cron";
import { build15Report } from "./report15.js";
import { build17Report } from "./report17.js";
import { pushText } from "../line/reply.js";
import { markCronRun, markError } from "../monitoring/metrics.js";
import { bookingsForDate } from "../ops/modules/booking.js";
import { allTrackings, updateTracking } from "../ops/modules/logistics.js";

function localDate() {
  const d = new Date();
  const tzDate = new Date(d.toLocaleString("en-US", { timeZone: process.env.TZ || "Asia/Taipei" }));
  const yyyy = tzDate.getFullYear();
  const mm = String(tzDate.getMonth() + 1).padStart(2, "0");
  const dd = String(tzDate.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmtDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function startCrons() {
  const groupId = process.env.TARGET_GROUP_ID;
  if (!groupId) return;

  cron.schedule("0 15 * * *", async () => {
    markCronRun();
    try {
      const message = await build15Report(localDate());
      await pushText(groupId, message);
    } catch (error) {
      markError();
      console.error("15:00 report failed", error);
    }
  }, { timezone: process.env.TZ || "Asia/Taipei" });

  cron.schedule("0 17 * * *", async () => {
    markCronRun();
    try {
      const message = await build17Report(localDate());
      await pushText(groupId, message);
    } catch (error) {
      markError();
      console.error("17:00 report failed", error);
    }
  }, { timezone: process.env.TZ || "Asia/Taipei" });

  // Next-day booking reminder.
  cron.schedule("0 19 * * *", async () => {
    markCronRun();
    try {
      const tomorrow = addDays(new Date(), 1);
      const date = fmtDate(new Date(tomorrow.toLocaleString("en-US", { timeZone: process.env.TZ || "Asia/Taipei" })));
      const records = await bookingsForDate(date);
      if (records.length === 0) return;
      const lines = records.slice(0, 10).map((r) => `- ${r.customer} ${r.start}-${r.end}`);
      await pushText(groupId, `📅 明日預約提醒 ${date}\n${lines.join("\n")}`);
    } catch (error) {
      markError();
      console.error("booking reminder failed", error);
    }
  }, { timezone: process.env.TZ || "Asia/Taipei" });

  // Logistics polling and change notifications.
  cron.schedule("*/30 * * * *", async () => {
    markCronRun();
    try {
      const list = await allTrackings();
      for (const item of list) {
        const result = await updateTracking({ carrier: item.carrier, trackingNo: item.trackingNo });
        if (result.changed) {
          await pushText(groupId, `📦 物流狀態變更 ${item.carrier} ${item.trackingNo}: ${result.record.status}`);
        }
      }
    } catch (error) {
      markError();
      console.error("logistics polling failed", error);
    }
  }, { timezone: process.env.TZ || "Asia/Taipei" });
}
