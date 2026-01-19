#!/usr/bin/env node
"use strict";
/**
 * SecurityStack個別デプロイスクリプト
 * GuardDuty修正後の再デプロイ用
 *
 * 注意: Windows AD EC2を作成する場合はVPCが必要です
 * VPCがない場合は、先にNetworkingStackをデプロイしてください
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
const security_stack_1 = require("../lib/stacks/integrated/security-stack");
const app = new cdk.App();
// 環境設定
const projectName = 'permission-aware-rag';
const environment = 'prod';
const region = 'ap-northeast-1';
const account = '178625946981';
// AgentCore設定をcdk.context.jsonから取得
const agentCoreConfig = app.node.tryGetContext('agentCore');
// VPC IDを環境変数またはコンテキストから取得
const vpcId = process.env.VPC_ID || app.node.tryGetContext('vpcId');
if (!vpcId) {
    console.warn('⚠️ VPC IDが指定されていません。Windows AD EC2は作成されません。');
    console.warn('   VPCを使用する場合は、環境変数VPC_IDまたはコンテキストvpcIdを設定してください。');
}
// 基本設定
const config = {
    project: {
        name: projectName
    },
    environment: environment,
    security: {
        enableGuardDuty: false, // GuardDutyは既存のDetectorを使用
        enableWaf: false,
        enableCloudTrail: false,
        enableConfig: false,
        kmsKeyRotation: true
    },
    agentCore: agentCoreConfig,
    // AD EC2インスタンスID（AgentCore Identity用）
    adEc2InstanceId: agentCoreConfig?.identity?.adEc2InstanceId,
    // VPC ID（SecurityStack内でインポート）
    vpcId: vpcId
};
// SecurityStackのみをデプロイ
new security_stack_1.SecurityStack(app, `TokyoRegion-${projectName}-${environment}-Security`, {
    config: config,
    projectName: projectName,
    environment: environment,
    vpcId: vpcId, // VPC IDを直接渡す
    env: {
        account: account,
        region: region
    },
    description: 'Security Stack - KMS, WAF, IAM, Windows AD, AgentCore Identity',
});
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95LXNlY3VyaXR5LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGVwbG95LXNlY3VyaXR5LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0E7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsdUNBQXFDO0FBQ3JDLGlEQUFtQztBQUVuQyw0RUFBd0U7QUFFeEUsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsT0FBTztBQUNQLE1BQU0sV0FBVyxHQUFHLHNCQUFzQixDQUFDO0FBQzNDLE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQztBQUMzQixNQUFNLE1BQU0sR0FBRyxnQkFBZ0IsQ0FBQztBQUNoQyxNQUFNLE9BQU8sR0FBRyxjQUFjLENBQUM7QUFFL0IsbUNBQW1DO0FBQ25DLE1BQU0sZUFBZSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBRTVELDJCQUEyQjtBQUMzQixNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUVwRSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDWCxPQUFPLENBQUMsSUFBSSxDQUFDLDZDQUE2QyxDQUFDLENBQUM7SUFDNUQsT0FBTyxDQUFDLElBQUksQ0FBQyxtREFBbUQsQ0FBQyxDQUFDO0FBQ3BFLENBQUM7QUFFRCxPQUFPO0FBQ1AsTUFBTSxNQUFNLEdBQUc7SUFDYixPQUFPLEVBQUU7UUFDUCxJQUFJLEVBQUUsV0FBVztLQUNsQjtJQUNELFdBQVcsRUFBRSxXQUFXO0lBQ3hCLFFBQVEsRUFBRTtRQUNSLGVBQWUsRUFBRSxLQUFLLEVBQUUsMkJBQTJCO1FBQ25ELFNBQVMsRUFBRSxLQUFLO1FBQ2hCLGdCQUFnQixFQUFFLEtBQUs7UUFDdkIsWUFBWSxFQUFFLEtBQUs7UUFDbkIsY0FBYyxFQUFFLElBQUk7S0FDckI7SUFDRCxTQUFTLEVBQUUsZUFBZTtJQUMxQixzQ0FBc0M7SUFDdEMsZUFBZSxFQUFFLGVBQWUsRUFBRSxRQUFRLEVBQUUsZUFBZTtJQUMzRCwrQkFBK0I7SUFDL0IsS0FBSyxFQUFFLEtBQUs7Q0FDYixDQUFDO0FBRUYsdUJBQXVCO0FBQ3ZCLElBQUksOEJBQWEsQ0FBQyxHQUFHLEVBQUUsZUFBZSxXQUFXLElBQUksV0FBVyxXQUFXLEVBQUU7SUFDM0UsTUFBTSxFQUFFLE1BQU07SUFDZCxXQUFXLEVBQUUsV0FBVztJQUN4QixXQUFXLEVBQUUsV0FBVztJQUN4QixLQUFLLEVBQUUsS0FBSyxFQUFFLGNBQWM7SUFDNUIsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLE9BQU87UUFDaEIsTUFBTSxFQUFFLE1BQU07S0FDZjtJQUNELFdBQVcsRUFBRSxnRUFBZ0U7Q0FDOUUsQ0FBQyxDQUFDO0FBRUgsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuLyoqXG4gKiBTZWN1cml0eVN0YWNr5YCL5Yil44OH44OX44Ot44Kk44K544Kv44Oq44OX44OIXG4gKiBHdWFyZER1dHnkv67mraPlvozjga7lho3jg4fjg5fjg63jgqTnlKhcbiAqIFxuICog5rOo5oSPOiBXaW5kb3dzIEFEIEVDMuOCkuS9nOaIkOOBmeOCi+WgtOWQiOOBr1ZQQ+OBjOW/heimgeOBp+OBmVxuICogVlBD44GM44Gq44GE5aC05ZCI44Gv44CB5YWI44GrTmV0d29ya2luZ1N0YWNr44KS44OH44OX44Ot44Kk44GX44Gm44GP44Gg44GV44GEXG4gKi9cblxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCB7IFNlY3VyaXR5U3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL2ludGVncmF0ZWQvc2VjdXJpdHktc3RhY2snO1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG4vLyDnkrDlooPoqK3lrppcbmNvbnN0IHByb2plY3ROYW1lID0gJ3Blcm1pc3Npb24tYXdhcmUtcmFnJztcbmNvbnN0IGVudmlyb25tZW50ID0gJ3Byb2QnO1xuY29uc3QgcmVnaW9uID0gJ2FwLW5vcnRoZWFzdC0xJztcbmNvbnN0IGFjY291bnQgPSAnMTc4NjI1OTQ2OTgxJztcblxuLy8gQWdlbnRDb3Jl6Kit5a6a44KSY2RrLmNvbnRleHQuanNvbuOBi+OCieWPluW+l1xuY29uc3QgYWdlbnRDb3JlQ29uZmlnID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnYWdlbnRDb3JlJyk7XG5cbi8vIFZQQyBJROOCkueSsOWig+WkieaVsOOBvuOBn+OBr+OCs+ODs+ODhuOCreOCueODiOOBi+OCieWPluW+l1xuY29uc3QgdnBjSWQgPSBwcm9jZXNzLmVudi5WUENfSUQgfHwgYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgndnBjSWQnKTtcblxuaWYgKCF2cGNJZCkge1xuICBjb25zb2xlLndhcm4oJ+KaoO+4jyBWUEMgSUTjgYzmjIflrprjgZXjgozjgabjgYTjgb7jgZvjgpPjgIJXaW5kb3dzIEFEIEVDMuOBr+S9nOaIkOOBleOCjOOBvuOBm+OCk+OAgicpO1xuICBjb25zb2xlLndhcm4oJyAgIFZQQ+OCkuS9v+eUqOOBmeOCi+WgtOWQiOOBr+OAgeeSsOWig+WkieaVsFZQQ19JROOBvuOBn+OBr+OCs+ODs+ODhuOCreOCueODiHZwY0lk44KS6Kit5a6a44GX44Gm44GP44Gg44GV44GE44CCJyk7XG59XG5cbi8vIOWfuuacrOioreWumlxuY29uc3QgY29uZmlnID0ge1xuICBwcm9qZWN0OiB7XG4gICAgbmFtZTogcHJvamVjdE5hbWVcbiAgfSxcbiAgZW52aXJvbm1lbnQ6IGVudmlyb25tZW50LFxuICBzZWN1cml0eToge1xuICAgIGVuYWJsZUd1YXJkRHV0eTogZmFsc2UsIC8vIEd1YXJkRHV0eeOBr+aXouWtmOOBrkRldGVjdG9y44KS5L2/55SoXG4gICAgZW5hYmxlV2FmOiBmYWxzZSxcbiAgICBlbmFibGVDbG91ZFRyYWlsOiBmYWxzZSxcbiAgICBlbmFibGVDb25maWc6IGZhbHNlLFxuICAgIGttc0tleVJvdGF0aW9uOiB0cnVlXG4gIH0sXG4gIGFnZW50Q29yZTogYWdlbnRDb3JlQ29uZmlnLFxuICAvLyBBRCBFQzLjgqTjg7Pjgrnjgr/jg7PjgrlJRO+8iEFnZW50Q29yZSBJZGVudGl0eeeUqO+8iVxuICBhZEVjMkluc3RhbmNlSWQ6IGFnZW50Q29yZUNvbmZpZz8uaWRlbnRpdHk/LmFkRWMySW5zdGFuY2VJZCxcbiAgLy8gVlBDIElE77yIU2VjdXJpdHlTdGFja+WGheOBp+OCpOODs+ODneODvOODiO+8iVxuICB2cGNJZDogdnBjSWRcbn07XG5cbi8vIFNlY3VyaXR5U3RhY2vjga7jgb/jgpLjg4fjg5fjg63jgqRcbm5ldyBTZWN1cml0eVN0YWNrKGFwcCwgYFRva3lvUmVnaW9uLSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LVNlY3VyaXR5YCwge1xuICBjb25maWc6IGNvbmZpZyxcbiAgcHJvamVjdE5hbWU6IHByb2plY3ROYW1lLFxuICBlbnZpcm9ubWVudDogZW52aXJvbm1lbnQsXG4gIHZwY0lkOiB2cGNJZCwgLy8gVlBDIElE44KS55u05o6l5rih44GZXG4gIGVudjoge1xuICAgIGFjY291bnQ6IGFjY291bnQsXG4gICAgcmVnaW9uOiByZWdpb25cbiAgfSxcbiAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBTdGFjayAtIEtNUywgV0FGLCBJQU0sIFdpbmRvd3MgQUQsIEFnZW50Q29yZSBJZGVudGl0eScsXG59KTtcblxuYXBwLnN5bnRoKCk7XG4iXX0=