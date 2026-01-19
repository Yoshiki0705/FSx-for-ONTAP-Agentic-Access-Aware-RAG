/**
 * OpenSearch Multimodal Embeddingスタック
 *
 * Titan Multimodal Embedding用に最適化されたOpenSearchクラスターをデプロイ
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { OpenSearchMultimodalConstruct } from '../modules/database/constructs/opensearch-multimodal-construct';
export interface OpenSearchMultimodalStackProps extends cdk.StackProps {
    /** 環境名 */
    readonly environment: string;
    /** プロジェクト名 */
    readonly projectName: string;
    /** パフォーマンスティア */
    readonly performanceTier?: 'standard' | 'high';
    /** VPC使用フラグ */
    readonly useVpc?: boolean;
    /** 既存VPC ID */
    readonly existingVpcId?: string;
    /** KMS暗号化有効化 */
    readonly enableKmsEncryption?: boolean;
    /** タグ */
    readonly tags?: Record<string, string>;
}
export declare class OpenSearchMultimodalStack extends cdk.Stack {
    readonly openSearchConstruct: OpenSearchMultimodalConstruct;
    readonly vpc?: ec2.IVpc;
    readonly kmsKey?: kms.Key;
    constructor(scope: Construct, id: string, props: OpenSearchMultimodalStackProps);
    /**
     * VPC設定
     */
    private setupVpc;
    /**
     * KMSキー作成
     */
    private createKmsKey;
    /**
     * ドメイン名生成（28文字以内）
     */
    private generateDomainName;
    /**
     * CloudFormation出力作成
     */
    private createOutputs;
    /**
     * スタックレベルタグ適用
     */
    private applyStackTags;
    /**
     * インデックス作成用のLambda関数作成（オプション）
     */
    createIndexSetupFunction(): void;
}
