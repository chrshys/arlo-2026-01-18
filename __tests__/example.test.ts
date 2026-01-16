import { describe, it, expect } from 'vitest'

describe('Example test suite', () => {
  it('should pass a basic assertion', () => {
    expect(1 + 1).toBe(2)
  })

  it('should handle string comparisons', () => {
    expect('hello').toBe('hello')
  })
})
