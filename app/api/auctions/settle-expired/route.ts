import { NextRequest, NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'

function jsonSafe<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  )
}

// POST /api/auctions/settle-expired
// Sets all ACTIVE auctions with endsAt <= now to SETTLED and emits socket events per auction
export async function POST(_req: NextRequest) {
  try {
    const now = new Date()
    // Find expired ACTIVE auctions
    const expired = await prisma.auction.findMany({
      where: {
        status: 'ACTIVE',
        endsAt: { lte: now },
      },
      include: { bids: true },
    })

    if (expired.length === 0) {
      return NextResponse.json(jsonSafe({ ok: true, count: 0 }))
    }

    const settled: string[] = []

    const FEE_BPS = Number(process.env.PLATFORM_FEE_BPS || 300)
    const POOL_BPS = Number(process.env.PREDICTION_POOL_BPS || 2000)

    for (const a of expired) {
      const updated = await prisma.auction.update({
        where: { id: a.id },
        data: {
          status: 'SETTLED',
          events: { create: { type: 'AUCTION_SETTLED' } },
        },
      })
      settled.push(updated.id)
      // Compute effective settle price (mock): highest committed bid
      const highest = a.bids?.reduce((m, b) => (m && m.amountWei > b.amountWei ? m : b), undefined as any)
      const settlePriceWei = highest ? highest.amountWei : BigInt(0)
      const feeWei = (settlePriceWei * BigInt(FEE_BPS)) / BigInt(10000)
      const poolWei = (feeWei * BigInt(POOL_BPS)) / BigInt(10000)
      // Log fee capture
      await prisma.eventLog.create({
        data: {
          auctionId: updated.id,
          type: 'FEE_CAPTURED',
          payload: {
            feeBps: FEE_BPS,
            poolBps: POOL_BPS,
            settlePriceWei: settlePriceWei.toString(),
            feeWei: feeWei.toString(),
            poolWei: poolWei.toString(),
          },
        },
      })
      // Score predictions
      try {
        const predictions = await prisma.eventLog.findMany({ where: { auctionId: updated.id, type: 'PREDICTION' } })
        if (predictions.length > 0) {
          const actualTs = Date.now()
          const actualPriceEth = Number(settlePriceWei) / 1e18
          for (const p of predictions) {
            const userId = (p as any).payload?.userId || 'anon'
            const predPriceEth = Number((p as any).payload?.predict?.priceEth ?? NaN)
            const predTime = (p as any).payload?.predict?.time ? new Date((p as any).payload?.predict?.time) : null
            let priceScore = 0
            let timeScore = 0
            if (!isNaN(predPriceEth) && actualPriceEth > 0) {
              priceScore = Math.max(0, 100 - Math.abs(predPriceEth - actualPriceEth) / Math.max(0.01, actualPriceEth) * 100)
            }
            if (predTime && !isNaN(predTime.getTime())) {
              const deltaSec = Math.abs(predTime.getTime() - actualTs) / 1000
              timeScore = Math.max(0, 100 - deltaSec / 60)
            }
            const score = predPriceEth && predTime ? (priceScore + timeScore) / 2 : (isNaN(predPriceEth) ? timeScore : priceScore)
            await prisma.eventLog.create({
              data: {
                auctionId: updated.id,
                type: 'PREDICTION_SCORED',
                payload: { userId, score: Math.round(score), components: { priceScore: Math.round(priceScore), timeScore: Math.round(timeScore) } },
              },
            })
            try {
              ;(globalThis as any).io?.emit('auction_update', { auctionId: updated.id, action: 'prediction_scored', userId, score: Math.round(score) })
            } catch {}
          }
        }
      } catch {}
      try {
        ;(globalThis as any).io?.emit('auction_update', {
          auctionId: updated.id,
          action: 'settled',
          status: updated.status,
        })
      } catch {}
    }

    return NextResponse.json(jsonSafe({ ok: true, count: settled.length, settled }))
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}
