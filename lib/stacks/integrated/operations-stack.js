"use strict";
/**
 * OperationsStack - 統合運用・エンタープライズスタック（モジュラーアーキテクチャ対応）
 *
 * 機能:
 * - 統合監視・エンタープライズコンストラクトによる一元管理
 * - CloudWatch・X-Ray・SNS・BI・組織管理の統合
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
exports.OperationsStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
// 統合監視コンストラクト（モジュラーアーキテクチャ）
const monitoring_construct_1 = require("../../modules/monitoring/constructs/monitoring-construct");
// 統合エンタープライズコンストラクト（モジュラーアーキテクチャ）
const enterprise_construct_1 = require("../../modules/enterprise/constructs/enterprise-construct");
// タグ設定
const tagging_config_1 = require("../../config/tagging-config");
// Phase 4: AgentCore Constructs統合
const bedrock_agent_core_observability_construct_1 = require("../../modules/ai/constructs/bedrock-agent-core-observability-construct");
const bedrock_agent_core_evaluations_construct_1 = require("../../modules/ai/constructs/bedrock-agent-core-evaluations-construct");
/**
 * 統合運用・エンタープライズスタック（モジュラーアーキテクチャ対応）
 *
 * 統合監視・エンタープライズコンストラクトによる一元管理
 * 個別スタックデプロイ完全対応
 */
