import type { PrismaClient } from '@/generated/prisma/client';
import { ILogger, logger } from '@/common/logger';
import { prisma } from '@/common/lib/prisma';
import { mapPrismaError } from '@/common/utils/map-prisma-error';
import { QueryOptions, toPrismaFindArgs } from '@/common/query';
import {
  ActorMembershipFilter,
  CreateProjectParams,
  ListProjectsResult,
  UpdateProjectParams,
} from './project.types';
import { Project, ProjectSchema } from './project.schema';
import { IProjectRepository } from './project.interface';

type ProjectPrismaClient = Pick<PrismaClient, 'project' | '$transaction'>;

export class ProjectRepository implements IProjectRepository {
  public readonly resourceName: string = 'projects';
  private readonly select = {
    id: true,
    name: true,
    description: true,
    creatorId: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  constructor(
    private readonly prisma: ProjectPrismaClient,
    private readonly logger: ILogger,
  ) {}

  public async createProject(params: CreateProjectParams): Promise<Project> {
    try {
      const project = await this.prisma.project.create({
        data: {
          name: params.name,
          description: params.description,
          creatorId: params.creatorId,
        },
        select: this.select,
      });

      return ProjectSchema.parse(project);
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async findProjects(
    options: QueryOptions,
    actorMembershipFilter?: ActorMembershipFilter,
  ): Promise<ListProjectsResult> {
    const { skip, take, orderBy, where } = toPrismaFindArgs(options);
    const stableOrderBy = [...orderBy, { id: 'asc' as const }];

    const scopedWhere = actorMembershipFilter
      ? { ...where, members: { some: { userId: actorMembershipFilter.userId } } }
      : where;

    try {
      const [rows, totalItems] = await this.prisma.$transaction([
        this.prisma.project.findMany({
          skip,
          take,
          orderBy: stableOrderBy,
          where: scopedWhere,
          select: this.select,
        }),
        this.prisma.project.count({ where: scopedWhere }),
      ]);

      return { items: rows.map((p) => ProjectSchema.parse(p)), totalItems };
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async getProjectById(projectId: string): Promise<Project | null> {
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: this.select,
      });

      return project ? ProjectSchema.parse(project) : null;
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async updateProject(projectId: string, params: UpdateProjectParams): Promise<Project> {
    try {
      const project = await this.prisma.project.update({
        where: { id: projectId },
        data: {
          ...(params.name !== undefined ? { name: params.name } : {}),
          ...(params.description !== undefined ? { description: params.description } : {}),
        },
        select: this.select,
      });

      return ProjectSchema.parse(project);
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async deleteProject(projectId: string): Promise<void> {
    try {
      await this.prisma.project.delete({ where: { id: projectId } });
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

export const projectRepository = new ProjectRepository(prisma, logger);
