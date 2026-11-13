/**
 * DemoSfnToolsGatewayStack
 *
 * 既存の Step Functions ワークフロー（SnapMirror フェイルオーバー/フェイルバック）を
 * AgentCore Gateway 経由で AI エージェントのツールとして公開する専用スタック。
 *
 * AWS Step Functions connector target（connectorId: "states"）を使う。
 * @see https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-step-functions.html
 *
 * ## なぜ KB Gateway と分離するか
 *
 * SnapMirror フェイルオーバーは不可逆な DR 切り替え。AgentCore Gateway の
 * ターゲットはサービスロールを共有するため、権限境界を分けたいワークフローは
 * Gateway ごと分けるのが公式ドキュメントの推奨。DR 操作を KB 検索ツールと
 * 同じサービスロールに同居させない。
 *
 * ## 守りの3層
 *
 * 1. 既定で公開するのは読み取り系4操作のみ
 *    （DescribeStateMachine / ListExecutions / DescribeExecution / GetExecutionHistory）。
 * 2. 書き込み（StartExecution / StopExecution）は enableWriteOps=true で明示 opt-in。
 * 3. 書き込み opt-in 時は Policy Engine(Cedar) で、開始・停止を限定ロールの
 *    principal にだけ許可する（記事の「StopExecution を店長だけ」と同じ型）。
 *
 * ## 既存ワークフローとの疎結合
 *
 * ステートマシン ARN は props（CDK context 由来）で受ける。fsxn-ops スタックは
 * SAM/CFn の別スタックで、Output に Export が付いていないため Fn.importValue は
 * 使えない。既存の existingFileSystemId 等と同じ「外部リソースを context で受ける」
 * パターンに揃える。
 *
 * ## 固定とタイプ
 *
 * 既存の 2 本は StateMachineType=STANDARD。StartSyncExecution（Express 専用）は
 * 使わず、StartExecution + DescribeExecution ポーリングの非同期パターンで扱う。
 * task token 系（SendTask*）は公開しない（露出ゼロ）。
 *
 * @see .private/design/stepfunctions-agentcore-gateway-integration.ja.md
 */

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as bedrockagentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

/** 公開するワークフロー 1 本分の定義 */
export interface SfnWorkflowTarget {
  /** ターゲット名（ツール名の接頭辞になる。例: "snapmirrorFailover" → snapmirrorFailover___StartExecution） */
  name: string;
  /** 固定するステートマシン ARN（STANDARD） */
  stateMachineArn: string;
  /** 説明（Target の description。ツールの input スキーマはシステムプロンプトで補う前提） */
  description?: string;
}

export interface DemoSfnToolsGatewayStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  /** 公開する Step Functions ワークフロー（1 本以上） */
  workflows: SfnWorkflowTarget[];
  /**
   * 書き込み操作（StartExecution / StopExecution）を公開するか。
   * false（既定）なら読み取り系4操作のみ。true で opt-in し、Cedar で限定ロールに絞る。
   * @default false
   */
  enableWriteOps?: boolean;
  /**
   * 書き込み操作を許可するロール名の部分一致パターン。
   * enableWriteOps=true のとき、Cedar で principal.id がこのパターンを含む場合だけ
   * StartExecution / StopExecution を許可する。未指定時は enableWriteOps=true でも
   * 書き込みを誰にも許可しない（= 実質読み取り専用のまま。安全側の既定）。
   * 例: "snapmirror-operator"
   */
  writeOpsRolePattern?: string;
  /**
   * Policy Engine の enforcement mode。
   * - LOG_ONLY: Cedar 評価をトレースに記録するが、ブロックしない（検証用）。
   * - ENFORCE: Cedar 評価結果でツール呼び出しを許可/拒否。
   * @default 'LOG_ONLY'
   */
  policyEngineMode?: 'LOG_ONLY' | 'ENFORCE';
}

export class DemoSfnToolsGatewayStack extends cdk.Stack {
  public readonly gatewayId: string;
  public readonly gatewayArn: string;
  public readonly gatewayUrl: string;

