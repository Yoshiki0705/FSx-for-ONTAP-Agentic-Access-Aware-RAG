# FSx統合システム IaC実装ガイド

## 🎯 概要

このガイドでは、**Infrastructure as Code (IaC)** として実装されたFSx for ONTAP統合システムの使用方法を説明します。設定ファイルの機能フラグにより、各機能を柔軟に有効化/無効化できます。

## 🏗️ アーキテクチャ概要

### IaC方式の特徴
- **設定ファイル駆動**: JSONファイルで全機能を制御
- **機能フラグ制御**: 各機能を個別に有効化/無効化
- **環境別設定**: 開発・本番環境で異なる設定
- **CDKスタック統合**: 既存システムに完全統合

### スタック構成
```
1. NetworkingStack     (基盤)
2. SecurityStack       (セキュリティ)
3. DataStack          (データ・ストレージ)
4. EmbeddingStack     (AI・埋め込み)
5. WebAppStack        (Webアプリケーション)
6. FsxIntegrationStack (FSx統合) ← 新規追加
7. OperationsStack    (監視・運用)
```

## 🎛️ 機能フラグ制御

### 基本機能フラグ
```typescript
features: {
  // 既存機能
  enableNetworking: true,
  enableSecurity: true,
  enableStorage: true,
  enableDatabase: true,
  enableEmbedding: true,
  enableAPI: true,
  enableAI: true,
  enableMonitoring: true,
  enableEnterprise: true,
  
  // FSx統合機能（新規）
  enableFsxIntegration: true,           // FSx統合機能全体
  enableFsxServerlessWorkflows: true,   // Step Functionsワークフロー
  enableFsxEventDriven: true,          // EventBridgeイベント駆動
  enableFsxBatchProcessing: true       // SQS/SNSバッチ処理
}
```

### 環境別設定例

#### 開発環境 (`tokyo-development-config.ts`)
```typescript
features: {
  // 基本機能
  enableNetworking: true,
  enableSecurity: true,
  enableStorage: true,
  enableDatabase: true,
  enableEmbedding: true,
  enableAPI: true,
  enableAI: true,
  enableMonitoring: false,     // コスト削減
  enableEnterprise: false,     // 開発環境では不要
  
  // FSx統合機能（選択的有効化）
  enableFsxIntegration: true,           // ✅ 有効
  enableFsxServerlessWorkflows: false,  // ❌ 無効（コスト削減）
  enableFsxEventDriven: true,          // ✅ 有効（テスト用）
  enableFsxBatchProcessing: false      // ❌ 無効（コスト削減）
}
```

#### 本番環境 (`tokyo-production-config.ts`)
```typescript
features: {
  // 基本機能（全て有効）
  enableNetworking: true,
  enableSecurity: true,
  enableStorage: true,
  enableDatabase: true,
  enableEmbedding: true,
  enableAPI: true,
  enableAI: true,
  enableMonitoring: true,
  enableEnterprise: true,
  
  // FSx統合機能（全て有効）
  enableFsxIntegration: true,           // ✅ 有効
  enableFsxServerlessWorkflows: true,   // ✅ 有効
  enableFsxEventDriven: true,          // ✅ 有効
  enableFsxBatchProcessing: true       // ✅ 有効
}
```

## 🚀 デプロイメント方法

### 1. 基本デプロイコマンド

#### 開発環境デプロイ
```bash
# 開発環境（FSx統合機能は選択的有効化）
npm run deploy:dev

# または直接CDKコマンド
CONFIG_ENV=development DEPLOY_MODE=full npx cdk deploy --all
```

#### 本番環境デプロイ
```bash
# 本番環境（全機能有効）
npm run deploy:prod

# または直接CDKコマンド
CONFIG_ENV=production DEPLOY_MODE=production npx cdk deploy --all
```

### 2. 最小構成デプロイ

```bash
# 開発環境最小構成（NetworkingStack + DataStackのみ）
npm run deploy:dev:minimal

# 本番環境最小構成
npm run deploy:prod:minimal
```

### 3. FSx統合機能のみデプロイ

```bash
# FSx統合スタックのみデプロイ
npx cdk deploy TokyoRegion-permission-aware-rag-prod-FsxIntegration

# 特定の機能フラグを強制有効化
CONFIG_ENV=development npx cdk deploy --all --context enableFsxIntegration=true
```

