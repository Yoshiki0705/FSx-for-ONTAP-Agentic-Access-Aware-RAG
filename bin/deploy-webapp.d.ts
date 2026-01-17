#!/usr/bin/env node
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
import 'source-map-support/register';
