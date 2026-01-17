/**
 * メイン統合デプロイメントスタック
 *
 * 6つの統合スタックを依存関係に基づいて段階的にデプロイ
 * 設定の一元管理と環境別デプロイメント対応
 */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SecurityStack, NetworkingStack, DataStack, EmbeddingStack, WebAppStack, OperationsStack, IntegratedStacksConfig } from './index';
import { AdvancedPermissionStack } from './advanced-permission-stack';
import { SecurityConfig } from '../../modules/security/interfaces/security-config';
import { NetworkingConfig } from '../../modules/networking/interfaces/networking-config';
import { StorageConfig } from '../../modules/storage/interfaces/storage-config';
import { DatabaseConfig } from '../../modules/database/interfaces/database-config';
import { ComputeConfig } from '../../modules/compute/interfaces/compute-config';
import { AiConfig } from '../../modules/ai/interfaces/ai-config';
import { ApiConfig } from '../../modules/api/interfaces/api-config';
import { MonitoringConfig } from '../../modules/monitoring/interfaces/monitoring-config';
import { EnterpriseConfig } from '../../modules/enterprise/interfaces/enterprise-config';
export interface MainDeploymentStackProps extends cdk.StackProps {
    config: IntegratedStacksConfig;
    securityConfig: SecurityConfig;
    networkingConfig: NetworkingConfig;
    storageConfig: StorageConfig;
    databaseConfig: DatabaseConfig;
    computeConfig: ComputeConfig;
    aiConfig: AiConfig;
    apiConfig: ApiConfig;
    monitoringConfig: MonitoringConfig;
    enterpriseConfig: EnterpriseConfig;
    enableAdvancedPermissionControl?: boolean;
    opensearchEndpoint?: string;
}
export declare class MainDeploymentStack extends cdk.Stack {
    readonly securityStack?: SecurityStack;
    readonly networkingStack?: NetworkingStack;
    readonly dataStack?: DataStack;
    readonly embeddingStack?: EmbeddingStack;
    readonly webAppStack?: WebAppStack;
    readonly operationsStack?: OperationsStack;
    readonly advancedPermissionStack?: AdvancedPermissionStack;
    readonly deploymentInfo: {
        deployedStacks: string[];
        skippedStacks: string[];
        totalDeploymentTime: string;
        estimatedMonthlyCost: string;
    };
    constructor(scope: Construct, id: string, props: MainDeploymentStackProps);
    /**
     * デプロイメント時間の計算
     */
    private calculateDeploymentTime;
    /**
     * 月額コストの計算
     */
    private calculateMonthlyCost;
    /**
     * デプロイメント情報のCloudFormation出力
     */
    private createDeploymentOutputs;
    /**
     * スタックレベルのタグ設定
     */
    private applyStackTags;
    /**
     * デプロイメント情報の取得
     */
    getDeploymentInfo(): {
        deployedStacks: string[];
        skippedStacks: string[];
        totalDeploymentTime: string;
        estimatedMonthlyCost: string;
    };
    /**
     * 特定のスタックが有効かどうかを確認
     */
    isStackEnabled(stackName: string): boolean;
    /**
     * 全体的なシステム情報を取得
     */
    getSystemInfo(): {
        projectName: string;
        region: string;
        account: string;
        deploymentInfo: {
            deployedStacks: string[];
            skippedStacks: string[];
            totalDeploymentTime: string;
            estimatedMonthlyCost: string;
        };
        endpoints: {
            website: string;
            api: any;
            monitoring: string;
        };
        resources: {
            security: string;
            networking: string;
            data: string;
            embedding: string;
            webapp: string;
            operations: string;
        };
    };
}
