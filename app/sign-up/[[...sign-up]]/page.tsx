'use client'

import { SignUp } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { useTheme } from 'next-themes'

export default function SignUpPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignUp
        appearance={{
          baseTheme: isDark ? dark : undefined,
          variables: {
            colorPrimary: isDark ? 'hsl(0 0% 98%)' : 'hsl(0 0% 9%)',
            colorBackground: isDark ? 'hsl(0 0% 3.9%)' : 'hsl(0 0% 100%)',
            colorText: isDark ? 'hsl(0 0% 98%)' : 'hsl(0 0% 3.9%)',
            colorTextSecondary: isDark ? 'hsl(0 0% 63.9%)' : 'hsl(0 0% 45.1%)',
            colorInputBackground: isDark ? 'hsl(0 0% 3.9%)' : 'hsl(0 0% 100%)',
            colorInputText: isDark ? 'hsl(0 0% 98%)' : 'hsl(0 0% 3.9%)',
            borderRadius: '0.5rem',
          },
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-md border border-border bg-card',
            headerTitle: 'text-foreground',
            headerSubtitle: 'text-muted-foreground',
            socialButtonsBlockButton:
              'border border-input bg-background hover:bg-accent text-foreground',
            socialButtonsBlockButtonText: 'text-foreground font-normal',
            dividerLine: 'bg-border',
            dividerText: 'text-muted-foreground',
            formFieldLabel: 'text-foreground',
            formFieldInput:
              'border border-input bg-background text-foreground focus:ring-ring focus:border-ring',
            formButtonPrimary: 'bg-primary text-primary-foreground hover:bg-primary/90',
            footerActionLink: 'text-primary hover:text-primary/90',
            identityPreviewText: 'text-foreground',
            identityPreviewEditButton: 'text-primary',
          },
        }}
      />
    </div>
  )
}
