# AutoList — Doma Protocol (Track 1)

Minimal Next.js + TypeScript + Tailwind scaffold that wires Doma Subgraph querying into a UI, with API stubs for creating a Dutch auction listing and for settlement via a relayer.

## Stack

- Next.js (App Router) + TypeScript + TailwindCSS
- Ethers v6 for MetaMask wallet connect
- Doma integration stubs:
  - Subgraph (configurable endpoint)
  - Orderbook SDK stub call for listings
  - Settlement relayer stub (to be triggered by Poll API)

## Quick start

1) Clone repo and install deps

```bash
npm install
# or: pnpm install / yarn install
```

2) Configure environment

Copy `.env.local.example` to `.env.local` and set your endpoints:

```bash
cp .env.local.example .env.local
# Edit .env.local and set NEXT_PUBLIC_DOMA_SUBGRAPH_URL
```

3) Run dev server

```bash
npm run dev
```

Visit http://localhost:3000.

## Doma integration

- Subgraph: `lib/subgraph.ts` contains a simple GraphQL POST helper `fetchSubgraphDomains()`. Adjust the query/fields per Doma's schema.
- Listing API stub: `app/api/listing/route.ts` shows where to integrate `@doma-protocol/orderbook-sdk` (Dutch auction w/ reserve).
- Settlement stub: `app/api/settlement/route.ts` for a relayer to finalize auctions. Wire this to Doma Poll API/Subgraph events and use Ethers to submit txs.

## Files of interest

- UI components: `components/WalletConnect.tsx`, `components/DomainList.tsx`
- Env config: `.env.local` (see `.env.local.example`)
- Tailwind config: `tailwind.config.js`, `app/globals.css`

## Next steps (MVP)

- Replace listing stub with real calls via `@doma-protocol/orderbook-sdk` (Seaport under the hood).
- Use Doma Subgraph to filter by ownership and show actual tokenized domains.
- Implement sealed-bid or Dutch auction params (reserve price, start/end).
- Implement a serverless relayer using Doma Poll API to drive settlement.
- Log and surface testnet tx hashes + subgraph links for judging.

## Notes

- This scaffold avoids adding the Orderbook SDK dependency by default so the app runs without it. Once ready, install it and replace the stub logic.
