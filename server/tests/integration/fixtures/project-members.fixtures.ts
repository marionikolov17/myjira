import { prisma } from '@/common/lib/prisma';
import { ProjectRoleName } from '@/modules/project-members';

const REQUIRED_PROJECT_ROLES: ProjectRoleName[] = Object.values(ProjectRoleName);

export async function ensureProjectRolesSeeded(): Promise<void> {
  const existing = await prisma.projectRole.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map((role) => role.name));
  const missing = REQUIRED_PROJECT_ROLES.filter((name) => !existingNames.has(name));
  if (missing.length === 0) return;

  await prisma.projectRole.createMany({
    data: missing.map((name) => ({ name })),
  });
}

export interface SeededProjectMembership {
  projectId: string;
  projectRoleId: string;
  projectRoleName: ProjectRoleName;
}

/**
 * Creates a project (owned by the given user) and enrolls the user as a member
 * with the requested project role. Assumes project roles are already seeded.
 */
export async function addUserToNewProject(
  userId: string,
  projectRoleName: ProjectRoleName,
  projectName: string,
): Promise<SeededProjectMembership> {
  const projectRole = await prisma.projectRole.findFirst({
    where: { name: projectRoleName },
  });
  if (!projectRole) {
    throw new Error(`Project role ${projectRoleName} not found`);
  }

  const project = await prisma.project.create({
    data: {
      name: projectName,
      description: `${projectName} description`,
      creatorId: userId,
    },
  });

  await prisma.projectMember.create({
    data: {
      projectId: project.id,
      userId,
      projectRoleId: projectRole.id,
    },
  });

  return {
    projectId: project.id,
    projectRoleId: projectRole.id,
    projectRoleName,
  };
}
