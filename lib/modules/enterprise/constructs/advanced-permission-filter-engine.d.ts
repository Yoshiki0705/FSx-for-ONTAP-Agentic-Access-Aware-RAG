/**
 * 高度な権限フィルタリングエンジン
 *
 * 時間ベース制限、地理的制限、動的権限を統合した
 * エンタープライズグレードの権限制御システム
 */
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { PermissionFilterConfig } from '../interfaces/permission-config';
export interface AdvancedPermissionFilterEngineProps {
    /** 権限フィルター設定 */
    readonly filterConfig: PermissionFilterConfig;
    /** OpenSearchドメインエンドポイント */
    readonly opensearchEndpoint: string;
    /** DynamoDBテーブル名 */
    readonly permissionTableName: string;
    /** 監査ログテーブル名 */
    readonly auditLogTableName: string;
    /** 地理的位置情報API設定 */
    readonly geoLocationApi?: {
        readonly endpoint: string;
        readonly apiKey: string;
    };
    /** プロジェクト管理API設定 */
    readonly projectManagementApi?: {
        readonly endpoint: string;
        readonly apiKey: string;
    };
}
export declare class AdvancedPermissionFilterEngine extends Construct {
    /** 権限フィルタリングLambda関数 */
    readonly permissionFilterFunction: lambda.Function;
    /** 時間ベース制限チェック関数 */
    readonly timeBasedCheckFunction: lambda.Function;
    /** 地理的制限チェック関数 */
    readonly geographicCheckFunction: lambda.Function;
    /** 動的権限更新関数 */
    readonly dynamicPermissionUpdateFunction: lambda.Function;
    /** 権限キャッシュテーブル */
    readonly permissionCacheTable: dynamodb.Table;
    /** 監査ログテーブル */
    readonly auditLogTable: dynamodb.Table;
    constructor(scope: Construct, id: string, props: AdvancedPermissionFilterEngineProps);
    private getPermissionFilterCode;
    private getTimeBasedCheckCode;
    private getGeographicCheckCode;
    private getDynamicPermissionUpdateCode;
}
