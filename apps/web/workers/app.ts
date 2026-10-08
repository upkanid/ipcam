import { createRequestHandler } from "react-router";

import { isValidRoomId } from "../app/lib/signaling-utils";
import { SignalingRoom } from "./signaling-room";

export interface Env {
  SIGNALING_ROOMS: DurableObjectNamespace<SignalingRoom>;
  TURN_KEY_ID?: string;
  TURN_KEY_API_TOKEN?: string;
}

declare module "react-router" {
  interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

async function handleWebSocket(request: Request, env: Env): Promise<Response> {
  if (
    request.method !== "GET" ||
    request.headers.get("Upgrade")?.toLowerCase() !== "websocket"
  ) {
    return new Response("WebSocket upgrade required", { status: 426 });
  }

  const room = new URL(request.url).searchParams.get("room");
  if (!room || !isValidRoomId(room)) {
    return new Response("Valid room id required", { status: 400 });
  }

  const forwardedFor = request.headers.get("X-Forwarded-For");
  const clientIp =
    request.headers.get("CF-Connecting-IP") ??
    forwardedFor?.split(",")[0]?.trim() ??
    "unknown";
  const rateLimitId = env.SIGNALING_ROOMS.idFromName(`rate-limit:${clientIp}`);
  const rateLimitResponse = await env.SIGNALING_ROOMS.get(rateLimitId).fetch(
    new Request(new URL("/rate-limit", request.url), { method: "POST" }),
  );
  if (!rateLimitResponse.ok) return rateLimitResponse;

  const id = env.SIGNALING_ROOMS.idFromName(room);
  return env.SIGNALING_ROOMS.get(id).fetch(request);
}

async function handleIceServers(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const url = new URL(request.url);
  const room = url.searchParams.get("room");
  if (!room || !isValidRoomId(room)) return new Response("Valid room id required", { status: 400 });
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) {
    return new Response("TURN is not configured", { status: 503 });
  }

  const clientIp = request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimitId = env.SIGNALING_ROOMS.idFromName(`ice-limit:${clientIp}`);
  const rateLimitResponse = await env.SIGNALING_ROOMS.get(rateLimitId).fetch(
    new Request(new URL("/rate-limit", request.url), { method: "POST" }),
  );
  if (!rateLimitResponse.ok) return rateLimitResponse;

  const upstream = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: 86_400 }),
    },
  );
  if (!upstream.ok) return new Response("TURN credential request failed", { status: 502 });
  const data = await upstream.json() as { iceServers?: unknown };
  if (!Array.isArray(data.iceServers)) {
    return new Response("Invalid TURN credential response", { status: 502 });
  }
  return Response.json({ iceServers: data.iceServers }, {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" },
  });
}

export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      return handleWebSocket(request, env);
    }

    if (url.pathname === "/ice-servers") {
      return handleIceServers(request, env);
    }

    if (url.pathname === "/healthz") {
      return Response.json({ ok: true });
    }

    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
} satisfies ExportedHandler<Env>;

export { SignalingRoom };
