'use client'

interface ActivityItem {
  _id: string
  _creationTime: number
  model: string | undefined
  threadId: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  } | null
  cost: string | null
}

interface ActivityTableProps {
  items: ActivityItem[]
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatModel(model: string | undefined): string {
  if (!model) return '-'
  // Strip provider prefix (e.g., "anthropic/claude-sonnet-4" -> "claude-sonnet-4")
  const parts = model.split('/')
  return parts[parts.length - 1]
}

function formatTokens(usage: ActivityItem['usage']): string {
  if (!usage) return '-'
  return `${usage.promptTokens} → ${usage.completionTokens}`
}

function formatCost(cost: string | null): string {
  if (!cost) return '-'
  const num = parseFloat(cost)
  return `$${num.toFixed(4)}`
}

function truncateId(id: string): string {
  return id.slice(0, 8) + '...'
}

export function ActivityTable({ items }: ActivityTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground border-b border-border">
            <th className="pb-3 font-medium">Timestamp</th>
            <th className="pb-3 font-medium">Model</th>
            <th className="pb-3 font-medium">Thread</th>
            <th className="pb-3 font-medium">Tokens</th>
            <th className="pb-3 font-medium text-right">Cost</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item._id} className="border-b border-border hover:bg-muted/50">
              <td className="py-3 text-muted-foreground">{formatTimestamp(item._creationTime)}</td>
              <td className="py-3">
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  {formatModel(item.model)}
                </code>
              </td>
              <td className="py-3">
                <span className="text-muted-foreground font-mono text-xs">
                  {truncateId(item.threadId)}
                </span>
              </td>
              <td className="py-3 text-muted-foreground">{formatTokens(item.usage)}</td>
              <td className="py-3 text-right font-mono">{formatCost(item.cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
