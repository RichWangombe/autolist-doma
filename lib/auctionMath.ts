// Utility functions for Dutch-auction price curves.
// All math is done in ETH (number) for UI use. Server-side logic can derive from this as well.

/** Convert wei (bigint | string | number) to ETH as a number */
export function weiToEthNum(wei: bigint | string | number): number {
  try {
    const b = typeof wei === 'bigint' ? wei : BigInt(wei as any)
    return Number(b) / 1e18
  } catch {
    return Number(wei)
  }
}

/** Linear decay from reserve to 0 over duration ms */
export function linearDutchPrice(reserveEth: number, elapsedMs: number, durationMs: number): number {
  if (elapsedMs <= 0) return reserveEth
  if (elapsedMs >= durationMs) return 0
  const pct = elapsedMs / durationMs
  return reserveEth * (1 - pct)
}

/** Exponential decay (price = reserve * e^{-k * t}) where k adjusts speed.
 *  k = ln(factor) / duration; factor>1 means price drops by that factor over full duration.
 */
export function expDutchPrice(reserveEth: number, elapsedMs: number, durationMs: number, factor = 10): number {
  if (elapsedMs <= 0) return reserveEth
  if (elapsedMs >= durationMs) return 0
  const k = Math.log(factor) / durationMs
  return reserveEth * Math.exp(-k * elapsedMs)
}

export type DecayMode = 'linear' | 'exponential' | 'sigmoid'

// Sigmoid decay using logistic curve: price = reserve / (1 + e^{k(t - d)})
export function sigmoidDutchPrice(reserve: number, elapsed: number, duration: number, steepness = 10) {
  const x = elapsed / duration // 0..1
  const k = steepness
  const price = reserve / (1 + Math.exp(k * (x - 0.5)))
  return price
}

export function calcDutchPrice(
  reserveWei: bigint | string | number,
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  mode: DecayMode = 'linear',
  factor = 10,
) {
  if (!startsAt || !endsAt) {
    return { priceEth: weiToEthNum(reserveWei).toFixed(4), pct: 0 }
  }
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()
  const now = Date.now()
  const reserveEth = weiToEthNum(reserveWei)
  if (now <= start) return { priceEth: reserveEth.toFixed(4), pct: 0 }
  if (now >= end) return { priceEth: '0', pct: 100 } as any
  const duration = end - start
  const elapsed = now - start
  let price: number
  if (mode === 'linear') price = linearDutchPrice(reserveEth, elapsed, duration)
  else if (mode === 'exponential') price = expDutchPrice(reserveEth, elapsed, duration, factor)
  else price = sigmoidDutchPrice(reserveEth, elapsed, duration)
  const pct = Math.round((elapsed / duration) * 100)
  return { priceEth: price.toFixed(4), pct }
}
