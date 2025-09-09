import WalletConnect from '@/components/WalletConnect'
import DomainList from '@/components/DomainList'

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Domains</h2>
          <p className="text-sm text-gray-500">Fetched from Doma Subgraph</p>
        </div>
        <WalletConnect />
      </div>
      <DomainList />
    </div>
  )
}
