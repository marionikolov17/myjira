'use client';

import { UserMinusIcon, UserPlusIcon, UsersIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { type DataTableColumn, DataTable } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { OptionSelect } from '@/components/common/OptionSelect';
import { RoleBadge } from '@/components/common/RoleBadge';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Button } from '@/components/ui/button';
import {
  PROJECT_ROLE_IDS,
  PROJECT_ROLE_LABELS,
  type ProjectMember,
  type ProjectRoleName,
} from '@/lib/api/schemas';
import { canChangeMemberRole, canRemoveMember } from '@/lib/authz/can';
import { PermissionGate } from '@/lib/authz/PermissionGate';
import { useActor } from '@/lib/authz/useCan';
import { notifyError } from '@/lib/forms/handleFormError';
import { useRemoveMember, useUpdateMemberRole } from '../mutations';
import { useProjectMembers } from '../queries';
import { AddMemberDialog } from './AddMemberDialog';

const ROLE_ORDER: Record<ProjectRoleName, number> = {
  ProjectOwner: 0,
  ProjectAdmin: 1,
  Developer: 2,
};
const EDITABLE_ROLES = (['ProjectAdmin', 'Developer'] as const).map((value) => ({
  value,
  label: PROJECT_ROLE_LABELS[value],
}));

export function MembersView({ projectId }: { projectId: string }) {
  const actor = useActor();
  const { data: members, isLoading, error, refetch } = useProjectMembers(projectId);
  const updateRole = useUpdateMemberRole(projectId);
  const removeMember = useRemoveMember(projectId);
  const [addOpen, setAddOpen] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<ProjectMember | null>(null);

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const sorted = members
    ? [...members].sort(
        (a, b) =>
          ROLE_ORDER[a.projectRole.name] - ROLE_ORDER[b.projectRole.name] ||
          a.user.name.localeCompare(b.user.name),
      )
    : undefined;

  const changeRole = (member: ProjectMember, role: ProjectRoleName) =>
    updateRole.mutate(
      { memberId: member.id, projectRoleId: PROJECT_ROLE_IDS[role] },
      {
        onSuccess: () => toast.success(`${member.user.name} is now ${PROJECT_ROLE_LABELS[role]}`),
        onError: notifyError,
      },
    );

  const confirmRemoval = () => {
    if (!pendingRemoval) return;
    const member = pendingRemoval;
    removeMember.mutate(member.id, {
      onSuccess: () => {
        toast.success(`${member.user.name} removed from the project`);
        setPendingRemoval(null);
      },
      onError: notifyError,
    });
  };

  const columns: DataTableColumn<ProjectMember>[] = [
    {
      id: 'member',
      header: 'Member',
      cell: (member) => (
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar user={member.user} decorative />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">
              {member.user.name}
              {member.user.id === actor?.userId && (
                <span className="text-muted-foreground"> (you)</span>
              )}
            </span>
            <span className="truncate text-xs text-muted-foreground">{member.user.email}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Project role',
      cell: (member) =>
        canChangeMemberRole(actor, projectId, member) ? (
          <OptionSelect
            size="sm"
            ariaLabel={`Project role for ${member.user.name}`}
            value={member.projectRole.name}
            options={EDITABLE_ROLES}
            onChange={(role) => role !== member.projectRole.name && changeRole(member, role)}
            disabled={updateRole.isPending}
            className="w-40"
          />
        ) : (
          <RoleBadge scope="project" role={member.projectRole.name} />
        ),
    },
    {
      id: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (member) =>
        canRemoveMember(actor, projectId, member) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPendingRemoval(member)}
            aria-label={`Remove ${member.user.name}`}
          >
            <UserMinusIcon data-icon="inline-start" />
            Remove
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {members
            ? `${members.length} ${members.length === 1 ? 'member' : 'members'}`
            : 'Loading members…'}
        </p>
        <PermissionGate action="members.add" projectId={projectId}>
          <Button onClick={() => setAddOpen(true)}>
            <UserPlusIcon data-icon="inline-start" />
            Add member
          </Button>
        </PermissionGate>
      </div>

      <DataTable
        columns={columns}
        rows={sorted}
        getRowId={(member) => member.id}
        isLoading={isLoading}
        caption="Project members"
        empty={
          <EmptyState
            icon={UsersIcon}
            title="No members"
            description="Add someone to get started."
          />
        }
      />

      <AddMemberDialog
        projectId={projectId}
        memberUserIds={members?.map((member) => member.user.id) ?? []}
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      <ConfirmDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
        title="Remove member?"
        description={
          pendingRemoval
            ? `${pendingRemoval.user.name} will lose access to this project. Issues assigned to them keep their assignee.`
            : ''
        }
        confirmLabel="Remove"
        pending={removeMember.isPending}
        onConfirm={confirmRemoval}
      />
    </div>
  );
}
