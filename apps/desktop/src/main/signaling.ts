import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { networkInterfaces } from 'os'

const PORT = 3717

type SignalingMessage = {
  type: 'offer' | 'answer' | 'candidate' | 'ready'
  payload?: unknown
}

export function createSignalingServer(): void {
  const httpServer = createServer()
  const wss = new WebSocketServer({ server: httpServer })

  const peers = new Set<WebSocket>()

  wss.on('connection', (ws) => {
    peers.add(ws)

    ws.on('message', (data) => {
      let msg: SignalingMessage
      try {
        msg = JSON.parse(data.toString())
      } catch {
        return
      }

      // Relay message to all other peers
      peers.forEach((peer) => {
        if (peer !== ws && peer.readyState === WebSocket.OPEN) {
          peer.send(JSON.stringify(msg))
        }
      })
    })

    ws.on('close', () => {
      peers.delete(ws)
    })
  })

  httpServer.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIP()
    console.log(`Signaling server running at ws://${ip}:${PORT}`)
  })
}

function getLocalIP(): string {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return '127.0.0.1'
}
