import type { PrismaClient } from '../../../prisma/generated/prisma/client';
import { ILogger, logger } from '@/common/logger';
import { prisma } from '@/common/lib/prisma';
import { mapPrismaError } from '@/common/utils/map-prisma-error';
import { ProjectMemberWithRole, ProjectMemberWithRoleSchema } from './project-member.schema';
import { IProjectMemberRepository } from './project-member.interface';

export class ProjectMemberRepository implements IProjectMemberRepository {
  public readonly resourceName: string = 'project_members';
  private readonly select = {
    id: true,
    projectId: true,
    userId: true,
    projectRoleId: true,
    projectRole: {
      select: {
        id: true,
        name: true,
      },
    },
  } as const;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: ILogger,
  ) {}

  public async getProjectMembersByUserId(userId: string): Promise<ProjectMemberWithRole[]> {
    try {
      const members = await this.prisma.projectMember.findMany({
        where: { userId },
        select: this.select,
      });

      return members.map((member) => ProjectMemberWithRoleSchema.parse(member));
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  private logError(error: unknown): void {
    if (error instanceof Error) {
      this.logger.error(error.message, { cause: error.cause, stack: error.stack });
      return;
    }
    this.logger.error(String(error));
  }
}

export const projectMemberRepository = new ProjectMemberRepository(prisma, logger);
