import prisma from './prisma'

// Side-effect module: starts a single timer that auto-settles expired auctions in dev/offline mode.
declare const globalThis: { __settleCronStarted?: boolean }

export async function settleExpired() {
  try {
    const now = new Date()
    const expired = await prisma.auction.findMany({
      where: { status: 'ACTIVE', endsAt: { lt: now } },
      select: { id: true },
    })
    if (expired.length === 0) return
    const ids = expired.map((a) => a.id)
    await prisma.$transaction([
      prisma.auction.updateMany({ where: { id: { in: ids } }, data: { status: 'SETTLED' } }),
      prisma.eventLog.createMany({ data: ids.map((id) => ({ auctionId: id, type: 'AUTO_SETTLED' })) }),
    ])
    console.log(`[settleCron] Auto-settled ${ids.length} auctions at`, now.toISOString())
  } catch (e) {
    console.error('[settleCron] error', e)
  }
}

if (!globalThis.__settleCronStarted) {
  globalThis.__settleCronStarted = true
  const INTERVAL_MS = 60_000 // 1 min
  // Run immediately and then on interval
  settleExpired().catch(() => {})
  setInterval(() => settleExpired().catch(() => {}), INTERVAL_MS)
}
