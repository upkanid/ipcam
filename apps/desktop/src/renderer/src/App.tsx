import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

const DEFAULT_PORT = 3717;
const DEFAULT_HOST = "https://ipcam.upkan.id";

function generateRoomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(3)))
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

type Status = "idle" | "waiting" | "connected";
type VCamStatus = "idle" | "starting" | "active" | "error" | "unsupported";

interface VCamInfo {
  supported: boolean;
  reason: string;
  device?: string;
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const rafRef = useRef(0);
  const lastFrameRef = useRef(0);
  const vcamArmedRef = useRef(false);

  const prevStatusRef = useRef<Status>("idle");

  const [localIP, setLocalIP] = useState("—");
  const [status, setStatus] = useState<Status>("idle");
  const [fps, setFps] = useState<number | null>(null);
  const [resolution, setResolution] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [showSettings, setShowSettings] = useState(false);
  const [roomId, setRoomId] = useState(generateRoomId);
  const [roomCopied, setRoomCopied] = useState(false);

  // Settings state
  const [port, setPort] = useState(DEFAULT_PORT);
  const [portInput, setPortInput] = useState(String(DEFAULT_PORT));
  const [hostUrl, setHostUrl] = useState(DEFAULT_HOST);
  const [hostInput, setHostInput] = useState(DEFAULT_HOST);

