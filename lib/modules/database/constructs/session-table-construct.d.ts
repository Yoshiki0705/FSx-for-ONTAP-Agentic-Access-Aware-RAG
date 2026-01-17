import { Construct } from 'constructs';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
/**
 * セッションテーブルコンストラクトのプロパティ
 */
export interface SessionTableConstructProps {
    /** テーブル名（命名規則に準拠） */
    tableName: string;
    /** 環境名（prod, dev, staging等） */
    environment: string;
    /** TTL有効期限（秒）デフォルト: 24時間 */
    defaultTtlSeconds?: number;
}
/**
 * セッション管理用DynamoDBテーブルコンストラクト
 *
 * 機能:
 * - セッションIDをパーティションキーとした高速アクセス
 * - ユーザーIDによる全セッション検索（GSI）
 * - TTLによる自動期限切れセッション削除
 * - 本番環境での暗号化とバックアップ
 *
 * 使用例:
 * ```typescript
 * const sessionTable = new SessionTableConstruct(this, 'SessionTable', {
 *   tableName: 'TokyoRegion-permission-aware-rag-prod-Sessions',
 *   environment: 'prod'
 * });
 * ```
 */
export declare class SessionTableConstruct extends Construct {
    /** DynamoDBテーブルインスタンス */
    readonly table: Table;
    constructor(scope: Construct, id: string, props: SessionTableConstructProps);
}
