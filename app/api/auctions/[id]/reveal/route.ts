import { NextRequest, NextResponse } from 'next/server'
import prisma from '../../../../../lib/prisma'

function jsonSafe<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  )
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auctionId = params.id
    const contentType = req.headers.get('content-type') || ''

    let bidder = ''
    let proof = ''

    if (contentType.includes('application/json')) {
      const body = await req.json()
      bidder = body?.bidder ?? ''
      proof = body?.proof ?? ''
    } else {
      const form = await req.formData()
      bidder = String(form.get('bidder') ?? '')
      proof = String(form.get('proof') ?? '')
    }

    const auction = await prisma.auction.findUnique({ where: { id: auctionId } })
    if (!auction) return NextResponse.json({ ok: false, error: 'auction not found' }, { status: 404 })

    await prisma.eventLog.create({
      data: {
        auctionId,
        type: 'BID_REVEAL',
        payload: { bidder, proof },
      },
    })

    try {
      ;(globalThis as any).io?.emit('auction_update', {
        auctionId,
        action: 'revealed',
        bidder,
      })
    } catch {}

    return NextResponse.json(jsonSafe({ ok: true }))
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}
