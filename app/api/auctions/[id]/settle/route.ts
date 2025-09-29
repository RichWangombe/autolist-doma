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

    // Compute effective settle price (mock): use highest committed bid if any, else 0
    const highest = updated.bids?.reduce((m, b) => (m && m.amountWei > b.amountWei ? m : b), undefined as any)
    const settlePriceWei = highest ? highest.amountWei : BigInt(0)
    // Fee parameters (basis points)
    const FEE_BPS = Number(process.env.PLATFORM_FEE_BPS || 300) // 3%
    const POOL_BPS = Number(process.env.PREDICTION_POOL_BPS || 2000) // 20% of fee goes to pool
    const feeWei = (settlePriceWei * BigInt(FEE_BPS)) / BigInt(10000)
    const poolWei = (feeWei * BigInt(POOL_BPS)) / BigInt(10000)

    // Log fee capture
    await prisma.eventLog.create({
      data: {
        auctionId,
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

    // Score predictions (if any) against settle price and time
    try {
      const predictions = await prisma.eventLog.findMany({ where: { auctionId, type: 'PREDICTION' } })
      if (predictions.length > 0) {
        const nowTs = new Date()
        const actualTs = nowTs.getTime()
        const actualPriceWei = settlePriceWei
        const actualPriceEth = Number(actualPriceWei) / 1e18
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
              auctionId,
              type: 'PREDICTION_SCORED',
              payload: {
                userId,
                score: Math.round(score),
                components: { priceScore: Math.round(priceScore), timeScore: Math.round(timeScore) },
              },
            },
          })
          try {
            ;(globalThis as any).io?.emit('auction_update', { auctionId, action: 'prediction_scored', userId, score: Math.round(score) })
          } catch {}
        }
      }
    } catch {}

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
