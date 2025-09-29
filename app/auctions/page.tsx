"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { calcDutchPrice, DecayMode } from '@/lib/auctionMath'
import Countdown from '@/components/Countdown'
import { useSocket } from '@/hooks/useSocket'

type Auction = {
  id: string
  tokenId: string | null
  domainId: string | null
  reservePriceWei: string | number | bigint
  status: string
  startsAt: string | null
  endsAt: string | null
  txHash?: string | null
  bids?: Bid[]
  events?: EventLog[]
  decayMode?: DecayMode | null
}

type EventLog = {
  id: string
  type: string
  txHash?: string | null
  payload?: any
  createdAt?: string
}

type Bid = {
  id: string
  bidder: string
  amountWei: string | number | bigint
  createdAt?: string
}

type ApiResp<T> = { ok: boolean; error?: string; [k: string]: any } & T

function weiToEth(wei: bigint | string | number, decimals = 2) {
  try {
    const b = typeof wei === 'bigint' ? wei : BigInt(wei as any)
    const eth = Number(b) / 1e18
    return eth.toFixed(decimals)
  } catch {
    return String(wei)
  }
}

function calcCurrentPrice(reserveWei: bigint | string | number, startsAt?: string | null, endsAt?: string | null) {
  if (!startsAt || !endsAt) return { priceEth: weiToEth(reserveWei), pct: 0 }
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()
  const now = Date.now()
  if (now <= start) return { priceEth: weiToEth(reserveWei), pct: 0 }
  if (now >= end) return { priceEth: '0', pct: 100 }
  const total = end - start
  const elapsed = now - start
  const pct = elapsed / total
  const reserveEth = Number(weiToEth(reserveWei, 6))
  const priceEth = (reserveEth * (1 - pct)).toFixed(4)
  return { priceEth, pct: Math.round(pct * 100) }
}

