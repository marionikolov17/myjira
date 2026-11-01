'use client';

import { useDraggable } from '@dnd-kit/core';
import { GripVerticalIcon } from 'lucide-react';
import Link from 'next/link';
import { PriorityIcon } from '@/components/common/PriorityBadge';
import { UserAvatar } from '@/components/common/UserAvatar';
import type { Issue } from '@/lib/api/schemas';
import { shortIssueId } from '@/lib/format';
import { cn } from '@/lib/utils';

type BoardCardProps = { issue: Issue; draggable: boolean; overlay?: boolean };

export function BoardCardBody({ issue, overlay = false }: { issue: Issue; overlay?: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border bg-card p-3 text-card-foreground shadow-xs',
        overlay && 'rotate-1 shadow-lg ring-2 ring-primary/40',
      )}
    >
      <Link
        href={`/projects/${issue.projectId}/issues/${issue.id}`}
        className="line-clamp-3 text-sm font-medium outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
        draggable={false}
      >
        {issue.title}
      </Link>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{shortIssueId(issue.id)}</span>
        <div className="flex items-center gap-2">
          <PriorityIcon priority={issue.priority} />
          <UserAvatar user={issue.assignee} size="sm" />
        </div>
      </div>
    </div>
  );
}

export function BoardCard({ issue, draggable }: BoardCardProps) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: issue.id,
    data: { issue },
    disabled: !draggable,
  });

  // Pointer sensors activate from the whole card; keyboard activation lives on the handle so
  // Enter on the title link still navigates instead of starting a drag.
  const { onKeyDown, ...pointerListeners } = (listeners ?? {}) as Record<
    string,
    (event: React.SyntheticEvent) => void
  >;

  return (
    <li
      ref={setNodeRef}
      {...pointerListeners}
      className={cn(
        'group relative',
        draggable && 'cursor-grab touch-manipulation',
        isDragging && 'opacity-40',
      )}
    >
      <BoardCardBody issue={issue} />
      {draggable && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          onKeyDown={onKeyDown}
          aria-label={`Move ${issue.title}`}
          aria-roledescription="draggable issue"
          className="absolute top-2 right-1.5 z-10 rounded-md p-0.5 text-muted-foreground opacity-0 outline-none transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <GripVerticalIcon className="size-4" aria-hidden="true" />
        </button>
      )}
    </li>
  );
}
