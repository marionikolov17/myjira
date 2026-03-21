import { AppError } from './app-error';
import { ErrorCodes } from './error-codes';
import { IResource } from './error.interface';

export class ResourceNotFoundError extends AppError {
  constructor(resource: IResource) {
    super(`${resource.resourceName} not found`, ErrorCodes.RESOURCE_NOT_FOUND, 404);
    this.details = { resource };
  }
}
