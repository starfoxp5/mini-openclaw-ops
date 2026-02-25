export const ORDERS_PROPS = {
  title: "Order ID",
  company: "Company",
  customer: "Customer",
  customerPo: "Customer PO",
  brand: "Brand",
  model: "Model",
  qty: "Qty",
  amountExTax: "Amount ExTax",
  status: "Status",
  currentEta: "Current ETA",
  owner: "Owner",
  lineGroupId: "Line Group ID",
  createdBy: "Created By"
} as const;

export const SHIPMENTS_PROPS = {
  title: "Shipment ID",
  shipDate: "Ship Date",
  company: "Company",
  customer: "Customer",
  amountExTax: "Amount ExTax",
  shipDocNo: "Ship Doc No",
  carrier: "Carrier",
  trackingNo: "Tracking No"
} as const;

export const EVENTS_PROPS = {
  title: "Event ID",
  eventType: "Event Type",
  oldEta: "Old ETA",
  newEta: "New ETA",
  messageText: "Message Text",
  source: "Source",
  createdBy: "Created By"
} as const;
