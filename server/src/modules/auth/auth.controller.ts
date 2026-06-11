import { NextFunction, Request, Response, Router } from 'express';
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
      const validatedParams = LoginParamsSchema.parse(req.body);

      const token = await this.authService.login(validatedParams);

      res.status(200).json({ data: { token } });
    } catch (error) {
      next(error);
    }
  }
}
