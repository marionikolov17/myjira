import { AuthorizationGuard } from './authorization-guard';
import { authorizationMatrix } from './authorization-matrix';

export * from './authorization.types';
export * from './authorization-matrix';
export * from './authorization-guard.interface';
export * from './authorization-guard';

export const authorizationGuard = new AuthorizationGuard(authorizationMatrix);
