import type { PrismaClient } from '@/generated/prisma/client';
import { ILogger, logger } from '@/common/logger';
import { prisma } from '@/common/lib/prisma';
import { mapPrismaError } from '@/common/utils/map-prisma-error';
import {
  ProjectMemberExpanded,
  ProjectMemberExpandedSchema,
  ProjectMemberWithRole,
  ProjectMemberWithRoleSchema,
} from './project-member.schema';
import { CreateProjectMemberParams, IProjectMemberRepository } from './project-member.interface';

type ProjectMemberPrismaClient = Pick<PrismaClient, 'projectMember'>;

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

  private readonly expandedSelect = {
    id: true,
    projectId: true,
    user: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
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

  public async getProjectMemberByUserAndProject(
    userId: string,
    projectId: string,
  ): Promise<ProjectMemberWithRole | null> {
    try {
      const member = await this.prisma.projectMember.findFirst({
        where: { userId, projectId },
        select: this.select,
      });

      return member ? ProjectMemberWithRoleSchema.parse(member) : null;
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async createProjectMember(
    params: CreateProjectMemberParams,
  ): Promise<ProjectMemberExpanded> {
    try {
      const member = await this.prisma.projectMember.create({
        data: {
          projectId: params.projectId,
          userId: params.userId,
          projectRoleId: params.projectRoleId,
        },
        select: this.expandedSelect,
      });

      return ProjectMemberExpandedSchema.parse(member);
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async listProjectMembers(projectId: string): Promise<ProjectMemberExpanded[]> {
    try {
      const members = await this.prisma.projectMember.findMany({
        where: { projectId },
        orderBy: { id: 'asc' },
        select: this.expandedSelect,
      });

      return members.map((member) => ProjectMemberExpandedSchema.parse(member));
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async getProjectMemberById(
    memberId: string,
    projectId: string,
  ): Promise<ProjectMemberExpanded | null> {
    try {
      const member = await this.prisma.projectMember.findFirst({
        where: { id: memberId, projectId },
        select: this.expandedSelect,
      });

      return member ? ProjectMemberExpandedSchema.parse(member) : null;
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async updateProjectMemberRole(
    memberId: string,
    projectRoleId: string,
  ): Promise<ProjectMemberExpanded> {
    try {
      const member = await this.prisma.projectMember.update({
        where: { id: memberId },
        data: { projectRoleId },
        select: this.expandedSelect,
      });

      return ProjectMemberExpandedSchema.parse(member);
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async deleteProjectMember(memberId: string): Promise<void> {
    try {
      await this.prisma.projectMember.delete({ where: { id: memberId } });
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
