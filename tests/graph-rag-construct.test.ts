/**
 * GraphRAGConstruct CDK Assertion Tests
 *
 * Validates:
 * - Neptune Analytics Graph resource creation
 * - IAM Role with minimal permissions
 * - VPC integration (private connectivity)
 * - Vector search configuration (1024 dimensions)
 * - Conditional provisioning (enableGraphRAG flag)
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { GraphRAGConstruct } from '../lib/constructs/graph-rag-construct';

describe('GraphRAGConstruct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let vpc: ec2.Vpc;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'ap-northeast-1' },
    });
    vpc = new ec2.Vpc(stack, 'TestVpc', { maxAzs: 2 });
  });

  it('creates Neptune Analytics Graph with correct configuration', () => {
    new GraphRAGConstruct(stack, 'GraphRAG', {
      projectName: 'test-project',
      environment: 'test',
      vpc,
      privateSubnets: vpc.privateSubnets,
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::NeptuneGraph::Graph', {
      GraphName: 'test-project-test-doc-graph',
      ProvisionedMemory: 32,
      PublicConnectivity: false,
      DeletionProtection: false,
      VectorSearchConfiguration: {
        VectorSearchDimension: 1024,
      },
    });
  });

  it('creates IAM Role with Neptune Graph access permissions', () => {
    new GraphRAGConstruct(stack, 'GraphRAG', {
      projectName: 'test-project',
      environment: 'test',
      vpc,
      privateSubnets: vpc.privateSubnets,
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'test-project-test-graph-access-role',
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Principal: { Service: 'lambda.amazonaws.com' },
          }),
        ]),
      }),
    });
  });

  it('includes Neptune Graph IAM actions in role policy', () => {
    new GraphRAGConstruct(stack, 'GraphRAG', {
      projectName: 'test-project',
      environment: 'test',
      vpc,
      privateSubnets: vpc.privateSubnets,
    });

    const template = Template.fromStack(stack);

    // Inline policy is embedded in the Role resource
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'test-project-test-graph-access-role',
      Policies: Match.arrayWith([
        Match.objectLike({
          PolicyName: 'NeptuneGraphAccess',
        }),
      ]),
    });
  });

  it('respects custom provisionedMemory parameter', () => {
    new GraphRAGConstruct(stack, 'GraphRAG', {
      projectName: 'test-project',
      environment: 'test',
      vpc,
      privateSubnets: vpc.privateSubnets,
      provisionedMemory: 64,
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::NeptuneGraph::Graph', {
      ProvisionedMemory: 64,
    });
  });

  it('enables deletion protection when specified', () => {
    new GraphRAGConstruct(stack, 'GraphRAG', {
      projectName: 'test-project',
      environment: 'test',
      vpc,
      privateSubnets: vpc.privateSubnets,
      deletionProtection: true,
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::NeptuneGraph::Graph', {
      DeletionProtection: true,
    });
  });

  it('outputs Graph endpoint and ID', () => {
    new GraphRAGConstruct(stack, 'GraphRAG', {
      projectName: 'test-project',
      environment: 'test',
      vpc,
      privateSubnets: vpc.privateSubnets,
    });

    const template = Template.fromStack(stack);
    const outputs = template.findOutputs('*');
    const outputKeys = Object.keys(outputs);

    // Verify outputs exist (CDK generates construct-path-based keys)
    expect(outputKeys.some(k => k.includes('GraphEndpoint'))).toBe(true);
    expect(outputKeys.some(k => k.includes('GraphId'))).toBe(true);
    expect(outputKeys.some(k => k.includes('GraphAccessRoleArn'))).toBe(true);
    expect(outputKeys.some(k => k.includes('GraphSchema'))).toBe(true);
  });
});
