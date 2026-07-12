import { UsersController } from './user.controller';

export * from './user.schema';
export * from './user.interface';
export * from './user.types';
export * from './user.repository';

const usersController = new UsersController();

export { usersController };
