'use client'

import { UserAvatar } from '@/components/common/UserAvatar'
import { Skeleton } from '@/components/ui/skeleton'
import { useProjectMembers } from '@/features/members/queries'

const MAX_VISIBLE = 5

export function MemberAvatarStack({ projectId }: { projectId: string }) {
  const { data: members, isLoading } = useProjectMembers(projectId)

  if (isLoading) return <Skeleton className="h-7 w-28 rounded-full" />
  if (!members?.length) return <span className="text-xs text-muted-foreground">No members</span>

  const visible = members.slice(0, MAX_VISIBLE)
  const overflow = members.length - visible.length

  return (
    <div className="flex items-center" aria-label={`${members.length} members`}>
      <div className="flex -space-x-2">
        {visible.map((member) => (
          <UserAvatar key={member.id} user={member.user} className="ring-2 ring-card" />
        ))}
      </div>
      {overflow > 0 && <span className="ml-2 text-xs font-medium text-muted-foreground">+{overflow}</span>}
    </div>
  )
}
