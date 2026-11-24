export type RealtimePayload = {
  type: "message" | "notification" | "post";
  data: unknown;
};

type Hub = { sendToUser: (userId: string, payload: RealtimePayload) => void };
const globalForRealtime = globalThis as unknown as { zoneRealtime?: Hub };

export function sendToUser(userId: string, payload: RealtimePayload) {
  globalForRealtime.zoneRealtime?.sendToUser(userId, payload);
}
