export async function fetchSubgraphDomains(): Promise<any> {
  const url = process.env.NEXT_PUBLIC_DOMA_SUBGRAPH_URL
  // Try multiple query shapes to accommodate schema variations
  const baseHeaders: Record<string, string> = { 'content-type': 'application/json' }
  const apiKey = process.env.NEXT_PUBLIC_DOMA_SUBGRAPH_API_KEY
  if (apiKey) baseHeaders['x-api-key'] = apiKey
  let json: any = null
  let ok = false
  // If subgraph URL is not set, fallback to mock route
  if (!url) {
    try {
      const mockRes = await fetch('/api/subgraph/mock', { method: 'POST' })
      json = await mockRes.json()
      ok = true
      console.log('Using mock subgraph: URL not set')
    } catch (e) {
      throw new Error('Subgraph URL not set and mock fallback failed')
    }
  }
  const queries = [
    // Based on errors, `names` returns `PaginatedNamesResponse` and `items` are `NameModel`.
    // `NameModel` likely exposes `tokens`, which in turn have `tokenId` and `owner`.
    {
      name: 'items.tokens.tokenId',
      query: `
        query ListNamesTokens {
          names {
            items {
              tokens {
                tokenId
              }
            }
          }
        }`
    },
    // Minimal variant to discover structure even if owner/tokenId differ
    {
      name: 'items.nameOnly',
      query: `
        query ListNamesNameOnly {
          names {
            items {
              name
            }
          }
        }`
    },
    {
      name: 'items.basic',
      query: `
        query ListNamesBasic {
          names {
            items {
              id
              name
            }
          }
        }`
    }
  ] as const

  const errors: string[] = []

  if (!ok && url) {
    for (const q of queries) {
      if (ok) break
      const res = await fetch(url, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ query: q.query })
      })
      if (!res.ok) {
        const text = await res.text()
        console.log('Subgraph error response:', text)
        errors.push(`${q.name}: HTTP ${res.status} ${text}`)
        continue
      }
      const j = await res.json()
      if (j?.errors) {
        console.log('Subgraph response (GraphQL errors):', JSON.stringify(j, null, 2))
        errors.push(`${q.name}: ${JSON.stringify(j.errors)}`)
        continue
      }
      console.log('Subgraph response:', JSON.stringify(j, null, 2))
      json = j
      ok = true
      break
    }
  }
  
  // If all shapes failed, try mock when unauthorized/missing key
  if (!ok) {
    const combined = errors.join(' | ')
    const looksUnauthorized = /401|UNAUTHENTICATED|api key is missing/i.test(combined)
    if (looksUnauthorized) {
      try {
        const mockRes = await fetch('/api/subgraph/mock', { method: 'POST' })
        json = await mockRes.json()
        ok = true
        console.log('Using mock subgraph: unauthorized or missing API key')
      } catch (e) {
        // proceed to introspection/throw
      }
    }
  }

  // If still not ok, introspect schema and throw
  if (!ok) {
    if (!url) {
      throw new Error(`Subgraph query failed and URL is not set. Tried shapes: ${errors.join(' | ')}`)
    }
    const introspectionQuery = `
      query IntrospectionQuery {
        tokenModel: __type(name: "TokenModel") {
          name
          fields { name type { name kind ofType { name kind } } }
        }
        nameModel: __type(name: "NameModel") {
          name
          fields { name type { name kind ofType { name kind } } }
        }
        namesResp: __type(name: "PaginatedNamesResponse") {
          name
          fields { name type { name kind ofType { name kind } } }
        }
      }
          fields {
            name
            type {
              name
              kind
              ofType {
                name
                kind
              }
            }
          }
        }
        __type(name: "NameModel") {
          name
          fields {
            name
            type {
              name
              kind
              ofType {
                name
                kind
              }
            }
          }
        }
        __type(name: "PaginatedNamesResponse") {
          name
          fields {
            name
            type {
              name
              kind
              ofType {
                name
                kind
              }
            }
          }
        }
        __schema {
          types {
            name
            kind
          }
        }
      }
    `
    const introspectionRes = await fetch(url, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ query: introspectionQuery })
    })
    if (introspectionRes.ok) {
      const introspectionJson = await introspectionRes.json()
      console.log('Subgraph schema:', JSON.stringify(introspectionJson, null, 2))
    } else {
      console.log('Introspection error:', await introspectionRes.text())
    }
    throw new Error(`Subgraph query failed. Tried shapes: ${errors.join(' | ')}`)
  }

  if (json?.data?.names) {
    const d = json.data.names as any
    // Flatten tokens under each item if present (items.tokens shape)
    if (Array.isArray(d?.items) && d.items.some((it: any) => Array.isArray(it?.tokens))) {
      const results: any[] = []
      for (const item of d.items as any[]) {
        const nameStr = item?.label ?? item?.name ?? item?.value
        const tokens = Array.isArray(item?.tokens) ? item.tokens : []
        for (const t of tokens) {
          results.push({
            id: t?.id ?? t?.tokenId ?? undefined,
            name: nameStr,
            tokenId: t?.tokenId ?? t?.id ?? undefined,
            owner: t?.owner?.id ?? t?.ownerAddress ?? t?.holder?.id ?? t?.account?.id ?? undefined
          })
        }
      }
      return results
    }

    let arr: any[] = []
    if (d?.edges) arr = (d.edges as any[]).map((e: any) => e?.node).filter(Boolean)
    else if (d?.nodes) arr = d.nodes as any[]
    else if (Array.isArray(d)) arr = d as any[]
    else if (d?.items) arr = d.items as any[]
    return arr.map((n: any) => ({
      id: n?.id,
      name: n?.labelName ?? n?.name ?? n?.label ?? n?.value,
      tokenId: n?.tokenId ?? n?.token?.id ?? undefined,
      owner: n?.owner?.id ?? n?.ownerAddress ?? n?.holder?.id ?? n?.account?.id ?? undefined
    }))
  } else {
    return []
  }
}