export default function AuctionsPage() {
  const [tick, setTick] = useState(0)  // local re-render for timers
  const [curveMode, setCurveMode] = useState<DecayMode>('exponential')
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<{ id: number; type: 'success' | 'error'; text: string }[]>([])

  const [tokenId, setTokenId] = useState('')
  const [domainId, setDomainId] = useState('')
  const [reservePriceEth, setReservePriceEth] = useState('0.01')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [creatingTrio, setCreatingTrio] = useState(false)
  const [feed, setFeed] = useState<any[]>([])
  const [feedOpen, setFeedOpen] = useState(false)
  // Phase B: watchlist and alerts
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [alerts, setAlerts] = useState<Record<string, { price?: number; firedPrice?: boolean }>>({})
  const [userId, setUserId] = useState<string>('')

  const mockBadge = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_DOMA_SUBGRAPH_URL
    const key = process.env.NEXT_PUBLIC_DOMA_SUBGRAPH_API_KEY
    return !url || !key
  }, [])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/auctions', { cache: 'no-store' })
      const j: ApiResp<{ auctions: Auction[] }> = await r.json()
      if (!j.ok) throw new Error(j.error || 'Failed to load')
      setAuctions(j.auctions)
    } catch (e: any) {
      setError(e?.message || 'Failed to load auctions')
    } finally {
      setLoading(false)
    }
  }

  // initial load
  useEffect(() => { refresh() }, [])

  // Load persisted watchlist/alerts
  useEffect(() => {
    // userId
    try {
      const uid = localStorage.getItem('arcade_user_id')
      if (uid) setUserId(uid)
      else {
        const gen = `u_${Math.random().toString(36).slice(2, 8)}${Date.now().toString().slice(-4)}`
        localStorage.setItem('arcade_user_id', gen)
        setUserId(gen)
      }
    } catch {}
    try {
      const wl = JSON.parse(localStorage.getItem('watchlist') || '[]')
      if (Array.isArray(wl)) setWatchlist(wl)
    } catch {}
    try {
      const al = JSON.parse(localStorage.getItem('alerts') || '{}')
      if (al && typeof al === 'object') setAlerts(al)
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('watchlist', JSON.stringify(watchlist)) } catch {}
  }, [watchlist])
  useEffect(() => {
    try { localStorage.setItem('alerts', JSON.stringify(alerts)) } catch {}
  }, [alerts])

  // socket subscription for live DB changes + live event feed + celebration on settle
  useSocket((evt: any) => {
    try {
      setFeed(prev => [{ at: Date.now(), ...evt }, ...prev].slice(0, 50))
      if (evt?.action === 'settled') {
        try { burstConfetti() } catch {}
      }
      const id = evt?.auctionId || evt?.id
      if (id && watchlist.includes(String(id))) {
        maybeNotify('Auction update', `${evt?.action || evt?.type || 'update'} on ${String(id)}`)
      }
    } catch {}
    refresh()
  })

  // local timer re-render every second for countdown / price display
  useEffect(() => { const t = setInterval(() => setTick((v)=>v+1), 1000); return () => clearInterval(t) }, [])

  async function createAuction(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const body: any = {
        reservePriceEth,
        decayMode: curveMode,
      }
      if (tokenId) body.tokenId = tokenId
      if (domainId) body.domainId = domainId
      if (startsAt) body.startsAt = startsAt
      if (endsAt) body.endsAt = endsAt

      const r = await fetch('/api/auctions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Failed to create')
      addToast('success', 'Draft created')
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Failed to create auction')
      addToast('error', e?.message || 'Failed to create auction')
    }
  }

  async function listOnChain(a: Auction) {
    setError(null)
    try {
      // Debug: trace button click & request lifecycle
      // eslint-disable-next-line no-console
      console.log('[listOnChain] start', a)
      const r = await fetch('/api/listing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          auctionId: a.id,
          tokenId: a.tokenId || undefined,
          domainId: a.domainId || undefined,
          reservePriceEth,
        }),
      })
      // eslint-disable-next-line no-console
      console.log('[listOnChain] response status', r.status)
      const j = await r.json()
      // eslint-disable-next-line no-console
      console.log('[listOnChain] response body', j)
      if (!j.ok) throw new Error(j.error || 'Listing failed')
      addToast('success', 'Auction activated')
      await refresh()
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[listOnChain] error', e)
      setError(e?.message || 'Listing failed')
      addToast('error', e?.message || 'Listing failed')
    }
  }

  // Create three auctions with identical timing/reserve but different curves, then auto-activate
  async function createTrio() {
    setError(null)
    setCreatingTrio(true)
    try {
      const startIso = startsAt || new Date(Date.now() + 2 * 60 * 1000).toISOString()
      const endIso = endsAt || new Date(Date.now() + 15 * 60 * 1000).toISOString()
      const modes: DecayMode[] = ['linear', 'exponential', 'sigmoid']

      const created: { id: string }[] = []
      for (const mode of modes) {
        const body: any = {
          reservePriceEth,
          decayMode: mode,
          startsAt: startIso,
          endsAt: endIso,
        }
        if (tokenId) body.tokenId = tokenId
        if (domainId) body.domainId = domainId
        const r = await fetch('/api/auctions', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
        })
        const j = await r.json()
        if (!j.ok) throw new Error(j.error || `Failed to create ${mode}`)
        created.push({ id: j.auction.id })
      }

      // Auto-activate each created auction
      for (const a of created) {
        const r2 = await fetch('/api/listing', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ auctionId: a.id, reservePriceEth })
        })
        const j2 = await r2.json()
        if (!j2.ok) throw new Error(j2.error || 'Activation failed')
      }

      addToast('success', 'Created trio: linear, exponential, sigmoid')
      await refresh()
    } catch (e: any) {
      addToast('error', e?.message || 'Failed to create trio')
      setError(e?.message || 'Failed to create trio')
    } finally {
      setCreatingTrio(false)
    }
  }

  // simple helpers for commit/reveal/settle per auction
  async function commitBid(a: Auction, bidder: string, amountEth: string) {
    setError(null)
    try {
      // eslint-disable-next-line no-console
      console.log('[commitBid] start', { id: a.id, bidder, amountEth })
      const r = await fetch(`/api/auctions/${a.id}/commit`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bidder, amountEth })
      })
      // eslint-disable-next-line no-console
      console.log('[commitBid] status', r.status)
      const j = await r.json()
      // eslint-disable-next-line no-console
      console.log('[commitBid] body', j)
      if (!j.ok) throw new Error(j.error || 'Commit failed')
      addToast('success', 'Bid committed')
      await refresh()
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[commitBid] error', e)
      setError(e?.message || 'Commit failed')
      addToast('error', e?.message || 'Commit failed')
    }
  }
  async function revealBid(a: Auction, bidder: string, proof: string) {
    setError(null)
    try {
      // eslint-disable-next-line no-console
      console.log('[revealBid] start', { id: a.id, bidder })
      const r = await fetch(`/api/auctions/${a.id}/reveal`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bidder, proof })
      })
      // eslint-disable-next-line no-console
      console.log('[revealBid] status', r.status)
      const j = await r.json()
      // eslint-disable-next-line no-console
      console.log('[revealBid] body', j)
      if (!j.ok) throw new Error(j.error || 'Reveal failed')
      addToast('success', 'Bid revealed')
      await refresh()
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[revealBid] error', e)
      setError(e?.message || 'Reveal failed')
      addToast('error', e?.message || 'Reveal failed')
    }
  }
  async function settleAuction(a: Auction, txHash?: string) {
    setError(null)
    try {
      // eslint-disable-next-line no-console
      console.log('[settleAuction] start', { id: a.id, txHash })
      const r = await fetch(`/api/auctions/${a.id}/settle`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ txHash })
      })
      // eslint-disable-next-line no-console
      console.log('[settleAuction] status', r.status)
      const j = await r.json()
      // eslint-disable-next-line no-console
      console.log('[settleAuction] body', j)
      if (!j.ok) throw new Error(j.error || 'Settle failed')
      addToast('success', 'Auction settled')
      await refresh()
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[settleAuction] error', e)
      setError(e?.message || 'Settle failed')
      addToast('error', e?.message || 'Settle failed')
    }
  }

  function addToast(type: 'success' | 'error', text: string) {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts(t => [...t, { id, type, text }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }

  function short(s?: string) {
    if (!s) return ''
    return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s
  }

  // Desktop notifications
  function requestNotifPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'default') {
      try { Notification.requestPermission().catch(()=>{}) } catch {}
    }
  }
  function maybeNotify(title: string, body: string) {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'granted') {
      try { new Notification(title, { body }) } catch {}
    }
  }

  // Price alert: on tick, check each auction against alert threshold and notify once
  useEffect(() => {
    try {
      auctions.forEach(a => {
        const rule = alerts[a.id]
        if (!rule?.price || rule.firedPrice) return
        const mode: DecayMode = (a.decayMode as DecayMode) || 'linear'
        const { priceEth } = calcDutchPrice(a.reservePriceWei, a.startsAt, a.endsAt, mode)
        const price = Number(priceEth)
        if (!isNaN(price) && price <= Number(rule.price)) {
          maybeNotify('Price alert', `Auction ${short(a.id)} reached ${priceEth} ETH`)
          addToast('success', `Price alert: ${short(a.id)} <= ${rule.price} ETH`)
          setAlerts(prev => ({ ...prev, [a.id]: { ...(prev[a.id]||{}), firedPrice: true } }))
        }
      })
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, auctions])

  // Simple confetti without deps: inject CSS and drop colorful squares briefly
  function ensureConfettiCSS() {
    if (typeof document === 'undefined') return
    if (document.getElementById('confetti-css')) return
    const style = document.createElement('style')
    style.id = 'confetti-css'
    style.innerHTML = `
      @keyframes confetti-fall { from { transform: translateY(0) rotate(0deg); opacity: 1 } to { transform: translateY(60vh) rotate(360deg); opacity: 0 } }
      .confetti-bit { position: fixed; width: 8px; height: 8px; will-change: transform, opacity; animation: confetti-fall 800ms linear forwards; border-radius: 1px; z-index: 50 }
    `
    document.head.appendChild(style)
  }
  function burstConfetti(x?: number, y?: number) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    ensureConfettiCSS()
    const cx = x ?? window.innerWidth - 120
    const cy = y ?? 100
    const n = 24
    for (let i = 0; i < n; i++) {
      const el = document.createElement('span')
      el.className = 'confetti-bit'
      const dx = (Math.random() * 180) - 90
      const dy = (Math.random() * 40) - 20
      el.style.left = `${cx + dx}px`
      el.style.top = `${cy + dy}px`
      el.style.background = `hsl(${Math.floor(Math.random()*360)}, 90%, 60%)`
      el.style.animationDelay = `${Math.random() * 0.2}s`
      document.body.appendChild(el)
      setTimeout(() => el.remove(), 1200)
    }
  }

  async function settleExpired() {
    try {
      const r = await fetch('/api/auctions/settle-expired', { method: 'POST' })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Failed to settle expired')
      addToast('success', `Settled ${j.count} expired auctions`)
      await refresh()
    } catch (e: any) {
      addToast('error', e?.message || 'Failed to settle expired')
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Toasts */}
      <div className="fixed right-4 top-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-3 py-2 rounded text-sm shadow ${t.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {t.text}
          </div>
        ))}
      </div>
      {/* Live Event Feed Toggle */}
      <div className="fixed right-4 bottom-4 z-50">
        <button
          type="button"
          className="px-3 py-2 rounded-full border bg-white shadow text-xs"
          onClick={() => setFeedOpen(v => !v)}
        >
          {feedOpen ? 'Close events' : `Events (${feed.length})`}
        </button>
      </div>
      {/* Live Event Feed Panel */}
      {feedOpen && (
        <div className="fixed right-4 top-24 z-40 w-72 md:w-80 max-h-[65vh] border bg-white rounded shadow">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide">Live Events</div>
            <button className="text-xs text-gray-500 hover:text-gray-700" type="button" onClick={() => setFeed([])}>clear</button>
          </div>
          <div className="p-2 overflow-auto" style={{ maxHeight: '55vh' }}>
            {feed.length === 0 && <div className="text-xs text-gray-400">No events yet</div>}
            <ul className="space-y-1">
              {feed.map((e, i) => {
                const id = e.auctionId || e.id
                const label = e.type || e.action || 'update'
                const ts = new Date(e.at || Date.now()).toLocaleTimeString()
                const meta = [e.bidder ? `bidder ${short(e.bidder)}` : '', e.amountEth ? `${e.amountEth} ETH` : '', e.status ? `status ${e.status}` : ''].filter(Boolean).join(' · ')
                return (
                  <li key={i} className="text-xs text-gray-700">
                    <div>
                      <span className="text-gray-500">{ts}</span>
                      <span className="mx-1">·</span>
                      <span className="font-medium">{label}</span>
                      {id && <span className="ml-1 text-gray-500">({short(String(id))})</span>}
                    </div>
                    {meta && <div className="text-[10px] text-gray-500">{meta}</div>}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Auctions</h1>
        <div className="flex items-center gap-2">
          <button className="btn btn-sm border px-3 py-1 rounded" onClick={refresh} disabled={loading}>Refresh</button>
          <button className="btn btn-sm border px-3 py-1 rounded" onClick={settleExpired} title="Settle all expired active auctions">Settle expired</button>
        </div>
      </div>
      {mockBadge && (
        <div className="text-xs text-amber-700 bg-amber-100 border border-amber-200 px-2 py-1 inline-block rounded">
          Subgraph mock active (no key/url set)
        </div>
      )}
      {error && <div className="text-red-600 text-sm">{error}</div>}

      <form onSubmit={createAuction} className="space-y-3 border rounded p-4">
        <div className="text-sm font-medium">Create auction (draft)</div>
        <div className="grid grid-cols-2 gap-3">
          <input className="border rounded px-2 py-1" placeholder="tokenId (optional)" value={tokenId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTokenId(e.target.value)} />
          <input className="border rounded px-2 py-1" placeholder="domainId (optional)" value={domainId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDomainId(e.target.value)} />
          <input className="border rounded px-2 py-1" placeholder="reservePriceEth" value={reservePriceEth} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReservePriceEth(e.target.value)} />
          <input className="border rounded px-2 py-1" placeholder="startsAt ISO (optional)" value={startsAt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartsAt(e.target.value)} />
          <input className="border rounded px-2 py-1 col-span-2" placeholder="endsAt ISO (optional)" value={endsAt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndsAt(e.target.value)} />
          <select className="border rounded px-2 py-1" value={curveMode} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCurveMode(e.target.value as DecayMode)}>
            <option value="linear">linear</option>
            <option value="exponential">exponential</option>
            <option value="sigmoid">sigmoid</option>
          </select>
        </div>
        {/* Quick time presets */}
        <div className="flex gap-2 text-xs">
          <button type="button" className="border px-2 py-1 rounded" onClick={() => setStartsAt(new Date(Date.now() + 2*60*1000).toISOString())}>Start +2m</button>
          <button type="button" className="border px-2 py-1 rounded" onClick={() => setEndsAt(new Date(Date.now() + 15*60*1000).toISOString())}>End +15m</button>
          <button type="button" className="border px-2 py-1 rounded" onClick={() => { setStartsAt(''); setEndsAt('') }}>Clear times</button>
          <button type="button" className="border px-2 py-1 rounded text-rose-600" title="Short, high-energy round"
            onClick={() => { setStartsAt(new Date(Date.now() + 60*1000).toISOString()); setEndsAt(new Date(Date.now() + 5*60*1000).toISOString()) }}>
            Blitz 5m
          </button>
        </div>
        <div>
          <button className="border px-3 py-1 rounded" type="submit" disabled={loading}>Create</button>
          <button type="button" className="ml-2 border px-3 py-1 rounded" onClick={createTrio} disabled={creatingTrio || loading}>
            {creatingTrio ? 'Creating trio…' : 'Create trio (compare curves)'}
          </button>
        </div>
      </form>

      {/* Lightweight Arcade Leaderboard */}
      <ArcadeLeaderboard auctions={auctions} />

      <div className="space-y-2">
        <div className="text-sm font-medium">Existing auctions</div>
        {auctions.length === 0 && <div className="text-sm text-gray-500">None yet</div>}
        <ul className="space-y-2">
          {auctions.map(a => (
            <li key={a.id} className="border rounded p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title={watchlist.includes(a.id) ? 'Unwatch' : 'Watch'}
                    className={`text-lg leading-none ${watchlist.includes(a.id) ? 'text-yellow-500' : 'text-gray-300'} hover:text-yellow-500`}
                    onClick={() => { requestNotifPermission(); setWatchlist(prev => prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id]) }}
                  >{watchlist.includes(a.id) ? '★' : '☆'}</button>
                  <div className="text-sm font-mono hover:underline text-indigo-600"><Link href={`/auctions/${a.id}`}>{a.id}</Link></div>
                </div>
                <div className="text-xs uppercase tracking-wide text-gray-600">{a.status}</div>
              </div>
              <div className="text-sm text-gray-700">
                {(a.tokenId && <span>tokenId: {a.tokenId} </span>) || null}
                {(a.domainId && <span>domainId: {a.domainId} </span>) || null}
                <span>reserve: {weiToEth(a.reservePriceWei)} ETH </span>
                {/* Curve badge */}
                {(() => {
                  const mode: DecayMode = (a.decayMode as DecayMode) || 'linear'
                  const color = mode === 'linear' ? 'bg-gray-200 text-gray-800' : mode === 'exponential' ? 'bg-indigo-200 text-indigo-800' : 'bg-emerald-200 text-emerald-800'
                  return <span className={`ml-1 text-[10px] px-1 py-0.5 rounded ${color}`}>curve: {mode}</span>
                })()}
                {a.startsAt && a.endsAt && (
                  <span className="ml-2 text-xs text-gray-500">{(() => {
                    const mode: DecayMode = (a.decayMode as DecayMode) || 'linear'
                    const { priceEth } = calcDutchPrice(a.reservePriceWei, a.startsAt!, a.endsAt!, mode)
                    return `current≈ ${priceEth} ETH`
                  })()}</span>
                )}
                {a.endsAt && <Countdown endsAt={a.endsAt} />}
                {/* Expired badge */}
                {a.endsAt && Date.now() >= new Date(a.endsAt).getTime() && (
                  <span className="ml-2 text-[10px] px-1 py-0.5 rounded bg-rose-200 text-rose-900">Expired</span>
                )}
                {/* Fee breakdown (from last FEE_CAPTURED) */}
                {(() => {
                  const feeEvents = (a.events || []).filter(e => e.type === 'FEE_CAPTURED')
                  if (feeEvents.length === 0) return null
                  const last = feeEvents[feeEvents.length - 1] as any
                  const feeWei = last?.payload?.feeWei
                  const poolWei = last?.payload?.poolWei
                  if (!feeWei && !poolWei) return null
                  const fee = feeWei ? weiToEth(feeWei, 6) : '0'
                  const pool = poolWei ? weiToEth(poolWei, 6) : '0'
                  return (
                    <span className="ml-2 text-[11px] text-gray-500">fee: {fee} ETH • pool: {pool} ETH</span>
                  )
                })()}
                {/* Bids / last event inline */}
                <span className="ml-2 text-xs text-gray-600">bids: {a.bids?.length ?? 0}</span>
                {a.events && a.events.length > 0 && (
                  <span className="ml-2 text-xs text-gray-500">last: {a.events[a.events.length - 1]?.type}</span>
                )}
              </div>
              <div className="mt-2 flex gap-2 flex-wrap">
                <button
                  type="button"
                  className="border px-2 py-1 rounded text-xs"
                  onClick={async () => {
                    // eslint-disable-next-line no-console
                    console.log('[button] List clicked', a.id)
                    await listOnChain(a)
                    // eslint-disable-next-line no-console
                    console.log('[button] List finished', a.id)
                  }}
                >
                  List (activate)
                </button>
                {/* Predict (price/time) */}
                {a.status === 'ACTIVE' && (
                  <details className="border rounded px-2 py-1 text-xs">
                    <summary>Predict</summary>
                    <PredictWidget userId={userId} onSubmit={async (payload) => {
                      try {
                        const r = await fetch(`/api/auctions/${a.id}/predict`, {
                          method: 'POST', headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ userId, ...payload })
                        })
                        const j = await r.json()
                        if (!j.ok) throw new Error(j.error || 'Predict failed')
                        addToast('success', 'Prediction submitted')
                        await refresh()
                      } catch (e: any) {
                        addToast('error', e?.message || 'Predict failed')
                      }
                    }} />
                  </details>
                )}
                {/* Alerts (price threshold) */}
                <details className="border rounded px-2 py-1 text-xs">
                  <summary>Alerts</summary>
                  <form className="mt-2 flex items-center gap-2" onSubmit={e => { e.preventDefault() }}>
                    <label className="text-[11px] text-gray-600">price ≤</label>
                    <input
                      className="border rounded px-2 py-1 text-xs w-24"
                      placeholder="0.02"
                      value={alerts[a.id]?.price ?? ''}
                      onChange={e => {
                        const v = e.target.value
                        setAlerts(prev => ({ ...prev, [a.id]: { ...(prev[a.id]||{}), price: v ? Number(v) : undefined, firedPrice: false } }))
                      }}
                    />
                    <span className="text-[11px] text-gray-600">ETH</span>
                  </form>
                </details>

                {/* Hide Commit/Reveal if expired */}
                {(!a.endsAt || Date.now() < new Date(a.endsAt).getTime()) ? (
                  <>
                    <details className="border rounded px-2 py-1 text-xs">
                      <summary>Commit</summary>
                      <CommitWidget onSubmit={(bidder, amount) => commitBid(a, bidder, amount)} />
                    </details>
                    <details className="border rounded px-2 py-1 text-xs">
                      <summary>Reveal</summary>
                      <RevealWidget onSubmit={(bidder, proof) => revealBid(a, bidder, proof)} />
                    </details>
                  </>
                ) : (
                  <div className="text-[11px] text-rose-700 border rounded px-2 py-1 bg-rose-50">Expired — please settle</div>
                )}
                <details className="border rounded px-2 py-1 text-xs">
                  <summary>Settle</summary>
                  <SettleWidget onSubmit={(tx) => settleAuction(a, tx)} />
                </details>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function CommitWidget({ onSubmit }: { onSubmit: (bidder: string, amountEth: string) => Promise<void> }) {
  const [bidder, setBidder] = useState('')
  const [amount, setAmount] = useState('0.02')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={async e => {
        e.preventDefault()
        // eslint-disable-next-line no-console
        console.log('[CommitWidget] submit click', { bidder, amount })
        setBusy(true)
        try {
          await onSubmit(bidder, amount)
          // eslint-disable-next-line no-console
          console.log('[CommitWidget] submit done')
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[CommitWidget] submit error', err)
        } finally {
          setBusy(false)
        }
      }}
    >
      <input className="border rounded px-2 py-1 text-xs" placeholder="bidder 0x..." value={bidder} onChange={e => setBidder(e.target.value)} />
      <input className="border rounded px-2 py-1 text-xs" placeholder="amount ETH" value={amount} onChange={e => setAmount(e.target.value)} />
      <button disabled={busy} className="border rounded px-2 py-1 text-xs" type="submit">Commit</button>
    </form>
  )
}

function RevealWidget({ onSubmit }: { onSubmit: (bidder: string, proof: string) => Promise<void> }) {
  const [bidder, setBidder] = useState('')
  const [proof, setProof] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form className="mt-2 flex gap-2" onSubmit={async e => { e.preventDefault(); console.log('[RevealWidget] submit', { bidder }); setBusy(true); try { await onSubmit(bidder, proof); console.log('[RevealWidget] done') } catch (err) { console.error('[RevealWidget] error', err) } finally { setBusy(false) } }}>
      <input className="border rounded px-2 py-1 text-xs" placeholder="bidder 0x..." value={bidder} onChange={e => setBidder(e.target.value)} />
      <input className="border rounded px-2 py-1 text-xs" placeholder="proof" value={proof} onChange={e => setProof(e.target.value)} />
      <button disabled={busy} className="border rounded px-2 py-1 text-xs" type="submit">Reveal</button>
    </form>
  )
}

function SettleWidget({ onSubmit }: { onSubmit: (txHash?: string) => Promise<void> }) {
  const [tx, setTx] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form className="mt-2 flex gap-2" onSubmit={async e => { e.preventDefault(); console.log('[SettleWidget] submit', { tx }); setBusy(true); try { await onSubmit(tx || undefined); console.log('[SettleWidget] done') } catch (err) { console.error('[SettleWidget] error', err) } finally { setBusy(false) } }}>
      <input className="border rounded px-2 py-1 text-xs" placeholder="txHash (optional)" value={tx} onChange={e => setTx(e.target.value)} />
      <button disabled={busy} className="border rounded px-2 py-1 text-xs" type="submit">Settle</button>
    </form>
  )
}

function PredictWidget({ userId, onSubmit }: { userId: string; onSubmit: (payload: { priceEth?: number; time?: string }) => Promise<void> }) {
  const [price, setPrice] = useState<string>('')
  const [time, setTime] = useState<string>('')
  const [busy, setBusy] = useState(false)
  return (
    <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await onSubmit({ priceEth: price ? Number(price) : undefined, time: time || undefined }); } finally { setBusy(false) } }}>
      <span className="text-[11px] text-gray-600">you:</span>
      <code className="text-[11px] bg-gray-100 px-1 rounded">{userId || 'anon'}</code>
      <label className="text-[11px] text-gray-600">price</label>
      <input className="border rounded px-2 py-1 text-xs w-24" placeholder="0.03" value={price} onChange={e => setPrice(e.target.value)} />
      <span className="text-[11px] text-gray-600">ETH</span>
      <label className="text-[11px] text-gray-600">time</label>
      <input className="border rounded px-2 py-1 text-xs w-44" placeholder="YYYY-MM-DDTHH:mm:ssZ" value={time} onChange={e => setTime(e.target.value)} />
      <button disabled={busy} className="border rounded px-2 py-1 text-xs" type="submit">Submit</button>
    </form>
  )
}

