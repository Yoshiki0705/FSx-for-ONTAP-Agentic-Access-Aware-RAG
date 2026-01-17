/**
 * OperationsStack - 統合運用・エンタープライズスタック（モジュラーアーキテクチャ対応）
 * 
 * 機能:
 * - 統合監視・エンタープライズコンストラクトによる一元管理
 * - CloudWatch・X-Ray・SNS・BI・組織管理の統合
 * - Agent Steering準拠命名規則対応
 * - 個別スタックデプロイ完全対応
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

// 統合監視コンストラクト（モジュラーアーキテクチャ）
import { MonitoringConstruct } from '../../modules/monitoring/constructs/monitoring-construct';

// 統合エンタープライズコンストラクト（モジュラーアーキテクチャ）
import { EnterpriseConstruct } from '../../modules/enterprise/constructs/enterprise-construct';

// インターフェース
import { MonitoringConfig } from '../../modules/monitoring/interfaces/monitoring-config';

// 他スタックからの依存関係
import { SecurityStack } from './security-stack';
import { DataStack } from './data-stack';
import { EmbeddingStack } from './embedding-stack';
import { WebAppStack } from './webapp-stack';

// タグ設定
import { TaggingStrategy, PermissionAwareRAGTags } from '../../config/tagging-config';

// Phase 4: AgentCore Constructs統合
import { BedrockAgentCoreObservabilityConstruct } from '../../modules/ai/constructs/bedrock-agent-core-observability-construct';
import { BedrockAgentCoreEvaluationsConstruct } from '../../modules/ai/constructs/bedrock-agent-core-evaluations-construct';
import { AgentCoreConfig } from '../../../types/agentcore-config';

export interface OperationsStackProps extends cdk.StackProps {
  readonly config: any; // 統合設定オブジェクト
  readonly securityStack?: SecurityStack; // セキュリティスタック（オプション）
  readonly dataStack?: DataStack; // データスタック（オプション）
  readonly embeddingStack?: EmbeddingStack; // Embeddingスタック（オプション）
  readonly webAppStack?: WebAppStack; // WebAppスタック（オプション）
  readonly namingGenerator?: any; // Agent Steering準拠命名ジェネレーター（オプション）
  readonly projectName: string; // プロジェクト名（コスト配布用）
  readonly environment: string; // 環境名（コスト配布用）
  
  // Phase 4: AgentCore設定
  readonly agentCore?: AgentCoreConfig;
}

/**
 * 統合運用・エンタープライズスタック（モジュラーアーキテクチャ対応）
 * 
 * 統合監視・エンタープライズコンストラクトによる一元管理
 * 個別スタックデプロイ完全対応
 */
export class OperationsStack extends cdk.Stack {
  /** 統合監視コンストラクト */
  public readonly monitoring: MonitoringConstruct;
  
  /** 統合エンタープライズコンストラクト */
  public readonly enterprise: EnterpriseConstruct;
  
  /** CloudWatchダッシュボードURL（他スタックからの参照用） */
  public readonly dashboardUrl?: string;
  
  /** SNSトピックARN（他スタックからの参照用） */
  public readonly snsTopicArns: { [key: string]: string } = {};
  
  /** Phase 4: AgentCore Constructs（オプション） */
  public agentCoreObservability?: BedrockAgentCoreObservabilityConstruct;
  public agentCoreEvaluations?: BedrockAgentCoreEvaluationsConstruct;

  constructor(scope: Construct, id: string, props: OperationsStackProps) {
    super(scope, id, props);

    console.log('📊 OperationsStack初期化開始...');
    console.log('📝 スタック名:', id);
    console.log('🏷️ Agent Steering準拠:', props.namingGenerator ? 'Yes' : 'No');

    // コスト配布タグの適用
    const taggingConfig = PermissionAwareRAGTags.getStandardConfig(
      props.projectName,
      props.environment as "dev" | "staging" | "prod"
    );
    TaggingStrategy.applyTagsToStack(this, taggingConfig);

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
    this.monitoring = new MonitoringConstruct(this, 'Monitoring', {
      config: props.config.monitoring || {},
      projectName: props.projectName,
      environment: props.environment,
    });

    // 統合エンタープライズコンストラクト作成
    this.enterprise = new EnterpriseConstruct(this, 'Enterprise', {
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
  private setupCrossStackReferences(): void {
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
  private createOutputs(): void {
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
  private addStackTags(): void {
    // 統一されたタグ戦略を使用
    const taggingConfig = PermissionAwareRAGTags.getStandardConfig(
      this.node.tryGetContext('projectName') || 'permission-aware-rag',
      this.node.tryGetContext('environment') || 'dev'
    );
    
    // 環境固有のタグ設定を追加
    const environmentConfig = PermissionAwareRAGTags.getEnvironmentConfig(
      this.node.tryGetContext('environment') || 'dev'
    );
    
    // タグ戦略を適用
    TaggingStrategy.applyTagsToStack(this, {
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
  private integrateAgentCoreConstructs(props: OperationsStackProps): void {
    const agentCoreConfig = props.agentCore || props.config.agentCore;
    if (!agentCoreConfig) {
      return;
    }

    // 1. Observability Construct（監視・トレーシング）
    if (agentCoreConfig.observability?.enabled) {
      console.log('📊 Observability Construct作成中...');
      this.agentCoreObservability = new BedrockAgentCoreObservabilityConstruct(this, 'AgentCoreObservability', {
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
      this.agentCoreEvaluations = new BedrockAgentCoreEvaluationsConstruct(this, 'AgentCoreEvaluations', {
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
  private createAgentCoreOutputs(): void {
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