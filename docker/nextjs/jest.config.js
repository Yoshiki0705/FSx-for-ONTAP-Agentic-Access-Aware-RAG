/**
 * Jest設定ファイル - Permission-aware RAG System
 * 
 * 機能:
 * - TypeScript対応
 * - Next.js環境設定
 * - テストカバレッジ設定
 * - モック設定
 */

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Next.jsアプリのパスを指定
  dir: './',
});

// Jestのカスタム設定
const customJestConfig = {
  // テスト環境の設定
  testEnvironment: 'jsdom',
  
  // セットアップファイル
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // モジュール名マッピング（TypeScriptのパスエイリアス対応）
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  // テストファイルのパターン
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],
  
  // 無視するファイル・ディレクトリ
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/coverage/',
    '<rootDir>/dist/',
  ],
  
  // 変換対象外のファイル
  transformIgnorePatterns: [
    '/node_modules/',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  
  // カバレッジ設定
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/*.spec.{js,jsx,ts,tsx}',
    '!src/pages/_app.tsx',
    '!src/pages/_document.tsx',
  ],
  
  // カバレッジレポート形式
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary',
  ],
  
  // カバレッジ閾値
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // 特定ファイルの閾値設定
    './src/hooks/useAgentInfoNormalization.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/utils/agent-validation.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  
  // カバレッジ出力ディレクトリ
  coverageDirectory: 'coverage',
  
  // テスト結果の詳細表示
  verbose: true,
  
  // 並列実行の設定
  maxWorkers: '50%',
  
  // テストタイムアウト（ミリ秒）
  testTimeout: 10000,
  
  // グローバル変数の設定
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
  
  // モック設定
  clearMocks: true,
  restoreMocks: true,
  
  // エラー時の詳細表示
  errorOnDeprecated: true,
  
  // 警告の表示設定
  silent: false,
  
  // テスト実行前後のフック
  globalSetup: undefined,
  globalTeardown: undefined,
  
  // ウォッチモードの設定
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/coverage/',
  ],
  
  // スナップショットの設定
  snapshotSerializers: [],
  
  // レポーター設定
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'coverage',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true,
      },
    ],
  ],
};

// Next.js設定とマージしてエクスポート
module.exports = createJestConfig(customJestConfig);