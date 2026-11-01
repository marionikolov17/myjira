'use client';

import { UserAvatar } from '@/components/common/UserAvatar';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjectMembers } from '@/features/members/queries';
import type { UserRef } from '@/lib/api/schemas';

type AssigneeSelectProps = {
  projectId: string;
  value: UserRef;
  onChange: (assignee: UserRef) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  invalid?: boolean;
};

/** Picks a project member as the issue's assignee. Issues are always assigned. */
export function AssigneeSelect({
  projectId,
  value,
  onChange,
  disabled,
  id,
  className,
  invalid,
}: AssigneeSelectProps) {
  const { data: members = [], isLoading } = useProjectMembers(projectId);
  const users = members.map((member) => member.user);
  // Keep the current assignee selectable even if they've since left the project.
  if (!users.some((user) => user.id === value.id)) users.unshift(value);

  const items = users.map((user) => ({ value: user.id, label: user.name }));

  return (
    <Select
      items={items}
      value={value.id}
      onValueChange={(next) => {
        if (next === null || next === value.id) return;
        const user = users.find((candidate) => candidate.id === next);
        if (user) onChange(user);
      }}
      disabled={disabled || isLoading}
    >
      <SelectTrigger
        id={id}
        className={className}
        aria-label="Assignee"
        aria-invalid={invalid || undefined}
      >
        <UserAvatar user={value} size="sm" decorative />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              <UserAvatar user={user} size="sm" decorative />
              {user.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
