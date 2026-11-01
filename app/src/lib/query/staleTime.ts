/** Detail entities change rarely enough to keep a longer cache. */
export const DETAIL_STALE_TIME_MS = 5 * 60_000;

/** Role catalogs are effectively static for a session. */
export const ROLES_STALE_TIME_MS = 10 * 60_000;

/** Actor context changes on token refresh */
export const ME_STALE_TIME_MS = 60_000;
