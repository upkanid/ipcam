import { useState } from "react";
import type { Status, VMicStatus, VMicInfo } from "../types";

export function VirtualMicSection({
  streamStatus,
  vmicStatus,
  vmicInfo,
  onToggle,
  onRecheck,
}: {
  streamStatus: Status;
  vmicStatus: VMicStatus;
  vmicInfo: VMicInfo | null;
  onToggle: () => void;
  onRecheck: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!vmicInfo) {
    return (
      <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em" }}>
        MEMUAT...
      </span>
    );
  }

  if (!vmicInfo.supported) {
    const helpUrl =
      navigator.platform.startsWith("Mac")
        ? "https://existential.audio/blackhole/"
        : navigator.platform.startsWith("Win")
          ? "https://vb-audio.com/Cable/"
          : "https://pipewire.org/";

    const helpLabel =
      navigator.platform.startsWith("Mac")
        ? "↗ INSTALL BLACKHOLE"
        : navigator.platform.startsWith("Win")
          ? "↗ INSTALL VB-CABLE"
          : "↗ SETUP PIPEWIRE";

    const commandMatch = vmicInfo.reason.match(/Jalankan:\n([^\n]+)/);
    const command = commandMatch ? commandMatch[1] : null;

    const copyCommand = () => {
      if (command) {
        navigator.clipboard.writeText(command);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--warning)", letterSpacing: "0.1em" }}>
          SETUP DIPERLUKAN
        </span>
        <div>
          <p
            className="selectable"
            style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-muted)", lineHeight: 1.7, letterSpacing: "0.04em", whiteSpace: "pre-wrap" }}
          >
            {vmicInfo.reason}
          </p>
          {command && (
            <button
              onClick={copyCommand}
              style={{ marginTop: 8, background: "rgba(245, 166, 35, 0.1)", border: "1px solid var(--warning)", color: "var(--warning)", padding: "2px 6px", fontSize: 8, fontFamily: "var(--mono)", cursor: "pointer", borderRadius: 2 }}
            >
              {copied ? "✓ COPIED" : "⧉ COPY COMMAND"}
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => window.open(helpUrl)}
            style={{ flex: 1, fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em", background: "transparent", border: "1px solid var(--warning)", color: "var(--warning)", padding: "5px 8px", cursor: "pointer" }}
          >
            {helpLabel}
          </button>
          <button
            onClick={onRecheck}
            style={{ flex: 1, fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em", background: "transparent", border: "1px solid var(--border-bright)", color: "var(--text-muted)", padding: "5px 8px", cursor: "pointer" }}
          >
            ↺ CEK ULANG
          </button>
        </div>
      </div>
    );
  }

  const isActive = vmicStatus === "active";
  const isStarting = vmicStatus === "starting";
  const isError = vmicStatus === "error";
  const canEnable = streamStatus === "connected" && vmicStatus === "idle";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em",
            color: isActive ? "var(--accent)" : isError ? "var(--danger)" : isStarting ? "var(--warning)" : "var(--text-muted)",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          {isActive && (
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block", animation: "pulse-ring 2s ease infinite" }} />
          )}
          {isActive ? "BROADCASTING" : isStarting ? "STARTING..." : isError ? "ERROR" : "OFFLINE"}
        </span>
        <button
          onClick={onToggle}
          disabled={!canEnable && vmicStatus === "idle"}
          style={{
            fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.14em", background: "transparent",
            cursor: canEnable || vmicStatus !== "idle" ? "pointer" : "not-allowed",
            border: `1px solid ${isActive || isStarting ? "var(--danger)" : canEnable ? "var(--accent)" : "var(--border-bright)"}`,
            color: isActive || isStarting ? "var(--danger)" : canEnable ? "var(--accent)" : "var(--text-muted)",
            padding: "4px 10px",
            opacity: !canEnable && vmicStatus === "idle" ? 0.4 : 1,
            transition: "all 0.2s",
          }}
        >
          {isActive || isStarting ? "■ STOP" : isError ? "↺ RETRY" : "→ ENABLE"}
        </button>
      </div>

      {vmicInfo.device && vmicStatus !== "idle" && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em" }}>
            DEVICE
          </span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text)", letterSpacing: "0.06em" }}>
            {vmicInfo.device}
          </span>
        </div>
      )}

      {vmicStatus === "idle" && streamStatus !== "connected" && (
        <p style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.04em", lineHeight: 1.6 }}>
          Hubungkan HP terlebih dahulu untuk mengaktifkan virtual mic.
        </p>
      )}
    </div>
  );
}
