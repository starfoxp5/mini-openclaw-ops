import type { Company } from "../types.js";

const mem = new Map<string, Company>();

export function getLastCompany(userId: string): Company | undefined {
  return mem.get(userId);
}

export function setLastCompany(userId: string, company: Company) {
  mem.set(userId, company);
}
