/**
 * DataStack - 統合データスタック（モジュラーアーキテクチャ対応）
 * 
 * 機能:
 * - 統合ストレージ・データベースコンストラクトによる一元管理
 * - S3・FSx・DynamoDB・OpenSearchの統合
 * - Agent Steering準拠命名規則対応
 * - 個別スタックデプロイ完全対応
 */

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

// 統合ストレージコンストラクト（モジュラーアーキテクチャ）
import { StorageConstruct } from '../../modules/storage/constructs/storage-construct';

// 統合データベースコンストラクト（モジュラーアーキテクチャ）
import { DatabaseConstruct } from '../../modules/database/constructs/database-construct';

// 機能復旧用データベースコンストラクト
import { SessionTableConstruct } from '../../modules/database/constructs/session-table-construct';
import { UserPreferencesTableConstruct } from '../../modules/database/constructs/user-preferences-table-construct';
import { ChatHistoryTableConstruct } from '../../modules/database/constructs/chat-history-table-construct';
import { DiscoveryCacheTableConstruct } from '../../modules/database/constructs/discovery-cache-table-construct';

// インターフェース
import { StorageConfig } from '../../modules/storage/interfaces/storage-config';
import { DatabaseConfig } from '../../modules/database/interfaces/database-config';

// 他スタックからの依存関係
import { SecurityStack } from './security-stack';

// タグ設定
import { TaggingStrategy, PermissionAwareRAGTags } from '../../config/tagging-config';

export interface DataStackConfig {
  readonly storage: StorageConfig;
  readonly database: DatabaseConfig;
}

export interface DataStackProps extends cdk.StackProps {
  readonly config: DataStackConfig; // 型安全な統合設定オブジェクト
  readonly projectName?: string; // プロジェクト名（オプション）
  readonly securityStack?: SecurityStack; // セキュリティスタック（オプション）
  readonly namingGenerator?: any; // Agent Steering準拠命名ジェネレーター（オプション）
  readonly environment: string; // 環境名（コスト配布用）
  readonly vpc?: any; // VPC（NetworkingStackから）
  readonly privateSubnetIds?: string[]; // プライベートサブネットID（NetworkingStackから）
}

/**
 * 統合データスタック（モジュラーアーキテクチャ対応）
 * 
 * 統合ストレージ・データベースコンストラクトによる一元管理
 * 個別スタックデプロイ完全対応
 */
export class DataStack extends cdk.Stack {
  /** 統合ストレージコンストラクト */
  public readonly storage: StorageConstruct;
  
  /** 統合データベースコンストラクト */
  public readonly database: DatabaseConstruct;
  
  /** S3バケット名（他スタックからの参照用） */
  public readonly s3BucketNames: { [key: string]: string } = {};
  
  /** DynamoDBテーブル名（他スタックからの参照用） */
  public readonly dynamoDbTableNames: { [key: string]: string } = {};
  
  /** OpenSearchドメインエンドポイント（他スタックからの参照用） */
  public openSearchEndpoint?: string;

  /** Permission API用DynamoDBテーブル */
  public userAccessTable?: dynamodb.Table;
  public permissionCacheTable?: dynamodb.Table;
  
  /** チャット履歴用DynamoDBテーブル */
  public chatHistoryTable?: dynamodb.Table;

  /** プロジェクト名（内部参照用） */
  private readonly projectName: string;
  /** 環境名（内部参照用） */
  private readonly environmentName: string;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    // プロパティの初期化
    this.environmentName = props.environment;

    console.log('💾 DataStack初期化開始...');
    console.log('📝 スタック名:', id);
    console.log('🏷️ Agent Steering準拠:', props.namingGenerator ? 'Yes' : 'No');

    // コスト配布タグの適用（FSx for ONTAP専用タグを含む）
    const taggingConfig = PermissionAwareRAGTags.getStandardConfig("permission-aware-rag", 
      props.environment as 'dev' | 'staging' | 'prod'
    );
    TaggingStrategy.applyTagsToStack(this, taggingConfig);

    // 注意: 依存関係は main-deployment-stack.ts で一元管理されます
    // セキュリティスタックとの依存関係は親スタックで設定済み

