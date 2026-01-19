/**
 * Windows Active Directory EC2 Construct
 *
 * AD SID自動取得システム用のWindows Server EC2インスタンスを作成
 *
 * Features:
 * - Windows Server 2022
 * - Active Directory Domain Services
 * - SSM Run Command対応
 * - PowerShell実行環境
 * - セキュアな認証情報管理（Secrets Manager）
 */
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
export interface WindowsAdConstructProps {
    /** VPC */
    readonly vpc: ec2.IVpc;
    /** セキュリティグループ（オプション） */
    readonly securityGroup?: ec2.ISecurityGroup;
    /** プライベートサブネット */
    readonly privateSubnets?: ec2.SubnetSelection;
    /** プロジェクト名 */
    readonly projectName: string;
    /** 環境名 */
    readonly environment: string;
    /** ドメイン名 */
    readonly domainName: string;
    /** インスタンスタイプ（デフォルト: t3.medium） */
    readonly instanceType?: ec2.InstanceType;
    /** キーペア名（オプション） */
    readonly keyName?: string;
    /** 既存のAdminパスワードシークレット（オプション） */
    readonly adminPasswordSecret?: secretsmanager.ISecret;
}
/**
 * Windows Active Directory EC2 Construct
 */
export declare class WindowsAdConstruct extends Construct {
    /** EC2インスタンス */
    readonly instance: ec2.Instance;
    /** セキュリティグループ */
    readonly securityGroup: ec2.ISecurityGroup;
    /** Adminパスワードシークレット */
    readonly adminPasswordSecret: secretsmanager.ISecret;
    /** インスタンスID */
    readonly instanceId: string;
    constructor(scope: Construct, id: string, props: WindowsAdConstructProps);
    /**
     * ユーザーデータスクリプト生成
     */
    private generateUserDataScript;
    /**
     * SSM Run Command実行権限を付与
     */
    grantSsmRunCommand(grantee: iam.IGrantable): void;
}
