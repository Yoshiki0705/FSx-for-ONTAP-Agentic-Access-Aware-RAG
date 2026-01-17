# FSx for ONTAP & サーバレス統合システム

## 概要

このシステムは、Amazon FSx for ONTAPとサーバレスアーキテクチャを統合し、高性能で費用対効果の高いデータ処理・ストレージソリューションを提供します。

## アーキテクチャ

### 主要コンポーネント

```
┌─────────────────────────────────────────────────────────────┐
│                    FSx for ONTAP                            │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  File System    │  │  S3 Access      │                  │
│  │  (Multi-AZ)     │  │  Points         │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Serverless Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Step        │  │ EventBridge │  │ Lambda      │         │
│  │ Functions   │  │ Rules       │  │ Functions   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │ SQS Queues  │  │ SNS Topics  │                          │
│  └─────────────┘  └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Application Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  Next.js UI     │  │  Lambda Web     │                  │
│  │  Components     │  │  Adapter        │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### データフロー

1. **データ取り込み**: Next.js UIからのユーザー操作
2. **Lambda Web Adapter**: HTTPリクエストをLambda関数に直接ルーティング
3. **イベント処理**: EventBridgeによるイベント配信
4. **ワークフロー実行**: Step Functionsによる処理オーケストレーション
5. **データ処理**: Lambda関数による実際の処理
6. **ストレージ**: FSx for ONTAPへの高性能データ保存
7. **通知**: SNSによる処理完了通知

## 機能

### 🗄️ FSx for ONTAP統合

- **高性能ストレージ**: 最大4GB/sのスループット
- **階層化ストレージ**: 自動的なホット/ウォーム/コールドデータ管理
- **S3 Access Points**: S3互換APIによる簡単アクセス
- **自動バックアップ**: 設定可能な保持期間とスケジュール
- **Multi-AZ対応**: 高可用性とディザスタリカバリ

### ⚡ サーバレス統合

- **Step Functions**: 複雑なワークフローの自動化
- **EventBridge**: イベント駆動アーキテクチャ
- **Lambda Functions**: スケーラブルなデータ処理
- **SQS/SNS**: 非同期メッセージング
- **CloudWatch**: 包括的な監視とアラート

### 🎨 UI統合

- **Lambda Web Adapter**: HTTPリクエストの直接Lambda処理
- **リアルタイム進捗表示**: EventBridge経由の進捗更新
- **パフォーマンス監視**: CloudWatchメトリクスの可視化
- **コスト分析**: ストレージ階層別のコスト表示
- **設定管理**: 動的な設定変更とプリセット管理

## セットアップ

### 前提条件

- AWS CLI v2.0+
- AWS CDK v2.0+
- Node.js 18+
- TypeScript 4.5+

### インストール

1. **依存関係のインストール**
   ```bash
   npm install
   ```

2. **設定ファイルの作成**
   ```bash
   cp config/environments/development.json.example config/environments/development.json
   # 設定ファイルを編集してAWSアカウント情報を設定
   ```

3. **CDKブートストラップ**
   ```bash
   npx cdk bootstrap
   ```

### デプロイ

#### 開発環境

```bash
# 設定検証
npm run deploy:dev -- --dry-run

# デプロイ実行
npm run deploy:dev
```

#### 本番環境

```bash
# 設定検証
npm run deploy:prod -- --dry-run

# デプロイ実行
npm run deploy:prod
```

#### カスタムデプロイ

```bash
# TypeScriptスクリプトを直接実行
npx ts-node scripts/deploy.ts development --verbose

# 特定のスタックのみデプロイ
npx ts-node scripts/deploy.ts production --stack-name MyStack