  // Virtual camera state
  const [vcamStatus, setVcamStatus] = useState<VCamStatus>("idle");
  const [vcamInfo, setVcamInfo] = useState<VCamInfo | null>(null);
  const [error, setError] = useState("");
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);

  useEffect(() => {
    window.api?.getLocalIP().then(setLocalIP);
    window.api?.getVersion().then(setAppVersion);
    window.api?.virtualCam.check().then(setVcamInfo);
    window.api?.virtualCam.onStatus((status, _reason) =>
      setVcamStatus(status as VCamStatus),
    );
    window.api?.updater.onDownloaded(setUpdateVersion);
    window.api?.updater.onAvailable(setUpdateAvailable);
    return () => window.api?.virtualCam.offStatus();
  }, []);

  // FPS polling via WebRTC inbound-rtp stats
  useEffect(() => {
    if (status !== "connected" || !pcRef.current) {
      setFps(null);
      return;
    }
    const interval = setInterval(async () => {
      if (!pcRef.current) return;
      const stats = await pcRef.current.getStats();
      stats.forEach((report) => {
        if (report.type === "inbound-rtp") {
          const r = report as RTCInboundRtpStreamStats;
          if (r.kind === "video" && typeof r.framesPerSecond === "number") {
            setFps(Math.round(r.framesPerSecond));
          }
        }
      });
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
  useEffect(() => { startReceiving(); }, []);

  // Sync audio to video element (React muted prop doesn't update reactively)
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = muted;
    videoRef.current.volume = volume;
  }, [muted, volume]);

  // Frame capture loop — only runs when vcam is armed and stream is connected
  useEffect(() => {
    const armed = vcamStatus !== "idle" && vcamStatus !== "unsupported";
    if (!armed || status !== "connected") {
      vcamArmedRef.current = false;
      cancelAnimationFrame(rafRef.current);
      return;
    }

    vcamArmedRef.current = true;
    const W = 640,
      H = 480;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    const INTERVAL = 1000 / 15; // 15 fps

    function loop() {
      if (!vcamArmedRef.current) return;
      const now = performance.now();
      if (
        now - lastFrameRef.current >= INTERVAL &&
        videoRef.current &&
        videoRef.current.readyState >= 2
      ) {
        lastFrameRef.current = now;
        ctx.drawImage(videoRef.current, 0, 0, W, H);
        const { data, width, height } = ctx.getImageData(0, 0, W, H);
        window.api.virtualCam.sendFrame(data.buffer.slice(0), width, height);
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      vcamArmedRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [vcamStatus, status]);

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

  function startReceiving() {
    setError("");
    const ws = new WebSocket(getSignalingUrl(hostUrl, roomId, port));
    wsRef.current = ws;
    setStatus("waiting");

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcRef.current = pc;

    pc.ontrack = (ev) => {
      if (videoRef.current) {
        videoRef.current.srcObject = ev.streams[0];
        setStatus("connected");
      }
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "candidate", payload: ev.candidate }));
      }
    };

    ws.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: "answer", payload: answer }));
      } else if (msg.type === "candidate") {
        await pc.addIceCandidate(new RTCIceCandidate(msg.payload));
      }
    };

    ws.onerror = () => {
      setError(
        `Tidak bisa terhubung ke signaling server. Periksa host URL dan port.`,
      );
      setStatus("idle");
    };

    ws.onclose = (ev) => {
      if (!ev.wasClean) {
        setError("Koneksi ke signaling server terputus.");
        setStatus("idle");
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        setError("Koneksi WebRTC gagal. Coba start receiving lagi.");
        setStatus("idle");
      }
    };
  }

  function stop() {
    if (vcamStatus !== "idle") window.api.virtualCam.disarm();
    pcRef.current?.close();
    wsRef.current?.close();
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
    setError("");
    setFps(null);
    setResolution(null);
    setRoomId(generateRoomId());
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
          <StatusPill status={status} />
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
              ["SRC", "PHONE / WebRTC"],
              ["CODEC", "H.264 / VP9"],
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
                <span style={s.mfValue}>{value}</span>
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
                  onRecheck={() => window.api?.virtualCam.check().then(setVcamInfo)}
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

/* ── Settings Panel ─────────────────────────────────────── */

function SettingsPanel({
  portInput,
  setPortInput,
  hostInput,
  setHostInput,
  onApply,
  onCancel,
}: {
  portInput: string;
  setPortInput: (v: string) => void;
  hostInput: string;
  setHostInput: (v: string) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const portNum = parseInt(portInput);
  const portValid = !isNaN(portNum) && portNum >= 1024 && portNum <= 65535;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        height: "100%",
      }}
    >
      <p style={{ ...s.sectionLabel, marginBottom: 20 }}>// SETTINGS</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Port */}
        <div style={s.settingRow}>
          <label style={s.settingLabel}>
            SIGNALING PORT
            <span
              style={{
                color: "var(--text-muted)",
                fontWeight: 400,
                fontSize: 9,
              }}
            >
              {" "}
              (1024–65535)
            </span>
          </label>
          <input
            type="number"
            value={portInput}
            onChange={(e) => setPortInput(e.target.value)}
            min={1024}
            max={65535}
            style={{
              ...s.settingInput,
              borderColor: portValid ? "var(--border-bright)" : "var(--danger)",
            }}
            onFocus={(e) => {
              if (portValid) e.target.style.borderColor = "var(--accent)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = portValid
                ? "var(--border-bright)"
                : "var(--danger)";
            }}
          />
          {!portValid && portInput !== "" && (
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 9,
                color: "var(--danger)",
                letterSpacing: "0.05em",
              }}
            >
              Port tidak valid
            </span>
          )}
        </div>

        {/* Host URL */}
        <div style={s.settingRow}>
          <label style={s.settingLabel}>
            WEB APP URL
            <span
              style={{
                color: "var(--text-muted)",
                fontWeight: 400,
                fontSize: 9,
              }}
            >
              {" "}
              (untuk QR)
            </span>
          </label>
          <input
            type="url"
            value={hostInput}
            onChange={(e) => setHostInput(e.target.value)}
            placeholder="https://ipcam.upkan.id"
            style={s.settingInput}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--accent)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border-bright)";
            }}
          />
          <p
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--text-muted)",
              letterSpacing: "0.04em",
              lineHeight: 1.6,
            }}
          >
            URL yang di-encode ke QR code. Ubah ke{" "}
            <span style={{ color: "var(--text)" }}>http://&lt;ip&gt;:5173</span>{" "}
            saat dev lokal.
          </p>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onApply}
          disabled={!portValid}
          style={{
            ...s.startBtn,
            flex: 1,
            marginBottom: 0,
            opacity: portValid ? 1 : 0.4,
            cursor: portValid ? "pointer" : "not-allowed",
          }}
        >
          APPLY
        </button>
        <button
          onClick={onCancel}
          style={{ ...s.stopBtn, padding: "11px 16px", marginBottom: 0 }}
        >
          CANCEL
        </button>
      </div>

      <div style={{ height: 16 }} />
      <div style={s.panelFooter}>
        <span>PORT CHANGE RESTARTS SERVER</span>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const base: React.CSSProperties = {
    position: "absolute",
    width: 22,
    height: 22,
    borderColor: "var(--accent)",
    borderStyle: "solid",
    borderWidth: 0,
    opacity: 0.8,
  };
  const map: Record<string, React.CSSProperties> = {
    tl: { top: 14, left: 14, borderTopWidth: 2, borderLeftWidth: 2 },
    tr: { top: 14, right: 14, borderTopWidth: 2, borderRightWidth: 2 },
    bl: { bottom: 14, left: 14, borderBottomWidth: 2, borderLeftWidth: 2 },
    br: { bottom: 14, right: 14, borderBottomWidth: 2, borderRightWidth: 2 },
  };
  return <span aria-hidden style={{ ...base, ...map[pos] }} />;
}

