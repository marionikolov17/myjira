'use client'

import { RoleBadge } from '@/components/common/RoleBadge'
import { Separator } from '@/components/ui/separator'
import { demoCredentials } from '@/lib/api/client/auth'

export function DemoAccounts({ onPick }: { onPick: (email: string, password: string) => void }) {
  if (!demoCredentials) return null
  const { accounts, password } = demoCredentials

  return (
    <section aria-labelledby="demo-accounts" className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <h2 id="demo-accounts" className="text-xs font-medium text-muted-foreground">
          Demo accounts
        </h2>
        <Separator className="flex-1" />
      </div>
      <ul className="flex flex-col gap-1.5">
        {accounts.map((account) => (
          <li key={account.email}>
            <button
              type="button"
              onClick={() => onPick(account.email, password)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{account.name}</span>
                <span className="truncate text-xs text-muted-foreground">{account.email}</span>
              </span>
              <RoleBadge scope="workspace" role={account.role} />
            </button>
          </li>
        ))}
      </ul>
      <p className="text-center text-xs text-muted-foreground">
        {'Password for every account: '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono">{password}</code>
      </p>
    </section>
  )
}
