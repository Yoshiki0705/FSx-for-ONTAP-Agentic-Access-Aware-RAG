#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { tokyoProductionConfig } from '../lib/config/environments/tokyo-production-config';
import { NetworkingStack } from '../lib/stacks/integrated/networking-stack';
import { SecurityStack } from '../lib/stacks/integrated/security-stack';
import { DataStack } from '../lib/stacks/integrated/data-stack';
import { EmbeddingStack } from '../lib/stacks/integrated/embedding-stack';
import { WebAppStack } from '../lib/stacks/integrated/webapp-stack';
import { OperationsStack } from '../lib/stacks/integrated/operations-stack';
import { adaptNetworkingConfig } from '../lib/config/adapters/networking-config-adapter';
import { adaptSecurityConfig } from '../lib/config/adapters/security-config-adapter';
import { adaptWebAppConfig } from '../lib/config/adapters/webapp-config-adapter';

/**
 * Permission-aware RAG with FSx for NetApp ONTAP
 * 統合デプロイメントアプリケーション
 * 
 * 環境変数DEPLOY_MODEで動作モードを切り替え:
 * - minimal: NetworkingStack + DataStack のみ
 * - full: 全6スタック（開発・テスト用）
 * - production: 全6スタック（本番用、追加検証あり）
 * 
 * デフォルト: full
 */

const app = new cdk.App();

// デプロイモードの取得
const deployMode = process.env.DEPLOY_MODE || 'full';
const validModes = ['minimal', 'full', 'production'];

if (!validModes.includes(deployMode)) {
  console.error(`❌ エラー: 無効なDEPLOY_MODE: ${deployMode}`);
  console.error(`   有効な値: ${validModes.join(', ')}`);
  process.exit(1);
}

// imageTagの取得（CDKコンテキストから）
const imageTag = app.node.tryGetContext('imageTag');

// 環境設定
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || '123456789012',
  region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1'
};

const projectName = tokyoProductionConfig.naming.projectName;
const environment = tokyoProductionConfig.environment;
const regionPrefix = tokyoProductionConfig.naming.regionPrefix;

console.log('🚀 Permission-aware RAG 統合デプロイメント初期化...');
console.log(`   デプロイモード: ${deployMode}`);
console.log(`   プロジェクト名: ${projectName}`);
console.log(`   環境: ${environment}`);
console.log(`   リージョン: ${tokyoProductionConfig.region}`);
console.log(`   アカウント: ${env.account}`);
console.log('');

// =============================================================================
// Stack 1: NetworkingStack（全モード共通）
// =============================================================================
console.log('📡 1/6: NetworkingStack初期化...');
const networkingStackName = `${regionPrefix}-${projectName}-${environment}-Networking`;
const networkingConfig = adaptNetworkingConfig(tokyoProductionConfig);
const networkingStack = new NetworkingStack(app, networkingStackName, {
  env,
  config: networkingConfig,
  projectName,
  environment: environment as 'dev' | 'staging' | 'prod' | 'test',
  description: `Permission-aware RAG Networking Stack (${deployMode})`,
  tags: {
    Project: projectName,
    Environment: environment,
    Stack: 'Networking',
    DeployMode: deployMode,
    ManagedBy: 'CDK'
  }
});
console.log('✅ NetworkingStack初期化完了');
console.log('');

// =============================================================================
// Stack 2: SecurityStack（full/production）
// =============================================================================
let securityStack: SecurityStack | undefined;
if (deployMode === 'full' || deployMode === 'production') {
  console.log('🔒 2/6: SecurityStack初期化...');
  const securityStackName = `${regionPrefix}-${projectName}-${environment}-Security`;
  securityStack = new SecurityStack(app, securityStackName, {
    env,
    config: tokyoProductionConfig,
    projectName,
    environment,
    description: `Permission-aware RAG Security Stack (${deployMode})`,
    tags: {
      Project: projectName,
      Environment: environment,
      Stack: 'Security',
      DeployMode: deployMode,
      ManagedBy: 'CDK'
    }
  });
  console.log('✅ SecurityStack初期化完了');
  console.log('');
} else {
  console.log('⏭️  2/6: SecurityStack スキップ（minimalモード）');
  console.log('');
}

// =============================================================================
// Stack 3: DataStack（全モード共通）
// =============================================================================
console.log('💾 3/6: DataStack初期化...');
const dataStackName = `${regionPrefix}-${projectName}-${environment}-Data`;
const dataStack = new DataStack(app, dataStackName, {
  env,
  config: {
    storage: {
      s3: tokyoProductionConfig.storage.s3,
      fsx: tokyoProductionConfig.storage.fsxOntap,
      fsxOntap: tokyoProductionConfig.storage.fsxOntap
    } as any,
    database: tokyoProductionConfig.database as any
  },
  projectName,
  environment,
  vpc: networkingStack.vpc,
  privateSubnetIds: networkingStack.vpc.privateSubnets.map((subnet: any) => subnet.subnetId),
  securityStack,
  description: `Permission-aware RAG Data Stack (${deployMode})`,
  tags: {
    Project: projectName,
    Environment: environment,
    Stack: 'Data',
    DeployMode: deployMode,
    ManagedBy: 'CDK'
  }
});
console.log('✅ DataStack初期化完了');
console.log('');

