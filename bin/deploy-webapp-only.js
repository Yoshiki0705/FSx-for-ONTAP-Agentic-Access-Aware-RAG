#!/usr/bin/env node
"use strict";
/**
 * WebAppStack単独デプロイメント（DataStackスキップ）
 *
 * 機能:
 * - WebAppStack: Next.js WebApp + Permission API統合のみ
 * - DataStackは既存のものを参照（新規作成しない）
 *
 * 使用方法:
 * npx cdk deploy --all --app "npx ts-node bin/deploy-webapp-only.ts"
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
console.log('🚀 WebAppStack単独デプロイ開始');
console.log('========================================');
console.log(`アカウント: ${env.account}`);
console.log(`リージョン: ${env.region}`);
console.log('');
// WebAppStack - Next.js WebApp + Permission API統合
console.log('📦 WebAppStack作成中...');
// Permission API設定を追加
const webAppConfig = {
    ...tokyo_production_config_1.tokyoProductionConfig,
    permissionApi: {
        enabled: false, // 一時的に無効化
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
    description: 'WebApp Stack - Next.js + Permission API Integration',
});
console.log('✅ WebAppStack作成完了');
console.log('');
console.log('========================================');
console.log('✅ WebAppStack単独デプロイ設定完了');
console.log('========================================');
console.log('');
console.log('📋 デプロイされるスタック:');
console.log('  1. TokyoRegion-PermissionAwareRAG-WebAppStack');
console.log('');
console.log('🚀 デプロイコマンド:');
console.log('  npx cdk deploy --all --app "npx ts-node bin/deploy-webapp-only.ts"');
console.log('');
console.log('⚠️  注意事項:');
console.log('  - DataStackは既存のものを参照します');
console.log('  - ECRにNext.jsイメージをプッシュ済みであることを確認してください');
console.log('  - imageTagはCDKコンテキストから取得されます: -c imageTag=YOUR_TAG');
console.log('========================================');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95LXdlYmFwcC1vbmx5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGVwbG95LXdlYmFwcC1vbmx5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0E7Ozs7Ozs7OztHQVNHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsdUNBQXFDO0FBQ3JDLGlEQUFtQztBQUNuQyx3RUFBb0U7QUFFcEUsa0JBQWtCO0FBQ2xCLGdHQUEyRjtBQUUzRixNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQiwyQkFBMkI7QUFDM0IsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7QUFFcEQsT0FBTztBQUNQLE1BQU0sR0FBRyxHQUFHO0lBQ1YsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO0lBQ3hDLE1BQU0sRUFBRSxnQkFBZ0IsRUFBRSxVQUFVO0NBQ3JDLENBQUM7QUFFRixPQUFPLENBQUMsR0FBRyxDQUFDLDBDQUEwQyxDQUFDLENBQUM7QUFDeEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO0FBQ3RDLE9BQU8sQ0FBQyxHQUFHLENBQUMsMENBQTBDLENBQUMsQ0FBQztBQUN4RCxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDckMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBQ3BDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7QUFFaEIsa0RBQWtEO0FBQ2xELE9BQU8sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsQ0FBQztBQUVwQyxzQkFBc0I7QUFDdEIsTUFBTSxZQUFZLEdBQVE7SUFDeEIsR0FBRywrQ0FBcUI7SUFDeEIsYUFBYSxFQUFFO1FBQ2IsT0FBTyxFQUFFLEtBQUssRUFBRSxVQUFVO1FBQzFCLGtCQUFrQixFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLElBQUksRUFBRTtRQUMxRCxrQkFBa0IsRUFBRSxZQUFZO0tBQ2pDO0NBQ0YsQ0FBQztBQUVGLE1BQU0sV0FBVyxHQUFHLElBQUksMEJBQVcsQ0FBQyxHQUFHLEVBQUUsNENBQTRDLEVBQUU7SUFDckYsR0FBRztJQUNILE1BQU0sRUFBRSxZQUFZO0lBQ3BCLFdBQVcsRUFBRSxzQkFBc0I7SUFDbkMsV0FBVyxFQUFFLE1BQU07SUFDbkIsY0FBYyxFQUFFLElBQUksRUFBRSxjQUFjO0lBQ3BDLGtCQUFrQixFQUFFLEtBQUssRUFBRSxjQUFjO0lBQ3pDLFVBQVUsRUFBRSxpQkFBaUI7SUFDN0IsUUFBUSxFQUFFLDZCQUE2QjtJQUN2QyxXQUFXLEVBQUUscURBQXFEO0NBQ25FLENBQUMsQ0FBQztBQUVILE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLENBQUMsQ0FBQztBQUNqQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBRWhCLE9BQU8sQ0FBQyxHQUFHLENBQUMsMENBQTBDLENBQUMsQ0FBQztBQUN4RCxPQUFPLENBQUMsR0FBRyxDQUFDLHlCQUF5QixDQUFDLENBQUM7QUFDdkMsT0FBTyxDQUFDLEdBQUcsQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO0FBQ3hELE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDaEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBQy9CLE9BQU8sQ0FBQyxHQUFHLENBQUMsaURBQWlELENBQUMsQ0FBQztBQUMvRCxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ2hCLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUM7QUFDNUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxzRUFBc0UsQ0FBQyxDQUFDO0FBQ3BGLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDaEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUN6QixPQUFPLENBQUMsR0FBRyxDQUFDLDJCQUEyQixDQUFDLENBQUM7QUFDekMsT0FBTyxDQUFDLEdBQUcsQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO0FBQ3hELE9BQU8sQ0FBQyxHQUFHLENBQUMsc0RBQXNELENBQUMsQ0FBQztBQUNwRSxPQUFPLENBQUMsR0FBRyxDQUFDLDBDQUEwQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG4vKipcbiAqIFdlYkFwcFN0YWNr5Y2Y54us44OH44OX44Ot44Kk44Oh44Oz44OI77yIRGF0YVN0YWNr44K544Kt44OD44OX77yJXG4gKiBcbiAqIOapn+iDvTpcbiAqIC0gV2ViQXBwU3RhY2s6IE5leHQuanMgV2ViQXBwICsgUGVybWlzc2lvbiBBUEnntbHlkIjjga7jgb9cbiAqIC0gRGF0YVN0YWNr44Gv5pei5a2Y44Gu44KC44Gu44KS5Y+C54Wn77yI5paw6KaP5L2c5oiQ44GX44Gq44GE77yJXG4gKiBcbiAqIOS9v+eUqOaWueazlTpcbiAqIG5weCBjZGsgZGVwbG95IC0tYWxsIC0tYXBwIFwibnB4IHRzLW5vZGUgYmluL2RlcGxveS13ZWJhcHAtb25seS50c1wiXG4gKi9cblxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IFdlYkFwcFN0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy9pbnRlZ3JhdGVkL3dlYmFwcC1zdGFjayc7XG5cbi8vIOadseS6rOODquODvOOCuOODp+ODs+ioreWumuOCkuOCpOODs+ODneODvOODiFxuaW1wb3J0IHsgdG9reW9Qcm9kdWN0aW9uQ29uZmlnIH0gZnJvbSAnLi4vbGliL2NvbmZpZy9lbnZpcm9ubWVudHMvdG9reW8tcHJvZHVjdGlvbi1jb25maWcnO1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG4vLyBpbWFnZVRhZ+OBruWPluW+l++8iENES+OCs+ODs+ODhuOCreOCueODiOOBi+OCie+8iVxuY29uc3QgaW1hZ2VUYWcgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdpbWFnZVRhZycpO1xuXG4vLyDnkrDlooPoqK3lrppcbmNvbnN0IGVudiA9IHtcbiAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcbiAgcmVnaW9uOiAnYXAtbm9ydGhlYXN0LTEnLCAvLyDmnbHkuqzjg6rjg7zjgrjjg6fjg7Ncbn07XG5cbmNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG5jb25zb2xlLmxvZygn8J+agCBXZWJBcHBTdGFja+WNmOeLrOODh+ODl+ODreOCpOmWi+WniycpO1xuY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbmNvbnNvbGUubG9nKGDjgqLjgqvjgqbjg7Pjg4g6ICR7ZW52LmFjY291bnR9YCk7XG5jb25zb2xlLmxvZyhg44Oq44O844K444On44OzOiAke2Vudi5yZWdpb259YCk7XG5jb25zb2xlLmxvZygnJyk7XG5cbi8vIFdlYkFwcFN0YWNrIC0gTmV4dC5qcyBXZWJBcHAgKyBQZXJtaXNzaW9uIEFQSee1seWQiFxuY29uc29sZS5sb2coJ/Cfk6YgV2ViQXBwU3RhY2vkvZzmiJDkuK0uLi4nKTtcblxuLy8gUGVybWlzc2lvbiBBUEnoqK3lrprjgpLov73liqBcbmNvbnN0IHdlYkFwcENvbmZpZzogYW55ID0ge1xuICAuLi50b2t5b1Byb2R1Y3Rpb25Db25maWcsXG4gIHBlcm1pc3Npb25BcGk6IHtcbiAgICBlbmFibGVkOiBmYWxzZSwgLy8g5LiA5pmC55qE44Gr54Sh5Yq55YyWXG4gICAgb250YXBNYW5hZ2VtZW50TGlmOiBwcm9jZXNzLmVudi5PTlRBUF9NQU5BR0VNRU5UX0xJRiB8fCAnJyxcbiAgICBzc21QYXJhbWV0ZXJQcmVmaXg6ICcvZnN4LW9udGFwJyxcbiAgfSxcbn07XG5cbmNvbnN0IHdlYkFwcFN0YWNrID0gbmV3IFdlYkFwcFN0YWNrKGFwcCwgJ1Rva3lvUmVnaW9uLVBlcm1pc3Npb25Bd2FyZVJBRy1XZWJBcHBTdGFjaycsIHtcbiAgZW52LFxuICBjb25maWc6IHdlYkFwcENvbmZpZyxcbiAgcHJvamVjdE5hbWU6ICdwZXJtaXNzaW9uLWF3YXJlLXJhZycsXG4gIGVudmlyb25tZW50OiAncHJvZCcsXG4gIHN0YW5kYWxvbmVNb2RlOiB0cnVlLCAvLyDjgrnjgr/jg7Pjg4njgqLjg63jg7zjg7Pjg6Ljg7zjg4lcbiAgc2tpcExhbWJkYUNyZWF0aW9uOiBmYWxzZSwgLy8gTGFtYmRh6Zai5pWw44KS5L2c5oiQXG4gIGRvY2tlclBhdGg6ICcuL2RvY2tlci9uZXh0anMnLFxuICBpbWFnZVRhZywgLy8gQ0RL44Kz44Oz44OG44Kt44K544OI44GL44KJ5Y+W5b6X44GX44GfaW1hZ2VUYWfjgpLmuKHjgZlcbiAgZGVzY3JpcHRpb246ICdXZWJBcHAgU3RhY2sgLSBOZXh0LmpzICsgUGVybWlzc2lvbiBBUEkgSW50ZWdyYXRpb24nLFxufSk7XG5cbmNvbnNvbGUubG9nKCfinIUgV2ViQXBwU3RhY2vkvZzmiJDlrozkuoYnKTtcbmNvbnNvbGUubG9nKCcnKTtcblxuY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbmNvbnNvbGUubG9nKCfinIUgV2ViQXBwU3RhY2vljZjni6zjg4fjg5fjg63jgqToqK3lrprlrozkuoYnKTtcbmNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG5jb25zb2xlLmxvZygnJyk7XG5jb25zb2xlLmxvZygn8J+TiyDjg4fjg5fjg63jgqTjgZXjgozjgovjgrnjgr/jg4Pjgq86Jyk7XG5jb25zb2xlLmxvZygnICAxLiBUb2t5b1JlZ2lvbi1QZXJtaXNzaW9uQXdhcmVSQUctV2ViQXBwU3RhY2snKTtcbmNvbnNvbGUubG9nKCcnKTtcbmNvbnNvbGUubG9nKCfwn5qAIOODh+ODl+ODreOCpOOCs+ODnuODs+ODiTonKTtcbmNvbnNvbGUubG9nKCcgIG5weCBjZGsgZGVwbG95IC0tYWxsIC0tYXBwIFwibnB4IHRzLW5vZGUgYmluL2RlcGxveS13ZWJhcHAtb25seS50c1wiJyk7XG5jb25zb2xlLmxvZygnJyk7XG5jb25zb2xlLmxvZygn4pqg77iPICDms6jmhI/kuovpoIU6Jyk7XG5jb25zb2xlLmxvZygnICAtIERhdGFTdGFja+OBr+aXouWtmOOBruOCguOBruOCkuWPgueFp+OBl+OBvuOBmScpO1xuY29uc29sZS5sb2coJyAgLSBFQ1LjgatOZXh0Lmpz44Kk44Oh44O844K444KS44OX44OD44K344Ol5riI44G/44Gn44GC44KL44GT44Go44KS56K66KqN44GX44Gm44GP44Gg44GV44GEJyk7XG5jb25zb2xlLmxvZygnICAtIGltYWdlVGFn44GvQ0RL44Kz44Oz44OG44Kt44K544OI44GL44KJ5Y+W5b6X44GV44KM44G+44GZOiAtYyBpbWFnZVRhZz1ZT1VSX1RBRycpO1xuY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbiJdfQ==