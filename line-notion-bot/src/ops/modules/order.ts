import { dataFile, nowIso, readJsonFile, writeJsonFile } from "./common.js";

export interface EtaEvidence {
  at: string;
  eta: string;
  sourceType: string;
  sourceRef: string;
  note?: string;
}

export interface OrderRecord {
  orderNo: string;
  customer: string;
  model?: string;
  qty?: number;
  promisedEta?: string;
  latestEta?: string;
  sourceEvidence: EtaEvidence[];
  createdAt: string;
  updatedAt: string;
}

interface OrderStore {
  orders: OrderRecord[];
}

const STORE_FILE = dataFile("orders.json");

async function loadStore(): Promise<OrderStore> {
  return readJsonFile<OrderStore>(STORE_FILE, { orders: [] });
}

async function saveStore(store: OrderStore) {
  await writeJsonFile(STORE_FILE, store);
}

export async function upsertOrder(input: {
  orderNo: string;
  customer: string;
  model?: string;
  qty?: number;
  promisedEta?: string;
  sourceType: string;
  sourceRef: string;
}) {
  const store = await loadStore();
  const now = nowIso();
  let order = store.orders.find((o) => o.orderNo === input.orderNo);
  if (!order) {
    order = {
      orderNo: input.orderNo,
      customer: input.customer,
      model: input.model,
      qty: input.qty,
      promisedEta: input.promisedEta,
      latestEta: input.promisedEta,
      sourceEvidence: [],
      createdAt: now,
      updatedAt: now
    };
    store.orders.push(order);
  }

  order.customer = input.customer || order.customer;
  order.model = input.model ?? order.model;
  order.qty = input.qty ?? order.qty;
  order.promisedEta = input.promisedEta ?? order.promisedEta;
  order.latestEta = input.promisedEta ?? order.latestEta;
  order.updatedAt = now;

  order.sourceEvidence.push({
    at: now,
    eta: order.latestEta ?? "",
    sourceType: input.sourceType,
    sourceRef: input.sourceRef,
    note: "order intake"
  });

  await saveStore(store);
  return order;
}

export async function updateOrderEta(input: {
  orderNo: string;
  eta: string;
  sourceType: string;
  sourceRef: string;
  note?: string;
}) {
  const store = await loadStore();
  const order = store.orders.find((o) => o.orderNo === input.orderNo);
  if (!order) {
    throw new Error(`order not found: ${input.orderNo}`);
  }

  order.latestEta = input.eta;
  order.updatedAt = nowIso();
  order.sourceEvidence.push({
    at: nowIso(),
    eta: input.eta,
    sourceType: input.sourceType,
    sourceRef: input.sourceRef,
    note: input.note
  });

  await saveStore(store);
  return order;
}

export async function getOrder(orderNo: string) {
  const store = await loadStore();
  return store.orders.find((o) => o.orderNo === orderNo) ?? null;
}
