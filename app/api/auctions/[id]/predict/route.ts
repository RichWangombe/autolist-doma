import { NextRequest, NextResponse } from 'next/server'
import prisma from '../../../../../lib/prisma'

function jsonSafe<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  )
}

// POST /api/auctions/[id]/predict
// Body: { userId: string, priceEth?: number, time?: string(ISO) }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auctionId = params.id
    const contentType = req.headers.get('content-type') || ''

    let userId = 'anon'
    let priceEth: number | undefined
    let timeIso: string | undefined

    if (contentType.includes('application/json')) {
      const body = await req.json()
      userId = typeof body?.userId === 'string' && body.userId.trim() ? body.userId.trim() : 'anon'
      priceEth = body?.priceEth !== undefined ? Number(body.priceEth) : undefined
      timeIso = typeof body?.time === 'string' ? body.time : undefined
    } else {
      const form = await req.formData()
      userId = String(form.get('userId') || 'anon')
      const price = form.get('priceEth')
      priceEth = price !== null && price !== undefined && String(price).length ? Number(price) : undefined
      timeIso = String(form.get('time') || '') || undefined
    }

    const auction = await prisma.auction.findUnique({ where: { id: auctionId } })
    if (!auction) return NextResponse.json({ ok: false, error: 'auction not found' }, { status: 404 })
    if (auction.status !== 'ACTIVE') return NextResponse.json({ ok: false, error: 'predictions allowed only for ACTIVE auctions' }, { status: 400 })

    // Basic validation: at least one of price/time must be provided
    if ((priceEth === undefined || Number.isNaN(priceEth)) && !timeIso) {
      return NextResponse.json({ ok: false, error: 'Provide priceEth and/or time' }, { status: 400 })
    }

    let timeValid: string | undefined = undefined
    if (timeIso) {
      const d = new Date(timeIso)
      if (!Number.isNaN(d.getTime())) timeValid = d.toISOString()
    }

    const ev = await prisma.eventLog.create({
      data: {
        auctionId,
        type: 'PREDICTION',
        payload: {
          userId,
          predict: {
            priceEth: priceEth !== undefined && !Number.isNaN(priceEth) ? Number(priceEth) : undefined,
            time: timeValid,
          },
        },
      },
    })

    try {
      ;(globalThis as any).io?.emit('auction_update', { auctionId, action: 'prediction_submitted', userId })
    } catch {}

    return NextResponse.json(jsonSafe({ ok: true, prediction: ev }))
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}
