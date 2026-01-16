# Code Standards

This document defines the coding conventions for Arlo. AI assistants should follow these standards when writing code.

## TypeScript

### Strict Mode

- TypeScript strict mode is enabled. Never use `// @ts-ignore` or `// @ts-expect-error` without a comment explaining why.
- Never use `any`. Use `unknown` and narrow the type, or define a proper type.

### Naming

- **Variables/functions**: `camelCase`
- **Types/interfaces**: `PascalCase`
- **Constants**: `SCREAMING_SNAKE_CASE` for true constants, `camelCase` for derived values
- **Files**: `kebab-case.ts` for utilities, `PascalCase.tsx` for React components
- **Convex functions**: Match the export name to the file name when there's one primary export

### Types

- Prefer `interface` over `type` for object shapes (better error messages, extendable)
- Use `type` for unions, intersections, and mapped types
- Export types that are used across files
- Co-locate types with the code that uses them

## React

### Components

- Use function components with TypeScript
- Props interface named `{ComponentName}Props`
- Destructure props in the function signature
- One component per file (except small helper components)

```tsx
interface TaskItemProps {
  task: Task
  onComplete: (id: string) => void
}

export function TaskItem({ task, onComplete }: TaskItemProps) {
  // ...
}
```

### Hooks

- Custom hooks go in `hooks/` directory
- Name custom hooks with `use` prefix
- Return objects for multiple values (not arrays) for better readability

### State

- Keep state as local as possible
- Lift state up only when needed
- Use Convex queries/mutations for server state (not React state)

## Convex

### Queries & Mutations

- Use descriptive names: `listPending`, `createFromUI`, `completeTask`
- Always validate args with `v` validators
- Internal functions (called by other Convex functions) use `internalQuery`/`internalMutation`
- Public functions (called from client) use `query`/`mutation`

### Schema

- Define indexes for any field you filter/sort by
- Use `v.optional()` for nullable fields
- Add new fields as optional to maintain backwards compatibility

### Actions

- Use actions only when you need external API calls or non-deterministic operations
- Prefer mutations for database writes (they're transactional)
- Actions should call mutations for database operations, not write directly

## File Organization

```
/
├── app/                    # Next.js app router pages
├── components/             # React components
│   └── ui/                 # Generic UI components
├── convex/                 # Convex backend
│   ├── _generated/         # Auto-generated (don't edit)
│   ├── arlo/               # Arlo agent logic
│   └── schema.ts           # Database schema
├── hooks/                  # Custom React hooks
├── lib/                    # Shared utilities
├── __tests__/              # Test files
└── types/                  # Shared TypeScript types
```

## Testing

### Test Files

- Place tests in `__tests__/` directory or co-locate as `*.test.ts` next to the file
- Name test files to match the file they test: `tasks.test.ts` for `tasks.ts`

### Test Structure

```typescript
import { describe, it, expect } from 'vitest'

describe('functionName', () => {
  it('should describe expected behavior', () => {
    // Arrange
    // Act
    // Assert
  })
})
```

### What to Test

- Convex functions: Test the logic, mock the database
- Utility functions: Test input/output
- React components: Test user interactions and rendered output
- Skip testing: Simple pass-through components, generated code

## Error Handling

- Use early returns for guard clauses
- Throw descriptive errors with context
- In Convex, let errors propagate (the framework handles them)
- In React, use error boundaries for component errors

## Comments

- Don't add comments that restate the code
- Do add comments explaining "why" when the reason isn't obvious
- Use `TODO:` for planned improvements (include context)
- Use `HACK:` for temporary workarounds (include why and when to fix)

## Git Commits

- Write commits in imperative mood: "Add feature" not "Added feature"
- Keep commits focused on one change
- Reference issue numbers when applicable

## Performance

- Use Convex indexes for queries that filter/sort
- Avoid N+1 queries (batch related data fetches)
- Use `useMemo`/`useCallback` only when there's a measured performance issue
- Don't optimize prematurely

## Security

- Never log sensitive data (API keys, user data)
- Validate all user input on the server (Convex)
- Use Convex auth for authentication when added
- Don't expose internal IDs unnecessarily
