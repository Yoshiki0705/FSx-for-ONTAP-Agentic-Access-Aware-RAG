/**
 * リソース競合ハンドラー（Early Validation Hook対応版）
 *
 * 目的:
 * - デプロイ前に既存リソースとの競合を検出
 * - 競合解決オプションを提供
 * - Early Validation errorを事前に防止
 * - Early Validation Hook発生時の動的リソース名変更
 *
 * 新機能（2026-01-18追加）:
 * - 変更セットの事前確認機能
 * - Early Validation Hook検知
 * - 動的リソース名変更機能
 * - 自動リトライ機能
 */
import * as cdk from 'aws-cdk-lib';
import { IConstruct } from 'constructs';
export interface ResourceConflictCheckResult {
    hasConflict: boolean;
    conflictingResources: ConflictingResource[];
    recommendations: string[];
    earlyValidationHookDetected?: boolean;
    hookFailureDetails?: HookFailureDetails;
}
export interface ConflictingResource {
    resourceType: string;
    resourceName: string;
    resourceId?: string;
    existingResourceArn?: string;
    conflictReason: string;
}
export interface HookFailureDetails {
    hookName: string;
    failureMode: string;
    failedResources: string[];
    errorMessage: string;
    suggestedResourceNames?: {
        [key: string]: string;
    };
}
export interface ResourceConflictHandlerProps {
    region: string;
    accountId: string;
    stackName: string;
    resourcePrefix: string;
    vpcId?: string;
}
/**
 * リソース競合ハンドラークラス（Early Validation Hook対応版）
 */
export declare class ResourceConflictHandler {
    private dynamodb;
    private cloudformation;
    private ec2;
    private props;
    constructor(props: ResourceConflictHandlerProps);
    /**
     * 変更セットの事前確認（Early Validation Hook検知）
     *
     * @param changeSetName 変更セット名
     * @returns 変更セット確認結果
     */
    checkChangeSet(changeSetName: string): Promise<ResourceConflictCheckResult>;
    /**
     * Hook失敗詳細の解析
     *
     * @param statusReason CloudFormationのStatusReason
     * @returns Hook失敗詳細
     */
    private parseHookFailure;
    /**
     * 動的リソース名の生成
     *
     * @param failedResources 失敗したリソース名のリスト
     * @returns 新しいリソース名のマップ
     */
    private generateDynamicResourceNames;
    /**
     * 変更セットの作成と確認
     *
     * @param templateBody CloudFormationテンプレート
     * @returns 変更セット確認結果
     */
    createAndCheckChangeSet(templateBody: string): Promise<ResourceConflictCheckResult>;
    /**
     * 変更セット作成完了を待機
     *
     * @param changeSetName 変更セット名
     */
    private waitForChangeSetCreation;
    /**
     * Security Groupの競合チェック
     */
    checkSecurityGroupConflicts(securityGroupNames: string[]): Promise<ResourceConflictCheckResult>;
    /**
     * DynamoDBテーブル名の競合チェック
     */
    checkDynamoDBConflicts(tableNames: string[]): Promise<ResourceConflictCheckResult>;
    /**
     * CloudFormationスタックの既存リソースチェック
     */
    checkStackResources(): Promise<ResourceConflictCheckResult>;
    /**
     * 包括的なリソース競合チェック
     */
    checkAllConflicts(tableNames: string[], securityGroupNames?: string[]): Promise<ResourceConflictCheckResult>;
    /**
     * 競合レポートの出力
     */
    printConflictReport(result: ResourceConflictCheckResult): void;
}
/**
 * CDK Aspect: デプロイ前にリソース競合をチェック
 */
export declare class ResourceConflictAspect implements cdk.IAspect {
    private handler;
    private tableNames;
    private securityGroupNames;
    constructor(handler: ResourceConflictHandler);
    visit(node: IConstruct): void;
    /**
     * 収集したリソース名で競合チェックを実行
     */
    checkConflicts(): Promise<ResourceConflictCheckResult>;
}