function StatusPill({ status }: { status: Status }) {
  const colors: Record<Status, string> = {
    idle: "var(--text-muted)",
    waiting: "var(--warning)",
    connected: "var(--accent)",
  };
  const labels: Record<Status, string> = {
    idle: "OFFLINE",
    waiting: "WAITING",
    connected: "CONNECTED",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: colors[status],
          display: "inline-block",
          animation:
            status === "connected"
              ? "pulse-ring 2s ease infinite"
              : status === "waiting"
                ? "blink 0.9s step-end infinite"
                : "none",
        }}
      />
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: colors[status],
          letterSpacing: "0.16em",
        }}
      >
        {labels[status]}
      </span>
    </div>
  );
}

function StatusDetail({ status }: { status: Status }) {
  const rows: Record<
    Status,
    { label: string; value: string; accent?: boolean }[]
  > = {
    idle: [
      { label: "STREAM", value: "INACTIVE" },
      { label: "PEERS", value: "0" },
      { label: "ICE", value: "NOT STARTED" },
    ],
    waiting: [
      { label: "STREAM", value: "PENDING", accent: true },
      { label: "PEERS", value: "0" },
      { label: "ICE", value: "GATHERING", accent: true },
    ],
    connected: [
      { label: "STREAM", value: "ACTIVE", accent: true },
      { label: "PEERS", value: "1", accent: true },
      { label: "ICE", value: "CONNECTED", accent: true },
    ],
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows[status].map(({ label, value, accent }) => (
        <div
          key={label}
          style={{ display: "flex", justifyContent: "space-between" }}
        >
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--text-muted)",
              letterSpacing: "0.12em",
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: accent ? "var(--accent)" : "var(--text-muted)",
              letterSpacing: "0.1em",
            }}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

function SignalBars({ status }: { status: Status }) {
  const count = 12;
  return (
    <div
      style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 32 }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const active = status === "connected";
        const waiting = status === "waiting";
        const delay = `${(i * 0.06).toFixed(2)}s`;
        const h = 8 + (i / count) * 24;
        return (
          <div
            key={i}
            style={{
              width: 3,
              height: h,
              background: active
                ? i > count * 0.75
                  ? "var(--danger)"
                  : i > count * 0.5
                    ? "var(--warning)"
                    : "var(--accent)"
                : waiting
                  ? "var(--accent-dim)"
                  : "var(--border-bright)",
              transformOrigin: "bottom",
              transition: "background 0.3s",
              animation: active
                ? `bar-active ${0.4 + i * 0.03}s ${delay} ease-in-out infinite`
                : waiting
                  ? `bar-idle ${0.6 + i * 0.04}s ${delay} ease-in-out infinite`
                  : "none",
            }}
          />
        );
      })}
    </div>
  );
}

