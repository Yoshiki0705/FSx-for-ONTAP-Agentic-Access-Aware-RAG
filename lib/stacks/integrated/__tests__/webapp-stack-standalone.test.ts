/**
 * WebAppStack スタンドアローンモード ユニットテスト
 * 
 * スタンドアローンモードでのWebAppStackの動作を検証します。
 * - VPC作成
 * - 既存VPC参照
 * - Lambda関数作成
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { WebAppStack } from '../webapp-stack';
import { tokyoWebAppStandaloneConfig } from '../../../config/environments/webapp-standalone-config';
import { adaptWebAppConfig } from '../../../config/adapters/webapp-config-adapter';

describe('WebAppStack - スタンドアローンモード', () => {
  let app: cdk.App;

  beforeEach(() => {
    app = new cdk.App();
  });

  describe('VPC作成テスト', () => {
    test('新規VPCが正しく作成される', () => {
      const stack = new WebAppStack(app, 'TestWebAppStack', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
        config: adaptWebAppConfig(tokyoWebAppStandaloneConfig as any),
        projectName: 'permission-aware-rag',
        environment: 'test',
        standaloneMode: true,
        skipLambdaCreation: true, // VPCのみテスト
      });

      const template = Template.fromStack(stack);

      // VPCが作成されることを確認
      template.resourceCountIs('AWS::EC2::VPC', 1);

      // VPCのプロパティを確認
      template.hasResourceProperties('AWS::EC2::VPC', {
        CidrBlock: Match.stringLikeRegexp('^10\\.'),
        EnableDnsHostnames: true,
        EnableDnsSupport: true,
      });
    });

    test('サブネットが正しく作成される', () => {
      const stack = new WebAppStack(app, 'TestWebAppStack', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
        config: adaptWebAppConfig(tokyoWebAppStandaloneConfig as any),
        projectName: 'permission-aware-rag',
        environment: 'test',
        standaloneMode: true,
        skipLambdaCreation: true,
      });

      const template = Template.fromStack(stack);

      // パブリックサブネットが作成されることを確認
      template.hasResourceProperties('AWS::EC2::Subnet', {
        MapPublicIpOnLaunch: true,
      });

      // プライベートサブネットが作成されることを確認
      template.hasResourceProperties('AWS::EC2::Subnet', {
        MapPublicIpOnLaunch: false,
      });
    });
  });

  describe('セキュリティグループテスト', () => {
    test('セキュリティグループが正しく作成される', () => {
      const stack = new WebAppStack(app, 'TestWebAppStack', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
        config: adaptWebAppConfig(tokyoWebAppStandaloneConfig as any),
        projectName: 'permission-aware-rag',
        environment: 'test',
        standaloneMode: true,
        skipLambdaCreation: true,
      });

      const template = Template.fromStack(stack);

      // セキュリティグループが作成されることを確認
      template.resourceCountIs('AWS::EC2::SecurityGroup', 1);

      // HTTPSインバウンドルールを確認
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        SecurityGroupIngress: Match.arrayWith([
          Match.objectLike({
            IpProtocol: 'tcp',
            FromPort: 443,
            ToPort: 443,
          }),
        ]),
      });
    });
  });

  describe('ECRリポジトリテスト', () => {
    test('ECRリポジトリが正しく作成される', () => {
      const stack = new WebAppStack(app, 'TestWebAppStack', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
        config: adaptWebAppConfig(tokyoWebAppStandaloneConfig as any),
        projectName: 'permission-aware-rag',
        environment: 'test',
        standaloneMode: true,
        skipLambdaCreation: true,
      });

      const template = Template.fromStack(stack);

      // ECRリポジトリが作成されることを確認
      template.resourceCountIs('AWS::ECR::Repository', 1);

      // ECRリポジトリのプロパティを確認
      template.hasResourceProperties('AWS::ECR::Repository', {
        ImageScanningConfiguration: {
          ScanOnPush: true,
        },
        ImageTagMutability: 'MUTABLE',
      });
    });

    test('ECRライフサイクルポリシーが設定される', () => {
      const stack = new WebAppStack(app, 'TestWebAppStack', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
        config: adaptWebAppConfig(tokyoWebAppStandaloneConfig as any),
        projectName: 'permission-aware-rag',
        environment: 'test',
        standaloneMode: true,
        skipLambdaCreation: true,
      });

      const template = Template.fromStack(stack);

      // ライフサイクルポリシーが設定されることを確認
      template.hasResourceProperties('AWS::ECR::Repository', {
        LifecyclePolicy: Match.objectLike({
          LifecyclePolicyText: Match.stringLikeRegexp('maxImageCount'),
        }),
      });
    });
  });

  describe('Lambda関数テスト', () => {
    test('Lambda関数が正しく作成される（skipLambdaCreation=false）', () => {
      const stack = new WebAppStack(app, 'TestWebAppStack', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
        config: adaptWebAppConfig(tokyoWebAppStandaloneConfig as any),
        projectName: 'permission-aware-rag',
        environment: 'test',
        standaloneMode: true,
        skipLambdaCreation: false,
      });

      const template = Template.fromStack(stack);

      // Lambda関数が作成されることを確認
      template.resourceCountIs('AWS::Lambda::Function', 1);

      // Lambda関数のプロパティを確認
      template.hasResourceProperties('AWS::Lambda::Function', {
        PackageType: 'Image',
        MemorySize: 2048,
        Timeout: 30,
      });
    });

    test('Lambda関数がスキップされる（skipLambdaCreation=true）', () => {
      const stack = new WebAppStack(app, 'TestWebAppStack', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
        config: adaptWebAppConfig(tokyoWebAppStandaloneConfig as any),
        projectName: 'permission-aware-rag',
        environment: 'test',
        standaloneMode: true,
        skipLambdaCreation: true,
      });

      const template = Template.fromStack(stack);

      // Lambda関数が作成されないことを確認
      template.resourceCountIs('AWS::Lambda::Function', 0);
    });
  });

  describe('CloudFrontテスト', () => {
    test('CloudFront Distributionが正しく作成される', () => {
      const stack = new WebAppStack(app, 'TestWebAppStack', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
        config: adaptWebAppConfig(tokyoWebAppStandaloneConfig as any),
        projectName: 'permission-aware-rag',
        environment: 'test',
        standaloneMode: true,
        skipLambdaCreation: false,
      });

      const template = Template.fromStack(stack);

      // CloudFront Distributionが作成されることを確認
      template.resourceCountIs('AWS::CloudFront::Distribution', 1);

      // CloudFrontのプロパティを確認
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          Enabled: true,
          PriceClass: 'PriceClass_200',
        }),
      });
    });
  });

  describe('出力値テスト', () => {
    test('必要な出力値が定義される', () => {
      const stack = new WebAppStack(app, 'TestWebAppStack', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
        config: adaptWebAppConfig(tokyoWebAppStandaloneConfig as any),
        projectName: 'permission-aware-rag',
        environment: 'test',
        standaloneMode: true,
        skipLambdaCreation: false,
      });

      const template = Template.fromStack(stack);

      // ECRリポジトリURI出力
      template.hasOutput('EcrRepositoryUri', {});

      // CloudFront URL出力
      template.hasOutput('CloudFrontUrl', {});
    });
  });

  describe('タグテスト', () => {
    test('正しいタグが設定される', () => {
      const stack = new WebAppStack(app, 'TestWebAppStack', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
        config: adaptWebAppConfig(tokyoWebAppStandaloneConfig as any),
        projectName: 'permission-aware-rag',
        environment: 'test',
        standaloneMode: true,
        skipLambdaCreation: true,
      });

      const template = Template.fromStack(stack);

      // VPCにタグが設定されることを確認
      template.hasResourceProperties('AWS::EC2::VPC', {
        Tags: Match.arrayWith([
          Match.objectLike({
            Key: 'DeployMode',
            Value: 'Standalone',
          }),
        ]),
      });
    });
  });
});
