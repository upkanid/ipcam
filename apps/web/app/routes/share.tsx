import { useRef, useState } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/share";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Share Camera — IPCam Upkan" }];
}

type Status = "idle" | "connecting" | "streaming";

type FacingMode = "environment" | "user" | "any";
type Quality = "360" | "720" | "1080";

interface MediaSettings {
  audio: boolean;
  video: boolean;
  facing: FacingMode;
  quality: Quality;
}

const QUALITY_MAP: Record<Quality, { width: number; height: number }> = {
  "360":  { width: 640,  height: 360  },
  "720":  { width: 1280, height: 720  },
  "1080": { width: 1920, height: 1080 },
};

export default function Share() {
  const [params] = useSearchParams();
  const defaultIp = [params.get("ip"), params.get("port")]
    .filter(Boolean)
    .join(":");

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef    = useRef<RTCPeerConnection | null>(null);
  const wsRef    = useRef<WebSocket | null>(null);

  const [ip, setIp]         = useState(defaultIp);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError]   = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [media, setMedia]   = useState<MediaSettings>({
    audio: true,
    video: true,
    facing: "environment",
    quality: "720",
  });

  async function startSharing() {
    if (!ip.trim() || (!media.audio && !media.video)) return;
    setError("");
    setStatus("connecting");

    const { width, height } = QUALITY_MAP[media.quality];
    const videoConstraints = media.video
      ? {
          width: { ideal: width },
          height: { ideal: height },
          facingMode: media.facing === "any" ? undefined : media.facing,
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

    if (videoRef.current) videoRef.current.srcObject = stream;

    const target = ip.trim().includes(":") ? ip.trim() : `${ip.trim()}:3717`;
    const ws = new WebSocket(`ws://${target}`);
    wsRef.current = ws;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (ev) => {
      if (ev.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "candidate", payload: ev.candidate }));
      }
    };

    ws.onopen = async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: "offer", payload: offer }));
      setStatus("streaming");
    };

    ws.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
      } else if (msg.type === "candidate") {
        await pc.addIceCandidate(new RTCIceCandidate(msg.payload));
      }
    };

    ws.onerror = () => {
      setError(`Tidak bisa terhubung ke ${target}. Pastikan Electron app sedang berjalan.`);
      setStatus("idle");
      stream.getTracks().forEach((t) => t.stop());
    };
  }

  function stopSharing() {
    pcRef.current?.close();
    wsRef.current?.close();
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setStatus("idle");
  }

  const isStreaming  = status === "streaming";
  const isConnecting = status === "connecting";
  const isActive     = isStreaming || isConnecting;

  return (
    <div style={s.root}>
      {/* ── Header ─────────────────────────────────────── */}
      <header style={s.header}>
        <a href="/" style={s.back}>← BACK</a>
        <span style={s.logo}>IPCAM_UPKAN</span>
        <StatusBadge status={status} />
      </header>

      {/* ── Preview ────────────────────────────────────── */}
      <div style={s.previewWrap}>
        <video ref={videoRef} autoPlay muted playsInline
          style={{ ...s.preview, display: isActive ? "block" : "none" }}
        />

        {!isActive && (
          <div style={s.previewIdle}>
            <CameraIcon />
            <span style={s.previewIdleText}>NO SIGNAL</span>
          </div>
        )}

        {isConnecting && (
          <div style={s.connectingOverlay}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)", letterSpacing: "0.2em", animation: "rec-blink 0.8s step-end infinite" }}>
              CONNECTING...
            </span>
          </div>
        )}

        {isStreaming && (
          <>
            {(["tl", "tr", "bl", "br"] as const).map((p) => <Corner key={p} pos={p} />)}
            <div style={s.liveBadge}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--danger)", display: "inline-block", animation: "rec-blink 1.2s step-end infinite" }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text)", letterSpacing: "0.15em" }}>LIVE</span>
            </div>
          </>
        )}
      </div>

      {/* ── Controls ───────────────────────────────────── */}
      <div style={s.controls}>

        {/* Media settings toggle — only when idle */}
        {status === "idle" && (
          <button
            onClick={() => setShowSettings((v) => !v)}
            style={{
              ...s.settingsToggle,
              color: showSettings ? "var(--accent)" : "var(--text-muted)",
              borderColor: showSettings ? "var(--accent)" : "var(--border-bright)",
            }}
          >
            ⚙ MEDIA SETTINGS
          </button>
        )}

        {/* Expandable settings */}
        {showSettings && status === "idle" && (
          <MediaSettingsPanel media={media} setMedia={setMedia} />
        )}

        {/* IP input */}
        <div style={{ position: "relative" }}>
          <span style={s.wsPrefix}>ws://</span>
          <input
            type="text"
            inputMode="url"
            placeholder="192.168.x.x:3717"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && status === "idle" && startSharing()}
            disabled={isActive}
            style={{
              ...s.ipInput,
              color: isActive ? "var(--text-muted)" : "var(--text)",
              borderColor: isStreaming ? "var(--accent)" : "var(--border-bright)",
            }}
            onFocus={(e) => { if (!isActive) e.target.style.borderColor = "var(--accent)" }}
            onBlur={(e) => { if (!isActive) e.target.style.borderColor = "var(--border-bright)" }}
          />
        </div>

        {error && <p style={s.error}>{error}</p>}

        {/* Action button */}
        {status === "idle" ? (
          <button
            onClick={startSharing}
            disabled={!ip.trim() || (!media.audio && !media.video)}
            style={{
              ...s.actionBtn,
              background: (ip.trim() && (media.audio || media.video)) ? "var(--accent)" : "var(--surface)",
              color: (ip.trim() && (media.audio || media.video)) ? "#000" : "var(--text-muted)",
              cursor: (ip.trim() && (media.audio || media.video)) ? "pointer" : "not-allowed",
            }}
          >
            → Start Sharing
          </button>
        ) : (
          <button onClick={stopSharing} style={s.stopBtn}>■ Stop</button>
        )}

        {/* Active stream info */}
        {isStreaming && (
          <div style={s.streamInfo}>
            <span style={{ color: "var(--accent)" }}>♪ {media.audio ? "AUDIO ON" : "NO AUDIO"}</span>
            <span>·</span>
            <span style={{ color: "var(--accent)" }}>▶ {media.video ? `VIDEO ${media.quality}p` : "NO VIDEO"}</span>
            <span>·</span>
            <span>{media.video && media.facing !== "any" ? (media.facing === "environment" ? "REAR CAM" : "FRONT CAM") : "ANY CAM"}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Media Settings Panel ───────────────────────────────── */

function MediaSettingsPanel({
  media, setMedia,
}: {
  media: MediaSettings;
  setMedia: (m: MediaSettings) => void;
}) {
  function update<K extends keyof MediaSettings>(key: K, val: MediaSettings[K]) {
    setMedia({ ...media, [key]: val });
  }

  return (
    <div style={sp.panel}>
      {/* Audio */}
      <div style={sp.row}>
        <span style={sp.label}>AUDIO</span>
        <ToggleGroup
          options={[{ label: "ON", value: true }, { label: "OFF", value: false }]}
          value={media.audio}
          onChange={(v) => update("audio", v)}
        />
      </div>

      {/* Video */}
      <div style={sp.row}>
        <span style={sp.label}>VIDEO</span>
        <ToggleGroup
          options={[{ label: "ON", value: true }, { label: "OFF", value: false }]}
          value={media.video}
          onChange={(v) => update("video", v)}
        />
      </div>

      {/* Camera facing — only when video on */}
      {media.video && (
        <div style={sp.row}>
          <span style={sp.label}>CAMERA</span>
          <ToggleGroup<FacingMode>
            options={[
              { label: "REAR", value: "environment" },
              { label: "FRONT", value: "user" },
              { label: "ANY", value: "any" },
            ]}
            value={media.facing}
            onChange={(v) => update("facing", v)}
          />
        </div>
      )}

      {/* Quality — only when video on */}
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
        <p style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--danger)", letterSpacing: "0.08em" }}>
          Minimal satu track harus aktif.
        </p>
      )}
    </div>
  );
}

