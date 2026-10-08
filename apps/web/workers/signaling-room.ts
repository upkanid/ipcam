import { DurableObject } from "cloudflare:workers";

import {
  isValidRoomId,
  validateSignalingMsg,
} from "../app/lib/signaling-utils";

const MAX_PEERS_PER_ROOM = 4;
const ROOM_TTL = 10 * 60_000;
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX_CONN = 10;

type RateLimitRecord = {
  timestamps: number[];
};

export class SignalingRoom extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/rate-limit") {
      return this.checkRateLimit();
    }

    const room = url.searchParams.get("room");

    if (
      request.method !== "GET" ||
      request.headers.get("Upgrade")?.toLowerCase() !== "websocket"
    ) {
      return new Response("WebSocket upgrade required", { status: 426 });
    }

    if (!room || !isValidRoomId(room)) {
      return new Response("Valid room id required", { status: 400 });
    }

    const peers = this.ctx.getWebSockets();
    if (peers.length >= MAX_PEERS_PER_ROOM) {
      return new Response("Room full", { status: 503 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair) as [
      WebSocket,
      WebSocket,
    ];

    this.ctx.acceptWebSocket(server);
    for (const peer of peers) {
      if (peer.readyState === WebSocket.OPEN) {
        peer.send(JSON.stringify({ type: "peer_joined", payload: {} }));
      }
    }

    await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const raw =
      typeof message === "string" ? message : new TextDecoder().decode(message);

    if (!validateSignalingMsg(raw)) return;

    await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL);

    for (const peer of this.ctx.getWebSockets()) {
      if (peer !== ws && peer.readyState === WebSocket.OPEN) {
        peer.send(raw);
      }
    }
  }

  async webSocketClose() {
    if (!this.ctx.getWebSockets().length) {
      await this.ctx.storage.deleteAlarm();
    }
  }

  private async checkRateLimit(): Promise<Response> {
    const now = Date.now();
    const record = (await this.ctx.storage.get<RateLimitRecord>("rate-limit")) ?? {
      timestamps: [],
    };
    const timestamps = record.timestamps.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW,
    );

    if (timestamps.length >= RATE_LIMIT_MAX_CONN) {
      await this.ctx.storage.put("rate-limit", { timestamps });
      return new Response("Too many connections", { status: 429 });
    }

    timestamps.push(now);
    await this.ctx.storage.put("rate-limit", { timestamps });
    return new Response(null, { status: 204 });
  }

  async alarm() {
    for (const peer of this.ctx.getWebSockets()) {
      peer.close(1000, "room expired");
    }
    await this.ctx.storage.deleteAlarm();
  }
}
