'use client';

import { LogOutIcon, UserRoundIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { RoleBadge } from '@/components/common/RoleBadge';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useLogout } from '@/features/auth/mutations';
import { useUser } from '@/features/users/queries';
import { useActor } from '@/lib/authz/useCan';

export function UserMenu() {
  const actor = useActor();
  const { data: user } = useUser(actor?.userId);
  const logout = useLogout();
  const router = useRouter();

  if (!actor) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-10 gap-2 rounded-full px-1.5 sm:pr-3"
            aria-label="Open user menu"
          />
        }
      >
        <UserAvatar user={user} size="sm" decorative />
        <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">
          {user ? user.name : <Skeleton className="h-4 w-20" />}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-2 py-2">
            <span className="flex flex-col">
              <span className="truncate text-sm font-medium text-foreground">
                {user?.name ?? '…'}
              </span>
              <span className="truncate text-xs font-normal">{user?.email}</span>
            </span>
            <span>
              <RoleBadge scope="workspace" role={actor.workspaceRole.name} />
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push('/profile')}>
            <UserRoundIcon aria-hidden="true" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={logout}>
            <LogOutIcon aria-hidden="true" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
