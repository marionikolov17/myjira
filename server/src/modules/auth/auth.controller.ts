import { NextFunction, Request, Response, Router } from 'express';
import { isPlainObject } from '@/common/utils/is-plain-object';
import { IAuthService } from './auth.interface';
import { LoginParamsSchema } from './auth.schema';

export class AuthController {
  public readonly router: Router;

  constructor(private readonly authService: IAuthService) {
    this.router = Router();
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.post('/login', this.login.bind(this));
  }

  private async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = isPlainObject(req.body) ? req.body : {};
      const validatedParams = LoginParamsSchema.parse(body);

      const token = await this.authService.login(validatedParams);

      res.status(200).json({ data: { token } });
    } catch (error) {
      next(error);
    }
  }
}
