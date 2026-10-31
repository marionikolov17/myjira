/**
 * Public env surface for the web client. The HTTP transport points at the real backend
 * (defaults to the local dev server at port 5000); override via `NEXT_PUBLIC_API_BASE_URL`
 * for staging / production.
 */
export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5000/api/v1';

export const WORKSPACE_NAME = 'MyJira';
