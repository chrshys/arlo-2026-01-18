'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function AppearancePage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch by only rendering theme UI after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Appearance</h1>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Theme</label>
            <div className="w-48 h-10 bg-muted animate-pulse rounded-md" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Appearance</h1>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Theme</label>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose how Arlo looks. System will match your device settings.
          </p>
        </div>
      </div>
    </div>
  )
}
