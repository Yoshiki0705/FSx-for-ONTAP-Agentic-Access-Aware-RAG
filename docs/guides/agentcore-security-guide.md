# AgentCore セキュリティガイド

**最終更新**: 2026-01-05  
**対象**: セキュリティ担当者、システム管理者、開発者  
**バージョン**: 1.0

---

## 📋 概要

このガイドは、Amazon Bedrock AgentCore機能のセキュリティに関するベストプラクティス、脆弱性対応手順、インシデント対応手順を説明します。

### 対象読者

- **セキュリティ担当者**: セキュリティポリシーの策定・実施
- **システム管理者**: セキュリティ設定の実装・運用
- **開発者**: セキュアなコードの実装

### 前提知識

- AWS IAM基礎知識
- AWS KMS基礎知識
- ネットワークセキュリティ基礎知識
- セキュリティインシデント対応の基礎知識

---

## 🔒 セキュリティベストプラクティス

### 1. IAM権限の最小権限原則

**原則**: 必要最小限の権限のみを付与し、過剰な権限を避ける

**実装方法**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeAgent",
        "bedrock:InvokeAgentWithResponseStream"
      ],
      "Resource": "arn:aws:bedrock:ap-northeast-1:123456789012:agent/*"
    }
  ]
}
```

**チェックリスト**:
- [ ] 各Lambda関数に必要最小限の権限を付与
- [ ] リソースベースのポリシーを使用（ワイルドカード`*`を避ける）
- [ ] 条件付きアクセスを設定（IP制限、時間制限等）
- [ ] 定期的に権限を見直し（四半期ごと）
- [ ] 未使用の権限を削除


**ベストプラクティス**:
- IAMロールは機能ごとに分離（Runtime用、Gateway用等）
- クロスアカウントアクセスは信頼ポリシーで制限
- IAM Access Analyzerで過剰な権限を検出
- AWS CloudTrailで全てのIAM操作を記録

**参考資料**:
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [Least Privilege Principle](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#grant-least-privilege)

---

### 2. KMS暗号化の推奨設定

**原則**: 全てのデータを暗号化し、暗号化キーを適切に管理する

**実装方法**:

```typescript
// CDK Constructでの設定
import * as kms from 'aws-cdk-lib/aws-kms';

const encryptionKey = new kms.Key(this, 'AgentCoreKey', {
  enableKeyRotation: true,  // 年1回の自動ローテーション
  description: 'AgentCore encryption key',
  alias: 'alias/agentcore-prod',
  removalPolicy: cdk.RemovalPolicy.RETAIN,  // 削除保護
});

// Lambda環境変数の暗号化
const runtimeFunction = new lambda.Function(this, 'RuntimeFunction', {
  environmentEncryption: encryptionKey,
  environment: {
    BEDROCK_AGENT_ID: 'agent-12345',
    API_KEY: 'secret-key',  // KMSで自動暗号化
  },
});
```

**チェックリスト**:
- [ ] 全てのLambda環境変数をKMS暗号化
- [ ] S3バケットでサーバーサイド暗号化（SSE-KMS）を有効化
- [ ] DynamoDBテーブルで暗号化を有効化
- [ ] キーローテーションを有効化（年1回）
- [ ] キーポリシーで最小権限を設定
- [ ] キー削除保護を有効化（RemovalPolicy.RETAIN）

**ベストプラクティス**:
- 環境ごとに異なるKMSキーを使用（dev、staging、prod）
- キーエイリアスを使用して管理を簡素化
- CloudTrailでキー使用を監査
- キーポリシーで特定のAWSサービスのみに使用を制限

**参考資料**:
- [AWS KMS Best Practices](https://docs.aws.amazon.com/kms/latest/developerguide/best-practices.html)
- [Envelope Encryption](https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html#enveloping)

---

### 3. ネットワークセキュリティ設定

**原則**: ネットワークレベルでアクセスを制限し、不要な通信を遮断する

**実装方法**:

```typescript
// VPC設定
const vpc = new ec2.Vpc(this, 'AgentCoreVpc', {
  maxAzs: 2,
  natGateways: 1,
  subnetConfiguration: [
    {
      name: 'Public',
      subnetType: ec2.SubnetType.PUBLIC,
      cidrMask: 24,
    },
    {
      name: 'Private',
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      cidrMask: 24,
    },
    {
      name: 'Isolated',
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      cidrMask: 24,
    },
  ],
});

// セキュリティグループ設定
const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSG', {
  vpc,
  description: 'Security group for AgentCore Lambda functions',
  allowAllOutbound: false,  // アウトバウンドを制限
});

