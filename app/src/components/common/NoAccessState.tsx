import { SearchXIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { EmptyState } from './EmptyState'

export function NoAccessState({ children }: { children?: ReactNode }) {
  return (
    <EmptyState
      icon={SearchXIcon}
      title="Not found or you don't have access"
      description="This page may have been removed, or you may not have permission to view it."
    >
      {children}
    </EmptyState>
  )
}
