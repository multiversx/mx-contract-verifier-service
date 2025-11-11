import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest'
  },
  moduleNameMapper: {
    // Libs mapping
    '^@libs/common(|/.*)$': '<rootDir>/libs/common/src/$1',
    '^@libs/common': '<rootDir>/libs/common',
    '^@libs/services(|/.*)$': '<rootDir>/libs/services/src/$1',
    '^@libs/services': '<rootDir>/libs/services',
    '^@libs/database(|/.*)$': '<rootDir>/libs/database/src/$1',
    '^@libs/database': '<rootDir>/libs/database',

    // Apps mapping
    '^apps/(.*)$': '<rootDir>/apps/$1',
    '^@queue-worker/(.*)$': '<rootDir>/apps/queue-worker/src/$1',
    '^@api/(.*)$': '<rootDir>/apps/api/src/$1',
  },
  roots: [
    '<rootDir>/apps',
    '<rootDir>/libs',
  ],
};

export default config;
