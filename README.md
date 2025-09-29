# autolist-doma

Auction Arcade — a real-time Dutch auction playground for DomainFi, built on the Doma Protocol. We pair frenetic Blitz rounds, anti-snipe fairness, watchlists, predictions, and fee sharing to keep buyers, sellers, and spectators hooked.

## Auction Arcade Features

- **Blitz Rounds + Anti-Snipe**: One-click Blitz preset (Start +1m, End +5m) and automatic end-time extensions when bids land inside the final window.
- **Fee Capture & Prediction Pool**: Every settle logs a configurable platform fee and sets aside a pool percentage for accurate forecasters.
- **Prediction Mini‑Game**: Anyone can forecast settle price/time; predictions score on settle and push users up the forecasters leaderboard.
- **Watchlist + Alerts**: Star auctions, receive desktop notifications, and set price-threshold alerts so you never miss the right moment to jump in.
- **Arcade Leaderboard**: Live summaries of top bidders, most bid-on auctions, expiring soon, and top forecasters (aggregate prediction scores).
- **Trio Comparison**: Spawn three simultaneous auctions with different decay curves (linear, exponential, sigmoid) to showcase price discovery strategies.
- **Confetti & Event Feed**: Delightful feedback on settle plus a socket-powered stream of all auction events for multi-tab demos.

## Quick Start

1. Clone: `git clone https://github.com/RichWangombe/autolist-doma.git`
2. Install: `npm install`
3. Run: `npx next dev -p 4000`
4. Open: `http://localhost:4000/auctions` in two tabs for multi-tab sync.

Set the following optional environment variables to demo economics and anti-snipe tweaks:

```
PLATFORM_FEE_BPS=300           # 3% platform fee captured on settle
PREDICTION_POOL_BPS=2000       # 20% of the fee allocated to prediction rewards
ANTI_SNIPE_WINDOW_MIN=1        # Anti-snipe window (minutes before endsAt)
ANTI_SNIPE_EXTENSION_MIN=1     # Extension length (minutes)
```

## Demo Script (120 seconds)

1. **Blitz Launch (20s)**  
   - In Tab A, set reserve `0.05 ETH`, click **Blitz 5m** preset.  
   - Click **Create** then “List (activate)”. Both tabs show `ACTIVE`, current≈ price, and countdown.

2. **Predict the Outcome (20s)**  
   - Expand **Predict** on the row. Enter price `0.03` and time (ISO, e.g. `2025-09-27T16:45:00Z`). Submit.  
   - Toast confirms submission; event feed logs `prediction_submitted`.

3. **Commit to Win (20s)**  
   - Expand **Commit**. Use bidder `0xAbC000000000000000000000000000000000AbC0` and amount `0.025`.  
   - Submit. See toast, bids counter update, and the anti-snipe window extend endsAt if you commit inside the final minute.

4. **Let It Expire & Bulk Settle (30s)**  
   - Allow the countdown to hit zero (Expired badge appears, Commit/Reveal disabled).  
   - Click **Settle expired** in the header. Confetti fires, status flips to `SETTLED`, fee line appears (e.g., `fee: 0.00075 ETH • pool: 0.00015 ETH`).

5. **Celebrate Scores & Leaderboard (30s)**  
   - Watch event feed for `AUCTION_SETTLED`, `FEE_CAPTURED`, `PREDICTION_SCORED`.  
   - Desktop notifications ping watched auctions.  
   - Leaderboard updates: new bid count, expiring-soon removal, and Top Forecasters entry with points.

6. **(Optional) Trio Curve Showdown**  
   - Use the curve dropdown + **Create trio (compare curves)** to spawn linear/exponential/sigmoid auctions for a side-by-side price discovery story.

Share the fully-built Arcade narrative: Blitz intensity, predictions, fee sharing, and high-engagement UX.

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
