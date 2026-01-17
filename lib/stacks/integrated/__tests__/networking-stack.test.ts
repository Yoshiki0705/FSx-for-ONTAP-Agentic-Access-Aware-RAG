/**
 * NetworkingStack のユニットテスト
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { NetworkingStack } from '../networking-stack';
import { createNetworkingConfig } from '../../../config/networking-defaults';

describe('NetworkingStack', () => {
  let app: cdk.App;
  let stack: NetworkingStack;

  beforeEach(() => {
    app = new cdk.App();
    const config = createNetworkingConfig('dev');
    
    stack = new NetworkingStack(app, 'TestNetworkingStack', {
      config,
      projectName: 'test-project',
      environment: 'dev',
    });
  });

  test('VPCが正しく作成される', () => {
    const template = Template.fromStack(stack);
    
    template.hasResourceProperties('AWS::EC2::VPC', {
      CidrBlock: '10.0.0.0/16',
      EnableDnsHostnames: true,
      EnableDnsSupport: true,
    });
  });

  test('パブリックサブネットが作成される', () => {
    const template = Template.fromStack(stack);
    
    template.hasResourceProperties('AWS::EC2::Subnet', {
      MapPublicIpOnLaunch: true,
    });
  });

  test('セキュリティグループが作成される', () => {
    const template = Template.fromStack(stack);
    
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'Web層用セキュリティグループ',
    });
  });

  test('CloudFormation出力が正しく設定される', () => {
    const template = Template.fromStack(stack);
    
    template.hasOutput('VpcId', {});
    template.hasOutput('VpcCidr', {});
  });

  test('タグが正しく設定される', () => {
    const template = Template.fromStack(stack);
    
    template.hasResourceProperties('AWS::EC2::VPC', {
      Tags: [
        { Key: 'Project', Value: 'test-project' },
        { Key: 'Environment', Value: 'dev' },
        { Key: 'Stack', Value: 'NetworkingStack' },
      ],
    });
  });

  test('不正なプロジェクト名でエラーが発生する', () => {
    const config = createNetworkingConfig('dev');
    
    expect(() => {
      new NetworkingStack(app, 'TestNetworkingStack', {
        config,
        projectName: '', // 空文字
        environment: 'dev',
      });
    }).toThrow('プロジェクト名が設定されていません');
  });

  test('不正な環境名でエラーが発生する', () => {
    const config = createNetworkingConfig('dev');
    
    expect(() => {
      new NetworkingStack(app, 'TestNetworkingStack', {
        config,
        projectName: 'test-project',
        environment: 'invalid' as any, // 不正な環境名
      });
    }).toThrow('環境名は次のいずれかを指定してください');
  });
});