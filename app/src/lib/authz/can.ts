import type {
  ActorContext,
  ProjectMember,
  ProjectRoleName,
  User,
  WorkspaceRoleName,
} from '@/lib/api/schemas';
import { workspaceRoleNameById } from '@/lib/api/schemas';

export const ACTIONS = [
  'auth.login',
  'me.read',
  'users.create',
  'users.list',
  'users.getById',
  'users.updateRole',
  'projects.create',
  'projects.list',
  'projects.getById',
  'projects.update',
  'projects.delete',
  'members.add',
  'members.list',
  'members.updateRole',
  'members.remove',
  'issues.create',
  'issues.list',
  'issues.getById',
  'issues.update',
  'issues.delete',
] as const;

export type Action = (typeof ACTIONS)[number];

export type AuthzContext = { projectId?: string };

export const ISSUE_MODIFY_DENIED_REASON =
  'You need a project role on this project to modify issues.';

export function getProjectRole(
  actor: ActorContext,
  projectId: string | undefined,
): ProjectRoleName | undefined {
  if (!projectId) return undefined;
  return actor.projectRoles.find((role) => role.projectId === projectId)?.projectRoleName;
}

function hasWorkspaceRole(actor: ActorContext, ...roles: WorkspaceRoleName[]): boolean {
  return roles.includes(actor.workspaceRole.name);
}

/** The single source of truth for the permission matrix. Business guards live alongside, below. */
export function can(
  actor: ActorContext | null | undefined,
  action: Action,
  context: AuthzContext = {},
): boolean {
  if (action === 'auth.login') return true;
  if (!actor) return false;

  const projectRole = getProjectRole(actor, context.projectId);
  const isOwner = hasWorkspaceRole(actor, 'Owner');
  const isOwnerOrAdmin = hasWorkspaceRole(actor, 'Owner', 'Admin');

  switch (action) {
    case 'me.read':
    case 'projects.list':
      return true;
    case 'users.list':
    case 'users.getById':
      return hasWorkspaceRole(actor, 'Owner', 'Admin', 'Developer');
    case 'users.create':
    case 'projects.create':
      return isOwnerOrAdmin;
    case 'users.updateRole':
      return isOwner;
    case 'projects.getById':
    case 'members.list':
    case 'issues.list':
    case 'issues.getById':
      return isOwnerOrAdmin || projectRole !== undefined;
    case 'projects.update':
    case 'projects.delete':
    case 'members.updateRole':
      return isOwner || projectRole === 'ProjectOwner';
    case 'members.add':
    case 'members.remove':
      return isOwner || projectRole === 'ProjectOwner' || projectRole === 'ProjectAdmin';
    case 'issues.create':
    case 'issues.update':
    case 'issues.delete':
      return projectRole !== undefined;
  }
}

/** A ProjectAdmin without the workspace-Owner bypass may only manage Developer-tier members. */
export function actsWithProjectAdminLimits(actor: ActorContext, projectId: string): boolean {
  return !hasWorkspaceRole(actor, 'Owner') && getProjectRole(actor, projectId) === 'ProjectAdmin';
}

export function assignableProjectRoles(
  actor: ActorContext | null,
  projectId: string,
): ProjectRoleName[] {
  if (!actor || !can(actor, 'members.add', { projectId })) return [];
  return actsWithProjectAdminLimits(actor, projectId)
    ? ['Developer']
    : ['ProjectAdmin', 'Developer'];
}

export function canChangeMemberRole(
  actor: ActorContext | null,
  projectId: string,
  member: ProjectMember,
): boolean {
  if (!actor || !can(actor, 'members.updateRole', { projectId })) return false;
  return member.projectRole.name !== 'ProjectOwner' && member.user.id !== actor.userId;
}

export function canRemoveMember(
  actor: ActorContext | null,
  projectId: string,
  member: ProjectMember,
): boolean {
  if (!actor || !can(actor, 'members.remove', { projectId })) return false;
  if (member.projectRole.name === 'ProjectOwner' || member.user.id === actor.userId) return false;
  if (actsWithProjectAdminLimits(actor, projectId)) return member.projectRole.name === 'Developer';
  return true;
}

export function invitableWorkspaceRoles(
  actor: ActorContext | null,
): Array<Exclude<WorkspaceRoleName, 'Owner'>> {
  if (!actor || !can(actor, 'users.create')) return [];
  return actor.workspaceRole.name === 'Owner' ? ['Admin', 'Developer'] : ['Developer'];
}

export function canChangeUserRole(actor: ActorContext | null, user: User): boolean {
  if (!actor || !can(actor, 'users.updateRole')) return false;
  return workspaceRoleNameById(user.workspaceRoleId) !== 'Owner';
}
