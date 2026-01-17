import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import { GlobalRagConfig } from '../../types/global-config';
/**
 * セキュリティ監視設定
 */
export interface SecurityMonitoringConfig {
    /** 脅威検出感度レベル */
    threatDetectionSensitivity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    /** 監視間隔（分） */
    monitoringIntervalMinutes: number;
    /** インシデント対応SLA（分） */
    incidentResponseSlaMinutes: number;
    /** 自動対応有効化 */
    autoResponseEnabled: boolean;
    /** 監視対象地域 */
    monitoredRegions: string[];
    /** アラート通知設定 */
    alertSettings: {
        email: string[];
        sms: string[];
        webhook?: string;
    };
}
/**
 * セキュリティ脅威レベル
 */
export declare enum ThreatLevel {
    CRITICAL = "CRITICAL",
    HIGH = "HIGH",
    MEDIUM = "MEDIUM",
    LOW = "LOW",
    INFO = "INFO"
}
/**
 * インシデント状態
 */
export declare enum IncidentStatus {
    OPEN = "OPEN",
    INVESTIGATING = "INVESTIGATING",
    CONTAINED = "CONTAINED",
    RESOLVED = "RESOLVED",
    CLOSED = "CLOSED"
}
/**
 * 統一セキュリティ監視システム
 *
 * 機能:
 * - 統一セキュリティ基準監視
 * - 脅威検出システム
 * - インシデント対応自動化
 * - セキュリティメトリクス収集
 * - リアルタイムアラート
 */
export declare class SecurityMonitoringSystem extends Construct {
    readonly securityEventsTable: dynamodb.Table;
    readonly incidentsTable: dynamodb.Table;
    readonly threatIntelTable: dynamodb.Table;
    readonly threatDetectorFunction: lambda.Function;
    readonly incidentResponderFunction: lambda.Function;
    readonly securityAnalyzerFunction: lambda.Function;
    readonly alertManagerFunction: lambda.Function;
    readonly securityWorkflow: stepfunctions.StateMachine;
    readonly securityAlertTopic: sns.Topic;
    readonly securityLogGroup: logs.LogGroup;
    private readonly globalConfig;
    private readonly securityConfig;
    constructor(scope: Construct, id: string, props: {
        globalConfig: GlobalRagConfig;
        securityConfig: SecurityMonitoringConfig;
    });
    /**
      * セキュリティイベントテーブルの作成
      */
    private createSecurityEventsTable;
    /**
     * インシデントテーブルの作成
     */
    private createIncidentsTable;
    /**
     * 脅威インテリジェンステーブルの作成
     */
    private createThreatIntelTable;
    /**
     * セキュリティログ群の作成
     */
    private createSecurityLogGroup;
    /**
     * セキュリティアラートトピックの作成
     */
    private createSecurityAlertTopic;
    /**
     * 脅威検出Lambda関数
     */
    private createThreatDetectorFunction;
    private createIncidentResponderFunction;
    /**
     * セキュリティ分析Lambda関数
     */
    private createSecurityAnalyzerFunction;
    /**
     * アラート管理Lambda関数
     */
    private createAlertManagerFunction;
    /**
     * Step Functions ワークフローの作成
     */
    private createSecurityWorkflow;
    /**
     * 監視スケジュールの作成
     */
    private createMonitoringSchedules;
    /**
     * CloudWatchイベントルールの作成
     */
    private createSecurityEventRules;
    /**
     * 必要なIAM権限の設定
     */
    private setupIamPermissions;
    /**
     * 初期化処理
     */
    initialize(): void;
}
