/**
 * 動的設定キャッシュテーブルコンストラクト
 * モデル・プロバイダー・リージョン情報の動的キャッシュ用DynamoDBテーブル
 */
import { Construct } from 'constructs';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
export interface DiscoveryCacheTableConstructProps {
    tableName: string;
    environment: string;
}
/**
 * 動的設定キャッシュ用DynamoDBテーブル
 *
 * 機能:
 * - Bedrockモデル情報の動的キャッシュ
 * - プロバイダー情報の動的生成・キャッシュ
 * - リージョン可用性情報のキャッシュ
 * - TTLによる自動キャッシュ更新
 */
export declare class DiscoveryCacheTableConstruct extends Construct {
    readonly table: Table;
    constructor(scope: Construct, id: string, props: DiscoveryCacheTableConstructProps);
}
