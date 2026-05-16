import type { Status } from "../types";

export function SignalBars({ status }: { status: Status }) {
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
