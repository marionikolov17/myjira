import { NextFunction, Request, Response, Router } from 'express';
import { requireAuthenticationMiddleware } from '@/common/middlewares';
import { isPlainObject } from '@/common/utils/is-plain-object';
import { ActorContext } from '@/common/interfaces';
import { IQueryParser, QueryConfig, buildPaginationMeta } from '@/common/query';
import { IdSchema } from '@/common/schema';
import { IProjectService } from './project.interface';
import {
  CreateProjectRequestParamsSchema,
  UpdateProjectRequestParamsSchema,
} from './project.schema';

export class ProjectsController {
  public readonly router: Router;

  constructor(
    private readonly projectService: IProjectService,
    private readonly queryParser: IQueryParser,
    private readonly projectsQueryConfig: QueryConfig,
  ) {
    this.router = Router();
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.get('/', requireAuthenticationMiddleware, this.listProjects.bind(this));
    this.router.post('/', requireAuthenticationMiddleware, this.createProject.bind(this));
    this.router.get('/:id', requireAuthenticationMiddleware, this.getProjectById.bind(this));
    this.router.patch('/:id', requireAuthenticationMiddleware, this.updateProject.bind(this));
    this.router.delete('/:id', requireAuthenticationMiddleware, this.deleteProject.bind(this));
  }

  private async createProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = isPlainObject(req.body) ? req.body : {};
      const validatedParams = CreateProjectRequestParamsSchema.parse(body);

      const project = await this.projectService.createProject(
        req.actor as ActorContext,
        validatedParams,
      );

      res.status(201).json({ data: project });
    } catch (error) {
      next(error);
    }
  }

  private async listProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const options = this.queryParser.parse(req.query, this.projectsQueryConfig);

      const { items, totalItems } = await this.projectService.listProjects(
        req.actor as ActorContext,
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

  private async getProjectById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = IdSchema.parse(req.params);

      const project = await this.projectService.getProjectById(req.actor as ActorContext, id);

      res.status(200).json({ data: project });
    } catch (error) {
      next(error);
    }
  }

  private async updateProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = IdSchema.parse(req.params);

      const body = isPlainObject(req.body) ? req.body : {};
      const validatedParams = UpdateProjectRequestParamsSchema.parse(body);

      const project = await this.projectService.updateProject(
        req.actor as ActorContext,
        id,
        validatedParams,
      );

      res.status(200).json({ data: project });
    } catch (error) {
      next(error);
    }
  }

  private async deleteProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = IdSchema.parse(req.params);

      await this.projectService.deleteProject(req.actor as ActorContext, id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
