/**
 * AgentModeSidebar テストスイート エクスポート
 * 
 * 機能:
 * - テストファイルの統一エクスポート
 * - テストスイートの構造化
 */

// 基本テスト
export { default as BasicTests } from './AgentModeSidebar.test';

// エラーハンドリングテスト  
export { default as ErrorTests } from './AgentModeSidebar.error.test';

// パフォーマンステスト
export { default as PerformanceTests } from './AgentModeSidebar.performance.test';

// 統合テスト（元ファイル）
export { default as IntegrationTests } from '../AgentModeSidebar.integration.test';