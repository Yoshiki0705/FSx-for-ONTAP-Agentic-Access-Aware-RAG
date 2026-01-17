/**
 * Windows SQLite負荷試験コンストラクト
 *
 * Windows EC2インスタンス上でのSQLite負荷試験
 * - Windows Server 2022
 * - CIFS/SMB経由でのFSx for ONTAPアクセス
 * - PowerShellベースの負荷試験スクリプト
 * - RDP接続用の踏み台サーバー
 */
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
export interface WindowsSqliteProps {
    readonly projectName: string;
    readonly environment: string;
    readonly vpc: ec2.IVpc;
    readonly privateSubnet: ec2.ISubnet;
    readonly securityGroup: ec2.ISecurityGroup;
    readonly keyPairName: string;
    readonly fsxFileSystemId: string;
    readonly fsxSvmId: string;
    readonly fsxVolumeId: string;
    readonly fsxMountPath: string;
    readonly fsxCifsEndpoint: string;
    readonly fsxCifsShareName: string;
    readonly instanceType?: string;
    readonly enableDetailedMonitoring?: boolean;
}
export declare class WindowsSqlite extends Construct {
    readonly instance: ec2.Instance;
    readonly bastionHost?: ec2.Instance;
    readonly securityGroup: ec2.SecurityGroup;
    private readonly instanceRole;
    constructor(scope: Construct, id: string, props: WindowsSqliteProps);
    /**
     * インスタンスロール作成
     */
    private createInstanceRole;
    /**
     * セキュリティグループ作成
     */
    private createSecurityGroup;
    /**
     * Windows インスタンス作成
     */
    private createWindowsInstance;
    /**
     * 踏み台サーバー作成
     */
    private createBastionHost;
    /**
     * Windows ユーザーデータ作成
     */
    private createWindowsUserData;
    /**
     * SQLite負荷試験スクリプト生成
     */
    private generateSqliteTestScript;
    /**
     * FSx マウントスクリプト生成
     */
    private generateMountScript;
    /**
     * 簡単な負荷試験スクリプト生成
     */
    private generateQuickTestScript;
    /**
     * タグ適用
     */
    private applyTags;
    /**
     * インスタンス情報取得
     */
    getInstanceInfo(): Record<string, any>;
}
