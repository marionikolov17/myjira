import Link from 'next/link'
import { NoAccessState } from '@/components/common/NoAccessState'
import { buttonVariants } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <NoAccessState>
        <Link href="/dashboard" className={buttonVariants({ variant: 'outline' })}>
          Back to dashboard
        </Link>
      </NoAccessState>
    </main>
  )
}
