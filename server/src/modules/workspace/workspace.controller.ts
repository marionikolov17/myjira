import { Router, Request, Response, NextFunction } from 'express';
import { isPlainObject } from '@/common/utils/is-plain-object';
import { IWorkspaceService } from './workspace.interface';
import { BootstrapWorkspaceUsersParamsSchema } from './workspace.schema';

export class WorkspaceController {
  public readonly router: Router;

  constructor(private readonly workspaceService: IWorkspaceService) {
    this.router = Router();
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.post('/bootstrap', this.bootstrapWorkspaceUsers.bind(this));
  }

  private async bootstrapWorkspaceUsers(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const body = isPlainObject(req.body) ? req.body : {};
      const validatedParams = BootstrapWorkspaceUsersParamsSchema.parse(body);

      const users = await this.workspaceService.bootstrapWorkspaceUsers(validatedParams);

      res.status(201).json({ data: users });
    } catch (error) {
      next(error);
    }
  }
}
