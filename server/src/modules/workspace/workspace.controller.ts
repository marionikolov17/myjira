import { Router, Request, Response, NextFunction } from 'express';
import { IWorkspaceService } from './workspace.interface';
import { BootstrapWorkspaceUsersSchema } from './workspace.schema';

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
      const { bootstrapToken } = BootstrapWorkspaceUsersSchema.parse(req.body);

      const users = await this.workspaceService.bootstrapWorkspaceUsers({ bootstrapToken });

      res.status(201).json({ data: users });
    } catch (error) {
      next(error);
    }
  }
}
