import { createRequestHandler } from "react-router";

import { isValidRoomId } from "../app/lib/signaling-utils";
import { SignalingRoom } from "./signaling-room";

export interface Env {
  SIGNALING_ROOMS: DurableObjectNamespace<SignalingRoom>;
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

export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      return handleWebSocket(request, env);
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
