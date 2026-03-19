export const createError = (message: string, cause: { code: string; detail: string }): Error => {
  return new Error(message, { cause });
};
