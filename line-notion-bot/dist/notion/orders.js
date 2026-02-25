import { ORDERS_PROPS } from "./schemas.js";
import { getNotionClient } from "./client.js";
import { notionEnabled } from "../config/env.js";
function orderId() {
    const d = new Date();
    return `#${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
}
export async function createOrderFromParsed(parsed, groupId, userId) {
    if (!notionEnabled()) {
        return orderId();
    }
    const db = process.env.NOTION_ORDERS_DB_ID;
    if (!db)
        throw new Error("Missing NOTION_ORDERS_DB_ID");
    const notion = getNotionClient();
    const title = orderId();
    const properties = {
        [ORDERS_PROPS.title]: { title: [{ text: { content: title } }] },
        [ORDERS_PROPS.company]: parsed.company ? { select: { name: parsed.company } } : undefined,
        [ORDERS_PROPS.customer]: parsed.customer ? { rich_text: [{ text: { content: parsed.customer } }] } : undefined,
        [ORDERS_PROPS.customerPo]: parsed.customerPo ? { rich_text: [{ text: { content: parsed.customerPo } }] } : undefined,
        [ORDERS_PROPS.model]: parsed.model ? { rich_text: [{ text: { content: parsed.model } }] } : undefined,
        [ORDERS_PROPS.qty]: parsed.qty !== undefined ? { number: parsed.qty } : undefined,
        [ORDERS_PROPS.amountExTax]: parsed.amountExTax !== undefined ? { number: parsed.amountExTax } : undefined,
        [ORDERS_PROPS.status]: { select: { name: parsed.confidence >= 0.75 ? "Received" : "NeedInfo" } },
        [ORDERS_PROPS.currentEta]: parsed.newEta ? { date: { start: parsed.newEta } } : undefined,
        [ORDERS_PROPS.lineGroupId]: { rich_text: [{ text: { content: groupId } }] },
        [ORDERS_PROPS.createdBy]: { rich_text: [{ text: { content: userId } }] }
    };
    await notion.pages.create({
        parent: { database_id: db },
        properties
    });
    return title;
}
export async function queryPendingOrdersByEta(today) {
    if (!notionEnabled()) {
        return [];
    }
    const db = process.env.NOTION_ORDERS_DB_ID;
    if (!db)
        throw new Error("Missing NOTION_ORDERS_DB_ID");
    const notion = getNotionClient();
    const res = await notion.databases.query({
        database_id: db,
        filter: {
            and: [
                {
                    or: [
                        { property: ORDERS_PROPS.status, select: { equals: "ETAConfirmed" } },
                        { property: ORDERS_PROPS.status, select: { equals: "ReadyToShip" } }
                    ]
                },
                { property: ORDERS_PROPS.status, select: { does_not_equal: "Shipped" } },
                { property: ORDERS_PROPS.currentEta, date: { on_or_before: today } }
            ]
        },
        page_size: 100
    });
    return res.results;
}
