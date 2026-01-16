import { describe, it, expect } from 'vitest'
import { formatCost, formatModel, formatTokens, truncateId } from '../components/ActivityTable'

describe('ActivityTable helpers', () => {
  it('formats model names by stripping provider', () => {
    expect(formatModel('anthropic/claude-sonnet-4')).toBe('claude-sonnet-4')
    expect(formatModel(undefined)).toBe('-')
  })

  it('formats token usage as prompt → completion', () => {
    expect(
      formatTokens({
        promptTokens: 12,
        completionTokens: 34,
        totalTokens: 46,
      })
    ).toBe('12 → 34')
    expect(formatTokens(null)).toBe('-')
  })

  it('formats cost with 4 decimals', () => {
    expect(formatCost('0.0001234')).toBe('$0.0001')
    expect(formatCost(null)).toBe('-')
  })

  it('truncates ids for display', () => {
    expect(truncateId('abcdef123456')).toBe('abcdef12...')
  })
})
