"use client"

import { useEffect, useState } from 'react'

export default function Countdown({ endsAt }: { endsAt: string | null | undefined }) {
  const [remaining, setRemaining] = useState<string>('')

  useEffect(() => {
    if (!endsAt) return
    function update() {
      const end = new Date(endsAt as string).getTime()
      const now = Date.now()
      const diff = end - now
      if (diff <= 0) {
        setRemaining('Ended')
        return
      }
      const sec = Math.floor(diff / 1000) % 60
      const min = Math.floor(diff / 1000 / 60) % 60
      const hrs = Math.floor(diff / 1000 / 60 / 60) % 24
      const days = Math.floor(diff / 1000 / 60 / 60 / 24)
      const parts: string[] = []
      if (days) parts.push(`${days}d`)
      parts.push(`${hrs.toString().padStart(2, '0')}h`)
      parts.push(`${min.toString().padStart(2, '0')}m`)
      parts.push(`${sec.toString().padStart(2, '0')}s`)
      setRemaining(parts.join(' '))
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [endsAt])

  if (!endsAt) return null
  return <span>{remaining}</span>
}
