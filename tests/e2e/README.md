# Bedrock Agent Core Runtime - E2E Tests

## 概要

このディレクトリには、Bedrock Agent Core Runtimeのエンドツーエンド（E2E）テストが含まれています。

## 前提条件

### 必須環境変数

E2Eテストを実行する前に、以下の環境変数を設定する必要があります：

```bash
export AWS_REGION="ap-northeast-1"
export LAMBDA_FUNCTION_NAME="TokyoRegion-permission-aware-rag-prod-AgentCore-Runtime-Function"
export BEDROCK_AGENT_ID="your-agent-id"
export BEDROCK_AGENT_ALIAS_ID="your-agent-alias-id"
```

### AWS認証情報

AWS CLIが設定されており、適切な権限を持つプロファイルが設定されている必要があります：

```bash
export AWS_PROFILE="user01"
```

または、AWS認証情報が環境変数として設定されている必要があります。

### 必要なAWS権限

E2Eテストを実行するには、以下のAWS権限が必要です：

- `lambda:InvokeFunction` - Lambda関数の実行
- `bedrock:InvokeAgent` - Bedrock Agentの実行
- `cloudwatch:GetMetricStatistics` - CloudWatchメトリクスの取得
- `logs:FilterLogEvents` - CloudWatch Logsの読み取り

## セットアップ

```bash
# 依存関係のインストール
cd tests/e2e
npm install
```

## テストの実行

### 全テストの実行

```bash
npm test
```

### 特定のテストの実行

```bash
npm test -- runtime-e2e.test.ts
```

### カバレッジレポート付きで実行

```bash
npm run test:coverage
```

### ウォッチモードで実行

```bash
npm run test:watch
```

## テストケース

### 1. Bedrock Agent実行テスト
- Lambda関数を通じてBedrock Agentを実行
- レスポンスの検証

### 2. ストリーミングレスポンステスト
- ストリーミングレスポンスの処理
- チャンクデータの検証

### 3. Lambda関数スケーリングテスト
- 複数の同時リクエスト処理
- スケーリング動作の検証

### 4. エラーハンドリングテスト
- 無効なパラメータの処理
- 存在しないAgentIDの処理

### 5. パフォーマンステスト
- レイテンシの測定（3秒以内）
- スループットの検証

### 6. CloudWatchメトリクステスト
- メトリクスの記録確認
- エラー率の検証

### 7. トレース機能テスト
- トレースデータの記録確認
- トレース情報の検証

## トラブルシューティング

### テストがタイムアウトする

E2Eテストは実際のAWSリソースを使用するため、ネットワーク遅延やAWSサービスの応答時間により、テストがタイムアウトする場合があります。

**対策**:
- `jest.config.js`の`testTimeout`を増やす（デフォルト: 60秒）
- AWS環境の状態を確認

### 認証エラー

**対策**:
- AWS認証情報が正しく設定されているか確認
- 必要な権限が付与されているか確認
- `AWS_PROFILE`環境変数が正しく設定されているか確認

### Lambda関数が見つからない

**対策**:
- `LAMBDA_FUNCTION_NAME`環境変数が正しく設定されているか確認
- Lambda関数が実際にデプロイされているか確認
- リージョンが正しいか確認

## 注意事項

- E2Eテストは実際のAWSリソースを使用するため、**AWS料金が発生**します
- テスト実行前に、テスト環境が正しく設定されているか確認してください
- 本番環境でE2Eテストを実行しないでください
- E2Eテストは開発環境またはステージング環境で実行してください

## CI/CD統合

E2Eテストは、CI/CDパイプラインに統合することができます。ただし、以下の点に注意してください：

1. **環境変数の設定**: CI/CD環境で必要な環境変数を設定
2. **AWS認証情報**: CI/CD環境でAWS認証情報を安全に管理
3. **テスト環境の分離**: 本番環境とは別のテスト環境を使用
4. **コスト管理**: E2Eテストの実行頻度を適切に設定

## 参考資料

- [Jest公式ドキュメント](https://jestjs.io/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [Bedrock Agent Runtime API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_Operations_Agents_for_Amazon_Bedrock_Runtime.html)