// 必要な通信のみ許可
lambdaSecurityGroup.addEgressRule(
  ec2.Peer.anyIpv4(),
  ec2.Port.tcp(443),  // HTTPS通信のみ
  'Allow HTTPS to AWS services'
);
```

**チェックリスト**:
- [ ] Lambda関数をプライベートサブネットに配置
- [ ] セキュリティグループでアウトバウンド通信を制限
- [ ] VPCエンドポイントを使用してAWSサービスにアクセス
- [ ] NACLで追加のネットワーク制御を実施
- [ ] VPCフローログを有効化
- [ ] AWS WAFでAPI Gatewayを保護

**ベストプラクティス**:
- Lambda関数は必要な場合のみVPC統合（コールドスタート増加に注意）
- VPCエンドポイントでS3、DynamoDB、Bedrockにアクセス
- セキュリティグループは最小限のポートのみ開放
- 定期的にセキュリティグループルールを見直し

**参考資料**:
- [VPC Security Best Practices](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-best-practices.html)
- [Lambda VPC Networking](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html)

---

### 4. データ保護のベストプラクティス

**原則**: データのライフサイクル全体で保護を実施する

**実装方法**:

```typescript
// S3バケットのセキュリティ設定
const documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
  encryption: s3.BucketEncryption.KMS,
  encryptionKey: encryptionKey,
  versioning: true,  // バージョニング有効化
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,  // パブリックアクセス禁止
  enforceSSL: true,  // SSL/TLS必須
  lifecycleRules: [
    {
      id: 'DeleteOldVersions',
      noncurrentVersionExpiration: cdk.Duration.days(90),
    },
  ],
});

// DynamoDBテーブルのセキュリティ設定
const identityTable = new dynamodb.Table(this, 'IdentityTable', {
  encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
  encryptionKey: encryptionKey,
  pointInTimeRecovery: true,  // PITR有効化
  deletionProtection: true,  // 削除保護
});
```

**チェックリスト**:
- [ ] 転送中の暗号化（TLS/SSL）を強制
- [ ] 保存時の暗号化（KMS）を有効化
- [ ] S3バケットバージョニングを有効化
- [ ] DynamoDB Point-in-Time Recoveryを有効化
- [ ] S3バケットのパブリックアクセスをブロック
- [ ] データ削除保護を有効化

**ベストプラクティス**:
- 機密データは必ずKMS暗号化
- S3バケットポリシーでSSL/TLS通信を強制
- ライフサイクルポリシーで古いデータを自動削除
- バックアップを定期的に取得（日次）

**参考資料**:
- [S3 Security Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)
- [DynamoDB Encryption](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/EncryptionAtRest.html)

---

### 5. 監査ログの設定

**原則**: 全ての操作を記録し、定期的に監査する

**実装方法**:

```typescript
// CloudTrail設定
const trail = new cloudtrail.Trail(this, 'AgentCoreTrail', {
  bucket: logsBucket,
  isMultiRegionTrail: true,
  includeGlobalServiceEvents: true,
  managementEvents: cloudtrail.ReadWriteType.ALL,
  sendToCloudWatchLogs: true,
  cloudWatchLogsRetention: logs.RetentionDays.ONE_YEAR,
});

// データイベントの記録
trail.addS3EventSelector([{
  bucket: documentsBucket,
  objectPrefix: 'sensitive/',
}], {
  readWriteType: cloudtrail.ReadWriteType.ALL,
});

// Lambda関数のログ設定
const runtimeFunction = new lambda.Function(this, 'RuntimeFunction', {
  logRetention: logs.RetentionDays.ONE_MONTH,
  logGroup: new logs.LogGroup(this, 'RuntimeLogs', {
    retention: logs.RetentionDays.ONE_MONTH,
    encryptionKey: encryptionKey,
  }),
});
```

**チェックリスト**:
- [ ] CloudTrailを全リージョンで有効化
- [ ] CloudTrailログをKMS暗号化
- [ ] CloudWatch Logsに送信して分析
- [ ] Lambda関数のログ保持期間を設定（30日）
- [ ] S3アクセスログを有効化
- [ ] VPCフローログを有効化

**ベストプラクティス**:
- CloudTrailログは別アカウントのS3バケットに保存
- ログの改ざん防止（S3 Object Lock）
- CloudWatch Logs Insightsで定期的に分析
- 異常なアクセスパターンをCloudWatch Alarmsで検知

**参考資料**:
- [CloudTrail Best Practices](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/best-practices-security.html)
- [CloudWatch Logs Encryption](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/encrypt-log-data-kms.html)

---

### 6. 認証・認可の強化

**原則**: 多層防御で認証・認可を実施する

**実装方法**:

```typescript
// Cognito User Pool設定
const userPool = new cognito.UserPool(this, 'AgentCoreUserPool', {
  passwordPolicy: {
    minLength: 12,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: true,
  },
  mfa: cognito.Mfa.REQUIRED,  // MFA必須
  accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
  advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
});

