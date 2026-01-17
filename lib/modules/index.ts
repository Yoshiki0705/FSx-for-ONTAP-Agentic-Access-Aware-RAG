/**
 * Modular Architecture Index
 * モジュラーアーキテクチャ統合インデックス
 * 
 * 9つの機能別モジュールの統合エクスポート
 */

// 機能別モジュール
export * from './networking';
export * from './security';
export * from './storage';
export * from './database';
// // // // export * from './compute';
// // export * from './api'; // 競合: CognitoConfig, MonitoringConfig
// // export * from './ai'; // 競合: DatabaseConfig, SecurityConfig, FsxConfig, S3Config, MonitoringConfig
// // export * from './monitoring'; // 競合: MonitoringConfig
// // export * from './enterprise';

// 統合CDKスタック
// Note: スタックは lib/stacks/index.ts から提供されます
// export * from '../stacks/networking-stack';
// export * from '../stacks/security-stack';

// コンプライアンス機能
// // export * from '../compliance/compliance-mapper';