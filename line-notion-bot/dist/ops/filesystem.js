import fs from "node:fs/promises";
import path from "node:path";
const DOC_ROOT = process.env.OPS_DOC_ROOT || path.join(process.cwd(), "ops-docs");
const TEMPLATE_ROOT = process.env.OPS_TEMPLATE_ROOT || path.join(process.cwd(), "templates");
const CATEGORY_MAP = {
    quote: "quotes",
    eta_followup: "orders",
    shipping_notice: "shipping",
    rma: "rma"
};
function sanitize(value) {
    return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/(^-|-$)/g, "");
}
function replaceTemplate(raw, vars) {
    return raw.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_m, key) => vars[key] ?? "");
}
async function ensureLayout() {
    const dirs = ["orders", "quotes", "rma", "shipping", "packs"].map((d) => path.join(DOC_ROOT, d));
    await Promise.all(dirs.map((dir) => fs.mkdir(dir, { recursive: true })));
}
async function loadTemplate(kind) {
    const file = path.join(TEMPLATE_ROOT, `${kind}.md`);
    return fs.readFile(file, "utf-8");
}
export async function generateTemplatedDocument(input) {
    await ensureLayout();
    const date = new Date().toISOString().slice(0, 10);
    const customer = sanitize(input.customer || "unknown");
    const orderNo = sanitize(input.orderNo || "no-order");
    const base = `${date}_${customer}_${orderNo}_${input.kind}`;
    const subDir = CATEGORY_MAP[input.kind];
    const template = await loadTemplate(input.kind);
    const content = replaceTemplate(template, {
        ...input.vars,
        date,
        customer: input.customer,
        order_no: input.orderNo
    });
    const docPath = path.join(DOC_ROOT, subDir, `${base}.md`);
    const tracePath = path.join(DOC_ROOT, subDir, `${base}.trace.json`);
    await fs.writeFile(docPath, content, "utf-8");
    await fs.writeFile(tracePath, JSON.stringify({
        generatedAt: new Date().toISOString(),
        customer: input.customer,
        orderNo: input.orderNo,
        kind: input.kind,
        sourceVars: input.vars
    }, null, 2), "utf-8");
    return { docPath, tracePath };
}
export async function packOrderDocuments(orderNo) {
    await ensureLayout();
    const safeOrderNo = sanitize(orderNo);
    const packDir = path.join(DOC_ROOT, "packs", `${new Date().toISOString().slice(0, 10)}_${safeOrderNo}`);
    await fs.mkdir(packDir, { recursive: true });
    const categories = ["orders", "quotes", "rma", "shipping"];
    const matched = [];
    for (const category of categories) {
        const dir = path.join(DOC_ROOT, category);
        const files = await fs.readdir(dir).catch(() => []);
        for (const file of files) {
            if (!file.includes(`_${safeOrderNo}_`))
                continue;
            matched.push(path.join(dir, file));
        }
    }
    const manifestPath = path.join(packDir, "manifest.txt");
    await fs.writeFile(manifestPath, matched.join("\n"), "utf-8");
    return { packDir, manifestPath, count: matched.length };
}
