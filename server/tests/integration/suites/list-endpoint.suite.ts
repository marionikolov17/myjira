import { describe, it, jest } from '@jest/globals';
import supertest from 'supertest';

import { Application } from 'express';

import { ActorContext } from '@/common/interfaces';
import { ITokenService } from '@/common/token-service/token-service.interface';
import { IWorkspaceRoleRepository, WorkspaceRoleName } from '@/modules/workspace-roles';

import { tokenFor } from '../fixtures/actor-context.fixtures';
import {
  expectAuthenticationRequired,
  expectForbiddenError,
  expectInternalServerError,
  expectValidationError,
} from '../assertions/errors.assertions';
import {
  expectDataIds,
  expectDataIdsInOrder,
  expectEmptyPaginatedEnvelope,
  expectPaginatedEnvelope,
} from '../assertions/list.assertions';

/**
 * Config consumed by {@link describeListEndpoint}.
 *
 * The suite only ever sees getter closures and probe descriptors so each spec
 * can seed its own population in its own `beforeAll` before any `it` body runs
 * — closures resolve lazily, so values that are `let`-assigned at seed time are
 * visible to the suite without extra wiring.
 */
export interface ListEndpointSuiteConfig {
  /** Full request path for the list endpoint, e.g. `/api/v1/users`. Drives the `describe` title. */
  path: string;
  /**
   * Optional: returns the fully resolved request path at test-run time (e.g.
   * `/api/v1/projects/${projectId}/issues` with a `projectId` resolved in the
   * spec's `beforeAll`). When set, the suite uses this value as the GET URL
   * for every request. When omitted, the eager {@link path} is used both for
   * the title and for the request.
   */
  getRuntimePath?(): string;
  /** Returns the fully wired Express app whose pipeline mirrors production. */
  getApp(): Application;
  /** Returns the token service wired into the authentication middleware. */
  getTokenService(): ITokenService;

  /** Total number of rows visible to {@link getDefaultActor} in the seeded population. */
  totalItems: number;
  /**
   * Page size used by the "known population" page-1 / final-page assertions.
   * Does NOT need to equal {@link defaults.pageSize}; it's just the size the
   * suite will request to make the pagination arithmetic deterministic.
   */
  pageSize: number;
  /** Pagination defaults the resource's `QueryConfig` applies when neither `page` nor `pageSize` is supplied. */
  defaults: { page: number; pageSize: number };

  /**
   * Default actor used by every envelope / defaults / sort / filter / validation
   * / 500 case. Must see the full seeded population (i.e. not a scoped actor).
   */
  getDefaultActor(): ActorContext;

  /**
   * Authorized-actor matrix: one 200 per entry. When `expectedIds` is set, the
   * suite additionally asserts `expectDataIds` and that the pagination total
   * matches — use this to prove per-actor scoping (e.g. a Developer who only
   * sees projects they're a member of).
   */
  getAuthorizedActorMatrix(): {
    label: string;
    actor: ActorContext;
    expectedIds?: string[];
  }[];

  /** Single representative filter probe (one operator on one field). */
  getFilterProbe(): {
    label: string;
    query: Record<string, string>;
    expectedIds: string[];
  };

  /** Query string that must match zero rows for the default actor. */
  getEmptyEnvelopeQuery(): Record<string, string>;

  /**
   * Single representative sort probe. The expected order is read from Prisma
   * (DB truth) so the suite can assert end-to-end ordering without
   * re-implementing the resource's secondary-key tiebreaker.
   */
  getSortProbe(): {
    query: Record<string, string>;
    getExpectedIdsInOrder(): Promise<string[]>;
  };

  /** Single representative 400 probe proving the parser is wired to this resource's `QueryConfig`. */
  validationProbe: { query: Record<string, unknown>; expectedFields: string[] };

  /**
   * Returns the workspace-role repository instance wired into the
   * authentication middleware. The suite spies on `getWorkspaceRoleById` to
   * poison the default actor's resolved role name and prove the authorization
   * guard rejects unknown roles with a 403.
   */
  getWorkspaceRoleRepository(): IWorkspaceRoleRepository;

  /**
   * Arranges a repository failure so the list service surfaces a 500. The
   * resource picks the exact method to spy on (e.g.
   * `jest.spyOn(ctx.userRepository, 'findUsers').mockRejectedValue(...)`).
   */
  arrangeRepositoryFailure(): void;
}

/**
 * Emits a fixed, minimal integration spec for a resource's `GET /` list
 * endpoint that proves the generic `queryParser` + list controller plumbing is
 * wired to the resource's `QueryConfig`.
 *
 * The exhaustive matrix for pagination arithmetic, filter operator coverage,
 * sort tiebreak rules, and validation surface area lives in the query-parser
 * unit tests. Here we assert end-to-end wiring once per resource and keep the
 * structure identical across resources.
 *
 * Emitted describe tree (names are stable and shared across resources):
 *
 * - `on success` — first page envelope, partial final page, defaults, empty
 *   envelope on an unmatching filter.
 * - `on authorized actors` — one 200 per entry in the matrix, with scoping
 *   assertions when `expectedIds` is set.
 * - `on filtering (end-to-end)` — single probe.
 * - `on sorting (end-to-end)` — single probe, oracle from Prisma.
 * - `on query-validation failure (400)` — single probe.
 * - `on unauthenticated request (401)` — no token.
 * - `on authorization failures (403)` — workspace-role spy returns an
 *   unsupported role name.
 * - `on unexpected dependency failure (500)` — resource-provided repository
 *   failure.
 *
 * Relies on the global `afterEach` `jest.restoreAllMocks()` in
 * `tests/integration/setup-after-env.ts` to clean up spies between cases.
 */
