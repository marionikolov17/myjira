import type { PrismaClient } from '@/generated/prisma/client';
import { UserStatus } from '@/generated/prisma/enums';
import { ILogger, logger } from '@/common/logger';
import { prisma } from '@/common/lib/prisma';
import { mapPrismaError } from '@/common/utils/map-prisma-error';
import { QueryOptions, toPrismaFindArgs } from '@/common/query';
import {
  BulkCreateUsersParams,
  CreateUserParams,
  HasUsersForWorkspaceRoleIdsParams,
  ListUsersResult,
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
    status: true,
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
          password: null,
          status: UserStatus.Pending,
          activationTokenHash: params.activationTokenHash,
          activationTokenExpiresAt: params.activationTokenExpiresAt,
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
          status: UserStatus.Active,
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
  ): Promise<(User & { password: string | null }) | null> {
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

  public async findUsers(options: QueryOptions): Promise<ListUsersResult> {
    const { skip, take, orderBy, where } = toPrismaFindArgs(options);
    const stableOrderBy = [...orderBy, { id: 'asc' as const }];

    try {
      const [rows, totalItems] = await this.prisma.$transaction([
        this.prisma.user.findMany({
          skip,
          take,
          orderBy: stableOrderBy,
          where,
          select: this.select,
        }),
        this.prisma.user.count({ where }),
      ]);

      return { items: rows.map((u) => UserSchema.parse(u)), totalItems };
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
