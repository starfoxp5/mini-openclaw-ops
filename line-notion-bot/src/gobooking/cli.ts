import fs from "node:fs/promises";
import path from "node:path";
import { MockBrowserAdapter } from "./adapter.js";
import { runBookingFlow } from "./runner.js";
import type { BookingInput } from "./types.js";

function getArg(flag: string) {
  const args = process.argv.slice(2);
  const idx = args.findIndex((a) => a === flag);
  if (idx < 0 || idx + 1 >= args.length) return "";
  return args[idx + 1];
}

async function readInput(inputPath: string): Promise<BookingInput> {
  const abs = path.isAbsolute(inputPath) ? inputPath : path.join(process.cwd(), inputPath);
  const raw = await fs.readFile(abs, "utf-8");
  return JSON.parse(raw) as BookingInput;
}

async function main() {
  const inputPath = getArg("--input");
  if (!inputPath) {
    console.error("Usage: npm run gobooking:run -- --input <path-to-input-json>");
    process.exitCode = 1;
    return;
  }
  const input = await readInput(inputPath);
  const adapter = new MockBrowserAdapter();
  const result = await runBookingFlow(input, adapter);

  process.stdout.write(`${JSON.stringify(result.output, null, 2)}\n`);
  process.stderr.write(`${JSON.stringify(result.summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
