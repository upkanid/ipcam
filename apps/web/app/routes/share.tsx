import { useEffect, useRef, useState } from "react";
import type { Route } from "./+types/share";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Share Camera — IPCam Upkan" }];
}

export default function Share() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [ip, setIp] = useState("");
  const [status, setStatus] = useState<"idle" | "connecting" | "streaming">("idle");
  const [error, setError] = useState("");

  async function startSharing() {
    if (!ip) return;
    setError("");
    setStatus("connecting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      setError("Tidak bisa mengakses kamera. Pastikan izin kamera sudah diberikan.");
      setStatus("idle");
      return;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }

    const ws = new WebSocket(`ws://${ip}`);
    wsRef.current = ws;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(JSON.stringify({ type: "candidate", payload: event.candidate }));
      }
    };

    ws.onopen = async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: "offer", payload: offer }));
      setStatus("streaming");
    };

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
      } else if (msg.type === "candidate") {
        await pc.addIceCandidate(new RTCIceCandidate(msg.payload));
      }
    };

    ws.onerror = () => {
      setError("Tidak bisa terhubung ke IP tersebut. Pastikan Electron app sudah berjalan.");
      setStatus("idle");
      stream.getTracks().forEach((t) => t.stop());
    };
  }

  function stopSharing() {
    pcRef.current?.close();
    wsRef.current?.close();
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setStatus("idle");
  }

  return (
    <main style={{ maxWidth: 480, margin: "40px auto", padding: "0 24px", fontFamily: "sans-serif" }}>
      <h1 style={{ marginBottom: 8 }}>Share Kamera</h1>
      <p style={{ color: "#555", marginBottom: 24 }}>
        Masukkan IP yang ditampilkan di Electron app, lalu tekan Start.
      </p>

      <input
        type="text"
        placeholder="192.168.1.x:3717"
        value={ip}
        onChange={(e) => setIp(e.target.value)}
        disabled={status !== "idle"}
        style={{
          width: "100%",
          padding: "10px 12px",
          fontSize: 16,
          border: "1px solid #ccc",
          borderRadius: 6,
          marginBottom: 12,
        }}
      />

      {status === "idle" ? (
        <button
          onClick={startSharing}
          disabled={!ip}
          style={{ width: "100%", padding: 12, background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontSize: 16, cursor: "pointer" }}
        >
          Start Sharing
        </button>
      ) : (
        <button
          onClick={stopSharing}
          style={{ width: "100%", padding: 12, background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, fontSize: 16, cursor: "pointer" }}
        >
          Stop
        </button>
      )}

      {error && <p style={{ color: "#dc2626", marginTop: 12 }}>{error}</p>}

      <div style={{ marginTop: 16, color: "#555", fontSize: 14 }}>
        {status === "connecting" && "Menghubungkan..."}
        {status === "streaming" && "Streaming aktif ✓"}
      </div>

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: "100%", marginTop: 24, borderRadius: 8, background: "#000", display: status !== "idle" ? "block" : "none" }}
      />
    </main>
  );
}
