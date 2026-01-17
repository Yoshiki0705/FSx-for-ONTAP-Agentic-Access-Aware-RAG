"use strict";
/**
 * メイン統合デプロイメントスタック
 *
 * 6つの統合スタックを依存関係に基づいて段階的にデプロイ
 * 設定の一元管理と環境別デプロイメント対応
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
exports.MainDeploymentStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const index_1 = require("./index");
// 高度権限制御スタック
const advanced_permission_stack_1 = require("./advanced-permission-stack");
// タグ設定のインポート
const tagging_config_1 = require("../../config/tagging-config");
class MainDeploymentStack extends cdk.Stack {
    // 統合スタックのインスタンス
    securityStack;
    networkingStack;
    dataStack;
    embeddingStack;
    webAppStack;
    operationsStack;
    advancedPermissionStack;
    // デプロイメント情報
    deploymentInfo;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { config, securityConfig, networkingConfig, storageConfig, databaseConfig, computeConfig, aiConfig, apiConfig, monitoringConfig, enterpriseConfig, } = props;
        // コスト配布タグの設定
        const taggingConfig = tagging_config_1.PermissionAwareRAGTags.getStandardConfig(config.projectName, config.environment);
        // 環境固有のタグ設定をマージ
        const environmentConfig = tagging_config_1.PermissionAwareRAGTags.getEnvironmentConfig(config.environment);
        const mergedTaggingConfig = {
            ...taggingConfig,
            customTags: {
                ...taggingConfig.customTags,
                ...environmentConfig.customTags,
            },
        };
        // スタック全体にタグを適用
        tagging_config_1.TaggingStrategy.applyTagsToStack(this, mergedTaggingConfig);
        const deployedStacks = [];
        const skippedStacks = [];
        // 1. SecurityStack のデプロイ
        if (config.enableSecurity) {
            this.securityStack = new index_1.SecurityStack(this, 'SecurityStack', {
                config: securityConfig,
                projectName: config.projectName,
                environment: config.environment,
            });
            deployedStacks.push('SecurityStack');
        }
        else {
            skippedStacks.push('SecurityStack');
        }
        // 2. NetworkingStack のデプロイ
        if (config.enableNetworking) {
            this.networkingStack = new index_1.NetworkingStack(this, 'NetworkingStack', {
                config: networkingConfig,
                projectName: config.projectName,
                environment: config.environment,
            });
            // SecurityStack への依存関係設定
            if (this.securityStack) {
                this.networkingStack.addDependency(this.securityStack);
            }
            deployedStacks.push('NetworkingStack');
        }
        else {
            skippedStacks.push('NetworkingStack');
        }
        // 3. DataStack のデプロイ
        if (config.enableData) {
            this.dataStack = new index_1.DataStack(this, 'DataStack', {
                config: {
                    storage: storageConfig,
                    database: databaseConfig,
                },
                securityStack: this.securityStack,
                projectName: config.projectName,
                environment: config.environment,
            });
            // 依存関係設定
            if (this.securityStack) {
                this.dataStack.addDependency(this.securityStack);
            }
            if (this.networkingStack) {
                this.dataStack.addDependency(this.networkingStack);
            }
            deployedStacks.push('DataStack');
        }
        else {
            skippedStacks.push('DataStack');
        }
        // 4. EmbeddingStack のデプロイ
        if (config.enableEmbedding) {
            this.embeddingStack = new index_1.EmbeddingStack(this, 'EmbeddingStack', {
                computeConfig,
                aiConfig,
                projectName: config.projectName,
                environment: config.environment,
                vpcId: this.networkingStack?.vpc.vpcId,
                privateSubnetIds: this.networkingStack?.privateSubnets.map(subnet => subnet.subnetId),
                securityGroupIds: this.networkingStack ? Object.values(this.networkingStack.securityGroups).map(sg => sg.securityGroupId) : undefined,
                kmsKeyArn: this.securityStack?.kmsKey.keyArn,
                s3BucketArns: this.dataStack ? Object.values(this.dataStack.s3Buckets).map(bucket => bucket.bucketArn) : undefined,
                dynamoDbTableArns: this.dataStack ? Object.values(this.dataStack.dynamoDbTables).map(table => table.tableArn) : undefined,
                openSearchCollectionArn: this.dataStack?.openSearchCollection?.attrArn,
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
        }
        else {
            skippedStacks.push('EmbeddingStack');
        }
        // 5. WebAppStack のデプロイ
        if (config.enableWebApp) {
            this.webAppStack = new index_1.WebAppStack(this, 'WebAppStack', {
                apiConfig,
                projectName: config.projectName,
                environment: config.environment,
                lambdaFunctionArns: this.embeddingStack ? Object.fromEntries(Object.entries(this.embeddingStack.lambdaFunctions).map(([name, func]) => [name, func.functionArn])) : undefined,
                wafWebAclArn: this.securityStack?.wafWebAcl?.attrArn,
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
        }
        else {
            skippedStacks.push('WebAppStack');
        }
        // 6. AdvancedPermissionStack のデプロイ
        if (props.enableAdvancedPermissionControl && props.opensearchEndpoint) {
            this.advancedPermissionStack = new advanced_permission_stack_1.AdvancedPermissionStack(this, 'AdvancedPermissionStack', {
                config: config,
                environment: config.environment,
                opensearchEndpoint: props.opensearchEndpoint,
                kmsKeyArn: this.securityStack?.kmsKey.keyArn,
                vpcId: this.networkingStack?.vpc.vpcId,
            });
            // 依存関係設定
            if (this.securityStack) {
                this.advancedPermissionStack.addDependency(this.securityStack);
            }
            if (this.networkingStack) {
                this.advancedPermissionStack.addDependency(this.networkingStack);
            }
            if (this.dataStack) {
                this.advancedPermissionStack.addDependency(this.dataStack);
            }
            deployedStacks.push('AdvancedPermissionStack');
        }
        else {
            skippedStacks.push('AdvancedPermissionStack');
        }
        // 7. OperationsStack のデプロイ
        if (config.enableOperations) {
            this.operationsStack = new index_1.OperationsStack(this, 'OperationsStack', {
                config: {
                    monitoring: monitoringConfig,
                    enterprise: enterpriseConfig,
                },
                securityStack: this.securityStack,
                dataStack: this.dataStack,
                embeddingStack: this.embeddingStack,
                webAppStack: this.webAppStack,
                projectName: config.projectName,
                environment: config.environment,
            });
            // 依存関係設定（全スタックに依存）
            if (this.securityStack) {
                this.operationsStack.addDependency(this.securityStack);
            }
            if (this.networkingStack) {
                this.operationsStack.addDependency(this.networkingStack);
            }
            if (this.dataStack) {
                this.operationsStack.addDependency(this.dataStack);
            }
            if (this.embeddingStack) {
                this.operationsStack.addDependency(this.embeddingStack);
            }
            if (this.webAppStack) {
                this.operationsStack.addDependency(this.webAppStack);
            }
            if (this.advancedPermissionStack) {
                this.operationsStack.addDependency(this.advancedPermissionStack);
            }
            deployedStacks.push('OperationsStack');
        }
        else {
            skippedStacks.push('OperationsStack');
        }
        // デプロイメント情報の設定
        this.deploymentInfo = {
            deployedStacks,
            skippedStacks,
            totalDeploymentTime: this.calculateDeploymentTime(deployedStacks),
            estimatedMonthlyCost: this.calculateMonthlyCost(deployedStacks),
        };
        // CloudFormation出力
        this.createDeploymentOutputs();
        // スタックレベルのタグ設定
        this.applyStackTags(config.projectName, config.environment);
    }
    /**
     * デプロイメント時間の計算
     */
    calculateDeploymentTime(deployedStacks) {
        const timeMap = {
            SecurityStack: 7.5,
            NetworkingStack: 12.5,
            DataStack: 22.5,
            EmbeddingStack: 15,
            WebAppStack: 20,
            AdvancedPermissionStack: 8,
            OperationsStack: 10,
        };
        const totalMinutes = deployedStacks.reduce((total, stack) => total + (timeMap[stack] || 0), 0);
        return `${Math.round(totalMinutes)} minutes`;
    }
    /**
     * 月額コストの計算
     */
    calculateMonthlyCost(deployedStacks) {
        const costMap = {
            SecurityStack: 20,
            NetworkingStack: 50,
            DataStack: 300,
            EmbeddingStack: 150,
            WebAppStack: 100,
            AdvancedPermissionStack: 75,
            OperationsStack: 30,
        };
        const totalCost = deployedStacks.reduce((total, stack) => total + (costMap[stack] || 0), 0);
        return `$${totalCost}-${Math.round(totalCost * 1.5)} USD/month`;
    }
    /**
     * デプロイメント情報のCloudFormation出力
     */
    createDeploymentOutputs() {
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
        new cdk.CfnOutput(this, 'TotalDeploymentTime', {
            value: this.deploymentInfo.totalDeploymentTime,
            description: 'Total deployment time',
            exportName: `${this.stackName}-TotalDeploymentTime`,
        });
        new cdk.CfnOutput(this, 'EstimatedMonthlyCost', {
            value: this.deploymentInfo.estimatedMonthlyCost,
            description: 'Estimated monthly cost',
            exportName: `${this.stackName}-EstimatedMonthlyCost`,
        });
        // 主要エンドポイント情報
        if (this.webAppStack) {
            new cdk.CfnOutput(this, 'WebsiteUrl', {
                value: `https://${this.webAppStack.cloudFrontDistribution.distributionDomainName}`,
                description: 'Website URL',
                exportName: `${this.stackName}-WebsiteUrl`,
            });
            new cdk.CfnOutput(this, 'ApiUrl', {
                value: this.webAppStack.apiGateway.url,
                description: 'API Gateway URL',
                exportName: `${this.stackName}-ApiUrl`,
            });
        }
        if (this.operationsStack) {
            new cdk.CfnOutput(this, 'MonitoringDashboardUrl', {
                value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.operationsStack.cloudWatchDashboard.dashboardName}`,
                description: 'CloudWatch Dashboard URL',
                exportName: `${this.stackName}-MonitoringDashboardUrl`,
            });
        }
    }
    /**
     * スタックレベルのタグ設定
     */
    applyStackTags(projectName, environment) {
        cdk.Tags.of(this).add('Project', projectName);
        cdk.Tags.of(this).add('Environment', environment);
        cdk.Tags.of(this).add('Stack', 'MainDeploymentStack');
        cdk.Tags.of(this).add('Component', 'Integration');
        cdk.Tags.of(this).add('ManagedBy', 'CDK');
        cdk.Tags.of(this).add('DeploymentType', 'Integrated');
        cdk.Tags.of(this).add('CostCenter', `${projectName}-${environment}-integrated`);
    }
    /**
     * デプロイメント情報の取得
     */
    getDeploymentInfo() {
        return this.deploymentInfo;
    }
    /**
     * 特定のスタックが有効かどうかを確認
     */
    isStackEnabled(stackName) {
        return this.deploymentInfo.deployedStacks.includes(stackName);
    }
    /**
     * 全体的なシステム情報を取得
     */
    getSystemInfo() {
        return {
            projectName: this.stackName,
            region: this.region,
            account: this.account,
            deploymentInfo: this.deploymentInfo,
            endpoints: {
                website: this.webAppStack ? `https://${this.webAppStack.cloudFrontDistribution.distributionDomainName}` : null,
                api: this.webAppStack?.apiGateway.url || null,
                monitoring: this.operationsStack ? `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.operationsStack.cloudWatchDashboard.dashboardName}` : null,
            },
            resources: {
                security: this.securityStack ? 'Enabled' : 'Disabled',
                networking: this.networkingStack ? 'Enabled' : 'Disabled',
                data: this.dataStack ? 'Enabled' : 'Disabled',
                embedding: this.embeddingStack ? 'Enabled' : 'Disabled',
                webapp: this.webAppStack ? 'Enabled' : 'Disabled',
                operations: this.operationsStack ? 'Enabled' : 'Disabled',
            },
        };
    }
}
exports.MainDeploymentStack = MainDeploymentStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi1kZXBsb3ltZW50LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibWFpbi1kZXBsb3ltZW50LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7R0FLRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFFbkMsbUNBVWlCO0FBRWpCLGFBQWE7QUFDYiwyRUFBc0U7QUFhdEUsYUFBYTtBQUNiLGdFQUFxRztBQXFCckcsTUFBYSxtQkFBb0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUNoRCxnQkFBZ0I7SUFDQSxhQUFhLENBQWlCO0lBQzlCLGVBQWUsQ0FBbUI7SUFDbEMsU0FBUyxDQUFhO0lBQ3RCLGNBQWMsQ0FBa0I7SUFDaEMsV0FBVyxDQUFlO0lBQzFCLGVBQWUsQ0FBbUI7SUFDbEMsdUJBQXVCLENBQTJCO0lBRWxFLFlBQVk7SUFDSSxjQUFjLENBSzVCO0lBRUYsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUErQjtRQUN2RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQ0osTUFBTSxFQUNOLGNBQWMsRUFDZCxnQkFBZ0IsRUFDaEIsYUFBYSxFQUNiLGNBQWMsRUFDZCxhQUFhLEVBQ2IsUUFBUSxFQUNSLFNBQVMsRUFDVCxnQkFBZ0IsRUFDaEIsZ0JBQWdCLEdBQ2pCLEdBQUcsS0FBSyxDQUFDO1FBRVYsYUFBYTtRQUNiLE1BQU0sYUFBYSxHQUFHLHVDQUFzQixDQUFDLGlCQUFpQixDQUM1RCxNQUFNLENBQUMsV0FBVyxFQUNsQixNQUFNLENBQUMsV0FBVyxDQUNuQixDQUFDO1FBRUYsZ0JBQWdCO1FBQ2hCLE1BQU0saUJBQWlCLEdBQUcsdUNBQXNCLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzFGLE1BQU0sbUJBQW1CLEdBQWtCO1lBQ3pDLEdBQUcsYUFBYTtZQUNoQixVQUFVLEVB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QWUsQ0FBQyxDQUFDLENBQUMsV0FBVyxJQUFJLENBQUMsTUFBTSxrREFBa0QsSUFBSSxDQUFDLE1BQU0sb0JBQW9CLElBQUksQ0FBQyxlQUFlLENBQUMsbUJBQW1CLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUk7YUFDMU07WUFDRCxTQUFTLEVBQUU7Z0JBQ1QsUUFBUSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsVUFBVTtnQkFDckQsVUFBVSxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsVUFBVTtnQkFDekQsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsVUFBVTtnQkFDN0MsU0FBUyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsVUFBVTtnQkFDdkQsTUFBTSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsVUFBVTtnQkFDakQsVUFBVSxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsVUFBVTthQUMxRDtTQUNGLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUF2WUQsa0RBdVlDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiDjg6HjgqTjg7PntbHlkIjjg4fjg5fjg63jgqTjg6Hjg7Pjg4jjgrnjgr/jg4Pjgq9cbiAqIFxuICogNuOBpOOBrue1seWQiOOCueOCv+ODg+OCr+OCkuS+neWtmOmWouS/guOBq+WfuuOBpeOBhOOBpuautemajueahOOBq+ODh+ODl+ODreOCpFxuICog6Kit5a6a44Gu5LiA5YWD566h55CG44Go55Kw5aKD5Yil44OH44OX44Ot44Kk44Oh44Oz44OI5a++5b+cXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHtcbiAgU2VjdXJpdHlTdGFjayxcbiAgTmV0d29ya2luZ1N0YWNrLFxuICBEYXRhU3RhY2ssXG4gIEVtYmVkZGluZ1N0YWNrLFxuICBXZWJBcHBTdGFjayxcbiAgT3BlcmF0aW9uc1N0YWNrLFxuICBJbnRlZ3JhdGVkU3RhY2tzQ29uZmlnLFxuICBERVBMT1lNRU5UX09SREVSLFxuICBTVEFDS19ERVBFTkRFTkNJRVMsXG59IGZyb20gJy4vaW5kZXgnO1xuXG4vLyDpq5jluqbmqKnpmZDliLblvqHjgrnjgr/jg4Pjgq9cbmltcG9ydCB7IEFkdmFuY2VkUGVybWlzc2lvblN0YWNrIH0gZnJvbSAnLi9hZHZhbmNlZC1wZXJtaXNzaW9uLXN0YWNrJztcblxuLy8g6Kit5a6a44Kk44Oz44K/44O844OV44Kn44O844K544Gu44Kk44Oz44Od44O844OIXG5pbXBvcnQgeyBTZWN1cml0eUNvbmZpZyB9IGZyb20gJy4uLy4uL21vZHVsZXMvc2VjdXJpdHkvaW50ZXJmYWNlcy9zZWN1cml0eS1jb25maWcnO1xuaW1wb3J0IHsgTmV0d29ya2luZ0NvbmZpZyB9IGZyb20gJy4uLy4uL21vZHVsZXMvbmV0d29ya2luZy9pbnRlcmZhY2VzL25ldHdvcmtpbmctY29uZmlnJztcbmltcG9ydCB7IFN0b3JhZ2VDb25maWcgfSBmcm9tICcuLi8uLi9tb2R1bGVzL3N0b3JhZ2UvaW50ZXJmYWNlcy9zdG9yYWdlLWNvbmZpZyc7XG5pbXBvcnQgeyBEYXRhYmFzZUNvbmZpZyB9IGZyb20gJy4uLy4uL21vZHVsZXMvZGF0YWJhc2UvaW50ZXJmYWNlcy9kYXRhYmFzZS1jb25maWcnO1xuaW1wb3J0IHsgQ29tcHV0ZUNvbmZpZyB9IGZyb20gJy4uLy4uL21vZHVsZXMvY29tcHV0ZS9pbnRlcmZhY2VzL2NvbXB1dGUtY29uZmlnJztcbmltcG9ydCB7IEFpQ29uZmlnIH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9haS9pbnRlcmZhY2VzL2FpLWNvbmZpZyc7XG5pbXBvcnQgeyBBcGlDb25maWcgfSBmcm9tICcuLi8uLi9tb2R1bGVzL2FwaS9pbnRlcmZhY2VzL2FwaS1jb25maWcnO1xuaW1wb3J0IHsgTW9uaXRvcmluZ0NvbmZpZyB9IGZyb20gJy4uLy4uL21vZHVsZXMvbW9uaXRvcmluZy9pbnRlcmZhY2VzL21vbml0b3JpbmctY29uZmlnJztcbmltcG9ydCB7IEVudGVycHJpc2VDb25maWcgfSBmcm9tICcuLi8uLi9tb2R1bGVzL2VudGVycHJpc2UvaW50ZXJmYWNlcy9lbnRlcnByaXNlLWNvbmZpZyc7XG5cbi8vIOOCv+OCsOioreWumuOBruOCpOODs+ODneODvOODiFxuaW1wb3J0IHsgVGFnZ2luZ1N0cmF0ZWd5LCBQZXJtaXNzaW9uQXdhcmVSQUdUYWdzLCBUYWdnaW5nQ29uZmlnIH0gZnJvbSAnLi4vLi4vY29uZmlnL3RhZ2dpbmctY29uZmlnJztcblxuZXhwb3J0IGludGVyZmFjZSBNYWluRGVwbG95bWVudFN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGNvbmZpZzogSW50ZWdyYXRlZFN0YWNrc0NvbmZpZztcbiAgXG4gIC8vIOWQhOODouOCuOODpeODvOODq+OBruips+e0sOioreWumlxuICBzZWN1cml0eUNvbmZpZzogU2VjdXJpdHlDb25maWc7XG4gIG5ldHdvcmtpbmdDb25maWc6IE5ldHdvcmtpbmdDb25maWc7XG4gIHN0b3JhZ2VDb25maWc6IFN0b3JhZ2VDb25maWc7XG4gIGRhdGFiYXNlQ29uZmlnOiBEYXRhYmFzZUNvbmZpZztcbiAgY29tcHV0ZUNvbmZpZzogQ29tcHV0ZUNvbmZpZztcbiAgYWlDb25maWc6IEFpQ29uZmlnO1xuICBhcGlDb25maWc6IEFwaUNvbmZpZztcbiAgbW9uaXRvcmluZ0NvbmZpZzogTW9uaXRvcmluZ0NvbmZpZztcbiAgZW50ZXJwcmlzZUNvbmZpZzogRW50ZXJwcmlzZUNvbmZpZztcbiAgXG4gIC8vIOmrmOW6puaoqemZkOWItuW+oeioreWumlxuICBlbmFibGVBZHZhbmNlZFBlcm1pc3Npb25Db250cm9sPzogYm9vbGVhbjtcbiAgb3BlbnNlYXJjaEVuZHBvaW50Pzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgTWFpbkRlcGxveW1lbnRTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIC8vIOe1seWQiOOCueOCv+ODg+OCr+OBruOCpOODs+OCueOCv+ODs+OCuVxuICBwdWJsaWMgcmVhZG9ubHkgc2VjdXJpdHlTdGFjaz86IFNlY3VyaXR5U3RhY2s7XG4gIHB1YmxpYyByZWFkb25seSBuZXR3b3JraW5nU3RhY2s/OiBOZXR3b3JraW5nU3RhY2s7XG4gIHB1YmxpYyByZWFkb25seSBkYXRhU3RhY2s/OiBEYXRhU3RhY2s7XG4gIHB1YmxpYyByZWFkb25seSBlbWJlZGRpbmdTdGFjaz86IEVtYmVkZGluZ1N0YWNrO1xuICBwdWJsaWMgcmVhZG9ubHkgd2ViQXBwU3RhY2s/OiBXZWJBcHBTdGFjaztcbiAgcHVibGljIHJlYWRvbmx5IG9wZXJhdGlvbnNTdGFjaz86IE9wZXJhdGlvbnNTdGFjaztcbiAgcHVibGljIHJlYWRvbmx5IGFkdmFuY2VkUGVybWlzc2lvblN0YWNrPzogQWR2YW5jZWRQZXJtaXNzaW9uU3RhY2s7XG5cbiAgLy8g44OH44OX44Ot44Kk44Oh44Oz44OI5oOF5aCxXG4gIHB1YmxpYyByZWFkb25seSBkZXBsb3ltZW50SW5mbzoge1xuICAgIGRlcGxveWVkU3RhY2tzOiBzdHJpbmdbXTtcbiAgICBza2lwcGVkU3RhY2tzOiBzdHJpbmdbXTtcbiAgICB0b3RhbERlcGxveW1lbnRUaW1lOiBzdHJpbmc7XG4gICAgZXN0aW1hdGVkTW9udGhseUNvc3Q6IHN0cmluZztcbiAgfTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogTWFpbkRlcGxveW1lbnRTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7IFxuICAgICAgY29uZmlnLFxuICAgICAgc2VjdXJpdHlDb25maWcsXG4gICAgICBuZXR3b3JraW5nQ29uZmlnLFxuICAgICAgc3RvcmFnZUNvbmZpZyxcbiAgICAgIGRhdGFiYXNlQ29uZmlnLFxuICAgICAgY29tcHV0ZUNvbmZpZyxcbiAgICAgIGFpQ29uZmlnLFxuICAgICAgYXBpQ29uZmlnLFxuICAgICAgbW9uaXRvcmluZ0NvbmZpZyxcbiAgICAgIGVudGVycHJpc2VDb25maWcsXG4gICAgfSA9IHByb3BzO1xuXG4gICAgLy8g44Kz44K544OI6YWN5biD44K/44Kw44Gu6Kit5a6aXG4gICAgY29uc3QgdGFnZ2luZ0NvbmZpZyA9IFBlcm1pc3Npb25Bd2FyZVJBR1RhZ3MuZ2V0U3RhbmRhcmRDb25maWcoXG4gICAgICBjb25maWcucHJvamVjdE5hbWUsXG4gICAgICBjb25maWcuZW52aXJvbm1lbnRcbiAgICApO1xuICAgIFxuICAgIC8vIOeSsOWig+WbuuacieOBruOCv+OCsOioreWumuOCkuODnuODvOOCuFxuICAgIGNvbnN0IGVudmlyb25tZW50Q29uZmlnID0gUGVybWlzc2lvbkF3YXJlUkFHVGFncy5nZXRFbnZpcm9ubWVudENvbmZpZyhjb25maWcuZW52aXJvbm1lbnQpO1xuICAgIGNvbnN0IG1lcmdlZFRhZ2dpbmdDb25maWc6IFRhZ2dpbmdDb25maWcgPSB7XG4gICAgICAuLi50YWdnaW5nQ29uZmlnLFxuICAgICAgY3VzdG9tVGFnczoge1xuICAgICAgICAuLi50YWdnaW5nQ29uZmlnLmN1c3RvbVRhZ3MsXG4gICAgICAgIC4uLmVudmlyb25tZW50Q29uZmlnLmN1c3RvbVRhZ3MsXG4gICAgICB9LFxuICAgIH07XG4gICAgXG4gICAgLy8g44K544K/44OD44Kv5YWo5L2T44Gr44K/44Kw44KS6YGp55SoXG4gICAgVGFnZ2luZ1N0cmF0ZWd5LmFwcGx5VGFnc1RvU3RhY2sodGhpcywgbWVyZ2VkVGFnZ2luZ0NvbmZpZyk7XG5cbiAgICBjb25zdCBkZXBsb3llZFN0YWNrczogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCBza2lwcGVkU3RhY2tzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgLy8gMS4gU2VjdXJpdHlTdGFjayDjga7jg4fjg5fjg63jgqRcbiAgICBpZiAoY29uZmlnLmVuYWJsZVNlY3VyaXR5KSB7XG4gICAgICB0aGlzLnNlY3VyaXR5U3RhY2sgPSBuZXcgU2VjdXJpdHlTdGFjayh0aGlzLCAnU2VjdXJpdHlTdGFjaycsIHtcbiAgICAgICAgY29uZmlnOiBzZWN1cml0eUNvbmZpZyxcbiAgICAgICAgcHJvamVjdE5hbWU6IGNvbmZpZy5wcm9qZWN0TmFtZSxcbiAgICAgICAgZW52aXJvbm1lbnQ6IGNvbmZpZy5lbnZpcm9ubWVudCxcbiAgICAgIH0pO1xuICAgICAgZGVwbG95ZWRTdGFja3MucHVzaCgnU2VjdXJpdHlTdGFjaycpO1xuICAgIH0gZWxzZSB7XG4gICAgICBza2lwcGVkU3RhY2tzLnB1c2goJ1NlY3VyaXR5U3RhY2snKTtcbiAgICB9XG5cbiAgICAvLyAyLiBOZXR3b3JraW5nU3RhY2sg44Gu44OH44OX44Ot44KkXG4gICAgaWYgKGNvbmZpZy5lbmFibGVOZXR3b3JraW5nKSB7XG4gICAgICB0aGlzLm5ldHdvcmtpbmdTdGFjayA9IG5ldyBOZXR3b3JraW5nU3RhY2sodGhpcywgJ05ldHdvcmtpbmdTdGFjaycsIHtcbiAgICAgICAgY29uZmlnOiBuZXR3b3JraW5nQ29uZmlnLFxuICAgICAgICBwcm9qZWN0TmFtZTogY29uZmlnLnByb2plY3ROYW1lLFxuICAgICAgICBlbnZpcm9ubWVudDogY29uZmlnLmVudmlyb25tZW50LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFNlY3VyaXR5U3RhY2sg44G444Gu5L6d5a2Y6Zai5L+C6Kit5a6aXG4gICAgICBpZiAodGhpcy5zZWN1cml0eVN0YWNrKSB7XG4gICAgICAgIHRoaXMubmV0d29ya2luZ1N0YWNrLmFkZERlcGVuZGVuY3kodGhpcy5zZWN1cml0eVN0YWNrKTtcbiAgICAgIH1cblxuICAgICAgZGVwbG95ZWRTdGFja3MucHVzaCgnTmV0d29ya2luZ1N0YWNrJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNraXBwZWRTdGFja3MucHVzaCgnTmV0d29ya2luZ1N0YWNrJyk7XG4gICAgfVxuXG4gICAgLy8gMy4gRGF0YVN0YWNrIOOBruODh+ODl+ODreOCpFxuICAgIGlmIChjb25maWcuZW5hYmxlRGF0YSkge1xuICAgICAgdGhpcy5kYXRhU3RhY2sgPSBuZXcgRGF0YVN0YWNrKHRoaXMsICdEYXRhU3RhY2snLCB7XG4gICAgICAgIGNvbmZpZzoge1xuICAgICAgICAgIHN0b3JhZ2U6IHN0b3JhZ2VDb25maWcsXG4gICAgICAgICAgZGF0YWJhc2U6IGRhdGFiYXNlQ29uZmlnLFxuICAgICAgICB9LFxuICAgICAgICBzZWN1cml0eVN0YWNrOiB0aGlzLnNlY3VyaXR5U3RhY2ssXG4gICAgICAgIHByb2plY3ROYW1lOiBjb25maWcucHJvamVjdE5hbWUsXG4gICAgICAgIGVudmlyb25tZW50OiBjb25maWcuZW52aXJvbm1lbnQsXG4gICAgICB9KTtcblxuICAgICAgLy8g5L6d5a2Y6Zai5L+C6Kit5a6aXG4gICAgICBpZiAodGhpcy5zZWN1cml0eVN0YWNrKSB7XG4gICAgICAgIHRoaXMuZGF0YVN0YWNrLmFkZERlcGVuZGVuY3kodGhpcy5zZWN1cml0eVN0YWNrKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLm5ldHdvcmtpbmdTdGFjaykge1xuICAgICAgICB0aGlzLmRhdGFTdGFjay5hZGREZXBlbmRlbmN5KHRoaXMubmV0d29ya2luZ1N0YWNrKTtcbiAgICAgIH1cblxuICAgICAgZGVwbG95ZWRTdGFja3MucHVzaCgnRGF0YVN0YWNrJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNraXBwZWRTdGFja3MucHVzaCgnRGF0YVN0YWNrJyk7XG4gICAgfVxuXG4gICAgLy8gNC4gRW1iZWRkaW5nU3RhY2sg44Gu44OH44OX44Ot44KkXG4gICAgaWYgKGNvbmZpZy5lbmFibGVFbWJlZGRpbmcpIHtcbiAgICAgIHRoaXMuZW1iZWRkaW5nU3RhY2sgPSBuZXcgRW1iZWRkaW5nU3RhY2sodGhpcywgJ0VtYmVkZGluZ1N0YWNrJywge1xuICAgICAgICBjb21wdXRlQ29uZmlnLFxuICAgICAgICBhaUNvbmZpZyxcbiAgICAgICAgcHJvamVjdE5hbWU6IGNvbmZpZy5wcm9qZWN0TmFtZSxcbiAgICAgICAgZW52aXJvbm1lbnQ6IGNvbmZpZy5lbnZpcm9ubWVudCxcbiAgICAgICAgdnBjSWQ6IHRoaXMubmV0d29ya2luZ1N0YWNrPy52cGMudnBjSWQsXG4gICAgICAgIHByaXZhdGVTdWJuZXRJZHM6IHRoaXMubmV0d29ya2luZ1N0YWNrPy5wcml2YXRlU3VibmV0cy5tYXAoc3VibmV0ID0+IHN1Ym5ldC5zdWJuZXRJZCksXG4gICAgICAgIHNlY3VyaXR5R3JvdXBJZHM6IHRoaXMubmV0d29ya2luZ1N0YWNrID8gT2JqZWN0LnZhbHVlcyh0aGlzLm5ldHdvcmtpbmdTdGFjay5zZWN1cml0eUdyb3VwcykubWFwKHNnID0+IHNnLnNlY3VyaXR5R3JvdXBJZCkgOiB1bmRlZmluZWQsXG4gICAgICAgIGttc0tleUFybjogdGhpcy5zZWN1cml0eVN0YWNrPy5rbXNLZXkua2V5QXJuLFxuICAgICAgICBzM0J1Y2tldEFybnM6IHRoaXMuZGF0YVN0YWNrID8gT2JqZWN0LnZhbHVlcyh0aGlzLmRhdGFTdGFjay5zM0J1Y2tldHMpLm1hcChidWNrZXQgPT4gYnVja2V0LmJ1Y2tldEFybikgOiB1bmRlZmluZWQsXG4gICAgICAgIGR5bmFtb0RiVGFibGVBcm5zOiB0aGlzLmRhdGFTdGFjayA/IE9iamVjdC52YWx1ZXModGhpcy5kYXRhU3RhY2suZHluYW1vRGJUYWJsZXMpLm1hcCh0YWJsZSA9PiB0YWJsZS50YWJsZUFybikgOiB1bmRlZmluZWQsXG4gICAgICAgIG9wZW5TZWFyY2hDb2xsZWN0aW9uQXJuOiB0aGlzLmRhdGFTdGFjaz8ub3BlblNlYXJjaENvbGxlY3Rpb24/LmF0dHJBcm4sXG4gICAgICB9KTtcblxuICAgICAgLy8g5L6d5a2Y6Zai5L+C6Kit5a6aXG4gICAgICBpZiAodGhpcy5zZWN1cml0eVN0YWNrKSB7XG4gICAgICAgIHRoaXMuZW1iZWRkaW5nU3RhY2suYWRkRGVwZW5kZW5jeSh0aGlzLnNlY3VyaXR5U3RhY2spO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMubmV0d29ya2luZ1N0YWNrKSB7XG4gICAgICAgIHRoaXMuZW1iZWRkaW5nU3RhY2suYWRkRGVwZW5kZW5jeSh0aGlzLm5ldHdvcmtpbmdTdGFjayk7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5kYXRhU3RhY2spIHtcbiAgICAgICAgdGhpcy5lbWJlZGRpbmdTdGFjay5hZGREZXBlbmRlbmN5KHRoaXMuZGF0YVN0YWNrKTtcbiAgICAgIH1cblxuICAgICAgZGVwbG95ZWRTdGFja3MucHVzaCgnRW1iZWRkaW5nU3RhY2snKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2tpcHBlZFN0YWNrcy5wdXNoKCdFbWJlZGRpbmdTdGFjaycpO1xuICAgIH1cblxuICAgIC8vIDUuIFdlYkFwcFN0YWNrIOOBruODh+ODl+ODreOCpFxuICAgIGlmIChjb25maWcuZW5hYmxlV2ViQXBwKSB7XG4gICAgICB0aGlzLndlYkFwcFN0YWNrID0gbmV3IFdlYkFwcFN0YWNrKHRoaXMsICdXZWJBcHBTdGFjaycsIHtcbiAgICAgICAgYXBpQ29uZmlnLFxuICAgICAgICBwcm9qZWN0TmFtZTogY29uZmlnLnByb2plY3ROYW1lLFxuICAgICAgICBlbnZpcm9ubWVudDogY29uZmlnLmVudmlyb25tZW50LFxuICAgICAgICBsYW1iZGFGdW5jdGlvbkFybnM6IHRoaXMuZW1iZWRkaW5nU3RhY2sgPyBPYmplY3QuZnJvbUVudHJpZXMoXG4gICAgICAgICAgT2JqZWN0LmVudHJpZXModGhpcy5lbWJlZGRpbmdTdGFjay5sYW1iZGFGdW5jdGlvbnMpLm1hcCgoW25hbWUsIGZ1bmNdKSA9PiBbbmFtZSwgZnVuYy5mdW5jdGlvbkFybl0pXG4gICAgICAgICkgOiB1bmRlZmluZWQsXG4gICAgICAgIHdhZldlYkFjbEFybjogdGhpcy5zZWN1cml0eVN0YWNrPy53YWZXZWJBY2w/LmF0dHJBcm4sXG4gICAgICB9KTtcblxuICAgICAgLy8g5L6d5a2Y6Zai5L+C6Kit5a6aXG4gICAgICBpZiAodGhpcy5zZWN1cml0eVN0YWNrKSB7XG4gICAgICAgIHRoaXMud2ViQXBwU3RhY2suYWRkRGVwZW5kZW5jeSh0aGlzLnNlY3VyaXR5U3RhY2spO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMubmV0d29ya2luZ1N0YWNrKSB7XG4gICAgICAgIHRoaXMud2ViQXBwU3RhY2suYWRkRGVwZW5kZW5jeSh0aGlzLm5ldHdvcmtpbmdTdGFjayk7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5lbWJlZGRpbmdTdGFjaykge1xuICAgICAgICB0aGlzLndlYkFwcFN0YWNrLmFkZERlcGVuZGVuY3kodGhpcy5lbWJlZGRpbmdTdGFjayk7XG4gICAgICB9XG5cbiAgICAgIGRlcGxveWVkU3RhY2tzLnB1c2goJ1dlYkFwcFN0YWNrJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNraXBwZWRTdGFja3MucHVzaCgnV2ViQXBwU3RhY2snKTtcbiAgICB9XG5cbiAgICAvLyA2LiBBZHZhbmNlZFBlcm1pc3Npb25TdGFjayDjga7jg4fjg5fjg63jgqRcbiAgICBpZiAocHJvcHMuZW5hYmxlQWR2YW5jZWRQZXJtaXNzaW9uQ29udHJvbCAmJiBwcm9wcy5vcGVuc2VhcmNoRW5kcG9pbnQpIHtcbiAgICAgIHRoaXMuYWR2YW5jZWRQZXJtaXNzaW9uU3RhY2sgPSBuZXcgQWR2YW5jZWRQZXJtaXNzaW9uU3RhY2sodGhpcywgJ0FkdmFuY2VkUGVybWlzc2lvblN0YWNrJywge1xuICAgICAgICBjb25maWc6IGNvbmZpZyxcbiAgICAgICAgZW52aXJvbm1lbnQ6IGNvbmZpZy5lbnZpcm9ubWVudCxcbiAgICAgICAgb3BlbnNlYXJjaEVuZHBvaW50OiBwcm9wcy5vcGVuc2VhcmNoRW5kcG9pbnQsXG4gICAgICAgIGttc0tleUFybjogdGhpcy5zZWN1cml0eVN0YWNrPy5rbXNLZXkua2V5QXJuLFxuICAgICAgICB2cGNJZDogdGhpcy5uZXR3b3JraW5nU3RhY2s/LnZwYy52cGNJZCxcbiAgICAgIH0pO1xuXG4gICAgICAvLyDkvp3lrZjplqLkv4LoqK3lrppcbiAgICAgIGlmICh0aGlzLnNlY3VyaXR5U3RhY2spIHtcbiAgICAgICAgdGhpcy5hZHZhbmNlZFBlcm1pc3Npb25TdGFjay5hZGREZXBlbmRlbmN5KHRoaXMuc2VjdXJpdHlTdGFjayk7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5uZXR3b3JraW5nU3RhY2spIHtcbiAgICAgICAgdGhpcy5hZHZhbmNlZFBlcm1pc3Npb25TdGFjay5hZGREZXBlbmRlbmN5KHRoaXMubmV0d29ya2luZ1N0YWNrKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmRhdGFTdGFjaykge1xuICAgICAgICB0aGlzLmFkdmFuY2VkUGVybWlzc2lvblN0YWNrLmFkZERlcGVuZGVuY3kodGhpcy5kYXRhU3RhY2spO1xuICAgICAgfVxuXG4gICAgICBkZXBsb3llZFN0YWNrcy5wdXNoKCdBZHZhbmNlZFBlcm1pc3Npb25TdGFjaycpO1xuICAgIH0gZWxzZSB7XG4gICAgICBza2lwcGVkU3RhY2tzLnB1c2goJ0FkdmFuY2VkUGVybWlzc2lvblN0YWNrJyk7XG4gICAgfVxuXG4gICAgLy8gNy4gT3BlcmF0aW9uc1N0YWNrIOOBruODh+ODl+ODreOCpFxuICAgIGlmIChjb25maWcuZW5hYmxlT3BlcmF0aW9ucykge1xuICAgICAgdGhpcy5vcGVyYXRpb25zU3RhY2sgPSBuZXcgT3BlcmF0aW9uc1N0YWNrKHRoaXMsICdPcGVyYXRpb25zU3RhY2snLCB7XG4gICAgICAgIGNvbmZpZzoge1xuICAgICAgICAgIG1vbml0b3Jpbmc6IG1vbml0b3JpbmdDb25maWcsXG4gICAgICAgICAgZW50ZXJwcmlzZTogZW50ZXJwcmlzZUNvbmZpZyxcbiAgICAgICAgfSxcbiAgICAgICAgc2VjdXJpdHlTdGFjazogdGhpcy5zZWN1cml0eVN0YWNrLFxuICAgICAgICBkYXRhU3RhY2s6IHRoaXMuZGF0YVN0YWNrLFxuICAgICAgICBlbWJlZGRpbmdTdGFjazogdGhpcy5lbWJlZGRpbmdTdGFjayxcbiAgICAgICAgd2ViQXBwU3RhY2s6IHRoaXMud2ViQXBwU3RhY2ssXG4gICAgICAgIHByb2plY3ROYW1lOiBjb25maWcucHJvamVjdE5hbWUsXG4gICAgICAgIGVudmlyb25tZW50OiBjb25maWcuZW52aXJvbm1lbnQsXG4gICAgICB9KTtcblxuICAgICAgLy8g5L6d5a2Y6Zai5L+C6Kit5a6a77yI5YWo44K544K/44OD44Kv44Gr5L6d5a2Y77yJXG4gICAgICBpZiAodGhpcy5zZWN1cml0eVN0YWNrKSB7XG4gICAgICAgIHRoaXMub3BlcmF0aW9uc1N0YWNrLmFkZERlcGVuZGVuY3kodGhpcy5zZWN1cml0eVN0YWNrKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLm5ldHdvcmtpbmdTdGFjaykge1xuICAgICAgICB0aGlzLm9wZXJhdGlvbnNTdGFjay5hZGREZXBlbmRlbmN5KHRoaXMubmV0d29ya2luZ1N0YWNrKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmRhdGFTdGFjaykge1xuICAgICAgICB0aGlzLm9wZXJhdGlvbnNTdGFjay5hZGREZXBlbmRlbmN5KHRoaXMuZGF0YVN0YWNrKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmVtYmVkZGluZ1N0YWNrKSB7XG4gICAgICAgIHRoaXMub3BlcmF0aW9uc1N0YWNrLmFkZERlcGVuZGVuY3kodGhpcy5lbWJlZGRpbmdTdGFjayk7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy53ZWJBcHBTdGFjaykge1xuICAgICAgICB0aGlzLm9wZXJhdGlvbnNTdGFjay5hZGREZXBlbmRlbmN5KHRoaXMud2ViQXBwU3RhY2spO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuYWR2YW5jZWRQZXJtaXNzaW9uU3RhY2spIHtcbiAgICAgICAgdGhpcy5vcGVyYXRpb25zU3RhY2suYWRkRGVwZW5kZW5jeSh0aGlzLmFkdmFuY2VkUGVybWlzc2lvblN0YWNrKTtcbiAgICAgIH1cblxuICAgICAgZGVwbG95ZWRTdGFja3MucHVzaCgnT3BlcmF0aW9uc1N0YWNrJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNraXBwZWRTdGFja3MucHVzaCgnT3BlcmF0aW9uc1N0YWNrJyk7XG4gICAgfVxuXG4gICAgLy8g44OH44OX44Ot44Kk44Oh44Oz44OI5oOF5aCx44Gu6Kit5a6aXG4gICAgdGhpcy5kZXBsb3ltZW50SW5mbyA9IHtcbiAgICAgIGRlcGxveWVkU3RhY2tzLFxuICAgICAgc2tpcHBlZFN0YWNrcyxcbiAgICAgIHRvdGFsRGVwbG95bWVudFRpbWU6IHRoaXMuY2FsY3VsYXRlRGVwbG95bWVudFRpbWUoZGVwbG95ZWRTdGFja3MpLFxuICAgICAgZXN0aW1hdGVkTW9udGhseUNvc3Q6IHRoaXMuY2FsY3VsYXRlTW9udGhseUNvc3QoZGVwbG95ZWRTdGFja3MpLFxuICAgIH07XG5cbiAgICAvLyBDbG91ZEZvcm1hdGlvbuWHuuWKm1xuICAgIHRoaXMuY3JlYXRlRGVwbG95bWVudE91dHB1dHMoKTtcblxuICAgIC8vIOOCueOCv+ODg+OCr+ODrOODmeODq+OBruOCv+OCsOioreWumlxuICAgIHRoaXMuYXBwbHlTdGFja1RhZ3MoY29uZmlnLnByb2plY3ROYW1lLCBjb25maWcuZW52aXJvbm1lbnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIOODh+ODl+ODreOCpOODoeODs+ODiOaZgumWk+OBruioiOeul1xuICAgKi9cbiAgcHJpdmF0ZSBjYWxjdWxhdGVEZXBsb3ltZW50VGltZShkZXBsb3llZFN0YWNrczogc3RyaW5nW10pOiBzdHJpbmcge1xuICAgIGNvbnN0IHRpbWVNYXA6IHsgW2tleTogc3RyaW5nXTogbnVtYmVyIH0gPSB7XG4gICAgICBTZWN1cml0eVN0YWNrOiA3LjUsXG4gICAgICBOZXR3b3JraW5nU3RhY2s6IDEyLjUsXG4gICAgICBEYXRhU3RhY2s6IDIyLjUsXG4gICAgICBFbWJlZGRpbmdTdGFjazogMTUsXG4gICAgICBXZWJBcHBTdGFjazogMjAsXG4gICAgICBBZHZhbmNlZFBlcm1pc3Npb25TdGFjazogOCxcbiAgICAgIE9wZXJhdGlvbnNTdGFjazogMTAsXG4gICAgfTtcblxuICAgIGNvbnN0IHRvdGFsTWludXRlcyA9IGRlcGxveWVkU3RhY2tzLnJlZHVjZSgodG90YWwsIHN0YWNrKSA9PiB0b3RhbCArICh0aW1lTWFwW3N0YWNrXSB8fCAwKSwgMCk7XG4gICAgcmV0dXJuIGAke01hdGgucm91bmQodG90YWxNaW51dGVzKX0gbWludXRlc2A7XG4gIH1cblxuICAvKipcbiAgICog5pyI6aGN44Kz44K544OI44Gu6KiI566XXG4gICAqL1xuICBwcml2YXRlIGNhbGN1bGF0ZU1vbnRobHlDb3N0KGRlcGxveWVkU3RhY2tzOiBzdHJpbmdbXSk6IHN0cmluZyB7XG4gICAgY29uc3QgY29zdE1hcDogeyBba2V5OiBzdHJpbmddOiBudW1iZXIgfSA9IHtcbiAgICAgIFNlY3VyaXR5U3RhY2s6IDIwLFxuICAgICAgTmV0d29ya2luZ1N0YWNrOiA1MCxcbiAgICAgIERhdGFTdGFjazogMzAwLFxuICAgICAgRW1iZWRkaW5nU3RhY2s6IDE1MCxcbiAgICAgIFdlYkFwcFN0YWNrOiAxMDAsXG4gICAgICBBZHZhbmNlZFBlcm1pc3Npb25TdGFjazogNzUsXG4gICAgICBPcGVyYXRpb25zU3RhY2s6IDMwLFxuICAgIH07XG5cbiAgICBjb25zdCB0b3RhbENvc3QgPSBkZXBsb3llZFN0YWNrcy5yZWR1Y2UoKHRvdGFsLCBzdGFjaykgPT4gdG90YWwgKyAoY29zdE1hcFtzdGFja10gfHwgMCksIDApO1xuICAgIHJldHVybiBgJCR7dG90YWxDb3N0fS0ke01hdGgucm91bmQodG90YWxDb3N0ICogMS41KX0gVVNEL21vbnRoYDtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg4fjg5fjg63jgqTjg6Hjg7Pjg4jmg4XloLHjga5DbG91ZEZvcm1hdGlvbuWHuuWKm1xuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVEZXBsb3ltZW50T3V0cHV0cygpOiB2b2lkIHtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGVwbG95ZWRTdGFja3MnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kZXBsb3ltZW50SW5mby5kZXBsb3llZFN0YWNrcy5qb2luKCcsICcpLFxuICAgICAgZGVzY3JpcHRpb246ICdTdWNjZXNzZnVsbHkgZGVwbG95ZWQgc3RhY2tzJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1EZXBsb3llZFN0YWNrc2AsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2tpcHBlZFN0YWNrcycsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmRlcGxveW1lbnRJbmZvLnNraXBwZWRTdGFja3Muam9pbignLCAnKSB8fCAnTm9uZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NraXBwZWQgc3RhY2tzJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Ta2lwcGVkU3RhY2tzYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdUb3RhbERlcGxveW1lbnRUaW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuZGVwbG95bWVudEluZm8udG90YWxEZXBsb3ltZW50VGltZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVG90YWwgZGVwbG95bWVudCB0aW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Ub3RhbERlcGxveW1lbnRUaW1lYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdFc3RpbWF0ZWRNb250aGx5Q29zdCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmRlcGxveW1lbnRJbmZvLmVzdGltYXRlZE1vbnRobHlDb3N0LFxuICAgICAgZGVzY3JpcHRpb246ICdFc3RpbWF0ZWQgbW9udGhseSBjb3N0JyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Fc3RpbWF0ZWRNb250aGx5Q29zdGAsXG4gICAgfSk7XG5cbiAgICAvLyDkuLvopoHjgqjjg7Pjg4njg53jgqTjg7Pjg4jmg4XloLFcbiAgICBpZiAodGhpcy53ZWJBcHBTdGFjaykge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dlYnNpdGVVcmwnLCB7XG4gICAgICAgIHZhbHVlOiBgaHR0cHM6Ly8ke3RoaXMud2ViQXBwU3RhY2suY2xvdWRGcm9udERpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lfWAsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnV2Vic2l0ZSBVUkwnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tV2Vic2l0ZVVybGAsXG4gICAgICB9KTtcblxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaVVybCcsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMud2ViQXBwU3RhY2suYXBpR2F0ZXdheS51cmwsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgVVJMJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFwaVVybGAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5vcGVyYXRpb25zU3RhY2spIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdNb25pdG9yaW5nRGFzaGJvYXJkVXJsJywge1xuICAgICAgICB2YWx1ZTogYGh0dHBzOi8vJHt0aGlzLnJlZ2lvbn0uY29uc29sZS5hd3MuYW1hem9uLmNvbS9jbG91ZHdhdGNoL2hvbWU/cmVnaW9uPSR7dGhpcy5yZWdpb259I2Rhc2hib2FyZHM6bmFtZT0ke3RoaXMub3BlcmF0aW9uc1N0YWNrLmNsb3VkV2F0Y2hEYXNoYm9hcmQuZGFzaGJvYXJkTmFtZX1gLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkV2F0Y2ggRGFzaGJvYXJkIFVSTCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Nb25pdG9yaW5nRGFzaGJvYXJkVXJsYCxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjgrnjgr/jg4Pjgq/jg6zjg5njg6vjga7jgr/jgrDoqK3lrppcbiAgICovXG4gIHByaXZhdGUgYXBwbHlTdGFja1RhZ3MocHJvamVjdE5hbWU6IHN0cmluZywgZW52aXJvbm1lbnQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnUHJvamVjdCcsIHByb2plY3ROYW1lKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50JywgZW52aXJvbm1lbnQpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnU3RhY2snLCAnTWFpbkRlcGxveW1lbnRTdGFjaycpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQ29tcG9uZW50JywgJ0ludGVncmF0aW9uJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdNYW5hZ2VkQnknLCAnQ0RLJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdEZXBsb3ltZW50VHlwZScsICdJbnRlZ3JhdGVkJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdDb3N0Q2VudGVyJywgYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWludGVncmF0ZWRgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg4fjg5fjg63jgqTjg6Hjg7Pjg4jmg4XloLHjga7lj5blvpdcbiAgICovXG4gIHB1YmxpYyBnZXREZXBsb3ltZW50SW5mbygpIHtcbiAgICByZXR1cm4gdGhpcy5kZXBsb3ltZW50SW5mbztcbiAgfVxuXG4gIC8qKlxuICAgKiDnibnlrprjga7jgrnjgr/jg4Pjgq/jgYzmnInlirnjgYvjganjgYbjgYvjgpLnorroqo1cbiAgICovXG4gIHB1YmxpYyBpc1N0YWNrRW5hYmxlZChzdGFja05hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmRlcGxveW1lbnRJbmZvLmRlcGxveWVkU3RhY2tzLmluY2x1ZGVzKHN0YWNrTmFtZSk7XG4gIH1cblxuICAvKipcbiAgICog5YWo5L2T55qE44Gq44K344K544OG44Og5oOF5aCx44KS5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgZ2V0U3lzdGVtSW5mbygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgcHJvamVjdE5hbWU6IHRoaXMuc3RhY2tOYW1lLFxuICAgICAgcmVnaW9uOiB0aGlzLnJlZ2lvbixcbiAgICAgIGFjY291bnQ6IHRoaXMuYWNjb3VudCxcbiAgICAgIGRlcGxveW1lbnRJbmZvOiB0aGlzLmRlcGxveW1lbnRJbmZvLFxuICAgICAgZW5kcG9pbnRzOiB7XG4gICAgICAgIHdlYnNpdGU6IHRoaXMud2ViQXBwU3RhY2sgPyBgaHR0cHM6Ly8ke3RoaXMud2ViQXBwU3RhY2suY2xvdWRGcm9udERpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lfWAgOiBudWxsLFxuICAgICAgICBhcGk6IHRoaXMud2ViQXBwU3RhY2s/LmFwaUdhdGV3YXkudXJsIHx8IG51bGwsXG4gICAgICAgIG1vbml0b3Jpbmc6IHRoaXMub3BlcmF0aW9uc1N0YWNrID8gYGh0dHBzOi8vJHt0aGlzLnJlZ2lvbn0uY29uc29sZS5hd3MuYW1hem9uLmNvbS9jbG91ZHdhdGNoL2hvbWU/cmVnaW9uPSR7dGhpcy5yZWdpb259I2Rhc2hib2FyZHM6bmFtZT0ke3RoaXMub3BlcmF0aW9uc1N0YWNrLmNsb3VkV2F0Y2hEYXNoYm9hcmQuZGFzaGJvYXJkTmFtZX1gIDogbnVsbCxcbiAgICAgIH0sXG4gICAgICByZXNvdXJjZXM6IHtcbiAgICAgICAgc2VjdXJpdHk6IHRoaXMuc2VjdXJpdHlTdGFjayA/ICdFbmFibGVkJyA6ICdEaXNhYmxlZCcsXG4gICAgICAgIG5ldHdvcmtpbmc6IHRoaXMubmV0d29ya2luZ1N0YWNrID8gJ0VuYWJsZWQnIDogJ0Rpc2FibGVkJyxcbiAgICAgICAgZGF0YTogdGhpcy5kYXRhU3RhY2sgPyAnRW5hYmxlZCcgOiAnRGlzYWJsZWQnLFxuICAgICAgICBlbWJlZGRpbmc6IHRoaXMuZW1iZWRkaW5nU3RhY2sgPyAnRW5hYmxlZCcgOiAnRGlzYWJsZWQnLFxuICAgICAgICB3ZWJhcHA6IHRoaXMud2ViQXBwU3RhY2sgPyAnRW5hYmxlZCcgOiAnRGlzYWJsZWQnLFxuICAgICAgICBvcGVyYXRpb25zOiB0aGlzLm9wZXJhdGlvbnNTdGFjayA/ICdFbmFibGVkJyA6ICdEaXNhYmxlZCcsXG4gICAgICB9LFxuICAgIH07XG4gIH1cbn0iXX0=