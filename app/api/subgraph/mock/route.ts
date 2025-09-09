import { NextResponse } from 'next/server'

// Simple mock of the Doma subgraph "names" query shape
// Returns items with nested tokens so our existing mapper can flatten
export async function POST() {
  return NextResponse.json({
    data: {
      names: {
        items: [
          {
            name: 'alice.doma',
            tokens: [
              { id: '1', tokenId: '1', owner: { id: '0xAbC000000000000000000000000000000000AbC0' } }
            ]
          },
          {
            name: 'bob.doma',
            tokens: [
              { id: '2', tokenId: '2', owner: { id: '0xDef000000000000000000000000000000000Def0' } }
            ]
          }
        ]
      }
    }
  })
}

export async function GET() {
  // Allow quick testing via GET as well
  return POST()
}
