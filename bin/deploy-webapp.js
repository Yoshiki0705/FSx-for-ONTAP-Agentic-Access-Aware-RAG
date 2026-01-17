#!/usr/bin/env node
"use strict";
/**
 * WebAppStack統合デプロイエントリーポイント
 *
 * 用途:
 * - WebAppStackのスタンドアローンデプロイ
 * - 環境変数による柔軟な設定
 * - 既存リソースの参照または新規作成
 *
 * 使用方法:
 *   npx cdk deploy -a "npx ts-node bin/deploy-webapp.ts"
 *
 * 環境変数:
 *   PROJECT_NAME: プロジェクト名（デフォルト: permission-aware-rag）
 *   ENVIRONMENT: 環境名（デフォルト: prod）
 *   CDK_DEFAULT_REGION: リージョン（デフォルト: ap-northeast-1）
 *   CDK_DEFAULT_ACCOUNT: AWSアカウントID（必須）
 *   EXISTING_VPC_ID: 既存VPC ID（オプション）
 *   EXISTING_SECURITY_GROUP_ID: 既存セキュリティグループID（オプション）
 *   SKIP_LAMBDA_CREATION: Lambda作成をスキップ（true/false、デフォルト: false）
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
const tokyo_production_config_1 = require("../lib/config/environments/tokyo-production-config");
const app = new cdk.App();
// imageTagの取得（CDKコンテキストから）
const imageTag = app.node.tryGetContext('imageTag');
// 環境設定
const projectName = process.env.PROJECT_NAME || 'permission-aware-rag';
const environment = process.env.ENVIRONMENT || 'prod';
const region = process.env.CDK_DEFAULT_REGION || 'ap-northeast-1';
const account = process.env.CDK_DEFAULT_ACCOUNT;
// スタンドアローンモード設定
const existingVpcId = process.env.EXISTING_VPC_ID;
const existingSecurityGroupId = process.env.EXISTING_SECURITY_GROUP_ID;
const skipLambdaCreation = process.env.SKIP_LAMBDA_CREATION === 'true';
// 必須環境変数チェック
if (!account) {
    console.error('❌ エラー: CDK_DEFAULT_ACCOUNT環境変数が設定されていません');
    console.error('');
    console.error('設定方法:');
    console.error('  export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)');
    process.exit(1);
}
// 既存リソースIDの検証
if (existingVpcId && !existingVpcId.startsWith('vpc-')) {
    console.error('❌ エラー: EXISTING_VPC_IDの形式が不正です');
    console.error(`   指定値: ${existingVpcId}`);
    console.error('   正しい形式: vpc-xxxxxxxxxxxxxxxxx');
    process.exit(1);
}
if (existingSecurityGroupId && !existingSecurityGroupId.startsWith('sg-')) {
    console.error('❌ エラー: EXISTING_SECURITY_GROUP_IDの形式が不正です');
    console.error(`   指定値: ${existingSecurityGroupId}`);
    console.error('   正しい形式: sg-xxxxxxxxxxxxxxxxx');
    process.exit(1);
}
console.log('🚀 WebAppStackデプロイ設定:');
console.log(`   プロジェクト名: ${projectName}`);
console.log(`   環境: ${environment}`);
console.log(`   リージョン: ${region}`);
console.log(`   アカウント: ${account}`);
console.log(`   デプロイモード: スタンドアローン`);
if (existingVpcId) {
    console.log(`   既存VPC: ${existingVpcId}`);
}
if (existingSecurityGroupId) {
    console.log(`   既存セキュリティグループ: ${existingSecurityGroupId}`);
}
if (skipLambdaCreation) {
    console.log(`   Lambda作成: スキップ`);
}
// 設定読み込み
const config = tokyo_production_config_1.tokyoProductionConfig;
console.log('✅ 設定読み込み完了');
// スタック名生成
const stackName = `${config.naming.regionPrefix}-${projectName}-${environment}-WebApp`;
// WebAppStackのデプロイ（スタンドアローンモード）
try {
    const webAppStack = new webapp_stack_1.WebAppStack(app, stackName, {
        env: {
            account,
            region,
        },
        config: config, // EnvironmentConfigとの互換性のため
        projectName,
        environment,
        imageTag, // CDKコンテキストから取得したimageTagを渡す
        // スタンドアローンモード設定
        standaloneMode: true,
        existingVpcId,
        existingSecurityGroupId,
    });
    console.log(`✅ WebAppStack "${webAppStack.stackName}" を初期化しました`);
    // タグ設定
    cdk.Tags.of(app).add('Project', projectName);
    cdk.Tags.of(app).add('Environment', environment);
    cdk.Tags.of(app).add('ManagedBy', 'CDK');
    cdk.Tags.of(app).add('Region', region);
    cdk.Tags.of(app).add('DeployMode', 'standalone'); // US-2.1要件
    app.synth();
}
catch (error) {
    console.error('');
    console.error('========================================');
    console.error('❌ WebAppStack初期化エラー');
    console.error('========================================');
    console.error('');
    if (error instanceof Error) {
        console.error('エラーメッセージ:', error.message);
        console.error('');
        // 一般的なエラーパターンに対する対処法を提示
        if (error.message.includes('VPC')) {
            console.error('💡 VPC関連エラーの対処法:');
            console.error('   1. EXISTING_VPC_ID環境変数が正しく設定されているか確認');
            console.error('   2. 指定したVPCが存在するか確認: aws ec2 describe-vpcs --vpc-ids <VPC_ID>');
            console.error('   3. VPCが同じリージョンにあるか確認');
        }
        else if (error.message.includes('SecurityGroup')) {
            console.error('💡 セキュリティグループ関連エラーの対処法:');
            console.error('   1. EXISTING_SECURITY_GROUP_ID環境変数が正しく設定されているか確認');
            console.error('   2. 指定したセキュリティグループが存在するか確認');
            console.error('   3. セキュリティグループが指定したVPCに属しているか確認');
        }
        else if (error.message.includes('ECR')) {
            console.error('💡 ECR関連エラーの対処法:');
            console.error('   1. ECRリポジトリが作成されているか確認');
            console.error('   2. Dockerイメージがプッシュされているか確認');
            console.error('   3. SKIP_LAMBDA_CREATION=true でECRのみデプロイを試行');
        }
        else {
            console.error('💡 一般的な対処法:');
            console.error('   1. AWS認証情報が正しく設定されているか確認');
            console.error('   2. 必要なIAM権限があるか確認');
            console.error('   3. リージョンが正しく設定されているか確認');
        }
    }
    else {
        console.error('予期しないエラー:', error);
    }
    console.error('');
    console.error('詳細なエラー情報:');
    console.error(error);
    console.error('');
    process.exit(1);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95LXdlYmFwcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRlcGxveS13ZWJhcHAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQTs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQW1CRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsd0VBQW9FO0FBQ3BFLGdHQUEyRjtBQUUzRixNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQiwyQkFBMkI7QUFDM0IsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7QUFFcEQsT0FBTztBQUNQLE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxJQUFJLHNCQUFzQixDQUFDO0FBQ3ZFLE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxJQUFJLE1BQU0sQ0FBQztBQUN0RCxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLGdCQUFnQixDQUFDO0FBQ2xFLE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLENBQUM7QUFFaEQsZ0JBQWdCO0FBQ2hCLE1BQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDO0FBQ2xELE1BQU0sdUJBQXVCLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQywwQkFBMEIsQ0FBQztBQUN2RSxNQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLEtBQUssTUFBTSxDQUFDO0FBRXZFLGFBQWE7QUFDYixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDYixPQUFPLENBQUMsS0FBSyxDQUFDLDBDQUEwQyxDQUFDLENBQUM7SUFDMUQsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMs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QUFDO0lBRUQsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNsQixPQUFPLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQzNCLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDckIsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUVsQixPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2xCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG4vKipcbiAqIFdlYkFwcFN0YWNr57Wx5ZCI44OH44OX44Ot44Kk44Ko44Oz44OI44Oq44O844Od44Kk44Oz44OIXG4gKiBcbiAqIOeUqOmAlDpcbiAqIC0gV2ViQXBwU3RhY2vjga7jgrnjgr/jg7Pjg4njgqLjg63jg7zjg7Pjg4fjg5fjg63jgqRcbiAqIC0g55Kw5aKD5aSJ5pWw44Gr44KI44KL5p+U6Luf44Gq6Kit5a6aXG4gKiAtIOaXouWtmOODquOCveODvOOCueOBruWPgueFp+OBvuOBn+OBr+aWsOimj+S9nOaIkFxuICogXG4gKiDkvb/nlKjmlrnms5U6XG4gKiAgIG5weCBjZGsgZGVwbG95IC1hIFwibnB4IHRzLW5vZGUgYmluL2RlcGxveS13ZWJhcHAudHNcIlxuICogXG4gKiDnkrDlooPlpInmlbA6XG4gKiAgIFBST0pFQ1RfTkFNRTog44OX44Ot44K444Kn44Kv44OI5ZCN77yI44OH44OV44Kp44Or44OIOiBwZXJtaXNzaW9uLWF3YXJlLXJhZ++8iVxuICogICBFTlZJUk9OTUVOVDog55Kw5aKD5ZCN77yI44OH44OV44Kp44Or44OIOiBwcm9k77yJXG4gKiAgIENES19ERUZBVUxUX1JFR0lPTjog44Oq44O844K444On44Oz77yI44OH44OV44Kp44Or44OIOiBhcC1ub3J0aGVhc3QtMe+8iVxuICogICBDREtfREVGQVVMVF9BQ0NPVU5UOiBBV1PjgqLjgqvjgqbjg7Pjg4hJRO+8iOW/hemgiO+8iVxuICogICBFWElTVElOR19WUENfSUQ6IOaXouWtmFZQQyBJRO+8iOOCquODl+OCt+ODp+ODs++8iVxuICogICBFWElTVElOR19TRUNVUklUWV9HUk9VUF9JRDog5pei5a2Y44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OXSUTvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAqICAgU0tJUF9MQU1CREFfQ1JFQVRJT046IExhbWJkYeS9nOaIkOOCkuOCueOCreODg+ODl++8iHRydWUvZmFsc2XjgIHjg4fjg5Xjgqnjg6vjg4g6IGZhbHNl77yJXG4gKi9cblxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IFdlYkFwcFN0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy9pbnRlZ3JhdGVkL3dlYmFwcC1zdGFjayc7XG5pbXBvcnQgeyB0b2t5b1Byb2R1Y3Rpb25Db25maWcgfSBmcm9tICcuLi9saWIvY29uZmlnL2Vudmlyb25tZW50cy90b2t5by1wcm9kdWN0aW9uLWNvbmZpZyc7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbi8vIGltYWdlVGFn44Gu5Y+W5b6X77yIQ0RL44Kz44Oz44OG44Kt44K544OI44GL44KJ77yJXG5jb25zdCBpbWFnZVRhZyA9IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ2ltYWdlVGFnJyk7XG5cbi8vIOeSsOWig+ioreWumlxuY29uc3QgcHJvamVjdE5hbWUgPSBwcm9jZXNzLmVudi5QUk9KRUNUX05BTUUgfHwgJ3Blcm1pc3Npb24tYXdhcmUtcmFnJztcbmNvbnN0IGVudmlyb25tZW50ID0gcHJvY2Vzcy5lbnYuRU5WSVJPTk1FTlQgfHwgJ3Byb2QnO1xuY29uc3QgcmVnaW9uID0gcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OIHx8ICdhcC1ub3J0aGVhc3QtMSc7XG5jb25zdCBhY2NvdW50ID0gcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVDtcblxuLy8g44K544K/44Oz44OJ44Ki44Ot44O844Oz44Oi44O844OJ6Kit5a6aXG5jb25zdCBleGlzdGluZ1ZwY0lkID0gcHJvY2Vzcy5lbnYuRVhJU1RJTkdfVlBDX0lEO1xuY29uc3QgZXhpc3RpbmdTZWN1cml0eUdyb3VwSWQgPSBwcm9jZXNzLmVudi5FWElTVElOR19TRUNVUklUWV9HUk9VUF9JRDtcbmNvbnN0IHNraXBMYW1iZGFDcmVhdGlvbiA9IHByb2Nlc3MuZW52LlNLSVBfTEFNQkRBX0NSRUFUSU9OID09PSAndHJ1ZSc7XG5cbi8vIOW/hemgiOeSsOWig+WkieaVsOODgeOCp+ODg+OCr1xuaWYgKCFhY2NvdW50KSB7XG4gIGNvbnNvbGUuZXJyb3IoJ+KdjCDjgqjjg6njg7w6IENES19ERUZBVUxUX0FDQ09VTlTnkrDlooPlpInmlbDjgYzoqK3lrprjgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgY29uc29sZS5lcnJvcignJyk7XG4gIGNvbnNvbGUuZXJyb3IoJ+ioreWumuaWueazlTonKTtcbiAgY29uc29sZS5lcnJvcignICBleHBvcnQgQ0RLX0RFRkFVTFRfQUNDT1VOVD0kKGF3cyBzdHMgZ2V0LWNhbGxlci1pZGVudGl0eSAtLXF1ZXJ5IEFjY291bnQgLS1vdXRwdXQgdGV4dCknKTtcbiAgcHJvY2Vzcy5leGl0KDEpO1xufVxuXG4vLyDml6LlrZjjg6rjgr3jg7zjgrlJROOBruaknOiovFxuaWYgKGV4aXN0aW5nVnBjSWQgJiYgIWV4aXN0aW5nVnBjSWQuc3RhcnRzV2l0aCgndnBjLScpKSB7XG4gIGNvbnNvbGUuZXJyb3IoJ+KdjCDjgqjjg6njg7w6IEVYSVNUSU5HX1ZQQ19JROOBruW9ouW8j+OBjOS4jeato+OBp+OBmScpO1xuICBjb25zb2xlLmVycm9yKGAgICDmjIflrprlgKQ6ICR7ZXhpc3RpbmdWcGNJZH1gKTtcbiAgY29uc29sZS5lcnJvcignICAg5q2j44GX44GE5b2i5byPOiB2cGMteHh4eHh4eHh4eHh4eHh4eHgnKTtcbiAgcHJvY2Vzcy5leGl0KDEpO1xufVxuXG5pZiAoZXhpc3RpbmdTZWN1cml0eUdyb3VwSWQgJiYgIWV4aXN0aW5nU2VjdXJpdHlHcm91cElkLnN0YXJ0c1dpdGgoJ3NnLScpKSB7XG4gIGNvbnNvbGUuZXJyb3IoJ+KdjCDjgqjjg6njg7w6IEVYSVNUSU5HX1NFQ1VSSVRZX0dST1VQX0lE44Gu5b2i5byP44GM5LiN5q2j44Gn44GZJyk7XG4gIGNvbnNvbGUuZXJyb3IoYCAgIOaMh+WumuWApDogJHtleGlzdGluZ1NlY3VyaXR5R3JvdXBJZH1gKTtcbiAgY29uc29sZS5lcnJvcignICAg5q2j44GX44GE5b2i5byPOiBzZy14eHh4eHh4eHh4eHh4eHh4eCcpO1xuICBwcm9jZXNzLmV4aXQoMSk7XG59XG5cbmNvbnNvbGUubG9nKCfwn5qAIFdlYkFwcFN0YWNr44OH44OX44Ot44Kk6Kit5a6aOicpO1xuY29uc29sZS5sb2coYCAgIOODl+ODreOCuOOCp+OCr+ODiOWQjTogJHtwcm9qZWN0TmFtZX1gKTtcbmNvbnNvbGUubG9nKGAgICDnkrDlooM6ICR7ZW52aXJvbm1lbnR9YCk7XG5jb25zb2xlLmxvZyhgICAg44Oq44O844K444On44OzOiAke3JlZ2lvbn1gKTtcbmNvbnNvbGUubG9nKGAgICDjgqLjgqvjgqbjg7Pjg4g6ICR7YWNjb3VudH1gKTtcbmNvbnNvbGUubG9nKGAgICDjg4fjg5fjg63jgqTjg6Ljg7zjg4k6IOOCueOCv+ODs+ODieOCouODreODvOODs2ApO1xuaWYgKGV4aXN0aW5nVnBjSWQpIHtcbiAgY29uc29sZS5sb2coYCAgIOaXouWtmFZQQzogJHtleGlzdGluZ1ZwY0lkfWApO1xufVxuaWYgKGV4aXN0aW5nU2VjdXJpdHlHcm91cElkKSB7XG4gIGNvbnNvbGUubG9nKGAgICDml6LlrZjjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5c6ICR7ZXhpc3RpbmdTZWN1cml0eUdyb3VwSWR9YCk7XG59XG5pZiAoc2tpcExhbWJkYUNyZWF0aW9uKSB7XG4gIGNvbnNvbGUubG9nKGAgICBMYW1iZGHkvZzmiJA6IOOCueOCreODg+ODl2ApO1xufVxuXG4vLyDoqK3lrproqq3jgb/ovrzjgb9cbmNvbnN0IGNvbmZpZyA9IHRva3lvUHJvZHVjdGlvbkNvbmZpZztcbmNvbnNvbGUubG9nKCfinIUg6Kit5a6a6Kqt44G/6L6844G/5a6M5LqGJyk7XG5cbi8vIOOCueOCv+ODg+OCr+WQjeeUn+aIkFxuY29uc3Qgc3RhY2tOYW1lID0gYCR7Y29uZmlnLm5hbWluZy5yZWdpb25QcmVmaXh9LSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LVdlYkFwcGA7XG5cbi8vIFdlYkFwcFN0YWNr44Gu44OH44OX44Ot44Kk77yI44K544K/44Oz44OJ44Ki44Ot44O844Oz44Oi44O844OJ77yJXG50cnkge1xuICBjb25zdCB3ZWJBcHBTdGFjayA9IG5ldyBXZWJBcHBTdGFjayhhcHAsIHN0YWNrTmFtZSwge1xuICAgIGVudjoge1xuICAgICAgYWNjb3VudCxcbiAgICAgIHJlZ2lvbixcbiAgICB9LFxuICAgIGNvbmZpZzogY29uZmlnIGFzIGFueSwgLy8gRW52aXJvbm1lbnRDb25maWfjgajjga7kupLmj5vmgKfjga7jgZ/jgoFcbiAgICBwcm9qZWN0TmFtZSxcbiAgICBlbnZpcm9ubWVudCxcbiAgICBpbWFnZVRhZywgLy8gQ0RL44Kz44Oz44OG44Kt44K544OI44GL44KJ5Y+W5b6X44GX44GfaW1hZ2VUYWfjgpLmuKHjgZlcbiAgICAvLyDjgrnjgr/jg7Pjg4njgqLjg63jg7zjg7Pjg6Ljg7zjg4noqK3lrppcbiAgICBzdGFuZGFsb25lTW9kZTogdHJ1ZSxcbiAgICBleGlzdGluZ1ZwY0lkLFxuICAgIGV4aXN0aW5nU2VjdXJpdHlHcm91cElkLFxuICB9KTtcblxuICBjb25zb2xlLmxvZyhg4pyFIFdlYkFwcFN0YWNrIFwiJHt3ZWJBcHBTdGFjay5zdGFja05hbWV9XCIg44KS5Yid5pyf5YyW44GX44G+44GX44GfYCk7XG5cbiAgLy8g44K/44Kw6Kit5a6aXG4gIGNkay5UYWdzLm9mKGFwcCkuYWRkKCdQcm9qZWN0JywgcHJvamVjdE5hbWUpO1xuICBjZGsuVGFncy5vZihhcHApLmFkZCgnRW52aXJvbm1lbnQnLCBlbnZpcm9ubWVudCk7XG4gIGNkay5UYWdzLm9mKGFwcCkuYWRkKCdNYW5hZ2VkQnknLCAnQ0RLJyk7XG4gIGNkay5UYWdzLm9mKGFwcCkuYWRkKCdSZWdpb24nLCByZWdpb24pO1xuICBjZGsuVGFncy5vZihhcHApLmFkZCgnRGVwbG95TW9kZScsICdzdGFuZGFsb25lJyk7IC8vIFVTLTIuMeimgeS7tlxuXG4gIGFwcC5zeW50aCgpO1xufSBjYXRjaCAoZXJyb3IpIHtcbiAgY29uc29sZS5lcnJvcignJyk7XG4gIGNvbnNvbGUuZXJyb3IoJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbiAgY29uc29sZS5lcnJvcign4p2MIFdlYkFwcFN0YWNr5Yid5pyf5YyW44Ko44Op44O8Jyk7XG4gIGNvbnNvbGUuZXJyb3IoJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbiAgY29uc29sZS5lcnJvcignJyk7XG4gIFxuICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ+OCqOODqeODvOODoeODg+OCu+ODvOOCuDonLCBlcnJvci5tZXNzYWdlKTtcbiAgICBjb25zb2xlLmVycm9yKCcnKTtcbiAgICBcbiAgICAvLyDkuIDoiKznmoTjgarjgqjjg6njg7zjg5Hjgr/jg7zjg7Pjgavlr77jgZnjgovlr77lh6bms5XjgpLmj5DnpLpcbiAgICBpZiAoZXJyb3IubWVzc2FnZS5pbmNsdWRlcygnVlBDJykpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ/CfkqEgVlBD6Zai6YCj44Ko44Op44O844Gu5a++5Yem5rOVOicpO1xuICAgICAgY29uc29sZS5lcnJvcignICAgMS4gRVhJU1RJTkdfVlBDX0lE55Kw5aKD5aSJ5pWw44GM5q2j44GX44GP6Kit5a6a44GV44KM44Gm44GE44KL44GL56K66KqNJyk7XG4gICAgICBjb25zb2xlLmVycm9yKCcgICAyLiDmjIflrprjgZfjgZ9WUEPjgYzlrZjlnKjjgZnjgovjgYvnorroqo06IGF3cyBlYzIgZGVzY3JpYmUtdnBjcyAtLXZwYy1pZHMgPFZQQ19JRD4nKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyAgIDMuIFZQQ+OBjOWQjOOBmOODquODvOOCuOODp+ODs+OBq+OBguOCi+OBi+eiuuiqjScpO1xuICAgIH0gZWxzZSBpZiAoZXJyb3IubWVzc2FnZS5pbmNsdWRlcygnU2VjdXJpdHlHcm91cCcpKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCfwn5KhIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+mWoumAo+OCqOODqeODvOOBruWvvuWHpuazlTonKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyAgIDEuIEVYSVNUSU5HX1NFQ1VSSVRZX0dST1VQX0lE55Kw5aKD5aSJ5pWw44GM5q2j44GX44GP6Kit5a6a44GV44KM44Gm44GE44KL44GL56K66KqNJyk7XG4gICAgICBjb25zb2xlLmVycm9yKCcgICAyLiDmjIflrprjgZfjgZ/jgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fjgYzlrZjlnKjjgZnjgovjgYvnorroqo0nKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyAgIDMuIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+OBjOaMh+WumuOBl+OBn1ZQQ+OBq+WxnuOBl+OBpuOBhOOCi+OBi+eiuuiqjScpO1xuICAgIH0gZWxzZSBpZiAoZXJyb3IubWVzc2FnZS5pbmNsdWRlcygnRUNSJykpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ/CfkqEgRUNS6Zai6YCj44Ko44Op44O844Gu5a++5Yem5rOVOicpO1xuICAgICAgY29uc29sZS5lcnJvcignICAgMS4gRUNS44Oq44Od44K444OI44Oq44GM5L2c5oiQ44GV44KM44Gm44GE44KL44GL56K66KqNJyk7XG4gICAgICBjb25zb2xlLmVycm9yKCcgICAyLiBEb2NrZXLjgqTjg6Hjg7zjgrjjgYzjg5fjg4Pjgrfjg6XjgZXjgozjgabjgYTjgovjgYvnorroqo0nKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyAgIDMuIFNLSVBfTEFNQkRBX0NSRUFUSU9OPXRydWUg44GnRUNS44Gu44G/44OH44OX44Ot44Kk44KS6Kmm6KGMJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ/CfkqEg5LiA6Iis55qE44Gq5a++5Yem5rOVOicpO1xuICAgICAgY29uc29sZS5lcnJvcignICAgMS4gQVdT6KqN6Ki85oOF5aCx44GM5q2j44GX44GP6Kit5a6a44GV44KM44Gm44GE44KL44GL56K66KqNJyk7XG4gICAgICBjb25zb2xlLmVycm9yKCcgICAyLiDlv4XopoHjgapJQU3mqKnpmZDjgYzjgYLjgovjgYvnorroqo0nKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyAgIDMuIOODquODvOOCuOODp+ODs+OBjOato+OBl+OBj+ioreWumuOBleOCjOOBpuOBhOOCi+OBi+eiuuiqjScpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLmVycm9yKCfkuojmnJ/jgZfjgarjgYTjgqjjg6njg7w6JywgZXJyb3IpO1xuICB9XG4gIFxuICBjb25zb2xlLmVycm9yKCcnKTtcbiAgY29uc29sZS5lcnJvcign6Kmz57Sw44Gq44Ko44Op44O85oOF5aCxOicpO1xuICBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgY29uc29sZS5lcnJvcignJyk7XG4gIFxuICBwcm9jZXNzLmV4aXQoMSk7XG59XG4iXX0=