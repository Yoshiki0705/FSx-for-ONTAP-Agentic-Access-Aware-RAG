"use strict";
/**
 * DataStack - 統合データスタック（モジュラーアーキテクチャ対応）
 *
 * 機能:
 * - 統合ストレージ・データベースコンストラクトによる一元管理
 * - S3・FSx・DynamoDB・OpenSearchの統合
 * - Agent Steering準拠命名規則対応
 * - 個別スタックデプロイ完全対応
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const s3deploy = __importStar(require("aws-cdk-lib/aws-s3-deployment"));
// 統合ストレージコンストラクト（モジュラーアーキテクチャ）
const storage_construct_1 = require("../../modules/storage/constructs/storage-construct");
// 統合データベースコンストラクト（モジュラーアーキテクチャ）
const database_construct_1 = require("../../modules/database/constructs/database-construct");
// 機能復旧用データベースコンストラクト
const session_table_construct_1 = require("../../modules/database/constructs/session-table-construct");
const user_preferences_table_construct_1 = require("../../modules/database/constructs/user-preferences-table-construct");
const chat_history_table_construct_1 = require("../../modules/database/constructs/chat-history-table-construct");
const discovery_cache_table_construct_1 = require("../../modules/database/constructs/discovery-cache-table-construct");
// タグ設定
const tagging_config_1 = require("../../config/tagging-config");
/**
 * 統合データスタック（モジュラーアーキテクチャ対応）
 *
 * 統合ストレージ・データベースコンストラクトによる一元管理
 * 個別スタックデプロイ完全対応
 */
