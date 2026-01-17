/**
 * AWS リソースタグ設定
 * コスト配布とリソース管理のための統一タグ戦略
 */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
export type Environment = 'dev' | 'staging' | 'prod';
export type ServiceType = 'FSx-for-NetApp-ONTAP' | 'AWS-Batch' | 'OpenSearch-Serverless' | 'AWS-Lambda' | 'EC2' | 'S3' | 'CloudFront';
export interface TaggingConfig {
    /** プロジェクト名（コスト配布の主要キー） */
    projectName: string;
    /** 環境名 (dev, staging, prod) */
    environment: Environment;
    /** 部門・チーム名 */
    department?: string;
    /** 所有者 */
    owner?: string;
    /** 作成日 */
    createdDate?: string;
    /** 追加のカスタムタグ */
    customTags?: Record<string, string>;
}
export interface CostAllocationTags {
    /** コスト配布タグ（必須） */
    cost: string;
    /** 環境タグ */
    Environment: string;
    /** プロジェクトタグ */
    Project: string;
    /** 部門タグ */
    Department?: string;
    /** 所有者タグ */
    Owner?: string;
    /** 作成日タグ */
    CreatedDate: string;
    /** CDKアプリケーションタグ */
    'CDK-Application': string;
    /** 管理方法タグ */
    'Management-Method': string;
}
/**
 * 統一されたタグ設定を生成
 */
export declare class TaggingStrategy {
    /**
     * タグ設定の妥当性を検証
     */
    static validateConfig(config: TaggingConfig): {
        isValid: boolean;
        errors: string[];
    };
    /**
     * コスト配布タグを生成
     */
    static generateCostAllocationTags(config: TaggingConfig): CostAllocationTags;
    /**
     * CDKスタックにタグを適用
     */
    static applyTagsToStack(stack: cdk.Stack, config: TaggingConfig): void;
    /**
     * 特定のリソースにタグを適用
     */
    static applyTagsToResource(resource: Construct, config: TaggingConfig): void;
    /**
     * FSx for ONTAP専用タグを生成
     */
    static generateFSxTags(config: TaggingConfig): Record<string, string>;
    /**
     * AWS Batch専用タグを生成
     */
    static generateBatchTags(config: TaggingConfig): Record<string, string>;
    /**
     * OpenSearch専用タグを生成
     */
    static generateOpenSearchTags(config: TaggingConfig): Record<string, string>;
    /**
     * Lambda専用タグを生成
     */
    static generateLambdaTags(config: TaggingConfig, functionPurpose: string): Record<string, string>;
    /**
     * コスト最適化用タグを生成
     */
    static generateCostOptimizationTags(config: TaggingConfig, resourceType: ServiceType): Record<string, string>;
}
/**
 * プロジェクト固有のタグ設定
 */
export declare class PermissionAwareRAGTags {
    /**
     * プロジェクト標準のタグ設定を取得
     */
    static getStandardConfig(projectName: string, environment: Environment): TaggingConfig;
    /**
     * 環境別のタグ設定を取得
     */
    static getEnvironmentConfig(environment: string): Partial<TaggingConfig>;
    /**
     * セキュリティ要件に基づくタグ設定を取得
     */
    static getSecurityConfig(environment: Environment): Partial<TaggingConfig>;
}
