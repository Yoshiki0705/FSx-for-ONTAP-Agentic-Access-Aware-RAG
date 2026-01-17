#!/usr/bin/env node
"use strict";
/**
 * WebAppStack + Permission API統合デプロイメント
 *
 * 機能:
 * - DataStack: DynamoDBテーブル作成
 * - WebAppStack: Next.js WebApp + Permission API統合
 *
 * 使用方法:
 * npx cdk deploy --all --app "npx ts-node bin/deploy-webapp-with-permission-api.ts"
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
const data_stack_1 = require("../lib/stacks/integrated/data-stack");
const webapp_stack_1 = require("../lib/stacks/integrated/webapp-stack");
// 東京リージョン設定をインポート
const tokyo_production_config_1 = require("../lib/config/environments/tokyo-production-config");
const app = new cdk.App();
// imageTagの取得（CDKコンテキストから）
const imageTag = app.node.tryGetContext('imageTag');
// 環境設定
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'ap-northeast-1', // 東京リージョン
};
console.log('========================================');
console.log('🚀 WebApp + Permission API統合デプロイ開始');
console.log('========================================');
console.log(`アカウント: ${env.account}`);
console.log(`リージョン: ${env.region}`);
console.log('');
// 1. DataStack - DynamoDB + OpenSearch + S3 + FSx for ONTAP（README.md準拠）
console.log('📦 Step 1: DataStack作成中...');
// README.md準拠の完全なDataStack設定
const dataStack = new data_stack_1.DataStack(app, 'TokyoRegion-PermissionAwareRAG-DataStack', {
    env,
    config: {
        storage: tokyo_production_config_1.tokyoProductionConfig.storage,
        database: tokyo_production_config_1.tokyoProductionConfig.database,
    },
    projectName: 'permission-aware-rag',
    environment: 'prod',
    description: 'Data Stack - DynamoDB + OpenSearch + FSx for ONTAP (README.md compliant)',
});
console.log('✅ DataStack作成完了');
console.log('');
// 2. WebAppStack - Next.js WebApp + Permission API統合
console.log('📦 Step 2: WebAppStack作成中...');
// Permission API設定を追加
const webAppConfig = {
    ...tokyo_production_config_1.tokyoProductionConfig,
    permissionApi: {
        enabled: false, // 一時的に無効化（Phase 11 E2Eテスト用にDataStackのみデプロイ）
        ontapManagementLif: process.env.ONTAP_MANAGEMENT_LIF || '',
        ssmParameterPrefix: '/fsx-ontap',
    },
};
const webAppStack = new webapp_stack_1.WebAppStack(app, 'TokyoRegion-PermissionAwareRAG-WebAppStack', {
    env,
    config: webAppConfig,
    projectName: 'permission-aware-rag',
    environment: 'prod',
    standaloneMode: true, // スタンドアローンモード
    skipLambdaCreation: false, // Lambda関数を作成
    dockerPath: './docker/nextjs',
    imageTag, // CDKコンテキストから取得したimageTagを渡す
    // DataStackからDynamoDBテーブルを参照
    userAccessTable: dataStack.userAccessTable,
    permissionCacheTable: dataStack.permissionCacheTable,
    description: 'WebApp Stack - Next.js + Permission API Integration',
});
// 依存関係の設定
webAppStack.addDependency(dataStack);
console.log('✅ WebAppStack作成完了');
console.log('');
console.log('========================================');
console.log('✅ 統合デプロイ設定完了');
console.log('========================================');
console.log('');
console.log('📋 デプロイされるスタック:');
console.log('  1. TokyoRegion-PermissionAwareRAG-DataStack');
console.log('  2. TokyoRegion-PermissionAwareRAG-WebAppStack');
console.log('');
console.log('🚀 デプロイコマンド:');
console.log('  npx cdk deploy --all --app "npx ts-node bin/deploy-webapp-with-permission-api.ts"');
console.log('');
console.log('⚠️  注意事項:');
console.log('  - ONTAP_MANAGEMENT_LIF環境変数を設定してください');
console.log('  - ECRにNext.jsイメージをプッシュしてください');
console.log('  - SSMパラメータ(/fsx-ontap/*)を設定してください');
console.log('========================================');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95LXdlYmFwcC13aXRoLXBlcm1pc3Npb24tYXBpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGVwbG95LXdlYmFwcC13aXRoLXBlcm1pc3Npb24tYXBpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0E7Ozs7Ozs7OztHQVNHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsdUNBQXFDO0FBQ3JDLGlEQUFtQztBQUNuQyxvRUFBZ0U7QUFDaEUsd0VBQW9FO0FBRXBFLGtCQUFrQjtBQUNsQixnR0FBMkY7QUFFM0YsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsMkJBQTJCO0FBQzNCLE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBRXBELE9BQU87QUFDUCxNQUFNLEdBQUcsR0FBRztJQUNWLE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtJQUN4QyxNQUFNLEVBQUUsZ0JBQWdCLEVBQUUsVUFBVTtDQUNyQyxDQUFDO0FBRUYsT0FBTyxDQUFDLEdBQUcsQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO0FBQ3hELE9BQU8sQ0FBQyxHQUFHLENBQUMsb0NBQW9DLENBQUMsQ0FBQztBQUNsRCxPQUFPLENBQUMsR0FBRyxDQUFDLDBDQUEwQyxDQUFDLENBQUM7QUFDeEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO0FBQ3JDLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztBQUNwQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBRWhCLHlFQUF5RTtBQUN6RSxPQUFPLENBQUMsR0FBRyxDQUFDLDRCQUE0QixDQUFDLENBQUM7QUFFMUMsNkJBQTZCO0FBQzdCLE1BQU0sU0FBUyxHQUFHLElBQUksc0JBQVMsQ0FBQyxHQUFHLEVBQUUsMENBQTBDLEVBQUU7SUFDL0UsR0FBRztJQUNILE1BQU0sRUFBRTtRQUNOLE9BQU8sRUFBRSwrQ0FBcUIsQ0FBQyxPQUFjO1FBQzdDLFFBQVEsRUFBRSwrQ0FBcUIsQ0FBQyxRQUFlO0tBQ2hEO0lBQ0QsV0FBVyxFQUFFLHNCQUFzQjtJQUNuQyxXQUFXLEVBQUUsTUFBTTtJQUNuQixXQUFXLEVBQUUsMEVBQTBFO0NBQ3hGLENBQUMsQ0FBQztBQUVILE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUMvQixPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBRWhCLHFEQUFxRDtBQUNyRCxPQUFPLENBQUMsR0FBRyxDQUFDLDhCQUE4QixDQUFDLENBQUM7QUFFNUMsc0JBQXNCO0FBQ3RCLE1BQU0sWUFBWSxHQUFRO0lBQ3hCLEdBQUcsK0NBQXFCO0lBQ3hCLGFBQWEsRUFBRTtRQUNiLE9BQU8sRUFBRSxLQUFLLEVBQUUsNENBQTRDO1FBQzVELGtCQUFrQixFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLElBQUksRUFBRTtRQUMxRCxrQkFBa0IsRUFBRSxZQUFZO0tBQ2pDO0NBQ0YsQ0FBQztBQUVGLE1BQU0sV0FBVyxHQUFHLElBQUksMEJBQVcsQ0FBQyxHQUFHLEVBQUUsNENBQTRDLEVBQUU7SUFDckYsR0FBRztJQUNILE1BQU0sRUFBRSxZQUFZO0lBQ3BCLFdBQVcsRUFBRSxzQkFBc0I7SUFDbkMsV0FBVyxFQUFFLE1BQU07SUFDbkIsY0FBYyxFQUFFLElBQUksRUFBRSxjQUFjO0lBQ3BDLGtCQUFrQixFQUFFLEtBQUssRUFBRSxjQUFjO0lBQ3pDLFVBQVUsRUFBRSxpQkFBaUI7SUFDN0IsUUFBUSxFQUFFLDZCQUE2QjtJQUN2Qyw2QkFBNkI7SUFDN0IsZUFBZSxFQUFFLFNBQVMsQ0FBQyxlQUFlO0lBQzFDLG9CQUFvQixFQUFFLFNBQVMsQ0FBQyxvQkFBb0I7SUFDcEQsV0FBVyxFQUFFLHFEQUFxRDtDQUNuRSxDQUFDLENBQUM7QUFFSCxVQUFVO0FBQ1YsV0FBVyxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUVyQyxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDLENBQUM7QUFDakMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUVoQixPQUFPLENBQUMsR0FBRyxDQUFDLDBDQUEwQyxDQUFDLENBQUM7QUFDeEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsQ0FBQztBQUM1QixPQUFPLENBQUMsR0FBRyxDQUFDLDBDQUEwQyxDQUFDLENBQUM7QUFDeEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNoQixPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUM7QUFDL0IsT0FBTyxDQUFDLEdBQUcsQ0FBQywrQ0FBK0MsQ0FBQyxDQUFDO0FBQzdELE9BQU8sQ0FBQyxHQUFHLENBQUMsaURBQWlELENBQUMsQ0FBQztBQUMvRCxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ2hCLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUM7QUFDNUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxRkFBcUYsQ0FBQyxDQUFDO0FBQ25HLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDaEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUN6QixPQUFPLENBQUMsR0FBRyxDQUFDLHVDQUF1QyxDQUFDLENBQUM7QUFDckQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO0FBQzlDLE9BQU8sQ0FBQyxHQUFHLENBQUMscUNBQXFDLENBQUMsQ0FBQztBQUNuRCxPQUFPLENBQUMsR0FBRyxDQUFDLDBDQUEwQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG4vKipcbiAqIFdlYkFwcFN0YWNrICsgUGVybWlzc2lvbiBBUEnntbHlkIjjg4fjg5fjg63jgqTjg6Hjg7Pjg4hcbiAqIFxuICog5qmf6IO9OlxuICogLSBEYXRhU3RhY2s6IER5bmFtb0RC44OG44O844OW44Or5L2c5oiQXG4gKiAtIFdlYkFwcFN0YWNrOiBOZXh0LmpzIFdlYkFwcCArIFBlcm1pc3Npb24gQVBJ57Wx5ZCIXG4gKiBcbiAqIOS9v+eUqOaWueazlTpcbiAqIG5weCBjZGsgZGVwbG95IC0tYWxsIC0tYXBwIFwibnB4IHRzLW5vZGUgYmluL2RlcGxveS13ZWJhcHAtd2l0aC1wZXJtaXNzaW9uLWFwaS50c1wiXG4gKi9cblxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IERhdGFTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvaW50ZWdyYXRlZC9kYXRhLXN0YWNrJztcbmltcG9ydCB7IFdlYkFwcFN0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy9pbnRlZ3JhdGVkL3dlYmFwcC1zdGFjayc7XG5cbi8vIOadseS6rOODquODvOOCuOODp+ODs+ioreWumuOCkuOCpOODs+ODneODvOODiFxuaW1wb3J0IHsgdG9reW9Qcm9kdWN0aW9uQ29uZmlnIH0gZnJvbSAnLi4vbGliL2NvbmZpZy9lbnZpcm9ubWVudHMvdG9reW8tcHJvZHVjdGlvbi1jb25maWcnO1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG4vLyBpbWFnZVRhZ+OBruWPluW+l++8iENES+OCs+ODs+ODhuOCreOCueODiOOBi+OCie+8iVxuY29uc3QgaW1hZ2VUYWcgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdpbWFnZVRhZycpO1xuXG4vLyDnkrDlooPoqK3lrppcbmNvbnN0IGVudiA9IHtcbiAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcbiAgcmVnaW9uOiAnYXAtbm9ydGhlYXN0LTEnLCAvLyDmnbHkuqzjg6rjg7zjgrjjg6fjg7Ncbn07XG5cbmNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG5jb25zb2xlLmxvZygn8J+agCBXZWJBcHAgKyBQZXJtaXNzaW9uIEFQSee1seWQiOODh+ODl+ODreOCpOmWi+WniycpO1xuY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbmNvbnNvbGUubG9nKGDjgqLjgqvjgqbjg7Pjg4g6ICR7ZW52LmFjY291bnR9YCk7XG5jb25zb2xlLmxvZyhg44Oq44O844K444On44OzOiAke2Vudi5yZWdpb259YCk7XG5jb25zb2xlLmxvZygnJyk7XG5cbi8vIDEuIERhdGFTdGFjayAtIER5bmFtb0RCICsgT3BlblNlYXJjaCArIFMzICsgRlN4IGZvciBPTlRBUO+8iFJFQURNRS5tZOa6luaLoO+8iVxuY29uc29sZS5sb2coJ/Cfk6YgU3RlcCAxOiBEYXRhU3RhY2vkvZzmiJDkuK0uLi4nKTtcblxuLy8gUkVBRE1FLm1k5rqW5oug44Gu5a6M5YWo44GqRGF0YVN0YWNr6Kit5a6aXG5jb25zdCBkYXRhU3RhY2sgPSBuZXcgRGF0YVN0YWNrKGFwcCwgJ1Rva3lvUmVnaW9uLVBlcm1pc3Npb25Bd2FyZVJBRy1EYXRhU3RhY2snLCB7XG4gIGVudixcbiAgY29uZmlnOiB7XG4gICAgc3RvcmFnZTogdG9reW9Qcm9kdWN0aW9uQ29uZmlnLnN0b3JhZ2UgYXMgYW55LFxuICAgIGRhdGFiYXNlOiB0b2t5b1Byb2R1Y3Rpb25Db25maWcuZGF0YWJhc2UgYXMgYW55LFxuICB9LFxuICBwcm9qZWN0TmFtZTogJ3Blcm1pc3Npb24tYXdhcmUtcmFnJyxcbiAgZW52aXJvbm1lbnQ6ICdwcm9kJyxcbiAgZGVzY3JpcHRpb246ICdEYXRhIFN0YWNrIC0gRHluYW1vREIgKyBPcGVuU2VhcmNoICsgRlN4IGZvciBPTlRBUCAoUkVBRE1FLm1kIGNvbXBsaWFudCknLFxufSk7XG5cbmNvbnNvbGUubG9nKCfinIUgRGF0YVN0YWNr5L2c5oiQ5a6M5LqGJyk7XG5jb25zb2xlLmxvZygnJyk7XG5cbi8vIDIuIFdlYkFwcFN0YWNrIC0gTmV4dC5qcyBXZWJBcHAgKyBQZXJtaXNzaW9uIEFQSee1seWQiFxuY29uc29sZS5sb2coJ/Cfk6YgU3RlcCAyOiBXZWJBcHBTdGFja+S9nOaIkOS4rS4uLicpO1xuXG4vLyBQZXJtaXNzaW9uIEFQSeioreWumuOCkui/veWKoFxuY29uc3Qgd2ViQXBwQ29uZmlnOiBhbnkgPSB7XG4gIC4uLnRva3lvUHJvZHVjdGlvbkNvbmZpZyxcbiAgcGVybWlzc2lvbkFwaToge1xuICAgIGVuYWJsZWQ6IGZhbHNlLCAvLyDkuIDmmYLnmoTjgavnhKHlirnljJbvvIhQaGFzZSAxMSBFMkXjg4bjgrnjg4jnlKjjgatEYXRhU3RhY2vjga7jgb/jg4fjg5fjg63jgqTvvIlcbiAgICBvbnRhcE1hbmFnZW1lbnRMaWY6IHByb2Nlc3MuZW52Lk9OVEFQX01BTkFHRU1FTlRfTElGIHx8ICcnLFxuICAgIHNzbVBhcmFtZXRlclByZWZpeDogJy9mc3gtb250YXAnLFxuICB9LFxufTtcblxuY29uc3Qgd2ViQXBwU3RhY2sgPSBuZXcgV2ViQXBwU3RhY2soYXBwLCAnVG9reW9SZWdpb24tUGVybWlzc2lvbkF3YXJlUkFHLVdlYkFwcFN0YWNrJywge1xuICBlbnYsXG4gIGNvbmZpZzogd2ViQXBwQ29uZmlnLFxuICBwcm9qZWN0TmFtZTogJ3Blcm1pc3Npb24tYXdhcmUtcmFnJyxcbiAgZW52aXJvbm1lbnQ6ICdwcm9kJyxcbiAgc3RhbmRhbG9uZU1vZGU6IHRydWUsIC8vIOOCueOCv+ODs+ODieOCouODreODvOODs+ODouODvOODiVxuICBza2lwTGFtYmRhQ3JlYXRpb246IGZhbHNlLCAvLyBMYW1iZGHplqLmlbDjgpLkvZzmiJBcbiAgZG9ja2VyUGF0aDogJy4vZG9ja2VyL25leHRqcycsXG4gIGltYWdlVGFnLCAvLyBDREvjgrPjg7Pjg4bjgq3jgrnjg4jjgYvjgonlj5blvpfjgZfjgZ9pbWFnZVRhZ+OCkua4oeOBmVxuICAvLyBEYXRhU3RhY2vjgYvjgolEeW5hbW9EQuODhuODvOODluODq+OCkuWPgueFp1xuICB1c2VyQWNjZXNzVGFibGU6IGRhdGFTdGFjay51c2VyQWNjZXNzVGFibGUsXG4gIHBlcm1pc3Npb25DYWNoZVRhYmxlOiBkYXRhU3RhY2sucGVybWlzc2lvbkNhY2hlVGFibGUsXG4gIGRlc2NyaXB0aW9uOiAnV2ViQXBwIFN0YWNrIC0gTmV4dC5qcyArIFBlcm1pc3Npb24gQVBJIEludGVncmF0aW9uJyxcbn0pO1xuXG4vLyDkvp3lrZjplqLkv4Ljga7oqK3lrppcbndlYkFwcFN0YWNrLmFkZERlcGVuZGVuY3koZGF0YVN0YWNrKTtcblxuY29uc29sZS5sb2coJ+KchSBXZWJBcHBTdGFja+S9nOaIkOWujOS6hicpO1xuY29uc29sZS5sb2coJycpO1xuXG5jb25zb2xlLmxvZygnPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PScpO1xuY29uc29sZS5sb2coJ+KchSDntbHlkIjjg4fjg5fjg63jgqToqK3lrprlrozkuoYnKTtcbmNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG5jb25zb2xlLmxvZygnJyk7XG5jb25zb2xlLmxvZygn8J+TiyDjg4fjg5fjg63jgqTjgZXjgozjgovjgrnjgr/jg4Pjgq86Jyk7XG5jb25zb2xlLmxvZygnICAxLiBUb2t5b1JlZ2lvbi1QZXJtaXNzaW9uQXdhcmVSQUctRGF0YVN0YWNrJyk7XG5jb25zb2xlLmxvZygnICAyLiBUb2t5b1JlZ2lvbi1QZXJtaXNzaW9uQXdhcmVSQUctV2ViQXBwU3RhY2snKTtcbmNvbnNvbGUubG9nKCcnKTtcbmNvbnNvbGUubG9nKCfwn5qAIOODh+ODl+ODreOCpOOCs+ODnuODs+ODiTonKTtcbmNvbnNvbGUubG9nKCcgIG5weCBjZGsgZGVwbG95IC0tYWxsIC0tYXBwIFwibnB4IHRzLW5vZGUgYmluL2RlcGxveS13ZWJhcHAtd2l0aC1wZXJtaXNzaW9uLWFwaS50c1wiJyk7XG5jb25zb2xlLmxvZygnJyk7XG5jb25zb2xlLmxvZygn4pqg77iPICDms6jmhI/kuovpoIU6Jyk7XG5jb25zb2xlLmxvZygnICAtIE9OVEFQX01BTkFHRU1FTlRfTElG55Kw5aKD5aSJ5pWw44KS6Kit5a6a44GX44Gm44GP44Gg44GV44GEJyk7XG5jb25zb2xlLmxvZygnICAtIEVDUuOBq05leHQuanPjgqTjg6Hjg7zjgrjjgpLjg5fjg4Pjgrfjg6XjgZfjgabjgY/jgaDjgZXjgYQnKTtcbmNvbnNvbGUubG9nKCcgIC0gU1NN44OR44Op44Oh44O844K/KC9mc3gtb250YXAvKinjgpLoqK3lrprjgZfjgabjgY/jgaDjgZXjgYQnKTtcbmNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4iXX0=