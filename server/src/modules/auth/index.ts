import { logger } from '@/common/logger';
import { tokenService } from '@/common/token-service';
import { passwordHasher } from '@/common/password-hasher';
import { userRepository } from '@/modules/users';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

const authService = new AuthService(userRepository, tokenService, passwordHasher, logger);
const authController = new AuthController(authService);

export { authController };