# 異なるリージョンにデプロイ
npx ts-node scripts/deploy.ts staging --region us-west-2
```

## 設定

### 環境設定ファイル

設定ファイルは `config/environments/` ディレクトリに配置します：

- `development.json`: 開発環境設定
- `staging.json`: ステージング環境設定
- `production.json`: 本番環境設定

### FSx for ONTAP設定

```json
{
  "fsx": {
    "enabled": true,
    "fileSystems": [
      {
        "enabled": true,
        "name": "my-ontap-fs",
        "storageCapacity": 1024,
        "throughputCapacity": 512,
        "deploymentType": "MULTI_AZ_1",
        "storageEfficiency": true,
        "backup": {
          "enabled": true,
          "retentionDays": 30,
          "dailyAutomaticBackupStartTime": "03:00"
        },
        "encryption": {
          "enabled": true,
          "kmsKeyId": "your-kms-key-id"
        },
        "network": {
          "subnetIds": ["subnet-12345", "subnet-67890"],
          "securityGroupIds": ["sg-12345"],
          "routeTableIds": ["rtb-12345"]
        }
      }
    ]
  }
}
```

### サーバレス設定

```json
{
  "serverless": {
    "enabled": true,
    "stepFunctions": {
      "enabled": true,
      "workflows": [
        {
          "enabled": true,
          "name": "data-processing-workflow",
          "purpose": "Process and archive data",
          "role": {
            "permissions": [
              "lambda:InvokeFunction",
              "fsx:DescribeFileSystems",
              "s3:GetObject",
              "s3:PutObject"
            ]
          }
        }
      ]
    }
  }
}
```

## 使用方法

### データ処理ワークフロー

1. **ファイルアップロード**
   ```typescript
   import { FsxServerlessIntegrationConstruct } from './lib/modules/integration/constructs/fsx-serverless-integration';
   
   // ワークフロー実行
   const integration = new FsxServerlessIntegrationConstruct(this, 'Integration', {
     projectName: 'my-project',
     environment: 'production',
     fsxConfig: fsxConfig,
     serverlessConfig: serverlessConfig,
     integration: {
       enabled: true,
       dataProcessing: {
         enabled: true,
         batchSize: 100,
         processingTimeout: 900,
         retryAttempts: 3
       }
     }
   });
   ```

2. **進捗監視**
   ```typescript
   // EventBridge経由で進捗を監視
   const eventBus = integration.customEventBus;
   eventBus.addEventPattern({
     source: ['data.processing'],
     detailType: ['Processing Progress']
   });
   ```

### パフォーマンス監視

```typescript
// CloudWatchメトリクスの取得
const metrics = await cloudWatch.getMetricStatistics({
  Namespace: 'FSx/ONTAP',
  MetricName: 'ThroughputUtilization',
  Dimensions: [
    {
      Name: 'FileSystemId',
      Value: fileSystemId
    }
  ],
  StartTime: new Date(Date.now() - 3600000),
  EndTime: new Date(),
  Period: 300,
  Statistics: ['Average', 'Maximum']
}).promise();
```

## パフォーマンス最適化

### ストレージ階層化

```typescript
// 自動階層化ポリシーの設定
const tieringPolicy = {
  coolingPeriod: 31, // 31日後にコールド階層に移動
  tieringMode: 'AUTO'
};
```

### Lambda最適化

```typescript
// Lambda関数の最適化設定
const lambdaFunction = new Function(this, 'OptimizedFunction', {
  runtime: Runtime.PYTHON_3_9,
  memorySize: 2048, // メモリサイズを増やしてパフォーマンス向上
  timeout: Duration.minutes(15),
  reservedConcurrentExecutions: 10, // 同時実行数制限
  environment: {
    PYTHONPATH: '/opt/python',
    FSX_MOUNT_PATH: '/mnt/fsx'
  }
});
```

## 監視とアラート

### CloudWatchアラーム

```typescript
// 高スループット使用率アラーム
new Alarm(this, 'HighThroughputAlarm', {
  metric: new Metric({
    namespace: 'AWS/FSx',
    metricName: 'ThroughputUtilization',
    dimensionsMap: {
      FileSystemId: fileSystemId
    }
  }),
  threshold: 80,
  evaluationPeriods: 2,
  treatMissingData: TreatMissingData.NOT_BREACHING
});
```

### コストアラート

```typescript
// 月次コストアラーム
new Alarm(this, 'MonthlyCostAlarm', {
  metric: new Metric({
    namespace: 'AWS/Billing',
    metricName: 'EstimatedCharges',
    dimensionsMap: {
      Currency: 'USD',
      ServiceName: 'AmazonFSx'
    }
  }),
  threshold: 1000, // $1000/月
  evaluationPeriods: 1
});
```

## トラブルシューティング

### よくある問題

#### 1. FSxファイルシステムの作成に失敗する

**症状**: CDKデプロイ時にFSxファイルシステムの作成でエラー

**原因**: 
- サブネットIDが正しくない
- セキュリティグループの設定が不適切
- 十分なIPアドレスがない

**解決方法**:
```bash
# VPC設定の確認
aws ec2 describe-subnets --subnet-ids subnet-12345
aws ec2 describe-security-groups --group-ids sg-12345

# 利用可能IPアドレスの確認
aws ec2 describe-subnets --subnet-ids subnet-12345 --query 'Subnets[0].AvailableIpAddressCount'
```

#### 2. Lambda関数がFSxにアクセスできない

**症状**: Lambda実行時にFSxファイルシステムにアクセスできない

**原因**:
- VPC設定が正しくない
- セキュリティグループでNFSポート（2049）が開いていない
- IAM権限が不足している

**解決方法**:
```typescript
// セキュリティグループの設定
const fsxSecurityGroup = new SecurityGroup(this, 'FsxSecurityGroup', {
  vpc: vpc,
  allowAllOutbound: true
});

