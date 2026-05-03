import { prisma } from '@/common/lib/prisma';
import { WorkspaceRole, WorkspaceRoleName, WorkspaceRoleSchema } from '@/modules/workspace-roles';

const REQUIRED_WORKSPACE_ROLES: WorkspaceRoleName[] = Object.values(WorkspaceRoleName);

export async function ensureWorkspaceRolesSeeded(): Promise<void> {
  const missing = await findMissingWorkspaceRoles(REQUIRED_WORKSPACE_ROLES);
  if (missing.length === 0) return;

  await createWorkspaceRoles(missing);
}

export async function seedOnlyWorkspaceRoles(names: WorkspaceRoleName[]): Promise<void> {
  await deleteAllWorkspaceRoles();
  if (names.length === 0) return;

  await createWorkspaceRoles(names);
}

export async function deleteAllWorkspaceRoles(): Promise<void> {
  await prisma.workspaceRole.deleteMany();
}

export async function fetchAllWorkspaceRoles(): Promise<WorkspaceRole[]> {
  const roles = await prisma.workspaceRole.findMany();
  return roles.map((role) => WorkspaceRoleSchema.parse(role));
}

async function findMissingWorkspaceRoles(
  required: WorkspaceRoleName[],
): Promise<WorkspaceRoleName[]> {
  const existing = await fetchExistingWorkspaceRoleNames();
  return required.filter((name) => !existing.has(name));
}

async function fetchExistingWorkspaceRoleNames(): Promise<Set<string>> {
  const roles = await prisma.workspaceRole.findMany({ select: { name: true } });
  return new Set(roles.map((role) => role.name));
}

async function createWorkspaceRoles(names: WorkspaceRoleName[]): Promise<void> {
  await prisma.workspaceRole.createMany({
    data: names.map((name) => ({ name })),
  });
}
