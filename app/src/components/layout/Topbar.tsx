'use client'

import { KanbanSquareIcon, MenuIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { WORKSPACE_NAME } from './navItems'
import { SidebarNav } from './Sidebar'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <KanbanSquareIcon aria-hidden="true" className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-sm font-semibold">MyJira</span>
        <span className="truncate text-xs text-muted-foreground">{WORKSPACE_NAME}</span>
      </span>
    </Link>
  )
}

export function Topbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md md:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation" />}>
          <MenuIcon aria-hidden="true" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72">
          <SheetHeader>
            <SheetTitle>MyJira</SheetTitle>
            <SheetDescription>{WORKSPACE_NAME}</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <Brand />
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
