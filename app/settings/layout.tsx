'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface SettingsLayoutProps {
  children: React.ReactNode
}

const navItems = [{ href: '/settings/activity', label: 'Activity' }]

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname()

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <aside className="w-52 border-r bg-gray-50 flex flex-col">
        <div className="p-4 border-b">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
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
                    ? 'bg-gray-200 text-gray-900 font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
