import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/types/**/*.ts',
    '!src/**/*.entity.ts',
    '!src/**/index.ts',
    '!src/modules/simulator/test-simulator.ts',
  ],
  coveragePathIgnorePatterns: ['[\\/]{1}src[\\/].+\\.module\\.ts$', '[\\/]{1}src[\\/]types[\\/]'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^test/(.*)$': '<rootDir>/test/$1',
  },
};

export default config;
