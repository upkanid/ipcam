import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/share";
import {
  ICE_SERVERS,
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_BASE_DELAY,
  CONNECTION_TIMEOUT,
  buildSignalingWsUrl,
} from "~/lib/webrtc-utils";
import {
  generateHexId,
  getPeerId,
  unwrapSignalingPayload,
} from "~/lib/peer-signaling-utils";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Share Camera — IPCam Upkan" }];
}

type Status = "idle" | "connecting" | "streaming";
type Quality = "360" | "720" | "1080";

interface MediaSettings {
  audio: boolean;
  video: boolean;
  cameraId: string;
  quality: Quality;
}

const QUALITY_MAP: Record<Quality, { width: number; height: number }> = {
  "360": { width: 640, height: 360 },
  "720": { width: 1280, height: 720 },
  "1080": { width: 1920, height: 1080 },
};

type SenderPeerState = {
  pc: RTCPeerConnection;
  pendingCandidates: RTCIceCandidateInit[];
};

export default function Share() {
  const [params, setSearchParams] = useSearchParams();
  const room = params.get("room");
  const defaultIp = [params.get("ip"), params.get("port")]
    .filter(Boolean)
    .join(":");

  // Auto generate room if missing on HTTPS/cloud
  useEffect(() => {
    if (!room) {
      setSearchParams({ room: generateHexId() }, { replace: true });
    }
  }, [room, setSearchParams]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const peerConnectionsRef = useRef<Map<string, SenderPeerState>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef(0);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalStopRef = useRef(false);

  const [ip, setIp] = useState(defaultIp);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [reconnecting, setReconnecting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [media, setMedia] = useState<MediaSettings>(() => {
    if (typeof window === "undefined") return { audio: false, video: true, cameraId: "environment", quality: "720" };
    try {
      const saved = localStorage.getItem("ipcam_media_settings");
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return { audio: false, video: true, cameraId: "environment", quality: "720" };
  });
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraDetecting, setCameraDetecting] = useState(false);
  const [trackState, setTrackState] = useState<{ audio: boolean; video: boolean }>({ audio: false, video: false });

  // Monitor actual track state (event-based, no polling)
  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) { setTrackState({ audio: false, video: false }); return; }
    const update = () => {
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];
      setTrackState({
        audio: !!(audioTrack && audioTrack.enabled && audioTrack.readyState === "live"),
        video: !!(videoTrack && videoTrack.enabled && videoTrack.readyState === "live"),
      });
    };
    update();
    stream.getTracks().forEach((t) => {
      t.addEventListener("ended", update);
      t.addEventListener("mute", update);
      t.addEventListener("unmute", update);
    });
    return () => stream.getTracks().forEach((t) => {
      t.removeEventListener("ended", update);
      t.removeEventListener("mute", update);
      t.removeEventListener("unmute", update);
    });
  }, [status]);

  // Persist media settings
  useEffect(() => {
    try { localStorage.setItem("ipcam_media_settings", JSON.stringify(media)); } catch { /* ignore */ }
  }, [media]);

  // Wake Lock helpers
  const acquireWakeLock = useCallback(async () => {
    if ("wakeLock" in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      } catch { /* device may not support it */ }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release();
    wakeLockRef.current = null;
  }, []);

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible" && streamRef.current) {
        acquireWakeLock();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [acquireWakeLock]);

  // Cleanup on unmount / navigate away
  useEffect(() => {
    return () => {
      intentionalStopRef.current = true;
      cleanupConnection();
      releaseWakeLock();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanupConnection() {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    pcRef.current?.close();
    pcRef.current = null;
    peerConnectionsRef.current.forEach(({ pc }) => pc.close());
    peerConnectionsRef.current.clear();
    wsRef.current?.close();
    wsRef.current = null;
  }

  function stopTracks() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function detectCameras() {
    setCameraDetecting(true);
    if (!navigator.mediaDevices) {
      setCameraDetecting(false);
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach((t) => t.stop());
    } catch {
      // Permission denied — enumerate anyway (labels may be empty)
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((d) => d.kind === "videoinput");
    setCameras(videoDevices);
    const rearCam = videoDevices.find(
      (d) =>
        d.label.toLowerCase().includes("back") ||
        d.label.toLowerCase().includes("rear") ||
        d.label.toLowerCase().includes("environment"),
    );
    if (rearCam) setMedia((m) => ({ ...m, cameraId: rearCam.deviceId }));
    setCameraDetecting(false);
  }

  function buildWsUrl(): string {
    return buildSignalingWsUrl(room, ip, window.location);
  }

  function scheduleReconnect() {
    if (intentionalStopRef.current) return;
    if (reconnectCountRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setError("Gagal reconnect setelah beberapa percobaan. Coba hubungkan ulang secara manual.");
      setReconnecting(false);
      setStatus("idle");
      stopTracks();
      releaseWakeLock();
      return;
    }
    // Cap exponential delay at max 3 seconds for responsive reconnects
    const exponentialDelay = RECONNECT_BASE_DELAY * Math.pow(1.5, reconnectCountRef.current);
    const delay = Math.min(3000, exponentialDelay);
    reconnectCountRef.current += 1;
    setReconnecting(true);
    setError(`Koneksi terputus. Menghubungkan ulang dalam ${(delay / 1000).toFixed(1)}s... (${reconnectCountRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      connectSignaling();
    }, delay);
  }

  async function startSharing() {
    if (!room && !ip.trim()) return;
    if (!media.audio && !media.video) return;
    setError("");
    setStatus("connecting");
    intentionalStopRef.current = false;
    reconnectCountRef.current = 0;
    setReconnecting(false);

    const { width, height } = QUALITY_MAP[media.quality];
    const isFacingMode =
      media.cameraId === "environment" || media.cameraId === "user";
    const videoConstraints = media.video
      ? {
          width: { ideal: width },
          height: { ideal: height },
          ...(isFacingMode
            ? { facingMode: media.cameraId }
            : media.cameraId
              ? { deviceId: { exact: media.cameraId } }
              : {}),
        }
      : false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: media.audio,
      });
    } catch {
      setError("Akses kamera/mikrofon ditolak. Pastikan izin sudah diberikan.");
      setStatus("idle");
      return;
    }

    streamRef.current = stream;
    if (videoRef.current) videoRef.current.srcObject = stream;
    await acquireWakeLock();
    connectSignaling();
  }

  function connectSignaling() {
    if (!streamRef.current) return;
    const stream = streamRef.current;

    cleanupConnection();
    setStatus("connecting");

    // Connection timeout
    connectionTimeoutRef.current = setTimeout(() => {
      connectionTimeoutRef.current = null;
      cleanupConnection();
      scheduleReconnect();
    }, CONNECTION_TIMEOUT);

    const ws = new WebSocket(buildWsUrl());
    wsRef.current = ws;

    const createPeerConnection = (viewerId: string) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const state: SenderPeerState = { pc, pendingCandidates: [] };
      peerConnectionsRef.current.set(viewerId, state);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = (ev) => {
        if (ev.candidate && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "candidate",
            payload: { targetPeerId: viewerId, candidate: ev.candidate },
          }));
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          reconnectCountRef.current = 0;
          setReconnecting(false);
          setError("");
          setStatus("streaming");
          // Cap video bitrate to avoid unnecessary CPU/heat
          const maxKbps = media.quality === "1080" ? 4000 : media.quality === "720" ? 2000 : 800;
          pc.getSenders().forEach(async (sender) => {
            if (sender.track?.kind !== "video") return;
            const params = sender.getParameters();
            if (!params.encodings?.length) params.encodings = [{}];
            params.encodings[0].maxBitrate = maxKbps * 1000;
            await sender.setParameters(params).catch(() => {});
          });
        } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          pc.close();
          peerConnectionsRef.current.delete(viewerId);
          if (pcRef.current === pc) pcRef.current = null;
          if (!peerConnectionsRef.current.size) setStatus("connecting");
        }
      };

      return state;
    };

    const addPendingCandidates = async (state: SenderPeerState) => {
      while (state.pendingCandidates.length && state.pc.remoteDescription) {
        const candidate = state.pendingCandidates.shift();
        if (candidate) await state.pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    const getActivePeerConnection = (viewerId: string) => {
      const current = peerConnectionsRef.current.get(viewerId);
      if (current && current.pc.signalingState !== "closed") return current;
      return createPeerConnection(viewerId);
    };

    const sendOffer = async (viewerId: string, iceRestart = false) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const { pc } = getActivePeerConnection(viewerId);
      const offer = await pc.createOffer({ iceRestart });
      await pc.setLocalDescription(offer);
      ws.send(JSON.stringify({
        type: "offer",
        payload: { targetPeerId: viewerId, description: offer },
      }));
    };

    ws.onopen = () => {
      setError("Menunggu viewer bergabung...");
    };

    ws.onmessage = async (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const payload = msg.payload ?? {};
        const viewerId = getPeerId(payload);
        if (msg.type === "answer") {
          const state = getActivePeerConnection(viewerId);
          const description = unwrapSignalingPayload<RTCSessionDescriptionInit>(payload, "description");
          await state.pc.setRemoteDescription(new RTCSessionDescription(description));
          await addPendingCandidates(state);
        } else if (msg.type === "candidate") {
          const state = getActivePeerConnection(viewerId);
          const candidate = unwrapSignalingPayload<RTCIceCandidateInit>(payload, "candidate");
          if (state.pc.remoteDescription) {
            await state.pc.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            state.pendingCandidates.push(candidate);
          }
        } else if (msg.type === "viewer_ready" || (msg.type === "peer_joined" && payload.peerId)) {
          // A viewer is ready. Send a fresh offer from a live peer connection.
          try {
            await sendOffer(viewerId, true);
          } catch {
            // negotiation failed, fallback to reconnect if broken
          }
        }
      } catch {
        // Ignore malformed signaling messages
      }
    };

    ws.onerror = () => {
      cleanupConnection();
      scheduleReconnect();
    };

    ws.onclose = (ev) => {
      if (!ev.wasClean && !intentionalStopRef.current) {
        cleanupConnection();
        scheduleReconnect();
      }
    };
  }

  function stopSharing() {
    intentionalStopRef.current = true;
    setReconnecting(false);
    cleanupConnection();
    stopTracks();
    releaseWakeLock();
    setStatus("idle");
    setError("");
  }

  const isStreaming = status === "streaming";
  const isConnecting = status === "connecting";
  const hasStream = isStreaming || isConnecting || reconnecting;
  const isActive = isStreaming || isConnecting;

  return (
    <div style={s.root}>
      {/* ── Header ─────────────────────────────────────── */}
      <header style={s.header}>
        <a href="/" style={s.back}>
          ← BACK
        </a>
        <span style={s.logo}>IPCAM_UPKAN</span>
        <StatusBadge status={status} reconnecting={reconnecting} />
      </header>

      {/* ── Preview ────────────────────────────────────── */}
      <div style={s.previewWrap}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ ...s.preview, display: hasStream ? "block" : "none" }}
        />

        {!hasStream && (
          <div style={s.previewIdle}>
            <CameraIcon />
            <span style={s.previewIdleText}>NO SIGNAL</span>
          </div>
        )}

        {isConnecting && (
          <div style={s.connectingOverlay}>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 12,
                color: "var(--accent)",
                letterSpacing: "0.2em",
                animation: "rec-blink 0.8s step-end infinite",
              }}
            >
              CONNECTING...
            </span>
          </div>
        )}

        {isStreaming && (
          <>
            {(["tl", "tr", "bl", "br"] as const).map((p) => (
              <Corner key={p} pos={p} />
            ))}
            <div style={s.liveBadge}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "var(--danger)",
                  display: "inline-block",
                  animation: "rec-blink 1.2s step-end infinite",
                }}
              />
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--text)",
                  letterSpacing: "0.15em",
                }}
              >
                LIVE
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Controls ───────────────────────────────────── */}
      <div className="share-controls" style={s.controls}>
        {/* Media settings toggle */}
        <button
          onClick={() => setShowSettings((v) => !v)}
          style={{
            ...s.settingsToggle,
            color: showSettings ? "var(--accent)" : "var(--text-muted)",
            borderColor: showSettings
                ? "var(--accent)"
                : "var(--border-bright)",
            }}
        >
          ⚙ MEDIA SETTINGS
        </button>

        {/* Expandable settings */}
        {showSettings && (
          <MediaSettingsPanel
            media={media}
            setMedia={setMedia}
            cameras={cameras}
            onDetect={detectCameras}
            detecting={cameraDetecting}
          />
        )}

        {/* Connection target */}
        {room && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={s.roomBadge}>
              <span style={s.roomLabel}>ROOM</span>
              <span style={s.roomCode}>{room}</span>
            </div>
            
            {status === "idle" && (
              <div style={{
                background: "var(--surface)",
                border: "1px solid var(--border-bright)",
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 8
              }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.15em" }}>
                  LINK VIEWER (PC / LAPTOP):
                </span>
                <div style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--accent)",
                  wordBreak: "break-all",
                  background: "rgba(0,0,0,0.2)",
                  padding: "8px 10px",
                  border: "1px solid var(--border)",
                  borderRadius: 2
                }}>
                  {typeof window !== "undefined" ? `${window.location.origin}/view?room=${room}` : `/view?room=${room}`}
                </div>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/view?room=${room}`;
                    navigator.clipboard.writeText(url);
                    alert("Link viewer disalin!");
                  }}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-bright)",
                    color: "var(--text)",
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    padding: "6px 12px",
                    cursor: "pointer",
                    alignSelf: "flex-end"
                  }}
                >
                  Salin Link Viewer
                </button>
              </div>
            )}
          </div>
        )}

        {error && <p style={s.error}>{error}</p>}

        {/* Action button */}
        {status === "idle" ? (
          <button
            onClick={startSharing}
            disabled={!room || (!media.audio && !media.video)}
            className="share-action-btn"
            style={{
              ...s.actionBtn,
              background:
                room && (media.audio || media.video)
                  ? "var(--accent)"
                  : "var(--surface)",
              color:
                room && (media.audio || media.video)
                  ? "#000"
                  : "var(--text-muted)",
              cursor:
                room && (media.audio || media.video)
                  ? "pointer"
                  : "not-allowed",
            }}
          >
            → Start Sharing
          </button>
        ) : (
          <button onClick={stopSharing} className="share-action-btn" style={s.stopBtn}>
            ■ Stop
          </button>
        )}

        {/* Active stream info */}
        {isStreaming && (
          <div style={s.streamInfo}>
            <span style={{ color: trackState.audio ? "var(--accent)" : "var(--danger)" }}>
              ♪ {trackState.audio ? "AUDIO LIVE" : "NO AUDIO"}
            </span>
            <span>·</span>
            <span style={{ color: trackState.video ? "var(--accent)" : "var(--danger)" }}>
              ▶ {trackState.video ? `VIDEO LIVE ${media.quality}p` : "NO VIDEO"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Media Settings Panel ───────────────────────────────── */

function MediaSettingsPanel({
  media,
  setMedia,
  cameras,
  onDetect,
  detecting,
}: {
  media: MediaSettings;
  setMedia: (m: MediaSettings) => void;
  cameras: MediaDeviceInfo[];
  onDetect: () => void;
  detecting: boolean;
}) {
  function update<K extends keyof MediaSettings>(
    key: K,
    val: MediaSettings[K],
  ) {
    setMedia({ ...media, [key]: val });
  }

  return (
    <div className="share-settings-panel" style={sp.panel}>
      {/* Audio */}
      <div style={sp.row}>
        <span style={sp.label}>AUDIO</span>
        <ToggleGroup
          options={[
            { label: "ON", value: true },
            { label: "OFF", value: false },
          ]}
          value={media.audio}
          onChange={(v) => update("audio", v)}
        />
      </div>

      {/* Video */}
      <div style={sp.row}>
        <span style={sp.label}>VIDEO</span>
        <ToggleGroup
          options={[
            { label: "ON", value: true },
            { label: "OFF", value: false },
          ]}
          value={media.video}
          onChange={(v) => update("video", v)}
        />
      </div>

      {/* Camera selection */}
      {media.video && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={sp.row}>
            <span style={sp.label}>CAMERA</span>
            <button
              onClick={onDetect}
              disabled={detecting}
              style={{
                fontFamily: "var(--mono)",
                fontSize: 9,
                letterSpacing: "0.12em",
                padding: "4px 10px",
                background: "transparent",
                cursor: detecting ? "wait" : "pointer",
                color: "var(--accent)",
                border: "1px solid var(--accent)",
                transition: "opacity 0.2s",
                opacity: detecting ? 0.5 : 1,
              }}
            >
              {detecting
                ? "DETECTING..."
                : cameras.length > 0
                  ? "RE-DETECT"
                  : "DETECT CAMERAS"}
            </button>
          </div>

          {/* Detected camera list */}
          {cameras.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {cameras.map((cam, i) => {
                const label = cam.label || `Camera ${i + 1}`;
                const isSelected = media.cameraId === cam.deviceId;
                return (
                  <button
                    key={cam.deviceId}
                    onClick={() => update("cameraId", cam.deviceId)}
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                      letterSpacing: "0.06em",
                      padding: "8px 12px",
                      textAlign: "left",
                      cursor: "pointer",
                      background: isSelected
                        ? "var(--accent-dim)"
                        : "transparent",
                      color: isSelected ? "var(--accent)" : "var(--text-muted)",
                      border: `1px solid ${isSelected ? "var(--accent)" : "var(--border-bright)"}`,
                      transition: "all 0.15s",
                    }}
                  >
                    {isSelected ? "▶ " : "  "}
                    {label}
                  </button>
                );
              })}
            </div>
          ) : (
            /* Fallback: facingMode before detection */
            <ToggleGroup<string>
              options={[
                { label: "REAR", value: "environment" },
                { label: "FRONT", value: "user" },
                { label: "ANY", value: "" },
              ]}
              value={media.cameraId}
              onChange={(v) => update("cameraId", v)}
            />
          )}
        </div>
      )}

      {/* Quality */}
      {media.video && (
        <div style={sp.row}>
          <span style={sp.label}>QUALITY</span>
          <ToggleGroup<Quality>
            options={[
              { label: "360p", value: "360" },
              { label: "720p", value: "720" },
              { label: "1080p", value: "1080" },
            ]}
            value={media.quality}
            onChange={(v) => update("quality", v)}
          />
        </div>
      )}

      {!media.audio && !media.video && (
        <p
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: "var(--danger)",
            letterSpacing: "0.08em",
          }}
        >
          Minimal satu track harus aktif.
        </p>
      )}
    </div>
  );
}