    // VPCの準備（README.md準拠 - FSx for ONTAPに必要）
    let vpc: ec2.IVpc | undefined;
    let privateSubnetIds: string[] | undefined;

    if (props.vpc) {
      // 既存VPCが提供されている場合
      if (typeof props.vpc === 'object' && 'vpcId' in props.vpc) {
        vpc = ec2.Vpc.fromVpcAttributes(this, 'ImportedVpc', props.vpc);
      } else {
        vpc = props.vpc;
      }
      privateSubnetIds = props.privateSubnetIds;
    } else if (props.config.storage?.fsx?.enabled || props.config.storage?.fsxOntap?.enabled) {
      // FSxが有効な場合、VPCを作成
      console.log('🌐 FSx用VPC作成開始...');
      
      vpc = new ec2.Vpc(this, 'DataStackVpc', {
        maxAzs: 2,
        natGateways: 1,
        subnetConfiguration: [
          {
            name: 'Public',
            subnetType: ec2.SubnetType.PUBLIC,
            cidrMask: 24,
          },
          {
            name: 'Private',
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            cidrMask: 24,
          },
        ],
      });

      privateSubnetIds = vpc.privateSubnets.map(subnet => subnet.subnetId);

      // VPC出力
      new cdk.CfnOutput(this, 'VpcId', {
        value: vpc.vpcId,
        description: 'VPC ID for FSx',
        exportName: `${this.stackName}-VpcId`,
      });

      console.log('✅ FSx用VPC作成完了');
    }

    // 統合ストレージコンストラクト作成（README.md準拠 - S3 + FSx）
    this.storage = new StorageConstruct(this, 'Storage', {
      config: props.config.storage,
      environment: props.environment,
      projectName: props.projectName,
      kmsKey: props.securityStack?.kmsKey,
      vpc: vpc,
      privateSubnetIds: privateSubnetIds,
    });

    // 統合データベースコンストラクト作成
    this.database = new DatabaseConstruct(this, 'Database', {
      config: props.config.database,      environment: props.environment,
      kmsKey: props.securityStack?.kmsKey,
    });

    // Permission API用DynamoDBテーブルの作成
    this.createPermissionApiTables();

    // 他スタックからの参照用プロパティ設定
    this.setupCrossStackReferences();

    // Gateway Construct用S3バケット作成（Phase 4: AgentCore Gateway統合）
    if (props.config.storage?.gateway?.enabled) {
      this.createGatewaySpecsBucket(props);
    }

    // スタック出力
    this.createOutputs();

    // タグ設定
    this.addStackTags();

