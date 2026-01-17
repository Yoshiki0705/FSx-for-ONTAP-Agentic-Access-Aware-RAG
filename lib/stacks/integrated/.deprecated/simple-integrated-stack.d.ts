/**
 * シンプル統合スタック
 *
 * 実装済みモジュールのみを使用した統合スタック
 * - SecurityStack: KMS、WAF、CloudTrail、GuardDuty
 * - NetworkingStack: VPC、サブネット、セキュリティグループ
 *
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SecurityStack } from './security-stack';
import { NetworkingStack } from './networking-stack';
/**
 * SimpleIntegratedStack のプロパティ
 */
export interface SimpleIntegratedStackProps extends cdk.StackProps {
    /** プロジェクト名（50文字以内、英数字・ハイフン・アンダースコアのみ） */
    projectName: string;
    /** 環境名（dev/staging/prod/test） */
    environment: 'dev' | 'staging' | 'prod' | 'test';
    /** セキュリティスタックを有効にするか（デフォルト: true） */
    enableSecurity?: boolean;
    /** ネットワーキングスタックを有効にするか（デフォルト: true） */
    enableNetworking?: boolean;
}
export declare class SimpleIntegratedStack extends cdk.Stack {
    readonly securityStack?: SecurityStack;
    readonly networkingStack?: NetworkingStack;
    constructor(scope: Construct, id: string, props: SimpleIntegratedStackProps);
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
     * タグ値のサニタイズ
     */
    private sanitizeTagValue;
    /**
     * システム情報の取得
     */
    getSystemInfo(): {
        projectName: string;
        region: string;
        account: string;
        enabledStacks: {
            security: boolean;
            networking: boolean;
        };
        endpoints: {
            vpc: string;
            kmsKey: string;
        };
    };
    /**
     * セキュリティ情報の取得
     */
    getSecurityInfo(): {
        kmsKey: cdk.aws_kms.Key;
        wafWebAcl: any;
    };
    /**
     * ネットワーク情報の取得
     */
    getNetworkingInfo(): {
        vpc: cdk.aws_ec2.Vpc;
        publicSubnets: cdk.aws_ec2.ISubnet[];
        privateSubnets: cdk.aws_ec2.ISubnet[];
        isolatedSubnets: cdk.aws_ec2.ISubnet[];
        securityGroups: {
            [key: string]: cdk.aws_ec2.SecurityGroup;
        };
    };
}
