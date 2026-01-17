/**
 * OpenSearch Domain構築（通常のOpenSearchクラスター）
 *
 * Titan Multimodal Embedding用に最適化されたOpenSearchドメイン
 * - ベクトル検索最適化
 * - 開発環境向け設定
 * - セキュリティ強化
 * - 監視・ログ設定
 */
import * as opensearch from 'aws-cdk-lib/aws-opensearch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
export interface OpenSearchDomainConfig {
    /** ドメイン名（28文字以内） */
    readonly domainName: string;
    /** 環境（dev/staging/prod） */
    readonly environment: string;
    /** インスタンス設定 */
    readonly instanceConfig: {
        /** インスタンスタイプ */
        readonly instanceType: ec2.InstanceType;
        /** インスタンス数 */
        readonly instanceCount: number;
        /** 専用マスターノード使用 */
        readonly dedicatedMasterEnabled?: boolean;
        /** マスターノードタイプ */
        readonly masterInstanceType?: ec2.InstanceType;
        /** マスターノード数 */
        readonly masterInstanceCount?: number;
    };
    /** ストレージ設定 */
    readonly storageConfig: {
        /** EBSボリュームタイプ */
        readonly volumeType: ec2.EbsDeviceVolumeType;
        /** ボリュームサイズ（GB） */
        readonly volumeSize: number;
        /** IOPS（gp3/io1の場合） */
        readonly iops?: number;
        /** スループット（gp3の場合） */
        readonly throughput?: number;
    };
    /** ネットワーク設定 */
    readonly networkConfig: {
        /** VPC配置 */
        readonly vpcEnabled: boolean;
        /** VPC */
        readonly vpc?: ec2.IVpc;
        /** サブネット */
        readonly subnets?: ec2.ISubnet[];
        /** セキュリティグループ */
        readonly securityGroups?: ec2.ISecurityGroup[];
    };
    /** セキュリティ設定 */
    readonly securityConfig: {
        /** 暗号化有効化 */
        readonly encryptionAtRest: boolean;
        /** ノード間暗号化 */
        readonly nodeToNodeEncryption: boolean;
        /** HTTPS強制 */
        readonly enforceHttps: boolean;
        /** KMSキー */
        readonly kmsKey?: kms.IKey;
        /** ファインアクセス制御 */
        readonly fineGrainedAccessControl: boolean;
        /** マスターユーザー名 */
        readonly masterUserName?: string;
    };
    /** 監視設定 */
    readonly monitoringConfig: {
        /** CloudWatchログ有効化 */
        readonly logsEnabled: boolean;
        /** スローログ有効化 */
        readonly slowLogsEnabled: boolean;
        /** アプリケーションログ有効化 */
        readonly appLogsEnabled: boolean;
        /** インデックススローログ有効化 */
        readonly indexSlowLogsEnabled: boolean;
    };
    /** バックアップ設定 */
    readonly backupConfig?: {
        /** 自動スナップショット時間 */
        readonly automatedSnapshotStartHour: number;
    };
    /** インデックス設定 */
    readonly indexConfig?: {
        /** シャード数 */
        readonly numberOfShards: number;
        /** レプリカ数 */
        readonly numberOfReplicas: number;
    };
    /** タグ */
    readonly tags?: Record<string, string>;
}
export interface OpenSearchDomainOutputs {
    /** ドメインARN */
    readonly domainArn: string;
    /** ドメインエンドポイント */
    readonly domainEndpoint: string;
    /** Kibanaエンドポイント */
    readonly kibanaEndpoint: string;
    /** ドメイン名 */
    readonly domainName: string;
    /** セキュリティグループID */
    readonly securityGroupId?: string;
    /** アクセスポリシーARN */
    readonly accessPolicyArn?: string;
}
export declare class OpenSearchDomainConstruct extends Construct {
    private config;
    readonly domain: opensearch.Domain;
    readonly outputs: OpenSearchDomainOutputs;
    private readonly securityGroup?;
    private readonly accessRole?;
    constructor(scope: Construct, id: string, config: OpenSearchDomainConfig);
    /**
     * 設定値検証（包括的エラーハンドリング）
     */
    private validateConfig;
    /**
     * セキュリティグループ作成
     */
    private createSecurityGroup;
    /**
     * IAMアクセスロール作成（セキュリティ強化版）
     */
    private createAccessRole;
    /**
     * OpenSearchドメイン作成
     */
    private createOpenSearchDomain;
    /**
     * CloudWatchログ設定作成
     */
    private createCloudWatchLogs;
    /**
     * 出力値作成
     */
    private createOutputs;
    /**
     * タグ適用
     */
    private applyTags;
    /**
     * Titan Multimodal Embedding用インデックステンプレート作成
     * OpenSearch 7.10.2対応版（methodパラメータ除去）
     */
    createMultimodalIndexTemplate(): string;
    /**
     * パフォーマンス最適化設定取得（環境別最適化）
     */
    getPerformanceOptimizationSettings(): Record<string, any>;
    /**
     * CloudWatchアラーム作成
     */
    createCloudWatchAlarms(): void;
}
