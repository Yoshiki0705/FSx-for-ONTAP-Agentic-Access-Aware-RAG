# AgentCore統合v2 セキュリティ・運用ガイド

**最終更新**: 2026-01-18  
**対象バージョン**: AgentCore統合v2  
**ドキュメント種別**: セキュリティ・運用統合ガイド

---

## 📋 目次

1. [概要](#概要)
2. [セキュリティベストプラクティス](#セキュリティベストプラクティス)
3. [インシデント対応](#インシデント対応)
4. [脆弱性対応](#脆弱性対応)
5. [セキュリティチェックリスト](#セキュリティチェックリスト)
6. [まとめ](#まとめ)

---

## 概要

本ガイドは、AgentCore統合v2システムのセキュリティ運用に関する包括的なドキュメントです。以下の4つの主要領域をカバーします：

- **セキュリティベストプラクティス**: 日常的なセキュリティ運用の推奨事項
- **インシデント対応**: セキュリティインシデント発生時の対応手順
- **脆弱性対応**: 脆弱性の検出・評価・修正プロセス
- **チェックリスト**: 定期的なセキュリティ確認項目

### 対象読者

- システム管理者
- セキュリティ担当者
- DevOpsエンジニア
- インシデント対応チーム

### 前提条件

- AgentCore統合v2システムの基本的な理解
- AWSサービスの基礎知識
- セキュリティの基本概念の理解

---

## セキュリティベストプラクティス

### 1. 認証・認可

#### 1.1 IAMロールとポリシー

**最小権限の原則**:
- 各コンポーネントに必要最小限の権限のみを付与
- ワイルドカード（`*`）の使用を避ける
- リソースベースのポリシーを優先

**推奨設定**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeAgent",
        "bedrock:Retrieve"
      ],
      "Resource": [
        "arn:aws:bedrock:ap-northeast-1:ACCOUNT_ID:agent/AGENT_ID",
        "arn:aws:bedrock:ap-northeast-1:ACCOUNT_ID:knowledge-base/KB_ID"
      ]
    }
  ]
}
```

**定期レビュー**:
- 月次でIAMポリシーをレビュー
- 未使用の権限を削除
- AWS Access Analyzerで過剰な権限を検出

#### 1.2 Cognito認証

**パスワードポリシー**:
- 最小長: 12文字以上
- 複雑性要件: 大文字、小文字、数字、特殊文字を含む
- パスワード履歴: 過去5回のパスワードを再利用不可
- パスワード有効期限: 90日

**MFA（多要素認証）**:
- 管理者アカウントは必須
- 一般ユーザーは推奨
- TOTP（Time-based One-Time Password）を使用

**セッション管理**:
- アクセストークン有効期限: 1時間
- リフレッシュトークン有効期限: 30日
- アイドルタイムアウト: 15分


### 2. ネットワークセキュリティ

#### 2.1 VPC設計

**サブネット分離**:
- パブリックサブネット: ALB、NAT Gateway
- プライベートサブネット: Lambda、ECS、RDS
- 分離サブネット: データベース、機密データ

**セキュリティグループ**:
```typescript
// Lambda関数用セキュリティグループ
const lambdaSG = new ec2.SecurityGroup(this, 'LambdaSG', {
  vpc,
  description: 'Security group for Lambda functions',
  allowAllOutbound: false, // 明示的なアウトバウンドルールのみ
});

// 必要最小限のアウトバウンドルール
lambdaSG.addEgressRule(
  ec2.Peer.ipv4('10.0.0.0/16'),
  ec2.Port.tcp(443),
  'HTTPS to VPC endpoints'
);
```

**NACLs（ネットワークACL）**:
- デフォルトで全て拒否
- 必要なトラフィックのみ許可
- ステートレスなため、インバウンド・アウトバウンド両方を設定

#### 2.2 VPCエンドポイント

**プライベート接続**:
- S3、DynamoDB: Gateway Endpoint
- Bedrock、Secrets Manager: Interface Endpoint
- インターネットゲートウェイを経由しない

**エンドポイントポリシー**:
```json
{
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": [
        "bedrock:InvokeAgent",
        "bedrock:Retrieve"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:PrincipalAccount": "ACCOUNT_ID"
        }
      }
    }
  ]
}
```


### 3. データ保護

#### 3.1 暗号化

**保存時の暗号化（Encryption at Rest）**:
- S3: SSE-KMS（AWS KMS管理キー）
- DynamoDB: KMS暗号化
- RDS: 透過的データ暗号化（TDE）
- EBS: KMS暗号化

**転送時の暗号化（Encryption in Transit）**:
- TLS 1.2以上を使用
- 自己署名証明書は使用しない
- 証明書の有効期限を監視

**KMS キー管理**:
```typescript
// カスタマー管理キー（CMK）
const kmsKey = new kms.Key(this, 'DataEncryptionKey', {
  enableKeyRotation: true, // 自動ローテーション有効
  description: 'Key for encrypting sensitive data',
  removalPolicy: cdk.RemovalPolicy.RETAIN, // 削除保護
});

