import type { PrismaClient } from '@/generated/prisma/client';
import { ILogger, logger } from '@/common/logger';
import { prisma } from '@/common/lib/prisma';
import { mapPrismaError } from '@/common/utils/map-prisma-error';
import { Comment, CommentSchema } from './comment.schema';
import { CreateCommentParams } from './comment.types';
import { ICommentRepository } from './comment.interface';

type CommentPrismaClient = Pick<PrismaClient, 'comment'>;

export class CommentRepository implements ICommentRepository {
  public readonly resourceName: string = 'comments';
  private readonly select = {
    id: true,
    body: true,
    issueId: true,
    createdAt: true,
    updatedAt: true,
    creator: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
  } as const;

  constructor(
    private readonly prisma: CommentPrismaClient,
    private readonly logger: ILogger,
  ) {}

  public async createComment(params: CreateCommentParams): Promise<Comment> {
    try {
      const comment = await this.prisma.comment.create({
        data: {
          issueId: params.issueId,
          creatorId: params.creatorId,
          body: params.body,
        },
        select: this.select,
      });

      return CommentSchema.parse(comment);
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async getCommentsByIssueId(issueId: string): Promise<Comment[]> {
    try {
      const comments = await this.prisma.comment.findMany({
        where: { issueId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: this.select,
      });

      return comments.map((comment) => CommentSchema.parse(comment));
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async getCommentById(commentId: string, issueId: string): Promise<Comment | null> {
    try {
      const comment = await this.prisma.comment.findFirst({
        where: { id: commentId, issueId },
        select: this.select,
      });

      return comment ? CommentSchema.parse(comment) : null;
    } catch (error) {
      this.logError(error);
      throw mapPrismaError(error);
    }
  }

  public async deleteComment(commentId: string): Promise<void> {
    try {
      await this.prisma.comment.delete({ where: { id: commentId } });
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

export const commentRepository = new CommentRepository(prisma, logger);
