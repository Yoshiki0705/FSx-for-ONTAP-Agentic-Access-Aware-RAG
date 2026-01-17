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
            //   });
            // }
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
}
exports.DataStack = DataStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRhdGEtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7OztHQVFHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQyxtRUFBcUQ7QUFDckQseURBQTJDO0FBRzNDLCtCQUErQjtBQUMvQiwwRkFBc0Y7QUFFdEYsZ0NBQWdDO0FBQ2hDLDZGQUF5RjtBQUV6RixxQkFBcUI7QUFDckIsdUdBQWtHO0FBQ2xHLHlIQUFtSDtBQUNuSCxpSEFBMkc7QUFDM0csdUhBQWlIO0FBU2pILE9BQU87QUFDUCxnRUFBc0Y7QUFpQnRGOzs7OztHQUtHO0FBQ0gsTUFBYSxTQUFVLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDdEMscUJBQXFCO0lBQ0wsT0FBTyxDQUFtQjtJQUUxQyxzQkFBc0I7SUFDTixRQUFRLENBQW9CO0lBRTVDLDJCQUEyQjtJQUNYLGFBQWEsR0FBOEIsRUFBRSxDQUFDO0lBRTlELGlDQUFpQztJQUNqQixrQkFBa0IsR0FBOEIsRUFBRSxDQUFDO0lBRW5FLHlDQUF5QztJQUNsQyxrQkFBa0IsQ0FBVTtJQUVuQyxrQ0FBa0M7SUFDM0IsZUFBZSxDQUFrQjtJQUNqQyxvQkFBb0IsQ0FBa0I7SUFFN0MsMEJBQTBCO0lBQ25CLGdCQUFnQixDQUFrQjtJQUV6QyxxQkFBcUI7SUFDSixXQUFXLENBQVM7SUFDckMsaUJBQWlCO0lBQ0EsZUFBZSxDQUFTO0lBRXpDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBcUI7UUFDN0QsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsWUFBWTtRQUNaLElBQUksQ0FBQyxlQUFlLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQztRQUV6QyxPQUFPLENBQUMsR0FBRyxDQUFDLHNCQUFzQixDQUFDLENBQUM7UUFDcEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFX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QUF5QjtZQUN0QyxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyx1QkFBdUI7U0FDckQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSx5QkFBeUIsRUFBRTtZQUNqRCxLQUFLLEVBQUUsbUJBQW1CLENBQUMsS0FBSyxDQUFDLFNBQVM7WUFDMUMsV0FBVyxFQUFFLDRCQUE0QjtZQUN6QyxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUywwQkFBMEI7U0FDeEQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUM3QyxLQUFLLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxTQUFTO1lBQ3JDLFdBQVcsRUFBRSwyQ0FBMkM7WUFDeEQsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsc0JBQXNCO1NBQ3BELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsMEJBQTBCLEVBQUU7WUFDbEQsS0FBSyxFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTO1lBQzFDLFdBQVcsRUFBRSw2QkFBNkI7WUFDMUMsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsMkJBQTJCO1NBQ3pELENBQUMsQ0FBQztRQUVILE9BQU8sQ0FBQyxHQUFHLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUN6QyxDQUFDO0NBQ0Y7QUF6WUQsOEJBeVlDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBEYXRhU3RhY2sgLSDntbHlkIjjg4fjg7zjgr/jgrnjgr/jg4Pjgq/vvIjjg6Ljgrjjg6Xjg6njg7zjgqLjg7zjgq3jg4bjgq/jg4Hjg6Plr77lv5zvvIlcbiAqIFxuICog5qmf6IO9OlxuICogLSDntbHlkIjjgrnjg4jjg6zjg7zjgrjjg7vjg4fjg7zjgr/jg5njg7zjgrnjgrPjg7Pjgrnjg4jjg6njgq/jg4jjgavjgojjgovkuIDlhYPnrqHnkIZcbiAqIC0gUzPjg7tGU3jjg7tEeW5hbW9EQuODu09wZW5TZWFyY2jjga7ntbHlkIhcbiAqIC0gQWdlbnQgU3RlZXJpbmfmupbmi6Dlkb3lkI3opo/liYflr77lv5xcbiAqIC0g5YCL5Yil44K544K/44OD44Kv44OH44OX44Ot44Kk5a6M5YWo5a++5b+cXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuLy8g57Wx5ZCI44K544OI44Os44O844K444Kz44Oz44K544OI44Op44Kv44OI77yI44Oi44K444Ol44Op44O844Ki44O844Kt44OG44Kv44OB44Oj77yJXG5pbXBvcnQgeyBTdG9yYWdlQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9zdG9yYWdlL2NvbnN0cnVjdHMvc3RvcmFnZS1jb25zdHJ1Y3QnO1xuXG4vLyDntbHlkIjjg4fjg7zjgr/jg5njg7zjgrnjgrPjg7Pjgrnjg4jjg6njgq/jg4jvvIjjg6Ljgrjjg6Xjg6njg7zjgqLjg7zjgq3jg4bjgq/jg4Hjg6PvvIlcbmltcG9ydCB7IERhdGFiYXNlQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9kYXRhYmFzZS9jb25zdHJ1Y3RzL2RhdGFiYXNlLWNvbnN0cnVjdCc7XG5cbi8vIOapn+iDveW+qeaXp+eUqOODh+ODvOOCv+ODmeODvOOCueOCs+ODs+OCueODiOODqeOCr+ODiFxuaW1wb3J0IHsgU2Vzc2lvblRhYmxlQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9kYXRhYmFzZS9jb25zdHJ1Y3RzL3Nlc3Npb24tdGFibGUtY29uc3RydWN0JztcbmltcG9ydCB7IFVzZXJQcmVmZXJlbmNlc1RhYmxlQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9kYXRhYmFzZS9jb25zdHJ1Y3RzL3VzZXItcHJlZmVyZW5jZXMtdGFibGUtY29uc3RydWN0JztcbmltcG9ydCB7IENoYXRIaXN0b3J5VGFibGVDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi9tb2R1bGVzL2RhdGFiYXNlL2NvbnN0cnVjdHMvY2hhdC1oaXN0b3J5LXRhYmxlLWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBEaXNjb3ZlcnlDYWNoZVRhYmxlQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9kYXRhYmFzZS9jb25zdHJ1Y3RzL2Rpc2NvdmVyeS1jYWNoZS10YWJsZS1jb25zdHJ1Y3QnO1xuXG4vLyDjgqTjg7Pjgr/jg7zjg5Xjgqfjg7zjgrlcbmltcG9ydCB7IFN0b3JhZ2VDb25maWcgfSBmcm9tICcuLi8uLi9tb2R1bGVzL3N0b3JhZ2UvaW50ZXJmYWNlcy9zdG9yYWdlLWNvbmZpZyc7XG5pbXBvcnQgeyBEYXRhYmFzZUNvbmZpZyB9IGZyb20gJy4uLy4uL21vZHVsZXMvZGF0YWJhc2UvaW50ZXJmYWNlcy9kYXRhYmFzZS1jb25maWcnO1xuXG4vLyDku5bjgrnjgr/jg4Pjgq/jgYvjgonjga7kvp3lrZjplqLkv4JcbmltcG9ydCB7IFNlY3VyaXR5U3RhY2sgfSBmcm9tICcuL3NlY3VyaXR5LXN0YWNrJztcblxuLy8g44K/44Kw6Kit5a6aXG5pbXBvcnQgeyBUYWdnaW5nU3RyYXRlZ3ksIFBlcm1pc3Npb25Bd2FyZVJBR1RhZ3MgfSBmcm9tICcuLi8uLi9jb25maWcvdGFnZ2luZy1jb25maWcnO1xuXG5leHBvcnQgaW50ZXJmYWNlIERhdGFTdGFja0NvbmZpZyB7XG4gIHJlYWRvbmx5IHN0b3JhZ2U6IFN0b3JhZ2VDb25maWc7XG4gIHJlYWRvbmx5IGRhdGFiYXNlOiBEYXRhYmFzZUNvbmZpZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBEYXRhU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgcmVhZG9ubHkgY29uZmlnOiBEYXRhU3RhY2tDb25maWc7IC8vIOWei+WuieWFqOOBque1seWQiOioreWumuOCquODluOCuOOCp+OCr+ODiFxuICByZWFkb25seSBwcm9qZWN0TmFtZT86IHN0cmluZzsgLy8g44OX44Ot44K444Kn44Kv44OI5ZCN77yI44Kq44OX44K344On44Oz77yJXG4gIHJlYWRvbmx5IHNlY3VyaXR5U3RhY2s/OiBTZWN1cml0eVN0YWNrOyAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPjgrnjgr/jg4Pjgq/vvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgcmVhZG9ubHkgbmFtaW5nR2VuZXJhdG9yPzogYW55OyAvLyBBZ2VudCBTdGVlcmluZ+a6luaLoOWRveWQjeOCuOOCp+ODjeODrOODvOOCv+ODvO+8iOOCquODl+OCt+ODp+ODs++8iVxuICByZWFkb25seSBlbnZpcm9ubWVudDogc3RyaW5nOyAvLyDnkrDlooPlkI3vvIjjgrPjgrnjg4jphY3luIPnlKjvvIlcbiAgcmVhZG9ubHkgdnBjPzogYW55OyAvLyBWUEPvvIhOZXR3b3JraW5nU3RhY2vjgYvjgonvvIlcbiAgcmVhZG9ubHkgcHJpdmF0ZVN1Ym5ldElkcz86IHN0cmluZ1tdOyAvLyDjg5fjg6njgqTjg5njg7zjg4jjgrXjg5bjg43jg4Pjg4hJRO+8iE5ldHdvcmtpbmdTdGFja+OBi+OCie+8iVxufVxuXG4vKipcbiAqIOe1seWQiOODh+ODvOOCv+OCueOCv+ODg+OCr++8iOODouOCuOODpeODqeODvOOCouODvOOCreODhuOCr+ODgeODo+WvvuW/nO+8iVxuICogXG4gKiDntbHlkIjjgrnjg4jjg6zjg7zjgrjjg7vjg4fjg7zjgr/jg5njg7zjgrnjgrPjg7Pjgrnjg4jjg6njgq/jg4jjgavjgojjgovkuIDlhYPnrqHnkIZcbiAqIOWAi+WIpeOCueOCv+ODg+OCr+ODh+ODl+ODreOCpOWujOWFqOWvvuW/nFxuICovXG5leHBvcnQgY2xhc3MgRGF0YVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgLyoqIOe1seWQiOOCueODiOODrOODvOOCuOOCs+ODs+OCueODiOODqeOCr+ODiCAqL1xuICBwdWJsaWMgcmVhZG9ubHkgc3RvcmFnZTogU3RvcmFnZUNvbnN0cnVjdDtcbiAgXG4gIC8qKiDntbHlkIjjg4fjg7zjgr/jg5njg7zjgrnjgrPjg7Pjgrnjg4jjg6njgq/jg4ggKi9cbiAgcHVibGljIHJlYWRvbmx5IGRhdGFiYXNlOiBEYXRhYmFzZUNvbnN0cnVjdDtcbiAgXG4gIC8qKiBTM+ODkOOCseODg+ODiOWQje+8iOS7luOCueOCv+ODg+OCr+OBi+OCieOBruWPgueFp+eUqO+8iSAqL1xuICBwdWJsaWMgcmVhZG9ubHkgczNCdWNrZXROYW1lczogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9O1xuICBcbiAgLyoqIER5bmFtb0RC44OG44O844OW44Or5ZCN77yI5LuW44K544K/44OD44Kv44GL44KJ44Gu5Y+C54Wn55So77yJICovXG4gIHB1YmxpYyByZWFkb25seSBkeW5hbW9EYlRhYmxlTmFtZXM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7fTtcbiAgXG4gIC8qKiBPcGVuU2VhcmNo44OJ44Oh44Kk44Oz44Ko44Oz44OJ44Od44Kk44Oz44OI77yI5LuW44K544K/44OD44Kv44GL44KJ44Gu5Y+C54Wn55So77yJICovXG4gIHB1YmxpYyBvcGVuU2VhcmNoRW5kcG9pbnQ/OiBzdHJpbmc7XG5cbiAgLyoqIFBlcm1pc3Npb24gQVBJ55SoRHluYW1vRELjg4bjg7zjg5bjg6sgKi9cbiAgcHVibGljIHVzZXJBY2Nlc3NUYWJsZT86IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcGVybWlzc2lvbkNhY2hlVGFibGU/OiBkeW5hbW9kYi5UYWJsZTtcbiAgXG4gIC8qKiDjg4Hjg6Pjg4Pjg4jlsaXmrbTnlKhEeW5hbW9EQuODhuODvOODluODqyAqL1xuICBwdWJsaWMgY2hhdEhpc3RvcnlUYWJsZT86IGR5bmFtb2RiLlRhYmxlO1xuXG4gIC8qKiDjg5fjg63jgrjjgqfjgq/jg4jlkI3vvIjlhoXpg6jlj4LnhafnlKjvvIkgKi9cbiAgcHJpdmF0ZSByZWFkb25seSBwcm9qZWN0TmFtZTogc3RyaW5nO1xuICAvKiog55Kw5aKD5ZCN77yI5YaF6YOo5Y+C54Wn55So77yJICovXG4gIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnROYW1lOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IERhdGFTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyDjg5fjg63jg5Hjg4bjgqPjga7liJ3mnJ/ljJZcbiAgICB0aGlzLmVudmlyb25tZW50TmFtZSA9IHByb3BzLmVudmlyb25tZW50O1xuXG4gICAgY29uc29sZS5sb2coJ/Cfkr4gRGF0YVN0YWNr5Yid5pyf5YyW6ZaL5aeLLi4uJyk7XG4gICAgY29uc29sZS5sb2coJ/Cfk50g44K544K/44OD44Kv5ZCNOicsIGlkKTtcbiAgICBjb25zb2xlLmxvZygn8J+Pt++4jyBBZ2VudCBTdGVlcmluZ+a6luaLoDonLCBwcm9wcy5uYW1pbmdHZW5lcmF0b3IgPyAnWWVzJyA6ICdObycpO1xuXG4gICAgLy8g44Kz44K544OI6YWN5biD44K/44Kw44Gu6YGp55So77yIRlN4IGZvciBPTlRBUOWwgueUqOOCv+OCsOOCkuWQq+OCgO+8iVxuICAgIGNvbnN0IHRhZ2dpbmdDb25maWcgPSBQZXJtaXNzaW9uQXdhcmVSQUdUYWdzLmdldFN0YW5kYXJkQ29uZmlnKFwicGVybWlzc2lvbi1hd2FyZS1yYWdcIiwgXG4gICAgICBwcm9wcy5lbnZpcm9ubWVudCBhcyAnZGV2JyB8ICdzdGFnaW5nJyB8ICdwcm9kJ1xuICAgICk7XG4gICAgVGFnZ2luZ1N0cmF0ZWd5LmFwcGx5VGFnc1RvU3RhY2sodGhpcywgdGFnZ2luZ0NvbmZpZyk7XG5cbiAgICAvLyDms6jmhI86IOS+neWtmOmWouS/guOBryBtYWluLWRlcGxveW1lbnQtc3RhY2sudHMg44Gn5LiA5YWD566h55CG44GV44KM44G+44GZXG4gICAgLy8g44K744Kt44Ol44Oq44OG44Kj44K544K/44OD44Kv44Go44Gu5L6d5a2Y6Zai5L+C44Gv6Kaq44K544K/44OD44Kv44Gn6Kit5a6a5riI44G/XG5cbiAgICAvLyBWUEPjga7mupblgpnvvIhSRUFETUUubWTmupbmi6AgLSBGU3ggZm9yIE9OVEFQ44Gr5b+F6KaB77yJXG4gICAgbGV0IHZwYzogZWMyLklWcGMgfCB1bmRlZmluZWQ7XG4gICAgbGV0IHByaXZhdGVTdWJuZXRJZHM6IHN0cmluZ1tdIHwgdW5kZWZpbmVkO1xuXG4gICAgaWYgKHByb3BzLnZwYykge1xuICAgICAgLy8g5pei5a2YVlBD44GM5o+Q5L6b44GV44KM44Gm44GE44KL5aC05ZCIXG4gICAgICBpZiAodHlwZW9mIHByb3BzLnZwYyA9PT0gJ29iamVjdCcgJiYgJ3ZwY0lkJyBpbiBwcm9wcy52cGMpIHtcbiAgICAgICAgdnBjID0gZWMyLlZwYy5mcm9tVnBjQXR0cmlidXRlcyh0aGlzLCAnSW1wb3J0ZWRWcGMnLCBwcm9wcy52cGMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdnBjID0gcHJvcHMudnBjO1xuICAgICAgfVxuICAgICAgcHJpdmF0ZVN1Ym5ldElkcyA9IHByb3BzLnByaXZhdGVTdWJuZXRJZHM7XG4gICAgfSBlbHNlIGlmIChwcm9wcy5jb25maWcuc3RvcmFnZT8uZnN4Py5lbmFibGVkIHx8IHByb3BzLmNvbmZpZy5zdG9yYWdlPy5mc3hPbnRhcD8uZW5hYmxlZCkge1xuICAgICAgLy8gRlN444GM5pyJ5Yq544Gq5aC05ZCI44CBVlBD44KS5L2c5oiQXG4gICAgICBjb25zb2xlLmxvZygn8J+MkCBGU3jnlKhWUEPkvZzmiJDplovlp4suLi4nKTtcbiAgICAgIFxuICAgICAgdnBjID0gbmV3IGVjMi5WcGModGhpcywgJ0RhdGFTdGFja1ZwYycsIHtcbiAgICAgICAgbWF4QXpzOiAyLFxuICAgICAgICBuYXRHYXRld2F5czogMSxcbiAgICAgICAgc3VibmV0Q29uZmlndXJhdGlvbjogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdQdWJsaWMnLFxuICAgICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFVCTElDLFxuICAgICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ1ByaXZhdGUnLFxuICAgICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgICAgICAgIGNpZHJNYXNrOiAyNCxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSk7XG5cbiAgICAgIHByaXZhdGVTdWJuZXRJZHMgPSB2cGMucHJpdmF0ZVN1Ym5ldHMubWFwKHN1Ym5ldCA9PiBzdWJuZXQuc3VibmV0SWQpO1xuXG4gICAgICAvLyBWUEPlh7rliptcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWcGNJZCcsIHtcbiAgICAgICAgdmFsdWU6IHZwYy52cGNJZCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdWUEMgSUQgZm9yIEZTeCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1WcGNJZGAsXG4gICAgICB9KTtcblxuICAgICAgY29uc29sZS5sb2coJ+KchSBGU3jnlKhWUEPkvZzmiJDlrozkuoYnKTtcbiAgICB9XG5cbiAgICAvLyDntbHlkIjjgrnjg4jjg6zjg7zjgrjjgrPjg7Pjgrnjg4jjg6njgq/jg4jkvZzmiJDvvIhSRUFETUUubWTmupbmi6AgLSBTMyArIEZTeO+8iVxuICAgIHRoaXMuc3RvcmFnZSA9IG5ldyBTdG9yYWdlQ29uc3RydWN0KHRoaXMsICdTdG9yYWdlJywge1xuICAgICAgY29uZmlnOiBwcm9wcy5jb25maWcuc3RvcmFnZSxcbiAgICAgIGVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgIHByb2plY3ROYW1lOiBwcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgIGttc0tleTogcHJvcHMuc2VjdXJpdHlTdGFjaz8ua21zS2V5LFxuICAgICAgdnBjOiB2cGMsXG4gICAgICBwcml2YXRlU3VibmV0SWRzOiBwcml2YXRlU3VibmV0SWRzLFxuICAgIH0pO1xuXG4gICAgLy8g57Wx5ZCI44OH44O844K/44OZ44O844K544Kz44Oz44K544OI44Op44Kv44OI5L2c5oiQXG4gICAgdGhpcy5kYXRhYmFzZSA9IG5ldyBEYXRhYmFzZUNvbnN0cnVjdCh0aGlzLCAnRGF0YWJhc2UnLCB7XG4gICAgICBjb25maWc6IHByb3BzLmNvbmZpZy5kYXRhYmFzZSwgICAgICBlbnZpcm9ubWVudDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICBrbXNLZXk6IHByb3BzLnNlY3VyaXR5U3RhY2s/Lmttc0tleSxcbiAgICB9KTtcblxuICAgIC8vIFBlcm1pc3Npb24gQVBJ55SoRHluYW1vRELjg4bjg7zjg5bjg6vjga7kvZzmiJBcbiAgICB0aGlzLmNyZWF0ZVBlcm1pc3Npb25BcGlUYWJsZXMoKTtcblxuICAgIC8vIOS7luOCueOCv+ODg+OCr+OBi+OCieOBruWPgueFp+eUqOODl+ODreODkeODhuOCo+ioreWumlxuICAgIHRoaXMuc2V0dXBDcm9zc1N0YWNrUmVmZXJlbmNlcygpO1xuXG4gICAgLy8g44K544K/44OD44Kv5Ye65YqbXG4gICAgdGhpcy5jcmVhdGVPdXRwdXRzKCk7XG5cbiAgICAvLyDjgr/jgrDoqK3lrppcbiAgICB0aGlzLmFkZFN0YWNrVGFncygpO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSBEYXRhU3RhY2vliJ3mnJ/ljJblrozkuoYnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTM+ODkOOCseODg+ODiOOBruWei+OCrOODvOODiVxuICAgKi9cbiAgcHJpdmF0ZSBpc1ZhbGlkUzNCdWNrZXQoYnVja2V0OiB1bmtub3duKTogYnVja2V0IGlzIHsgYnVja2V0TmFtZTogc3RyaW5nIH0ge1xuICAgIHJldHVybiB0eXBlb2YgYnVja2V0ID09PSAnb2JqZWN0JyAmJiBcbiAgICAgICAgICAgYnVja2V0ICE9PSBudWxsICYmIFxuICAgICAgICAgICAnYnVja2V0TmFtZScgaW4gYnVja2V0ICYmIFxuICAgICAgICAgICB0eXBlb2YgKGJ1Y2tldCBhcyBhbnkpLmJ1Y2tldE5hbWUgPT09ICdzdHJpbmcnO1xuICB9XG5cbiAgLyoqXG4gICAqIER5bmFtb0RC44OG44O844OW44Or44Gu5Z6L44Ks44O844OJXG4gICAqL1xuICBwcml2YXRlIGlzVmFsaWREeW5hbW9EYlRhYmxlKHRhYmxlOiB1bmtub3duKTogdGFibGUgaXMgeyB0YWJsZU5hbWU6IHN0cmluZyB9IHtcbiAgICByZXR1cm4gdHlwZW9mIHRhYmxlID09PSAnb2JqZWN0JyAmJiBcbiAgICAgICAgICAgdGFibGUgIT09IG51bGwgJiYgXG4gICAgICAgICAgICd0YWJsZU5hbWUnIGluIHRhYmxlICYmIFxuICAgICAgICAgICB0eXBlb2YgKHRhYmxlIGFzIGFueSkudGFibGVOYW1lID09PSAnc3RyaW5nJztcbiAgfVxuXG4gIC8qKlxuICAgKiDku5bjgrnjgr/jg4Pjgq/jgYvjgonjga7lj4LnhafnlKjjg5fjg63jg5Hjg4bjgqPoqK3lrprvvIjlnovlronlhajmgKflvLfljJbniYjvvIlcbiAgICovXG4gIHByaXZhdGUgc2V0dXBDcm9zc1N0YWNrUmVmZXJlbmNlcygpOiB2b2lkIHtcbiAgICB0cnkge1xuICAgICAgLy8gUzPjg5DjgrHjg4Pjg4jlkI3jga7oqK3lrprvvIjlnovlronlhajmgKflvLfljJbvvIlcbiAgICAgIGlmICh0aGlzLnN0b3JhZ2Uub3V0cHV0cz8uczNCdWNrZXRzKSB7XG4gICAgICAgIE9iamVjdC5lbnRyaWVzKHRoaXMuc3RvcmFnZS5vdXRwdXRzLnMzQnVja2V0cykuZm9yRWFjaCgoW25hbWUsIGJ1Y2tldF0pID0+IHtcbiAgICAgICAgICBpZiAodGhpcy5pc1ZhbGlkUzNCdWNrZXQoYnVja2V0KSkge1xuICAgICAgICAgICAgdGhpcy5zM0J1Y2tldE5hbWVzW25hbWVdID0gYnVja2V0LmJ1Y2tldE5hbWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybihg4pqg77iPIOeEoeWKueOBqlMz44OQ44Kx44OD44OI6Kit5a6a44KS44K544Kt44OD44OXOiAke25hbWV9YCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gRHluYW1vRELjg4bjg7zjg5bjg6vlkI3jga7oqK3lrprvvIjlnovlronlhajmgKflvLfljJbvvIlcbiAgICAgIGlmICh0aGlzLmRhdGFiYXNlLm91dHB1dHM/LmR5bmFtb0RiVGFibGVzKSB7XG4gICAgICAgIE9iamVjdC5lbnRyaWVzKHRoaXMuZGF0YWJhc2Uub3V0cHV0cy5keW5hbW9EYlRhYmxlcykuZm9yRWFjaCgoW25hbWUsIHRhYmxlXSkgPT4ge1xuICAgICAgICAgIGlmICh0aGlzLmlzVmFsaWREeW5hbW9EYlRhYmxlKHRhYmxlKSkge1xuICAgICAgICAgICAgdGhpcy5keW5hbW9EYlRhYmxlTmFtZXNbbmFtZV0gPSB0YWJsZS50YWJsZU5hbWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybihg4pqg77iPIOeEoeWKueOBqkR5bmFtb0RC44OG44O844OW44Or6Kit5a6a44KS44K544Kt44OD44OXOiAke25hbWV9YCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gT3BlblNlYXJjaOOCqOODs+ODieODneOCpOODs+ODiOOBruioreWumu+8iOWei+WuieWFqOaAp+W8t+WMlu+8iVxuICAgICAgaWYgKHRoaXMuZGF0YWJhc2Uub3V0cHV0cz8ub3BlblNlYXJjaEVuZHBvaW50ICYmIFxuICAgICAgICAgIHR5cGVvZiB0aGlzLmRhdGFiYXNlLm91dHB1dHMub3BlblNlYXJjaEVuZHBvaW50ID09PSAnc3RyaW5nJykge1xuICAgICAgICB0aGlzLm9wZW5TZWFyY2hFbmRwb2ludCA9IHRoaXMuZGF0YWJhc2Uub3V0cHV0cy5vcGVuU2VhcmNoRW5kcG9pbnQ7XG4gICAgICB9XG5cbiAgICAgIGNvbnNvbGUubG9nKCfwn5SXIOS7luOCueOCv+ODg+OCr+WPgueFp+eUqOODl+ODreODkeODhuOCo+ioreWumuWujOS6hicpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCfinYwg5LuW44K544K/44OD44Kv5Y+C54Wn55So44OX44Ot44OR44OG44Kj6Kit5a6a44Ko44Op44O8OicsIGVycm9yKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRGF0YVN0YWNr5Y+C54Wn6Kit5a6a44Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yfWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjgrnjgr/jg4Pjgq/lh7rlipvkvZzmiJDvvIjlgIvliKXjg4fjg5fjg63jgqTlr77lv5zvvIlcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlT3V0cHV0cygpOiB2b2lkIHtcbiAgICAvLyBTM+ODkOOCseODg+ODiOWQjeWHuuWKm++8iOS7luOCueOCv+ODg+OCr+OBi+OCieOBruWPgueFp+eUqO+8iVxuICAgIE9iamVjdC5lbnRyaWVzKHRoaXMuczNCdWNrZXROYW1lcykuZm9yRWFjaCgoW25hbWUsIGJ1Y2tldE5hbWVdKSA9PiB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgUzNCdWNrZXQke25hbWV9TmFtZWAsIHtcbiAgICAgICAgdmFsdWU6IGJ1Y2tldE5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgUzMgJHtuYW1lfSBCdWNrZXQgTmFtZWAsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1TM0J1Y2tldCR7bmFtZX1OYW1lYCxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgLy8gRHluYW1vRELjg4bjg7zjg5bjg6vlkI3lh7rlipvvvIjku5bjgrnjgr/jg4Pjgq/jgYvjgonjga7lj4LnhafnlKjvvIlcbiAgICBPYmplY3QuZW50cmllcyh0aGlzLmR5bmFtb0RiVGFibGVOYW1lcykuZm9yRWFjaCgoW25hbWUsIHRhYmxlTmFtZV0pID0+IHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBEeW5hbW9EYiR7bmFtZX1UYWJsZU5hbWVgLCB7XG4gICAgICAgIHZhbHVlOiB0YWJsZU5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgRHluYW1vREIgJHtuYW1lfSBUYWJsZSBOYW1lYCxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUR5bmFtb0RiJHtuYW1lfVRhYmxlTmFtZWAsXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIC8vIE9wZW5TZWFyY2jjgqjjg7Pjg4njg53jgqTjg7Pjg4jlh7rlipvvvIjlrZjlnKjjgZnjgovloLTlkIjjga7jgb/vvIlcbiAgICBpZiAodGhpcy5vcGVuU2VhcmNoRW5kcG9pbnQpIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdPcGVuU2VhcmNoRW5kcG9pbnQnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLm9wZW5TZWFyY2hFbmRwb2ludCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdPcGVuU2VhcmNoIERvbWFpbiBFbmRwb2ludCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1PcGVuU2VhcmNoRW5kcG9pbnRgLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8g44K544OI44Os44O844K457Wx5ZCI5Ye65Yqb77yI5a2Y5Zyo44GZ44KL5aC05ZCI44Gu44G/77yJXG4gICAgaWYgKHRoaXMuc3RvcmFnZS5vdXRwdXRzKSB7XG4gICAgICAvLyBGU3ggRmlsZSBTeXN0ZW0gSURcbiAgICAgIGlmICh0aGlzLnN0b3JhZ2Uub3V0cHV0cy5mc3hGaWxlU3lzdGVtSWQpIHtcbiAgICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0ZzeEZpbGVTeXN0ZW1JZCcsIHtcbiAgICAgICAgICB2YWx1ZTogdGhpcy5zdG9yYWdlLm91dHB1dHMuZnN4RmlsZVN5c3RlbUlkLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRlN4IGZvciBOZXRBcHAgT05UQVAgRmlsZSBTeXN0ZW0gSUQnLFxuICAgICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Gc3hGaWxlU3lzdGVtSWRgLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gICB9KTtcbiAgICAgIC8vIH1cbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZygn8J+TpCBEYXRhU3RhY2vlh7rlipvlgKTkvZzmiJDlrozkuoYnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrnjgr/jg4Pjgq/jgr/jgrDoqK3lrprvvIjntbHkuIDjgr/jgrDmiKbnlaXmupbmi6DvvIlcbiAgICovXG4gIHByaXZhdGUgYWRkU3RhY2tUYWdzKCk6IHZvaWQge1xuICAgIHRyeSB7XG4gICAgICAvLyDjg5fjg63jgrjjgqfjgq/jg4jmqJnmupbjgr/jgrDoqK3lrprjgpLlj5blvpfvvIhwcm9wc+OBi+OCieWPluW+l++8iVxuICAgICAgY29uc3QgdGFnZ2luZ0NvbmZpZyA9IFBlcm1pc3Npb25Bd2FyZVJBR1RhZ3MuZ2V0U3RhbmRhcmRDb25maWcoXCJwZXJtaXNzaW9uLWF3YXJlLXJhZ1wiLCBcbiAgICAgICAgKHRoaXMuZW52aXJvbm1lbnROYW1lIHx8ICdkZXYnKSBhcyAnZGV2JyB8ICdzdGFnaW5nJyB8ICdwcm9kJ1xuICAgICAgKTtcbiAgICAgIFxuICAgICAgLy8g55Kw5aKD5Yil44K/44Kw6Kit5a6a44KS44Oe44O844K4XG4gICAgICBjb25zdCBlbnZDb25maWcgPSBQZXJtaXNzaW9uQXdhcmVSQUdUYWdzLmdldEVudmlyb25tZW50Q29uZmlnKCh0aGlzLmVudmlyb25tZW50TmFtZSB8fCAnZGV2JykgYXMgJ2RldicgfCAnc3RhZ2luZycgfCAncHJvZCcpO1xuICAgICAgY29uc3QgbWVyZ2VkQ29uZmlnID0geyAuLi50YWdnaW5nQ29uZmlnLCAuLi5lbnZDb25maWcgfTtcbiAgICAgIFxuICAgICAgLy8g44K744Kt44Ol44Oq44OG44Kj6KaB5Lu244K/44Kw44KS44Oe44O844K4XG4gICAgICBjb25zdCBzZWN1cml0eUNvbmZpZyA9IFBlcm1pc3Npb25Bd2FyZVJBR1RhZ3MuZ2V0U2VjdXJpdHlDb25maWcoKHRoaXMuZW52aXJvbm1lbnROYW1lIHx8ICdkZXYnKSBhcyAnZGV2JyB8ICdzdGFnaW5nJyB8ICdwcm9kJyk7XG4gICAgICBjb25zdCBmaW5hbENvbmZpZyA9IHsgLi4ubWVyZ2VkQ29uZmlnLCAuLi5zZWN1cml0eUNvbmZpZyB9O1xuICAgICAgXG4gICAgICAvLyDjg4fjg7zjgr/jgrnjgr/jg4Pjgq/lm7rmnInjga7jgqvjgrnjgr/jg6Djgr/jgrDjgpLov73liqBcbiAgICAgIGZpbmFsQ29uZmlnLmN1c3RvbVRhZ3MgPSB7XG4gICAgICAgIC4uLmZpbmFsQ29uZmlnLmN1c3RvbVRhZ3MsXG4gICAgICAgICdNb2R1bGUnOiAnU3RvcmFnZStEYXRhYmFzZScsXG4gICAgICAgICdTdGFja1R5cGUnOiAnSW50ZWdyYXRlZCcsXG4gICAgICAgICdBcmNoaXRlY3R1cmUnOiAnTW9kdWxhcicsXG4gICAgICAgICdEYXRhYmFzZVR5cGVzJzogJ0R5bmFtb0RCK09wZW5TZWFyY2gnLFxuICAgICAgICAnSW5kaXZpZHVhbERlcGxveVN1cHBvcnQnOiAnWWVzJyxcbiAgICAgICAgJ0RhdGEtQ2xhc3NpZmljYXRpb24nOiAnU2Vuc2l0aXZlJyxcbiAgICAgICAgJ0JhY2t1cC1SZXF1aXJlZCc6ICd0cnVlJyxcbiAgICAgICAgJ0VuY3J5cHRpb24tUmVxdWlyZWQnOiAndHJ1ZScsXG4gICAgICB9O1xuICAgICAgXG4gICAgICAvLyDntbHkuIDjgr/jgrDmiKbnlaXjgpLpgannlKhcbiAgICAgIFRhZ2dpbmdTdHJhdGVneS5hcHBseVRhZ3NUb1N0YWNrKHRoaXMsIGZpbmFsQ29uZmlnKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coJ/Cfj7fvuI8gRGF0YVN0YWNr57Wx5LiA44K/44Kw6Kit5a6a5a6M5LqGJyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ+KdjCBEYXRhU3RhY2vjgr/jgrDoqK3lrprjgqjjg6njg7w6JywgZXJyb3IpO1xuICAgICAgXG4gICAgICAvLyDjg5Xjgqnjg7zjg6vjg5Djg4Pjgq86IOWfuuacrOOCv+OCsOOBruOBv+ioreWumlxuICAgICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdNb2R1bGUnLCAnU3RvcmFnZStEYXRhYmFzZScpO1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdTdGFja1R5cGUnLCAnSW50ZWdyYXRlZCcpO1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdNYW5hZ2VkQnknLCAnQ0RLJyk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKCfimqDvuI8gRGF0YVN0YWNr44OV44Kp44O844Or44OQ44OD44Kv44K/44Kw6Kit5a6a5a6M5LqGJyk7XG4gICAgfVxuICB9XG5cblxuXG4gIC8qKlxuICAgKiDmqZ/og73lvqnml6fnlKhEeW5hbW9EQuODhuODvOODluODq+OBruS9nOaIkFxuICAgKiBcbiAgICog5L2c5oiQ44GZ44KL44OG44O844OW44OrOlxuICAgKiAxLiDjgrvjg4Pjgrfjg6fjg7PnrqHnkIbjg4bjg7zjg5bjg6sgLSDoqo3oqLzjgrvjg4Pjgrfjg6fjg7Pjga7msLjntprljJZcbiAgICogMi4g44Om44O844K244O86Kit5a6a44OG44O844OW44OrIC0g44OG44O844Oe44O76KiA6Kqe44O744Oq44O844K444On44Oz6Kit5a6a44Gu5rC457aa5YyWXG4gICAqIDMuIOODgeODo+ODg+ODiOWxpeattOODhuODvOODluODqyAtIOODgeODo+ODg+ODiOWxpeattOOBrueuoeeQhlxuICAgKiA0LiDli5XnmoToqK3lrprjgq3jg6Pjg4Pjgrfjg6Xjg4bjg7zjg5bjg6sgLSDjg6Ljg4fjg6vjg7vjg5fjg63jg5DjgqTjg4Djg7zmg4XloLHjga7jgq3jg6Pjg4Pjgrfjg6VcbiAgICogNS4gUGVybWlzc2lvbiBBUEnnlKjjg4bjg7zjg5bjg6sgLSDjg6bjg7zjgrbjg7zjgqLjgq/jgrvjgrnjg7vmqKnpmZDjgq3jg6Pjg4Pjgrfjg6VcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlUGVybWlzc2lvbkFwaVRhYmxlcygpOiB2b2lkIHtcbiAgICBjb25zb2xlLmxvZygn8J+TiiDmqZ/og73lvqnml6fnlKhEeW5hbW9EQuODhuODvOODluODq+S9nOaIkOmWi+Wniy4uLicpO1xuXG4gICAgLy8gMS4g44K744OD44K344On44Oz566h55CG44OG44O844OW44Or77yI5qmf6IO95b6p5penIC0g6KaB5Lu2Me+8iVxuICAgIGNvbnN0IHNlc3Npb25UYWJsZSA9IG5ldyBTZXNzaW9uVGFibGVDb25zdHJ1Y3QodGhpcywgJ1Nlc3Npb25UYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYCR7dGhpcy5lbnZpcm9ubWVudE5hbWV9LXNlc3Npb25zYCxcbiAgICAgIGVudmlyb25tZW50OiB0aGlzLmVudmlyb25tZW50TmFtZSxcbiAgICB9KTtcbiAgICB0aGlzLmR5bmFtb0RiVGFibGVOYW1lc1snc2Vzc2lvbnMnXSA9IHNlc3Npb25UYWJsZS50YWJsZS50YWJsZU5hbWU7XG5cbiAgICAvLyAyLiDjg6bjg7zjgrbjg7zoqK3lrprjg4bjg7zjg5bjg6vvvIjmqZ/og73lvqnml6cgLSDopoHku7Yy77yJXG4gICAgY29uc3QgdXNlclByZWZlcmVuY2VzVGFibGUgPSBuZXcgVXNlclByZWZlcmVuY2VzVGFibGVDb25zdHJ1Y3QodGhpcywgJ1VzZXJQcmVmZXJlbmNlc1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBgJHt0aGlzLmVudmlyb25tZW50TmFtZX0tdXNlci1wcmVmZXJlbmNlc2AsXG4gICAgICBlbnZpcm9ubWVudDogdGhpcy5lbnZpcm9ubWVudE5hbWUsXG4gICAgfSk7XG4gICAgdGhpcy5keW5hbW9EYlRhYmxlTmFtZXNbJ3VzZXJQcmVmZXJlbmNlcyddID0gdXNlclByZWZlcmVuY2VzVGFibGUudGFibGUudGFibGVOYW1lO1xuXG4gICAgLy8gMy4g44OB44Oj44OD44OI5bGl5q2044OG44O844OW44Or77yI5qmf6IO95b6p5penIC0g6KaB5Lu2MTLvvIlcbiAgICBjb25zdCBjaGF0SGlzdG9yeVRhYmxlID0gbmV3IENoYXRIaXN0b3J5VGFibGVDb25zdHJ1Y3QodGhpcywgJ0NoYXRIaXN0b3J5VGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGAke3RoaXMuZW52aXJvbm1lbnROYW1lfS1jaGF0LWhpc3RvcnlgLFxuICAgICAgZW52aXJvbm1lbnQ6IHRoaXMuZW52aXJvbm1lbnROYW1lLFxuICAgIH0pO1xuICAgIHRoaXMuZHluYW1vRGJUYWJsZU5hbWVzWydjaGF0SGlzdG9yeSddID0gY2hhdEhpc3RvcnlUYWJsZS50YWJsZS50YWJsZU5hbWU7XG4gICAgdGhpcy5jaGF0SGlzdG9yeVRhYmxlID0gY2hhdEhpc3RvcnlUYWJsZS50YWJsZTtcblxuICAgIC8vIDQuIOWLleeahOioreWumuOCreODo+ODg+OCt+ODpeODhuODvOODluODq++8iOapn+iDveW+qeaXpyAtIOimgeS7tjTvvIlcbiAgICBjb25zdCBkaXNjb3ZlcnlDYWNoZVRhYmxlID0gbmV3IERpc2NvdmVyeUNhY2hlVGFibGVDb25zdHJ1Y3QodGhpcywgJ0Rpc2NvdmVyeUNhY2hlVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGAke3RoaXMuZW52aXJvbm1lbnROYW1lfS1kaXNjb3ZlcnktY2FjaGVgLFxuICAgICAgZW52aXJvbm1lbnQ6IHRoaXMuZW52aXJvbm1lbnROYW1lLFxuICAgIH0pO1xuICAgIHRoaXMuZHluYW1vRGJUYWJsZU5hbWVzWydkaXNjb3ZlcnlDYWNoZSddID0gZGlzY292ZXJ5Q2FjaGVUYWJsZS50YWJsZS50YWJsZU5hbWU7XG5cbiAgICAvLyA1LiBQZXJtaXNzaW9uIEFQSeeUqOODhuODvOODluODq1xuICAgIC8vIOODpuODvOOCtuODvOOCouOCr+OCu+OCueODhuODvOODluODq1xuICAgIHRoaXMudXNlckFjY2Vzc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdVc2VyQWNjZXNzVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGAke3RoaXMuZW52aXJvbm1lbnROYW1lfS11c2VyLWFjY2Vzcy10YWJsZWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3VzZXJJZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBlbmNyeXB0aW9uOiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0aGlzLmVudmlyb25tZW50TmFtZSA9PT0gJ3Byb2QnLFxuICAgICAgcmVtb3ZhbFBvbGljeTogdGhpcy5lbnZpcm9ubWVudE5hbWUgPT09ICdwcm9kJyBcbiAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gXG4gICAgICAgIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcbiAgICB0aGlzLmR5bmFtb0RiVGFibGVOYW1lc1sndXNlckFjY2VzcyddID0gdGhpcy51c2VyQWNjZXNzVGFibGUudGFibGVOYW1lO1xuXG4gICAgLy8g5qip6ZmQ44Kt44Oj44OD44K344Ol44OG44O844OW44OrXG4gICAgdGhpcy5wZXJtaXNzaW9uQ2FjaGVUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnUGVybWlzc2lvbkNhY2hlVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGAke3RoaXMuZW52aXJvbm1lbnROYW1lfS1wZXJtaXNzaW9uLWNhY2hlYCxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnY2FjaGVLZXknLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogJ3R0bCcsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLCAvLyDjgq3jg6Pjg4Pjgrfjg6Xjga/liYrpmaTlj6/og71cbiAgICB9KTtcbiAgICB0aGlzLmR5bmFtb0RiVGFibGVOYW1lc1sncGVybWlzc2lvbkNhY2hlJ10gPSB0aGlzLnBlcm1pc3Npb25DYWNoZVRhYmxlLnRhYmxlTmFtZTtcblxuICAgIC8vIENsb3VkRm9ybWF0aW9uIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2Vzc2lvblRhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiBzZXNzaW9uVGFibGUudGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdTZXNzaW9uIE1hbmFnZW1lbnQgVGFibGUgTmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tU2Vzc2lvblRhYmxlTmFtZWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclByZWZlcmVuY2VzVGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHVzZXJQcmVmZXJlbmNlc1RhYmxlLnRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVXNlciBQcmVmZXJlbmNlcyBUYWJsZSBOYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Vc2VyUHJlZmVyZW5jZXNUYWJsZU5hbWVgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NoYXRIaXN0b3J5VGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IGNoYXRIaXN0b3J5VGFibGUudGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdDaGF0IEhpc3RvcnkgVGFibGUgTmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQ2hhdEhpc3RvcnlUYWJsZU5hbWVgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Rpc2NvdmVyeUNhY2hlVGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IGRpc2NvdmVyeUNhY2hlVGFibGUudGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdEaXNjb3ZlcnkgQ2FjaGUgVGFibGUgTmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tRGlzY292ZXJ5Q2FjaGVUYWJsZU5hbWVgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJBY2Nlc3NUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyQWNjZXNzVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdVc2VyIEFjY2VzcyBUYWJsZSBOYW1lIGZvciBQZXJtaXNzaW9uIEFQSScsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tVXNlckFjY2Vzc1RhYmxlTmFtZWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUGVybWlzc2lvbkNhY2hlVGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMucGVybWlzc2lvbkNhY2hlVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdQZXJtaXNzaW9uIENhY2hlIFRhYmxlIE5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVBlcm1pc3Npb25DYWNoZVRhYmxlTmFtZWAsXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIOapn+iDveW+qeaXp+eUqER5bmFtb0RC44OG44O844OW44Or5L2c5oiQ5a6M5LqGJyk7XG4gIH1cbn1cbiJdfQ==