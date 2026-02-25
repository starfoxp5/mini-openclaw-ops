import { messagingApi } from "@line/bot-sdk";

let client: messagingApi.MessagingApiClient | null = null;

export function getLineClient() {
  if (!client) {
    client = new messagingApi.MessagingApiClient({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || ""
    });
  }
  return client;
}

export async function replyText(replyToken: string, text: string) {
  if (!replyToken) return;
  await getLineClient().replyMessage({
    replyToken,
    messages: [{ type: "text", text }]
  });
}

export async function pushText(to: string, text: string) {
  await getLineClient().pushMessage({
    to,
    messages: [{ type: "text", text }]
  });
}