// キーポリシー
kmsKey.addToResourcePolicy(new iam.PolicyStatement({
  actions: ['kms:Decrypt', 'kms:DescribeKey'],
  principals: [new iam.ServicePrincipal('lambda.amazonaws.com')],
  resources: ['*'],
  conditions: {
    StringEquals: {
      'kms:ViaService': `lambda.ap-northeast-1.amazonaws.com`,
    },
  },
}));
```

#### 3.2 機密情報管理

**AWS Secrets Manager**:
- データベース認証情報
- APIキー
- 外部サービスのトークン

**自動ローテーション**:
```typescript
const secret = new secretsmanager.Secret(this, 'DBSecret', {
  generateSecretString: {
    secretStringTemplate: JSON.stringify({ username: 'admin' }),
    generateStringKey: 'password',
    excludePunctuation: true,
    passwordLength: 32,
  },
});

// 30日ごとに自動ローテーション
secret.addRotationSchedule('RotationSchedule', {
  automaticallyAfter: cdk.Duration.days(30),
  rotationLambda: rotationFunction,
});
```

**環境変数の保護**:
- 機密情報は環境変数に直接設定しない
- Secrets Managerから動的に取得
- CloudFormationテンプレートに平文で記載しない


### 4. ログとモニタリング

#### 4.1 CloudWatch Logs

**ログ収集**:
- Lambda関数: 全ての実行ログ
- API Gateway: アクセスログ、実行ログ
- VPC Flow Logs: ネットワークトラフィック
- CloudTrail: API呼び出し履歴

**ログ保持期間**:
- 本番環境: 90日以上
- 開発環境: 30日
- コンプライアンス要件に応じて調整

**ログ暗号化**:
```typescript
const logGroup = new logs.LogGroup(this, 'ApplicationLogs', {
  retention: logs.RetentionDays.THREE_MONTHS,
  encryptionKey: kmsKey, // KMS暗号化
  removalPolicy: cdk.RemovalPolicy.RETAIN,
});
```

#### 4.2 CloudWatch Alarms

**重要なメトリクス**:
- Lambda関数のエラー率
- API Gatewayの4xx/5xxエラー
- DynamoDBのスロットリング
- 認証失敗の回数

**アラーム設定例**:
```typescript
// Lambda関数のエラー率アラーム
const errorAlarm = new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
  metric: lambdaFunction.metricErrors({
    statistic: 'Sum',
    period: cdk.Duration.minutes(5),
  }),
  threshold: 10,
  evaluationPeriods: 2,
  alarmDescription: 'Lambda function error rate is too high',
  actionsEnabled: true,
});

errorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));
```

#### 4.3 AWS CloudTrail

**監査ログ**:
- 全てのAPI呼び出しを記録
- S3バケットに保存（暗号化）
- CloudWatch Logsにストリーミング

**重要イベントの監視**:
- IAMポリシーの変更
- セキュリティグループの変更
- KMSキーの削除
- ルートアカウントの使用


### 5. アプリケーションセキュリティ

#### 5.1 入力検証

**サニタイゼーション**:
```typescript
import { z } from 'zod';

// Zodスキーマで入力検証
const userInputSchema = z.object({
  query: z.string().min(1).max(1000),
  sessionId: z.string().uuid(),
  userId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
});

