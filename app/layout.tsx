import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { KnowledgeGraphProvider } from '@/context/KnowledgeGraphContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Knowledge Graph MCP',
  description: 'AI Memory Context Protocol',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-950 text-gray-100`}>
        <KnowledgeGraphProvider>
          {children}
        </KnowledgeGraphProvider>
      </body>
    </html>
  )
}