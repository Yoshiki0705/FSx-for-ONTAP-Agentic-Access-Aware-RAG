/**
 * チャット履歴テーブルコンストラクト
 * チャット履歴管理用DynamoDBテーブル
 */

import { Construct } from 'constructs';
import { 
  Table, 
  AttributeType, 
  BillingMode, 
  ProjectionType,
  TableEncryption 
} from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';

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
export class ChatHistoryTableConstruct extends Construct {
  public readonly table: Table;

  constructor(scope: Construct, id: string, props: ChatHistoryTableConstructProps) {
    super(scope, id);

    this.table = new Table(this, 'ChatHistoryTable', {
      tableName: props.tableName,
      
      // 複合キー: ユーザーID + チャットID
      partitionKey: {
        name: 'userId',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'chatId',
        type: AttributeType.STRING
      },
      
      billingMode: BillingMode.PAY_PER_REQUEST,
      
      removalPolicy: props.environment === 'prod' 
        ? RemovalPolicy.RETAIN 
        : RemovalPolicy.DESTROY,

      pointInTimeRecovery: props.environment === 'prod',
      encryption: TableEncryption.AWS_MANAGED,
    });

    // GSI: 時系列でのチャット検索用
    this.table.addGlobalSecondaryIndex({
      indexName: 'TimeIndex',
      partitionKey: {
        name: 'userId',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'updatedAt',
        type: AttributeType.NUMBER
      },
      projectionType: ProjectionType.ALL
    });

    // GSI: モデル別チャット検索用
    this.table.addGlobalSecondaryIndex({
      indexName: 'ModelIndex',
      partitionKey: {
        name: 'userId',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'modelId',
        type: AttributeType.STRING
      },
      projectionType: ProjectionType.KEYS_ONLY
    });
  }
}