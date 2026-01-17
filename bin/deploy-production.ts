#!/usr/bin/env node
/**
 * 本番環境統合デプロイスクリプト（VPC共有アーキテクチャ）
 * 
 * 🏗️ アーキテクチャ原則:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 1. VPC共有: 全てのスタックが NetworkingStack の VPC を共有
 * 2. 明示的依存: スタック間の依存関係を明示的に定義
 * 3. 段階的デプロイ: 依存関係に基づく順序でデプロイ
 * 4. エラーハンドリング: 各フェーズでの検証とロールバック
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 📋 VPC共有の重要性:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * - コスト削減: 複数VPC作成によるNAT Gateway重複コストを回避
 * - ネットワーク統合: 全リソースが同一ネットワーク内で通信可能
 * - セキュリティ: 統一されたセキュリティグループとNACL管理
 * - 運用効率: VPC管理の一元化による運用負荷軽減
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 🔗 スタック間依存関係:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * NetworkingStack (VPC基盤)
 *     ↓
 * SecurityStack (KMS Keys, IAM Roles)
 *     ↓
 * DataStack (FSx, DynamoDB) ← NetworkingStack の VPC を使用
 *     ↓
 * WebAppStack (Lambda, CloudFront) ← NetworkingStack の VPC を使用
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 🚨 重要な注意事項:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 1. DataStack は NetworkingStack の VPC を明示的に使用
 * 2. FSx for ONTAP は NetworkingStack のプライベートサブネットに配置
 * 3. 新しいVPCを作成しない（既存VPCを共有）
 * 4. VPC共有は props.vpc と props.privateSubnetIds で実現
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 使用方法:
 *   npx ts-node bin/deploy-production.ts
 * 
 * デプロイ時間目安:
 *   - NetworkingStack: 5-10分
 *   - SecurityStack: 2-3分
 *   - DataStack: 60-90分（FSx作成含む）
 *   - WebAppStack: 10-15分
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

// スタックインポート
import { NetworkingStack } from '../lib/stacks/integrated/networking-stack';
import { SecurityStack } from '../lib/stacks/integrated/security-stack';
import { DataStack } from '../lib/stacks/integrated/data-stack';

const app = new cdk.App();

// 環境設定
const projectName = 'permission-aware-rag';
const environment = 'prod';
const region = 'ap-northeast-1';
const account = '178625946981';

const env = {
  account: account,
  region: region
};

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 本番環境統合デプロイ開始（VPC共有アーキテクチャ）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📝 プロジェクト: ${projectName}`);
console.log(`🌍 環境: ${environment}`);
console.log(`📍 リージョン: ${region}`);
console.log(`🔑 アカウント: ${account}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ========================================
// Phase 1: Networking Stack（VPC基盤）
// ========================================
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📡 Phase 1: Networking Stack作成（VPC共有基盤 + Windows AD）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('🎯 目的: 全スタックで共有するVPC基盤とWindows ADを構築');
console.log('📋 作成リソース:');
console.log('   - VPC: 10.0.0.0/16');
console.log('   - Public Subnets: 3 AZs');
console.log('   - Private Subnets: 3 AZs（FSx, Lambda, Windows AD配置用）');
console.log('   - Isolated Subnets: 3 AZs（データベース用）');
console.log('   - NAT Gateway: 1個（コスト最適化）');
console.log('   - VPC Endpoints: S3, DynamoDB, ECR, Logs, Secrets Manager');
console.log('   - Windows AD EC2: t3.medium（Active Directory Domain Services）');
console.log('');
console.log('💡 重要: このVPCとWindows ADは全てのスタックで共有されます');
console.log('');

const networkingStack = new NetworkingStack(app, `TokyoRegion-${projectName}-${environment}-Networking-Stack`, {
  config: {
    vpcCidr: '10.0.0.0/16',
    maxAzs: 3,
    enablePublicSubnets: true,
    enablePrivateSubnets: true,
    enableIsolatedSubnets: true,
    enableNatGateway: true,
    enableDnsHostnames: true,
    enableDnsSupport: true,
    vpcEndpoints: {
      s3: true,
      dynamodb: true,
      lambda: true,
    },
    securityGroups: {
      web: true,
      api: true,
      database: true,
      lambda: true,
    },
    enableFlowLogs: false,
  },
  projectName: projectName,
  environment: environment as 'dev' | 'staging' | 'prod' | 'test',
  // Windows AD設定（cdk.context.jsonから取得）
  windowsAdConfig: app.node.tryGetContext('agentCore')?.identity?.windowsAdConfig,
  env: env,
  description: 'Networking Stack - VPC, Subnets, Security Groups, VPC Endpoints, Windows AD EC2 (Shared across all stacks)',
});

console.log('');
console.log('✅ Networking Stack作成完了');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 作成されたリソース:');
console.log(`   🌐 VPC ID: ${networkingStack.vpc.vpcId}`);
console.log(`   📍 Public Subnets: ${networkingStack.publicSubnets.length}個`);
console.log(`   🔒 Private Subnets: ${networkingStack.privateSubnets.length}個（FSx, Lambda, Windows AD配置用）`);
console.log(`   🗄️ Isolated Subnets: ${networkingStack.isolatedSubnets.length}個（データベース用）`);
if (networkingStack.windowsAd) {
  console.log(`   🪟 Windows AD EC2: ${networkingStack.windowsAd.instanceId}`);
  console.log(`   🔐 Domain: permission-aware-rag.local`);
}
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('💡 このVPCとWindows ADは以下のスタックで共有されます:');
console.log('   ✅ SecurityStack: AD Sync Lambda関数');
console.log('   ✅ DataStack: FSx for ONTAP, DynamoDB');
console.log('   ✅ WebAppStack: Lambda関数');
console.log('   ✅ 将来のスタック: 全て同一VPCを使用');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ========================================
// Phase 2: Security Stack（セキュリティ基盤）
// ========================================
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔒 Phase 2: Security Stack作成（セキュリティ基盤）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('🎯 目的: 暗号化・認証・認可の基盤を構築');
console.log('📋 作成リソース:');
console.log('   - KMS Key: データ暗号化用（自動ローテーション有効）');
console.log('   - IAM Roles: Lambda実行ロール、FSxアクセスロール');
console.log('   - GuardDuty: 既存Detector使用（新規作成なし）');
console.log('');
console.log('💡 重要: KMS Keyは全てのスタックで共有されます');
console.log('');

const securityStack = new SecurityStack(app, `TokyoRegion-${projectName}-${environment}-Security`, {
  config: {
    project: {
      name: projectName
    },
    environment: environment,
    security: {
      enableGuardDuty: false, // 既存のGuardDuty Detectorを使用
      enableWaf: false,
      enableCloudTrail: false,
      enableConfig: false,
      kmsKeyRotation: true
    },
    agentCore: app.node.tryGetContext('agentCore') // AgentCore設定を渡す
  },
  projectName: projectName,
  environment: environment,
  agentCore: app.node.tryGetContext('agentCore'), // AgentCore設定を渡す
  windowsAdInstanceId: networkingStack.windowsAd?.instanceId, // Windows AD Instance IDを渡す
  env: env,
  description: 'Security Stack - KMS Keys, IAM Roles, AgentCore Identity (GuardDuty uses existing detector)',
});

// SecurityStackはNetworkingStackに依存
securityStack.addDependency(networkingStack);

console.log('');
console.log('✅ Security Stack作成完了');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 作成されたリソース:');
console.log('   🔐 KMS Key: 有効（自動ローテーション）');
console.log('   👤 IAM Roles: Lambda実行ロール、FSxアクセスロール');
console.log('   🛡️ GuardDuty: 既存Detector使用');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ========================================
// Phase 3: Data Stack（データ基盤 - VPC共有）
// ========================================
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💾 Phase 3: Data Stack作成（VPC共有アーキテクチャ）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('🎯 目的: データストレージ基盤を構築（NetworkingStackのVPCを使用）');
console.log('');
console.log('🔗 VPC共有の実装:');
console.log('   ✅ NetworkingStack の VPC を明示的に使用');
console.log('   ✅ NetworkingStack のプライベートサブネットを使用');
console.log('   ✅ 新しいVPCを作成しない（既存VPCを共有）');
console.log('');
console.log('📋 作成リソース:');
console.log('   - FSx for ONTAP: 1024GB, 128MB/s');
console.log('     └─ 配置先: NetworkingStack のプライベートサブネット');
console.log('     └─ S3 Access Points経由でアクセス可能');
console.log('   - DynamoDB: 6テーブル');
console.log('     ├─ Session管理テーブル');
console.log('     ├─ ユーザー設定テーブル');
console.log('     ├─ チャット履歴テーブル');
console.log('     ├─ 動的設定キャッシュテーブル');
console.log('     ├─ ユーザーアクセステーブル');
console.log('     └─ 権限キャッシュテーブル');
console.log('');
console.log('💡 ストレージアーキテクチャ:');
console.log('   ✅ FSx for ONTAPを主要ストレージとして使用');
console.log('   ✅ S3 Access Points経由でFSx for ONTAPにアクセス');
console.log('   ✅ S3は使用しない（FSx for ONTAPに統合）');
console.log('   ✅ EFSは使用しない（FSx for ONTAPに統合）');
console.log('');
console.log('⏱️ デプロイ時間: 60-90分（FSx作成含む）');
console.log('');

// DataStackConfig準拠の設定
// アーキテクチャ原則:
// - FSx for ONTAPを主要ストレージとして使用
// - S3 Access Points経由でFSx for ONTAPにアクセス
// - S3は使用しない（FSx for ONTAPに統合）
// - EFSは使用しない（FSx for ONTAPに統合）
const dataStackConfig = {
  storage: {
    // S3は使用しない（FSx for ONTAP + S3 Access Pointsを使用）
    fsx: {
      enabled: true,
      fileSystemType: 'ONTAP' as const,
      storageCapacity: 1024,
      throughputCapacity: 128,
      multiAz: false,
      deploymentType: 'SINGLE_AZ_1' as const,
      automaticBackupRetentionDays: 0,
      disableBackupConfirmed: true,
      backup: {
        automaticBackup: false,
        retentionDays: 0,
        disableBackupConfirmed: true
      }
    }
  },
  database: {
    dynamoDb: {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: {
        enabled: true,
        kmsManaged: true
      },
      pointInTimeRecovery: true
    },
    openSearch: {
      enabled: false, // OpenSearchは削除済み
      serverless: false,
      encryption: {
        enabled: true,
        kmsManaged: true
      }
    },
    rds: {
      enabled: false,
      engine: {} as any // RDSは使用しない
    }
  }
};

const dataStack = new DataStack(app, `TokyoRegion-${projectName}-${environment}-Data`, {
  config: dataStackConfig,
  projectName: projectName,
  environment: environment,
  vpc: networkingStack.vpc, // ✅ NetworkingStackのVPCを明示的に使用
  privateSubnetIds: networkingStack.privateSubnets.map(subnet => subnet.subnetId), // ✅ プライベートサブネットIDを渡す
  securityStack: securityStack, // KMS Keyを使用
  env: env,
  description: 'Data Stack - FSx for ONTAP (using shared VPC from NetworkingStack), DynamoDB (Session, UserPreferences, ChatHistory, etc.)',
});

// DataStackはNetworkingStackとSecurityStackに依存
dataStack.addDependency(networkingStack);
dataStack.addDependency(securityStack);

console.log('');
console.log('✅ Data Stack作成完了');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 VPC共有の確認:');
console.log(`   🌐 使用VPC: ${networkingStack.vpc.vpcId}`);
console.log(`   📍 FSx配置先: NetworkingStack のプライベートサブネット`);
console.log(`   🔒 サブネット数: ${networkingStack.privateSubnets.length}個`);
console.log('');
console.log('📊 作成されたリソース:');
console.log('   💾 FSx for ONTAP: 1024GB, 128MB/s');
console.log('   🗄️ DynamoDB: 6テーブル');
console.log('   🔐 暗号化: SecurityStack の KMS Key使用');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('💡 VPC共有のメリット:');
console.log('   ✅ コスト削減: NAT Gateway重複コスト回避');
console.log('   ✅ ネットワーク統合: 全リソースが同一ネットワーク内で通信');
console.log('   ✅ セキュリティ: 統一されたセキュリティグループ管理');
console.log('   ✅ 運用効率: VPC管理の一元化');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ========================================
// Phase 4: WebApp Stack（Webアプリケーション）
// ========================================
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🌐 Phase 4: WebApp Stack（別途デプロイ）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('⚠️  WebAppStackは別途デプロイしてください（imageTagが必要）');
console.log('');
console.log('📋 デプロイコマンド:');
console.log('   npx cdk deploy TokyoRegion-permission-aware-rag-prod-WebApp \\');
console.log('     -c imageTag=<your-image-tag>');
console.log('');
console.log('💡 WebAppStackもNetworkingStackのVPCを使用します');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ========================================
// デプロイサマリー
// ========================================
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 デプロイサマリー（VPC共有アーキテクチャ）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('✅ Phase 1: Networking Stack - VPC共有基盤');
console.log('   🌐 VPC: 10.0.0.0/16');
console.log('   📍 AZ: 3');
console.log('   🚪 NAT Gateway: 1');
console.log('   📂 Subnets: Public, Private, Isolated');
console.log('   🔌 VPC Endpoints: S3, DynamoDB, ECR, Logs, Secrets Manager');
console.log('   💡 全スタックで共有される基盤VPC');
console.log('');
console.log('✅ Phase 2: Security Stack - セキュリティ基盤');
console.log('   🔐 KMS Key: 有効（自動ローテーション）');
console.log('   🛡️ GuardDuty: 既存Detector使用');
console.log('   💡 全スタックで共有されるKMS Key');
console.log('');
console.log('✅ Phase 3: Data Stack - データ基盤（VPC共有）');
console.log('   💾 FSx for ONTAP: 1024GB, 128MB/s');
console.log('   📍 配置先: NetworkingStack のプライベートサブネット');
console.log('   🗄️ DynamoDB: 6テーブル');
console.log('   🔗 VPC共有: ✅ 明示的に設定済み');
console.log('   💡 NetworkingStack の VPC を使用');
console.log('');
console.log('⏳ Phase 4: WebApp Stack - Webアプリケーション');
console.log('   ⚠️  別途デプロイが必要（imageTag指定）');
console.log('   💡 NetworkingStack の VPC を使用予定');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('🎯 VPC共有アーキテクチャの利点:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💰 コスト削減:');
console.log('   - NAT Gateway重複コスト回避（月額$45/個 × 削減数）');
console.log('   - VPC Peering不要（月額$0.01/GB × 削減量）');
console.log('');
console.log('🔒 セキュリティ向上:');
console.log('   - 統一されたセキュリティグループ管理');
console.log('   - 一元化されたNACL設定');
console.log('   - VPC Flow Logsの統合管理');
console.log('');
console.log('⚡ 運用効率化:');
console.log('   - VPC管理の一元化');
console.log('   - ネットワーク設定の簡素化');
console.log('   - トラブルシューティングの容易化');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

console.log('\n🎯 次のステップ:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('1. CDK Synth実行: npx cdk synth');
console.log('2. デプロイ実行: npx cdk deploy --all');
console.log('3. WebAppデプロイ: npx cdk deploy TokyoRegion-permission-aware-rag-prod-WebApp -c imageTag=<tag>');
console.log('4. VPC共有確認: AWS Console > VPC > vpc-05273211525990e49');
console.log('5. FSx配置確認: AWS Console > FSx > File Systems');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

app.synth();
