'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface SettingsLayoutProps {
  children: React.ReactNode
}

const navItems = [
  { href: '/settings/activity', label: 'Activity' },
  { href: '/settings/appearance', label: 'Appearance' },
]

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname()

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <aside className="w-52 border-r border-border bg-muted/40 flex flex-col">
        <div className="p-4 border-b border-border">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Back to Arlo
          </Link>
        </div>
        <nav className="p-2 flex-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 rounded text-sm ${
                  isActive
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
