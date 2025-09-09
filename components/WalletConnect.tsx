"use client"
import { useEffect, useState } from 'react'
import { ethers } from 'ethers'

export default function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null)
  const [network, setNetwork] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const targetChainIdHex = process.env.NEXT_PUBLIC_DOMA_CHAIN_ID
  const targetChainId = (() => {
    try { return targetChainIdHex ? BigInt(targetChainIdHex) : null } catch { return null }
  })()
  const chainName = process.env.NEXT_PUBLIC_DOMA_CHAIN_NAME || 'Doma Testnet'
  const rpcUrl = process.env.NEXT_PUBLIC_DOMA_RPC_URL
  const currencySymbol = process.env.NEXT_PUBLIC_DOMA_CURRENCY_SYMBOL || 'DOMA'
  const explorerUrl = process.env.NEXT_PUBLIC_DOMA_EXPLORER_URL

  async function ensureNetwork(provider: ethers.BrowserProvider) {
    if (!targetChainIdHex) return // nothing to enforce
    const eth = (window as any).ethereum
    if (!eth) return
    const net = await provider.getNetwork()
    if (targetChainId && net.chainId === targetChainId) return
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetChainIdHex }]
      })
    } catch (e: any) {
      // 4902 = chain not added
      if (e?.code === 4902 && rpcUrl) {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: targetChainIdHex,
            chainName,
            nativeCurrency: { name: currencySymbol, symbol: currencySymbol, decimals: 18 },
            rpcUrls: [rpcUrl],
            blockExplorerUrls: explorerUrl ? [explorerUrl] : []
          }]
        })
        await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: targetChainIdHex }] })
      } else {
        throw e
      }
    }
  }

  async function connect() {
    try {
      setError(null)
      if (!(window as any).ethereum) {
        setError('MetaMask not found. Install it to connect.')
        return
      }
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      await provider.send('eth_requestAccounts', [])
      const signer = await provider.getSigner()
      const addr = await signer.getAddress()
      // Ensure correct network if configured
      await ensureNetwork(provider)
      const net = await provider.getNetwork()
      setAddress(addr)
      setNetwork(net.name || `chainId ${net.chainId}`)
    } catch (e: any) {
      setError(e?.message || 'Failed to connect')
    }
  }

  useEffect(() => {
    const eth = (window as any).ethereum
    if (!eth) return
    const handler = (accounts: string[]) => {
      setAddress(accounts?.[0] ?? null)
    }
    eth.on?.('accountsChanged', handler)
    const chainHandler = async (_chainIdHex: string) => {
      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum)
        const net = await provider.getNetwork()
        setNetwork(net.name || `chainId ${net.chainId}`)
      } catch {}
    }
    eth.on?.('chainChanged', chainHandler)
    return () => {
      eth.removeListener?.('accountsChanged', handler)
      eth.removeListener?.('chainChanged', chainHandler)
    }
  }, [])

  return (
    <div className="flex items-center gap-3">
      {address ? (
        <div className="text-sm">
          <div className="font-mono">{address.slice(0, 6)}…{address.slice(-4)}</div>
          <div className="text-gray-500">{network ?? ''}</div>
        </div>
      ) : (
        <button onClick={connect} className="px-3 py-1.5 rounded bg-black text-white text-sm">Connect Wallet</button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
