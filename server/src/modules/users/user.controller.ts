import { NextFunction, Request, Response, Router } from 'express';
import { requireAuthenticationMiddleware } from '@/common/middlewares';
import { isPlainObject } from '@/common/utils/is-plain-object';
import { ActorContext } from '@/common/interfaces';
import { IUserService } from './user.interface';
import { CreateUserRequestParamsSchema } from './user.schema';

export class UsersController {
  public readonly router: Router;

  constructor(private readonly userService: IUserService) {
    this.router = Router();
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.get('/me', requireAuthenticationMiddleware, this.getMe.bind(this));
    this.router.post('/', requireAuthenticationMiddleware, this.createUser.bind(this));
  }

  private getMe(req: Request, res: Response): void {
    res.status(200).json({ data: req.actor });
  }

  private async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = isPlainObject(req.body) ? req.body : {};
      const validatedParams = CreateUserRequestParamsSchema.parse(body);

      const result = await this.userService.createUser(req.actor as ActorContext, validatedParams);

      res.status(201).json({ data: { user: result.user, activation: result.activation } });
    } catch (error) {
      next(error);
    }
  }
}
