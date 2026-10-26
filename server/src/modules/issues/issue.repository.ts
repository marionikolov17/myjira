import type { PrismaClient } from '@/generated/prisma/client';
import { ILogger, logger } from '@/common/logger';
import { prisma } from '@/common/lib/prisma';
import { mapPrismaError } from '@/common/utils/map-prisma-error';
import { QueryOptions, toPrismaFindArgs } from '@/common/query';
import { Issue, IssueSchema } from './issue.schema';
import { CreateIssueParams, ListIssuesResult, UpdateIssueParams } from './issue.types';
import { IIssueRepository } from './issue.interface';

type IssuePrismaClient = Pick<PrismaClient, 'issue' | '$transaction'>;

export class IssueRepository implements IIssueRepository {
  public readonly resourceName: string = 'issues';
  private readonly select = {
    id: true,
    title: true,
    description: true,
    status: true,
    priority: true,
    projectId: true,
    createdAt: true,
    updatedAt: true,
    creator: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    assignee: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
  } as const;

  constructor(
    private readonly prisma: IssuePrismaClient,
    private readonly logger: ILogger,
  ) {}

  public async createIssue(params: CreateIssueParams): Promise<Issue> {
    try {
      const issue = await this.prisma.issue.create({
        data: {
          projectId: params.projectId,
          creatorId: params.creatorId,
          assigneeId: params.assigneeId,
          title: params.title,
          description: params.description,
          priority: params.priority,
          status: params.status,
        },
        select: this.select,
      });

      return IssueSchema.parse(issue);
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async findIssues(options: QueryOptions, projectId: string): Promise<ListIssuesResult> {
    const { skip, take, orderBy, where } = toPrismaFindArgs(options);
    const stableOrderBy = [...orderBy, { id: 'asc' as const }];
    const scopedWhere = { ...where, projectId };

    try {
      const [rows, totalItems] = await this.prisma.$transaction([
        this.prisma.issue.findMany({
          skip,
          take,
          orderBy: stableOrderBy,
          where: scopedWhere,
          select: this.select,
        }),
        this.prisma.issue.count({ where: scopedWhere }),
      ]);

      return { items: rows.map((r) => IssueSchema.parse(r)), totalItems };
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async getIssueById(issueId: string, projectId: string): Promise<Issue | null> {
    try {
      const issue = await this.prisma.issue.findFirst({
        where: { id: issueId, projectId },
        select: this.select,
      });

      return issue ? IssueSchema.parse(issue) : null;
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async updateIssue(issueId: string, params: UpdateIssueParams): Promise<Issue> {
    try {
      const issue = await this.prisma.issue.update({
        where: { id: issueId },
        data: {
          ...(params.title !== undefined ? { title: params.title } : {}),
          ...(params.description !== undefined ? { description: params.description } : {}),
          ...(params.status !== undefined ? { status: params.status } : {}),
          ...(params.priority !== undefined ? { priority: params.priority } : {}),
          ...(params.assigneeId !== undefined ? { assigneeId: params.assigneeId } : {}),
        },
        select: this.select,
      });

      return IssueSchema.parse(issue);
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async deleteIssue(issueId: string): Promise<void> {
    try {
      await this.prisma.issue.delete({ where: { id: issueId } });
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

export const issueRepository = new IssueRepository(prisma, logger);
