import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const auction = await prisma.auction.findUnique({
      where: { id },
      include: { bids: true, events: { orderBy: { createdAt: 'desc' } } },
    })
    if (!auction) return NextResponse.json({ ok: false, error: 'Auction not found' }, { status: 404 })
    return NextResponse.json({ ok: true, auction })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown' }, { status: 500 })
  }
}
