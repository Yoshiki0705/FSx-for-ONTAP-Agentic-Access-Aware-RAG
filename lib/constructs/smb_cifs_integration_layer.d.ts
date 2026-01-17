/**
 * FSx for NetApp ONTAP SMB/CIFS統合レイヤー実装
 * Active Directory統合とWindows EC2アクセス機能の維持
 */
import { Construct } from 'constructs';
import { SecretValue } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as directoryservice from 'aws-cdk-lib/aws-directoryservice';
/**
 * Active Directory設定
 */
export interface ActiveDirectoryConfig {
    /** ドメイン名 */
    domainName: string;
    /** NetBIOS名 */
    netBiosName: string;
    /** 管理者パスワード */
    adminPassword: SecretValue;
    /** DNS IPアドレス */
    dnsIpAddresses: string[];
    /** 組織単位（OU） */
    organizationalUnit?: string;
    /** ファイルシステム管理者グループ */
    fileSystemAdministratorsGroup: string;
    /** 既存ADの使用 */
    useExistingAD: boolean;
    /** 既存AD ID（使用する場合） */
    existingDirectoryId?: string;
}
/**
 * SMB/CIFS認証設定
 */
export interface SMBAuthConfig {
    /** ドメインユーザー名 */
    domainUsername: string;
    /** ドメインパスワード */
    domainPassword: SecretValue;
    /** サービスアカウント */
    serviceAccount: {
        username: string;
        password: SecretValue;
    };
    /** Kerberos設定 */
    kerberosConfig?: {
        realm: string;
        kdcServer: string;
        adminServer: string;
    };
}
/**
 * Windows EC2設定
 */
export interface WindowsEC2Config {
    /** インスタンスタイプ */
    instanceType: ec2.InstanceType;
    /** AMI ID */
    amiId?: string;
    /** キーペア名 */
    keyPairName: string;
    /** 自動ドメイン参加 */
    autoJoinDomain: boolean;
    /** 管理者パスワード */
    adminPassword: SecretValue;
}
/**
 * SMB/CIFS統合レイヤークラス
 */
export declare class SMBCIFSIntegrationLayer extends Construct {
    /** Active Directory */
    readonly activeDirectory?: directoryservice.CfnMicrosoftAD;
    /** Windows EC2インスタンス */
    readonly windowsInstance?: ec2.Instance;
    /** SMB認証設定 */
    readonly smbAuthConfig: SMBAuthConfig;
    /** セキュリティグループ */
    readonly securityGroup: ec2.SecurityGroup;
    constructor(scope: Construct, id: string, props: {
        vpc: ec2.IVpc;
        adConfig: ActiveDirectoryConfig;
        smbAuthConfig: SMBAuthConfig;
        windowsConfig?: WindowsEC2Config;
        createWindowsInstance?: boolean;
    });
    /**
     * セキュリティグループの作成
     */
    private createSecurityGroup;
    /**
     * Active Directoryの作成
     */
    private createActiveDirectory;
    /**
     * Windows EC2インスタンスの作成
     */
    private createWindowsInstance;
    /**
     * Windows EC2用IAMロールの作成
     */
    private createWindowsInstanceRole;
    /**
     * Windows User Dataスクリプトの生成
     */
    private generateWindowsUserData;
    /**
     * SMB認証情報の保存
     */
    private storeSMBCredentials;
    /**
     * SMB/CIFSマウントスクリプトの生成
     */
    private createSMBMountScripts;
    /**
     * Linux用SMBマウントスクリプトの生成
     */
    private generateLinuxSMBScript;
}
