import { prisma } from '@/common/lib/prisma';
import { ProjectRoleName } from '@/generated/prisma/enums';

const REQUIRED_PROJECT_ROLES = [
  ProjectRoleName.ProjectOwner,
  ProjectRoleName.ProjectAdmin,
  ProjectRoleName.Developer,
] as const;

export async function ensureProjectRolesSeeded(): Promise<void> {
  const existing = await prisma.projectRole.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map((role) => role.name));
  const missing = REQUIRED_PROJECT_ROLES.filter((name) => !existingNames.has(name));
  if (missing.length === 0) return;

  await prisma.projectRole.createMany({
    data: missing.map((name) => ({ name })),
  });
}

export async function fetchProjectRoleIdByName(name: ProjectRoleName): Promise<string> {
  const role = await prisma.projectRole.findFirst({ where: { name } });
  if (!role) {
    throw new Error(`Expected project role ${name} to exist`);
  }
  return role.id;
}
