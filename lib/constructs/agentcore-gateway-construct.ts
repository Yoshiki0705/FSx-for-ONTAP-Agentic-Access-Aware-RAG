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
        name: `${prefix.replace(/-/g, '_')}_policy_engine`,
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
        name: `${prefix.replace(/-/g, '_')}_baseline_policy`,
        policyEngineId: policyEngine.attrPolicyEngineId,
        description: 'Baseline permit for LOG_ONLY observation. Replace with least-privilege policies before ENFORCE.',
        definition: {
          cedar: {
            // Constrain to AgentCore::Gateway resource type (wildcard resource rejected by API)
            statement: 'permit(principal, action, resource) when { resource is AgentCore::Gateway };',
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
      authorizerType: 'AWS_IAM',
      protocolType: 'MCP',
      roleArn: gatewayRole.roleArn,
      exceptionLevel: 'DEBUG',
      // Policy Engine: Guardrails 統合によるリアルタイムコンテンツ安全性評価
      ...(policyEngineConfig ? { policyEngineConfiguration: policyEngineConfig } : {}),
      // Lambda Interceptor: ツール実行前にPermission checkを適用
      interceptorConfigurations: [
        {
          interceptionPoints: ['REQUEST'],
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
    // ─── Web Search (REMOVED from ap-northeast-1 Gateway) ─────────────────────
    // AWS Summit NY 2026 で発表された AgentCore Web Search Tool。
    //
    // 本セッション以前に enableWebSearch=true で ap-northeast-1 Gateway に
    // Web Search target を追加する AwsCustomResource が存在していたが、以下の理由で撤去:
    //
    // 1. Web Search Tool のリージョン対応は UNVERIFIED（project-context では
    //    us-east-1 のみ。公式リージョン可用性表で要確認）
    // 2. target 構成（targetConfiguration の形状）も UNVERIFIED
    // 3. ap-northeast-1 Gateway に us-east-1 限定のツールを追加するのは整合性エラー
    //
    // 今後のステップ (Step 4/5):
    //   - us-east-1 に専用 Gateway を作成（WafStack パターン or CLI/PoC）
    //   - Web Search target を us-east-1 Gateway に正式に追加
    //   - Lambda WebSearchClient が us-east-1 Gateway を呼び出す
    //
    // 現在の Web Search 機能:
    //   - 機構 A (Claude Platform on AWS callWithWebSearch) は ap-northeast-1 Lambda から
    //     直接利用可能（リージョン制約なし）。Step 1/2 で実装済み。
    //   - ENABLE_WEB_SEARCH env var (demo-webapp-stack) は機構 A を制御する。
    //
    // @see docs/investigations/agentcore-web-search-integration.md — §4.1, §7 Risk R2
    if (props.enableWebSearch) {
      cdk.Annotations.of(this).addWarningV2(
        '@perm-rag/web-search-region',
        'enableWebSearch=true は現在 ap-northeast-1 Gateway に Web Search target を作成しません。' +
        'Web Search Tool は us-east-1 のみ対応の可能性があり（UNVERIFIED）、' +
        '本 Gateway への配置は不整合と判断して撤去しました。' +
        'Step 4 で us-east-1 専用 Gateway を作成後に Web Search target を追加してください。' +
        '現時点の Web 検索は機構 A（Claude Platform callWithWebSearch / ENABLE_WEB_SEARCH env var）で動作します。',
      );
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
