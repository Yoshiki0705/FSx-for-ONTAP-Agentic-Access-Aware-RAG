"use strict";
/**
 * 包括的デプロイメントスタック
 *
 * 全てのCDKスタックを統合的にデプロイするためのマスタースタック
 * 依存関係を管理し、段階的なデプロイメントを実現
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
exports.ComprehensiveDeploymentStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
// 既存スタックのインポート
const security_stack_1 = require("../security-stack");
const networking_stack_1 = require("../networking-stack");
const data_stack_1 = require("../data-stack");
const embedding_stack_1 = require("../embedding-stack");
const webapp_stack_1 = require("../webapp-stack");
const operations_stack_1 = require("../operations-stack");
// リージョン別スタック
const japan_deployment_stack_1 = require("../japan-deployment-stack");
const us_deployment_stack_1 = require("../us-deployment-stack");
const eu_deployment_stack_1 = require("../eu-deployment-stack");
const apac_deployment_stack_1 = require("../apac-deployment-stack");
const south_america_deployment_stack_1 = require("../south-america-deployment-stack");
// 特殊スタック
const disaster_recovery_stack_1 = require("../disaster-recovery-stack");
const global_deployment_stack_1 = require("../global-deployment-stack");
// ルートレベルスタック
const fsxn_stack_1 = require("../../fsxn-stack");
const network_stack_1 = require("../../network-stack");
const minimal_production_stack_1 = require("../../minimal-production-stack");
class ComprehensiveDeploymentStack extends cdk.Stack {
    // 基本スタック
    securityStack;
    networkingStack;
    dataStack;
    embeddingStack;
    webAppStack;
    operationsStack;
    // リージョン別スタック
    japanStack;
    usStack;
    euStack;
    apacStack;
    southAmericaStack;
    // 特殊スタック
    disasterRecoveryStack;
    globalStack;
    fsxnStack;
    networkStack;
    minimalProductionStack;
    // デプロイメント情報
    deploymentInfo;
    constructor(scope, id, props) {
        super(scope, id, props);
        // 入力値の検証（セキュリティ対策）
        this.validateInputs(props);
        const { projectName, environment, deploymentConfig, regions } = props;
        const deployedStacks = [];
        const skippedStacks = [];
        const deploymentOrder = [];
        // Phase 1: セキュリティ基盤
        if (deploymentConfig.enableSecurity) {
            try {
                this.securityStack = new security_stack_1.SecurityStack(this, 'Security', {
                    config: props.securityConfig || this.getDefaultSecurityConfig(projectName, environment),
                    projectName,
                    environment,
                    env: { region: regions.primary },
                });
                deployedStacks.push('SecurityStack');
                deploymentOrder.push('Phase1-Security');
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`SecurityStack の作成に失敗しました: ${errorMessage}`);
            }
        }
        else {
            skippedStacks.push('SecurityStack');
        }
        // Phase 2: ネットワーク基盤
        if (deploymentConfig.enableNetworking) {
            this.networkingStack = new networking_stack_1.NetworkingStack(this, 'Networking', {
                env: { region: regions.primary },
            });
            // セキュリティスタックへの依存関係
            if (this.securityStack) {
                this.networkingStack.addDependency(this.securityStack);
            }
            deployedStacks.push('NetworkingStack');
            deploymentOrder.push('Phase2-Networking');
        }
        else {
            skippedStacks.push('NetworkingStack');
        }
        // 従来のネットワークスタック（互換性のため）
        if (deploymentConfig.enableNetworking) {
            this.networkStack = new network_stack_1.NetworkStack(this, 'Network', {
                env: { region: regions.primary },
            });
            if (this.networkingStack) {
                this.networkStack.addDependency(this.networkingStack);
            }
            deployedStacks.push('NetworkStack');
        }
        // Phase 3: データ・ストレージ
        if (deploymentConfig.enableData) {
            this.dataStack = new data_stack_1.DataStack(this, 'Data', {
                env: { region: regions.primary },
            });
            // 依存関係設定
            if (this.securityStack) {
                this.dataStack.addDependency(this.securityStack);
            }
            if (this.networkingStack) {
                this.dataStack.addDependency(this.networkingStack);
            }
            deployedStacks.push('DataStack');
            deploymentOrder.push('Phase3-Data');
        }
        else {
            skippedStacks.push('DataStack');
        }
        // FSxN スタック
        if (deploymentConfig.enableFSxN) {
            this.fsxnStack = new fsxn_stack_1.FSxNStack(this, 'FSxN', {
                env: { region: regions.primary },
            });
            if (this.networkStack) {
                this.fsxnStack.addDependency(this.networkStack);
            }
            deployedStacks.push('FSxNStack');
        }
        // Phase 4: Embedding・AI
        if (deploymentConfig.enableEmbedding) {
            this.embeddingStack = new embedding_stack_1.EmbeddingStack(this, 'Embedding', {
                env: { region: regions.primary },
            });
            // 依存関係設定
            if (this.securityStack) {
                this.embeddingStack.addDependency(this.securityStack);
            }
            if (this.networkingStack) {
                this.embeddingStack.addDependency(this.networkingStack);
            }
            if (this.dataStack) {
                this.embeddingStack.addDependency(this.dataStack);
            }
            deployedStacks.push('EmbeddingStack');
            deploymentOrder.push('Phase4-Embedding');
        }
        else {
            skippedStacks.push('EmbeddingStack');
        }
        // Phase 5: WebApp・API
        if (deploymentConfig.enableWebApp) {
            this.webAppStack = new webapp_stack_1.WebAppStack(this, 'WebApp', {
                env: { region: regions.primary },
            });
            // 依存関係設定
            if (this.securityStack) {
                this.webAppStack.addDependency(this.securityStack);
            }
            if (this.networkingStack) {
                this.webAppStack.addDependency(this.networkingStack);
            }
            if (this.embeddingStack) {
                this.webAppStack.addDependency(this.embeddingStack);
            }
            deployedStacks.push('WebAppStack');
            deploymentOrder.push('Phase5-WebApp');
        }
        else {
            skippedStacks.push('WebAppStack');
        }
        // Phase 6: 運用・監視
        if (deploymentConfig.enableOperations) {
            this.operationsStack = new operations_stack_1.OperationsStack(this, 'Operations', {
                env: { region: regions.primary },
            });
            // 全スタックへの依存関係
            [this.securityStack, this.networkingStack, this.dataStack, this.embeddingStack, this.webAppStack]
                .filter(stack => stack)
                .forEach(stack => {
                if (stack && this.operationsStack) {
                    this.operationsStack.addDependency(stack);
                }
            });
            deployedStacks.push('OperationsStack');
            deploymentOrder.push('Phase6-Operations');
        }
        else {
            skippedStacks.push('OperationsStack');
        }
        // Phase 7: リージョン別デプロイメント
        if (deploymentConfig.enableJapan) {
            this.japanStack = new japan_deployment_stack_1.JapanDeploymentStack(this, 'Japan', {
                env: { region: 'ap-northeast-1' },
            });
            deployedStacks.push('JapanDeploymentStack');
            deploymentOrder.push('Phase7-Japan');
        }
        if (deploymentConfig.enableUS) {
            this.usStack = new us_deployment_stack_1.USDeploymentStack(this, 'US', {
                env: { region: 'us-east-1' },
            });
            deployedStacks.push('USDeploymentStack');
            deploymentOrder.push('Phase7-US');
        }
        if (deploymentConfig.enableEU) {
            this.euStack = new eu_deployment_stack_1.EUDeploymentStack(this, 'EU', {
                env: { region: 'eu-west-1' },
            });
            deployedStacks.push('EUDeploymentStack');
            deploymentOrder.push('Phase7-EU');
        }
        if (deploymentConfig.enableAPAC) {
            this.apacStack = new apac_deployment_stack_1.APACDeploymentStack(this, 'APAC', {
                env: { region: 'ap-southeast-1' },
            });
            deployedStacks.push('APACDeploymentStack');
            deploymentOrder.push('Phase7-APAC');
        }
        if (deploymentConfig.enableSouthAmerica) {
            this.southAmericaStack = new south_america_deployment_stack_1.SouthAmericaDeploymentStack(this, 'SouthAmerica', {
                env: { region: 'sa-east-1' },
            });
            deployedStacks.push('SouthAmericaDeploymentStack');
            deploymentOrder.push('Phase7-SouthAmerica');
        }
        // Phase 8: 特殊機能
        if (deploymentConfig.enableDisasterRecovery && regions.disaster) {
            this.disasterRecoveryStack = new disaster_recovery_stack_1.DisasterRecoveryStack(this, 'DisasterRecovery', {
                env: { region: regions.disaster },
            });
            deployedStacks.push('DisasterRecoveryStack');
            deploymentOrder.push('Phase8-DisasterRecovery');
        }
        if (deploymentConfig.enableGlobalDeployment) {
            this.globalStack = new global_deployment_stack_1.GlobalDeploymentStack(this, 'Global', {
                env: { region: regions.primary },
            });
            deployedStacks.push('GlobalDeploymentStack');
            deploymentOrder.push('Phase8-Global');
        }
        if (deploymentConfig.enableMinimalProduction) {
            this.minimalProductionStack = new minimal_production_stack_1.MinimalProductionStack(this, 'MinimalProduction', {
                env: { region: regions.primary },
            });
            deployedStacks.push('MinimalProductionStack');
            deploymentOrder.push('Phase8-MinimalProduction');
        }
        // デプロイメント情報の設定
        this.deploymentInfo = {
            deployedStacks,
            skippedStacks,
            totalStacks: deployedStacks.length + skippedStacks.length,
            deploymentOrder,
        };
        // CloudFormation出力
        this.createOutputs();
        // スタックレベルのタグ設定
        this.applyStackTags(projectName, environment);
    }
    /**
     * 入力値の検証（セキュリティ対策）
     */
    validateInputs(props) {
        const { projectName, environment, regions } = props;
        // プロジェクト名の検証
        if (!projectName || typeof projectName !== 'string') {
            throw new Error('プロジェクト名が設定されていません');
        }
        if (projectName.trim().length === 0) {
            throw new Error('プロジェクト名が空文字です');
        }
        if (projectName.length > 50) {
            throw new Error('プロジェクト名は50文字以内で設定してください');
        }
        // セキュリティ: 安全な文字のみ許可
        if (!/^[a-zA-Z0-9\-_]+$/.test(projectName)) {
            throw new Error('プロジェクト名に不正な文字が含まれています（英数字、ハイフン、アンダースコアのみ許可）');
        }
        // 環境名の検証
        const validEnvironments = ['dev', 'staging', 'prod', 'test'];
        if (!validEnvironments.includes(environment)) {
            throw new Error(`環境名は次のいずれかを指定してください: ${validEnvironments.join(', ')}`);
        }
        // リージョン設定の検証
        if (!regions.primary || typeof regions.primary !== 'string') {
            throw new Error('プライマリリージョンが設定されていません');
        }
        // AWSリージョン形式の検証
        const regionPattern = /^[a-z]{2}-[a-z]+-\d+$/;
        if (!regionPattern.test(regions.primary)) {
            throw new Error(`無効なリージョン形式です: ${regions.primary}`);
        }
        if (regions.secondary && !regionPattern.test(regions.secondary)) {
            throw new Error(`無効なセカンダリリージョン形式です: ${regions.secondary}`);
        }
        if (regions.disaster && !regionPattern.test(regions.disaster)) {
            throw new Error(`無効な災害復旧リージョン形式です: ${regions.disaster}`);
        }
    }
    /**
     * CloudFormation出力の作成
     */
    createOutputs() {
        new cdk.CfnOutput(this, 'DeployedStacks', {
            value: this.deploymentInfo.deployedStacks.join(', '),
            description: 'Successfully deployed stacks',
            exportName: `${this.stackName}-DeployedStacks`,
        });
        new cdk.CfnOutput(this, 'SkippedStacks', {
            value: this.deploymentInfo.skippedStacks.join(', ') || 'None',
            description: 'Skipped stacks',
            exportName: `${this.stackName}-SkippedStacks`,
        });
        new cdk.CfnOutput(this, 'TotalStacks', {
            value: this.deploymentInfo.totalStacks.toString(),
            description: 'Total number of stacks',
            exportName: `${this.stackName}-TotalStacks`,
        });
        new cdk.CfnOutput(this, 'DeploymentOrder', {
            value: this.deploymentInfo.deploymentOrder.join(' -> '),
            description: 'Deployment order phases',
            exportName: `${this.stackName}-DeploymentOrder`,
        });
    }
    /**
     * スタックレベルのタグ設定（セキュリティ対策付き）
     */
    applyStackTags(projectName, environment) {
        // タグ値のサニタイズ（セキュリティ対策）
        const sanitizedProjectName = this.sanitizeTagValue(projectName);
        const sanitizedEnvironment = this.sanitizeTagValue(environment);
        const tags = {
            Project: sanitizedProjectName,
            Environment: sanitizedEnvironment,
            Stack: 'ComprehensiveDeploymentStack',
            Component: 'MasterDeployment',
            ManagedBy: 'CDK',
            Architecture: 'Comprehensive',
            CostCenter: `${sanitizedProjectName}-${sanitizedEnvironment}-comprehensive`,
            CreatedAt: new Date().toISOString().split('T')[0],
            Version: '1.0.0'
        };
        // 一括でタグを適用
        Object.entries(tags).forEach(([key, value]) => {
            cdk.Tags.of(this).add(key, value);
        });
    }
    /**
     * タグ値のサニタイズ（セキュリティ対策）
     */
    sanitizeTagValue(value) {
        return value
            .replace(/[<>\"'&]/g, '') // XSS対策
            .substring(0, 256) // AWS タグ値の最大長制限
            .trim();
    }
    /**
     * デフォルトセキュリティ設定の取得
     */
    getDefaultSecurityConfig(projectName, environment) {
        return {
            kms: {
                enableKeyRotation: true,
                keySpec: 'SYMMETRIC_DEFAULT',
                keyUsage: 'ENCRYPT_DECRYPT',
            },
            waf: {
                enabled: true,
                scope: 'REGIONAL',
                rules: {
                    enableAWSManagedRules: true,
                    enableRateLimiting: true,
                    rateLimit: 2000,
                    enableGeoBlocking: false,
                    blockedCountries: [],
                },
            },
            cloudTrail: {
                enabled: true,
                s3BucketName: `${projectName}-${environment}-cloudtrail`,
                includeGlobalServiceEvents: true,
                isMultiRegionTrail: true,
                enableLogFileValidation: true,
            },
            tags: {
                SecurityLevel: 'High',
                EncryptionRequired: true,
                ComplianceFramework: 'SOC2',
                DataClassification: 'Confidential',
            },
        };
    }
    /**
     * デフォルトネットワーキング設定の取得
     */
    getDefaultNetworkingConfig() {
        return {
            vpcCidr: '10.0.0.0/16',
            maxAzs: 3,
            enablePublicSubnets: true,
            enablePrivateSubnets: true,
            enableIsolatedSubnets: true,
            enableNatGateway: true,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            enableFlowLogs: true,
            vpcEndpoints: {
                s3: true,
                dynamodb: true,
                lambda: true,
                opensearch: true,
            },
            securityGroups: {
                web: true,
                api: true,
                database: true,
                lambda: true,
            },
        };
    }
    /**
     * デプロイメント統計の取得
     */
    getDeploymentStats() {
        return {
            ...this.deploymentInfo,
            deploymentPhases: {
                'Phase1-Security': this.securityStack ? 'Deployed' : 'Skipped',
                'Phase2-Networking': this.networkingStack ? 'Deployed' : 'Skipped',
                'Phase3-Data': this.dataStack ? 'Deployed' : 'Skipped',
                'Phase4-Embedding': this.embeddingStack ? 'Deployed' : 'Skipped',
                'Phase5-WebApp': this.webAppStack ? 'Deployed' : 'Skipped',
                'Phase6-Operations': this.operationsStack ? 'Deployed' : 'Skipped',
                'Phase7-Regional': [
                    this.japanStack && 'Japan',
                    this.usStack && 'US',
                    this.euStack && 'EU',
                    this.apacStack && 'APAC',
                    this.southAmericaStack && 'SouthAmerica'
                ].filter(Boolean).join(', ') || 'None',
                'Phase8-Special': [
                    this.disasterRecoveryStack && 'DisasterRecovery',
                    this.globalStack && 'Global',
                    this.minimalProductionStack && 'MinimalProduction'
                ].filter(Boolean).join(', ') || 'None',
            },
        };
    }
    /**
     * システム情報の取得
     */
    getSystemInfo() {
        return {
            stackName: this.stackName,
            region: this.region,
            account: this.account,
            deploymentInfo: this.deploymentInfo,
            enabledComponents: {
                security: !!this.securityStack,
                networking: !!this.networkingStack,
                data: !!this.dataStack,
                embedding: !!this.embeddingStack,
                webapp: !!this.webAppStack,
                operations: !!this.operationsStack,
            },
            regionalDeployments: {
                japan: !!this.japanStack,
                us: !!this.usStack,
                eu: !!this.euStack,
                apac: !!this.apacStack,
                southAmerica: !!this.southAmericaStack,
            },
            specialFeatures: {
                disasterRecovery: !!this.disasterRecoveryStack,
                global: !!this.globalStack,
                fsxn: !!this.fsxnStack,
                minimalProduction: !!this.minimalProductionStack,
            },
        };
    }
    /**
     * セキュリティリソースの取得
     */
    getSecurityResources() {
        return {
            securityStack: this.securityStack,
            kmsKey: this.securityStack?.kmsKey || null,
            wafWebAcl: this.securityStack?.wafWebAcl || null,
        };
    }
    /**
     * ネットワークリソースの取得
     */
    getNetworkResources() {
        return {
            networkingStack: this.networkingStack,
            networkStack: this.networkStack,
            vpc: this.networkingStack?.vpc || null,
            publicSubnets: this.networkingStack?.publicSubnets || [],
            privateSubnets: this.networkingStack?.privateSubnets || [],
            isolatedSubnets: this.networkingStack?.isolatedSubnets || [],
            securityGroups: this.networkingStack?.securityGroups || {},
        };
    }
    /**
     * データリソースの取得
     */
    getDataResources() {
        return {
            dataStack: this.dataStack,
            fsxnStack: this.fsxnStack,
            s3Buckets: this.dataStack?.s3Buckets || {},
            dynamoDbTables: this.dataStack?.dynamoDbTables || {},
            openSearchCollection: this.dataStack?.openSearchCollection || null,
            fsxFileSystem: this.fsxnStack?.fsxFileSystem || null,
        };
    }
}
exports.ComprehensiveDeploymentStack = ComprehensiveDeploymentStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcHJlaGVuc2l2ZS1kZXBsb3ltZW50LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY29tcHJlaGVuc2l2ZS1kZXBsb3ltZW50LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7R0FLRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFHbkMsZUFBZTtBQUNmLHNEQUFrRDtBQUNsRCwwREFBc0Q7QUFDdEQsOENBQTBDO0FBQzFDLHdEQUFvRDtBQUNwRCxrREFBOEM7QUFDOUMsMERBQXNEO0FBRXRELGFBQWE7QUFDYixzRUFBaUU7QUFDakUsZ0VBQTJEO0FBQzNELGdFQUEyRDtBQUMzRCxvRUFBK0Q7QUFDL0Qsc0ZBQWdGO0FBRWhGLFNBQVM7QUFDVCx3RUFBbUU7QUFDbkUsd0VBQW1FO0FBRW5FLGFBQWE7QUFDYixpREFBNkM7QUFDN0MsdURBQW1EO0FBQ25ELDZFQUF3RTtBQWdEeEUsTUFBYSw0QkFBNkIsU0FBUSxHQUFHLENBQUMsS0FBSztJQUN6RCxTQUFTO0lBQ08sYUFBYSxDQUFpQjtJQUM5QixlQUFlLENBQW1CO0lBQ2xDLFNBQVMsQ0FBYTtJQUN0QixjQUFjLENBQWtCO0lBQ2hDLFdBQVcsQ0FBZTtJQUMxQixlQUFlLENBQW1CO0lBRWxELGFBQWE7SUFDRyxVQUFVLENBQXdCO0lBQ2xDLE9BQU8sQ0FBcUI7SUFDNUIsT0FBTyxDQUFxQjtJQUM1QixTQUFTLENBQXVCO0lBQ2hDLGlCQUFpQixDQUErQjtJQUVoRSxTQUFTO0lBQ08scUJBQXFCLENBQXlCO0lBQzlDLFdBQVcsQ0FBeUI7SUFDcEMsU0FBUyxDQUFhO0lBQ3RCLFlBQVksQ0FBZ0I7SUFDNUIsc0JBQXNCLENBQTBCO0lBRWhFLFlBQVk7SUFDSSxjQUFjLENBSzVCO0lBRUYsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF3QztRQUNoRixLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FB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MUQsZUFBZSxFQUFFLElBQUksQ0FBQyxlQUFlLEVBQUUsZUFBZSxJQUFJLEVBQUU7WUFDNUQsY0FBYyxFQUFFLElBQUksQ0FBQyxlQUFlLEVBQUUsY0FBYyxJQUFJLEVBQUU7U0FDM0QsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNJLGdCQUFnQjtRQUNyQixPQUFPO1lBQ0wsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTO1lBQ3pCLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUztZQUN6QixTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxTQUFTLElBQUksRUFBRTtZQUMxQyxjQUFjLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxjQUFjLElBQUksRUFBRTtZQUNwRCxvQkFBb0IsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixJQUFJLElBQUk7WUFDbEUsYUFBYSxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsYUFBYSxJQUFJLElBQUk7U0FDckQsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQTNpQkQsb0VBMmlCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog5YyF5ous55qE44OH44OX44Ot44Kk44Oh44Oz44OI44K544K/44OD44KvXG4gKiBcbiAqIOWFqOOBpuOBrkNES+OCueOCv+ODg+OCr+OCkue1seWQiOeahOOBq+ODh+ODl+ODreOCpOOBmeOCi+OBn+OCgeOBruODnuOCueOCv+ODvOOCueOCv+ODg+OCr1xuICog5L6d5a2Y6Zai5L+C44KS566h55CG44GX44CB5q616ZqO55qE44Gq44OH44OX44Ot44Kk44Oh44Oz44OI44KS5a6f54++XG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG4vLyDml6LlrZjjgrnjgr/jg4Pjgq/jga7jgqTjg7Pjg53jg7zjg4hcbmltcG9ydCB7IFNlY3VyaXR5U3RhY2sgfSBmcm9tICcuLi9zZWN1cml0eS1zdGFjayc7XG5pbXBvcnQgeyBOZXR3b3JraW5nU3RhY2sgfSBmcm9tICcuLi9uZXR3b3JraW5nLXN0YWNrJztcbmltcG9ydCB7IERhdGFTdGFjayB9IGZyb20gJy4uL2RhdGEtc3RhY2snO1xuaW1wb3J0IHsgRW1iZWRkaW5nU3RhY2sgfSBmcm9tICcuLi9lbWJlZGRpbmctc3RhY2snO1xuaW1wb3J0IHsgV2ViQXBwU3RhY2sgfSBmcm9tICcuLi93ZWJhcHAtc3RhY2snO1xuaW1wb3J0IHsgT3BlcmF0aW9uc1N0YWNrIH0gZnJvbSAnLi4vb3BlcmF0aW9ucy1zdGFjayc7XG5cbi8vIOODquODvOOCuOODp+ODs+WIpeOCueOCv+ODg+OCr1xuaW1wb3J0IHsgSmFwYW5EZXBsb3ltZW50U3RhY2sgfSBmcm9tICcuLi9qYXBhbi1kZXBsb3ltZW50LXN0YWNrJztcbmltcG9ydCB7IFVTRGVwbG95bWVudFN0YWNrIH0gZnJvbSAnLi4vdXMtZGVwbG95bWVudC1zdGFjayc7XG5pbXBvcnQgeyBFVURlcGxveW1lbnRTdGFjayB9IGZyb20gJy4uL2V1LWRlcGxveW1lbnQtc3RhY2snO1xuaW1wb3J0IHsgQVBBQ0RlcGxveW1lbnRTdGFjayB9IGZyb20gJy4uL2FwYWMtZGVwbG95bWVudC1zdGFjayc7XG5pbXBvcnQgeyBTb3V0aEFtZXJpY2FEZXBsb3ltZW50U3RhY2sgfSBmcm9tICcuLi9zb3V0aC1hbWVyaWNhLWRlcGxveW1lbnQtc3RhY2snO1xuXG4vLyDnibnmrorjgrnjgr/jg4Pjgq9cbmltcG9ydCB7IERpc2FzdGVyUmVjb3ZlcnlTdGFjayB9IGZyb20gJy4uL2Rpc2FzdGVyLXJlY292ZXJ5LXN0YWNrJztcbmltcG9ydCB7IEdsb2JhbERlcGxveW1lbnRTdGFjayB9IGZyb20gJy4uL2dsb2JhbC1kZXBsb3ltZW50LXN0YWNrJztcblxuLy8g44Or44O844OI44Os44OZ44Or44K544K/44OD44KvXG5pbXBvcnQgeyBGU3hOU3RhY2sgfSBmcm9tICcuLi8uLi9mc3huLXN0YWNrJztcbmltcG9ydCB7IE5ldHdvcmtTdGFjayB9IGZyb20gJy4uLy4uL25ldHdvcmstc3RhY2snO1xuaW1wb3J0IHsgTWluaW1hbFByb2R1Y3Rpb25TdGFjayB9IGZyb20gJy4uLy4uL21pbmltYWwtcHJvZHVjdGlvbi1zdGFjayc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcHJlaGVuc2l2ZURlcGxveW1lbnRTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICAvKiog44OX44Ot44K444Kn44Kv44OI5ZCN77yINTDmloflrZfku6XlhoXjgIHoi7HmlbDlrZfjg7vjg4/jgqTjg5Xjg7Pjg7vjgqLjg7Pjg4Djg7zjgrnjgrPjgqLjga7jgb/vvIkgKi9cbiAgcHJvamVjdE5hbWU6IHN0cmluZztcbiAgLyoqIOeSsOWig+WQje+8iOWOs+WvhuOBquWei+WItue0hO+8iSAqL1xuICBlbnZpcm9ubWVudDogJ2RldicgfCAnc3RhZ2luZycgfCAncHJvZCcgfCAndGVzdCc7XG4gIFxuICAvLyDjg4fjg5fjg63jgqTjg6Hjg7Pjg4joqK3lrppcbiAgZGVwbG95bWVudENvbmZpZzoge1xuICAgIC8vIOWfuuacrOOCs+ODs+ODneODvOODjeODs+ODiFxuICAgIGVuYWJsZVNlY3VyaXR5OiBib29sZWFuO1xuICAgIGVuYWJsZU5ldHdvcmtpbmc6IGJvb2xlYW47XG4gICAgZW5hYmxlRGF0YTogYm9vbGVhbjtcbiAgICBlbmFibGVFbWJlZGRpbmc6IGJvb2xlYW47XG4gICAgZW5hYmxlV2ViQXBwOiBib29sZWFuO1xuICAgIGVuYWJsZU9wZXJhdGlvbnM6IGJvb2xlYW47XG4gICAgXG4gICAgLy8g44Oq44O844K444On44Oz5Yil44OH44OX44Ot44Kk44Oh44Oz44OIXG4gICAgZW5hYmxlSmFwYW46IGJvb2xlYW47XG4gICAgZW5hYmxlVVM6IGJvb2xlYW47XG4gICAgZW5hYmxlRVU6IGJvb2xlYW47XG4gICAgZW5hYmxlQVBBQzogYm9vbGVhbjtcbiAgICBlbmFibGVTb3V0aEFtZXJpY2E6IGJvb2xlYW47XG4gICAgXG4gICAgLy8g54m55q6K5qmf6IO9XG4gICAgZW5hYmxlRGlzYXN0ZXJSZWNvdmVyeTogYm9vbGVhbjtcbiAgICBlbmFibGVHbG9iYWxEZXBsb3ltZW50OiBib29sZWFuO1xuICAgIGVuYWJsZUZTeE46IGJvb2xlYW47XG4gICAgZW5hYmxlTWluaW1hbFByb2R1Y3Rpb246IGJvb2xlYW47XG4gIH07XG4gIFxuICAvLyDjg6rjg7zjgrjjg6fjg7PoqK3lrppcbiAgcmVnaW9uczoge1xuICAgIHByaW1hcnk6IHN0cmluZztcbiAgICBzZWNvbmRhcnk/OiBzdHJpbmc7XG4gICAgZGlzYXN0ZXI/OiBzdHJpbmc7XG4gIH07XG4gIFxuICAvLyDlkITjgrnjgr/jg4Pjgq/lm7rmnInjga7oqK3lrprvvIjlv4XpoIjvvIlcbiAgc2VjdXJpdHlDb25maWc/OiBhbnk7XG4gIG5ldHdvcmtpbmdDb25maWc/OiBhbnk7XG4gIGRhdGFDb25maWc/OiBhbnk7XG4gIGNvbXB1dGVDb25maWc/OiBhbnk7XG4gIHdlYkFwcENvbmZpZz86IGFueTtcbiAgb3BlcmF0aW9uc0NvbmZpZz86IGFueTtcbn1cblxuZXhwb3J0IGNsYXNzIENvbXByZWhlbnNpdmVEZXBsb3ltZW50U3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICAvLyDln7rmnKzjgrnjgr/jg4Pjgq9cbiAgcHVibGljIHJlYWRvbmx5IHNlY3VyaXR5U3RhY2s/OiBTZWN1cml0eVN0YWNrO1xuICBwdWJsaWMgcmVhZG9ubHkgbmV0d29ya2luZ1N0YWNrPzogTmV0d29ya2luZ1N0YWNrO1xuICBwdWJsaWMgcmVhZG9ubHkgZGF0YVN0YWNrPzogRGF0YVN0YWNrO1xuICBwdWJsaWMgcmVhZG9ubHkgZW1iZWRkaW5nU3RhY2s/OiBFbWJlZGRpbmdTdGFjaztcbiAgcHVibGljIHJlYWRvbmx5IHdlYkFwcFN0YWNrPzogV2ViQXBwU3RhY2s7XG4gIHB1YmxpYyByZWFkb25seSBvcGVyYXRpb25zU3RhY2s/OiBPcGVyYXRpb25zU3RhY2s7XG4gIFxuICAvLyDjg6rjg7zjgrjjg6fjg7PliKXjgrnjgr/jg4Pjgq9cbiAgcHVibGljIHJlYWRvbmx5IGphcGFuU3RhY2s/OiBKYXBhbkRlcGxveW1lbnRTdGFjaztcbiAgcHVibGljIHJlYWRvbmx5IHVzU3RhY2s/OiBVU0RlcGxveW1lbnRTdGFjaztcbiAgcHVibGljIHJlYWRvbmx5IGV1U3RhY2s/OiBFVURlcGxveW1lbnRTdGFjaztcbiAgcHVibGljIHJlYWRvbmx5IGFwYWNTdGFjaz86IEFQQUNEZXBsb3ltZW50U3RhY2s7XG4gIHB1YmxpYyByZWFkb25seSBzb3V0aEFtZXJpY2FTdGFjaz86IFNvdXRoQW1lcmljYURlcGxveW1lbnRTdGFjaztcbiAgXG4gIC8vIOeJueauiuOCueOCv+ODg+OCr1xuICBwdWJsaWMgcmVhZG9ubHkgZGlzYXN0ZXJSZWNvdmVyeVN0YWNrPzogRGlzYXN0ZXJSZWNvdmVyeVN0YWNrO1xuICBwdWJsaWMgcmVhZG9ubHkgZ2xvYmFsU3RhY2s/OiBHbG9iYWxEZXBsb3ltZW50U3RhY2s7XG4gIHB1YmxpYyByZWFkb25seSBmc3huU3RhY2s/OiBGU3hOU3RhY2s7XG4gIHB1YmxpYyByZWFkb25seSBuZXR3b3JrU3RhY2s/OiBOZXR3b3JrU3RhY2s7XG4gIHB1YmxpYyByZWFkb25seSBtaW5pbWFsUHJvZHVjdGlvblN0YWNrPzogTWluaW1hbFByb2R1Y3Rpb25TdGFjaztcbiAgXG4gIC8vIOODh+ODl+ODreOCpOODoeODs+ODiOaDheWgsVxuICBwdWJsaWMgcmVhZG9ubHkgZGVwbG95bWVudEluZm86IHtcbiAgICBkZXBsb3llZFN0YWNrczogc3RyaW5nW107XG4gICAgc2tpcHBlZFN0YWNrczogc3RyaW5nW107XG4gICAgdG90YWxTdGFja3M6IG51bWJlcjtcbiAgICBkZXBsb3ltZW50T3JkZXI6IHN0cmluZ1tdO1xuICB9O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBDb21wcmVoZW5zaXZlRGVwbG95bWVudFN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIOWFpeWKm+WApOOBruaknOiovO+8iOOCu+OCreODpeODquODhuOCo+Wvvuetlu+8iVxuICAgIHRoaXMudmFsaWRhdGVJbnB1dHMocHJvcHMpO1xuXG4gICAgY29uc3QgeyBwcm9qZWN0TmFtZSwgZW52aXJvbm1lbnQsIGRlcGxveW1lbnRDb25maWcsIHJlZ2lvbnMgfSA9IHByb3BzO1xuICAgIFxuICAgIGNvbnN0IGRlcGxveWVkU3RhY2tzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHNraXBwZWRTdGFja3M6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgZGVwbG95bWVudE9yZGVyOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgLy8gUGhhc2UgMTog44K744Kt44Ol44Oq44OG44Kj5Z+655ukXG4gICAgaWYgKGRlcGxveW1lbnRDb25maWcuZW5hYmxlU2VjdXJpdHkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRoaXMuc2VjdXJpdHlTdGFjayA9IG5ldyBTZWN1cml0eVN0YWNrKHRoaXMsICdTZWN1cml0eScsIHtcbiAgICAgICAgICBjb25maWc6IHByb3BzLnNlY3VyaXR5Q29uZmlnIHx8IHRoaXMuZ2V0RGVmYXVsdFNlY3VyaXR5Q29uZmlnKHByb2plY3ROYW1lLCBlbnZpcm9ubWVudCksXG4gICAgICAgICAgcHJvamVjdE5hbWUsXG4gICAgICAgICAgZW52aXJvbm1lbnQsXG4gICAgICAgICAgZW52OiB7IHJlZ2lvbjogcmVnaW9ucy5wcmltYXJ5IH0sXG4gICAgICAgIH0pO1xuICAgICAgICBkZXBsb3llZFN0YWNrcy5wdXNoKCdTZWN1cml0eVN0YWNrJyk7XG4gICAgICAgIGRlcGxveW1lbnRPcmRlci5wdXNoKCdQaGFzZTEtU2VjdXJpdHknKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnN0IGVycm9yTWVzc2FnZSA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTZWN1cml0eVN0YWNrIOOBruS9nOaIkOOBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtlcnJvck1lc3NhZ2V9YCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHNraXBwZWRTdGFja3MucHVzaCgnU2VjdXJpdHlTdGFjaycpO1xuICAgIH1cblxuICAgIC8vIFBoYXNlIDI6IOODjeODg+ODiOODr+ODvOOCr+WfuuebpFxuICAgIGlmIChkZXBsb3ltZW50Q29uZmlnLmVuYWJsZU5ldHdvcmtpbmcpIHtcbiAgICAgIHRoaXMubmV0d29ya2luZ1N0YWNrID0gbmV3IE5ldHdvcmtpbmdTdGFjayh0aGlzLCAnTmV0d29ya2luZycsIHtcbiAgICAgICAgZW52OiB7IHJlZ2lvbjogcmVnaW9ucy5wcmltYXJ5IH0sXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8g44K744Kt44Ol44Oq44OG44Kj44K544K/44OD44Kv44G444Gu5L6d5a2Y6Zai5L+CXG4gICAgICBpZiAodGhpcy5zZWN1cml0eVN0YWNrKSB7XG4gICAgICAgIHRoaXMubmV0d29ya2luZ1N0YWNrLmFkZERlcGVuZGVuY3kodGhpcy5zZWN1cml0eVN0YWNrKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgZGVwbG95ZWRTdGFja3MucHVzaCgnTmV0d29ya2luZ1N0YWNrJyk7XG4gICAgICBkZXBsb3ltZW50T3JkZXIucHVzaCgnUGhhc2UyLU5ldHdvcmtpbmcnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2tpcHBlZFN0YWNrcy5wdXNoKCdOZXR3b3JraW5nU3RhY2snKTtcbiAgICB9XG5cbiAgICAvLyDlvpPmnaXjga7jg43jg4Pjg4jjg6/jg7zjgq/jgrnjgr/jg4Pjgq/vvIjkupLmj5vmgKfjga7jgZ/jgoHvvIlcbiAgICBpZiAoZGVwbG95bWVudENvbmZpZy5lbmFibGVOZXR3b3JraW5nKSB7XG4gICAgICB0aGlzLm5ldHdvcmtTdGFjayA9IG5ldyBOZXR3b3JrU3RhY2sodGhpcywgJ05ldHdvcmsnLCB7XG4gICAgICAgIGVudjogeyByZWdpb246IHJlZ2lvbnMucHJpbWFyeSB9LFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGlmICh0aGlzLm5ldHdvcmtpbmdTdGFjaykge1xuICAgICAgICB0aGlzLm5ldHdvcmtTdGFjay5hZGREZXBlbmRlbmN5KHRoaXMubmV0d29ya2luZ1N0YWNrKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgZGVwbG95ZWRTdGFja3MucHVzaCgnTmV0d29ya1N0YWNrJyk7XG4gICAgfVxuXG4gICAgLy8gUGhhc2UgMzog44OH44O844K/44O744K544OI44Os44O844K4XG4gICAgaWYgKGRlcGxveW1lbnRDb25maWcuZW5hYmxlRGF0YSkge1xuICAgICAgdGhpcy5kYXRhU3RhY2sgPSBuZXcgRGF0YVN0YWNrKHRoaXMsICdEYXRhJywge1xuICAgICAgICBlbnY6IHsgcmVnaW9uOiByZWdpb25zLnByaW1hcnkgfSxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICAvLyDkvp3lrZjplqLkv4LoqK3lrppcbiAgICAgIGlmICh0aGlzLnNlY3VyaXR5U3RhY2spIHtcbiAgICAgICAgdGhpcy5kYXRhU3RhY2suYWRkRGVwZW5kZW5jeSh0aGlzLnNlY3VyaXR5U3RhY2spO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMubmV0d29ya2luZ1N0YWNrKSB7XG4gICAgICAgIHRoaXMuZGF0YVN0YWNrLmFkZERlcGVuZGVuY3kodGhpcy5uZXR3b3JraW5nU3RhY2spO1xuICAgICAgfVxuICAgICAgXG4gICAgICBkZXBsb3llZFN0YWNrcy5wdXNoKCdEYXRhU3RhY2snKTtcbiAgICAgIGRlcGxveW1lbnRPcmRlci5wdXNoKCdQaGFzZTMtRGF0YScpO1xuICAgIH0gZWxzZSB7XG4gICAgICBza2lwcGVkU3RhY2tzLnB1c2goJ0RhdGFTdGFjaycpO1xuICAgIH1cblxuICAgIC8vIEZTeE4g44K544K/44OD44KvXG4gICAgaWYgKGRlcGxveW1lbnRDb25maWcuZW5hYmxlRlN4Tikge1xuICAgICAgdGhpcy5mc3huU3RhY2sgPSBuZXcgRlN4TlN0YWNrKHRoaXMsICdGU3hOJywge1xuICAgICAgICBlbnY6IHsgcmVnaW9uOiByZWdpb25zLnByaW1hcnkgfSxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBpZiAodGhpcy5uZXR3b3JrU3RhY2spIHtcbiAgICAgICAgdGhpcy5mc3huU3RhY2suYWRkRGVwZW5kZW5jeSh0aGlzLm5ldHdvcmtTdGFjayk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGRlcGxveWVkU3RhY2tzLnB1c2goJ0ZTeE5TdGFjaycpO1xuICAgIH1cblxuICAgIC8vIFBoYXNlIDQ6IEVtYmVkZGluZ+ODu0FJXG4gICAgaWYgKGRlcGxveW1lbnRDb25maWcuZW5hYmxlRW1iZWRkaW5nKSB7XG4gICAgICB0aGlzLmVtYmVkZGluZ1N0YWNrID0gbmV3IEVtYmVkZGluZ1N0YWNrKHRoaXMsICdFbWJlZGRpbmcnLCB7XG4gICAgICAgIGVudjogeyByZWdpb246IHJlZ2lvbnMucHJpbWFyeSB9LFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIC8vIOS+neWtmOmWouS/guioreWumlxuICAgICAgaWYgKHRoaXMuc2VjdXJpdHlTdGFjaykge1xuICAgICAgICB0aGlzLmVtYmVkZGluZ1N0YWNrLmFkZERlcGVuZGVuY3kodGhpcy5zZWN1cml0eVN0YWNrKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLm5ldHdvcmtpbmdTdGFjaykge1xuICAgICAgICB0aGlzLmVtYmVkZGluZ1N0YWNrLmFkZERlcGVuZGVuY3kodGhpcy5uZXR3b3JraW5nU3RhY2spO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuZGF0YVN0YWNrKSB7XG4gICAgICAgIHRoaXMuZW1iZWRkaW5nU3RhY2suYWRkRGVwZW5kZW5jeSh0aGlzLmRhdGFTdGFjayk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGRlcGxveWVkU3RhY2tzLnB1c2goJ0VtYmVkZGluZ1N0YWNrJyk7XG4gICAgICBkZXBsb3ltZW50T3JkZXIucHVzaCgnUGhhc2U0LUVtYmVkZGluZycpO1xuICAgIH0gZWxzZSB7XG4gICAgICBza2lwcGVkU3RhY2tzLnB1c2goJ0VtYmVkZGluZ1N0YWNrJyk7XG4gICAgfVxuXG4gICAgLy8gUGhhc2UgNTogV2ViQXBw44O7QVBJXG4gICAgaWYgKGRlcGxveW1lbnRDb25maWcuZW5hYmxlV2ViQXBwKSB7XG4gICAgICB0aGlzLndlYkFwcFN0YWNrID0gbmV3IFdlYkFwcFN0YWNrKHRoaXMsICdXZWJBcHAnLCB7XG4gICAgICAgIGVudjogeyByZWdpb246IHJlZ2lvbnMucHJpbWFyeSB9LFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIC8vIOS+neWtmOmWouS/guioreWumlxuICAgICAgaWYgKHRoaXMuc2VjdXJpdHlTdGFjaykge1xuICAgICAgICB0aGlzLndlYkFwcFN0YWNrLmFkZERlcGVuZGVuY3kodGhpcy5zZWN1cml0eVN0YWNrKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLm5ldHdvcmtpbmdTdGFjaykge1xuICAgICAgICB0aGlzLndlYkFwcFN0YWNrLmFkZERlcGVuZGVuY3kodGhpcy5uZXR3b3JraW5nU3RhY2spO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuZW1iZWRkaW5nU3RhY2spIHtcbiAgICAgICAgdGhpcy53ZWJBcHBTdGFjay5hZGREZXBlbmRlbmN5KHRoaXMuZW1iZWRkaW5nU3RhY2spO1xuICAgICAgfVxuICAgICAgXG4gICAgICBkZXBsb3llZFN0YWNrcy5wdXNoKCdXZWJBcHBTdGFjaycpO1xuICAgICAgZGVwbG95bWVudE9yZGVyLnB1c2goJ1BoYXNlNS1XZWJBcHAnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2tpcHBlZFN0YWNrcy5wdXNoKCdXZWJBcHBTdGFjaycpO1xuICAgIH1cblxuICAgIC8vIFBoYXNlIDY6IOmBi+eUqOODu+ebo+imllxuICAgIGlmIChkZXBsb3ltZW50Q29uZmlnLmVuYWJsZU9wZXJhdGlvbnMpIHtcbiAgICAgIHRoaXMub3BlcmF0aW9uc1N0YWNrID0gbmV3IE9wZXJhdGlvbnNTdGFjayh0aGlzLCAnT3BlcmF0aW9ucycsIHtcbiAgICAgICAgZW52OiB7IHJlZ2lvbjogcmVnaW9ucy5wcmltYXJ5IH0sXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8g5YWo44K544K/44OD44Kv44G444Gu5L6d5a2Y6Zai5L+CXG4gICAgICBbdGhpcy5zZWN1cml0eVN0YWNrLCB0aGlzLm5ldHdvcmtpbmdTdGFjaywgdGhpcy5kYXRhU3RhY2ssIHRoaXMuZW1iZWRkaW5nU3RhY2ssIHRoaXMud2ViQXBwU3RhY2tdXG4gICAgICAgIC5maWx0ZXIoc3RhY2sgPT4gc3RhY2spXG4gICAgICAgIC5mb3JFYWNoKHN0YWNrID0+IHtcbiAgICAgICAgICBpZiAoc3RhY2sgJiYgdGhpcy5vcGVyYXRpb25zU3RhY2spIHtcbiAgICAgICAgICAgIHRoaXMub3BlcmF0aW9uc1N0YWNrLmFkZERlcGVuZGVuY3koc3RhY2spO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICBcbiAgICAgIGRlcGxveWVkU3RhY2tzLnB1c2goJ09wZXJhdGlvbnNTdGFjaycpO1xuICAgICAgZGVwbG95bWVudE9yZGVyLnB1c2goJ1BoYXNlNi1PcGVyYXRpb25zJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNraXBwZWRTdGFja3MucHVzaCgnT3BlcmF0aW9uc1N0YWNrJyk7XG4gICAgfVxuXG4gICAgLy8gUGhhc2UgNzog44Oq44O844K444On44Oz5Yil44OH44OX44Ot44Kk44Oh44Oz44OIXG4gICAgaWYgKGRlcGxveW1lbnRDb25maWcuZW5hYmxlSmFwYW4pIHtcbiAgICAgIHRoaXMuamFwYW5TdGFjayA9IG5ldyBKYXBhbkRlcGxveW1lbnRTdGFjayh0aGlzLCAnSmFwYW4nLCB7XG4gICAgICAgIGVudjogeyByZWdpb246ICdhcC1ub3J0aGVhc3QtMScgfSxcbiAgICAgIH0pO1xuICAgICAgZGVwbG95ZWRTdGFja3MucHVzaCgnSmFwYW5EZXBsb3ltZW50U3RhY2snKTtcbiAgICAgIGRlcGxveW1lbnRPcmRlci5wdXNoKCdQaGFzZTctSmFwYW4nKTtcbiAgICB9XG5cbiAgICBpZiAoZGVwbG95bWVudENvbmZpZy5lbmFibGVVUykge1xuICAgICAgdGhpcy51c1N0YWNrID0gbmV3IFVTRGVwbG95bWVudFN0YWNrKHRoaXMsICdVUycsIHtcbiAgICAgICAgZW52OiB7IHJlZ2lvbjogJ3VzLWVhc3QtMScgfSxcbiAgICAgIH0pO1xuICAgICAgZGVwbG95ZWRTdGFja3MucHVzaCgnVVNEZXBsb3ltZW50U3RhY2snKTtcbiAgICAgIGRlcGxveW1lbnRPcmRlci5wdXNoKCdQaGFzZTctVVMnKTtcbiAgICB9XG5cbiAgICBpZiAoZGVwbG95bWVudENvbmZpZy5lbmFibGVFVSkge1xuICAgICAgdGhpcy5ldVN0YWNrID0gbmV3IEVVRGVwbG95bWVudFN0YWNrKHRoaXMsICdFVScsIHtcbiAgICAgICAgZW52OiB7IHJlZ2lvbjogJ2V1LXdlc3QtMScgfSxcbiAgICAgIH0pO1xuICAgICAgZGVwbG95ZWRTdGFja3MucHVzaCgnRVVEZXBsb3ltZW50U3RhY2snKTtcbiAgICAgIGRlcGxveW1lbnRPcmRlci5wdXNoKCdQaGFzZTctRVUnKTtcbiAgICB9XG5cbiAgICBpZiAoZGVwbG95bWVudENvbmZpZy5lbmFibGVBUEFDKSB7XG4gICAgICB0aGlzLmFwYWNTdGFjayA9IG5ldyBBUEFDRGVwbG95bWVudFN0YWNrKHRoaXMsICdBUEFDJywge1xuICAgICAgICBlbnY6IHsgcmVnaW9uOiAnYXAtc291dGhlYXN0LTEnIH0sXG4gICAgICB9KTtcbiAgICAgIGRlcGxveWVkU3RhY2tzLnB1c2goJ0FQQUNEZXBsb3ltZW50U3RhY2snKTtcbiAgICAgIGRlcGxveW1lbnRPcmRlci5wdXNoKCdQaGFzZTctQVBBQycpO1xuICAgIH1cblxuICAgIGlmIChkZXBsb3ltZW50Q29uZmlnLmVuYWJsZVNvdXRoQW1lcmljYSkge1xuICAgICAgdGhpcy5zb3V0aEFtZXJpY2FTdGFjayA9IG5ldyBTb3V0aEFtZXJpY2FEZXBsb3ltZW50U3RhY2sodGhpcywgJ1NvdXRoQW1lcmljYScsIHtcbiAgICAgICAgZW52OiB7IHJlZ2lvbjogJ3NhLWVhc3QtMScgfSxcbiAgICAgIH0pO1xuICAgICAgZGVwbG95ZWRTdGFja3MucHVzaCgnU291dGhBbWVyaWNhRGVwbG95bWVudFN0YWNrJyk7XG4gICAgICBkZXBsb3ltZW50T3JkZXIucHVzaCgnUGhhc2U3LVNvdXRoQW1lcmljYScpO1xuICAgIH1cblxuICAgIC8vIFBoYXNlIDg6IOeJueauiuapn+iDvVxuICAgIGlmIChkZXBsb3ltZW50Q29uZmlnLmVuYWJsZURpc2FzdGVyUmVjb3ZlcnkgJiYgcmVnaW9ucy5kaXNhc3Rlcikge1xuICAgICAgdGhpcy5kaXNhc3RlclJlY292ZXJ5U3RhY2sgPSBuZXcgRGlzYXN0ZXJSZWNvdmVyeVN0YWNrKHRoaXMsICdEaXNhc3RlclJlY292ZXJ5Jywge1xuICAgICAgICBlbnY6IHsgcmVnaW9uOiByZWdpb25zLmRpc2FzdGVyIH0sXG4gICAgICB9KTtcbiAgICAgIGRlcGxveWVkU3RhY2tzLnB1c2goJ0Rpc2FzdGVyUmVjb3ZlcnlTdGFjaycpO1xuICAgICAgZGVwbG95bWVudE9yZGVyLnB1c2goJ1BoYXNlOC1EaXNhc3RlclJlY292ZXJ5Jyk7XG4gICAgfVxuXG4gICAgaWYgKGRlcGxveW1lbnRDb25maWcuZW5hYmxlR2xvYmFsRGVwbG95bWVudCkge1xuICAgICAgdGhpcy5nbG9iYWxTdGFjayA9IG5ldyBHbG9iYWxEZXBsb3ltZW50U3RhY2sodGhpcywgJ0dsb2JhbCcsIHtcbiAgICAgICAgZW52OiB7IHJlZ2lvbjogcmVnaW9ucy5wcmltYXJ5IH0sXG4gICAgICB9KTtcbiAgICAgIGRlcGxveWVkU3RhY2tzLnB1c2goJ0dsb2JhbERlcGxveW1lbnRTdGFjaycpO1xuICAgICAgZGVwbG95bWVudE9yZGVyLnB1c2goJ1BoYXNlOC1HbG9iYWwnKTtcbiAgICB9XG5cbiAgICBpZiAoZGVwbG95bWVudENvbmZpZy5lbmFibGVNaW5pbWFsUHJvZHVjdGlvbikge1xuICAgICAgdGhpcy5taW5pbWFsUHJvZHVjdGlvblN0YWNrID0gbmV3IE1pbmltYWxQcm9kdWN0aW9uU3RhY2sodGhpcywgJ01pbmltYWxQcm9kdWN0aW9uJywge1xuICAgICAgICBlbnY6IHsgcmVnaW9uOiByZWdpb25zLnByaW1hcnkgfSxcbiAgICAgIH0pO1xuICAgICAgZGVwbG95ZWRTdGFja3MucHVzaCgnTWluaW1hbFByb2R1Y3Rpb25TdGFjaycpO1xuICAgICAgZGVwbG95bWVudE9yZGVyLnB1c2goJ1BoYXNlOC1NaW5pbWFsUHJvZHVjdGlvbicpO1xuICAgIH1cblxuICAgIC8vIOODh+ODl+ODreOCpOODoeODs+ODiOaDheWgseOBruioreWumlxuICAgIHRoaXMuZGVwbG95bWVudEluZm8gPSB7XG4gICAgICBkZXBsb3llZFN0YWNrcyxcbiAgICAgIHNraXBwZWRTdGFja3MsXG4gICAgICB0b3RhbFN0YWNrczogZGVwbG95ZWRTdGFja3MubGVuZ3RoICsgc2tpcHBlZFN0YWNrcy5sZW5ndGgsXG4gICAgICBkZXBsb3ltZW50T3JkZXIsXG4gICAgfTtcblxuICAgIC8vIENsb3VkRm9ybWF0aW9u5Ye65YqbXG4gICAgdGhpcy5jcmVhdGVPdXRwdXRzKCk7XG5cbiAgICAvLyDjgrnjgr/jg4Pjgq/jg6zjg5njg6vjga7jgr/jgrDoqK3lrppcbiAgICB0aGlzLmFwcGx5U3RhY2tUYWdzKHByb2plY3ROYW1lLCBlbnZpcm9ubWVudCk7XG4gIH1cblxuICAvKipcbiAgICog5YWl5Yqb5YCk44Gu5qSc6Ki877yI44K744Kt44Ol44Oq44OG44Kj5a++562W77yJXG4gICAqL1xuICBwcml2YXRlIHZhbGlkYXRlSW5wdXRzKHByb3BzOiBDb21wcmVoZW5zaXZlRGVwbG95bWVudFN0YWNrUHJvcHMpOiB2b2lkIHtcbiAgICBjb25zdCB7IHByb2plY3ROYW1lLCBlbnZpcm9ubWVudCwgcmVnaW9ucyB9ID0gcHJvcHM7XG5cbiAgICAvLyDjg5fjg63jgrjjgqfjgq/jg4jlkI3jga7mpJzoqLxcbiAgICBpZiAoIXByb2plY3ROYW1lIHx8IHR5cGVvZiBwcm9qZWN0TmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcign44OX44Ot44K444Kn44Kv44OI5ZCN44GM6Kit5a6a44GV44KM44Gm44GE44G+44Gb44KTJyk7XG4gICAgfVxuXG4gICAgaWYgKHByb2plY3ROYW1lLnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcign44OX44Ot44K444Kn44Kv44OI5ZCN44GM56m65paH5a2X44Gn44GZJyk7XG4gICAgfVxuXG4gICAgaWYgKHByb2plY3ROYW1lLmxlbmd0aCA+IDUwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+ODl+ODreOCuOOCp+OCr+ODiOWQjeOBrzUw5paH5a2X5Lul5YaF44Gn6Kit5a6a44GX44Gm44GP44Gg44GV44GEJyk7XG4gICAgfVxuXG4gICAgLy8g44K744Kt44Ol44Oq44OG44KjOiDlronlhajjgarmloflrZfjga7jgb/oqLHlj69cbiAgICBpZiAoIS9eW2EtekEtWjAtOVxcLV9dKyQvLnRlc3QocHJvamVjdE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+ODl+ODreOCuOOCp+OCr+ODiOWQjeOBq+S4jeato+OBquaWh+Wtl+OBjOWQq+OBvuOCjOOBpuOBhOOBvuOBme+8iOiLseaVsOWtl+OAgeODj+OCpOODleODs+OAgeOCouODs+ODgOODvOOCueOCs+OCouOBruOBv+ioseWPr++8iScpO1xuICAgIH1cblxuICAgIC8vIOeSsOWig+WQjeOBruaknOiovFxuICAgIGNvbnN0IHZhbGlkRW52aXJvbm1lbnRzID0gWydkZXYnLCAnc3RhZ2luZycsICdwcm9kJywgJ3Rlc3QnXSBhcyBjb25zdDtcbiAgICBpZiAoIXZhbGlkRW52aXJvbm1lbnRzLmluY2x1ZGVzKGVudmlyb25tZW50KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGDnkrDlooPlkI3jga/mrKHjga7jgYTjgZrjgozjgYvjgpLmjIflrprjgZfjgabjgY/jgaDjgZXjgYQ6ICR7dmFsaWRFbnZpcm9ubWVudHMuam9pbignLCAnKX1gKTtcbiAgICB9XG5cbiAgICAvLyDjg6rjg7zjgrjjg6fjg7PoqK3lrprjga7mpJzoqLxcbiAgICBpZiAoIXJlZ2lvbnMucHJpbWFyeSB8fCB0eXBlb2YgcmVnaW9ucy5wcmltYXJ5ICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCfjg5fjg6njgqTjg57jg6rjg6rjg7zjgrjjg6fjg7PjgYzoqK3lrprjgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICB9XG5cbiAgICAvLyBBV1Pjg6rjg7zjgrjjg6fjg7PlvaLlvI/jga7mpJzoqLxcbiAgICBjb25zdCByZWdpb25QYXR0ZXJuID0gL15bYS16XXsyfS1bYS16XSstXFxkKyQvO1xuICAgIGlmICghcmVnaW9uUGF0dGVybi50ZXN0KHJlZ2lvbnMucHJpbWFyeSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihg54Sh5Yq544Gq44Oq44O844K444On44Oz5b2i5byP44Gn44GZOiAke3JlZ2lvbnMucHJpbWFyeX1gKTtcbiAgICB9XG5cbiAgICBpZiAocmVnaW9ucy5zZWNvbmRhcnkgJiYgIXJlZ2lvblBhdHRlcm4udGVzdChyZWdpb25zLnNlY29uZGFyeSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihg54Sh5Yq544Gq44K744Kr44Oz44OA44Oq44Oq44O844K444On44Oz5b2i5byP44Gn44GZOiAke3JlZ2lvbnMuc2Vjb25kYXJ5fWApO1xuICAgIH1cblxuICAgIGlmIChyZWdpb25zLmRpc2FzdGVyICYmICFyZWdpb25QYXR0ZXJuLnRlc3QocmVnaW9ucy5kaXNhc3RlcikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihg54Sh5Yq544Gq54G95a6z5b6p5pen44Oq44O844K444On44Oz5b2i5byP44Gn44GZOiAke3JlZ2lvbnMuZGlzYXN0ZXJ9YCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENsb3VkRm9ybWF0aW9u5Ye65Yqb44Gu5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZU91dHB1dHMoKTogdm9pZCB7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RlcGxveWVkU3RhY2tzJywge1xuICAgICAgdmFsdWU6IHRoaXMuZGVwbG95bWVudEluZm8uZGVwbG95ZWRTdGFja3Muam9pbignLCAnKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU3VjY2Vzc2Z1bGx5IGRlcGxveWVkIHN0YWNrcycsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tRGVwbG95ZWRTdGFja3NgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1NraXBwZWRTdGFja3MnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kZXBsb3ltZW50SW5mby5za2lwcGVkU3RhY2tzLmpvaW4oJywgJykgfHwgJ05vbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdTa2lwcGVkIHN0YWNrcycsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tU2tpcHBlZFN0YWNrc2AsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVG90YWxTdGFja3MnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kZXBsb3ltZW50SW5mby50b3RhbFN0YWNrcy50b1N0cmluZygpLFxuICAgICAgZGVzY3JpcHRpb246ICdUb3RhbCBudW1iZXIgb2Ygc3RhY2tzJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Ub3RhbFN0YWNrc2AsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGVwbG95bWVudE9yZGVyJywge1xuICAgICAgdmFsdWU6IHRoaXMuZGVwbG95bWVudEluZm8uZGVwbG95bWVudE9yZGVyLmpvaW4oJyAtPiAnKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRGVwbG95bWVudCBvcmRlciBwaGFzZXMnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LURlcGxveW1lbnRPcmRlcmAsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog44K544K/44OD44Kv44Os44OZ44Or44Gu44K/44Kw6Kit5a6a77yI44K744Kt44Ol44Oq44OG44Kj5a++562W5LuY44GN77yJXG4gICAqL1xuICBwcml2YXRlIGFwcGx5U3RhY2tUYWdzKHByb2plY3ROYW1lOiBzdHJpbmcsIGVudmlyb25tZW50OiBzdHJpbmcpOiB2b2lkIHtcbiAgICAvLyDjgr/jgrDlgKTjga7jgrXjg4vjgr/jgqTjgrrvvIjjgrvjgq3jg6Xjg6rjg4bjgqPlr77nrZbvvIlcbiAgICBjb25zdCBzYW5pdGl6ZWRQcm9qZWN0TmFtZSA9IHRoaXMuc2FuaXRpemVUYWdWYWx1ZShwcm9qZWN0TmFtZSk7XG4gICAgY29uc3Qgc2FuaXRpemVkRW52aXJvbm1lbnQgPSB0aGlzLnNhbml0aXplVGFnVmFsdWUoZW52aXJvbm1lbnQpO1xuICAgIFxuICAgIGNvbnN0IHRhZ3MgPSB7XG4gICAgICBQcm9qZWN0OiBzYW5pdGl6ZWRQcm9qZWN0TmFtZSxcbiAgICAgIEVudmlyb25tZW50OiBzYW5pdGl6ZWRFbnZpcm9ubWVudCxcbiAgICAgIFN0YWNrOiAnQ29tcHJlaGVuc2l2ZURlcGxveW1lbnRTdGFjaycsXG4gICAgICBDb21wb25lbnQ6ICdNYXN0ZXJEZXBsb3ltZW50JyxcbiAgICAgIE1hbmFnZWRCeTogJ0NESycsXG4gICAgICBBcmNoaXRlY3R1cmU6ICdDb21wcmVoZW5zaXZlJyxcbiAgICAgIENvc3RDZW50ZXI6IGAke3Nhbml0aXplZFByb2plY3ROYW1lfS0ke3Nhbml0aXplZEVudmlyb25tZW50fS1jb21wcmVoZW5zaXZlYCxcbiAgICAgIENyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNwbGl0KCdUJylbMF0sXG4gICAgICBWZXJzaW9uOiAnMS4wLjAnXG4gICAgfTtcblxuICAgIC8vIOS4gOaLrOOBp+OCv+OCsOOCkumBqeeUqFxuICAgIE9iamVjdC5lbnRyaWVzKHRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKGtleSwgdmFsdWUpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCv+OCsOWApOOBruOCteODi+OCv+OCpOOCuu+8iOOCu+OCreODpeODquODhuOCo+Wvvuetlu+8iVxuICAgKi9cbiAgcHJpdmF0ZSBzYW5pdGl6ZVRhZ1ZhbHVlKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiB2YWx1ZVxuICAgICAgLnJlcGxhY2UoL1s8PlxcXCInJl0vZywgJycpIC8vIFhTU+WvvuetllxuICAgICAgLnN1YnN0cmluZygwLCAyNTYpIC8vIEFXUyDjgr/jgrDlgKTjga7mnIDlpKfplbfliLbpmZBcbiAgICAgIC50cmltKCk7XG4gIH1cblxuICAvKipcbiAgICog44OH44OV44Kp44Or44OI44K744Kt44Ol44Oq44OG44Kj6Kit5a6a44Gu5Y+W5b6XXG4gICAqL1xuICBwcml2YXRlIGdldERlZmF1bHRTZWN1cml0eUNvbmZpZyhwcm9qZWN0TmFtZTogc3RyaW5nLCBlbnZpcm9ubWVudDogc3RyaW5nKTogYW55IHtcbiAgICByZXR1cm4ge1xuICAgICAga21zOiB7XG4gICAgICAgIGVuYWJsZUtleVJvdGF0aW9uOiB0cnVlLFxuICAgICAgICBrZXlTcGVjOiAnU1lNTUVUUklDX0RFRkFVTFQnLFxuICAgICAgICBrZXlVc2FnZTogJ0VOQ1JZUFRfREVDUllQVCcsXG4gICAgICB9LFxuICAgICAgd2FmOiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIHNjb3BlOiAnUkVHSU9OQUwnLFxuICAgICAgICBydWxlczoge1xuICAgICAgICAgIGVuYWJsZUFXU01hbmFnZWRSdWxlczogdHJ1ZSxcbiAgICAgICAgICBlbmFibGVSYXRlTGltaXRpbmc6IHRydWUsXG4gICAgICAgICAgcmF0ZUxpbWl0OiAyMDAwLFxuICAgICAgICAgIGVuYWJsZUdlb0Jsb2NraW5nOiBmYWxzZSxcbiAgICAgICAgICBibG9ja2VkQ291bnRyaWVzOiBbXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBjbG91ZFRyYWlsOiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIHMzQnVja2V0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWNsb3VkdHJhaWxgLFxuICAgICAgICBpbmNsdWRlR2xvYmFsU2VydmljZUV2ZW50czogdHJ1ZSxcbiAgICAgICAgaXNNdWx0aVJlZ2lvblRyYWlsOiB0cnVlLFxuICAgICAgICBlbmFibGVMb2dGaWxlVmFsaWRhdGlvbjogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICB0YWdzOiB7XG4gICAgICAgIFNlY3VyaXR5TGV2ZWw6ICdIaWdoJyxcbiAgICAgICAgRW5jcnlwdGlvblJlcXVpcmVkOiB0cnVlLFxuICAgICAgICBDb21wbGlhbmNlRnJhbWV3b3JrOiAnU09DMicsXG4gICAgICAgIERhdGFDbGFzc2lmaWNhdGlvbjogJ0NvbmZpZGVudGlhbCcsXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog44OH44OV44Kp44Or44OI44ON44OD44OI44Ov44O844Kt44Oz44Kw6Kit5a6a44Gu5Y+W5b6XXG4gICAqL1xuICBwcml2YXRlIGdldERlZmF1bHROZXR3b3JraW5nQ29uZmlnKCk6IGFueSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHZwY0NpZHI6ICcxMC4wLjAuMC8xNicsXG4gICAgICBtYXhBenM6IDMsXG4gICAgICBlbmFibGVQdWJsaWNTdWJuZXRzOiB0cnVlLFxuICAgICAgZW5hYmxlUHJpdmF0ZVN1Ym5ldHM6IHRydWUsXG4gICAgICBlbmFibGVJc29sYXRlZFN1Ym5ldHM6IHRydWUsXG4gICAgICBlbmFibGVOYXRHYXRld2F5OiB0cnVlLFxuICAgICAgZW5hYmxlRG5zSG9zdG5hbWVzOiB0cnVlLFxuICAgICAgZW5hYmxlRG5zU3VwcG9ydDogdHJ1ZSxcbiAgICAgIGVuYWJsZUZsb3dMb2dzOiB0cnVlLFxuICAgICAgdnBjRW5kcG9pbnRzOiB7XG4gICAgICAgIHMzOiB0cnVlLFxuICAgICAgICBkeW5hbW9kYjogdHJ1ZSxcbiAgICAgICAgbGFtYmRhOiB0cnVlLFxuICAgICAgICBvcGVuc2VhcmNoOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiB7XG4gICAgICAgIHdlYjogdHJ1ZSxcbiAgICAgICAgYXBpOiB0cnVlLFxuICAgICAgICBkYXRhYmFzZTogdHJ1ZSxcbiAgICAgICAgbGFtYmRhOiB0cnVlLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOODh+ODl+ODreOCpOODoeODs+ODiOe1seioiOOBruWPluW+l1xuICAgKi9cbiAgcHVibGljIGdldERlcGxveW1lbnRTdGF0cygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgLi4udGhpcy5kZXBsb3ltZW50SW5mbyxcbiAgICAgIGRlcGxveW1lbnRQaGFzZXM6IHtcbiAgICAgICAgJ1BoYXNlMS1TZWN1cml0eSc6IHRoaXMuc2VjdXJpdHlTdGFjayA/ICdEZXBsb3llZCcgOiAnU2tpcHBlZCcsXG4gICAgICAgICdQaGFzZTItTmV0d29ya2luZyc6IHRoaXMubmV0d29ya2luZ1N0YWNrID8gJ0RlcGxveWVkJyA6ICdTa2lwcGVkJyxcbiAgICAgICAgJ1BoYXNlMy1EYXRhJzogdGhpcy5kYXRhU3RhY2sgPyAnRGVwbG95ZWQnIDogJ1NraXBwZWQnLFxuICAgICAgICAnUGhhc2U0LUVtYmVkZGluZyc6IHRoaXMuZW1iZWRkaW5nU3RhY2sgPyAnRGVwbG95ZWQnIDogJ1NraXBwZWQnLFxuICAgICAgICAnUGhhc2U1LVdlYkFwcCc6IHRoaXMud2ViQXBwU3RhY2sgPyAnRGVwbG95ZWQnIDogJ1NraXBwZWQnLFxuICAgICAgICAnUGhhc2U2LU9wZXJhdGlvbnMnOiB0aGlzLm9wZXJhdGlvbnNTdGFjayA/ICdEZXBsb3llZCcgOiAnU2tpcHBlZCcsXG4gICAgICAgICdQaGFzZTctUmVnaW9uYWwnOiBbXG4gICAgICAgICAgdGhpcy5qYXBhblN0YWNrICYmICdKYXBhbicsXG4gICAgICAgICAgdGhpcy51c1N0YWNrICYmICdVUycsXG4gICAgICAgICAgdGhpcy5ldVN0YWNrICYmICdFVScsXG4gICAgICAgICAgdGhpcy5hcGFjU3RhY2sgJiYgJ0FQQUMnLFxuICAgICAgICAgIHRoaXMuc291dGhBbWVyaWNhU3RhY2sgJiYgJ1NvdXRoQW1lcmljYSdcbiAgICAgICAgXS5maWx0ZXIoQm9vbGVhbikuam9pbignLCAnKSB8fCAnTm9uZScsXG4gICAgICAgICdQaGFzZTgtU3BlY2lhbCc6IFtcbiAgICAgICAgICB0aGlzLmRpc2FzdGVyUmVjb3ZlcnlTdGFjayAmJiAnRGlzYXN0ZXJSZWNvdmVyeScsXG4gICAgICAgICAgdGhpcy5nbG9iYWxTdGFjayAmJiAnR2xvYmFsJyxcbiAgICAgICAgICB0aGlzLm1pbmltYWxQcm9kdWN0aW9uU3RhY2sgJiYgJ01pbmltYWxQcm9kdWN0aW9uJ1xuICAgICAgICBdLmZpbHRlcihCb29sZWFuKS5qb2luKCcsICcpIHx8ICdOb25lJyxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrfjgrnjg4bjg6Dmg4XloLHjga7lj5blvpdcbiAgICovXG4gIHB1YmxpYyBnZXRTeXN0ZW1JbmZvKCkge1xuICAgIHJldHVybiB7XG4gICAgICBzdGFja05hbWU6IHRoaXMuc3RhY2tOYW1lLFxuICAgICAgcmVnaW9uOiB0aGlzLnJlZ2lvbixcbiAgICAgIGFjY291bnQ6IHRoaXMuYWNjb3VudCxcbiAgICAgIGRlcGxveW1lbnRJbmZvOiB0aGlzLmRlcGxveW1lbnRJbmZvLFxuICAgICAgZW5hYmxlZENvbXBvbmVudHM6IHtcbiAgICAgICAgc2VjdXJpdHk6ICEhdGhpcy5zZWN1cml0eVN0YWNrLFxuICAgICAgICBuZXR3b3JraW5nOiAhIXRoaXMubmV0d29ya2luZ1N0YWNrLFxuICAgICAgICBkYXRhOiAhIXRoaXMuZGF0YVN0YWNrLFxuICAgICAgICBlbWJlZGRpbmc6ICEhdGhpcy5lbWJlZGRpbmdTdGFjayxcbiAgICAgICAgd2ViYXBwOiAhIXRoaXMud2ViQXBwU3RhY2ssXG4gICAgICAgIG9wZXJhdGlvbnM6ICEhdGhpcy5vcGVyYXRpb25zU3RhY2ssXG4gICAgICB9LFxuICAgICAgcmVnaW9uYWxEZXBsb3ltZW50czoge1xuICAgICAgICBqYXBhbjogISF0aGlzLmphcGFuU3RhY2ssXG4gICAgICAgIHVzOiAhIXRoaXMudXNTdGFjayxcbiAgICAgICAgZXU6ICEhdGhpcy5ldVN0YWNrLFxuICAgICAgICBhcGFjOiAhIXRoaXMuYXBhY1N0YWNrLFxuICAgICAgICBzb3V0aEFtZXJpY2E6ICEhdGhpcy5zb3V0aEFtZXJpY2FTdGFjayxcbiAgICAgIH0sXG4gICAgICBzcGVjaWFsRmVhdHVyZXM6IHtcbiAgICAgICAgZGlzYXN0ZXJSZWNvdmVyeTogISF0aGlzLmRpc2FzdGVyUmVjb3ZlcnlTdGFjayxcbiAgICAgICAgZ2xvYmFsOiAhIXRoaXMuZ2xvYmFsU3RhY2ssXG4gICAgICAgIGZzeG46ICEhdGhpcy5mc3huU3RhY2ssXG4gICAgICAgIG1pbmltYWxQcm9kdWN0aW9uOiAhIXRoaXMubWluaW1hbFByb2R1Y3Rpb25TdGFjayxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrvjgq3jg6Xjg6rjg4bjgqPjg6rjgr3jg7zjgrnjga7lj5blvpdcbiAgICovXG4gIHB1YmxpYyBnZXRTZWN1cml0eVJlc291cmNlcygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgc2VjdXJpdHlTdGFjazogdGhpcy5zZWN1cml0eVN0YWNrLFxuICAgICAga21zS2V5OiB0aGlzLnNlY3VyaXR5U3RhY2s/Lmttc0tleSB8fCBudWxsLFxuICAgICAgd2FmV2ViQWNsOiB0aGlzLnNlY3VyaXR5U3RhY2s/LndhZldlYkFjbCB8fCBudWxsLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog44ON44OD44OI44Ov44O844Kv44Oq44K944O844K544Gu5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgZ2V0TmV0d29ya1Jlc291cmNlcygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbmV0d29ya2luZ1N0YWNrOiB0aGlzLm5ldHdvcmtpbmdTdGFjayxcbiAgICAgIG5ldHdvcmtTdGFjazogdGhpcy5uZXR3b3JrU3RhY2ssXG4gICAgICB2cGM6IHRoaXMubmV0d29ya2luZ1N0YWNrPy52cGMgfHwgbnVsbCxcbiAgICAgIHB1YmxpY1N1Ym5ldHM6IHRoaXMubmV0d29ya2luZ1N0YWNrPy5wdWJsaWNTdWJuZXRzIHx8IFtdLFxuICAgICAgcHJpdmF0ZVN1Ym5ldHM6IHRoaXMubmV0d29ya2luZ1N0YWNrPy5wcml2YXRlU3VibmV0cyB8fCBbXSxcbiAgICAgIGlzb2xhdGVkU3VibmV0czogdGhpcy5uZXR3b3JraW5nU3RhY2s/Lmlzb2xhdGVkU3VibmV0cyB8fCBbXSxcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiB0aGlzLm5ldHdvcmtpbmdTdGFjaz8uc2VjdXJpdHlHcm91cHMgfHwge30sXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg4fjg7zjgr/jg6rjgr3jg7zjgrnjga7lj5blvpdcbiAgICovXG4gIHB1YmxpYyBnZXREYXRhUmVzb3VyY2VzKCkge1xuICAgIHJldHVybiB7XG4gICAgICBkYXRhU3RhY2s6IHRoaXMuZGF0YVN0YWNrLFxuICAgICAgZnN4blN0YWNrOiB0aGlzLmZzeG5TdGFjayxcbiAgICAgIHMzQnVja2V0czogdGhpcy5kYXRhU3RhY2s/LnMzQnVja2V0cyB8fCB7fSxcbiAgICAgIGR5bmFtb0RiVGFibGVzOiB0aGlzLmRhdGFTdGFjaz8uZHluYW1vRGJUYWJsZXMgfHwge30sXG4gICAgICBvcGVuU2VhcmNoQ29sbGVjdGlvbjogdGhpcy5kYXRhU3RhY2s/Lm9wZW5TZWFyY2hDb2xsZWN0aW9uIHx8IG51bGwsXG4gICAgICBmc3hGaWxlU3lzdGVtOiB0aGlzLmZzeG5TdGFjaz8uZnN4RmlsZVN5c3RlbSB8fCBudWxsLFxuICAgIH07XG4gIH1cbn0iXX0=