/**
 * Jest設定ファイル
 * Code Interpreter Lambda関数の統合テスト用
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.integration.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  collectCoverageFrom: [
    '../../../../lambda/agent-core-code-interpreter/**/*.ts',
    '!../../../../lambda/agent-core-code-interpreter/**/*.test.ts',
    '!../../../../lambda/agent-core-code-interpreter/**/*.d.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testTimeout: 180000, // 3分（パッケージインストールテストのため）
  verbose: true,
};
