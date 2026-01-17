#!/usr/bin/env node
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
import 'source-map-support/register';
