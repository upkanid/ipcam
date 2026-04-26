import type { Route } from "./+types/landing";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "IPCam Upkan — Phone to Webcam, Wirelessly" },
    { name: "description", content: "Stream your phone camera to any PC on your local network via WebRTC. No cloud, no drivers, no cables." },
  ];
}

export default function Landing() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", overflowX: "hidden" }}>
      {/* Subtle grid background */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(0,232,122,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,232,122,0.025) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          pointerEvents: "none",
          animation: "grid-fade 1.2s ease both",
        }}
      />

      {/* ── Nav ───────────────────────────────────────────── */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 40px",
          borderBottom: "1px solid var(--border)",
          position: "relative",
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 13,
            color: "var(--accent)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          IPCAM_UPKAN
        </span>
        <a
          href="/share"
          style={{
            fontFamily: "var(--mono)",
            fontSize: 12,
            color: "var(--text-muted)",
            textDecoration: "none",
            letterSpacing: "0.1em",
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          SHARE CAMERA →
        </a>
      </nav>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "60px",
          padding: "80px 40px 80px",
          maxWidth: 1200,
          margin: "0 auto",
          alignItems: "center",
          position: "relative",
          zIndex: 5,
        }}
      >
        {/* Left: Copy */}
        <div style={{ animation: "fade-up 0.7s ease both" }}>
          {/* Status badges */}
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 36,
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--danger)",
                letterSpacing: "0.12em",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ animation: "rec-blink 1.2s step-end infinite" }}>●</span>
              REC
            </span>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--accent)",
                letterSpacing: "0.18em",
                border: "1px solid var(--accent)",
                padding: "2px 8px",
              }}
            >
              LIVE
            </span>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--text-muted)",
                letterSpacing: "0.12em",
              }}
            >
              WebRTC / LAN
            </span>
          </div>

          {/* Headline */}
          <h1
            style={{
              fontFamily: "var(--display)",
              fontSize: "clamp(64px, 7vw, 96px)",
              fontWeight: 900,
              lineHeight: 0.95,
              margin: "0 0 28px",
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              color: "var(--text)",
            }}
          >
            Jadikan{" "}
            <span style={{ color: "var(--accent)" }}>HP</span>
            {" "}kamu
            <br />
            webcam
            <br />
            wireless.
          </h1>

          <p
            style={{
              fontFamily: "var(--body)",
              fontSize: 16,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              maxWidth: 400,
              margin: "0 0 40px",
            }}
          >
            Stream kamera HP ke PC dalam jaringan lokal yang sama.
            Tanpa cloud, tanpa driver, tanpa kabel.{" "}
            <span style={{ color: "var(--text)", fontFamily: "var(--mono)", fontSize: 13 }}>Pure WebRTC.</span>
          </p>

          <a
            href="/share"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              background: "var(--accent)",
              color: "#000",
              fontFamily: "var(--mono)",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              textDecoration: "none",
              padding: "14px 28px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#00ff88";
              e.currentTarget.style.boxShadow = "0 0 30px var(--accent-glow)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--accent)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            → Start Sharing
          </a>
        </div>

        {/* Right: Viewfinder */}
        <div
          style={{
            animation: "fade-up 0.7s 0.15s ease both",
            opacity: 0,
          }}
        >
          <Viewfinder />
        </div>
      </section>

      {/* ── Steps ─────────────────────────────────────────── */}
      <section
        style={{
          borderTop: "1px solid var(--border)",
          padding: "60px 40px",
          maxWidth: 1200,
          margin: "0 auto",
          position: "relative",
          zIndex: 5,
        }}
      >
        <p
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: "var(--text-muted)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            marginBottom: 40,
          }}
        >
          // Cara Pakai
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 1,
            background: "var(--border)",
          }}
        >
          {[
            { n: "01", text: "Buka Electron app di PC atau laptop" },
            { n: "02", text: "Catat IP yang ditampilkan di app" },
            { n: "03", text: "Buka halaman /share di HP, masukkan IP" },
            { n: "04", text: "Izinkan kamera — stream langsung aktif" },
          ].map(({ n, text }) => (
            <div
              key={n}
              style={{
                background: "var(--bg)",
                padding: "32px 28px",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg)")}
            >
              <span
                style={{
                  display: "block",
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--accent)",
                  letterSpacing: "0.15em",
                  marginBottom: 14,
                }}
              >
                {n} /
              </span>
              <p
                style={{
                  fontFamily: "var(--body)",
                  fontSize: 15,
                  color: "var(--text)",
                  lineHeight: 1.55,
                  margin: 0,
                }}
              >
                {text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "24px 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.1em" }}>
          IPCAM_UPKAN
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)" }}>
          PORT 3717 / LAN ONLY
        </span>
      </footer>
    </div>
  );
}

function Viewfinder() {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "4/3",
        border: "1px solid var(--border-bright)",
        background: "#050805",
        overflow: "hidden",
      }}
    >
      {/* Corner brackets */}
      {(["tl", "tr", "bl", "br"] as const).map((pos) => (
        <span
          key={pos}
          aria-hidden
          style={{
            position: "absolute",
            width: 20,
            height: 20,
            borderColor: "var(--accent)",
            borderStyle: "solid",
            borderWidth: 0,
            ...(pos === "tl" && { top: 12, left: 12, borderTopWidth: 2, borderLeftWidth: 2 }),
            ...(pos === "tr" && { top: 12, right: 12, borderTopWidth: 2, borderRightWidth: 2 }),
            ...(pos === "bl" && { bottom: 12, left: 12, borderBottomWidth: 2, borderLeftWidth: 2 }),
            ...(pos === "br" && { bottom: 12, right: 12, borderBottomWidth: 2, borderRightWidth: 2 }),
          }}
        />
      ))}

      {/* Scanline */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 1,
          background: "linear-gradient(90deg, transparent 0%, var(--accent) 40%, var(--accent) 60%, transparent 100%)",
          opacity: 0.5,
          animation: "scanline 4s linear infinite",
        }}
      />

      {/* Center text */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--text-muted)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          WAITING FOR SIGNAL
        </span>
        <div
          style={{
            width: 40,
            height: 1,
            background: "var(--border-bright)",
          }}
        />
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: "rgba(0,232,122,0.3)",
            letterSpacing: "0.12em",
          }}
        >
          PORT: 3717
        </span>
      </div>

      {/* Bottom status bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "8px 14px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          background: "rgba(0,0,0,0.6)",
        }}
      >
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.12em" }}>
          STATUS: OFFLINE
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.12em" }}>
          WebRTC · H.264
        </span>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 9,
            color: "var(--danger)",
            letterSpacing: "0.12em",
            animation: "rec-blink 1.2s step-end infinite",
          }}
        >
          NO SIGNAL
        </span>
      </div>
    </div>
  );
}
