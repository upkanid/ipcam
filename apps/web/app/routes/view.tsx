import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/view";
import {
  ICE_SERVERS,
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_BASE_DELAY,
  CONNECTION_TIMEOUT,
  buildSignalingWsUrl,
} from "~/lib/webrtc-utils";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "View Stream — IPCam Upkan" },
    {
      name: "description",
      content:
        "View your phone camera stream in the browser. Works as OBS Browser Source.",
    },
  ];
}

type Status = "idle" | "waiting" | "connected";



export default function View() {
  const [params, setSearchParams] = useSearchParams();
  const room = params.get("room");
  const paramIp = [params.get("ip"), params.get("port")]
    .filter(Boolean)
    .join(":");
  const obs = params.get("obs") === "1";

  const noRoomOnHttps =
    !room &&
    typeof window !== "undefined" &&
    window.location.protocol === "https:";

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoWrapRef = useRef<HTMLDivElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef(0);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const intentionalStopRef = useRef(false);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevFramesRef = useRef(0);

  const ip = paramIp;
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [reconnecting, setReconnecting] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [fps, setFps] = useState(0);
  const [resolution, setResolution] = useState("");
  const [target, setTarget] = useState(room || paramIp || "");
  const [trackState, setTrackState] = useState<{
    audio: boolean;
    video: boolean;
  }>({ audio: false, video: false });

  const hasParams = !!(room || paramIp);

  // ── Auto-connect on mount/param change ─────────────────
  useEffect(() => {
    if (hasParams) {
      startViewing();
    }
    return () => {
      intentionalStopRef.current = true;
      cleanupConnection();
      stopStatsPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasParams]);

  // ── Sync muted/volume to video element ─────────────────
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
      videoRef.current.volume = volume;
    }
  }, [muted, volume]);

  // ── FPS stats polling ──────────────────────────────────
  function startStatsPolling() {
    stopStatsPolling();
    prevFramesRef.current = 0;
    statsIntervalRef.current = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        const stats = await pc.getStats();
        stats.forEach((report) => {
          if (
            report.type === "inbound-rtp" &&
            report.kind === "video" &&
            typeof report.framesDecoded === "number"
          ) {
            const decoded = report.framesDecoded;
            if (prevFramesRef.current > 0) {
              setFps(decoded - prevFramesRef.current);
            }
            prevFramesRef.current = decoded;
          }
        });
      } catch {
        /* ignore */
      }
    }, 1000);
  }

  function stopStatsPolling() {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    setFps(0);
  }

  // ── Video metadata ─────────────────────────────────────
  function handleLoadedMetadata() {
    const v = videoRef.current;
    if (v) {
      setResolution(`${v.videoWidth}×${v.videoHeight}`);
    }
  }

  // ── Connection helpers ─────────────────────────────────
  function buildWsUrl(): string {
    return buildSignalingWsUrl(room, ip, window.location);
  }

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
    wsRef.current?.close();
    wsRef.current = null;
  }

  function scheduleReconnect() {
    if (intentionalStopRef.current) return;
    if (reconnectCountRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setError(
        "Failed to reconnect after multiple attempts. Try connecting manually.",
      );
      setReconnecting(false);
      setStatus("idle");
      stopStatsPolling();
      return;
    }
    const delay =
      RECONNECT_BASE_DELAY * Math.pow(2, reconnectCountRef.current);
    reconnectCountRef.current += 1;
    setReconnecting(true);
    setError(
      `Connection lost. Reconnecting in ${Math.round(delay / 1000)}s... (${reconnectCountRef.current}/${MAX_RECONNECT_ATTEMPTS})`,
    );
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      connectSignaling();
    }, delay);
  }

  function handleConnect() {
    const cleanTarget = target.trim();
    if (!cleanTarget) return;

    if (/[.:]/.test(cleanTarget) || cleanTarget.toLowerCase() === "localhost") {
      if (typeof window !== "undefined" && window.location.protocol === "https:") {
        setError("Koneksi via IP lokal (LAN) tidak didukung pada HTTPS. Silakan gunakan Room ID untuk koneksi cloud.");
        return;
      }
      setSearchParams({ ip: cleanTarget });
    } else {
      setSearchParams({ room: cleanTarget });
    }
  }

  function startViewing() {
    if (!room && !ip.trim()) return;
    setError("");
    setStatus("waiting");
    intentionalStopRef.current = false;
    reconnectCountRef.current = 0;
    setReconnecting(false);
    connectSignaling();
  }

  function connectSignaling() {
    cleanupConnection();
    setStatus("waiting");

    // Connection timeout
    connectionTimeoutRef.current = setTimeout(() => {
      connectionTimeoutRef.current = null;
      cleanupConnection();
      scheduleReconnect();
    }, CONNECTION_TIMEOUT);

    const ws = new WebSocket(buildWsUrl());
    wsRef.current = ws;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    // When we get a track (video/audio from sender), attach to video element
    pc.ontrack = (ev) => {
      if (videoRef.current) {
        videoRef.current.srcObject = ev.streams[0];
      }
      // Monitor track state
      const stream = ev.streams[0];
      if (stream) {
        const updateTrackState = () => {
          const audioTrack = stream.getAudioTracks()[0];
          const videoTrack = stream.getVideoTracks()[0];
          setTrackState({
            audio: !!(
              audioTrack &&
              audioTrack.enabled &&
              audioTrack.readyState === "live"
            ),
            video: !!(
              videoTrack &&
              videoTrack.enabled &&
              videoTrack.readyState === "live"
            ),
          });
        };
        updateTrackState();
        stream.getTracks().forEach((t) => {
          t.addEventListener("ended", updateTrackState);
          t.addEventListener("mute", updateTrackState);
          t.addEventListener("unmute", updateTrackState);
        });
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        reconnectCountRef.current = 0;
        setReconnecting(false);
        setError("");
        setStatus("connected");
        startStatsPolling();
      } else if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected"
      ) {
        stopStatsPolling();
        cleanupConnection();
        scheduleReconnect();
      }
    };

    // Send ICE candidates
    pc.onicecandidate = (ev) => {
      if (ev.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "candidate", payload: ev.candidate }));
      }
    };

    // Handle signaling messages (receiver: wait for offer, send answer)
    ws.onmessage = async (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "offer") {
          await pc.setRemoteDescription(
            new RTCSessionDescription(msg.payload),
          );
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "answer", payload: answer }));
        } else if (msg.type === "candidate") {
          await pc.addIceCandidate(new RTCIceCandidate(msg.payload));
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

  function stopViewing() {
    intentionalStopRef.current = true;
    setReconnecting(false);
    cleanupConnection();
    stopStatsPolling();
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
    setError("");
    setResolution("");
    setTrackState({ audio: false, video: false });
  }

  // ── Fullscreen ─────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    const el = videoWrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  const isConnected = status === "connected";
  const isWaiting = status === "waiting";
  const isActive = isConnected || isWaiting || reconnecting;

  // ── OBS Mode ───────────────────────────────────────────
  if (obs) {
    return (
      <div style={s.obsRoot}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          onLoadedMetadata={handleLoadedMetadata}
          style={s.obsVideo}
        />
        {isConnected && <div style={s.obsDot} />}
        {isWaiting && (
          <div style={s.obsWaiting}>
            <span style={s.obsWaitingText}>CONNECTING...</span>
          </div>
        )}
      </div>
    );
  }

  // ── Normal Mode ────────────────────────────────────────
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

      {/* ── Video Area ─────────────────────────────────── */}
      <div ref={videoWrapRef} style={s.previewWrap}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          onLoadedMetadata={handleLoadedMetadata}
          style={{
            ...s.preview,
            display: isActive ? "block" : "none",
          }}
        />

        {/* Idle / waiting overlay */}
        {!isActive && (
          <div style={s.previewIdle}>
            <MonitorIcon />
            <span style={s.previewIdleText}>
              {noRoomOnHttps ? "ENTER ROOM ID" : "NO STREAM"}
            </span>
          </div>
        )}

        {/* Waiting overlay on top of video */}
        {isWaiting && (
          <div style={s.connectingOverlay}>
            <div style={s.waitingContent}>
              <span style={s.waitingPulse} />
              <span style={s.waitingText}>WAITING FOR STREAM...</span>
              {room && <span style={s.waitingRoom}>ROOM {room}</span>}
            </div>
          </div>
        )}

        {/* Connected overlays */}
        {isConnected && (
          <>
            {(["tl", "tr", "bl", "br"] as const).map((p) => (
              <Corner key={p} pos={p} />
            ))}
            <div style={s.recBadge}>
              <span style={s.recDot} />
              <span style={s.recText}>REC</span>
            </div>
            {muted && <div style={s.mutedBadge}>MUTED</div>}
          </>
        )}
      </div>

      {/* ── Controls ───────────────────────────────────── */}
      <div style={s.controls}>
        {/* Connection controls when idle */}
        {status === "idle" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {!hasParams && (
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="text"
                  placeholder="Masukkan Room ID atau IP Address"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && target.trim() && handleConnect()
                  }
                  style={{
                    ...s.ipInput,
                    width: "100%",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--accent)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--border-bright)";
                  }}
                />
                <button
                  onClick={handleConnect}
                  disabled={!target.trim()}
                  style={{
                    ...s.actionBtn,
                    width: "auto",
                    padding: "0 24px",
                    background: target.trim() ? "var(--accent)" : "var(--surface)",
                    color: target.trim() ? "#000" : "var(--text-muted)",
                    cursor: target.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  → Connect
                </button>
              </div>
            )}
            
            {hasParams && (
              <button
                onClick={startViewing}
                style={{
                  ...s.actionBtn,
                  background: "var(--accent)",
                  color: "#000",
                  cursor: "pointer",
                }}
              >
                → Connect
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {error && <p style={s.error}>{error}</p>}

        {/* Active controls bar */}
        {isActive && (
          <div style={s.controlBar}>
            {/* Audio controls */}
            <div style={s.controlGroup}>
              <button
                onClick={() => setMuted((m) => !m)}
                style={{
                  ...s.controlBtn,
                  color: muted ? "var(--danger)" : "var(--accent)",
                  borderColor: muted ? "var(--danger)" : "var(--accent)",
                }}
              >
                {muted ? "🔇" : "🔊"}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  if (parseFloat(e.target.value) > 0 && muted) setMuted(false);
                }}
                style={s.volumeSlider}
              />
            </div>

            {/* Stats */}
            <div style={s.statsGroup}>
              {isConnected && (
                <>
                  <span
                    style={{
                      ...s.stat,
                      color: trackState.video
                        ? "var(--accent)"
                        : "var(--danger)",
                    }}
                  >
                    {trackState.video ? "▶ VIDEO LIVE" : "▶ NO SIGNAL"}
                  </span>
                  <span style={s.statDivider}>·</span>
                  <span
                    style={{
                      ...s.stat,
                      color: trackState.audio
                        ? "var(--accent)"
                        : "var(--text-muted)",
                    }}
                  >
                    {trackState.audio ? "♪ AUDIO LIVE" : "♪ OFF"}
                  </span>
                  <span style={s.statDivider}>·</span>
                  <span style={s.stat}>{fps} FPS</span>
                  {resolution && (
                    <>
                      <span style={s.statDivider}>·</span>
                      <span style={s.stat}>{resolution}</span>
                    </>
                  )}
                </>
              )}
              {isWaiting && !isConnected && (
                <span style={{ ...s.stat, color: "#f5a623" }}>
                  WAITING...
                </span>
              )}
            </div>

            {/* Right controls */}
            <div style={s.controlGroup}>
              <button onClick={toggleFullscreen} style={s.controlBtn}>
                ⛶
              </button>
              <button onClick={stopViewing} style={s.disconnectBtn}>
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Room info when connected */}
        {isActive && room && (
          <div style={s.roomInfo}>
            <span style={s.roomLabel}>ROOM</span>
            <span style={s.roomCode}>{room}</span>
          </div>
        )}
      </div>
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
    br: {
      bottom: 12,
      right: 12,
      borderBottomWidth: 2,
      borderRightWidth: 2,
    },
  };
  return <span aria-hidden style={{ ...base, ...map[pos] }} />;
}

