/** @type {import("jest").Config} **/
export const testEnvironment = 'node';
export const transform = {
  '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json', useESM: true }],
};
export const moduleNameMapper = {
  '^@/(.*)$': '<rootDir>/src/$1',
};
export const setupFiles = ['<rootDir>/tests/setup.ts'];
export const extensionsToTreatAsEsm = ['.ts', '.tsx'];
