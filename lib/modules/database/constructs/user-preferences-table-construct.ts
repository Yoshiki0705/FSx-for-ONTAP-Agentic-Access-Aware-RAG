/**
 * ユーザー設定テーブルコンストラクト
 * 設定永続化システム用DynamoDBテーブル
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
export class UserPreferencesTableConstruct extends Construct {
  public readonly table: Table;

  constructor(scope: Construct, id: string, props: UserPreferencesTableConstructProps) {
    super(scope, id);

    this.table = new Table(this, 'UserPreferencesTable', {
      tableName: props.tableName,
      
      // 複合キー: ユーザーID + カテゴリ
      partitionKey: {
        name: 'userId',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'category',
        type: AttributeType.STRING
      },
      
      billingMode: BillingMode.PAY_PER_REQUEST,
      
      removalPolicy: props.environment === 'prod' 
        ? RemovalPolicy.RETAIN 
        : RemovalPolicy.DESTROY,

      pointInTimeRecovery: props.environment === 'prod',
      encryption: TableEncryption.AWS_MANAGED,
    });

    // GSI: カテゴリ別設定の一括取得用
    this.table.addGlobalSecondaryIndex({
      indexName: 'CategoryIndex',
      partitionKey: {
        name: 'category',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'updatedAt',
        type: AttributeType.NUMBER
      },
      projectionType: ProjectionType.ALL
    });
  }
}