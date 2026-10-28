import { Spinner } from '@/components/ui/spinner'

export function FullScreenLoader({ label = 'Loading your workspace' }: { label?: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 text-muted-foreground" role="status">
      <Spinner className="size-6" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
