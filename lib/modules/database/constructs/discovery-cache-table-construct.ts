/**
 * 動的設定キャッシュテーブルコンストラクト
 * モデル・プロバイダー・リージョン情報の動的キャッシュ用DynamoDBテーブル
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
export class DiscoveryCacheTableConstruct extends Construct {
  public readonly table: Table;

  constructor(scope: Construct, id: string, props: DiscoveryCacheTableConstructProps) {
    super(scope, id);

    this.table = new Table(this, 'DiscoveryCacheTable', {
      tableName: props.tableName,
      
      // パーティションキー: キャッシュキー
      partitionKey: {
        name: 'cacheKey',
        type: AttributeType.STRING
      },
      
      billingMode: BillingMode.PAY_PER_REQUEST,
      
      // TTL設定（6時間でキャッシュ更新）
      timeToLiveAttribute: 'expiresAt',
      
      removalPolicy: props.environment === 'prod' 
        ? RemovalPolicy.RETAIN 
        : RemovalPolicy.DESTROY,

      pointInTimeRecovery: props.environment === 'prod',
      encryption: TableEncryption.AWS_MANAGED,
    });

    // GSI: リージョン別キャッシュ検索用
    this.table.addGlobalSecondaryIndex({
      indexName: 'RegionIndex',
      partitionKey: {
        name: 'region',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'createdAt',
        type: AttributeType.NUMBER
      },
      projectionType: ProjectionType.ALL
    });

    // GSI: データタイプ別キャッシュ検索用
    this.table.addGlobalSecondaryIndex({
      indexName: 'DataTypeIndex',
      partitionKey: {
        name: 'dataType',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'createdAt',
        type: AttributeType.NUMBER
      },
      projectionType: ProjectionType.ALL
    });
  }
}