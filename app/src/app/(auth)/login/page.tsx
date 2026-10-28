'use client'

import { KanbanSquareIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuthHydrated } from '@/components/layout/useAuthHydrated'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { useAuthStore } from '@/stores/authStore'

export default function LoginPage() {
  const router = useRouter()
  const hydrated = useAuthHydrated()
  const status = useAuthStore((state) => state.status)

  useEffect(() => {
    if (hydrated && status === 'authenticated') router.replace('/dashboard')
  }, [hydrated, status, router])

  return (
    <main className="relative flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center justify-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KanbanSquareIcon aria-hidden="true" className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">MyJira</span>
        </div>
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to your workspace to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
