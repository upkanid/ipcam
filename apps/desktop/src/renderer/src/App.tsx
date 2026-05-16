import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import {
  DEFAULT_PORT,
  DEFAULT_HOST,
  ICE_SERVERS,
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_BASE_DELAY,
  CONNECTION_TIMEOUT,
  type Status,
  type VCamStatus,
  type VCamInfo,
  type VMicStatus,
  type VMicInfo,
} from "./types";
import { s } from "./styles";
import {
  Corner,
  StatusPill,
  StatusDetail,
  SignalBars,
  VirtualCamSection,
  VirtualMicSection,
  SettingsPanel,
} from "./components";

function generateRoomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(5)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function getSignalingUrl(
  hostUrl: string,
  roomId: string,
  localPort: number,
): string {
  try {
    const u = new URL(hostUrl);
    if (u.protocol === "https:") return `wss://${u.host}/ws?room=${roomId}`;
  } catch {
    /* fallthrough */
  }
  return `ws://localhost:${localPort}`;
}

function getShareUrl(
  hostUrl: string,
  roomId: string,
  localIP: string,
  localPort: number,
): string {
  try {
    const u = new URL(hostUrl);
    if (u.protocol === "https:") return `${hostUrl}/share?room=${roomId}`;
  } catch {
    /* fallthrough */
  }
  return `${hostUrl}/share?ip=${localIP}&port=${localPort}`;
}

