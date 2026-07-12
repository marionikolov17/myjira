import type { PrismaClient } from '../../../prisma/generated/prisma/client';
import { ILogger, logger } from '@/common/logger';
import { prisma } from '@/common/lib/prisma';
import { mapPrismaError } from '@/common/utils/map-prisma-error';
import {
  BulkCreateUsersParams,
  CreateUserParams,
  HasUsersForWorkspaceRoleIdsParams,
} from './user.types';
import { User, UserSchema } from './user.schema';
import { IUserRepository } from './user.interface';

export class UserRepository implements IUserRepository {
  public readonly resourceName: string = 'users';
  private readonly select = {
    id: true,
    name: true,
    email: true,
    workspaceRoleId: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: ILogger,
  ) {}

  public async createUser(params: CreateUserParams): Promise<User> {
    try {
      const user = await this.prisma.user.create({
        data: {
          name: params.name,
          email: params.email,
          password: params.hashedPassword,
          workspaceRoleId: params.workspaceRoleId,
        },
        select: this.select,
      });

      return UserSchema.parse(user);
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async bulkCreateUsers(params: BulkCreateUsersParams): Promise<User[]> {
    try {
      const users = await this.prisma.user.createManyAndReturn({
        data: params.users.map((user) => ({
          name: user.name,
          email: user.email,
          password: user.hashedPassword,
          workspaceRoleId: user.workspaceRoleId,
        })),
        select: this.select,
      });

      return users.map((user) => UserSchema.parse(user));
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async hasUsersForWorkspaceRoleIds(
    params: HasUsersForWorkspaceRoleIdsParams,
  ): Promise<boolean> {
    try {
      const count = await this.prisma.user.count({
        where: { workspaceRoleId: { in: params.workspaceRoleIds } },
      });

      return count > 0;
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async getUserByEmailWithPassword(
    email: string,
  ): Promise<(User & { password: string }) | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: {
          ...this.select,
          password: true,
        },
      });

      return user ? { ...UserSchema.parse(user), password: user.password } : null;
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async getUserById(userId: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: this.select,
      });

      return user ? UserSchema.parse(user) : null;
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

export const userRepository = new UserRepository(prisma, logger);
