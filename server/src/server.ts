import app from './app';
import { env } from './config/env';
import { logger } from './common/logger';

app.listen(env.PORT, () => {
  logger.info(`Server is listening on PORT ${env.PORT}`, { port: env.PORT });
});
