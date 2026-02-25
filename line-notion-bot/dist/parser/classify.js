const RULES = [
    { type: "ETA_CHANGED", keywords: ["改期", "延期", "延後", "->", "→"] },
    { type: "ETA_CONFIRMED", keywords: ["交期", "eta", "到貨"] },
    { type: "PLANNED_SHIP", keywords: ["預計出貨", "預出"] },
    { type: "SHIPPED", keywords: ["出貨", "已出", "出貨通知"] },
    { type: "FACTORY_ORDERED", keywords: ["向原廠下單", "原廠下單", "fluke order", "factory"] },
    { type: "LOGISTICS_UPDATED", keywords: ["物流", "tracking", "黑貓", "順豐", "dhl", "fedex", "ups"] },
    { type: "RECEIVED", keywords: ["收到訂單", "客戶下單", "po#", "訂單"] }
];
export function classifyEventType(text) {
    const lower = text.toLowerCase();
    for (const rule of RULES) {
        if (rule.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
            return rule.type;
        }
    }
    return "UNKNOWN";
}