  constructor(scope: Construct, id: string, props: DemoSfnToolsGatewayStackProps) {
    super(scope, id, props);

    const { projectName, environment, workflows } = props;
    const prefix = `${projectName}-${environment}`;
    const enableWriteOps = props.enableWriteOps ?? false;
    const policyEngineMode = props.policyEngineMode ?? 'LOG_ONLY';

    if (workflows.length === 0) {
      throw new Error(
        'DemoSfnToolsGatewayStack requires at least one workflow in props.workflows. ' +
        'Pass state machine ARNs via CDK context (sfnFailoverArn / sfnFailbackArn).',
      );
    }

    // 読み取り系4操作（既定で全ワークフローに公開）。すべて状況照会で副作用なし。
    // - DescribeStateMachine / ListExecutions: stateMachineArn をピンする固定操作。
    //   ListExecutions / DescribeExecution / GetExecutionHistory は Standard のみ対応で、
    //   既存の 2 本は STANDARD なので問題ない。
    // - StartSyncExecution は Express 専用なので STANDARD の本プロジェクトでは公開しない。
    const readOps = ['DescribeStateMachine', 'ListExecutions'];
    // execution ARN をエージェントが渡す読み取り操作（固定しない）
    const readOpsByExecutionArn = ['DescribeExecution', 'GetExecutionHistory'];
    // 書き込み操作（opt-in）
    const writeOpsPinned = ['StartExecution']; // stateMachineArn 固定
    const writeOpsByExecutionArn = ['StopExecution']; // execution ARN をエージェントが渡す

    // ─── IAM Role（Gateway サービスロール） ─────────────────────────────
    // 公開する操作に対応する Step Functions 権限を、対象ステートマシン/実行 ARN に絞る。
    const stateMachineArns = workflows.map((w) => w.stateMachineArn);
    // 実行 ARN は stateMachineArn 文字列から導出する。
    // stateMachineArn 形式: arn:aws:states:REGION:ACCOUNT:stateMachine:NAME
    // execution ARN 形式:   arn:aws:states:REGION:ACCOUNT:execution:NAME:*
    // ARN は context で渡される具体値（token ではない）ので文字列置換でよい。
    const execArnsForPolicy = workflows.map(
      (w) => w.stateMachineArn.replace(':stateMachine:', ':execution:') + ':*',
    );

    const statements: iam.PolicyStatement[] = [
      // 読み取り（固定操作）: DescribeStateMachine / ListExecutions → stateMachine ARN
      new iam.PolicyStatement({
        sid: 'SfnReadStateMachine',
        actions: ['states:DescribeStateMachine', 'states:ListExecutions'],
        resources: stateMachineArns,
      }),
      // 読み取り（execution ARN）: DescribeExecution / GetExecutionHistory → execution ARN
      new iam.PolicyStatement({
        sid: 'SfnReadExecution',
        actions: ['states:DescribeExecution', 'states:GetExecutionHistory'],
        resources: execArnsForPolicy,
      }),
    ];

    if (enableWriteOps) {
      statements.push(
        new iam.PolicyStatement({
          sid: 'SfnStartExecution',
          actions: ['states:StartExecution'],
          resources: stateMachineArns,
        }),
        new iam.PolicyStatement({
          sid: 'SfnStopExecution',
          actions: ['states:StopExecution'],
          resources: execArnsForPolicy,
        }),
      );
    }

    const gatewayRole = new iam.Role(this, 'GatewayRole', {
      roleName: `${prefix}-sfn-gateway-role`,
      description: 'AgentCore Gateway service role for Step Functions tools',
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com', {
        conditions: {
          StringEquals: { 'aws:SourceAccount': cdk.Aws.ACCOUNT_ID },
        },
      }),
      inlinePolicies: {
        SfnGatewayPolicy: new iam.PolicyDocument({ statements }),
      },
    });

    // ─── Policy Engine（Cedar、書き込み opt-in 時のみ） ──────────────────
    let policyEngine: bedrockagentcore.CfnPolicyEngine | undefined;
    if (enableWriteOps) {
      policyEngine = new bedrockagentcore.CfnPolicyEngine(this, 'PolicyEngine', {
        name: `${prefix.replace(/-/g, '_')}_sfn_policy_engine`,
        description: `Cedar authorization for Step Functions write ops — ${projectName}`,
      });
    }

    // ─── AgentCore Gateway ───────────────────────────────────────────────
    const gateway = new bedrockagentcore.CfnGateway(this, 'Gateway', {
      name: `${prefix}-sfn-gateway`,
      description: `Step Functions tools gateway (${environment}) — ${projectName}`,
      authorizerType: 'AWS_IAM',
      protocolType: 'MCP',
      roleArn: gatewayRole.roleArn,
      exceptionLevel: 'DEBUG',
      ...(policyEngine
        ? {
            policyEngineConfiguration: {
              arn: policyEngine.attrPolicyEngineArn,
              mode: policyEngineMode,
            },
          }
        : {}),
    });

    this.gatewayId = gateway.attrGatewayIdentifier;
    this.gatewayArn = gateway.attrGatewayArn;
    this.gatewayUrl = gateway.attrGatewayUrl;

    // ─── Gateway Targets（ワークフローごとに1つ） ─────────────────────────
    // 1 操作に固定できるステートマシンは1つなので、ワークフローごとに Target を作る。
    for (const wf of workflows) {
      const configurations: bedrockagentcore.CfnGatewayTarget.ConnectorConfigurationProperty[] = [
        // 固定操作（stateMachineArn をピン）
        ...readOps.map((op) => ({
          name: op,
          parameterValues: { stateMachineArn: wf.stateMachineArn },
        })),
        // execution ARN 操作（固定しない）
        ...readOpsByExecutionArn.map((op) => ({ name: op })),
      ];

      if (enableWriteOps) {
        configurations.push(
          ...writeOpsPinned.map((op) => ({
            name: op,
            parameterValues: { stateMachineArn: wf.stateMachineArn },
          })),
          ...writeOpsByExecutionArn.map((op) => ({ name: op })),
        );
      }

      const target = new bedrockagentcore.CfnGatewayTarget(this, `${wf.name}Target`, {
        gatewayIdentifier: gateway.attrGatewayIdentifier,
        name: wf.name,
        description:
          wf.description ||
          `Step Functions tools for ${wf.name} — read-only${enableWriteOps ? ' + write (Cedar-gated)' : ''}`,
        targetConfiguration: {
          mcp: {
            connector: {
              source: { connectorId: 'states' },
              configurations,
            },
          },
        },
        credentialProviderConfigurations: [{ credentialProviderType: 'GATEWAY_IAM_ROLE' }],
      });
      target.node.addDependency(gateway);

      // ─── Cedar ポリシー（書き込み opt-in 時のみ、Target 作成後に作る） ───
      // Cedar はツール定義と突き合わせて検証されるため、Target の後に作る依存を付ける。
      if (enableWriteOps && policyEngine) {
        const gatewayEntity = `AgentCore::Gateway::"${gateway.attrGatewayArn}"`;

        // ベースライン: この Gateway のツールを IAM 呼び出し元に許可（Cedar は既定拒否）。
        const allowPolicy = new bedrockagentcore.CfnPolicy(this, `${wf.name}AllowTools`, {
          policyEngineId: policyEngine.attrPolicyEngineId,
          name: `${wf.name.replace(/[^a-zA-Z0-9]/g, '')}AllowTools`,
          description: `Allow gateway tools for ${wf.name} to IAM callers`,
          definition: {
            cedar: {
              statement: `permit(principal is AgentCore::IamEntity, action, resource == ${gatewayEntity});`,
            },
          },
          validationMode: 'IGNORE_ALL_FINDINGS',
        });
        allowPolicy.node.addDependency(target);

        // 書き込み（StartExecution / StopExecution）を限定ロールだけに絞る。
        // writeOpsRolePattern 未指定なら、誰にも許可しない（forbid で全拒否 = 安全側）。
        const writeOps = [...writeOpsPinned, ...writeOpsByExecutionArn];
        const unlessClause = props.writeOpsRolePattern
          ? ` unless { principal.id like "*${props.writeOpsRolePattern}*" }`
          : ''; // パターン無し = 常に forbid（全ロール拒否）

        for (const op of writeOps) {
          const forbidPolicy = new bedrockagentcore.CfnPolicy(this, `${wf.name}Only${op}`, {
            policyEngineId: policyEngine.attrPolicyEngineId,
            name: `${wf.name.replace(/[^a-zA-Z0-9]/g, '')}Restrict${op}`,
            description: `Restrict ${wf.name}___${op} to the operator role only`,
            definition: {
              cedar: {
                statement:
                  `forbid(principal is AgentCore::IamEntity, ` +
                  `action == AgentCore::Action::"${wf.name}___${op}", ` +
                  `resource == ${gatewayEntity})${unlessClause};`,
              },
            },
          });
          forbidPolicy.node.addDependency(target);
        }
      }
    }

    // ─── Outputs ─────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'SfnGatewayId', {
      value: gateway.attrGatewayIdentifier,
      description: 'AgentCore Step Functions tools Gateway ID',
      exportName: `${prefix}-SfnGatewayId`,
    });
    new cdk.CfnOutput(this, 'SfnGatewayArn', {
      value: gateway.attrGatewayArn,
      description: 'AgentCore Step Functions tools Gateway ARN',
      exportName: `${prefix}-SfnGatewayArn`,
    });
    new cdk.CfnOutput(this, 'SfnGatewayUrl', {
      value: gateway.attrGatewayUrl,
      description: 'AgentCore Step Functions tools Gateway URL (MCP endpoint)',
      exportName: `${prefix}-SfnGatewayUrl`,
    });
    new cdk.CfnOutput(this, 'SfnGatewayMode', {
      value: enableWriteOps ? `write-enabled (${policyEngineMode})` : 'read-only',
      description: 'Exposed operation scope. Write ops are opt-in and Cedar-gated.',
    });

    cdk.Tags.of(this).add('Project', projectName);
    cdk.Tags.of(this).add('Environment', environment);

    // ─── cdk-nag suppressions ────────────────────────────────────────────
    NagSuppressions.addResourceSuppressions(
      gatewayRole,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'Step Functions execution ARNs use a wildcard suffix (execution:NAME:*) because ' +
            'execution IDs are generated at runtime. State-machine-level actions are scoped to ' +
            'the exact state machine ARNs passed in. This is the tightest scoping the Step Functions ' +
            'connector allows for DescribeExecution/GetExecutionHistory/StopExecution.',
          appliesTo: workflows.flatMap((w) => [
            `Resource::${w.stateMachineArn.replace(':stateMachine:', ':execution:')}:*`,
          ]),
        },
      ],
      true,
    );
  }
}
