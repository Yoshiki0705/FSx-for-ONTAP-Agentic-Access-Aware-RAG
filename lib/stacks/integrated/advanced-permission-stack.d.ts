/**
 * AdvancedPermissionStack - 高度権限制御統合スタック
 *
 * 機能:
 * - 時間ベース制限、地理的制限、動的権限の統合管理
 * - 高度権限フィルタリングエンジンのデプロイ
 * - 権限キャッシュ・監査ログシステムの構築
 * - 既存セキュリティスタックとの連携
 */
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { AdvancedPermissionFilterEngine } from '../../modules/enterprise/constructs/advanced-permission-filter-engine';
export interface AdvancedPermissionStackProps extends cdk.StackProps {
    /** プロジェクト設定 */
    readonly config: any;
    /** 環境名 */
    readonly environment: string;
    /** OpenSearchドメインエンドポイント */
    readonly opensearchEndpoint: string;
    /** セキュリティスタックからのKMSキー */
    readonly kmsKeyArn?: string;
    /** 既存VPCの参照 */
    readonly vpcId?: string;
    /** 命名ジェネレーター */
    readonly namingGenerator?: any;
}
/**
 * 高度権限制御統合スタック
 *
 * エンタープライズグレードの権限制御システムを統合管理
 */
export declare class AdvancedPermissionStack extends cdk.Stack {
    /** 高度権限フィルタリングエンジン */
    permissionEngine: AdvancedPermissionFilterEngine;
    /** 権限設定テーブル */
    permissionConfigTable: dynamodb.Table;
    /** ユーザープロファイルテーブル */
    userProfileTable: dynamodb.Table;
    /** 監査ログテーブル */
    auditLogTable: dynamodb.Table;
    /** 権限管理API Lambda */
    permissionManagementApi: lambda.Function;
    /** 監視・アラート用SNSトピック */
    alertTopic: sns.Topic;
    /** CloudWatchダッシュボード */
    monitoringDashboard: cloudwatch.Dashboard;
    constructor(scope: Construct, id: string, props: AdvancedPermissionStackProps);
    /**
     * DynamoDBテーブル作成
     */
    private createDynamoDBTables;
    /**
     * 権限管理API作成
     */
    private createPermissionManagementApi;
    /**
     * 監視・アラートシステム作成
     */
    private createMonitoringSystem;
    /**
     * CloudWatchアラーム作成
     */
    private createCloudWatchAlarms;
    /**
     * CloudWatchダッシュボード作成
     */
    private createDashboard;
    /**
     * スタック出力作成
     */
    private createOutputs;
    /**
     * スタックタグ設定
     */
    private addStackTags;
    /**
     * 権限管理API Lambda関数コード
     */
    private getPermissionManagementApiCode;
}
