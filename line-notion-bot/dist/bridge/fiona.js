function bridgeEnabled() {
    return (process.env.FIONA_BRIDGE_ENABLED || "false") === "true";
}
export async function sendToFiona(payload) {
    if (!bridgeEnabled()) {
        return { ok: false, skipped: true, reason: "bridge disabled" };
    }
    const url = process.env.FIONA_BRIDGE_URL;
    if (!url) {
        return { ok: false, skipped: true, reason: "FIONA_BRIDGE_URL missing" };
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
            return { ok: false, skipped: false, reason: `bridge http ${res.status}: ${raw.slice(0, 300)}` };
        }
        let replyText;
        try {
            const json = JSON.parse(raw);
            replyText = json.replyText;
        }
        catch {
            replyText = raw.slice(0, 1000);
        }
        return { ok: true, replyText };
    }
    catch (error) {
        return { ok: false, skipped: false, reason: `bridge error: ${String(error)}` };
    }
    finally {
        clearTimeout(timer);
    }
}
