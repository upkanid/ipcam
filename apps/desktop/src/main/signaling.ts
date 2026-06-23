import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { networkInterfaces } from 'os'

type SignalingMessage = {
  type: 'offer' | 'answer' | 'candidate'
  payload?: unknown
}

export function createSignalingServer(port: number): () => void {
  const httpServer = createServer()
  const wss = new WebSocketServer({ server: httpServer })
  const peers = new Set<WebSocket>()

  wss.on('connection', (ws) => {
    peers.add(ws)

    ws.on('message', (data) => {
      let msg: SignalingMessage
      try { msg = JSON.parse(data.toString()) } catch { return }

      peers.forEach((peer) => {
        if (peer !== ws && peer.readyState === WebSocket.OPEN) {
          peer.send(JSON.stringify(msg))
        }
      })
    })

    ws.on('close', () => peers.delete(ws))
  })

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Signaling server ws://${getLocalIP()}:${port}`)
  })

  return () => {
    wss.close()
    httpServer.close()
    peers.clear()
  }
}

export function getLocalIP(): string {
  const nets = networkInterfaces()
  const candidates: { name: string; address: string }[] = []

  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        candidates.push({ name, address: net.address })
      }
    }
  }

  if (candidates.length === 0) {
    return '127.0.0.1'
  }

  // Prioritize interfaces:
  // 3 = Wi-Fi / WLAN
  // 2 = Physical Ethernet / LAN
  // 1 = Unknown / other physical
  // 0 = Virtual / VPN / WSL
  const getPriority = (name: string): number => {
    const lower = name.toLowerCase()

    // Virtual / VPN / WSL adapters should have the lowest priority
    if (
      lower.includes('virtual') ||
      lower.includes('vpn') ||
      lower.includes('wsl') ||
      lower.includes('vethernet') ||
      lower.includes('vmware') ||
      lower.includes('virtualbox') ||
      lower.includes('vbox') ||
      lower.includes('tap') ||
      lower.includes('tailscale') ||
      lower.includes('zerotier') ||
      lower.includes('pseudo')
    ) {
      return 0
    }

    // Wi-Fi / WLAN adapters have the highest priority
    if (
      lower.includes('wi-fi') ||
      lower.includes('wifi') ||
      lower.includes('wlan') ||
      lower.includes('wireless') ||
      lower.startsWith('wl')
    ) {
      return 3
    }

    // Physical Ethernet / LAN adapters
    if (
      lower.includes('ethernet') ||
      lower.includes('lan') ||
      lower.startsWith('eth') ||
      lower.startsWith('en')
    ) {
      return 2
    }

    // Other/unknown physical interfaces
    return 1
  }

  // Sort descending by priority score
  candidates.sort((a, b) => getPriority(b.name) - getPriority(a.name))

  return candidates[0].address
}
