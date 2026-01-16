import type { Metadata } from 'next'
import './globals.css'
import { ConvexClientProvider } from '@/components/ConvexProvider'

export const metadata: Metadata = {
  title: 'Arlo',
  description: 'Your personal AI assistant',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  )
}
