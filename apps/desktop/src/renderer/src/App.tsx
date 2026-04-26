import { useEffect, useRef, useState } from 'react'

const SIGNALING_PORT = 3717

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [localIP, setLocalIP] = useState<string>('...')
  const [status, setStatus] = useState<'idle' | 'waiting' | 'connected'>('idle')

  useEffect(() => {
    // Get local IP from main process
    window.api?.getLocalIP().then((ip: string) => setLocalIP(ip))
  }, [])

  function startReceiving() {
    const ws = new WebSocket(`ws://localhost:${SIGNALING_PORT}`)
    wsRef.current = ws
    setStatus('waiting')

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })
    pcRef.current = pc

    pc.ontrack = (event) => {
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0]
        setStatus('connected')
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(JSON.stringify({ type: 'candidate', payload: event.candidate }))
      }
    }

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.payload))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        ws.send(JSON.stringify({ type: 'answer', payload: answer }))
      } else if (msg.type === 'candidate') {
        await pc.addIceCandidate(new RTCIceCandidate(msg.payload))
      }
    }
  }

  function stop() {
    pcRef.current?.close()
    wsRef.current?.close()
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('idle')
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>IPCam Upkan</h1>

      <div style={{ marginBottom: 16 }}>
        <p>
          Buka <strong>web app</strong> di HP dan masukkan IP ini:
        </p>
        <code style={{ fontSize: 20, background: '#f0f0f0', padding: '4px 12px', borderRadius: 4 }}>
          {localIP}:{SIGNALING_PORT}
        </code>
      </div>

      <div style={{ marginBottom: 16 }}>
        {status === 'idle' && <button onClick={startReceiving}>Start Receiving</button>}
        {(status === 'waiting' || status === 'connected') && (
          <button onClick={stop}>Stop</button>
        )}
        <span style={{ marginLeft: 12, color: status === 'connected' ? 'green' : 'gray' }}>
          {status === 'idle' ? '' : status === 'waiting' ? 'Menunggu koneksi...' : 'Terhubung'}
        </span>
      </div>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: '100%', maxWidth: 640, background: '#000', borderRadius: 8 }}
      />
    </div>
  )
}