function VirtualCamSection({
  streamStatus,
  vcamStatus,
  vcamInfo,
  onToggle,
  onRecheck,
}: {
  streamStatus: Status;
  vcamStatus: VCamStatus;
  vcamInfo: VCamInfo | null;
  onToggle: () => void;
  onRecheck: () => void;
}) {
  if (!vcamInfo) {
    return (
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          color: "var(--text-muted)",
          letterSpacing: "0.1em",
        }}
      >
        MEMUAT...
      </span>
    );
  }

  if (!vcamInfo.supported) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: "var(--warning)",
            letterSpacing: "0.1em",
          }}
        >
          DRIVER DIPERLUKAN
        </span>
        <p
          style={{
            fontFamily: "var(--mono)",
            fontSize: 9,
            color: "var(--text-muted)",
            lineHeight: 1.7,
            letterSpacing: "0.04em",
            whiteSpace: "pre-wrap",
          }}
        >
          {vcamInfo.reason}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => window.open("https://obsproject.com/wiki/install-instructions/mac")}
            style={{
              flex: 1,
              fontFamily: "var(--mono)",
              fontSize: 9,
              letterSpacing: "0.12em",
              background: "transparent",
              border: "1px solid var(--warning)",
              color: "var(--warning)",
              padding: "5px 8px",
              cursor: "pointer",
            }}
          >
            ↗ DOWNLOAD OBS
          </button>
          <button
            onClick={onRecheck}
            style={{
              flex: 1,
              fontFamily: "var(--mono)",
              fontSize: 9,
              letterSpacing: "0.12em",
              background: "transparent",
              border: "1px solid var(--border-bright)",
              color: "var(--text-muted)",
              padding: "5px 8px",
              cursor: "pointer",
            }}
          >
            ↺ CEK ULANG
          </button>
        </div>
      </div>
    );
  }

  const isActive = vcamStatus === "active";
  const isStarting = vcamStatus === "starting";
  const isError = vcamStatus === "error";
  const canEnable = streamStatus === "connected" && vcamStatus === "idle";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.1em",
            color: isActive
              ? "var(--accent)"
              : isError
                ? "var(--danger)"
                : isStarting
                  ? "var(--warning)"
                  : "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {isActive && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--accent)",
                display: "inline-block",
                animation: "pulse-ring 2s ease infinite",
              }}
            />
          )}
          {isActive
            ? "BROADCASTING"
            : isStarting
              ? "STARTING..."
              : isError
                ? "ERROR"
                : "OFFLINE"}
        </span>
        <button
          onClick={onToggle}
          disabled={!canEnable && vcamStatus === "idle"}
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.14em",
            background: "transparent",
            cursor:
              canEnable || vcamStatus !== "idle" ? "pointer" : "not-allowed",
            border: `1px solid ${isActive || isStarting ? "var(--danger)" : canEnable ? "var(--accent)" : "var(--border-bright)"}`,
            color:
              isActive || isStarting
                ? "var(--danger)"
                : canEnable
                  ? "var(--accent)"
                  : "var(--text-muted)",
            padding: "4px 10px",
            opacity: !canEnable && vcamStatus === "idle" ? 0.4 : 1,
            transition: "all 0.2s",
          }}
        >
          {isActive || isStarting ? "■ STOP" : isError ? "↺ RETRY" : "→ ENABLE"}
        </button>
      </div>

      {vcamInfo.device && vcamStatus !== "idle" && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--text-muted)",
              letterSpacing: "0.1em",
            }}
          >
            DEVICE
          </span>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--text)",
              letterSpacing: "0.06em",
            }}
          >
            {vcamInfo.device}
          </span>
        </div>
      )}

      {vcamStatus === "idle" && streamStatus !== "connected" && (
        <p
          style={{
            fontFamily: "var(--mono)",
            fontSize: 9,
            color: "var(--text-muted)",
            letterSpacing: "0.04em",
            lineHeight: 1.6,
          }}
        >
          Hubungkan HP terlebih dahulu untuk mengaktifkan virtual cam.
        </p>
      )}
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "var(--bg)",
    overflow: "hidden",
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
    height: 44,
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  headerLogo: {
    fontFamily: "var(--mono)",
    fontSize: 11,
    color: "var(--accent)",
    letterSpacing: "0.2em",
  },
  headerCenter: {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 140,
    justifyContent: "flex-end",
  },
  iconBtn: {
    fontFamily: "var(--mono)",
    fontSize: 13,
    background: "transparent",
    border: "1px solid",
    padding: "4px 8px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  stopBtn: {
    fontFamily: "var(--mono)",
    fontSize: 10,
    letterSpacing: "0.14em",
    color: "var(--danger)",
    background: "transparent",
    border: "1px solid var(--danger)",
    padding: "5px 12px",
    cursor: "pointer",
  },

  main: { display: "flex", flex: 1, overflow: "hidden", minHeight: 0 },

  monitorWrap: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid var(--border)",
    minWidth: 0,
  },
  monitor: {
    flex: 1,
    position: "relative",
    background: "#040604",
    overflow: "hidden",
  },
  video: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
    transition: "opacity 0.4s",
  },
  monitorGrid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(0,232,122,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,232,122,0.03) 1px, transparent 1px)",
    backgroundSize: "40px 40px",
    pointerEvents: "none",
    zIndex: 1,
  },
  scanline: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    background:
      "linear-gradient(90deg, transparent 0%, rgba(0,232,122,0.5) 40%, rgba(0,232,122,0.5) 60%, transparent 100%)",
    pointerEvents: "none",
    animation: "scanline 5s linear infinite",
    zIndex: 3,
  },
  monitorOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    zIndex: 2,
  },
  qrWrap: {
    padding: 8,
    background: "#0a0a0a",
    border: "1px solid var(--border-bright)",
  },
  qrLabel: {
    fontFamily: "var(--mono)",
    fontSize: 10,
    color: "var(--text-muted)",
    letterSpacing: "0.18em",
    textAlign: "center",
  },
  qrSub: {
    fontFamily: "var(--mono)",
    fontSize: 13,
    color: "var(--accent)",
    letterSpacing: "0.08em",
  },
  recBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(0,0,0,0.65)",
    padding: "4px 10px",
    zIndex: 10,
  },
  recDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "var(--danger)",
    display: "inline-block",
  },
  recText: {
    fontFamily: "var(--mono)",
    fontSize: 9,
    color: "var(--text)",
    letterSpacing: "0.18em",
  },
  mutedBadge: {
    position: "absolute",
    bottom: 14,
    right: 14,
    fontFamily: "var(--mono)",
    fontSize: 9,
    color: "var(--danger)",
    letterSpacing: "0.14em",
    background: "rgba(0,0,0,0.6)",
    padding: "3px 8px",
    zIndex: 10,
  },

  monitorFooter: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 16px",
    height: 32,
    borderTop: "1px solid var(--border)",
    flexShrink: 0,
  },
  mfLabel: {
    fontFamily: "var(--mono)",
    fontSize: 9,
    color: "var(--text-muted)",
    letterSpacing: "0.15em",
  },
  mfValue: {
    fontFamily: "var(--mono)",
    fontSize: 9,
    color: "var(--text)",
    letterSpacing: "0.08em",
  },
  mfSep: {
    width: 1,
    height: 12,
    background: "var(--border-bright)",
    margin: "0 4px",
    flexShrink: 0,
  },

  panel: {
    width: 264,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    padding: "20px 20px 16px",
    gap: 0,
    overflowY: "auto",
  },
  panelDivider: { height: 1, background: "var(--border)", margin: "18px 0" },
  section: { display: "flex", flexDirection: "column", gap: 12 },
  sectionLabel: {
    fontFamily: "var(--mono)",
    fontSize: 9,
    color: "var(--text-muted)",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
  },
  rowLabel: {
    fontFamily: "var(--mono)",
    fontSize: 10,
    color: "var(--text-muted)",
    letterSpacing: "0.12em",
  },
  toggleBtn: {
    fontFamily: "var(--mono)",
    fontSize: 10,
    letterSpacing: "0.14em",
    background: "transparent",
    border: "1px solid",
    padding: "4px 10px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  ipBlock: {
    display: "flex",
    alignItems: "baseline",
    padding: "14px 12px",
    background: "var(--surface)",
    border: "1px solid var(--border-bright)",
  },
  ipAddress: {
    fontFamily: "var(--display)",
    fontSize: 28,
    fontWeight: 800,
    color: "var(--text)",
    letterSpacing: "-0.01em",
  },
  ipPort: {
    fontFamily: "var(--mono)",
    fontSize: 13,
    color: "var(--accent)",
    letterSpacing: "0.04em",
    marginLeft: 2,
  },
  ipHint: {
    fontFamily: "var(--mono)",
    fontSize: 10,
    color: "var(--text-muted)",
    lineHeight: 1.6,
    letterSpacing: "0.04em",
  },
  startBtn: {
    width: "100%",
    padding: "13px",
    background: "var(--accent)",
    color: "#000",
    fontFamily: "var(--mono)",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.18em",
    border: "none",
    cursor: "pointer",
    textTransform: "uppercase",
    marginBottom: 16,
  },
  panelFooter: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "var(--mono)",
    fontSize: 9,
    color: "var(--text-muted)",
    letterSpacing: "0.1em",
  },

  updateBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 20px",
    background: "rgba(0,232,122,0.08)",
    borderBottom: "1px solid rgba(0,232,122,0.25)",
    flexShrink: 0,
  },
  updateText: {
    fontFamily: "var(--mono)",
    fontSize: 11,
    color: "var(--accent)",
    letterSpacing: "0.1em",
  },
  updateBtn: {
    fontFamily: "var(--mono)",
    fontSize: 10,
    letterSpacing: "0.14em",
    background: "var(--accent)",
    color: "#000",
    border: "none",
    padding: "5px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },

  errorBanner: {
    padding: "8px 10px",
    background: "rgba(255,60,60,0.08)",
    border: "1px solid rgba(255,60,60,0.25)",
  },
  errorText: {
    fontFamily: "var(--mono)",
    fontSize: 9,
    color: "var(--danger)",
    letterSpacing: "0.06em",
    lineHeight: 1.6,
  },

  settingRow: { display: "flex", flexDirection: "column", gap: 8 },
  settingLabel: {
    fontFamily: "var(--mono)",
    fontSize: 10,
    color: "var(--text-muted)",
    letterSpacing: "0.12em",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  settingInput: {
    width: "100%",
    padding: "9px 12px",
    fontFamily: "var(--mono)",
    fontSize: 13,
    color: "var(--text)",
    background: "var(--surface)",
    border: "1px solid var(--border-bright)",
    outline: "none",
    letterSpacing: "0.05em",
    transition: "border-color 0.2s",
  },
};
