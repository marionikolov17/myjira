import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { rateLimit, MINUTE } from 'express-rate-limit';
import { errorMiddleware, loggerRequestMiddleware } from '@/common/middlewares';
import { workspaceController } from '@/modules/workspace';
import { authController, authenticationMiddleware } from '@/modules/auth';
import { usersController } from '@/modules/users';
import { projectsController } from '@/modules/projects';
import { projectMemberController } from '@/modules/project-members';
import { issueController } from '@/modules/issues';
import openapiSpec from '../docs/openapi.json';

const app = express();

app.set('query parser', 'extended');

app.use(express.json());
app.use(
  rateLimit({
    windowMs: MINUTE * 1,
    max: 100,
    message: 'Too many requests, please try again later.',
  }),
);

app.use(loggerRequestMiddleware);

app.use(authenticationMiddleware);

app.use('/docs', swaggerUi.serve);
app.get('/docs', swaggerUi.setup(openapiSpec));

app.use('/api/v1/workspace', workspaceController.router);
app.use('/api/v1/auth', authController.router);
app.use('/api/v1/users', usersController.router);
app.use('/api/v1/projects', projectsController.router);
app.use('/api/v1/projects/:projectId/members', projectMemberController.router);
app.use('/api/v1/projects/:projectId/issues', issueController.router);

app.use(errorMiddleware);

export default app;