## 🔧 設定カスタマイズ

### 1. 新しい環境設定の作成

```typescript
// lib/config/environments/my-custom-config.ts
export const myCustomConfig: EnvironmentConfig = {
  environment: 'staging',
  region: 'us-west-2',
  
  // ... 基本設定 ...
  
  features: {
    // 基本機能
    enableNetworking: true,
    enableSecurity: true,
    enableStorage: true,
    enableDatabase: true,
    enableEmbedding: false,      // 無効化
    enableAPI: true,
    enableAI: false,             // 無効化
    enableMonitoring: true,
    enableEnterprise: false,     // 無効化
    
    // FSx統合機能（カスタム設定）
    enableFsxIntegration: true,
    enableFsxServerlessWorkflows: true,
    enableFsxEventDriven: false,     // 無効化
    enableFsxBatchProcessing: true
  }
};
```

### 2. カスタム設定の使用

```bash
# エントリーポイントを修正してカスタム設定を使用
# bin/deploy-all-stacks.ts で設定を切り替え

const config = configEnv === 'custom' ? myCustomConfig : 
               configEnv === 'development' ? tokyoDevelopmentConfig : 
               tokyoProductionConfig;
```

```bash
# カスタム設定でデプロイ
CONFIG_ENV=custom DEPLOY_MODE=full npx cdk deploy --all
```

## 📊 機能別詳細設定

### 1. FSx for ONTAP設定

```typescript
storage: {
  fsxOntap: {
    enabled: true,                    // FSx機能の有効化
    storageCapacity: 1024,           // ストレージ容量（GB）
    throughputCapacity: 128,         // スループット（MB/s）
    deploymentType: 'SINGLE_AZ_1',   // デプロイメントタイプ
    automaticBackupRetentionDays: 7, // バックアップ保持日数
    volumes: {
      data: {
        enabled: true,
        name: 'data_volume',
        junctionPath: '/data',
        sizeInMegabytes: 10240,
        storageEfficiencyEnabled: true,
        securityStyle: 'UNIX'
      }
    }
  }
}
```

### 2. Serverless統合設定

```typescript
// Step Functions設定
features: {
  enableFsxServerlessWorkflows: true  // Step Functions有効化
}

// EventBridge設定
features: {
  enableFsxEventDriven: true         // EventBridge有効化
}

// SQS/SNS設定
features: {
  enableFsxBatchProcessing: true     // バッチ処理有効化
}
```

### 3. 監視・ログ設定

```typescript
monitoring: {
  enableDetailedMonitoring: true,    // 詳細監視
  logRetentionDays: 7,              // ログ保持日数
  enableAlarms: true,               // アラーム有効化
  enableXRayTracing: true           // X-Rayトレーシング
}
```

## 🎯 ユースケース別設定例

### ユースケース1: 開発・テスト環境
**目的**: コスト削減しながらFSx機能をテスト

```typescript
features: {
  enableFsxIntegration: true,           // FSx基本機能のみ
  enableFsxServerlessWorkflows: false,  // Step Functions無効（コスト削減）
  enableFsxEventDriven: true,          // EventBridge有効（テスト用）
  enableFsxBatchProcessing: false      // SQS/SNS無効（コスト削減）
}
```

### ユースケース2: ステージング環境
**目的**: 本番環境に近い構成でテスト

```typescript
features: {
  enableFsxIntegration: true,           // 全機能有効
  enableFsxServerlessWorkflows: true,   // Step Functions有効
  enableFsxEventDriven: true,          // EventBridge有効
  enableFsxBatchProcessing: true       // SQS/SNS有効
}
```

### ユースケース3: 本番環境
**目的**: 全機能を有効化して最高のパフォーマンス

```typescript
features: {
  enableFsxIntegration: true,           // 全機能有効
  enableFsxServerlessWorkflows: true,   // Step Functions有効
  enableFsxEventDriven: true,          // EventBridge有効
  enableFsxBatchProcessing: true       // SQS/SNS有効
}

// 本番環境向け高性能設定
storage: {
  fsxOntap: {
    storageCapacity: 4096,            // 大容量
    throughputCapacity: 512,          // 高スループット
    deploymentType: 'MULTI_AZ_1',     // 高可用性
    automaticBackupRetentionDays: 30  // 長期バックアップ
  }
}
```

