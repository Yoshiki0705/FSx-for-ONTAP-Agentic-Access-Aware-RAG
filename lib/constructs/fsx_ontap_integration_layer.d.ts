/**
 * FSx for NetApp ONTAP 統合レイヤー実装
 * 複数ボリュームの動的マウント機能とNFS最適化設定
 */
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { FSxMountConfig, ExtendedEmbeddingConfig } from './types/type';
/**
 * NFS マウントオプション設定
 */
export interface NFSMountOptions {
    /** 読み取りサイズ（バイト） */
    rsize: number;
    /** 書き込みサイズ（バイト） */
    wsize: number;
    /** ハードマウント */
    hard: boolean;
    /** 割り込み可能 */
    intr: boolean;
    /** タイムアウト（秒） */
    timeo: number;
    /** リトライ回数 */
    retrans: number;
    /** NFSバージョン */
    nfsvers: string;
    /** プロトコル */
    proto: 'tcp' | 'udp';
    /** ファイルロック */
    flock: boolean;
    /** 非同期書き込み */
    async: boolean;
}
/**
 * SMB/CIFS マウントオプション設定
 */
export interface SMBMountOptions {
    /** SMBバージョン */
    vers: string;
    /** セキュリティモード */
    sec: 'ntlmssp' | 'krb5' | 'krb5i' | 'krb5p';
    /** ファイルモード */
    fileMode: string;
    /** ディレクトリモード */
    dirMode: string;
    /** UID */
    uid: number;
    /** GID */
    gid: number;
    /** キャッシュモード */
    cache: 'strict' | 'loose' | 'none';
    /** 永続的ハンドル */
    persistenthandles: boolean;
    /** 復元力のあるハンドル */
    resilienthandles: boolean;
}
/**
 * ボリューム設定
 */
export interface VolumeConfig {
    /** ボリューム名 */
    name: string;
    /** マウントポイント */
    mountPoint: string;
    /** プロトコル */
    protocol: 'NFS' | 'SMB';
    /** FSx パス */
    fsxPath: string;
    /** マウントオプション */
    mountOptions: NFSMountOptions | SMBMountOptions;
    /** 自動マウント */
    autoMount: boolean;
    /** 権限設定 */
    permissions: {
        owner: string;
        group: string;
        mode: string;
    };
}
/**
 * FSx ONTAP統合レイヤークラス
 */
export declare class FSxONTAPIntegrationLayer extends Construct {
    /** FSx ファイルシステムID */
    readonly fileSystemId: string;
    /** SVM ID */
    readonly svmId: string;
    /** マウント設定 */
    readonly mountConfig: FSxMountConfig;
    /** ボリューム設定リスト */
    readonly volumeConfigs: VolumeConfig[];
    /** マウントスクリプト */
    readonly mountScript: string;
    /** アンマウントスクリプト */
    readonly unmountScript: string;
    constructor(scope: Construct, id: string, props: {
        vpc: ec2.IVpc;
        embeddingConfig: ExtendedEmbeddingConfig;
        securityGroup?: ec2.ISecurityGroup;
    });
    /**
     * ボリューム設定の作成
     */
    private createVolumeConfigs;
    /**
     * 最適化されたNFSマウントオプションの取得
     */
    private getOptimizedNFSOptions;
    /**
     * 最適化されたSMBマウントオプションの取得
     */
    private getOptimizedSMBOptions;
    /**
     * セキュリティグループの作成
     */
    private createSecurityGroup;
    /**
     * マウントスクリプトの生成
     */
    private generateMountScript;
    /**
     * アンマウントスクリプトの生成
     */
    private generateUnmountScript;
    /**
     * SSMパラメータの作成
     */
    private createSSMParameters;
    /**
     * IAMロールの作成
     */
    private createIAMRole;
    /**
     * 出力の作成
     */
    private createOutputs;
    /**
     * マウント状態の検証スクリプト生成
     */
    generateValidationScript(): string;
    /**
     * パフォーマンステストスクリプト生成
     */
    generatePerformanceTestScript(): string;
}
/**
 * FSx ONTAP統合ユーティリティクラス
 */
export declare class FSxONTAPUtils {
    /**
     * FSx エンドポイント情報の取得
     */
    static getFSxEndpoints(fileSystemId: string, svmId: string, region?: string): Promise<{
        managementEndpoint: string;
        nfsEndpoint: string;
        smbEndpoint: string;
    }>;
    /**
     * マウントオプションの最適化
     */
    static optimizeNFSOptions(workloadType: 'read-heavy' | 'write-heavy' | 'balanced'): NFSMountOptions;
    /**
     * マウント状態の監視
     */
    static generateMonitoringScript(): string;
    /**
     * 障害回復スクリプトの生成
     */
    static generateRecoveryScript(): string;
}
