import express from 'express';
import { workspaceController } from '@/modules/workspace';
import { errorMiddleware, loggerRequestMiddleware } from '@/common/middlewares';

const app = express();

app.use(express.json());

app.use(loggerRequestMiddleware);

app.use('/api/v1/workspace', workspaceController.router);

app.use(errorMiddleware);

export default app;