export function describeListEndpoint(config: ListEndpointSuiteConfig): void {
  describe(`GET ${config.path}`, () => {
    const { path, totalItems, pageSize, defaults, validationProbe } = config;
    const expectedTotalPages = Math.ceil(totalItems / pageSize);

    function listRequest(
      query?: Record<string, unknown>,
      authorizationHeader?: string,
    ): supertest.Test {
      const requestPath = config.getRuntimePath ? config.getRuntimePath() : path;
      let request = supertest(config.getApp()).get(requestPath);

      if (authorizationHeader !== undefined) {
        request = request.set('Authorization', authorizationHeader);
      }

      if (query) {
        request = request.query(query);
      }

      return request;
    }

    function headerForDefaultActor(): string {
      return tokenFor(config.getTokenService(), config.getDefaultActor());
    }

    describe('on success', () => {
      it('returns the envelope on the first page with correct totals', async () => {
        const response = await listRequest(
          { page: '1', pageSize: String(pageSize) },
          headerForDefaultActor(),
        );

        expectPaginatedEnvelope(response, {
          page: 1,
          pageSize,
          totalItems,
          totalPages: expectedTotalPages,
          dataLength: Math.min(pageSize, totalItems),
        });
      });

      it('returns a partial final page from skip/take', async () => {
        const remainder = totalItems - (expectedTotalPages - 1) * pageSize;

        const response = await listRequest(
          { page: String(expectedTotalPages), pageSize: String(pageSize) },
          headerForDefaultActor(),
        );

        expectPaginatedEnvelope(response, {
          page: expectedTotalPages,
          pageSize,
          totalItems,
          totalPages: expectedTotalPages,
          dataLength: remainder,
        });
      });

      it('applies the query-config defaults (page, pageSize) when neither is supplied', async () => {
        const response = await listRequest(undefined, headerForDefaultActor());

        expectPaginatedEnvelope(response, {
          page: defaults.page,
          pageSize: defaults.pageSize,
        });
      });

      it('returns an empty envelope with zeroed totals when a filter matches nothing', async () => {
        const response = await listRequest(config.getEmptyEnvelopeQuery(), headerForDefaultActor());

        expectEmptyPaginatedEnvelope(response);
      });
    });

    describe('on authorized actors', () => {
      // Resolve the matrix lazily inside the it body so the spec's `beforeAll`
      // has already built the actors by the time Jest runs each case.
      it('returns 200 (and expected rows when scoped) for every authorized actor', async () => {
        const matrix = config.getAuthorizedActorMatrix();

        for (const entry of matrix) {
          const response = await listRequest(
            { pageSize: '100' },
            tokenFor(config.getTokenService(), entry.actor),
          );

          if (entry.expectedIds !== undefined) {
            expectPaginatedEnvelope(response, { totalItems: entry.expectedIds.length });
            expectDataIds(response, entry.expectedIds);
          } else {
            expectPaginatedEnvelope(response);
          }
        }
      });
    });

    describe('on filtering (end-to-end)', () => {
      it('returns exactly the matching rows for the resource filter probe', async () => {
        const probe = config.getFilterProbe();

        const response = await listRequest(probe.query, headerForDefaultActor());

        expectDataIds(response, probe.expectedIds);
      });
    });

    describe('on sorting (end-to-end)', () => {
      it('orders rows per the resource sort probe (vs. DB truth)', async () => {
        const probe = config.getSortProbe();
        const expectedIds = await probe.getExpectedIdsInOrder();

        const response = await listRequest(probe.query, headerForDefaultActor());

        expectDataIdsInOrder(response, expectedIds);
      });
    });

    describe('on query-validation failure (400)', () => {
      it('surfaces the parser ValidationError with the offending field', async () => {
        const response = await listRequest(validationProbe.query, headerForDefaultActor());

        expectValidationError(response, validationProbe.expectedFields);
      });
    });

    describe('on unauthenticated request (401)', () => {
      it('returns an authentication required error', async () => {
        const response = await listRequest();

        expectAuthenticationRequired(response);
      });
    });

    describe('on authorization failures (403)', () => {
      it("returns 403 when the actor's workspace role is not in the list matrix", async () => {
        const defaultActor = config.getDefaultActor();
        const unsupportedWorkspaceRoleName = 'Viewer' as WorkspaceRoleName;

        jest.spyOn(config.getWorkspaceRoleRepository(), 'getWorkspaceRoleById').mockResolvedValue({
          id: defaultActor.workspaceRole.id,
          name: unsupportedWorkspaceRoleName,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const response = await listRequest(undefined, headerForDefaultActor());

        expectForbiddenError(response);
      });
    });

    describe('on unexpected dependency failure (500)', () => {
      it('returns an internal server error when the list repository throws', async () => {
        config.arrangeRepositoryFailure();

        const response = await listRequest(undefined, headerForDefaultActor());

        expectInternalServerError(response);
      });
    });
  });
}
