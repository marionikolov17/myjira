import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ILogger } from '@/common/logger';
import { IAuthorizationGuard, AuthorizationScope } from '@/common/authorization';
import { IActivationTokenService } from '@/common/activation-token';
import {
  AuthorizationError,
  BusinessRuleViolationError,
  ConflictError,
  ResourceNotFoundError,
} from '@/common/errors';

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
  TARGET_USER_ID,
  adminRole,
  adminTargetUser,
  assignOwnerInput,
  assignUnknownRoleInput,
  createdUser,
  demoteToDeveloperInput,
  demotedToDeveloperUser,
  developerRole,
  developerTargetUser,
  generatedActivationToken,
  ownerActor,
  ownerRole,
  ownerTargetUser,
  pendingDeveloperTargetUser,
  promoteToAdminInput,
  promotedPendingUser,
  promotedToAdminUser,
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

  describe('updateUserRole', () => {
    beforeEach(() => {
      // Happy-path defaults: target exists and is a Developer; the requested
      // role resolves to Admin.
      mockUserRepository.getUserById.mockResolvedValue(developerTargetUser);
      mockUserRepository.updateUserWorkspaceRoleById.mockResolvedValue(promotedToAdminUser);

      mockWorkspaceRoleRepository.getWorkspaceRoleById.mockImplementation(async (id) => {
        if (id === developerRole.id) return developerRole;
        if (id === adminRole.id) return adminRole;
        if (id === ownerRole.id) return ownerRole;
        return null;
      });
    });

    describe('on success', () => {
      it('promotes a Developer to Workspace Admin and returns the updated user', async () => {
        const result = await userService.updateUserRole(
          ownerActor,
          developerTargetUser.id,
          promoteToAdminInput,
        );

        expect(result).toEqual(promotedToAdminUser);
        expect(mockUserRepository.updateUserWorkspaceRoleById).toHaveBeenCalledWith(
          developerTargetUser.id,
          promoteToAdminInput.workspaceRoleId,
        );
      });

      it('demotes a Workspace Admin to Developer and returns the updated user', async () => {
        mockUserRepository.getUserById.mockResolvedValue(adminTargetUser);
        mockUserRepository.updateUserWorkspaceRoleById.mockResolvedValue(demotedToDeveloperUser);

        const result = await userService.updateUserRole(
          ownerActor,
          adminTargetUser.id,
          demoteToDeveloperInput,
        );

        expect(result).toEqual(demotedToDeveloperUser);
        expect(mockUserRepository.updateUserWorkspaceRoleById).toHaveBeenCalledWith(
          adminTargetUser.id,
          demoteToDeveloperInput.workspaceRoleId,
        );
      });

      it('returns the target unchanged and does not persist when the requested role equals the current role (idempotent no-op)', async () => {
        const result = await userService.updateUserRole(ownerActor, developerTargetUser.id, {
          workspaceRoleId: developerTargetUser.workspaceRoleId,
        });

        expect(result).toBe(developerTargetUser);
        expect(mockUserRepository.updateUserWorkspaceRoleById).not.toHaveBeenCalled();
      });

      it('updates the role of a target whose account has not yet been activated', async () => {
        mockUserRepository.getUserById.mockResolvedValue(pendingDeveloperTargetUser);
        mockUserRepository.updateUserWorkspaceRoleById.mockResolvedValue(promotedPendingUser);

        const result = await userService.updateUserRole(
          ownerActor,
          pendingDeveloperTargetUser.id,
          promoteToAdminInput,
        );

        expect(result).toEqual(promotedPendingUser);
        expect(mockUserRepository.updateUserWorkspaceRoleById).toHaveBeenCalledWith(
          pendingDeveloperTargetUser.id,
          promoteToAdminInput.workspaceRoleId,
        );
      });
    });

    describe('on authorization failure', () => {
      it('throws AuthorizationError and performs no reads or writes when the guard rejects the actor', async () => {
        mockAuthorizationGuard.authorize.mockImplementation(() => {
          throw new AuthorizationError();
        });

        await expect(
          userService.updateUserRole(ownerActor, developerTargetUser.id, promoteToAdminInput),
        ).rejects.toThrow(AuthorizationError);

        expect(mockAuthorizationGuard.authorize).toHaveBeenCalledWith({
          actor: ownerActor,
          scope: AuthorizationScope.Workspace,
          action: 'updateUserRole',
        });
        expect(mockUserRepository.getUserById).not.toHaveBeenCalled();
        expect(mockUserRepository.updateUserWorkspaceRoleById).not.toHaveBeenCalled();
      });
    });

    describe('on target lookup failures', () => {
      it('throws ResourceNotFoundError and does not persist when the target user does not exist', async () => {
        mockUserRepository.getUserById.mockResolvedValue(null);

        await expect(
          userService.updateUserRole(ownerActor, TARGET_USER_ID, promoteToAdminInput),
        ).rejects.toThrow(ResourceNotFoundError);

        expect(mockUserRepository.updateUserWorkspaceRoleById).not.toHaveBeenCalled();
      });

      it('throws AuthorizationError and does not persist when the target currently holds the Workspace Owner role', async () => {
        mockUserRepository.getUserById.mockResolvedValue(ownerTargetUser);

        await expect(
          userService.updateUserRole(ownerActor, ownerTargetUser.id, promoteToAdminInput),
        ).rejects.toThrow(AuthorizationError);

        expect(mockUserRepository.updateUserWorkspaceRoleById).not.toHaveBeenCalled();
      });
    });

    describe('on requested-role validation failures', () => {
      it('throws BusinessRuleViolationError and does not persist when the requested role does not exist', async () => {
        await expect(
          userService.updateUserRole(ownerActor, developerTargetUser.id, assignUnknownRoleInput),
        ).rejects.toThrow(BusinessRuleViolationError);

        expect(mockUserRepository.updateUserWorkspaceRoleById).not.toHaveBeenCalled();
      });

      it('throws BusinessRuleViolationError and does not persist when the requested role is the Workspace Owner role', async () => {
        await expect(
          userService.updateUserRole(ownerActor, developerTargetUser.id, assignOwnerInput),
        ).rejects.toThrow(BusinessRuleViolationError);

        expect(mockUserRepository.updateUserWorkspaceRoleById).not.toHaveBeenCalled();
      });
    });
  });
});
