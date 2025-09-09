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
    let txHash: string | null = null
    if (contentType.includes('application/json')) {
      const body = await req.json()
      txHash = body?.txHash ?? null
    } else if (contentType.includes('form')) {
      const form = await req.formData()
      txHash = String(form.get('txHash') ?? '') || null
    }

    const auction = await prisma.auction.findUnique({ where: { id: auctionId } })
    if (!auction) return NextResponse.json({ ok: false, error: 'auction not found' }, { status: 404 })

    const updated = await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: 'SETTLED',
        txHash: txHash ?? auction.txHash,
        events: {
          create: {
            type: 'AUCTION_SETTLED',
            txHash: txHash ?? undefined,
          },
        },
      },
      include: { bids: true, events: true },
    })

    // emit live update
    try {
      ;(globalThis as any).io?.emit('auction_update', {
        auctionId,
        action: 'settled',
        status: updated.status,
      })
    } catch {}

    return NextResponse.json(jsonSafe({ ok: true, auction: updated }))
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}
