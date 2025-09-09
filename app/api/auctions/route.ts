import { NextRequest, NextResponse } from 'next/server'
import { parseEther } from 'ethers'
import prisma from '../../../lib/prisma'

// Convert BigInt values to string so NextResponse.json can serialize
function jsonSafe<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  )
}

// GET /api/auctions -> list auctions (latest first)
export async function GET() {
  try {
    const auctions = await prisma.auction.findMany({
      orderBy: { createdAt: 'desc' },
      include: { bids: true, events: true },
    })
    return NextResponse.json({ ok: true, auctions: jsonSafe(auctions) })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}

// POST /api/auctions -> create an auction record
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''
    let tokenId = ''
    let domainId = ''
    let reservePriceEthStr = ''
    let startsAtStr = ''
    let endsAtStr = ''
    let decayModeStr = ''
    if (contentType.includes('application/json')) {
      const body = await req.json()
      tokenId = body?.tokenId ?? ''
      domainId = body?.domainId ?? ''
      reservePriceEthStr = body?.reservePriceEth ?? ''
      startsAtStr = body?.startsAt ?? ''
      endsAtStr = body?.endsAt ?? ''
      decayModeStr = body?.decayMode ?? ''
    } else {
      const form = await req.formData()
      tokenId = String(form.get('tokenId') ?? '')
      domainId = String(form.get('domainId') ?? '')
      reservePriceEthStr = String(form.get('reservePriceEth') ?? '')
      startsAtStr = String(form.get('startsAt') ?? '')
      endsAtStr = String(form.get('endsAt') ?? '')
      decayModeStr = String(form.get('decayMode') ?? '')
    }

    if (!reservePriceEthStr) {
      return NextResponse.json({ ok: false, error: 'reservePriceEth required' }, { status: 400 })
    }
    if (!tokenId && !domainId) {
      return NextResponse.json({ ok: false, error: 'tokenId or domainId required' }, { status: 400 })
    }

    let reserveWei: bigint
    try { reserveWei = parseEther(String(reservePriceEthStr)) } catch {
      return NextResponse.json({ ok: false, error: 'Invalid reservePriceEth' }, { status: 400 })
    }

    const startsAt = startsAtStr ? new Date(startsAtStr) : null
    const endsAt = endsAtStr ? new Date(endsAtStr) : null

    const auction = await prisma.auction.create({
      data: {
        tokenId: tokenId || null,
        domainId: domainId || null,
        reservePriceWei: reserveWei,
        startsAt: startsAt,
        endsAt: endsAt,
        decayMode: decayModeStr || null,
        // status defaults to DRAFT; frontend or listing route can flip to ACTIVE
      },
    })

    return NextResponse.json({ ok: true, auction: jsonSafe(auction) })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}
