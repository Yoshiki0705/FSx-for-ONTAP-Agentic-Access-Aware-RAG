"use strict";
/**
 * OpenSearch Multimodal Embeddingクラスター構築
 *
 * Titan Multimodal Embedding用に最適化されたOpenSearchクラスター
 * - ベクトル検索最適化
 * - 高性能インスタンス設定
 * - セキュリティ強化
 * - 監視・ログ設定
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
exports.OpenSearchMultimodalConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const opensearch = __importStar(require("aws-cdk-lib/aws-opensearchserverless"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const constructs_1 = require("constructs");
class OpenSearchMultimodalConstruct extends constructs_1.Construct {
    collection;
    outputs;
    securityGroup;
    accessRole;
    config;
    constructor(scope, id, config) {
        super(scope, id);
        // configを明示的に設定
        this.config = config;
        // 入力値検証
        this.validateConfig();
        // セキュリティグループ作成（VPC使用時）
        if (this.config.networkConfig.vpcEnabled && this.config.networkConfig.vpc) {
            this.securityGroup = this.createSecurityGroup();
        }
        // IAMロール作成
        this.accessRole = this.createAccessRole();
        // CloudWatchログ設定
        this.createCloudWatchLogs();
        // OpenSearchサーバーレスコレクション作成
        this.collection = this.createOpenSearchCollection();
        // 出力値設定
        this.outputs = this.createOutputs();
        // タグ適用
        this.applyTags();
    }
    /**
     * 設定値検証
     */
    validateConfig() {
        // 設定値はreadonlyなので、デフォルト値は呼び出し側で設定する必要がある
        // ここでは検証のみ実施
        // ドメイン名長さチェック（28文字以内）
        if (this.config.domainName.length > 28) {
            throw new Error(`OpenSearchドメイン名は28文字以内である必要があります: ${this.config.domainName} (${this.config.domainName.length}文字)`);
        }
        // ドメイン名形式チェック
        const domainNameRegex = /^[a-z][a-z0-9\-]*$/;
        if (!domainNameRegex.test(this.config.domainName)) {
            throw new Error(`OpenSearchドメイン名は小文字、数字、ハイフンのみ使用可能です: ${this.config.domainName}`);
        }
        // コレクションタイプ検証
        if (this.config.collectionConfig?.type && !['SEARCH', 'TIMESERIES', 'VECTORSEARCH'].includes(this.config.collectionConfig.type)) {
            throw new Error(`無効なコレクションタイプ: ${this.config.collectionConfig.type}`);
        }
        // VPC設定チェック
        if (this.config.networkConfig.vpcEnabled && !this.config.networkConfig.vpc) {
            throw new Error('VPCが有効な場合、VPCを指定してください');
        }
    }
    /**
     * セキュリティグループ作成
     */
    createSecurityGroup() {
        const sg = new ec2.SecurityGroup(this, 'OpenSearchSecurityGroup', {
            vpc: this.config.networkConfig.vpc,
            description: `Security group for OpenSearch domain ${this.config.domainName}`,
            allowAllOutbound: true,
        });
        // HTTPS (443) アクセス許可（VPC内のみ）
        sg.addIngressRule(ec2.Peer.ipv4(this.config.networkConfig.vpc.vpcCidrBlock), ec2.Port.tcp(443), 'HTTPS access to OpenSearch from VPC');
        // OpenSearch API (9200) アクセス許可（VPC内のみ）
        sg.addIngressRule(ec2.Peer.ipv4(this.config.networkConfig.vpc.vpcCidrBlock), ec2.Port.tcp(9200), 'OpenSearch API access from VPC');
        return sg;
    }
    /**
     * IAMアクセスロール作成
     */
    createAccessRole() {
        const role = new iam.Role(this, 'OpenSearchAccessRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: `Access role for OpenSearch domain ${this.config.domainName}`,
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });
        // OpenSearchアクセス権限
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'aoss:APIAccessAll',
                'aoss:DashboardsAccessAll',
            ],
            resources: [`arn:aws:aoss:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:collection/${this.config.domainName}`],
        }));
        return role;
    }
    /**
     * OpenSearchサーバーレスコレクション作成
     */
    createOpenSearchCollection() {
        // セキュリティポリシー作成
        const securityPolicy = this.createSecurityPolicy();
        // ネットワークポリシー作成（VPC使用時）
        const networkPolicy = this.config.networkConfig.vpcEnabled
            ? this.createNetworkPolicy()
            : undefined;
        // データアクセスポリシー作成
        const dataAccessPolicy = this.createDataAccessPolicy();
        // コレクション作成
        const collectionType = this.config.collectionConfig?.type || 'VECTORSEARCH';
        const collection = new opensearch.CfnCollection(this, 'OpenSearchCollection', {
            name: this.config.domainName,
            type: collectionType, // 必須: VECTORSEARCH, SEARCH, TIMESERIES
            description: this.config.collectionConfig?.description || `Multimodal embedding collection for ${this.config.environment}`,
            tags: this.createCollectionTags(),
        });
        console.log(`🔍 OpenSearchコレクション作成: name=${this.config.domainName}, type=${collectionType}`);
        // 依存関係設定
        collection.addDependency(securityPolicy);
        collection.addDependency(dataAccessPolicy);
        if (networkPolicy) {
            collection.addDependency(networkPolicy);
        }
        return collection;
    }
    /**
     * セキュリティポリシー作成
     */
    createSecurityPolicy() {
        // OpenSearch Serverless暗号化ポリシー
        // AWS公式ドキュメントに従った正しい形式
        // 重要: Resourceパターンはワイルドカード（collection/*）を使用
        const encryptionPolicy = this.config.securityConfig.kmsKey
            ? {
                Rules: [
                    {
                        ResourceType: 'collection',
                        Resource: [`collection/${this.config.domainName}`],
                    }
                ],
                KmsARN: this.config.securityConfig.kmsKey.keyArn
            }
            : {
                Rules: [
                    {
                        ResourceType: 'collection',
                        Resource: [`collection/${this.config.domainName}`],
                    }
                ],
                AWSOwnedKey: true
            };
        // デバッグ: ポリシーの構造を確認
        const policyString = JSON.stringify(encryptionPolicy);
        console.log('🔍 OpenSearch暗号化ポリシー:', policyString);
        console.log('🔍 コレクション名:', this.config.domainName);
        // ポリシー名は32文字以内に制限（AWS制約）
        const policyName = `perm-aware-rag-encrypt`;
        return new opensearch.CfnSecurityPolicy(this, 'SecurityPolicy', {
            name: policyName,
            type: 'encryption',
            policy: policyString,
        });
    }
    /**
     * ネットワークポリシー作成
     */
    createNetworkPolicy() {
        const networkPolicy = {
            Rules: [
                {
                    ResourceType: 'collection',
                    Resource: [`collection/${this.config.domainName}`],
                    AllowFromPublic: false
                },
                {
                    ResourceType: 'dashboard',
                    Resource: [`collection/${this.config.domainName}`],
                    AllowFromPublic: false
                }
            ]
        };
        return new opensearch.CfnSecurityPolicy(this, 'NetworkPolicy', {
            name: `perm-aware-rag-network`,
            type: 'network',
            policy: JSON.stringify(networkPolicy),
        });
    }
    /**
     * データアクセスポリシー作成
     */
    createDataAccessPolicy() {
        // OpenSearch ServerlessのAccessPolicyは配列形式で渡す必要がある
        const accessPolicy = [
            {
                Rules: [
                    {
                        ResourceType: 'collection',
                        Resource: [`collection/${this.config.domainName}`],
                        Permission: [
                            'aoss:CreateCollectionItems',
                            'aoss:DeleteCollectionItems',
                            'aoss:UpdateCollectionItems',
                            'aoss:DescribeCollectionItems'
                        ]
                    },
                    {
                        ResourceType: 'index',
                        Resource: [`index/${this.config.domainName}/*`],
                        Permission: [
                            'aoss:CreateIndex',
                            'aoss:DeleteIndex',
                            'aoss:UpdateIndex',
                            'aoss:DescribeIndex',
                            'aoss:ReadDocument',
                            'aoss:WriteDocument'
                        ]
                    }
                ],
                Principal: [this.accessRole.roleArn]
            }
        ];
        return new opensearch.CfnAccessPolicy(this, 'DataAccessPolicy', {
            name: `perm-aware-rag-data`,
            type: 'data',
            policy: JSON.stringify(accessPolicy),
        });
    }
    /**
     * コレクション用タグ作成
     */
    createCollectionTags() {
        const defaultTags = {
            Component: 'OpenSearch',
            Purpose: 'MultimodalEmbedding',
            Environment: this.config.environment,
            EmbeddingModel: 'TitanMultimodal',
        };
        const allTags = { ...defaultTags, ...this.config.tags };
        return Object.entries(allTags).map(([key, value]) => ({
            key,
            value,
        }));
    }
    /**
     * CloudWatchログ設定作成（OpenSearch Serverless用）
     */
    createCloudWatchLogs() {
        if (this.config.monitoringConfig?.logsEnabled) {
            // OpenSearch Serverlessでは自動的にCloudWatchログが有効化される
            // 必要に応じて追加のログ設定をここに実装
            new logs.LogGroup(this, 'OpenSearchServerlessLogGroup', {
                logGroupName: `/aws/opensearchserverless/collections/${this.config.domainName}`,
                retention: this.config.environment === 'prod'
                    ? logs.RetentionDays.SIX_MONTHS
                    : logs.RetentionDays.ONE_MONTH,
                removalPolicy: this.config.environment === 'prod'
                    ? cdk.RemovalPolicy.RETAIN
                    : cdk.RemovalPolicy.DESTROY,
            });
        }
    }
    /**
     * 出力値作成
     */
    createOutputs() {
        return {
            domainArn: this.collection.attrArn,
            domainEndpoint: this.collection.attrCollectionEndpoint,
            kibanaEndpoint: this.collection.attrDashboardEndpoint,
            domainName: this.collection.name,
            securityGroupId: this.securityGroup?.securityGroupId,
            accessPolicyArn: this.accessRole?.roleArn,
        };
    }
    /**
     * タグ適用
     */
    applyTags() {
        const defaultTags = {
            Component: 'OpenSearch',
            Purpose: 'MultimodalEmbedding',
            Environment: this.config.environment,
            EmbeddingModel: 'TitanMultimodal',
        };
        const allTags = { ...defaultTags, ...this.config.tags };
        Object.entries(allTags).forEach(([key, value]) => {
            cdk.Tags.of(this).add(key, value);
        });
    }
    /**
     * Titan Multimodal Embedding用インデックス作成
     */
    createMultimodalIndex() {
        const indexTemplate = {
            settings: {
                index: {
                    number_of_shards: 2, // OpenSearch Serverlessでは自動管理
                    number_of_replicas: this.config.environment === 'prod' ? 1 : 0,
                    'knn': true,
                    'knn.algo_param.ef_search': 100,
                    'knn.algo_param.ef_construction': 200,
                    'knn.space_type': 'cosinesimil',
                },
            },
            mappings: {
                properties: {
                    document_id: { type: 'keyword' },
                    content_type: { type: 'keyword' },
                    text_content: {
                        type: 'text',
                        analyzer: 'standard',
                        fields: {
                            keyword: { type: 'keyword' }
                        }
                    },
                    image_metadata: {
                        type: 'object',
                        properties: {
                            format: { type: 'keyword' },
                            size: { type: 'long' },
                            dimensions: {
                                type: 'object',
                                properties: {
                                    width: { type: 'integer' },
                                    height: { type: 'integer' }
                                }
                            }
                        }
                    },
                    text_embedding_vector: {
                        type: 'knn_vector',
                        dimension: 1024,
                        method: {
                            name: 'hnsw',
                            space_type: 'cosinesimil',
                            engine: 'nmslib',
                            parameters: {
                                ef_construction: 200,
                                m: 16
                            }
                        }
                    },
                    multimodal_embedding_vector: {
                        type: 'knn_vector',
                        dimension: 1024,
                        method: {
                            name: 'hnsw',
                            space_type: 'cosinesimil',
                            engine: 'nmslib',
                            parameters: {
                                ef_construction: 200,
                                m: 16
                            }
                        }
                    },
                    user_permissions: { type: 'keyword' },
                    file_path: { type: 'keyword' },
                    created_at: { type: 'date' },
                    updated_at: { type: 'date' },
                    model_version: { type: 'keyword' },
                    embedding_model: { type: 'keyword' },
                }
            }
        };
        return JSON.stringify(indexTemplate, null, 2);
    }
    /**
     * パフォーマンス最適化設定取得
     */
    getPerformanceOptimizationSettings() {
        return {
            // インデックス設定
            'index.refresh_interval': '30s',
            'index.number_of_replicas': this.config.environment === 'prod' ? 1 : 0,
            'index.translog.flush_threshold_size': '1gb',
            'index.translog.sync_interval': '30s',
            // 検索設定
            'search.max_buckets': 65536,
            'search.allow_expensive_queries': true,
            // KNN設定
            'knn.memory.circuit_breaker.enabled': true,
            'knn.memory.circuit_breaker.limit': '75%',
            'knn.cache.item.expiry.enabled': true,
            'knn.cache.item.expiry.minutes': 60,
            // クラスター設定
            'cluster.routing.allocation.disk.threshold_enabled': true,
            'cluster.routing.allocation.disk.watermark.low': '85%',
            'cluster.routing.allocation.disk.watermark.high': '90%',
            'cluster.routing.allocation.disk.watermark.flood_stage': '95%',
        };
    }
}
exports.OpenSearchMultimodalConstruct = OpenSearchMultimodalConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlbnNlYXJjaC1tdWx0aW1vZGFsLWNvbnN0cnVjdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9wZW5zZWFyY2gtbXVsdGltb2RhbC1jb25zdHJ1Y3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7OztHQVFHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQyxpRkFBbUU7QUFDbkUseURBQTJDO0FBQzNDLHlEQUEyQztBQUUzQywyREFBNkM7QUFDN0MsMkNBQXVDO0FBcUZ2QyxNQUFhLDZCQUE4QixTQUFRLHNCQUFTO0lBQzFDLFVBQVUsQ0FBMkI7SUFDckMsT0FBTyxDQUE4QjtJQUNwQyxhQUFhLENBQXFCO0lBQ2xDLFVBQVUsQ0FBWTtJQUMvQixNQUFNLENBQTZCO0lBRTNDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsTUFBa0M7UUFDMUUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixnQkFBZ0I7UUFDaEIsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFFckIsUUFBUTtRQUNSLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUV0Qix1QkFBdUI7UUFDdkIsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxVQUFVLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDMUUsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztRQUNsRCxDQUFDO1FBRUQsV0FBVztRQUNYLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFFMUMsaUJBQWlCO1FBQ2pCLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1FBRTVCLDJCQUEyQjtRQUMzQixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQywwQkFBMEIsRUFBRSxDQUFDO1FBRXBE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STtZQUN6RCwrQ0FBK0MsRUFBRSxLQUFLO1lBQ3RELGdEQUFnRCxFQUFFLEtBQUs7WUFDdkQsdURBQXVELEVBQUUsS0FBSztTQUMvRCxDQUFDO0lBQ0osQ0FBQztDQUNGO0FBM2JELHNFQTJiQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogT3BlblNlYXJjaCBNdWx0aW1vZGFsIEVtYmVkZGluZ+OCr+ODqeOCueOCv+ODvOani+eviVxuICogXG4gKiBUaXRhbiBNdWx0aW1vZGFsIEVtYmVkZGluZ+eUqOOBq+acgOmBqeWMluOBleOCjOOBn09wZW5TZWFyY2jjgq/jg6njgrnjgr/jg7xcbiAqIC0g44OZ44Kv44OI44Or5qSc57Si5pyA6YGp5YyWXG4gKiAtIOmrmOaAp+iDveOCpOODs+OCueOCv+ODs+OCueioreWumlxuICogLSDjgrvjgq3jg6Xjg6rjg4bjgqPlvLfljJZcbiAqIC0g55uj6KaW44O744Ot44Kw6Kit5a6aXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIG9wZW5zZWFyY2ggZnJvbSAnYXdzLWNkay1saWIvYXdzLW9wZW5zZWFyY2hzZXJ2ZXJsZXNzJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGttcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mta21zJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgT3BlblNlYXJjaE11bHRpbW9kYWxDb25maWcge1xuICAvKiog44Kz44Os44Kv44K344On44Oz5ZCN77yIMjjmloflrZfku6XlhoXvvIkgKi9cbiAgcmVhZG9ubHkgZG9tYWluTmFtZTogc3RyaW5nO1xuICBcbiAgLyoqIOeSsOWig++8iGRldi9zdGFnaW5nL3Byb2TvvIkgKi9cbiAgcmVhZG9ubHkgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgXG4gIC8qKiDjgrPjg6zjgq/jgrfjg6fjg7PoqK3lrpogKi9cbiAgcmVhZG9ubHkgY29sbGVjdGlvbkNvbmZpZzoge1xuICAgIC8qKiDjgrPjg6zjgq/jgrfjg6fjg7Pjgr/jgqTjg5cgKi9cbiAgICByZWFkb25seSB0eXBlOiAnU0VBUkNIJyB8ICdUSU1FU0VSSUVTJyB8ICdWRUNUT1JTRUFSQ0gnO1xuICAgIC8qKiDoqqzmmI4gKi9cbiAgICByZWFkb25seSBkZXNjcmlwdGlvbj86IHN0cmluZztcbiAgfTtcbiAgXG4gIC8qKiDjg43jg4Pjg4jjg6/jg7zjgq/oqK3lrpogKi9cbiAgcmVhZG9ubHkgbmV0d29ya0NvbmZpZzoge1xuICAgIC8qKiBWUEPphY3nva4gKi9cbiAgICByZWFkb25seSB2cGNFbmFibGVkOiBib29sZWFuO1xuICAgIC8qKiBWUEMgKi9cbiAgICByZWFkb25seSB2cGM/OiBlYzIuSVZwYztcbiAgICAvKiog44K144OW44ON44OD44OIICovXG4gICAgcmVhZG9ubHkgc3VibmV0cz86IGVjMi5JU3VibmV0W107XG4gICAgLyoqIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODlyAqL1xuICAgIHJlYWRvbmx5IHNlY3VyaXR5R3JvdXBzPzogZWMyLklTZWN1cml0eUdyb3VwW107XG4gIH07XG4gIFxuICAvKiog44K744Kt44Ol44Oq44OG44Kj6Kit5a6aICovXG4gIHJlYWRvbmx5IHNlY3VyaXR5Q29uZmlnOiB7XG4gICAgLyoqIOaal+WPt+WMluacieWKueWMliAqL1xuICAgIHJlYWRvbmx5IGVuY3J5cHRpb25BdFJlc3Q6IGJvb2xlYW47XG4gICAgLyoqIOODjuODvOODiemWk+aal+WPt+WMliAqL1xuICAgIHJlYWRvbmx5IG5vZGVUb05vZGVFbmNyeXB0aW9uOiBib29sZWFuO1xuICAgIC8qKiBIVFRQU+W8t+WItiAqL1xuICAgIHJlYWRvbmx5IGVuZm9yY2VIdHRwczogYm9vbGVhbjtcbiAgICAvKiogS01T44Kt44O8ICovXG4gICAgcmVhZG9ubHkga21zS2V5Pzoga21zLklLZXk7XG4gICAgLyoqIOODleOCoeOCpOODs+OCouOCr+OCu+OCueWItuW+oSAqL1xuICAgIHJlYWRvbmx5IGZpbmVHcmFpbmVkQWNjZXNzQ29udHJvbDogYm9vbGVhbjtcbiAgfTtcbiAgXG4gIC8qKiDnm6PoppboqK3lrpogKi9cbiAgcmVhZG9ubHkgbW9uaXRvcmluZ0NvbmZpZzoge1xuICAgIC8qKiBDbG91ZFdhdGNo44Ot44Kw5pyJ5Yq55YyWICovXG4gICAgcmVhZG9ubHkgbG9nc0VuYWJsZWQ6IGJvb2xlYW47XG4gICAgLyoqIOOCueODreODvOODreOCsOacieWKueWMliAqL1xuICAgIHJlYWRvbmx5IHNsb3dMb2dzRW5hYmxlZDogYm9vbGVhbjtcbiAgICAvKiog44Ki44OX44Oq44Kx44O844K344On44Oz44Ot44Kw5pyJ5Yq55YyWICovXG4gICAgcmVhZG9ubHkgYXBwTG9nc0VuYWJsZWQ6IGJvb2xlYW47XG4gICAgLyoqIOOCpOODs+ODh+ODg+OCr+OCueOCueODreODvOODreOCsOacieWKueWMliAqL1xuICAgIHJlYWRvbmx5IGluZGV4U2xvd0xvZ3NFbmFibGVkOiBib29sZWFuO1xuICB9O1xuICBcbiAgLyoqIOODkOODg+OCr+OCouODg+ODl+ioreWumiAqL1xuICByZWFkb25seSBiYWNrdXBDb25maWc/OiB7XG4gICAgLyoqIOiHquWLleOCueODiuODg+ODl+OCt+ODp+ODg+ODiOaZgumWkyAqL1xuICAgIHJlYWRvbmx5IGF1dG9tYXRlZFNuYXBzaG90U3RhcnRIb3VyOiBudW1iZXI7XG4gIH07XG4gIFxuICAvKiog44K/44KwICovXG4gIHJlYWRvbmx5IHRhZ3M/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE9wZW5TZWFyY2hNdWx0aW1vZGFsT3V0cHV0cyB7XG4gIC8qKiDjg4njg6HjgqTjg7NBUk4gKi9cbiAgcmVhZG9ubHkgZG9tYWluQXJuOiBzdHJpbmc7XG4gIFxuICAvKiog44OJ44Oh44Kk44Oz44Ko44Oz44OJ44Od44Kk44Oz44OIICovXG4gIHJlYWRvbmx5IGRvbWFpbkVuZHBvaW50OiBzdHJpbmc7XG4gIFxuICAvKiogS2liYW5h44Ko44Oz44OJ44Od44Kk44Oz44OIICovXG4gIHJlYWRvbmx5IGtpYmFuYUVuZHBvaW50OiBzdHJpbmc7XG4gIFxuICAvKiog44OJ44Oh44Kk44Oz5ZCNICovXG4gIHJlYWRvbmx5IGRvbWFpbk5hbWU6IHN0cmluZztcbiAgXG4gIC8qKiDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5dJRCAqL1xuICByZWFkb25seSBzZWN1cml0eUdyb3VwSWQ/OiBzdHJpbmc7XG4gIFxuICAvKiog44Ki44Kv44K744K544Od44Oq44K344O8QVJOICovXG4gIHJlYWRvbmx5IGFjY2Vzc1BvbGljeUFybj86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIE9wZW5TZWFyY2hNdWx0aW1vZGFsQ29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IGNvbGxlY3Rpb246IG9wZW5zZWFyY2guQ2ZuQ29sbGVjdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IG91dHB1dHM6IE9wZW5TZWFyY2hNdWx0aW1vZGFsT3V0cHV0cztcbiAgcHJpdmF0ZSByZWFkb25seSBzZWN1cml0eUdyb3VwPzogZWMyLlNlY3VyaXR5R3JvdXA7XG4gIHByaXZhdGUgcmVhZG9ubHkgYWNjZXNzUm9sZT86IGlhbS5Sb2xlO1xuICBwcml2YXRlIGNvbmZpZzogT3BlblNlYXJjaE11bHRpbW9kYWxDb25maWc7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgY29uZmlnOiBPcGVuU2VhcmNoTXVsdGltb2RhbENvbmZpZykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG4gICAgXG4gICAgLy8gY29uZmln44KS5piO56S655qE44Gr6Kit5a6aXG4gICAgdGhpcy5jb25maWcgPSBjb25maWc7XG5cbiAgICAvLyDlhaXlipvlgKTmpJzoqLxcbiAgICB0aGlzLnZhbGlkYXRlQ29uZmlnKCk7XG5cbiAgICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fkvZzmiJDvvIhWUEPkvb/nlKjmmYLvvIlcbiAgICBpZiAodGhpcy5jb25maWcubmV0d29ya0NvbmZpZy52cGNFbmFibGVkICYmIHRoaXMuY29uZmlnLm5ldHdvcmtDb25maWcudnBjKSB7XG4gICAgICB0aGlzLnNlY3VyaXR5R3JvdXAgPSB0aGlzLmNyZWF0ZVNlY3VyaXR5R3JvdXAoKTtcbiAgICB9XG5cbiAgICAvLyBJQU3jg63jg7zjg6vkvZzmiJBcbiAgICB0aGlzLmFjY2Vzc1JvbGUgPSB0aGlzLmNyZWF0ZUFjY2Vzc1JvbGUoKTtcblxuICAgIC8vIENsb3VkV2F0Y2jjg63jgrDoqK3lrppcbiAgICB0aGlzLmNyZWF0ZUNsb3VkV2F0Y2hMb2dzKCk7XG5cbiAgICAvLyBPcGVuU2VhcmNo44K144O844OQ44O844Os44K544Kz44Os44Kv44K344On44Oz5L2c5oiQXG4gICAgdGhpcy5jb2xsZWN0aW9uID0gdGhpcy5jcmVhdGVPcGVuU2VhcmNoQ29sbGVjdGlvbigpO1xuXG4gICAgLy8g5Ye65Yqb5YCk6Kit5a6aXG4gICAgdGhpcy5vdXRwdXRzID0gdGhpcy5jcmVhdGVPdXRwdXRzKCk7XG5cbiAgICAvLyDjgr/jgrDpgannlKhcbiAgICB0aGlzLmFwcGx5VGFncygpO1xuICB9XG5cbiAgLyoqXG4gICAqIOioreWumuWApOaknOiovFxuICAgKi9cbiAgcHJpdmF0ZSB2YWxpZGF0ZUNvbmZpZygpOiB2b2lkIHtcbiAgICAvLyDoqK3lrprlgKTjga9yZWFkb25seeOBquOBruOBp+OAgeODh+ODleOCqeODq+ODiOWApOOBr+WRvOOBs+WHuuOBl+WBtOOBp+ioreWumuOBmeOCi+W/heimgeOBjOOBguOCi1xuICAgIC8vIOOBk+OBk+OBp+OBr+aknOiovOOBruOBv+Wun+aWvVxuICAgIFxuICAgIC8vIOODieODoeOCpOODs+WQjemVt+OBleODgeOCp+ODg+OCr++8iDI45paH5a2X5Lul5YaF77yJXG4gICAgaWYgKHRoaXMuY29uZmlnLmRvbWFpbk5hbWUubGVuZ3RoID4gMjgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgT3BlblNlYXJjaOODieODoeOCpOODs+WQjeOBrzI45paH5a2X5Lul5YaF44Gn44GC44KL5b+F6KaB44GM44GC44KK44G+44GZOiAke3RoaXMuY29uZmlnLmRvbWFpbk5hbWV9ICgke3RoaXMuY29uZmlnLmRvbWFpbk5hbWUubGVuZ3RofeaWh+WtlylgKTtcbiAgICB9XG5cbiAgICAvLyDjg4njg6HjgqTjg7PlkI3lvaLlvI/jg4Hjgqfjg4Pjgq9cbiAgICBjb25zdCBkb21haW5OYW1lUmVnZXggPSAvXlthLXpdW2EtejAtOVxcLV0qJC87XG4gICAgaWYgKCFkb21haW5OYW1lUmVnZXgudGVzdCh0aGlzLmNvbmZpZy5kb21haW5OYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBPcGVuU2VhcmNo44OJ44Oh44Kk44Oz5ZCN44Gv5bCP5paH5a2X44CB5pWw5a2X44CB44OP44Kk44OV44Oz44Gu44G/5L2/55So5Y+v6IO944Gn44GZOiAke3RoaXMuY29uZmlnLmRvbWFpbk5hbWV9YCk7XG4gICAgfVxuXG4gICAgLy8g44Kz44Os44Kv44K344On44Oz44K/44Kk44OX5qSc6Ki8XG4gICAgaWYgKHRoaXMuY29uZmlnLmNvbGxlY3Rpb25Db25maWc/LnR5cGUgJiYgIVsnU0VBUkNIJywgJ1RJTUVTRVJJRVMnLCAnVkVDVE9SU0VBUkNIJ10uaW5jbHVkZXModGhpcy5jb25maWcuY29sbGVjdGlvbkNvbmZpZy50eXBlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGDnhKHlirnjgarjgrPjg6zjgq/jgrfjg6fjg7Pjgr/jgqTjg5c6ICR7dGhpcy5jb25maWcuY29sbGVjdGlvbkNvbmZpZy50eXBlfWApO1xuICAgIH1cblxuICAgIC8vIFZQQ+ioreWumuODgeOCp+ODg+OCr1xuICAgIGlmICh0aGlzLmNvbmZpZy5uZXR3b3JrQ29uZmlnLnZwY0VuYWJsZWQgJiYgIXRoaXMuY29uZmlnLm5ldHdvcmtDb25maWcudnBjKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1ZQQ+OBjOacieWKueOBquWgtOWQiOOAgVZQQ+OCkuaMh+WumuOBl+OBpuOBj+OBoOOBleOBhCcpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlU2VjdXJpdHlHcm91cCgpOiBlYzIuU2VjdXJpdHlHcm91cCB7XG4gICAgY29uc3Qgc2cgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ09wZW5TZWFyY2hTZWN1cml0eUdyb3VwJywge1xuICAgICAgdnBjOiB0aGlzLmNvbmZpZy5uZXR3b3JrQ29uZmlnLnZwYyEsXG4gICAgICBkZXNjcmlwdGlvbjogYFNlY3VyaXR5IGdyb3VwIGZvciBPcGVuU2VhcmNoIGRvbWFpbiAke3RoaXMuY29uZmlnLmRvbWFpbk5hbWV9YCxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBIVFRQUyAoNDQzKSDjgqLjgq/jgrvjgrnoqLHlj6/vvIhWUEPlhoXjga7jgb/vvIlcbiAgICBzZy5hZGRJbmdyZXNzUnVsZShcbiAgICAgIGVjMi5QZWVyLmlwdjQodGhpcy5jb25maWcubmV0d29ya0NvbmZpZy52cGMhLnZwY0NpZHJCbG9jayksXG4gICAgICBlYzIuUG9ydC50Y3AoNDQzKSxcbiAgICAgICdIVFRQUyBhY2Nlc3MgdG8gT3BlblNlYXJjaCBmcm9tIFZQQydcbiAgICApO1xuXG4gICAgLy8gT3BlblNlYXJjaCBBUEkgKDkyMDApIOOCouOCr+OCu+OCueioseWPr++8iFZQQ+WGheOBruOBv++8iVxuICAgIHNnLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgZWMyLlBlZXIuaXB2NCh0aGlzLmNvbmZpZy5uZXR3b3JrQ29uZmlnLnZwYyEudnBjQ2lkckJsb2NrKSxcbiAgICAgIGVjMi5Qb3J0LnRjcCg5MjAwKSxcbiAgICAgICdPcGVuU2VhcmNoIEFQSSBhY2Nlc3MgZnJvbSBWUEMnXG4gICAgKTtcblxuICAgIHJldHVybiBzZztcbiAgfVxuXG4gIC8qKlxuICAgKiBJQU3jgqLjgq/jgrvjgrnjg63jg7zjg6vkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQWNjZXNzUm9sZSgpOiBpYW0uUm9sZSB7XG4gICAgY29uc3Qgcm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnT3BlblNlYXJjaEFjY2Vzc1JvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgQWNjZXNzIHJvbGUgZm9yIE9wZW5TZWFyY2ggZG9tYWluICR7dGhpcy5jb25maWcuZG9tYWluTmFtZX1gLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIE9wZW5TZWFyY2jjgqLjgq/jgrvjgrnmqKnpmZBcbiAgICByb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2Fvc3M6QVBJQWNjZXNzQWxsJyxcbiAgICAgICAgJ2Fvc3M6RGFzaGJvYXJkc0FjY2Vzc0FsbCcsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbYGFybjphd3M6YW9zczoke2Nkay5TdGFjay5vZih0aGlzKS5yZWdpb259OiR7Y2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnR9OmNvbGxlY3Rpb24vJHt0aGlzLmNvbmZpZy5kb21haW5OYW1lfWBdLFxuICAgIH0pKTtcblxuICAgIHJldHVybiByb2xlO1xuICB9XG5cbiAgLyoqXG4gICAqIE9wZW5TZWFyY2jjgrXjg7zjg5Djg7zjg6zjgrnjgrPjg6zjgq/jgrfjg6fjg7PkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlT3BlblNlYXJjaENvbGxlY3Rpb24oKTogb3BlbnNlYXJjaC5DZm5Db2xsZWN0aW9uIHtcbiAgICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPjg53jg6rjgrfjg7zkvZzmiJBcbiAgICBjb25zdCBzZWN1cml0eVBvbGljeSA9IHRoaXMuY3JlYXRlU2VjdXJpdHlQb2xpY3koKTtcbiAgICBcbiAgICAvLyDjg43jg4Pjg4jjg6/jg7zjgq/jg53jg6rjgrfjg7zkvZzmiJDvvIhWUEPkvb/nlKjmmYLvvIlcbiAgICBjb25zdCBuZXR3b3JrUG9saWN5ID0gdGhpcy5jb25maWcubmV0d29ya0NvbmZpZy52cGNFbmFibGVkIFxuICAgICAgPyB0aGlzLmNyZWF0ZU5ldHdvcmtQb2xpY3koKSBcbiAgICAgIDogdW5kZWZpbmVkO1xuXG4gICAgLy8g44OH44O844K/44Ki44Kv44K744K544Od44Oq44K344O85L2c5oiQXG4gICAgY29uc3QgZGF0YUFjY2Vzc1BvbGljeSA9IHRoaXMuY3JlYXRlRGF0YUFjY2Vzc1BvbGljeSgpO1xuXG4gICAgLy8g44Kz44Os44Kv44K344On44Oz5L2c5oiQXG4gICAgY29uc3QgY29sbGVjdGlvblR5cGUgPSB0aGlzLmNvbmZpZy5jb2xsZWN0aW9uQ29uZmlnPy50eXBlIHx8ICdWRUNUT1JTRUFSQ0gnO1xuICAgIGNvbnN0IGNvbGxlY3Rpb24gPSBuZXcgb3BlbnNlYXJjaC5DZm5Db2xsZWN0aW9uKHRoaXMsICdPcGVuU2VhcmNoQ29sbGVjdGlvbicsIHtcbiAgICAgIG5hbWU6IHRoaXMuY29uZmlnLmRvbWFpbk5hbWUsXG4gICAgICB0eXBlOiBjb2xsZWN0aW9uVHlwZSwgLy8g5b+F6aCIOiBWRUNUT1JTRUFSQ0gsIFNFQVJDSCwgVElNRVNFUklFU1xuICAgICAgZGVzY3JpcHRpb246IHRoaXMuY29uZmlnLmNvbGxlY3Rpb25Db25maWc/LmRlc2NyaXB0aW9uIHx8IGBNdWx0aW1vZGFsIGVtYmVkZGluZyBjb2xsZWN0aW9uIGZvciAke3RoaXMuY29uZmlnLmVudmlyb25tZW50fWAsXG4gICAgICB0YWdzOiB0aGlzLmNyZWF0ZUNvbGxlY3Rpb25UYWdzKCksXG4gICAgfSk7XG4gICAgXG4gICAgY29uc29sZS5sb2coYPCflI0gT3BlblNlYXJjaOOCs+ODrOOCr+OCt+ODp+ODs+S9nOaIkDogbmFtZT0ke3RoaXMuY29uZmlnLmRvbWFpbk5hbWV9LCB0eXBlPSR7Y29sbGVjdGlvblR5cGV9YCk7XG5cbiAgICAvLyDkvp3lrZjplqLkv4LoqK3lrppcbiAgICBjb2xsZWN0aW9uLmFkZERlcGVuZGVuY3koc2VjdXJpdHlQb2xpY3kpO1xuICAgIGNvbGxlY3Rpb24uYWRkRGVwZW5kZW5jeShkYXRhQWNjZXNzUG9saWN5KTtcbiAgICBpZiAobmV0d29ya1BvbGljeSkge1xuICAgICAgY29sbGVjdGlvbi5hZGREZXBlbmRlbmN5KG5ldHdvcmtQb2xpY3kpO1xuICAgIH1cblxuICAgIHJldHVybiBjb2xsZWN0aW9uO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCu+OCreODpeODquODhuOCo+ODneODquOCt+ODvOS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVTZWN1cml0eVBvbGljeSgpOiBvcGVuc2VhcmNoLkNmblNlY3VyaXR5UG9saWN5IHtcbiAgICAvLyBPcGVuU2VhcmNoIFNlcnZlcmxlc3Pmmpflj7fljJbjg53jg6rjgrfjg7xcbiAgICAvLyBBV1PlhazlvI/jg4njgq3jg6Xjg6Hjg7Pjg4jjgavlvpPjgaPjgZ/mraPjgZfjgYTlvaLlvI9cbiAgICAvLyDph43opoE6IFJlc291cmNl44OR44K/44O844Oz44Gv44Ov44Kk44Or44OJ44Kr44O844OJ77yIY29sbGVjdGlvbi8q77yJ44KS5L2/55SoXG4gICAgY29uc3QgZW5jcnlwdGlvblBvbGljeSA9IHRoaXMuY29uZmlnLnNlY3VyaXR5Q29uZmlnLmttc0tleVxuICAgICAgPyB7XG4gICAgICAgICAgUnVsZXM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgUmVzb3VyY2VUeXBlOiAnY29sbGVjdGlvbicsXG4gICAgICAgICAgICAgIFJlc291cmNlOiBbYGNvbGxlY3Rpb24vJHt0aGlzLmNvbmZpZy5kb21haW5OYW1lfWBdLFxuICAgICAgICAgICAgfVxuICAgICAgICAgIF0sXG4gICAgICAgICAgS21zQVJOOiB0aGlzLmNvbmZpZy5zZWN1cml0eUNvbmZpZy5rbXNLZXkua2V5QXJuXG4gICAgICAgIH1cbiAgICAgIDoge1xuICAgICAgICAgIFJ1bGVzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIFJlc291cmNlVHlwZTogJ2NvbGxlY3Rpb24nLFxuICAgICAgICAgICAgICBSZXNvdXJjZTogW2Bjb2xsZWN0aW9uLyR7dGhpcy5jb25maWcuZG9tYWluTmFtZX1gXSxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdLFxuICAgICAgICAgIEFXU093bmVkS2V5OiB0cnVlXG4gICAgICAgIH07XG5cbiAgICAvLyDjg4fjg5Djg4PjgrA6IOODneODquOCt+ODvOOBruani+mAoOOCkueiuuiqjVxuICAgIGNvbnN0IHBvbGljeVN0cmluZyA9IEpTT04uc3RyaW5naWZ5KGVuY3J5cHRpb25Qb2xpY3kpO1xuICAgIGNvbnNvbGUubG9nKCfwn5SNIE9wZW5TZWFyY2jmmpflj7fljJbjg53jg6rjgrfjg7w6JywgcG9saWN5U3RyaW5nKTtcbiAgICBjb25zb2xlLmxvZygn8J+UjSDjgrPjg6zjgq/jgrfjg6fjg7PlkI06JywgdGhpcy5jb25maWcuZG9tYWluTmFtZSk7XG5cbiAgICAvLyDjg53jg6rjgrfjg7zlkI3jga8zMuaWh+Wtl+S7peWGheOBq+WItumZkO+8iEFXU+WItue0hO+8iVxuICAgIGNvbnN0IHBvbGljeU5hbWUgPSBgcGVybS1hd2FyZS1yYWctZW5jcnlwdGA7XG4gICAgXG4gICAgcmV0dXJuIG5ldyBvcGVuc2VhcmNoLkNmblNlY3VyaXR5UG9saWN5KHRoaXMsICdTZWN1cml0eVBvbGljeScsIHtcbiAgICAgIG5hbWU6IHBvbGljeU5hbWUsXG4gICAgICB0eXBlOiAnZW5jcnlwdGlvbicsXG4gICAgICBwb2xpY3k6IHBvbGljeVN0cmluZyxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg43jg4Pjg4jjg6/jg7zjgq/jg53jg6rjgrfjg7zkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlTmV0d29ya1BvbGljeSgpOiBvcGVuc2VhcmNoLkNmblNlY3VyaXR5UG9saWN5IHtcbiAgICBjb25zdCBuZXR3b3JrUG9saWN5ID0ge1xuICAgICAgUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIFJlc291cmNlVHlwZTogJ2NvbGxlY3Rpb24nLFxuICAgICAgICAgIFJlc291cmNlOiBbYGNvbGxlY3Rpb24vJHt0aGlzLmNvbmZpZy5kb21haW5OYW1lfWBdLFxuICAgICAgICAgIEFsbG93RnJvbVB1YmxpYzogZmFsc2VcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIFJlc291cmNlVHlwZTogJ2Rhc2hib2FyZCcsXG4gICAgICAgICAgUmVzb3VyY2U6IFtgY29sbGVjdGlvbi8ke3RoaXMuY29uZmlnLmRvbWFpbk5hbWV9YF0sXG4gICAgICAgICAgQWxsb3dGcm9tUHVibGljOiBmYWxzZVxuICAgICAgICB9XG4gICAgICBdXG4gICAgfTtcblxuICAgIHJldHVybiBuZXcgb3BlbnNlYXJjaC5DZm5TZWN1cml0eVBvbGljeSh0aGlzLCAnTmV0d29ya1BvbGljeScsIHtcbiAgICAgIG5hbWU6IGBwZXJtLWF3YXJlLXJhZy1uZXR3b3JrYCxcbiAgICAgIHR5cGU6ICduZXR3b3JrJyxcbiAgICAgIHBvbGljeTogSlNPTi5zdHJpbmdpZnkobmV0d29ya1BvbGljeSksXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog44OH44O844K/44Ki44Kv44K744K544Od44Oq44K344O85L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZURhdGFBY2Nlc3NQb2xpY3koKTogb3BlbnNlYXJjaC5DZm5BY2Nlc3NQb2xpY3kge1xuICAgIC8vIE9wZW5TZWFyY2ggU2VydmVybGVzc+OBrkFjY2Vzc1BvbGljeeOBr+mFjeWIl+W9ouW8j+OBp+a4oeOBmeW/heimgeOBjOOBguOCi1xuICAgIGNvbnN0IGFjY2Vzc1BvbGljeSA9IFtcbiAgICAgIHtcbiAgICAgICAgUnVsZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBSZXNvdXJjZVR5cGU6ICdjb2xsZWN0aW9uJyxcbiAgICAgICAgICAgIFJlc291cmNlOiBbYGNvbGxlY3Rpb24vJHt0aGlzLmNvbmZpZy5kb21haW5OYW1lfWBdLFxuICAgICAgICAgICAgUGVybWlzc2lvbjogW1xuICAgICAgICAgICAgICAnYW9zczpDcmVhdGVDb2xsZWN0aW9uSXRlbXMnLFxuICAgICAgICAgICAgICAnYW9zczpEZWxldGVDb2xsZWN0aW9uSXRlbXMnLFxuICAgICAgICAgICAgICAnYW9zczpVcGRhdGVDb2xsZWN0aW9uSXRlbXMnLFxuICAgICAgICAgICAgICAnYW9zczpEZXNjcmliZUNvbGxlY3Rpb25JdGVtcydcbiAgICAgICAgICAgIF1cbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIFJlc291cmNlVHlwZTogJ2luZGV4JyxcbiAgICAgICAgICAgIFJlc291cmNlOiBbYGluZGV4LyR7dGhpcy5jb25maWcuZG9tYWluTmFtZX0vKmBdLFxuICAgICAgICAgICAgUGVybWlzc2lvbjogW1xuICAgICAgICAgICAgICAnYW9zczpDcmVhdGVJbmRleCcsXG4gICAgICAgICAgICAgICdhb3NzOkRlbGV0ZUluZGV4JyxcbiAgICAgICAgICAgICAgJ2Fvc3M6VXBkYXRlSW5kZXgnLFxuICAgICAgICAgICAgICAnYW9zczpEZXNjcmliZUluZGV4JyxcbiAgICAgICAgICAgICAgJ2Fvc3M6UmVhZERvY3VtZW50JyxcbiAgICAgICAgICAgICAgJ2Fvc3M6V3JpdGVEb2N1bWVudCdcbiAgICAgICAgICAgIF1cbiAgICAgICAgICB9XG4gICAgICAgIF0sXG4gICAgICAgIFByaW5jaXBhbDogW3RoaXMuYWNjZXNzUm9sZSEucm9sZUFybl1cbiAgICAgIH1cbiAgICBdO1xuXG4gICAgcmV0dXJuIG5ldyBvcGVuc2VhcmNoLkNmbkFjY2Vzc1BvbGljeSh0aGlzLCAnRGF0YUFjY2Vzc1BvbGljeScsIHtcbiAgICAgIG5hbWU6IGBwZXJtLWF3YXJlLXJhZy1kYXRhYCxcbiAgICAgIHR5cGU6ICdkYXRhJyxcbiAgICAgIHBvbGljeTogSlNPTi5zdHJpbmdpZnkoYWNjZXNzUG9saWN5KSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrPjg6zjgq/jgrfjg6fjg7PnlKjjgr/jgrDkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQ29sbGVjdGlvblRhZ3MoKTogY2RrLkNmblRhZ1tdIHtcbiAgICBjb25zdCBkZWZhdWx0VGFncyA9IHtcbiAgICAgIENvbXBvbmVudDogJ09wZW5TZWFyY2gnLFxuICAgICAgUHVycG9zZTogJ011bHRpbW9kYWxFbWJlZGRpbmcnLFxuICAgICAgRW52aXJvbm1lbnQ6IHRoaXMuY29uZmlnLmVudmlyb25tZW50LFxuICAgICAgRW1iZWRkaW5nTW9kZWw6ICdUaXRhbk11bHRpbW9kYWwnLFxuICAgIH07XG5cbiAgICBjb25zdCBhbGxUYWdzID0geyAuLi5kZWZhdWx0VGFncywgLi4udGhpcy5jb25maWcudGFncyB9O1xuXG4gICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKGFsbFRhZ3MpLm1hcCgoW2tleSwgdmFsdWVdKSA9PiAoe1xuICAgICAga2V5LFxuICAgICAgdmFsdWUsXG4gICAgfSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIENsb3VkV2F0Y2jjg63jgrDoqK3lrprkvZzmiJDvvIhPcGVuU2VhcmNoIFNlcnZlcmxlc3PnlKjvvIlcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQ2xvdWRXYXRjaExvZ3MoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuY29uZmlnLm1vbml0b3JpbmdDb25maWc/LmxvZ3NFbmFibGVkKSB7XG4gICAgICAvLyBPcGVuU2VhcmNoIFNlcnZlcmxlc3Pjgafjga/oh6rli5XnmoTjgatDbG91ZFdhdGNo44Ot44Kw44GM5pyJ5Yq55YyW44GV44KM44KLXG4gICAgICAvLyDlv4XopoHjgavlv5zjgZjjgabov73liqDjga7jg63jgrDoqK3lrprjgpLjgZPjgZPjgavlrp/oo4VcbiAgICAgIG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdPcGVuU2VhcmNoU2VydmVybGVzc0xvZ0dyb3VwJywge1xuICAgICAgICBsb2dHcm91cE5hbWU6IGAvYXdzL29wZW5zZWFyY2hzZXJ2ZXJsZXNzL2NvbGxlY3Rpb25zLyR7dGhpcy5jb25maWcuZG9tYWluTmFtZX1gLFxuICAgICAgICByZXRlbnRpb246IHRoaXMuY29uZmlnLmVudmlyb25tZW50ID09PSAncHJvZCcgXG4gICAgICAgICAgPyBsb2dzLlJldGVudGlvbkRheXMuU0lYX01PTlRIUyBcbiAgICAgICAgICA6IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IHRoaXMuY29uZmlnLmVudmlyb25tZW50ID09PSAncHJvZCcgXG4gICAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gXG4gICAgICAgICAgOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cblxuXG4gIC8qKlxuICAgKiDlh7rlipvlgKTkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlT3V0cHV0cygpOiBPcGVuU2VhcmNoTXVsdGltb2RhbE91dHB1dHMge1xuICAgIHJldHVybiB7XG4gICAgICBkb21haW5Bcm46IHRoaXMuY29sbGVjdGlvbi5hdHRyQXJuLFxuICAgICAgZG9tYWluRW5kcG9pbnQ6IHRoaXMuY29sbGVjdGlvbi5hdHRyQ29sbGVjdGlvbkVuZHBvaW50LFxuICAgICAga2liYW5hRW5kcG9pbnQ6IHRoaXMuY29sbGVjdGlvbi5hdHRyRGFzaGJvYXJkRW5kcG9pbnQsXG4gICAgICBkb21haW5OYW1lOiB0aGlzLmNvbGxlY3Rpb24ubmFtZSEsXG4gICAgICBzZWN1cml0eUdyb3VwSWQ6IHRoaXMuc2VjdXJpdHlHcm91cD8uc2VjdXJpdHlHcm91cElkLFxuICAgICAgYWNjZXNzUG9saWN5QXJuOiB0aGlzLmFjY2Vzc1JvbGU/LnJvbGVBcm4sXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgr/jgrDpgannlKhcbiAgICovXG4gIHByaXZhdGUgYXBwbHlUYWdzKCk6IHZvaWQge1xuICAgIGNvbnN0IGRlZmF1bHRUYWdzID0ge1xuICAgICAgQ29tcG9uZW50OiAnT3BlblNlYXJjaCcsXG4gICAgICBQdXJwb3NlOiAnTXVsdGltb2RhbEVtYmVkZGluZycsXG4gICAgICBFbnZpcm9ubWVudDogdGhpcy5jb25maWcuZW52aXJvbm1lbnQsXG4gICAgICBFbWJlZGRpbmdNb2RlbDogJ1RpdGFuTXVsdGltb2RhbCcsXG4gICAgfTtcblxuICAgIGNvbnN0IGFsbFRhZ3MgPSB7IC4uLmRlZmF1bHRUYWdzLCAuLi50aGlzLmNvbmZpZy50YWdzIH07XG5cbiAgICBPYmplY3QuZW50cmllcyhhbGxUYWdzKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZChrZXksIHZhbHVlKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaXRhbiBNdWx0aW1vZGFsIEVtYmVkZGluZ+eUqOOCpOODs+ODh+ODg+OCr+OCueS9nOaIkFxuICAgKi9cbiAgcHVibGljIGNyZWF0ZU11bHRpbW9kYWxJbmRleCgpOiBzdHJpbmcge1xuICAgIGNvbnN0IGluZGV4VGVtcGxhdGUgPSB7XG4gICAgICBzZXR0aW5nczoge1xuICAgICAgICBpbmRleDoge1xuICAgICAgICAgIG51bWJlcl9vZl9zaGFyZHM6IDIsIC8vIE9wZW5TZWFyY2ggU2VydmVybGVzc+OBp+OBr+iHquWLleeuoeeQhlxuICAgICAgICAgIG51bWJlcl9vZl9yZXBsaWNhczogdGhpcy5jb25maWcuZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IDEgOiAwLFxuICAgICAgICAgICdrbm4nOiB0cnVlLFxuICAgICAgICAgICdrbm4uYWxnb19wYXJhbS5lZl9zZWFyY2gnOiAxMDAsXG4gICAgICAgICAgJ2tubi5hbGdvX3BhcmFtLmVmX2NvbnN0cnVjdGlvbic6IDIwMCxcbiAgICAgICAgICAna25uLnNwYWNlX3R5cGUnOiAnY29zaW5lc2ltaWwnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIG1hcHBpbmdzOiB7XG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICBkb2N1bWVudF9pZDogeyB0eXBlOiAna2V5d29yZCcgfSxcbiAgICAgICAgICBjb250ZW50X3R5cGU6IHsgdHlwZTogJ2tleXdvcmQnIH0sXG4gICAgICAgICAgdGV4dF9jb250ZW50OiB7IFxuICAgICAgICAgICAgdHlwZTogJ3RleHQnLFxuICAgICAgICAgICAgYW5hbHl6ZXI6ICdzdGFuZGFyZCcsXG4gICAgICAgICAgICBmaWVsZHM6IHtcbiAgICAgICAgICAgICAga2V5d29yZDogeyB0eXBlOiAna2V5d29yZCcgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAgaW1hZ2VfbWV0YWRhdGE6IHtcbiAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICBmb3JtYXQ6IHsgdHlwZTogJ2tleXdvcmQnIH0sXG4gICAgICAgICAgICAgIHNpemU6IHsgdHlwZTogJ2xvbmcnIH0sXG4gICAgICAgICAgICAgIGRpbWVuc2lvbnM6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICB3aWR0aDogeyB0eXBlOiAnaW50ZWdlcicgfSxcbiAgICAgICAgICAgICAgICAgIGhlaWdodDogeyB0eXBlOiAnaW50ZWdlcicgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAgdGV4dF9lbWJlZGRpbmdfdmVjdG9yOiB7XG4gICAgICAgICAgICB0eXBlOiAna25uX3ZlY3RvcicsXG4gICAgICAgICAgICBkaW1lbnNpb246IDEwMjQsXG4gICAgICAgICAgICBtZXRob2Q6IHtcbiAgICAgICAgICAgICAgbmFtZTogJ2huc3cnLFxuICAgICAgICAgICAgICBzcGFjZV90eXBlOiAnY29zaW5lc2ltaWwnLFxuICAgICAgICAgICAgICBlbmdpbmU6ICdubXNsaWInLFxuICAgICAgICAgICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgZWZfY29uc3RydWN0aW9uOiAyMDAsXG4gICAgICAgICAgICAgICAgbTogMTZcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAgbXVsdGltb2RhbF9lbWJlZGRpbmdfdmVjdG9yOiB7XG4gICAgICAgICAgICB0eXBlOiAna25uX3ZlY3RvcicsXG4gICAgICAgICAgICBkaW1lbnNpb246IDEwMjQsXG4gICAgICAgICAgICBtZXRob2Q6IHtcbiAgICAgICAgICAgICAgbmFtZTogJ2huc3cnLFxuICAgICAgICAgICAgICBzcGFjZV90eXBlOiAnY29zaW5lc2ltaWwnLFxuICAgICAgICAgICAgICBlbmdpbmU6ICdubXNsaWInLFxuICAgICAgICAgICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgZWZfY29uc3RydWN0aW9uOiAyMDAsXG4gICAgICAgICAgICAgICAgbTogMTZcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAgdXNlcl9wZXJtaXNzaW9uczogeyB0eXBlOiAna2V5d29yZCcgfSxcbiAgICAgICAgICBmaWxlX3BhdGg6IHsgdHlwZTogJ2tleXdvcmQnIH0sXG4gICAgICAgICAgY3JlYXRlZF9hdDogeyB0eXBlOiAnZGF0ZScgfSxcbiAgICAgICAgICB1cGRhdGVkX2F0OiB7IHR5cGU6ICdkYXRlJyB9LFxuICAgICAgICAgIG1vZGVsX3ZlcnNpb246IHsgdHlwZTogJ2tleXdvcmQnIH0sXG4gICAgICAgICAgZW1iZWRkaW5nX21vZGVsOiB7IHR5cGU6ICdrZXl3b3JkJyB9LFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShpbmRleFRlbXBsYXRlLCBudWxsLCAyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg5Hjg5Xjgqnjg7zjg57jg7PjgrnmnIDpganljJboqK3lrprlj5blvpdcbiAgICovXG4gIHB1YmxpYyBnZXRQZXJmb3JtYW5jZU9wdGltaXphdGlvblNldHRpbmdzKCk6IFJlY29yZDxzdHJpbmcsIGFueT4ge1xuICAgIHJldHVybiB7XG4gICAgICAvLyDjgqTjg7Pjg4fjg4Pjgq/jgrnoqK3lrppcbiAgICAgICdpbmRleC5yZWZyZXNoX2ludGVydmFsJzogJzMwcycsXG4gICAgICAnaW5kZXgubnVtYmVyX29mX3JlcGxpY2FzJzogdGhpcy5jb25maWcuZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IDEgOiAwLFxuICAgICAgJ2luZGV4LnRyYW5zbG9nLmZsdXNoX3RocmVzaG9sZF9zaXplJzogJzFnYicsXG4gICAgICAnaW5kZXgudHJhbnNsb2cuc3luY19pbnRlcnZhbCc6ICczMHMnLFxuICAgICAgXG4gICAgICAvLyDmpJzntKLoqK3lrppcbiAgICAgICdzZWFyY2gubWF4X2J1Y2tldHMnOiA2NTUzNixcbiAgICAgICdzZWFyY2guYWxsb3dfZXhwZW5zaXZlX3F1ZXJpZXMnOiB0cnVlLFxuICAgICAgXG4gICAgICAvLyBLTk7oqK3lrppcbiAgICAgICdrbm4ubWVtb3J5LmNpcmN1aXRfYnJlYWtlci5lbmFibGVkJzogdHJ1ZSxcbiAgICAgICdrbm4ubWVtb3J5LmNpcmN1aXRfYnJlYWtlci5saW1pdCc6ICc3NSUnLFxuICAgICAgJ2tubi5jYWNoZS5pdGVtLmV4cGlyeS5lbmFibGVkJzogdHJ1ZSxcbiAgICAgICdrbm4uY2FjaGUuaXRlbS5leHBpcnkubWludXRlcyc6IDYwLFxuICAgICAgXG4gICAgICAvLyDjgq/jg6njgrnjgr/jg7zoqK3lrppcbiAgICAgICdjbHVzdGVyLnJvdXRpbmcuYWxsb2NhdGlvbi5kaXNrLnRocmVzaG9sZF9lbmFibGVkJzogdHJ1ZSxcbiAgICAgICdjbHVzdGVyLnJvdXRpbmcuYWxsb2NhdGlvbi5kaXNrLndhdGVybWFyay5sb3cnOiAnODUlJyxcbiAgICAgICdjbHVzdGVyLnJvdXRpbmcuYWxsb2NhdGlvbi5kaXNrLndhdGVybWFyay5oaWdoJzogJzkwJScsXG4gICAgICAnY2x1c3Rlci5yb3V0aW5nLmFsbG9jYXRpb24uZGlzay53YXRlcm1hcmsuZmxvb2Rfc3RhZ2UnOiAnOTUlJyxcbiAgICB9O1xuICB9XG59Il19