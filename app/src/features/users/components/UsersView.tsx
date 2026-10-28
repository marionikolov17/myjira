'use client'

import { parseAsInteger, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { useState } from 'react'
import { toast } from 'sonner'
import { type DataTableColumn, DataTable } from '@/components/common/DataTable'
import { ErrorState } from '@/components/common/ErrorState'
import { OptionSelect } from '@/components/common/OptionSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { PaginationBar } from '@/components/common/PaginationBar'
import { RoleBadge } from '@/components/common/RoleBadge'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Badge } from '@/components/ui/badge'
import {
  WORKSPACE_ROLE_IDS,
  workspaceRoleNameById,
  type CreateUserResponse,
  type User,
} from '@/lib/api/schemas'
import { canChangeUserRole } from '@/lib/authz/can'
import { PermissionGate } from '@/lib/authz/PermissionGate'
import { useActor } from '@/lib/authz/useCan'
import { formatDate } from '@/lib/format'
import { notifyError } from '@/lib/forms/handleFormError'
import { useUpdateUserRole } from '../mutations'
import { useUsers } from '../queries'
import { USER_SORT_OPTIONS } from '../schemas'
import { ActivationLinkDialog } from './ActivationLinkDialog'
import { InviteUserDialog } from './InviteUserDialog'

const PAGE_SIZE = 12
const SORT_VALUES = USER_SORT_OPTIONS.map((option) => option.value)
type UserSort = (typeof SORT_VALUES)[number]
const DEFAULT_SORT: UserSort = 'name'

const ROLE_OPTIONS = (['Admin', 'Developer'] as const).map((role) => ({ value: WORKSPACE_ROLE_IDS[role], label: role }))

export function UsersView() {
  const actor = useActor()
  const [{ page, sort }, setParams] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      sort: parseAsStringLiteral(SORT_VALUES).withDefault(DEFAULT_SORT),
    },
    { history: 'replace' },
  )
  const { data, isLoading, error, refetch } = useUsers({ page: Math.max(1, page), pageSize: PAGE_SIZE, sort })
  const updateRole = useUpdateUserRole()
  const [invite, setInvite] = useState<CreateUserResponse | null>(null)

  const setSort = (next: string | null) => {
    const value = (SORT_VALUES as readonly string[]).includes(next ?? '') ? (next as UserSort) : null
    void setParams({ sort: value, page: null })
  }

  const changeRole = (user: User, workspaceRoleId: string) => {
    if (workspaceRoleId === user.workspaceRoleId) return
    updateRole.mutate(
      { userId: user.id, workspaceRoleId },
      {
        onSuccess: (updated) =>
          toast.success(`${updated.name} is now ${workspaceRoleNameById(updated.workspaceRoleId) ?? 'updated'}`),
        onError: notifyError,
      },
    )
  }

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
      cell: (user) => <Badge variant={user.status === 'Active' ? 'secondary' : 'outline'}>{user.status}</Badge>,
      headerClassName: 'hidden sm:table-cell',
      className: 'hidden sm:table-cell',
    },
    {
      id: 'role',
      header: 'Workspace role',
      cell: (user) => {
        const role = workspaceRoleNameById(user.workspaceRoleId) ?? 'Developer'
        return canChangeUserRole(actor, user) ? (
          <OptionSelect
            size="sm"
            ariaLabel={`Workspace role for ${user.name}`}
            value={user.workspaceRoleId}
            options={ROLE_OPTIONS}
            onChange={(next) => changeRole(user, next)}
            disabled={updateRole.isPending}
            className="w-36"
          />
        ) : (
          <RoleBadge scope="workspace" role={role} />
        )
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
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        description="Everyone in the workspace and their workspace role."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <OptionSelect
              ariaLabel="Sort users"
              value={sort}
              options={USER_SORT_OPTIONS}
              onChange={(next) => setSort(next)}
              className="w-40"
            />
            <PermissionGate action="users.create">
              <InviteUserDialog onInvited={setInvite} />
            </PermissionGate>
          </div>
        }
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
            sort={sort}
            onSortChange={setSort}
            caption="Workspace users"
            skeletonRows={8}
          />
          <PaginationBar
            pagination={data?.meta.pagination}
            onPageChange={(next) => void setParams({ page: next <= 1 ? null : next })}
            itemLabel="users"
          />
        </>
      )}

      <ActivationLinkDialog invite={invite} onDismiss={() => setInvite(null)} />
    </div>
  )
}
