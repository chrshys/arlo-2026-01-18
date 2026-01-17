import type { Metadata } from 'next'
import './globals.css'
import { ConvexClientProvider } from '@/components/ConvexProvider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { PanelLayoutProvider } from '@/components/providers/panel-layout-provider'
import { AppModeProvider } from '@/components/providers/app-mode-provider'

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
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <ConvexClientProvider>
            <AppModeProvider>
              <PanelLayoutProvider>{children}</PanelLayoutProvider>
            </AppModeProvider>
          </ConvexClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
