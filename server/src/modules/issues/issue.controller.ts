import { NextFunction, Request, Response, Router } from 'express';
import { requireAuthenticationMiddleware } from '@/common/middlewares';
import { isPlainObject } from '@/common/utils/is-plain-object';
import { ActorContext } from '@/common/interfaces';
import { IQueryParser, QueryConfig, buildPaginationMeta } from '@/common/query';
import { IdSchema } from '@/common/schema';
import { IIssueService } from './issue.interface';
import { CreateIssueRequestParamsSchema, UpdateIssueRequestParamsSchema } from './issue.schema';

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
    this.router.get('/:id', requireAuthenticationMiddleware, this.getIssueById.bind(this));
    this.router.patch('/:id', requireAuthenticationMiddleware, this.updateIssue.bind(this));
    this.router.delete('/:id', requireAuthenticationMiddleware, this.deleteIssue.bind(this));
  }

  private async createIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: projectId } = IdSchema.parse({ id: req.params['projectId'] });

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
      const { id: projectId } = IdSchema.parse({ id: req.params['projectId'] });

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
      const { id: projectId } = IdSchema.parse({ id: req.params['projectId'] });
      const { id: issueId } = IdSchema.parse({ id: req.params['id'] });

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
      const { id: projectId } = IdSchema.parse({ id: req.params['projectId'] });
      const { id: issueId } = IdSchema.parse({ id: req.params['id'] });

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
      const { id: projectId } = IdSchema.parse({ id: req.params['projectId'] });
      const { id: issueId } = IdSchema.parse({ id: req.params['id'] });

      await this.issueService.deleteIssue(req.actor as ActorContext, projectId, issueId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
