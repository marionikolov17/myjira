import { prisma } from '@/common/lib/prisma';
import { ProjectRoleName } from '@/generated/prisma/enums';
import { fetchProjectRoleIdByName } from './project-roles.fixtures';

export interface SeededProjectMembership {
  id: string;
  projectId: string;
  userId: string;
  projectRoleId: string;
  projectRoleName: ProjectRoleName;
}

/**
 * Enrolls a user as a project member with the given project role, returning
 * the fresh row so the test can address it in subsequent requests.
 * Assumes project roles are already seeded.
 */
export async function seedProjectMembership(
  projectId: string,
  userId: string,
  projectRoleName: ProjectRoleName,
): Promise<SeededProjectMembership> {
  const projectRoleId = await fetchProjectRoleIdByName(projectRoleName);
  const row = await prisma.projectMember.create({
    data: { projectId, userId, projectRoleId },
    select: { id: true },
  });
  return { id: row.id, projectId, userId, projectRoleId, projectRoleName };
}
