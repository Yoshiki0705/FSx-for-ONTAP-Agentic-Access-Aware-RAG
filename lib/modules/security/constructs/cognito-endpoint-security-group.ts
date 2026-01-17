/**
 * Cognito VPC Endpoint用セキュリティグループコンストラクト
 * 
 * VPC内からのHTTPS通信を許可し、Cognito User Poolsへの閉域網接続を実現
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface CognitoEndpointSecurityGroupProps {
  /**
   * セキュリティグループを作成するVPC
   */
  vpc: ec2.IVpc;

  /**
   * セキュリティグループの説明
   * @default 'Security group for Cognito VPC Endpoint'
   */
  description?: string;

  /**
   * インバウンドトラフィックを許可するCIDRブロック
   * @default VPC CIDR
   */
  allowedCidrs?: string[];

  /**
   * セキュリティグループを作成するかどうか
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
 * Cognito VPC Endpoint用セキュリティグループコンストラクト
 * 
 * VPC内からのHTTPS（ポート443）通信を許可し、
 * Cognito User Poolsへの閉域網接続を実現します。
 * 
 * 使用例:
 * ```typescript
 * const cognitoSg = new CognitoEndpointSecurityGroup(this, 'CognitoSG', {
 *   vpc,
 *   enabled: true,
 *   projectName: 'permission-aware-rag',
 *   environment: 'prod',
 * });
 * ```
 */
export class CognitoEndpointSecurityGroup extends Construct {
  /**
   * 作成されたセキュリティグループ（enabledがtrueの場合のみ）
   */
  public readonly securityGroup?: ec2.SecurityGroup;

  /**
   * セキュリティグループが有効かどうか
   */
  public readonly isEnabled: boolean;

  constructor(scope: Construct, id: string, props: CognitoEndpointSecurityGroupProps) {
    super(scope, id);

    // CDKコンテキスト変数からenabled設定を取得（propsが優先）
    const contextEnabled = scope.node.tryGetContext('cognitoPrivateEndpoint') === true;
    this.isEnabled = props.enabled ?? contextEnabled;

    if (!this.isEnabled) {
      console.log('ℹ️  Cognito Endpoint Security Group: 無効');
      return;
    }

    console.log('✅ Cognito Endpoint Security Group: 有効');

    // セキュリティグループ作成
    this.securityGroup = new ec2.SecurityGroup(this, 'CognitoEndpointSecurityGroup', {
      vpc: props.vpc,
      description: props.description ?? 'Security group for Cognito VPC Endpoint',
      allowAllOutbound: true, // Cognitoへのアウトバウンド通信を許可
    });

    // インバウンドルール: VPC内からのHTTPS通信を許可
    const allowedCidrs = props.allowedCidrs ?? [props.vpc.vpcCidrBlock];
    
    allowedCidrs.forEach((cidr, index) => {
      this.securityGroup!.addIngressRule(
        ec2.Peer.ipv4(cidr),
        ec2.Port.tcp(443),
        `Allow HTTPS from ${cidr}`
      );
      
      console.log(`📝 インバウンドルール追加: ${cidr} → 443/tcp`);
    });

    // タグ設定
    cdk.Tags.of(this.securityGroup).add('Name', `${props.projectName}-${props.environment}-cognito-endpoint-sg`);
    cdk.Tags.of(this.securityGroup).add('Service', 'Cognito');
    cdk.Tags.of(this.securityGroup).add('Purpose', 'VPC-Endpoint');
    cdk.Tags.of(this.securityGroup).add('Project', props.projectName);
    cdk.Tags.of(this.securityGroup).add('Environment', props.environment);

    // 出力値
    new cdk.CfnOutput(this, 'CognitoEndpointSecurityGroupId', {
      value: this.securityGroup.securityGroupId,
      description: 'Cognito VPC Endpoint Security Group ID',
      exportName: `${cdk.Stack.of(this).stackName}-CognitoEndpointSecurityGroupId`,
    });

    console.log(`📝 Cognito Endpoint Security Group作成完了: ${this.securityGroup.securityGroupId}`);
  }

  /**
   * セキュリティグループIDを取得
   */
  public getSecurityGroupId(): string | undefined {
    return this.securityGroup?.securityGroupId;
  }

  /**
   * Lambda関数などからの接続を許可
   * 
   * @param peer 接続元（セキュリティグループまたはCIDR）
   * @param description ルールの説明
   */
  public allowConnectionFrom(peer: ec2.IPeer, description?: string): void {
    if (!this.securityGroup) {
      console.warn('⚠️  セキュリティグループが無効のため、接続許可を追加できません');
      return;
    }

    this.securityGroup.addIngressRule(
      peer,
      ec2.Port.tcp(443),
      description ?? 'Allow HTTPS connection'
    );

    console.log(`📝 接続許可追加: ${description ?? 'Custom peer'}`);
  }
}
