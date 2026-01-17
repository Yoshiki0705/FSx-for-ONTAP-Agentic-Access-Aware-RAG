# Code Interpreter Lambda Function - 単体テスト

Amazon Bedrock AgentCore Code Interpreter Lambda関数の単体テストです。

## テスト対象

### 1. セッション管理
- セッション開始
- セッション停止
- 最大同時セッション数制限
- セッションタイムアウト

### 2. コード実行
- Python/Node.jsコード実行
- タイムアウト制御
- エラーハンドリング
- トレース情報取得

### 3. ファイル操作
- ファイル書き込み
- ファイル読み込み
- ファイル削除
- ファイル一覧取得

### 4. ターミナルコマンド実行
- コマンド実行
- ネットワークアクセス制御
- 危険なコマンドのブロック

### 5. パッケージ管理
- パッケージインストール
- バージョン管理
- ホワイトリスト方式のセキュリティ
- インストール済みパッケージ一覧

### 6. エラーハンドリング
- 不正なアクション
- 必須パラメータのバリデーション
- レスポンス形式の検証

### 7. メトリクス
- レイテンシ記録
- 実行時間記録

## テストケース数

- **セッション管理**: 4テストケース
- **コード実行**: 3テストケース
- **ファイル操作**: 8テストケース
- **ターミナルコマンド実行**: 6テストケース
- **パッケージ管理**: 5テストケース
- **エラーハンドリング**: 4テストケース
- **メトリクス**: 2テストケース

**合計**: 32テストケース

## セットアップ

### 依存関係のインストール

```bash
cd tests/unit/lambda/agent-core-code-interpreter
npm install
```

## テスト実行

### 全テスト実行

```bash
npm test
```

### ウォッチモード

```bash
npm run test:watch
```

### カバレッジレポート生成

```bash
npm run test:coverage
```

## カバレッジ目標

- **Branches**: 70%以上
- **Functions**: 70%以上
- **Lines**: 70%以上
- **Statements**: 70%以上

## モック

### AWS SDK v3

以下のAWS SDKクライアントをモック化しています：

- `@aws-sdk/client-bedrock-agent-runtime`: Bedrock Agent Runtime API
- `@aws-sdk/client-s3`: S3 API

### モック実装

```typescript
jest.mock('@aws-sdk/client-bedrock-agent-runtime');
jest.mock('@aws-sdk/client-s3');
```

## テスト環境変数

```typescript
process.env.PROJECT_NAME = 'test-project';
process.env.ENVIRONMENT = 'test';
process.env.FSX_S3_ACCESS_POINT_ARN = 'arn:aws:s3:us-east-1:123456789012:accesspoint/test-access-point';
process.env.EXECUTION_TIMEOUT = '60';
process.env.MEMORY_LIMIT = '512';
process.env.ALLOWED_PACKAGES = '["numpy", "pandas", "matplotlib", "scipy"]';
process.env.ALLOW_NETWORK_ACCESS = 'false';
process.env.SESSION_TIMEOUT = '3600';
process.env.MAX_CONCURRENT_SESSIONS = '10';
```

## テスト例

### セッション開始テスト

```typescript
test('セッション開始が成功する', async () => {
  const event = {
    action: 'START_SESSION' as const,
  };

  const response = await handler(event);

  expect(response.status).toBe('SUCCESS');
  expect(response.sessionId).toBeDefined();
  expect(response.result?.output).toContain('started successfully');
});
```

### パッケージインストールテスト

```typescript
test('許可されていないパッケージはインストールできない', async () => {
  const event = {
    action: 'INSTALL_PACKAGE' as const,
    sessionId,
    packageName: 'malicious-package',
  };

  const response = await handler(event);

  expect(response.status).toBe('FAILED');
  expect(response.error?.message).toContain('is not allowed');
});
```

### 危険なコマンドのブロックテスト

```typescript
test('危険なコマンド（rm -rf）はブロックされる', async () => {
  const event = {
    action: 'EXECUTE_COMMAND' as const,
    sessionId,
    command: 'rm -rf /',
  };

  const response = await handler(event);

  expect(response.status).toBe('FAILED');
  expect(response.error?.message).toContain('Dangerous command is not allowed');
});
```

## トラブルシューティング

### テストが失敗する場合

1. **依存関係の確認**
   ```bash
   npm install
   ```

2. **TypeScriptコンパイルエラー**
   ```bash
   npx tsc --noEmit
   ```

3. **モックの確認**
   - AWS SDKのモックが正しく設定されているか確認
   - `jest.clearAllMocks()`が各テスト後に実行されているか確認

### カバレッジが低い場合

1. **未テストの関数を特定**
   ```bash
   npm run test:coverage
   open coverage/lcov-report/index.html
   ```

2. **テストケースを追加**
   - エッジケースのテスト
   - エラーハンドリングのテスト
   - バリデーションのテスト

## CI/CD統合

### GitHub Actions

```yaml
- name: Run Unit Tests
  run: |
    cd tests/unit/lambda/agent-core-code-interpreter
    npm install
    npm test
```

### カバレッジレポート

```yaml
- name: Generate Coverage Report
  run: |
    cd tests/unit/lambda/agent-core-code-interpreter
    npm run test:coverage
    
- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./tests/unit/lambda/agent-core-code-interpreter/coverage/lcov.info
```

## ライセンス

MIT License
