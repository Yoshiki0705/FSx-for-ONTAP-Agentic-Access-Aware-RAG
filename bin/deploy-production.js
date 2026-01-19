#!/usr/bin/env node
"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
// スタックインポート
const networking_stack_1 = require("../lib/stacks/integrated/networking-stack");
const security_stack_1 = require("../lib/stacks/integrated/security-stack");
const data_stack_1 = require("../lib/stacks/integrated/data-stack");
const app = new cdk.App();
// 環境設定
const projectName = 'permission-aware-rag';
const environment = 'prod';
const region = 'ap-northeast-1';
const account = '178625946981';
// 既存VPC情報（cdk.context.jsonから取得）
const existingVpcId = 'vpc-09aa251d6db52b1fc';
const existingVpcCidr = '10.21.0.0/16';
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
// Phase 1: Networking Stack（既存VPCインポート）
// ========================================
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📡 Phase 1: Networking Stack作成（既存VPCインポート + Windows AD）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('🎯 目的: 既存VPCをインポートしてWindows ADを構築');
console.log('📋 インポート対象:');
console.log(`   - VPC ID: ${existingVpcId}`);
console.log(`   - VPC CIDR: ${existingVpcCidr}`);
console.log('   - Public Subnets: 3 AZs');
console.log('   - Private Subnets: 3 AZs（FSx, Lambda, Windows AD配置用）');
console.log('');
console.log('📋 新規作成リソース:');
console.log('   - Security Groups: Web, API, Database, Lambda（名前の重複を動的に回避）');
console.log('   - Windows AD EC2: t3.medium（Active Directory Domain Services）');
console.log('');
console.log('💡 重要: 既存VPCを使用するため、VPC削除や新規作成は不要');
console.log('');
const networkingStack = new networking_stack_1.NetworkingStack(app, `TokyoRegion-${projectName}-${environment}-Networking-Stack`, {
    config: {
        vpcCidr: existingVpcCidr, // 既存VPCのCIDR
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
    environment: environment,
    existingVpcId: existingVpcId, // ✅ 既存VPC IDを指定
    existingVpcCidr: existingVpcCidr, // ✅ 既存VPC CIDRを指定
    env: env,
    description: 'Networking Stack - Import existing VPC, create Security Groups with unique names, Windows AD EC2',
});
console.log('');
console.log('✅ Networking Stack作成完了');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 インポートされたリソース:');
console.log(`   🌐 VPC ID: ${existingVpcId}`);
console.log(`   📍 VPC CIDR: ${existingVpcCidr}`);
console.log(`   📍 Public Subnets: ${networkingStack.publicSubnets.length}個`);
console.log(`   🔒 Private Subnets: ${networkingStack.privateSubnets.length}個（FSx, Lambda配置用）`);
console.log(`   🗄️ Isolated Subnets: ${networkingStack.isolatedSubnets.length}個（データベース用）`);
console.log('');
console.log('📊 新規作成されたリソース:');
console.log('   🛡️ Security Groups: Web, API, Database, Lambda（名前の重複を動的に回避）');
console.log('   🪟 Windows AD EC2: t3.medium（Active Directory Domain Services）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('💡 既存VPCインポートのメリット:');
console.log('   ✅ VPC削除不要: 既存環境を維持');
console.log('   ✅ ダウンタイムなし: 既存リソースに影響なし');
console.log('   ✅ コスト削減: NAT Gateway重複コスト回避');
console.log('   ✅ Security Group名の重複: タイムスタンプで動的に回避');
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
const securityStack = new security_stack_1.SecurityStack(app, `TokyoRegion-${projectName}-${environment}-Security`, {
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
    vpc: networkingStack.vpc, // NetworkingStackからVPCを渡す
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
console.log('💾 Phase 3: Data Stack作成（既存VPC使用）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('🎯 目的: データストレージ基盤を構築（既存VPCを使用）');
console.log('');
console.log('🔗 既存VPC使用の実装:');
console.log(`   ✅ 既存VPC: ${existingVpcId} (${existingVpcCidr})`);
console.log('   ✅ NetworkingStack のプライベートサブネットを使用');
console.log('   ✅ 新しいVPCを作成しない（既存VPCを共有）');
console.log('');
console.log('📋 作成リソース:');
console.log('   - FSx for ONTAP: 1024GB, 128MB/s');
console.log('     └─ 配置先: 既存VPCのプライベートサブネット');
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
            fileSystemType: 'ONTAP',
            storageCapacity: 1024,
            throughputCapacity: 128,
            multiAz: false,
            deploymentType: 'SINGLE_AZ_1',
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
        rds: false // RDSは使用しない
    }
};
const dataStack = new data_stack_1.DataStack(app, `TokyoRegion-${projectName}-${environment}-Data`, {
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
console.log('📊 既存VPC使用の確認:');
console.log(`   🌐 使用VPC: ${existingVpcId} (${existingVpcCidr})`);
console.log(`   📍 FSx配置先: 既存VPCのプライベートサブネット`);
console.log(`   🔒 サブネット数: ${networkingStack.privateSubnets.length}個`);
console.log('');
console.log('📊 作成されたリソース:');
console.log('   💾 FSx for ONTAP: 1024GB, 128MB/s');
console.log('   🗄️ DynamoDB: 6テーブル');
console.log('   🔐 暗号化: SecurityStack の KMS Key使用');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('💡 既存VPC使用のメリット:');
console.log('   ✅ VPC削除不要: 既存環境を維持');
console.log('   ✅ ダウンタイムなし: 既存リソースに影響なし');
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
console.log('📊 デプロイサマリー（既存VPC使用アーキテクチャ）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('✅ Phase 1: Networking Stack - 既存VPCインポート');
console.log(`   🌐 VPC: ${existingVpcId} (${existingVpcCidr})`);
console.log('   📍 AZ: 3');
console.log('   📂 Subnets: Public, Private, Isolated（既存）');
console.log('   🛡️ Security Groups: Web, API, Database, Lambda（新規作成、名前の重複を動的に回避）');
console.log('   🪟 Windows AD EC2: t3.medium（新規作成）');
console.log('   💡 既存VPCを使用、VPC削除や新規作成なし');
console.log('');
console.log('✅ Phase 2: Security Stack - セキュリティ基盤');
console.log('   🔐 KMS Key: 有効（自動ローテーション）');
console.log('   🛡️ GuardDuty: 既存Detector使用');
console.log('   💡 全スタックで共有されるKMS Key');
console.log('');
console.log('✅ Phase 3: Data Stack - データ基盤（既存VPC使用）');
console.log('   💾 FSx for ONTAP: 1024GB, 128MB/s');
console.log('   📍 配置先: 既存VPCのプライベートサブネット');
console.log('   🗄️ DynamoDB: 6テーブル');
console.log('   🔗 既存VPC使用: ✅ 明示的に設定済み');
console.log(`   💡 既存VPC (${existingVpcId}) を使用`);
console.log('');
console.log('⏳ Phase 4: WebApp Stack - Webアプリケーション');
console.log('   ⚠️  別途デプロイが必要（imageTag指定）');
console.log('   💡 既存VPCを使用予定');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('🎯 既存VPC使用アーキテクチャの利点:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💰 コスト削減:');
console.log('   - VPC削除不要: 既存環境を維持');
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
console.log('   - ダウンタイムなし: 既存リソースに影響なし');
console.log('');
console.log('🛡️ Security Group名の重複対策:');
console.log('   - タイムスタンプを使用して動的に一意な名前を生成');
console.log('   - 既存のSecurity Groupsと競合しない');
console.log('   - 同じ機能を持つSecurity Groupsを複製');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n🎯 次のステップ:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('1. CDK Synth実行: npx cdk synth');
console.log('2. デプロイ実行: npx cdk deploy --all');
console.log('3. WebAppデプロイ: npx cdk deploy TokyoRegion-permission-aware-rag-prod-WebApp -c imageTag=<tag>');
console.log(`4. 既存VPC確認: AWS Console > VPC > ${existingVpcId}`);
console.log('5. FSx配置確認: AWS Console > FSx > File Systems');
console.log('6. Security Groups確認: AWS Console > VPC > Security Groups（タイムスタンプ付き名前）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95LXByb2R1Y3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkZXBsb3ktcHJvZHVjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUNBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBOENHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsdUNBQXFDO0FBQ3JDLGlEQUFtQztBQUNuQyxtRUFBcUQ7QUFFckQsWUFBWTtBQUNaLGdGQUE0RTtBQUM1RSw0RUFBd0U7QUFDeEUsb0VBQWdFO0FBRWhFLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLE9BQU87QUFDUCxNQUFNLFdBQVcsR0FBRyxzQkFBc0IsQ0FBQztBQUMzQyxNQUFNLFdBQVcsR0FBRyxNQUFNLENBQUM7QUFDM0IsTUFBTSxNQUFNLEdBQUcsZ0JBQWdCLENBQUM7QUFDaEMsTUFBTSxPQUFPLEdBQUcsY0FBYyxDQUFDO0FBRS9CLGdDQUFnQztBQUNoQyxNQUFNLGFBQWEsR0FBRyx1QkFBdUIsQ0FBQztBQUM5QyxNQUFNLGVBQWUsR0FBRyxjQUFjLENBQUM7QUFFdkMsTUFBTSxHQUFHLEdBQUc7SUFDVixPQUFPLEVBQUUsT0FBTztJQUNoQixNQUFNLEVBQUUsTUFBTTtDQUNmLENBQUM7QUFFRixPQUFPLENBQUMsR0FBRyxDQUFDLDhEQUE4RCxDQUFDLENBQUM7QUFDNUUsT0FBTyxDQUFDLEdBQUcsQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO0FBQzdDLE9BQU8sQ0FBQyxHQUFHLENBQUMsOERBQThELENBQUMsQ0FBQztBQUM1RSxPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWMsV0FBVyxFQUFFLENBQUMsQ0FBQztBQUN6QyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsV0FBVyxFQUFFLENBQUMsQ0FBQztBQUNyQyxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsTUFBTSxFQUFFLENBQUMs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QyxHQUFHLENBQUMsd0VBQXdFLENBQUMsQ0FBQztBQUN0RixPQUFPLENBQUMsR0FBRyxDQUFDLDhEQUE4RCxDQUFDLENBQUM7QUFFNUUsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuLyoqXG4gKiDmnKznlarnkrDlooPntbHlkIjjg4fjg5fjg63jgqTjgrnjgq/jg6rjg5fjg4jvvIhWUEPlhbHmnInjgqLjg7zjgq3jg4bjgq/jg4Hjg6PvvIlcbiAqIFxuICog8J+Pl++4jyDjgqLjg7zjgq3jg4bjgq/jg4Hjg6Pljp/liYc6XG4gKiDilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIFcbiAqIDEuIFZQQ+WFseaciTog5YWo44Gm44Gu44K544K/44OD44Kv44GMIE5ldHdvcmtpbmdTdGFjayDjga4gVlBDIOOCkuWFseaciVxuICogMi4g5piO56S655qE5L6d5a2YOiDjgrnjgr/jg4Pjgq/plpPjga7kvp3lrZjplqLkv4LjgpLmmI7npLrnmoTjgavlrprnvqlcbiAqIDMuIOautemajueahOODh+ODl+ODreOCpDog5L6d5a2Y6Zai5L+C44Gr5Z+644Gl44GP6aCG5bqP44Gn44OH44OX44Ot44KkXG4gKiA0LiDjgqjjg6njg7zjg4/jg7Pjg4njg6rjg7PjgrA6IOWQhOODleOCp+ODvOOCuuOBp+OBruaknOiovOOBqOODreODvOODq+ODkOODg+OCr1xuICog4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSBXG4gKiBcbiAqIPCfk4sgVlBD5YWx5pyJ44Gu6YeN6KaB5oCnOlxuICog4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSBXG4gKiAtIOOCs+OCueODiOWJiua4mzog6KSH5pWwVlBD5L2c5oiQ44Gr44KI44KLTkFUIEdhdGV3YXnph43opIfjgrPjgrnjg4jjgpLlm57pgb9cbiAqIC0g44ON44OD44OI44Ov44O844Kv57Wx5ZCIOiDlhajjg6rjgr3jg7zjgrnjgYzlkIzkuIDjg43jg4Pjg4jjg6/jg7zjgq/lhoXjgafpgJrkv6Hlj6/og71cbiAqIC0g44K744Kt44Ol44Oq44OG44KjOiDntbHkuIDjgZXjgozjgZ/jgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fjgahOQUNM566h55CGXG4gKiAtIOmBi+eUqOWKueeOhzogVlBD566h55CG44Gu5LiA5YWD5YyW44Gr44KI44KL6YGL55So6LKg6I236Lu95ribXG4gKiDilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIFcbiAqIFxuICog8J+UlyDjgrnjgr/jg4Pjgq/plpPkvp3lrZjplqLkv4I6XG4gKiDilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIFcbiAqIE5ldHdvcmtpbmdTdGFjayAoVlBD5Z+655ukKVxuICogICAgIOKGk1xuICogU2VjdXJpdHlTdGFjayAoS01TIEtleXMsIElBTSBSb2xlcylcbiAqICAgICDihpNcbiAqIERhdGFTdGFjayAoRlN4LCBEeW5hbW9EQikg4oaQIE5ldHdvcmtpbmdTdGFjayDjga4gVlBDIOOCkuS9v+eUqFxuICogICAgIOKGk1xuICogV2ViQXBwU3RhY2sgKExhbWJkYSwgQ2xvdWRGcm9udCkg4oaQIE5ldHdvcmtpbmdTdGFjayDjga4gVlBDIOOCkuS9v+eUqFxuICog4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSBXG4gKiBcbiAqIPCfmqgg6YeN6KaB44Gq5rOo5oSP5LqL6aCFOlxuICog4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSBXG4gKiAxLiBEYXRhU3RhY2sg44GvIE5ldHdvcmtpbmdTdGFjayDjga4gVlBDIOOCkuaYjuekuueahOOBq+S9v+eUqFxuICogMi4gRlN4IGZvciBPTlRBUCDjga8gTmV0d29ya2luZ1N0YWNrIOOBruODl+ODqeOCpOODmeODvOODiOOCteODluODjeODg+ODiOOBq+mFjee9rlxuICogMy4g5paw44GX44GEVlBD44KS5L2c5oiQ44GX44Gq44GE77yI5pei5a2YVlBD44KS5YWx5pyJ77yJXG4gKiA0LiBWUEPlhbHmnInjga8gcHJvcHMudnBjIOOBqCBwcm9wcy5wcml2YXRlU3VibmV0SWRzIOOBp+Wun+ePvlxuICog4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSBXG4gKiBcbiAqIOS9v+eUqOaWueazlTpcbiAqICAgbnB4IHRzLW5vZGUgYmluL2RlcGxveS1wcm9kdWN0aW9uLnRzXG4gKiBcbiAqIOODh+ODl+ODreOCpOaZgumWk+ebruWuiTpcbiAqICAgLSBOZXR3b3JraW5nU3RhY2s6IDUtMTDliIZcbiAqICAgLSBTZWN1cml0eVN0YWNrOiAyLTPliIZcbiAqICAgLSBEYXRhU3RhY2s6IDYwLTkw5YiG77yIRlN45L2c5oiQ5ZCr44KA77yJXG4gKiAgIC0gV2ViQXBwU3RhY2s6IDEwLTE15YiGXG4gKi9cblxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5cbi8vIOOCueOCv+ODg+OCr+OCpOODs+ODneODvOODiFxuaW1wb3J0IHsgTmV0d29ya2luZ1N0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy9pbnRlZ3JhdGVkL25ldHdvcmtpbmctc3RhY2snO1xuaW1wb3J0IHsgU2VjdXJpdHlTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvaW50ZWdyYXRlZC9zZWN1cml0eS1zdGFjayc7XG5pbXBvcnQgeyBEYXRhU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL2ludGVncmF0ZWQvZGF0YS1zdGFjayc7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbi8vIOeSsOWig+ioreWumlxuY29uc3QgcHJvamVjdE5hbWUgPSAncGVybWlzc2lvbi1hd2FyZS1yYWcnO1xuY29uc3QgZW52aXJvbm1lbnQgPSAncHJvZCc7XG5jb25zdCByZWdpb24gPSAnYXAtbm9ydGhlYXN0LTEnO1xuY29uc3QgYWNjb3VudCA9ICcxNzg2MjU5NDY5ODEnO1xuXG4vLyDml6LlrZhWUEPmg4XloLHvvIhjZGsuY29udGV4dC5qc29u44GL44KJ5Y+W5b6X77yJXG5jb25zdCBleGlzdGluZ1ZwY0lkID0gJ3ZwYy0wOWFhMjUxZDZkYjUyYjFmYyc7XG5jb25zdCBleGlzdGluZ1ZwY0NpZHIgPSAnMTAuMjEuMC4wLzE2JztcblxuY29uc3QgZW52ID0ge1xuICBhY2NvdW50OiBhY2NvdW50LFxuICByZWdpb246IHJlZ2lvblxufTtcblxuY29uc29sZS5sb2coJ+KUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgScpO1xuY29uc29sZS5sb2coJ/CfmoAg5pys55Wq55Kw5aKD57Wx5ZCI44OH44OX44Ot44Kk6ZaL5aeL77yIVlBD5YWx5pyJ44Ki44O844Kt44OG44Kv44OB44Oj77yJJyk7XG5jb25zb2xlLmxvZygn4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSBJyk7XG5jb25zb2xlLmxvZyhg8J+TnSDjg5fjg63jgrjjgqfjgq/jg4g6ICR7cHJvamVjdE5hbWV9YCk7XG5jb25zb2xlLmxvZyhg8J+MjSDnkrDlooM6ICR7ZW52aXJvbm1lbnR9YCk7XG5jb25zb2xlLmxvZyhg8J+TjSDjg6rjg7zjgrjjg6fjg7M6ICR7cmVnaW9ufWApO1xuY29uc29sZS5sb2coYPCflJEg44Ki44Kr44Km44Oz44OIOiAke2FjY291bnR9YCk7XG5jb25zb2xlLmxvZygn4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSBJyk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFBoYXNlIDE6IE5ldHdvcmtpbmcgU3RhY2vvvIjml6LlrZhWUEPjgqTjg7Pjg53jg7zjg4jvvIlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbmNvbnNvbGUubG9nKCdcXG7ilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIEnKTtcbmNvbnNvbGUubG9nKCfwn5OhIFBoYXNlIDE6IE5ldHdvcmtpbmcgU3RhY2vkvZzmiJDvvIjml6LlrZhWUEPjgqTjg7Pjg53jg7zjg4ggKyBXaW5kb3dzIEFE77yJJyk7XG5jb25zb2xlLmxvZygn4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSBJyk7XG5jb25zb2xlLmxvZygnJyk7XG5jb25zb2xlLmxvZygn8J+OryDnm67nmoQ6IOaXouWtmFZQQ+OCkuOCpOODs+ODneODvOODiOOBl+OBpldpbmRvd3MgQUTjgpLmp4vnr4knKTtcbmNvbnNvbGUubG9nKCfwn5OLIOOCpOODs+ODneODvOODiOWvvuixoTonKTtcbmNvbnNvbGUubG9nKGAgICAtIFZQQyBJRDogJHtleGlzdGluZ1ZwY0lkfWApO1xuY29uc29sZS5sb2coYCAgIC0gVlBDIENJRFI6ICR7ZXhpc3RpbmdWcGNDaWRyfWApO1xuY29uc29sZS5sb2coJyAgIC0gUHVibGljIFN1Ym5ldHM6IDMgQVpzJyk7XG5jb25zb2xlLmxvZygnICAgLSBQcml2YXRlIFN1Ym5ldHM6IDMgQVpz77yIRlN4LCBMYW1iZGEsIFdpbmRvd3MgQUTphY3nva7nlKjvvIknKTtcbmNvbnNvbGUubG9nKCcnKTtcbmNvbnNvbGUubG9nKCfwn5OLIOaWsOimj+S9nOaIkOODquOCveODvOOCuTonKTtcbmNvbnNvbGUubG9nKCcgICAtIFNlY3VyaXR5IEdyb3VwczogV2ViLCBBUEksIERhdGFiYXNlLCBMYW1iZGHvvIjlkI3liY3jga7ph43opIfjgpLli5XnmoTjgavlm57pgb/vvIknKTtcbmNvbnNvbGUubG9nKCcgICAtIFdpbmRvd3MgQUQgRUMyOiB0My5tZWRpdW3vvIhBY3RpdmUgRGlyZWN0b3J5IERvbWFpbiBTZXJ2aWNlc++8iScpO1xuY29uc29sZS5sb2coJycpO1xuY29uc29sZS5sb2coJ/CfkqEg6YeN6KaBOiDml6LlrZhWUEPjgpLkvb/nlKjjgZnjgovjgZ/jgoHjgIFWUEPliYrpmaTjgoTmlrDopo/kvZzmiJDjga/kuI3opoEnKTtcbmNvbnNvbGUubG9nKCcnKTtcblxuY29uc3QgbmV0d29ya2luZ1N0YWNrID0gbmV3IE5ldHdvcmtpbmdTdGFjayhhcHAsIGBUb2t5b1JlZ2lvbi0ke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1OZXR3b3JraW5nLVN0YWNrYCwge1xuICBjb25maWc6IHtcbiAgICB2cGNDaWRyOiBleGlzdGluZ1ZwY0NpZHIsIC8vIOaXouWtmFZQQ+OBrkNJRFJcbiAgICBtYXhBenM6IDMsXG4gICAgZW5hYmxlUHVibGljU3VibmV0czogdHJ1ZSxcbiAgICBlbmFibGVQcml2YXRlU3VibmV0czogdHJ1ZSxcbiAgICBlbmFibGVJc29sYXRlZFN1Ym5ldHM6IHRydWUsXG4gICAgZW5hYmxlTmF0R2F0ZXdheTogdHJ1ZSxcbiAgICBlbmFibGVEbnNIb3N0bmFtZXM6IHRydWUsXG4gICAgZW5hYmxlRG5zU3VwcG9ydDogdHJ1ZSxcbiAgICB2cGNFbmRwb2ludHM6IHtcbiAgICAgIHMzOiB0cnVlIGFzIGJvb2xlYW4sXG4gICAgICBkeW5hbW9kYjogdHJ1ZSBhcyBib29sZWFuLFxuICAgICAgbGFtYmRhOiB0cnVlIGFzIGJvb2xlYW4sXG4gICAgfSxcbiAgICBzZWN1cml0eUdyb3Vwczoge1xuICAgICAgd2ViOiB0cnVlIGFzIGJvb2xlYW4sXG4gICAgICBhcGk6IHRydWUgYXMgYm9vbGVhbixcbiAgICAgIGRhdGFiYXNlOiB0cnVlIGFzIGJvb2xlYW4sXG4gICAgICBsYW1iZGE6IHRydWUgYXMgYm9vbGVhbixcbiAgICB9LFxuICAgIGVuYWJsZUZsb3dMb2dzOiBmYWxzZSxcbiAgfSxcbiAgcHJvamVjdE5hbWU6IHByb2plY3ROYW1lLFxuICBlbnZpcm9ubWVudDogZW52aXJvbm1lbnQgYXMgJ2RldicgfCAnc3RhZ2luZycgfCAncHJvZCcgfCAndGVzdCcsXG4gIGV4aXN0aW5nVnBjSWQ6IGV4aXN0aW5nVnBjSWQsIC8vIOKchSDml6LlrZhWUEMgSUTjgpLmjIflrppcbiAgZXhpc3RpbmdWcGNDaWRyOiBleGlzdGluZ1ZwY0NpZHIsIC8vIOKchSDml6LlrZhWUEMgQ0lEUuOCkuaMh+WumlxuICBlbnY6IGVudixcbiAgZGVzY3JpcHRpb246ICdOZXR3b3JraW5nIFN0YWNrIC0gSW1wb3J0IGV4aXN0aW5nIFZQQywgY3JlYXRlIFNlY3VyaXR5IEdyb3VwcyB3aXRoIHVuaXF1ZSBuYW1lcywgV2luZG93cyBBRCBFQzInLFxufSk7XG5cbmNvbnNvbGUubG9nKCcnKTtcbmNvbnNvbGUubG9nKCfinIUgTmV0d29ya2luZyBTdGFja+S9nOaIkOWujOS6hicpO1xuY29uc29sZS5sb2coJ+KUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgScpO1xuY29uc29sZS5sb2coJ/Cfk4og44Kk44Oz44Od44O844OI44GV44KM44Gf44Oq44K944O844K5OicpO1xuY29uc29sZS5sb2coYCAgIPCfjJAgVlBDIElEOiAke2V4aXN0aW5nVnBjSWR9YCk7XG5jb25zb2xlLmxvZyhgICAg8J+TjSBWUEMgQ0lEUjogJHtleGlzdGluZ1ZwY0NpZHJ9YCk7XG5jb25zb2xlLmxvZyhgICAg8J+TjSBQdWJsaWMgU3VibmV0czogJHtuZXR3b3JraW5nU3RhY2sucHVibGljU3VibmV0cy5sZW5ndGh95YCLYCk7XG5jb25zb2xlLmxvZyhgICAg8J+UkiBQcml2YXRlIFN1Ym5ldHM6ICR7bmV0d29ya2luZ1N0YWNrLnByaXZhdGVTdWJuZXRzLmxlbmd0aH3lgIvvvIhGU3gsIExhbWJkYemFjee9rueUqO+8iWApO1xuY29uc29sZS5sb2coYCAgIPCfl4TvuI8gSXNvbGF0ZWQgU3VibmV0czogJHtuZXR3b3JraW5nU3RhY2suaXNvbGF0ZWRTdWJuZXRzLmxlbmd0aH3lgIvvvIjjg4fjg7zjgr/jg5njg7zjgrnnlKjvvIlgKTtcbmNvbnNvbGUubG9nKCcnKTtcbmNvbnNvbGUubG9nKCfwn5OKIOaWsOimj+S9nOaIkOOBleOCjOOBn+ODquOCveODvOOCuTonKTtcbmNvbnNvbGUubG9nKCcgICDwn5uh77iPIFNlY3VyaXR5IEdyb3VwczogV2ViLCBBUEksIERhdGFiYXNlLCBMYW1iZGHvvIjlkI3liY3jga7ph43opIfjgpLli5XnmoTjgavlm57pgb/vvIknKTtcbmNvbnNvbGUubG9nKCcgICDwn6qfIFdpbmRvd3MgQUQgRUMyOiB0My5tZWRpdW3vvIhBY3RpdmUgRGlyZWN0b3J5IERvbWFpbiBTZXJ2aWNlc++8iScpO1xuY29uc29sZS5sb2coJ+KUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgScpO1xuY29uc29sZS5sb2coJycpO1xuY29uc29sZS5sb2coJ/CfkqEg5pei5a2YVlBD44Kk44Oz44Od44O844OI44Gu44Oh44Oq44OD44OIOicpO1xuY29uc29sZS5sb2coJyAgIOKchSBWUEPliYrpmaTkuI3opoE6IOaXouWtmOeSsOWig+OCkue2reaMgScpO1xuY29uc29sZS5sb2coJyAgIOKchSDjg4Djgqbjg7Pjgr/jgqTjg6DjgarjgZc6IOaXouWtmOODquOCveODvOOCueOBq+W9semfv+OBquOBlycpO1xuY29uc29sZS5sb2coJyAgIOKchSDjgrPjgrnjg4jliYrmuJs6IE5BVCBHYXRld2F56YeN6KSH44Kz44K544OI5Zue6YG/Jyk7XG5jb25zb2xlLmxvZygnICAg4pyFIFNlY3VyaXR5IEdyb3Vw5ZCN44Gu6YeN6KSHOiDjgr/jgqTjg6Djgrnjgr/jg7Pjg5fjgafli5XnmoTjgavlm57pgb8nKTtcbmNvbnNvbGUubG9nKCfilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIEnKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gUGhhc2UgMjogU2VjdXJpdHkgU3RhY2vvvIjjgrvjgq3jg6Xjg6rjg4bjgqPln7rnm6TvvIlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbmNvbnNvbGUubG9nKCdcXG7ilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIEnKTtcbmNvbnNvbGUubG9nKCfwn5SSIFBoYXNlIDI6IFNlY3VyaXR5IFN0YWNr5L2c5oiQ77yI44K744Kt44Ol44Oq44OG44Kj5Z+655uk77yJJyk7XG5jb25zb2xlLmxvZygn4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSBJyk7XG5jb25zb2xlLmxvZygnJyk7XG5jb25zb2xlLmxvZygn8J+OryDnm67nmoQ6IOaal+WPt+WMluODu+iqjeiovOODu+iqjeWPr+OBruWfuuebpOOCkuani+eviScpO1xuY29uc29sZS5sb2coJ/Cfk4sg5L2c5oiQ44Oq44K944O844K5OicpO1xuY29uc29sZS5sb2coJyAgIC0gS01TIEtleTog44OH44O844K/5pqX5Y+35YyW55So77yI6Ieq5YuV44Ot44O844OG44O844K344On44Oz5pyJ5Yq577yJJyk7XG5jb25zb2xlLmxvZygnICAgLSBJQU0gUm9sZXM6IExhbWJkYeWun+ihjOODreODvOODq+OAgUZTeOOCouOCr+OCu+OCueODreODvOODqycpO1xuY29uc29sZS5sb2coJyAgIC0gR3VhcmREdXR5OiDml6LlrZhEZXRlY3RvcuS9v+eUqO+8iOaWsOimj+S9nOaIkOOBquOBl++8iScpO1xuY29uc29sZS5sb2coJycpO1xuY29uc29sZS5sb2coJ/CfkqEg6YeN6KaBOiBLTVMgS2V544Gv5YWo44Gm44Gu44K544K/44OD44Kv44Gn5YWx5pyJ44GV44KM44G+44GZJyk7XG5jb25zb2xlLmxvZygnJyk7XG5cbmNvbnN0IHNlY3VyaXR5U3RhY2sgPSBuZXcgU2VjdXJpdHlTdGFjayhhcHAsIGBUb2t5b1JlZ2lvbi0ke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1TZWN1cml0eWAsIHtcbiAgY29uZmlnOiB7XG4gICAgcHJvamVjdDoge1xuICAgICAgbmFtZTogcHJvamVjdE5hbWVcbiAgICB9LFxuICAgIGVudmlyb25tZW50OiBlbnZpcm9ubWVudCxcbiAgICBzZWN1cml0eToge1xuICAgICAgZW5hYmxlR3VhcmREdXR5OiBmYWxzZSwgLy8g5pei5a2Y44GuR3VhcmREdXR5IERldGVjdG9y44KS5L2/55SoXG4gICAgICBlbmFibGVXYWY6IGZhbHNlLFxuICAgICAgZW5hYmxlQ2xvdWRUcmFpbDogZmFsc2UsXG4gICAgICBlbmFibGVDb25maWc6IGZhbHNlLFxuICAgICAga21zS2V5Um90YXRpb246IHRydWVcbiAgICB9LFxuICAgIGFnZW50Q29yZTogYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnYWdlbnRDb3JlJykgLy8gQWdlbnRDb3Jl6Kit5a6a44KS5rih44GZXG4gIH0sXG4gIHByb2plY3ROYW1lOiBwcm9qZWN0TmFtZSxcbiAgZW52aXJvbm1lbnQ6IGVudmlyb25tZW50LFxuICBhZ2VudENvcmU6IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ2FnZW50Q29yZScpLCAvLyBBZ2VudENvcmXoqK3lrprjgpLmuKHjgZlcbiAgdnBjOiBuZXR3b3JraW5nU3RhY2sudnBjLCAvLyBOZXR3b3JraW5nU3RhY2vjgYvjgolWUEPjgpLmuKHjgZlcbiAgZW52OiBlbnYsXG4gIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgU3RhY2sgLSBLTVMgS2V5cywgSUFNIFJvbGVzLCBBZ2VudENvcmUgSWRlbnRpdHkgKEd1YXJkRHV0eSB1c2VzIGV4aXN0aW5nIGRldGVjdG9yKScsXG59KTtcblxuLy8gU2VjdXJpdHlTdGFja+OBr05ldHdvcmtpbmdTdGFja+OBq+S+neWtmFxuc2VjdXJpdHlTdGFjay5hZGREZXBlbmRlbmN5KG5ldHdvcmtpbmdTdGFjayk7XG5cbmNvbnNvbGUubG9nKCcnKTtcbmNvbnNvbGUubG9nKCfinIUgU2VjdXJpdHkgU3RhY2vkvZzmiJDlrozkuoYnKTtcbmNvbnNvbGUubG9nKCfilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIEnKTtcbmNvbnNvbGUubG9nKCfwn5OKIOS9nOaIkOOBleOCjOOBn+ODquOCveODvOOCuTonKTtcbmNvbnNvbGUubG9nKCcgICDwn5SQIEtNUyBLZXk6IOacieWKue+8iOiHquWLleODreODvOODhuODvOOCt+ODp+ODs++8iScpO1xuY29uc29sZS5sb2coJyAgIPCfkaQgSUFNIFJvbGVzOiBMYW1iZGHlrp/ooYzjg63jg7zjg6vjgIFGU3jjgqLjgq/jgrvjgrnjg63jg7zjg6snKTtcbmNvbnNvbGUubG9nKCcgICDwn5uh77iPIEd1YXJkRHV0eTog5pei5a2YRGV0ZWN0b3Lkvb/nlKgnKTtcbmNvbnNvbGUubG9nKCfilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIEnKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gUGhhc2UgMzogRGF0YSBTdGFja++8iOODh+ODvOOCv+WfuuebpCAtIFZQQ+WFseacie+8iVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuY29uc29sZS5sb2coJ1xcbuKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgScpO1xuY29uc29sZS5sb2coJ/Cfkr4gUGhhc2UgMzogRGF0YSBTdGFja+S9nOaIkO+8iOaXouWtmFZQQ+S9v+eUqO+8iScpO1xuY29uc29sZS5sb2coJ+KUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgScpO1xuY29uc29sZS5sb2coJycpO1xuY29uc29sZS5sb2coJ/Cfjq8g55uu55qEOiDjg4fjg7zjgr/jgrnjg4jjg6zjg7zjgrjln7rnm6TjgpLmp4vnr4nvvIjml6LlrZhWUEPjgpLkvb/nlKjvvIknKTtcbmNvbnNvbGUubG9nKCcnKTtcbmNvbnNvbGUubG9nKCfwn5SXIOaXouWtmFZQQ+S9v+eUqOOBruWun+ijhTonKTtcbmNvbnNvbGUubG9nKGAgICDinIUg5pei5a2YVlBDOiAke2V4aXN0aW5nVnBjSWR9ICgke2V4aXN0aW5nVnBjQ2lkcn0pYCk7XG5jb25zb2xlLmxvZygnICAg4pyFIE5ldHdvcmtpbmdTdGFjayDjga7jg5fjg6njgqTjg5njg7zjg4jjgrXjg5bjg43jg4Pjg4jjgpLkvb/nlKgnKTtcbmNvbnNvbGUubG9nKCcgICDinIUg5paw44GX44GEVlBD44KS5L2c5oiQ44GX44Gq44GE77yI5pei5a2YVlBD44KS5YWx5pyJ77yJJyk7XG5jb25zb2xlLmxvZygnJyk7XG5jb25zb2xlLmxvZygn8J+TiyDkvZzmiJDjg6rjgr3jg7zjgrk6Jyk7XG5jb25zb2xlLmxvZygnICAgLSBGU3ggZm9yIE9OVEFQOiAxMDI0R0IsIDEyOE1CL3MnKTtcbmNvbnNvbGUubG9nKCcgICAgIOKUlOKUgCDphY3nva7lhYg6IOaXouWtmFZQQ+OBruODl+ODqeOCpOODmeODvOODiOOCteODluODjeODg+ODiCcpO1xuY29uc29sZS5sb2coJyAgICAg4pSU4pSAIFMzIEFjY2VzcyBQb2ludHPntYznlLHjgafjgqLjgq/jgrvjgrnlj6/og70nKTtcbmNvbnNvbGUubG9nKCcgICAtIER5bmFtb0RCOiA244OG44O844OW44OrJyk7XG5jb25zb2xlLmxvZygnICAgICDilJzilIAgU2Vzc2lvbueuoeeQhuODhuODvOODluODqycpO1xuY29uc29sZS5sb2coJyAgICAg4pSc4pSAIOODpuODvOOCtuODvOioreWumuODhuODvOODluODqycpO1xuY29uc29sZS5sb2coJyAgICAg4pSc4pSAIOODgeODo+ODg+ODiOWxpeattOODhuODvOODluODqycpO1xuY29uc29sZS5sb2coJyAgICAg4pSc4pSAIOWLleeahOioreWumuOCreODo+ODg+OCt+ODpeODhuODvOODluODqycpO1xuY29uc29sZS5sb2coJyAgICAg4pSc4pSAIOODpuODvOOCtuODvOOCouOCr+OCu+OCueODhuODvOODluODqycpO1xuY29uc29sZS5sb2coJyAgICAg4pSU4pSAIOaoqemZkOOCreODo+ODg+OCt+ODpeODhuODvOODluODqycpO1xuY29uc29sZS5sb2coJycpO1xuY29uc29sZS5sb2coJ/CfkqEg44K544OI44Os44O844K444Ki44O844Kt44OG44Kv44OB44OjOicpO1xuY29uc29sZS5sb2coJyAgIOKchSBGU3ggZm9yIE9OVEFQ44KS5Li76KaB44K544OI44Os44O844K444Go44GX44Gm5L2/55SoJyk7XG5jb25zb2xlLmxvZygnICAg4pyFIFMzIEFjY2VzcyBQb2ludHPntYznlLHjgadGU3ggZm9yIE9OVEFQ44Gr44Ki44Kv44K744K5Jyk7XG5jb25zb2xlLmxvZygnICAg4pyFIFMz44Gv5L2/55So44GX44Gq44GE77yIRlN4IGZvciBPTlRBUOOBq+e1seWQiO+8iScpO1xuY29uc29sZS5sb2coJyAgIOKchSBFRlPjga/kvb/nlKjjgZfjgarjgYTvvIhGU3ggZm9yIE9OVEFQ44Gr57Wx5ZCI77yJJyk7XG5jb25zb2xlLmxvZygnJyk7XG5jb25zb2xlLmxvZygn4o+x77iPIOODh+ODl+ODreOCpOaZgumWkzogNjAtOTDliIbvvIhGU3jkvZzmiJDlkKvjgoDvvIknKTtcbmNvbnNvbGUubG9nKCcnKTtcblxuLy8gRGF0YVN0YWNrQ29uZmln5rqW5oug44Gu6Kit5a6aXG4vLyDjgqLjg7zjgq3jg4bjgq/jg4Hjg6Pljp/liYc6XG4vLyAtIEZTeCBmb3IgT05UQVDjgpLkuLvopoHjgrnjg4jjg6zjg7zjgrjjgajjgZfjgabkvb/nlKhcbi8vIC0gUzMgQWNjZXNzIFBvaW50c+e1jOeUseOBp0ZTeCBmb3IgT05UQVDjgavjgqLjgq/jgrvjgrlcbi8vIC0gUzPjga/kvb/nlKjjgZfjgarjgYTvvIhGU3ggZm9yIE9OVEFQ44Gr57Wx5ZCI77yJXG4vLyAtIEVGU+OBr+S9v+eUqOOBl+OBquOBhO+8iEZTeCBmb3IgT05UQVDjgavntbHlkIjvvIlcbmNvbnN0IGRhdGFTdGFja0NvbmZpZyA9IHtcbiAgc3RvcmFnZToge1xuICAgIC8vIFMz44Gv5L2/55So44GX44Gq44GE77yIRlN4IGZvciBPTlRBUCArIFMzIEFjY2VzcyBQb2ludHPjgpLkvb/nlKjvvIlcbiAgICBmc3g6IHtcbiAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICBmaWxlU3lzdGVtVHlwZTogJ09OVEFQJyBhcyBjb25zdCxcbiAgICAgIHN0b3JhZ2VDYXBhY2l0eTogMTAyNCxcbiAgICAgIHRocm91Z2hwdXRDYXBhY2l0eTogMTI4LFxuICAgICAgbXVsdGlBejogZmFsc2UsXG4gICAgICBkZXBsb3ltZW50VHlwZTogJ1NJTkdMRV9BWl8xJyBhcyBjb25zdCxcbiAgICAgIGF1dG9tYXRpY0JhY2t1cFJldGVudGlvbkRheXM6IDAsXG4gICAgICBkaXNhYmxlQmFja3VwQ29uZmlybWVkOiB0cnVlLFxuICAgICAgYmFja3VwOiB7XG4gICAgICAgIGF1dG9tYXRpY0JhY2t1cDogZmFsc2UsXG4gICAgICAgIHJldGVudGlvbkRheXM6IDAsXG4gICAgICAgIGRpc2FibGVCYWNrdXBDb25maXJtZWQ6IHRydWVcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIGRhdGFiYXNlOiB7XG4gICAgZHluYW1vRGI6IHtcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBlbmNyeXB0aW9uOiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIGttc01hbmFnZWQ6IHRydWVcbiAgICAgIH0sXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlXG4gICAgfSxcbiAgICBvcGVuU2VhcmNoOiB7XG4gICAgICBlbmFibGVkOiBmYWxzZSwgLy8gT3BlblNlYXJjaOOBr+WJiumZpOa4iOOBv1xuICAgICAgc2VydmVybGVzczogZmFsc2UsXG4gICAgICBlbmNyeXB0aW9uOiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIGttc01hbmFnZWQ6IHRydWVcbiAgICAgIH1cbiAgICB9LFxuICAgIHJkczogZmFsc2UgYXMgYW55IC8vIFJEU+OBr+S9v+eUqOOBl+OBquOBhFxuICB9XG59O1xuXG5jb25zdCBkYXRhU3RhY2sgPSBuZXcgRGF0YVN0YWNrKGFwcCwgYFRva3lvUmVnaW9uLSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LURhdGFgLCB7XG4gIGNvbmZpZzogZGF0YVN0YWNrQ29uZmlnLFxuICBwcm9qZWN0TmFtZTogcHJvamVjdE5hbWUsXG4gIGVudmlyb25tZW50OiBlbnZpcm9ubWVudCxcbiAgdnBjOiBuZXR3b3JraW5nU3RhY2sudnBjLCAvLyDinIUgTmV0d29ya2luZ1N0YWNr44GuVlBD44KS5piO56S655qE44Gr5L2/55SoXG4gIHByaXZhdGVTdWJuZXRJZHM6IG5ldHdvcmtpbmdTdGFjay5wcml2YXRlU3VibmV0cy5tYXAoc3VibmV0ID0+IHN1Ym5ldC5zdWJuZXRJZCksIC8vIOKchSDjg5fjg6njgqTjg5njg7zjg4jjgrXjg5bjg43jg4Pjg4hJROOCkua4oeOBmVxuICBzZWN1cml0eVN0YWNrOiBzZWN1cml0eVN0YWNrLCAvLyBLTVMgS2V544KS5L2/55SoXG4gIGVudjogZW52LFxuICBkZXNjcmlwdGlvbjogJ0RhdGEgU3RhY2sgLSBGU3ggZm9yIE9OVEFQICh1c2luZyBzaGFyZWQgVlBDIGZyb20gTmV0d29ya2luZ1N0YWNrKSwgRHluYW1vREIgKFNlc3Npb24sIFVzZXJQcmVmZXJlbmNlcywgQ2hhdEhpc3RvcnksIGV0Yy4pJyxcbn0pO1xuXG4vLyBEYXRhU3RhY2vjga9OZXR3b3JraW5nU3RhY2vjgahTZWN1cml0eVN0YWNr44Gr5L6d5a2YXG5kYXRhU3RhY2suYWRkRGVwZW5kZW5jeShuZXR3b3JraW5nU3RhY2spO1xuZGF0YVN0YWNrLmFkZERlcGVuZGVuY3koc2VjdXJpdHlTdGFjayk7XG5cbmNvbnNvbGUubG9nKCcnKTtcbmNvbnNvbGUubG9nKCfinIUgRGF0YSBTdGFja+S9nOaIkOWujOS6hicpO1xuY29uc29sZS5sb2coJ+KUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgScpO1xuY29uc29sZS5sb2coJ/Cfk4og5pei5a2YVlBD5L2/55So44Gu56K66KqNOicpO1xuY29uc29sZS5sb2coYCAgIPCfjJAg5L2/55SoVlBDOiAke2V4aXN0aW5nVnBjSWR9ICgke2V4aXN0aW5nVnBjQ2lkcn0pYCk7XG5jb25zb2xlLmxvZyhgICAg8J+TjSBGU3jphY3nva7lhYg6IOaXouWtmFZQQ+OBruODl+ODqeOCpOODmeODvOODiOOCteODluODjeODg+ODiGApO1xuY29uc29sZS5sb2coYCAgIPCflJIg44K144OW44ON44OD44OI5pWwOiAke25ldHdvcmtpbmdTdGFjay5wcml2YXRlU3VibmV0cy5sZW5ndGh95YCLYCk7XG5jb25zb2xlLmxvZygnJyk7XG5jb25zb2xlLmxvZygn8J+TiiDkvZzmiJDjgZXjgozjgZ/jg6rjgr3jg7zjgrk6Jyk7XG5jb25zb2xlLmxvZygnICAg8J+SviBGU3ggZm9yIE9OVEFQOiAxMDI0R0IsIDEyOE1CL3MnKTtcbmNvbnNvbGUubG9nKCcgICDwn5eE77iPIER5bmFtb0RCOiA244OG44O844OW44OrJyk7XG5jb25zb2xlLmxvZygnICAg8J+UkCDmmpflj7fljJY6IFNlY3VyaXR5U3RhY2sg44GuIEtNUyBLZXnkvb/nlKgnKTtcbmNvbnNvbGUubG9nKCfilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIEnKTtcbmNvbnNvbGUubG9nKCcnKTtcbmNvbnNvbGUubG9nKCfwn5KhIOaXouWtmFZQQ+S9v+eUqOOBruODoeODquODg+ODiDonKTtcbmNvbnNvbGUubG9nKCcgICDinIUgVlBD5YmK6Zmk5LiN6KaBOiDml6LlrZjnkrDlooPjgpLntq3mjIEnKTtcbmNvbnNvbGUubG9nKCcgICDinIUg44OA44Km44Oz44K/44Kk44Og44Gq44GXOiDml6LlrZjjg6rjgr3jg7zjgrnjgavlvbHpn7/jgarjgZcnKTtcbmNvbnNvbGUubG9nKCcgICDinIUg44Kz44K544OI5YmK5ribOiBOQVQgR2F0ZXdheemHjeikh+OCs+OCueODiOWbnumBvycpO1xuY29uc29sZS5sb2coJyAgIOKchSDjg43jg4Pjg4jjg6/jg7zjgq/ntbHlkIg6IOWFqOODquOCveODvOOCueOBjOWQjOS4gOODjeODg+ODiOODr+ODvOOCr+WGheOBp+mAmuS/oScpO1xuY29uc29sZS5sb2coJyAgIOKchSDjgrvjgq3jg6Xjg6rjg4bjgqM6IOe1seS4gOOBleOCjOOBn+OCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+euoeeQhicpO1xuY29uc29sZS5sb2coJyAgIOKchSDpgYvnlKjlirnnjoc6IFZQQ+euoeeQhuOBruS4gOWFg+WMlicpO1xuY29uc29sZS5sb2coJ+KUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgScpO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBQaGFzZSA0OiBXZWJBcHAgU3RhY2vvvIhXZWLjgqLjg5fjg6rjgrHjg7zjgrfjg6fjg7PvvIlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbmNvbnNvbGUubG9nKCdcXG7ilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIEnKTtcbmNvbnNvbGUubG9nKCfwn4yQIFBoYXNlIDQ6IFdlYkFwcCBTdGFja++8iOWIpemAlOODh+ODl+ODreOCpO+8iScpO1xuY29uc29sZS5sb2coJ+KUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgScpO1xuY29uc29sZS5sb2coJycpO1xuY29uc29sZS5sb2coJ+KaoO+4jyAgV2ViQXBwU3RhY2vjga/liKXpgJTjg4fjg5fjg63jgqTjgZfjgabjgY/jgaDjgZXjgYTvvIhpbWFnZVRhZ+OBjOW/heimge+8iScpO1xuY29uc29sZS5sb2coJycpO1xuY29uc29sZS5sb2coJ/Cfk4sg44OH44OX44Ot44Kk44Kz44Oe44Oz44OJOicpO1xuY29uc29sZS5sb2coJyAgIG5weCBjZGsgZGVwbG95IFRva3lvUmVnaW9uLXBlcm1pc3Npb24tYXdhcmUtcmFnLXByb2QtV2ViQXBwIFxcXFwnKTtcbmNvbnNvbGUubG9nKCcgICAgIC1jIGltYWdlVGFnPTx5b3VyLWltYWdlLXRhZz4nKTtcbmNvbnNvbGUubG9nKCcnKTtcbmNvbnNvbGUubG9nKCfwn5KhIFdlYkFwcFN0YWNr44KCTmV0d29ya2luZ1N0YWNr44GuVlBD44KS5L2/55So44GX44G+44GZJyk7XG5jb25zb2xlLmxvZygn4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSBJyk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOODh+ODl+ODreOCpOOCteODnuODquODvFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuY29uc29sZS5sb2coJ1xcbuKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgScpO1xuY29uc29sZS5sb2coJ/Cfk4og44OH44OX44Ot44Kk44K144Oe44Oq44O877yI5pei5a2YVlBD5L2/55So44Ki44O844Kt44OG44Kv44OB44Oj77yJJyk7XG5jb25zb2xlLmxvZygn4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSBJyk7XG5jb25zb2xlLmxvZygnJyk7XG5jb25zb2xlLmxvZygn4pyFIFBoYXNlIDE6IE5ldHdvcmtpbmcgU3RhY2sgLSDml6LlrZhWUEPjgqTjg7Pjg53jg7zjg4gnKTtcbmNvbnNvbGUubG9nKGAgICDwn4yQIFZQQzogJHtleGlzdGluZ1ZwY0lkfSAoJHtleGlzdGluZ1ZwY0NpZHJ9KWApO1xuY29uc29sZS5sb2coJyAgIPCfk40gQVo6IDMnKTtcbmNvbnNvbGUubG9nKCcgICDwn5OCIFN1Ym5ldHM6IFB1YmxpYywgUHJpdmF0ZSwgSXNvbGF0ZWTvvIjml6LlrZjvvIknKTtcbmNvbnNvbGUubG9nKCcgICDwn5uh77iPIFNlY3VyaXR5IEdyb3VwczogV2ViLCBBUEksIERhdGFiYXNlLCBMYW1iZGHvvIjmlrDopo/kvZzmiJDjgIHlkI3liY3jga7ph43opIfjgpLli5XnmoTjgavlm57pgb/vvIknKTtcbmNvbnNvbGUubG9nKCcgICDwn6qfIFdpbmRvd3MgQUQgRUMyOiB0My5tZWRpdW3vvIjmlrDopo/kvZzmiJDvvIknKTtcbmNvbnNvbGUubG9nKCcgICDwn5KhIOaXouWtmFZQQ+OCkuS9v+eUqOOAgVZQQ+WJiumZpOOChOaWsOimj+S9nOaIkOOBquOBlycpO1xuY29uc29sZS5sb2coJycpO1xuY29uc29sZS5sb2coJ+KchSBQaGFzZSAyOiBTZWN1cml0eSBTdGFjayAtIOOCu+OCreODpeODquODhuOCo+WfuuebpCcpO1xuY29uc29sZS5sb2coJyAgIPCflJAgS01TIEtleTog5pyJ5Yq577yI6Ieq5YuV44Ot44O844OG44O844K344On44Oz77yJJyk7XG5jb25zb2xlLmxvZygnICAg8J+boe+4jyBHdWFyZER1dHk6IOaXouWtmERldGVjdG9y5L2/55SoJyk7XG5jb25zb2xlLmxvZygnICAg8J+SoSDlhajjgrnjgr/jg4Pjgq/jgaflhbHmnInjgZXjgozjgotLTVMgS2V5Jyk7XG5jb25zb2xlLmxvZygnJyk7XG5jb25zb2xlLmxvZygn4pyFIFBoYXNlIDM6IERhdGEgU3RhY2sgLSDjg4fjg7zjgr/ln7rnm6TvvIjml6LlrZhWUEPkvb/nlKjvvIknKTtcbmNvbnNvbGUubG9nKCcgICDwn5K+IEZTeCBmb3IgT05UQVA6IDEwMjRHQiwgMTI4TUIvcycpO1xuY29uc29sZS5sb2coJyAgIPCfk40g6YWN572u5YWIOiDml6LlrZhWUEPjga7jg5fjg6njgqTjg5njg7zjg4jjgrXjg5bjg43jg4Pjg4gnKTtcbmNvbnNvbGUubG9nKCcgICDwn5eE77iPIER5bmFtb0RCOiA244OG44O844OW44OrJyk7XG5jb25zb2xlLmxvZygnICAg8J+UlyDml6LlrZhWUEPkvb/nlKg6IOKchSDmmI7npLrnmoTjgavoqK3lrprmuIjjgb8nKTtcbmNvbnNvbGUubG9nKGAgICDwn5KhIOaXouWtmFZQQyAoJHtleGlzdGluZ1ZwY0lkfSkg44KS5L2/55SoYCk7XG5jb25zb2xlLmxvZygnJyk7XG5jb25zb2xlLmxvZygn4o+zIFBoYXNlIDQ6IFdlYkFwcCBTdGFjayAtIFdlYuOCouODl+ODquOCseODvOOCt+ODp+ODsycpO1xuY29uc29sZS5sb2coJyAgIOKaoO+4jyAg5Yil6YCU44OH44OX44Ot44Kk44GM5b+F6KaB77yIaW1hZ2VUYWfmjIflrprvvIknKTtcbmNvbnNvbGUubG9nKCcgICDwn5KhIOaXouWtmFZQQ+OCkuS9v+eUqOS6iOWumicpO1xuY29uc29sZS5sb2coJ+KUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgScpO1xuY29uc29sZS5sb2coJycpO1xuY29uc29sZS5sb2coJ/Cfjq8g5pei5a2YVlBD5L2/55So44Ki44O844Kt44OG44Kv44OB44Oj44Gu5Yip54K5OicpO1xuY29uc29sZS5sb2coJ+KUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgScpO1xuY29uc29sZS5sb2coJ/CfkrAg44Kz44K544OI5YmK5ribOicpO1xuY29uc29sZS5sb2coJyAgIC0gVlBD5YmK6Zmk5LiN6KaBOiDml6LlrZjnkrDlooPjgpLntq3mjIEnKTtcbmNvbnNvbGUubG9nKCcgICAtIE5BVCBHYXRld2F56YeN6KSH44Kz44K544OI5Zue6YG/77yI5pyI6aGNJDQ1L+WAiyDDlyDliYrmuJvmlbDvvIknKTtcbmNvbnNvbGUubG9nKCcgICAtIFZQQyBQZWVyaW5n5LiN6KaB77yI5pyI6aGNJDAuMDEvR0Igw5cg5YmK5rib6YeP77yJJyk7XG5jb25zb2xlLmxvZygnJyk7XG5jb25zb2xlLmxvZygn8J+UkiDjgrvjgq3jg6Xjg6rjg4bjgqPlkJHkuIo6Jyk7XG5jb25zb2xlLmxvZygnICAgLSDntbHkuIDjgZXjgozjgZ/jgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fnrqHnkIYnKTtcbmNvbnNvbGUubG9nKCcgICAtIOS4gOWFg+WMluOBleOCjOOBn05BQ0zoqK3lrponKTtcbmNvbnNvbGUubG9nKCcgICAtIFZQQyBGbG93IExvZ3Pjga7ntbHlkIjnrqHnkIYnKTtcbmNvbnNvbGUubG9nKCcnKTtcbmNvbnNvbGUubG9nKCfimqEg6YGL55So5Yq5546H5YyWOicpO1xuY29uc29sZS5sb2coJyAgIC0gVlBD566h55CG44Gu5LiA5YWD5YyWJyk7XG5jb25zb2xlLmxvZygnICAgLSDjg43jg4Pjg4jjg6/jg7zjgq/oqK3lrprjga7nsKHntKDljJYnKTtcbmNvbnNvbGUubG9nKCcgICAtIOODiOODqeODluODq+OCt+ODpeODvOODhuOCo+ODs+OCsOOBruWuueaYk+WMlicpO1xuY29uc29sZS5sb2coJyAgIC0g44OA44Km44Oz44K/44Kk44Og44Gq44GXOiDml6LlrZjjg6rjgr3jg7zjgrnjgavlvbHpn7/jgarjgZcnKTtcbmNvbnNvbGUubG9nKCcnKTtcbmNvbnNvbGUubG9nKCfwn5uh77iPIFNlY3VyaXR5IEdyb3Vw5ZCN44Gu6YeN6KSH5a++562WOicpO1xuY29uc29sZS5sb2coJyAgIC0g44K/44Kk44Og44K544K/44Oz44OX44KS5L2/55So44GX44Gm5YuV55qE44Gr5LiA5oSP44Gq5ZCN5YmN44KS55Sf5oiQJyk7XG5jb25zb2xlLmxvZygnICAgLSDml6LlrZjjga5TZWN1cml0eSBHcm91cHPjgajnq7blkIjjgZfjgarjgYQnKTtcbmNvbnNvbGUubG9nKCcgICAtIOWQjOOBmOapn+iDveOCkuaMgeOBpFNlY3VyaXR5IEdyb3Vwc+OCkuikh+ijvScpO1xuY29uc29sZS5sb2coJ+KUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgScpO1xuXG5jb25zb2xlLmxvZygnXFxu8J+OryDmrKHjga7jgrnjg4bjg4Pjg5c6Jyk7XG5jb25zb2xlLmxvZygn4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSBJyk7XG5jb25zb2xlLmxvZygnMS4gQ0RLIFN5bnRo5a6f6KGMOiBucHggY2RrIHN5bnRoJyk7XG5jb25zb2xlLmxvZygnMi4g44OH44OX44Ot44Kk5a6f6KGMOiBucHggY2RrIGRlcGxveSAtLWFsbCcpO1xuY29uc29sZS5sb2coJzMuIFdlYkFwcOODh+ODl+ODreOCpDogbnB4IGNkayBkZXBsb3kgVG9reW9SZWdpb24tcGVybWlzc2lvbi1hd2FyZS1yYWctcHJvZC1XZWJBcHAgLWMgaW1hZ2VUYWc9PHRhZz4nKTtcbmNvbnNvbGUubG9nKGA0LiDml6LlrZhWUEPnorroqo06IEFXUyBDb25zb2xlID4gVlBDID4gJHtleGlzdGluZ1ZwY0lkfWApO1xuY29uc29sZS5sb2coJzUuIEZTeOmFjee9rueiuuiqjTogQVdTIENvbnNvbGUgPiBGU3ggPiBGaWxlIFN5c3RlbXMnKTtcbmNvbnNvbGUubG9nKCc2LiBTZWN1cml0eSBHcm91cHPnorroqo06IEFXUyBDb25zb2xlID4gVlBDID4gU2VjdXJpdHkgR3JvdXBz77yI44K/44Kk44Og44K544K/44Oz44OX5LuY44GN5ZCN5YmN77yJJyk7XG5jb25zb2xlLmxvZygn4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSBJyk7XG5cbmFwcC5zeW50aCgpO1xuIl19