function ToggleGroup<T>({
  options, value, onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
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
    position: "absolute", width: 18, height: 18,
    borderColor: "var(--accent)", borderStyle: "solid", borderWidth: 0, opacity: 0.7,
  };
  const map: Record<string, React.CSSProperties> = {
    tl: { top: 12, left: 12, borderTopWidth: 2, borderLeftWidth: 2 },
    tr: { top: 12, right: 12, borderTopWidth: 2, borderRightWidth: 2 },
    bl: { bottom: 12, left: 12, borderBottomWidth: 2, borderLeftWidth: 2 },
    br: { bottom: 12, right: 12, borderBottomWidth: 2, borderRightWidth: 2 },
  };
  return <span aria-hidden style={{ ...base, ...map[pos] }} />;
}

function StatusBadge({ status }: { status: Status }) {
  const labels: Record<Status, string> = { idle: "OFFLINE", connecting: "CONNECTING", streaming: "LIVE" };
  const colors: Record<Status, string> = { idle: "var(--text-muted)", connecting: "#f5a623", streaming: "var(--accent)" };
  return (
    <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: colors[status], letterSpacing: "0.15em",
      animation: status === "streaming" ? "rec-blink 2s step-end infinite" : "none" }}>
      {labels[status]}
    </span>
  );
}

function CameraIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--border-bright)" strokeWidth="1" strokeLinecap="round">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="1" />
    </svg>
  );
}

/* ── Styles ─────────────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  root: { background: "var(--bg)", minHeight: "100dvh", display: "flex", flexDirection: "column" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 },
  back: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)", textDecoration: "none", letterSpacing: "0.12em" },
  logo: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)", letterSpacing: "0.18em" },

  previewWrap: { flex: 1, position: "relative", background: "#050805", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  preview: { width: "100%", height: "100%", objectFit: "cover" },
  previewIdle: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  previewIdleText: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.2em" },
  connectingOverlay: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(5,8,5,0.75)" },
  liveBadge: { position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.6)", padding: "4px 10px" },

  controls: { padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10, flexShrink: 0, background: "var(--bg2)" },
  settingsToggle: { alignSelf: "flex-start", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.12em", background: "transparent", border: "1px solid", padding: "5px 12px", cursor: "pointer", transition: "all 0.2s" },
  wsPrefix: { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-muted)", pointerEvents: "none", letterSpacing: "0.05em" },
  ipInput: { width: "100%", padding: "14px 14px 14px 52px", fontFamily: "var(--mono)", fontSize: 15, background: "var(--surface)", border: "1px solid", borderRadius: 0, outline: "none", letterSpacing: "0.05em", transition: "border-color 0.2s" },
  error: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--danger)", letterSpacing: "0.05em", padding: "10px 14px", background: "rgba(255,60,60,0.08)", border: "1px solid rgba(255,60,60,0.2)" },
  actionBtn: { width: "100%", padding: "16px", fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", border: "none", transition: "all 0.2s" },
  stopBtn: { width: "100%", padding: "16px", background: "transparent", color: "var(--danger)", fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", border: "1px solid var(--danger)", cursor: "pointer" },
  streamInfo: { display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em" },
};

const sp: Record<string, React.CSSProperties> = {
  panel: { display: "flex", flexDirection: "column", gap: 14, padding: "14px", background: "var(--surface)", border: "1px solid var(--border-bright)" },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  label: { fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.14em", flexShrink: 0 },
};
