/**
 * OpenSearch Multimodal Embeddingクラスター構築
 *
 * Titan Multimodal Embedding用に最適化されたOpenSearchクラスター
 * - ベクトル検索最適化
 * - 高性能インスタンス設定
 * - セキュリティ強化
 * - 監視・ログ設定
 */
import * as opensearch from 'aws-cdk-lib/aws-opensearchserverless';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
export interface OpenSearchMultimodalConfig {
    /** コレクション名（28文字以内） */
    readonly domainName: string;
    /** 環境（dev/staging/prod） */
    readonly environment: string;
    /** コレクション設定 */
    readonly collectionConfig: {
        /** コレクションタイプ */
        readonly type: 'SEARCH' | 'TIMESERIES' | 'VECTORSEARCH';
        /** 説明 */
        readonly description?: string;
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
    /** タグ */
    readonly tags?: Record<string, string>;
}
export interface OpenSearchMultimodalOutputs {
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
export declare class OpenSearchMultimodalConstruct extends Construct {
    readonly collection: opensearch.CfnCollection;
    readonly outputs: OpenSearchMultimodalOutputs;
    private readonly securityGroup?;
    private readonly accessRole?;
    private config;
    constructor(scope: Construct, id: string, config: OpenSearchMultimodalConfig);
    /**
     * 設定値検証
     */
    private validateConfig;
    /**
     * セキュリティグループ作成
     */
    private createSecurityGroup;
    /**
     * IAMアクセスロール作成
     */
    private createAccessRole;
    /**
     * OpenSearchサーバーレスコレクション作成
     */
    private createOpenSearchCollection;
    /**
     * セキュリティポリシー作成
     */
    private createSecurityPolicy;
    /**
     * ネットワークポリシー作成
     */
    private createNetworkPolicy;
    /**
     * データアクセスポリシー作成
     */
    private createDataAccessPolicy;
    /**
     * コレクション用タグ作成
     */
    private createCollectionTags;
    /**
     * CloudWatchログ設定作成（OpenSearch Serverless用）
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
     * Titan Multimodal Embedding用インデックス作成
     */
    createMultimodalIndex(): string;
    /**
     * パフォーマンス最適化設定取得
     */
    getPerformanceOptimizationSettings(): Record<string, any>;
}
