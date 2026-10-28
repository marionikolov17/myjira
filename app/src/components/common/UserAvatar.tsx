import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getInitials } from '@/lib/format'

type UserAvatarProps = {
  user: { name: string } | null | undefined
  size?: 'sm' | 'default' | 'lg'
  className?: string
  decorative?: boolean
}

export function UserAvatar({ user, size = 'default', className, decorative = false }: UserAvatarProps) {
  const label = user ? user.name : 'Unassigned'
  return (
    <Avatar size={size} className={className} aria-hidden={decorative || undefined} title={decorative ? undefined : label}>
      <AvatarFallback className="bg-accent text-[0.6875rem] font-medium text-accent-foreground">
        {user ? getInitials(user.name) : '–'}
        {!decorative && <span className="sr-only">{label}</span>}
      </AvatarFallback>
    </Avatar>
  )
}

type UserIdentityProps = {
  user: { name: string; email: string }
  size?: 'sm' | 'default' | 'lg'
}

export function UserIdentity({ user, size = 'default' }: UserIdentityProps) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar user={user} size={size} decorative />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{user.name}</span>
        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
      </div>
    </div>
  )
}
