"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Auction {
  id: string
  tokenId: string | null
  domainId: string | null
  reservePriceWei: string | number | bigint
  status: string
  startsAt: string | null
  endsAt: string | null
  txHash?: string | null
  bids: any[]
  events: EventLog[]
}

interface EventLog {
  id: string
  type: string
  txHash?: string | null
  payload?: Record<string, any> | null
  createdAt: string
}

type ApiResp<T> = { ok: boolean; error?: string } & T

function weiToEth(wei: bigint | string | number) {
  try {
    const b = typeof wei === 'bigint' ? wei : BigInt(wei as any)
    return (Number(b) / 1e18).toFixed(4)
  } catch {
    return String(wei)
  }
}

export default function AuctionDetail({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const [data, setData] = useState<Auction | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch(`/api/auctions/${id}`, { cache: 'no-store' })
      const json: ApiResp<{ auction: Auction }> = await res.json()
      if (!json.ok) throw new Error(json.error || 'err')
      setData(json.auction)
    } catch (e: any) {
      setErr(e?.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // refresh every 30s
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [])

  if (loading && !data) return <div className="p-6">Loading…</div>
  if (err) return <div className="p-6 text-red-600">{err}</div>
  if (!data) return null

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <button className="text-sm text-indigo-600 hover:underline" onClick={() => router.back()}>&larr; Back</button>
      <h1 className="text-xl font-semibold">Auction {data.id}</h1>
      <div className="border rounded p-4 space-y-1 text-sm">
        <div>status: <span className="font-mono">{data.status}</span></div>
        {data.tokenId && <div>tokenId: {data.tokenId}</div>}
        {data.domainId && <div>domainId: {data.domainId}</div>}
        <div>reservePrice: {weiToEth(data.reservePriceWei)} ETH</div>
        {data.txHash && <div>txHash: <a href={process.env.NEXT_PUBLIC_DOMA_EXPLORER_URL ? `${process.env.NEXT_PUBLIC_DOMA_EXPLORER_URL}/tx/${data.txHash}` : '#'} className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer">{data.txHash}</a></div>}
        {data.startsAt && <div>startsAt: {new Date(data.startsAt).toLocaleString()}</div>}
        {data.endsAt && <div>endsAt: {new Date(data.endsAt).toLocaleString()}</div>}
      </div>

      <div>
        <h2 className="font-medium mb-2">Events</h2>
        {data.events.length === 0 && <div className="text-sm text-gray-500">No events yet</div>}
        <ul className="space-y-2">
          {data.events.map(ev => (
            <li key={ev.id} className="border rounded p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="font-mono text-xs text-gray-600">{new Date(ev.createdAt).toLocaleString()}</div>
                <div className="text-xs uppercase tracking-wide">{ev.type}</div>
              </div>
              {ev.txHash && <div className="text-xs">txHash: {ev.txHash}</div>}
              {ev.payload && <pre className="bg-gray-50 rounded p-2 text-xs overflow-x-auto">{JSON.stringify(ev.payload, null, 2)}</pre>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
