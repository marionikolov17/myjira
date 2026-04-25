import type { PrismaClient } from '../../../prisma/generated/prisma/client';
import { ILogger, logger } from '@/common/logger';
import { prisma } from '@/common/lib/prisma';
import { mapPrismaError } from '@/common/utils/map-prisma-error';
import { WorkspaceRole, WorkspaceRoleSchema } from './workspace-role.schema';
import { IWorkspaceRoleRepository } from './workspace-role.interface';

export class WorkspaceRoleRepository implements IWorkspaceRoleRepository {
  public readonly resourceName: string = 'workspace_roles';
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

  public async getWorkspaceRoles(): Promise<WorkspaceRole[]> {
    try {
      const roles = await this.prisma.workspaceRole.findMany({
        select: this.select,
      });

      return roles.map((role) => WorkspaceRoleSchema.parse(role));
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

export const workspaceRoleRepository = new WorkspaceRoleRepository(prisma, logger);