// API Gateway認証設定
const api = new apigateway.RestApi(this, 'AgentCoreApi', {
  defaultCorsPreflightOptions: {
    allowOrigins: ['https://example.com'],  // 特定のオリジンのみ許可
    allowMethods: ['GET', 'POST'],
  },
  defaultMethodOptions: {
    authorizationType: apigateway.AuthorizationType.IAM,
  },
});
```

**チェックリスト**:
- [ ] MFA（多要素認証）を有効化
- [ ] 強力なパスワードポリシーを設定
- [ ] API Gatewayで認証を必須化（IAM、Cognito、Lambda Authorizer）
- [ ] セッションタイムアウトを適切に設定
- [ ] 失敗したログイン試行を監視
- [ ] アカウントロックアウトポリシーを設定

**ベストプラクティス**:
- Cognito User PoolでMFAを必須化
- API GatewayでIAM認証またはCognito認証を使用
- Lambda AuthorizerでカスタムRBAC/ABACを実装
- セッショントークンは短時間で期限切れ（1時間）

**参考資料**:
- [Cognito Security Best Practices](https://docs.aws.amazon.com/cognito/latest/developerguide/security-best-practices.html)
- [API Gateway Authorization](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-control-access-to-api.html)

---

### 7. セキュリティ監視とアラート

**原則**: リアルタイムでセキュリティイベントを監視し、迅速に対応する

**実装方法**:

```typescript
// GuardDuty有効化
const guardDuty = new guardduty.CfnDetector(this, 'GuardDuty', {
  enable: true,
  findingPublishingFrequency: 'FIFTEEN_MINUTES',
});

// Security Hub有効化
const securityHub = new securityhub.CfnHub(this, 'SecurityHub', {
  tags: { Environment: 'production' },
});

// CloudWatch Alarms設定
const unauthorizedApiCallsAlarm = new cloudwatch.Alarm(this, 'UnauthorizedApiCalls', {
  metric: new cloudwatch.Metric({
    namespace: 'CloudTrailMetrics',
    metricName: 'UnauthorizedApiCalls',
    statistic: 'Sum',
    period: cdk.Duration.minutes(5),
  }),
  threshold: 5,
  evaluationPeriods: 1,
  alarmDescription: 'Unauthorized API calls detected',
});
```

**チェックリスト**:
- [ ] AWS GuardDutyを有効化
- [ ] AWS Security Hubを有効化
- [ ] CloudWatch Alarmsで異常を検知
- [ ] SNSトピックでアラート通知
- [ ] AWS Configで設定変更を監視
- [ ] IAM Access Analyzerで過剰な権限を検出

**ベストプラクティス**:
- GuardDutyで脅威を自動検出
- Security Hubで複数のセキュリティサービスを統合
- CloudWatch Alarmsで異常なアクセスパターンを検知
- SNSでセキュリティチームに即座に通知

**参考資料**:
- [GuardDuty Best Practices](https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_best-practices.html)
- [Security Hub Best Practices](https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-best-practices.html)

---

### 8. コンプライアンスとガバナンス

**原則**: 規制要件に準拠し、ガバナンスを確立する

**実装方法**:

```typescript
// AWS Config Rules設定
const configRule = new config.ManagedRule(this, 'EncryptedVolumes', {
  identifier: config.ManagedRuleIdentifiers.EC2_ENCRYPTED_VOLUMES,
  description: 'Ensure all EBS volumes are encrypted',
});

// AWS Organizations SCPs設定
const scp = new organizations.CfnPolicy(this, 'DenyUnencryptedS3', {
  name: 'DenyUnencryptedS3',
  type: 'SERVICE_CONTROL_POLICY',
  content: JSON.stringify({
    Version: '2012-10-17',
    Statement: [{
      Effect: 'Deny',
      Action: 's3:PutObject',
      Resource: '*',
      Condition: {
        StringNotEquals: {
          's3:x-amz-server-side-encryption': 'aws:kms',
        },
      },
    }],
  }),
});
```

**チェックリスト**:
- [ ] AWS Configで設定準拠を監視
- [ ] AWS Organizations SCPsで組織全体のポリシーを適用
- [ ] タグ付けポリシーでリソース管理を標準化
- [ ] コンプライアンスレポートを定期的に生成
- [ ] データ主権要件に準拠（リージョン制限）
- [ ] 定期的なセキュリティ監査を実施

**ベストプラクティス**:
- AWS Configで自動的にコンプライアンスをチェック
- Organizations SCPsで組織全体のセキュリティポリシーを強制
- タグ付けでコスト配分とリソース管理を実施
- 四半期ごとにセキュリティ監査を実施

**参考資料**:
- [AWS Config Best Practices](https://docs.aws.amazon.com/config/latest/developerguide/best-practices.html)
- [AWS Organizations SCPs](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html)

---

### 9. サプライチェーンセキュリティ

**原則**: 依存関係とサプライチェーンのセキュリティを確保する

**実装方法**:

```bash
# npm auditで脆弱性スキャン
npm audit --audit-level=moderate

# Dependabotで自動更新
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10

# Dockerイメージのスキャン
docker scan permission-aware-rag-webapp:latest

