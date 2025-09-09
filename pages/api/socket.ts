import type { NextApiRequest, NextApiResponse } from 'next'
import { Server } from 'socket.io'
import type { Server as HTTPServer } from 'http'
import type { Socket } from 'net'

interface SocketServer extends HTTPServer {
  io?: Server
}

interface SocketWithServer extends Socket {
  server: SocketServer
}

const ioPath = '/api/socket'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const { socket } = res as any as { socket: SocketWithServer }
  if (!socket.server.io) {
    const io = new Server(socket.server, {
      path: ioPath,
      addTrailingSlash: false,
    })
    socket.server.io = io
    globalThis.io = io as any
    io.on('connection', (s) => {
      // eslint-disable-next-line no-console
      console.log('[socket.io] client connected', s.id)
    })
  }
  res.end()
}
