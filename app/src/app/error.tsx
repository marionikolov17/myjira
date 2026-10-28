'use client'

import { ErrorState } from '@/components/common/ErrorState'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <ErrorState error={error} onRetry={reset} />
    </main>
  )
}
