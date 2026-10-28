import {
  FolderKanbanIcon,
  LayoutDashboardIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import type { Action } from '@/lib/authz/can';

export type NavItem = { href: string; label: string; icon: LucideIcon; action: Action };

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon, action: 'me.read' },
  { href: '/projects', label: 'Projects', icon: FolderKanbanIcon, action: 'projects.list' },
  { href: '/users', label: 'Users', icon: UsersIcon, action: 'users.list' },
  { href: '/profile', label: 'Profile', icon: UserRoundIcon, action: 'me.read' },
];

export const WORKSPACE_NAME = 'Northwind Labs';
