import express, { Application, Router } from 'express';
import { authenticationMiddleware } from '@/modules/auth';
import { errorMiddleware } from '../middlewares';

export function createTestApp(router: Router): Application {
  const testApp = express();

  testApp.use(express.json());

  testApp.use(authenticationMiddleware);

  testApp.use(router);
  testApp.use(errorMiddleware);

  return testApp;
}
