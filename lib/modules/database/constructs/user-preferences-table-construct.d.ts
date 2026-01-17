/**
 * ユーザー設定テーブルコンストラクト
 * 設定永続化システム用DynamoDBテーブル
 */
import { Construct } from 'constructs';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
export interface UserPreferencesTableConstructProps {
    tableName: string;
    environment: string;
}
/**
 * ユーザー設定永続化用DynamoDBテーブル
 *
 * 機能:
 * - ユーザーIDとカテゴリによる設定管理
 * - テーマ、言語、リージョン、モデル設定の永続化
 * - カテゴリ別設定の効率的な取得
 */
export declare class UserPreferencesTableConstruct extends Construct {
    readonly table: Table;
    constructor(scope: Construct, id: string, props: UserPreferencesTableConstructProps);
}
