'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PermissionGate } from '@/lib/authz/PermissionGate'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './navItems'

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        const Icon = item.icon
        return (
          <PermissionGate key={item.href} action={item.action}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
                active && 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {item.label}
            </Link>
          </PermissionGate>
        )
      })}
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-6 md:flex">
      <SidebarNav />
    </aside>
  )
}
