import { NextFunction, Request, Response, Router } from 'express';
import { requireAuthenticationMiddleware } from '@/common/middlewares';
import { ActorContext } from '@/common/interfaces';
import { IWorkspaceRoleService } from './workspace-role.service';

export class WorkspaceRoleController {
  public readonly router: Router;

  constructor(private readonly workspaceRoleService: IWorkspaceRoleService) {
    this.router = Router();
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.get('/', requireAuthenticationMiddleware, this.listWorkspaceRoles.bind(this));
  }

  private async listWorkspaceRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roles = await this.workspaceRoleService.listWorkspaceRoles(req.actor as ActorContext);
      res.status(200).json({ data: roles });
    } catch (error) {
      next(error);
    }
  }
}
