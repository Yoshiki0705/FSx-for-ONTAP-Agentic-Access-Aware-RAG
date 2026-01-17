#!/usr/bin/env node
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
import 'source-map-support/register';
