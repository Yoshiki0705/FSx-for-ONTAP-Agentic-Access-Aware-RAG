/**
 * Code Interpreter統合テスト - セットアップファイル
 * 
 * テスト実行前の環境設定を行います。
 * 
 * @author Kiro AI
 * @date 2026-01-04
 */

// 環境変数設定
process.env.PROJECT_NAME = process.env.PROJECT_NAME || 'permission-aware-rag';
process.env.ENVIRONMENT = process.env.ENVIRONMENT || 'test';
process.env.AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1';
process.env.FSX_S3_ACCESS_POINT_ARN = process.env.FSX_S3_ACCESS_POINT_ARN || '';
process.env.EXECUTION_TIMEOUT = process.env.EXECUTION_TIMEOUT || '60';
process.env.MEMORY_LIMIT = process.env.MEMORY_LIMIT || '512';
process.env.ALLOWED_PACKAGES = process.env.ALLOWED_PACKAGES || '["numpy", "pandas", "matplotlib", "scipy"]';
process.env.ALLOW_NETWORK_ACCESS = process.env.ALLOW_NETWORK_ACCESS || 'false';
process.env.SESSION_TIMEOUT = process.env.SESSION_TIMEOUT || '3600';
process.env.MAX_CONCURRENT_SESSIONS = process.env.MAX_CONCURRENT_SESSIONS || '10';

console.log('Code Interpreter統合テスト環境設定完了');
console.log('PROJECT_NAME:', process.env.PROJECT_NAME);
console.log('ENVIRONMENT:', process.env.ENVIRONMENT);
console.log('AWS_REGION:', process.env.AWS_REGION);
console.log('EXECUTION_TIMEOUT:', process.env.EXECUTION_TIMEOUT);
console.log('MAX_CONCURRENT_SESSIONS:', process.env.MAX_CONCURRENT_SESSIONS);
