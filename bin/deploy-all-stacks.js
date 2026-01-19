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
// imageTagの取得（優先順位: CDKコンテキスト > 環境変数）
let imageTag = app.node.tryGetContext('imageTag');
if (!imageTag) {
    imageTag = process.env.IMAGE_TAG;
    if (imageTag) {
        console.log(`ℹ️ imageTagを環境変数から取得: ${imageTag}`);
    }
}
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
        // 環境変数設定のみのデプロイのため、設定検証を無効化
        environmentResourceControl: {
            validateConfiguration: false,
        },
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95LWFsbC1zdGFja3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkZXBsb3ktYWxsLXN0YWNrcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsZ0dBQTJGO0FBQzNGLGdGQUE0RTtBQUM1RSw0RUFBd0U7QUFDeEUsb0VBQWdFO0FBQ2hFLDhFQUEwRTtBQUMxRSx3RUFBb0U7QUFDcEUsZ0ZBQTRFO0FBQzVFLGdHQUF5RjtBQUl6Rjs7Ozs7Ozs7OztHQVVHO0FBRUgsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsYUFBYTtBQUNiLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxJQUFJLE1BQU0sQ0FBQztBQUNyRCxNQUFNLFVBQVUsR0FBRyxDQUFDLFNBQVMsRUFBRSxNQUFNLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFFckQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztJQUNyQyxPQUFPLENBQUMsS0FBSyxDQUFDLDBCQUEwQixVQUFVLEVBQUUsQ0FBQyxDQUFDO0lBQ3RELE9BQU8sQ0FBQyxLQUFLLENBQUMsWUFBWSxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNuRCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2xCLENBQUM7QUFFRCxzQ0FBc0M7QUFDdEMsSUFBSSxRQUFRLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDbEQsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ2QsUUFBUSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDO0lBQ2pDLElBQUksUUFBUSxFQUFFLENBQUM7UUFDYixPQUFP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Q3hELE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDaEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUN6QixPQUFPLENBQUMsR0FBRyxDQUFDLHdCQUF3QixDQUFDLENBQUM7QUFDdEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNoQixPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ3hCLE9BQU8sQ0FBQyxHQUFHLENBQUMsNENBQTRDLENBQUMsQ0FBQztBQUMxRCxPQUFPLENBQUMsR0FBRyxDQUFDLHlDQUF5QyxDQUFDLENBQUM7QUFDdkQsT0FBTyxDQUFDLEdBQUcsQ0FBQywrQ0FBK0MsQ0FBQyxDQUFDO0FBQzdELE9BQU8sQ0FBQyxHQUFHLENBQUMsMENBQTBDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyB0b2t5b1Byb2R1Y3Rpb25Db25maWcgfSBmcm9tICcuLi9saWIvY29uZmlnL2Vudmlyb25tZW50cy90b2t5by1wcm9kdWN0aW9uLWNvbmZpZyc7XG5pbXBvcnQgeyBOZXR3b3JraW5nU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL2ludGVncmF0ZWQvbmV0d29ya2luZy1zdGFjayc7XG5pbXBvcnQgeyBTZWN1cml0eVN0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy9pbnRlZ3JhdGVkL3NlY3VyaXR5LXN0YWNrJztcbmltcG9ydCB7IERhdGFTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvaW50ZWdyYXRlZC9kYXRhLXN0YWNrJztcbmltcG9ydCB7IEVtYmVkZGluZ1N0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy9pbnRlZ3JhdGVkL2VtYmVkZGluZy1zdGFjayc7XG5pbXBvcnQgeyBXZWJBcHBTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvaW50ZWdyYXRlZC93ZWJhcHAtc3RhY2snO1xuaW1wb3J0IHsgT3BlcmF0aW9uc1N0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy9pbnRlZ3JhdGVkL29wZXJhdGlvbnMtc3RhY2snO1xuaW1wb3J0IHsgYWRhcHROZXR3b3JraW5nQ29uZmlnIH0gZnJvbSAnLi4vbGliL2NvbmZpZy9hZGFwdGVycy9uZXR3b3JraW5nLWNvbmZpZy1hZGFwdGVyJztcbmltcG9ydCB7IGFkYXB0U2VjdXJpdHlDb25maWcgfSBmcm9tICcuLi9saWIvY29uZmlnL2FkYXB0ZXJzL3NlY3VyaXR5LWNvbmZpZy1hZGFwdGVyJztcbmltcG9ydCB7IGFkYXB0V2ViQXBwQ29uZmlnIH0gZnJvbSAnLi4vbGliL2NvbmZpZy9hZGFwdGVycy93ZWJhcHAtY29uZmlnLWFkYXB0ZXInO1xuXG4vKipcbiAqIFBlcm1pc3Npb24tYXdhcmUgUkFHIHdpdGggRlN4IGZvciBOZXRBcHAgT05UQVBcbiAqIOe1seWQiOODh+ODl+ODreOCpOODoeODs+ODiOOCouODl+ODquOCseODvOOCt+ODp+ODs1xuICogXG4gKiDnkrDlooPlpInmlbBERVBMT1lfTU9EReOBp+WLleS9nOODouODvOODieOCkuWIh+OCiuabv+OBiDpcbiAqIC0gbWluaW1hbDogTmV0d29ya2luZ1N0YWNrICsgRGF0YVN0YWNrIOOBruOBv1xuICogLSBmdWxsOiDlhag244K544K/44OD44Kv77yI6ZaL55m644O744OG44K544OI55So77yJXG4gKiAtIHByb2R1Y3Rpb246IOWFqDbjgrnjgr/jg4Pjgq/vvIjmnKznlarnlKjjgIHov73liqDmpJzoqLzjgYLjgorvvIlcbiAqIFxuICog44OH44OV44Kp44Or44OIOiBmdWxsXG4gKi9cblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxuLy8g44OH44OX44Ot44Kk44Oi44O844OJ44Gu5Y+W5b6XXG5jb25zdCBkZXBsb3lNb2RlID0gcHJvY2Vzcy5lbnYuREVQTE9ZX01PREUgfHwgJ2Z1bGwnO1xuY29uc3QgdmFsaWRNb2RlcyA9IFsnbWluaW1hbCcsICdmdWxsJywgJ3Byb2R1Y3Rpb24nXTtcblxuaWYgKCF2YWxpZE1vZGVzLmluY2x1ZGVzKGRlcGxveU1vZGUpKSB7XG4gIGNvbnNvbGUuZXJyb3IoYOKdjCDjgqjjg6njg7w6IOeEoeWKueOBqkRFUExPWV9NT0RFOiAke2RlcGxveU1vZGV9YCk7XG4gIGNvbnNvbGUuZXJyb3IoYCAgIOacieWKueOBquWApDogJHt2YWxpZE1vZGVzLmpvaW4oJywgJyl9YCk7XG4gIHByb2Nlc3MuZXhpdCgxKTtcbn1cblxuLy8gaW1hZ2VUYWfjga7lj5blvpfvvIjlhKrlhYjpoIbkvY06IENES+OCs+ODs+ODhuOCreOCueODiCA+IOeSsOWig+WkieaVsO+8iVxubGV0IGltYWdlVGFnID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnaW1hZ2VUYWcnKTtcbmlmICghaW1hZ2VUYWcpIHtcbiAgaW1hZ2VUYWcgPSBwcm9jZXNzLmVudi5JTUFHRV9UQUc7XG4gIGlmIChpbWFnZVRhZykge1xuICAgIGNvbnNvbGUubG9nKGDihLnvuI8gaW1hZ2VUYWfjgpLnkrDlooPlpInmlbDjgYvjgonlj5blvpc6ICR7aW1hZ2VUYWd9YCk7XG4gIH1cbn1cblxuLy8g55Kw5aKD6Kit5a6aXG5jb25zdCBlbnYgPSB7XG4gIGFjY291bnQ6IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQgfHwgJzEyMzQ1Njc4OTAxMicsXG4gIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OIHx8ICdhcC1ub3J0aGVhc3QtMSdcbn07XG5cbmNvbnN0IHByb2plY3ROYW1lID0gdG9reW9Qcm9kdWN0aW9uQ29uZmlnLm5hbWluZy5wcm9qZWN0TmFtZTtcbmNvbnN0IGVudmlyb25tZW50ID0gdG9reW9Qcm9kdWN0aW9uQ29uZmlnLmVudmlyb25tZW50O1xuY29uc3QgcmVnaW9uUHJlZml4ID0gdG9reW9Qcm9kdWN0aW9uQ29uZmlnLm5hbWluZy5yZWdpb25QcmVmaXg7XG5cbmNvbnNvbGUubG9nKCfwn5qAIFBlcm1pc3Npb24tYXdhcmUgUkFHIOe1seWQiOODh+ODl+ODreOCpOODoeODs+ODiOWIneacn+WMli4uLicpO1xuY29uc29sZS5sb2coYCAgIOODh+ODl+ODreOCpOODouODvOODiTogJHtkZXBsb3lNb2RlfWApO1xuY29uc29sZS5sb2coYCAgIOODl+ODreOCuOOCp+OCr+ODiOWQjTogJHtwcm9qZWN0TmFtZX1gKTtcbmNvbnNvbGUubG9nKGAgICDnkrDlooM6ICR7ZW52aXJvbm1lbnR9YCk7XG5jb25zb2xlLmxvZyhgICAg44Oq44O844K444On44OzOiAke3Rva3lvUHJvZHVjdGlvbkNvbmZpZy5yZWdpb259YCk7XG5jb25zb2xlLmxvZyhgICAg44Ki44Kr44Km44Oz44OIOiAke2Vudi5hY2NvdW50fWApO1xuY29uc29sZS5sb2coJycpO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU3RhY2sgMTogTmV0d29ya2luZ1N0YWNr77yI5YWo44Oi44O844OJ5YWx6YCa77yJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuY29uc29sZS5sb2coJ/Cfk6EgMS82OiBOZXR3b3JraW5nU3RhY2vliJ3mnJ/ljJYuLi4nKTtcbmNvbnN0IG5ldHdvcmtpbmdTdGFja05hbWUgPSBgJHtyZWdpb25QcmVmaXh9LSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LU5ldHdvcmtpbmdgO1xuY29uc3QgbmV0d29ya2luZ0NvbmZpZyA9IGFkYXB0TmV0d29ya2luZ0NvbmZpZyh0b2t5b1Byb2R1Y3Rpb25Db25maWcpO1xuY29uc3QgbmV0d29ya2luZ1N0YWNrID0gbmV3IE5ldHdvcmtpbmdTdGFjayhhcHAsIG5ldHdvcmtpbmdTdGFja05hbWUsIHtcbiAgZW52LFxuICBjb25maWc6IG5ldHdvcmtpbmdDb25maWcsXG4gIHByb2plY3ROYW1lLFxuICBlbnZpcm9ubWVudDogZW52aXJvbm1lbnQgYXMgJ2RldicgfCAnc3RhZ2luZycgfCAncHJvZCcgfCAndGVzdCcsXG4gIGRlc2NyaXB0aW9uOiBgUGVybWlzc2lvbi1hd2FyZSBSQUcgTmV0d29ya2luZyBTdGFjayAoJHtkZXBsb3lNb2RlfSlgLFxuICB0YWdzOiB7XG4gICAgUHJvamVjdDogcHJvamVjdE5hbWUsXG4gICAgRW52aXJvbm1lbnQ6IGVudmlyb25tZW50LFxuICAgIFN0YWNrOiAnTmV0d29ya2luZycsXG4gICAgRGVwbG95TW9kZTogZGVwbG95TW9kZSxcbiAgICBNYW5hZ2VkQnk6ICdDREsnXG4gIH1cbn0pO1xuY29uc29sZS5sb2coJ+KchSBOZXR3b3JraW5nU3RhY2vliJ3mnJ/ljJblrozkuoYnKTtcbmNvbnNvbGUubG9nKCcnKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFN0YWNrIDI6IFNlY3VyaXR5U3RhY2vvvIhmdWxsL3Byb2R1Y3Rpb27vvIlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5sZXQgc2VjdXJpdHlTdGFjazogU2VjdXJpdHlTdGFjayB8IHVuZGVmaW5lZDtcbmlmIChkZXBsb3lNb2RlID09PSAnZnVsbCcgfHwgZGVwbG95TW9kZSA9PT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIGNvbnNvbGUubG9nKCfwn5SSIDIvNjogU2VjdXJpdHlTdGFja+WIneacn+WMli4uLicpO1xuICBjb25zdCBzZWN1cml0eVN0YWNrTmFtZSA9IGAke3JlZ2lvblByZWZpeH0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tU2VjdXJpdHlgO1xuICBzZWN1cml0eVN0YWNrID0gbmV3IFNlY3VyaXR5U3RhY2soYXBwLCBzZWN1cml0eVN0YWNrTmFtZSwge1xuICAgIGVudixcbiAgICBjb25maWc6IHRva3lvUHJvZHVjdGlvbkNvbmZpZyxcbiAgICBwcm9qZWN0TmFtZSxcbiAgICBlbnZpcm9ubWVudCxcbiAgICBkZXNjcmlwdGlvbjogYFBlcm1pc3Npb24tYXdhcmUgUkFHIFNlY3VyaXR5IFN0YWNrICgke2RlcGxveU1vZGV9KWAsXG4gICAgdGFnczoge1xuICAgICAgUHJvamVjdDogcHJvamVjdE5hbWUsXG4gICAgICBFbnZpcm9ubWVudDogZW52aXJvbm1lbnQsXG4gICAgICBTdGFjazogJ1NlY3VyaXR5JyxcbiAgICAgIERlcGxveU1vZGU6IGRlcGxveU1vZGUsXG4gICAgICBNYW5hZ2VkQnk6ICdDREsnXG4gICAgfVxuICB9KTtcbiAgY29uc29sZS5sb2coJ+KchSBTZWN1cml0eVN0YWNr5Yid5pyf5YyW5a6M5LqGJyk7XG4gIGNvbnNvbGUubG9nKCcnKTtcbn0gZWxzZSB7XG4gIGNvbnNvbGUubG9nKCfij63vuI8gIDIvNjogU2VjdXJpdHlTdGFjayDjgrnjgq3jg4Pjg5fvvIhtaW5pbWFs44Oi44O844OJ77yJJyk7XG4gIGNvbnNvbGUubG9nKCcnKTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFN0YWNrIDM6IERhdGFTdGFja++8iOWFqOODouODvOODieWFsemAmu+8iVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbmNvbnNvbGUubG9nKCfwn5K+IDMvNjogRGF0YVN0YWNr5Yid5pyf5YyWLi4uJyk7XG5jb25zdCBkYXRhU3RhY2tOYW1lID0gYCR7cmVnaW9uUHJlZml4fS0ke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1EYXRhYDtcbmNvbnN0IGRhdGFTdGFjayA9IG5ldyBEYXRhU3RhY2soYXBwLCBkYXRhU3RhY2tOYW1lLCB7XG4gIGVudixcbiAgY29uZmlnOiB7XG4gICAgc3RvcmFnZToge1xuICAgICAgczM6IHRva3lvUHJvZHVjdGlvbkNvbmZpZy5zdG9yYWdlLnMzLFxuICAgICAgZnN4OiB0b2t5b1Byb2R1Y3Rpb25Db25maWcuc3RvcmFnZS5mc3hPbnRhcCxcbiAgICAgIGZzeE9udGFwOiB0b2t5b1Byb2R1Y3Rpb25Db25maWcuc3RvcmFnZS5mc3hPbnRhcFxuICAgIH0gYXMgYW55LFxuICAgIGRhdGFiYXNlOiB0b2t5b1Byb2R1Y3Rpb25Db25maWcuZGF0YWJhc2UgYXMgYW55XG4gIH0sXG4gIHByb2plY3ROYW1lLFxuICBlbnZpcm9ubWVudCxcbiAgdnBjOiBuZXR3b3JraW5nU3RhY2sudnBjLFxuICBwcml2YXRlU3VibmV0SWRzOiBuZXR3b3JraW5nU3RhY2sudnBjLnByaXZhdGVTdWJuZXRzLm1hcCgoc3VibmV0OiBhbnkpID0+IHN1Ym5ldC5zdWJuZXRJZCksXG4gIHNlY3VyaXR5U3RhY2ssXG4gIGRlc2NyaXB0aW9uOiBgUGVybWlzc2lvbi1hd2FyZSBSQUcgRGF0YSBTdGFjayAoJHtkZXBsb3lNb2RlfSlgLFxuICB0YWdzOiB7XG4gICAgUHJvamVjdDogcHJvamVjdE5hbWUsXG4gICAgRW52aXJvbm1lbnQ6IGVudmlyb25tZW50LFxuICAgIFN0YWNrOiAnRGF0YScsXG4gICAgRGVwbG95TW9kZTogZGVwbG95TW9kZSxcbiAgICBNYW5hZ2VkQnk6ICdDREsnXG4gIH1cbn0pO1xuY29uc29sZS5sb2coJ+KchSBEYXRhU3RhY2vliJ3mnJ/ljJblrozkuoYnKTtcbmNvbnNvbGUubG9nKCcnKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFN0YWNrIDQ6IEVtYmVkZGluZ1N0YWNr77yIZnVsbC9wcm9kdWN0aW9u77yJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxubGV0IGVtYmVkZGluZ1N0YWNrOiBFbWJlZGRpbmdTdGFjayB8IHVuZGVmaW5lZDtcbmlmIChkZXBsb3lNb2RlID09PSAnZnVsbCcgfHwgZGVwbG95TW9kZSA9PT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIGNvbnNvbGUubG9nKCfwn6SWIDQvNjogRW1iZWRkaW5nU3RhY2vliJ3mnJ/ljJYuLi4nKTtcbiAgY29uc3QgZW1iZWRkaW5nU3RhY2tOYW1lID0gYCR7cmVnaW9uUHJlZml4fS0ke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1FbWJlZGRpbmdgO1xuICBlbWJlZGRpbmdTdGFjayA9IG5ldyBFbWJlZGRpbmdTdGFjayhhcHAsIGVtYmVkZGluZ1N0YWNrTmFtZSwge1xuICAgIGVudixcbiAgICBjb25maWc6IHtcbiAgICAgIGFpOiB0b2t5b1Byb2R1Y3Rpb25Db25maWcuYWlcbiAgICB9LFxuICAgIHByb2plY3ROYW1lLFxuICAgIGVudmlyb25tZW50LFxuICAgIHZwYzogbmV0d29ya2luZ1N0YWNrLnZwYyxcbiAgICBwcml2YXRlU3VibmV0SWRzOiBuZXR3b3JraW5nU3RhY2sudnBjLnByaXZhdGVTdWJuZXRzLm1hcCgoc3VibmV0OiBhbnkpID0+IHN1Ym5ldC5zdWJuZXRJZCksXG4gICAgcHVibGljU3VibmV0SWRzOiBuZXR3b3JraW5nU3RhY2sudnBjLnB1YmxpY1N1Ym5ldHMubWFwKChzdWJuZXQ6IGFueSkgPT4gc3VibmV0LnN1Ym5ldElkKSxcbiAgICBzM0J1Y2tldE5hbWVzOiBkYXRhU3RhY2suczNCdWNrZXROYW1lcyxcbiAgICAvLyBBV1MgQmF0Y2gvRUNTL1Nwb3QgRmxlZXTmnInlirnljJZcbiAgICBlbmFibGVCYXRjaEludGVncmF0aW9uOiB0b2t5b1Byb2R1Y3Rpb25Db25maWcuZW1iZWRkaW5nPy5iYXRjaD8uZW5hYmxlZCB8fCBmYWxzZSxcbiAgICBlbWJlZGRpbmdDb25maWc6IHRva3lvUHJvZHVjdGlvbkNvbmZpZy5lbWJlZGRpbmcgYXMgYW55LFxuICAgIGRlc2NyaXB0aW9uOiBgUGVybWlzc2lvbi1hd2FyZSBSQUcgRW1iZWRkaW5nIFN0YWNrICgke2RlcGxveU1vZGV9KWAsXG4gICAgdGFnczoge1xuICAgICAgUHJvamVjdDogcHJvamVjdE5hbWUsXG4gICAgICBFbnZpcm9ubWVudDogZW52aXJvbm1lbnQsXG4gICAgICBTdGFjazogJ0VtYmVkZGluZycsXG4gICAgICBEZXBsb3lNb2RlOiBkZXBsb3lNb2RlLFxuICAgICAgTWFuYWdlZEJ5OiAnQ0RLJ1xuICAgIH1cbiAgfSk7XG4gIGNvbnNvbGUubG9nKCfinIUgRW1iZWRkaW5nU3RhY2vliJ3mnJ/ljJblrozkuoYnKTtcbiAgY29uc29sZS5sb2coJycpO1xufSBlbHNlIHtcbiAgY29uc29sZS5sb2coJ+KPre+4jyAgNC82OiBFbWJlZGRpbmdTdGFjayDjgrnjgq3jg4Pjg5fvvIhtaW5pbWFs44Oi44O844OJ77yJJyk7XG4gIGNvbnNvbGUubG9nKCcnKTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFN0YWNrIDU6IFdlYkFwcFN0YWNr77yIZnVsbC9wcm9kdWN0aW9u77yJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxubGV0IHdlYkFwcFN0YWNrOiBXZWJBcHBTdGFjayB8IHVuZGVmaW5lZDtcbmlmIChkZXBsb3lNb2RlID09PSAnZnVsbCcgfHwgZGVwbG95TW9kZSA9PT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIGNvbnNvbGUubG9nKCfwn4yQIDUvNjogV2ViQXBwU3RhY2vliJ3mnJ/ljJYuLi4nKTtcbiAgY29uc3Qgd2ViQXBwU3RhY2tOYW1lID0gYCR7cmVnaW9uUHJlZml4fS0ke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1XZWJBcHBgO1xuICBjb25zdCB3ZWJBcHBTdGFjayA9IG5ldyBXZWJBcHBTdGFjayhhcHAsIHdlYkFwcFN0YWNrTmFtZSwge1xuICAgIGVudixcbiAgICBjb25maWc6IHRva3lvUHJvZHVjdGlvbkNvbmZpZyBhcyBhbnksIC8vIEVudmlyb25tZW50Q29uZmln44Go44Gu5LqS5o+b5oCn44Gu44Gf44KBXG4gICAgcHJvamVjdE5hbWUsXG4gICAgZW52aXJvbm1lbnQsXG4gICAgbmV0d29ya2luZ1N0YWNrLFxuICAgIHNlY3VyaXR5U3RhY2ssXG4gICAgaW1hZ2VUYWcsIC8vIENES+OCs+ODs+ODhuOCreOCueODiOOBi+OCieWPluW+l+OBl+OBn2ltYWdlVGFn44KS5rih44GZXG4gICAgZGVzY3JpcHRpb246IGBQZXJtaXNzaW9uLWF3YXJlIFJBRyBXZWJBcHAgU3RhY2sgKCR7ZGVwbG95TW9kZX0pYCxcbiAgICAvLyDnkrDlooPlpInmlbDoqK3lrprjga7jgb/jga7jg4fjg5fjg63jgqTjga7jgZ/jgoHjgIHoqK3lrprmpJzoqLzjgpLnhKHlirnljJZcbiAgICBlbnZpcm9ubWVudFJlc291cmNlQ29udHJvbDoge1xuICAgICAgdmFsaWRhdGVDb25maWd1cmF0aW9uOiBmYWxzZSxcbiAgICB9LFxuICAgIHRhZ3M6IHtcbiAgICAgIFByb2plY3Q6IHByb2plY3ROYW1lLFxuICAgICAgRW52aXJvbm1lbnQ6IGVudmlyb25tZW50LFxuICAgICAgU3RhY2s6ICdXZWJBcHAnLFxuICAgICAgRGVwbG95TW9kZTogZGVwbG95TW9kZSxcbiAgICAgIE1hbmFnZWRCeTogJ0NESydcbiAgICB9XG4gIH0pO1xuICBjb25zb2xlLmxvZygn4pyFIFdlYkFwcFN0YWNr5Yid5pyf5YyW5a6M5LqGJyk7XG4gIGNvbnNvbGUubG9nKCcnKTtcbn0gZWxzZSB7XG4gIGNvbnNvbGUubG9nKCfij63vuI8gIDUvNjogV2ViQXBwU3RhY2sg44K544Kt44OD44OX77yIbWluaW1hbOODouODvOODie+8iScpO1xuICBjb25zb2xlLmxvZygnJyk7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTdGFjayA2OiBPcGVyYXRpb25zU3RhY2vvvIhmdWxsL3Byb2R1Y3Rpb27vvIlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5sZXQgb3BlcmF0aW9uc1N0YWNrOiBPcGVyYXRpb25zU3RhY2sgfCB1bmRlZmluZWQ7XG5pZiAoZGVwbG95TW9kZSA9PT0gJ2Z1bGwnIHx8IGRlcGxveU1vZGUgPT09ICdwcm9kdWN0aW9uJykge1xuICBjb25zb2xlLmxvZygn8J+TiiA2LzY6IE9wZXJhdGlvbnNTdGFja+WIneacn+WMli4uLicpO1xuICBjb25zdCBvcGVyYXRpb25zU3RhY2tOYW1lID0gYCR7cmVnaW9uUHJlZml4fS0ke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1PcGVyYXRpb25zYDtcbiAgb3BlcmF0aW9uc1N0YWNrID0gbmV3IE9wZXJhdGlvbnNTdGFjayhhcHAsIG9wZXJhdGlvbnNTdGFja05hbWUsIHtcbiAgICBlbnYsXG4gICAgY29uZmlnOiB7XG4gICAgICAuLi50b2t5b1Byb2R1Y3Rpb25Db25maWcsXG4gICAgICBtb25pdG9yaW5nOiB0b2t5b1Byb2R1Y3Rpb25Db25maWcubW9uaXRvcmluZyB8fCB7XG4gICAgICAgIGNsb3Vkd2F0Y2g6IHsgZW5hYmxlZDogdHJ1ZSB9LFxuICAgICAgICBzbnM6IHsgZW5hYmxlZDogdHJ1ZSB9LFxuICAgICAgICBsb2dzOiB7IHJldGVudGlvbkRheXM6IDcgfVxuICAgICAgfVxuICAgIH0sXG4gICAgcHJvamVjdE5hbWUsXG4gICAgZW52aXJvbm1lbnQsXG4gICAgc2VjdXJpdHlTdGFjayxcbiAgICBkYXRhU3RhY2ssXG4gICAgZW1iZWRkaW5nU3RhY2ssXG4gICAgd2ViQXBwU3RhY2ssXG4gICAgZGVzY3JpcHRpb246IGBQZXJtaXNzaW9uLWF3YXJlIFJBRyBPcGVyYXRpb25zIFN0YWNrICgke2RlcGxveU1vZGV9KWAsXG4gICAgdGFnczoge1xuICAgICAgUHJvamVjdDogcHJvamVjdE5hbWUsXG4gICAgICBFbnZpcm9ubWVudDogZW52aXJvbm1lbnQsXG4gICAgICBTdGFjazogJ09wZXJhdGlvbnMnLFxuICAgICAgRGVwbG95TW9kZTogZGVwbG95TW9kZSxcbiAgICAgIE1hbmFnZWRCeTogJ0NESydcbiAgICB9XG4gIH0pO1xuICBjb25zb2xlLmxvZygn4pyFIE9wZXJhdGlvbnNTdGFja+WIneacn+WMluWujOS6hicpO1xuICBjb25zb2xlLmxvZygnJyk7XG59IGVsc2Uge1xuICBjb25zb2xlLmxvZygn4o+t77iPICA2LzY6IE9wZXJhdGlvbnNTdGFjayDjgrnjgq3jg4Pjg5fvvIhtaW5pbWFs44Oi44O844OJ77yJJyk7XG4gIGNvbnNvbGUubG9nKCcnKTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOODh+ODl+ODreOCpOOCteODnuODquODvFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbmNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG5jb25zb2xlLmxvZygn4pyFIOWFqOOCueOCv+ODg+OCr+WIneacn+WMluWujOS6hicpO1xuY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbmNvbnNvbGUubG9nKGDjg4fjg5fjg63jgqTjg6Ljg7zjg4k6ICR7ZGVwbG95TW9kZX1gKTtcbmNvbnNvbGUubG9nKCcnKTtcbmNvbnNvbGUubG9nKCfliJ3mnJ/ljJbjgZXjgozjgZ/jgrnjgr/jg4Pjgq86Jyk7XG5jb25zb2xlLmxvZygnICDinIUgTmV0d29ya2luZ1N0YWNrJyk7XG5pZiAoc2VjdXJpdHlTdGFjaykgY29uc29sZS5sb2coJyAg4pyFIFNlY3VyaXR5U3RhY2snKTtcbmNvbnNvbGUubG9nKCcgIOKchSBEYXRhU3RhY2snKTtcbmlmIChlbWJlZGRpbmdTdGFjaykgY29uc29sZS5sb2coJyAg4pyFIEVtYmVkZGluZ1N0YWNrJyk7XG5pZiAod2ViQXBwU3RhY2spIGNvbnNvbGUubG9nKCcgIOKchSBXZWJBcHBTdGFjaycpO1xuaWYgKG9wZXJhdGlvbnNTdGFjaykgY29uc29sZS5sb2coJyAg4pyFIE9wZXJhdGlvbnNTdGFjaycpO1xuY29uc29sZS5sb2coJycpO1xuY29uc29sZS5sb2coJ+ODh+ODl+ODreOCpOOCs+ODnuODs+ODiTonKTtcbmNvbnNvbGUubG9nKCcgIG5weCBjZGsgZGVwbG95IC0tYWxsJyk7XG5jb25zb2xlLmxvZygnJyk7XG5jb25zb2xlLmxvZygn44Oi44O844OJ5YiH44KK5pu/44GIOicpO1xuY29uc29sZS5sb2coJyAgREVQTE9ZX01PREU9bWluaW1hbCBucHggY2RrIGRlcGxveSAtLWFsbCcpO1xuY29uc29sZS5sb2coJyAgREVQTE9ZX01PREU9ZnVsbCBucHggY2RrIGRlcGxveSAtLWFsbCcpO1xuY29uc29sZS5sb2coJyAgREVQTE9ZX01PREU9cHJvZHVjdGlvbiBucHggY2RrIGRlcGxveSAtLWFsbCcpO1xuY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbiJdfQ==