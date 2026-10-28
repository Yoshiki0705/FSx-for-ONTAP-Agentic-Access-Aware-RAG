/**
 * NetworkingStack CDK ユニットテスト
 *
 * テスト対象: lib/stacks/demo/demo-networking-stack.ts
 * テストケース:
 *   1. 新規作成分岐（existingVpcId 未指定）: VPC と NAT Gateway が作られる
 *   2. 既存VPC参照分岐: VPC / NAT Gateway / サブネットを作らず、SG だけ作る
 *   3. 既存VPC参照分岐: 渡したサブネットとAZがそのまま公開される
 *   4. 既存VPC参照分岐: enableVpcEndpoints を指定しても EP を作らない
 *   5. バリデーション: サブネット1本 / AZ本数不一致 / CIDR欠落 は synth 時に throw
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Annotations, Match } from 'aws-cdk-lib/assertions';
import {
  DemoNetworkingStack,
  DemoNetworkingStackProps,
} from '../../lib/stacks/demo/demo-networking-stack';

const ENV = { account: '123456789012', region: 'ap-northeast-1' };

const EXISTING: Partial<DemoNetworkingStackProps> = {
  existingVpcId: 'vpc-0123456789abcdef0',
  existingPrivateSubnetIds: ['subnet-0aaaaaaaaaaaaaaa1', 'subnet-0bbbbbbbbbbbbbbb2'],
  existingAvailabilityZones: ['ap-northeast-1a', 'ap-northeast-1c'],
  existingVpcCidr: '10.0.0.0/16',
};

function createNetworkingStack(overrides: Partial<DemoNetworkingStackProps> = {}) {
  const app = new cdk.App();
  const stack = new DemoNetworkingStack(app, 'TestNetworking', {
    projectName: 'testproj',
    environment: 'dev',
    env: ENV,
    ...overrides,
  });
  return { stack, template: Template.fromStack(stack) };
}

describe('新規作成分岐（existingVpcId 未指定）', () => {
  it('VPC と NAT Gateway を作る', () => {
    const { template } = createNetworkingStack();
    template.resourceCountIs('AWS::EC2::VPC', 1);
    template.resourceCountIs('AWS::EC2::NatGateway', 1);
  });

  it('enableVpcEndpoints=true で Gateway EP と Interface EP を作る', () => {
    const { template } = createNetworkingStack({ enableVpcEndpoints: true });
    // S3 + DynamoDB (Gateway) + Bedrock x2 / SSM x2 / Secrets / Logs (Interface)
    template.resourceCountIs('AWS::EC2::VPCEndpoint', 8);
  });
});

describe('既存VPC参照分岐', () => {
  it('VPC・NAT Gateway・サブネットを作らず、SG だけ作る', () => {
    const { template } = createNetworkingStack(EXISTING);
    template.resourceCountIs('AWS::EC2::VPC', 0);
    template.resourceCountIs('AWS::EC2::NatGateway', 0);
    template.resourceCountIs('AWS::EC2::Subnet', 0);
    template.resourceCountIs('AWS::EC2::SecurityGroup', 2);
  });

  it('SG は既存 VPC ID に紐づく', () => {
    const { template } = createNetworkingStack(EXISTING);
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupName: 'testproj-dev-lambda-sg',
      VpcId: 'vpc-0123456789abcdef0',
    });
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupName: 'testproj-dev-fsx-sg',
      VpcId: 'vpc-0123456789abcdef0',
    });
  });

  it('FSx SG の ingress に既存VPCのCIDRが使われる', () => {
    const { template } = createNetworkingStack(EXISTING);
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupName: 'testproj-dev-fsx-sg',
      SecurityGroupIngress: Match.arrayWith([
        Match.objectLike({ CidrIp: '10.0.0.0/16', FromPort: 2049, ToPort: 2049 }),
      ]),
    });
  });

  it('渡したサブネットとAZがそのまま公開される', () => {
    const { stack } = createNetworkingStack(EXISTING);
    expect(stack.privateSubnets.map(s => s.subnetId)).toEqual(EXISTING.existingPrivateSubnetIds);
    expect(stack.privateSubnets.map(s => s.availabilityZone)).toEqual(
      EXISTING.existingAvailabilityZones,
    );
    expect(stack.publicSubnets).toEqual([]);
    expect(stack.vpc.vpcId).toBe('vpc-0123456789abcdef0');
  });

  it('enableVpcEndpoints=true でも EP を作らず、警告を出す', () => {
    const { stack, template } = createNetworkingStack({ ...EXISTING, enableVpcEndpoints: true });
    template.resourceCountIs('AWS::EC2::VPCEndpoint', 0);
    Annotations.fromStack(stack).hasWarning(
      '*',
      Match.stringLikeRegexp('enableVpcEndpoints を無視'),
    );
  });
});

describe('既存VPC参照のバリデーション', () => {
  it('サブネットが1本だと throw する', () => {
    expect(() =>
      createNetworkingStack({
        ...EXISTING,
        existingPrivateSubnetIds: ['subnet-0aaaaaaaaaaaaaaa1'],
        existingAvailabilityZones: ['ap-northeast-1a'],
      }),
    ).toThrow(/existingPrivateSubnetIds/);
  });

  it('サブネット未指定だと throw する', () => {
    expect(() =>
      createNetworkingStack({ ...EXISTING, existingPrivateSubnetIds: undefined }),
    ).toThrow(/existingPrivateSubnetIds/);
  });

  it('AZ の本数がサブネットと違うと throw する', () => {
    expect(() =>
      createNetworkingStack({ ...EXISTING, existingAvailabilityZones: ['ap-northeast-1a'] }),
    ).toThrow(/existingAvailabilityZones/);
  });

  it('CIDR が無いと分かりやすいメッセージで throw する', () => {
    expect(() =>
      createNetworkingStack({ ...EXISTING, existingVpcCidr: undefined }),
    ).toThrow(/existingVpcCidr/);
  });
});
