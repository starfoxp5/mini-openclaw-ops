import crypto from "node:crypto";

export function verifyLineSignature(rawBody: string, signature: string | undefined, channelSecret: string): boolean {
  if (!signature || !channelSecret) return false;
  const hash = crypto.createHmac("SHA256", channelSecret).update(rawBody).digest("base64");
  return hash === signature;
}
