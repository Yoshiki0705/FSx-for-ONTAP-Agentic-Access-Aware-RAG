#!/usr/bin/env node
/**
 * SecurityStack個別デプロイスクリプト
 * GuardDuty修正後の再デプロイ用
 *
 * 注意: Windows AD EC2を作成する場合はVPCが必要です
 * VPCがない場合は、先にNetworkingStackをデプロイしてください
 */
import 'source-map-support/register';
