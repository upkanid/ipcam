import { createRequestHandler } from "@react-router/express";
import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ noServer: true });
const VALID_SIGNAL_TYPES = /* @__PURE__ */ new Set(["offer", "answer", "candidate"]);
const MAX_MSG_SIZE = 16384;
function validateSignalingMsg(raw) {
  if (raw.length > MAX_MSG_SIZE) return false;
  try {
    const msg = JSON.parse(raw);
    return typeof msg === "object" && msg !== null && typeof msg.type === "string" && VALID_SIGNAL_TYPES.has(msg.type) && "payload" in msg;
  } catch {
    return false;
  }
}
function isValidRoomId(room) {
  return /^[A-Fa-f0-9]{6,16}$/.test(room);
}
const MAX_PEERS_PER_ROOM = 4;
const MAX_ROOMS = 1e4;
const PING_INTERVAL = 3e4;
const ROOM_TTL = 10 * 6e4;
const RATE_LIMIT_WINDOW = 6e4;
const RATE_LIMIT_MAX_CONN = 10;
const rooms = /* @__PURE__ */ new Map();
const roomLastActive = /* @__PURE__ */ new Map();
const connRateMap = /* @__PURE__ */ new Map();
function removePeer(ws, room) {
  const peers = rooms.get(room);
  if (!peers) return;
  peers.delete(ws);
  if (!peers.size) {
    rooms.delete(room);
    roomLastActive.delete(room);
  }
}
function isRateLimited(ip) {
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
function log(level, msg, data) {
  const entry = { ts: (/* @__PURE__ */ new Date()).toISOString(), level, msg, ...data };
  console[level](JSON.stringify(entry));
}
setInterval(() => {
  const now = Date.now();
  for (const [room, lastActive] of roomLastActive) {
    if (now - lastActive > ROOM_TTL) {
      const peers = rooms.get(room);
      if (peers) {
        log("info", "room_expired", { room, peers: peers.size });
        peers.forEach((ws) => ws.close(1e3, "room expired"));
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
}, 6e4);
httpServer.on("upgrade", (req, socket, head) => {
  if (!req.url?.startsWith("/ws")) return socket.destroy();
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
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
    rooms.set(room, /* @__PURE__ */ new Set());
    roomLastActive.set(room, Date.now());
  }
  const peers = rooms.get(room);
  if (peers.size >= MAX_PEERS_PER_ROOM)
    return void ws.close(1013, "room full");
  peers.add(ws);
  ws.__room = room;
  ws.__alive = true;
  ws.on("pong", () => {
    ws.__alive = true;
  });
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
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.__alive === false) {
      const room = ws.__room;
      if (room) removePeer(ws, room);
      return ws.terminate();
    }
    ws.__alive = false;
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
    build: () => import("./build/server/index.js")
  })
);
const port = Number(process.env.PORT ?? 3e3);
httpServer.listen(port, () => {
  log("info", "server_start", { port });
});
function shutdown() {
  log("info", "shutdown", { rooms: rooms.size, clients: wss.clients.size });
  wss.clients.forEach((ws) => ws.close(1001, "server shutting down"));
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5e3);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
