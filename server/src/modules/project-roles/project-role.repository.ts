import type { PrismaClient } from '@/generated/prisma/client';
import { ILogger, logger } from '@/common/logger';
import { prisma } from '@/common/lib/prisma';
import { mapPrismaError } from '@/common/utils/map-prisma-error';
import { BusinessRuleViolationError } from '@/common/errors';
import { ProjectRole, ProjectRoleName, ProjectRoleSchema } from './project-role.schema';
import { IProjectRoleRepository } from './project-role.interface';

export class ProjectRoleRepository implements IProjectRoleRepository {
  public readonly resourceName: string = 'project_roles';
  private readonly select = {
    id: true,
    name: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: ILogger,
  ) {}

  public async getProjectRoles(): Promise<ProjectRole[]> {
    try {
      const roles = await this.prisma.projectRole.findMany({
        select: this.select,
      });

      return roles.map((role) => ProjectRoleSchema.parse(role));
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async getProjectRoleById(id: string): Promise<ProjectRole | null> {
    try {
      const role = await this.prisma.projectRole.findUnique({
        where: { id },
        select: this.select,
      });

      return role ? ProjectRoleSchema.parse(role) : null;
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

export const projectRoleRepository = new ProjectRoleRepository(prisma, logger);
