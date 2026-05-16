import type React from "react";

export function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
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
