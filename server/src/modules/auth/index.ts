import { logger } from '@/common/logger';
import { tokenService } from '@/common/token-service';
import { passwordHasher } from '@/common/password-hasher';
import { createAuthenticationMiddleware } from '@/common/middlewares';
import { userRepository } from '@/modules/users';
import { workspaceRoleRepository } from '@/modules/workspace-roles';
import { projectMemberRepository } from '@/modules/project-members';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ActorContextService } from './actor-context.service';

const authService = new AuthService(userRepository, tokenService, passwordHasher, logger);
const authController = new AuthController(authService);

const actorContextService = new ActorContextService(
  userRepository,
  workspaceRoleRepository,
  projectMemberRepository,
  logger,
);

const authenticationMiddleware = createAuthenticationMiddleware({
  tokenService,
  actorContextService,
});

export { authController, actorContextService, authenticationMiddleware };
