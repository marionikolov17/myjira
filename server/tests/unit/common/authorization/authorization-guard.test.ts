import { beforeEach, describe, expect, it } from '@jest/globals';

import { AuthorizationError } from '@/common/errors';
import { IAuthorizationGuard } from '@/common/authorization';
import { AuthorizationGuard } from '@/common/authorization';
import { AuthorizationScope } from '@/common/authorization';
import { AuthorizeInput } from '@/common/authorization';
import { WorkspaceRoleName } from '@/modules/workspace-roles';
import { ProjectRoleName } from '@/modules/project-members';

import {
  OTHER_PROJECT_ID,
  PROJECT_ID,
  buildMockActor,
  buildMockProjectRole,
  testAuthorizationMatrix,
} from './authorization-guard.mock';

describe('AuthorizationGuard', () => {
  let authorizationGuard: IAuthorizationGuard;

  beforeEach(() => {
    authorizationGuard = new AuthorizationGuard(testAuthorizationMatrix);
  });

  describe('authorize', () => {
    describe('workspace scope', () => {
      it.each([
        { case: 'Owner', workspaceRoleName: WorkspaceRoleName.OWNER },
        { case: 'Admin', workspaceRoleName: WorkspaceRoleName.ADMIN },
      ])('should permit a $case for a configured workspace action', ({ workspaceRoleName }) => {
        const actor = buildMockActor({ workspaceRoleName });

        expect(
          authorizationGuard.authorize({
            actor,
            scope: AuthorizationScope.Workspace,
            action: 'createUser',
          }),
        ).toBeUndefined();
      });

      it('should deny a workspace role that is not in the allowed list', () => {
        const actor = buildMockActor({ workspaceRoleName: WorkspaceRoleName.DEVELOPER });

        expect(() =>
          authorizationGuard.authorize({
            actor,
            scope: AuthorizationScope.Workspace,
            action: 'createUser',
          }),
        ).toThrow(AuthorizationError);
      });

      it('should deny an unconfigured workspace action for any role', () => {
        const actor = buildMockActor({ workspaceRoleName: WorkspaceRoleName.OWNER });

        expect(() =>
          authorizationGuard.authorize({
            actor,
            scope: AuthorizationScope.Workspace,
            action: 'updateUserRole',
          }),
        ).toThrow(AuthorizationError);
      });
    });

    describe('project scope', () => {
      it('should permit a member whose project role is in the allowed list', () => {
        const actor = buildMockActor({
          projectRoles: [buildMockProjectRole(ProjectRoleName.PROJECT_ADMIN)],
        });

        expect(
          authorizationGuard.authorize({
            actor,
            scope: AuthorizationScope.Project,
            action: 'addProjectMember',
            resource: PROJECT_ID,
          }),
        ).toBeUndefined();
      });

      it('should permit a member for an action allowed to every project role', () => {
        const actor = buildMockActor({
          projectRoles: [buildMockProjectRole(ProjectRoleName.DEVELOPER)],
        });

        expect(
          authorizationGuard.authorize({
            actor,
            scope: AuthorizationScope.Project,
            action: 'createIssue',
            resource: PROJECT_ID,
          }),
        ).toBeUndefined();
      });

      it('should deny a member whose project role is not in the allowed list', () => {
        const actor = buildMockActor({
          projectRoles: [buildMockProjectRole(ProjectRoleName.DEVELOPER)],
        });

        expect(() =>
          authorizationGuard.authorize({
            actor,
            scope: AuthorizationScope.Project,
            action: 'addProjectMember',
            resource: PROJECT_ID,
          }),
        ).toThrow(AuthorizationError);
      });

      it('should deny an actor with no project role for the target project', () => {
        const actor = buildMockActor({
          projectRoles: [buildMockProjectRole(ProjectRoleName.PROJECT_OWNER, OTHER_PROJECT_ID)],
        });

        expect(() =>
          authorizationGuard.authorize({
            actor,
            scope: AuthorizationScope.Project,
            action: 'addProjectMember',
            resource: PROJECT_ID,
          }),
        ).toThrow(AuthorizationError);
      });

      it('should deny when the target project identifier is empty', () => {
        const actor = buildMockActor({
          projectRoles: [buildMockProjectRole(ProjectRoleName.PROJECT_OWNER)],
        });

        expect(() =>
          authorizationGuard.authorize({
            actor,
            scope: AuthorizationScope.Project,
            action: 'addProjectMember',
            resource: '',
          }),
        ).toThrow(AuthorizationError);
      });

      it('should deny an unconfigured project action for any project role', () => {
        const actor = buildMockActor({
          projectRoles: [buildMockProjectRole(ProjectRoleName.PROJECT_OWNER)],
        });

        expect(() =>
          authorizationGuard.authorize({
            actor,
            scope: AuthorizationScope.Project,
            action: 'updateProjectRole',
            resource: PROJECT_ID,
          }),
        ).toThrow(AuthorizationError);
      });

      describe('workspaceBypass', () => {
        it.each([
          { case: 'Workspace Owner', workspaceRoleName: WorkspaceRoleName.OWNER },
          { case: 'Workspace Admin', workspaceRoleName: WorkspaceRoleName.ADMIN },
        ])(
          'should permit a $case bypass regardless of project membership',
          ({ workspaceRoleName }) => {
            const actor = buildMockActor({ workspaceRoleName, projectRoles: [] });

            expect(
              authorizationGuard.authorize({
                actor,
                scope: AuthorizationScope.Project,
                action: 'getProjectById',
                resource: PROJECT_ID,
              }),
            ).toBeUndefined();
          },
        );

        it('should permit a workspaceBypass actor even when their project role would be denied', () => {
          const actor = buildMockActor({
            workspaceRoleName: WorkspaceRoleName.ADMIN,
            // `DEVELOPER` is NOT in `getProjectById`'s projectRoles.
            projectRoles: [buildMockProjectRole(ProjectRoleName.DEVELOPER)],
          });

          expect(
            authorizationGuard.authorize({
              actor,
              scope: AuthorizationScope.Project,
              action: 'getProjectById',
              resource: PROJECT_ID,
            }),
          ).toBeUndefined();
        });

        it('should fall through to the project-role check when the workspace role is not in bypass', () => {
          const actor = buildMockActor({
            workspaceRoleName: WorkspaceRoleName.DEVELOPER,
            projectRoles: [buildMockProjectRole(ProjectRoleName.PROJECT_ADMIN)],
          });

          expect(
            authorizationGuard.authorize({
              actor,
              scope: AuthorizationScope.Project,
              action: 'getProjectById',
              resource: PROJECT_ID,
            }),
          ).toBeUndefined();
        });

        it('should deny when the workspace role is not in bypass and the project role is not allowed', () => {
          const actor = buildMockActor({
            workspaceRoleName: WorkspaceRoleName.DEVELOPER,
            projectRoles: [buildMockProjectRole(ProjectRoleName.DEVELOPER)],
          });

          expect(() =>
            authorizationGuard.authorize({
              actor,
              scope: AuthorizationScope.Project,
              action: 'getProjectById',
              resource: PROJECT_ID,
            }),
          ).toThrow(AuthorizationError);
        });

        it('should deny a non-member when the workspace role is not in bypass', () => {
          const actor = buildMockActor({
            workspaceRoleName: WorkspaceRoleName.DEVELOPER,
            projectRoles: [],
          });

          expect(() =>
            authorizationGuard.authorize({
              actor,
              scope: AuthorizationScope.Project,
              action: 'getProjectById',
              resource: PROJECT_ID,
            }),
          ).toThrow(AuthorizationError);
        });

        it('should preserve old deny-when-not-member behavior for a config without bypass (object shape)', () => {
          const actor = buildMockActor({
            workspaceRoleName: WorkspaceRoleName.OWNER,
            projectRoles: [],
          });

          expect(() =>
            authorizationGuard.authorize({
              actor,
              scope: AuthorizationScope.Project,
              action: 'deleteProject',
              resource: PROJECT_ID,
            }),
          ).toThrow(AuthorizationError);
        });

        it('should permit via project role for a config without bypass (object shape)', () => {
          const actor = buildMockActor({
            workspaceRoleName: WorkspaceRoleName.DEVELOPER,
            projectRoles: [buildMockProjectRole(ProjectRoleName.PROJECT_OWNER)],
          });

          expect(
            authorizationGuard.authorize({
              actor,
              scope: AuthorizationScope.Project,
              action: 'deleteProject',
              resource: PROJECT_ID,
            }),
          ).toBeUndefined();
        });

        it('should preserve old array-shape behavior (no bypass considered) for a workspace Owner on a project they do not belong to', () => {
          const actor = buildMockActor({
            workspaceRoleName: WorkspaceRoleName.OWNER,
            projectRoles: [],
          });

          expect(() =>
            authorizationGuard.authorize({
              actor,
              scope: AuthorizationScope.Project,
              action: 'addProjectMember',
              resource: PROJECT_ID,
            }),
          ).toThrow(AuthorizationError);
        });

        it('should not consult workspaceBypass for workspace-scope actions', () => {
          // `createUser` is a workspace-scope action; bypass is irrelevant.
          const actor = buildMockActor({ workspaceRoleName: WorkspaceRoleName.DEVELOPER });

          expect(() =>
            authorizationGuard.authorize({
              actor,
              scope: AuthorizationScope.Workspace,
              action: 'createUser',
            }),
          ).toThrow(AuthorizationError);
        });
      });
    });

    describe('unknown scope', () => {
      it('should deny an authorization scope that is not recognized', () => {
        const actor = buildMockActor({ workspaceRoleName: WorkspaceRoleName.OWNER });

        expect(() =>
          authorizationGuard.authorize({
            actor,
            scope: 'unknown',
            action: 'createUser',
          } as unknown as AuthorizeInput),
        ).toThrow(AuthorizationError);
      });
    });
  });
});
