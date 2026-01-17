# セキュリティガイド

## 概要

このドキュメントでは、Embedding Batch Workload Templateのセキュリティ機能と、セキュリティベストプラクティスの実装方法について説明します。

## セキュリティ機能

### 1. CDK Nagによる自動セキュリティチェック

CDK Nagを使用して、デプロイメント前にセキュリティベストプラクティスを自動的にチェックします。

#### 有効化方法

```typescript
import { applyCdkNagChecks } from './lib/aspects/security-aspect';

// スタック作成後に適用
const stack = new EmbeddingBatchStack(app, 'MyStack', props);

applyCdkNagChecks(stack, {
  environment: 'prod',
  strictMode: true
});
```

#### チェック項目

- **S3バケット**
  - パブリックアクセスブロック設定
  - SSL強制
  - 暗号化設定
  - バージョニング（本番環境）

- **IAMロール・ポリシー**
  - 過剰な権限の検出
  - ワイルドカードリソースの使用
  - 管理ポリシーの使用

- **セキュリティグループ**
  - 0.0.0.0/0からのアクセス
  - 不要なポート開放

- **CloudWatch Logs**
  - ログ保持期間
  - 暗号化設定

### 2. 環境別セキュリティ設定

#### 開発環境（dev）

```json
{
  "security": {
    "strictMode": false,
    "enableDetailedLogging": true,
    "allowedRules": [
      "AwsSolutions-IAM4",
      "AwsSolutions-IAM5"
    ]
  }
}
```

- 管理ポリシーの使用を許可
- ワイルドカード権限の使用を許可
- 詳細なログ出力

#### 本番環境（prod）

```json
{
  "security": {
    "strictMode": true,
    "enableDetailedLogging": false,
    "allowedRules": []
  }
}
```

- 厳格なセキュリティチェック
- 最小権限の原則を強制
- すべてのリソースで暗号化を要求

### 3. S3バケットのセキュリティ

#### ベストプラクティス

```typescript
const bucket = new s3.Bucket(this, 'SecureBucket', {
  // パブリックアクセスを完全にブロック
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  
  // SSL接続を強制
  enforceSSL: true,
  
  // サーバーサイド暗号化
  encryption: s3.BucketEncryption.S3_MANAGED,
  
  // バージョニング有効化（本番環境）
  versioned: true,
  
  // ライフサイクルルール
  lifecycleRules: [
    {
      id: 'DeleteOldVersions',
      noncurrentVersionExpiration: cdk.Duration.days(90)
    }
  ],
  
  // アクセスログ
  serverAccessLogsBucket: logBucket,
  serverAccessLogsPrefix: 'access-logs/'
});
```

#### セキュリティチェックリスト

- [ ] パブリックアクセスがブロックされている
- [ ] SSL接続が強制されている
- [ ] 暗号化が有効になっている
- [ ] バージョニングが有効（本番環境）
- [ ] ライフサイクルルールが設定されている
- [ ] アクセスログが有効になっている

### 4. IAMロール・ポリシーのセキュリティ

#### 最小権限の原則

