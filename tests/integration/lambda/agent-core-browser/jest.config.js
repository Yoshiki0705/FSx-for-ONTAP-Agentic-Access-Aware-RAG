/**
 * Jest設定ファイル - Browser Lambda Function統合テスト
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
    '../../../../lambda/agent-core-browser/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  verbose: true,
  testTimeout: 120000, // ブラウザ操作は時間がかかるため120秒に設定
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
};