    console.log('✅ DataStack初期化完了');
  }

  /**
   * S3バケットの型ガード
   */
  private isValidS3Bucket(bucket: unknown): bucket is { bucketName: string } {
    return typeof bucket === 'object' && 
           bucket !== null && 
           'bucketName' in bucket && 
           typeof (bucket as any).bucketName === 'string';
  }

  /**
   * DynamoDBテーブルの型ガード
   */
  private isValidDynamoDbTable(table: unknown): table is { tableName: string } {
    return typeof table === 'object' && 
           table !== null && 
           'tableName' in table && 
           typeof (table as any).tableName === 'string';
  }

  /**
   * 他スタックからの参照用プロパティ設定（型安全性強化版）
   */
  private setupCrossStackReferences(): void {
    try {
      // S3バケット名の設定（型安全性強化）
      if (this.storage.outputs?.s3Buckets) {
        Object.entries(this.storage.outputs.s3Buckets).forEach(([name, bucket]) => {
          if (this.isValidS3Bucket(bucket)) {
            this.s3BucketNames[name] = bucket.bucketName;
          } else {
            console.warn(`⚠️ 無効なS3バケット設定をスキップ: ${name}`);
          }
        });
      }

      // DynamoDBテーブル名の設定（型安全性強化）
      if (this.database.outputs?.dynamoDbTables) {
        Object.entries(this.database.outputs.dynamoDbTables).forEach(([name, table]) => {
          if (this.isValidDynamoDbTable(table)) {
            this.dynamoDbTableNames[name] = table.tableName;
          } else {
            console.warn(`⚠️ 無効なDynamoDBテーブル設定をスキップ: ${name}`);
          }
        });
      }

      // OpenSearchエンドポイントの設定（型安全性強化）
      if (this.database.outputs?.openSearchEndpoint && 
          typeof this.database.outputs.openSearchEndpoint === 'string') {
        this.openSearchEndpoint = this.database.outputs.openSearchEndpoint;
      }

      console.log('🔗 他スタック参照用プロパティ設定完了');
    } catch (error) {
      console.error('❌ 他スタック参照用プロパティ設定エラー:', error);
      throw new Error(`DataStack参照設定に失敗しました: ${error}`);
    }
  }

  /**
   * スタック出力作成（個別デプロイ対応）
   */
  private createOutputs(): void {
    // S3バケット名出力（他スタックからの参照用）
    Object.entries(this.s3BucketNames).forEach(([name, bucketName]) => {
      new cdk.CfnOutput(this, `S3Bucket${name}Name`, {
        value: bucketName,
        description: `S3 ${name} Bucket Name`,
        exportName: `${this.stackName}-S3Bucket${name}Name`,
      });
    });

    // DynamoDBテーブル名出力（他スタックからの参照用）
    Object.entries(this.dynamoDbTableNames).forEach(([name, tableName]) => {
      new cdk.CfnOutput(this, `DynamoDb${name}TableName`, {
        value: tableName,
        description: `DynamoDB ${name} Table Name`,
        exportName: `${this.stackName}-DynamoDb${name}TableName`,
      });
    });

    // OpenSearchエンドポイント出力（存在する場合のみ）
    if (this.openSearchEndpoint) {
      new cdk.CfnOutput(this, 'OpenSearchEndpoint', {
        value: this.openSearchEndpoint,
        description: 'OpenSearch Domain Endpoint',
        exportName: `${this.stackName}-OpenSearchEndpoint`,
      });
    }

    // ストレージ統合出力（存在する場合のみ）
    if (this.storage.outputs) {
      // FSx File System ID
      if (this.storage.outputs.fsxFileSystemId) {
        new cdk.CfnOutput(this, 'FsxFileSystemId', {
          value: this.storage.outputs.fsxFileSystemId,
          description: 'FSx for NetApp ONTAP File System ID',
          exportName: `${this.stackName}-FsxFileSystemId`,
        });
      }

      // FSx S3 Access Point ARN（動的取得）
      if (this.storage.outputs.fsxS3AccessPointArn) {
        new cdk.CfnOutput(this, 'FsxS3AccessPointArn', {
          value: this.storage.outputs.fsxS3AccessPointArn,
          description: 'FSx for ONTAP S3 Access Point ARN',
          exportName: `${this.stackName}-FsxS3AccessPointArn`,
        });
      }

      // FSx S3 Access Point Alias（動的取得）
      if (this.storage.outputs.fsxS3AccessPointAlias) {
        new cdk.CfnOutput(this, 'FsxS3AccessPointAlias', {
          value: this.storage.outputs.fsxS3AccessPointAlias,
          description: 'FSx for ONTAP S3 Access Point Alias',
          exportName: `${this.stackName}-FsxS3AccessPointAlias`,
        });
      }
    }

    console.log('📤 DataStack出力値作成完了');
  }

  /**
   * スタックタグ設定（統一タグ戦略準拠）
   */
  private addStackTags(): void {
    try {
      // プロジェクト標準タグ設定を取得（propsから取得）
      const taggingConfig = PermissionAwareRAGTags.getStandardConfig("permission-aware-rag", 
        (this.environmentName || 'dev') as 'dev' | 'staging' | 'prod'
      );
      
      // 環境別タグ設定をマージ
      const envConfig = PermissionAwareRAGTags.getEnvironmentConfig((this.environmentName || 'dev') as 'dev' | 'staging' | 'prod');
      const mergedConfig = { ...taggingConfig, ...envConfig };
      
      // セキュリティ要件タグをマージ
      const securityConfig = PermissionAwareRAGTags.getSecurityConfig((this.environmentName || 'dev') as 'dev' | 'staging' | 'prod');
      const finalConfig = { ...mergedConfig, ...securityConfig };
      
      // データスタック固有のカスタムタグを追加
      finalConfig.customTags = {
        ...finalConfig.customTags,
        'Module': 'Storage+Database',
        'StackType': 'Integrated',
        'Architecture': 'Modular',
        'DatabaseTypes': 'DynamoDB+OpenSearch',
        'IndividualDeploySupport': 'Yes',
        'Data-Classification': 'Sensitive',
        'Backup-Required': 'true',
        'Encryption-Required': 'true',
      };
      
      // 統一タグ戦略を適用
      TaggingStrategy.applyTagsToStack(this, finalConfig);
      
      console.log('🏷️ DataStack統一タグ設定完了');
    } catch (error) {
      console.error('❌ DataStackタグ設定エラー:', error);
      
      // フォールバック: 基本タグのみ設定
      cdk.Tags.of(this).add('Module', 'Storage+Database');
      cdk.Tags.of(this).add('StackType', 'Integrated');
      cdk.Tags.of(this).add('ManagedBy', 'CDK');
      
      console.log('⚠️ DataStackフォールバックタグ設定完了');
    }
  }



  /**
   * 機能復旧用DynamoDBテーブルの作成
   * 
   * 作成するテーブル:
   * 1. セッション管理テーブル - 認証セッションの永続化
   * 2. ユーザー設定テーブル - テーマ・言語・リージョン設定の永続化
   * 3. チャット履歴テーブル - チャット履歴の管理
   * 4. 動的設定キャッシュテーブル - モデル・プロバイダー情報のキャッシュ
   * 5. Permission API用テーブル - ユーザーアクセス・権限キャッシュ
   */
  private createPermissionApiTables(): void {
    console.log('📊 機能復旧用DynamoDBテーブル作成開始...');

    // 1. セッション管理テーブル（機能復旧 - 要件1）
    const sessionTable = new SessionTableConstruct(this, 'SessionTable', {
      tableName: `${this.environmentName}-sessions`,
      environment: this.environmentName,
    });
    this.dynamoDbTableNames['sessions'] = sessionTable.table.tableName;

    // 2. ユーザー設定テーブル（機能復旧 - 要件2）
    const userPreferencesTable = new UserPreferencesTableConstruct(this, 'UserPreferencesTable', {
      tableName: `${this.environmentName}-user-preferences`,
      environment: this.environmentName,
    });
    this.dynamoDbTableNames['userPreferences'] = userPreferencesTable.table.tableName;

    // 3. チャット履歴テーブル（機能復旧 - 要件12）
    const chatHistoryTable = new ChatHistoryTableConstruct(this, 'ChatHistoryTable', {
      tableName: `${this.environmentName}-chat-history`,
      environment: this.environmentName,
    });
    this.dynamoDbTableNames['chatHistory'] = chatHistoryTable.table.tableName;
    this.chatHistoryTable = chatHistoryTable.table;

    // 4. 動的設定キャッシュテーブル（機能復旧 - 要件4）
    const discoveryCacheTable = new DiscoveryCacheTableConstruct(this, 'DiscoveryCacheTable', {
      tableName: `${this.environmentName}-discovery-cache`,
      environment: this.environmentName,
    });
    this.dynamoDbTableNames['discoveryCache'] = discoveryCacheTable.table.tableName;

    // 5. Permission API用テーブル
    // ユーザーアクセステーブル
    this.userAccessTable = new dynamodb.Table(this, 'UserAccessTable', {
      tableName: `${this.environmentName}-user-access-table`,
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: this.environmentName === 'prod',
      removalPolicy: this.environmentName === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
    });
    this.dynamoDbTableNames['userAccess'] = this.userAccessTable.tableName;

    // 権限キャッシュテーブル
    this.permissionCacheTable = new dynamodb.Table(this, 'PermissionCacheTable', {
      tableName: `${this.environmentName}-permission-cache`,
      partitionKey: {
        name: 'cacheKey',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // キャッシュは削除可能
    });
    this.dynamoDbTableNames['permissionCache'] = this.permissionCacheTable.tableName;

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'SessionTableName', {
      value: sessionTable.table.tableName,
      description: 'Session Management Table Name',
      exportName: `${this.stackName}-SessionTableName`,
    });

    new cdk.CfnOutput(this, 'UserPreferencesTableName', {
      value: userPreferencesTable.table.tableName,
      description: 'User Preferences Table Name',
      exportName: `${this.stackName}-UserPreferencesTableName`,
    });

    new cdk.CfnOutput(this, 'ChatHistoryTableName', {
      value: chatHistoryTable.table.tableName,
      description: 'Chat History Table Name',
      exportName: `${this.stackName}-ChatHistoryTableName`,
    });

    new cdk.CfnOutput(this, 'DiscoveryCacheTableName', {
      value: discoveryCacheTable.table.tableName,
      description: 'Discovery Cache Table Name',
      exportName: `${this.stackName}-DiscoveryCacheTableName`,
    });

    new cdk.CfnOutput(this, 'UserAccessTableName', {
      value: this.userAccessTable.tableName,
      description: 'User Access Table Name for Permission API',
      exportName: `${this.stackName}-UserAccessTableName`,
    });

    new cdk.CfnOutput(this, 'PermissionCacheTableName', {
      value: this.permissionCacheTable.tableName,
      description: 'Permission Cache Table Name',
      exportName: `${this.stackName}-PermissionCacheTableName`,
    });

    console.log('✅ 機能復旧用DynamoDBテーブル作成完了');
  }

  /**
   * Gateway Construct用S3バケット作成（Phase 4: AgentCore Gateway統合）
   */
  private createGatewaySpecsBucket(props: DataStackProps): void {
    console.log('📦 Gateway用S3バケット作成中...');
    
    const gatewayBucketName = props.config.storage?.gateway?.bucketNamePrefix 
      ? `${props.config.storage.gateway.bucketNamePrefix}-${props.environment}`
      : `${props.projectName}-${props.environment}-gateway-specs`;
    
    const gatewayBucket = new s3.Bucket(this, 'GatewaySpecsBucket', {
      bucketName: gatewayBucketName,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
      removalPolicy: props.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.environment !== 'prod',
    });
    
    // S3バケット名を出力（他スタックからの参照用）
    this.s3BucketNames['gatewaySpecs'] = gatewayBucket.bucketName;
    
    // CloudFormation Output
    new cdk.CfnOutput(this, 'GatewaySpecsBucketName', {
      value: gatewayBucket.bucketName,
      description: 'Gateway Specs S3 Bucket Name',
      exportName: `${this.stackName}-GatewaySpecsBucketName`,
    });
    
    new cdk.CfnOutput(this, 'GatewaySpecsBucketArn', {
      value: gatewayBucket.bucketArn,
      description: 'Gateway Specs S3 Bucket ARN',
      exportName: `${this.stackName}-GatewaySpecsBucketArn`,
    });
    
    // サンプルOpenAPI仕様をデプロイ時に作成（オプション）
    if (props.config.storage?.gateway?.deploySpecs !== false) {
      new s3deploy.BucketDeployment(this, 'GatewaySpecsDeployment', {
        sources: [
          s3deploy.Source.data(
            'openapi/sample-openapi.yaml', 
            this.getSampleOpenApiSpec()
          )
        ],
        destinationBucket: gatewayBucket,
      });
    }
    
    console.log('✅ Gateway用S3バケット作成完了');
  }

  /**
   * サンプルOpenAPI仕様生成メソッド
   */
  private getSampleOpenApiSpec(): string {
    return `openapi: 3.0.0
info:
  title: FSx for ONTAP Document API
  description: API for accessing documents stored in FSx for ONTAP via S3 Access Points
  version: 1.0.0
servers:
  - url: https://api.example.com/v1
    description: Production server
paths:
  /documents:
    get:
      summary: List documents
      description: Retrieve a list of documents accessible via FSx for ONTAP
      operationId: listDocuments
      parameters:
        - name: limit
          in: query
          description: Maximum number of documents to return
          required: false
          schema:
            type: integer
            default: 10
            minimum: 1
            maximum: 100
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  documents:
                    type: array
                    items:
                      $ref: '#/components/schemas/Document'
components:
  schemas:
    Document:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        path:
          type: string
        size:
          type: integer
        lastModified:
          type: string
          format: date-time`;
  }
}
