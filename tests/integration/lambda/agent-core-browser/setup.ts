/**
 * Jest Setup File - Browser統合テスト用
 * 実際のAWS認証情報を使用
 */

// テスト環境変数（実際のAWSリソースを使用）
process.env.PROJECT_NAME = 'permission-aware-rag';
process.env.ENVIRONMENT = 'test';
process.env.SCREENSHOT_BUCKET = 'tokyoregion-permission-aware-rag-test-browser-screenshots';
process.env.AWS_REGION = 'ap-northeast-1';

// AWS認証情報は環境変数またはAWS CLIの設定から自動的に読み込まれる
console.log('Browser統合テスト環境設定完了');
console.log('S3バケット:', process.env.SCREENSHOT_BUCKET);
console.log('リージョン:', process.env.AWS_REGION);
