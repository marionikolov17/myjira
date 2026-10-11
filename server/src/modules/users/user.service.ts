import { ActorContext } from '@/common/interfaces';
import { ILogger } from '@/common/logger';
import {
  AuthorizationError,
  BusinessRuleViolationError,
  ResourceNotFoundError,
} from '@/common/errors';
import { IActivationTokenService } from '@/common/activation-token';
import { AuthorizationScope, IAuthorizationGuard } from '@/common/authorization';
import { QueryOptions } from '@/common/query';
import { IWorkspaceRoleRepository, WorkspaceRoleName } from '@/modules/workspace-roles';
import { IUserRepository, IUserService } from './user.interface';
import { CreateUserResult, ListUsersResult, UserServiceConfig } from './user.types';
import { CreateUserRequestParams, UpdateUserRoleRequestParams, User } from './user.schema';

export class UserService implements IUserService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly workspaceRoleRepository: IWorkspaceRoleRepository,
    private readonly authorizationGuard: IAuthorizationGuard,
    private readonly activationTokenService: IActivationTokenService,
    private readonly logger: ILogger,
    private readonly config: UserServiceConfig,
  ) {}

  public async createUser(
    actor: ActorContext,
    params: CreateUserRequestParams,
  ): Promise<CreateUserResult> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Workspace,
      action: 'createUser',
    });

    await this.assertAssignableRole(params.workspaceRoleId);

    const activationToken = this.activationTokenService.generate();

    const user = await this.userRepository.createUser({
      name: params.name,
      email: params.email,
      workspaceRoleId: params.workspaceRoleId,
      activationTokenHash: activationToken.tokenHash,
      activationTokenExpiresAt: activationToken.expiresAt,
    });

    this.logger.info('Workspace user created', { userId: user.id, status: user.status });

    return {
      user,
      activation: {
        url: this.buildActivationUrl(activationToken.token),
        expiresAt: activationToken.expiresAt,
      },
    };
  }

  private async assertAssignableRole(workspaceRoleId: string): Promise<void> {
    const workspaceRole = await this.workspaceRoleRepository.getWorkspaceRoleById(workspaceRoleId);

    if (!workspaceRole) {
      this.logger.warn('Workspace user creation rejected: unknown workspace role', {
        workspaceRoleId,
      });
      throw new BusinessRuleViolationError('The specified workspace role does not exist');
    }

    if (workspaceRole.name === WorkspaceRoleName.OWNER) {
      this.logger.warn('Workspace user creation rejected: Owner role cannot be assigned', {
        workspaceRoleId,
      });
      throw new BusinessRuleViolationError(
        'The Workspace Owner role cannot be assigned to a workspace user',
      );
    }
  }

  private buildActivationUrl(token: string): string {
    const url = new URL(this.config.activationUrlBase);
    url.searchParams.set('token', token);
    return url.toString();
  }

  public async listUsers(actor: ActorContext, options: QueryOptions): Promise<ListUsersResult> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Workspace,
      action: 'listUsers',
    });

    return this.userRepository.findUsers(options);
  }

  public async updateUserRole(
    actor: ActorContext,
    userId: string,
    params: UpdateUserRoleRequestParams,
  ): Promise<User> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Workspace,
      action: 'updateUserRole',
    });

    const target = await this.userRepository.getUserById(userId);

    if (!target) {
      this.logger.warn('Workspace user role update rejected: target user not found', { userId });
      throw new ResourceNotFoundError({
        resourceName: this.userRepository.resourceName,
      });
    }

    const targetCurrentRole = await this.workspaceRoleRepository.getWorkspaceRoleById(
      target.workspaceRoleId,
    );

    if (targetCurrentRole?.name === WorkspaceRoleName.OWNER) {
      this.logger.warn('Workspace user role update rejected: target user is the Workspace Owner', {
        userId: target.id,
      });
      throw new AuthorizationError();
    }

    await this.assertAssignableRole(params.workspaceRoleId);

    if (target.workspaceRoleId === params.workspaceRoleId) {
      this.logger.info('Workspace user role update is a no-op: requested role matches current', {
        userId: target.id,
        workspaceRoleId: target.workspaceRoleId,
      });
      return target;
    }

    const updated = await this.userRepository.updateUserWorkspaceRoleById(
      target.id,
      params.workspaceRoleId,
    );

    this.logger.info('Workspace user role updated', {
      userId: updated.id,
      from: target.workspaceRoleId,
      to: updated.workspaceRoleId,
    });

    return updated;
  }
}