```typescript
const role = new iam.Role(this, 'BatchJobRole', {
  assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
  description: 'Batch job execution role with minimal permissions',
  
  // 具体的な権限のみを付与
  inlinePolicies: {
    'BatchJobPolicy': new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:PutObject'
          ],
          // ワイルドカードではなく具体的なリソースを指定
          resources: [
            `arn:aws:s3:::${bucketName}/input/*`,
            `arn:aws:s3:::${bucketName}/output/*`
          ]
        })
      ]
    })
  }
});
```

#### 避けるべきパターン

❌ **過剰な権限**
```typescript
// 悪い例
new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: ['s3:*'],
  resources: ['*']
});
```

✅ **最小権限**
```typescript
// 良い例
new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: [
    's3:GetObject',
    's3:PutObject'
  ],
  resources: [
    `arn:aws:s3:::${bucketName}/specific-prefix/*`
  ]
});
```

### 5. ネットワークセキュリティ

#### VPC設定

```typescript
const vpc = new ec2.Vpc(this, 'SecureVpc', {
  maxAzs: 2,
  
  // プライベートサブネットのみ使用
  subnetConfiguration: [
    {
      name: 'Private',
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      cidrMask: 24
    }
  ],
  
  // VPCフローログ有効化
  flowLogs: {
    'FlowLog': {
      destination: ec2.FlowLogDestination.toCloudWatchLogs(logGroup)
    }
  }
});
```

#### セキュリティグループ

```typescript
const securityGroup = new ec2.SecurityGroup(this, 'BatchSecurityGroup', {
  vpc,
  description: 'Security group for Batch compute environment',
  
  // デフォルトでアウトバウンドのみ許可
  allowAllOutbound: true
});

// 必要最小限のインバウンドルールのみ追加
securityGroup.addIngressRule(
  ec2.Peer.ipv4('10.0.0.0/16'), // 特定のCIDRのみ
  ec2.Port.tcp(443),
  'Allow HTTPS from VPC'
);
```

### 6. ログとモニタリング

#### CloudWatch Logs

```typescript
const logGroup = new logs.LogGroup(this, 'BatchLogGroup', {
  // ログ保持期間を設定
  retention: logs.RetentionDays.ONE_MONTH,
  
  // KMS暗号化（本番環境）
  encryptionKey: kmsKey,
  
  // ログストリーム名のプレフィックス
  logGroupName: `/aws/batch/${projectName}`
});
```

#### CloudWatch Alarms

```typescript
// 異常なアクティビティの検出
const errorMetric = logGroup.addMetricFilter('ErrorMetric', {
  filterPattern: logs.FilterPattern.anyTerm('ERROR', 'Exception', 'Failed'),
  metricName: 'BatchErrors',
  metricNamespace: 'CustomMetrics'
});

new cloudwatch.Alarm(this, 'HighErrorRate', {
  metric: errorMetric.metric(),
  threshold: 10,
  evaluationPeriods: 1,
  alarmDescription: 'Alert when error rate is high',
  actionsEnabled: true
});
```

## セキュリティチェックリスト

### デプロイメント前

- [ ] CDK Nagチェックが通過している
- [ ] すべてのS3バケットが暗号化されている
- [ ] IAMロールが最小権限の原則に従っている
- [ ] セキュリティグループが適切に設定されている
- [ ] ログ設定が有効になっている

### デプロイメント後

- [ ] AWS Security Hubでセキュリティスコアを確認
- [ ] AWS Configでコンプライアンスを確認
- [ ] CloudWatch Logsでエラーログを確認
- [ ] IAM Access Analyzerで過剰な権限を確認

## トラブルシューティング

### CDK Nagエラーの解決

#### エラー: AwsSolutions-S3-1

**問題**: S3バケットでサーバーアクセスログが有効になっていません

**解決方法**:
```typescript
const logBucket = new s3.Bucket(this, 'LogBucket', {
  encryption: s3.BucketEncryption.S3_MANAGED,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
});

const bucket = new s3.Bucket(this, 'DataBucket', {
  serverAccessLogsBucket: logBucket,
  serverAccessLogsPrefix: 'access-logs/'
});
```

#### エラー: AwsSolutions-IAM4

**問題**: IAMロールで管理ポリシーが使用されています

**解決方法**:
```typescript
// 管理ポリシーの代わりにインラインポリシーを使用
const role = new iam.Role(this, 'CustomRole', {
  assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
  inlinePolicies: {
    'CustomPolicy': new iam.PolicyDocument({
      statements: [/* 具体的な権限 */]
    })
  }
});
```

#### エラー: AwsSolutions-IAM5

**問題**: IAMポリシーでワイルドカードリソースが使用されています

**解決方法**:
```typescript
// ワイルドカードの代わりに具体的なリソースARNを指定
new iam.PolicyStatement({
  actions: ['s3:GetObject'],
  resources: [
    `arn:aws:s3:::${bucketName}/specific-prefix/*`
  ]
});
```

### 抑制ルールの使用

特定のルールを無効にする必要がある場合（開発環境など）:

```typescript
import { NagSuppressions } from 'cdk-nag';

NagSuppressions.addResourceSuppressions(bucket, [
  {
    id: 'AwsSolutions-S3-1',
    reason: '開発環境ではアクセスログを無効化'
  }
]);
```

## セキュリティアップデート

### 定期的な確認事項

1. **依存関係の更新**
   ```bash
   npm audit
   npm update
   ```

2. **AWS Security Hubの確認**
   - セキュリティスコアの監視
   - 検出された問題の修正

3. **IAM Access Analyzerの確認**
   - 外部アクセスの検出
   - 過剰な権限の特定

4. **CloudWatch Logsの確認**
   - 異常なアクティビティの検出
   - エラーログの分析

## 参考資料

- [AWS Well-Architected Framework - Security Pillar](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html)
- [CDK Nag Documentation](https://github.com/cdklabs/cdk-nag)
- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)

## サポート

セキュリティに関する質問や問題がある場合:

1. `docs/ERROR_HANDLING_GUIDE.md` を確認
2. AWS Security Hubでセキュリティスコアを確認
3. CloudWatch Logsでエラーログを確認
4. 必要に応じてAWSサポートに連絡
