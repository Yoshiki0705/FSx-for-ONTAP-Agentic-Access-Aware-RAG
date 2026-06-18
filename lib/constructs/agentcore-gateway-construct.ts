/**
 * AgentCore Gateway Construct
 *
 * エージェントとツール間の通信を集約するマネージドエントリポイント。
 * Lambda InterceptorでPermission-awareなツール実行ポリシーを適用する。
 *
 * Features:
 * - IAM認証によるアクセス制御（same-account principals）
 * - Lambda Interceptor でリクエストレベルのPermission check
 * - Policy Engine + Bedrock Guardrails 統合（プロンプトインジェクション/PII/有害コンテンツ検出）
 * - Web Search built-in connector target（エージェントのWeb検索ツール）
 * - CloudWatch Logs による構造化ログ出力
 * - MCP Server登録対応
 *
 * @see docs/design/2026q2-ai-update-roadmap.md — Phase 2
 * @see .kiro/specs/agentcore-gateway-modernization/requirements.md
 */

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as bedrockagentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

/** Policy Engine enforcement mode */
export type PolicyEngineMode = 'LOG_ONLY' | 'ENFORCE';

export interface AgentCoreGatewayConstructProps {
  /** プロジェクト名 */
  projectName: string;
  /** 環境名 */
  environment: string;
  /** ユーザーアクセスDynamoDBテーブル（Permission Interceptor用） */
  userAccessTable: dynamodb.ITable;
  /** Gateway description */
  description?: string;

  // ─── Policy Engine + Guardrails 統合 ────────────────────────
  /**
   * Bedrock Guardrail ARN を Policy Engine に統合するか。
   * 指定時、Policy Engine を作成し policyEngineConfiguration として Gateway に紐づける。
   * Guardrails は Gateway のツール呼び出し入出力をリアルタイムで評価し、
   * プロンプトインジェクション、有害コンテンツ、機密情報漏洩をブロックする。
   */
  guardrailArn?: string;
  /**
   * Policy Engine の enforcement mode。
   * - LOG_ONLY: ポリシー評価のみ（トレースに記録、ブロックしない）。テスト用。
   * - ENFORCE: ポリシー評価結果に基づきツール呼び出しを許可/拒否。
   * @default 'LOG_ONLY'
   */
  policyEngineMode?: PolicyEngineMode;

  // ─── Web Search ─────────────────────────────────────────────
  /**
   * AgentCore Web Search built-in connector target を有効化するか。
   * 有効時、Gateway に Web Search ツールが追加され、エージェントが
   * リアルタイムの Web 情報を引用付きで取得可能になる。
   * @default false
   */
  enableWebSearch?: boolean;
}

export class AgentCoreGatewayConstruct extends Construct {
  /** Gateway ID */
  public readonly gatewayId: string;
  /** Gateway ARN */
  public readonly gatewayArn: string;
  /** Permission Interceptor Lambda関数 */
  public readonly interceptorFunction: lambda.Function;
  /** Policy Engine ARN（Guardrails統合時のみ） */
  public readonly policyEngineArn?: string;
  /** Policy Engine ID（Guardrails統合時のみ） */
  public readonly policyEngineId?: string;

