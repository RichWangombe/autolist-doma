# autolist-doma

A real-time Dutch auction dApp for DomainFi, built on Doma Protocol for transparent price discovery with configurable decay curves.

## Features

- **Full Auction Lifecycle**: List (activate), Commit, Reveal, Settle with real-time sync across tabs.
- **Configurable Decay Curves**: Linear, Exponential, Sigmoid for seller-optimized pricing.
- **Trio Comparison**: One-click creation of three auctions with identical timing but different curves to visualize divergence.
- **Live Event Feed**: Real-time stream of auction events (BID_COMMIT, BID_REVEAL, etc.) via Socket.IO.
- **BigInt-Safe**: All routes handle Ethereum values without serialization errors.
- **Responsive UI**: Toasts for actions, bids/events display, quick time presets.

## Quick Start

1. Clone: `git clone https://github.com/RichWangombe/autolist-doma.git`
2. Install: `npm install`
3. Run: `npx next dev -p 4000`
4. Open: `http://localhost:4000/auctions` in two tabs for multi-tab sync.

## Demo Script (90 seconds)

1. **Activate an Auction (10s)**:
   - In Tab A, create a draft with reserve `0.01 ETH`, start/end times.
   - Click “List (activate)”.
   - Both tabs update to ACTIVE instantly.

2. **Commit a Bid (20s)**:
   - In Tab A, expand “Commit”.
   - Fill bidder `0xAbC000000000000000000000000000000000AbC0`, amount `0.02`.
   - Click Commit.
   - Toast “Bid committed”; bids count increments; last event shows BID_COMMIT.

3. **Reveal the Bid (20s)**:
   - Expand “Reveal”, fill bidder same as above, proof `test-proof-1`.
   - Click Reveal.
   - Toast “Bid revealed”; last event updates to BID_REVEAL.

4. **Settle (10s)**:
   - Expand “Settle”, optional tx `0xabc123`.
   - Click Settle.
   - Row flips to SETTLED in both tabs.

5. **Curve Comparison (30s)**:
   - Click “Start +2m”, “End +15m”, set reserve `0.05`.
   - Click “Create trio (compare curves)”.
   - Watch three auctions: linear (steady drop), exponential (fast early), sigmoid (S-shaped).

## Hackathon Track

**Track 1: On-Chain Auctions & Price Discovery**

This submission innovates auction mechanisms for premium/expiring domains, enabling transparent price discovery with custom Dutch decay strategies. It reduces asymmetry for sellers/buyers by providing real-time visibility and configurable pricing levers.

- **Innovation**: Trio comparison visually teaches curve impact; live event feed shows auction activity.
- **Doma Integration**: Uses Doma SDK for listing/activation; testnet-ready for on-chain settlements.
- **Usability**: Multi-tab sync, toasts, quick presets make demos smooth.
- **Demo Quality**: 90s walkthrough with tangible outcomes.

## Doma Usage

- **Integration Points**: `app/api/listing/route.ts` uses Doma hooks for activation; `lib/doma.ts` handles SDK calls.
- **Testnet Config**: Set `NEXT_PUBLIC_DOMA_SUBGRAPH_URL` and `NEXT_PUBLIC_DOMA_SUBGRAPH_API_KEY` in `.env` for live data.
- **On-Chain Impact**: Ready for proofs and settlements on Doma testnet; current mock subgraph for development.
- **Future**: Add wallet connect (SIWE) and full on-chain bids/reveals.

## Tech Stack

- **Frontend**: Next.js (App Router), React, Tailwind CSS
- **Backend**: Next.js API routes, Prisma + SQLite
- **Real-Time**: Socket.IO
- **Math**: Custom Dutch decay curves in `lib/auctionMath.ts`
- **BigInt Handling**: `jsonSafe` wrappers for Ethereum values

## Project Links

- **GitHub**: https://github.com/RichWangombe/autolist-doma
- **Demo Video**: [Add YouTube/Loom link here]
- **X/Twitter**: [Add project handle here]

## License

MIT
