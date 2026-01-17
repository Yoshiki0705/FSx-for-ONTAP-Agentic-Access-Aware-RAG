/**
 * チャット履歴テーブルコンストラクト
 * チャット履歴管理用DynamoDBテーブル
 */
import { Construct } from 'constructs';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
export interface ChatHistoryTableConstructProps {
    tableName: string;
    environment: string;
}
/**
 * チャット履歴管理用DynamoDBテーブル
 *
 * 機能:
 * - ユーザー別チャット履歴の管理
 * - 時系列でのチャット検索
 * - メッセージ内容の永続化
 * - 検索・フィルタリング機能のサポート
 */
export declare class ChatHistoryTableConstruct extends Construct {
    readonly table: Table;
    constructor(scope: Construct, id: string, props: ChatHistoryTableConstructProps);
}
