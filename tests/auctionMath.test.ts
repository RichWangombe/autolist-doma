import { describe, it, expect } from 'vitest'
import { linearDutchPrice, expDutchPrice, calcDutchPrice } from '../lib/auctionMath'

describe('auctionMath', () => {
  it('linearDutchPrice halves price at half duration', () => {
    const price = linearDutchPrice(1, 500, 1000)
    expect(price).toBeCloseTo(0.5, 6)
  })

  it('expDutchPrice decays to reserve/factor at full duration', () => {
    const reserve = 2
    const factor = 10
    const price = expDutchPrice(reserve, 1000, 1000, factor)
    expect(price).toBeCloseTo(reserve / factor, 6)
  })

  it('calcDutchPrice before start returns full reserve', () => {
    const now = Date.now()
    const { priceEth } = calcDutchPrice(1e18, new Date(now + 1000).toISOString(), new Date(now + 2000).toISOString())
    expect(Number(priceEth)).toBeCloseTo(1, 6)
  })
})
