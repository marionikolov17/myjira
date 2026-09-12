import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ILogger } from '@/common/logger';
import { IAuthorizationGuard, AuthorizationScope } from '@/common/authorization';
import { IActivationTokenService } from '@/common/activation-token';
import { AuthorizationError, BusinessRuleViolationError, ConflictError } from '@/common/errors';

import { IUserRepository, IUserService } from '@/modules/users';
import { UserService } from '@/modules/users/user.service';
import { IWorkspaceRoleRepository } from '@/modules/workspace-roles';

import { createMockLogger } from '../../mocks/logger.mock';
import { createMockUserRepository } from '../../mocks/user.repository.mock';
import { createMockWorkspaceRoleRepository } from '../../mocks/workspace-role.repository.mock';
import { createMockAuthorizationGuard } from '../../mocks/authorization-guard.mock';
import { createMockActivationTokenService } from '../../mocks/activation-token.service.mock';

import {
  ACTIVATION_URL_BASE,
  RAW_TOKEN,
  TOKEN_HASH,
  EXPIRES_AT,
  createdUser,
  developerRole,
  generatedActivationToken,
  ownerActor,
  ownerRole,
  userServiceConfig,
  validInput,
} from './user.service.mock';

describe('UserService', () => {
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockWorkspaceRoleRepository: jest.Mocked<IWorkspaceRoleRepository>;
  let mockAuthorizationGuard: jest.Mocked<IAuthorizationGuard>;
  let mockActivationTokenService: jest.Mocked<IActivationTokenService>;
  let mockLogger: jest.Mocked<ILogger>;

  let userService: IUserService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUserRepository = createMockUserRepository();
    mockUserRepository.createUser.mockResolvedValue(createdUser);

    mockWorkspaceRoleRepository = createMockWorkspaceRoleRepository();
    mockWorkspaceRoleRepository.getWorkspaceRoleById.mockResolvedValue(developerRole);

    mockAuthorizationGuard = createMockAuthorizationGuard();

    mockActivationTokenService = createMockActivationTokenService();
    mockActivationTokenService.generate.mockReturnValue(generatedActivationToken);

    mockLogger = createMockLogger();

    userService = new UserService(
      mockUserRepository,
      mockWorkspaceRoleRepository,
      mockAuthorizationGuard,
      mockActivationTokenService,
      mockLogger,
      userServiceConfig,
    );
  });

  describe('authorization', () => {
    it('authorizes the actor on the workspace createUser action', async () => {
      await userService.createUser(ownerActor, validInput);

      expect(mockAuthorizationGuard.authorize).toHaveBeenCalledWith({
        actor: ownerActor,
        scope: AuthorizationScope.Workspace,
        action: 'createUser',
      });
    });

    it('throws AuthorizationError and creates nothing when the actor is not authorized', async () => {
      mockAuthorizationGuard.authorize.mockImplementation(() => {
        throw new AuthorizationError();
      });

      await expect(userService.createUser(ownerActor, validInput)).rejects.toThrow(
        AuthorizationError,
      );

      expect(mockWorkspaceRoleRepository.getWorkspaceRoleById).not.toHaveBeenCalled();
      expect(mockUserRepository.createUser).not.toHaveBeenCalled();
    });
  });

  describe('role validation', () => {
    it('throws BusinessRuleViolationError when the role does not exist', async () => {
      mockWorkspaceRoleRepository.getWorkspaceRoleById.mockResolvedValue(null);

      await expect(userService.createUser(ownerActor, validInput)).rejects.toThrow(
        BusinessRuleViolationError,
      );

      expect(mockUserRepository.createUser).not.toHaveBeenCalled();
    });

    it('throws BusinessRuleViolationError when the role is the Owner role', async () => {
      mockWorkspaceRoleRepository.getWorkspaceRoleById.mockResolvedValue(ownerRole);

      await expect(
        userService.createUser(ownerActor, { ...validInput, workspaceRoleId: ownerRole.id }),
      ).rejects.toThrow(BusinessRuleViolationError);

      expect(mockUserRepository.createUser).not.toHaveBeenCalled();
    });
  });

  describe('on success', () => {
    it('returns the created user and a one-time activation link', async () => {
      const result = await userService.createUser(ownerActor, validInput);

      expect(result.user).toEqual(createdUser);
      expect(result.activation.expiresAt).toEqual(EXPIRES_AT);
      expect(result.activation.url).toBe(`${ACTIVATION_URL_BASE}?token=${RAW_TOKEN}`);
    });

    it('persists only the token hash and never the raw token', async () => {
      await userService.createUser(ownerActor, validInput);

      expect(mockUserRepository.createUser).toHaveBeenCalledWith({
        name: validInput.name,
        email: validInput.email,
        workspaceRoleId: validInput.workspaceRoleId,
        activationTokenHash: TOKEN_HASH,
        activationTokenExpiresAt: EXPIRES_AT,
      });

      const persistedParams = mockUserRepository.createUser.mock.calls[0]?.[0];
      expect(JSON.stringify(persistedParams)).not.toContain(RAW_TOKEN);
    });

    it('does not pass any password or credential field to the repository', async () => {
      await userService.createUser(ownerActor, validInput);

      const persistedParams = mockUserRepository.createUser.mock.calls[0]?.[0] ?? {};
      expect(persistedParams).not.toHaveProperty('password');
      expect(persistedParams).not.toHaveProperty('hashedPassword');
    });
  });

  describe('on duplicate email', () => {
    it('propagates a ConflictError from the repository', async () => {
      mockUserRepository.createUser.mockRejectedValue(new ConflictError('email already exists'));

      await expect(userService.createUser(ownerActor, validInput)).rejects.toThrow(ConflictError);
    });
  });
});