function isCloudMode(hostUrl: string): boolean {
  try {
    return new URL(hostUrl).protocol === "https:";
  } catch {
    return false;
  }
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const rafRef = useRef(0);
  const lastFrameRef = useRef(0);
  const vcamArmedRef = useRef(false);

  const prevStatusRef = useRef<Status>("idle");
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef(0);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalStopRef = useRef(false);

  const [localIP, setLocalIP] = useState("—");
  const [status, setStatus] = useState<Status>("idle");
  const [fps, setFps] = useState<number | null>(null);
  const [resolution, setResolution] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [showSettings, setShowSettings] = useState(false);
  const [roomId, setRoomId] = useState(() => {
    try { return localStorage.getItem("ipcam_room") || generateRoomId(); } catch { return generateRoomId(); }
  });
  const [roomCopied, setRoomCopied] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [trackState, setTrackState] = useState<{ audio: boolean; video: boolean }>({ audio: false, video: false });

  // Settings state
  const [port, setPort] = useState(DEFAULT_PORT);
  const [portInput, setPortInput] = useState(String(DEFAULT_PORT));
  const [hostUrl, setHostUrl] = useState(DEFAULT_HOST);
  const [hostInput, setHostInput] = useState(DEFAULT_HOST);

  // Virtual camera state
  const [vcamStatus, setVcamStatus] = useState<VCamStatus>("idle");
  const [vcamInfo, setVcamInfo] = useState<VCamInfo | null>(null);
  // Virtual mic state
  const [vmicStatus, setVmicStatus] = useState<VMicStatus>("idle");
  const [vmicInfo, setVmicInfo] = useState<VMicInfo | null>(null);
  const vmicArmedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const [error, setError] = useState("");
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);

  // Persist room ID
  useEffect(() => {
    try { localStorage.setItem("ipcam_room", roomId); } catch { /* ignore */ }
  }, [roomId]);

  useEffect(() => {
    window.api?.getLocalIP().then(setLocalIP);
    window.api?.getVersion().then(setAppVersion);
    window.api?.virtualCam.check().then(setVcamInfo);
    window.api?.virtualCam.onStatus((status, _reason) =>
      setVcamStatus(status as VCamStatus),
    );
    window.api?.virtualMic.check().then(setVmicInfo);
    window.api?.virtualMic.onStatus((status, _reason) =>
      setVmicStatus(status as VMicStatus),
    );
    window.api?.updater.onDownloaded(setUpdateVersion);
    window.api?.updater.onAvailable(setUpdateAvailable);
    return () => {
      window.api?.virtualCam.offStatus();
      window.api?.virtualMic.offStatus();
    };
  }, []);

  // FPS polling via WebRTC inbound-rtp stats
  useEffect(() => {
    if (status !== "connected" || !pcRef.current) {
      setFps(null);
      setTrackState({ audio: false, video: false });
      return;
    }
    const interval = setInterval(async () => {
      if (!pcRef.current) return;
      let hasVideo = false;
      let hasAudio = false;
      const stats = await pcRef.current.getStats();
      stats.forEach((report) => {
        if (report.type === "inbound-rtp") {
          const r = report as RTCInboundRtpStreamStats;
          if (r.kind === "video") {
            hasVideo = (r.bytesReceived ?? 0) > 0;
            if (typeof r.framesPerSecond === "number") {
              setFps(Math.round(r.framesPerSecond));
            }
          }
          if (r.kind === "audio") {
            hasAudio = (r.bytesReceived ?? 0) > 0;
          }
        }
      });
      setTrackState({ audio: hasAudio, video: hasVideo });
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  // System notifications on connect / disconnect
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev === status) return;
    if (prev !== "connected" && status === "connected") {
      new Notification("IPCAM UPKAN", { body: "Kamera terhubung" });
    } else if (prev === "connected" && status !== "connected") {
      new Notification("IPCAM UPKAN", { body: "Koneksi terputus" });
    }
  }, [status]);

  // Auto-connect on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    startReceiving();
    const onBeforeUnload = () => {
      intentionalStopRef.current = true;
      if (vcamStatus !== "idle") window.api?.virtualCam.disarm();
      if (vmicStatus !== "idle") window.api?.virtualMic.disarm();
      cleanupConnection();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      intentionalStopRef.current = true;
      cleanupConnection();
    };
  }, []);

  // Sync audio to video element (React muted prop doesn't update reactively)
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = muted;
    videoRef.current.volume = volume;
    // Re-trigger play in case browser paused due to unmute without gesture
    if (!muted && videoRef.current.paused && videoRef.current.srcObject) {
      videoRef.current.play().catch(() => {});
    }
  }, [muted, volume]);

  // Frame capture loop — only runs when vcam is armed and stream is connected
  useEffect(() => {
    const armed = vcamStatus !== "idle" && vcamStatus !== "unsupported";
    if (!armed || status !== "connected" || !videoRef.current) {
      vcamArmedRef.current = false;
      return;
    }

    vcamArmedRef.current = true;
    
    // Calculate dimensions once or update on resize
    const vW = videoRef.current.videoWidth || 640;
    const vH = videoRef.current.videoHeight || 480;
    
    // We target a reasonable resolution (max 1280x720) while maintaining aspect ratio
    const SCALE = Math.min(1, 1280 / vW, 720 / vH);
    const W = Math.floor(vW * SCALE);
    const H = Math.floor(vH * SCALE);

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const INTERVAL = 1000 / 15; // 15 fps

    function capture() {
      if (!vcamArmedRef.current || !videoRef.current) return;
      
      const now = performance.now();
      if (
        now - lastFrameRef.current >= INTERVAL &&
        videoRef.current.readyState >= 2
      ) {
        lastFrameRef.current = now;
        ctx.drawImage(videoRef.current, 0, 0, W, H);
        const { data } = ctx.getImageData(0, 0, W, H);
        // data.buffer is a SharedArrayBuffer in some contexts, slice to ensure ArrayBuffer
        window.api.virtualCam.sendFrame(data.buffer.slice(0), W, H);
      }
    }

    // Use setInterval instead of requestAnimationFrame so it keeps running when minimized
    const timer = setInterval(capture, INTERVAL);
    
    return () => {
      vcamArmedRef.current = false;
      clearInterval(timer);
    };
  }, [vcamStatus, status, resolution]);

  // Audio capture loop — captures audio from WebRTC stream and sends to virtual mic
  useEffect(() => {
    const armed = vmicStatus !== "idle" && vmicStatus !== "unsupported";
    if (!armed || status !== "connected" || !videoRef.current) {
      vmicArmedRef.current = false;
      if (audioProcessorRef.current) {
        audioProcessorRef.current.disconnect();
        audioProcessorRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      return;
    }

    vmicArmedRef.current = true;
    const stream = videoRef.current.srcObject as MediaStream | null;
    if (!stream || stream.getAudioTracks().length === 0) return;

    const ctx = new AudioContext({ sampleRate: 48000 });
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    // 4800 samples = 100ms at 48kHz
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    audioProcessorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (!vmicArmedRef.current) return;
      const input = e.inputBuffer.getChannelData(0);
      // Send float32 PCM directly
      window.api.virtualMic.sendAudio(input.buffer.slice(0));
    };

    source.connect(processor);
    processor.connect(ctx.destination);

    return () => {
      vmicArmedRef.current = false;
      processor.disconnect();
      source.disconnect();
      ctx.close();
      audioProcessorRef.current = null;
      audioCtxRef.current = null;
    };
  }, [vmicStatus, status]);

  function copyRoom() {
    navigator.clipboard.writeText(roomId);
    setRoomCopied(true);
    setTimeout(() => setRoomCopied(false), 1500);
  }

  function regenerateRoom() {
    if (status !== "idle") stop();
    else setRoomId(generateRoomId());
  }

  function toggleVirtualCam() {
    if (vcamStatus === "idle") {
      window.api.virtualCam.arm();
    } else {
      window.api.virtualCam.disarm();
    }
  }

  function toggleVirtualMic() {
    if (vmicStatus === "idle") {
      window.api.virtualMic.arm();
    } else {
      window.api.virtualMic.disarm();
    }
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
      setError("Gagal reconnect. Klik START RECEIVING untuk coba lagi.");
      setReconnecting(false);
      setStatus("idle");
      return;
    }
    const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectCountRef.current);
    reconnectCountRef.current += 1;
    setReconnecting(true);
    setError(`Reconnecting dalam ${Math.round(delay / 1000)}s... (${reconnectCountRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      connectToSignaling();
    }, delay);
  }

  function startReceiving() {
    setError("");
    intentionalStopRef.current = false;
    reconnectCountRef.current = 0;
    setReconnecting(false);
    connectToSignaling();
  }

  function connectToSignaling() {
    cleanupConnection();
    setStatus("waiting");

    connectionTimeoutRef.current = setTimeout(() => {
      connectionTimeoutRef.current = null;
      cleanupConnection();
      scheduleReconnect();
    }, CONNECTION_TIMEOUT);

    const ws = new WebSocket(getSignalingUrl(hostUrl, roomId, port));
    wsRef.current = ws;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.ontrack = (ev) => {
      if (videoRef.current) {
        videoRef.current.srcObject = ev.streams[0];
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
        setStatus("connected");
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        cleanupConnection();
        scheduleReconnect();
      }
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "candidate", payload: ev.candidate }));
      }
    };

    ws.onmessage = async (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
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

  function stop() {
    intentionalStopRef.current = true;
    setReconnecting(false);
    if (vcamStatus !== "idle") window.api.virtualCam.disarm();
    if (vmicStatus !== "idle") window.api.virtualMic.disarm();
    cleanupConnection();
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
    setError("");
    setFps(null);
    setResolution(null);
  }

  async function applySettings() {
    const newPort = parseInt(portInput);
    if (isNaN(newPort) || newPort < 1024 || newPort > 65535) return;
    if (status !== "idle") stop();
    await window.api?.restartSignaling(newPort);
    setPort(newPort);
    setHostUrl(hostInput);
    setShowSettings(false);
  }

  return (
    <div style={s.root}>
      {/* ── Header ──────────────────────────────────────── */}
      <header style={s.header}>
        <span style={s.headerLogo}>IPCAM_UPKAN</span>

        <div style={s.headerCenter}>
          <StatusPill status={status} reconnecting={reconnecting} />
        </div>

        <div style={s.headerRight}>
          <button
            onClick={() => setShowSettings((v) => !v)}
            style={{
              ...s.iconBtn,
              color: showSettings ? "var(--accent)" : "var(--text-muted)",
              borderColor: showSettings
                ? "var(--accent)"
                : "var(--border-bright)",
            }}
            title="Settings"
          >
            ⚙
          </button>
          {status !== "idle" && (
            <button onClick={stop} style={s.stopBtn}>
              ■ STOP
            </button>
          )}
        </div>
      </header>

      {/* ── Update banner ───────────────────────────────── */}
      {(updateVersion || updateAvailable) && (
        <div style={s.updateBanner}>
          <span style={s.updateText}>
            ↑ v{updateVersion ?? updateAvailable} tersedia
          </span>
          {updateVersion ? (
            <button
              onClick={() => window.api.updater.install()}
              style={s.updateBtn}
            >
              RESTART & UPDATE
            </button>
          ) : (
            <button
              onClick={() => window.api.updater.openReleases()}
              style={s.updateBtn}
            >
              LIHAT RELEASES →
            </button>
          )}
        </div>
      )}

      {/* ── Main ─────────────────────────────────────────── */}
      <main style={s.main}>
        {/* ── Left: Monitor ─────────────────────────────── */}
        <div style={s.monitorWrap}>
          <div style={s.monitor}>
            {/* Subtle grid */}
            <div style={s.monitorGrid} aria-hidden />

            {/* Scanline while not streaming */}
            {status !== "connected" && <div style={s.scanline} aria-hidden />}

            {/* Video */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={muted}
              style={{ ...s.video, opacity: status === "connected" ? 1 : 0 }}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  setResolution(`${videoRef.current.videoWidth}×${videoRef.current.videoHeight}`);
                }
              }}
            />

            {/* QR / Idle overlay */}
            {status !== "connected" && (
              <div style={s.monitorOverlay}>
                <div style={s.qrWrap}>
                  <QRCodeSVG
                    value={getShareUrl(hostUrl, roomId, localIP, port)}
                    size={160}
                    bgColor="#0a0a0a"
                    fgColor="#00e87a"
                    level="M"
                  />
                </div>
                <span style={s.qrLabel}>
                  {status === "idle"
                    ? "SCAN DI HP UNTUK CONNECT"
                    : "WAITING FOR CONNECTION..."}
                </span>
                <span
                  style={{
                    ...s.qrSub,
                    animation:
                      status === "waiting"
                        ? "blink 1.1s step-end infinite"
                        : "none",
                  }}
                >
                  {isCloudMode(hostUrl) ? roomId : `${localIP}:${port}`}
                </span>
              </div>
            )}

            {/* Connected overlays */}
            {status === "connected" && (
              <>
                {(["tl", "tr", "bl", "br"] as const).map((p) => (
                  <Corner key={p} pos={p} />
                ))}
                <div style={s.recBadge}>
                  <span
                    style={{
                      ...s.recDot,
                      animation: "blink 1.2s step-end infinite",
                    }}
                  />
                  <span style={s.recText}>REC</span>
                </div>
                {muted && <div style={s.mutedBadge}>⊘ MUTED</div>}
              </>
            )}
          </div>

          {/* Monitor footer */}
          <div style={s.monitorFooter}>
            {[
              ["VIDEO", trackState.video ? "LIVE" : status === "connected" ? "NO SIGNAL" : "—"],
              ["AUDIO", trackState.audio ? "LIVE" : status === "connected" ? "OFF" : "—"],
              ["PORT", String(port)],
              ["FPS", fps !== null ? String(fps) : "—"],
              ["RES", resolution ?? "—"],
            ].map(([label, value], i) => (
              <span
                key={label}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                {i > 0 && <span style={s.mfSep} />}
                <span style={s.mfLabel}>{label}</span>
                <span style={{
                  ...s.mfValue,
                  color: (label === "VIDEO" || label === "AUDIO") && value === "LIVE"
                    ? "var(--accent)"
                    : (label === "VIDEO" || label === "AUDIO") && value === "NO SIGNAL"
                      ? "var(--danger)"
                      : undefined,
                }}>{value}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── Right: Panel ──────────────────────────────── */}
        <aside style={s.panel}>
          {showSettings ? (
            <SettingsPanel
              portInput={portInput}
              setPortInput={setPortInput}
              hostInput={hostInput}
              setHostInput={setHostInput}
              onApply={applySettings}
              onCancel={() => {
                setPortInput(String(port));
                setHostInput(hostUrl);
                setShowSettings(false);
              }}
            />
          ) : (
            <>
              <SignalBars status={status} />
              <div style={s.panelDivider} />

              {/* Signal source */}
              <div style={s.section}>
                <p style={s.sectionLabel}>// SIGNAL SOURCE</p>
                {isCloudMode(hostUrl) ? (
                  <>
                    <div style={{ ...s.ipBlock, flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                        <span
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: 9,
                            color: "var(--text-muted)",
                            letterSpacing: "0.14em",
                          }}
                        >
                          ROOM
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--display)",
                            fontSize: 24,
                            fontWeight: 800,
                            color: "var(--accent)",
                            letterSpacing: "0.12em",
                          }}
                        >
                          {roomId}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6, width: "100%" }}>
                        <button
                          onClick={copyRoom}
                          style={{
                            flex: 1,
                            fontFamily: "var(--mono)",
                            fontSize: 9,
                            letterSpacing: "0.12em",
                            background: "transparent",
                            border: `1px solid ${roomCopied ? "var(--accent)" : "var(--border-bright)"}`,
                            color: roomCopied ? "var(--accent)" : "var(--text-muted)",
                            padding: "4px 6px",
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                        >
                          {roomCopied ? "✓ COPIED" : "⧉ COPY"}
                        </button>
                        <button
                          onClick={regenerateRoom}
                          style={{
                            flex: 1,
                            fontFamily: "var(--mono)",
                            fontSize: 9,
                            letterSpacing: "0.12em",
                            background: "transparent",
                            border: "1px solid var(--border-bright)",
                            color: "var(--text-muted)",
                            padding: "4px 6px",
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                        >
                          ↺ NEW ROOM
                        </button>
                      </div>
                    </div>
                    <p style={s.ipHint}>
                      Scan QR — relay via{" "}
                      <span style={{ color: "var(--accent)" }}>
                        {new URL(hostUrl).host}
                      </span>
                      , stream WebRTC P2P.
                    </p>
                  </>
                ) : (
                  <>
                    <div style={s.ipBlock}>
                      <span style={s.ipAddress}>{localIP}</span>
                      <span style={s.ipPort}>:{port}</span>
                    </div>
                    <p style={s.ipHint}>
                      Scan QR atau buka{" "}
                      <span style={{ color: "var(--accent)" }}>
                        {hostUrl}/share
                      </span>{" "}
                      di HP dan masukkan IP di atas.
                    </p>
                  </>
                )}
              </div>

              <div style={s.panelDivider} />

              {/* Audio */}
              <div style={s.section}>
                <p style={s.sectionLabel}>// AUDIO OUTPUT</p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={s.rowLabel}>SPEAKER</span>
                  <button
                    onClick={() => setMuted((m) => !m)}
                    style={{
                      ...s.toggleBtn,
                      color: muted ? "var(--danger)" : "var(--accent)",
                      borderColor: muted ? "var(--danger)" : "var(--accent)",
                    }}
                  >
                    {muted ? "⊘ MUTED" : "♪ LIVE"}
                  </button>
                </div>
                {!muted && (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span style={s.rowLabel}>VOL</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                      style={{
                        flex: 1,
                        accentColor: "var(--accent)",
                        cursor: "pointer",
                      }}
                    />
                    <span
                      style={{
                        ...s.rowLabel,
                        minWidth: 28,
                        textAlign: "right",
                      }}
                    >
                      {Math.round(volume * 100)}%
                    </span>
                  </div>
                )}
              </div>

              <div style={s.panelDivider} />

              {/* Status */}
              <div style={s.section}>
                <p style={s.sectionLabel}>// STATUS</p>
                <StatusDetail status={status} />
                {error && (
                  <div style={s.errorBanner}>
                    <span style={s.errorText}>⚠ {error}</span>
                  </div>
                )}
              </div>

              <div style={s.panelDivider} />

              {/* Virtual Camera */}
              <div style={s.section}>
                <p style={s.sectionLabel}>// VIRTUAL CAM</p>
                <VirtualCamSection
                  streamStatus={status}
                  vcamStatus={vcamStatus}
                  vcamInfo={vcamInfo}
                  onToggle={toggleVirtualCam}
                  onRecheck={() => window.api?.virtualCam.recheck().then(setVcamInfo)}
                />
              </div>

              <div style={s.panelDivider} />

              {/* Virtual Mic */}
              <div style={s.section}>
                <p style={s.sectionLabel}>// VIRTUAL MIC</p>
                <VirtualMicSection
                  streamStatus={status}
                  vmicStatus={vmicStatus}
                  vmicInfo={vmicInfo}
                  onToggle={toggleVirtualMic}
                  onRecheck={() => window.api?.virtualMic.recheck().then(setVmicInfo)}
                />
              </div>

              <div style={{ flex: 1 }} />

              {status === "idle" && (
                <button onClick={startReceiving} style={s.startBtn}>
                  → START RECEIVING
                </button>
              )}

              <div style={s.panelFooter}>
                {isCloudMode(hostUrl) ? (
                  <>
                    <span>CLOUD RELAY</span>
                    <span>·</span>
                    <span>WebRTC P2P</span>
                  </>
                ) : (
                  <>
                    <span>PORT {port}</span>
                    <span>·</span>
                    <span>LAN ONLY</span>
                    <span>·</span>
                    <span>0.0.0.0</span>
                  </>
                )}
                {appVersion && (
                  <>
                    <span style={{ flex: 1 }} />
                    <span>v{appVersion}</span>
                  </>
                )}
              </div>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
