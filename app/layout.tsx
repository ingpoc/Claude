import React from 'react';
import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cn } from '../lib/utils'
import Sidebar from '../components/Sidebar';

// Assuming you will create a Sidebar component later
// import Sidebar from '@/components/Sidebar'; 

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

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
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          inter.variable
        )}
      >
        <div className="flex min-h-screen">
          {/* Placeholder for Sidebar - uncomment import and component when ready */}
          <Sidebar className="w-16 hidden md:block" />
          <main className="flex-1 p-4 md:p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}