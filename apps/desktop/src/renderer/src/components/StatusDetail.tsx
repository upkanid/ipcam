import type { Status } from "../types";

export function StatusDetail({ status }: { status: Status }) {
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
