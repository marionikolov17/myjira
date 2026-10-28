'use client'

import { useDroppable } from '@dnd-kit/core'
import { PlusIcon } from 'lucide-react'
import { StatusIcon } from '@/components/common/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ISSUE_STATUS_LABELS, type Issue, type IssueStatus } from '@/lib/api/schemas'
import { cn } from '@/lib/utils'
import { BoardCard } from './BoardCard'

type BoardColumnProps = {
  status: IssueStatus
  issues: Issue[]
  isLoading: boolean
  canDrag: boolean
  canCreate: boolean
  onCreate: (status: IssueStatus) => void
}

export function BoardColumn({ status, issues, isLoading, canDrag, canCreate, onCreate }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const label = ISSUE_STATUS_LABELS[status]
  const headingId = `board-column-${status}`

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={cn(
        'flex min-h-64 flex-col gap-3 rounded-2xl bg-muted/60 p-3 transition-colors',
        isOver && 'bg-accent ring-2 ring-primary/30',
      )}
    >
      <header className="flex items-center justify-between gap-2 px-1">
        <h2 id={headingId} className="flex items-center gap-2 text-sm font-semibold">
          <StatusIcon status={status} className="size-4 text-muted-foreground" />
          {label}
          <Badge variant="secondary" className="tabular-nums">
            {isLoading ? '–' : issues.length}
          </Badge>
        </h2>
        {canCreate && (
          <Button variant="ghost" size="icon-sm" onClick={() => onCreate(status)} aria-label={`New issue in ${label}`}>
            <PlusIcon />
          </Button>
        )}
      </header>
      <ul className="flex flex-1 flex-col gap-2">
        {isLoading
          ? Array.from({ length: 3 }, (_, index) => (
              <li key={index}>
                <Skeleton className="h-20 rounded-xl" />
              </li>
            ))
          : issues.map((issue) => <BoardCard key={issue.id} issue={issue} draggable={canDrag} />)}
        {!isLoading && issues.length === 0 && (
          <li className="flex flex-1 items-center justify-center rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
            {canDrag ? 'Drop issues here' : 'No issues'}
          </li>
        )}
      </ul>
    </section>
  )
}
