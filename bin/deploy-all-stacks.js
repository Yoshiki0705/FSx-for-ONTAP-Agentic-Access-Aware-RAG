#!/usr/bin/env node
"use strict";
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
const tokyo_production_config_1 = require("../lib/config/environments/tokyo-production-config");
const networking_stack_1 = require("../lib/stacks/integrated/networking-stack");
const security_stack_1 = require("../lib/stacks/integrated/security-stack");
const data_stack_1 = require("../lib/stacks/integrated/data-stack");
const embedding_stack_1 = require("../lib/stacks/integrated/embedding-stack");
const webapp_stack_1 = require("../lib/stacks/integrated/webapp-stack");
const operations_stack_1 = require("../lib/stacks/integrated/operations-stack");
const networking_config_adapter_1 = require("../lib/config/adapters/networking-config-adapter");
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
const projectName = tokyo_production_config_1.tokyoProductionConfig.naming.projectName;
const environment = tokyo_production_config_1.tokyoProductionConfig.environment;
const regionPrefix = tokyo_production_config_1.tokyoProductionConfig.naming.regionPrefix;
console.log('🚀 Permission-aware RAG 統合デプロイメント初期化...');
console.log(`   デプロイモード: ${deployMode}`);
console.log(`   プロジェクト名: ${projectName}`);
console.log(`   環境: ${environment}`);
console.log(`   リージョン: ${tokyo_production_config_1.tokyoProductionConfig.region}`);
console.log(`   アカウント: ${env.account}`);
console.log('');
// =============================================================================
// Stack 1: NetworkingStack（全モード共通）
// =============================================================================
console.log('📡 1/6: NetworkingStack初期化...');
const networkingStackName = `${regionPrefix}-${projectName}-${environment}-Networking`;
const networkingConfig = (0, networking_config_adapter_1.adaptNetworkingConfig)(tokyo_production_config_1.tokyoProductionConfig);
const networkingStack = new networking_stack_1.NetworkingStack(app, networkingStackName, {
    env,
    config: networkingConfig,
    projectName,
    environment: environment,
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
let securityStack;
if (deployMode === 'full' || deployMode === 'production') {
    console.log('🔒 2/6: SecurityStack初期化...');
    const securityStackName = `${regionPrefix}-${projectName}-${environment}-Security`;
    securityStack = new security_stack_1.SecurityStack(app, securityStackName, {
        env,
        config: tokyo_production_config_1.tokyoProductionConfig,
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
}
else {
    console.log('⏭️  2/6: SecurityStack スキップ（minimalモード）');
    console.log('');
}
// =============================================================================
// Stack 3: DataStack（全モード共通）
// =============================================================================
console.log('💾 3/6: DataStack初期化...');
const dataStackName = `${regionPrefix}-${projectName}-${environment}-Data`;
const dataStack = new data_stack_1.DataStack(app, dataStackName, {
    env,
    config: {
        storage: {
            s3: tokyo_production_config_1.tokyoProductionConfig.storage.s3,
            fsx: tokyo_production_config_1.tokyoProductionConfig.storage.fsxOntap,
            fsxOntap: tokyo_production_config_1.tokyoProductionConfig.storage.fsxOntap
        },
        database: tokyo_production_config_1.tokyoProductionConfig.database
    },
    projectName,
    environment,
    vpc: networkingStack.vpc,
    privateSubnetIds: networkingStack.vpc.privateSubnets.map((subnet) => subnet.subnetId),
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
let embeddingStack;
if (deployMode === 'full' || deployMode === 'production') {
    console.log('🤖 4/6: EmbeddingStack初期化...');
    const embeddingStackName = `${regionPrefix}-${projectName}-${environment}-Embedding`;
    embeddingStack = new embedding_stack_1.EmbeddingStack(app, embeddingStackName, {
        env,
        config: {
            ai: tokyo_production_config_1.tokyoProductionConfig.ai
        },
        projectName,
        environment,
        vpc: networkingStack.vpc,
        privateSubnetIds: networkingStack.vpc.privateSubnets.map((subnet) => subnet.subnetId),
        publicSubnetIds: networkingStack.vpc.publicSubnets.map((subnet) => subnet.subnetId),
        s3BucketNames: dataStack.s3BucketNames,
        // AWS Batch/ECS/Spot Fleet有効化
        enableBatchIntegration: tokyo_production_config_1.tokyoProductionConfig.embedding?.batch?.enabled || false,
        embeddingConfig: tokyo_production_config_1.tokyoProductionConfig.embedding,
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
}
else {
    console.log('⏭️  4/6: EmbeddingStack スキップ（minimalモード）');
    console.log('');
}
// =============================================================================
// Stack 5: WebAppStack（full/production）
// =============================================================================
let webAppStack;
if (deployMode === 'full' || deployMode === 'production') {
    console.log('🌐 5/6: WebAppStack初期化...');
    const webAppStackName = `${regionPrefix}-${projectName}-${environment}-WebApp`;
    const webAppStack = new webapp_stack_1.WebAppStack(app, webAppStackName, {
        env,
        config: tokyo_production_config_1.tokyoProductionConfig, // EnvironmentConfigとの互換性のため
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
}
else {
    console.log('⏭️  5/6: WebAppStack スキップ（minimalモード）');
    console.log('');
}
// =============================================================================
// Stack 6: OperationsStack（full/production）
// =============================================================================
let operationsStack;
if (deployMode === 'full' || deployMode === 'production') {
    console.log('📊 6/6: OperationsStack初期化...');
    const operationsStackName = `${regionPrefix}-${projectName}-${environment}-Operations`;
    operationsStack = new operations_stack_1.OperationsStack(app, operationsStackName, {
        env,
        config: {
            ...tokyo_production_config_1.tokyoProductionConfig,
            monitoring: tokyo_production_config_1.tokyoProductionConfig.monitoring || {
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
}
else {
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
if (securityStack)
    console.log('  ✅ SecurityStack');
console.log('  ✅ DataStack');
if (embeddingStack)
    console.log('  ✅ EmbeddingStack');
if (webAppStack)
    console.log('  ✅ WebAppStack');
if (operationsStack)
    console.log('  ✅ OperationsStack');
console.log('');
console.log('デプロイコマンド:');
console.log('  npx cdk deploy --all');
console.log('');
console.log('モード切り替え:');
console.log('  DEPLOY_MODE=minimal npx cdk deploy --all');
console.log('  DEPLOY_MODE=full npx cdk deploy --all');
console.log('  DEPLOY_MODE=production npx cdk deploy --all');
console.log('========================================');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95LWFsbC1zdGFja3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkZXBsb3ktYWxsLXN0YWNrcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsZ0dBQTJGO0FBQzNGLGdGQUE0RTtBQUM1RSw0RUFBd0U7QUFDeEUsb0VBQWdFO0FBQ2hFLDhFQUEwRTtBQUMxRSx3RUFBb0U7QUFDcEUsZ0ZBQTRFO0FBQzVFLGdHQUF5RjtBQUl6Rjs7Ozs7Ozs7OztHQVVHO0FBRUgsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsYUFBYTtBQUNiLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxJQUFJLE1BQU0sQ0FBQztBQUNyRCxNQUFNLFVBQVUsR0FBRyxDQUFDLFNBQVMsRUFBRSxNQUFNLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFFckQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztJQUNyQyxPQUFPLENBQUMsS0FBSyxDQUFDLDBCQUEwQixVQUFVLEVBQUUsQ0FBQyxDQUFDO0lBQ3RELE9BQU8sQ0FBQyxLQUFLLENBQUMsWUFBWSxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNuRCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2xCLENBQUM7QUFFRCwyQkFBMkI7QUFDM0IsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7QUFFcEQsT0FBTztBQUNQLE1BQU0sR0FBRyxHQUFHO0lBQ1YsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLElBQUksY0FBYztJQUMxRCxNQUFNLEVBQUUsT0FBTyxDQUFDLEdB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QUE0QyxDQUFDLENBQUM7QUFDMUQsT0FBTyxDQUFDLEdBQUcsQ0FBQyx5Q0FBeUMsQ0FBQyxDQUFDO0FBQ3ZELE9BQU8sQ0FBQyxHQUFHLENBQUMsK0NBQStDLENBQUMsQ0FBQztBQUM3RCxPQUFPLENBQUMsR0FBRyxDQUFDLDBDQUEwQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5pbXBvcnQgJ3NvdXJjZS1tYXAtc3VwcG9ydC9yZWdpc3Rlcic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgdG9reW9Qcm9kdWN0aW9uQ29uZmlnIH0gZnJvbSAnLi4vbGliL2NvbmZpZy9lbnZpcm9ubWVudHMvdG9reW8tcHJvZHVjdGlvbi1jb25maWcnO1xuaW1wb3J0IHsgTmV0d29ya2luZ1N0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy9pbnRlZ3JhdGVkL25ldHdvcmtpbmctc3RhY2snO1xuaW1wb3J0IHsgU2VjdXJpdHlTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvaW50ZWdyYXRlZC9zZWN1cml0eS1zdGFjayc7XG5pbXBvcnQgeyBEYXRhU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL2ludGVncmF0ZWQvZGF0YS1zdGFjayc7XG5pbXBvcnQgeyBFbWJlZGRpbmdTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvaW50ZWdyYXRlZC9lbWJlZGRpbmctc3RhY2snO1xuaW1wb3J0IHsgV2ViQXBwU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL2ludGVncmF0ZWQvd2ViYXBwLXN0YWNrJztcbmltcG9ydCB7IE9wZXJhdGlvbnNTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvaW50ZWdyYXRlZC9vcGVyYXRpb25zLXN0YWNrJztcbmltcG9ydCB7IGFkYXB0TmV0d29ya2luZ0NvbmZpZyB9IGZyb20gJy4uL2xpYi9jb25maWcvYWRhcHRlcnMvbmV0d29ya2luZy1jb25maWctYWRhcHRlcic7XG5pbXBvcnQgeyBhZGFwdFNlY3VyaXR5Q29uZmlnIH0gZnJvbSAnLi4vbGliL2NvbmZpZy9hZGFwdGVycy9zZWN1cml0eS1jb25maWctYWRhcHRlcic7XG5pbXBvcnQgeyBhZGFwdFdlYkFwcENvbmZpZyB9IGZyb20gJy4uL2xpYi9jb25maWcvYWRhcHRlcnMvd2ViYXBwLWNvbmZpZy1hZGFwdGVyJztcblxuLyoqXG4gKiBQZXJtaXNzaW9uLWF3YXJlIFJBRyB3aXRoIEZTeCBmb3IgTmV0QXBwIE9OVEFQXG4gKiDntbHlkIjjg4fjg5fjg63jgqTjg6Hjg7Pjg4jjgqLjg5fjg6rjgrHjg7zjgrfjg6fjg7NcbiAqIFxuICog55Kw5aKD5aSJ5pWwREVQTE9ZX01PREXjgafli5XkvZzjg6Ljg7zjg4njgpLliIfjgormm7/jgYg6XG4gKiAtIG1pbmltYWw6IE5ldHdvcmtpbmdTdGFjayArIERhdGFTdGFjayDjga7jgb9cbiAqIC0gZnVsbDog5YWoNuOCueOCv+ODg+OCr++8iOmWi+eZuuODu+ODhuOCueODiOeUqO+8iVxuICogLSBwcm9kdWN0aW9uOiDlhag244K544K/44OD44Kv77yI5pys55Wq55So44CB6L+95Yqg5qSc6Ki844GC44KK77yJXG4gKiBcbiAqIOODh+ODleOCqeODq+ODiDogZnVsbFxuICovXG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbi8vIOODh+ODl+ODreOCpOODouODvOODieOBruWPluW+l1xuY29uc3QgZGVwbG95TW9kZSA9IHByb2Nlc3MuZW52LkRFUExPWV9NT0RFIHx8ICdmdWxsJztcbmNvbnN0IHZhbGlkTW9kZXMgPSBbJ21pbmltYWwnLCAnZnVsbCcsICdwcm9kdWN0aW9uJ107XG5cbmlmICghdmFsaWRNb2Rlcy5pbmNsdWRlcyhkZXBsb3lNb2RlKSkge1xuICBjb25zb2xlLmVycm9yKGDinYwg44Ko44Op44O8OiDnhKHlirnjgapERVBMT1lfTU9ERTogJHtkZXBsb3lNb2RlfWApO1xuICBjb25zb2xlLmVycm9yKGAgICDmnInlirnjgarlgKQ6ICR7dmFsaWRNb2Rlcy5qb2luKCcsICcpfWApO1xuICBwcm9jZXNzLmV4aXQoMSk7XG59XG5cbi8vIGltYWdlVGFn44Gu5Y+W5b6X77yIQ0RL44Kz44Oz44OG44Kt44K544OI44GL44KJ77yJXG5jb25zdCBpbWFnZVRhZyA9IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ2ltYWdlVGFnJyk7XG5cbi8vIOeSsOWig+ioreWumlxuY29uc3QgZW52ID0ge1xuICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5UIHx8ICcxMjM0NTY3ODkwMTInLFxuICByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCAnYXAtbm9ydGhlYXN0LTEnXG59O1xuXG5jb25zdCBwcm9qZWN0TmFtZSA9IHRva3lvUHJvZHVjdGlvbkNvbmZpZy5uYW1pbmcucHJvamVjdE5hbWU7XG5jb25zdCBlbnZpcm9ubWVudCA9IHRva3lvUHJvZHVjdGlvbkNvbmZpZy5lbnZpcm9ubWVudDtcbmNvbnN0IHJlZ2lvblByZWZpeCA9IHRva3lvUHJvZHVjdGlvbkNvbmZpZy5uYW1pbmcucmVnaW9uUHJlZml4O1xuXG5jb25zb2xlLmxvZygn8J+agCBQZXJtaXNzaW9uLWF3YXJlIFJBRyDntbHlkIjjg4fjg5fjg63jgqTjg6Hjg7Pjg4jliJ3mnJ/ljJYuLi4nKTtcbmNvbnNvbGUubG9nKGAgICDjg4fjg5fjg63jgqTjg6Ljg7zjg4k6ICR7ZGVwbG95TW9kZX1gKTtcbmNvbnNvbGUubG9nKGAgICDjg5fjg63jgrjjgqfjgq/jg4jlkI06ICR7cHJvamVjdE5hbWV9YCk7XG5jb25zb2xlLmxvZyhgICAg55Kw5aKDOiAke2Vudmlyb25tZW50fWApO1xuY29uc29sZS5sb2coYCAgIOODquODvOOCuOODp+ODszogJHt0b2t5b1Byb2R1Y3Rpb25Db25maWcucmVnaW9ufWApO1xuY29uc29sZS5sb2coYCAgIOOCouOCq+OCpuODs+ODiDogJHtlbnYuYWNjb3VudH1gKTtcbmNvbnNvbGUubG9nKCcnKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFN0YWNrIDE6IE5ldHdvcmtpbmdTdGFja++8iOWFqOODouODvOODieWFsemAmu+8iVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbmNvbnNvbGUubG9nKCfwn5OhIDEvNjogTmV0d29ya2luZ1N0YWNr5Yid5pyf5YyWLi4uJyk7XG5jb25zdCBuZXR3b3JraW5nU3RhY2tOYW1lID0gYCR7cmVnaW9uUHJlZml4fS0ke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1OZXR3b3JraW5nYDtcbmNvbnN0IG5ldHdvcmtpbmdDb25maWcgPSBhZGFwdE5ldHdvcmtpbmdDb25maWcodG9reW9Qcm9kdWN0aW9uQ29uZmlnKTtcbmNvbnN0IG5ldHdvcmtpbmdTdGFjayA9IG5ldyBOZXR3b3JraW5nU3RhY2soYXBwLCBuZXR3b3JraW5nU3RhY2tOYW1lLCB7XG4gIGVudixcbiAgY29uZmlnOiBuZXR3b3JraW5nQ29uZmlnLFxuICBwcm9qZWN0TmFtZSxcbiAgZW52aXJvbm1lbnQ6IGVudmlyb25tZW50IGFzICdkZXYnIHwgJ3N0YWdpbmcnIHwgJ3Byb2QnIHwgJ3Rlc3QnLFxuICBkZXNjcmlwdGlvbjogYFBlcm1pc3Npb24tYXdhcmUgUkFHIE5ldHdvcmtpbmcgU3RhY2sgKCR7ZGVwbG95TW9kZX0pYCxcbiAgdGFnczoge1xuICAgIFByb2plY3Q6IHByb2plY3ROYW1lLFxuICAgIEVudmlyb25tZW50OiBlbnZpcm9ubWVudCxcbiAgICBTdGFjazogJ05ldHdvcmtpbmcnLFxuICAgIERlcGxveU1vZGU6IGRlcGxveU1vZGUsXG4gICAgTWFuYWdlZEJ5OiAnQ0RLJ1xuICB9XG59KTtcbmNvbnNvbGUubG9nKCfinIUgTmV0d29ya2luZ1N0YWNr5Yid5pyf5YyW5a6M5LqGJyk7XG5jb25zb2xlLmxvZygnJyk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTdGFjayAyOiBTZWN1cml0eVN0YWNr77yIZnVsbC9wcm9kdWN0aW9u77yJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxubGV0IHNlY3VyaXR5U3RhY2s6IFNlY3VyaXR5U3RhY2sgfCB1bmRlZmluZWQ7XG5pZiAoZGVwbG95TW9kZSA9PT0gJ2Z1bGwnIHx8IGRlcGxveU1vZGUgPT09ICdwcm9kdWN0aW9uJykge1xuICBjb25zb2xlLmxvZygn8J+UkiAyLzY6IFNlY3VyaXR5U3RhY2vliJ3mnJ/ljJYuLi4nKTtcbiAgY29uc3Qgc2VjdXJpdHlTdGFja05hbWUgPSBgJHtyZWdpb25QcmVmaXh9LSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LVNlY3VyaXR5YDtcbiAgc2VjdXJpdHlTdGFjayA9IG5ldyBTZWN1cml0eVN0YWNrKGFwcCwgc2VjdXJpdHlTdGFja05hbWUsIHtcbiAgICBlbnYsXG4gICAgY29uZmlnOiB0b2t5b1Byb2R1Y3Rpb25Db25maWcsXG4gICAgcHJvamVjdE5hbWUsXG4gICAgZW52aXJvbm1lbnQsXG4gICAgZGVzY3JpcHRpb246IGBQZXJtaXNzaW9uLWF3YXJlIFJBRyBTZWN1cml0eSBTdGFjayAoJHtkZXBsb3lNb2RlfSlgLFxuICAgIHRhZ3M6IHtcbiAgICAgIFByb2plY3Q6IHByb2plY3ROYW1lLFxuICAgICAgRW52aXJvbm1lbnQ6IGVudmlyb25tZW50LFxuICAgICAgU3RhY2s6ICdTZWN1cml0eScsXG4gICAgICBEZXBsb3lNb2RlOiBkZXBsb3lNb2RlLFxuICAgICAgTWFuYWdlZEJ5OiAnQ0RLJ1xuICAgIH1cbiAgfSk7XG4gIGNvbnNvbGUubG9nKCfinIUgU2VjdXJpdHlTdGFja+WIneacn+WMluWujOS6hicpO1xuICBjb25zb2xlLmxvZygnJyk7XG59IGVsc2Uge1xuICBjb25zb2xlLmxvZygn4o+t77iPICAyLzY6IFNlY3VyaXR5U3RhY2sg44K544Kt44OD44OX77yIbWluaW1hbOODouODvOODie+8iScpO1xuICBjb25zb2xlLmxvZygnJyk7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTdGFjayAzOiBEYXRhU3RhY2vvvIjlhajjg6Ljg7zjg4nlhbHpgJrvvIlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5jb25zb2xlLmxvZygn8J+SviAzLzY6IERhdGFTdGFja+WIneacn+WMli4uLicpO1xuY29uc3QgZGF0YVN0YWNrTmFtZSA9IGAke3JlZ2lvblByZWZpeH0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tRGF0YWA7XG5jb25zdCBkYXRhU3RhY2sgPSBuZXcgRGF0YVN0YWNrKGFwcCwgZGF0YVN0YWNrTmFtZSwge1xuICBlbnYsXG4gIGNvbmZpZzoge1xuICAgIHN0b3JhZ2U6IHtcbiAgICAgIHMzOiB0b2t5b1Byb2R1Y3Rpb25Db25maWcuc3RvcmFnZS5zMyxcbiAgICAgIGZzeDogdG9reW9Qcm9kdWN0aW9uQ29uZmlnLnN0b3JhZ2UuZnN4T250YXAsXG4gICAgICBmc3hPbnRhcDogdG9reW9Qcm9kdWN0aW9uQ29uZmlnLnN0b3JhZ2UuZnN4T250YXBcbiAgICB9IGFzIGFueSxcbiAgICBkYXRhYmFzZTogdG9reW9Qcm9kdWN0aW9uQ29uZmlnLmRhdGFiYXNlIGFzIGFueVxuICB9LFxuICBwcm9qZWN0TmFtZSxcbiAgZW52aXJvbm1lbnQsXG4gIHZwYzogbmV0d29ya2luZ1N0YWNrLnZwYyxcbiAgcHJpdmF0ZVN1Ym5ldElkczogbmV0d29ya2luZ1N0YWNrLnZwYy5wcml2YXRlU3VibmV0cy5tYXAoKHN1Ym5ldDogYW55KSA9PiBzdWJuZXQuc3VibmV0SWQpLFxuICBzZWN1cml0eVN0YWNrLFxuICBkZXNjcmlwdGlvbjogYFBlcm1pc3Npb24tYXdhcmUgUkFHIERhdGEgU3RhY2sgKCR7ZGVwbG95TW9kZX0pYCxcbiAgdGFnczoge1xuICAgIFByb2plY3Q6IHByb2plY3ROYW1lLFxuICAgIEVudmlyb25tZW50OiBlbnZpcm9ubWVudCxcbiAgICBTdGFjazogJ0RhdGEnLFxuICAgIERlcGxveU1vZGU6IGRlcGxveU1vZGUsXG4gICAgTWFuYWdlZEJ5OiAnQ0RLJ1xuICB9XG59KTtcbmNvbnNvbGUubG9nKCfinIUgRGF0YVN0YWNr5Yid5pyf5YyW5a6M5LqGJyk7XG5jb25zb2xlLmxvZygnJyk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTdGFjayA0OiBFbWJlZGRpbmdTdGFja++8iGZ1bGwvcHJvZHVjdGlvbu+8iVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbmxldCBlbWJlZGRpbmdTdGFjazogRW1iZWRkaW5nU3RhY2sgfCB1bmRlZmluZWQ7XG5pZiAoZGVwbG95TW9kZSA9PT0gJ2Z1bGwnIHx8IGRlcGxveU1vZGUgPT09ICdwcm9kdWN0aW9uJykge1xuICBjb25zb2xlLmxvZygn8J+kliA0LzY6IEVtYmVkZGluZ1N0YWNr5Yid5pyf5YyWLi4uJyk7XG4gIGNvbnN0IGVtYmVkZGluZ1N0YWNrTmFtZSA9IGAke3JlZ2lvblByZWZpeH0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tRW1iZWRkaW5nYDtcbiAgZW1iZWRkaW5nU3RhY2sgPSBuZXcgRW1iZWRkaW5nU3RhY2soYXBwLCBlbWJlZGRpbmdTdGFja05hbWUsIHtcbiAgICBlbnYsXG4gICAgY29uZmlnOiB7XG4gICAgICBhaTogdG9reW9Qcm9kdWN0aW9uQ29uZmlnLmFpXG4gICAgfSxcbiAgICBwcm9qZWN0TmFtZSxcbiAgICBlbnZpcm9ubWVudCxcbiAgICB2cGM6IG5ldHdvcmtpbmdTdGFjay52cGMsXG4gICAgcHJpdmF0ZVN1Ym5ldElkczogbmV0d29ya2luZ1N0YWNrLnZwYy5wcml2YXRlU3VibmV0cy5tYXAoKHN1Ym5ldDogYW55KSA9PiBzdWJuZXQuc3VibmV0SWQpLFxuICAgIHB1YmxpY1N1Ym5ldElkczogbmV0d29ya2luZ1N0YWNrLnZwYy5wdWJsaWNTdWJuZXRzLm1hcCgoc3VibmV0OiBhbnkpID0+IHN1Ym5ldC5zdWJuZXRJZCksXG4gICAgczNCdWNrZXROYW1lczogZGF0YVN0YWNrLnMzQnVja2V0TmFtZXMsXG4gICAgLy8gQVdTIEJhdGNoL0VDUy9TcG90IEZsZWV05pyJ5Yq55YyWXG4gICAgZW5hYmxlQmF0Y2hJbnRlZ3JhdGlvbjogdG9reW9Qcm9kdWN0aW9uQ29uZmlnLmVtYmVkZGluZz8uYmF0Y2g/LmVuYWJsZWQgfHwgZmFsc2UsXG4gICAgZW1iZWRkaW5nQ29uZmlnOiB0b2t5b1Byb2R1Y3Rpb25Db25maWcuZW1iZWRkaW5nIGFzIGFueSxcbiAgICBkZXNjcmlwdGlvbjogYFBlcm1pc3Npb24tYXdhcmUgUkFHIEVtYmVkZGluZyBTdGFjayAoJHtkZXBsb3lNb2RlfSlgLFxuICAgIHRhZ3M6IHtcbiAgICAgIFByb2plY3Q6IHByb2plY3ROYW1lLFxuICAgICAgRW52aXJvbm1lbnQ6IGVudmlyb25tZW50LFxuICAgICAgU3RhY2s6ICdFbWJlZGRpbmcnLFxuICAgICAgRGVwbG95TW9kZTogZGVwbG95TW9kZSxcbiAgICAgIE1hbmFnZWRCeTogJ0NESydcbiAgICB9XG4gIH0pO1xuICBjb25zb2xlLmxvZygn4pyFIEVtYmVkZGluZ1N0YWNr5Yid5pyf5YyW5a6M5LqGJyk7XG4gIGNvbnNvbGUubG9nKCcnKTtcbn0gZWxzZSB7XG4gIGNvbnNvbGUubG9nKCfij63vuI8gIDQvNjogRW1iZWRkaW5nU3RhY2sg44K544Kt44OD44OX77yIbWluaW1hbOODouODvOODie+8iScpO1xuICBjb25zb2xlLmxvZygnJyk7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTdGFjayA1OiBXZWJBcHBTdGFja++8iGZ1bGwvcHJvZHVjdGlvbu+8iVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbmxldCB3ZWJBcHBTdGFjazogV2ViQXBwU3RhY2sgfCB1bmRlZmluZWQ7XG5pZiAoZGVwbG95TW9kZSA9PT0gJ2Z1bGwnIHx8IGRlcGxveU1vZGUgPT09ICdwcm9kdWN0aW9uJykge1xuICBjb25zb2xlLmxvZygn8J+MkCA1LzY6IFdlYkFwcFN0YWNr5Yid5pyf5YyWLi4uJyk7XG4gIGNvbnN0IHdlYkFwcFN0YWNrTmFtZSA9IGAke3JlZ2lvblByZWZpeH0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tV2ViQXBwYDtcbiAgY29uc3Qgd2ViQXBwU3RhY2sgPSBuZXcgV2ViQXBwU3RhY2soYXBwLCB3ZWJBcHBTdGFja05hbWUsIHtcbiAgICBlbnYsXG4gICAgY29uZmlnOiB0b2t5b1Byb2R1Y3Rpb25Db25maWcgYXMgYW55LCAvLyBFbnZpcm9ubWVudENvbmZpZ+OBqOOBruS6kuaPm+aAp+OBruOBn+OCgVxuICAgIHByb2plY3ROYW1lLFxuICAgIGVudmlyb25tZW50LFxuICAgIG5ldHdvcmtpbmdTdGFjayxcbiAgICBzZWN1cml0eVN0YWNrLFxuICAgIGltYWdlVGFnLCAvLyBDREvjgrPjg7Pjg4bjgq3jgrnjg4jjgYvjgonlj5blvpfjgZfjgZ9pbWFnZVRhZ+OCkua4oeOBmVxuICAgIGRlc2NyaXB0aW9uOiBgUGVybWlzc2lvbi1hd2FyZSBSQUcgV2ViQXBwIFN0YWNrICgke2RlcGxveU1vZGV9KWAsXG4gICAgdGFnczoge1xuICAgICAgUHJvamVjdDogcHJvamVjdE5hbWUsXG4gICAgICBFbnZpcm9ubWVudDogZW52aXJvbm1lbnQsXG4gICAgICBTdGFjazogJ1dlYkFwcCcsXG4gICAgICBEZXBsb3lNb2RlOiBkZXBsb3lNb2RlLFxuICAgICAgTWFuYWdlZEJ5OiAnQ0RLJ1xuICAgIH1cbiAgfSk7XG4gIGNvbnNvbGUubG9nKCfinIUgV2ViQXBwU3RhY2vliJ3mnJ/ljJblrozkuoYnKTtcbiAgY29uc29sZS5sb2coJycpO1xufSBlbHNlIHtcbiAgY29uc29sZS5sb2coJ+KPre+4jyAgNS82OiBXZWJBcHBTdGFjayDjgrnjgq3jg4Pjg5fvvIhtaW5pbWFs44Oi44O844OJ77yJJyk7XG4gIGNvbnNvbGUubG9nKCcnKTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFN0YWNrIDY6IE9wZXJhdGlvbnNTdGFja++8iGZ1bGwvcHJvZHVjdGlvbu+8iVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbmxldCBvcGVyYXRpb25zU3RhY2s6IE9wZXJhdGlvbnNTdGFjayB8IHVuZGVmaW5lZDtcbmlmIChkZXBsb3lNb2RlID09PSAnZnVsbCcgfHwgZGVwbG95TW9kZSA9PT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIGNvbnNvbGUubG9nKCfwn5OKIDYvNjogT3BlcmF0aW9uc1N0YWNr5Yid5pyf5YyWLi4uJyk7XG4gIGNvbnN0IG9wZXJhdGlvbnNTdGFja05hbWUgPSBgJHtyZWdpb25QcmVmaXh9LSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LU9wZXJhdGlvbnNgO1xuICBvcGVyYXRpb25zU3RhY2sgPSBuZXcgT3BlcmF0aW9uc1N0YWNrKGFwcCwgb3BlcmF0aW9uc1N0YWNrTmFtZSwge1xuICAgIGVudixcbiAgICBjb25maWc6IHtcbiAgICAgIC4uLnRva3lvUHJvZHVjdGlvbkNvbmZpZyxcbiAgICAgIG1vbml0b3Jpbmc6IHRva3lvUHJvZHVjdGlvbkNvbmZpZy5tb25pdG9yaW5nIHx8IHtcbiAgICAgICAgY2xvdWR3YXRjaDogeyBlbmFibGVkOiB0cnVlIH0sXG4gICAgICAgIHNuczogeyBlbmFibGVkOiB0cnVlIH0sXG4gICAgICAgIGxvZ3M6IHsgcmV0ZW50aW9uRGF5czogNyB9XG4gICAgICB9XG4gICAgfSxcbiAgICBwcm9qZWN0TmFtZSxcbiAgICBlbnZpcm9ubWVudCxcbiAgICBzZWN1cml0eVN0YWNrLFxuICAgIGRhdGFTdGFjayxcbiAgICBlbWJlZGRpbmdTdGFjayxcbiAgICB3ZWJBcHBTdGFjayxcbiAgICBkZXNjcmlwdGlvbjogYFBlcm1pc3Npb24tYXdhcmUgUkFHIE9wZXJhdGlvbnMgU3RhY2sgKCR7ZGVwbG95TW9kZX0pYCxcbiAgICB0YWdzOiB7XG4gICAgICBQcm9qZWN0OiBwcm9qZWN0TmFtZSxcbiAgICAgIEVudmlyb25tZW50OiBlbnZpcm9ubWVudCxcbiAgICAgIFN0YWNrOiAnT3BlcmF0aW9ucycsXG4gICAgICBEZXBsb3lNb2RlOiBkZXBsb3lNb2RlLFxuICAgICAgTWFuYWdlZEJ5OiAnQ0RLJ1xuICAgIH1cbiAgfSk7XG4gIGNvbnNvbGUubG9nKCfinIUgT3BlcmF0aW9uc1N0YWNr5Yid5pyf5YyW5a6M5LqGJyk7XG4gIGNvbnNvbGUubG9nKCcnKTtcbn0gZWxzZSB7XG4gIGNvbnNvbGUubG9nKCfij63vuI8gIDYvNjogT3BlcmF0aW9uc1N0YWNrIOOCueOCreODg+ODl++8iG1pbmltYWzjg6Ljg7zjg4nvvIknKTtcbiAgY29uc29sZS5sb2coJycpO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g44OH44OX44Ot44Kk44K144Oe44Oq44O8XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbmNvbnNvbGUubG9nKCfinIUg5YWo44K544K/44OD44Kv5Yid5pyf5YyW5a6M5LqGJyk7XG5jb25zb2xlLmxvZygnPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PScpO1xuY29uc29sZS5sb2coYOODh+ODl+ODreOCpOODouODvOODiTogJHtkZXBsb3lNb2RlfWApO1xuY29uc29sZS5sb2coJycpO1xuY29uc29sZS5sb2coJ+WIneacn+WMluOBleOCjOOBn+OCueOCv+ODg+OCrzonKTtcbmNvbnNvbGUubG9nKCcgIOKchSBOZXR3b3JraW5nU3RhY2snKTtcbmlmIChzZWN1cml0eVN0YWNrKSBjb25zb2xlLmxvZygnICDinIUgU2VjdXJpdHlTdGFjaycpO1xuY29uc29sZS5sb2coJyAg4pyFIERhdGFTdGFjaycpO1xuaWYgKGVtYmVkZGluZ1N0YWNrKSBjb25zb2xlLmxvZygnICDinIUgRW1iZWRkaW5nU3RhY2snKTtcbmlmICh3ZWJBcHBTdGFjaykgY29uc29sZS5sb2coJyAg4pyFIFdlYkFwcFN0YWNrJyk7XG5pZiAob3BlcmF0aW9uc1N0YWNrKSBjb25zb2xlLmxvZygnICDinIUgT3BlcmF0aW9uc1N0YWNrJyk7XG5jb25zb2xlLmxvZygnJyk7XG5jb25zb2xlLmxvZygn44OH44OX44Ot44Kk44Kz44Oe44Oz44OJOicpO1xuY29uc29sZS5sb2coJyAgbnB4IGNkayBkZXBsb3kgLS1hbGwnKTtcbmNvbnNvbGUubG9nKCcnKTtcbmNvbnNvbGUubG9nKCfjg6Ljg7zjg4nliIfjgormm7/jgYg6Jyk7XG5jb25zb2xlLmxvZygnICBERVBMT1lfTU9ERT1taW5pbWFsIG5weCBjZGsgZGVwbG95IC0tYWxsJyk7XG5jb25zb2xlLmxvZygnICBERVBMT1lfTU9ERT1mdWxsIG5weCBjZGsgZGVwbG95IC0tYWxsJyk7XG5jb25zb2xlLmxvZygnICBERVBMT1lfTU9ERT1wcm9kdWN0aW9uIG5weCBjZGsgZGVwbG95IC0tYWxsJyk7XG5jb25zb2xlLmxvZygnPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PScpO1xuIl19