function StatusBadge({
  status,
  reconnecting,
}: {
  status: Status;
  reconnecting?: boolean;
}) {
  const label = reconnecting
    ? "RECONNECTING"
    : status === "idle"
      ? "OFFLINE"
      : status === "waiting"
        ? "WAITING"
        : "CONNECTED";
  const color = reconnecting
    ? "#f5a623"
    : status === "idle"
      ? "var(--text-muted)"
      : status === "waiting"
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
          status === "connected"
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

function MonitorIcon() {
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
      <rect x="2" y="3" width="20" height="14" rx="1" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

/* ── Styles ─────────────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  /* ── Root / Layout ── */
  root: {
    background: "var(--bg)",
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
  },

  /* ── Header ── */
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

  /* ── Video Area ── */
  previewWrap: {
    flex: 1,
    position: "relative",
    background: "#050805",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  preview: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
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
    background: "rgba(5,8,5,0.85)",
  },
  waitingContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
  },
  waitingPulse: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: "#f5a623",
    animation: "rec-blink 1s step-end infinite",
  },
  waitingText: {
    fontFamily: "var(--mono)",
    fontSize: 12,
    color: "var(--accent)",
    letterSpacing: "0.2em",
  },
  waitingRoom: {
    fontFamily: "var(--mono)",
    fontSize: 18,
    color: "var(--accent)",
    letterSpacing: "0.25em",
    fontWeight: 700,
    marginTop: 4,
  },

  /* ── Connected Overlays ── */
  recBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(0,0,0,0.6)",
    padding: "4px 10px",
  },
  recDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "var(--danger)",
    display: "inline-block",
    animation: "rec-blink 1.2s step-end infinite",
  },
  recText: {
    fontFamily: "var(--mono)",
    fontSize: 10,
    color: "var(--text)",
    letterSpacing: "0.15em",
  },
  mutedBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    fontFamily: "var(--mono)",
    fontSize: 9,
    color: "var(--danger)",
    letterSpacing: "0.12em",
    background: "rgba(0,0,0,0.6)",
    padding: "4px 8px",
  },

  /* ── Controls ── */
  controls: {
    padding: "12px 20px",
    borderTop: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    flexShrink: 0,
    background: "var(--bg2)",
  },
  controlBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  controlGroup: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  controlBtn: {
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--mono)",
    fontSize: 14,
    background: "transparent",
    color: "var(--text-muted)",
    border: "1px solid var(--border-bright)",
    cursor: "pointer",
    transition: "all 0.15s",
    padding: 0,
  },
  disconnectBtn: {
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--mono)",
    fontSize: 14,
    background: "transparent",
    color: "var(--danger)",
    border: "1px solid var(--danger)",
    cursor: "pointer",
    transition: "all 0.15s",
    padding: 0,
  },
  volumeSlider: {
    width: 80,
    height: 4,
    cursor: "pointer",
    accentColor: "var(--accent)",
  },
  statsGroup: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  stat: {
    fontFamily: "var(--mono)",
    fontSize: 10,
    color: "var(--text-muted)",
    letterSpacing: "0.1em",
  },
  statDivider: {
    fontFamily: "var(--mono)",
    fontSize: 10,
    color: "var(--border-bright)",
  },

  /* ── IP Input / Action ── */
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
  ipInput: {
    width: "100%",
    padding: "14px 14px 14px 52px",
    fontFamily: "var(--mono)",
    fontSize: 15,
    background: "var(--surface)",
    color: "var(--text)",
    border: "1px solid var(--border-bright)",
    borderRadius: 0,
    outline: "none",
    letterSpacing: "0.05em",
    transition: "border-color 0.2s",
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
  error: {
    fontFamily: "var(--mono)",
    fontSize: 11,
    color: "var(--danger)",
    letterSpacing: "0.05em",
    padding: "10px 14px",
    background: "rgba(255,60,60,0.08)",
    border: "1px solid rgba(255,60,60,0.2)",
    margin: 0,
  },

  /* ── No Room Notice ── */
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
    marginTop: 0,
  },
  noRoomHint: {
    fontFamily: "var(--mono)",
    fontSize: 10,
    color: "var(--text-muted)",
    letterSpacing: "0.04em",
    lineHeight: 1.7,
    marginBottom: 0,
    marginTop: 0,
  },

  /* ── Room Info ── */
  roomInfo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  roomLabel: {
    fontFamily: "var(--mono)",
    fontSize: 9,
    color: "var(--text-muted)",
    letterSpacing: "0.18em",
  },
  roomCode: {
    fontFamily: "var(--mono)",
    fontSize: 14,
    color: "var(--accent)",
    letterSpacing: "0.2em",
    fontWeight: 700,
  },

  /* ── OBS Mode ── */
  obsRoot: {
    width: "100vw",
    height: "100vh",
    background: "transparent",
    overflow: "hidden",
    position: "relative",
  },
  obsVideo: {
    width: "100vw",
    height: "100vh",
    objectFit: "contain",
    background: "transparent",
  },
  obsDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--accent)",
    opacity: 0.5,
  },
  obsWaiting: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  obsWaitingText: {
    fontFamily: "var(--mono)",
    fontSize: 11,
    color: "#f5a623",
    letterSpacing: "0.2em",
    opacity: 0.6,
    animation: "rec-blink 1s step-end infinite",
  },
};