// Lightweight leaderboard widget — top bidders and most bid-on auctions
function ArcadeLeaderboard({ auctions }: { auctions: Auction[] }) {
  const stats = useMemo(() => {
    const bidderCount: Record<string, number> = {}
    let topAuctions: { id: string; bids: number; endsAt?: string | null }[] = []
    // Forecaster scores
    const forecaster: Record<string, number> = {}
    for (const a of auctions) {
      const n = a.bids?.length || 0
      topAuctions.push({ id: a.id, bids: n, endsAt: a.endsAt })
      for (const b of a.bids || []) {
        const key = (b.bidder || '').toLowerCase()
        if (!key) continue
        bidderCount[key] = (bidderCount[key] || 0) + 1
      }
      for (const ev of a.events || []) {
        if (ev.type === 'PREDICTION_SCORED') {
          const uid = (ev as any).payload?.userId || 'anon'
          const sc = Number((ev as any).payload?.score ?? 0)
          if (!Number.isNaN(sc)) forecaster[uid] = (forecaster[uid] || 0) + sc
        }
      }
    }
    const topBidders = Object.entries(bidderCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    topAuctions = topAuctions.sort((a, b) => b.bids - a.bids).slice(0, 5)
    const now = Date.now()
    const expSoon = auctions
      .filter(a => a.status === 'ACTIVE' && a.endsAt && new Date(a.endsAt).getTime() > now)
      .sort((a, b) => new Date(a.endsAt as string).getTime() - new Date(b.endsAt as string).getTime())
      .slice(0, 3)
    const topForecasters = Object.entries(forecaster)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    return { topBidders, topAuctions, expSoon, topForecasters }
  }, [auctions])

  if (auctions.length === 0) return null
  return (
    <div className="border rounded p-3">
      <div className="text-sm font-medium mb-2">Arcade Leaderboard</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div>
          <div className="font-semibold mb-1">Top bidders</div>
          <ul className="space-y-1">
            {stats.topBidders.length === 0 && <li className="text-gray-500">No bids yet</li>}
            {stats.topBidders.map(([addr, count], i) => (
              <li key={addr} className="text-gray-700">#{i+1} {addr.slice(0,6)}…{addr.slice(-4)} · {count}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-1">Most bid-on</div>
          <ul className="space-y-1">
            {stats.topAuctions.length === 0 && <li className="text-gray-500">No auctions yet</li>}
            {stats.topAuctions.map(a => (
              <li key={a.id} className="text-gray-700">{a.id.slice(0,6)}…{a.id.slice(-4)} · bids {a.bids}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-1">Expiring soon</div>
          <ul className="space-y-1">
            {stats.expSoon.length === 0 && <li className="text-gray-500">None</li>}
            {stats.expSoon.map(a => (
              <li key={a.id} className="text-gray-700">{a.id.slice(0,6)}…{a.id.slice(-4)} · ends {new Date(a.endsAt as string).toLocaleTimeString()}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-1">Top forecasters</div>
          <ul className="space-y-1">
            {stats.topForecasters.length === 0 && <li className="text-gray-500">No predictions yet</li>}
            {stats.topForecasters.map(([uid, score], i) => (
              <li key={uid} className="text-gray-700">#{i+1} {uid} · {Math.round(Number(score))} pts</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
