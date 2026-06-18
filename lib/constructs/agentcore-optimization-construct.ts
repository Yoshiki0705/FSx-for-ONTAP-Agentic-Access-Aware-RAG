/**
 * AgentCore Optimization Construct
 *
 * AWS Summit NY 2026: AgentCore Optimization（Preview）による
 * エージェント品質の継続的改善ループを構築する。
 *
 * 機能:
 * - Configuration Bundle: エージェント設定（system prompt, model ID, tool descriptions）の
 *   バージョン管理。コード再デプロイなしで行動変更可能。
 * - Recommendations: 本番トレースを分析し、system prompt / tool descriptions の改善案を自動生成。
 * - A/B Testing: Gateway 経由のトラフィック分割で、改善案を統計的有意性をもって検証。
 *
 * Prerequisites:
 * - AgentCore Gateway（enableAgentCoreGateway=true）
 * - CloudWatch Transaction Search 有効化
 * - エージェントセッションのテレメトリデータ
 *
 * @see https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/optimization.html
 */

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface AgentCoreOptimizationConstructProps {
  /** プロジェクト名 */
  projectName: string;
  /** 環境名 */
  environment: string;
  /** AgentCore Gateway ARN（A/B テスト用） */
  gatewayArn: string;
  /** AgentCore Gateway ID（A/B テスト用） */
  gatewayId: string;
  /**
   * 初期 Configuration Bundle の内容。
   * system prompt、model ID、tool descriptions を含む。
   */
  initialConfig: {
    /** RAG system prompt（permission-aware） */
    systemPrompt: string;
    /** 使用するモデル ID */
    modelId: string;
    /** ツール説明（各ツール名→説明のマップ） */
    toolDescriptions?: Record<string, string>;
  };
  /**
   * AgentCore Runtime ARN（Configuration Bundle のコンポーネントキー）。
   * 指定しない場合は Gateway ARN をキーとして使用。
   */
  runtimeArn?: string;
}

export class AgentCoreOptimizationConstruct extends Construct {
  /** Configuration Bundle 名 */
  public readonly configBundleName: string;
  /** Optimization IAM ロール ARN（Recommendations / A/B Tests 実行用） */
  public readonly optimizationRoleArn: string;

