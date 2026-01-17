/**
 * Networking Stack
 * ネットワーク基盤統合スタック
 *
 * 統合機能:
 * - VPC、セキュリティグループ、ロードバランサー、CDN
 */
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NetworkingConfig } from '../modules/networking/interfaces';
export interface NetworkingStackProps extends StackProps {
    config: NetworkingConfig;
    projectName: string;
    environment: string;
}
export declare class NetworkingStack extends Stack {
    readonly vpc: any;
    readonly loadBalancer?: any;
    readonly distribution?: any;
    constructor(scope: Construct, id: string, props: NetworkingStackProps);
    private createVpc;
    private createLoadBalancer;
    private createCloudFrontDistribution;
}
