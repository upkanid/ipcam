export const DEFAULT_PORT = 3717;
export const DEFAULT_HOST = "https://ipcam.upkan.id";

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export const MAX_RECONNECT_ATTEMPTS = 8;
export const RECONNECT_BASE_DELAY = 1000;
export const CONNECTION_TIMEOUT = 15_000;

export type Status = "idle" | "waiting" | "connected";
export type VCamStatus = "idle" | "starting" | "active" | "error" | "unsupported";

export interface VCamInfo {
  supported: boolean;
  reason: string;
  device?: string;
  backend?: "ffmpeg" | "pyvirtualcam";
}

export type VMicStatus = "idle" | "starting" | "active" | "error" | "unsupported";

export interface VMicInfo {
  supported: boolean;
  reason: string;
  device?: string;
}
