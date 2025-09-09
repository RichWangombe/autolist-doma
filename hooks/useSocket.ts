import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

const IO_PATH = '/api/socket'

export function useSocket(onMessage?: (event: any) => void) {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const socket = io({ path: IO_PATH })
    socketRef.current = socket
    if (onMessage) socket.on('auction_update', onMessage)

    return () => {
      if (onMessage) socket.off('auction_update', onMessage)
      socket.disconnect()
    }
  }, [onMessage])

  return socketRef.current
}
