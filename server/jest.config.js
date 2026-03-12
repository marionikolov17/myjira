/** @type {import("jest").Config} **/
export const testEnvironment = 'node';
export const transform = {
  '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
};
export const moduleNameMapper = {
  '^@/(.*)$': '<rootDir>/src/$1',
};
