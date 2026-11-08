import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { requireAuthenticationMiddleware } from '@/common/middlewares';
import { isPlainObject } from '@/common/utils/is-plain-object';
import { ActorContext } from '@/common/interfaces';
import { ICommentService } from './comment.interface';
import { CreateCommentRequestParamsSchema } from './comment.schema';

const ProjectIdPathSchema = z.object({ projectId: z.uuid() });
const IssueIdPathSchema = z.object({ issueId: z.uuid() });
const CommentIdPathSchema = z.object({ commentId: z.uuid() });

export class CommentController {
  public readonly router: Router;

  constructor(private readonly commentService: ICommentService) {
    this.router = Router({ mergeParams: true });
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.post('/', requireAuthenticationMiddleware, this.createComment.bind(this));
    this.router.get('/', requireAuthenticationMiddleware, this.listComments.bind(this));
    this.router.delete(
      '/:commentId',
      requireAuthenticationMiddleware,
      this.deleteComment.bind(this),
    );
  }

  private async createComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = parseProjectIdParam(req);
      const { issueId } = parseIssueIdParam(req);

      const body = isPlainObject(req.body) ? req.body : {};
      const validatedParams = CreateCommentRequestParamsSchema.parse(body);

      const comment = await this.commentService.createComment(
        req.actor as ActorContext,
        projectId,
        issueId,
        validatedParams,
      );

      res.status(201).json({ data: comment });
    } catch (error) {
      next(error);
    }
  }

  private async listComments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = parseProjectIdParam(req);
      const { issueId } = parseIssueIdParam(req);

      const comments = await this.commentService.listComments(
        req.actor as ActorContext,
        projectId,
        issueId,
      );

      res.status(200).json({ data: comments });
    } catch (error) {
      next(error);
    }
  }

  private async deleteComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = parseProjectIdParam(req);
      const { issueId } = parseIssueIdParam(req);
      const { commentId } = parseCommentIdParam(req);

      await this.commentService.deleteComment(
        req.actor as ActorContext,
        projectId,
        issueId,
        commentId,
      );

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

function parseProjectIdParam(req: Request): { projectId: string } {
  const parsed = ProjectIdPathSchema.parse({ projectId: req.params['projectId'] });
  return parsed;
}

function parseIssueIdParam(req: Request): { issueId: string } {
  const parsed = IssueIdPathSchema.parse({ issueId: req.params['issueId'] });
  return parsed;
}

function parseCommentIdParam(req: Request): { commentId: string } {
  const parsed = CommentIdPathSchema.parse({ commentId: req.params['commentId'] });
  return parsed;
}
