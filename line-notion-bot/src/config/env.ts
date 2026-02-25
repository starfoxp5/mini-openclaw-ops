const REQUIRED_ENV = [
  "LINE_CHANNEL_SECRET",
  "LINE_CHANNEL_ACCESS_TOKEN"
] as const;

function hasPlaceholder(value: string) {
  return (
    value.includes("your_") ||
    value.includes("example") ||
    value.trim().length === 0
  );
}

export function validateEnv() {
  const missing: string[] = [];
  for (const key of REQUIRED_ENV) {
    const value = process.env[key] ?? "";
    if (!value || hasPlaceholder(value)) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Invalid env: ${missing.join(", ")}`);
  }
}

export function notionEnabled() {
  return Boolean(
    process.env.NOTION_TOKEN &&
    process.env.NOTION_ORDERS_DB_ID &&
    process.env.NOTION_SHIPMENTS_DB_ID &&
    process.env.NOTION_EVENTS_DB_ID
  );
}

export function providerHealthConfig() {
  return {
    openaiKey: process.env.OPENAI_API_KEY,
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    googleKey: process.env.GOOGLE_API_KEY,
    preferred: process.env.PREFERRED_PROVIDER ?? "openai",
    fallback: process.env.FALLBACK_PROVIDER ?? "anthropic"
  };
}