# ECRイメージスキャン有効化
aws ecr put-image-scanning-configuration \
  --repository-name permission-aware-rag-webapp \
  --image-scanning-configuration scanOnPush=true
```

**チェックリスト**:
- [ ] npm auditで定期的に脆弱性スキャン
- [ ] Dependabotで依存関係を自動更新
- [ ] Dockerイメージスキャンを有効化
- [ ] ECRイメージスキャンを有効化
- [ ] Lambda Layersの脆弱性をスキャン
- [ ] サードパーティライブラリを最小限に抑える

**ベストプラクティス**:
- 週次でnpm auditを実行
- Dependabotで自動的にPRを作成
- ECRでイメージスキャンを自動実行
- 脆弱性が見つかった場合は即座にパッチ適用

**参考資料**:
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [ECR Image Scanning](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-scanning.html)

---

### 10. インシデント対応準備

**原則**: インシデント発生時に迅速に対応できる体制を整える

**実装方法**:

```typescript
// SNSトピックでアラート通知
const securityAlertTopic = new sns.Topic(this, 'SecurityAlerts', {
  displayName: 'AgentCore Security Alerts',
});

securityAlertTopic.addSubscription(
  new subscriptions.EmailSubscription('security-team@example.com')
);

// Lambda関数でインシデント対応を自動化
const incidentResponseFunction = new lambda.Function(this, 'IncidentResponse', {
  runtime: lambda.Runtime.NODEJS_22_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda/incident-response'),
  environment: {
    SNS_TOPIC_ARN: securityAlertTopic.topicArn,
  },
});

