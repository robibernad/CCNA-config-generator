import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CCNA Network Config Generator',
  description: 'Visual configuration tool for Cisco network devices',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-200 px-6 py-4">
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <h1 className="text-xl font-bold text-slate-800">
                  🌐 CCNA Network Config Generator
                </h1>
                <span className="text-sm text-slate-500">
                  Visual Cisco IOS Configuration
                </span>
              </div>
            </header>
            <main className="max-w-7xl mx-auto p-6">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
