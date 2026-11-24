import { createServer } from "node:http";
import { createHash } from "node:crypto";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { closeDb, getDb, now } from "../src/lib/server/db";
import type { RealtimePayload } from "../src/lib/server/realtime";

declare module "ws" {
  interface WebSocket { isAlive: boolean; }
}

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const sockets = new Map<string, Set<WebSocket>>();

function cookieToken(header?: string) {
  return header?.split(";").map((part) => part.trim()).find((part) => part.startsWith("zone_session="))?.split("=")[1];
}

function sendToUser(userId: string, payload: RealtimePayload) {
  const encoded = JSON.stringify(payload);
  for (const socket of sockets.get(userId) || []) {
    if (socket.readyState === WebSocket.OPEN) socket.send(encoded);
  }
}

(globalThis as unknown as { zoneRealtime: { sendToUser: typeof sendToUser } }).zoneRealtime = { sendToUser };

app.prepare().then(() => {
getDb();
const server = createServer((request, response) => handle(request, response));
const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url || "/", `http://${request.headers.host}`).pathname;
  if (pathname !== "/ws") return app.getUpgradeHandler()(request, socket, head);
  const token = cookieToken(request.headers.cookie);
  const user = token ? getDb().prepare("SELECT user_id FROM sessions WHERE token_hash=? AND expires_at > ?")
    .get(createHash("sha256").update(token).digest("hex"), now()) as { user_id: string } | undefined : undefined;
  if (!user) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => {
    const userId = user.user_id;
    const userSockets = sockets.get(userId) || new Set<WebSocket>();
    userSockets.add(ws);
    sockets.set(userId, userSockets);
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });
    ws.send(JSON.stringify({ type: "ready", data: { userId } }));
    ws.on("message", () => ws.send(JSON.stringify({ type: "error", data: { message: "Use the authenticated API to send messages." } })));
    ws.on("close", () => {
      userSockets.delete(ws);
      if (!userSockets.size) sockets.delete(userId);
    });
  });
});

const heartbeat = setInterval(() => {
  for (const userSockets of sockets.values()) for (const ws of userSockets) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

server.listen(port, hostname, () => console.log(`ZONE ready on http://${hostname}:${port}`));

function shutdown() {
  clearInterval(heartbeat);
  for (const userSockets of sockets.values()) for (const ws of userSockets) ws.close(1001, "Server shutting down");
  server.close(() => { closeDb(); process.exit(0); });
  setTimeout(() => { closeDb(); process.exit(1); }, 10000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
}).catch((error) => {
  console.error("ZONE failed to start", error);
  process.exit(1);
});