// EventBridge Ruleでインシデントを検知
const incidentRule = new events.Rule(this, 'IncidentRule', {
  eventPattern: {
    source: ['aws.guardduty'],
    detailType: ['GuardDuty Finding'],
    detail: {
      severity: [7, 8, 9],  // High/Critical severity
    },
  },
  targets: [new targets.LambdaFunction(incidentResponseFunction)],
});
```

**チェックリスト**:
- [ ] インシデント対応チームの連絡先を整備
- [ ] インシデント対応手順書を作成
- [ ] 自動化されたインシデント対応を実装
- [ ] 定期的なインシデント対応訓練を実施
- [ ] インシデント対応ツールを準備（AWS Systems Manager、Lambda等）
- [ ] ポストモーテムプロセスを確立

**ベストプラクティス**:
- SNSでセキュリティチームに即座に通知
- Lambda関数で初動対応を自動化（アカウント無効化、リソース隔離等）
- 四半期ごとにインシデント対応訓練を実施
- インシデント後は必ずポストモーテムを実施

**参考資料**:
- [AWS Incident Response](https://docs.aws.amazon.com/whitepapers/latest/aws-security-incident-response-guide/welcome.html)
- [Automated Incident Response](https://aws.amazon.com/solutions/implementations/automated-security-response-on-aws/)

---

## 📋 セキュリティチェックリスト

### デプロイ前チェックリスト

- [ ] IAM権限が最小権限原則に従っている
- [ ] KMS暗号化が全てのデータに適用されている
- [ ] ネットワークセキュリティグループが適切に設定されている
- [ ] S3バケットのパブリックアクセスがブロックされている
- [ ] CloudTrailが有効化されている
- [ ] GuardDutyが有効化されている
- [ ] Security Hubが有効化されている
- [ ] npm auditで脆弱性がない
- [ ] Dockerイメージスキャンで脆弱性がない
- [ ] セキュリティレビューが完了している

### 運用中チェックリスト（週次）

- [ ] CloudTrailログを確認
- [ ] GuardDuty Findingsを確認
- [ ] Security Hub Findingsを確認
- [ ] CloudWatch Alarmsを確認
- [ ] IAM Access Analyzerの結果を確認
- [ ] npm auditを実行
- [ ] 未使用のIAM権限を削除
- [ ] セキュリティパッチを適用

### 運用中チェックリスト（月次）

- [ ] セキュリティ監査を実施
- [ ] コンプライアンスレポートを生成
- [ ] インシデント対応訓練を実施
- [ ] セキュリティポリシーを見直し
- [ ] KMSキーローテーションを確認
- [ ] バックアップテストを実施
- [ ] 脆弱性スキャンを実施
- [ ] セキュリティドキュメントを更新

---

## 🚨 脆弱性対応手順

### 脆弱性対応フロー

```
脆弱性発見 → 評価 → 優先順位付け → パッチ適用 → 検証 → 報告
```

---

### Phase 1: 脆弱性発見（即座）

**目的**: 脆弱性を早期に発見する

**手順**:

1. **自動スキャン**
   ```bash
   # npm auditで脆弱性スキャン
   npm audit --audit-level=moderate
   
   # Dockerイメージスキャン
   docker scan permission-aware-rag-webapp:latest
   
   # ECRイメージスキャン結果確認
   aws ecr describe-image-scan-findings \
     --repository-name permission-aware-rag-webapp \
     --image-id imageTag=latest
   ```

2. **手動確認**
   - GitHub Security Advisoriesを確認
   - AWS Security Bulletinsを確認
   - CVE（Common Vulnerabilities and Exposures）データベースを確認

3. **通知受信**
   - Dependabotアラート
   - GuardDuty Findings
   - Security Hub Findings

**成果物**:
- 脆弱性リスト（CVE ID、影響範囲、深刻度）

---

### Phase 2: 脆弱性評価（1時間以内）

**目的**: 脆弱性の影響範囲と深刻度を評価する

**評価基準**:

| 深刻度 | CVSS Score | 対応期限 | 説明 |
|--------|-----------|---------|------|
| Critical | 9.0-10.0 | 24時間以内 | 即座に悪用可能、重大な影響 |
| High | 7.0-8.9 | 7日以内 | 悪用可能、重大な影響 |
| Medium | 4.0-6.9 | 30日以内 | 悪用には条件が必要 |
| Low | 0.1-3.9 | 90日以内 | 影響が限定的 |

**評価手順**:

1. **影響範囲の特定**
   ```bash
   # 依存関係ツリーを確認
   npm ls [パッケージ名]
   
   # 使用箇所を検索
   grep -r "[パッケージ名]" ./lambda ./docker
   ```

2. **悪用可能性の評価**
   - 攻撃ベクトル（ネットワーク、ローカル等）
   - 攻撃の複雑さ（低、高）
   - 必要な権限（なし、低、高）
   - ユーザーインタラクション（必要、不要）

3. **ビジネスへの影響評価**
   - データ漏洩の可能性
   - サービス停止の可能性
   - 金銭的損失の可能性
   - 評判への影響

**成果物**:
- 脆弱性評価レポート（深刻度、影響範囲、対応期限）

---

### Phase 3: 優先順位付け（2時間以内）

**目的**: 対応の優先順位を決定する

**優先順位マトリクス**:

| 深刻度 | 影響範囲 | 優先度 | 対応期限 |
|--------|---------|--------|---------|
| Critical | 本番環境 | P0 | 24時間以内 |
| Critical | ステージング環境 | P1 | 7日以内 |
| High | 本番環境 | P1 | 7日以内 |
| High | ステージング環境 | P2 | 30日以内 |
| Medium | 本番環境 | P2 | 30日以内 |
| Medium | ステージング環境 | P3 | 90日以内 |
| Low | 全環境 | P3 | 90日以内 |

**優先順位付け手順**:

1. **P0（緊急）**: 即座に対応
   - 本番環境のCritical脆弱性
   - 既に悪用されている脆弱性
   - データ漏洩の可能性がある脆弱性

2. **P1（高）**: 7日以内に対応
   - 本番環境のHigh脆弱性
   - ステージング環境のCritical脆弱性
   - 悪用可能性が高い脆弱性

3. **P2（中）**: 30日以内に対応
   - 本番環境のMedium脆弱性
   - ステージング環境のHigh脆弱性
   - 悪用には条件が必要な脆弱性

4. **P3（低）**: 90日以内に対応
   - 全環境のLow脆弱性
   - 影響が限定的な脆弱性

**成果物**:
- 優先順位付けされた脆弱性リスト

---

### Phase 4: パッチ適用（優先度に応じて）

**目的**: 脆弱性を修正する

**パッチ適用手順**:

1. **パッチの入手**
   ```bash
   # npm updateでパッケージを更新
   npm update [パッケージ名]
   
   # 特定バージョンにアップグレード
   npm install [パッケージ名]@[バージョン]
   
   # package-lock.jsonを更新
   npm install
   ```

2. **ローカルテスト**
   ```bash
   # 単体テスト実行
   npm test
   
   # 統合テスト実行
   npm run test:integration
   
   # E2Eテスト実行
   npm run test:e2e
   ```

3. **ステージング環境デプロイ**
   ```bash
   # ステージング環境にデプロイ
   ./development/scripts/deployment/deploy-staging.sh
   
   # ステージング環境テスト
   ./development/scripts/testing/run-staging-tests.sh
   ```

4. **本番環境デプロイ**
   ```bash
   # 本番環境にデプロイ
   ./development/scripts/deployment/unified-deploy.sh "security-patch-CVE-2024-12345"
   
   # 本番環境検証
   ./development/scripts/testing/run-production-smoke-tests.sh
   ```

**緊急パッチ適用手順（P0）**:

```bash
# 1. 緊急ブランチ作成
git checkout -b hotfix/CVE-2024-12345

# 2. パッチ適用
npm update [パッケージ名]

# 3. テスト実行
npm test

# 4. コミット
git add package.json package-lock.json
git commit -m "security: fix CVE-2024-12345"

# 5. 本番環境に直接デプロイ
git push origin hotfix/CVE-2024-12345
./development/scripts/deployment/unified-deploy.sh "hotfix-CVE-2024-12345"