class OperationsStack extends cdk.Stack {
    /** 統合監視コンストラクト */
    monitoring;
    /** 統合エンタープライズコンストラクト */
    enterprise;
    /** CloudWatchダッシュボードURL（他スタックからの参照用） */
    dashboardUrl;
    /** SNSトピックARN（他スタックからの参照用） */
    snsTopicArns = {};
    /** Phase 4: AgentCore Constructs（オプション） */
    agentCoreObservability;
    agentCoreEvaluations;
    constructor(scope, id, props) {
        super(scope, id, props);
        console.log('📊 OperationsStack初期化開始...');
        console.log('📝 スタック名:', id);
        console.log('🏷️ Agent Steering準拠:', props.namingGenerator ? 'Yes' : 'No');
        // コスト配布タグの適用
        const taggingConfig = tagging_config_1.PermissionAwareRAGTags.getStandardConfig(props.projectName, props.environment);
        tagging_config_1.TaggingStrategy.applyTagsToStack(this, taggingConfig);
        // 依存スタックとの依存関係設定（存在する場合）
        if (props.securityStack) {
            this.addDependency(props.securityStack);
            console.log('🔗 SecurityStackとの依存関係設定完了');
        }
        if (props.dataStack) {
            this.addDependency(props.dataStack);
            console.log('🔗 DataStackとの依存関係設定完了');
        }
        if (props.embeddingStack) {
            this.addDependency(props.embeddingStack);
            console.log('🔗 EmbeddingStackとの依存関係設定完了');
        }
        if (props.webAppStack) {
            this.addDependency(props.webAppStack);
            console.log('🔗 WebAppStackとの依存関係設定完了');
        }
        // 統合監視コンストラクト作成
        this.monitoring = new monitoring_construct_1.MonitoringConstruct(this, 'Monitoring', {
            config: props.config.monitoring || {},
            projectName: props.projectName,
            environment: props.environment,
        });
        // 統合エンタープライズコンストラクト作成
        this.enterprise = new enterprise_construct_1.EnterpriseConstruct(this, 'Enterprise', {
            config: props.config.enterprise,
            // environment: props.config.environment, // プロパティが存在しないためコメントアウト
            // kmsKey: props.securityStack?.kmsKey, // プロパティが存在しないためコメントアウト
            // cognitoUserPoolId: props.webAppStack?.cognitoUserPoolId, // プロパティが存在しないためコメントアウト
            // namingGenerator: props.namingGenerator, // プロパティが存在しないためコメントアウト
        });
        // Phase 4: AgentCore Constructs統合（オプション）
        if (props.agentCore || props.config.agentCore) {
            console.log('');
            console.log('========================================');
            console.log('🚀 AgentCore Constructs統合開始...');
            console.log('========================================');
            this.integrateAgentCoreConstructs(props);
            console.log('✅ AgentCore Constructs統合完了');
        }
        // 他スタックからの参照用プロパティ設定
        this.setupCrossStackReferences();
        // スタック出力
        this.createOutputs();
        // タグ設定
        this.addStackTags();
        console.log('✅ OperationsStack初期化完了');
    }
    /**
     * 他スタックからの参照用プロパティ設定
     */
    setupCrossStackReferences() {
        // CloudWatchダッシュボードURLの設定（存在する場合）
        // if (this.monitoring.outputs?.dashboardUrl) {
        //   this.dashboardUrl = this.monitoring.outputs.dashboardUrl;
        // }
        // SNSトピックARNの設定（存在する場合）
        // if (this.monitoring.outputs?.snsTopics) {
        //   Object.entries(this.monitoring.outputs.snsTopics).forEach(([name, topic]) => {
        //     if (topic && typeof topic === 'object' && 'topicArn' in topic) {
        //       this.snsTopicArns[name] = topic.topicArn;
        //     }
        //   });
        // }
        console.log('🔗 他スタック参照用プロパティ設定完了');
    }
    /**
     * スタック出力作成（個別デプロイ対応）
     */
    createOutputs() {
        // CloudWatchダッシュボードURL出力（存在する場合のみ）
        if (this.dashboardUrl) {
            new cdk.CfnOutput(this, 'DashboardUrl', {
                value: this.dashboardUrl,
                description: 'CloudWatch Dashboard URL',
                exportName: `${this.stackName}-DashboardUrl`,
            });
        }
        // SNSトピックARN出力（他スタックからの参照用）
        Object.entries(this.snsTopicArns).forEach(([name, topicArn]) => {
            new cdk.CfnOutput(this, `SnsTopic${name}Arn`, {
                value: topicArn,
                description: `SNS ${name} Topic ARN`,
                exportName: `${this.stackName}-SnsTopic${name}Arn`,
            });
        });
        // 監視統合出力（存在する場合のみ）
        // if (this.monitoring.outputs) {
        //   // X-Ray Trace URL
        //   if (this.monitoring.outputs.xrayTraceUrl) {
        //     new cdk.CfnOutput(this, 'XRayTraceUrl', {
        //       value: this.monitoring.outputs.xrayTraceUrl,
        //       description: 'X-Ray Trace URL',
        //       exportName: `${this.stackName}-XRayTraceUrl`,
        //     });
        //   }
        //   // Log Group Names
        //   if (this.monitoring.outputs.logGroupNames) {
        //     Object.entries(this.monitoring.outputs.logGroupNames).forEach(([name, logGroupName]) => {
        //       new cdk.CfnOutput(this, `LogGroup${name}Name`, {
        //         value: logGroupName,
        //         description: `CloudWatch Log Group ${name} Name`,
        //         exportName: `${this.stackName}-LogGroup${name}Name`,
        //       });
        //     });
        //   }
        // }
        // エンタープライズ統合出力（存在する場合のみ）
        // if (this.enterprise.outputs) {
        //   // BI Dashboard URL
        //   if (this.enterprise.outputs.biDashboardUrl) {
        //     new cdk.CfnOutput(this, 'BiDashboardUrl', {
        //       value: this.enterprise.outputs.biDashboardUrl,
        //       description: 'BI Analytics Dashboard URL',
        //       exportName: `${this.stackName}-BiDashboardUrl`,
        //     });
        //   }
        //   // Organization Management Console URL
        //   if (this.enterprise.outputs.organizationConsoleUrl) {
        //     new cdk.CfnOutput(this, 'OrganizationConsoleUrl', {
        //       value: this.enterprise.outputs.organizationConsoleUrl,
        //       description: 'Organization Management Console URL',
        //       exportName: `${this.stackName}-OrganizationConsoleUrl`,
        //     });
        //   }
        // }
        console.log('📤 OperationsStack出力値作成完了');
    }
    /**
     * スタックタグ設定（統一されたタグ戦略使用）
     */
    addStackTags() {
        // 統一されたタグ戦略を使用
        const taggingConfig = tagging_config_1.PermissionAwareRAGTags.getStandardConfig(this.node.tryGetContext('projectName') || 'permission-aware-rag', this.node.tryGetContext('environment') || 'dev');
        // 環境固有のタグ設定を追加
        const environmentConfig = tagging_config_1.PermissionAwareRAGTags.getEnvironmentConfig(this.node.tryGetContext('environment') || 'dev');
        // タグ戦略を適用
        tagging_config_1.TaggingStrategy.applyTagsToStack(this, {
            ...taggingConfig,
            ...environmentConfig,
            customTags: {
                ...taggingConfig.customTags,
                ...environmentConfig.customTags,
                'Module': 'Monitoring+Enterprise',
                'StackType': 'Integrated',
                'Architecture': 'Modular',
                'MonitoringServices': 'CloudWatch+X-Ray+SNS',
                'EnterpriseFeatures': 'BI+Organization+AccessControl',
                'IndividualDeploySupport': 'Yes'
            }
        });
        console.log('🏷️ OperationsStackタグ設定完了（統一戦略使用）');
    }
    /**
     * AgentCore Constructs統合（Phase 4）
     */
    integrateAgentCoreConstructs(props) {
        const agentCoreConfig = props.agentCore || props.config.agentCore;
        if (!agentCoreConfig) {
            return;
        }
        // 1. Observability Construct（監視・トレーシング）
        if (agentCoreConfig.observability?.enabled) {
            console.log('📊 Observability Construct作成中...');
            this.agentCoreObservability = new bedrock_agent_core_observability_construct_1.BedrockAgentCoreObservabilityConstruct(this, 'AgentCoreObservability', {
                enabled: true,
                projectName: props.projectName,
                environment: props.environment,
                cloudwatchConfig: agentCoreConfig.observability.cloudwatchConfig,
                xrayConfig: agentCoreConfig.observability.xrayConfig,
                errorTrackingConfig: agentCoreConfig.observability.errorTrackingConfig,
            });
            console.log('✅ Observability Construct作成完了');
        }
        // 2. Evaluations Construct（評価・テスト）
        if (agentCoreConfig.evaluations?.enabled) {
            console.log('🧪 Evaluations Construct作成中...');
            this.agentCoreEvaluations = new bedrock_agent_core_evaluations_construct_1.BedrockAgentCoreEvaluationsConstruct(this, 'AgentCoreEvaluations', {
                enabled: true,
                projectName: props.projectName,
                environment: props.environment,
                qualityMetricsConfig: agentCoreConfig.evaluations.qualityMetricsConfig,
                abTestConfig: agentCoreConfig.evaluations.abTestConfig,
            });
            console.log('✅ Evaluations Construct作成完了');
        }
        // CloudFormation Outputs
        this.createAgentCoreOutputs();
    }
    /**
     * AgentCore CloudFormation Outputsを作成
     */
    createAgentCoreOutputs() {
        console.log('📤 AgentCore Outputs作成中...');
        // Observability Outputs
        if (this.agentCoreObservability?.dashboard) {
            new cdk.CfnOutput(this, 'AgentCoreObservabilityDashboardName', {
                value: this.agentCoreObservability.dashboard.dashboardName,
                description: 'AgentCore Observability Dashboard Name',
                exportName: `${this.stackName}-AgentCoreObservabilityDashboardName`,
            });
        }
        if (this.agentCoreObservability?.logGroup) {
            new cdk.CfnOutput(this, 'AgentCoreObservabilityLogGroupName', {
                value: this.agentCoreObservability.logGroup.logGroupName,
                description: 'AgentCore Observability Log Group Name',
                exportName: `${this.stackName}-AgentCoreObservabilityLogGroupName`,
            });
        }
        // Evaluations Outputs
        if (this.agentCoreEvaluations?.resultsTable) {
            new cdk.CfnOutput(this, 'AgentCoreEvaluationsResultsTableName', {
                value: this.agentCoreEvaluations.resultsTable.tableName,
                description: 'AgentCore Evaluations Results Table Name',
                exportName: `${this.stackName}-AgentCoreEvaluationsResultsTableName`,
            });
        }
        if (this.agentCoreEvaluations?.dashboard) {
            new cdk.CfnOutput(this, 'AgentCoreEvaluationsDashboardName', {
                value: this.agentCoreEvaluations.dashboard.dashboardName,
                description: 'AgentCore Evaluations Dashboard Name',
                exportName: `${this.stackName}-AgentCoreEvaluationsDashboardName`,
            });
        }
        console.log('✅ AgentCore Outputs作成完了');
    }
}
exports.OperationsStack = OperationsStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlcmF0aW9ucy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9wZXJhdGlvbnMtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7OztHQVFHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUduQyw0QkFBNEI7QUFDNUIsbUdBQStGO0FBRS9GLGtDQUFrQztBQUNsQyxtR0FBK0Y7QUFXL0YsT0FBTztBQUNQLGdFQUFzRjtBQUV0RixrQ0FBa0M7QUFDbEMsdUlBQWdJO0FBQ2hJLG1JQUE0SDtBQWlCNUg7Ozs7O0dBS0c7QUFDSCxNQUFhLGVBQWdCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDNUMsa0JBQWtCO0lBQ0YsVUFBVSxDQUFzQjtJQUVoRCx3QkFBd0I7SUFDUixVQUFVLENBQXNCO0lBRWhELHdDQUF3QztJQUN4QixZQUFZLENBQVU7SUFFdEMsOEJBQThCO0lBQ2QsWUFBWSxHQUE4QixFQUFFLENBQUM7SUFFN0QsMkNBQTJDO0lBQ3BDLHNCQUFzQixDQUEwQztJQUNoRSxvQkFBb0IsQ0FBd0M7SUFFbkUsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUEyQjtRQUNuRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixPQUFPLENBQUMsR0FBRyxDQUFDLDRCQUE0QixDQUFDLENBQUM7UUFDMUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDN0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsRUFBRSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRTNFLGFBQWE7UUFDYixNQUFNLGFBQWEsR0FBRyx1Q0FBc0IsQ0FBQyxpQkFBaUIsQ0FDNUQsS0FBSyxDQUFDLFdBQVcsRUFDakIsS0FBSyxDQUFDLFdBQXlDLENBQ2hELENB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dkQsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsdUNBQXVDO2FBQ3JFLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxTQUFTLEVBQUUsQ0FBQztZQUN6QyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG1DQUFtQyxFQUFFO2dCQUMzRCxLQUFLLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxhQUFhO2dCQUN4RCxXQUFXLEVBQUUsc0NBQXNDO2dCQUNuRCxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyxvQ0FBb0M7YUFDbEUsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELE9BQU8sQ0FBQyxHQUFHLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUN6QyxDQUFDO0NBQ0Y7QUF2U0QsMENBdVNDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBPcGVyYXRpb25zU3RhY2sgLSDntbHlkIjpgYvnlKjjg7vjgqjjg7Pjgr/jg7zjg5fjg6njgqTjgrrjgrnjgr/jg4Pjgq/vvIjjg6Ljgrjjg6Xjg6njg7zjgqLjg7zjgq3jg4bjgq/jg4Hjg6Plr77lv5zvvIlcbiAqIFxuICog5qmf6IO9OlxuICogLSDntbHlkIjnm6Poppbjg7vjgqjjg7Pjgr/jg7zjg5fjg6njgqTjgrrjgrPjg7Pjgrnjg4jjg6njgq/jg4jjgavjgojjgovkuIDlhYPnrqHnkIZcbiAqIC0gQ2xvdWRXYXRjaOODu1gtUmF544O7U05T44O7Qknjg7vntYTnuZTnrqHnkIbjga7ntbHlkIhcbiAqIC0gQWdlbnQgU3RlZXJpbmfmupbmi6Dlkb3lkI3opo/liYflr77lv5xcbiAqIC0g5YCL5Yil44K544K/44OD44Kv44OH44OX44Ot44Kk5a6M5YWo5a++5b+cXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG4vLyDntbHlkIjnm6PoppbjgrPjg7Pjgrnjg4jjg6njgq/jg4jvvIjjg6Ljgrjjg6Xjg6njg7zjgqLjg7zjgq3jg4bjgq/jg4Hjg6PvvIlcbmltcG9ydCB7IE1vbml0b3JpbmdDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi9tb2R1bGVzL21vbml0b3JpbmcvY29uc3RydWN0cy9tb25pdG9yaW5nLWNvbnN0cnVjdCc7XG5cbi8vIOe1seWQiOOCqOODs+OCv+ODvOODl+ODqeOCpOOCuuOCs+ODs+OCueODiOODqeOCr+ODiO+8iOODouOCuOODpeODqeODvOOCouODvOOCreODhuOCr+ODgeODo++8iVxuaW1wb3J0IHsgRW50ZXJwcmlzZUNvbnN0cnVjdCB9IGZyb20gJy4uLy4uL21vZHVsZXMvZW50ZXJwcmlzZS9jb25zdHJ1Y3RzL2VudGVycHJpc2UtY29uc3RydWN0JztcblxuLy8g44Kk44Oz44K/44O844OV44Kn44O844K5XG5pbXBvcnQgeyBNb25pdG9yaW5nQ29uZmlnIH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9tb25pdG9yaW5nL2ludGVyZmFjZXMvbW9uaXRvcmluZy1jb25maWcnO1xuXG4vLyDku5bjgrnjgr/jg4Pjgq/jgYvjgonjga7kvp3lrZjplqLkv4JcbmltcG9ydCB7IFNlY3VyaXR5U3RhY2sgfSBmcm9tICcuL3NlY3VyaXR5LXN0YWNrJztcbmltcG9ydCB7IERhdGFTdGFjayB9IGZyb20gJy4vZGF0YS1zdGFjayc7XG5pbXBvcnQgeyBFbWJlZGRpbmdTdGFjayB9IGZyb20gJy4vZW1iZWRkaW5nLXN0YWNrJztcbmltcG9ydCB7IFdlYkFwcFN0YWNrIH0gZnJvbSAnLi93ZWJhcHAtc3RhY2snO1xuXG4vLyDjgr/jgrDoqK3lrppcbmltcG9ydCB7IFRhZ2dpbmdTdHJhdGVneSwgUGVybWlzc2lvbkF3YXJlUkFHVGFncyB9IGZyb20gJy4uLy4uL2NvbmZpZy90YWdnaW5nLWNvbmZpZyc7XG5cbi8vIFBoYXNlIDQ6IEFnZW50Q29yZSBDb25zdHJ1Y3Rz57Wx5ZCIXG5pbXBvcnQgeyBCZWRyb2NrQWdlbnRDb3JlT2JzZXJ2YWJpbGl0eUNvbnN0cnVjdCB9IGZyb20gJy4uLy4uL21vZHVsZXMvYWkvY29uc3RydWN0cy9iZWRyb2NrLWFnZW50LWNvcmUtb2JzZXJ2YWJpbGl0eS1jb25zdHJ1Y3QnO1xuaW1wb3J0IHsgQmVkcm9ja0FnZW50Q29yZUV2YWx1YXRpb25zQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9haS9jb25zdHJ1Y3RzL2JlZHJvY2stYWdlbnQtY29yZS1ldmFsdWF0aW9ucy1jb25zdHJ1Y3QnO1xuaW1wb3J0IHsgQWdlbnRDb3JlQ29uZmlnIH0gZnJvbSAnLi4vLi4vLi4vdHlwZXMvYWdlbnRjb3JlLWNvbmZpZyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgT3BlcmF0aW9uc1N0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHJlYWRvbmx5IGNvbmZpZzogYW55OyAvLyDntbHlkIjoqK3lrprjgqrjg5bjgrjjgqfjgq/jg4hcbiAgcmVhZG9ubHkgc2VjdXJpdHlTdGFjaz86IFNlY3VyaXR5U3RhY2s7IC8vIOOCu+OCreODpeODquODhuOCo+OCueOCv+ODg+OCr++8iOOCquODl+OCt+ODp+ODs++8iVxuICByZWFkb25seSBkYXRhU3RhY2s/OiBEYXRhU3RhY2s7IC8vIOODh+ODvOOCv+OCueOCv+ODg+OCr++8iOOCquODl+OCt+ODp+ODs++8iVxuICByZWFkb25seSBlbWJlZGRpbmdTdGFjaz86IEVtYmVkZGluZ1N0YWNrOyAvLyBFbWJlZGRpbmfjgrnjgr/jg4Pjgq/vvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgcmVhZG9ubHkgd2ViQXBwU3RhY2s/OiBXZWJBcHBTdGFjazsgLy8gV2ViQXBw44K544K/44OD44Kv77yI44Kq44OX44K344On44Oz77yJXG4gIHJlYWRvbmx5IG5hbWluZ0dlbmVyYXRvcj86IGFueTsgLy8gQWdlbnQgU3RlZXJpbmfmupbmi6Dlkb3lkI3jgrjjgqfjg43jg6zjg7zjgr/jg7zvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgcmVhZG9ubHkgcHJvamVjdE5hbWU6IHN0cmluZzsgLy8g44OX44Ot44K444Kn44Kv44OI5ZCN77yI44Kz44K544OI6YWN5biD55So77yJXG4gIHJlYWRvbmx5IGVudmlyb25tZW50OiBzdHJpbmc7IC8vIOeSsOWig+WQje+8iOOCs+OCueODiOmFjeW4g+eUqO+8iVxuICBcbiAgLy8gUGhhc2UgNDogQWdlbnRDb3Jl6Kit5a6aXG4gIHJlYWRvbmx5IGFnZW50Q29yZT86IEFnZW50Q29yZUNvbmZpZztcbn1cblxuLyoqXG4gKiDntbHlkIjpgYvnlKjjg7vjgqjjg7Pjgr/jg7zjg5fjg6njgqTjgrrjgrnjgr/jg4Pjgq/vvIjjg6Ljgrjjg6Xjg6njg7zjgqLjg7zjgq3jg4bjgq/jg4Hjg6Plr77lv5zvvIlcbiAqIFxuICog57Wx5ZCI55uj6KaW44O744Ko44Oz44K/44O844OX44Op44Kk44K644Kz44Oz44K544OI44Op44Kv44OI44Gr44KI44KL5LiA5YWD566h55CGXG4gKiDlgIvliKXjgrnjgr/jg4Pjgq/jg4fjg5fjg63jgqTlrozlhajlr77lv5xcbiAqL1xuZXhwb3J0IGNsYXNzIE9wZXJhdGlvbnNTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIC8qKiDntbHlkIjnm6PoppbjgrPjg7Pjgrnjg4jjg6njgq/jg4ggKi9cbiAgcHVibGljIHJlYWRvbmx5IG1vbml0b3Jpbmc6IE1vbml0b3JpbmdDb25zdHJ1Y3Q7XG4gIFxuICAvKiog57Wx5ZCI44Ko44Oz44K/44O844OX44Op44Kk44K644Kz44Oz44K544OI44Op44Kv44OIICovXG4gIHB1YmxpYyByZWFkb25seSBlbnRlcnByaXNlOiBFbnRlcnByaXNlQ29uc3RydWN0O1xuICBcbiAgLyoqIENsb3VkV2F0Y2jjg4Djg4Pjgrfjg6Xjg5zjg7zjg4lVUkzvvIjku5bjgrnjgr/jg4Pjgq/jgYvjgonjga7lj4LnhafnlKjvvIkgKi9cbiAgcHVibGljIHJlYWRvbmx5IGRhc2hib2FyZFVybD86IHN0cmluZztcbiAgXG4gIC8qKiBTTlPjg4jjg5Tjg4Pjgq9BUk7vvIjku5bjgrnjgr/jg4Pjgq/jgYvjgonjga7lj4LnhafnlKjvvIkgKi9cbiAgcHVibGljIHJlYWRvbmx5IHNuc1RvcGljQXJuczogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9O1xuICBcbiAgLyoqIFBoYXNlIDQ6IEFnZW50Q29yZSBDb25zdHJ1Y3Rz77yI44Kq44OX44K344On44Oz77yJICovXG4gIHB1YmxpYyBhZ2VudENvcmVPYnNlcnZhYmlsaXR5PzogQmVkcm9ja0FnZW50Q29yZU9ic2VydmFiaWxpdHlDb25zdHJ1Y3Q7XG4gIHB1YmxpYyBhZ2VudENvcmVFdmFsdWF0aW9ucz86IEJlZHJvY2tBZ2VudENvcmVFdmFsdWF0aW9uc0NvbnN0cnVjdDtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogT3BlcmF0aW9uc1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnNvbGUubG9nKCfwn5OKIE9wZXJhdGlvbnNTdGFja+WIneacn+WMlumWi+Wniy4uLicpO1xuICAgIGNvbnNvbGUubG9nKCfwn5OdIOOCueOCv+ODg+OCr+WQjTonLCBpZCk7XG4gICAgY29uc29sZS5sb2coJ/Cfj7fvuI8gQWdlbnQgU3RlZXJpbmfmupbmi6A6JywgcHJvcHMubmFtaW5nR2VuZXJhdG9yID8gJ1llcycgOiAnTm8nKTtcblxuICAgIC8vIOOCs+OCueODiOmFjeW4g+OCv+OCsOOBrumBqeeUqFxuICAgIGNvbnN0IHRhZ2dpbmdDb25maWcgPSBQZXJtaXNzaW9uQXdhcmVSQUdUYWdzLmdldFN0YW5kYXJkQ29uZmlnKFxuICAgICAgcHJvcHMucHJvamVjdE5hbWUsXG4gICAgICBwcm9wcy5lbnZpcm9ubWVudCBhcyBcImRldlwiIHwgXCJzdGFnaW5nXCIgfCBcInByb2RcIlxuICAgICk7XG4gICAgVGFnZ2luZ1N0cmF0ZWd5LmFwcGx5VGFnc1RvU3RhY2sodGhpcywgdGFnZ2luZ0NvbmZpZyk7XG5cbiAgICAvLyDkvp3lrZjjgrnjgr/jg4Pjgq/jgajjga7kvp3lrZjplqLkv4LoqK3lrprvvIjlrZjlnKjjgZnjgovloLTlkIjvvIlcbiAgICBpZiAocHJvcHMuc2VjdXJpdHlTdGFjaykge1xuICAgICAgdGhpcy5hZGREZXBlbmRlbmN5KHByb3BzLnNlY3VyaXR5U3RhY2spO1xuICAgICAgY29uc29sZS5sb2coJ/CflJcgU2VjdXJpdHlTdGFja+OBqOOBruS+neWtmOmWouS/guioreWumuWujOS6hicpO1xuICAgIH1cbiAgICBpZiAocHJvcHMuZGF0YVN0YWNrKSB7XG4gICAgICB0aGlzLmFkZERlcGVuZGVuY3kocHJvcHMuZGF0YVN0YWNrKTtcbiAgICAgIGNvbnNvbGUubG9nKCfwn5SXIERhdGFTdGFja+OBqOOBruS+neWtmOmWouS/guioreWumuWujOS6hicpO1xuICAgIH1cbiAgICBpZiAocHJvcHMuZW1iZWRkaW5nU3RhY2spIHtcbiAgICAgIHRoaXMuYWRkRGVwZW5kZW5jeShwcm9wcy5lbWJlZGRpbmdTdGFjayk7XG4gICAgICBjb25zb2xlLmxvZygn8J+UlyBFbWJlZGRpbmdTdGFja+OBqOOBruS+neWtmOmWouS/guioreWumuWujOS6hicpO1xuICAgIH1cbiAgICBpZiAocHJvcHMud2ViQXBwU3RhY2spIHtcbiAgICAgIHRoaXMuYWRkRGVwZW5kZW5jeShwcm9wcy53ZWJBcHBTdGFjayk7XG4gICAgICBjb25zb2xlLmxvZygn8J+UlyBXZWJBcHBTdGFja+OBqOOBruS+neWtmOmWouS/guioreWumuWujOS6hicpO1xuICAgIH1cblxuICAgIC8vIOe1seWQiOebo+imluOCs+ODs+OCueODiOODqeOCr+ODiOS9nOaIkFxuICAgIHRoaXMubW9uaXRvcmluZyA9IG5ldyBNb25pdG9yaW5nQ29uc3RydWN0KHRoaXMsICdNb25pdG9yaW5nJywge1xuICAgICAgY29uZmlnOiBwcm9wcy5jb25maWcubW9uaXRvcmluZyB8fCB7fSxcbiAgICAgIHByb2plY3ROYW1lOiBwcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgIGVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICB9KTtcblxuICAgIC8vIOe1seWQiOOCqOODs+OCv+ODvOODl+ODqeOCpOOCuuOCs+ODs+OCueODiOODqeOCr+ODiOS9nOaIkFxuICAgIHRoaXMuZW50ZXJwcmlzZSA9IG5ldyBFbnRlcnByaXNlQ29uc3RydWN0KHRoaXMsICdFbnRlcnByaXNlJywge1xuICAgICAgY29uZmlnOiBwcm9wcy5jb25maWcuZW50ZXJwcmlzZSxcbiAgICAgIC8vIGVudmlyb25tZW50OiBwcm9wcy5jb25maWcuZW52aXJvbm1lbnQsIC8vIOODl+ODreODkeODhuOCo+OBjOWtmOWcqOOBl+OBquOBhOOBn+OCgeOCs+ODoeODs+ODiOOCouOCpuODiFxuICAgICAgLy8ga21zS2V5OiBwcm9wcy5zZWN1cml0eVN0YWNrPy5rbXNLZXksIC8vIOODl+ODreODkeODhuOCo+OBjOWtmOWcqOOBl+OBquOBhOOBn+OCgeOCs+ODoeODs+ODiOOCouOCpuODiFxuICAgICAgLy8gY29nbml0b1VzZXJQb29sSWQ6IHByb3BzLndlYkFwcFN0YWNrPy5jb2duaXRvVXNlclBvb2xJZCwgLy8g44OX44Ot44OR44OG44Kj44GM5a2Y5Zyo44GX44Gq44GE44Gf44KB44Kz44Oh44Oz44OI44Ki44Km44OIXG4gICAgICAvLyBuYW1pbmdHZW5lcmF0b3I6IHByb3BzLm5hbWluZ0dlbmVyYXRvciwgLy8g44OX44Ot44OR44OG44Kj44GM5a2Y5Zyo44GX44Gq44GE44Gf44KB44Kz44Oh44Oz44OI44Ki44Km44OIXG4gICAgfSk7XG5cbiAgICAvLyBQaGFzZSA0OiBBZ2VudENvcmUgQ29uc3RydWN0c+e1seWQiO+8iOOCquODl+OCt+ODp+ODs++8iVxuICAgIGlmIChwcm9wcy5hZ2VudENvcmUgfHwgcHJvcHMuY29uZmlnLmFnZW50Q29yZSkge1xuICAgICAgY29uc29sZS5sb2coJycpO1xuICAgICAgY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbiAgICAgIGNvbnNvbGUubG9nKCfwn5qAIEFnZW50Q29yZSBDb25zdHJ1Y3Rz57Wx5ZCI6ZaL5aeLLi4uJyk7XG4gICAgICBjb25zb2xlLmxvZygnPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PScpO1xuICAgICAgXG4gICAgICB0aGlzLmludGVncmF0ZUFnZW50Q29yZUNvbnN0cnVjdHMocHJvcHMpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZygn4pyFIEFnZW50Q29yZSBDb25zdHJ1Y3Rz57Wx5ZCI5a6M5LqGJyk7XG4gICAgfVxuXG4gICAgLy8g5LuW44K544K/44OD44Kv44GL44KJ44Gu5Y+C54Wn55So44OX44Ot44OR44OG44Kj6Kit5a6aXG4gICAgdGhpcy5zZXR1cENyb3NzU3RhY2tSZWZlcmVuY2VzKCk7XG5cbiAgICAvLyDjgrnjgr/jg4Pjgq/lh7rliptcbiAgICB0aGlzLmNyZWF0ZU91dHB1dHMoKTtcblxuICAgIC8vIOOCv+OCsOioreWumlxuICAgIHRoaXMuYWRkU3RhY2tUYWdzKCk7XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIE9wZXJhdGlvbnNTdGFja+WIneacn+WMluWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIOS7luOCueOCv+ODg+OCr+OBi+OCieOBruWPgueFp+eUqOODl+ODreODkeODhuOCo+ioreWumlxuICAgKi9cbiAgcHJpdmF0ZSBzZXR1cENyb3NzU3RhY2tSZWZlcmVuY2VzKCk6IHZvaWQge1xuICAgIC8vIENsb3VkV2F0Y2jjg4Djg4Pjgrfjg6Xjg5zjg7zjg4lVUkzjga7oqK3lrprvvIjlrZjlnKjjgZnjgovloLTlkIjvvIlcbiAgICAvLyBpZiAodGhpcy5tb25pdG9yaW5nLm91dHB1dHM/LmRhc2hib2FyZFVybCkge1xuICAgIC8vICAgdGhpcy5kYXNoYm9hcmRVcmwgPSB0aGlzLm1vbml0b3Jpbmcub3V0cHV0cy5kYXNoYm9hcmRVcmw7XG4gICAgLy8gfVxuXG4gICAgLy8gU05T44OI44OU44OD44KvQVJO44Gu6Kit5a6a77yI5a2Y5Zyo44GZ44KL5aC05ZCI77yJXG4gICAgLy8gaWYgKHRoaXMubW9uaXRvcmluZy5vdXRwdXRzPy5zbnNUb3BpY3MpIHtcbiAgICAvLyAgIE9iamVjdC5lbnRyaWVzKHRoaXMubW9uaXRvcmluZy5vdXRwdXRzLnNuc1RvcGljcykuZm9yRWFjaCgoW25hbWUsIHRvcGljXSkgPT4ge1xuICAgIC8vICAgICBpZiAodG9waWMgJiYgdHlwZW9mIHRvcGljID09PSAnb2JqZWN0JyAmJiAndG9waWNBcm4nIGluIHRvcGljKSB7XG4gICAgLy8gICAgICAgdGhpcy5zbnNUb3BpY0FybnNbbmFtZV0gPSB0b3BpYy50b3BpY0FybjtcbiAgICAvLyAgICAgfVxuICAgIC8vICAgfSk7XG4gICAgLy8gfVxuXG4gICAgY29uc29sZS5sb2coJ/CflJcg5LuW44K544K/44OD44Kv5Y+C54Wn55So44OX44Ot44OR44OG44Kj6Kit5a6a5a6M5LqGJyk7XG4gIH1cblxuICAvKipcbiAgICog44K544K/44OD44Kv5Ye65Yqb5L2c5oiQ77yI5YCL5Yil44OH44OX44Ot44Kk5a++5b+c77yJXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZU91dHB1dHMoKTogdm9pZCB7XG4gICAgLy8gQ2xvdWRXYXRjaOODgOODg+OCt+ODpeODnOODvOODiVVSTOWHuuWKm++8iOWtmOWcqOOBmeOCi+WgtOWQiOOBruOBv++8iVxuICAgIGlmICh0aGlzLmRhc2hib2FyZFVybCkge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Rhc2hib2FyZFVybCcsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuZGFzaGJvYXJkVXJsLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkV2F0Y2ggRGFzaGJvYXJkIFVSTCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1EYXNoYm9hcmRVcmxgLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gU05T44OI44OU44OD44KvQVJO5Ye65Yqb77yI5LuW44K544K/44OD44Kv44GL44KJ44Gu5Y+C54Wn55So77yJXG4gICAgT2JqZWN0LmVudHJpZXModGhpcy5zbnNUb3BpY0FybnMpLmZvckVhY2goKFtuYW1lLCB0b3BpY0Fybl0pID0+IHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBTbnNUb3BpYyR7bmFtZX1Bcm5gLCB7XG4gICAgICAgIHZhbHVlOiB0b3BpY0FybixcbiAgICAgICAgZGVzY3JpcHRpb246IGBTTlMgJHtuYW1lfSBUb3BpYyBBUk5gLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tU25zVG9waWMke25hbWV9QXJuYCxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgLy8g55uj6KaW57Wx5ZCI5Ye65Yqb77yI5a2Y5Zyo44GZ44KL5aC05ZCI44Gu44G/77yJXG4gICAgLy8gaWYgKHRoaXMubW9uaXRvcmluZy5vdXRwdXRzKSB7XG4gICAgLy8gICAvLyBYLVJheSBUcmFjZSBVUkxcbiAgICAvLyAgIGlmICh0aGlzLm1vbml0b3Jpbmcub3V0cHV0cy54cmF5VHJhY2VVcmwpIHtcbiAgICAvLyAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1hSYXlUcmFjZVVybCcsIHtcbiAgICAvLyAgICAgICB2YWx1ZTogdGhpcy5tb25pdG9yaW5nLm91dHB1dHMueHJheVRyYWNlVXJsLFxuICAgIC8vICAgICAgIGRlc2NyaXB0aW9uOiAnWC1SYXkgVHJhY2UgVVJMJyxcbiAgICAvLyAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tWFJheVRyYWNlVXJsYCxcbiAgICAvLyAgICAgfSk7XG4gICAgLy8gICB9XG5cbiAgICAvLyAgIC8vIExvZyBHcm91cCBOYW1lc1xuICAgIC8vICAgaWYgKHRoaXMubW9uaXRvcmluZy5vdXRwdXRzLmxvZ0dyb3VwTmFtZXMpIHtcbiAgICAvLyAgICAgT2JqZWN0LmVudHJpZXModGhpcy5tb25pdG9yaW5nLm91dHB1dHMubG9nR3JvdXBOYW1lcykuZm9yRWFjaCgoW25hbWUsIGxvZ0dyb3VwTmFtZV0pID0+IHtcbiAgICAvLyAgICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgTG9nR3JvdXAke25hbWV9TmFtZWAsIHtcbiAgICAvLyAgICAgICAgIHZhbHVlOiBsb2dHcm91cE5hbWUsXG4gICAgLy8gICAgICAgICBkZXNjcmlwdGlvbjogYENsb3VkV2F0Y2ggTG9nIEdyb3VwICR7bmFtZX0gTmFtZWAsXG4gICAgLy8gICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tTG9nR3JvdXAke25hbWV9TmFtZWAsXG4gICAgLy8gICAgICAgfSk7XG4gICAgLy8gICAgIH0pO1xuICAgIC8vICAgfVxuICAgIC8vIH1cblxuICAgIC8vIOOCqOODs+OCv+ODvOODl+ODqeOCpOOCuue1seWQiOWHuuWKm++8iOWtmOWcqOOBmeOCi+WgtOWQiOOBruOBv++8iVxuICAgIC8vIGlmICh0aGlzLmVudGVycHJpc2Uub3V0cHV0cykge1xuICAgIC8vICAgLy8gQkkgRGFzaGJvYXJkIFVSTFxuICAgIC8vICAgaWYgKHRoaXMuZW50ZXJwcmlzZS5vdXRwdXRzLmJpRGFzaGJvYXJkVXJsKSB7XG4gICAgLy8gICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdCaURhc2hib2FyZFVybCcsIHtcbiAgICAvLyAgICAgICB2YWx1ZTogdGhpcy5lbnRlcnByaXNlLm91dHB1dHMuYmlEYXNoYm9hcmRVcmwsXG4gICAgLy8gICAgICAgZGVzY3JpcHRpb246ICdCSSBBbmFseXRpY3MgRGFzaGJvYXJkIFVSTCcsXG4gICAgLy8gICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUJpRGFzaGJvYXJkVXJsYCxcbiAgICAvLyAgICAgfSk7XG4gICAgLy8gICB9XG5cbiAgICAvLyAgIC8vIE9yZ2FuaXphdGlvbiBNYW5hZ2VtZW50IENvbnNvbGUgVVJMXG4gICAgLy8gICBpZiAodGhpcy5lbnRlcnByaXNlLm91dHB1dHMub3JnYW5pemF0aW9uQ29uc29sZVVybCkge1xuICAgIC8vICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnT3JnYW5pemF0aW9uQ29uc29sZVVybCcsIHtcbiAgICAvLyAgICAgICB2YWx1ZTogdGhpcy5lbnRlcnByaXNlLm91dHB1dHMub3JnYW5pemF0aW9uQ29uc29sZVVybCxcbiAgICAvLyAgICAgICBkZXNjcmlwdGlvbjogJ09yZ2FuaXphdGlvbiBNYW5hZ2VtZW50IENvbnNvbGUgVVJMJyxcbiAgICAvLyAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tT3JnYW5pemF0aW9uQ29uc29sZVVybGAsXG4gICAgLy8gICAgIH0pO1xuICAgIC8vICAgfVxuICAgIC8vIH1cblxuICAgIGNvbnNvbGUubG9nKCfwn5OkIE9wZXJhdGlvbnNTdGFja+WHuuWKm+WApOS9nOaIkOWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCueOCv+ODg+OCr+OCv+OCsOioreWumu+8iOe1seS4gOOBleOCjOOBn+OCv+OCsOaIpueVpeS9v+eUqO+8iVxuICAgKi9cbiAgcHJpdmF0ZSBhZGRTdGFja1RhZ3MoKTogdm9pZCB7XG4gICAgLy8g57Wx5LiA44GV44KM44Gf44K/44Kw5oim55Wl44KS5L2/55SoXG4gICAgY29uc3QgdGFnZ2luZ0NvbmZpZyA9IFBlcm1pc3Npb25Bd2FyZVJBR1RhZ3MuZ2V0U3RhbmRhcmRDb25maWcoXG4gICAgICB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dCgncHJvamVjdE5hbWUnKSB8fCAncGVybWlzc2lvbi1hd2FyZS1yYWcnLFxuICAgICAgdGhpcy5ub2RlLnRyeUdldENvbnRleHQoJ2Vudmlyb25tZW50JykgfHwgJ2RldidcbiAgICApO1xuICAgIFxuICAgIC8vIOeSsOWig+WbuuacieOBruOCv+OCsOioreWumuOCkui/veWKoFxuICAgIGNvbnN0IGVudmlyb25tZW50Q29uZmlnID0gUGVybWlzc2lvbkF3YXJlUkFHVGFncy5nZXRFbnZpcm9ubWVudENvbmZpZyhcbiAgICAgIHRoaXMubm9kZS50cnlHZXRDb250ZXh0KCdlbnZpcm9ubWVudCcpIHx8ICdkZXYnXG4gICAgKTtcbiAgICBcbiAgICAvLyDjgr/jgrDmiKbnlaXjgpLpgannlKhcbiAgICBUYWdnaW5nU3RyYXRlZ3kuYXBwbHlUYWdzVG9TdGFjayh0aGlzLCB7XG4gICAgICAuLi50YWdnaW5nQ29uZmlnLFxuICAgICAgLi4uZW52aXJvbm1lbnRDb25maWcsXG4gICAgICBjdXN0b21UYWdzOiB7XG4gICAgICAgIC4uLnRhZ2dpbmdDb25maWcuY3VzdG9tVGFncyxcbiAgICAgICAgLi4uZW52aXJvbm1lbnRDb25maWcuY3VzdG9tVGFncyxcbiAgICAgICAgJ01vZHVsZSc6ICdNb25pdG9yaW5nK0VudGVycHJpc2UnLFxuICAgICAgICAnU3RhY2tUeXBlJzogJ0ludGVncmF0ZWQnLFxuICAgICAgICAnQXJjaGl0ZWN0dXJlJzogJ01vZHVsYXInLFxuICAgICAgICAnTW9uaXRvcmluZ1NlcnZpY2VzJzogJ0Nsb3VkV2F0Y2grWC1SYXkrU05TJyxcbiAgICAgICAgJ0VudGVycHJpc2VGZWF0dXJlcyc6ICdCSStPcmdhbml6YXRpb24rQWNjZXNzQ29udHJvbCcsXG4gICAgICAgICdJbmRpdmlkdWFsRGVwbG95U3VwcG9ydCc6ICdZZXMnXG4gICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgY29uc29sZS5sb2coJ/Cfj7fvuI8gT3BlcmF0aW9uc1N0YWNr44K/44Kw6Kit5a6a5a6M5LqG77yI57Wx5LiA5oim55Wl5L2/55So77yJJyk7XG4gIH1cblxuICAvKipcbiAgICogQWdlbnRDb3JlIENvbnN0cnVjdHPntbHlkIjvvIhQaGFzZSA077yJXG4gICAqL1xuICBwcml2YXRlIGludGVncmF0ZUFnZW50Q29yZUNvbnN0cnVjdHMocHJvcHM6IE9wZXJhdGlvbnNTdGFja1Byb3BzKTogdm9pZCB7XG4gICAgY29uc3QgYWdlbnRDb3JlQ29uZmlnID0gcHJvcHMuYWdlbnRDb3JlIHx8IHByb3BzLmNvbmZpZy5hZ2VudENvcmU7XG4gICAgaWYgKCFhZ2VudENvcmVDb25maWcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyAxLiBPYnNlcnZhYmlsaXR5IENvbnN0cnVjdO+8iOebo+imluODu+ODiOODrOODvOOCt+ODs+OCsO+8iVxuICAgIGlmIChhZ2VudENvcmVDb25maWcub2JzZXJ2YWJpbGl0eT8uZW5hYmxlZCkge1xuICAgICAgY29uc29sZS5sb2coJ/Cfk4ogT2JzZXJ2YWJpbGl0eSBDb25zdHJ1Y3TkvZzmiJDkuK0uLi4nKTtcbiAgICAgIHRoaXMuYWdlbnRDb3JlT2JzZXJ2YWJpbGl0eSA9IG5ldyBCZWRyb2NrQWdlbnRDb3JlT2JzZXJ2YWJpbGl0eUNvbnN0cnVjdCh0aGlzLCAnQWdlbnRDb3JlT2JzZXJ2YWJpbGl0eScsIHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgcHJvamVjdE5hbWU6IHByb3BzLnByb2plY3ROYW1lLFxuICAgICAgICBlbnZpcm9ubWVudDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICAgIGNsb3Vkd2F0Y2hDb25maWc6IGFnZW50Q29yZUNvbmZpZy5vYnNlcnZhYmlsaXR5LmNsb3Vkd2F0Y2hDb25maWcsXG4gICAgICAgIHhyYXlDb25maWc6IGFnZW50Q29yZUNvbmZpZy5vYnNlcnZhYmlsaXR5LnhyYXlDb25maWcsXG4gICAgICAgIGVycm9yVHJhY2tpbmdDb25maWc6IGFnZW50Q29yZUNvbmZpZy5vYnNlcnZhYmlsaXR5LmVycm9yVHJhY2tpbmdDb25maWcsXG4gICAgICB9KTtcbiAgICAgIGNvbnNvbGUubG9nKCfinIUgT2JzZXJ2YWJpbGl0eSBDb25zdHJ1Y3TkvZzmiJDlrozkuoYnKTtcbiAgICB9XG5cbiAgICAvLyAyLiBFdmFsdWF0aW9ucyBDb25zdHJ1Y3TvvIjoqZXkvqHjg7vjg4bjgrnjg4jvvIlcbiAgICBpZiAoYWdlbnRDb3JlQ29uZmlnLmV2YWx1YXRpb25zPy5lbmFibGVkKSB7XG4gICAgICBjb25zb2xlLmxvZygn8J+nqiBFdmFsdWF0aW9ucyBDb25zdHJ1Y3TkvZzmiJDkuK0uLi4nKTtcbiAgICAgIHRoaXMuYWdlbnRDb3JlRXZhbHVhdGlvbnMgPSBuZXcgQmVkcm9ja0FnZW50Q29yZUV2YWx1YXRpb25zQ29uc3RydWN0KHRoaXMsICdBZ2VudENvcmVFdmFsdWF0aW9ucycsIHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgcHJvamVjdE5hbWU6IHByb3BzLnByb2plY3ROYW1lLFxuICAgICAgICBlbnZpcm9ubWVudDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICAgIHF1YWxpdHlNZXRyaWNzQ29uZmlnOiBhZ2VudENvcmVDb25maWcuZXZhbHVhdGlvbnMucXVhbGl0eU1ldHJpY3NDb25maWcsXG4gICAgICAgIGFiVGVzdENvbmZpZzogYWdlbnRDb3JlQ29uZmlnLmV2YWx1YXRpb25zLmFiVGVzdENvbmZpZyxcbiAgICAgIH0pO1xuICAgICAgY29uc29sZS5sb2coJ+KchSBFdmFsdWF0aW9ucyBDb25zdHJ1Y3TkvZzmiJDlrozkuoYnKTtcbiAgICB9XG5cbiAgICAvLyBDbG91ZEZvcm1hdGlvbiBPdXRwdXRzXG4gICAgdGhpcy5jcmVhdGVBZ2VudENvcmVPdXRwdXRzKCk7XG4gIH1cblxuICAvKipcbiAgICogQWdlbnRDb3JlIENsb3VkRm9ybWF0aW9uIE91dHB1dHPjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQWdlbnRDb3JlT3V0cHV0cygpOiB2b2lkIHtcbiAgICBjb25zb2xlLmxvZygn8J+TpCBBZ2VudENvcmUgT3V0cHV0c+S9nOaIkOS4rS4uLicpO1xuXG4gICAgLy8gT2JzZXJ2YWJpbGl0eSBPdXRwdXRzXG4gICAgaWYgKHRoaXMuYWdlbnRDb3JlT2JzZXJ2YWJpbGl0eT8uZGFzaGJvYXJkKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWdlbnRDb3JlT2JzZXJ2YWJpbGl0eURhc2hib2FyZE5hbWUnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmFnZW50Q29yZU9ic2VydmFiaWxpdHkuZGFzaGJvYXJkLmRhc2hib2FyZE5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIE9ic2VydmFiaWxpdHkgRGFzaGJvYXJkIE5hbWUnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQWdlbnRDb3JlT2JzZXJ2YWJpbGl0eURhc2hib2FyZE5hbWVgLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuYWdlbnRDb3JlT2JzZXJ2YWJpbGl0eT8ubG9nR3JvdXApIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBZ2VudENvcmVPYnNlcnZhYmlsaXR5TG9nR3JvdXBOYW1lJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudENvcmVPYnNlcnZhYmlsaXR5LmxvZ0dyb3VwLmxvZ0dyb3VwTmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgT2JzZXJ2YWJpbGl0eSBMb2cgR3JvdXAgTmFtZScsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BZ2VudENvcmVPYnNlcnZhYmlsaXR5TG9nR3JvdXBOYW1lYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEV2YWx1YXRpb25zIE91dHB1dHNcbiAgICBpZiAodGhpcy5hZ2VudENvcmVFdmFsdWF0aW9ucz8ucmVzdWx0c1RhYmxlKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWdlbnRDb3JlRXZhbHVhdGlvbnNSZXN1bHRzVGFibGVOYW1lJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudENvcmVFdmFsdWF0aW9ucy5yZXN1bHRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0FnZW50Q29yZSBFdmFsdWF0aW9ucyBSZXN1bHRzIFRhYmxlIE5hbWUnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQWdlbnRDb3JlRXZhbHVhdGlvbnNSZXN1bHRzVGFibGVOYW1lYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmFnZW50Q29yZUV2YWx1YXRpb25zPy5kYXNoYm9hcmQpIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBZ2VudENvcmVFdmFsdWF0aW9uc0Rhc2hib2FyZE5hbWUnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmFnZW50Q29yZUV2YWx1YXRpb25zLmRhc2hib2FyZC5kYXNoYm9hcmROYW1lLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0FnZW50Q29yZSBFdmFsdWF0aW9ucyBEYXNoYm9hcmQgTmFtZScsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BZ2VudENvcmVFdmFsdWF0aW9uc0Rhc2hib2FyZE5hbWVgLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ+KchSBBZ2VudENvcmUgT3V0cHV0c+S9nOaIkOWujOS6hicpO1xuICB9XG59Il19