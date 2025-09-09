import { NextRequest, NextResponse } from 'next/server'
import { parseEther } from 'ethers'
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
    let amountEthStr = ''

    if (contentType.includes('application/json')) {
      const body = await req.json()
      bidder = body?.bidder ?? ''
      amountEthStr = body?.amountEth ?? ''
    } else {
      const form = await req.formData()
      bidder = String(form.get('bidder') ?? '')
      amountEthStr = String(form.get('amountEth') ?? '')
    }

    if (!bidder) return NextResponse.json({ ok: false, error: 'bidder required' }, { status: 400 })
    if (!amountEthStr) return NextResponse.json({ ok: false, error: 'amountEth required' }, { status: 400 })

    const auction = await prisma.auction.findUnique({ where: { id: auctionId } })
    if (!auction) return NextResponse.json({ ok: false, error: 'auction not found' }, { status: 404 })

    let amountWei: bigint
    try { amountWei = parseEther(String(amountEthStr)) } catch {
      return NextResponse.json({ ok: false, error: 'Invalid amountEth' }, { status: 400 })
    }

    const bid = await prisma.bid.create({
      data: {
        auctionId,
        bidder: bidder.toLowerCase(),
        amountWei,
      },
    })

    await prisma.eventLog.create({
      data: {
        auctionId,
        type: 'BID_COMMIT',
        payload: { bidder, amountEth: amountEthStr },
      },
    })

    // emit live update
    if (globalThis.io) {
      globalThis.io.emit('auction_update', { id: auctionId, type: 'BID_COMMIT', bidder, amountEth: amountEthStr })
    }

    return NextResponse.json(jsonSafe({ ok: true, bid }))
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}
