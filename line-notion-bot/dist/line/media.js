import fs from "node:fs/promises";
import path from "node:path";
const DATA_ROOT = process.env.OPS_DATA_ROOT || path.join(process.cwd(), "data");
const MEDIA_ROOT = path.join(DATA_ROOT, "line-media");
const EXT_MAP = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "application/pdf": "pdf",
    "application/octet-stream": "bin"
};
function extFromContentType(ct) {
    const pure = ct.split(";")[0].trim().toLowerCase();
    return EXT_MAP[pure] ?? "bin";
}
export async function downloadAndSaveLineMedia(messageId) {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token)
        throw new Error("LINE_CHANNEL_ACCESS_TOKEN missing");
    const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`LINE media fetch failed ${res.status}: ${text.slice(0, 300)}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const ext = extFromContentType(contentType);
    await fs.mkdir(MEDIA_ROOT, { recursive: true });
    const filePath = path.join(MEDIA_ROOT, `${Date.now()}_${messageId}.${ext}`);
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));
    return {
        filePath,
        contentType,
        size: Buffer.byteLength(Buffer.from(arrayBuffer))
    };
}
