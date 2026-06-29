import type { Route } from "./+types/landing";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "IPCam Upkan — Phone to Webcam, Wirelessly" },
    { name: "description", content: "Stream your phone camera to any PC via WebRTC. View in desktop app, browser, or OBS. No cloud, no drivers, no cables." },
    { property: "og:title", content: "IPCam Upkan — Phone to Webcam, Wirelessly" },
    { property: "og:description", content: "Stream your phone camera to any PC via WebRTC. View in desktop app, browser, or OBS." },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://ipcam.upkan.id" },
    { property: "og:image", content: "https://ipcam.upkan.id/logo-icon.png" },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: "IPCam Upkan — Phone to Webcam, Wirelessly" },
    { name: "twitter:description", content: "Stream your phone camera to any PC via WebRTC. View in desktop app, browser, or OBS." },
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
        <div className="flex items-center gap-6">
          <a
            href="/view"
            className="font-[var(--mono)] text-[12px] text-[var(--text-muted)] no-underline tracking-[0.1em] transition-colors duration-200 hover:text-[var(--accent)]"
          >
            VIEW STREAM →
          </a>
          <a
            href="/share"
            className="font-[var(--mono)] text-[12px] text-[var(--text-muted)] no-underline tracking-[0.1em] transition-colors duration-200 hover:text-[var(--accent)]"
          >
            SHARE CAMERA →
          </a>
        </div>
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

        {/* ── Three panels: View / Share / Desktop ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 border border-[var(--border)]">
          {/* Panel: Web Viewer */}
          <div
            className="p-10 [animation:fade-up_0.7s_0.1s_ease_both] opacity-0 max-sm:p-8"
          >
            <span className="block font-[var(--mono)] text-[10px] text-[var(--text-muted)] tracking-[0.2em] mb-4">
              01 / SIAPKAN RECEIVER
            </span>
            <div className="text-4xl mb-5" aria-hidden>🌐</div>
            <h2 className="font-[var(--display)] text-[clamp(24px,3vw,36px)] font-black uppercase text-[var(--text)] mb-3 leading-none">
              Start<br />
              <span className="text-[var(--accent)]">viewer dulu</span>
            </h2>
            <p className="font-[var(--body)] text-[14px] text-[var(--text-muted)] leading-[1.65] mb-8">
              Buka viewer di PC, desktop app, atau OBS Browser Source sampai statusnya waiting.
            </p>
            <a
              href="/view"
              className="inline-flex items-center gap-2.5 bg-[var(--accent)] text-black font-[var(--mono)] text-[13px] font-bold tracking-[0.12em] uppercase no-underline px-7 py-3.5 transition-all duration-200 hover:bg-[#00ff88] hover:shadow-[0_0_30px_var(--accent-glow)]"
            >
              → Open Viewer
            </a>
          </div>

          {/* Panel: HP (Share) */}
          <div
            className="p-10 [animation:fade-up_0.7s_0.15s_ease_both] opacity-0 border-l border-[var(--border)] max-sm:border-l-0 max-sm:border-t max-sm:p-8"
          >
            <span className="block font-[var(--mono)] text-[10px] text-[var(--text-muted)] tracking-[0.2em] mb-4">
              02 / KIRIM DARI HP
            </span>
            <div className="text-4xl mb-5" aria-hidden>📱</div>
            <h2 className="font-[var(--display)] text-[clamp(24px,3vw,36px)] font-black uppercase text-[var(--text)] mb-3 leading-none">
              Share<br />
              <span className="text-[var(--accent)]">kamera HP</span>
            </h2>
            <p className="font-[var(--body)] text-[14px] text-[var(--text-muted)] leading-[1.65] mb-8">
              Setelah receiver waiting, scan QR atau buka link share dari HP lalu tap Start Sharing.
            </p>
            <a
              href="/share"
              className="inline-flex items-center gap-2.5 bg-transparent text-[var(--text)] font-[var(--mono)] text-[13px] font-bold tracking-[0.12em] uppercase no-underline px-7 py-3.5 border border-[var(--border-bright)] transition-all duration-200 hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              → Start Sharing
            </a>
          </div>

          {/* Panel: Desktop App */}
          <div
            className="p-10 [animation:fade-up_0.7s_0.2s_ease_both] opacity-0 border-l border-[var(--border)] max-sm:border-l-0 max-sm:border-t max-sm:p-8"
          >
            <span className="block font-[var(--mono)] text-[10px] text-[var(--text-muted)] tracking-[0.2em] mb-4">
              03 / DESKTOP APP
            </span>
            <div className="text-4xl mb-5" aria-hidden>🖥️</div>
            <h2 className="font-[var(--display)] text-[clamp(24px,3vw,36px)] font-black uppercase text-[var(--text)] mb-3 leading-none">
              Virtual<br />
              <span className="text-[var(--accent)]">camera</span>
            </h2>
            <p className="font-[var(--body)] text-[14px] text-[var(--text-muted)] leading-[1.65] mb-8">
              Butuh virtual webcam untuk Zoom/Meet? Download app desktop dengan fitur virtual cam & mic built-in.
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

      {/* ── How to use ── */}
      <section className="relative z-[5] max-w-[1200px] mx-auto px-10 py-16 border-t border-[var(--border)] mt-16 max-sm:px-5 max-sm:py-10 max-sm:mt-10">
        <p className="font-[var(--mono)] text-[10px] text-[var(--text-muted)] tracking-[0.2em] uppercase mb-10">
          // Cara Pakai — Web Viewer
        </p>
        <div
          className="grid gap-px bg-[var(--border)]"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
        >
          {[
            { n: "01", label: "PC", text: "Buka /view di browser PC, desktop app, atau OBS source" },
            { n: "02", label: "PC", text: "Masukkan Room ID atau pakai link viewer sampai status waiting" },
            { n: "03", label: "HP", text: "Scan QR atau buka /share dengan Room ID yang sama" },
            { n: "04", label: "HP", text: "Tap Start Sharing — stream langsung muncul di receiver" },
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

      {/* ── OBS Browser Source Section ── */}
      <section className="relative z-[5] max-w-[1200px] mx-auto px-10 pb-16 max-sm:px-5 max-sm:pb-10">
        <div className="border border-[var(--border)] p-10 max-sm:p-6">
          <div className="flex items-start gap-5 max-sm:flex-col">
            <div className="text-3xl flex-shrink-0" aria-hidden>🎬</div>
            <div className="flex-1">
              <p className="font-[var(--mono)] text-[10px] text-[var(--text-muted)] tracking-[0.2em] uppercase mb-3">
                // OBS Browser Source
              </p>
              <h3 className="font-[var(--display)] text-[clamp(20px,2.5vw,28px)] font-black uppercase text-[var(--text)] mb-3 leading-none">
                Pakai sebagai <span className="text-[var(--accent)]">OBS source</span>
              </h3>
              <p className="font-[var(--body)] text-[14px] text-[var(--text-muted)] leading-[1.7] mb-6">
                Tambahkan Browser Source di OBS dengan URL di bawah. Stream HP kamu langsung muncul sebagai source — tanpa virtual camera driver, tanpa app tambahan.
              </p>
              <div className="font-[var(--mono)] text-[13px] text-[var(--accent)] bg-[var(--surface)] border border-[var(--border-bright)] px-5 py-3.5 mb-5 break-all select-all tracking-[0.05em]">
                https://ipcam.upkan.id/view?room=ROOM_ID&obs=1
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Width", value: "1920" },
                  { label: "Height", value: "1080" },
                  { label: "FPS", value: "30" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="font-[var(--mono)] text-[10px] text-[var(--text-muted)] tracking-[0.12em]">
                      {label}:
                    </span>
                    <span className="font-[var(--mono)] text-[12px] text-[var(--text)] tracking-[0.08em]">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Comparison table ── */}
      <section className="relative z-[5] max-w-[1200px] mx-auto px-10 pb-16 max-sm:px-5 max-sm:pb-10">
        <p className="font-[var(--mono)] text-[10px] text-[var(--text-muted)] tracking-[0.2em] uppercase mb-6">
          // Perbandingan
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-[var(--mono)] text-[12px]">
            <thead>
              <tr className="border-b border-[var(--border-bright)]">
                <th className="text-left py-3 px-4 text-[var(--text-muted)] tracking-[0.12em] text-[10px] font-normal">FITUR</th>
                <th className="text-center py-3 px-4 text-[var(--accent)] tracking-[0.12em] text-[10px] font-normal">WEB VIEWER</th>
                <th className="text-center py-3 px-4 text-[var(--text-muted)] tracking-[0.12em] text-[10px] font-normal">OBS SOURCE</th>
                <th className="text-center py-3 px-4 text-[var(--text-muted)] tracking-[0.12em] text-[10px] font-normal">DESKTOP APP</th>
              </tr>
            </thead>
            <tbody>
              {[
                { feature: "View stream", web: true, obs: true, desktop: true },
                { feature: "Audio", web: true, obs: true, desktop: true },
                { feature: "Tanpa install", web: true, obs: true, desktop: false },
                { feature: "OBS source langsung", web: false, obs: true, desktop: false },
                { feature: "Virtual camera", web: false, obs: false, desktop: true },
                { feature: "Virtual mic", web: false, obs: false, desktop: true },
                { feature: "Fullscreen", web: true, obs: false, desktop: true },
              ].map(({ feature, web, obs, desktop }) => (
                <tr key={feature} className="border-b border-[var(--border)] hover:bg-[var(--surface)] transition-colors duration-150">
                  <td className="py-3 px-4 text-[var(--text)]">{feature}</td>
                  <td className="py-3 px-4 text-center">{web ? <span className="text-[var(--accent)]">✓</span> : <span className="text-[var(--text-muted)]">—</span>}</td>
                  <td className="py-3 px-4 text-center">{obs ? <span className="text-[var(--accent)]">✓</span> : <span className="text-[var(--text-muted)]">—</span>}</td>
                  <td className="py-3 px-4 text-center">{desktop ? <span className="text-[var(--accent)]">✓</span> : <span className="text-[var(--text-muted)]">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
