import { AuthorizeInput } from './authorization.types';

export interface IAuthorizationGuard {
  authorize(input: AuthorizeInput): void;
}
