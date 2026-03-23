import express from 'express';
import { systemController } from '@/modules/system';
import { errorMiddleware, loggerRequestMiddleware } from '@/common/middlewares';

const app = express();

app.use(express.json());

app.use(loggerRequestMiddleware);

app.use('/api/v1/system', systemController.router);

app.use(errorMiddleware);

export default app;