// =============================================================================
// Stack 4: EmbeddingStack（full/production）
// =============================================================================
let embeddingStack: EmbeddingStack | undefined;
if (deployMode === 'full' || deployMode === 'production') {
  console.log('🤖 4/6: EmbeddingStack初期化...');
  const embeddingStackName = `${regionPrefix}-${projectName}-${environment}-Embedding`;
  embeddingStack = new EmbeddingStack(app, embeddingStackName, {
    env,
    config: {
      ai: tokyoProductionConfig.ai
    },
    projectName,
    environment,
    vpc: networkingStack.vpc,
    privateSubnetIds: networkingStack.vpc.privateSubnets.map((subnet: any) => subnet.subnetId),
    publicSubnetIds: networkingStack.vpc.publicSubnets.map((subnet: any) => subnet.subnetId),
    s3BucketNames: dataStack.s3BucketNames,
    // AWS Batch/ECS/Spot Fleet有効化
    enableBatchIntegration: tokyoProductionConfig.embedding?.batch?.enabled || false,
    embeddingConfig: tokyoProductionConfig.embedding as any,
    description: `Permission-aware RAG Embedding Stack (${deployMode})`,
    tags: {
      Project: projectName,
      Environment: environment,
      Stack: 'Embedding',
      DeployMode: deployMode,
      ManagedBy: 'CDK'
    }
  });
  console.log('✅ EmbeddingStack初期化完了');
  console.log('');
} else {
  console.log('⏭️  4/6: EmbeddingStack スキップ（minimalモード）');
  console.log('');
}

// =============================================================================
// Stack 5: WebAppStack（full/production）
// =============================================================================
let webAppStack: WebAppStack | undefined;
if (deployMode === 'full' || deployMode === 'production') {
  console.log('🌐 5/6: WebAppStack初期化...');
  const webAppStackName = `${regionPrefix}-${projectName}-${environment}-WebApp`;
  const webAppStack = new WebAppStack(app, webAppStackName, {
    env,
    config: tokyoProductionConfig as any, // EnvironmentConfigとの互換性のため
    projectName,
    environment,
    networkingStack,
    securityStack,
    imageTag, // CDKコンテキストから取得したimageTagを渡す
    description: `Permission-aware RAG WebApp Stack (${deployMode})`,
    tags: {
      Project: projectName,
      Environment: environment,
      Stack: 'WebApp',
      DeployMode: deployMode,
      ManagedBy: 'CDK'
    }
  });
  console.log('✅ WebAppStack初期化完了');
  console.log('');
} else {
  console.log('⏭️  5/6: WebAppStack スキップ（minimalモード）');
  console.log('');
}

// =============================================================================
// Stack 6: OperationsStack（full/production）
// =============================================================================
let operationsStack: OperationsStack | undefined;
if (deployMode === 'full' || deployMode === 'production') {
  console.log('📊 6/6: OperationsStack初期化...');
  const operationsStackName = `${regionPrefix}-${projectName}-${environment}-Operations`;
  operationsStack = new OperationsStack(app, operationsStackName, {
    env,
    config: {
      ...tokyoProductionConfig,
      monitoring: tokyoProductionConfig.monitoring || {
        cloudwatch: { enabled: true },
        sns: { enabled: true },
        logs: { retentionDays: 7 }
      }
    },
    projectName,
    environment,
    securityStack,
    dataStack,
    embeddingStack,
    webAppStack,
    description: `Permission-aware RAG Operations Stack (${deployMode})`,
    tags: {
      Project: projectName,
      Environment: environment,
      Stack: 'Operations',
      DeployMode: deployMode,
      ManagedBy: 'CDK'
    }
  });
  console.log('✅ OperationsStack初期化完了');
  console.log('');
} else {
  console.log('⏭️  6/6: OperationsStack スキップ（minimalモード）');
  console.log('');
}

// =============================================================================
// デプロイサマリー
// =============================================================================
console.log('========================================');
console.log('✅ 全スタック初期化完了');
console.log('========================================');
console.log(`デプロイモード: ${deployMode}`);
console.log('');
console.log('初期化されたスタック:');
console.log('  ✅ NetworkingStack');
if (securityStack) console.log('  ✅ SecurityStack');
console.log('  ✅ DataStack');
if (embeddingStack) console.log('  ✅ EmbeddingStack');
if (webAppStack) console.log('  ✅ WebAppStack');
if (operationsStack) console.log('  ✅ OperationsStack');
console.log('');
console.log('デプロイコマンド:');
console.log('  npx cdk deploy --all');
console.log('');
console.log('モード切り替え:');
console.log('  DEPLOY_MODE=minimal npx cdk deploy --all');
console.log('  DEPLOY_MODE=full npx cdk deploy --all');
console.log('  DEPLOY_MODE=production npx cdk deploy --all');
console.log('========================================');
