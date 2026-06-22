import type { Route } from "./+types/landing";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "IPCam Upkan — Phone to Webcam, Wirelessly" },
    { name: "description", content: "Stream your phone camera to any PC on your local network via WebRTC. No cloud, no drivers, no cables." },
    { property: "og:title", content: "IPCam Upkan — Phone to Webcam, Wirelessly" },
    { property: "og:description", content: "Stream your phone camera to any PC on your local network via WebRTC. No cloud, no drivers, no cables." },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://ipcam.upkan.id" },
    { property: "og:image", content: "https://ipcam.upkan.id/logo-icon.png" },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: "IPCam Upkan — Phone to Webcam, Wirelessly" },
    { name: "twitter:description", content: "Stream your phone camera to any PC via WebRTC. No cloud, no drivers, no cables." },
    { name: "theme-color", content: "#0d0d0d" },
  ];
}

export default function Landing() {
  return (
    <div className="bg-[var(--bg)] min-h-screen overflow-x-hidden">
      {/* Grid background */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none [animation:grid-fade_1.2s_ease_both]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,232,122,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,232,122,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* ── Nav ── */}
      <nav className="relative z-10 flex items-center justify-between px-10 py-5 border-b border-[var(--border)] max-sm:px-5 max-sm:py-4">
        <span className="font-[var(--mono)] text-[13px] text-[var(--accent)] tracking-[0.15em] uppercase">
          IPCAM_UPKAN
        </span>
        <a
          href="/share"
          className="font-[var(--mono)] text-[12px] text-[var(--text-muted)] no-underline tracking-[0.1em] transition-colors duration-200 hover:text-[var(--accent)]"
        >
          SHARE CAMERA →
        </a>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-[5] max-w-[1200px] mx-auto px-10 pt-16 pb-0 max-sm:px-5 max-sm:pt-10">
        {/* Tagline */}
        <div className="text-center mb-12 [animation:fade-up_0.6s_ease_both]">
          <div className="flex justify-center items-center gap-3 mb-5">
            <span className="font-[var(--mono)] text-[11px] text-[var(--danger)] tracking-[0.12em] flex items-center gap-1.5">
              <span className="[animation:rec-blink_1.2s_step-end_infinite]">●</span> REC
            </span>
            <span className="font-[var(--mono)] text-[10px] text-[var(--accent)] tracking-[0.18em] border border-[var(--accent)] px-2 py-0.5">
              LIVE
            </span>
            <span className="font-[var(--mono)] text-[10px] text-[var(--text-muted)] tracking-[0.12em]">
              WebRTC / P2P
            </span>
          </div>
          <h1 className="font-[var(--display)] text-[clamp(48px,6vw,80px)] font-black leading-[0.95] tracking-tight uppercase text-[var(--text)] mb-4">
            Jadikan <span className="text-[var(--accent)]">HP</span> kamu webcam wireless.
          </h1>
          <p className="font-[var(--body)] text-[15px] text-[var(--text-muted)] m-0">
            Tanpa cloud, tanpa driver, tanpa kabel.{" "}
            <span className="font-[var(--mono)] text-[12px] text-[var(--text)]">Pure WebRTC.</span>
          </p>
        </div>

        {/* Split panels */}
        <div className="grid grid-cols-[1fr_auto_1fr] border border-[var(--border)] max-sm:grid-cols-1">
          {/* Panel: HP */}
          <div
            className="p-12 [animation:fade-up_0.7s_0.1s_ease_both] opacity-0 max-sm:p-9"
          >
            <span className="block font-[var(--mono)] text-[10px] text-[var(--text-muted)] tracking-[0.2em] mb-4">
              01 / KAMU DI HP
            </span>
            <div className="text-4xl mb-5" aria-hidden>📱</div>
            <h2 className="font-[var(--display)] text-[clamp(28px,3vw,40px)] font-black uppercase text-[var(--text)] mb-3 leading-none">
              Jadikan kamera<br />
              <span className="text-[var(--accent)]">sumber stream</span>
            </h2>
            <p className="font-[var(--body)] text-[14px] text-[var(--text-muted)] leading-[1.65] mb-8">
              Buka halaman ini dari HP, lalu tap tombol di bawah. Kamera HP kamu langsung jadi webcam yang bisa diterima di PC.
            </p>
            <a
              href="/share"
              className="inline-flex items-center gap-2.5 bg-[var(--accent)] text-black font-[var(--mono)] text-[13px] font-bold tracking-[0.12em] uppercase no-underline px-7 py-3.5 transition-all duration-200 hover:bg-[#00ff88] hover:shadow-[0_0_30px_var(--accent-glow)]"
            >
              → Start Sharing
            </a>
          </div>

          {/* Divider */}
          <div
            aria-hidden
            className="flex flex-col items-center w-10 py-12 max-sm:flex-row max-sm:w-auto max-sm:h-10 max-sm:py-0 max-sm:px-6"
          >
            <div className="w-px flex-1 bg-[var(--border)] max-sm:w-auto max-sm:h-px" />
            <span className="font-[var(--mono)] text-[10px] text-[var(--text-muted)] tracking-[0.15em] py-2.5 max-sm:py-0 max-sm:px-2.5">
              OR
            </span>
            <div className="w-px flex-1 bg-[var(--border)] max-sm:w-auto max-sm:h-px" />
          </div>

          {/* Panel: PC */}
          <div
            className="p-12 [animation:fade-up_0.7s_0.2s_ease_both] opacity-0 border-l border-[var(--border)] max-sm:border-l-0 max-sm:border-t max-sm:p-9"
          >
            <span className="block font-[var(--mono)] text-[10px] text-[var(--text-muted)] tracking-[0.2em] mb-4">
              02 / KAMU DI PC
            </span>
            <div className="text-4xl mb-5" aria-hidden>🖥️</div>
            <h2 className="font-[var(--display)] text-[clamp(28px,3vw,40px)] font-black uppercase text-[var(--text)] mb-3 leading-none">
              Terima stream<br />
              <span className="text-[var(--accent)]">di desktop</span>
            </h2>
            <p className="font-[var(--body)] text-[14px] text-[var(--text-muted)] leading-[1.65] mb-8">
              Download app desktop untuk Windows, macOS, atau Linux. Buka app, scan QR dari HP, dan feed kamera langsung muncul.
            </p>
            <a
              href="https://github.com/upkanid/ipcam/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 bg-transparent text-[var(--text)] font-[var(--mono)] text-[13px] font-bold tracking-[0.12em] uppercase no-underline px-7 py-3.5 border border-[var(--border-bright)] transition-all duration-200 hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              ↓ Download App
            </a>
          </div>
        </div>
      </section>

      {/* ── Steps ── */}
      <section className="relative z-[5] max-w-[1200px] mx-auto px-10 py-16 border-t border-[var(--border)] mt-16 max-sm:px-5 max-sm:py-10 max-sm:mt-10">
        <p className="font-[var(--mono)] text-[10px] text-[var(--text-muted)] tracking-[0.2em] uppercase mb-10">
          // Cara Pakai
        </p>
        <div
          className="grid gap-px bg-[var(--border)]"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
        >
          {[
            { n: "01", label: "PC", text: "Download & buka app desktop di PC" },
            { n: "02", label: "PC", text: "App menampilkan QR code room" },
            { n: "03", label: "HP", text: "Scan QR dari HP — halaman /share terbuka otomatis" },
            { n: "04", label: "HP", text: "Tap Start Sharing — stream langsung aktif di PC" },
          ].map(({ n, label, text }) => (
            <div
              key={n}
              className="bg-[var(--bg)] px-7 py-8 transition-colors duration-200 hover:bg-[var(--surface)]"
            >
              <span className="block font-[var(--mono)] text-[11px] text-[var(--accent)] tracking-[0.15em] mb-3.5">
                {n} /{" "}
                <span className={label === "HP" ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}>
                  {label}
                </span>
              </span>
              <p className="font-[var(--body)] text-[15px] text-[var(--text)] leading-[1.55] m-0">
                {text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--border)] px-10 py-6 flex justify-between items-center max-sm:px-5 max-sm:py-5 max-sm:flex-col max-sm:gap-2 max-sm:text-center">
        <span className="font-[var(--mono)] text-[11px] text-[var(--text-muted)] tracking-[0.1em]">
          IPCAM_UPKAN
        </span>
        <span className="font-[var(--mono)] text-[11px] text-[var(--text-muted)]">
          WebRTC / P2P
        </span>
      </footer>
    </div>
  );
}
