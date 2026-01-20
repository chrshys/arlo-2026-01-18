'use client'

import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Mail, Shield, AlertTriangle } from 'lucide-react'

type PermissionLevel = 'read' | 'read_draft' | 'read_draft_send'

interface GmailSettingsProps {
  isConnected: boolean
}

const PERMISSION_LEVELS: {
  value: PermissionLevel
  label: string
  description: string
  capabilities: string[]
}[] = [
  {
    value: 'read',
    label: 'Read Only',
    description: 'Arlo can read and search your emails',
    capabilities: ['Search emails', 'Read email content', 'View threads', 'List labels'],
  },
  {
    value: 'read_draft',
    label: 'Read + Draft',
    description: 'Arlo can also create draft emails for your review',
    capabilities: ['All read permissions', 'Create draft emails', 'Delete drafts'],
  },
  {
    value: 'read_draft_send',
    label: 'Read + Draft + Send',
    description: 'Arlo can send emails (with optional confirmation)',
    capabilities: [
      'All draft permissions',
      'Send emails',
      'Archive emails',
      'Manage labels',
      'Mark as read',
    ],
  },
]

export function GmailSettings({ isConnected }: GmailSettingsProps) {
  const integration = useQuery(api.integrations.getByProvider, { provider: 'gmail' })
  const setGmailSettings = useMutation(api.integrations.setGmailSettings)

  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState<PermissionLevel>('read_draft')
  const [requireConfirmation, setRequireConfirmation] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (integration) {
      setSelectedLevel(integration.gmailPermissionLevel || 'read_draft')
      setRequireConfirmation(integration.gmailRequireConfirmation !== false)
    }
  }, [integration])

  const handleLevelChange = async (level: PermissionLevel) => {
    setSelectedLevel(level)
    setSaving(true)
    try {
      await setGmailSettings({
        permissionLevel: level,
        requireConfirmation: level === 'read_draft_send' ? requireConfirmation : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmationChange = async (confirm: boolean) => {
    setRequireConfirmation(confirm)
    setSaving(true)
    try {
      await setGmailSettings({
        permissionLevel: selectedLevel,
        requireConfirmation: confirm,
      })
    } finally {
      setSaving(false)
    }
  }

  if (!isConnected) return null

  return (
    <div className="mt-4 border-t pt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">Gmail Permissions</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {PERMISSION_LEVELS.find((l) => l.value === selectedLevel)?.label}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Control what Arlo can do with your Gmail account
          </p>

          <div className="grid gap-2">
            {PERMISSION_LEVELS.map((level) => {
              const isSelected = selectedLevel === level.value
              return (
                <label
                  key={level.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                    isSelected
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border bg-transparent hover:bg-muted/50'
                  } ${saving ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <input
                    type="radio"
                    name="permission-level"
                    checked={isSelected}
                    onChange={() => handleLevelChange(level.value)}
                    disabled={saving}
                    className="mt-1 h-4 w-4 border-border"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {level.value === 'read' && <Mail className="h-4 w-4 text-muted-foreground" />}
                      {level.value === 'read_draft' && <Shield className="h-4 w-4 text-blue-500" />}
                      {level.value === 'read_draft_send' && (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                      <span className="text-sm font-medium">{level.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{level.description}</p>
                    <ul className="mt-2 space-y-1">
                      {level.capabilities.map((cap) => (
                        <li key={cap} className="text-xs text-muted-foreground">
                          • {cap}
                        </li>
                      ))}
                    </ul>
                  </div>
                </label>
              )
            })}
          </div>

          {selectedLevel === 'read_draft_send' && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={requireConfirmation}
                  onChange={(e) => handleConfirmationChange(e.target.checked)}
                  disabled={saving}
                  className="mt-1 h-4 w-4 rounded border-border"
                />
                <div>
                  <span className="text-sm font-medium">Require confirmation before sending</span>
                  <p className="text-xs text-muted-foreground">
                    {requireConfirmation
                      ? 'Arlo will create a draft and ask you to confirm before sending'
                      : 'Arlo can send emails directly without asking (use with caution)'}
                  </p>
                </div>
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