class DataStack extends cdk.Stack {
    /** 統合ストレージコンストラクト */
    storage;
    /** 統合データベースコンストラクト */
    database;
    /** S3バケット名（他スタックからの参照用） */
    s3BucketNames = {};
    /** DynamoDBテーブル名（他スタックからの参照用） */
    dynamoDbTableNames = {};
    /** OpenSearchドメインエンドポイント（他スタックからの参照用） */
    openSearchEndpoint;
    /** Permission API用DynamoDBテーブル */
    userAccessTable;
    permissionCacheTable;
    /** チャット履歴用DynamoDBテーブル */
    chatHistoryTable;
    /** プロジェクト名（内部参照用） */
    projectName;
    /** 環境名（内部参照用） */
    environmentName;
    constructor(scope, id, props) {
        super(scope, id, props);
        // プロパティの初期化
        this.environmentName = props.environment;
        console.log('💾 DataStack初期化開始...');
        console.log('📝 スタック名:', id);
        console.log('🏷️ Agent Steering準拠:', props.namingGenerator ? 'Yes' : 'No');
        // コスト配布タグの適用（FSx for ONTAP専用タグを含む）
        const taggingConfig = tagging_config_1.PermissionAwareRAGTags.getStandardConfig("permission-aware-rag", props.environment);
        tagging_config_1.TaggingStrategy.applyTagsToStack(this, taggingConfig);
        // 注意: 依存関係は main-deployment-stack.ts で一元管理されます
        // セキュリティスタックとの依存関係は親スタックで設定済み
        // VPCの準備（README.md準拠 - FSx for ONTAPに必要）
        let vpc;
        let privateSubnetIds;
        if (props.vpc) {
            // 既存VPCが提供されている場合
            if (typeof props.vpc === 'object' && 'vpcId' in props.vpc) {
                vpc = ec2.Vpc.fromVpcAttributes(this, 'ImportedVpc', props.vpc);
            }
            else {
                vpc = props.vpc;
            }
            privateSubnetIds = props.privateSubnetIds;
        }
        else if (props.config.storage?.fsx?.enabled || props.config.storage?.fsxOntap?.enabled) {
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
        this.storage = new storage_construct_1.StorageConstruct(this, 'Storage', {
            config: props.config.storage,
            environment: props.environment,
            projectName: props.projectName,
            kmsKey: props.securityStack?.kmsKey,
            vpc: vpc,
            privateSubnetIds: privateSubnetIds,
        });
        // 統合データベースコンストラクト作成
        this.database = new database_construct_1.DatabaseConstruct(this, 'Database', {
            config: props.config.database, environment: props.environment,
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
    isValidS3Bucket(bucket) {
        return typeof bucket === 'object' &&
            bucket !== null &&
            'bucketName' in bucket &&
            typeof bucket.bucketName === 'string';
    }
    /**
     * DynamoDBテーブルの型ガード
     */
    isValidDynamoDbTable(table) {
        return typeof table === 'object' &&
            table !== null &&
            'tableName' in table &&
            typeof table.tableName === 'string';
    }
    /**
     * 他スタックからの参照用プロパティ設定（型安全性強化版）
     */
    setupCrossStackReferences() {
        try {
            // S3バケット名の設定（型安全性強化）
            if (this.storage.outputs?.s3Buckets) {
                Object.entries(this.storage.outputs.s3Buckets).forEach(([name, bucket]) => {
                    if (this.isValidS3Bucket(bucket)) {
                        this.s3BucketNames[name] = bucket.bucketName;
                    }
                    else {
                        console.warn(`⚠️ 無効なS3バケット設定をスキップ: ${name}`);
                    }
                });
            }
            // DynamoDBテーブル名の設定（型安全性強化）
            if (this.database.outputs?.dynamoDbTables) {
                Object.entries(this.database.outputs.dynamoDbTables).forEach(([name, table]) => {
                    if (this.isValidDynamoDbTable(table)) {
                        this.dynamoDbTableNames[name] = table.tableName;
                    }
                    else {
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
        }
        catch (error) {
            console.error('❌ 他スタック参照用プロパティ設定エラー:', error);
            throw new Error(`DataStack参照設定に失敗しました: ${error}`);
        }
    }
    /**
     * スタック出力作成（個別デプロイ対応）
     */
    createOutputs() {
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
    addStackTags() {
        try {
            // プロジェクト標準タグ設定を取得（propsから取得）
            const taggingConfig = tagging_config_1.PermissionAwareRAGTags.getStandardConfig("permission-aware-rag", (this.environmentName || 'dev'));
            // 環境別タグ設定をマージ
            const envConfig = tagging_config_1.PermissionAwareRAGTags.getEnvironmentConfig((this.environmentName || 'dev'));
            const mergedConfig = { ...taggingConfig, ...envConfig };
            // セキュリティ要件タグをマージ
            const securityConfig = tagging_config_1.PermissionAwareRAGTags.getSecurityConfig((this.environmentName || 'dev'));
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
            tagging_config_1.TaggingStrategy.applyTagsToStack(this, finalConfig);
            console.log('🏷️ DataStack統一タグ設定完了');
        }
        catch (error) {
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
    createPermissionApiTables() {
        console.log('📊 機能復旧用DynamoDBテーブル作成開始...');
        // 1. セッション管理テーブル（機能復旧 - 要件1）
        const sessionTable = new session_table_construct_1.SessionTableConstruct(this, 'SessionTable', {
            tableName: `${this.environmentName}-sessions`,
            environment: this.environmentName,
        });
        this.dynamoDbTableNames['sessions'] = sessionTable.table.tableName;
        // 2. ユーザー設定テーブル（機能復旧 - 要件2）
        const userPreferencesTable = new user_preferences_table_construct_1.UserPreferencesTableConstruct(this, 'UserPreferencesTable', {
            tableName: `${this.environmentName}-user-preferences`,
            environment: this.environmentName,
        });
        this.dynamoDbTableNames['userPreferences'] = userPreferencesTable.table.tableName;
        // 3. チャット履歴テーブル（機能復旧 - 要件12）
        const chatHistoryTable = new chat_history_table_construct_1.ChatHistoryTableConstruct(this, 'ChatHistoryTable', {
            tableName: `${this.environmentName}-chat-history`,
            environment: this.environmentName,
        });
        this.dynamoDbTableNames['chatHistory'] = chatHistoryTable.table.tableName;
        this.chatHistoryTable = chatHistoryTable.table;
        // 4. 動的設定キャッシュテーブル（機能復旧 - 要件4）
        const discoveryCacheTable = new discovery_cache_table_construct_1.DiscoveryCacheTableConstruct(this, 'DiscoveryCacheTable', {
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
    createGatewaySpecsBucket(props) {
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
                    s3deploy.Source.data('openapi/sample-openapi.yaml', this.getSampleOpenApiSpec())
                ],
                destinationBucket: gatewayBucket,
            });
        }
        console.log('✅ Gateway用S3バケット作成完了');
    }
    /**
     * サンプルOpenAPI仕様生成メソッド
     */
    getSampleOpenApiSpec() {
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
exports.DataStack = DataStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRhdGEtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7OztHQVFHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQyxtRUFBcUQ7QUFDckQseURBQTJDO0FBQzNDLHVEQUF5QztBQUN6Qyx3RUFBMEQ7QUFHMUQsK0JBQStCO0FBQy9CLDBGQUFzRjtBQUV0RixnQ0FBZ0M7QUFDaEMsNkZBQXlGO0FBRXpGLHFCQUFxQjtBQUNyQix1R0FBa0c7QUFDbEcseUhBQW1IO0FBQ25ILGlIQUEyRztBQUMzRyx1SEFBaUg7QUFTakgsT0FBTztBQUNQLGdFQUFzRjtBQWlCdEY7Ozs7O0dBS0c7QUFDSCxNQUFhLFNBQVUsU0FBUSxHQUFHLENBQUMsS0FBSztJQUN0QyxxQkFBcUI7SUFDTCxPQUFPLENBQW1CO0lBRTFDLHNCQUFzQjtJQUNOLFFBQVEsQ0FBb0I7SUFFNUMsMkJBQTJCO0lBQ1gsYUFBYSxHQUE4QixFQUFFLENBQUM7SUFFOUQsaUNBQWlDO0lBQ2pCLGtCQUFrQixHQUE4QixFQUFFLENBQUM7SUFFbkUseUNBQXlDO0lBQ2xDLGtCQUFrQixDQUFVO0lBRW5DLGtDQUFrQztJQUMzQixlQUFlLENBQWtCO0lBQ2pDLG9CQUFvQixDQUFrQjtJQUU3QywwQkFBMEI7SUFDbkIsZ0JBQWdCLENBQWtCO0lBRXpDLHFCQUFxQjtJQUNKLFdBQVcsQ0FBUztJQUNyQyxpQkFBaUI7SUFDQSxlQUFlLENBQVM7SUFFekMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFxQjtRQUM3RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixZQUFZO1FBQ1osSUFBSSxDQUFDLGVBQWUsR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDO1FBRXpDLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsQ0FBQztRQUNw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RUFBRSx3QkFBd0IsRUFBRTtnQkFDNUQsT0FBTyxFQUFFO29CQUNQLFFBQVEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUNsQiw2QkFBNkIsRUFDN0IsSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQzVCO2lCQUNGO2dCQUNELGlCQUFpQixFQUFFLGFBQWE7YUFDakMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELE9BQU8sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBRUQ7O09BRUc7SUFDSyxvQkFBb0I7UUFDMUIsT0FBTzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzRCQW1EaUIsQ0FBQztJQUMzQixDQUFDO0NBQ0Y7QUFuaEJELDhCQW1oQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIERhdGFTdGFjayAtIOe1seWQiOODh+ODvOOCv+OCueOCv+ODg+OCr++8iOODouOCuOODpeODqeODvOOCouODvOOCreODhuOCr+ODgeODo+WvvuW/nO+8iVxuICogXG4gKiDmqZ/og706XG4gKiAtIOe1seWQiOOCueODiOODrOODvOOCuOODu+ODh+ODvOOCv+ODmeODvOOCueOCs+ODs+OCueODiOODqeOCr+ODiOOBq+OCiOOCi+S4gOWFg+euoeeQhlxuICogLSBTM+ODu0ZTeOODu0R5bmFtb0RC44O7T3BlblNlYXJjaOOBrue1seWQiFxuICogLSBBZ2VudCBTdGVlcmluZ+a6luaLoOWRveWQjeimj+WJh+WvvuW/nFxuICogLSDlgIvliKXjgrnjgr/jg4Pjgq/jg4fjg5fjg63jgqTlrozlhajlr77lv5xcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBzM2RlcGxveSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMtZGVwbG95bWVudCc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuLy8g57Wx5ZCI44K544OI44Os44O844K444Kz44Oz44K544OI44Op44Kv44OI77yI44Oi44K444Ol44Op44O844Ki44O844Kt44OG44Kv44OB44Oj77yJXG5pbXBvcnQgeyBTdG9yYWdlQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9zdG9yYWdlL2NvbnN0cnVjdHMvc3RvcmFnZS1jb25zdHJ1Y3QnO1xuXG4vLyDntbHlkIjjg4fjg7zjgr/jg5njg7zjgrnjgrPjg7Pjgrnjg4jjg6njgq/jg4jvvIjjg6Ljgrjjg6Xjg6njg7zjgqLjg7zjgq3jg4bjgq/jg4Hjg6PvvIlcbmltcG9ydCB7IERhdGFiYXNlQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9kYXRhYmFzZS9jb25zdHJ1Y3RzL2RhdGFiYXNlLWNvbnN0cnVjdCc7XG5cbi8vIOapn+iDveW+qeaXp+eUqOODh+ODvOOCv+ODmeODvOOCueOCs+ODs+OCueODiOODqeOCr+ODiFxuaW1wb3J0IHsgU2Vzc2lvblRhYmxlQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9kYXRhYmFzZS9jb25zdHJ1Y3RzL3Nlc3Npb24tdGFibGUtY29uc3RydWN0JztcbmltcG9ydCB7IFVzZXJQcmVmZXJlbmNlc1RhYmxlQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9kYXRhYmFzZS9jb25zdHJ1Y3RzL3VzZXItcHJlZmVyZW5jZXMtdGFibGUtY29uc3RydWN0JztcbmltcG9ydCB7IENoYXRIaXN0b3J5VGFibGVDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi9tb2R1bGVzL2RhdGFiYXNlL2NvbnN0cnVjdHMvY2hhdC1oaXN0b3J5LXRhYmxlLWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBEaXNjb3ZlcnlDYWNoZVRhYmxlQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9kYXRhYmFzZS9jb25zdHJ1Y3RzL2Rpc2NvdmVyeS1jYWNoZS10YWJsZS1jb25zdHJ1Y3QnO1xuXG4vLyDjgqTjg7Pjgr/jg7zjg5Xjgqfjg7zjgrlcbmltcG9ydCB7IFN0b3JhZ2VDb25maWcgfSBmcm9tICcuLi8uLi9tb2R1bGVzL3N0b3JhZ2UvaW50ZXJmYWNlcy9zdG9yYWdlLWNvbmZpZyc7XG5pbXBvcnQgeyBEYXRhYmFzZUNvbmZpZyB9IGZyb20gJy4uLy4uL21vZHVsZXMvZGF0YWJhc2UvaW50ZXJmYWNlcy9kYXRhYmFzZS1jb25maWcnO1xuXG4vLyDku5bjgrnjgr/jg4Pjgq/jgYvjgonjga7kvp3lrZjplqLkv4JcbmltcG9ydCB7IFNlY3VyaXR5U3RhY2sgfSBmcm9tICcuL3NlY3VyaXR5LXN0YWNrJztcblxuLy8g44K/44Kw6Kit5a6aXG5pbXBvcnQgeyBUYWdnaW5nU3RyYXRlZ3ksIFBlcm1pc3Npb25Bd2FyZVJBR1RhZ3MgfSBmcm9tICcuLi8uLi9jb25maWcvdGFnZ2luZy1jb25maWcnO1xuXG5leHBvcnQgaW50ZXJmYWNlIERhdGFTdGFja0NvbmZpZyB7XG4gIHJlYWRvbmx5IHN0b3JhZ2U6IFN0b3JhZ2VDb25maWc7XG4gIHJlYWRvbmx5IGRhdGFiYXNlOiBEYXRhYmFzZUNvbmZpZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBEYXRhU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgcmVhZG9ubHkgY29uZmlnOiBEYXRhU3RhY2tDb25maWc7IC8vIOWei+WuieWFqOOBque1seWQiOioreWumuOCquODluOCuOOCp+OCr+ODiFxuICByZWFkb25seSBwcm9qZWN0TmFtZT86IHN0cmluZzsgLy8g44OX44Ot44K444Kn44Kv44OI5ZCN77yI44Kq44OX44K344On44Oz77yJXG4gIHJlYWRvbmx5IHNlY3VyaXR5U3RhY2s/OiBTZWN1cml0eVN0YWNrOyAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPjgrnjgr/jg4Pjgq/vvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgcmVhZG9ubHkgbmFtaW5nR2VuZXJhdG9yPzogYW55OyAvLyBBZ2VudCBTdGVlcmluZ+a6luaLoOWRveWQjeOCuOOCp+ODjeODrOODvOOCv+ODvO+8iOOCquODl+OCt+ODp+ODs++8iVxuICByZWFkb25seSBlbnZpcm9ubWVudDogc3RyaW5nOyAvLyDnkrDlooPlkI3vvIjjgrPjgrnjg4jphY3luIPnlKjvvIlcbiAgcmVhZG9ubHkgdnBjPzogYW55OyAvLyBWUEPvvIhOZXR3b3JraW5nU3RhY2vjgYvjgonvvIlcbiAgcmVhZG9ubHkgcHJpdmF0ZVN1Ym5ldElkcz86IHN0cmluZ1tdOyAvLyDjg5fjg6njgqTjg5njg7zjg4jjgrXjg5bjg43jg4Pjg4hJRO+8iE5ldHdvcmtpbmdTdGFja+OBi+OCie+8iVxufVxuXG4vKipcbiAqIOe1seWQiOODh+ODvOOCv+OCueOCv+ODg+OCr++8iOODouOCuOODpeODqeODvOOCouODvOOCreODhuOCr+ODgeODo+WvvuW/nO+8iVxuICogXG4gKiDntbHlkIjjgrnjg4jjg6zjg7zjgrjjg7vjg4fjg7zjgr/jg5njg7zjgrnjgrPjg7Pjgrnjg4jjg6njgq/jg4jjgavjgojjgovkuIDlhYPnrqHnkIZcbiAqIOWAi+WIpeOCueOCv+ODg+OCr+ODh+ODl+ODreOCpOWujOWFqOWvvuW/nFxuICovXG5leHBvcnQgY2xhc3MgRGF0YVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgLyoqIOe1seWQiOOCueODiOODrOODvOOCuOOCs+ODs+OCueODiOODqeOCr+ODiCAqL1xuICBwdWJsaWMgcmVhZG9ubHkgc3RvcmFnZTogU3RvcmFnZUNvbnN0cnVjdDtcbiAgXG4gIC8qKiDntbHlkIjjg4fjg7zjgr/jg5njg7zjgrnjgrPjg7Pjgrnjg4jjg6njgq/jg4ggKi9cbiAgcHVibGljIHJlYWRvbmx5IGRhdGFiYXNlOiBEYXRhYmFzZUNvbnN0cnVjdDtcbiAgXG4gIC8qKiBTM+ODkOOCseODg+ODiOWQje+8iOS7luOCueOCv+ODg+OCr+OBi+OCieOBruWPgueFp+eUqO+8iSAqL1xuICBwdWJsaWMgcmVhZG9ubHkgczNCdWNrZXROYW1lczogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9O1xuICBcbiAgLyoqIER5bmFtb0RC44OG44O844OW44Or5ZCN77yI5LuW44K544K/44OD44Kv44GL44KJ44Gu5Y+C54Wn55So77yJICovXG4gIHB1YmxpYyByZWFkb25seSBkeW5hbW9EYlRhYmxlTmFtZXM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7fTtcbiAgXG4gIC8qKiBPcGVuU2VhcmNo44OJ44Oh44Kk44Oz44Ko44Oz44OJ44Od44Kk44Oz44OI77yI5LuW44K544K/44OD44Kv44GL44KJ44Gu5Y+C54Wn55So77yJICovXG4gIHB1YmxpYyBvcGVuU2VhcmNoRW5kcG9pbnQ/OiBzdHJpbmc7XG5cbiAgLyoqIFBlcm1pc3Npb24gQVBJ55SoRHluYW1vRELjg4bjg7zjg5bjg6sgKi9cbiAgcHVibGljIHVzZXJBY2Nlc3NUYWJsZT86IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcGVybWlzc2lvbkNhY2hlVGFibGU/OiBkeW5hbW9kYi5UYWJsZTtcbiAgXG4gIC8qKiDjg4Hjg6Pjg4Pjg4jlsaXmrbTnlKhEeW5hbW9EQuODhuODvOODluODqyAqL1xuICBwdWJsaWMgY2hhdEhpc3RvcnlUYWJsZT86IGR5bmFtb2RiLlRhYmxlO1xuXG4gIC8qKiDjg5fjg63jgrjjgqfjgq/jg4jlkI3vvIjlhoXpg6jlj4LnhafnlKjvvIkgKi9cbiAgcHJpdmF0ZSByZWFkb25seSBwcm9qZWN0TmFtZTogc3RyaW5nO1xuICAvKiog55Kw5aKD5ZCN77yI5YaF6YOo5Y+C54Wn55So77yJICovXG4gIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnROYW1lOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IERhdGFTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyDjg5fjg63jg5Hjg4bjgqPjga7liJ3mnJ/ljJZcbiAgICB0aGlzLmVudmlyb25tZW50TmFtZSA9IHByb3BzLmVudmlyb25tZW50O1xuXG4gICAgY29uc29sZS5sb2coJ/Cfkr4gRGF0YVN0YWNr5Yid5pyf5YyW6ZaL5aeLLi4uJyk7XG4gICAgY29uc29sZS5sb2coJ/Cfk50g44K544K/44OD44Kv5ZCNOicsIGlkKTtcbiAgICBjb25zb2xlLmxvZygn8J+Pt++4jyBBZ2VudCBTdGVlcmluZ+a6luaLoDonLCBwcm9wcy5uYW1pbmdHZW5lcmF0b3IgPyAnWWVzJyA6ICdObycpO1xuXG4gICAgLy8g44Kz44K544OI6YWN5biD44K/44Kw44Gu6YGp55So77yIRlN4IGZvciBPTlRBUOWwgueUqOOCv+OCsOOCkuWQq+OCgO+8iVxuICAgIGNvbnN0IHRhZ2dpbmdDb25maWcgPSBQZXJtaXNzaW9uQXdhcmVSQUdUYWdzLmdldFN0YW5kYXJkQ29uZmlnKFwicGVybWlzc2lvbi1hd2FyZS1yYWdcIiwgXG4gICAgICBwcm9wcy5lbnZpcm9ubWVudCBhcyAnZGV2JyB8ICdzdGFnaW5nJyB8ICdwcm9kJ1xuICAgICk7XG4gICAgVGFnZ2luZ1N0cmF0ZWd5LmFwcGx5VGFnc1RvU3RhY2sodGhpcywgdGFnZ2luZ0NvbmZpZyk7XG5cbiAgICAvLyDms6jmhI86IOS+neWtmOmWouS/guOBryBtYWluLWRlcGxveW1lbnQtc3RhY2sudHMg44Gn5LiA5YWD566h55CG44GV44KM44G+44GZXG4gICAgLy8g44K744Kt44Ol44Oq44OG44Kj44K544K/44OD44Kv44Go44Gu5L6d5a2Y6Zai5L+C44Gv6Kaq44K544K/44OD44Kv44Gn6Kit5a6a5riI44G/XG5cbiAgICAvLyBWUEPjga7mupblgpnvvIhSRUFETUUubWTmupbmi6AgLSBGU3ggZm9yIE9OVEFQ44Gr5b+F6KaB77yJXG4gICAgbGV0IHZwYzogZWMyLklWcGMgfCB1bmRlZmluZWQ7XG4gICAgbGV0IHByaXZhdGVTdWJuZXRJZHM6IHN0cmluZ1tdIHwgdW5kZWZpbmVkO1xuXG4gICAgaWYgKHByb3BzLnZwYykge1xuICAgICAgLy8g5pei5a2YVlBD44GM5o+Q5L6b44GV44KM44Gm44GE44KL5aC05ZCIXG4gICAgICBpZiAodHlwZW9mIHByb3BzLnZwYyA9PT0gJ29iamVjdCcgJiYgJ3ZwY0lkJyBpbiBwcm9wcy52cGMpIHtcbiAgICAgICAgdnBjID0gZWMyLlZwYy5mcm9tVnBjQXR0cmlidXRlcyh0aGlzLCAnSW1wb3J0ZWRWcGMnLCBwcm9wcy52cGMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdnBjID0gcHJvcHMudnBjO1xuICAgICAgfVxuICAgICAgcHJpdmF0ZVN1Ym5ldElkcyA9IHByb3BzLnByaXZhdGVTdWJuZXRJZHM7XG4gICAgfSBlbHNlIGlmIChwcm9wcy5jb25maWcuc3RvcmFnZT8uZnN4Py5lbmFibGVkIHx8IHByb3BzLmNvbmZpZy5zdG9yYWdlPy5mc3hPbnRhcD8uZW5hYmxlZCkge1xuICAgICAgLy8gRlN444GM5pyJ5Yq544Gq5aC05ZCI44CBVlBD44KS5L2c5oiQXG4gICAgICBjb25zb2xlLmxvZygn8J+MkCBGU3jnlKhWUEPkvZzmiJDplovlp4suLi4nKTtcbiAgICAgIFxuICAgICAgdnBjID0gbmV3IGVjMi5WcGModGhpcywgJ0RhdGFTdGFja1ZwYycsIHtcbiAgICAgICAgbWF4QXpzOiAyLFxuICAgICAgICBuYXRHYXRld2F5czogMSxcbiAgICAgICAgc3VibmV0Q29uZmlndXJhdGlvbjogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdQdWJsaWMnLFxuICAgICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFVCTElDLFxuICAgICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ1ByaXZhdGUnLFxuICAgICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgICAgICAgIGNpZHJNYXNrOiAyNCxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSk7XG5cbiAgICAgIHByaXZhdGVTdWJuZXRJZHMgPSB2cGMucHJpdmF0ZVN1Ym5ldHMubWFwKHN1Ym5ldCA9PiBzdWJuZXQuc3VibmV0SWQpO1xuXG4gICAgICAvLyBWUEPlh7rliptcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWcGNJZCcsIHtcbiAgICAgICAgdmFsdWU6IHZwYy52cGNJZCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdWUEMgSUQgZm9yIEZTeCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1WcGNJZGAsXG4gICAgICB9KTtcblxuICAgICAgY29uc29sZS5sb2coJ+KchSBGU3jnlKhWUEPkvZzmiJDlrozkuoYnKTtcbiAgICB9XG5cbiAgICAvLyDntbHlkIjjgrnjg4jjg6zjg7zjgrjjgrPjg7Pjgrnjg4jjg6njgq/jg4jkvZzmiJDvvIhSRUFETUUubWTmupbmi6AgLSBTMyArIEZTeO+8iVxuICAgIHRoaXMuc3RvcmFnZSA9IG5ldyBTdG9yYWdlQ29uc3RydWN0KHRoaXMsICdTdG9yYWdlJywge1xuICAgICAgY29uZmlnOiBwcm9wcy5jb25maWcuc3RvcmFnZSxcbiAgICAgIGVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgIHByb2plY3ROYW1lOiBwcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgIGttc0tleTogcHJvcHMuc2VjdXJpdHlTdGFjaz8ua21zS2V5LFxuICAgICAgdnBjOiB2cGMsXG4gICAgICBwcml2YXRlU3VibmV0SWRzOiBwcml2YXRlU3VibmV0SWRzLFxuICAgIH0pO1xuXG4gICAgLy8g57Wx5ZCI44OH44O844K/44OZ44O844K544Kz44Oz44K544OI44Op44Kv44OI5L2c5oiQXG4gICAgdGhpcy5kYXRhYmFzZSA9IG5ldyBEYXRhYmFzZUNvbnN0cnVjdCh0aGlzLCAnRGF0YWJhc2UnLCB7XG4gICAgICBjb25maWc6IHByb3BzLmNvbmZpZy5kYXRhYmFzZSwgICAgICBlbnZpcm9ubWVudDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICBrbXNLZXk6IHByb3BzLnNlY3VyaXR5U3RhY2s/Lmttc0tleSxcbiAgICB9KTtcblxuICAgIC8vIFBlcm1pc3Npb24gQVBJ55SoRHluYW1vRELjg4bjg7zjg5bjg6vjga7kvZzmiJBcbiAgICB0aGlzLmNyZWF0ZVBlcm1pc3Npb25BcGlUYWJsZXMoKTtcblxuICAgIC8vIOS7luOCueOCv+ODg+OCr+OBi+OCieOBruWPgueFp+eUqOODl+ODreODkeODhuOCo+ioreWumlxuICAgIHRoaXMuc2V0dXBDcm9zc1N0YWNrUmVmZXJlbmNlcygpO1xuXG4gICAgLy8gR2F0ZXdheSBDb25zdHJ1Y3TnlKhTM+ODkOOCseODg+ODiOS9nOaIkO+8iFBoYXNlIDQ6IEFnZW50Q29yZSBHYXRld2F557Wx5ZCI77yJXG4gICAgaWYgKHByb3BzLmNvbmZpZy5zdG9yYWdlPy5nYXRld2F5Py5lbmFibGVkKSB7XG4gICAgICB0aGlzLmNyZWF0ZUdhdGV3YXlTcGVjc0J1Y2tldChwcm9wcyk7XG4gICAgfVxuXG4gICAgLy8g44K544K/44OD44Kv5Ye65YqbXG4gICAgdGhpcy5jcmVhdGVPdXRwdXRzKCk7XG5cbiAgICAvLyDjgr/jgrDoqK3lrppcbiAgICB0aGlzLmFkZFN0YWNrVGFncygpO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSBEYXRhU3RhY2vliJ3mnJ/ljJblrozkuoYnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTM+ODkOOCseODg+ODiOOBruWei+OCrOODvOODiVxuICAgKi9cbiAgcHJpdmF0ZSBpc1ZhbGlkUzNCdWNrZXQoYnVja2V0OiB1bmtub3duKTogYnVja2V0IGlzIHsgYnVja2V0TmFtZTogc3RyaW5nIH0ge1xuICAgIHJldHVybiB0eXBlb2YgYnVja2V0ID09PSAnb2JqZWN0JyAmJiBcbiAgICAgICAgICAgYnVja2V0ICE9PSBudWxsICYmIFxuICAgICAgICAgICAnYnVja2V0TmFtZScgaW4gYnVja2V0ICYmIFxuICAgICAgICAgICB0eXBlb2YgKGJ1Y2tldCBhcyBhbnkpLmJ1Y2tldE5hbWUgPT09ICdzdHJpbmcnO1xuICB9XG5cbiAgLyoqXG4gICAqIER5bmFtb0RC44OG44O844OW44Or44Gu5Z6L44Ks44O844OJXG4gICAqL1xuICBwcml2YXRlIGlzVmFsaWREeW5hbW9EYlRhYmxlKHRhYmxlOiB1bmtub3duKTogdGFibGUgaXMgeyB0YWJsZU5hbWU6IHN0cmluZyB9IHtcbiAgICByZXR1cm4gdHlwZW9mIHRhYmxlID09PSAnb2JqZWN0JyAmJiBcbiAgICAgICAgICAgdGFibGUgIT09IG51bGwgJiYgXG4gICAgICAgICAgICd0YWJsZU5hbWUnIGluIHRhYmxlICYmIFxuICAgICAgICAgICB0eXBlb2YgKHRhYmxlIGFzIGFueSkudGFibGVOYW1lID09PSAnc3RyaW5nJztcbiAgfVxuXG4gIC8qKlxuICAgKiDku5bjgrnjgr/jg4Pjgq/jgYvjgonjga7lj4LnhafnlKjjg5fjg63jg5Hjg4bjgqPoqK3lrprvvIjlnovlronlhajmgKflvLfljJbniYjvvIlcbiAgICovXG4gIHByaXZhdGUgc2V0dXBDcm9zc1N0YWNrUmVmZXJlbmNlcygpOiB2b2lkIHtcbiAgICB0cnkge1xuICAgICAgLy8gUzPjg5DjgrHjg4Pjg4jlkI3jga7oqK3lrprvvIjlnovlronlhajmgKflvLfljJbvvIlcbiAgICAgIGlmICh0aGlzLnN0b3JhZ2Uub3V0cHV0cz8uczNCdWNrZXRzKSB7XG4gICAgICAgIE9iamVjdC5lbnRyaWVzKHRoaXMuc3RvcmFnZS5vdXRwdXRzLnMzQnVja2V0cykuZm9yRWFjaCgoW25hbWUsIGJ1Y2tldF0pID0+IHtcbiAgICAgICAgICBpZiAodGhpcy5pc1ZhbGlkUzNCdWNrZXQoYnVja2V0KSkge1xuICAgICAgICAgICAgdGhpcy5zM0J1Y2tldE5hbWVzW25hbWVdID0gYnVja2V0LmJ1Y2tldE5hbWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybihg4pqg77iPIOeEoeWKueOBqlMz44OQ44Kx44OD44OI6Kit5a6a44KS44K544Kt44OD44OXOiAke25hbWV9YCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gRHluYW1vRELjg4bjg7zjg5bjg6vlkI3jga7oqK3lrprvvIjlnovlronlhajmgKflvLfljJbvvIlcbiAgICAgIGlmICh0aGlzLmRhdGFiYXNlLm91dHB1dHM/LmR5bmFtb0RiVGFibGVzKSB7XG4gICAgICAgIE9iamVjdC5lbnRyaWVzKHRoaXMuZGF0YWJhc2Uub3V0cHV0cy5keW5hbW9EYlRhYmxlcykuZm9yRWFjaCgoW25hbWUsIHRhYmxlXSkgPT4ge1xuICAgICAgICAgIGlmICh0aGlzLmlzVmFsaWREeW5hbW9EYlRhYmxlKHRhYmxlKSkge1xuICAgICAgICAgICAgdGhpcy5keW5hbW9EYlRhYmxlTmFtZXNbbmFtZV0gPSB0YWJsZS50YWJsZU5hbWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybihg4pqg77iPIOeEoeWKueOBqkR5bmFtb0RC44OG44O844OW44Or6Kit5a6a44KS44K544Kt44OD44OXOiAke25hbWV9YCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gT3BlblNlYXJjaOOCqOODs+ODieODneOCpOODs+ODiOOBruioreWumu+8iOWei+WuieWFqOaAp+W8t+WMlu+8iVxuICAgICAgaWYgKHRoaXMuZGF0YWJhc2Uub3V0cHV0cz8ub3BlblNlYXJjaEVuZHBvaW50ICYmIFxuICAgICAgICAgIHR5cGVvZiB0aGlzLmRhdGFiYXNlLm91dHB1dHMub3BlblNlYXJjaEVuZHBvaW50ID09PSAnc3RyaW5nJykge1xuICAgICAgICB0aGlzLm9wZW5TZWFyY2hFbmRwb2ludCA9IHRoaXMuZGF0YWJhc2Uub3V0cHV0cy5vcGVuU2VhcmNoRW5kcG9pbnQ7XG4gICAgICB9XG5cbiAgICAgIGNvbnNvbGUubG9nKCfwn5SXIOS7luOCueOCv+ODg+OCr+WPgueFp+eUqOODl+ODreODkeODhuOCo+ioreWumuWujOS6hicpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCfinYwg5LuW44K544K/44OD44Kv5Y+C54Wn55So44OX44Ot44OR44OG44Kj6Kit5a6a44Ko44Op44O8OicsIGVycm9yKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRGF0YVN0YWNr5Y+C54Wn6Kit5a6a44Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yfWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjgrnjgr/jg4Pjgq/lh7rlipvkvZzmiJDvvIjlgIvliKXjg4fjg5fjg63jgqTlr77lv5zvvIlcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlT3V0cHV0cygpOiB2b2lkIHtcbiAgICAvLyBTM+ODkOOCseODg+ODiOWQjeWHuuWKm++8iOS7luOCueOCv+ODg+OCr+OBi+OCieOBruWPgueFp+eUqO+8iVxuICAgIE9iamVjdC5lbnRyaWVzKHRoaXMuczNCdWNrZXROYW1lcykuZm9yRWFjaCgoW25hbWUsIGJ1Y2tldE5hbWVdKSA9PiB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgUzNCdWNrZXQke25hbWV9TmFtZWAsIHtcbiAgICAgICAgdmFsdWU6IGJ1Y2tldE5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgUzMgJHtuYW1lfSBCdWNrZXQgTmFtZWAsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1TM0J1Y2tldCR7bmFtZX1OYW1lYCxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgLy8gRHluYW1vRELjg4bjg7zjg5bjg6vlkI3lh7rlipvvvIjku5bjgrnjgr/jg4Pjgq/jgYvjgonjga7lj4LnhafnlKjvvIlcbiAgICBPYmplY3QuZW50cmllcyh0aGlzLmR5bmFtb0RiVGFibGVOYW1lcykuZm9yRWFjaCgoW25hbWUsIHRhYmxlTmFtZV0pID0+IHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBEeW5hbW9EYiR7bmFtZX1UYWJsZU5hbWVgLCB7XG4gICAgICAgIHZhbHVlOiB0YWJsZU5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgRHluYW1vREIgJHtuYW1lfSBUYWJsZSBOYW1lYCxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUR5bmFtb0RiJHtuYW1lfVRhYmxlTmFtZWAsXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIC8vIE9wZW5TZWFyY2jjgqjjg7Pjg4njg53jgqTjg7Pjg4jlh7rlipvvvIjlrZjlnKjjgZnjgovloLTlkIjjga7jgb/vvIlcbiAgICBpZiAodGhpcy5vcGVuU2VhcmNoRW5kcG9pbnQpIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdPcGVuU2VhcmNoRW5kcG9pbnQnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLm9wZW5TZWFyY2hFbmRwb2ludCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdPcGVuU2VhcmNoIERvbWFpbiBFbmRwb2ludCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1PcGVuU2VhcmNoRW5kcG9pbnRgLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8g44K544OI44Os44O844K457Wx5ZCI5Ye65Yqb77yI5a2Y5Zyo44GZ44KL5aC05ZCI44Gu44G/77yJXG4gICAgaWYgKHRoaXMuc3RvcmFnZS5vdXRwdXRzKSB7XG4gICAgICAvLyBGU3ggRmlsZSBTeXN0ZW0gSURcbiAgICAgIGlmICh0aGlzLnN0b3JhZ2Uub3V0cHV0cy5mc3hGaWxlU3lzdGVtSWQpIHtcbiAgICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0ZzeEZpbGVTeXN0ZW1JZCcsIHtcbiAgICAgICAgICB2YWx1ZTogdGhpcy5zdG9yYWdlLm91dHB1dHMuZnN4RmlsZVN5c3RlbUlkLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRlN4IGZvciBOZXRBcHAgT05UQVAgRmlsZSBTeXN0ZW0gSUQnLFxuICAgICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Gc3hGaWxlU3lzdGVtSWRgLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gRlN4IFMzIEFjY2VzcyBQb2ludCBBUk7vvIjli5XnmoTlj5blvpfvvIlcbiAgICAgIGlmICh0aGlzLnN0b3JhZ2Uub3V0cHV0cy5mc3hTM0FjY2Vzc1BvaW50QXJuKSB7XG4gICAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGc3hTM0FjY2Vzc1BvaW50QXJuJywge1xuICAgICAgICAgIHZhbHVlOiB0aGlzLnN0b3JhZ2Uub3V0cHV0cy5mc3hTM0FjY2Vzc1BvaW50QXJuLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRlN4IGZvciBPTlRBUCBTMyBBY2Nlc3MgUG9pbnQgQVJOJyxcbiAgICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tRnN4UzNBY2Nlc3NQb2ludEFybmAsXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBGU3ggUzMgQWNjZXNzIFBvaW50IEFsaWFz77yI5YuV55qE5Y+W5b6X77yJXG4gICAgICBpZiAodGhpcy5zdG9yYWdlLm91dHB1dHMuZnN4UzNBY2Nlc3NQb2ludEFsaWFzKSB7XG4gICAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGc3hTM0FjY2Vzc1BvaW50QWxpYXMnLCB7XG4gICAgICAgICAgdmFsdWU6IHRoaXMuc3RvcmFnZS5vdXRwdXRzLmZzeFMzQWNjZXNzUG9pbnRBbGlhcyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ0ZTeCBmb3IgT05UQVAgUzMgQWNjZXNzIFBvaW50IEFsaWFzJyxcbiAgICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tRnN4UzNBY2Nlc3NQb2ludEFsaWFzYCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ/Cfk6QgRGF0YVN0YWNr5Ye65Yqb5YCk5L2c5oiQ5a6M5LqGJyk7XG4gIH1cblxuICAvKipcbiAgICog44K544K/44OD44Kv44K/44Kw6Kit5a6a77yI57Wx5LiA44K/44Kw5oim55Wl5rqW5oug77yJXG4gICAqL1xuICBwcml2YXRlIGFkZFN0YWNrVGFncygpOiB2b2lkIHtcbiAgICB0cnkge1xuICAgICAgLy8g44OX44Ot44K444Kn44Kv44OI5qiZ5rqW44K/44Kw6Kit5a6a44KS5Y+W5b6X77yIcHJvcHPjgYvjgonlj5blvpfvvIlcbiAgICAgIGNvbnN0IHRhZ2dpbmdDb25maWcgPSBQZXJtaXNzaW9uQXdhcmVSQUdUYWdzLmdldFN0YW5kYXJkQ29uZmlnKFwicGVybWlzc2lvbi1hd2FyZS1yYWdcIiwgXG4gICAgICAgICh0aGlzLmVudmlyb25tZW50TmFtZSB8fCAnZGV2JykgYXMgJ2RldicgfCAnc3RhZ2luZycgfCAncHJvZCdcbiAgICAgICk7XG4gICAgICBcbiAgICAgIC8vIOeSsOWig+WIpeOCv+OCsOioreWumuOCkuODnuODvOOCuFxuICAgICAgY29uc3QgZW52Q29uZmlnID0gUGVybWlzc2lvbkF3YXJlUkFHVGFncy5nZXRFbnZpcm9ubWVudENvbmZpZygodGhpcy5lbnZpcm9ubWVudE5hbWUgfHwgJ2RldicpIGFzICdkZXYnIHwgJ3N0YWdpbmcnIHwgJ3Byb2QnKTtcbiAgICAgIGNvbnN0IG1lcmdlZENvbmZpZyA9IHsgLi4udGFnZ2luZ0NvbmZpZywgLi4uZW52Q29uZmlnIH07XG4gICAgICBcbiAgICAgIC8vIOOCu+OCreODpeODquODhuOCo+imgeS7tuOCv+OCsOOCkuODnuODvOOCuFxuICAgICAgY29uc3Qgc2VjdXJpdHlDb25maWcgPSBQZXJtaXNzaW9uQXdhcmVSQUdUYWdzLmdldFNlY3VyaXR5Q29uZmlnKCh0aGlzLmVudmlyb25tZW50TmFtZSB8fCAnZGV2JykgYXMgJ2RldicgfCAnc3RhZ2luZycgfCAncHJvZCcpO1xuICAgICAgY29uc3QgZmluYWxDb25maWcgPSB7IC4uLm1lcmdlZENvbmZpZywgLi4uc2VjdXJpdHlDb25maWcgfTtcbiAgICAgIFxuICAgICAgLy8g44OH44O844K/44K544K/44OD44Kv5Zu65pyJ44Gu44Kr44K544K/44Og44K/44Kw44KS6L+95YqgXG4gICAgICBmaW5hbENvbmZpZy5jdXN0b21UYWdzID0ge1xuICAgICAgICAuLi5maW5hbENvbmZpZy5jdXN0b21UYWdzLFxuICAgICAgICAnTW9kdWxlJzogJ1N0b3JhZ2UrRGF0YWJhc2UnLFxuICAgICAgICAnU3RhY2tUeXBlJzogJ0ludGVncmF0ZWQnLFxuICAgICAgICAnQXJjaGl0ZWN0dXJlJzogJ01vZHVsYXInLFxuICAgICAgICAnRGF0YWJhc2VUeXBlcyc6ICdEeW5hbW9EQitPcGVuU2VhcmNoJyxcbiAgICAgICAgJ0luZGl2aWR1YWxEZXBsb3lTdXBwb3J0JzogJ1llcycsXG4gICAgICAgICdEYXRhLUNsYXNzaWZpY2F0aW9uJzogJ1NlbnNpdGl2ZScsXG4gICAgICAgICdCYWNrdXAtUmVxdWlyZWQnOiAndHJ1ZScsXG4gICAgICAgICdFbmNyeXB0aW9uLVJlcXVpcmVkJzogJ3RydWUnLFxuICAgICAgfTtcbiAgICAgIFxuICAgICAgLy8g57Wx5LiA44K/44Kw5oim55Wl44KS6YGp55SoXG4gICAgICBUYWdnaW5nU3RyYXRlZ3kuYXBwbHlUYWdzVG9TdGFjayh0aGlzLCBmaW5hbENvbmZpZyk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKCfwn4+377iPIERhdGFTdGFja+e1seS4gOOCv+OCsOioreWumuWujOS6hicpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCfinYwgRGF0YVN0YWNr44K/44Kw6Kit5a6a44Ko44Op44O8OicsIGVycm9yKTtcbiAgICAgIFxuICAgICAgLy8g44OV44Kp44O844Or44OQ44OD44KvOiDln7rmnKzjgr/jgrDjga7jgb/oqK3lrppcbiAgICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnTW9kdWxlJywgJ1N0b3JhZ2UrRGF0YWJhc2UnKTtcbiAgICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnU3RhY2tUeXBlJywgJ0ludGVncmF0ZWQnKTtcbiAgICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnTWFuYWdlZEJ5JywgJ0NESycpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZygn4pqg77iPIERhdGFTdGFja+ODleOCqeODvOODq+ODkOODg+OCr+OCv+OCsOioreWumuWujOS6hicpO1xuICAgIH1cbiAgfVxuXG5cblxuICAvKipcbiAgICog5qmf6IO95b6p5pen55SoRHluYW1vRELjg4bjg7zjg5bjg6vjga7kvZzmiJBcbiAgICogXG4gICAqIOS9nOaIkOOBmeOCi+ODhuODvOODluODqzpcbiAgICogMS4g44K744OD44K344On44Oz566h55CG44OG44O844OW44OrIC0g6KqN6Ki844K744OD44K344On44Oz44Gu5rC457aa5YyWXG4gICAqIDIuIOODpuODvOOCtuODvOioreWumuODhuODvOODluODqyAtIOODhuODvOODnuODu+iogOiqnuODu+ODquODvOOCuOODp+ODs+ioreWumuOBruawuOe2muWMllxuICAgKiAzLiDjg4Hjg6Pjg4Pjg4jlsaXmrbTjg4bjg7zjg5bjg6sgLSDjg4Hjg6Pjg4Pjg4jlsaXmrbTjga7nrqHnkIZcbiAgICogNC4g5YuV55qE6Kit5a6a44Kt44Oj44OD44K344Ol44OG44O844OW44OrIC0g44Oi44OH44Or44O744OX44Ot44OQ44Kk44OA44O85oOF5aCx44Gu44Kt44Oj44OD44K344OlXG4gICAqIDUuIFBlcm1pc3Npb24gQVBJ55So44OG44O844OW44OrIC0g44Om44O844K244O844Ki44Kv44K744K544O75qip6ZmQ44Kt44Oj44OD44K344OlXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVBlcm1pc3Npb25BcGlUYWJsZXMoKTogdm9pZCB7XG4gICAgY29uc29sZS5sb2coJ/Cfk4og5qmf6IO95b6p5pen55SoRHluYW1vRELjg4bjg7zjg5bjg6vkvZzmiJDplovlp4suLi4nKTtcblxuICAgIC8vIDEuIOOCu+ODg+OCt+ODp+ODs+euoeeQhuODhuODvOODluODq++8iOapn+iDveW+qeaXpyAtIOimgeS7tjHvvIlcbiAgICBjb25zdCBzZXNzaW9uVGFibGUgPSBuZXcgU2Vzc2lvblRhYmxlQ29uc3RydWN0KHRoaXMsICdTZXNzaW9uVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGAke3RoaXMuZW52aXJvbm1lbnROYW1lfS1zZXNzaW9uc2AsXG4gICAgICBlbnZpcm9ubWVudDogdGhpcy5lbnZpcm9ubWVudE5hbWUsXG4gICAgfSk7XG4gICAgdGhpcy5keW5hbW9EYlRhYmxlTmFtZXNbJ3Nlc3Npb25zJ10gPSBzZXNzaW9uVGFibGUudGFibGUudGFibGVOYW1lO1xuXG4gICAgLy8gMi4g44Om44O844K244O86Kit5a6a44OG44O844OW44Or77yI5qmf6IO95b6p5penIC0g6KaB5Lu2Mu+8iVxuICAgIGNvbnN0IHVzZXJQcmVmZXJlbmNlc1RhYmxlID0gbmV3IFVzZXJQcmVmZXJlbmNlc1RhYmxlQ29uc3RydWN0KHRoaXMsICdVc2VyUHJlZmVyZW5jZXNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYCR7dGhpcy5lbnZpcm9ubWVudE5hbWV9LXVzZXItcHJlZmVyZW5jZXNgLFxuICAgICAgZW52aXJvbm1lbnQ6IHRoaXMuZW52aXJvbm1lbnROYW1lLFxuICAgIH0pO1xuICAgIHRoaXMuZHluYW1vRGJUYWJsZU5hbWVzWyd1c2VyUHJlZmVyZW5jZXMnXSA9IHVzZXJQcmVmZXJlbmNlc1RhYmxlLnRhYmxlLnRhYmxlTmFtZTtcblxuICAgIC8vIDMuIOODgeODo+ODg+ODiOWxpeattOODhuODvOODluODq++8iOapn+iDveW+qeaXpyAtIOimgeS7tjEy77yJXG4gICAgY29uc3QgY2hhdEhpc3RvcnlUYWJsZSA9IG5ldyBDaGF0SGlzdG9yeVRhYmxlQ29uc3RydWN0KHRoaXMsICdDaGF0SGlzdG9yeVRhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBgJHt0aGlzLmVudmlyb25tZW50TmFtZX0tY2hhdC1oaXN0b3J5YCxcbiAgICAgIGVudmlyb25tZW50OiB0aGlzLmVudmlyb25tZW50TmFtZSxcbiAgICB9KTtcbiAgICB0aGlzLmR5bmFtb0RiVGFibGVOYW1lc1snY2hhdEhpc3RvcnknXSA9IGNoYXRIaXN0b3J5VGFibGUudGFibGUudGFibGVOYW1lO1xuICAgIHRoaXMuY2hhdEhpc3RvcnlUYWJsZSA9IGNoYXRIaXN0b3J5VGFibGUudGFibGU7XG5cbiAgICAvLyA0LiDli5XnmoToqK3lrprjgq3jg6Pjg4Pjgrfjg6Xjg4bjg7zjg5bjg6vvvIjmqZ/og73lvqnml6cgLSDopoHku7Y077yJXG4gICAgY29uc3QgZGlzY292ZXJ5Q2FjaGVUYWJsZSA9IG5ldyBEaXNjb3ZlcnlDYWNoZVRhYmxlQ29uc3RydWN0KHRoaXMsICdEaXNjb3ZlcnlDYWNoZVRhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBgJHt0aGlzLmVudmlyb25tZW50TmFtZX0tZGlzY292ZXJ5LWNhY2hlYCxcbiAgICAgIGVudmlyb25tZW50OiB0aGlzLmVudmlyb25tZW50TmFtZSxcbiAgICB9KTtcbiAgICB0aGlzLmR5bmFtb0RiVGFibGVOYW1lc1snZGlzY292ZXJ5Q2FjaGUnXSA9IGRpc2NvdmVyeUNhY2hlVGFibGUudGFibGUudGFibGVOYW1lO1xuXG4gICAgLy8gNS4gUGVybWlzc2lvbiBBUEnnlKjjg4bjg7zjg5bjg6tcbiAgICAvLyDjg6bjg7zjgrbjg7zjgqLjgq/jgrvjgrnjg4bjg7zjg5bjg6tcbiAgICB0aGlzLnVzZXJBY2Nlc3NUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnVXNlckFjY2Vzc1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBgJHt0aGlzLmVudmlyb25tZW50TmFtZX0tdXNlci1hY2Nlc3MtdGFibGVgLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICd1c2VySWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdGhpcy5lbnZpcm9ubWVudE5hbWUgPT09ICdwcm9kJyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IHRoaXMuZW52aXJvbm1lbnROYW1lID09PSAncHJvZCcgXG4gICAgICAgID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIFxuICAgICAgICA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG4gICAgdGhpcy5keW5hbW9EYlRhYmxlTmFtZXNbJ3VzZXJBY2Nlc3MnXSA9IHRoaXMudXNlckFjY2Vzc1RhYmxlLnRhYmxlTmFtZTtcblxuICAgIC8vIOaoqemZkOOCreODo+ODg+OCt+ODpeODhuODvOODluODq1xuICAgIHRoaXMucGVybWlzc2lvbkNhY2hlVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1Blcm1pc3Npb25DYWNoZVRhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBgJHt0aGlzLmVudmlyb25tZW50TmFtZX0tcGVybWlzc2lvbi1jYWNoZWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ2NhY2hlS2V5JyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSwgLy8g44Kt44Oj44OD44K344Ol44Gv5YmK6Zmk5Y+v6IO9XG4gICAgfSk7XG4gICAgdGhpcy5keW5hbW9EYlRhYmxlTmFtZXNbJ3Blcm1pc3Npb25DYWNoZSddID0gdGhpcy5wZXJtaXNzaW9uQ2FjaGVUYWJsZS50YWJsZU5hbWU7XG5cbiAgICAvLyBDbG91ZEZvcm1hdGlvbiBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Nlc3Npb25UYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogc2Vzc2lvblRhYmxlLnRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2Vzc2lvbiBNYW5hZ2VtZW50IFRhYmxlIE5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVNlc3Npb25UYWJsZU5hbWVgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQcmVmZXJlbmNlc1RhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB1c2VyUHJlZmVyZW5jZXNUYWJsZS50YWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VzZXIgUHJlZmVyZW5jZXMgVGFibGUgTmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tVXNlclByZWZlcmVuY2VzVGFibGVOYW1lYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDaGF0SGlzdG9yeVRhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiBjaGF0SGlzdG9yeVRhYmxlLnRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2hhdCBIaXN0b3J5IFRhYmxlIE5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUNoYXRIaXN0b3J5VGFibGVOYW1lYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEaXNjb3ZlcnlDYWNoZVRhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiBkaXNjb3ZlcnlDYWNoZVRhYmxlLnRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRGlzY292ZXJ5IENhY2hlIFRhYmxlIE5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LURpc2NvdmVyeUNhY2hlVGFibGVOYW1lYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyQWNjZXNzVGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlckFjY2Vzc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVXNlciBBY2Nlc3MgVGFibGUgTmFtZSBmb3IgUGVybWlzc2lvbiBBUEknLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVVzZXJBY2Nlc3NUYWJsZU5hbWVgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Blcm1pc3Npb25DYWNoZVRhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnBlcm1pc3Npb25DYWNoZVRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUGVybWlzc2lvbiBDYWNoZSBUYWJsZSBOYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1QZXJtaXNzaW9uQ2FjaGVUYWJsZU5hbWVgLFxuICAgIH0pO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSDmqZ/og73lvqnml6fnlKhEeW5hbW9EQuODhuODvOODluODq+S9nOaIkOWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdhdGV3YXkgQ29uc3RydWN055SoUzPjg5DjgrHjg4Pjg4jkvZzmiJDvvIhQaGFzZSA0OiBBZ2VudENvcmUgR2F0ZXdheee1seWQiO+8iVxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVHYXRld2F5U3BlY3NCdWNrZXQocHJvcHM6IERhdGFTdGFja1Byb3BzKTogdm9pZCB7XG4gICAgY29uc29sZS5sb2coJ/Cfk6YgR2F0ZXdheeeUqFMz44OQ44Kx44OD44OI5L2c5oiQ5LitLi4uJyk7XG4gICAgXG4gICAgY29uc3QgZ2F0ZXdheUJ1Y2tldE5hbWUgPSBwcm9wcy5jb25maWcuc3RvcmFnZT8uZ2F0ZXdheT8uYnVja2V0TmFtZVByZWZpeCBcbiAgICAgID8gYCR7cHJvcHMuY29uZmlnLnN0b3JhZ2UuZ2F0ZXdheS5idWNrZXROYW1lUHJlZml4fS0ke3Byb3BzLmVudmlyb25tZW50fWBcbiAgICAgIDogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWdhdGV3YXktc3BlY3NgO1xuICAgIFxuICAgIGNvbnN0IGdhdGV3YXlCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdHYXRld2F5U3BlY3NCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBnYXRld2F5QnVja2V0TmFtZSxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICB2ZXJzaW9uZWQ6IHRydWUsXG4gICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdEZWxldGVPbGRWZXJzaW9ucycsXG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBub25jdXJyZW50VmVyc2lvbkV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICByZW1vdmFsUG9saWN5OiBwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnIFxuICAgICAgICA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiBcbiAgICAgICAgOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHByb3BzLmVudmlyb25tZW50ICE9PSAncHJvZCcsXG4gICAgfSk7XG4gICAgXG4gICAgLy8gUzPjg5DjgrHjg4Pjg4jlkI3jgpLlh7rlipvvvIjku5bjgrnjgr/jg4Pjgq/jgYvjgonjga7lj4LnhafnlKjvvIlcbiAgICB0aGlzLnMzQnVja2V0TmFtZXNbJ2dhdGV3YXlTcGVjcyddID0gZ2F0ZXdheUJ1Y2tldC5idWNrZXROYW1lO1xuICAgIFxuICAgIC8vIENsb3VkRm9ybWF0aW9uIE91dHB1dFxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdHYXRld2F5U3BlY3NCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IGdhdGV3YXlCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2F0ZXdheSBTcGVjcyBTMyBCdWNrZXQgTmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tR2F0ZXdheVNwZWNzQnVja2V0TmFtZWAsXG4gICAgfSk7XG4gICAgXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0dhdGV3YXlTcGVjc0J1Y2tldEFybicsIHtcbiAgICAgIHZhbHVlOiBnYXRld2F5QnVja2V0LmJ1Y2tldEFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2F0ZXdheSBTcGVjcyBTMyBCdWNrZXQgQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1HYXRld2F5U3BlY3NCdWNrZXRBcm5gLFxuICAgIH0pO1xuICAgIFxuICAgIC8vIOOCteODs+ODl+ODq09wZW5BUEnku5Xmp5jjgpLjg4fjg5fjg63jgqTmmYLjgavkvZzmiJDvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICBpZiAocHJvcHMuY29uZmlnLnN0b3JhZ2U/LmdhdGV3YXk/LmRlcGxveVNwZWNzICE9PSBmYWxzZSkge1xuICAgICAgbmV3IHMzZGVwbG95LkJ1Y2tldERlcGxveW1lbnQodGhpcywgJ0dhdGV3YXlTcGVjc0RlcGxveW1lbnQnLCB7XG4gICAgICAgIHNvdXJjZXM6IFtcbiAgICAgICAgICBzM2RlcGxveS5Tb3VyY2UuZGF0YShcbiAgICAgICAgICAgICdvcGVuYXBpL3NhbXBsZS1vcGVuYXBpLnlhbWwnLCBcbiAgICAgICAgICAgIHRoaXMuZ2V0U2FtcGxlT3BlbkFwaVNwZWMoKVxuICAgICAgICAgIClcbiAgICAgICAgXSxcbiAgICAgICAgZGVzdGluYXRpb25CdWNrZXQ6IGdhdGV3YXlCdWNrZXQsXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgY29uc29sZS5sb2coJ+KchSBHYXRld2F555SoUzPjg5DjgrHjg4Pjg4jkvZzmiJDlrozkuoYnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrXjg7Pjg5fjg6tPcGVuQVBJ5LuV5qeY55Sf5oiQ44Oh44K944OD44OJXG4gICAqL1xuICBwcml2YXRlIGdldFNhbXBsZU9wZW5BcGlTcGVjKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGBvcGVuYXBpOiAzLjAuMFxuaW5mbzpcbiAgdGl0bGU6IEZTeCBmb3IgT05UQVAgRG9jdW1lbnQgQVBJXG4gIGRlc2NyaXB0aW9uOiBBUEkgZm9yIGFjY2Vzc2luZyBkb2N1bWVudHMgc3RvcmVkIGluIEZTeCBmb3IgT05UQVAgdmlhIFMzIEFjY2VzcyBQb2ludHNcbiAgdmVyc2lvbjogMS4wLjBcbnNlcnZlcnM6XG4gIC0gdXJsOiBodHRwczovL2FwaS5leGFtcGxlLmNvbS92MVxuICAgIGRlc2NyaXB0aW9uOiBQcm9kdWN0aW9uIHNlcnZlclxucGF0aHM6XG4gIC9kb2N1bWVudHM6XG4gICAgZ2V0OlxuICAgICAgc3VtbWFyeTogTGlzdCBkb2N1bWVudHNcbiAgICAgIGRlc2NyaXB0aW9uOiBSZXRyaWV2ZSBhIGxpc3Qgb2YgZG9jdW1lbnRzIGFjY2Vzc2libGUgdmlhIEZTeCBmb3IgT05UQVBcbiAgICAgIG9wZXJhdGlvbklkOiBsaXN0RG9jdW1lbnRzXG4gICAgICBwYXJhbWV0ZXJzOlxuICAgICAgICAtIG5hbWU6IGxpbWl0XG4gICAgICAgICAgaW46IHF1ZXJ5XG4gICAgICAgICAgZGVzY3JpcHRpb246IE1heGltdW0gbnVtYmVyIG9mIGRvY3VtZW50cyB0byByZXR1cm5cbiAgICAgICAgICByZXF1aXJlZDogZmFsc2VcbiAgICAgICAgICBzY2hlbWE6XG4gICAgICAgICAgICB0eXBlOiBpbnRlZ2VyXG4gICAgICAgICAgICBkZWZhdWx0OiAxMFxuICAgICAgICAgICAgbWluaW11bTogMVxuICAgICAgICAgICAgbWF4aW11bTogMTAwXG4gICAgICByZXNwb25zZXM6XG4gICAgICAgICcyMDAnOlxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBTdWNjZXNzZnVsIHJlc3BvbnNlXG4gICAgICAgICAgY29udGVudDpcbiAgICAgICAgICAgIGFwcGxpY2F0aW9uL2pzb246XG4gICAgICAgICAgICAgIHNjaGVtYTpcbiAgICAgICAgICAgICAgICB0eXBlOiBvYmplY3RcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOlxuICAgICAgICAgICAgICAgICAgZG9jdW1lbnRzOlxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBhcnJheVxuICAgICAgICAgICAgICAgICAgICBpdGVtczpcbiAgICAgICAgICAgICAgICAgICAgICAkcmVmOiAnIy9jb21wb25lbnRzL3NjaGVtYXMvRG9jdW1lbnQnXG5jb21wb25lbnRzOlxuICBzY2hlbWFzOlxuICAgIERvY3VtZW50OlxuICAgICAgdHlwZTogb2JqZWN0XG4gICAgICBwcm9wZXJ0aWVzOlxuICAgICAgICBpZDpcbiAgICAgICAgICB0eXBlOiBzdHJpbmdcbiAgICAgICAgbmFtZTpcbiAgICAgICAgICB0eXBlOiBzdHJpbmdcbiAgICAgICAgcGF0aDpcbiAgICAgICAgICB0eXBlOiBzdHJpbmdcbiAgICAgICAgc2l6ZTpcbiAgICAgICAgICB0eXBlOiBpbnRlZ2VyXG4gICAgICAgIGxhc3RNb2RpZmllZDpcbiAgICAgICAgICB0eXBlOiBzdHJpbmdcbiAgICAgICAgICBmb3JtYXQ6IGRhdGUtdGltZWA7XG4gIH1cbn1cbiJdfQ==