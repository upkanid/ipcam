import type { Route } from "./+types/landing";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "IPCam Upkan — Share Your Camera Wirelessly" },
    { name: "description", content: "Stream your phone camera to any PC on your local network." },
  ];
}

export default function Landing() {
  return (
    <main style={{ maxWidth: 640, margin: "80px auto", padding: "0 24px", fontFamily: "sans-serif", textAlign: "center" }}>
      <h1 style={{ fontSize: 40, marginBottom: 16 }}>IPCam Upkan</h1>
      <p style={{ fontSize: 18, color: "#555", marginBottom: 32 }}>
        Ubah kamera HP kamu menjadi webcam wireless untuk PC di jaringan yang sama.
      </p>
      <a
        href="/share"
        style={{
          display: "inline-block",
          background: "#2563eb",
          color: "#fff",
          padding: "12px 32px",
          borderRadius: 8,
          textDecoration: "none",
          fontSize: 16,
          fontWeight: 600,
        }}
      >
        Mulai Share Kamera
      </a>

      <section style={{ marginTop: 64, textAlign: "left" }}>
        <h2 style={{ marginBottom: 16 }}>Cara pakai</h2>
        <ol style={{ paddingLeft: 24, lineHeight: 2 }}>
          <li>Buka <strong>IPCam Upkan</strong> di PC/laptop kamu</li>
          <li>Catat IP address yang ditampilkan di app desktop</li>
          <li>Buka halaman <strong>/share</strong> di HP ini dan masukkan IP tersebut</li>
          <li>Izinkan akses kamera — stream langsung tersambung</li>
          <li>Gunakan sebagai virtual camera di OBS, Zoom, atau app lainnya</li>
        </ol>
      </section>
    </main>
  );
}
