/**
 * AgentCore Gateway Construct
 *
 * エージェントとツール間の通信を集約するマネージドエントリポイント。
 * Lambda InterceptorでPermission-awareなツール実行ポリシーを適用する。
 *
 * Features:
 * - IAM認証によるアクセス制御（same-account principals）
 * - Lambda Interceptor でリクエストレベルのPermission check
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

export interface AgentCoreGatewayConstructProps {
  /** プロジェクト名 */
  projectName: string;
  /** 環境名 */
  environment: string;
  /** ユーザーアクセスDynamoDBテーブル（Permission Interceptor用） */
  userAccessTable: dynamodb.ITable;
  /** Gateway description */
  description?: string;
}

export class AgentCoreGatewayConstruct extends Construct {
  /** Gateway ID */
  public readonly gatewayId: string;
  /** Gateway ARN */
  public readonly gatewayArn: string;
  /** Permission Interceptor Lambda関数 */
  public readonly interceptorFunction: lambda.Function;

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

    const gateway = new bedrockagentcore.CfnGateway(this, 'Gateway', {
      name: `${prefix}-gateway`,
      description: props.description || `AgentCore Gateway for ${projectName} — Permission-aware tool routing`,
      authorizerType: 'IAM',
      protocolType: 'MCP',
      roleArn: gatewayRole.roleArn,
      exceptionLevel: 'DEBUG',
      // Lambda Interceptor: ツール実行前にPermission checkを適用
      // TODO (Phase future): Add AFTER_TOOL_INVOCATION interception point
      // to scan tool results for PII/sensitive data before returning to the model.
      // Currently only pre-execution permission check is implemented.
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
