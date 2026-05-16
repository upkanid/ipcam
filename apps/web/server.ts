import { createRequestHandler } from "@react-router/express";
import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ noServer: true });

const VALID_SIGNAL_TYPES = new Set(["offer", "answer", "candidate"]);
const MAX_MSG_SIZE = 16_384; // 16 KB
const MAX_PEERS_PER_ROOM = 2;
const MAX_ROOMS = 10_000;
const PING_INTERVAL = 30_000; // 30s
const ROOM_TTL = 10 * 60_000; // 10 min idle → auto-delete

// room → set of connected peers
const rooms = new Map<string, Set<WebSocket>>();
const roomLastActive = new Map<string, number>();

function validateSignalingMsg(raw: string): boolean {
  if (raw.length > MAX_MSG_SIZE) return false;
  try {
    const msg = JSON.parse(raw);
    return (
      typeof msg === "object" &&
      msg !== null &&
      typeof msg.type === "string" &&
      VALID_SIGNAL_TYPES.has(msg.type) &&
      "payload" in msg
    );
  } catch {
    return false;
  }
}

function removePeer(ws: WebSocket, room: string) {
  const peers = rooms.get(room);
  if (!peers) return;
  peers.delete(ws);
  if (!peers.size) {
    rooms.delete(room);
    roomLastActive.delete(room);
  }
}

// Periodic stale room cleanup
setInterval(() => {
  const now = Date.now();
  for (const [room, lastActive] of roomLastActive) {
    if (now - lastActive > ROOM_TTL) {
      const peers = rooms.get(room);
      if (peers) peers.forEach((ws) => ws.close(1000, "room expired"));
      rooms.delete(room);
      roomLastActive.delete(room);
    }
  }
}, 60_000);

httpServer.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/ws")) {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  } else {
    socket.destroy();
  }
});

wss.on("connection", (ws, req) => {
  const room = new URLSearchParams(req.url?.split("?")[1] ?? "").get("room");
  if (!room || !/^[A-Fa-f0-9]{6,16}$/.test(room))
    return void ws.close(1008, "valid room id required");

  if (!rooms.has(room) && rooms.size >= MAX_ROOMS)
    return void ws.close(1013, "server full");

  if (!rooms.has(room)) {
    rooms.set(room, new Set());
    roomLastActive.set(room, Date.now());
  }
  const peers = rooms.get(room)!;

  if (peers.size >= MAX_PEERS_PER_ROOM)
    return void ws.close(1013, "room full");

  peers.add(ws);
  (ws as any).__room = room;
  (ws as any).__alive = true;

  ws.on("pong", () => { (ws as any).__alive = true; });

  ws.on("message", (data) => {
    const raw = data.toString();
    if (!validateSignalingMsg(raw)) return;
    roomLastActive.set(room, Date.now());
    peers.forEach((peer) => {
      if (peer !== ws && peer.readyState === WebSocket.OPEN)
        peer.send(raw);
    });
  });

  ws.on("close", () => removePeer(ws, room));
  ws.on("error", () => removePeer(ws, room));
});

// Heartbeat: ping all clients, close unresponsive ones
setInterval(() => {
  wss.clients.forEach((ws) => {
    if ((ws as any).__alive === false) {
      const room = (ws as any).__room;
      if (room) removePeer(ws, room);
      return ws.terminate();
    }
    (ws as any).__alive = false;
    ws.ping();
  });
}, PING_INTERVAL);

app.use(
  "/assets",
  express.static("build/client/assets", { immutable: true, maxAge: "1y" })
);
app.use(express.static("build/client", { maxAge: "1h" }));

app.all(
  "*",
  createRequestHandler({
    build: () => import("./build/server/index.js"),
  })
);

const port = Number(process.env.PORT ?? 3000);
httpServer.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

// Graceful shutdown
function shutdown() {
  console.log("Shutting down gracefully...");
  wss.clients.forEach((ws) => ws.close(1001, "server shutting down"));
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
