/**
 * Jest Setup File
 * AWS SDK v3のモック設定を初期化
 */

// AWS認証情報のモック設定
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.AWS_SESSION_TOKEN = 'test-session-token';
process.env.AWS_REGION = 'ap-northeast-1';

// テスト環境変数
process.env.PROJECT_NAME = 'test-project';
process.env.ENVIRONMENT = 'test';
process.env.IDENTITY_TABLE_NAME = 'test-identity-table';
