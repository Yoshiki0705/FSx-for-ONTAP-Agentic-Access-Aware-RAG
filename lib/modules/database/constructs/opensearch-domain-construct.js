"use strict";
/**
 * OpenSearch Domain構築（通常のOpenSearchクラスター）
 *
 * Titan Multimodal Embedding用に最適化されたOpenSearchドメイン
 * - ベクトル検索最適化
 * - 開発環境向け設定
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
exports.OpenSearchDomainConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const opensearch = __importStar(require("aws-cdk-lib/aws-opensearch"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const constructs_1 = require("constructs");
class OpenSearchDomainConstruct extends constructs_1.Construct {
    config;
    domain;
    outputs;
    securityGroup;
    accessRole;
    constructor(scope, id, config) {
        super(scope, id);
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
        // OpenSearchドメイン作成
        this.domain = this.createOpenSearchDomain();
        // 出力値設定
        this.outputs = this.createOutputs();
        // タグ適用
        this.applyTags();
        // CloudWatchアラーム作成
        this.createCloudWatchAlarms();
    }
    /**
     * 設定値検証（包括的エラーハンドリング）
     */
    validateConfig() {
        const errors = [];
        // ドメイン名検証
        if (!this.config.domainName || this.config.domainName.trim().length === 0) {
            errors.push('ドメイン名が空です');
        }
        else {
            if (this.config.domainName.length > 28) {
                errors.push(`ドメイン名は28文字以内である必要があります: ${this.config.domainName} (${this.config.domainName.length}文字)`);
            }
            const domainNameRegex = /^[a-z][a-z0-9\-]*$/;
            if (!domainNameRegex.test(this.config.domainName)) {
                errors.push(`ドメイン名は小文字、数字、ハイフンのみ使用可能です: ${this.config.domainName}`);
            }
            // 連続ハイフンチェック
            if (this.config.domainName.includes('--')) {
                errors.push(`ドメイン名に連続するハイフンは使用できません: ${this.config.domainName}`);
            }
            // 末尾ハイフンチェック
            if (this.config.domainName.endsWith('-')) {
                errors.push(`ドメイン名の末尾にハイフンは使用できません: ${this.config.domainName}`);
            }
        }
        // 環境名検証
        const validEnvironments = ['dev', 'development', 'staging', 'stage', 'prod', 'production'];
        if (!validEnvironments.includes(this.config.environment)) {
            errors.push(`無効な環境名: ${this.config.environment}. 有効な値: ${validEnvironments.join(', ')}`);
        }
        // VPC設定検証
        if (this.config.networkConfig.vpcEnabled) {
            if (!this.config.networkConfig.vpc) {
                errors.push('VPCが有効な場合、VPCを指定してください');
            }
            if (this.config.networkConfig.subnets && this.config.networkConfig.subnets.length < 2) {
                errors.push('VPC使用時は最低2つのサブネットが必要です（高可用性のため）');
            }
        }
        // インスタンス設定検証
        if (this.config.instanceConfig.instanceCount < 1 || this.config.instanceConfig.instanceCount > 80) {
            errors.push(`インスタンス数は1-80の範囲である必要があります: ${this.config.instanceConfig.instanceCount}`);
        }
        // 本番環境では最低3ノード推奨
        if (this.config.environment === 'prod' && this.config.instanceConfig.instanceCount < 3) {
            errors.push('本番環境では高可用性のため最低3ノードを推奨します');
        }
        // マスターノード設定検証
        if (this.config.instanceConfig.dedicatedMasterEnabled) {
            if (!this.config.instanceConfig.masterInstanceCount || this.config.instanceConfig.masterInstanceCount < 3) {
                errors.push('専用マスターノードを使用する場合、最低3ノードが必要です');
            }
            if (this.config.instanceConfig.masterInstanceCount % 2 === 0) {
                errors.push('マスターノード数は奇数である必要があります（スプリットブレイン防止）');
            }
        }
        // ストレージ設定検証
        if (this.config.storageConfig.volumeSize < 10 || this.config.storageConfig.volumeSize > 16384) {
            errors.push(`ボリュームサイズは10-16384GBの範囲である必要があります: ${this.config.storageConfig.volumeSize}GB`);
        }
        // IOPS設定検証
        if (this.config.storageConfig.volumeType === ec2.EbsDeviceVolumeType.IO1) {
            if (!this.config.storageConfig.iops || this.config.storageConfig.iops < 100) {
                errors.push('io1ボリュームタイプの場合、IOPSは100以上である必要があります');
            }
        }
        // セキュリティ設定検証
        if (this.config.environment === 'prod') {
            if (!this.config.securityConfig.encryptionAtRest) {
                errors.push('本番環境では保存時暗号化が必須です');
            }
            if (!this.config.securityConfig.nodeToNodeEncryption) {
                errors.push('本番環境ではノード間暗号化が必須です');
            }
            if (!this.config.securityConfig.enforceHttps) {
                errors.push('本番環境ではHTTPS強制が必須です');
            }
        }
        // エラーがある場合は例外をスロー
        if (errors.length > 0) {
            throw new Error(`OpenSearch設定検証エラー:\n${errors.map(e => `- ${e}`).join('\n')}`);
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
     * IAMアクセスロール作成（セキュリティ強化版）
     */
    createAccessRole() {
        const role = new iam.Role(this, 'OpenSearchAccessRole', {
            assumedBy: new iam.CompositePrincipal(new iam.ServicePrincipal('lambda.amazonaws.com'), new iam.ServicePrincipal('ec2.amazonaws.com'), 
            // 本番環境ではAccountRootPrincipalを除外
            ...(this.config.environment !== 'prod' ? [new iam.AccountRootPrincipal()] : [])),
            description: `Access role for OpenSearch domain ${this.config.domainName}`,
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
            // セッション時間制限
            maxSessionDuration: cdk.Duration.hours(this.config.environment === 'prod' ? 1 : 12),
        });
        // 最小権限の原則に基づくOpenSearchアクセス権限
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'es:ESHttpGet',
                'es:ESHttpPost',
                'es:ESHttpPut',
                'es:ESHttpDelete',
                'es:ESHttpHead',
                'es:DescribeDomain',
                'es:ListDomainNames',
            ],
            resources: [`arn:aws:es:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:domain/${this.config.domainName}/*`],
            // 時間ベースの条件追加（本番環境）
            conditions: this.config.environment === 'prod' ? {
                'DateGreaterThan': {
                    'aws:CurrentTime': '2024-01-01T00:00:00Z'
                },
                'IpAddress': {
                    'aws:SourceIp': this.config.networkConfig.vpc?.vpcCidrBlock || '10.0.0.0/8'
                }
            } : undefined,
        }));
        return role;
    }
    /**
     * OpenSearchドメイン作成
     */
    createOpenSearchDomain() {
        // ドメイン設定
        const domainProps = {
            domainName: this.config.domainName,
            version: opensearch.EngineVersion.OPENSEARCH_2_11, // 最新安定版
            // クラスター設定
            capacity: {
                dataNodes: this.config.instanceConfig.instanceCount,
                dataNodeInstanceType: this.config.instanceConfig.instanceType.toString(),
                masterNodes: this.config.instanceConfig.dedicatedMasterEnabled
                    ? this.config.instanceConfig.masterInstanceCount
                    : undefined,
                masterNodeInstanceType: this.config.instanceConfig.dedicatedMasterEnabled
                    ? this.config.instanceConfig.masterInstanceType?.toString()
                    : undefined,
            },
            // EBS設定
            ebs: {
                enabled: true,
                volumeType: this.config.storageConfig.volumeType,
                volumeSize: this.config.storageConfig.volumeSize,
                iops: this.config.storageConfig.iops,
                throughput: this.config.storageConfig.throughput,
            },
            // ネットワーク設定
            vpc: this.config.networkConfig.vpcEnabled ? this.config.networkConfig.vpc : undefined,
            vpcSubnets: this.config.networkConfig.vpcEnabled && this.config.networkConfig.subnets
                ? [{ subnets: this.config.networkConfig.subnets }]
                : undefined,
            securityGroups: this.securityGroup ? [this.securityGroup] : undefined,
            // セキュリティ設定
            encryptionAtRest: {
                enabled: this.config.securityConfig.encryptionAtRest,
                kmsKey: this.config.securityConfig.kmsKey,
            },
            nodeToNodeEncryption: this.config.securityConfig.nodeToNodeEncryption,
            enforceHttps: this.config.securityConfig.enforceHttps,
            // ファインアクセス制御
            fineGrainedAccessControl: this.config.securityConfig.fineGrainedAccessControl ? {
                masterUserName: this.config.securityConfig.masterUserName || 'admin',
            } : undefined,
            // ログ設定
            logging: {
                slowSearchLogEnabled: this.config.monitoringConfig.slowLogsEnabled,
                appLogEnabled: this.config.monitoringConfig.appLogsEnabled,
                slowIndexLogEnabled: this.config.monitoringConfig.indexSlowLogsEnabled,
            },
            // 自動スナップショット
            automatedSnapshotStartHour: this.config.backupConfig?.automatedSnapshotStartHour || 3,
            // アクセスポリシー
            accessPolicies: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    principals: [this.accessRole],
                    actions: ['es:*'],
                    resources: [`arn:aws:es:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:domain/${this.config.domainName}/*`],
                }),
            ],
            // 削除保護（本番環境のみ）
            removalPolicy: this.config.environment === 'prod'
                ? cdk.RemovalPolicy.RETAIN
                : cdk.RemovalPolicy.DESTROY,
        };
        return new opensearch.Domain(this, 'OpenSearchDomain', domainProps);
    }
    /**
     * CloudWatchログ設定作成
     */
    createCloudWatchLogs() {
        if (this.config.monitoringConfig.logsEnabled) {
            // アプリケーションログ
            if (this.config.monitoringConfig.appLogsEnabled) {
                new logs.LogGroup(this, 'OpenSearchAppLogGroup', {
                    logGroupName: `/aws/opensearch/domains/${this.config.domainName}/application-logs`,
                    retention: this.config.environment === 'prod'
                        ? logs.RetentionDays.SIX_MONTHS
                        : logs.RetentionDays.ONE_MONTH,
                    removalPolicy: this.config.environment === 'prod'
                        ? cdk.RemovalPolicy.RETAIN
                        : cdk.RemovalPolicy.DESTROY,
                });
            }
            // スローログ
            if (this.config.monitoringConfig.slowLogsEnabled) {
                new logs.LogGroup(this, 'OpenSearchSlowLogGroup', {
                    logGroupName: `/aws/opensearch/domains/${this.config.domainName}/search-slowlogs`,
                    retention: this.config.environment === 'prod'
                        ? logs.RetentionDays.THREE_MONTHS
                        : logs.RetentionDays.TWO_WEEKS,
                    removalPolicy: this.config.environment === 'prod'
                        ? cdk.RemovalPolicy.RETAIN
                        : cdk.RemovalPolicy.DESTROY,
                });
            }
            // インデックススローログ
            if (this.config.monitoringConfig.indexSlowLogsEnabled) {
                new logs.LogGroup(this, 'OpenSearchIndexSlowLogGroup', {
                    logGroupName: `/aws/opensearch/domains/${this.config.domainName}/index-slowlogs`,
                    retention: this.config.environment === 'prod'
                        ? logs.RetentionDays.THREE_MONTHS
                        : logs.RetentionDays.TWO_WEEKS,
                    removalPolicy: this.config.environment === 'prod'
                        ? cdk.RemovalPolicy.RETAIN
                        : cdk.RemovalPolicy.DESTROY,
                });
            }
        }
    }
    /**
     * 出力値作成
     */
    createOutputs() {
        return {
            domainArn: this.domain.domainArn,
            domainEndpoint: `https://${this.domain.domainEndpoint}`,
            kibanaEndpoint: `https://${this.domain.domainEndpoint}/_dashboards/`,
            domainName: this.domain.domainName,
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
     * Titan Multimodal Embedding用インデックステンプレート作成
     * OpenSearch 7.10.2対応版（methodパラメータ除去）
     */
    createMultimodalIndexTemplate() {
        const indexTemplate = {
            settings: {
                index: {
                    number_of_shards: this.config.indexConfig?.numberOfShards || 2,
                    number_of_replicas: this.config.indexConfig?.numberOfReplicas || 0, // 開発環境では0
                    knn: true,
                    refresh_interval: '30s',
                },
            },
            mappings: {
                properties: {
                    document_id: { type: 'keyword' },
                    content_type: { type: 'keyword' },
                    text_content: {
                        type: 'text',
                        analyzer: 'standard',
                        fields: { keyword: { type: 'keyword' } },
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
                                    height: { type: 'integer' },
                                },
                            },
                        },
                    },
                    // OpenSearch 7.10.2対応：methodパラメータを削除
                    text_embedding_vector: {
                        type: 'knn_vector',
                        dimension: 1024,
                    },
                    multimodal_embedding_vector: {
                        type: 'knn_vector',
                        dimension: 1024,
                    },
                    user_permissions: { type: 'keyword' },
                    file_path: { type: 'keyword' },
                    created_at: { type: 'date' },
                    updated_at: { type: 'date' },
                    model_version: { type: 'keyword' },
                    embedding_model: { type: 'keyword' },
                },
            },
        };
        return JSON.stringify(indexTemplate, null, 2);
    }
    /**
     * パフォーマンス最適化設定取得（環境別最適化）
     */
    getPerformanceOptimizationSettings() {
        const baseSettings = {
            // インデックス設定（環境別最適化）
            'index.refresh_interval': this.config.environment === 'prod' ? '30s' : '5s',
            'index.number_of_replicas': this.config.environment === 'prod' ? 1 : 0,
            'index.translog.flush_threshold_size': this.config.environment === 'prod' ? '1gb' : '512mb',
            'index.translog.sync_interval': '30s',
            'index.translog.durability': this.config.environment === 'prod' ? 'request' : 'async',
            // 検索設定
            'search.max_buckets': this.config.environment === 'prod' ? 65536 : 10000,
            'search.allow_expensive_queries': this.config.environment !== 'prod',
            'search.default_search_timeout': '30s',
            'search.max_open_scroll_context': 500,
            // KNN設定（OpenSearch 2.x以降）
            'knn.memory.circuit_breaker.enabled': true,
            'knn.memory.circuit_breaker.limit': this.config.environment === 'prod' ? '75%' : '50%',
            'knn.cache.item.expiry.enabled': true,
            'knn.cache.item.expiry.minutes': this.config.environment === 'prod' ? 60 : 30,
            'knn.algo_param.ef_search': this.config.environment === 'prod' ? 512 : 100,
            // クラスター設定（環境別調整）
            'cluster.routing.allocation.disk.threshold_enabled': true,
            'cluster.routing.allocation.disk.watermark.low': this.config.environment === 'prod' ? '85%' : '80%',
            'cluster.routing.allocation.disk.watermark.high': this.config.environment === 'prod' ? '90%' : '85%',
            'cluster.routing.allocation.disk.watermark.flood_stage': this.config.environment === 'prod' ? '95%' : '90%',
            'cluster.routing.allocation.cluster_concurrent_rebalance': 2,
            'cluster.routing.allocation.node_concurrent_recoveries': 2,
            // スレッドプール設定
            'thread_pool.search.size': Math.max(1, Math.floor(this.config.instanceConfig.instanceCount * 2)),
            'thread_pool.search.queue_size': 1000,
            'thread_pool.write.size': Math.max(1, Math.floor(this.config.instanceConfig.instanceCount * 1)),
            'thread_pool.write.queue_size': 200,
            // JVM設定（メモリ最適化）
            'indices.memory.index_buffer_size': this.config.environment === 'prod' ? '20%' : '10%',
            'indices.memory.min_index_buffer_size': '48mb',
            'indices.memory.max_index_buffer_size': this.config.environment === 'prod' ? '512mb' : '256mb',
        };
        // 本番環境専用設定
        if (this.config.environment === 'prod') {
            return {
                ...baseSettings,
                // 本番環境専用の高パフォーマンス設定
                'indices.fielddata.cache.size': '40%',
                'indices.queries.cache.size': '10%',
                'indices.requests.cache.size': '2%',
                'bootstrap.memory_lock': true,
                'cluster.routing.allocation.awareness.attributes': 'zone',
                'cluster.routing.allocation.awareness.force.zone.values': 'zone1,zone2,zone3',
            };
        }
        return baseSettings;
    }
    /**
     * CloudWatchアラーム作成
     */
    createCloudWatchAlarms() {
        if (!this.config.monitoringConfig.logsEnabled)
            return;
        const alarmNamespace = 'AWS/ES';
        const dimensionName = 'DomainName';
        const dimensionValue = this.config.domainName;
        // クラスター状態アラーム
        new cdk.aws_cloudwatch.Alarm(this, 'ClusterStatusRedAlarm', {
            alarmName: `${this.config.domainName}-cluster-status-red`,
            alarmDescription: 'OpenSearchクラスターが赤状態です',
            metric: new cdk.aws_cloudwatch.Metric({
                namespace: alarmNamespace,
                metricName: 'ClusterStatus.red',
                dimensionsMap: { [dimensionName]: dimensionValue },
                statistic: 'Maximum',
            }),
            threshold: 0,
            comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            evaluationPeriods: 1,
            treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        // CPU使用率アラーム
        new cdk.aws_cloudwatch.Alarm(this, 'HighCpuAlarm', {
            alarmName: `${this.config.domainName}-high-cpu`,
            alarmDescription: 'OpenSearchのCPU使用率が高すぎます',
            metric: new cdk.aws_cloudwatch.Metric({
                namespace: alarmNamespace,
                metricName: 'CPUUtilization',
                dimensionsMap: { [dimensionName]: dimensionValue },
                statistic: 'Average',
            }),
            threshold: this.config.environment === 'prod' ? 80 : 90,
            comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            evaluationPeriods: 2,
        });
        // メモリ使用率アラーム
        new cdk.aws_cloudwatch.Alarm(this, 'HighMemoryAlarm', {
            alarmName: `${this.config.domainName}-high-memory`,
            alarmDescription: 'OpenSearchのメモリ使用率が高すぎます',
            metric: new cdk.aws_cloudwatch.Metric({
                namespace: alarmNamespace,
                metricName: 'JVMMemoryPressure',
                dimensionsMap: { [dimensionName]: dimensionValue },
                statistic: 'Maximum',
            }),
            threshold: this.config.environment === 'prod' ? 85 : 95,
            comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            evaluationPeriods: 3,
        });
        // ディスク使用率アラーム
        new cdk.aws_cloudwatch.Alarm(this, 'HighDiskUsageAlarm', {
            alarmName: `${this.config.domainName}-high-disk-usage`,
            alarmDescription: 'OpenSearchのディスク使用率が高すぎます',
            metric: new cdk.aws_cloudwatch.Metric({
                namespace: alarmNamespace,
                metricName: 'StorageUtilization',
                dimensionsMap: { [dimensionName]: dimensionValue },
                statistic: 'Maximum',
            }),
            threshold: this.config.environment === 'prod' ? 80 : 85,
            comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            evaluationPeriods: 2,
        });
    }
}
exports.OpenSearchDomainConstruct = OpenSearchDomainConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlbnNlYXJjaC1kb21haW4tY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsib3BlbnNlYXJjaC1kb21haW4tY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7R0FRRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFDbkMsdUVBQXlEO0FBQ3pELHlEQUEyQztBQUMzQyx5REFBMkM7QUFFM0MsMkRBQTZDO0FBQzdDLDJDQUF1QztBQWlIdkMsTUFBYSx5QkFBMEIsU0FBUSxzQkFBUztJQU1KO0lBTGxDLE1BQU0sQ0FBb0I7SUFDMUIsT0FBTyxDQUEwQjtJQUNoQyxhQUFhLENBQXFCO0lBQ2xDLFVBQVUsQ0FBWTtJQUV2QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFVLE1BQThCO1FBQzlFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFEK0IsV0FBTSxHQUFOLE1BQU0sQ0FBd0I7UUFHOUUsUUFBUTtRQUNSLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUV0Qix1QkFBdUI7UUFDdkIsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxVQUFVLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDMUUsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztRQUNsRCxDQUFDO1FBRUQsV0FBVztRQUNYLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFFMUMsaUJBQWlCO1FBQ2pCLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1FBRTVCLG1CQUFtQjtRQUNuQixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO1FBRTVDLFFBQVE7UUFDUixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxh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O0FBM2lCRCw4REEyaUJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBPcGVuU2VhcmNoIERvbWFpbuani+evie+8iOmAmuW4uOOBrk9wZW5TZWFyY2jjgq/jg6njgrnjgr/jg7zvvIlcbiAqIFxuICogVGl0YW4gTXVsdGltb2RhbCBFbWJlZGRpbmfnlKjjgavmnIDpganljJbjgZXjgozjgZ9PcGVuU2VhcmNo44OJ44Oh44Kk44OzXG4gKiAtIOODmeOCr+ODiOODq+aknOe0ouacgOmBqeWMllxuICogLSDplovnmbrnkrDlooPlkJHjgZHoqK3lrppcbiAqIC0g44K744Kt44Ol44Oq44OG44Kj5by35YyWXG4gKiAtIOebo+imluODu+ODreOCsOioreWumlxuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBvcGVuc2VhcmNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1vcGVuc2VhcmNoJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGttcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mta21zJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgT3BlblNlYXJjaERvbWFpbkNvbmZpZyB7XG4gIC8qKiDjg4njg6HjgqTjg7PlkI3vvIgyOOaWh+Wtl+S7peWGhe+8iSAqL1xuICByZWFkb25seSBkb21haW5OYW1lOiBzdHJpbmc7XG4gIFxuICAvKiog55Kw5aKD77yIZGV2L3N0YWdpbmcvcHJvZO+8iSAqL1xuICByZWFkb25seSBlbnZpcm9ubWVudDogc3RyaW5nO1xuICBcbiAgLyoqIOOCpOODs+OCueOCv+ODs+OCueioreWumiAqL1xuICByZWFkb25seSBpbnN0YW5jZUNvbmZpZzoge1xuICAgIC8qKiDjgqTjg7Pjgrnjgr/jg7Pjgrnjgr/jgqTjg5cgKi9cbiAgICByZWFkb25seSBpbnN0YW5jZVR5cGU6IGVjMi5JbnN0YW5jZVR5cGU7XG4gICAgLyoqIOOCpOODs+OCueOCv+ODs+OCueaVsCAqL1xuICAgIHJlYWRvbmx5IGluc3RhbmNlQ291bnQ6IG51bWJlcjtcbiAgICAvKiog5bCC55So44Oe44K544K/44O844OO44O844OJ5L2/55SoICovXG4gICAgcmVhZG9ubHkgZGVkaWNhdGVkTWFzdGVyRW5hYmxlZD86IGJvb2xlYW47XG4gICAgLyoqIOODnuOCueOCv+ODvOODjuODvOODieOCv+OCpOODlyAqL1xuICAgIHJlYWRvbmx5IG1hc3Rlckluc3RhbmNlVHlwZT86IGVjMi5JbnN0YW5jZVR5cGU7XG4gICAgLyoqIOODnuOCueOCv+ODvOODjuODvOODieaVsCAqL1xuICAgIHJlYWRvbmx5IG1hc3Rlckluc3RhbmNlQ291bnQ/OiBudW1iZXI7XG4gIH07XG4gIFxuICAvKiog44K544OI44Os44O844K46Kit5a6aICovXG4gIHJlYWRvbmx5IHN0b3JhZ2VDb25maWc6IHtcbiAgICAvKiogRUJT44Oc44Oq44Ol44O844Og44K/44Kk44OXICovXG4gICAgcmVhZG9ubHkgdm9sdW1lVHlwZTogZWMyLkVic0RldmljZVZvbHVtZVR5cGU7XG4gICAgLyoqIOODnOODquODpeODvOODoOOCteOCpOOCuu+8iEdC77yJICovXG4gICAgcmVhZG9ubHkgdm9sdW1lU2l6ZTogbnVtYmVyO1xuICAgIC8qKiBJT1BT77yIZ3AzL2lvMeOBruWgtOWQiO+8iSAqL1xuICAgIHJlYWRvbmx5IGlvcHM/OiBudW1iZXI7XG4gICAgLyoqIOOCueODq+ODvOODl+ODg+ODiO+8iGdwM+OBruWgtOWQiO+8iSAqL1xuICAgIHJlYWRvbmx5IHRocm91Z2hwdXQ/OiBudW1iZXI7XG4gIH07XG4gIFxuICAvKiog44ON44OD44OI44Ov44O844Kv6Kit5a6aICovXG4gIHJlYWRvbmx5IG5ldHdvcmtDb25maWc6IHtcbiAgICAvKiogVlBD6YWN572uICovXG4gICAgcmVhZG9ubHkgdnBjRW5hYmxlZDogYm9vbGVhbjtcbiAgICAvKiogVlBDICovXG4gICAgcmVhZG9ubHkgdnBjPzogZWMyLklWcGM7XG4gICAgLyoqIOOCteODluODjeODg+ODiCAqL1xuICAgIHJlYWRvbmx5IHN1Ym5ldHM/OiBlYzIuSVN1Ym5ldFtdO1xuICAgIC8qKiDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5cgKi9cbiAgICByZWFkb25seSBzZWN1cml0eUdyb3Vwcz86IGVjMi5JU2VjdXJpdHlHcm91cFtdO1xuICB9O1xuICBcbiAgLyoqIOOCu+OCreODpeODquODhuOCo+ioreWumiAqL1xuICByZWFkb25seSBzZWN1cml0eUNvbmZpZzoge1xuICAgIC8qKiDmmpflj7fljJbmnInlirnljJYgKi9cbiAgICByZWFkb25seSBlbmNyeXB0aW9uQXRSZXN0OiBib29sZWFuO1xuICAgIC8qKiDjg47jg7zjg4nplpPmmpflj7fljJYgKi9cbiAgICByZWFkb25seSBub2RlVG9Ob2RlRW5jcnlwdGlvbjogYm9vbGVhbjtcbiAgICAvKiogSFRUUFPlvLfliLYgKi9cbiAgICByZWFkb25seSBlbmZvcmNlSHR0cHM6IGJvb2xlYW47XG4gICAgLyoqIEtNU+OCreODvCAqL1xuICAgIHJlYWRvbmx5IGttc0tleT86IGttcy5JS2V5O1xuICAgIC8qKiDjg5XjgqHjgqTjg7PjgqLjgq/jgrvjgrnliLblvqEgKi9cbiAgICByZWFkb25seSBmaW5lR3JhaW5lZEFjY2Vzc0NvbnRyb2w6IGJvb2xlYW47XG4gICAgLyoqIOODnuOCueOCv+ODvOODpuODvOOCtuODvOWQjSAqL1xuICAgIHJlYWRvbmx5IG1hc3RlclVzZXJOYW1lPzogc3RyaW5nO1xuICB9O1xuICBcbiAgLyoqIOebo+imluioreWumiAqL1xuICByZWFkb25seSBtb25pdG9yaW5nQ29uZmlnOiB7XG4gICAgLyoqIENsb3VkV2F0Y2jjg63jgrDmnInlirnljJYgKi9cbiAgICByZWFkb25seSBsb2dzRW5hYmxlZDogYm9vbGVhbjtcbiAgICAvKiog44K544Ot44O844Ot44Kw5pyJ5Yq55YyWICovXG4gICAgcmVhZG9ubHkgc2xvd0xvZ3NFbmFibGVkOiBib29sZWFuO1xuICAgIC8qKiDjgqLjg5fjg6rjgrHjg7zjgrfjg6fjg7Pjg63jgrDmnInlirnljJYgKi9cbiAgICByZWFkb25seSBhcHBMb2dzRW5hYmxlZDogYm9vbGVhbjtcbiAgICAvKiog44Kk44Oz44OH44OD44Kv44K544K544Ot44O844Ot44Kw5pyJ5Yq55YyWICovXG4gICAgcmVhZG9ubHkgaW5kZXhTbG93TG9nc0VuYWJsZWQ6IGJvb2xlYW47XG4gIH07XG4gIFxuICAvKiog44OQ44OD44Kv44Ki44OD44OX6Kit5a6aICovXG4gIHJlYWRvbmx5IGJhY2t1cENvbmZpZz86IHtcbiAgICAvKiog6Ieq5YuV44K544OK44OD44OX44K344On44OD44OI5pmC6ZaTICovXG4gICAgcmVhZG9ubHkgYXV0b21hdGVkU25hcHNob3RTdGFydEhvdXI6IG51bWJlcjtcbiAgfTtcbiAgXG4gIC8qKiDjgqTjg7Pjg4fjg4Pjgq/jgrnoqK3lrpogKi9cbiAgcmVhZG9ubHkgaW5kZXhDb25maWc/OiB7XG4gICAgLyoqIOOCt+ODo+ODvOODieaVsCAqL1xuICAgIHJlYWRvbmx5IG51bWJlck9mU2hhcmRzOiBudW1iZXI7XG4gICAgLyoqIOODrOODl+ODquOCq+aVsCAqL1xuICAgIHJlYWRvbmx5IG51bWJlck9mUmVwbGljYXM6IG51bWJlcjtcbiAgfTtcbiAgXG4gIC8qKiDjgr/jgrAgKi9cbiAgcmVhZG9ubHkgdGFncz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgT3BlblNlYXJjaERvbWFpbk91dHB1dHMge1xuICAvKiog44OJ44Oh44Kk44OzQVJOICovXG4gIHJlYWRvbmx5IGRvbWFpbkFybjogc3RyaW5nO1xuICBcbiAgLyoqIOODieODoeOCpOODs+OCqOODs+ODieODneOCpOODs+ODiCAqL1xuICByZWFkb25seSBkb21haW5FbmRwb2ludDogc3RyaW5nO1xuICBcbiAgLyoqIEtpYmFuYeOCqOODs+ODieODneOCpOODs+ODiCAqL1xuICByZWFkb25seSBraWJhbmFFbmRwb2ludDogc3RyaW5nO1xuICBcbiAgLyoqIOODieODoeOCpOODs+WQjSAqL1xuICByZWFkb25seSBkb21haW5OYW1lOiBzdHJpbmc7XG4gIFxuICAvKiog44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OXSUQgKi9cbiAgcmVhZG9ubHkgc2VjdXJpdHlHcm91cElkPzogc3RyaW5nO1xuICBcbiAgLyoqIOOCouOCr+OCu+OCueODneODquOCt+ODvEFSTiAqL1xuICByZWFkb25seSBhY2Nlc3NQb2xpY3lBcm4/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBPcGVuU2VhcmNoRG9tYWluQ29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IGRvbWFpbjogb3BlbnNlYXJjaC5Eb21haW47XG4gIHB1YmxpYyByZWFkb25seSBvdXRwdXRzOiBPcGVuU2VhcmNoRG9tYWluT3V0cHV0cztcbiAgcHJpdmF0ZSByZWFkb25seSBzZWN1cml0eUdyb3VwPzogZWMyLlNlY3VyaXR5R3JvdXA7XG4gIHByaXZhdGUgcmVhZG9ubHkgYWNjZXNzUm9sZT86IGlhbS5Sb2xlO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByaXZhdGUgY29uZmlnOiBPcGVuU2VhcmNoRG9tYWluQ29uZmlnKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIC8vIOWFpeWKm+WApOaknOiovFxuICAgIHRoaXMudmFsaWRhdGVDb25maWcoKTtcblxuICAgIC8vIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+S9nOaIkO+8iFZQQ+S9v+eUqOaZgu+8iVxuICAgIGlmICh0aGlzLmNvbmZpZy5uZXR3b3JrQ29uZmlnLnZwY0VuYWJsZWQgJiYgdGhpcy5jb25maWcubmV0d29ya0NvbmZpZy52cGMpIHtcbiAgICAgIHRoaXMuc2VjdXJpdHlHcm91cCA9IHRoaXMuY3JlYXRlU2VjdXJpdHlHcm91cCgpO1xuICAgIH1cblxuICAgIC8vIElBTeODreODvOODq+S9nOaIkFxuICAgIHRoaXMuYWNjZXNzUm9sZSA9IHRoaXMuY3JlYXRlQWNjZXNzUm9sZSgpO1xuXG4gICAgLy8gQ2xvdWRXYXRjaOODreOCsOioreWumlxuICAgIHRoaXMuY3JlYXRlQ2xvdWRXYXRjaExvZ3MoKTtcblxuICAgIC8vIE9wZW5TZWFyY2jjg4njg6HjgqTjg7PkvZzmiJBcbiAgICB0aGlzLmRvbWFpbiA9IHRoaXMuY3JlYXRlT3BlblNlYXJjaERvbWFpbigpO1xuXG4gICAgLy8g5Ye65Yqb5YCk6Kit5a6aXG4gICAgdGhpcy5vdXRwdXRzID0gdGhpcy5jcmVhdGVPdXRwdXRzKCk7XG5cbiAgICAvLyDjgr/jgrDpgannlKhcbiAgICB0aGlzLmFwcGx5VGFncygpO1xuXG4gICAgLy8gQ2xvdWRXYXRjaOOCouODqeODvOODoOS9nOaIkFxuICAgIHRoaXMuY3JlYXRlQ2xvdWRXYXRjaEFsYXJtcygpO1xuICB9XG5cbiAgLyoqXG4gICAqIOioreWumuWApOaknOiovO+8iOWMheaLrOeahOOCqOODqeODvOODj+ODs+ODieODquODs+OCsO+8iVxuICAgKi9cbiAgcHJpdmF0ZSB2YWxpZGF0ZUNvbmZpZygpOiB2b2lkIHtcbiAgICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG5cbiAgICAvLyDjg4njg6HjgqTjg7PlkI3mpJzoqLxcbiAgICBpZiAoIXRoaXMuY29uZmlnLmRvbWFpbk5hbWUgfHwgdGhpcy5jb25maWcuZG9tYWluTmFtZS50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICBlcnJvcnMucHVzaCgn44OJ44Oh44Kk44Oz5ZCN44GM56m644Gn44GZJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0aGlzLmNvbmZpZy5kb21haW5OYW1lLmxlbmd0aCA+IDI4KSB7XG4gICAgICAgIGVycm9ycy5wdXNoKGDjg4njg6HjgqTjg7PlkI3jga8yOOaWh+Wtl+S7peWGheOBp+OBguOCi+W/heimgeOBjOOBguOCiuOBvuOBmTogJHt0aGlzLmNvbmZpZy5kb21haW5OYW1lfSAoJHt0aGlzLmNvbmZpZy5kb21haW5OYW1lLmxlbmd0aH3mloflrZcpYCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGRvbWFpbk5hbWVSZWdleCA9IC9eW2Etel1bYS16MC05XFwtXSokLztcbiAgICAgIGlmICghZG9tYWluTmFtZVJlZ2V4LnRlc3QodGhpcy5jb25maWcuZG9tYWluTmFtZSkpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goYOODieODoeOCpOODs+WQjeOBr+Wwj+aWh+Wtl+OAgeaVsOWtl+OAgeODj+OCpOODleODs+OBruOBv+S9v+eUqOWPr+iDveOBp+OBmTogJHt0aGlzLmNvbmZpZy5kb21haW5OYW1lfWApO1xuICAgICAgfVxuXG4gICAgICAvLyDpgKPntprjg4/jgqTjg5Xjg7Pjg4Hjgqfjg4Pjgq9cbiAgICAgIGlmICh0aGlzLmNvbmZpZy5kb21haW5OYW1lLmluY2x1ZGVzKCctLScpKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKGDjg4njg6HjgqTjg7PlkI3jgavpgKPntprjgZnjgovjg4/jgqTjg5Xjg7Pjga/kvb/nlKjjgafjgY3jgb7jgZvjgpM6ICR7dGhpcy5jb25maWcuZG9tYWluTmFtZX1gKTtcbiAgICAgIH1cblxuICAgICAgLy8g5pyr5bC+44OP44Kk44OV44Oz44OB44Kn44OD44KvXG4gICAgICBpZiAodGhpcy5jb25maWcuZG9tYWluTmFtZS5lbmRzV2l0aCgnLScpKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKGDjg4njg6HjgqTjg7PlkI3jga7mnKvlsL7jgavjg4/jgqTjg5Xjg7Pjga/kvb/nlKjjgafjgY3jgb7jgZvjgpM6ICR7dGhpcy5jb25maWcuZG9tYWluTmFtZX1gKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyDnkrDlooPlkI3mpJzoqLxcbiAgICBjb25zdCB2YWxpZEVudmlyb25tZW50cyA9IFsnZGV2JywgJ2RldmVsb3BtZW50JywgJ3N0YWdpbmcnLCAnc3RhZ2UnLCAncHJvZCcsICdwcm9kdWN0aW9uJ107XG4gICAgaWYgKCF2YWxpZEVudmlyb25tZW50cy5pbmNsdWRlcyh0aGlzLmNvbmZpZy5lbnZpcm9ubWVudCkpIHtcbiAgICAgIGVycm9ycy5wdXNoKGDnhKHlirnjgarnkrDlooPlkI06ICR7dGhpcy5jb25maWcuZW52aXJvbm1lbnR9LiDmnInlirnjgarlgKQ6ICR7dmFsaWRFbnZpcm9ubWVudHMuam9pbignLCAnKX1gKTtcbiAgICB9XG5cbiAgICAvLyBWUEPoqK3lrprmpJzoqLxcbiAgICBpZiAodGhpcy5jb25maWcubmV0d29ya0NvbmZpZy52cGNFbmFibGVkKSB7XG4gICAgICBpZiAoIXRoaXMuY29uZmlnLm5ldHdvcmtDb25maWcudnBjKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKCdWUEPjgYzmnInlirnjgarloLTlkIjjgIFWUEPjgpLmjIflrprjgZfjgabjgY/jgaDjgZXjgYQnKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmNvbmZpZy5uZXR3b3JrQ29uZmlnLnN1Ym5ldHMgJiYgdGhpcy5jb25maWcubmV0d29ya0NvbmZpZy5zdWJuZXRzLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goJ1ZQQ+S9v+eUqOaZguOBr+acgOS9jjLjgaTjga7jgrXjg5bjg43jg4Pjg4jjgYzlv4XopoHjgafjgZnvvIjpq5jlj6/nlKjmgKfjga7jgZ/jgoHvvIknKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyDjgqTjg7Pjgrnjgr/jg7PjgrnoqK3lrprmpJzoqLxcbiAgICBpZiAodGhpcy5jb25maWcuaW5zdGFuY2VDb25maWcuaW5zdGFuY2VDb3VudCA8IDEgfHwgdGhpcy5jb25maWcuaW5zdGFuY2VDb25maWcuaW5zdGFuY2VDb3VudCA+IDgwKSB7XG4gICAgICBlcnJvcnMucHVzaChg44Kk44Oz44K544K/44Oz44K55pWw44GvMS04MOOBruevhOWbsuOBp+OBguOCi+W/heimgeOBjOOBguOCiuOBvuOBmTogJHt0aGlzLmNvbmZpZy5pbnN0YW5jZUNvbmZpZy5pbnN0YW5jZUNvdW50fWApO1xuICAgIH1cblxuICAgIC8vIOacrOeVqueSsOWig+OBp+OBr+acgOS9jjPjg47jg7zjg4nmjqjlpahcbiAgICBpZiAodGhpcy5jb25maWcuZW52aXJvbm1lbnQgPT09ICdwcm9kJyAmJiB0aGlzLmNvbmZpZy5pbnN0YW5jZUNvbmZpZy5pbnN0YW5jZUNvdW50IDwgMykge1xuICAgICAgZXJyb3JzLnB1c2goJ+acrOeVqueSsOWig+OBp+OBr+mrmOWPr+eUqOaAp+OBruOBn+OCgeacgOS9jjPjg47jg7zjg4njgpLmjqjlpajjgZfjgb7jgZknKTtcbiAgICB9XG5cbiAgICAvLyDjg57jgrnjgr/jg7zjg47jg7zjg4noqK3lrprmpJzoqLxcbiAgICBpZiAodGhpcy5jb25maWcuaW5zdGFuY2VDb25maWcuZGVkaWNhdGVkTWFzdGVyRW5hYmxlZCkge1xuICAgICAgaWYgKCF0aGlzLmNvbmZpZy5pbnN0YW5jZUNvbmZpZy5tYXN0ZXJJbnN0YW5jZUNvdW50IHx8IHRoaXMuY29uZmlnLmluc3RhbmNlQ29uZmlnLm1hc3Rlckluc3RhbmNlQ291bnQgPCAzKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKCflsILnlKjjg57jgrnjgr/jg7zjg47jg7zjg4njgpLkvb/nlKjjgZnjgovloLTlkIjjgIHmnIDkvY4z44OO44O844OJ44GM5b+F6KaB44Gn44GZJyk7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5jb25maWcuaW5zdGFuY2VDb25maWcubWFzdGVySW5zdGFuY2VDb3VudCAlIDIgPT09IDApIHtcbiAgICAgICAgZXJyb3JzLnB1c2goJ+ODnuOCueOCv+ODvOODjuODvOODieaVsOOBr+Wlh+aVsOOBp+OBguOCi+W/heimgeOBjOOBguOCiuOBvuOBme+8iOOCueODl+ODquODg+ODiOODluODrOOCpOODs+mYsuatou+8iScpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIOOCueODiOODrOODvOOCuOioreWumuaknOiovFxuICAgIGlmICh0aGlzLmNvbmZpZy5zdG9yYWdlQ29uZmlnLnZvbHVtZVNpemUgPCAxMCB8fCB0aGlzLmNvbmZpZy5zdG9yYWdlQ29uZmlnLnZvbHVtZVNpemUgPiAxNjM4NCkge1xuICAgICAgZXJyb3JzLnB1c2goYOODnOODquODpeODvOODoOOCteOCpOOCuuOBrzEwLTE2Mzg0R0Ljga7nr4Tlm7LjgafjgYLjgovlv4XopoHjgYzjgYLjgorjgb7jgZk6ICR7dGhpcy5jb25maWcuc3RvcmFnZUNvbmZpZy52b2x1bWVTaXplfUdCYCk7XG4gICAgfVxuXG4gICAgLy8gSU9QU+ioreWumuaknOiovFxuICAgIGlmICh0aGlzLmNvbmZpZy5zdG9yYWdlQ29uZmlnLnZvbHVtZVR5cGUgPT09IGVjMi5FYnNEZXZpY2VWb2x1bWVUeXBlLklPMSkge1xuICAgICAgaWYgKCF0aGlzLmNvbmZpZy5zdG9yYWdlQ29uZmlnLmlvcHMgfHwgdGhpcy5jb25maWcuc3RvcmFnZUNvbmZpZy5pb3BzIDwgMTAwKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKCdpbzHjg5zjg6rjg6Xjg7zjg6Djgr/jgqTjg5fjga7loLTlkIjjgIFJT1BT44GvMTAw5Lul5LiK44Gn44GC44KL5b+F6KaB44GM44GC44KK44G+44GZJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8g44K744Kt44Ol44Oq44OG44Kj6Kit5a6a5qSc6Ki8XG4gICAgaWYgKHRoaXMuY29uZmlnLmVudmlyb25tZW50ID09PSAncHJvZCcpIHtcbiAgICAgIGlmICghdGhpcy5jb25maWcuc2VjdXJpdHlDb25maWcuZW5jcnlwdGlvbkF0UmVzdCkge1xuICAgICAgICBlcnJvcnMucHVzaCgn5pys55Wq55Kw5aKD44Gn44Gv5L+d5a2Y5pmC5pqX5Y+35YyW44GM5b+F6aCI44Gn44GZJyk7XG4gICAgICB9XG4gICAgICBpZiAoIXRoaXMuY29uZmlnLnNlY3VyaXR5Q29uZmlnLm5vZGVUb05vZGVFbmNyeXB0aW9uKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKCfmnKznlarnkrDlooPjgafjga/jg47jg7zjg4nplpPmmpflj7fljJbjgYzlv4XpoIjjgafjgZknKTtcbiAgICAgIH1cbiAgICAgIGlmICghdGhpcy5jb25maWcuc2VjdXJpdHlDb25maWcuZW5mb3JjZUh0dHBzKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKCfmnKznlarnkrDlooPjgafjga9IVFRQU+W8t+WItuOBjOW/hemgiOOBp+OBmScpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIOOCqOODqeODvOOBjOOBguOCi+WgtOWQiOOBr+S+i+WkluOCkuOCueODreODvFxuICAgIGlmIChlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBPcGVuU2VhcmNo6Kit5a6a5qSc6Ki844Ko44Op44O8OlxcbiR7ZXJyb3JzLm1hcChlID0+IGAtICR7ZX1gKS5qb2luKCdcXG4nKX1gKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVNlY3VyaXR5R3JvdXAoKTogZWMyLlNlY3VyaXR5R3JvdXAge1xuICAgIGNvbnN0IHNnID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdPcGVuU2VhcmNoU2VjdXJpdHlHcm91cCcsIHtcbiAgICAgIHZwYzogdGhpcy5jb25maWcubmV0d29ya0NvbmZpZy52cGMhLFxuICAgICAgZGVzY3JpcHRpb246IGBTZWN1cml0eSBncm91cCBmb3IgT3BlblNlYXJjaCBkb21haW4gJHt0aGlzLmNvbmZpZy5kb21haW5OYW1lfWAsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gSFRUUFMgKDQ0Mykg44Ki44Kv44K744K56Kix5Y+v77yIVlBD5YaF44Gu44G/77yJXG4gICAgc2cuYWRkSW5ncmVzc1J1bGUoXG4gICAgICBlYzIuUGVlci5pcHY0KHRoaXMuY29uZmlnLm5ldHdvcmtDb25maWcudnBjIS52cGNDaWRyQmxvY2spLFxuICAgICAgZWMyLlBvcnQudGNwKDQ0MyksXG4gICAgICAnSFRUUFMgYWNjZXNzIHRvIE9wZW5TZWFyY2ggZnJvbSBWUEMnXG4gICAgKTtcblxuICAgIC8vIE9wZW5TZWFyY2ggQVBJICg5MjAwKSDjgqLjgq/jgrvjgrnoqLHlj6/vvIhWUEPlhoXjga7jgb/vvIlcbiAgICBzZy5hZGRJbmdyZXNzUnVsZShcbiAgICAgIGVjMi5QZWVyLmlwdjQodGhpcy5jb25maWcubmV0d29ya0NvbmZpZy52cGMhLnZwY0NpZHJCbG9jayksXG4gICAgICBlYzIuUG9ydC50Y3AoOTIwMCksXG4gICAgICAnT3BlblNlYXJjaCBBUEkgYWNjZXNzIGZyb20gVlBDJ1xuICAgICk7XG5cbiAgICByZXR1cm4gc2c7XG4gIH1cblxuICAvKipcbiAgICogSUFN44Ki44Kv44K744K544Ot44O844Or5L2c5oiQ77yI44K744Kt44Ol44Oq44OG44Kj5by35YyW54mI77yJXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUFjY2Vzc1JvbGUoKTogaWFtLlJvbGUge1xuICAgIGNvbnN0IHJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ09wZW5TZWFyY2hBY2Nlc3NSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLkNvbXBvc2l0ZVByaW5jaXBhbChcbiAgICAgICAgbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgICBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2VjMi5hbWF6b25hd3MuY29tJyksXG4gICAgICAgIC8vIOacrOeVqueSsOWig+OBp+OBr0FjY291bnRSb290UHJpbmNpcGFs44KS6Zmk5aSWXG4gICAgICAgIC4uLih0aGlzLmNvbmZpZy5lbnZpcm9ubWVudCAhPT0gJ3Byb2QnID8gW25ldyBpYW0uQWNjb3VudFJvb3RQcmluY2lwYWwoKV0gOiBbXSlcbiAgICAgICksXG4gICAgICBkZXNjcmlwdGlvbjogYEFjY2VzcyByb2xlIGZvciBPcGVuU2VhcmNoIGRvbWFpbiAke3RoaXMuY29uZmlnLmRvbWFpbk5hbWV9YCxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgIF0sXG4gICAgICAvLyDjgrvjg4Pjgrfjg6fjg7PmmYLplpPliLbpmZBcbiAgICAgIG1heFNlc3Npb25EdXJhdGlvbjogY2RrLkR1cmF0aW9uLmhvdXJzKHRoaXMuY29uZmlnLmVudmlyb25tZW50ID09PSAncHJvZCcgPyAxIDogMTIpLFxuICAgIH0pO1xuXG4gICAgLy8g5pyA5bCP5qip6ZmQ44Gu5Y6f5YmH44Gr5Z+644Gl44GPT3BlblNlYXJjaOOCouOCr+OCu+OCueaoqemZkFxuICAgIHJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnZXM6RVNIdHRwR2V0JyxcbiAgICAgICAgJ2VzOkVTSHR0cFBvc3QnLFxuICAgICAgICAnZXM6RVNIdHRwUHV0JyxcbiAgICAgICAgJ2VzOkVTSHR0cERlbGV0ZScsXG4gICAgICAgICdlczpFU0h0dHBIZWFkJyxcbiAgICAgICAgJ2VzOkRlc2NyaWJlRG9tYWluJyxcbiAgICAgICAgJ2VzOkxpc3REb21haW5OYW1lcycsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbYGFybjphd3M6ZXM6JHtjZGsuU3RhY2sub2YodGhpcykucmVnaW9ufToke2Nkay5TdGFjay5vZih0aGlzKS5hY2NvdW50fTpkb21haW4vJHt0aGlzLmNvbmZpZy5kb21haW5OYW1lfS8qYF0sXG4gICAgICAvLyDmmYLplpPjg5njg7zjgrnjga7mnaHku7bov73liqDvvIjmnKznlarnkrDlooPvvIlcbiAgICAgIGNvbmRpdGlvbnM6IHRoaXMuY29uZmlnLmVudmlyb25tZW50ID09PSAncHJvZCcgPyB7XG4gICAgICAgICdEYXRlR3JlYXRlclRoYW4nOiB7XG4gICAgICAgICAgJ2F3czpDdXJyZW50VGltZSc6ICcyMDI0LTAxLTAxVDAwOjAwOjAwWidcbiAgICAgICAgfSxcbiAgICAgICAgJ0lwQWRkcmVzcyc6IHtcbiAgICAgICAgICAnYXdzOlNvdXJjZUlwJzogdGhpcy5jb25maWcubmV0d29ya0NvbmZpZy52cGM/LnZwY0NpZHJCbG9jayB8fCAnMTAuMC4wLjAvOCdcbiAgICAgICAgfVxuICAgICAgfSA6IHVuZGVmaW5lZCxcbiAgICB9KSk7XG5cbiAgICByZXR1cm4gcm9sZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBPcGVuU2VhcmNo44OJ44Oh44Kk44Oz5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZU9wZW5TZWFyY2hEb21haW4oKTogb3BlbnNlYXJjaC5Eb21haW4ge1xuICAgIC8vIOODieODoeOCpOODs+ioreWumlxuICAgIGNvbnN0IGRvbWFpblByb3BzOiBvcGVuc2VhcmNoLkRvbWFpblByb3BzID0ge1xuICAgICAgZG9tYWluTmFtZTogdGhpcy5jb25maWcuZG9tYWluTmFtZSxcbiAgICAgIHZlcnNpb246IG9wZW5zZWFyY2guRW5naW5lVmVyc2lvbi5PUEVOU0VBUkNIXzJfMTEsIC8vIOacgOaWsOWuieWumueJiFxuICAgICAgXG4gICAgICAvLyDjgq/jg6njgrnjgr/jg7zoqK3lrppcbiAgICAgIGNhcGFjaXR5OiB7XG4gICAgICAgIGRhdGFOb2RlczogdGhpcy5jb25maWcuaW5zdGFuY2VDb25maWcuaW5zdGFuY2VDb3VudCxcbiAgICAgICAgZGF0YU5vZGVJbnN0YW5jZVR5cGU6IHRoaXMuY29uZmlnLmluc3RhbmNlQ29uZmlnLmluc3RhbmNlVHlwZS50b1N0cmluZygpLFxuICAgICAgICBtYXN0ZXJOb2RlczogdGhpcy5jb25maWcuaW5zdGFuY2VDb25maWcuZGVkaWNhdGVkTWFzdGVyRW5hYmxlZCBcbiAgICAgICAgICA/IHRoaXMuY29uZmlnLmluc3RhbmNlQ29uZmlnLm1hc3Rlckluc3RhbmNlQ291bnQgXG4gICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgIG1hc3Rlck5vZGVJbnN0YW5jZVR5cGU6IHRoaXMuY29uZmlnLmluc3RhbmNlQ29uZmlnLmRlZGljYXRlZE1hc3RlckVuYWJsZWQgXG4gICAgICAgICAgPyB0aGlzLmNvbmZpZy5pbnN0YW5jZUNvbmZpZy5tYXN0ZXJJbnN0YW5jZVR5cGU/LnRvU3RyaW5nKCkgXG4gICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICB9LFxuXG4gICAgICAvLyBFQlPoqK3lrppcbiAgICAgIGViczoge1xuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICB2b2x1bWVUeXBlOiB0aGlzLmNvbmZpZy5zdG9yYWdlQ29uZmlnLnZvbHVtZVR5cGUsXG4gICAgICAgIHZvbHVtZVNpemU6IHRoaXMuY29uZmlnLnN0b3JhZ2VDb25maWcudm9sdW1lU2l6ZSxcbiAgICAgICAgaW9wczogdGhpcy5jb25maWcuc3RvcmFnZUNvbmZpZy5pb3BzLFxuICAgICAgICB0aHJvdWdocHV0OiB0aGlzLmNvbmZpZy5zdG9yYWdlQ29uZmlnLnRocm91Z2hwdXQsXG4gICAgICB9LFxuXG4gICAgICAvLyDjg43jg4Pjg4jjg6/jg7zjgq/oqK3lrppcbiAgICAgIHZwYzogdGhpcy5jb25maWcubmV0d29ya0NvbmZpZy52cGNFbmFibGVkID8gdGhpcy5jb25maWcubmV0d29ya0NvbmZpZy52cGMgOiB1bmRlZmluZWQsXG4gICAgICB2cGNTdWJuZXRzOiB0aGlzLmNvbmZpZy5uZXR3b3JrQ29uZmlnLnZwY0VuYWJsZWQgJiYgdGhpcy5jb25maWcubmV0d29ya0NvbmZpZy5zdWJuZXRzIFxuICAgICAgICA/IFt7IHN1Ym5ldHM6IHRoaXMuY29uZmlnLm5ldHdvcmtDb25maWcuc3VibmV0cyB9XSBcbiAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICBzZWN1cml0eUdyb3VwczogdGhpcy5zZWN1cml0eUdyb3VwID8gW3RoaXMuc2VjdXJpdHlHcm91cF0gOiB1bmRlZmluZWQsXG5cbiAgICAgIC8vIOOCu+OCreODpeODquODhuOCo+ioreWumlxuICAgICAgZW5jcnlwdGlvbkF0UmVzdDoge1xuICAgICAgICBlbmFibGVkOiB0aGlzLmNvbmZpZy5zZWN1cml0eUNvbmZpZy5lbmNyeXB0aW9uQXRSZXN0LFxuICAgICAgICBrbXNLZXk6IHRoaXMuY29uZmlnLnNlY3VyaXR5Q29uZmlnLmttc0tleSxcbiAgICAgIH0sXG4gICAgICBub2RlVG9Ob2RlRW5jcnlwdGlvbjogdGhpcy5jb25maWcuc2VjdXJpdHlDb25maWcubm9kZVRvTm9kZUVuY3J5cHRpb24sXG4gICAgICBlbmZvcmNlSHR0cHM6IHRoaXMuY29uZmlnLnNlY3VyaXR5Q29uZmlnLmVuZm9yY2VIdHRwcyxcblxuICAgICAgLy8g44OV44Kh44Kk44Oz44Ki44Kv44K744K55Yi25b6hXG4gICAgICBmaW5lR3JhaW5lZEFjY2Vzc0NvbnRyb2w6IHRoaXMuY29uZmlnLnNlY3VyaXR5Q29uZmlnLmZpbmVHcmFpbmVkQWNjZXNzQ29udHJvbCA/IHtcbiAgICAgICAgbWFzdGVyVXNlck5hbWU6IHRoaXMuY29uZmlnLnNlY3VyaXR5Q29uZmlnLm1hc3RlclVzZXJOYW1lIHx8ICdhZG1pbicsXG4gICAgICB9IDogdW5kZWZpbmVkLFxuXG4gICAgICAvLyDjg63jgrDoqK3lrppcbiAgICAgIGxvZ2dpbmc6IHtcbiAgICAgICAgc2xvd1NlYXJjaExvZ0VuYWJsZWQ6IHRoaXMuY29uZmlnLm1vbml0b3JpbmdDb25maWcuc2xvd0xvZ3NFbmFibGVkLFxuICAgICAgICBhcHBMb2dFbmFibGVkOiB0aGlzLmNvbmZpZy5tb25pdG9yaW5nQ29uZmlnLmFwcExvZ3NFbmFibGVkLFxuICAgICAgICBzbG93SW5kZXhMb2dFbmFibGVkOiB0aGlzLmNvbmZpZy5tb25pdG9yaW5nQ29uZmlnLmluZGV4U2xvd0xvZ3NFbmFibGVkLFxuICAgICAgfSxcblxuICAgICAgLy8g6Ieq5YuV44K544OK44OD44OX44K344On44OD44OIXG4gICAgICBhdXRvbWF0ZWRTbmFwc2hvdFN0YXJ0SG91cjogdGhpcy5jb25maWcuYmFja3VwQ29uZmlnPy5hdXRvbWF0ZWRTbmFwc2hvdFN0YXJ0SG91ciB8fCAzLFxuXG4gICAgICAvLyDjgqLjgq/jgrvjgrnjg53jg6rjgrfjg7xcbiAgICAgIGFjY2Vzc1BvbGljaWVzOiBbXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgcHJpbmNpcGFsczogW3RoaXMuYWNjZXNzUm9sZSFdLFxuICAgICAgICAgIGFjdGlvbnM6IFsnZXM6KiddLFxuICAgICAgICAgIHJlc291cmNlczogW2Bhcm46YXdzOmVzOiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06ZG9tYWluLyR7dGhpcy5jb25maWcuZG9tYWluTmFtZX0vKmBdLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG5cbiAgICAgIC8vIOWJiumZpOS/neitt++8iOacrOeVqueSsOWig+OBruOBv++8iVxuICAgICAgcmVtb3ZhbFBvbGljeTogdGhpcy5jb25maWcuZW52aXJvbm1lbnQgPT09ICdwcm9kJyBcbiAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gXG4gICAgICAgIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9O1xuXG4gICAgcmV0dXJuIG5ldyBvcGVuc2VhcmNoLkRvbWFpbih0aGlzLCAnT3BlblNlYXJjaERvbWFpbicsIGRvbWFpblByb3BzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbG91ZFdhdGNo44Ot44Kw6Kit5a6a5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUNsb3VkV2F0Y2hMb2dzKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmNvbmZpZy5tb25pdG9yaW5nQ29uZmlnLmxvZ3NFbmFibGVkKSB7XG4gICAgICAvLyDjgqLjg5fjg6rjgrHjg7zjgrfjg6fjg7Pjg63jgrBcbiAgICAgIGlmICh0aGlzLmNvbmZpZy5tb25pdG9yaW5nQ29uZmlnLmFwcExvZ3NFbmFibGVkKSB7XG4gICAgICAgIG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdPcGVuU2VhcmNoQXBwTG9nR3JvdXAnLCB7XG4gICAgICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9vcGVuc2VhcmNoL2RvbWFpbnMvJHt0aGlzLmNvbmZpZy5kb21haW5OYW1lfS9hcHBsaWNhdGlvbi1sb2dzYCxcbiAgICAgICAgICByZXRlbnRpb246IHRoaXMuY29uZmlnLmVudmlyb25tZW50ID09PSAncHJvZCcgXG4gICAgICAgICAgICA/IGxvZ3MuUmV0ZW50aW9uRGF5cy5TSVhfTU9OVEhTIFxuICAgICAgICAgICAgOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxuICAgICAgICAgIHJlbW92YWxQb2xpY3k6IHRoaXMuY29uZmlnLmVudmlyb25tZW50ID09PSAncHJvZCcgXG4gICAgICAgICAgICA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiBcbiAgICAgICAgICAgIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIOOCueODreODvOODreOCsFxuICAgICAgaWYgKHRoaXMuY29uZmlnLm1vbml0b3JpbmdDb25maWcuc2xvd0xvZ3NFbmFibGVkKSB7XG4gICAgICAgIG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdPcGVuU2VhcmNoU2xvd0xvZ0dyb3VwJywge1xuICAgICAgICAgIGxvZ0dyb3VwTmFtZTogYC9hd3Mvb3BlbnNlYXJjaC9kb21haW5zLyR7dGhpcy5jb25maWcuZG9tYWluTmFtZX0vc2VhcmNoLXNsb3dsb2dzYCxcbiAgICAgICAgICByZXRlbnRpb246IHRoaXMuY29uZmlnLmVudmlyb25tZW50ID09PSAncHJvZCcgXG4gICAgICAgICAgICA/IGxvZ3MuUmV0ZW50aW9uRGF5cy5USFJFRV9NT05USFMgXG4gICAgICAgICAgICA6IGxvZ3MuUmV0ZW50aW9uRGF5cy5UV09fV0VFS1MsXG4gICAgICAgICAgcmVtb3ZhbFBvbGljeTogdGhpcy5jb25maWcuZW52aXJvbm1lbnQgPT09ICdwcm9kJyBcbiAgICAgICAgICAgID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIFxuICAgICAgICAgICAgOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8g44Kk44Oz44OH44OD44Kv44K544K544Ot44O844Ot44KwXG4gICAgICBpZiAodGhpcy5jb25maWcubW9uaXRvcmluZ0NvbmZpZy5pbmRleFNsb3dMb2dzRW5hYmxlZCkge1xuICAgICAgICBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnT3BlblNlYXJjaEluZGV4U2xvd0xvZ0dyb3VwJywge1xuICAgICAgICAgIGxvZ0dyb3VwTmFtZTogYC9hd3Mvb3BlbnNlYXJjaC9kb21haW5zLyR7dGhpcy5jb25maWcuZG9tYWluTmFtZX0vaW5kZXgtc2xvd2xvZ3NgLFxuICAgICAgICAgIHJldGVudGlvbjogdGhpcy5jb25maWcuZW52aXJvbm1lbnQgPT09ICdwcm9kJyBcbiAgICAgICAgICAgID8gbG9ncy5SZXRlbnRpb25EYXlzLlRIUkVFX01PTlRIUyBcbiAgICAgICAgICAgIDogbG9ncy5SZXRlbnRpb25EYXlzLlRXT19XRUVLUyxcbiAgICAgICAgICByZW1vdmFsUG9saWN5OiB0aGlzLmNvbmZpZy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnIFxuICAgICAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gXG4gICAgICAgICAgICA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDlh7rlipvlgKTkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlT3V0cHV0cygpOiBPcGVuU2VhcmNoRG9tYWluT3V0cHV0cyB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGRvbWFpbkFybjogdGhpcy5kb21haW4uZG9tYWluQXJuLFxuICAgICAgZG9tYWluRW5kcG9pbnQ6IGBodHRwczovLyR7dGhpcy5kb21haW4uZG9tYWluRW5kcG9pbnR9YCxcbiAgICAgIGtpYmFuYUVuZHBvaW50OiBgaHR0cHM6Ly8ke3RoaXMuZG9tYWluLmRvbWFpbkVuZHBvaW50fS9fZGFzaGJvYXJkcy9gLFxuICAgICAgZG9tYWluTmFtZTogdGhpcy5kb21haW4uZG9tYWluTmFtZSxcbiAgICAgIHNlY3VyaXR5R3JvdXBJZDogdGhpcy5zZWN1cml0eUdyb3VwPy5zZWN1cml0eUdyb3VwSWQsXG4gICAgICBhY2Nlc3NQb2xpY3lBcm46IHRoaXMuYWNjZXNzUm9sZT8ucm9sZUFybixcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOOCv+OCsOmBqeeUqFxuICAgKi9cbiAgcHJpdmF0ZSBhcHBseVRhZ3MoKTogdm9pZCB7XG4gICAgY29uc3QgZGVmYXVsdFRhZ3MgPSB7XG4gICAgICBDb21wb25lbnQ6ICdPcGVuU2VhcmNoJyxcbiAgICAgIFB1cnBvc2U6ICdNdWx0aW1vZGFsRW1iZWRkaW5nJyxcbiAgICAgIEVudmlyb25tZW50OiB0aGlzLmNvbmZpZy5lbnZpcm9ubWVudCxcbiAgICAgIEVtYmVkZGluZ01vZGVsOiAnVGl0YW5NdWx0aW1vZGFsJyxcbiAgICB9O1xuXG4gICAgY29uc3QgYWxsVGFncyA9IHsgLi4uZGVmYXVsdFRhZ3MsIC4uLnRoaXMuY29uZmlnLnRhZ3MgfTtcblxuICAgIE9iamVjdC5lbnRyaWVzKGFsbFRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKGtleSwgdmFsdWUpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFRpdGFuIE11bHRpbW9kYWwgRW1iZWRkaW5n55So44Kk44Oz44OH44OD44Kv44K544OG44Oz44OX44Os44O844OI5L2c5oiQXG4gICAqIE9wZW5TZWFyY2ggNy4xMC4y5a++5b+c54mI77yIbWV0aG9k44OR44Op44Oh44O844K/6Zmk5Y6777yJXG4gICAqL1xuICBwdWJsaWMgY3JlYXRlTXVsdGltb2RhbEluZGV4VGVtcGxhdGUoKTogc3RyaW5nIHtcbiAgICBjb25zdCBpbmRleFRlbXBsYXRlID0ge1xuICAgICAgc2V0dGluZ3M6IHtcbiAgICAgICAgaW5kZXg6IHtcbiAgICAgICAgICBudW1iZXJfb2Zfc2hhcmRzOiB0aGlzLmNvbmZpZy5pbmRleENvbmZpZz8ubnVtYmVyT2ZTaGFyZHMgfHwgMixcbiAgICAgICAgICBudW1iZXJfb2ZfcmVwbGljYXM6IHRoaXMuY29uZmlnLmluZGV4Q29uZmlnPy5udW1iZXJPZlJlcGxpY2FzIHx8IDAsIC8vIOmWi+eZuueSsOWig+OBp+OBrzBcbiAgICAgICAgICBrbm46IHRydWUsXG4gICAgICAgICAgcmVmcmVzaF9pbnRlcnZhbDogJzMwcycsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgbWFwcGluZ3M6IHtcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgIGRvY3VtZW50X2lkOiB7IHR5cGU6ICdrZXl3b3JkJyB9LFxuICAgICAgICAgIGNvbnRlbnRfdHlwZTogeyB0eXBlOiAna2V5d29yZCcgfSxcbiAgICAgICAgICB0ZXh0X2NvbnRlbnQ6IHtcbiAgICAgICAgICAgIHR5cGU6ICd0ZXh0JyxcbiAgICAgICAgICAgIGFuYWx5emVyOiAnc3RhbmRhcmQnLFxuICAgICAgICAgICAgZmllbGRzOiB7IGtleXdvcmQ6IHsgdHlwZTogJ2tleXdvcmQnIH0gfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGltYWdlX21ldGFkYXRhOiB7XG4gICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgZm9ybWF0OiB7IHR5cGU6ICdrZXl3b3JkJyB9LFxuICAgICAgICAgICAgICBzaXplOiB7IHR5cGU6ICdsb25nJyB9LFxuICAgICAgICAgICAgICBkaW1lbnNpb25zOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgd2lkdGg6IHsgdHlwZTogJ2ludGVnZXInIH0sXG4gICAgICAgICAgICAgICAgICBoZWlnaHQ6IHsgdHlwZTogJ2ludGVnZXInIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICAvLyBPcGVuU2VhcmNoIDcuMTAuMuWvvuW/nO+8mm1ldGhvZOODkeODqeODoeODvOOCv+OCkuWJiumZpFxuICAgICAgICAgIHRleHRfZW1iZWRkaW5nX3ZlY3Rvcjoge1xuICAgICAgICAgICAgdHlwZTogJ2tubl92ZWN0b3InLFxuICAgICAgICAgICAgZGltZW5zaW9uOiAxMDI0LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgbXVsdGltb2RhbF9lbWJlZGRpbmdfdmVjdG9yOiB7XG4gICAgICAgICAgICB0eXBlOiAna25uX3ZlY3RvcicsXG4gICAgICAgICAgICBkaW1lbnNpb246IDEwMjQsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB1c2VyX3Blcm1pc3Npb25zOiB7IHR5cGU6ICdrZXl3b3JkJyB9LFxuICAgICAgICAgIGZpbGVfcGF0aDogeyB0eXBlOiAna2V5d29yZCcgfSxcbiAgICAgICAgICBjcmVhdGVkX2F0OiB7IHR5cGU6ICdkYXRlJyB9LFxuICAgICAgICAgIHVwZGF0ZWRfYXQ6IHsgdHlwZTogJ2RhdGUnIH0sXG4gICAgICAgICAgbW9kZWxfdmVyc2lvbjogeyB0eXBlOiAna2V5d29yZCcgfSxcbiAgICAgICAgICBlbWJlZGRpbmdfbW9kZWw6IHsgdHlwZTogJ2tleXdvcmQnIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH07XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoaW5kZXhUZW1wbGF0ZSwgbnVsbCwgMik7XG4gIH1cblxuICAvKipcbiAgICog44OR44OV44Kp44O844Oe44Oz44K55pyA6YGp5YyW6Kit5a6a5Y+W5b6X77yI55Kw5aKD5Yil5pyA6YGp5YyW77yJXG4gICAqL1xuICBwdWJsaWMgZ2V0UGVyZm9ybWFuY2VPcHRpbWl6YXRpb25TZXR0aW5ncygpOiBSZWNvcmQ8c3RyaW5nLCBhbnk+IHtcbiAgICBjb25zdCBiYXNlU2V0dGluZ3MgPSB7XG4gICAgICAvLyDjgqTjg7Pjg4fjg4Pjgq/jgrnoqK3lrprvvIjnkrDlooPliKXmnIDpganljJbvvIlcbiAgICAgICdpbmRleC5yZWZyZXNoX2ludGVydmFsJzogdGhpcy5jb25maWcuZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/ICczMHMnIDogJzVzJyxcbiAgICAgICdpbmRleC5udW1iZXJfb2ZfcmVwbGljYXMnOiB0aGlzLmNvbmZpZy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gMSA6IDAsXG4gICAgICAnaW5kZXgudHJhbnNsb2cuZmx1c2hfdGhyZXNob2xkX3NpemUnOiB0aGlzLmNvbmZpZy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gJzFnYicgOiAnNTEybWInLFxuICAgICAgJ2luZGV4LnRyYW5zbG9nLnN5bmNfaW50ZXJ2YWwnOiAnMzBzJyxcbiAgICAgICdpbmRleC50cmFuc2xvZy5kdXJhYmlsaXR5JzogdGhpcy5jb25maWcuZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/ICdyZXF1ZXN0JyA6ICdhc3luYycsXG4gICAgICBcbiAgICAgIC8vIOaknOe0ouioreWumlxuICAgICAgJ3NlYXJjaC5tYXhfYnVja2V0cyc6IHRoaXMuY29uZmlnLmVudmlyb25tZW50ID09PSAncHJvZCcgPyA2NTUzNiA6IDEwMDAwLFxuICAgICAgJ3NlYXJjaC5hbGxvd19leHBlbnNpdmVfcXVlcmllcyc6IHRoaXMuY29uZmlnLmVudmlyb25tZW50ICE9PSAncHJvZCcsXG4gICAgICAnc2VhcmNoLmRlZmF1bHRfc2VhcmNoX3RpbWVvdXQnOiAnMzBzJyxcbiAgICAgICdzZWFyY2gubWF4X29wZW5fc2Nyb2xsX2NvbnRleHQnOiA1MDAsXG4gICAgICBcbiAgICAgIC8vIEtOTuioreWumu+8iE9wZW5TZWFyY2ggMi545Lul6ZmN77yJXG4gICAgICAna25uLm1lbW9yeS5jaXJjdWl0X2JyZWFrZXIuZW5hYmxlZCc6IHRydWUsXG4gICAgICAna25uLm1lbW9yeS5jaXJjdWl0X2JyZWFrZXIubGltaXQnOiB0aGlzLmNvbmZpZy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gJzc1JScgOiAnNTAlJyxcbiAgICAgICdrbm4uY2FjaGUuaXRlbS5leHBpcnkuZW5hYmxlZCc6IHRydWUsXG4gICAgICAna25uLmNhY2hlLml0ZW0uZXhwaXJ5Lm1pbnV0ZXMnOiB0aGlzLmNvbmZpZy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gNjAgOiAzMCxcbiAgICAgICdrbm4uYWxnb19wYXJhbS5lZl9zZWFyY2gnOiB0aGlzLmNvbmZpZy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gNTEyIDogMTAwLFxuICAgICAgXG4gICAgICAvLyDjgq/jg6njgrnjgr/jg7zoqK3lrprvvIjnkrDlooPliKXoqr/mlbTvvIlcbiAgICAgICdjbHVzdGVyLnJvdXRpbmcuYWxsb2NhdGlvbi5kaXNrLnRocmVzaG9sZF9lbmFibGVkJzogdHJ1ZSxcbiAgICAgICdjbHVzdGVyLnJvdXRpbmcuYWxsb2NhdGlvbi5kaXNrLndhdGVybWFyay5sb3cnOiB0aGlzLmNvbmZpZy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gJzg1JScgOiAnODAlJyxcbiAgICAgICdjbHVzdGVyLnJvdXRpbmcuYWxsb2NhdGlvbi5kaXNrLndhdGVybWFyay5oaWdoJzogdGhpcy5jb25maWcuZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/ICc5MCUnIDogJzg1JScsXG4gICAgICAnY2x1c3Rlci5yb3V0aW5nLmFsbG9jYXRpb24uZGlzay53YXRlcm1hcmsuZmxvb2Rfc3RhZ2UnOiB0aGlzLmNvbmZpZy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gJzk1JScgOiAnOTAlJyxcbiAgICAgICdjbHVzdGVyLnJvdXRpbmcuYWxsb2NhdGlvbi5jbHVzdGVyX2NvbmN1cnJlbnRfcmViYWxhbmNlJzogMixcbiAgICAgICdjbHVzdGVyLnJvdXRpbmcuYWxsb2NhdGlvbi5ub2RlX2NvbmN1cnJlbnRfcmVjb3Zlcmllcyc6IDIsXG4gICAgICBcbiAgICAgIC8vIOOCueODrOODg+ODieODl+ODvOODq+ioreWumlxuICAgICAgJ3RocmVhZF9wb29sLnNlYXJjaC5zaXplJzogTWF0aC5tYXgoMSwgTWF0aC5mbG9vcih0aGlzLmNvbmZpZy5pbnN0YW5jZUNvbmZpZy5pbnN0YW5jZUNvdW50ICogMikpLFxuICAgICAgJ3RocmVhZF9wb29sLnNlYXJjaC5xdWV1ZV9zaXplJzogMTAwMCxcbiAgICAgICd0aHJlYWRfcG9vbC53cml0ZS5zaXplJzogTWF0aC5tYXgoMSwgTWF0aC5mbG9vcih0aGlzLmNvbmZpZy5pbnN0YW5jZUNvbmZpZy5pbnN0YW5jZUNvdW50ICogMSkpLFxuICAgICAgJ3RocmVhZF9wb29sLndyaXRlLnF1ZXVlX3NpemUnOiAyMDAsXG4gICAgICBcbiAgICAgIC8vIEpWTeioreWumu+8iOODoeODouODquacgOmBqeWMlu+8iVxuICAgICAgJ2luZGljZXMubWVtb3J5LmluZGV4X2J1ZmZlcl9zaXplJzogdGhpcy5jb25maWcuZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/ICcyMCUnIDogJzEwJScsXG4gICAgICAnaW5kaWNlcy5tZW1vcnkubWluX2luZGV4X2J1ZmZlcl9zaXplJzogJzQ4bWInLFxuICAgICAgJ2luZGljZXMubWVtb3J5Lm1heF9pbmRleF9idWZmZXJfc2l6ZSc6IHRoaXMuY29uZmlnLmVudmlyb25tZW50ID09PSAncHJvZCcgPyAnNTEybWInIDogJzI1Nm1iJyxcbiAgICB9O1xuXG4gICAgLy8g5pys55Wq55Kw5aKD5bCC55So6Kit5a6aXG4gICAgaWYgKHRoaXMuY29uZmlnLmVudmlyb25tZW50ID09PSAncHJvZCcpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIC4uLmJhc2VTZXR0aW5ncyxcbiAgICAgICAgLy8g5pys55Wq55Kw5aKD5bCC55So44Gu6auY44OR44OV44Kp44O844Oe44Oz44K56Kit5a6aXG4gICAgICAgICdpbmRpY2VzLmZpZWxkZGF0YS5jYWNoZS5zaXplJzogJzQwJScsXG4gICAgICAgICdpbmRpY2VzLnF1ZXJpZXMuY2FjaGUuc2l6ZSc6ICcxMCUnLFxuICAgICAgICAnaW5kaWNlcy5yZXF1ZXN0cy5jYWNoZS5zaXplJzogJzIlJyxcbiAgICAgICAgJ2Jvb3RzdHJhcC5tZW1vcnlfbG9jayc6IHRydWUsXG4gICAgICAgICdjbHVzdGVyLnJvdXRpbmcuYWxsb2NhdGlvbi5hd2FyZW5lc3MuYXR0cmlidXRlcyc6ICd6b25lJyxcbiAgICAgICAgJ2NsdXN0ZXIucm91dGluZy5hbGxvY2F0aW9uLmF3YXJlbmVzcy5mb3JjZS56b25lLnZhbHVlcyc6ICd6b25lMSx6b25lMix6b25lMycsXG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBiYXNlU2V0dGluZ3M7XG4gIH1cblxuICAvKipcbiAgICogQ2xvdWRXYXRjaOOCouODqeODvOODoOS9nOaIkFxuICAgKi9cbiAgcHVibGljIGNyZWF0ZUNsb3VkV2F0Y2hBbGFybXMoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmNvbmZpZy5tb25pdG9yaW5nQ29uZmlnLmxvZ3NFbmFibGVkKSByZXR1cm47XG5cbiAgICBjb25zdCBhbGFybU5hbWVzcGFjZSA9ICdBV1MvRVMnO1xuICAgIGNvbnN0IGRpbWVuc2lvbk5hbWUgPSAnRG9tYWluTmFtZSc7XG4gICAgY29uc3QgZGltZW5zaW9uVmFsdWUgPSB0aGlzLmNvbmZpZy5kb21haW5OYW1lO1xuXG4gICAgLy8g44Kv44Op44K544K/44O854q25oWL44Ki44Op44O844OgXG4gICAgbmV3IGNkay5hd3NfY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnQ2x1c3RlclN0YXR1c1JlZEFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiBgJHt0aGlzLmNvbmZpZy5kb21haW5OYW1lfS1jbHVzdGVyLXN0YXR1cy1yZWRgLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ09wZW5TZWFyY2jjgq/jg6njgrnjgr/jg7zjgYzotaTnirbmhYvjgafjgZknLFxuICAgICAgbWV0cmljOiBuZXcgY2RrLmF3c19jbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogYWxhcm1OYW1lc3BhY2UsXG4gICAgICAgIG1ldHJpY05hbWU6ICdDbHVzdGVyU3RhdHVzLnJlZCcsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHsgW2RpbWVuc2lvbk5hbWVdOiBkaW1lbnNpb25WYWx1ZSB9LFxuICAgICAgICBzdGF0aXN0aWM6ICdNYXhpbXVtJyxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiAwLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjZGsuYXdzX2Nsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNkay5hd3NfY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgfSk7XG5cbiAgICAvLyBDUFXkvb/nlKjnjofjgqLjg6njg7zjg6BcbiAgICBuZXcgY2RrLmF3c19jbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdIaWdoQ3B1QWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6IGAke3RoaXMuY29uZmlnLmRvbWFpbk5hbWV9LWhpZ2gtY3B1YCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdPcGVuU2VhcmNo44GuQ1BV5L2/55So546H44GM6auY44GZ44GO44G+44GZJyxcbiAgICAgIG1ldHJpYzogbmV3IGNkay5hd3NfY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6IGFsYXJtTmFtZXNwYWNlLFxuICAgICAgICBtZXRyaWNOYW1lOiAnQ1BVVXRpbGl6YXRpb24nLFxuICAgICAgICBkaW1lbnNpb25zTWFwOiB7IFtkaW1lbnNpb25OYW1lXTogZGltZW5zaW9uVmFsdWUgfSxcbiAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICB9KSxcbiAgICAgIHRocmVzaG9sZDogdGhpcy5jb25maWcuZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IDgwIDogOTAsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNkay5hd3NfY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX1RIUkVTSE9MRCxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgIH0pO1xuXG4gICAgLy8g44Oh44Oi44Oq5L2/55So546H44Ki44Op44O844OgXG4gICAgbmV3IGNkay5hd3NfY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnSGlnaE1lbW9yeUFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiBgJHt0aGlzLmNvbmZpZy5kb21haW5OYW1lfS1oaWdoLW1lbW9yeWAsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnT3BlblNlYXJjaOOBruODoeODouODquS9v+eUqOeOh+OBjOmrmOOBmeOBjuOBvuOBmScsXG4gICAgICBtZXRyaWM6IG5ldyBjZGsuYXdzX2Nsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiBhbGFybU5hbWVzcGFjZSxcbiAgICAgICAgbWV0cmljTmFtZTogJ0pWTU1lbW9yeVByZXNzdXJlJyxcbiAgICAgICAgZGltZW5zaW9uc01hcDogeyBbZGltZW5zaW9uTmFtZV06IGRpbWVuc2lvblZhbHVlIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ01heGltdW0nLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IHRoaXMuY29uZmlnLmVudmlyb25tZW50ID09PSAncHJvZCcgPyA4NSA6IDk1LFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjZGsuYXdzX2Nsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMyxcbiAgICB9KTtcblxuICAgIC8vIOODh+OCo+OCueOCr+S9v+eUqOeOh+OCouODqeODvOODoFxuICAgIG5ldyBjZGsuYXdzX2Nsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ0hpZ2hEaXNrVXNhZ2VBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogYCR7dGhpcy5jb25maWcuZG9tYWluTmFtZX0taGlnaC1kaXNrLXVzYWdlYCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdPcGVuU2VhcmNo44Gu44OH44Kj44K544Kv5L2/55So546H44GM6auY44GZ44GO44G+44GZJyxcbiAgICAgIG1ldHJpYzogbmV3IGNkay5hd3NfY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6IGFsYXJtTmFtZXNwYWNlLFxuICAgICAgICBtZXRyaWNOYW1lOiAnU3RvcmFnZVV0aWxpemF0aW9uJyxcbiAgICAgICAgZGltZW5zaW9uc01hcDogeyBbZGltZW5zaW9uTmFtZV06IGRpbWVuc2lvblZhbHVlIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ01heGltdW0nLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IHRoaXMuY29uZmlnLmVudmlyb25tZW50ID09PSAncHJvZCcgPyA4MCA6IDg1LFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjZGsuYXdzX2Nsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICB9KTtcbiAgfVxufSJdfQ==