// 検証実行
try {
  const validatedInput = userInputSchema.parse(input);
  // 処理を続行
} catch (error) {
  // バリデーションエラー
  return { statusCode: 400, body: 'Invalid input' };
}
```

**SQLインジェクション対策**:
- プリペアドステートメントを使用
- ORMを使用（TypeORM、Prisma等）
- 動的SQLの生成を避ける

**XSS対策**:
- ユーザー入力をエスケープ
- Content Security Policy（CSP）ヘッダーを設定
- HTTPOnlyクッキーを使用

#### 5.2 API セキュリティ

**レート制限**:
```typescript
// API Gatewayのスロットリング設定
const api = new apigateway.RestApi(this, 'AgentCoreAPI', {
  deployOptions: {
    throttlingRateLimit: 1000, // 1秒あたり1000リクエスト
    throttlingBurstLimit: 2000, // バースト時2000リクエスト
  },
});
```

**CORS設定**:
```typescript
// 厳格なCORS設定
api.addCorsPreflight('/*', {
  allowOrigins: ['https://yourdomain.com'], // 特定のドメインのみ
  allowMethods: ['GET', 'POST'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: cdk.Duration.hours(1),
});
```

**APIキー管理**:
- API Gatewayの使用量プランを使用
- キーのローテーション（90日ごと）
- 未使用のキーを無効化


### 6. コンプライアンスとガバナンス

#### 6.1 AWS Config

**リソース設定の監視**:
```typescript
// AWS Config ルール
const configRule = new config.ManagedRule(this, 'EncryptedVolumes', {
  identifier: config.ManagedRuleIdentifiers.EC2_EBS_ENCRYPTION_BY_DEFAULT,
  description: 'Checks that EBS volumes are encrypted',
});
```

**コンプライアンスチェック**:
- S3バケットの暗号化
- RDSの自動バックアップ
- Lambda関数のVPC配置
- セキュリティグループのルール

#### 6.2 AWS Security Hub

**統合セキュリティ管理**:
- GuardDuty、Inspector、Macieの統合
- CIS AWS Foundations Benchmarkの準拠
- セキュリティスコアの可視化

**自動修復**:
```typescript
// Security Hubの検出結果に基づく自動修復
const remediationRule = new events.Rule(this, 'AutoRemediation', {
  eventPattern: {
    source: ['aws.securityhub'],
    detailType: ['Security Hub Findings - Imported'],
    detail: {
      findings: {
        Compliance: {
          Status: ['FAILED'],
        },
      },
    },
  },
  targets: [new targets.LambdaFunction(remediationFunction)],
});
```

#### 6.3 タグ付け戦略

**必須タグ**:
- `Environment`: 環境（prod、staging、dev）
- `Project`: プロジェクト名
- `Owner`: 責任者
- `CostCenter`: コストセンター
- `Compliance`: コンプライアンス要件

**タグポリシー**:
```json
{
  "tags": {
    "Environment": {
      "tag_key": {
        "@@assign": "Environment"
      },
      "tag_value": {
        "@@assign": ["prod", "staging", "dev"]
      },
      "enforced_for": {
        "@@assign": ["ec2:instance", "lambda:function", "s3:bucket"]
      }
    }
  }
}
```


### 7. バックアップとディザスタリカバリ

#### 7.1 バックアップ戦略

**RTO/RPO目標**:
- RTO（Recovery Time Objective）: 4時間
- RPO（Recovery Point Objective）: 1時間

**バックアップ対象**:
- DynamoDB: ポイントインタイムリカバリ（PITR）有効
- RDS: 自動バックアップ（7日保持）
- S3: バージョニング有効
- Lambda関数: コードのバージョン管理

**AWS Backup**:
```typescript
const backupPlan = new backup.BackupPlan(this, 'BackupPlan', {
  backupPlanRules: [
    new backup.BackupPlanRule({
      ruleName: 'DailyBackup',
      scheduleExpression: events.Schedule.cron({
        hour: '2',
        minute: '0',
      }),
      deleteAfter: cdk.Duration.days(30),
      moveToColdStorageAfter: cdk.Duration.days(7),
    }),
  ],
});

// DynamoDBテーブルをバックアップ対象に追加
backupPlan.addSelection('Selection', {
  resources: [
    backup.BackupResource.fromDynamoDbTable(table),
  ],
});
```

#### 7.2 ディザスタリカバリ

**マルチリージョン構成**:
- プライマリリージョン: ap-northeast-1（東京）
- セカンダリリージョン: ap-northeast-3（大阪）
- DynamoDBグローバルテーブル
- S3クロスリージョンレプリケーション

**フェイルオーバー手順**:
1. Route 53ヘルスチェックで障害検出
2. 自動的にセカンダリリージョンにフェイルオーバー
3. アラート通知
4. 手動での確認と対応


### 8. セキュリティテスト

#### 8.1 脆弱性スキャン

**Amazon Inspector**:
- EC2インスタンスの脆弱性スキャン
- Lambda関数の脆弱性スキャン
- コンテナイメージのスキャン

**定期スキャン**:
```typescript
// Inspectorの有効化
const inspector = new inspector2.CfnEnabler(this, 'InspectorEnabler', {
  resourceTypes: ['EC2', 'ECR', 'LAMBDA'],
  accountIds: [cdk.Stack.of(this).account],
});
```

#### 8.2 ペネトレーションテスト

**実施頻度**:
- 年次: 包括的なペネトレーションテスト
- 四半期: 重要な変更後のテスト
- 随時: 新機能リリース前のテスト

**テスト範囲**:
- 認証・認可の脆弱性
- インジェクション攻撃
- セッション管理
- APIセキュリティ

#### 8.3 セキュリティコードレビュー

**レビュー項目**:
- ハードコードされた認証情報
- 不適切なエラーハンドリング
- 安全でない暗号化
- 入力検証の欠如

**自動化ツール**:
- SonarQube: コード品質とセキュリティ
- Snyk: 依存関係の脆弱性
- git-secrets: 認証情報の検出


### 9. サードパーティ統合

#### 9.1 依存関係管理

**npm パッケージ**:
- `npm audit`で脆弱性チェック
- Dependabotで自動更新
- ロックファイル（package-lock.json）のコミット

**脆弱性対応**:
```bash
# 脆弱性スキャン
npm audit

# 自動修正（可能な場合）
npm audit fix

# 手動更新が必要な場合
npm update package-name
```

#### 9.2 外部API連携

**APIキーの保護**:
- Secrets Managerに保存
- 環境変数経由で取得
- ログに出力しない

**通信の暗号化**:
- TLS 1.2以上を使用
- 証明書の検証を有効化
- タイムアウトの設定

**レート制限の遵守**:
- 外部APIのレート制限を確認
- リトライロジックの実装
- エクスポネンシャルバックオフ


### 10. セキュリティ教育とトレーニング

#### 10.1 開発者向けトレーニング

**必須トピック**:
- OWASP Top 10
- AWSセキュリティベストプラクティス
- セキュアコーディング
- インシデント対応手順

**トレーニング頻度**:
- 新規メンバー: オンボーディング時
- 全メンバー: 年2回
- セキュリティチーム: 四半期ごと

#### 10.2 セキュリティ意識向上

**フィッシング訓練**:
- 四半期ごとに実施
- 結果の分析と改善
- 追加トレーニングの提供

**セキュリティニュースレター**:
- 月次で配信
- 最新の脅威情報
- ベストプラクティスの共有

---

## インシデント対応

### インシデント対応フレームワーク

AgentCore統合v2システムにおけるセキュリティインシデント対応は、以下の6つのフェーズで構成されます：

1. **準備（Preparation）**
2. **検出と分析（Detection & Analysis）**
3. **封じ込め（Containment）**
4. **根絶（Eradication）**
5. **復旧（Recovery）**
6. **事後対応（Post-Incident Activity）**

---

### Phase 1: 準備（Preparation）

#### 1.1 インシデント対応チームの編成

**チーム構成**:
- **インシデントマネージャー**: 全体統括、意思決定
- **セキュリティアナリスト**: 脅威分析、調査
- **システムエンジニア**: 技術対応、復旧作業
- **コミュニケーション担当**: 内外への連絡
- **法務担当**: 法的対応、コンプライアンス

**連絡先リスト**:
```
インシデントマネージャー: [名前] [電話] [メール]
セキュリティアナリスト: [名前] [電話] [メール]
システムエンジニア: [名前] [電話] [メール]
AWS サポート: +81-3-XXXX-XXXX
```

#### 1.2 ツールとリソースの準備

**必須ツール**:
- AWS CloudWatch Logs Insights
- AWS CloudTrail
- AWS Security Hub
- Amazon GuardDuty
- フォレンジック用EC2インスタンス

**ドキュメント**:
- システムアーキテクチャ図
- ネットワーク構成図
- IAMロール・ポリシー一覧
- 緊急連絡先リスト
- エスカレーションフロー

#### 1.3 インシデント分類

**重大度レベル**:

| レベル | 説明 | 対応時間 | 例 |
|--------|------|----------|-----|
| **Critical** | システム全体に影響 | 即時 | データ漏洩、ランサムウェア |
| **High** | 重要機能に影響 | 1時間以内 | 不正アクセス、DDoS攻撃 |
| **Medium** | 一部機能に影響 | 4時間以内 | マルウェア検出、脆弱性悪用 |
| **Low** | 軽微な影響 | 24時間以内 | ポリシー違反、疑わしい活動 |


### Phase 2: 検出と分析（Detection & Analysis）

#### 2.1 インシデント検出

**自動検出**:
- GuardDuty: 異常なAPI呼び出し、不正アクセス
- CloudWatch Alarms: メトリクスの異常値
- Security Hub: セキュリティ検出結果の統合
- VPC Flow Logs: 異常なネットワークトラフィック

**手動検出**:
- ユーザーからの報告
- セキュリティ監査
- ログレビュー

#### 2.2 初期分析

**情報収集**:
```bash
# CloudTrailログの確認
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=ConsoleLogin \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z

# GuardDuty検出結果の取得
aws guardduty list-findings \
  --detector-id <detector-id> \
  --finding-criteria '{"Criterion":{"severity":{"Gte":7}}}'

# VPC Flow Logsの分析
aws logs filter-log-events \
  --log-group-name /aws/vpc/flowlogs \
  --filter-pattern '[version, account, eni, source, destination, srcport, destport="22", protocol="6", packets, bytes, windowstart, windowend, action="REJECT", flowlogstatus]'
```

**タイムライン作成**:
1. 最初の異常検出時刻
2. 影響を受けたリソース
3. 実行されたアクション
4. 関連するIPアドレス、ユーザー

#### 2.3 影響範囲の特定

**チェック項目**:
- 影響を受けたAWSアカウント
- 侵害されたリソース（EC2、Lambda、S3等）
- アクセスされたデータ
- 変更されたIAMポリシー
- 作成された不正なリソース


### Phase 3: 封じ込め（Containment）

#### 3.1 短期的封じ込め

**即座に実行**:

1. **侵害されたアカウントの無効化**:
```bash
# IAMユーザーの無効化
aws iam update-login-profile \
  --user-name compromised-user \
  --password-reset-required

# アクセスキーの無効化
aws iam update-access-key \
  --user-name compromised-user \
  --access-key-id AKIAIOSFODNN7EXAMPLE \
  --status Inactive
```

2. **セキュリティグループの変更**:
```bash
# 全てのインバウンドトラフィックをブロック
aws ec2 revoke-security-group-ingress \
  --group-id sg-xxxxx \
  --ip-permissions '[{"IpProtocol": "-1", "IpRanges": [{"CidrIp": "0.0.0.0/0"}]}]'
```

3. **侵害されたインスタンスの隔離**:
```bash
# インスタンスを隔離用セキュリティグループに移動
aws ec2 modify-instance-attribute \
  --instance-id i-xxxxx \
  --groups sg-isolation
```

#### 3.2 長期的封じ込め

**システムの安定化**:
- バックアップからの復旧準備
- 代替システムの起動
- トラフィックの迂回

**証拠保全**:
```bash
# EBSスナップショットの作成
aws ec2 create-snapshot \
  --volume-id vol-xxxxx \
  --description "Forensic snapshot - Incident #12345"

# S3バケットのバージョニング有効化（未設定の場合）
aws s3api put-bucket-versioning \
  --bucket compromised-bucket \
  --versioning-configuration Status=Enabled

# CloudTrailログのコピー
aws s3 sync s3://cloudtrail-bucket/AWSLogs/ \
  s3://forensic-bucket/incident-12345/cloudtrail/
```


### Phase 4: 根絶（Eradication）

#### 4.1 脅威の除去

**マルウェアの削除**:
```bash
# 侵害されたインスタンスの終了
aws ec2 terminate-instances --instance-ids i-xxxxx

# 不正なLambda関数の削除
aws lambda delete-function --function-name malicious-function

# 不正なIAMロールの削除
aws iam delete-role --role-name compromised-role
```

**バックドアの除去**:
- 不正なSSHキーの削除
- 不正なIAMユーザー・ロールの削除
- 不正なセキュリティグループルールの削除
- 不正なS3バケットポリシーの削除

#### 4.2 脆弱性の修正

**パッチ適用**:
```bash
# Systems Managerでパッチ適用
aws ssm send-command \
  --document-name "AWS-RunPatchBaseline" \
  --targets "Key=instanceids,Values=i-xxxxx" \
  --parameters "Operation=Install"
```

**設定の強化**:
- IAMポリシーの見直し
- セキュリティグループの最小化
- 不要なサービスの無効化
- ログ設定の強化

#### 4.3 認証情報のローテーション

**全ての認証情報を更新**:
```bash
# Secrets Managerのシークレットをローテーション
aws secretsmanager rotate-secret \
  --secret-id database-credentials

# IAMアクセスキーの再生成
aws iam create-access-key --user-name user-name
aws iam delete-access-key \
  --user-name user-name \
  --access-key-id old-key-id

# RDSパスワードの変更
aws rds modify-db-instance \
  --db-instance-identifier mydb \
  --master-user-password new-password
```


### Phase 5: 復旧（Recovery）

#### 5.1 システムの復旧

**クリーンな環境からの復旧**:
```bash
# 新しいAMIからインスタンスを起動
aws ec2 run-instances \
  --image-id ami-clean-xxxxx \
  --instance-type t3.medium \
  --security-group-ids sg-secure-xxxxx \
  --subnet-id subnet-xxxxx

# Lambda関数の再デプロイ
aws lambda update-function-code \
  --function-name my-function \
  --s3-bucket deployment-bucket \
  --s3-key clean-code.zip
```

**データの復元**:
```bash
# DynamoDBのポイントインタイムリカバリ
aws dynamodb restore-table-to-point-in-time \
  --source-table-name original-table \
  --target-table-name restored-table \
  --restore-date-time 2024-01-01T12:00:00Z

# RDSスナップショットからの復元
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier restored-db \
  --db-snapshot-identifier clean-snapshot
```

#### 5.2 監視の強化

**追加の監視設定**:
```typescript
// 侵害されたリソースタイプの監視強化
const enhancedAlarm = new cloudwatch.Alarm(this, 'EnhancedMonitoring', {
  metric: new cloudwatch.Metric({
    namespace: 'AWS/Lambda',
    metricName: 'Invocations',
    dimensionsMap: {
      FunctionName: 'sensitive-function',
    },
    statistic: 'Sum',
    period: cdk.Duration.minutes(1),
  }),
  threshold: 100,
  evaluationPeriods: 1,
  alarmDescription: 'Enhanced monitoring after incident',
});
```

#### 5.3 段階的な復旧

**復旧手順**:
1. 開発環境で検証
2. ステージング環境で検証
3. 本番環境の一部で検証
4. 全体への展開
5. 24時間の集中監視


### Phase 6: 事後対応（Post-Incident Activity）

#### 6.1 インシデントレポート作成

**レポート内容**:
```markdown
# インシデントレポート #12345

## 概要
- **発生日時**: 2024-01-01 10:00 JST
- **検出日時**: 2024-01-01 10:15 JST
- **重大度**: High
- **影響範囲**: Lambda関数、DynamoDBテーブル

## タイムライン
- 10:00 - 不正なAPI呼び出しを検出
- 10:15 - GuardDutyアラート発報
- 10:20 - インシデント対応チーム招集
- 10:30 - 侵害されたアカウントを無効化
- 11:00 - 影響範囲の特定完了
- 12:00 - 脅威の除去完了
- 14:00 - システム復旧完了

## 根本原因
- IAMポリシーの過剰な権限
- MFAの未設定
- CloudTrailログの監視不足

## 対応アクション
- IAMポリシーの最小権限化
- 全アカウントでMFA強制
- CloudWatch Alarmsの追加

## 学んだ教訓
- 早期検出の重要性
- 定期的なセキュリティレビューの必要性
```

#### 6.2 根本原因分析（RCA）

**5 Whys分析**:
1. なぜインシデントが発生したか？ → 不正アクセスがあった
2. なぜ不正アクセスがあったか？ → 認証情報が漏洩した
3. なぜ認証情報が漏洩したか？ → GitHubに誤ってコミットした
4. なぜGitHubにコミットしたか？ → git-secretsが設定されていなかった
5. なぜgit-secretsが設定されていなかったか？ → オンボーディングプロセスに含まれていなかった

**是正措置**:
- オンボーディングプロセスにgit-secrets設定を追加
- CI/CDパイプラインに認証情報スキャンを追加
- 定期的なセキュリティトレーニングの実施

#### 6.3 改善計画

**短期的改善（1ヶ月以内）**:
- [ ] IAMポリシーの見直しと最小権限化
- [ ] MFAの全アカウント強制
- [ ] CloudWatch Alarmsの追加
- [ ] インシデント対応手順の更新

**中期的改善（3ヶ月以内）**:
- [ ] セキュリティ自動化の強化
- [ ] フォレンジック環境の整備
- [ ] セキュリティトレーニングの実施
- [ ] ペネトレーションテストの実施

**長期的改善（6ヶ月以内）**:
- [ ] ゼロトラストアーキテクチャの導入
- [ ] AIベースの脅威検出の導入
- [ ] セキュリティ文化の醸成

---

## 脆弱性対応

### 脆弱性管理プロセス

AgentCore統合v2システムにおける脆弱性管理は、継続的なプロセスとして実施されます。

---

### 1. 脆弱性の検出

#### 1.1 自動スキャン

**Amazon Inspector**:
```typescript
// Inspectorの有効化
const inspector = new inspector2.CfnEnabler(this, 'InspectorEnabler', {
  resourceTypes: ['EC2', 'ECR', 'LAMBDA'],
  accountIds: [cdk.Stack.of(this).account],
});

// スキャン結果の通知
const inspectorRule = new events.Rule(this, 'InspectorFindings', {
  eventPattern: {
    source: ['aws.inspector2'],
    detailType: ['Inspector2 Finding'],
    detail: {
      severity: ['CRITICAL', 'HIGH'],
    },
  },
  targets: [new targets.SnsTopic(securityTopic)],
});
```

**スキャン対象**:
- EC2インスタンス: OS、ネットワーク設定
- Lambda関数: コード、依存関係
- ECRイメージ: コンテナイメージ、パッケージ

**スキャン頻度**:
- 継続的スキャン: 新しいリソースが作成されたとき
- 定期スキャン: 毎日（既存リソース）
- オンデマンドスキャン: 必要に応じて

#### 1.2 依存関係の脆弱性

**npm audit**:
```bash
# 脆弱性スキャン
npm audit

# JSON形式で出力
npm audit --json > audit-report.json

# 重大度でフィルタ
npm audit --audit-level=high
```

**Dependabot設定**:
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "daily"
    open-pull-requests-limit: 10
    reviewers:
      - "security-team"
    labels:
      - "security"
      - "dependencies"
```

#### 1.3 手動レビュー

**コードレビュー**:
- プルリクエストでのセキュリティレビュー
- 定期的なコード監査
- セキュリティチェックリストの使用

**設定レビュー**:
- IAMポリシーの定期レビュー
- セキュリティグループの定期レビュー
- S3バケットポリシーの定期レビュー


### 2. 脆弱性の評価

#### 2.1 重大度の判定

**CVSSスコアリング**:

| CVSS Score | 重大度 | 対応期限 | 例 |
|------------|--------|----------|-----|
| 9.0-10.0 | Critical | 24時間以内 | リモートコード実行 |
| 7.0-8.9 | High | 7日以内 | 権限昇格 |
| 4.0-6.9 | Medium | 30日以内 | 情報漏洩 |
| 0.1-3.9 | Low | 90日以内 | DoS |

**評価基準**:
- **悪用可能性**: 攻撃の容易さ
- **影響範囲**: 影響を受けるシステム
- **機密性**: データの機密性
- **完全性**: データの改ざん可能性
- **可用性**: サービスの停止可能性

#### 2.2 ビジネスへの影響評価

**影響度の判定**:
```typescript
interface VulnerabilityImpact {
  technicalSeverity: 'Critical' | 'High' | 'Medium' | 'Low';
  businessImpact: 'Critical' | 'High' | 'Medium' | 'Low';
  affectedSystems: string[];
  dataAtRisk: string[];
  complianceImpact: boolean;
}

// 評価例
const vulnerability: VulnerabilityImpact = {
  technicalSeverity: 'High',
  businessImpact: 'Critical', // 顧客データが影響を受ける
  affectedSystems: ['Lambda', 'DynamoDB'],
  dataAtRisk: ['Customer PII', 'Transaction Data'],
  complianceImpact: true, // GDPR違反の可能性
};
```

#### 2.3 優先順位付け

**優先度マトリクス**:

| 技術的重大度 | ビジネス影響: Critical | ビジネス影響: High | ビジネス影響: Medium | ビジネス影響: Low |
|--------------|------------------------|-------------------|---------------------|------------------|
| **Critical** | P0（即時） | P0（即時） | P1（24時間） | P1（24時間） |
| **High** | P0（即時） | P1（24時間） | P2（7日） | P3（30日） |
| **Medium** | P1（24時間） | P2（7日） | P3（30日） | P4（90日） |
| **Low** | P2（7日） | P3（30日） | P4（90日） | P4（90日） |


### 3. 脆弱性の修正

#### 3.1 パッチ適用

**OSパッチ**:
```bash
# Systems Managerでパッチ適用
aws ssm create-patch-baseline \
  --name "SecurityPatches" \
  --operating-system "AMAZON_LINUX_2" \
  --approval-rules "PatchRules=[{PatchFilterGroup={PatchFilters=[{Key=SEVERITY,Values=[Critical,Important]}]},ApproveAfterDays=0}]"

# パッチグループの作成
aws ssm register-patch-baseline-for-patch-group \
  --baseline-id pb-xxxxx \
  --patch-group "Production"

# パッチ適用の実行
aws ssm send-command \
  --document-name "AWS-RunPatchBaseline" \
  --targets "Key=tag:PatchGroup,Values=Production" \
  --parameters "Operation=Install"
```

**アプリケーションパッチ**:
```bash
# npm パッケージの更新
npm update package-name

# 特定のバージョンへの更新
npm install package-name@1.2.3

# package-lock.jsonの更新
npm install
```

#### 3.2 設定変更

**セキュリティグループの修正**:
```bash
# 不要なルールの削除
aws ec2 revoke-security-group-ingress \
  --group-id sg-xxxxx \
  --ip-permissions '[{"IpProtocol": "tcp", "FromPort": 22, "ToPort": 22, "IpRanges": [{"CidrIp": "0.0.0.0/0"}]}]'

# 制限されたルールの追加
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --ip-permissions '[{"IpProtocol": "tcp", "FromPort": 22, "ToPort": 22, "IpRanges": [{"CidrIp": "10.0.0.0/8"}]}]'
```

**IAMポリシーの修正**:
```bash
# ポリシーの更新
aws iam create-policy-version \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/MyPolicy \
  --policy-document file://updated-policy.json \
  --set-as-default
```

#### 3.3 ワークアラウンド

**一時的な対策**:
- WAFルールの追加
- レート制限の強化
- 機能の一時無効化
- トラフィックの制限

**ワークアラウンド例**:
```typescript
// WAFルールで脆弱性を緩和
const wafRule = new wafv2.CfnWebACLRule({
  name: 'BlockVulnerableEndpoint',
  priority: 1,
  statement: {
    byteMatchStatement: {
      searchString: '/vulnerable-endpoint',
      fieldToMatch: { uriPath: {} },
      textTransformations: [{ priority: 0, type: 'NONE' }],
      positionalConstraint: 'CONTAINS',
    },
  },
  action: { block: {} },
  visibilityConfig: {
    sampledRequestsEnabled: true,
    cloudWatchMetricsEnabled: true,
    metricName: 'BlockVulnerableEndpoint',
  },
});
```


### 4. 検証とテスト

#### 4.1 修正の検証

**自動テスト**:
```bash
# 単体テスト
npm test

# 統合テスト
npm run test:integration

# セキュリティテスト
npm audit
npm run test:security
```

**手動テスト**:
- 機能テスト: 修正が機能に影響しないことを確認
- セキュリティテスト: 脆弱性が修正されたことを確認
- パフォーマンステスト: 性能劣化がないことを確認

#### 4.2 再スキャン

**Inspector再スキャン**:
```bash
# 特定のリソースを再スキャン
aws inspector2 create-findings-report \
  --report-format JSON \
  --s3-destination bucketName=security-reports,keyPrefix=rescans/

# スキャン結果の確認
aws inspector2 list-findings \
  --filter-criteria '{"resourceId":[{"comparison":"EQUALS","value":"i-xxxxx"}]}'
```

#### 4.3 本番環境への展開

**段階的展開**:
1. 開発環境でテスト
2. ステージング環境でテスト
3. 本番環境の一部（カナリアデプロイ）
4. 全体への展開

**ロールバック計画**:
```bash
# Lambda関数のバージョン管理
aws lambda publish-version \
  --function-name my-function

# 以前のバージョンへのロールバック
aws lambda update-alias \
  --function-name my-function \
  --name PROD \
  --function-version 1
```


### 5. 文書化と報告

#### 5.1 脆弱性レポート

**レポートテンプレート**:
```markdown
# 脆弱性レポート: CVE-2024-XXXXX

## 概要
- **CVE ID**: CVE-2024-XXXXX
- **発見日**: 2024-01-01
- **重大度**: High (CVSS 8.5)
- **影響を受けるコンポーネント**: Lambda関数、npm package "vulnerable-lib"

## 詳細
### 脆弱性の説明
[脆弱性の詳細な説明]

### 影響範囲
- 影響を受けるシステム: [リスト]
- 影響を受けるデータ: [リスト]
- 悪用の可能性: [高/中/低]

## 対応
### 修正内容
- パッケージを1.2.3から1.2.4にアップデート
- 設定ファイルの変更

### 検証結果
- 単体テスト: 合格
- 統合テスト: 合格
- セキュリティスキャン: 脆弱性なし

### デプロイ
- デプロイ日時: 2024-01-02 10:00 JST
- デプロイ環境: 本番環境
- ロールバック計画: [詳細]

## 予防策
- 依存関係の定期更新
- Dependabotの有効化
- セキュリティスキャンの自動化
```

#### 5.2 ステークホルダーへの報告

**報告対象**:
- 経営層: 重大度Critical/Highの脆弱性
- 開発チーム: 全ての脆弱性
- セキュリティチーム: 全ての脆弱性
- コンプライアンスチーム: コンプライアンスに影響する脆弱性

**報告頻度**:
- Critical: 即時
- High: 24時間以内
- Medium: 週次レポート
- Low: 月次レポート

#### 5.3 ナレッジベースの更新

**文書化項目**:
- 脆弱性の詳細
- 修正手順
- 検証方法
- 予防策
- 学んだ教訓

---

## セキュリティチェックリスト

### デプロイ前チェックリスト

#### 認証・認可
- [ ] IAMロールは最小権限の原則に従っている
- [ ] ワイルドカード（`*`）の使用を避けている
- [ ] リソースベースのポリシーを使用している
- [ ] MFAが必要なアカウントで有効化されている
- [ ] パスワードポリシーが要件を満たしている

#### ネットワークセキュリティ
- [ ] セキュリティグループは最小限のルールのみ
- [ ] 0.0.0.0/0からのインバウンドトラフィックを避けている
- [ ] VPCエンドポイントを使用している
- [ ] NACLsが適切に設定されている
- [ ] VPC Flow Logsが有効化されている

#### データ保護
- [ ] S3バケットでSSE-KMSが有効化されている
- [ ] DynamoDBでKMS暗号化が有効化されている
- [ ] RDSで透過的データ暗号化が有効化されている
- [ ] TLS 1.2以上を使用している
- [ ] 機密情報はSecrets Managerに保存されている

#### ログとモニタリング
- [ ] CloudWatch Logsが有効化されている
- [ ] ログ保持期間が適切に設定されている
- [ ] CloudTrailが有効化されている
- [ ] 重要なメトリクスにアラームが設定されている
- [ ] SNS通知が設定されている

#### アプリケーションセキュリティ
- [ ] 入力検証が実装されている
- [ ] SQLインジェクション対策が実装されている
- [ ] XSS対策が実装されている
- [ ] CSRF対策が実装されている
- [ ] レート制限が設定されている

#### コンプライアンス
- [ ] 必須タグが設定されている
- [ ] AWS Configルールが有効化されている
- [ ] Security Hubが有効化されている
- [ ] GuardDutyが有効化されている
- [ ] Inspectorが有効化されている

#### バックアップ
- [ ] DynamoDBのPITRが有効化されている
- [ ] RDSの自動バックアップが有効化されている
- [ ] S3バケットのバージョニングが有効化されている
- [ ] AWS Backupプランが設定されている
- [ ] バックアップのテストが実施されている


### 定期レビューチェックリスト

#### 月次レビュー
- [ ] IAMポリシーのレビュー
- [ ] セキュリティグループのレビュー
- [ ] 未使用のリソースの削除
- [ ] ログの確認
- [ ] アラームの確認
- [ ] 脆弱性スキャン結果の確認
- [ ] パッチ適用状況の確認

#### 四半期レビュー
- [ ] アクセス権限の全体レビュー
- [ ] セキュリティ設定の全体レビュー
- [ ] ディザスタリカバリ計画のテスト
- [ ] インシデント対応手順のレビュー
- [ ] セキュリティトレーニングの実施
- [ ] ペネトレーションテストの実施

#### 年次レビュー
- [ ] セキュリティポリシーの全体レビュー
- [ ] アーキテクチャのセキュリティレビュー
- [ ] コンプライアンス監査
- [ ] 包括的なペネトレーションテスト
- [ ] ディザスタリカバリの全体テスト
- [ ] セキュリティ戦略の見直し

---

### インシデント対応チェックリスト

#### 検出時
- [ ] インシデントの重大度を判定
- [ ] インシデント対応チームを招集
- [ ] 初期分析を実施
- [ ] タイムラインを作成
- [ ] 影響範囲を特定

#### 封じ込め時
- [ ] 侵害されたアカウントを無効化
- [ ] セキュリティグループを変更
- [ ] 侵害されたインスタンスを隔離
- [ ] 証拠を保全
- [ ] バックアップを確認

#### 根絶時
- [ ] 脅威を除去
- [ ] バックドアを除去
- [ ] 脆弱性を修正
- [ ] 認証情報をローテーション
- [ ] 設定を強化

#### 復旧時
- [ ] クリーンな環境から復旧
- [ ] データを復元
- [ ] 監視を強化
- [ ] 段階的に復旧
- [ ] 24時間の集中監視

#### 事後対応時
- [ ] インシデントレポートを作成
- [ ] 根本原因分析を実施
- [ ] 改善計画を策定
- [ ] ステークホルダーに報告
- [ ] ナレッジベースを更新

---

## まとめ

### セキュリティ運用の重要ポイント

#### 1. 予防が最優先
- セキュリティベストプラクティスの徹底
- 定期的なレビューと監査
- 継続的な教育とトレーニング
- 自動化による人的エラーの削減

#### 2. 早期検出が鍵
- 包括的なログ収集
- リアルタイムモニタリング
- 自動アラート設定
- 定期的な脆弱性スキャン

#### 3. 迅速な対応
- 明確なインシデント対応手順
- 訓練されたインシデント対応チーム
- 自動化された対応プロセス
- 定期的な訓練と演習

#### 4. 継続的な改善
- インシデントからの学習
- 定期的なプロセス見直し
- 新しい脅威への対応
- セキュリティ文化の醸成

---

### 次のステップ

#### 即座に実施すべきこと
1. このガイドを全チームメンバーと共有
2. セキュリティチェックリストを実施
3. 不足している設定を特定
4. 優先順位を付けて対応

#### 1ヶ月以内に実施すべきこと
1. インシデント対応チームの編成
2. インシデント対応訓練の実施
3. セキュリティ監視の強化
4. 脆弱性管理プロセスの確立

#### 3ヶ月以内に実施すべきこと
1. セキュリティ自動化の強化
2. ペネトレーションテストの実施
3. ディザスタリカバリ訓練の実施
4. セキュリティ文化の醸成

---

### 関連ドキュメント

- [AgentCore統合v2 完全ガイド](./agentcore-complete-guide.md)
- [AgentCore統合v2 監視・トラブルシューティングガイド](./agentcore-monitoring-troubleshooting-guide.md)
- [AWS Well-Architected Framework - Security Pillar](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html)
- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)

---

**最終更新**: 2026-01-18  
**次回レビュー予定**: 2026-04-18
