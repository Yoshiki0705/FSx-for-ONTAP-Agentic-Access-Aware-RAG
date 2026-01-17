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
import { Construct } from 'constructs';
import { StorageConstruct } from '../../modules/storage/constructs/storage-construct';
import { DatabaseConstruct } from '../../modules/database/constructs/database-construct';
import { StorageConfig } from '../../modules/storage/interfaces/storage-config';
import { DatabaseConfig } from '../../modules/database/interfaces/database-config';
import { SecurityStack } from './security-stack';
export interface DataStackConfig {
    readonly storage: StorageConfig;
    readonly database: DatabaseConfig;
}
export interface DataStackProps extends cdk.StackProps {
    readonly config: DataStackConfig;
    readonly projectName?: string;
    readonly securityStack?: SecurityStack;
    readonly namingGenerator?: any;
    readonly environment: string;
    readonly vpc?: any;
    readonly privateSubnetIds?: string[];
}
/**
 * 統合データスタック（モジュラーアーキテクチャ対応）
 *
 * 統合ストレージ・データベースコンストラクトによる一元管理
 * 個別スタックデプロイ完全対応
 */
export declare class DataStack extends cdk.Stack {
    /** 統合ストレージコンストラクト */
    readonly storage: StorageConstruct;
    /** 統合データベースコンストラクト */
    readonly database: DatabaseConstruct;
    /** S3バケット名（他スタックからの参照用） */
    readonly s3BucketNames: {
        [key: string]: string;
    };
    /** DynamoDBテーブル名（他スタックからの参照用） */
    readonly dynamoDbTableNames: {
        [key: string]: string;
    };
    /** OpenSearchドメインエンドポイント（他スタックからの参照用） */
    openSearchEndpoint?: string;
    /** Permission API用DynamoDBテーブル */
    userAccessTable?: dynamodb.Table;
    permissionCacheTable?: dynamodb.Table;
    /** チャット履歴用DynamoDBテーブル */
    chatHistoryTable?: dynamodb.Table;
    /** プロジェクト名（内部参照用） */
    private readonly projectName;
    /** 環境名（内部参照用） */
    private readonly environmentName;
    constructor(scope: Construct, id: string, props: DataStackProps);
    /**
     * S3バケットの型ガード
     */
    private isValidS3Bucket;
    /**
     * DynamoDBテーブルの型ガード
     */
    private isValidDynamoDbTable;
    /**
     * 他スタックからの参照用プロパティ設定（型安全性強化版）
     */
    private setupCrossStackReferences;
    /**
     * スタック出力作成（個別デプロイ対応）
     */
    private createOutputs;
    /**
     * スタックタグ設定（統一タグ戦略準拠）
     */
    private addStackTags;
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
    private createPermissionApiTables;
}
