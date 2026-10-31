'use client';

import { UsersIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { type DataTableColumn, DataTable } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { OptionSelect } from '@/components/common/OptionSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginationBar } from '@/components/common/PaginationBar';
import { RoleBadge } from '@/components/common/RoleBadge';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CreateUserResponse, ListFilter, ListQuery, User } from '@/lib/api/schemas';
import { canChangeUserRole } from '@/lib/authz/can';
import { PermissionGate } from '@/lib/authz/PermissionGate';
import { useActor } from '@/lib/authz/useCan';
import { formatDate } from '@/lib/format';
import { notifyError } from '@/lib/forms/handleFormError';
import { useWorkspaceRoles } from '@/features/roles/queries';
import { useUpdateUserRole } from '../mutations';
import { ASSIGNABLE_ROLE_NAMES } from '../options';
import { useUsers } from '../queries';
import { USERS_PAGE_SIZE, USER_SORT_OPTIONS } from '../schemas';
import { useUserFilters, type UserFilterValues } from '../useUserFilters';
import { ActivationLinkDialog } from './ActivationLinkDialog';
import { InviteUserDialog } from './InviteUserDialog';
import { UserFilterBar } from './UserFilterBar';

function buildFilter(values: UserFilterValues): ListFilter | undefined {
  const next: ListFilter = {};
  if (values.status.length > 0) next.status = { in: values.status };
  if (values.role.length > 0) next.workspaceRoleId = { in: values.role };
  return Object.keys(next).length > 0 ? next : undefined;
}

export function UsersView() {
  const actor = useActor();
  const workspaceRoles = useWorkspaceRoles();
  const filters = useUserFilters();

  const filter = buildFilter(filters.values);
  const query: ListQuery = {
    page: filters.page,
    pageSize: USERS_PAGE_SIZE,
    sort: filters.sort,
    filter,
  };

  const { data, isLoading, error, refetch } = useUsers(query);
  const updateRole = useUpdateUserRole();

  const [invite, setInvite] = useState<CreateUserResponse | null>(null);

  const assignableRoleOptions = useMemo(
    () =>
      ASSIGNABLE_ROLE_NAMES.flatMap((name) => {
        const role = workspaceRoles.byName(name);
        return role ? [{ value: role.id, label: name }] : [];
      }),
    [workspaceRoles],
  );

  const changeRole = (user: User, workspaceRoleId: string) => {
    if (workspaceRoleId === user.workspaceRoleId) return;
    updateRole.mutate(
      { userId: user.id, workspaceRoleId },
      {
        onSuccess: (updated) =>
          toast.success(
            `${updated.name} is now ${workspaceRoles.byId(updated.workspaceRoleId)?.name ?? 'updated'}`,
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
        const role = workspaceRoles.byId(user.workspaceRoleId)?.name ?? 'Developer';
        const editable = canChangeUserRole(actor, user, (id) => workspaceRoles.byId(id)?.name);
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
              <InviteUserDialog onInvited={setInvite} />
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
              <EmptyState
                icon={UsersIcon}
                title={anyFilterActive ? 'No users match these filters' : 'No users yet'}
                description={
                  anyFilterActive
                    ? 'Try removing a filter.'
                    : 'Invite someone to join the workspace.'
                }
              >
                {anyFilterActive ? (
                  <Button variant="outline" onClick={filters.clearFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <PermissionGate action="users.create">
                    <InviteUserDialog onInvited={setInvite} />
                  </PermissionGate>
                )}
              </EmptyState>
            }
          />
          <PaginationBar
            pagination={data?.meta.pagination}
            onPageChange={filters.setPage}
            itemLabel="users"
          />
        </>
      )}

      <ActivationLinkDialog invite={invite} onDismiss={() => setInvite(null)} />
    </div>
  );
}
