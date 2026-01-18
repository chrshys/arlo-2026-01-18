import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignUp
        appearance={{
          variables: {
            colorPrimary: 'hsl(0 0% 9%)',
            colorBackground: 'hsl(0 0% 100%)',
            colorText: 'hsl(0 0% 3.9%)',
            colorTextSecondary: 'hsl(0 0% 45.1%)',
            colorInputBackground: 'hsl(0 0% 100%)',
            colorInputText: 'hsl(0 0% 3.9%)',
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
