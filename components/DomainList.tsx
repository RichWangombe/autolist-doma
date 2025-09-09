"use client"
import { useEffect, useState } from 'react'
import { fetchSubgraphDomains } from '@/lib/subgraph'

type DomainItem = {
  id: string
  name?: string
  tokenId?: string
  owner?: string
}

export default function DomainList() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<DomainItem[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [reserveEth, setReserveEth] = useState<string>('0.05')
  const subgraphUrl = process.env.NEXT_PUBLIC_DOMA_SUBGRAPH_URL
  const apiKey = process.env.NEXT_PUBLIC_DOMA_SUBGRAPH_API_KEY
  const isMock = !subgraphUrl || !apiKey

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSubgraphDomains()
      setItems(data)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to fetch domains')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function createAuction(tokenId?: string) {
    setMsg(null)
    try {
      const res = await fetch('/api/auctions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tokenId, reservePriceEth: reserveEth })
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      setMsg('Auction draft created')
      // Optionally redirect to /auctions so the user can activate/list it
      if (typeof window !== 'undefined') {
        window.location.href = '/auctions'
      }
    } catch (e: any) {
      setMsg(e?.message ?? 'Failed to create auction')
    }
  }

  return (
    <div className="rounded border bg-white">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="font-medium">Doma Domains {isMock && (<span className="ml-2 align-middle text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800">Mock data</span>)}</div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600" htmlFor="reserveEth">Reserve (ETH)</label>
          <input
            id="reserveEth"
            type="number"
            step="0.0001"
            min="0"
            value={reserveEth}
            onChange={(e) => setReserveEth(e.target.value)}
            className="text-sm px-2 py-1 rounded border w-28"
          />
          <button onClick={refresh} className="text-sm px-3 py-1.5 rounded border">Refresh</button>
        </div>
      </div>
      {loading && <div className="p-4 text-sm text-gray-500">Loading…</div>}
      {error && <div className="p-4 text-sm text-red-600">{error}</div>}
      {msg && <div className="p-4 text-sm text-indigo-700">{msg}</div>}
      {!loading && !error && (
        <ul className="divide-y">
          {items.map((d) => (
            <li key={d.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-mono text-sm">{d.id}</div>
                <div className="text-gray-500 text-xs">
                  {d.name ?? ''} {d.tokenId ? `(tokenId ${d.tokenId})` : ''} {d.owner ? `• owner ${d.owner}` : ''}
                </div>
              </div>
              <button onClick={() => createAuction(d.tokenId)} className="text-sm px-3 py-1.5 rounded bg-indigo-600 text-white">Create Auction</button>
            </li>
          ))}
          {items.length === 0 && <li className="p-4 text-sm text-gray-500">No domains found.</li>}
        </ul>
      )}
    </div>
  )
}
