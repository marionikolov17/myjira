import { logger } from '@/common/logger';
import { authorizationGuard } from '@/common/authorization';
import { activationTokenService } from '@/common/activation-token';
import { workspaceRoleRepository } from '@/modules/workspace-roles';
import { env } from '@/config/env';
import { UsersController } from './user.controller';
import { UserService } from './user.service';
import { userRepository } from './user.repository';

export * from './user.schema';
export * from './user.interface';
export * from './user.types';
export * from './user.repository';
export * from './user.service';

const userService = new UserService(
  userRepository,
  workspaceRoleRepository,
  authorizationGuard,
  activationTokenService,
  logger,
  { activationUrlBase: env.ACTIVATION_URL_BASE },
);

const usersController = new UsersController(userService);

export { usersController, userService };
