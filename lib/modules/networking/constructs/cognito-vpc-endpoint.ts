/**
 * Cognito VPC Endpointコンストラクト
 * 
 * AWS PrivateLinkを使用してCognito User Poolsへの閉域網接続を提供
 * CDKコンテキスト変数 `cognitoPrivateEndpoint` で有効化
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface CognitoVpcEndpointProps {
  /**
   * VPC Endpointを作成するVPC
   */
  vpc: ec2.IVpc;

  /**
   * VPC Endpointを配置するサブネット
   * プライベートサブネットを推奨
   */
  subnets?: ec2.SubnetSelection;

  /**
   * VPC Endpointに関連付けるセキュリティグループ
   */
  securityGroups?: ec2.ISecurityGroup[];

  /**
   * プライベートDNSを有効化するかどうか
   * @default true
   */
  enablePrivateDns?: boolean;

  /**
   * VPC Endpointを作成するかどうか
   * CDKコンテキスト変数 `cognitoPrivateEndpoint` で制御
   * @default false
   */
  enabled?: boolean;

  /**
   * プロジェクト名（タグ付け用）
   */
  projectName: string;

  /**
   * 環境名（タグ付け用）
   */
  environment: string;
}

/**
 * Cognito VPC Endpointコンストラクト
 * 
 * AWS PrivateLinkを使用してCognito User Poolsへの閉域網接続を提供します。
 * 
 * 使用例:
 * ```typescript
 * const cognitoEndpoint = new CognitoVpcEndpoint(this, 'CognitoEndpoint', {
 *   vpc,
 *   subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
 *   securityGroups: [cognitoEndpointSg],
 *   enabled: true,
 *   projectName: 'permission-aware-rag',
 *   environment: 'prod',
 * });
 * ```
 */
export class CognitoVpcEndpoint extends Construct {
  /**
   * 作成されたVPC Endpoint（enabledがtrueの場合のみ）
   */
  public readonly vpcEndpoint?: ec2.InterfaceVpcEndpoint;

  /**
   * VPC Endpointが有効かどうか
   */
  public readonly isEnabled: boolean;

  constructor(scope: Construct, id: string, props: CognitoVpcEndpointProps) {
    super(scope, id);

    // CDKコンテキスト変数からenabled設定を取得（propsが優先）
    const contextEnabled = scope.node.tryGetContext('cognitoPrivateEndpoint') === true;
    this.isEnabled = props.enabled ?? contextEnabled;

    if (!this.isEnabled) {
      console.log('ℹ️  Cognito VPC Endpoint: 無効（Public Endpoint使用）');
      return;
    }

    console.log('✅ Cognito VPC Endpoint: 有効（Private Endpoint使用）');

    // リージョンを取得
    const region = cdk.Stack.of(this).region;

    // Cognito User Pools用のVPC Endpointサービス名
    const serviceName = `com.amazonaws.${region}.cognito-idp`;

    // デフォルトのサブネット選択（プライベートサブネット）
    const subnetSelection = props.subnets ?? {
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    };

    // VPC Endpoint作成
    this.vpcEndpoint = new ec2.InterfaceVpcEndpoint(this, 'CognitoVpcEndpoint', {
      vpc: props.vpc,
      service: new ec2.InterfaceVpcEndpointService(serviceName),
      subnets: subnetSelection,
      securityGroups: props.securityGroups,
      privateDnsEnabled: props.enablePrivateDns ?? true,
    });

    // タグ設定
    cdk.Tags.of(this.vpcEndpoint).add('Name', `${props.projectName}-${props.environment}-cognito-endpoint`);
    cdk.Tags.of(this.vpcEndpoint).add('Service', 'Cognito');
    cdk.Tags.of(this.vpcEndpoint).add('ConnectionType', 'PrivateLink');
    cdk.Tags.of(this.vpcEndpoint).add('Project', props.projectName);
    cdk.Tags.of(this.vpcEndpoint).add('Environment', props.environment);

    // 出力値
    new cdk.CfnOutput(this, 'CognitoVpcEndpointId', {
      value: this.vpcEndpoint.vpcEndpointId,
      description: 'Cognito VPC Endpoint ID',
      exportName: `${cdk.Stack.of(this).stackName}-CognitoVpcEndpointId`,
    });

    new cdk.CfnOutput(this, 'CognitoVpcEndpointDnsEntries', {
      value: cdk.Fn.join(',', this.vpcEndpoint.vpcEndpointDnsEntries),
      description: 'Cognito VPC Endpoint DNS Entries',
      exportName: `${cdk.Stack.of(this).stackName}-CognitoVpcEndpointDnsEntries`,
    });

    console.log(`📝 Cognito VPC Endpoint作成完了: ${serviceName}`);
  }

  /**
   * VPC EndpointのDNSエントリを取得
   */
  public getDnsEntries(): string[] {
    return this.vpcEndpoint?.vpcEndpointDnsEntries ?? [];
  }

  /**
   * VPC Endpoint IDを取得
   */
  public getEndpointId(): string | undefined {
    return this.vpcEndpoint?.vpcEndpointId;
  }
}
