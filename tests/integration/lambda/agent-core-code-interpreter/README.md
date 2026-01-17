# Code Interpreter Lambda Function - 統合テスト

Amazon Bedrock AgentCore Code Interpreter Lambda関数の統合テストです。

実際のAWSサービス（Bedrock Agent Runtime、S3）を使用してテストを実行します。

## テスト対象

### 1. セッション管理統合テスト
- セッションのライフサイクル（開始→停止）
- 複数セッションの同時管理

### 2. コード実行統合テスト
- 簡単なPythonコード実行
- 数値計算実行
- タイムアウト設定

### 3. ファイル操作統合テスト
- ファイルの書き込み・読み込み・削除
- ファイル一覧取得

### 4. ターミナルコマンド実行統合テスト
- 安全なコマンド実行
- 危険なコマンドのブロック
- ネットワークアクセス制御

### 5. パッケージ管理統合テスト
- 許可されたパッケージのインストール
- 許可されていないパッケージのブロック
- インストール済みパッケージ一覧取得

### 6. エラーハンドリング統合テスト
- 存在しないセッションでの操作
- 不正なアクション

### 7. メトリクス統合テスト
- メトリクスの記録
- 実行時間の記録

## テストケース数

- **セッション管理**: 2テストケース
- **コード実行**: 3テストケース
- **ファイル操作**: 2テストケース
- **ターミナルコマンド実行**: 3テストケース
- **パッケージ管理**: 3テストケース
- **エラーハンドリング**: 2テストケース
- **メトリクス**: 2テストケース

**合計**: 17テストケース

## 前提条件

### AWS認証情報

以下のいずれかの方法でAWS認証情報を設定してください：

1. **AWS CLI設定**
   ```bash
   aws configure
   ```

2. **環境変数**
   ```bash
   export AWS_ACCESS_KEY_ID=your_access_key
   export AWS_SECRET_ACCESS_KEY=your_secret_key
   export AWS_REGION=ap-northeast-1
   ```

3. **IAMロール**（EC2インスタンス上で実行する場合）

### 必要なAWS権限

テスト実行には以下のAWS権限が必要です：

- `bedrock:InvokeModel`
- `bedrock:InvokeModelWithResponseStream`
- `s3:GetObject`
- `s3:PutObject`
- `s3:DeleteObject`
- `s3:ListBucket`

### 環境変数

以下の環境変数を設定してください：

```bash
export PROJECT_NAME=permission-aware-rag
export ENVIRONMENT=test
export AWS_REGION=ap-northeast-1
export FSX_S3_ACCESS_POINT_ARN=arn:aws:s3:region:account-id:accesspoint/access-point-name
export EXECUTION_TIMEOUT=60
export MEMORY_LIMIT=512
export ALLOWED_PACKAGES='["numpy", "pandas", "matplotlib", "scipy"]'
export ALLOW_NETWORK_ACCESS=false
export SESSION_TIMEOUT=3600
export MAX_CONCURRENT_SESSIONS=10
```

## セットアップ

### 依存関係のインストール

```bash
cd tests/integration/lambda/agent-core-code-interpreter
npm install
```

## テスト実行

### EC2環境での実行（推奨）

```bash
# EC2にSSH接続
ssh -i /path/to/key.pem ubuntu@ec2-instance

# プロジェクトディレクトリに移動
cd /home/ubuntu/Permission-aware-RAG-FSxN-CDK-github

# テストディレクトリに移動
cd tests/integration/lambda/agent-core-code-interpreter

# 依存関係のインストール
npm install

# テスト実行
npm test
```

### ローカル環境での実行

```bash
cd tests/integration/lambda/agent-core-code-interpreter
npm install
npm test
```

### 特定のテストスイートのみ実行

```bash
npm test -- --testNamePattern="セッション管理"
```

### カバレッジレポート生成

```bash
npm run test:coverage
```

## テスト結果の確認

### 成功例

```
PASS  tests/integration/lambda/agent-core-code-interpreter/index.integration.test.ts
  Code Interpreter Lambda Function - Integration Tests
    セッション管理統合テスト
      ✓ セッションのライフサイクル（開始→停止）が正常に動作する (1234ms)
      ✓ 複数のセッションを同時に管理できる (2345ms)
    コード実行統合テスト
      ✓ 簡単なPythonコードを実行できる (3456ms)
    ...

Test Suites: 1 passed, 1 total
Tests:       17 passed, 17 total
Time:        45.678s
```

## トラブルシューティング

### Bedrock Agent Runtime APIエラー

**症状**: `AccessDeniedException` または `ResourceNotFoundException`

**対策**:
1. IAM権限を確認
   ```bash
   aws iam get-user
   aws iam list-attached-user-policies --user-name your-user
   ```

2. Bedrock Agent Runtimeが利用可能なリージョンか確認
   ```bash
   aws bedrock list-foundation-models --region ap-northeast-1
   ```

### S3アクセスエラー

**症状**: `AccessDenied` または `NoSuchBucket`

**対策**:
1. S3バケットが存在するか確認
   ```bash
   aws s3 ls s3://your-bucket-name
   ```

2. IAM権限を確認
   ```bash
   aws s3api get-bucket-policy --bucket your-bucket-name
   ```

### タイムアウトエラー

**症状**: テストがタイムアウトする

**対策**:
1. `jest.config.js`のタイムアウト設定を増やす
   ```javascript
   testTimeout: 300000, // 5分
   ```

2. ネットワーク接続を確認
   ```bash
   ping bedrock.ap-northeast-1.amazonaws.com
   ```

### パッケージインストールエラー

**症状**: パッケージインストールテストが失敗する

**対策**:
1. 許可されたパッケージリストを確認
   ```bash
   echo $ALLOWED_PACKAGES
   ```

2. Bedrock Agent Runtime環境でpipが利用可能か確認

## CI/CD統合

### GitHub Actions

```yaml
- name: Run Integration Tests
  run: |
    cd tests/integration/lambda/agent-core-code-interpreter
    npm install
    npm test
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    AWS_REGION: ap-northeast-1
    PROJECT_NAME: permission-aware-rag
    ENVIRONMENT: test
```

## 注意事項

### コスト

- Bedrock Agent Runtime APIの使用には料金が発生します
- S3ストレージとリクエストにも料金が発生します
- テスト実行前にAWS料金を確認してください

### セキュリティ

- テスト環境では本番データを使用しないでください
- テスト用のIAMユーザーまたはロールを使用してください
- テスト後はリソースをクリーンアップしてください

### パフォーマンス

- 統合テストは単体テストよりも時間がかかります
- 並列実行は避けてください（セッション管理の競合を防ぐため）
- テスト実行時間: 約1-2分

## ライセンス

MIT License
