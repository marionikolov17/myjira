import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { requireAuthenticationMiddleware } from '@/common/middlewares';
import { isPlainObject } from '@/common/utils/is-plain-object';
import { ActorContext } from '@/common/interfaces';
import { IQueryParser, QueryConfig, buildPaginationMeta } from '@/common/query';
import { IIssueService } from './issue.interface';
import { CreateIssueRequestParamsSchema, UpdateIssueRequestParamsSchema } from './issue.schema';

const ProjectIdPathSchema = z.object({ projectId: z.uuid() });
const IssueIdPathSchema = z.object({ issueId: z.uuid() });

export class IssueController {
  public readonly router: Router;

  constructor(
    private readonly issueService: IIssueService,
    private readonly queryParser: IQueryParser,
    private readonly issuesQueryConfig: QueryConfig,
  ) {
    this.router = Router({ mergeParams: true });
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.post('/', requireAuthenticationMiddleware, this.createIssue.bind(this));
    this.router.get('/', requireAuthenticationMiddleware, this.listIssues.bind(this));
    this.router.get('/:issueId', requireAuthenticationMiddleware, this.getIssueById.bind(this));
    this.router.patch('/:issueId', requireAuthenticationMiddleware, this.updateIssue.bind(this));
    this.router.delete('/:issueId', requireAuthenticationMiddleware, this.deleteIssue.bind(this));
  }

  private async createIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = parseProjectIdParam(req);

      const body = isPlainObject(req.body) ? req.body : {};
      const validatedParams = CreateIssueRequestParamsSchema.parse(body);

      const issue = await this.issueService.createIssue(
        req.actor as ActorContext,
        projectId,
        validatedParams,
      );

      res.status(201).json({ data: issue });
    } catch (error) {
      next(error);
    }
  }

  private async listIssues(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = parseProjectIdParam(req);

      const options = this.queryParser.parse(req.query, this.issuesQueryConfig);

      const { items, totalItems } = await this.issueService.listIssues(
        req.actor as ActorContext,
        projectId,
        options,
      );

      const pagination = buildPaginationMeta(
        options.pagination.page,
        options.pagination.pageSize,
        totalItems,
      );

      res.status(200).json({ data: items, meta: { pagination } });
    } catch (error) {
      next(error);
    }
  }

  private async getIssueById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = parseProjectIdParam(req);
      const { issueId } = parseIssueIdParam(req);

      const issue = await this.issueService.getIssueById(
        req.actor as ActorContext,
        projectId,
        issueId,
      );

      res.status(200).json({ data: issue });
    } catch (error) {
      next(error);
    }
  }

  private async updateIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = parseProjectIdParam(req);
      const { issueId } = parseIssueIdParam(req);

      const body = isPlainObject(req.body) ? req.body : {};
      const validatedParams = UpdateIssueRequestParamsSchema.parse(body);

      const issue = await this.issueService.updateIssue(
        req.actor as ActorContext,
        projectId,
        issueId,
        validatedParams,
      );

      res.status(200).json({ data: issue });
    } catch (error) {
      next(error);
    }
  }

  private async deleteIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = parseProjectIdParam(req);
      const { issueId } = parseIssueIdParam(req);

      await this.issueService.deleteIssue(req.actor as ActorContext, projectId, issueId);

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
