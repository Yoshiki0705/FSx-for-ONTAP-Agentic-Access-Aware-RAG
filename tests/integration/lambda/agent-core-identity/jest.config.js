/**
 * Jest設定ファイル - Identity Lambda Function統合テスト
 * 
 * @author Kiro AI
 * @date 2026-01-04
 * @version 1.0.0
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.integration.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        module: 'commonjs',
      },
      useESM: false,
    }],
  },
  extensionsToTreatAsEsm: [],
  collectCoverageFrom: [
    '../../../../lambda/agent-core-identity/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  verbose: true,
  testTimeout: 60000, // 統合テストは時間がかかるため60秒に設定
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
};
