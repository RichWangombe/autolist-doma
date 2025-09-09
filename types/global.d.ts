import type { Server as IOServer, Socket } from 'socket.io'

declare global {
  var io: IOServer | undefined
}

export {}
