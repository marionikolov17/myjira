'use client'

import { KanbanSquareIcon, ListIcon, SettingsIcon, UsersIcon, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCan } from '@/lib/authz/useCan'
import { cn } from '@/lib/utils'

type Tab = { segment: string; label: string; icon: LucideIcon }

const TABS: Tab[] = [
  { segment: 'board', label: 'Board', icon: KanbanSquareIcon },
  { segment: 'issues', label: 'Issues', icon: ListIcon },
  { segment: 'members', label: 'Members', icon: UsersIcon },
  { segment: 'settings', label: 'Settings', icon: SettingsIcon },
]

export function ProjectSubNav({ projectId }: { projectId: string }) {
  const pathname = usePathname()
  const canUpdate = useCan('projects.update', { projectId })
  const canDelete = useCan('projects.delete', { projectId })
  const tabs = TABS.filter((tab) => tab.segment !== 'settings' || canUpdate || canDelete)

  return (
    <nav aria-label="Project sections" className="-mx-1 overflow-x-auto border-b">
      <ul className="flex min-w-max gap-1 px-1">
        {tabs.map((tab) => {
          const href = `/projects/${projectId}/${tab.segment}`
          const active = pathname === href || pathname.startsWith(`${href}/`)
          const Icon = tab.icon
          return (
            <li key={tab.segment}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 rounded-t-lg',
                  active
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
