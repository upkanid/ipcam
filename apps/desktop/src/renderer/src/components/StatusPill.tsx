import type { Status } from "../types";

export function StatusPill({ status, reconnecting }: { status: Status; reconnecting?: boolean }) {
  const color = reconnecting
    ? "var(--warning)"
    : status === "idle"
      ? "var(--text-muted)"
      : status === "waiting"
        ? "var(--warning)"
        : "var(--accent)";
  const label = reconnecting
    ? "RECONNECTING"
    : status === "idle"
      ? "OFFLINE"
      : status === "waiting"
        ? "WAITING"
        : "CONNECTED";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: color,
          display: "inline-block",
          animation:
            status === "connected"
              ? "pulse-ring 2s ease infinite"
              : status === "waiting" || reconnecting
                ? "blink 0.9s step-end infinite"
                : "none",
        }}
      />
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          color,
          letterSpacing: "0.16em",
        }}
      >
        {label}
      </span>
    </div>
  );
}
