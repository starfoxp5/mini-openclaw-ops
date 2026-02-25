import crypto from "node:crypto";
export function verifyLineSignature(rawBody, signature, channelSecret) {
    if (!signature || !channelSecret)
        return false;
    const hash = crypto.createHmac("SHA256", channelSecret).update(rawBody).digest("base64");
    return hash === signature;
}
