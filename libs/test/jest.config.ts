import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  displayName: 'services',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/index.ts',
  ],
  coverageDirectory: './coverage',
  moduleNameMapper: {
    '^@libs/common(|/.*)$': '<rootDir>/../common/src/$1',
    '^@libs/common': '<rootDir>/../common'
  }
};

export default config;
