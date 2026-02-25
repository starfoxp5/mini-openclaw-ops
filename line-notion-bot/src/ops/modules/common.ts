import fs from "node:fs/promises";
import path from "node:path";

const DATA_ROOT = process.env.OPS_DATA_ROOT || path.join(process.cwd(), "data");

export async function ensureDataRoot() {
  await fs.mkdir(DATA_ROOT, { recursive: true });
  return DATA_ROOT;
}

export async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(file: string, value: unknown) {
  await ensureDataRoot();
  await fs.writeFile(file, JSON.stringify(value, null, 2), "utf-8");
}

export function dataFile(name: string) {
  return path.join(DATA_ROOT, name);
}

export function nowIso() {
  return new Date().toISOString();
}
