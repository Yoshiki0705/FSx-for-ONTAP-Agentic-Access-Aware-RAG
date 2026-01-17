/**
 * 包括的デプロイメントスタック
 *
 * 全てのCDKスタックを統合的にデプロイするためのマスタースタック
 * 依存関係を管理し、段階的なデプロイメントを実現
 */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SecurityStack } from '../security-stack';
import { NetworkingStack } from '../networking-stack';
import { DataStack } from '../data-stack';
import { EmbeddingStack } from '../embedding-stack';
import { WebAppStack } from '../webapp-stack';
import { OperationsStack } from '../operations-stack';
import { JapanDeploymentStack } from '../japan-deployment-stack';
import { USDeploymentStack } from '../us-deployment-stack';
import { EUDeploymentStack } from '../eu-deployment-stack';
import { APACDeploymentStack } from '../apac-deployment-stack';
import { SouthAmericaDeploymentStack } from '../south-america-deployment-stack';
import { DisasterRecoveryStack } from '../disaster-recovery-stack';
import { GlobalDeploymentStack } from '../global-deployment-stack';
import { FSxNStack } from '../../fsxn-stack';
import { NetworkStack } from '../../network-stack';
import { MinimalProductionStack } from '../../minimal-production-stack';
export interface ComprehensiveDeploymentStackProps extends cdk.StackProps {
    /** プロジェクト名（50文字以内、英数字・ハイフン・アンダースコアのみ） */
    projectName: string;
    /** 環境名（厳密な型制約） */
    environment: 'dev' | 'staging' | 'prod' | 'test';
    deploymentConfig: {
        enableSecurity: boolean;
        enableNetworking: boolean;
        enableData: boolean;
        enableEmbedding: boolean;
        enableWebApp: boolean;
        enableOperations: boolean;
        enableJapan: boolean;
        enableUS: boolean;
        enableEU: boolean;
        enableAPAC: boolean;
        enableSouthAmerica: boolean;
        enableDisasterRecovery: boolean;
        enableGlobalDeployment: boolean;
        enableFSxN: boolean;
        enableMinimalProduction: boolean;
    };
    regions: {
        primary: string;
        secondary?: string;
        disaster?: string;
    };
    securityConfig?: any;
    networkingConfig?: any;
    dataConfig?: any;
    computeConfig?: any;
    webAppConfig?: any;
    operationsConfig?: any;
}
export declare class ComprehensiveDeploymentStack extends cdk.Stack {
    readonly securityStack?: SecurityStack;
    readonly networkingStack?: NetworkingStack;
    readonly dataStack?: DataStack;
    readonly embeddingStack?: EmbeddingStack;
    readonly webAppStack?: WebAppStack;
    readonly operationsStack?: OperationsStack;
    readonly japanStack?: JapanDeploymentStack;
    readonly usStack?: USDeploymentStack;
    readonly euStack?: EUDeploymentStack;
    readonly apacStack?: APACDeploymentStack;
    readonly southAmericaStack?: SouthAmericaDeploymentStack;
    readonly disasterRecoveryStack?: DisasterRecoveryStack;
    readonly globalStack?: GlobalDeploymentStack;
    readonly fsxnStack?: FSxNStack;
    readonly networkStack?: NetworkStack;
    readonly minimalProductionStack?: MinimalProductionStack;
    readonly deploymentInfo: {
        deployedStacks: string[];
        skippedStacks: string[];
        totalStacks: number;
        deploymentOrder: string[];
    };
    constructor(scope: Construct, id: string, props: ComprehensiveDeploymentStackProps);
    /**
     * 入力値の検証（セキュリティ対策）
     */
    private validateInputs;
    /**
     * CloudFormation出力の作成
     */
    private createOutputs;
    /**
     * スタックレベルのタグ設定（セキュリティ対策付き）
     */
    private applyStackTags;
    /**
     * タグ値のサニタイズ（セキュリティ対策）
     */
    private sanitizeTagValue;
    /**
     * デフォルトセキュリティ設定の取得
     */
    private getDefaultSecurityConfig;
    /**
     * デフォルトネットワーキング設定の取得
     */
    private getDefaultNetworkingConfig;
    /**
     * デプロイメント統計の取得
     */
    getDeploymentStats(): {
        deploymentPhases: {
            'Phase1-Security': string;
            'Phase2-Networking': string;
            'Phase3-Data': string;
            'Phase4-Embedding': string;
            'Phase5-WebApp': string;
            'Phase6-Operations': string;
            'Phase7-Regional': string;
            'Phase8-Special': string;
        };
        deployedStacks: string[];
        skippedStacks: string[];
        totalStacks: number;
        deploymentOrder: string[];
    };
    /**
     * システム情報の取得
     */
    getSystemInfo(): {
        stackName: string;
        region: string;
        account: string;
        deploymentInfo: {
            deployedStacks: string[];
            skippedStacks: string[];
            totalStacks: number;
            deploymentOrder: string[];
        };
        enabledComponents: {
            security: boolean;
            networking: boolean;
            data: boolean;
            embedding: boolean;
            webapp: boolean;
            operations: boolean;
        };
        regionalDeployments: {
            japan: boolean;
            us: boolean;
            eu: boolean;
            apac: boolean;
            southAmerica: boolean;
        };
        specialFeatures: {
            disasterRecovery: boolean;
            global: boolean;
            fsxn: boolean;
            minimalProduction: boolean;
        };
    };
    /**
     * セキュリティリソースの取得
     */
    getSecurityResources(): {
        securityStack: SecurityStack;
        kmsKey: any;
        wafWebAcl: any;
    };
    /**
     * ネットワークリソースの取得
     */
    getNetworkResources(): {
        networkingStack: NetworkingStack;
        networkStack: NetworkStack;
        vpc: any;
        publicSubnets: any;
        privateSubnets: any;
        isolatedSubnets: any;
        securityGroups: any;
    };
    /**
     * データリソースの取得
     */
    getDataResources(): {
        dataStack: DataStack;
        fsxnStack: FSxNStack;
        s3Buckets: any;
        dynamoDbTables: any;
        openSearchCollection: any;
        fsxFileSystem: any;
    };
}
