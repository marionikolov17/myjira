'use client';

import { CheckIcon, UserPlusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { OptionSelect } from '@/components/common/OptionSelect';
import { PaginationBar } from '@/components/common/PaginationBar';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useUsers } from '@/features/users/queries';
import { PROJECT_ROLE_IDS, PROJECT_ROLE_LABELS, type ProjectRoleName } from '@/lib/api/schemas';
import { assignableProjectRoles } from '@/lib/authz/can';
import { useActor } from '@/lib/authz/useCan';
import { notifyError } from '@/lib/forms/handleFormError';
import { cn } from '@/lib/utils';
import { useAddMember } from '../mutations';
import { ADD_MEMBER_PAGE_SIZE } from '../schemas';

type AddMemberDialogProps = {
  projectId: string;
  memberUserIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddMemberDialog({
  projectId,
  memberUserIds,
  open,
  onOpenChange,
}: AddMemberDialogProps) {
  const actor = useActor();
  const roles = assignableProjectRoles(actor, projectId);
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [role, setRole] = useState<ProjectRoleName>('Developer');
  const addMember = useAddMember(projectId);
  const { data, isLoading } = useUsers(
    { page, pageSize: ADD_MEMBER_PAGE_SIZE, sort: 'name' },
    { enabled: open },
  );

  const pageUsers = data?.data ?? [];
  const candidates = pageUsers.filter((user) => !memberUserIds.includes(user.id));
  const hiddenCount = pageUsers.length - candidates.length;

  const reset = () => {
    setSelectedUserId(null);
    setRole('Developer');
    setPage(1);
  };

  const handleOpenChange = (next: boolean) => {
    if (addMember.isPending) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = () => {
    if (!selectedUserId) return;
    addMember.mutate(
      { userId: selectedUserId, projectRoleId: PROJECT_ROLE_IDS[role] },
      {
        onSuccess: (member) => {
          toast.success(
            `${member.user.name} added as ${PROJECT_ROLE_LABELS[member.projectRole.name]}`,
          );
          reset();
          onOpenChange(false);
        },
        onError: notifyError,
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add member</DialogTitle>
          <DialogDescription>
            Pick a workspace user who isn&apos;t on this project yet.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div role="listbox" aria-label="Workspace users" className="flex flex-col gap-1">
            {isLoading &&
              Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-xl" />
              ))}
            {!isLoading && candidates.length === 0 && (
              <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                Everyone on this page is already a member. Try another page.
              </p>
            )}
            {candidates.map((user) => {
              const selected = user.id === selectedUserId;
              return (
                <button
                  key={user.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => setSelectedUserId(selected ? null : user.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
                    selected ? 'border-primary bg-primary/5' : 'border-transparent',
                  )}
                >
                  <UserAvatar user={user} size="sm" decorative />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </span>
                  {user.status === 'Pending' && <Badge variant="outline">Pending</Badge>}
                  {selected && <CheckIcon className="size-4 text-primary" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          {hiddenCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {hiddenCount} existing {hiddenCount === 1 ? 'member is' : 'members are'} hidden on
              this page.
            </p>
          )}
          <PaginationBar
            pagination={data?.meta.pagination}
            onPageChange={setPage}
            itemLabel="users"
          />

          <Field>
            <FieldLabel htmlFor="add-member-role">Project role</FieldLabel>
            <OptionSelect
              id="add-member-role"
              ariaLabel="Project role"
              value={role}
              options={roles.map((value) => ({ value, label: PROJECT_ROLE_LABELS[value] }))}
              onChange={setRole}
              disabled={roles.length <= 1}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={addMember.isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={!selectedUserId || addMember.isPending}>
            {addMember.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <UserPlusIcon data-icon="inline-start" />
            )}
            Add member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
