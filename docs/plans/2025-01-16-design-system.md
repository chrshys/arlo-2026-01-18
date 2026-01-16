# Design System Setup

## Overview

Establish a design system foundation using Tailwind CSS, shadcn/ui, and dark/light mode support.

## Decisions

- **UI library:** shadcn/ui (component registry, not a dependency)
- **Color scheme:** shadcn defaults (zinc-based neutral palette), customize later
- **Dark mode strategy:** System preference with manual override in settings
- **Tailwind dark mode:** `class` strategy (controlled by next-themes)
- **Migration approach:** Gradual — existing components stay as-is, new components use CSS variables

## Architecture

```
components/
  ui/                    # shadcn components (button, select, etc.)
  providers/
    theme-provider.tsx   # next-themes wrapper
lib/
  utils.ts               # cn() utility for class merging
```

## Theme Provider

Using `next-themes` for:

- System preference detection
- localStorage persistence of user choice
- SSR-safe (no flash of wrong theme)
- Applies `dark` class to `<html>`

Layout structure:

```tsx
<html lang="en" suppressHydrationWarning>
  <body>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ConvexClientProvider>{children}</ConvexClientProvider>
    </ThemeProvider>
  </body>
</html>
```

## Settings Toggle

Theme selector in `/settings` using shadcn Select component:

- Light
- Dark
- System (default)

## CSS Variables

shadcn uses CSS custom properties that automatically switch between light/dark:

```css
/* Light mode */
--background: 0 0% 100%;
--foreground: 240 10% 3.9%;

/* Dark mode (when .dark class present) */
.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
}
```

Use these in components: `bg-background`, `text-foreground`, `bg-primary`, etc.

## Adding Components

Pull components as needed:

```bash
npx shadcn@latest add button
npx shadcn@latest add select
npx shadcn@latest add card
# etc.
```

Components are copied into `components/ui/` — you own the code and can modify it.

## Migration Path

Existing components use hardcoded colors (`bg-gray-100`, `bg-blue-500`). These will:

1. Continue working in light mode
2. Be gradually replaced as we rebuild with shadcn primitives
3. No need to add dark: variants to code we're replacing
