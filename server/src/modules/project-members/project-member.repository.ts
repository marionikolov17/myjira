import type { PrismaClient } from '@/generated/prisma/client';
import { ILogger, logger } from '@/common/logger';
import { prisma } from '@/common/lib/prisma';
import { mapPrismaError } from '@/common/utils/map-prisma-error';
import { BusinessRuleViolationError } from '@/common/errors';
import {
  ProjectMemberWithRole,
  ProjectMemberWithRoleSchema,
  ProjectRoleName,
} from './project-member.schema';
import { CreateProjectMemberParams, IProjectMemberRepository } from './project-member.interface';

type ProjectMemberPrismaClient = Pick<PrismaClient, 'projectMember' | 'projectRole'>;

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
    private readonly prisma: ProjectMemberPrismaClient,
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

  public async createProjectMember(params: CreateProjectMemberParams): Promise<void> {
    try {
      await this.prisma.projectMember.create({
        data: {
          projectId: params.projectId,
          userId: params.userId,
          projectRoleId: params.projectRoleId,
        },
      });
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async getProjectRoleIdByName(name: ProjectRoleName): Promise<string> {
    try {
      const role = await this.prisma.projectRole.findFirst({
        where: { name },
        select: { id: true },
      });

      if (!role) {
        throw new BusinessRuleViolationError(`Project role ${name} does not exist`);
      }

      return role.id;
    } catch (error) {
      if (error instanceof BusinessRuleViolationError) {
        throw error;
      }
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
