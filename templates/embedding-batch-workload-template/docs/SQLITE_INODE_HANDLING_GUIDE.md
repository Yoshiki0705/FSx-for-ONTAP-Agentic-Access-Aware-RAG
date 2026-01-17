# SQLite重複inode問題対応ガイド

## 概要

FSx for NetApp ONTAP上のSQLiteデータベースで発生する可能性のある同時ファイル処理時のinode重複問題に対応するための実装ガイドです。

## 問題の背景

### inode重複問題とは

- **発生条件**: 複数のプロセスが同時に同じファイルシステム上のSQLiteデータベースにアクセスする場合
- **症状**: `UNIQUE constraint failed: inode` エラー、データベースロック、データ整合性の問題
- **影響**: ファイル処理の失敗、データ損失のリスク、システムの不安定化

### FSx for NetApp ONTAPでの特性

- NFSマウントによる共有ファイルシステム
- 複数のコンピュートノードからの同時アクセス
- ネットワークレイテンシによるロック競合の増加

## 実装アーキテクチャ

### コンポーネント構成

```
┌─────────────────────────────────────────────────────────────┐
│                SQLite Inode Handler                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │ Inode Cache  │    │ File Lock    │    │ Retry Logic  │ │
│  │              │    │              │    │              │ │
│  │ • Duplicate  │────│ • Exclusive  │────│ • Exponential│ │
│  │   Detection  │    │   Lock       │    │   Backoff    │ │
│  │ • Cache      │    │ • Lock Dir   │    │ • Max Retry  │ │
│  │   Management │    │ • Timeout    │    │ • Error Type │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│         │                    │                    │        │
│         └────────────────────┴────────────────────┘        │
│                              │                             │
│                    ┌─────────▼─────────┐                   │
│                    │ Concurrent File   │                   │
│                    │ Processing        │                   │
│                    └───────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### 主要機能

#### 1. inode重複検出

```javascript
const SqliteInodeHandler = require('./sqlite-inode-handler');

const handler = new SqliteInodeHandler({
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 30000
});

// inode重複チェック
const isDuplicate = await handler.checkInodeDuplicate(inode);
if (isDuplicate) {
    console.warn('inode重複を検出しました');
    // スキップまたは代替処理
}
```

#### 2. ファイルロック機構

```javascript
// ファイルロックの取得
const lockFilePath = await handler.acquireFileLock(filePath);

try {
    // ファイル処理の実行
    await processFile(filePath);
} finally {
    // ファイルロックの解放
    await handler.releaseFileLock(lockFilePath);
}
```

#### 3. 指数バックオフリトライ

```javascript
// リトライ機構付きの処理実行
await handler.retryWithBackoff(async () => {
    // SQLite操作
    await database.insert(data);
}, 5); // 最大5回リトライ
```

#### 4. 同時ファイル処理制御

```javascript
// 複数ファイルの同時処理
const result = await handler.handleConcurrentFileProcessing(
    files,
    async (fileInfo) => {
        // 各ファイルの処理ロジック
        console.log(`Processing: ${fileInfo.path}`);
        await processDocument(fileInfo);
    }
);

console.log(`処理完了: ${result.processed.length}ファイル`);
console.log(`スキップ: ${result.skipped.length}ファイル`);
console.log(`エラー: ${result.errors.length}件`);
```

## Lambda関数への統合

### Document Processor統合例

```javascript
const SqliteInodeHandler = require('./sqlite-inode-handler');

// ハンドラーインスタンスの作成
const inodeHandler = new SqliteInodeHandler({
    maxRetries: parseInt(process.env.MAX_RETRIES || '5'),
    baseDelay: parseInt(process.env.BASE_DELAY || '1000'),
    maxDelay: parseInt(process.env.MAX_DELAY || '30000'),
    lockDir: process.env.LOCK_DIR || '/tmp/file-locks'
});

// S3イベント処理での使用
async function handleS3Event(event) {
    const files = extractFilesFromEvent(event);
    
    const result = await inodeHandler.handleConcurrentFileProcessing(
        files,
        async (fileInfo) => {
            // ファイル処理ロジック
            await submitBatchJob(fileInfo);
        }
    );
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            processed: result.processed.length,
            skipped: result.skipped.length,
            errors: result.errors.length
        })
    };
}
```

### 環境変数設定

```bash
# Lambda環境変数
MAX_RETRIES=5           # 最大リトライ回数
BASE_DELAY=1000         # 基本遅延時間（ミリ秒）
MAX_DELAY=30000         # 最大遅延時間（ミリ秒）
LOCK_DIR=/tmp/file-locks # ロックファイルディレクトリ
```

## 負荷試験

### 負荷試験スクリプトの実行

```bash
# 基本テスト（20ファイル同時アップロード）
./scripts/load-test-sqlite-concurrent.sh --mode basic

# 標準テスト（50ファイル同時アップロード）
./scripts/load-test-sqlite-concurrent.sh --mode standard

# 高負荷テスト（100ファイル同時アップロード）
./scripts/load-test-sqlite-concurrent.sh --mode high
```

### カスタム設定での実行

```bash
# カスタム同時処理数とテスト時間
./scripts/load-test-sqlite-concurrent.sh \
    --concurrent 75 \
    --duration 900 \
    --fsx-path /mnt/fsx/rag-data \
    --report-dir ./reports/custom-test
