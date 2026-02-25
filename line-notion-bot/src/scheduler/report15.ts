import { queryPendingOrdersByEta } from "../notion/orders.js";
import { ORDERS_PROPS } from "../notion/schemas.js";
import { getNumber, getRichText, getSelect, getTitle } from "../notion/helpers.js";

export async function build15Report(today: string) {
  const rows = await queryPendingOrdersByEta(today);
  if (!rows.length) return "15:00 提醒：目前沒有待出貨項目。";

  const byCompany: Record<string, string[]> = {};
  for (const row of rows as any[]) {
    const company = getSelect(row, ORDERS_PROPS.company) || "Unknown";
    const line = `${getTitle(row, ORDERS_PROPS.title)} ${getRichText(row, ORDERS_PROPS.customer)} ${getRichText(row, ORDERS_PROPS.model)} $${getNumber(row, ORDERS_PROPS.amountExTax).toLocaleString()} 未稅`;
    byCompany[company] = byCompany[company] || [];
    byCompany[company].push(line);
  }

  const sections = Object.entries(byCompany).map(([company, items]) => `${company}\n${items.map((x) => `- ${x}`).join("\n")}`);
  return `⚠️ 15:00 待出貨提醒\n\n${sections.join("\n\n")}`;
}
