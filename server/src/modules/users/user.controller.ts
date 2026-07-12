import { Request, Response, Router } from 'express';
import { requireAuthenticationMiddleware } from '@/common/middlewares';

export class UsersController {
  public readonly router: Router;

  constructor() {
    this.router = Router();
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.get('/me', requireAuthenticationMiddleware, this.getMe.bind(this));
  }

  private getMe(req: Request, res: Response): void {
    res.status(200).json({ data: req.actor });
  }
}
