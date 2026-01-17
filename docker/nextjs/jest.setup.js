// Jest セットアップファイル
// 高度権限制御システムテスト用設定

// グローバルモック設定
global.fetch = jest.fn();

// Next.js環境変数モック
process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'ap-northeast-1';
process.env.PERMISSION_FILTER_FUNCTION_NAME = 'test-permission-filter';
process.env.AUDIT_LOG_FUNCTION_NAME = 'test-audit-log';

// コンソール出力の制御（テスト時のノイズ削減）
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// テスト後のクリーンアップ
afterEach(() => {
  jest.clearAllMocks();
});