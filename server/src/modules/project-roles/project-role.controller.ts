import { NextFunction, Request, Response, Router } from 'express';
import { requireAuthenticationMiddleware } from '@/common/middlewares';
import { ActorContext } from '@/common/interfaces';
import { IProjectRoleService } from './project-role.service';

export class ProjectRoleController {
  public readonly router: Router;

  constructor(private readonly projectRoleService: IProjectRoleService) {
    this.router = Router();
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.get('/', requireAuthenticationMiddleware, this.listProjectRoles.bind(this));
  }

  private async listProjectRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roles = await this.projectRoleService.listProjectRoles(req.actor as ActorContext);
      res.status(200).json({ data: roles });
    } catch (error) {
      next(error);
    }
  }
}
