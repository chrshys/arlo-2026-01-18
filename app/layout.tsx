import type { Metadata } from 'next'
import './globals.css'
import { ConvexClientProvider } from '@/components/ConvexProvider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { PanelLayoutProvider } from '@/components/providers/panel-layout-provider'

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
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <ConvexClientProvider>
            <PanelLayoutProvider>{children}</PanelLayoutProvider>
          </ConvexClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
