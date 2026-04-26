import { createRequestHandler } from "@react-router/express";
import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ noServer: true });
const rooms = /* @__PURE__ */ new Map();
httpServer.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/ws")) {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  } else {
    socket.destroy();
  }
});
wss.on("connection", (ws, req) => {
  const room = new URLSearchParams(req.url?.split("?")[1] ?? "").get("room");
  if (!room) return void ws.close(1008, "room required");
  if (!rooms.has(room)) rooms.set(room, /* @__PURE__ */ new Set());
  const peers = rooms.get(room);
  peers.add(ws);
  ws.on("message", (data) => {
    peers.forEach((peer) => {
      if (peer !== ws && peer.readyState === WebSocket.OPEN)
        peer.send(data.toString());
    });
  });
  ws.on("close", () => {
    peers.delete(ws);
    if (!peers.size) rooms.delete(room);
  });
});
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
  console.log(`Server listening on port ${port}`);
});
