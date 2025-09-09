import { NextApiResponse } from 'next'
import { Server as ServerIO } from 'socket.io'
import { Server as NetServer } from 'http'
import { Socket as NetSocket } from 'net'

interface SocketServer extends NetServer {
  io?: ServerIO | undefined
}

interface SocketWithIO extends NetSocket {
  server: SocketServer
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO
}

import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, res: NextApiResponseWithSocket) {
  if (res.socket.server.io) {
    console.log('Socket is already running')
  } else {
    console.log('Socket is initializing')
    const io = new ServerIO(res.socket.server, {
      path: '/api/socket/io',
      addTrailingSlash: false,
    })
    res.socket.server.io = io
  }
  res.end()
}

export const dynamic = 'force-dynamic';
