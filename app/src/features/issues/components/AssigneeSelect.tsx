'use client'

import { UserAvatar } from '@/components/common/UserAvatar'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProjectMembers } from '@/features/members/queries'
import type { UserRef } from '@/lib/api/schemas'
import { UNASSIGNED } from '../schemas'

type AssigneeSelectProps = {
  projectId: string
  value: UserRef | null
  onChange: (assignee: UserRef | null) => void
  disabled?: boolean
  id?: string
  className?: string
  invalid?: boolean
}

export function AssigneeSelect({ projectId, value, onChange, disabled, id, className, invalid }: AssigneeSelectProps) {
  const { data: members = [], isLoading } = useProjectMembers(projectId)
  const users = members.map((member) => member.user)
  // Keep the current assignee selectable even if they've since left the project.
  if (value && !users.some((user) => user.id === value.id)) users.unshift(value)

  const items = [
    { value: UNASSIGNED, label: 'Unassigned' },
    ...users.map((user) => ({ value: user.id, label: user.name })),
  ]

  return (
    <Select
      items={items}
      value={value?.id ?? UNASSIGNED}
      onValueChange={(next) => {
        if (next === null || next === (value?.id ?? UNASSIGNED)) return
        onChange(next === UNASSIGNED ? null : (users.find((user) => user.id === next) ?? null))
      }}
      disabled={disabled || isLoading}
    >
      <SelectTrigger id={id} className={className} aria-label="Assignee" aria-invalid={invalid || undefined}>
        <UserAvatar user={value} size="sm" decorative />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={UNASSIGNED}>
            <UserAvatar user={null} size="sm" decorative />
            Unassigned
          </SelectItem>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              <UserAvatar user={user} size="sm" decorative />
              {user.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
