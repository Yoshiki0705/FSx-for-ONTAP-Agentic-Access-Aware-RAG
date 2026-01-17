/**
 * 最小統合スタック
 *
 * セキュリティとネットワーキングのみの最小構成
 * スタック間参照の問題を回避し、段階的な実装を可能にする
 */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SecurityConstruct } from '../../modules/security/constructs/security-construct';
import { NetworkingConstruct } from '../../modules/networking/constructs/networking-construct';
export interface MinimalIntegratedStackProps extends cdk.StackProps {
    projectName: string;
    environment: 'dev' | 'staging' | 'prod' | 'test';
}
export declare class MinimalIntegratedStack extends cdk.Stack {
    readonly securityConstruct: SecurityConstruct;
    readonly networkingConstruct: NetworkingConstruct;
    readonly kmsKey: cdk.aws_kms.Key;
    readonly vpc: cdk.aws_ec2.Vpc;
    constructor(scope: Construct, id: string, props: MinimalIntegratedStackProps);
    /**
     * CloudFormation出力の作成
     */
    private createOutputs;
    /**
     * スタックレベルのタグ設定
     */
    private applyStackTags;
    /**
     * システム情報の取得
     */
    getSystemInfo(): {
        stackName: string;
        region: string;
        account: string;
        components: {
            security: boolean;
            networking: boolean;
        };
        resources: {
            kmsKey: string;
            vpc: string;
            wafWebAcl: string;
        };
    };
    /**
     * セキュリティリソースの取得
     */
    getSecurityResources(): {
        kmsKey: cdk.aws_kms.Key;
        wafWebAcl: cdk.aws_wafv2.CfnWebACL;
        securityConstruct: SecurityConstruct;
    };
    /**
     * ネットワークリソースの取得
     */
    getNetworkResources(): {
        vpc: cdk.aws_ec2.Vpc;
        publicSubnets: cdk.aws_ec2.ISubnet[];
        privateSubnets: cdk.aws_ec2.ISubnet[];
        isolatedSubnets: cdk.aws_ec2.ISubnet[];
        securityGroups: {
            [key: string]: cdk.aws_ec2.SecurityGroup;
        };
        networkingConstruct: NetworkingConstruct;
    };
}
