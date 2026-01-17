/**
 * OpenSearch Domainスタック
 *
 * 通常のOpenSearchクラスター（非Serverless）をデプロイ
 * Titan Multimodal Embedding用に最適化
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { OpenSearchDomainConstruct } from '../modules/database/constructs/opensearch-domain-construct';
export interface OpenSearchDomainStackProps extends cdk.StackProps {
    /** 環境名 */
    readonly environment: string;
    /** プロジェクト名 */
    readonly projectName: string;
    /** VPC使用フラグ */
    readonly useVpc?: boolean;
    /** 既存VPC ID */
    readonly existingVpcId?: string;
    /** KMS暗号化有効化 */
    readonly enableKmsEncryption?: boolean;
    /** カスタム設定上書き */
    readonly customConfig?: Partial<any>;
    /** タグ */
    readonly tags?: Record<string, string>;
}
export declare class OpenSearchDomainStack extends cdk.Stack {
    readonly openSearchConstruct: OpenSearchDomainConstruct;
    readonly vpc?: ec2.IVpc;
    readonly kmsKey?: kms.Key;
    constructor(scope: Construct, id: string, props: OpenSearchDomainStackProps);
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
     * Agent Steering命名規則準拠
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
}
