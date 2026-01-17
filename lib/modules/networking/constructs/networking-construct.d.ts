/**
 * ネットワーキングコンストラクト
 * VPC、サブネット、セキュリティグループの統合管理
 */
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { NetworkingConstructProps } from '../interfaces/networking-config';
export declare class NetworkingConstruct extends Construct {
    readonly vpc: ec2.Vpc;
    readonly publicSubnets: ec2.ISubnet[];
    readonly privateSubnets: ec2.ISubnet[];
    readonly isolatedSubnets: ec2.ISubnet[];
    readonly securityGroups: {
        [key: string]: ec2.SecurityGroup;
    };
    readonly vpcEndpoints?: {
        [key: string]: ec2.InterfaceVpcEndpoint | ec2.GatewayVpcEndpoint;
    };
    constructor(scope: Construct, id: string, props: NetworkingConstructProps);
    /**
     * VPCの作成
     */
    private createVpc;
    /**
     * サブネット設定の作成
     */
    private createSubnetConfiguration;
    /**
     * セキュリティグループの作成
     */
    private createSecurityGroups;
    /**
     * VPCエンドポイントの作成
     */
    private createVpcEndpoints;
    /**
     * VPCフローログの作成
     */
    private createFlowLogs;
}