```

### 負荷試験の検証項目

1. **inode重複検出**: 同時アップロード時の重複検出率
2. **エラーハンドリング**: リトライ機構の動作確認
3. **データ整合性**: データベースの整合性維持
4. **パフォーマンス**: 処理時間とスループット
5. **リソース使用率**: CPU、メモリ、ディスクI/O

## トラブルシューティング

### よくある問題と対処法

#### 1. ファイルロック取得失敗

**症状**:
```
Error: ファイルロックの取得に失敗: /path/to/file (最大リトライ回数超過)
```

**対処法**:
- `MAX_RETRIES` を増やす
- `BASE_DELAY` を調整する
- 同時処理数を減らす
- ロックディレクトリの権限を確認

#### 2. SQLiteデータベースロック

**症状**:
```
Error: database is locked
```

**対処法**:
- リトライ機構が自動的に対応
- `maxRetries` パラメータを調整
- データベース接続のタイムアウト設定を確認

#### 3. inode重複エラー

**症状**:
```
Error: UNIQUE constraint failed: inode
```

**対処法**:
- inode重複検出機能が自動的にスキップ
- inodeキャッシュのクリア: `handler.clearInodeCache()`
- データベース整合性の確認

### デバッグ方法

#### ログレベルの設定

```javascript
// 詳細ログの有効化
process.env.DEBUG = 'sqlite-inode-handler:*';

// ログ出力の確認
console.log('Inode cache size:', handler.inodeCache.size);
console.log('Lock directory:', handler.lockDir);
```

#### データベース整合性チェック

```javascript
// 整合性確認の実行
const integrity = await handler.verifyDatabaseIntegrity(dbPath);

if (!integrity.isValid) {
    console.error('データベース整合性エラー:', integrity.errors);
}
```

## ベストプラクティス

### 1. 適切なリトライ設定

```javascript
// 推奨設定
const handler = new SqliteInodeHandler({
    maxRetries: 5,        // 5回まで再試行
    baseDelay: 1000,      // 1秒から開始
    maxDelay: 30000       // 最大30秒まで
});
```

### 2. エラーハンドリング

```javascript
try {
    const result = await handler.handleConcurrentFileProcessing(files, processFunc);
    
    // エラーの記録と通知
    if (result.errors.length > 0) {
        await notifyErrors(result.errors);
    }
} catch (error) {
    console.error('致命的エラー:', error);
    await sendAlert(error);
}
```

### 3. 定期的なキャッシュクリア

```javascript
// 定期的なinodeキャッシュのクリア（メモリリーク防止）
setInterval(() => {
    handler.clearInodeCache();
}, 3600000); // 1時間ごと
```

### 4. 監視とアラート

```javascript
// CloudWatchメトリクスの送信
const metrics = {
    ProcessedFiles: result.processed.length,
    SkippedFiles: result.skipped.length,
    ErrorCount: result.errors.length,
    InodeDuplicates: result.skipped.filter(f => f.reason === 'inode duplicate').length
};

await publishMetrics(metrics);
```

## パフォーマンス最適化

### 1. 同時処理数の調整

```javascript
// バッチサイズの最適化
const OPTIMAL_BATCH_SIZE = 50; // 環境に応じて調整

const batches = chunkArray(files, OPTIMAL_BATCH_SIZE);
for (const batch of batches) {
    await handler.handleConcurrentFileProcessing(batch, processFunc);
}
```

### 2. ロックディレクトリの配置

```bash
# 高速なストレージを使用
LOCK_DIR=/dev/shm/file-locks  # メモリベースのファイルシステム
```

### 3. データベース設定の最適化

```sql
-- SQLite設定の最適化
PRAGMA journal_mode = WAL;        -- Write-Ahead Logging
PRAGMA synchronous = NORMAL;      -- 同期モード
PRAGMA cache_size = 10000;        -- キャッシュサイズ
PRAGMA temp_store = MEMORY;       -- 一時ストレージ
```

## セキュリティ考慮事項

### 1. ロックファイルの権限

```bash
# ロックディレクトリの権限設定
chmod 700 /tmp/file-locks
```

### 2. ファイルパスの検証

```javascript
// パストラバーサル攻撃の防止
function validateFilePath(filePath) {
    const normalized = path.normalize(filePath);
    if (normalized.includes('..')) {
        throw new Error('Invalid file path');
    }
    return normalized;
}
```

### 3. リソース制限

```javascript
// 同時処理数の制限
const MAX_CONCURRENT_FILES = 100;

if (files.length > MAX_CONCURRENT_FILES) {
    throw new Error(`Too many files: ${files.length} > ${MAX_CONCURRENT_FILES}`);
}
```

## まとめ

SQLite重複inode問題対応機能により、以下が実現されます：

- ✅ 同時ファイル処理時のinode重複検出
- ✅ 排他制御によるデータ整合性の保証
- ✅ 指数バックオフによる自動リトライ
- ✅ エラーハンドリングとロギング
- ✅ パフォーマンスの最適化

本番環境での使用前に、必ず負荷試験を実施し、環境に応じた設定の調整を行ってください。

## 関連ドキュメント

- [FSx File Path Tracking System](./FSX_FILE_PATH_TRACKING_SYSTEM.md)
- [Load Test Guide](./LOAD_TEST_GUIDE.md)
- [Operations Monitoring Guide](./OPERATIONS_MONITORING_GUIDE.md)
- [Troubleshooting Guide](./CDK_TROUBLESHOOTING_GUIDE.md)

---
最終更新: 2025-11-09
バージョン: 1.0.0
