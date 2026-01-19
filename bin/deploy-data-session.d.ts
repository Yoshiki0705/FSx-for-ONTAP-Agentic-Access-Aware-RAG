#!/usr/bin/env node
/**
 * DataStack個別デプロイスクリプト
 * SecurityStack修正後のデプロイ用
 *
 * 注意: SessionTableStackは存在しないため、DataStackのみをデプロイします。
 * DataStackには全てのDynamoDBテーブル（セッション、ユーザー設定、チャット履歴等）が含まれています。
 *
 * 重要: 既存のNetworkingStackのVPCを使用します（vpc-05273211525990e49）
 */
import 'source-map-support/register';