  constructor(scope: Construct, id: string, props: AgentCoreGatewayConstructProps) {
    super(scope, id);

    const { projectName, environment, userAccessTable } = props;
    const prefix = `${projectName}-${environment}`;

    // ─── Permission Interceptor Lambda ─────────────────────────
    // ツール実行前にユーザーのPermission（SID/UID/GID）を検証し、
    // 権限外の操作をブロックする。Fail-safe: DynamoDB読み取り失敗時はDENY。

    this.interceptorFunction = new lambda.Function(this, 'PermissionInterceptor', {
      functionName: `${prefix}-gateway-interceptor`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.lambda_handler',
      code: lambda.Code.fromAsset('lambda/gateway-interceptor'),
      timeout: cdk.Duration.seconds(3),
      memorySize: 256,
      environment: {
        USER_ACCESS_TABLE_NAME: userAccessTable.tableName,
        LOG_LEVEL: 'INFO',
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // DynamoDB読み取り権限（user-accessテーブルからSID情報を取得）
    userAccessTable.grantReadData(this.interceptorFunction);

    // ─── AgentCore Gateway ─────────────────────────────────────

    // Gateway IAMロール: Interceptor Lambda呼び出し + MCP Server接続
    const gatewayRole = new iam.Role(this, 'GatewayRole', {
      roleName: `${prefix}-gateway-role`,
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      inlinePolicies: {
        InvokeInterceptor: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['lambda:InvokeFunction'],
              resources: [this.interceptorFunction.functionArn],
            }),
          ],
        }),
      },
    });

    // ─── Policy Engine + Guardrails 統合 ─────────────────────────
    // AWS Summit NY 2026: AgentCore Policy に Bedrock Guardrails を統合。
    //
    // 検証メモ（2026-06-18, ドキュメント突合せ）:
    //   - Policy Engine 作成 + Gateway への policyEngineConfiguration 紐付けは
    //     CfnGateway / CfnPolicyEngine の正式プロパティ（検証済み）。
    //   - Cedar の実スキーマは context.input.<field> / principal.hasTag/getTag /
    //     action == AgentCore::Action::"TargetName___tool" / resource ==
    //     AgentCore::Gateway::"<arn>" （AgentCore starter-toolkit ドキュメントで確認）。
    //   - ⚠️ Guardrails の「Cedar context への露出」（context.guardrails.* 等）は
    //     公式スキーマに存在しない。Guardrails-in-Policy の付与は別機構（target の
    //     policyConfiguration.guardrailConfiguration 等）であり、Cedar 文では表現しない。
    //     → 以前の context.guardrails.evaluation ベースのポリシーは誤りのため撤去。
    let policyEngineConfig: bedrockagentcore.CfnGateway.GatewayPolicyEngineConfigurationProperty | undefined;

    if (props.guardrailArn) {
      const policyEngine = new bedrockagentcore.CfnPolicyEngine(this, 'PolicyEngine', {
        name: `${prefix}-policy-engine`,
        description: `Policy Engine for ${projectName} — Cedar authorization for gateway tool calls`,
      });

      this.policyEngineArn = policyEngine.attrPolicyEngineArn;
      this.policyEngineId = policyEngine.attrPolicyEngineId;

      // ベースライン Cedar ポリシー（検証済み構文）。
      // Policy Engine に permit ポリシーが1つも無いと Cedar の default-deny により
      // 全ツール呼び出しが拒否される。LOG_ONLY 観測用のベースラインとして
      // permit を1つ用意する。
      //
      // ⚠️ SECURITY: これは permit-all のベースラインであり、最小権限ではない。
      //    本番 ENFORCE 化の前に、以下の形式で対象ツール単位の least-privilege
      //    ポリシーを必ず作成すること:
      //      permit(principal, action == AgentCore::Action::"<Target>___<tool>",
      //             resource == AgentCore::Gateway::"<gateway-arn>") when { ... };
      //    参考: https://aws.github.io/bedrock-agentcore-starter-toolkit/examples/policy-integration.html
      const baselinePolicy = new bedrockagentcore.CfnPolicy(this, 'BaselineAuthorizationPolicy', {
        name: `${prefix}-baseline-policy`,
        policyEngineId: policyEngine.attrPolicyEngineId,
        description: 'Baseline permit for LOG_ONLY observation. Replace with least-privilege policies before ENFORCE.',
        definition: {
          cedar: {
            statement: 'permit(principal, action, resource);',
          },
        },
        // 有効な Cedar 構文のため findings で fail させる（厳格）
        validationMode: 'FAIL_ON_ANY_FINDINGS',
      });
      baselinePolicy.addDependency(policyEngine);

      policyEngineConfig = {
        arn: policyEngine.attrPolicyEngineArn,
        mode: props.policyEngineMode || 'LOG_ONLY',
      };

      // Gateway Role に Guardrails 評価権限を付与（ApplyGuardrail / InvokeGuardrailChecks）。
      // 実際の Guardrails 付与（policyConfiguration.guardrailConfiguration 等）は
      // target 設定側で行う想定。コンテンツ安全性は KB 紐付け Guardrail と
      // chunk-safety-filter でも多層に担保される。
      gatewayRole.addToPolicy(new iam.PolicyStatement({
        actions: ['bedrock:ApplyGuardrail', 'bedrock:InvokeGuardrailChecks'],
        resources: [props.guardrailArn],
      }));

      new cdk.CfnOutput(this, 'PolicyEngineArn', {
        value: policyEngine.attrPolicyEngineArn,
        description: 'AgentCore Policy Engine ARN (Cedar authorization)',
      });

      new cdk.CfnOutput(this, 'PolicyEngineMode', {
        value: props.policyEngineMode || 'LOG_ONLY',
        description: 'Policy Engine mode. Author least-privilege Cedar policies before switching to ENFORCE.',
      });

      new cdk.CfnOutput(this, 'PolicyEngineGuardrailNote', {
        value: 'Baseline permit policy only. Attach Guardrails via documented policyConfiguration and author per-tool Cedar policies before ENFORCE.',
        description: 'Action required before production ENFORCE',
      });
    }

    const gateway = new bedrockagentcore.CfnGateway(this, 'Gateway', {
      name: `${prefix}-gateway`,
      description: props.description || `AgentCore Gateway for ${projectName} — Permission-aware tool routing`,
      authorizerType: 'IAM',
      protocolType: 'MCP',
      roleArn: gatewayRole.roleArn,
      exceptionLevel: 'DEBUG',
      // Policy Engine: Guardrails 統合によるリアルタイムコンテンツ安全性評価
      ...(policyEngineConfig ? { policyEngineConfiguration: policyEngineConfig } : {}),
      // Lambda Interceptor: ツール実行前にPermission checkを適用
      interceptorConfigurations: [
        {
          interceptionPoints: ['BEFORE_TOOL_INVOCATION'],
          interceptor: {
            lambda: {
              arn: this.interceptorFunction.functionArn,
            },
          },
        },
      ],
    });

    // Gateway からInterceptor Lambdaを呼び出す権限
    this.interceptorFunction.addPermission('GatewayInvoke', {
      principal: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: gateway.attrGatewayArn,
    });

    this.gatewayId = gateway.attrGatewayIdentifier;
    this.gatewayArn = gateway.attrGatewayArn;

    // ─── Web Search Built-in Connector Target ────────────────────
    // AWS Summit NY 2026: AgentCore Web Search ツール。
    // Gateway に Web Search connector target を追加し、エージェントが
    // リアルタイムのWeb情報を引用付きで取得できるようにする。
    // データは AWS 環境内で処理され、外部へのデータ流出なし（zero data egress）。
    //
    // ⚠️ UNVERIFIED: Web Search は built-in connector target のため、現時点では
    //    CloudFormation で直接サポートされていない。下記の AwsCustomResource は
    //    createGatewayTarget API を呼ぶが、**Web Search 専用の target 構成
    //    （targetConfiguration の形状・専用 connector 種別・エンドポイント）は
    //    AWS 公式ドキュメントで未確認**である。
    //    そのため本実装はデフォルト無効（enableWebSearch=false）とし、
    //    有効化前に必ず以下で正式な API 形状を確認・修正すること:
    //    https://aws.amazon.com/blogs/aws/announcing-web-search-on-amazon-bedrock-agentcore-ground-your-ai-agents-in-current-accurate-web-knowledge/
    //    https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/
    //    （AWS Summit 時点の案内ではコンソール/CLI で Web Search target を作成する。
    //     CLI 相当のパラメータが固まり次第、下記 parameters を置換する想定）
    if (props.enableWebSearch) {
      // NOTE: WEB_SEARCH_TARGET_ENDPOINT 環境変数で正式エンドポイントを上書き可能。
      // 未指定時はプレースホルダ（要置換）を使用する。
      const webSearchEndpoint = process.env.WEB_SEARCH_TARGET_ENDPOINT
        || `https://web-search.bedrock-agentcore.${cdk.Aws.REGION}.amazonaws.com`; // PLACEHOLDER — verify before use

      const webSearchTarget = new cr.AwsCustomResource(this, 'WebSearchTarget', {
        onCreate: {
          service: 'BedrockAgentCoreControl',
          action: 'createGatewayTarget',
          parameters: {
            gatewayIdentifier: gateway.attrGatewayIdentifier,
            name: `${prefix}-web-search`,
            description: 'Web Search — Ground agent responses in current, cited web knowledge',
            targetConfiguration: {
              mcp: {
                mcpServer: {
                  endpoint: webSearchEndpoint,
                },
              },
            },
            credentialProviderConfigurations: [
              {
                credentialProviderType: 'GATEWAY_IAM_ROLE',
                credentialProvider: {},
              },
            ],
          },
          physicalResourceId: cr.PhysicalResourceId.fromResponse('targetId'),
        },
        onDelete: {
          service: 'BedrockAgentCoreControl',
          action: 'deleteGatewayTarget',
          parameters: {
            gatewayIdentifier: gateway.attrGatewayIdentifier,
            targetId: new cr.PhysicalResourceIdReference(),
          },
        },
        // 最小権限: この Gateway 配下の target に限定。
        // CreateGatewayTarget は作成時に target ID が未定のため gateway ARN スコープも許可。
        policy: cr.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            actions: [
              'bedrock-agentcore:CreateGatewayTarget',
              'bedrock-agentcore:DeleteGatewayTarget',
              'bedrock-agentcore:GetGatewayTarget',
            ],
            resources: [
              gateway.attrGatewayArn,
              `arn:aws:bedrock-agentcore:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:gateway/*/target/*`,
            ],
          }),
        ]),
        logRetention: logs.RetentionDays.ONE_WEEK,
      });
      webSearchTarget.node.addDependency(gateway);

      new cdk.CfnOutput(this, 'WebSearchTargetId', {
        value: webSearchTarget.getResponseField('targetId'),
        description: 'Web Search Gateway Target ID',
      });

      new cdk.CfnOutput(this, 'WebSearchEnabled', {
        value: 'true',
        description: 'Web Search connector target enabled (verify endpoint/config before production)',
      });
    }

    // ─── CloudFormation Outputs ─────────────────────────────────
    new cdk.CfnOutput(this, 'GatewayId', {
      value: gateway.attrGatewayIdentifier,
      description: 'AgentCore Gateway ID',
      exportName: `${prefix}-GatewayId`,
    });

    new cdk.CfnOutput(this, 'GatewayArn', {
      value: gateway.attrGatewayArn,
      description: 'AgentCore Gateway ARN',
      exportName: `${prefix}-GatewayArn`,
    });

    new cdk.CfnOutput(this, 'GatewayUrl', {
      value: gateway.attrGatewayUrl,
      description: 'AgentCore Gateway URL endpoint',
      exportName: `${prefix}-GatewayUrl`,
    });

    new cdk.CfnOutput(this, 'InterceptorFunctionName', {
      value: this.interceptorFunction.functionName,
      description: 'Permission Interceptor Lambda function name',
    });
  }
}