# 6. mainブランチにマージ
git checkout main
git merge hotfix/CVE-2024-12345
git push origin main
```

**成果物**:
- パッチ適用済みコード
- テスト結果レポート

---

### Phase 5: 検証（パッチ適用後）

**目的**: パッチが正しく適用され、脆弱性が修正されたことを確認する

**検証手順**:

1. **脆弱性スキャン再実行**
   ```bash
   # npm auditで確認
   npm audit
   
   # Dockerイメージスキャン
   docker scan permission-aware-rag-webapp:latest
   
   # ECRイメージスキャン
   aws ecr start-image-scan \
     --repository-name permission-aware-rag-webapp \
     --image-id imageTag=latest
   ```

2. **機能テスト**
   ```bash
   # 全テストスイート実行
   npm test
   npm run test:integration
   npm run test:e2e
   ```

3. **パフォーマンステスト**
   ```bash
   # レイテンシ確認
   curl -w "@curl-format.txt" -o /dev/null -s https://example.com/api/health
   
   # スループット確認
   ab -n 1000 -c 10 https://example.com/api/health
   ```

4. **セキュリティテスト**
   ```bash
   # OWASP ZAPでスキャン
   docker run -t owasp/zap2docker-stable zap-baseline.py \
     -t https://example.com
   ```

**成果物**:
- 検証レポート（脆弱性が修正されたことの証明）

---

### Phase 6: 報告（検証完了後）

**目的**: 関係者に脆弱性対応の結果を報告する

**報告内容**:

1. **エグゼクティブサマリー**
   - 脆弱性の概要
   - 影響範囲
   - 対応内容
   - 対応期間

2. **詳細レポート**
   - CVE ID
   - CVSS Score
   - 影響を受けるコンポーネント
   - パッチ適用内容
   - テスト結果
   - 残存リスク

3. **今後の対策**
   - 再発防止策
   - プロセス改善
   - ツール導入

**報告先**:
- セキュリティチーム
- 開発チーム
- 運用チーム
- 経営層（Critical/High脆弱性の場合）

**成果物**:
- 脆弱性対応完了レポート

---

### 緊急時の連絡先

| 役割 | 連絡先 | 対応時間 |
|------|--------|---------|
| セキュリティチームリーダー | security-lead@example.com | 24/7 |
| 開発チームリーダー | dev-lead@example.com | 平日9-18時 |
| 運用チームリーダー | ops-lead@example.com | 24/7 |
| AWS サポート | AWS Support Console | 24/7 |
| 経営層 | exec@example.com | 緊急時のみ |

---

### エスカレーションフロー

```
Level 1: セキュリティチーム（即座対応）
  ↓ 2時間以内に解決しない場合
Level 2: 開発チームリーダー + 運用チームリーダー
  ↓ 4時間以内に解決しない場合
Level 3: CTO + CISO
  ↓ 8時間以内に解決しない場合
Level 4: CEO + 経営層
```

---

## 🔥 インシデント対応手順

### インシデント対応フロー

```
検知 → 初動対応 → 影響範囲特定 → 封じ込め → 復旧 → 事後分析
```

---

### Phase 1: インシデント検知（即座）

**目的**: セキュリティインシデントを早期に検知する

**検知方法**:

1. **自動検知**
   - GuardDuty Findings（異常なAPI呼び出し、不正アクセス等）
   - Security Hub Findings（設定違反、脆弱性等）
   - CloudWatch Alarms（異常なメトリクス）
   - CloudTrail Insights（異常なAPI活動）

2. **手動検知**
   - ユーザーからの報告
   - 監視ダッシュボードでの異常発見
   - ログ分析での異常発見

3. **外部通知**
   - AWS Security Bulletins
   - セキュリティ研究者からの報告
   - 顧客からの報告

**検知時の初動**:

```bash
# 1. インシデント対応チームに通知
aws sns publish \
  --topic-arn arn:aws:sns:ap-northeast-1:123456789012:SecurityAlerts \
  --subject "Security Incident Detected" \
  --message "GuardDuty detected unauthorized API calls"

# 2. 初期ログ収集
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=UnauthorizedOperation \
  --max-results 50 > incident-logs.json

# 3. 影響範囲の初期評価
aws guardduty get-findings \
  --detector-id [detector-id] \
  --finding-ids [finding-id] > guardduty-finding.json
