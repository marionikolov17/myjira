import { Router, Request, Response, NextFunction } from 'express';
import { ISystemService } from './system.interface';
import { BootstrapSystemUsersSchema } from './system.schema';

export class SystemController {
  public readonly router: Router;

  constructor(private readonly systemService: ISystemService) {
    this.router = Router();
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.post('/bootstrap', this.bootstrapSystemUsers.bind(this));
  }

  private async bootstrapSystemUsers(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { bootstrapToken } = BootstrapSystemUsersSchema.parse(req.body);

      const users = await this.systemService.bootstrapSystemUsers({ bootstrapToken });

      res.status(201).json({ data: users });
    } catch (error) {
      next(error);
    }
  }
}
