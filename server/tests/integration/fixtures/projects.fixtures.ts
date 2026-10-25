import { prisma } from '@/common/lib/prisma';

export interface SeededProject {
  id: string;
  name: string;
  description: string;
  creatorId: string;
}

/**
 * Seeds a project row directly via Prisma (bypassing the controller/service).
 */
export async function seedProject(
  creatorId: string,
  name: string,
  description: string,
): Promise<SeededProject> {
  return prisma.project.create({
    data: { name, description, creatorId },
    select: { id: true, name: true, description: true, creatorId: true },
  });
}
