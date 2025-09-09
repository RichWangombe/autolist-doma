import { NextRequest, NextResponse } from 'next/server'
import { parseEther, Wallet, JsonRpcProvider } from 'ethers'
import { DomaOrderbookSDK } from '@doma-protocol/orderbook-sdk'
import prisma from '../../../lib/prisma'

// Convert BigInt values to string so NextResponse.json can serialize
function jsonSafe<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  )
}

// Initialize SDK across versions: pass empty config and cast to any to satisfy typings
const sdk: any = new (DomaOrderbookSDK as any)({})

// POST /api/listing — Create a listing (Dutch auction stub)
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''
    let tokenId = ''
    let auctionId = ''
    let reservePriceEthStr = ''
    let domainId = ''
    if (contentType.includes('application/json')) {
      const body = await req.json()
      tokenId = body?.tokenId ?? ''
      auctionId = body?.auctionId ?? ''
      reservePriceEthStr = body?.reservePriceEth ?? ''
      domainId = body?.domainId ?? ''
    } else {
      const formData = await req.formData()
      tokenId = String(formData.get('tokenId') ?? '')
      auctionId = String(formData.get('auctionId') ?? '')
      reservePriceEthStr = String(formData.get('reservePriceEth') ?? '')
      domainId = String(formData.get('domainId') ?? '')
    }

    if (!reservePriceEthStr) {
      return NextResponse.json({ ok: false, error: 'reservePriceEth required' }, { status: 400 })
    }
    if (!auctionId && !tokenId && !domainId) {
      return NextResponse.json({ ok: false, error: 'auctionId or (tokenId/domainId) required' }, { status: 400 })
    }

    let reserveWei: bigint
    try {
      reserveWei = parseEther(String(reservePriceEthStr))
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid reservePriceEth' }, { status: 400 })
    }

    const rpcUrl = process.env.DOMA_RPC_URL || ''
    const relayerPk = process.env.RELAYER_PRIVATE_KEY || ''
    const devOffline = !rpcUrl || !relayerPk || process.env.DEV_OFFCHAIN === 'true'

    let listing: any = null
    try {
      if (!devOffline) {
        const provider = new JsonRpcProvider(rpcUrl)
        const signer = new Wallet(relayerPk, provider)
        // Tolerate SDKs that expose setSigner, otherwise attach via any-cast
        try { (sdk as any).setSigner?.(signer) } catch {}

        // Attempt on-chain listing if SDK supports it
        if ((sdk as any).createDutchAuction) {
          listing = await (sdk as any).createDutchAuction({
            reservePrice: reserveWei,
            tokenId,
            domainId,
          })
        }
      }

      // Persist auction to DB: mark ACTIVE and log event
      // Prefer explicit auctionId targeting; fallback to tokenId/domainId lookup
      const existing = auctionId
        ? await prisma.auction.findUnique({ where: { id: auctionId } })
        : await prisma.auction.findFirst({
            where: {
              OR: [
                tokenId ? { tokenId } : undefined,
                domainId ? { domainId } : undefined,
              ].filter(Boolean) as any,
            },
          })

      let auction
      if (existing) {
        auction = await prisma.auction.update({
          where: { id: existing.id },
          data: {
            reservePriceWei: reserveWei,
            status: 'ACTIVE',
            txHash: listing?.txHash ?? null,
            events: {
              create: {
                type: 'LISTING_CREATED',
                txHash: listing?.txHash ?? null,
                payload: listing ? (listing as any) : undefined,
              },
            },
          },
        })
      } else {
        auction = await prisma.auction.create({
          data: {
            tokenId: tokenId || null,
            domainId: domainId || null,
            reservePriceWei: reserveWei,
            status: 'ACTIVE',
            txHash: listing?.txHash ?? null,
            events: {
              create: {
                type: 'LISTING_CREATED',
                txHash: listing?.txHash ?? null,
                payload: listing ? (listing as any) : undefined,
              },
            },
          },
        })
      }

      // Emit socket event so all clients refresh
      try {
        ;(globalThis as any).io?.emit('auction_update', {
          auctionId: auction.id,
          action: 'listed',
          status: auction.status,
        })
      } catch {}

      return NextResponse.json(
        jsonSafe({
          ok: true,
          message: listing ? 'Listing created' : 'Listing prepared (SDK stub — integrate when available)'.trim(),
          tokenId,
          domainId,
          reservePriceEth: String(reservePriceEthStr),
          reservePriceWei: reserveWei.toString(),
          listing,
          auction,
        })
      )
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e?.message ?? 'unknown error' }, { status: 500 })
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}