fsxSecurityGroup.addIngressRule(
  Peer.ipv4(vpc.vpcCidrBlock),
  Port.tcp(2049),
  'Allow NFS access from VPC'
);
```

#### 3. Step Functionsワークフローが失敗する

**症状**: ワークフロー実行時にタイムアウトまたはエラー

**原因**:
- Lambda関数のタイムアウト設定が短い
- IAM権限が不足している
- リトライ設定が適切でない

**解決方法**:
```typescript
// ワークフロー定義の最適化
const definition = {
  Comment: 'Optimized workflow',
  StartAt: 'ProcessData',
  States: {
    ProcessData: {
      Type: 'Task',
      Resource: lambdaFunction.functionArn,
      Timeout: 900, // 15分のタイムアウト
      Retry: [
        {
          ErrorEquals: ['Lambda.ServiceException'],
          IntervalSeconds: 2,
          MaxAttempts: 3,
          BackoffRate: 2.0
        }
      ]
    }
  }
};
```

### ログとデバッグ

#### CloudWatchログの確認

```bash
# Lambda関数のログ確認
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/

# Step Functionsの実行履歴確認
aws stepfunctions list-executions --state-machine-arn arn:aws:states:region:account:stateMachine:MyStateMachine
```

#### X-Rayトレーシング

```typescript
// X-Rayトレーシングの有効化
const lambdaFunction = new Function(this, 'TracedFunction', {
  // ... other properties
  tracing: Tracing.ACTIVE
});
```

## セキュリティ

### 暗号化

- **保存時暗号化**: FSx for ONTAPとS3で自動暗号化
- **転送時暗号化**: TLS 1.2以上を使用
- **キー管理**: AWS KMSによるキー管理

### アクセス制御

```typescript
// IAMポリシーの例
const fsxAccessPolicy = new PolicyStatement({
  effect: Effect.ALLOW,
  actions: [
    'fsx:DescribeFileSystems',
    'fsx:DescribeVolumes',
    'fsx:CreateBackup'
  ],
  resources: [
    `arn:aws:fsx:${region}:${account}:file-system/*`
  ],
  conditions: {
    StringEquals: {
      'fsx:StorageVirtualMachine': svmId
    }
  }
});
```

### ネットワークセキュリティ

```typescript
// VPCエンドポイントの設定
const s3Endpoint = new VpcEndpoint(this, 'S3Endpoint', {
  vpc: vpc,
  service: VpcEndpointService.S3
});

const fsxEndpoint = new VpcEndpoint(this, 'FsxEndpoint', {
  vpc: vpc,
  service: VpcEndpointService.FSX
});
```

## コスト最適化

### ストレージコスト

- **階層化**: 自動的なデータ階層化でコスト削減
- **重複排除**: FSx ONTAPの重複排除機能
- **圧縮**: データ圧縮による容量削減

### コンピュートコスト

- **Lambda最適化**: 適切なメモリサイズとタイムアウト設定
- **予約容量**: 予測可能なワークロードでの予約容量使用
- **スポットインスタンス**: バッチ処理でのスポットインスタンス活用

### 監視とアラート

```typescript
// コスト監視ダッシュボード
const costDashboard = new Dashboard(this, 'CostDashboard', {
  dashboardName: 'FSx-Serverless-Cost-Dashboard'
});

costDashboard.addWidgets(
  new GraphWidget({
    title: 'Monthly FSx Costs',
    left: [
      new Metric({
        namespace: 'AWS/Billing',
        metricName: 'EstimatedCharges',
        dimensionsMap: {
          ServiceName: 'AmazonFSx'
        }
      })
    ]
  })
);
```

## 貢献

プロジェクトへの貢献を歓迎します。以下の手順に従ってください：

1. フォークを作成
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は [LICENSE](LICENSE) ファイルを参照してください。

## サポート

質問や問題がある場合は、以下の方法でサポートを受けることができます：

- GitHub Issues: バグレポートや機能リクエスト
- ディスカッション: 一般的な質問や議論
- ドキュメント: 詳細な技術文書

## 参考リンク

- [Amazon FSx for NetApp ONTAP](https://aws.amazon.com/fsx/netapp-ontap/)
- [AWS Step Functions](https://aws.amazon.com/step-functions/)
- [Amazon EventBridge](https://aws.amazon.com/eventbridge/)
- [AWS Lambda](https://aws.amazon.com/lambda/)
- [AWS CDK](https://aws.amazon.com/cdk/)