import { InvalidLoginCredentialsError } from '@/common/errors';
import { ITokenService } from '@/common/token-service/token-service.interface';
import { IPasswordHasher } from '@/common/password-hasher/password-hasher.interface';
import { ILogger } from '@/common/logger/logger.interface';
import { LoginParams } from './auth.schema';
import { IAuthService } from './auth.interface';
import { IUserRepository } from '../users/user.interface';

export class AuthService implements IAuthService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly tokenService: ITokenService,
    private readonly passwordHasher: IPasswordHasher,
    private readonly logger: ILogger,
  ) {}

  async login(params: LoginParams): Promise<string> {
    const user = await this.userRepository.getUserByEmailWithPassword(params.email);
    if (!user) {
      this.logger.error('Invalid login credentials', { email: params.email });
      throw new InvalidLoginCredentialsError();
    }

    const isPasswordValid = await this.passwordHasher.verifyPassword(
      params.password,
      user.password,
    );
    if (!isPasswordValid) {
      this.logger.error('Invalid login credentials', { email: params.email });
      throw new InvalidLoginCredentialsError();
    }

    return this.tokenService.generateToken({
      userId: user.id,
      workspaceRoleId: user.workspaceRoleId,
    });
  }
}