function ToggleGroup<T>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="share-toggle-group" style={{ display: "flex", gap: 4 }}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.1em",
            padding: "5px 10px",
            background: value === opt.value ? "var(--accent)" : "transparent",
            color: value === opt.value ? "#000" : "var(--text-muted)",
            border: `1px solid ${value === opt.value ? "var(--accent)" : "var(--border-bright)"}`,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const base: React.CSSProperties = {
    position: "absolute",
    width: 18,
    height: 18,
    borderColor: "var(--accent)",
    borderStyle: "solid",
    borderWidth: 0,
    opacity: 0.7,
  };
  const map: Record<string, React.CSSProperties> = {
    tl: { top: 12, left: 12, borderTopWidth: 2, borderLeftWidth: 2 },
    tr: { top: 12, right: 12, borderTopWidth: 2, borderRightWidth: 2 },
    bl: { bottom: 12, left: 12, borderBottomWidth: 2, borderLeftWidth: 2 },
    br: { bottom: 12, right: 12, borderBottomWidth: 2, borderRightWidth: 2 },
  };
  return <span aria-hidden style={{ ...base, ...map[pos] }} />;
}

function StatusBadge({ status, reconnecting }: { status: Status; reconnecting?: boolean }) {
  const label = reconnecting
    ? "RECONNECTING"
    : status === "idle"
      ? "OFFLINE"
      : status === "connecting"
        ? "CONNECTING"
        : "LIVE";
  const color = reconnecting
    ? "#f5a623"
    : status === "idle"
      ? "var(--text-muted)"
      : status === "connecting"
        ? "#f5a623"
        : "var(--accent)";
  return (
    <span
      style={{
        fontFamily: "var(--mono)",
        fontSize: 10,
        color,
        letterSpacing: "0.15em",
        animation:
          status === "streaming"
            ? "rec-blink 2s step-end infinite"
            : reconnecting
              ? "rec-blink 0.8s step-end infinite"
              : "none",
      }}
    >
      {label}
    </span>
  );
}

function CameraIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--border-bright)"
      strokeWidth="1"
      strokeLinecap="round"
    >
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="1" />
    </svg>
  );
}

/* ── Styles ─────────────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  root: {
    background: "var(--bg)",
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  back: {
    fontFamily: "var(--mono)",
    fontSize: 11,
    color: "var(--text-muted)",
    textDecoration: "none",
    letterSpacing: "0.12em",
  },
  logo: {
    fontFamily: "var(--mono)",
    fontSize: 11,
    color: "var(--accent)",
    letterSpacing: "0.18em",
  },

  previewWrap: {
    flex: 1,
    position: "relative",
    background: "#050805",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  preview: { width: "100%", height: "100%", objectFit: "cover" },
  previewIdle: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  },
  previewIdleText: {
    fontFamily: "var(--mono)",
    fontSize: 11,
    color: "var(--text-muted)",
    letterSpacing: "0.2em",
  },
  connectingOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(5,8,5,0.75)",
  },
  liveBadge: {
    position: "absolute",
    top: 14,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(0,0,0,0.6)",
    padding: "4px 10px",
  },

  controls: {
    padding: "16px 20px",
    borderTop: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    flexShrink: 0,
    background: "var(--bg2)",
  },
  settingsToggle: {
    alignSelf: "flex-start",
    fontFamily: "var(--mono)",
    fontSize: 10,
    letterSpacing: "0.12em",
    background: "transparent",
    border: "1px solid",
    padding: "5px 12px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  wsPrefix: {
    position: "absolute",
    left: 14,
    top: "50%",
    transform: "translateY(-50%)",
    fontFamily: "var(--mono)",
    fontSize: 12,
    color: "var(--text-muted)",
    pointerEvents: "none",
    letterSpacing: "0.05em",
  },
  roomBadge: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px",
    background: "var(--surface)",
    border: "1px solid var(--accent)",
  },
  roomLabel: {
    fontFamily: "var(--mono)",
    fontSize: 9,
    color: "var(--text-muted)",
    letterSpacing: "0.18em",
  },
  roomCode: {
    fontFamily: "var(--mono)",
    fontSize: 20,
    color: "var(--accent)",
    letterSpacing: "0.2em",
    fontWeight: 700,
  },
  ipInput: {
    width: "100%",
    padding: "14px 14px 14px 52px",
    fontFamily: "var(--mono)",
    fontSize: 15,
    background: "var(--surface)",
    border: "1px solid",
    borderRadius: 0,
    outline: "none",
    letterSpacing: "0.05em",
    transition: "border-color 0.2s",
  },
  error: {
    fontFamily: "var(--mono)",
    fontSize: 11,
    color: "var(--danger)",
    letterSpacing: "0.05em",
    padding: "10px 14px",
    background: "rgba(255,60,60,0.08)",
    border: "1px solid rgba(255,60,60,0.2)",
  },
  noRoomNotice: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    padding: "16px 14px",
    background: "var(--surface)",
    border: "1px solid var(--border-bright)",
  },
  noRoomIcon: {
    fontFamily: "var(--mono)",
    fontSize: 20,
    color: "var(--text-muted)",
    flexShrink: 0,
    lineHeight: 1.2,
  },
  noRoomTitle: {
    fontFamily: "var(--mono)",
    fontSize: 11,
    color: "var(--accent)",
    letterSpacing: "0.14em",
    marginBottom: 6,
  },
  noRoomHint: {
    fontFamily: "var(--mono)",
    fontSize: 10,
    color: "var(--text-muted)",
    letterSpacing: "0.04em",
    lineHeight: 1.7,
  },
  actionBtn: {
    width: "100%",
    padding: "16px",
    fontFamily: "var(--mono)",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    border: "none",
    transition: "all 0.2s",
  },
  stopBtn: {
    width: "100%",
    padding: "16px",
    background: "transparent",
    color: "var(--danger)",
    fontFamily: "var(--mono)",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    border: "1px solid var(--danger)",
    cursor: "pointer",
  },
  streamInfo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "var(--mono)",
    fontSize: 10,
    color: "var(--text-muted)",
    letterSpacing: "0.1em",
  },
};

const sp: Record<string, React.CSSProperties> = {
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: "14px",
    background: "var(--surface)",
    border: "1px solid var(--border-bright)",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  label: {
    fontFamily: "var(--mono)",
    fontSize: 10,
    color: "var(--text-muted)",
    letterSpacing: "0.14em",
    flexShrink: 0,
  },
};
