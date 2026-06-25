import { createRequestHandler } from "@react-router/express";
import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ noServer: true });

const VALID_SIGNAL_TYPES = new Set(["offer", "answer", "candidate", "peer_joined"]);
const MAX_MSG_SIZE = 16_384; // 16 KB

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

function isValidRoomId(room: string): boolean {
  return /^[A-Fa-f0-9]{6,16}$/.test(room);
}
const MAX_PEERS_PER_ROOM = 4;
const MAX_ROOMS = 10_000;
const PING_INTERVAL = 30_000; // 30s
const ROOM_TTL = 10 * 60_000; // 10 min idle → auto-delete
const RATE_LIMIT_WINDOW = 60_000; // 1 min
const RATE_LIMIT_MAX_CONN = 10; // max connections per IP per window

// room → set of connected peers
const rooms = new Map<string, Set<WebSocket>>();
const roomLastActive = new Map<string, number>();

// IP → connection timestamps (for rate limiting)
const connRateMap = new Map<string, number[]>();



function removePeer(ws: WebSocket, room: string) {
  const peers = rooms.get(room);
  if (!peers) return;
  peers.delete(ws);
  if (!peers.size) {
    rooms.delete(room);
    roomLastActive.delete(room);
  }
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = connRateMap.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  if (recent.length >= RATE_LIMIT_MAX_CONN) {
    connRateMap.set(ip, recent);
    return true;
  }
  recent.push(now);
  connRateMap.set(ip, recent);
  return false;
}

function log(level: "info" | "warn" | "error", msg: string, data?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, msg, ...data };
  console[level](JSON.stringify(entry));
}

// Periodic stale room cleanup + rate limit map pruning
setInterval(() => {
  const now = Date.now();
  for (const [room, lastActive] of roomLastActive) {
    if (now - lastActive > ROOM_TTL) {
      const peers = rooms.get(room);
      if (peers) {
        log("info", "room_expired", { room, peers: peers.size });
        peers.forEach((ws) => ws.close(1000, "room expired"));
      }
      rooms.delete(room);
      roomLastActive.delete(room);
    }
  }
  for (const [ip, timestamps] of connRateMap) {
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
    if (!recent.length) connRateMap.delete(ip);
    else connRateMap.set(ip, recent);
  }
}, 60_000);

httpServer.on("upgrade", (req, socket, head) => {
  if (!req.url?.startsWith("/ws")) return socket.destroy();

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    ?? req.socket.remoteAddress ?? "unknown";
  if (isRateLimited(ip)) {
    log("warn", "rate_limited", { ip });
    socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
    return socket.destroy();
  }

  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

wss.on("connection", (ws, req) => {
  const room = new URLSearchParams(req.url?.split("?")[1] ?? "").get("room");
  if (!room || !isValidRoomId(room))
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

  // Notify existing peers that a new peer has joined (helps trigger a new offer immediately)
  peers.forEach((peer) => {
    if (peer.readyState === WebSocket.OPEN) {
      peer.send(JSON.stringify({ type: "peer_joined", payload: {} }));
    }
  });

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
  log("info", "server_start", { port });
});

// Graceful shutdown
function shutdown() {
  log("info", "shutdown", { rooms: rooms.size, clients: wss.clients.size });
  wss.clients.forEach((ws) => ws.close(1001, "server shutting down"));
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
