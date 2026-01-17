/**
 * 統一統合スタック
 *
 * 単一スタック内でコンストラクトを直接使用する統合アプローチ
 * スタック間参照の問題を回避し、シンプルな構造を実現
 */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SecurityConstruct } from '../../modules/security/constructs/security-construct';
import { NetworkingConstruct } from '../../modules/networking/constructs/networking-construct';
import { StorageConstruct } from '../../modules/storage/constructs/storage-construct';
import { DatabaseConstruct } from '../../modules/database/constructs/database-construct';
import { SecurityConfig } from '../../modules/security/interfaces/security-config';
import { NetworkingConfig } from '../../modules/networking/interfaces/networking-config';
import { StorageConfig } from '../../modules/storage/interfaces/storage-config';
import { DatabaseConfig } from '../../modules/database/interfaces/database-config';
export interface UnifiedIntegratedStackProps extends cdk.StackProps {
    /** プロジェクト名（英数字、ハイフン、アンダースコアのみ許可） */
    projectName: string;
    /** 環境名（厳密な型制約） */
    environment: 'dev' | 'staging' | 'prod' | 'test';
    enableSecurity?: boolean;
    enableNetworking?: boolean;
    enableStorage?: boolean;
    enableDatabase?: boolean;
    securityConfig?: Partial<SecurityConfig>;
    networkingConfig?: Partial<NetworkingConfig>;
    storageConfig?: Partial<StorageConfig>;
    databaseConfig?: Partial<DatabaseConfig>;
}
export declare class UnifiedIntegratedStack extends cdk.Stack {
    readonly securityConstruct?: SecurityConstruct;
    readonly networkingConstruct?: NetworkingConstruct;
    readonly storageConstruct?: StorageConstruct;
    readonly databaseConstruct?: DatabaseConstruct;
    readonly kmsKey?: cdk.aws_kms.Key;
    readonly vpc?: cdk.aws_ec2.Vpc;
    readonly wafWebAcl?: cdk.aws_wafv2.CfnWebACL;
    constructor(scope: Construct, id: string, props: UnifiedIntegratedStackProps);
    /**
     * 設定のマージ（深いマージ）
     */
    private mergeConfig;
    /**
     * 深いマージ実装（型安全性とパフォーマンス向上）
     */
    private deepMerge;
    /**
     * プレーンオブジェクトかどうかを判定
     */
    private isPlainObject;
    /**
     * 入力値の検証（セキュリティ対策）
     */
    private validateInputs;
    /**
     * デフォルトセキュリティ設定の取得（メモリ効率化）
     */
    private getDefaultSecurityConfig;
    /**
     * デフォルトネットワーキング設定の取得（メモリ効率化）
     */
    private getDefaultNetworkingConfig;
    /**
     * CloudFormation出力の作成
     */
    private createOutputs;
    /**
     * スタックレベルのタグ設定（保守性向上）
     */
    private applyStackTags;
    /**
     * タグ値のサニタイズ（セキュリティ対策）
     */
    private sanitizeTagValue;
    /**
     * システム情報の取得
     */
    getSystemInfo(): {
        stackName: string;
        region: string;
        account: string;
        enabledComponents: {
            security: boolean;
            networking: boolean;
            storage: boolean;
            database: boolean;
        };
        resources: {
            kmsKey: string;
            vpc: string;
            wafWebAcl: string;
        };
    };
    /**
     * セキュリティリソースの取得
     */
    getSecurityResources(): {
        kmsKey: cdk.aws_kms.Key;
        wafWebAcl: cdk.aws_wafv2.CfnWebACL;
        securityConstruct: SecurityConstruct;
    };
    /**
     * ネットワークリソースの取得
     */
    getNetworkResources(): {
        vpc: cdk.aws_ec2.Vpc;
        publicSubnets: cdk.aws_ec2.ISubnet[];
        privateSubnets: cdk.aws_ec2.ISubnet[];
        isolatedSubnets: cdk.aws_ec2.ISubnet[];
        securityGroups: {
            [key: string]: cdk.aws_ec2.SecurityGroup;
        };
        networkingConstruct: NetworkingConstruct;
    };
    /**
     * ストレージリソースの取得
     */
    getStorageResources(): {
        storageConstruct: StorageConstruct;
        documentsBucket: cdk.aws_s3.IBucket;
        backupBucket: cdk.aws_s3.IBucket;
        fsxFileSystem: cdk.aws_fsx.CfnFileSystem;
    };
    /**
     * データベースリソースの取得
     */
    getDatabaseResources(): {
        databaseConstruct: DatabaseConstruct;
        dynamoTables: any;
        opensearchCollections: any;
    };
}