```

**成果物**:
- インシデント検知レポート（検知時刻、検知方法、初期評価）

---

### Phase 2: 初動対応（15分以内）

**目的**: インシデントの拡大を防ぐ

**初動対応手順**:

1. **インシデント対応チーム招集**
   - セキュリティチームリーダー
   - 開発チームリーダー
   - 運用チームリーダー
   - AWS サポート（必要に応じて）

2. **初期封じ込め**
   ```bash
   # 疑わしいIAMユーザーを無効化
   aws iam update-access-key \
     --access-key-id AKIAIOSFODNN7EXAMPLE \
     --status Inactive \
     --user-name suspicious-user
   
   # 疑わしいセキュリティグループルールを削除
   aws ec2 revoke-security-group-ingress \
     --group-id sg-12345678 \
     --ip-permissions IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges='[{CidrIp=0.0.0.0/0}]'
   
   # 疑わしいLambda関数を無効化
   aws lambda update-function-configuration \
     --function-name suspicious-function \
     --environment Variables={DISABLED=true}
   ```

3. **証拠保全**
   ```bash
   # CloudTrailログをバックアップ
   aws s3 sync s3://cloudtrail-logs-bucket/ ./incident-evidence/cloudtrail/
   
   # CloudWatch Logsをエクスポート
   aws logs create-export-task \
     --log-group-name /aws/lambda/suspicious-function \
     --from $(date -d '1 hour ago' +%s)000 \
     --to $(date +%s)000 \
     --destination incident-evidence-bucket
   
   # スナップショット作成
   aws ec2 create-snapshot \
     --volume-id vol-12345678 \
     --description "Incident evidence snapshot"
   ```

**成果物**:
- 初動対応ログ
- 証拠保全データ

---

### Phase 3: 影響範囲特定（1時間以内）

**目的**: インシデントの影響範囲を正確に把握する

**影響範囲特定手順**:

1. **タイムライン作成**
   ```bash
   # CloudTrailで不正なAPI呼び出しを特定
   aws cloudtrail lookup-events \
     --lookup-attributes AttributeKey=Username,AttributeValue=suspicious-user \
     --start-time 2024-01-01T00:00:00Z \
     --end-time 2024-01-01T23:59:59Z > timeline.json
   ```

2. **影響を受けたリソースの特定**
   ```bash
   # 不正にアクセスされたS3バケットを特定
   aws s3api get-bucket-logging --bucket my-bucket
   
   # 不正に実行されたLambda関数を特定
   aws lambda list-functions --query 'Functions[?LastModified>`2024-01-01`]'
   
   # 不正に変更されたIAMポリシーを特定
   aws iam list-policies --scope Local --query 'Policies[?UpdateDate>`2024-01-01`]'
   ```

3. **データ漏洩の確認**
   ```bash
   # S3アクセスログを分析
   aws s3 cp s3://my-bucket-logs/ ./logs/ --recursive
   grep "GetObject" ./logs/* | grep "suspicious-user"
   
   # DynamoDBアクセスログを分析
   aws dynamodb query \
     --table-name AuditLog \
     --key-condition-expression "UserId = :user" \
     --expression-attribute-values '{":user":{"S":"suspicious-user"}}'
   ```

**成果物**:
- 影響範囲レポート（影響を受けたリソース、データ漏洩の有無）

---

### Phase 4: 封じ込め（2時間以内）

**目的**: インシデントの拡大を完全に防ぐ

**封じ込め手順**:

1. **完全な隔離**
   ```bash
   # 疑わしいEC2インスタンスを隔離
   aws ec2 modify-instance-attribute \
     --instance-id i-12345678 \
     --groups sg-isolated
   
   # 疑わしいIAMロールを削除
   aws iam delete-role --role-name suspicious-role
   
   # 疑わしいAPI Keyを削除
   aws apigateway delete-api-key --api-key suspicious-key
   ```

2. **アクセス権限の取り消し**
   ```bash
   # 全てのアクセスキーを無効化
   aws iam list-access-keys --user-name suspicious-user \
     | jq -r '.AccessKeyMetadata[].AccessKeyId' \
     | xargs -I {} aws iam update-access-key \
       --access-key-id {} --status Inactive --user-name suspicious-user
   
   # セッショントークンを無効化
   aws sts get-session-token --duration-seconds 0
   ```

3. **ネットワーク遮断**
   ```bash
   # 疑わしいIPアドレスをブロック
   aws wafv2 update-ip-set \
     --scope REGIONAL \
     --id suspicious-ip-set \
     --addresses 192.0.2.1/32
   
   # セキュリティグループで全通信を遮断
   aws ec2 revoke-security-group-ingress \
     --group-id sg-12345678 \
     --ip-permissions IpProtocol=-1
   ```

**成果物**:
- 封じ込め完了レポート

---

### Phase 5: 復旧（4時間以内）

**目的**: 正常な状態に復旧する

**復旧手順**:

1. **クリーンな環境の構築**
   ```bash
   # 新しいIAMロールを作成
   aws iam create-role \
     --role-name clean-role \
     --assume-role-policy-document file://trust-policy.json
   
   # 新しいLambda関数をデプロイ
   ./development/scripts/deployment/unified-deploy.sh "incident-recovery"
   
   # 新しいセキュリティグループを作成
   aws ec2 create-security-group \
     --group-name clean-sg \
     --description "Clean security group after incident"
   ```

2. **データの復元**
   ```bash
   # S3バケットを以前のバージョンに復元
   aws s3api list-object-versions \
     --bucket my-bucket \
     --prefix sensitive/ \
     | jq -r '.Versions[] | select(.IsLatest==false) | .VersionId' \
     | head -1 \
     | xargs -I {} aws s3api copy-object \
       --bucket my-bucket \
       --copy-source my-bucket/sensitive/data.json?versionId={} \
       --key sensitive/data.json
   
   # DynamoDBテーブルをPoint-in-Time Recoveryで復元
   aws dynamodb restore-table-to-point-in-time \
     --source-table-name original-table \
     --target-table-name restored-table \
     --restore-date-time 2024-01-01T00:00:00Z
   ```

3. **セキュリティ強化**
   ```bash
   # MFAを強制
   aws iam update-account-password-policy \
     --require-mfa true
   
   # 全てのアクセスキーをローテーション
   ./development/scripts/security/rotate-all-access-keys.sh
   
   # セキュリティグループルールを見直し
   ./development/scripts/security/audit-security-groups.sh
   ```

**成果物**:
- 復旧完了レポート

---

### Phase 6: 事後分析（復旧後1週間以内）

**目的**: インシデントから学び、再発を防止する

**事後分析手順**:

1. **ポストモーテム会議**
   - 参加者: セキュリティチーム、開発チーム、運用チーム、経営層
   - 議題:
     - インシデントの経緯
     - 対応の良かった点
     - 対応の改善点
     - 再発防止策

2. **根本原因分析**
   - 5 Whys分析
   - フィッシュボーン図
   - タイムライン分析

3. **再発防止策の策定**
   - 技術的対策（セキュリティ強化、監視強化等）
   - プロセス改善（手順書更新、訓練実施等）
   - 組織的対策（体制強化、教育実施等）

4. **ドキュメント更新**
   - インシデント対応手順書の更新
   - セキュリティベストプラクティスの更新
   - 運用手順書の更新

**成果物**:
- ポストモーテムレポート
- 再発防止策リスト
- 更新されたドキュメント

---

### インシデント対応連絡体制

| フェーズ | 連絡先 | 連絡方法 | 対応時間 |
|---------|--------|---------|---------|
| 検知 | セキュリティチーム | SNS、Email、Slack | 即座 |
| 初動対応 | セキュリティチームリーダー | 電話、Slack | 15分以内 |
| 影響範囲特定 | 開発チーム、運用チーム | Slack、Zoom | 1時間以内 |
| 封じ込め | 全チーム | Zoom会議 | 2時間以内 |
| 復旧 | 全チーム | Zoom会議 | 4時間以内 |
| 事後分析 | 全チーム + 経営層 | 対面会議 | 1週間以内 |

---

### インシデント対応ツール

| ツール | 用途 | アクセス方法 |
|--------|------|------------|
| AWS Console | リソース管理 | https://console.aws.amazon.com |
| AWS CLI | 自動化スクリプト | ローカル環境 |
| CloudTrail | ログ分析 | AWS Console |
| GuardDuty | 脅威検出 | AWS Console |
| Security Hub | セキュリティ統合 | AWS Console |
| Systems Manager | リモート実行 | AWS Console |
| Slack | コミュニケーション | https://workspace.slack.com |
| Zoom | ビデオ会議 | https://zoom.us |

---

## 📚 関連ドキュメント

### セキュリティドキュメント

- **AWS Security Best Practices**: https://aws.amazon.com/security/best-practices/
- **AWS Well-Architected Security Pillar**: https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/

### 内部ドキュメント

- **運用手順書**: `docs/guides/agentcore-operations-manual.md`
- **監視・アラート設定ガイド**: `docs/guides/agentcore-monitoring-alert-guide.md`
- **トラブルシューティングガイド**: `docs/guides/debugging-troubleshooting-guide.md`

---

## 📝 まとめ

このセキュリティガイドでは、AgentCore機能のセキュリティベストプラクティス、脆弱性対応手順、インシデント対応手順を説明しました。

### 主要なポイント

1. **多層防御**: IAM、KMS、ネットワーク、データ保護の複数層でセキュリティを確保
2. **継続的監視**: GuardDuty、Security Hub、CloudWatchで24/7監視
3. **迅速な対応**: 脆弱性とインシデントに迅速に対応する体制を整備
4. **継続的改善**: ポストモーテムで学び、セキュリティを継続的に改善

### 次のステップ

1. **セキュリティチェックリスト実施**: デプロイ前・運用中のチェックリストを実施
2. **脆弱性スキャン**: 定期的にnpm audit、Dockerスキャンを実施
3. **インシデント対応訓練**: 四半期ごとにインシデント対応訓練を実施
4. **セキュリティ監査**: 年次でセキュリティ監査を実施

---

**最終更新**: 2026-01-05  
**バージョン**: 1.0  
**ライセンス**: MIT License
