import { queryShipmentsByDateRange } from "../notion/shipments.js";
import { SHIPMENTS_PROPS } from "../notion/schemas.js";
import { getNumber, getSelect } from "../notion/helpers.js";
function sumByCompany(rows) {
    const sums = {};
    for (const row of rows) {
        const c = getSelect(row, SHIPMENTS_PROPS.company) || "Unknown";
        sums[c] = (sums[c] || 0) + getNumber(row, SHIPMENTS_PROPS.amountExTax);
    }
    return sums;
}
function fmt(sums) {
    const total = Object.values(sums).reduce((a, b) => a + b, 0);
    const lines = Object.entries(sums).map(([c, n]) => `${c}：$${n.toLocaleString()}`);
    lines.push(`合計：$${total.toLocaleString()}`);
    return lines.join("\n");
}
export async function build17Report(today) {
    const monthStart = `${today.slice(0, 8)}01`;
    const todayRows = (await queryShipmentsByDateRange(today, today));
    const monthRows = (await queryShipmentsByDateRange(monthStart, today));
    const todaySums = sumByCompany(todayRows);
    const monthSums = sumByCompany(monthRows);
    return `📊 17:00 出貨報表（未稅）\n\n今日出貨\n${fmt(todaySums)}\n\n本月累計\n${fmt(monthSums)}`;
}
