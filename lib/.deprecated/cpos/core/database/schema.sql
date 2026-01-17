-- CPOS Database Schema
-- 継続的プロジェクト整理システムのデータベーススキーマ

-- ファイルメタデータテーブル
CREATE TABLE IF NOT EXISTS file_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT UNIQUE NOT NULL,
    size INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    mime_type TEXT,
    category TEXT,
    created_at DATETIME NOT NULL,
    modified_at DATETIME NOT NULL,
    environment TEXT NOT NULL CHECK (environment IN ('local', 'ec2'))
);

-- ファイルパスのインデックス
CREATE INDEX IF NOT EXISTS idx_file_metadata_path ON file_metadata(path);
CREATE INDEX IF NOT EXISTS idx_file_metadata_environment ON file_metadata(environment);
CREATE INDEX IF NOT EXISTS idx_file_metadata_category ON file_metadata(category);

-- 同期状態テーブル
CREATE TABLE IF NOT EXISTS sync_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    local_checksum TEXT,
    remote_checksum TEXT,
    last_sync DATETIME,
    status TEXT NOT NULL CHECK (status IN ('synced', 'pending', 'conflict', 'error')),
    conflicts TEXT -- JSON形式の競合情報
);

-- 同期状態のインデックス
CREATE INDEX IF NOT EXISTS idx_sync_state_file_path ON sync_state(file_path);
CREATE INDEX IF NOT EXISTS idx_sync_state_status ON sync_state(status);

-- バックアップ履歴テーブル
CREATE TABLE IF NOT EXISTS backup_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_id TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('incremental', 'full', 'archive')),
    created_at DATETIME NOT NULL,
    size INTEGER NOT NULL,
    file_count INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('completed', 'failed', 'in_progress')),
    metadata TEXT -- JSON形式のメタデータ
);

-- バックアップ履歴のインデックス
CREATE INDEX IF NOT EXISTS idx_backup_history_backup_id ON backup_history(backup_id);
CREATE INDEX IF NOT EXISTS idx_backup_history_type ON backup_history(type);
CREATE INDEX IF NOT EXISTS idx_backup_history_created_at ON backup_history(created_at);

-- 処理ログテーブル
CREATE TABLE IF NOT EXISTS operation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
    started_at DATETIME NOT NULL,
    completed_at DATETIME,
    details TEXT, -- JSON形式の詳細情報
    error_message TEXT
);

-- 処理ログのインデックス
CREATE INDEX IF NOT EXISTS idx_operation_log_operation_type ON operation_log(operation_type);
CREATE INDEX IF NOT EXISTS idx_operation_log_status ON operation_log(status);
CREATE INDEX IF NOT EXISTS idx_operation_log_started_at ON operation_log(started_at);

-- 分類ルールテーブル（動的ルール管理用）
CREATE TABLE IF NOT EXISTS classification_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    pattern TEXT NOT NULL,
    content_patterns TEXT, -- JSON配列
    target_path TEXT NOT NULL,
    confidence REAL NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 分類ルールのインデックス
CREATE INDEX IF NOT EXISTS idx_classification_rules_enabled ON classification_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_classification_rules_confidence ON classification_rules(confidence);

-- プロジェクト構造定義テーブル
CREATE TABLE IF NOT EXISTS project_structure (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    purpose TEXT NOT NULL,
    required BOOLEAN DEFAULT 0,
    permissions TEXT DEFAULT '755',
    max_size INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- プロジェクト構造のインデックス
CREATE INDEX IF NOT EXISTS idx_project_structure_path ON project_structure(path);
CREATE INDEX IF NOT EXISTS idx_project_structure_required ON project_structure(required);

-- 設定テーブル（システム設定の永続化）
CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 設定のインデックス
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);

-- 初期データの挿入
INSERT OR IGNORE INTO system_config (key, value, description) VALUES
('schema_version', '1.0.0', 'データベーススキーマのバージョン'),
('last_maintenance', datetime('now'), '最後のメンテナンス実行時刻'),
('auto_classification', 'true', '自動分類機能の有効/無効');

-- デフォルトのプロジェクト構造定義
INSERT OR IGNORE INTO project_structure (path, purpose, required, permissions) VALUES
('lib', 'TypeScriptライブラリファイル', 1, '755'),
('lib/cpos', 'CPOS システムコア', 1, '755'),
('lib/cpos/core', 'コアモジュール', 1, '755'),
('lib/cpos/interfaces', 'インターフェース定義', 1, '755'),
('lib/cpos/models', 'データモデル', 1, '755'),
('lib/cpos/utils', 'ユーティリティ', 1, '755'),
('config', '設定ファイル', 1, '755'),
('docs', 'ドキュメント', 1, '755'),
('tests', 'テストファイル', 1, '755'),
('temp', '一時ファイル', 0, '755'),
('backups', 'バックアップファイル', 0, '755');

-- デフォルトの分類ルール
INSERT OR IGNORE INTO classification_rules (name, pattern, content_patterns, target_path, confidence) VALUES
('TypeScript CDK Files', '**/*.ts', '["import.*@aws-cdk", "new.*Construct"]', 'lib/constructs/', 0.9),
('Lambda Functions', '**/*.ts', '["export.*handler", "APIGatewayProxyEvent"]', 'lambda/', 0.85),
('Documentation', '**/*.md', '["# ", "## "]', 'docs/', 0.8),
('Configuration Files', '**/*.json', '["config", "settings"]', 'config/', 0.7),
('Test Files', '**/*.test.ts', '["describe", "it(", "test("]', 'tests/', 0.95),
('CPOS Core Files', '**/cpos/**/*.ts', '["CPOS", "Configuration", "FileScanner"]', 'lib/cpos/', 0.9);