### ユースケース4: 特定機能のみ有効化
**目的**: EventBridge機能のみを使用

```typescript
features: {
  enableFsxIntegration: true,           // FSx基本機能
  enableFsxServerlessWorkflows: false,  // Step Functions無効
  enableFsxEventDriven: true,          // EventBridge有効
  enableFsxBatchProcessing: false      // SQS/SNS無効
}
```

## 🔍 デプロイ状況の確認

### 1. スタック状況確認
```bash
# 全スタックの状況確認
npx cdk list

# 特定スタックの詳細確認
npx cdk describe TokyoRegion-permission-aware-rag-prod-FsxIntegration
```

### 2. 機能フラグ状況確認
```bash
# デプロイ時に機能フラグ状況が表示される
CONFIG_ENV=development DEPLOY_MODE=full npx cdk deploy --all

# 出力例:
# 🎛️  機能フラグ状態:
#    FSx統合: ✅
#    FSxワークフロー: ❌
#    FSxイベント駆動: ✅
#    FSxバッチ処理: ❌
```

### 3. リソース確認
```bash
# CloudFormationスタックの確認
aws cloudformation describe-stacks --stack-name TokyoRegion-permission-aware-rag-prod-FsxIntegration

# FSxファイルシステムの確認
aws fsx describe-file-systems

# Lambda関数の確認
aws lambda list-functions --query 'Functions[?contains(FunctionName, `fsx`)]'
```

## 🚨 トラブルシューティング

### 1. 機能フラグが反映されない
**症状**: 設定を変更してもリソースが作成/削除されない

**解決方法**:
```bash
# 設定変更後は必ずCDK diffで確認
npx cdk diff

# 強制的に再デプロイ
npx cdk deploy --force
```

### 2. 特定機能のみ無効化したい
**症状**: 一部の機能だけを無効化したい

**解決方法**:
```typescript
// 設定ファイルで該当フラグを無効化
features: {
  enableFsxServerlessWorkflows: false  // Step Functions無効化
}
```

```bash
# 変更をデプロイ
npm run deploy:dev
```

### 3. 環境設定が切り替わらない
**症状**: CONFIG_ENVを変更しても設定が反映されない

**解決方法**:
```bash
# 環境変数を明示的に指定
CONFIG_ENV=development DEPLOY_MODE=full npx cdk deploy --all

# または設定ファイルを直接確認
cat lib/config/environments/tokyo-development-config.ts
```

## 💡 ベストプラクティス

### 1. 段階的デプロイ
```bash
# 1. 最小構成でテスト
npm run deploy:dev:minimal

# 2. 基本機能を追加
CONFIG_ENV=development DEPLOY_MODE=full npx cdk deploy --all

# 3. FSx機能を段階的に有効化
# 設定ファイルで1つずつ機能フラグを有効化
```

### 2. コスト最適化
```typescript
// 開発環境ではコストを抑制
features: {
  enableFsxIntegration: true,           // 基本機能のみ
  enableFsxServerlessWorkflows: false,  // 高コスト機能は無効
  enableFsxEventDriven: true,          // 低コスト機能は有効
  enableFsxBatchProcessing: false      // 高コスト機能は無効
}
```

### 3. 本番環境準備
```typescript
// 本番環境では全機能有効 + 高性能設定
features: {
  // 全FSx機能有効
  enableFsxIntegration: true,
  enableFsxServerlessWorkflows: true,
  enableFsxEventDriven: true,
  enableFsxBatchProcessing: true
}

storage: {
  fsxOntap: {
    deploymentType: 'MULTI_AZ_1',     // 高可用性
    storageCapacity: 4096,            // 大容量
    throughputCapacity: 512           // 高性能
  }
}
```

## 📚 参考資料

- [AWS CDK公式ドキュメント](https://docs.aws.amazon.com/cdk/)
- [Amazon FSx for NetApp ONTAP](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/)
- [AWS Step Functions](https://docs.aws.amazon.com/step-functions/)
- [Amazon EventBridge](https://docs.aws.amazon.com/eventbridge/)

このIaC方式により、設定ファイルの機能フラグで柔軟にFSx統合機能を制御でき、環境やユースケースに応じた最適な構成を実現できます。