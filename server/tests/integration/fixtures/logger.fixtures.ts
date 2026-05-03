import { ILogger } from '@/common/logger';

export const silentLogger: ILogger = {
  error: () => {
    return;
  },
  warn: () => {
    return;
  },
  info: () => {
    return;
  },
  http: () => {
    return;
  },
  debug: () => {
    return;
  },
};
