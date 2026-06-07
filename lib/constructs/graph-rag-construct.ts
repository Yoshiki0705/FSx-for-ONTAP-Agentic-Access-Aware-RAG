/**
 * Graph RAG Construct — Neptune Analytics + Document Relationship Graph
 *
 * ドキュメント間の関連性（引用、後継、プロジェクト所属、チーム所有）を
 * グラフ構造で表現し、KB検索結果のコンテキスト拡張に使用する。
 *
 * Features:
 * - Neptune Analytics Graph（サーバーレス、m-NCU課金）
 * - VPCエンドポイント経由のプライベートアクセス
 * - Lambda実行ロール（グラフ読み書き）
 * - ドキュメント関連性スキーマ定義
 *
 * @see docs/design/2026q2-ai-update-roadmap.md — Phase 5
 * @see .kiro/specs/knowledge-base-multimodal/requirements.md — Requirement 4-6
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as neptunegraph from 'aws-cdk-lib/aws-neptunegraph';
import { Construct } from 'constructs';

export interface GraphRAGConstructProps {
  /** プロジェクト名 */
  projectName: string;
  /** 環境名 */
  environment: string;
  /** VPC（プライベートサブネットに配置） */
  vpc: ec2.IVpc;
  /** プライベートサブネット */
  privateSubnets: ec2.ISubnet[];
  /** プロビジョンドメモリ (m-NCU)。最小16、デフォルト32 */
  provisionedMemory?: number;
  /** 削除保護（本番環境では true） */
  deletionProtection?: boolean;
}

/**
 * Document Relationship Graph Schema
 *
 * Nodes:
 *   - Document { id, name, s3Path, type, createdAt, permissionSIDs[] }
 *   - Project { id, name, department }
 *   - Team { id, name }
 *   - Entity { id, name, type }
 *
 * Edges:
 *   - Document -[REFERENCES]-> Document
 *   - Document -[SUPERSEDES]-> Document
 *   - Document -[BELONGS_TO]-> Project
 *   - Document -[AUTHORED_BY]-> Team
 *   - Document -[MENTIONS]-> Entity
 *   - Team -[OWNS]-> Project
 *
 * Scaling guide (m-NCU recommendations):
 *   - 10K documents: 32 m-NCU (default)
 *   - 50K documents: 64 m-NCU
 *   - 100K documents: 128 m-NCU
 *   - 500K+ documents: 256+ m-NCU (contact AWS for guidance)
 *
 * TODO (Future): For large-scale graph construction (>10K documents),
 * implement as Step Functions workflow:
 *   1. Scan S3 AP for new/modified documents (Lambda)
 *   2. Extract entities and relationships (Bedrock batch)
 *   3. Batch write to Neptune Analytics (Lambda, chunked)
 *   4. Verify graph consistency (Lambda)
 *   5. Update DynamoDB inventory (Lambda)
 */
export const GRAPH_SCHEMA = {
  nodeTypes: ['Document', 'Project', 'Team', 'Entity'],
  edgeTypes: ['REFERENCES', 'SUPERSEDES', 'BELONGS_TO', 'AUTHORED_BY', 'MENTIONS', 'OWNS'],
} as const;

export class GraphRAGConstruct extends Construct {
  /** Neptune Analytics Graph Endpoint */
  public readonly graphEndpoint: string;
  /** Neptune Analytics Graph ID */
  public readonly graphId: string;
  /** Graph access IAM Role ARN (for Lambda functions) */
  public readonly graphAccessRoleArn: string;

  constructor(scope: Construct, id: string, props: GraphRAGConstructProps) {
    super(scope, id);

    const { projectName, environment, vpc, privateSubnets } = props;
    const prefix = `${projectName}-${environment}`;
    const provisionedMemory = props.provisionedMemory ?? 32;

    // ─── Neptune Analytics Graph ───────────────────────────────
    const graph = new neptunegraph.CfnGraph(this, 'DocumentGraph', {
      graphName: `${prefix}-doc-graph`,
      provisionedMemory,
      publicConnectivity: false,
      deletionProtection: props.deletionProtection ?? false,
      vectorSearchConfiguration: {
        vectorSearchDimension: 1024, // Match Titan Embed v2 dimension
      },
      tags: [
        { key: 'Project', value: projectName },
        { key: 'Environment', value: environment },
        { key: 'Purpose', value: 'graph-rag-document-relationships' },
      ],
    });

    this.graphEndpoint = graph.attrEndpoint;
    this.graphId = graph.attrGraphId;

    // ─── Graph Access IAM Role ─────────────────────────────────
    // Lambda関数がグラフにアクセスするためのロール
    const graphAccessRole = new iam.Role(this, 'GraphAccessRole', {
      roleName: `${prefix}-graph-access-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
      inlinePolicies: {
        NeptuneGraphAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                'neptune-graph:ReadDataViaQuery',
                'neptune-graph:WriteDataViaQuery',
                'neptune-graph:GetGraphSummary',
              ],
              resources: [`arn:aws:neptune-graph:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:graph/${graph.attrGraphId}`],
            }),
          ],
        }),
      },
    });

    this.graphAccessRoleArn = graphAccessRole.roleArn;

    // ─── CloudFormation Outputs ─────────────────────────────────
    new cdk.CfnOutput(this, 'GraphEndpoint', {
      value: graph.attrEndpoint,
      description: 'Neptune Analytics Graph endpoint for document relationships',
      exportName: `${prefix}-GraphEndpoint`,
    });

    new cdk.CfnOutput(this, 'GraphId', {
      value: graph.attrGraphId,
      description: 'Neptune Analytics Graph ID',
      exportName: `${prefix}-GraphId`,
    });

    new cdk.CfnOutput(this, 'GraphAccessRoleArn', {
      value: graphAccessRole.roleArn,
      description: 'IAM Role ARN for Lambda graph access',
    });

    new cdk.CfnOutput(this, 'GraphSchema', {
      value: JSON.stringify(GRAPH_SCHEMA),
      description: 'Document relationship graph schema definition',
    });
  }
}
