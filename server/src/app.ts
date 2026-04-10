import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { errorMiddleware, loggerRequestMiddleware } from '@/common/middlewares';
import { workspaceController } from '@/modules/workspace';
import openapiSpec from '../docs/openapi.json';

const app = express();

app.use(express.json());

app.use(loggerRequestMiddleware);

app.use('/docs', swaggerUi.serve);
app.get('/docs', swaggerUi.setup(openapiSpec));

app.use('/api/v1/workspace', workspaceController.router);

app.use(errorMiddleware);

export default app;
