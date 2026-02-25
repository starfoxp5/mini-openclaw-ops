export interface FionaAttachment {
  kind: string;
  filePath: string;
  contentType: string;
  size: number;
  fileName?: string;
}

export interface FionaIngressPayload {
  target: string;
  channel: "line";
  userId: string;
  groupId: string;
  text?: string;
  timestamp: number;
  sourceRef: string;
  attachments?: FionaAttachment[];
}

function bridgeEnabled() {
  return (process.env.FIONA_BRIDGE_ENABLED || "false") === "true";
}

export async function sendToFiona(payload: FionaIngressPayload) {
  if (!bridgeEnabled()) {
    return { ok: false as const, skipped: true as const, reason: "bridge disabled" };
  }

  const url = process.env.FIONA_BRIDGE_URL;
  if (!url) {
    return { ok: false as const, skipped: true as const, reason: "FIONA_BRIDGE_URL missing" };
  }

  const timeoutMs = Number(process.env.FIONA_BRIDGE_TIMEOUT_MS || 15000);
  const token = process.env.FIONA_BRIDGE_TOKEN;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const raw = await res.text();
    if (!res.ok) {
      return { ok: false as const, skipped: false as const, reason: `bridge http ${res.status}: ${raw.slice(0, 300)}` };
    }

    let replyText: string | undefined;
    try {
      const json = JSON.parse(raw) as { replyText?: string };
      replyText = json.replyText;
    } catch {
      replyText = raw.slice(0, 1000);
    }

    return { ok: true as const, replyText };
  } catch (error) {
    return { ok: false as const, skipped: false as const, reason: `bridge error: ${String(error)}` };
  } finally {
    clearTimeout(timer);
  }
}
