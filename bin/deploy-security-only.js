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
const security_stack_1 = require("../lib/stacks/integrated/security-stack");
const tagging_config_1 = require("../lib/config/tagging-config");
const app = new cdk.App();
// 環境設定
const projectName = app.node.tryGetContext('projectName') || 'permission-aware-rag';
const environment = app.node.tryGetContext('environment') || 'prod';
const region = process.env.CDK_DEFAULT_REGION || 'ap-northeast-1';
const account = process.env.CDK_DEFAULT_ACCOUNT || '178625946981';
// VPC ID取得
const vpcId = process.env.VPC_ID || app.node.tryGetContext('vpcId');
// AgentCore設定取得
const agentCoreConfig = app.node.tryGetContext('agentCore');
console.log('🚀 SecurityStack デプロイ設定:');
console.log(`   プロジェクト名: ${projectName}`);
console.log(`   環境: ${environment}`);
console.log(`   リージョン: ${region}`);
console.log(`   アカウント: ${account}`);
console.log(`   VPC ID: ${vpcId || '未指定'}`);
console.log(`   AgentCore有効: ${agentCoreConfig?.enabled ? 'Yes' : 'No'}`);
// タグ設定取得
const taggingConfig = tagging_config_1.PermissionAwareRAGTags.getStandardConfig(projectName, environment);
const tags = tagging_config_1.TaggingStrategy.generateCostAllocationTags(taggingConfig);
// SecurityStack作成
const securityStack = new security_stack_1.SecurityStack(app, `TokyoRegion-${projectName}-${environment}-SecurityStack`, {
    env: {
        account,
        region,
    },
    projectName,
    environment,
    vpcId,
    agentCore: agentCoreConfig,
    config: {
        vpcId,
        project: {
            name: projectName,
        },
        environment,
        security: {
            kms: {
                enableKeyRotation: true,
                removalPolicy: cdk.RemovalPolicy.RETAIN,
            },
            waf: {
                enabled: false, // WAFは無効化（CloudFrontで使用）
            },
            guardDuty: {
                enabled: false,
            },
            cloudTrail: {
                enabled: false,
            },
        },
    },
});
// タグ適用
Object.entries(tags).forEach(([key, value]) => {
    cdk.Tags.of(securityStack).add(key, String(value));
});
console.log('✅ SecurityStack初期化完了');
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95LXNlY3VyaXR5LW9ubHkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkZXBsb3ktc2VjdXJpdHktb25seS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsNEVBQXdFO0FBQ3hFLGlFQUF1RjtBQUV2RixNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixPQUFPO0FBQ1AsTUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLElBQUksc0JBQXNCLENBQUM7QUFDcEYsTUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLElBQUksTUFBTSxDQUFDO0FBQ3BFLE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLElBQUksZ0JBQWdCLENBQUM7QUFDbEUsTUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsSUFBSSxjQUFjLENBQUM7QUFFbEUsV0FBVztBQUNYLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBRXBFLGdCQUFnQjtBQUNoQixNQUFNLGVBQWUsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUU1RCxPQUFPLENBQUMsR0FBRyxDQUFDLDBCQUEwQixDQUFDLENBQUM7QUFDeEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLFdBQVcsRUFBRSxDQUFDLENBQUM7QUFDMUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLFdBQVcsRUFBRSxDQUFDLENBQUM7QUFDckMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFDbkMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDcEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEtBQUssSUFBSSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0FBQzVDLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLGVBQWUsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUUxRSxTQUFTO0FBQ1QsTUFBTSxhQUFhLEdBQUcsdUNBQXNCLENBQUMsaUJBQWlCLENBQUMsV0FBVyxFQUFFLFdBQWtCLENBQUMsQ0FBQztBQUNoRyxNQUFNLElBQUksR0FBRyxnQ0FBZSxDQUFDLDBCQUEwQixDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBRXZFLGtCQUFrQjtBQUNsQixNQUFNLGFBQWEsR0FBRyxJQUFJLDhCQUFhLENBQUMsR0FBRyxFQUFFLGVBQWUsV0FBVyxJQUFJLFdBQVcsZ0JBQWdCLEVBQUU7SUFDdEcsR0FBRyxFQUFFO1FBQ0gsT0FBTztRQUNQLE1BQU07S0FDUDtJQUNELFdBQVc7SUFDWCxXQUFXO0lBQ1gsS0FBSztJQUNMLFNBQVMsRUFBRSxlQUFlO0lBQzFCLE1BQU0sRUFBRTtRQUNOLEtBQUs7UUFDTCxPQUFPLEVBQUU7WUFDUCxJQUFJLEVBQUUsV0FBVztTQUNsQjtRQUNELFdBQVc7UUFDWCxRQUFRLEVBQUU7WUFDUixHQUFHLEVBQUU7Z0JBQ0gsaUJBQWlCLEVBQUUsSUFBSTtnQkFDdkIsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUN4QztZQUNELEdBQUcsRUFBRTtnQkFDSCxPQUFPLEVBQUUsS0FBSyxFQUFFLHlCQUF5QjthQUMxQztZQUNELFNBQVMsRUFBRTtnQkFDVCxPQUFPLEVBQUUsS0FBSzthQUNmO1lBQ0QsVUFBVSxFQUFFO2dCQUNWLE9BQU8sRUFBRSxLQUFLO2FBQ2Y7U0FDRjtLQUNGO0NBQ0YsQ0FBQyxDQUFDO0FBRUgsT0FBTztBQUNQLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRTtJQUM1QyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ3JELENBQUMsQ0FBQyxDQUFDO0FBRUgsT0FBTyxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0FBRXBDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBTZWN1cml0eVN0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy9pbnRlZ3JhdGVkL3NlY3VyaXR5LXN0YWNrJztcbmltcG9ydCB7IFBlcm1pc3Npb25Bd2FyZVJBR1RhZ3MsIFRhZ2dpbmdTdHJhdGVneSB9IGZyb20gJy4uL2xpYi9jb25maWcvdGFnZ2luZy1jb25maWcnO1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG4vLyDnkrDlooPoqK3lrppcbmNvbnN0IHByb2plY3ROYW1lID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgncHJvamVjdE5hbWUnKSB8fCAncGVybWlzc2lvbi1hd2FyZS1yYWcnO1xuY29uc3QgZW52aXJvbm1lbnQgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdlbnZpcm9ubWVudCcpIHx8ICdwcm9kJztcbmNvbnN0IHJlZ2lvbiA9IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCAnYXAtbm9ydGhlYXN0LTEnO1xuY29uc3QgYWNjb3VudCA9IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQgfHwgJzE3ODYyNTk0Njk4MSc7XG5cbi8vIFZQQyBJROWPluW+l1xuY29uc3QgdnBjSWQgPSBwcm9jZXNzLmVudi5WUENfSUQgfHwgYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgndnBjSWQnKTtcblxuLy8gQWdlbnRDb3Jl6Kit5a6a5Y+W5b6XXG5jb25zdCBhZ2VudENvcmVDb25maWcgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdhZ2VudENvcmUnKTtcblxuY29uc29sZS5sb2coJ/CfmoAgU2VjdXJpdHlTdGFjayDjg4fjg5fjg63jgqToqK3lrpo6Jyk7XG5jb25zb2xlLmxvZyhgICAg44OX44Ot44K444Kn44Kv44OI5ZCNOiAke3Byb2plY3ROYW1lfWApO1xuY29uc29sZS5sb2coYCAgIOeSsOWigzogJHtlbnZpcm9ubWVudH1gKTtcbmNvbnNvbGUubG9nKGAgICDjg6rjg7zjgrjjg6fjg7M6ICR7cmVnaW9ufWApO1xuY29uc29sZS5sb2coYCAgIOOCouOCq+OCpuODs+ODiDogJHthY2NvdW50fWApO1xuY29uc29sZS5sb2coYCAgIFZQQyBJRDogJHt2cGNJZCB8fCAn5pyq5oyH5a6aJ31gKTtcbmNvbnNvbGUubG9nKGAgICBBZ2VudENvcmXmnInlirk6ICR7YWdlbnRDb3JlQ29uZmlnPy5lbmFibGVkID8gJ1llcycgOiAnTm8nfWApO1xuXG4vLyDjgr/jgrDoqK3lrprlj5blvpdcbmNvbnN0IHRhZ2dpbmdDb25maWcgPSBQZXJtaXNzaW9uQXdhcmVSQUdUYWdzLmdldFN0YW5kYXJkQ29uZmlnKHByb2plY3ROYW1lLCBlbnZpcm9ubWVudCBhcyBhbnkpO1xuY29uc3QgdGFncyA9IFRhZ2dpbmdTdHJhdGVneS5nZW5lcmF0ZUNvc3RBbGxvY2F0aW9uVGFncyh0YWdnaW5nQ29uZmlnKTtcblxuLy8gU2VjdXJpdHlTdGFja+S9nOaIkFxuY29uc3Qgc2VjdXJpdHlTdGFjayA9IG5ldyBTZWN1cml0eVN0YWNrKGFwcCwgYFRva3lvUmVnaW9uLSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LVNlY3VyaXR5U3RhY2tgLCB7XG4gIGVudjoge1xuICAgIGFjY291bnQsXG4gICAgcmVnaW9uLFxuICB9LFxuICBwcm9qZWN0TmFtZSxcbiAgZW52aXJvbm1lbnQsXG4gIHZwY0lkLFxuICBhZ2VudENvcmU6IGFnZW50Q29yZUNvbmZpZyxcbiAgY29uZmlnOiB7XG4gICAgdnBjSWQsXG4gICAgcHJvamVjdDoge1xuICAgICAgbmFtZTogcHJvamVjdE5hbWUsXG4gICAgfSxcbiAgICBlbnZpcm9ubWVudCxcbiAgICBzZWN1cml0eToge1xuICAgICAga21zOiB7XG4gICAgICAgIGVuYWJsZUtleVJvdGF0aW9uOiB0cnVlLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICB9LFxuICAgICAgd2FmOiB7XG4gICAgICAgIGVuYWJsZWQ6IGZhbHNlLCAvLyBXQUbjga/nhKHlirnljJbvvIhDbG91ZEZyb25044Gn5L2/55So77yJXG4gICAgICB9LFxuICAgICAgZ3VhcmREdXR5OiB7XG4gICAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIGNsb3VkVHJhaWw6IHtcbiAgICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG59KTtcblxuLy8g44K/44Kw6YGp55SoXG5PYmplY3QuZW50cmllcyh0YWdzKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgY2RrLlRhZ3Mub2Yoc2VjdXJpdHlTdGFjaykuYWRkKGtleSwgU3RyaW5nKHZhbHVlKSk7XG59KTtcblxuY29uc29sZS5sb2coJ+KchSBTZWN1cml0eVN0YWNr5Yid5pyf5YyW5a6M5LqGJyk7XG5cbmFwcC5zeW50aCgpO1xuIl19