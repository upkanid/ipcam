import { useState } from "react";
import type { Status, VCamStatus, VCamInfo } from "../types";


export function VirtualCamSection({
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
  const [copied, setCopied] = useState(false);

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
    const helpUrl =
      navigator.platform.startsWith("Win")
        ? "https://obsproject.com/download"
        : navigator.platform.startsWith("Mac")
          ? "https://obsproject.com/download"
          : "https://github.com/umlaeute/v4l2loopback";

    const helpLabel =
      navigator.platform.startsWith("Win") || navigator.platform.startsWith("Mac")
        ? "↗ DOWNLOAD OBS"
        : "↗ SETUP DRIVER";

    // Attempt to extract command from reason
    const commandMatch = vcamInfo.reason.match(/Jalankan:\n([^\n]+)/);
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
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: "var(--warning)",
            letterSpacing: "0.1em",
          }}
        >
          SETUP DIPERLUKAN
        </span>
        <div style={{ position: 'relative' }}>
          <p
            className="selectable"
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
          {command && (
            <button
              onClick={copyCommand}
              style={{
                marginTop: 8,
                background: "rgba(245, 166, 35, 0.1)",
                border: "1px solid var(--warning)",
                color: "var(--warning)",
                padding: "2px 6px",
                fontSize: 8,
                fontFamily: "var(--mono)",
                cursor: "pointer",
                borderRadius: 2,
              }}
            >
              {copied ? "✓ COPIED" : "⧉ COPY COMMAND"}
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => window.open(helpUrl)}
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
            {helpLabel}
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
