"use strict";
/**
 * 統一統合スタック
 *
 * 単一スタック内でコンストラクトを直接使用する統合アプローチ
 * スタック間参照の問題を回避し、シンプルな構造を実現
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnifiedIntegratedStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const security_construct_1 = require("../../modules/security/constructs/security-construct");
const networking_construct_1 = require("../../modules/networking/constructs/networking-construct");
const storage_construct_1 = require("../../modules/storage/constructs/storage-construct");
const database_construct_1 = require("../../modules/database/constructs/database-construct");
class UnifiedIntegratedStack extends cdk.Stack {
    // コンストラクトインスタンス
    securityConstruct;
    networkingConstruct;
    storageConstruct;
    databaseConstruct;
    // 主要リソース参照
    kmsKey;
    vpc;
    wafWebAcl;
    constructor(scope, id, props) {
        super(scope, id, props);
        // 入力値の検証（セキュリティ強化）
        this.validateInputs(props);
        const { projectName, environment, enableSecurity = true, enableNetworking = true, enableStorage = false, enableDatabase = false, securityConfig = {}, networkingConfig = {}, storageConfig = {}, databaseConfig = {} } = props;
        // 1. セキュリティコンストラクト（遅延初期化でパフォーマンス向上）
        if (enableSecurity) {
            const mergedSecurityConfig = this.mergeConfig(this.getDefaultSecurityConfig(projectName, environment), securityConfig);
            this.securityConstruct = new security_construct_1.SecurityConstruct(this, 'Security', {
                config: mergedSecurityConfig,
                projectName,
                environment,
            });
            this.kmsKey = this.securityConstruct.kmsKey;
            this.wafWebAcl = this.securityConstruct.wafWebAcl;
        }
        // 2. ネットワーキングコンストラクト
        if (enableNetworking) {
            const mergedNetworkingConfig = this.mergeConfig(this.getDefaultNetworkingConfig(), networkingConfig);
            this.networkingConstruct = new networking_construct_1.NetworkingConstruct(this, 'Networking', {
                config: mergedNetworkingConfig,
                projectName,
                environment,
            });
            this.vpc = this.networkingConstruct.vpc;
        }
        // 3. ストレージコンストラクト（オプション）
        if (enableStorage && this.vpc && this.kmsKey) {
            const defaultStorageConfig = {
                s3: {
                    enabled: true,
                    documentsBucket: {
                        versioned: true,
                        encryption: {
                            type: 'KMS',
                            kmsKeyId: this.kmsKey?.keyId,
                        },
                        lifecycle: {
                            transitionToIADays: 30,
                            transitionToGlacierDays: 90,
                            expirationDays: 365,
                        },
                    },
                    backupBucket: {
                        versioned: true,
                        encryption: {
                            type: 'KMS',
                            kmsKeyId: this.kmsKey?.keyId,
                        },
                    },
                },
                fsx: {
                    enabled: true,
                    fileSystem: {
                        storageCapacity: 1024,
                        deploymentType: 'MULTI_AZ_1',
                        throughputCapacity: 128,
                        automaticBackup: {
                            enabled: true,
                            retentionDays: 7,
                        },
                    },
                    svm: {
                        name: `${projectName}-svm`,
                        netBiosName: `${projectName.toUpperCase()}SVM`,
                    },
                    volumes: {
                        dataVolume: {
                            name: 'data',
                            sizeInGb: 100,
                            junctionPath: '/data',
                            securityStyle: 'NTFS',
                        },
                        databaseVolume: {
                            name: 'database',
                            sizeInGb: 50,
                            junctionPath: '/database',
                            securityStyle: 'UNIX',
                        },
                    },
                },
                ecr: {
                    enabled: true,
                    repositories: {
                        nextjs: {
                            repositoryName: `${projectName}-nextjs`,
                            imageScanOnPush: true,
                            lifecycle: {
                                maxImageCount: 10,
                            },
                        },
                        embedding: {
                            repositoryName: `${projectName}-embedding`,
                            imageScanOnPush: true,
                            lifecycle: {
                                maxImageCount: 5,
                            },
                        },
                    },
                },
                tags: {
                    StorageType: 'Hybrid',
                    DataClassification: 'Confidential',
                    BackupRequired: true,
                    EncryptionRequired: true,
                    ComplianceFramework: 'SOC2',
                },
            };
            const mergedStorageConfig = this.mergeConfig(defaultStorageConfig, storageConfig);
            this.storageConstruct = new storage_construct_1.StorageConstruct(this, 'Storage', {
                config: mergedStorageConfig,
                projectName,
                environment,
                vpc: this.vpc,
                kmsKey: this.kmsKey,
            });
        }
        // 4. データベースコンストラクト（オプション）
        if (enableDatabase && this.kmsKey) {
            const defaultDatabaseConfig = {
                dynamodb: {
                    enabled: true,
                    tables: {
                        sessionTable: {
                            tableName: `${projectName}-${environment}-sessions`,
                            partitionKey: { name: 'sessionId', type: cdk.aws_dynamodb.AttributeType.STRING },
                            billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
                            pointInTimeRecovery: true,
                            deletionProtection: false,
                            timeToLive: {
                                attribute: 'ttl',
                            },
                        },
                        userTable: {
                            tableName: `${projectName}-${environment}-users`,
                            partitionKey: { name: 'userId', type: cdk.aws_dynamodb.AttributeType.STRING },
                            billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
                            pointInTimeRecovery: true,
                            deletionProtection: false,
                        },
                        documentMetadataTable: {
                            tableName: `${projectName}-${environment}-document-metadata`,
                            partitionKey: { name: 'documentId', type: cdk.aws_dynamodb.AttributeType.STRING },
                            billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
                            pointInTimeRecovery: true,
                            deletionProtection: false,
                        },
                        chatHistoryTable: {
                            tableName: `${projectName}-${environment}-chat-history`,
                            partitionKey: { name: 'chatId', type: cdk.aws_dynamodb.AttributeType.STRING },
                            sortKey: { name: 'timestamp', type: cdk.aws_dynamodb.AttributeType.NUMBER },
                            billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
                            pointInTimeRecovery: true,
                            deletionProtection: false,
                        },
                    },
                },
                opensearch: {
                    enabled: true,
                    collections: {
                        vectorCollection: {
                            name: `${projectName}-${environment}-vectors`,
                            type: 'VECTORSEARCH',
                            description: 'Document vector search collection',
                        },
                        logsCollection: {
                            name: `${projectName}-${environment}-logs`,
                            type: 'SEARCH',
                            description: 'Application logs collection',
                        },
                    },
                    securityPolicy: {
                        encryptionPolicyName: `${projectName}-${environment}-encryption-policy`,
                        networkPolicyName: `${projectName}-${environment}-network-policy`,
                        dataAccessPolicyName: `${projectName}-${environment}-data-access-policy`,
                    },
                    indices: {
                        vectorIndex: {
                            name: 'document-vectors',
                            vectorDimensions: 1536,
                            distanceMetric: 'cosine',
                        },
                    },
                },
                sqlite: {
                    enabled: false,
                    upsertManager: {
                        batchSize: 100,
                        maxRetries: 3,
                        timeoutSeconds: 30,
                        concurrency: 5,
                    },
                    database: {
                        filePath: '/tmp/app.db',
                        connectionPool: {
                            maxConnections: 10,
                            idleTimeoutSeconds: 300,
                        },
                    },
                },
                tags: {
                    DatabaseType: 'NoSQL',
                    DataClassification: 'Confidential',
                    BackupRequired: true,
                    EncryptionRequired: true,
                    PerformanceTier: 'High',
                    ComplianceFramework: 'SOC2',
                },
            };
            const mergedDatabaseConfig = this.mergeConfig(defaultDatabaseConfig, databaseConfig);
            this.databaseConstruct = new database_construct_1.DatabaseConstruct(this, 'Database', {
                config: mergedDatabaseConfig,
                projectName,
                environment,
                kmsKey: this.kmsKey,
            });
        }
        // CloudFormation出力
        this.createOutputs();
        // スタックレベルのタグ設定
        this.applyStackTags(projectName, environment);
    }
    /**
     * 設定のマージ（深いマージ）
     */
    mergeConfig(defaultConfig, overrideConfig) {
        return this.deepMerge(defaultConfig, overrideConfig);
    }
    /**
     * 深いマージ実装（型安全性とパフォーマンス向上）
     */
    deepMerge(target, source) {
        // null/undefinedチェックを最初に実行
        if (!target || !source) {
            return target;
        }
        const result = { ...target };
        // Object.keysを使用してより安全な反復処理
        Object.keys(source).forEach(key => {
            const typedKey = key;
            const sourceValue = source[typedKey];
            const targetValue = result[typedKey];
            if (sourceValue !== undefined) {
                // より厳密な型チェック
                if (this.isPlainObject(sourceValue) && this.isPlainObject(targetValue)) {
                    result[typedKey] = this.deepMerge(targetValue, sourceValue);
                }
                else {
                    result[typedKey] = sourceValue;
                }
            }
        });
        return result;
    }
    /**
     * プレーンオブジェクトかどうかを判定
     */
    isPlainObject(obj) {
        return typeof obj === 'object' &&
            obj !== null &&
            !Array.isArray(obj) &&
            obj.constructor === Object;
    }
    /**
     * 入力値の検証（セキュリティ対策）
     */
    validateInputs(props) {
        const { projectName, environment } = props;
        // プロジェクト名の検証
        if (!projectName || typeof projectName !== 'string') {
            throw new Error('プロジェクト名が設定されていません');
        }
        if (projectName.trim().length === 0) {
            throw new Error('プロジェクト名が空文字です');
        }
        if (projectName.length > 50) {
            throw new Error('プロジェクト名は50文字以内で設定してください');
        }
        // セキュリティ: 安全な文字のみ許可
        if (!/^[a-zA-Z0-9\-_]+$/.test(projectName)) {
            throw new Error('プロジェクト名に不正な文字が含まれています（英数字、ハイフン、アンダースコアのみ許可）');
        }
        // 環境名の検証
        const validEnvironments = ['dev', 'staging', 'prod', 'test'];
        if (!validEnvironments.includes(environment)) {
            throw new Error(`環境名は次のいずれかを指定してください: ${validEnvironments.join(', ')}`);
        }
        // リソース名の長さ制限チェック（AWS制限対応）
        const resourceNamePrefix = `${projectName}-${environment}`;
        if (resourceNamePrefix.length > 40) {
            throw new Error('プロジェクト名と環境名の組み合わせが長すぎます（40文字以内）');
        }
    }
    /**
     * デフォルトセキュリティ設定の取得（メモリ効率化）
     */
    getDefaultSecurityConfig(projectName, environment) {
        return {
            kms: {
                enableKeyRotation: true,
                keySpec: 'SYMMETRIC_DEFAULT',
                keyUsage: 'ENCRYPT_DECRYPT',
            },
            waf: {
                enabled: true,
                scope: 'REGIONAL',
                rules: {
                    enableAWSManagedRules: true,
                    enableRateLimiting: true,
                    rateLimit: 2000,
                    enableGeoBlocking: false,
                    blockedCountries: [],
                },
            },
            cloudTrail: {
                enabled: true,
                s3BucketName: `${projectName}-${environment}-cloudtrail`,
                includeGlobalServiceEvents: true,
                isMultiRegionTrail: true,
                enableLogFileValidation: true,
            },
            tags: {
                SecurityLevel: 'High',
                EncryptionRequired: true,
                ComplianceFramework: 'SOC2',
                DataClassification: 'Confidential',
            },
        };
    }
    /**
     * デフォルトネットワーキング設定の取得（メモリ効率化）
     */
    getDefaultNetworkingConfig() {
        return {
            vpcCidr: '10.0.0.0/16',
            maxAzs: 3,
            enablePublicSubnets: true,
            enablePrivateSubnets: true,
            enableIsolatedSubnets: true,
            enableNatGateway: true,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            enableFlowLogs: true,
            vpcEndpoints: {
                s3: true,
                dynamodb: true,
                lambda: true,
                opensearch: true,
            },
            securityGroups: {
                web: true,
                api: true,
                database: true,
                lambda: true,
            },
        };
    }
    /**
     * CloudFormation出力の作成
     */
    createOutputs() {
        // セキュリティ出力
        if (this.kmsKey) {
            new cdk.CfnOutput(this, 'KmsKeyId', {
                value: this.kmsKey.keyId,
                description: 'KMS Key ID',
                exportName: `${this.stackName}-KmsKeyId`,
            });
            new cdk.CfnOutput(this, 'KmsKeyArn', {
                value: this.kmsKey.keyArn,
                description: 'KMS Key ARN',
                exportName: `${this.stackName}-KmsKeyArn`,
            });
        }
        if (this.wafWebAcl) {
            new cdk.CfnOutput(this, 'WafWebAclArn', {
                value: this.wafWebAcl.attrArn,
                description: 'WAF WebACL ARN',
                exportName: `${this.stackName}-WafWebAclArn`,
            });
        }
        // ネットワーキング出力
        if (this.vpc) {
            new cdk.CfnOutput(this, 'VpcId', {
                value: this.vpc.vpcId,
                description: 'VPC ID',
                exportName: `${this.stackName}-VpcId`,
            });
            new cdk.CfnOutput(this, 'VpcCidr', {
                value: this.vpc.vpcCidrBlock,
                description: 'VPC CIDR Block',
                exportName: `${this.stackName}-VpcCidr`,
            });
            // アベイラビリティゾーン
            new cdk.CfnOutput(this, 'AvailabilityZones', {
                value: this.vpc.availabilityZones.join(','),
                description: 'Availability Zones',
                exportName: `${this.stackName}-AvailabilityZones`,
            });
        }
        // ストレージ出力
        if (this.storageConstruct) {
            if (this.storageConstruct.documentsBucket) {
                new cdk.CfnOutput(this, 'DocumentsBucketName', {
                    value: this.storageConstruct.documentsBucket.bucketName,
                    description: 'Documents S3 Bucket Name',
                    exportName: `${this.stackName}-DocumentsBucketName`,
                });
            }
            if (this.storageConstruct.fsxFileSystem) {
                new cdk.CfnOutput(this, 'FSxFileSystemId', {
                    value: this.storageConstruct.fsxFileSystem.ref,
                    description: 'FSx File System ID',
                    exportName: `${this.stackName}-FSxFileSystemId`,
                });
            }
        }
        // データベース出力
        if (this.databaseConstruct) {
            // DynamoDB テーブル
            Object.entries(this.databaseConstruct.dynamoTables).forEach(([name, table]) => {
                new cdk.CfnOutput(this, `DynamoTable${name}Name`, {
                    value: table.tableName,
                    description: `DynamoDB Table ${name} Name`,
                    exportName: `${this.stackName}-DynamoTable${name}Name`,
                });
            });
            // OpenSearch コレクション
            Object.entries(this.databaseConstruct.opensearchCollections).forEach(([name, collection]) => {
                new cdk.CfnOutput(this, `OpenSearchCollection${name}Endpoint`, {
                    value: collection.attrCollectionEndpoint,
                    description: `OpenSearch Collection ${name} Endpoint`,
                    exportName: `${this.stackName}-OpenSearchCollection${name}Endpoint`,
                });
            });
        }
    }
    /**
     * スタックレベルのタグ設定（保守性向上）
     */
    applyStackTags(projectName, environment) {
        // タグ値のサニタイズ（セキュリティ対策）
        const sanitizedProjectName = this.sanitizeTagValue(projectName);
        const sanitizedEnvironment = this.sanitizeTagValue(environment);
        const tags = {
            Project: sanitizedProjectName,
            Environment: sanitizedEnvironment,
            Stack: 'UnifiedIntegratedStack',
            Component: 'Integration',
            ManagedBy: 'CDK',
            Architecture: 'Unified',
            CostCenter: `${sanitizedProjectName}-${sanitizedEnvironment}-unified`,
            CreatedAt: new Date().toISOString().split('T')[0],
            Version: '1.0.0'
        };
        // 一括でタグを適用
        Object.entries(tags).forEach(([key, value]) => {
            cdk.Tags.of(this).add(key, value);
        });
    }
    /**
     * タグ値のサニタイズ（セキュリティ対策）
     */
    sanitizeTagValue(value) {
        return value
            .replace(/[<>\"'&]/g, '') // XSS対策
            .substring(0, 256) // AWS タグ値の最大長制限
            .trim();
    }
    /**
     * システム情報の取得
     */
    getSystemInfo() {
        return {
            stackName: this.stackName,
            region: this.region,
            account: this.account,
            enabledComponents: {
                security: !!this.securityConstruct,
                networking: !!this.networkingConstruct,
                storage: !!this.storageConstruct,
                database: !!this.databaseConstruct,
            },
            resources: {
                kmsKey: this.kmsKey?.keyArn || null,
                vpc: this.vpc?.vpcId || null,
                wafWebAcl: this.wafWebAcl?.attrArn || null,
            },
        };
    }
    /**
     * セキュリティリソースの取得
     */
    getSecurityResources() {
        return {
            kmsKey: this.kmsKey,
            wafWebAcl: this.wafWebAcl,
            securityConstruct: this.securityConstruct,
        };
    }
    /**
     * ネットワークリソースの取得
     */
    getNetworkResources() {
        if (!this.networkingConstruct) {
            return null;
        }
        return {
            vpc: this.vpc,
            publicSubnets: this.networkingConstruct.publicSubnets,
            privateSubnets: this.networkingConstruct.privateSubnets,
            isolatedSubnets: this.networkingConstruct.isolatedSubnets,
            securityGroups: this.networkingConstruct.securityGroups,
            networkingConstruct: this.networkingConstruct,
        };
    }
    /**
     * ストレージリソースの取得
     */
    getStorageResources() {
        return {
            storageConstruct: this.storageConstruct,
            documentsBucket: this.storageConstruct?.documentsBucket || null,
            backupBucket: this.storageConstruct?.backupBucket || null,
            fsxFileSystem: this.storageConstruct?.fsxFileSystem || null,
        };
    }
    /**
     * データベースリソースの取得
     */
    getDatabaseResources() {
        return {
            databaseConstruct: this.databaseConstruct,
            dynamoTables: this.databaseConstruct?.dynamoTables || {},
            opensearchCollections: this.databaseConstruct?.opensearchCollections || {},
        };
    }
}
exports.UnifiedIntegratedStack = UnifiedIntegratedStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5pZmllZC1pbnRlZ3JhdGVkLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidW5pZmllZC1pbnRlZ3JhdGVkLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7R0FLRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFFbkMsNkZBQXlGO0FBQ3pGLG1HQUErRjtBQUMvRiwwRkFBc0Y7QUFDdEYsNkZBQXlGO0FBeUJ6RixNQUFhLHNCQUF1QixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ25ELGdCQUFnQjtJQUNBLGlCQUFpQixDQUFxQjtJQUN0QyxtQkFBbUIsQ0FBdUI7SUFDMUMsZ0JBQWdCLENBQW9CO0lBQ3BDLGlCQUFpQixDQUFxQjtJQUV0RCxXQUFXO0lBQ0ssTUFBTSxDQUFtQjtJQUN6QixHQUFHLENBQW1CO0lBQ3RCLFNBQVMsQ0FBMkI7SUFFcEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFrQztRQUMxRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixtQkFBbUI7UUFDbkIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUUzQixNQUFNLEVBQ0osV0FBVyxFQUNYLFdBQVcsRUFDWCxjQUFjLEdBQUcsSUFBSSxFQUNyQixnQkFBZ0IsR0FBRyxJQUFJLEVBQ3ZCLGFBQWEsR0FBRyxLQUFLLEVBQ3JCLGNBQWMsR0FBRyxLQUFLLEVBQ3RCLGNBQWMsR0FBRyxFQUFFLEVBQ25CLGdCQUFnQixHQUFHLEVBQUUsRUFDckIsYUFBYSxHQUFHLEVBQUUsRUFDbEIsY0FBYyxHQUFHLEVBQUUsRUFDcEIsR0FBRyxLQUFLLENBQUM7UUFFVixvQ0FBb0M7UUFDcEMsSUFBSSxjQUFjLEVBQUUsQ0FBQztZQUNuQixNQUFNLG9CQUFvQixHQUFHLElBQUksQ0FBQyxXQUFXLENBQzNDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxXQUFXLEVB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QUN4QixPQUFPO1lBQ0wsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLGdCQUFnQjtZQUN2QyxlQUFlLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixFQUFFLGVBQWUsSUFBSSxJQUFJO1lBQy9ELFlBQVksRUFBRSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsWUFBWSxJQUFJLElBQUk7WUFDekQsYUFBYSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxhQUFhLElBQUksSUFBSTtTQUM1RCxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0ksb0JBQW9CO1FBQ3pCLE9BQU87WUFDTCxpQkFBaUIsRUFBRSxJQUFJLENBQUMsaUJBQWlCO1lBQ3pDLFlBQVksRUFBRSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsWUFBWSxJQUFJLEVBQUU7WUFDeEQscUJBQXFCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixFQUFFLHFCQUFxQixJQUFJLEVBQUU7U0FDM0UsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQXptQkQsd0RBeW1CQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog57Wx5LiA57Wx5ZCI44K544K/44OD44KvXG4gKiBcbiAqIOWNmOS4gOOCueOCv+ODg+OCr+WGheOBp+OCs+ODs+OCueODiOODqeOCr+ODiOOCkuebtOaOpeS9v+eUqOOBmeOCi+e1seWQiOOCouODl+ODreODvOODgVxuICog44K544K/44OD44Kv6ZaT5Y+C54Wn44Gu5ZWP6aGM44KS5Zue6YG/44GX44CB44K344Oz44OX44Or44Gq5qeL6YCg44KS5a6f54++XG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgU2VjdXJpdHlDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi9tb2R1bGVzL3NlY3VyaXR5L2NvbnN0cnVjdHMvc2VjdXJpdHktY29uc3RydWN0JztcbmltcG9ydCB7IE5ldHdvcmtpbmdDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi9tb2R1bGVzL25ldHdvcmtpbmcvY29uc3RydWN0cy9uZXR3b3JraW5nLWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBTdG9yYWdlQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9zdG9yYWdlL2NvbnN0cnVjdHMvc3RvcmFnZS1jb25zdHJ1Y3QnO1xuaW1wb3J0IHsgRGF0YWJhc2VDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi9tb2R1bGVzL2RhdGFiYXNlL2NvbnN0cnVjdHMvZGF0YWJhc2UtY29uc3RydWN0JztcbmltcG9ydCB7IFNlY3VyaXR5Q29uZmlnIH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9zZWN1cml0eS9pbnRlcmZhY2VzL3NlY3VyaXR5LWNvbmZpZyc7XG5pbXBvcnQgeyBOZXR3b3JraW5nQ29uZmlnIH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9uZXR3b3JraW5nL2ludGVyZmFjZXMvbmV0d29ya2luZy1jb25maWcnO1xuaW1wb3J0IHsgU3RvcmFnZUNvbmZpZyB9IGZyb20gJy4uLy4uL21vZHVsZXMvc3RvcmFnZS9pbnRlcmZhY2VzL3N0b3JhZ2UtY29uZmlnJztcbmltcG9ydCB7IERhdGFiYXNlQ29uZmlnIH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9kYXRhYmFzZS9pbnRlcmZhY2VzL2RhdGFiYXNlLWNvbmZpZyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVW5pZmllZEludGVncmF0ZWRTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICAvKiog44OX44Ot44K444Kn44Kv44OI5ZCN77yI6Iux5pWw5a2X44CB44OP44Kk44OV44Oz44CB44Ki44Oz44OA44O844K544Kz44Ki44Gu44G/6Kix5Y+v77yJICovXG4gIHByb2plY3ROYW1lOiBzdHJpbmc7XG4gIC8qKiDnkrDlooPlkI3vvIjljrPlr4bjgarlnovliLbntITvvIkgKi9cbiAgZW52aXJvbm1lbnQ6ICdkZXYnIHwgJ3N0YWdpbmcnIHwgJ3Byb2QnIHwgJ3Rlc3QnO1xuICBcbiAgLy8g5qmf6IO944OV44Op44KwXG4gIGVuYWJsZVNlY3VyaXR5PzogYm9vbGVhbjtcbiAgZW5hYmxlTmV0d29ya2luZz86IGJvb2xlYW47XG4gIGVuYWJsZVN0b3JhZ2U/OiBib29sZWFuO1xuICBlbmFibGVEYXRhYmFzZT86IGJvb2xlYW47XG4gIFxuICAvLyDoqK3lrprjgqrjg7zjg5Djg7zjg6njgqTjg4lcbiAgc2VjdXJpdHlDb25maWc/OiBQYXJ0aWFsPFNlY3VyaXR5Q29uZmlnPjtcbiAgbmV0d29ya2luZ0NvbmZpZz86IFBhcnRpYWw8TmV0d29ya2luZ0NvbmZpZz47XG4gIHN0b3JhZ2VDb25maWc/OiBQYXJ0aWFsPFN0b3JhZ2VDb25maWc+O1xuICBkYXRhYmFzZUNvbmZpZz86IFBhcnRpYWw8RGF0YWJhc2VDb25maWc+O1xufVxuXG5leHBvcnQgY2xhc3MgVW5pZmllZEludGVncmF0ZWRTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIC8vIOOCs+ODs+OCueODiOODqeOCr+ODiOOCpOODs+OCueOCv+ODs+OCuVxuICBwdWJsaWMgcmVhZG9ubHkgc2VjdXJpdHlDb25zdHJ1Y3Q/OiBTZWN1cml0eUNvbnN0cnVjdDtcbiAgcHVibGljIHJlYWRvbmx5IG5ldHdvcmtpbmdDb25zdHJ1Y3Q/OiBOZXR3b3JraW5nQ29uc3RydWN0O1xuICBwdWJsaWMgcmVhZG9ubHkgc3RvcmFnZUNvbnN0cnVjdD86IFN0b3JhZ2VDb25zdHJ1Y3Q7XG4gIHB1YmxpYyByZWFkb25seSBkYXRhYmFzZUNvbnN0cnVjdD86IERhdGFiYXNlQ29uc3RydWN0O1xuXG4gIC8vIOS4u+imgeODquOCveODvOOCueWPgueFp1xuICBwdWJsaWMgcmVhZG9ubHkga21zS2V5PzogY2RrLmF3c19rbXMuS2V5O1xuICBwdWJsaWMgcmVhZG9ubHkgdnBjPzogY2RrLmF3c19lYzIuVnBjO1xuICBwdWJsaWMgcmVhZG9ubHkgd2FmV2ViQWNsPzogY2RrLmF3c193YWZ2Mi5DZm5XZWJBQ0w7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFVuaWZpZWRJbnRlZ3JhdGVkU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8g5YWl5Yqb5YCk44Gu5qSc6Ki877yI44K744Kt44Ol44Oq44OG44Kj5by35YyW77yJXG4gICAgdGhpcy52YWxpZGF0ZUlucHV0cyhwcm9wcyk7XG5cbiAgICBjb25zdCB7IFxuICAgICAgcHJvamVjdE5hbWUsIFxuICAgICAgZW52aXJvbm1lbnQsIFxuICAgICAgZW5hYmxlU2VjdXJpdHkgPSB0cnVlLFxuICAgICAgZW5hYmxlTmV0d29ya2luZyA9IHRydWUsXG4gICAgICBlbmFibGVTdG9yYWdlID0gZmFsc2UsXG4gICAgICBlbmFibGVEYXRhYmFzZSA9IGZhbHNlLFxuICAgICAgc2VjdXJpdHlDb25maWcgPSB7fSxcbiAgICAgIG5ldHdvcmtpbmdDb25maWcgPSB7fSxcbiAgICAgIHN0b3JhZ2VDb25maWcgPSB7fSxcbiAgICAgIGRhdGFiYXNlQ29uZmlnID0ge31cbiAgICB9ID0gcHJvcHM7XG5cbiAgICAvLyAxLiDjgrvjgq3jg6Xjg6rjg4bjgqPjgrPjg7Pjgrnjg4jjg6njgq/jg4jvvIjpgYXlu7bliJ3mnJ/ljJbjgafjg5Hjg5Xjgqnjg7zjg57jg7PjgrnlkJHkuIrvvIlcbiAgICBpZiAoZW5hYmxlU2VjdXJpdHkpIHtcbiAgICAgIGNvbnN0IG1lcmdlZFNlY3VyaXR5Q29uZmlnID0gdGhpcy5tZXJnZUNvbmZpZyhcbiAgICAgICAgdGhpcy5nZXREZWZhdWx0U2VjdXJpdHlDb25maWcocHJvamVjdE5hbWUsIGVudmlyb25tZW50KSwgXG4gICAgICAgIHNlY3VyaXR5Q29uZmlnXG4gICAgICApO1xuXG4gICAgICB0aGlzLnNlY3VyaXR5Q29uc3RydWN0ID0gbmV3IFNlY3VyaXR5Q29uc3RydWN0KHRoaXMsICdTZWN1cml0eScsIHtcbiAgICAgICAgY29uZmlnOiBtZXJnZWRTZWN1cml0eUNvbmZpZyxcbiAgICAgICAgcHJvamVjdE5hbWUsXG4gICAgICAgIGVudmlyb25tZW50LFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMua21zS2V5ID0gdGhpcy5zZWN1cml0eUNvbnN0cnVjdC5rbXNLZXk7XG4gICAgICB0aGlzLndhZldlYkFjbCA9IHRoaXMuc2VjdXJpdHlDb25zdHJ1Y3Qud2FmV2ViQWNsO1xuICAgIH1cblxuICAgIC8vIDIuIOODjeODg+ODiOODr+ODvOOCreODs+OCsOOCs+ODs+OCueODiOODqeOCr+ODiFxuICAgIGlmIChlbmFibGVOZXR3b3JraW5nKSB7XG4gICAgICBjb25zdCBtZXJnZWROZXR3b3JraW5nQ29uZmlnID0gdGhpcy5tZXJnZUNvbmZpZyhcbiAgICAgICAgdGhpcy5nZXREZWZhdWx0TmV0d29ya2luZ0NvbmZpZygpLCBcbiAgICAgICAgbmV0d29ya2luZ0NvbmZpZ1xuICAgICAgKTtcblxuICAgICAgdGhpcy5uZXR3b3JraW5nQ29uc3RydWN0ID0gbmV3IE5ldHdvcmtpbmdDb25zdHJ1Y3QodGhpcywgJ05ldHdvcmtpbmcnLCB7XG4gICAgICAgIGNvbmZpZzogbWVyZ2VkTmV0d29ya2luZ0NvbmZpZyxcbiAgICAgICAgcHJvamVjdE5hbWUsXG4gICAgICAgIGVudmlyb25tZW50LFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMudnBjID0gdGhpcy5uZXR3b3JraW5nQ29uc3RydWN0LnZwYztcbiAgICB9XG5cbiAgICAvLyAzLiDjgrnjg4jjg6zjg7zjgrjjgrPjg7Pjgrnjg4jjg6njgq/jg4jvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICBpZiAoZW5hYmxlU3RvcmFnZSAmJiB0aGlzLnZwYyAmJiB0aGlzLmttc0tleSkge1xuICAgICAgY29uc3QgZGVmYXVsdFN0b3JhZ2VDb25maWc6IFN0b3JhZ2VDb25maWcgPSB7XG4gICAgICAgIHMzOiB7XG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBkb2N1bWVudHNCdWNrZXQ6IHtcbiAgICAgICAgICAgIHZlcnNpb25lZDogdHJ1ZSxcbiAgICAgICAgICAgIGVuY3J5cHRpb246IHtcbiAgICAgICAgICAgICAgdHlwZTogJ0tNUycsXG4gICAgICAgICAgICAgIGttc0tleUlkOiB0aGlzLmttc0tleT8ua2V5SWQsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbGlmZWN5Y2xlOiB7XG4gICAgICAgICAgICAgIHRyYW5zaXRpb25Ub0lBRGF5czogMzAsXG4gICAgICAgICAgICAgIHRyYW5zaXRpb25Ub0dsYWNpZXJEYXlzOiA5MCxcbiAgICAgICAgICAgICAgZXhwaXJhdGlvbkRheXM6IDM2NSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBiYWNrdXBCdWNrZXQ6IHtcbiAgICAgICAgICAgIHZlcnNpb25lZDogdHJ1ZSxcbiAgICAgICAgICAgIGVuY3J5cHRpb246IHtcbiAgICAgICAgICAgICAgdHlwZTogJ0tNUycsXG4gICAgICAgICAgICAgIGttc0tleUlkOiB0aGlzLmttc0tleT8ua2V5SWQsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGZzeDoge1xuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgZmlsZVN5c3RlbToge1xuICAgICAgICAgICAgc3RvcmFnZUNhcGFjaXR5OiAxMDI0LFxuICAgICAgICAgICAgZGVwbG95bWVudFR5cGU6ICdNVUxUSV9BWl8xJyxcbiAgICAgICAgICAgIHRocm91Z2hwdXRDYXBhY2l0eTogMTI4LFxuICAgICAgICAgICAgYXV0b21hdGljQmFja3VwOiB7XG4gICAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICAgIHJldGVudGlvbkRheXM6IDcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc3ZtOiB7XG4gICAgICAgICAgICBuYW1lOiBgJHtwcm9qZWN0TmFtZX0tc3ZtYCxcbiAgICAgICAgICAgIG5ldEJpb3NOYW1lOiBgJHtwcm9qZWN0TmFtZS50b1VwcGVyQ2FzZSgpfVNWTWAsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB2b2x1bWVzOiB7XG4gICAgICAgICAgICBkYXRhVm9sdW1lOiB7XG4gICAgICAgICAgICAgIG5hbWU6ICdkYXRhJyxcbiAgICAgICAgICAgICAgc2l6ZUluR2I6IDEwMCxcbiAgICAgICAgICAgICAganVuY3Rpb25QYXRoOiAnL2RhdGEnLFxuICAgICAgICAgICAgICBzZWN1cml0eVN0eWxlOiAnTlRGUycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZGF0YWJhc2VWb2x1bWU6IHtcbiAgICAgICAgICAgICAgbmFtZTogJ2RhdGFiYXNlJyxcbiAgICAgICAgICAgICAgc2l6ZUluR2I6IDUwLFxuICAgICAgICAgICAgICBqdW5jdGlvblBhdGg6ICcvZGF0YWJhc2UnLFxuICAgICAgICAgICAgICBzZWN1cml0eVN0eWxlOiAnVU5JWCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGVjcjoge1xuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgcmVwb3NpdG9yaWVzOiB7XG4gICAgICAgICAgICBuZXh0anM6IHtcbiAgICAgICAgICAgICAgcmVwb3NpdG9yeU5hbWU6IGAke3Byb2plY3ROYW1lfS1uZXh0anNgLFxuICAgICAgICAgICAgICBpbWFnZVNjYW5PblB1c2g6IHRydWUsXG4gICAgICAgICAgICAgIGxpZmVjeWNsZToge1xuICAgICAgICAgICAgICAgIG1heEltYWdlQ291bnQ6IDEwLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGVtYmVkZGluZzoge1xuICAgICAgICAgICAgICByZXBvc2l0b3J5TmFtZTogYCR7cHJvamVjdE5hbWV9LWVtYmVkZGluZ2AsXG4gICAgICAgICAgICAgIGltYWdlU2Nhbk9uUHVzaDogdHJ1ZSxcbiAgICAgICAgICAgICAgbGlmZWN5Y2xlOiB7XG4gICAgICAgICAgICAgICAgbWF4SW1hZ2VDb3VudDogNSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgdGFnczoge1xuICAgICAgICAgIFN0b3JhZ2VUeXBlOiAnSHlicmlkJyxcbiAgICAgICAgICBEYXRhQ2xhc3NpZmljYXRpb246ICdDb25maWRlbnRpYWwnLFxuICAgICAgICAgIEJhY2t1cFJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIEVuY3J5cHRpb25SZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICBDb21wbGlhbmNlRnJhbWV3b3JrOiAnU09DMicsXG4gICAgICAgIH0sXG4gICAgICB9O1xuXG4gICAgICBjb25zdCBtZXJnZWRTdG9yYWdlQ29uZmlnID0gdGhpcy5tZXJnZUNvbmZpZyhkZWZhdWx0U3RvcmFnZUNvbmZpZywgc3RvcmFnZUNvbmZpZyk7XG5cbiAgICAgIHRoaXMuc3RvcmFnZUNvbnN0cnVjdCA9IG5ldyBTdG9yYWdlQ29uc3RydWN0KHRoaXMsICdTdG9yYWdlJywge1xuICAgICAgICBjb25maWc6IG1lcmdlZFN0b3JhZ2VDb25maWcsXG4gICAgICAgIHByb2plY3ROYW1lLFxuICAgICAgICBlbnZpcm9ubWVudCxcbiAgICAgICAgdnBjOiB0aGlzLnZwYyxcbiAgICAgICAga21zS2V5OiB0aGlzLmttc0tleSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIDQuIOODh+ODvOOCv+ODmeODvOOCueOCs+ODs+OCueODiOODqeOCr+ODiO+8iOOCquODl+OCt+ODp+ODs++8iVxuICAgIGlmIChlbmFibGVEYXRhYmFzZSAmJiB0aGlzLmttc0tleSkge1xuICAgICAgY29uc3QgZGVmYXVsdERhdGFiYXNlQ29uZmlnOiBEYXRhYmFzZUNvbmZpZyA9IHtcbiAgICAgICAgZHluYW1vZGI6IHtcbiAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgIHRhYmxlczoge1xuICAgICAgICAgICAgc2Vzc2lvblRhYmxlOiB7XG4gICAgICAgICAgICAgIHRhYmxlTmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LXNlc3Npb25zYCxcbiAgICAgICAgICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdzZXNzaW9uSWQnLCB0eXBlOiBjZGsuYXdzX2R5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICAgICAgICAgIGJpbGxpbmdNb2RlOiBjZGsuYXdzX2R5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgICAgICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcbiAgICAgICAgICAgICAgZGVsZXRpb25Qcm90ZWN0aW9uOiBmYWxzZSxcbiAgICAgICAgICAgICAgdGltZVRvTGl2ZToge1xuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZTogJ3R0bCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdXNlclRhYmxlOiB7XG4gICAgICAgICAgICAgIHRhYmxlTmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LXVzZXJzYCxcbiAgICAgICAgICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd1c2VySWQnLCB0eXBlOiBjZGsuYXdzX2R5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICAgICAgICAgIGJpbGxpbmdNb2RlOiBjZGsuYXdzX2R5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgICAgICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcbiAgICAgICAgICAgICAgZGVsZXRpb25Qcm90ZWN0aW9uOiBmYWxzZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBkb2N1bWVudE1ldGFkYXRhVGFibGU6IHtcbiAgICAgICAgICAgICAgdGFibGVOYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tZG9jdW1lbnQtbWV0YWRhdGFgLFxuICAgICAgICAgICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2RvY3VtZW50SWQnLCB0eXBlOiBjZGsuYXdzX2R5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICAgICAgICAgIGJpbGxpbmdNb2RlOiBjZGsuYXdzX2R5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgICAgICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcbiAgICAgICAgICAgICAgZGVsZXRpb25Qcm90ZWN0aW9uOiBmYWxzZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjaGF0SGlzdG9yeVRhYmxlOiB7XG4gICAgICAgICAgICAgIHRhYmxlTmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWNoYXQtaGlzdG9yeWAsXG4gICAgICAgICAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnY2hhdElkJywgdHlwZTogY2RrLmF3c19keW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgICAgICAgICBzb3J0S2V5OiB7IG5hbWU6ICd0aW1lc3RhbXAnLCB0eXBlOiBjZGsuYXdzX2R5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSIH0sXG4gICAgICAgICAgICAgIGJpbGxpbmdNb2RlOiBjZGsuYXdzX2R5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgICAgICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcbiAgICAgICAgICAgICAgZGVsZXRpb25Qcm90ZWN0aW9uOiBmYWxzZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgb3BlbnNlYXJjaDoge1xuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgY29sbGVjdGlvbnM6IHtcbiAgICAgICAgICAgIHZlY3RvckNvbGxlY3Rpb246IHtcbiAgICAgICAgICAgICAgbmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LXZlY3RvcnNgLFxuICAgICAgICAgICAgICB0eXBlOiAnVkVDVE9SU0VBUkNIJyxcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdEb2N1bWVudCB2ZWN0b3Igc2VhcmNoIGNvbGxlY3Rpb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGxvZ3NDb2xsZWN0aW9uOiB7XG4gICAgICAgICAgICAgIG5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1sb2dzYCxcbiAgICAgICAgICAgICAgdHlwZTogJ1NFQVJDSCcsXG4gICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQXBwbGljYXRpb24gbG9ncyBjb2xsZWN0aW9uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzZWN1cml0eVBvbGljeToge1xuICAgICAgICAgICAgZW5jcnlwdGlvblBvbGljeU5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1lbmNyeXB0aW9uLXBvbGljeWAsXG4gICAgICAgICAgICBuZXR3b3JrUG9saWN5TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LW5ldHdvcmstcG9saWN5YCxcbiAgICAgICAgICAgIGRhdGFBY2Nlc3NQb2xpY3lOYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tZGF0YS1hY2Nlc3MtcG9saWN5YCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGluZGljZXM6IHtcbiAgICAgICAgICAgIHZlY3RvckluZGV4OiB7XG4gICAgICAgICAgICAgIG5hbWU6ICdkb2N1bWVudC12ZWN0b3JzJyxcbiAgICAgICAgICAgICAgdmVjdG9yRGltZW5zaW9uczogMTUzNixcbiAgICAgICAgICAgICAgZGlzdGFuY2VNZXRyaWM6ICdjb3NpbmUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBzcWxpdGU6IHtcbiAgICAgICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICAgICAgICB1cHNlcnRNYW5hZ2VyOiB7XG4gICAgICAgICAgICBiYXRjaFNpemU6IDEwMCxcbiAgICAgICAgICAgIG1heFJldHJpZXM6IDMsXG4gICAgICAgICAgICB0aW1lb3V0U2Vjb25kczogMzAsXG4gICAgICAgICAgICBjb25jdXJyZW5jeTogNSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGRhdGFiYXNlOiB7XG4gICAgICAgICAgICBmaWxlUGF0aDogJy90bXAvYXBwLmRiJyxcbiAgICAgICAgICAgIGNvbm5lY3Rpb25Qb29sOiB7XG4gICAgICAgICAgICAgIG1heENvbm5lY3Rpb25zOiAxMCxcbiAgICAgICAgICAgICAgaWRsZVRpbWVvdXRTZWNvbmRzOiAzMDAsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHRhZ3M6IHtcbiAgICAgICAgICBEYXRhYmFzZVR5cGU6ICdOb1NRTCcsXG4gICAgICAgICAgRGF0YUNsYXNzaWZpY2F0aW9uOiAnQ29uZmlkZW50aWFsJyxcbiAgICAgICAgICBCYWNrdXBSZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICBFbmNyeXB0aW9uUmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgUGVyZm9ybWFuY2VUaWVyOiAnSGlnaCcsXG4gICAgICAgICAgQ29tcGxpYW5jZUZyYW1ld29yazogJ1NPQzInLFxuICAgICAgICB9LFxuICAgICAgfTtcblxuICAgICAgY29uc3QgbWVyZ2VkRGF0YWJhc2VDb25maWcgPSB0aGlzLm1lcmdlQ29uZmlnKGRlZmF1bHREYXRhYmFzZUNvbmZpZywgZGF0YWJhc2VDb25maWcpO1xuXG4gICAgICB0aGlzLmRhdGFiYXNlQ29uc3RydWN0ID0gbmV3IERhdGFiYXNlQ29uc3RydWN0KHRoaXMsICdEYXRhYmFzZScsIHtcbiAgICAgICAgY29uZmlnOiBtZXJnZWREYXRhYmFzZUNvbmZpZyxcbiAgICAgICAgcHJvamVjdE5hbWUsXG4gICAgICAgIGVudmlyb25tZW50LFxuICAgICAgICBrbXNLZXk6IHRoaXMua21zS2V5LFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQ2xvdWRGb3JtYXRpb27lh7rliptcbiAgICB0aGlzLmNyZWF0ZU91dHB1dHMoKTtcblxuICAgIC8vIOOCueOCv+ODg+OCr+ODrOODmeODq+OBruOCv+OCsOioreWumlxuICAgIHRoaXMuYXBwbHlTdGFja1RhZ3MocHJvamVjdE5hbWUsIGVudmlyb25tZW50KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDoqK3lrprjga7jg57jg7zjgrjvvIjmt7HjgYTjg57jg7zjgrjvvIlcbiAgICovXG4gIHByaXZhdGUgbWVyZ2VDb25maWc8VD4oZGVmYXVsdENvbmZpZzogVCwgb3ZlcnJpZGVDb25maWc6IFBhcnRpYWw8VD4pOiBUIHtcbiAgICByZXR1cm4gdGhpcy5kZWVwTWVyZ2UoZGVmYXVsdENvbmZpZywgb3ZlcnJpZGVDb25maWcpO1xuICB9XG5cbiAgLyoqXG4gICAqIOa3seOBhOODnuODvOOCuOWun+ijhe+8iOWei+WuieWFqOaAp+OBqOODkeODleOCqeODvOODnuODs+OCueWQkeS4iu+8iVxuICAgKi9cbiAgcHJpdmF0ZSBkZWVwTWVyZ2U8VD4odGFyZ2V0OiBULCBzb3VyY2U6IFBhcnRpYWw8VD4pOiBUIHtcbiAgICAvLyBudWxsL3VuZGVmaW5lZOODgeOCp+ODg+OCr+OCkuacgOWIneOBq+Wun+ihjFxuICAgIGlmICghdGFyZ2V0IHx8ICFzb3VyY2UpIHtcbiAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0ID0geyAuLi50YXJnZXQgfTtcbiAgICBcbiAgICAvLyBPYmplY3Qua2V5c+OCkuS9v+eUqOOBl+OBpuOCiOOCiuWuieWFqOOBquWPjeW+qeWHpueQhlxuICAgIE9iamVjdC5rZXlzKHNvdXJjZSkuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgY29uc3QgdHlwZWRLZXkgPSBrZXkgYXMga2V5b2YgVDtcbiAgICAgIGNvbnN0IHNvdXJjZVZhbHVlID0gc291cmNlW3R5cGVkS2V5XTtcbiAgICAgIGNvbnN0IHRhcmdldFZhbHVlID0gcmVzdWx0W3R5cGVkS2V5XTtcbiAgICAgIFxuICAgICAgaWYgKHNvdXJjZVZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgLy8g44KI44KK5Y6z5a+G44Gq5Z6L44OB44Kn44OD44KvXG4gICAgICAgIGlmICh0aGlzLmlzUGxhaW5PYmplY3Qoc291cmNlVmFsdWUpICYmIHRoaXMuaXNQbGFpbk9iamVjdCh0YXJnZXRWYWx1ZSkpIHtcbiAgICAgICAgICByZXN1bHRbdHlwZWRLZXldID0gdGhpcy5kZWVwTWVyZ2UodGFyZ2V0VmFsdWUsIHNvdXJjZVZhbHVlIGFzIFBhcnRpYWw8VFtrZXlvZiBUXT4pIGFzIFRba2V5b2YgVF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdWx0W3R5cGVkS2V5XSA9IHNvdXJjZVZhbHVlIGFzIFRba2V5b2YgVF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICBcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIOODl+ODrOODvOODs+OCquODluOCuOOCp+OCr+ODiOOBi+OBqeOBhuOBi+OCkuWIpOWumlxuICAgKi9cbiAgcHJpdmF0ZSBpc1BsYWluT2JqZWN0KG9iajogdW5rbm93bik6IG9iaiBpcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gICAgcmV0dXJuIHR5cGVvZiBvYmogPT09ICdvYmplY3QnICYmIFxuICAgICAgICAgICBvYmogIT09IG51bGwgJiYgXG4gICAgICAgICAgICFBcnJheS5pc0FycmF5KG9iaikgJiYgXG4gICAgICAgICAgIG9iai5jb25zdHJ1Y3RvciA9PT0gT2JqZWN0O1xuICB9XG5cbiAgLyoqXG4gICAqIOWFpeWKm+WApOOBruaknOiovO+8iOOCu+OCreODpeODquODhuOCo+Wvvuetlu+8iVxuICAgKi9cbiAgcHJpdmF0ZSB2YWxpZGF0ZUlucHV0cyhwcm9wczogVW5pZmllZEludGVncmF0ZWRTdGFja1Byb3BzKTogdm9pZCB7XG4gICAgY29uc3QgeyBwcm9qZWN0TmFtZSwgZW52aXJvbm1lbnQgfSA9IHByb3BzO1xuXG4gICAgLy8g44OX44Ot44K444Kn44Kv44OI5ZCN44Gu5qSc6Ki8XG4gICAgaWYgKCFwcm9qZWN0TmFtZSB8fCB0eXBlb2YgcHJvamVjdE5hbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+ODl+ODreOCuOOCp+OCr+ODiOWQjeOBjOioreWumuOBleOCjOOBpuOBhOOBvuOBm+OCkycpO1xuICAgIH1cblxuICAgIGlmIChwcm9qZWN0TmFtZS50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+ODl+ODreOCuOOCp+OCr+ODiOWQjeOBjOepuuaWh+Wtl+OBp+OBmScpO1xuICAgIH1cblxuICAgIGlmIChwcm9qZWN0TmFtZS5sZW5ndGggPiA1MCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCfjg5fjg63jgrjjgqfjgq/jg4jlkI3jga81MOaWh+Wtl+S7peWGheOBp+ioreWumuOBl+OBpuOBj+OBoOOBleOBhCcpO1xuICAgIH1cblxuICAgIC8vIOOCu+OCreODpeODquODhuOCozog5a6J5YWo44Gq5paH5a2X44Gu44G/6Kix5Y+vXG4gICAgaWYgKCEvXlthLXpBLVowLTlcXC1fXSskLy50ZXN0KHByb2plY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCfjg5fjg63jgrjjgqfjgq/jg4jlkI3jgavkuI3mraPjgarmloflrZfjgYzlkKvjgb7jgozjgabjgYTjgb7jgZnvvIjoi7HmlbDlrZfjgIHjg4/jgqTjg5Xjg7PjgIHjgqLjg7Pjg4Djg7zjgrnjgrPjgqLjga7jgb/oqLHlj6/vvIknKTtcbiAgICB9XG5cbiAgICAvLyDnkrDlooPlkI3jga7mpJzoqLxcbiAgICBjb25zdCB2YWxpZEVudmlyb25tZW50cyA9IFsnZGV2JywgJ3N0YWdpbmcnLCAncHJvZCcsICd0ZXN0J10gYXMgY29uc3Q7XG4gICAgaWYgKCF2YWxpZEVudmlyb25tZW50cy5pbmNsdWRlcyhlbnZpcm9ubWVudCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihg55Kw5aKD5ZCN44Gv5qyh44Gu44GE44Ga44KM44GL44KS5oyH5a6a44GX44Gm44GP44Gg44GV44GEOiAke3ZhbGlkRW52aXJvbm1lbnRzLmpvaW4oJywgJyl9YCk7XG4gICAgfVxuXG4gICAgLy8g44Oq44K944O844K55ZCN44Gu6ZW344GV5Yi26ZmQ44OB44Kn44OD44Kv77yIQVdT5Yi26ZmQ5a++5b+c77yJXG4gICAgY29uc3QgcmVzb3VyY2VOYW1lUHJlZml4ID0gYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9YDtcbiAgICBpZiAocmVzb3VyY2VOYW1lUHJlZml4Lmxlbmd0aCA+IDQwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+ODl+ODreOCuOOCp+OCr+ODiOWQjeOBqOeSsOWig+WQjeOBrue1hOOBv+WQiOOCj+OBm+OBjOmVt+OBmeOBjuOBvuOBme+8iDQw5paH5a2X5Lul5YaF77yJJyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODh+ODleOCqeODq+ODiOOCu+OCreODpeODquODhuOCo+ioreWumuOBruWPluW+l++8iOODoeODouODquWKueeOh+WMlu+8iVxuICAgKi9cbiAgcHJpdmF0ZSBnZXREZWZhdWx0U2VjdXJpdHlDb25maWcocHJvamVjdE5hbWU6IHN0cmluZywgZW52aXJvbm1lbnQ6IHN0cmluZyk6IFNlY3VyaXR5Q29uZmlnIHtcbiAgICByZXR1cm4ge1xuICAgICAga21zOiB7XG4gICAgICAgIGVuYWJsZUtleVJvdGF0aW9uOiB0cnVlLFxuICAgICAgICBrZXlTcGVjOiAnU1lNTUVUUklDX0RFRkFVTFQnLFxuICAgICAgICBrZXlVc2FnZTogJ0VOQ1JZUFRfREVDUllQVCcsXG4gICAgICB9LFxuICAgICAgd2FmOiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIHNjb3BlOiAnUkVHSU9OQUwnLFxuICAgICAgICBydWxlczoge1xuICAgICAgICAgIGVuYWJsZUFXU01hbmFnZWRSdWxlczogdHJ1ZSxcbiAgICAgICAgICBlbmFibGVSYXRlTGltaXRpbmc6IHRydWUsXG4gICAgICAgICAgcmF0ZUxpbWl0OiAyMDAwLFxuICAgICAgICAgIGVuYWJsZUdlb0Jsb2NraW5nOiBmYWxzZSxcbiAgICAgICAgICBibG9ja2VkQ291bnRyaWVzOiBbXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBjbG91ZFRyYWlsOiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIHMzQnVja2V0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWNsb3VkdHJhaWxgLFxuICAgICAgICBpbmNsdWRlR2xvYmFsU2VydmljZUV2ZW50czogdHJ1ZSxcbiAgICAgICAgaXNNdWx0aVJlZ2lvblRyYWlsOiB0cnVlLFxuICAgICAgICBlbmFibGVMb2dGaWxlVmFsaWRhdGlvbjogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICB0YWdzOiB7XG4gICAgICAgIFNlY3VyaXR5TGV2ZWw6ICdIaWdoJyxcbiAgICAgICAgRW5jcnlwdGlvblJlcXVpcmVkOiB0cnVlLFxuICAgICAgICBDb21wbGlhbmNlRnJhbWV3b3JrOiAnU09DMicsXG4gICAgICAgIERhdGFDbGFzc2lmaWNhdGlvbjogJ0NvbmZpZGVudGlhbCcsXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog44OH44OV44Kp44Or44OI44ON44OD44OI44Ov44O844Kt44Oz44Kw6Kit5a6a44Gu5Y+W5b6X77yI44Oh44Oi44Oq5Yq5546H5YyW77yJXG4gICAqL1xuICBwcml2YXRlIGdldERlZmF1bHROZXR3b3JraW5nQ29uZmlnKCk6IE5ldHdvcmtpbmdDb25maWcge1xuICAgIHJldHVybiB7XG4gICAgICB2cGNDaWRyOiAnMTAuMC4wLjAvMTYnLFxuICAgICAgbWF4QXpzOiAzLFxuICAgICAgZW5hYmxlUHVibGljU3VibmV0czogdHJ1ZSxcbiAgICAgIGVuYWJsZVByaXZhdGVTdWJuZXRzOiB0cnVlLFxuICAgICAgZW5hYmxlSXNvbGF0ZWRTdWJuZXRzOiB0cnVlLFxuICAgICAgZW5hYmxlTmF0R2F0ZXdheTogdHJ1ZSxcbiAgICAgIGVuYWJsZURuc0hvc3RuYW1lczogdHJ1ZSxcbiAgICAgIGVuYWJsZURuc1N1cHBvcnQ6IHRydWUsXG4gICAgICBlbmFibGVGbG93TG9nczogdHJ1ZSxcbiAgICAgIHZwY0VuZHBvaW50czoge1xuICAgICAgICBzMzogdHJ1ZSxcbiAgICAgICAgZHluYW1vZGI6IHRydWUsXG4gICAgICAgIGxhbWJkYTogdHJ1ZSxcbiAgICAgICAgb3BlbnNlYXJjaDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBzZWN1cml0eUdyb3Vwczoge1xuICAgICAgICB3ZWI6IHRydWUsXG4gICAgICAgIGFwaTogdHJ1ZSxcbiAgICAgICAgZGF0YWJhc2U6IHRydWUsXG4gICAgICAgIGxhbWJkYTogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbG91ZEZvcm1hdGlvbuWHuuWKm+OBruS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVPdXRwdXRzKCk6IHZvaWQge1xuICAgIC8vIOOCu+OCreODpeODquODhuOCo+WHuuWKm1xuICAgIGlmICh0aGlzLmttc0tleSkge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0ttc0tleUlkJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5rbXNLZXkua2V5SWQsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnS01TIEtleSBJRCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1LbXNLZXlJZGAsXG4gICAgICB9KTtcblxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0ttc0tleUFybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMua21zS2V5LmtleUFybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdLTVMgS2V5IEFSTicsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1LbXNLZXlBcm5gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMud2FmV2ViQWNsKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV2FmV2ViQWNsQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy53YWZXZWJBY2wuYXR0ckFybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdXQUYgV2ViQUNMIEFSTicsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1XYWZXZWJBY2xBcm5gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8g44ON44OD44OI44Ov44O844Kt44Oz44Kw5Ye65YqbXG4gICAgaWYgKHRoaXMudnBjKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVnBjSWQnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLnZwYy52cGNJZCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdWUEMgSUQnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tVnBjSWRgLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWcGNDaWRyJywge1xuICAgICAgICB2YWx1ZTogdGhpcy52cGMudnBjQ2lkckJsb2NrLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1ZQQyBDSURSIEJsb2NrJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVZwY0NpZHJgLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIOOCouODmeOCpOODqeODk+ODquODhuOCo+OCvuODvOODs1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0F2YWlsYWJpbGl0eVpvbmVzJywge1xuICAgICAgICB2YWx1ZTogdGhpcy52cGMuYXZhaWxhYmlsaXR5Wm9uZXMuam9pbignLCcpLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0F2YWlsYWJpbGl0eSBab25lcycsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BdmFpbGFiaWxpdHlab25lc2AsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyDjgrnjg4jjg6zjg7zjgrjlh7rliptcbiAgICBpZiAodGhpcy5zdG9yYWdlQ29uc3RydWN0KSB7XG4gICAgICBpZiAodGhpcy5zdG9yYWdlQ29uc3RydWN0LmRvY3VtZW50c0J1Y2tldCkge1xuICAgICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRG9jdW1lbnRzQnVja2V0TmFtZScsIHtcbiAgICAgICAgICB2YWx1ZTogdGhpcy5zdG9yYWdlQ29uc3RydWN0LmRvY3VtZW50c0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRG9jdW1lbnRzIFMzIEJ1Y2tldCBOYW1lJyxcbiAgICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tRG9jdW1lbnRzQnVja2V0TmFtZWAsXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5zdG9yYWdlQ29uc3RydWN0LmZzeEZpbGVTeXN0ZW0pIHtcbiAgICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0ZTeEZpbGVTeXN0ZW1JZCcsIHtcbiAgICAgICAgICB2YWx1ZTogdGhpcy5zdG9yYWdlQ29uc3RydWN0LmZzeEZpbGVTeXN0ZW0ucmVmLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRlN4IEZpbGUgU3lzdGVtIElEJyxcbiAgICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tRlN4RmlsZVN5c3RlbUlkYCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8g44OH44O844K/44OZ44O844K55Ye65YqbXG4gICAgaWYgKHRoaXMuZGF0YWJhc2VDb25zdHJ1Y3QpIHtcbiAgICAgIC8vIER5bmFtb0RCIOODhuODvOODluODq1xuICAgICAgT2JqZWN0LmVudHJpZXModGhpcy5kYXRhYmFzZUNvbnN0cnVjdC5keW5hbW9UYWJsZXMpLmZvckVhY2goKFtuYW1lLCB0YWJsZV0pID0+IHtcbiAgICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYER5bmFtb1RhYmxlJHtuYW1lfU5hbWVgLCB7XG4gICAgICAgICAgdmFsdWU6IHRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogYER5bmFtb0RCIFRhYmxlICR7bmFtZX0gTmFtZWAsXG4gICAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUR5bmFtb1RhYmxlJHtuYW1lfU5hbWVgLFxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBPcGVuU2VhcmNoIOOCs+ODrOOCr+OCt+ODp+ODs1xuICAgICAgT2JqZWN0LmVudHJpZXModGhpcy5kYXRhYmFzZUNvbnN0cnVjdC5vcGVuc2VhcmNoQ29sbGVjdGlvbnMpLmZvckVhY2goKFtuYW1lLCBjb2xsZWN0aW9uXSkgPT4ge1xuICAgICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgT3BlblNlYXJjaENvbGxlY3Rpb24ke25hbWV9RW5kcG9pbnRgLCB7XG4gICAgICAgICAgdmFsdWU6IGNvbGxlY3Rpb24uYXR0ckNvbGxlY3Rpb25FbmRwb2ludCxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogYE9wZW5TZWFyY2ggQ29sbGVjdGlvbiAke25hbWV9IEVuZHBvaW50YCxcbiAgICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tT3BlblNlYXJjaENvbGxlY3Rpb24ke25hbWV9RW5kcG9pbnRgLFxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjgrnjgr/jg4Pjgq/jg6zjg5njg6vjga7jgr/jgrDoqK3lrprvvIjkv53lrojmgKflkJHkuIrvvIlcbiAgICovXG4gIHByaXZhdGUgYXBwbHlTdGFja1RhZ3MocHJvamVjdE5hbWU6IHN0cmluZywgZW52aXJvbm1lbnQ6IHN0cmluZyk6IHZvaWQge1xuICAgIC8vIOOCv+OCsOWApOOBruOCteODi+OCv+OCpOOCuu+8iOOCu+OCreODpeODquODhuOCo+Wvvuetlu+8iVxuICAgIGNvbnN0IHNhbml0aXplZFByb2plY3ROYW1lID0gdGhpcy5zYW5pdGl6ZVRhZ1ZhbHVlKHByb2plY3ROYW1lKTtcbiAgICBjb25zdCBzYW5pdGl6ZWRFbnZpcm9ubWVudCA9IHRoaXMuc2FuaXRpemVUYWdWYWx1ZShlbnZpcm9ubWVudCk7XG4gICAgXG4gICAgY29uc3QgdGFncyA9IHtcbiAgICAgIFByb2plY3Q6IHNhbml0aXplZFByb2plY3ROYW1lLFxuICAgICAgRW52aXJvbm1lbnQ6IHNhbml0aXplZEVudmlyb25tZW50LFxuICAgICAgU3RhY2s6ICdVbmlmaWVkSW50ZWdyYXRlZFN0YWNrJyxcbiAgICAgIENvbXBvbmVudDogJ0ludGVncmF0aW9uJyxcbiAgICAgIE1hbmFnZWRCeTogJ0NESycsXG4gICAgICBBcmNoaXRlY3R1cmU6ICdVbmlmaWVkJyxcbiAgICAgIENvc3RDZW50ZXI6IGAke3Nhbml0aXplZFByb2plY3ROYW1lfS0ke3Nhbml0aXplZEVudmlyb25tZW50fS11bmlmaWVkYCxcbiAgICAgIENyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNwbGl0KCdUJylbMF0sXG4gICAgICBWZXJzaW9uOiAnMS4wLjAnXG4gICAgfTtcblxuICAgIC8vIOS4gOaLrOOBp+OCv+OCsOOCkumBqeeUqFxuICAgIE9iamVjdC5lbnRyaWVzKHRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKGtleSwgdmFsdWUpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCv+OCsOWApOOBruOCteODi+OCv+OCpOOCuu+8iOOCu+OCreODpeODquODhuOCo+Wvvuetlu+8iVxuICAgKi9cbiAgcHJpdmF0ZSBzYW5pdGl6ZVRhZ1ZhbHVlKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiB2YWx1ZVxuICAgICAgLnJlcGxhY2UoL1s8PlxcXCInJl0vZywgJycpIC8vIFhTU+WvvuetllxuICAgICAgLnN1YnN0cmluZygwLCAyNTYpIC8vIEFXUyDjgr/jgrDlgKTjga7mnIDlpKfplbfliLbpmZBcbiAgICAgIC50cmltKCk7XG4gIH1cblxuICAvKipcbiAgICog44K344K544OG44Og5oOF5aCx44Gu5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgZ2V0U3lzdGVtSW5mbygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3RhY2tOYW1lOiB0aGlzLnN0YWNrTmFtZSxcbiAgICAgIHJlZ2lvbjogdGhpcy5yZWdpb24sXG4gICAgICBhY2NvdW50OiB0aGlzLmFjY291bnQsXG4gICAgICBlbmFibGVkQ29tcG9uZW50czoge1xuICAgICAgICBzZWN1cml0eTogISF0aGlzLnNlY3VyaXR5Q29uc3RydWN0LFxuICAgICAgICBuZXR3b3JraW5nOiAhIXRoaXMubmV0d29ya2luZ0NvbnN0cnVjdCxcbiAgICAgICAgc3RvcmFnZTogISF0aGlzLnN0b3JhZ2VDb25zdHJ1Y3QsXG4gICAgICAgIGRhdGFiYXNlOiAhIXRoaXMuZGF0YWJhc2VDb25zdHJ1Y3QsXG4gICAgICB9LFxuICAgICAgcmVzb3VyY2VzOiB7XG4gICAgICAgIGttc0tleTogdGhpcy5rbXNLZXk/LmtleUFybiB8fCBudWxsLFxuICAgICAgICB2cGM6IHRoaXMudnBjPy52cGNJZCB8fCBudWxsLFxuICAgICAgICB3YWZXZWJBY2w6IHRoaXMud2FmV2ViQWNsPy5hdHRyQXJuIHx8IG51bGwsXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog44K744Kt44Ol44Oq44OG44Kj44Oq44K944O844K544Gu5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgZ2V0U2VjdXJpdHlSZXNvdXJjZXMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGttc0tleTogdGhpcy5rbXNLZXksXG4gICAgICB3YWZXZWJBY2w6IHRoaXMud2FmV2ViQWNsLFxuICAgICAgc2VjdXJpdHlDb25zdHJ1Y3Q6IHRoaXMuc2VjdXJpdHlDb25zdHJ1Y3QsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg43jg4Pjg4jjg6/jg7zjgq/jg6rjgr3jg7zjgrnjga7lj5blvpdcbiAgICovXG4gIHB1YmxpYyBnZXROZXR3b3JrUmVzb3VyY2VzKCkge1xuICAgIGlmICghdGhpcy5uZXR3b3JraW5nQ29uc3RydWN0KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgdnBjOiB0aGlzLnZwYyxcbiAgICAgIHB1YmxpY1N1Ym5ldHM6IHRoaXMubmV0d29ya2luZ0NvbnN0cnVjdC5wdWJsaWNTdWJuZXRzLFxuICAgICAgcHJpdmF0ZVN1Ym5ldHM6IHRoaXMubmV0d29ya2luZ0NvbnN0cnVjdC5wcml2YXRlU3VibmV0cyxcbiAgICAgIGlzb2xhdGVkU3VibmV0czogdGhpcy5uZXR3b3JraW5nQ29uc3RydWN0Lmlzb2xhdGVkU3VibmV0cyxcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiB0aGlzLm5ldHdvcmtpbmdDb25zdHJ1Y3Quc2VjdXJpdHlHcm91cHMsXG4gICAgICBuZXR3b3JraW5nQ29uc3RydWN0OiB0aGlzLm5ldHdvcmtpbmdDb25zdHJ1Y3QsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrnjg4jjg6zjg7zjgrjjg6rjgr3jg7zjgrnjga7lj5blvpdcbiAgICovXG4gIHB1YmxpYyBnZXRTdG9yYWdlUmVzb3VyY2VzKCkge1xuICAgIHJldHVybiB7XG4gICAgICBzdG9yYWdlQ29uc3RydWN0OiB0aGlzLnN0b3JhZ2VDb25zdHJ1Y3QsXG4gICAgICBkb2N1bWVudHNCdWNrZXQ6IHRoaXMuc3RvcmFnZUNvbnN0cnVjdD8uZG9jdW1lbnRzQnVja2V0IHx8IG51bGwsXG4gICAgICBiYWNrdXBCdWNrZXQ6IHRoaXMuc3RvcmFnZUNvbnN0cnVjdD8uYmFja3VwQnVja2V0IHx8IG51bGwsXG4gICAgICBmc3hGaWxlU3lzdGVtOiB0aGlzLnN0b3JhZ2VDb25zdHJ1Y3Q/LmZzeEZpbGVTeXN0ZW0gfHwgbnVsbCxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOODh+ODvOOCv+ODmeODvOOCueODquOCveODvOOCueOBruWPluW+l1xuICAgKi9cbiAgcHVibGljIGdldERhdGFiYXNlUmVzb3VyY2VzKCkge1xuICAgIHJldHVybiB7XG4gICAgICBkYXRhYmFzZUNvbnN0cnVjdDogdGhpcy5kYXRhYmFzZUNvbnN0cnVjdCxcbiAgICAgIGR5bmFtb1RhYmxlczogdGhpcy5kYXRhYmFzZUNvbnN0cnVjdD8uZHluYW1vVGFibGVzIHx8IHt9LFxuICAgICAgb3BlbnNlYXJjaENvbGxlY3Rpb25zOiB0aGlzLmRhdGFiYXNlQ29uc3RydWN0Py5vcGVuc2VhcmNoQ29sbGVjdGlvbnMgfHwge30sXG4gICAgfTtcbiAgfVxufSJdfQ==