  constructor(scope: Construct, id: string, props: AgentCoreOptimizationConstructProps) {
    super(scope, id);

    const { projectName, environment, gatewayArn, gatewayId } = props;
    const prefix = `${projectName}-${environment}`;
    this.configBundleName = `${prefix.replace(/-/g, '_')}_agent_config`;

    // ─── IAM Role for Optimization Operations ─────────────────────
    // Recommendations, Configuration Bundles, A/B Tests, CloudWatch Logs 読み取り。
    //
    // 信頼ポリシー: AgentCore サービスのみが assume できる。
    // 管理者が CLI/SDK から Recommendations / A/B テストを実行する場合は、
    // 管理者自身の IAM 権限（上記アクション）を別途付与すること。
    // （アカウント全体を信頼する AccountPrincipal は過剰権限のため使用しない）
    const optimizationRole = new iam.Role(this, 'OptimizationRole', {
      roleName: `${prefix}-optimization-role`,
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      inlinePolicies: {
        OptimizationPolicy: new iam.PolicyDocument({
          statements: [
            // Configuration Bundles
            new iam.PolicyStatement({
              sid: 'ConfigurationBundles',
              actions: [
                'bedrock-agentcore:CreateConfigurationBundle',
                'bedrock-agentcore:GetConfigurationBundle',
                'bedrock-agentcore:GetConfigurationBundleVersion',
                'bedrock-agentcore:ListConfigurationBundles',
                'bedrock-agentcore:ListConfigurationBundleVersions',
                'bedrock-agentcore:UpdateConfigurationBundle',
                'bedrock-agentcore:DeleteConfigurationBundle',
              ],
              resources: [`arn:aws:bedrock-agentcore:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:configuration-bundle/*`],
            }),
            // Recommendations
            new iam.PolicyStatement({
              sid: 'Recommendations',
              actions: [
                'bedrock-agentcore:StartRecommendation',
                'bedrock-agentcore:GetRecommendation',
                'bedrock-agentcore:ListRecommendations',
                'bedrock-agentcore:DeleteRecommendation',
              ],
              resources: [`arn:aws:bedrock-agentcore:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:recommendation/*`],
            }),
            // A/B Testing
            new iam.PolicyStatement({
              sid: 'ABTesting',
              actions: [
                'bedrock-agentcore:CreateABTest',
                'bedrock-agentcore:GetABTest',
                'bedrock-agentcore:ListABTests',
                'bedrock-agentcore:UpdateABTest',
                'bedrock-agentcore:DeleteABTest',
              ],
              resources: [`arn:aws:bedrock-agentcore:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:ab-test/*`],
            }),
            // CloudWatch Logs（トレース読み取り）
            new iam.PolicyStatement({
              sid: 'CloudWatchLogs',
              actions: [
                'logs:GetLogEvents',
                'logs:FilterLogEvents',
                'logs:StartQuery',
                'logs:GetQueryResults',
              ],
              resources: [
                `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/bedrock-agentcore/runtimes/*`,
                `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/${prefix}-*`,
              ],
            }),
            // Bedrock model invocation（Recommendations 生成に必要）
            new iam.PolicyStatement({
              sid: 'BedrockModelAccess',
              actions: [
                'bedrock:InvokeModel',
              ],
              resources: [`arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/*`],
            }),
          ],
        }),
      },
    });
    this.optimizationRoleArn = optimizationRole.roleArn;

    // ─── Initial Configuration Bundle ─────────────────────────────
    // エージェント設定の初期バージョンを作成。
    // 以降の Recommendations は、このバンドルの最新バージョンを読み取り、
    // 改善案を新バージョンとして書き込む。
    //
    // ⚠️ UNVERIFIED: createConfigurationBundle の正式なパラメータ形状
    //    （components / componentArn / configuration / branch）は本実装時点で
    //    AWS 公式ドキュメントとの完全一致を確認できていない（Preview 機能）。
    //    有効化前に必ず以下で API 形状を確認・修正すること:
    //    https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/configuration-bundles.html
    const componentArn = props.runtimeArn || gatewayArn;
    const initialConfigPayload = {
      systemPrompt: props.initialConfig.systemPrompt,
      modelId: props.initialConfig.modelId,
      ...(props.initialConfig.toolDescriptions ? { toolDescriptions: props.initialConfig.toolDescriptions } : {}),
    };

    new cr.AwsCustomResource(this, 'ConfigBundle', {
      onCreate: {
        service: 'BedrockAgentCoreControl',
        action: 'createConfigurationBundle',
        parameters: {
          name: this.configBundleName,
          description: `Agent configuration for ${projectName} — system prompt, model ID, tool descriptions`,
          components: [
            {
              componentArn,
              configuration: initialConfigPayload,
            },
          ],
          branch: 'mainline',
        },
        physicalResourceId: cr.PhysicalResourceId.fromResponse('name'),
      },
      onDelete: {
        service: 'BedrockAgentCoreControl',
        action: 'deleteConfigurationBundle',
        parameters: {
          name: this.configBundleName,
        },
      },
      // 最小権限: configuration-bundle リソースに限定
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: [
            'bedrock-agentcore:CreateConfigurationBundle',
            'bedrock-agentcore:DeleteConfigurationBundle',
            'bedrock-agentcore:GetConfigurationBundle',
          ],
          resources: [
            `arn:aws:bedrock-agentcore:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:configuration-bundle/*`,
          ],
        }),
      ]),
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // ─── CloudFormation Outputs ─────────────────────────────────
    new cdk.CfnOutput(this, 'ConfigBundleName', {
      value: this.configBundleName,
      description: 'AgentCore Configuration Bundle name (versioned agent config)',
    });

    new cdk.CfnOutput(this, 'OptimizationRoleArn', {
      value: optimizationRole.roleArn,
      description: 'IAM Role ARN for running Recommendations and A/B Tests',
    });

    new cdk.CfnOutput(this, 'OptimizationGuide', {
      value: JSON.stringify({
        workflow: [
          '1. Deploy and run agent — traces collected in CloudWatch',
          '2. Run: agentcore optimization start-recommendation --config-bundle ' + this.configBundleName,
          '3. Review recommendation: agentcore optimization get-recommendation --id <rec-id>',
          '4. Approve and create new bundle version: agentcore optimization apply-recommendation --id <rec-id>',
          '5. Start A/B test: agentcore optimization create-ab-test --gateway ' + gatewayId + ' --control v1 --treatment v2',
          '6. Monitor: agentcore optimization get-ab-test --id <test-id>',
          '7. Deploy winner: agentcore optimization promote-variant --test-id <test-id> --variant treatment',
        ],
        gatewayId,
        configBundleName: this.configBundleName,
        roleArn: optimizationRole.roleArn,
        docsUrl: 'https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/optimization.html',
      }),
      description: 'AgentCore Optimization workflow guide (JSON)',
    });
  }
}
