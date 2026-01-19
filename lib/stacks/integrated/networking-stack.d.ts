/**
 * 統合ネットワーキングスタック
 *
 * モジュラーアーキテクチャに基づくネットワーク基盤統合管理
 * - VPC・サブネット構成
 * - インターネットゲートウェイ・NATゲートウェイ
 * - セキュリティグループ・NACL
 * - VPCエンドポイント
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { NetworkingConstruct } from '../../modules/networking';
import { NetworkingConfig } from '../../modules/networking';
import { WindowsAdConstruct } from '../../modules/security/constructs/windows-ad-construct';
/**
 * Windows AD設定
 */
export interface WindowsAdConfig {
    /** Windows AD機能を有効化するかどうか */
    enabled: boolean;
    /** Active Directory Domain Name */
    domainName: string;
    /** AD EC2インスタンスタイプ */
    instanceType?: ec2.InstanceType;
    /** AD EC2のSSH Key Name（nullの場合はSSM Session Managerを使用） */
    keyName?: string | null;
}
/**
 * NetworkingStack のプロパティ
 */
export interface NetworkingStackProps extends cdk.StackProps {
    /** ネットワーキング設定 */
    config: NetworkingConfig;
    /** プロジェクト名（50文字以内） */
    projectName: string;
    /** 環境名（dev/staging/prod/test） */
    environment: 'dev' | 'staging' | 'prod' | 'test';
    /** Windows AD設定（オプション） */
    windowsAdConfig?: WindowsAdConfig;
    /** 既存VPCをインポートする場合のVPC ID（オプション） */
    existingVpcId?: string;
    /** 既存VPCをインポートする場合のVPC CIDR（オプション） */
    existingVpcCidr?: string;
}
export declare class NetworkingStack extends cdk.Stack {
    readonly networkingConstruct: NetworkingConstruct;
    readonly vpc: cdk.aws_ec2.IVpc;
    readonly publicSubnets: cdk.aws_ec2.ISubnet[];
    readonly privateSubnets: cdk.aws_ec2.ISubnet[];
    readonly isolatedSubnets: cdk.aws_ec2.ISubnet[];
    readonly securityGroups: {
        [key: string]: cdk.aws_ec2.SecurityGroup;
    };
    /** Windows AD EC2（オプション） */
    readonly windowsAd?: WindowsAdConstruct;
    constructor(scope: Construct, id: string, props: NetworkingStackProps);
    /**
     * プロパティの検証
     */
    private validateProps;
    /**
     * CloudFormation出力の作成
     */
    private createOutputs;
    /**
     * スタックレベルのタグ設定
     */
    private applyStackTags;
    /**
     * 既存VPC用のSecurity Groupsを作成（名前の重複を動的に回避）
     */
    private createSecurityGroupsForImportedVpc;
    /**
     * タグ値のサニタイズ
     */
    private sanitizeTagValue;
    /**
     * 他のスタックで使用するためのネットワーク情報を取得
     */
    getNetworkingInfo(): {
        vpc: cdk.aws_ec2.IVpc;
        publicSubnets: cdk.aws_ec2.ISubnet[];
        privateSubnets: cdk.aws_ec2.ISubnet[];
        isolatedSubnets: cdk.aws_ec2.ISubnet[];
        securityGroups: {
            [key: string]: cdk.aws_ec2.SecurityGroup;
        };
        availabilityZones: string[];
    };
    /**
     * 特定のセキュリティグループを取得
     */
    getSecurityGroup(name: string): cdk.aws_ec2.SecurityGroup | undefined;
    /**
     * VPCエンドポイント情報を取得
     */
    getVpcEndpoints(): {
        [key: string]: cdk.aws_ec2.InterfaceVpcEndpoint | cdk.aws_ec2.GatewayVpcEndpoint;
    };
}
