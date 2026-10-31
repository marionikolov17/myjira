'use client';

import { MailPlusIcon, UsersIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { type DataTableColumn, DataTable } from '@/components/common/DataTable';
import { ErrorState } from '@/components/common/ErrorState';
import { FilterAwareEmptyState } from '@/components/common/FilterAwareEmptyState';
import { OptionSelect } from '@/components/common/OptionSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginationBar } from '@/components/common/PaginationBar';
import { RoleBadge } from '@/components/common/RoleBadge';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CreateUserResponse, User } from '@/lib/api/schemas';
import { assignableWorkspaceRoles, canChangeUserRole } from '@/lib/authz/can';
import { PermissionGate } from '@/lib/authz/PermissionGate';
import { useActor } from '@/lib/authz/useCan';
import { formatDate } from '@/lib/format';
import { notifyError } from '@/lib/forms/handleFormError';
import { WORKSPACE_ROLE_LABELS } from '@/lib/labels/roles';
import { roleById, useWorkspaceRoles, workspaceRoleByName } from '@/features/roles/queries';
import { useUpdateUserRole } from '../mutations';
import { useUsers } from '../queries';
import { USER_SORT_OPTIONS } from '../constants';
import { userFiltersToListQuery, useUserFilters } from '../useUserFilters';
import { ActivationLinkDialog } from './ActivationLinkDialog';
import { InviteUserDialog } from './InviteUserDialog';
import { UserFilterBar } from './UserFilterBar';

export function UsersView() {
  const actor = useActor();
  const workspaceRoles = useWorkspaceRoles();
  const roles = workspaceRoles.data;
  const filters = useUserFilters();
  const query = userFiltersToListQuery(filters);

  const { data, isLoading, error, refetch } = useUsers(query);
  const updateRole = useUpdateUserRole();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState<CreateUserResponse | null>(null);

  const assignableRoleOptions = useMemo(
    () =>
      assignableWorkspaceRoles(actor).flatMap((name) => {
        const role = workspaceRoleByName(roles, name);
        return role ? [{ value: role.id, label: WORKSPACE_ROLE_LABELS[name] }] : [];
      }),
    [actor, roles],
  );

  const changeRole = (user: User, workspaceRoleId: string) => {
    if (workspaceRoleId === user.workspaceRoleId) return;
    updateRole.mutate(
      { userId: user.id, workspaceRoleId },
      {
        onSuccess: (updated) =>
          toast.success(
            `${updated.name} is now ${roleById(roles, updated.workspaceRoleId)?.name ?? 'updated'}`,
          ),
        onError: notifyError,
      },
    );
  };

  const columns: DataTableColumn<User>[] = [
    {
      id: 'user',
      header: 'User',
      sortKey: 'name',
      cell: (user) => (
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar user={user} decorative />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">
              {user.name}
              {user.id === actor?.userId && <span className="text-muted-foreground"> (you)</span>}
            </span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (user) => (
        <Badge variant={user.status === 'Active' ? 'secondary' : 'outline'}>{user.status}</Badge>
      ),
      headerClassName: 'hidden sm:table-cell',
      className: 'hidden sm:table-cell',
    },
    {
      id: 'role',
      header: 'Workspace role',
      cell: (user) => {
        const role = roleById(roles, user.workspaceRoleId)?.name ?? 'Developer';
        const editable = canChangeUserRole(actor, user, (id) => roleById(roles, id)?.name);
        return editable ? (
          <OptionSelect
            size="sm"
            ariaLabel={`Workspace role for ${user.name}`}
            value={user.workspaceRoleId}
            options={assignableRoleOptions}
            onChange={(next) => changeRole(user, next)}
            disabled={updateRole.isPending || assignableRoleOptions.length === 0}
            className="w-36"
          />
        ) : (
          <RoleBadge scope="workspace" role={role} />
        );
      },
    },
    {
      id: 'createdAt',
      header: 'Created',
      sortKey: 'createdAt',
      cell: (user) => (
        <time dateTime={user.createdAt} className="text-sm whitespace-nowrap text-muted-foreground">
          {formatDate(user.createdAt)}
        </time>
      ),
      headerClassName: 'hidden md:table-cell',
      className: 'hidden md:table-cell',
    },
  ];

  const anyFilterActive = filters.values.status.length > 0 || filters.values.role.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        description="Everyone in the workspace and their workspace role."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <OptionSelect
              ariaLabel="Sort users"
              value={filters.sort}
              options={USER_SORT_OPTIONS}
              onChange={filters.setSort}
              className="w-44"
            />
            <PermissionGate action="users.create">
              <Button onClick={() => setInviteOpen(true)} disabled={workspaceRoles.isLoading}>
                <MailPlusIcon data-icon="inline-start" />
                Invite user
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <UserFilterBar
        keys={['status', 'role']}
        values={filters.values}
        onChange={filters.setFilter}
        onClear={filters.clearFilters}
      />

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={data?.data}
            getRowId={(user) => user.id}
            isLoading={isLoading}
            sort={filters.sort}
            onSortChange={filters.setSort}
            caption="Workspace users"
            skeletonRows={8}
            empty={
              <FilterAwareEmptyState
                icon={UsersIcon}
                entityLabel="users"
                filterActive={anyFilterActive}
                emptyDescription="Invite someone to join the workspace."
                onClearFilters={filters.clearFilters}
              >
                <PermissionGate action="users.create">
                  <Button onClick={() => setInviteOpen(true)} disabled={workspaceRoles.isLoading}>
                    <MailPlusIcon data-icon="inline-start" />
                    Invite user
                  </Button>
                </PermissionGate>
              </FilterAwareEmptyState>
            }
          />
          <PaginationBar
            pagination={data?.meta.pagination}
            onPageChange={filters.setPage}
            itemLabel="users"
          />
        </>
      )}

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvited={setInvite} />
      <ActivationLinkDialog invite={invite} onDismiss={() => setInvite(null)} />
    </div>
  );
}
