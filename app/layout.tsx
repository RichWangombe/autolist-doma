import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AutoList Doma',
  description: 'List domains and run auctions on Doma'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <header className="border-b bg-white">
            <div className="max-w-5xl mx-auto p-4 flex items-center justify-between">
              <h1 className="font-semibold"><a href="/">AutoList Doma</a></h1>
              <nav className="flex items-center gap-4 text-sm">
                <a href="/auctions" className="hover:underline">Auctions</a>
              </nav>
            </div>
          </header>
          <main className="max-w-5xl mx-auto p-4">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
