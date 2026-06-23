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
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        return net.address
      }
    }
  }
  return '127.0.0.1'
}
