/**
 * OpenSearch Domain構築（通常のOpenSearchクラスター）
 * 
 * Titan Multimodal Embedding用に最適化されたOpenSearchドメイン
 * - ベクトル検索最適化
 * - 開発環境向け設定
 * - セキュリティ強化
 * - 監視・ログ設定
 */

import * as cdk from 'aws-cdk-lib';
import * as opensearch from 'aws-cdk-lib/aws-opensearch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
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

export class OpenSearchDomainConstruct extends Construct {
  public readonly domain: opensearch.Domain;
  public readonly outputs: OpenSearchDomainOutputs;
  private readonly securityGroup?: ec2.SecurityGroup;
  private readonly accessRole?: iam.Role;

  constructor(scope: Construct, id: string, private config: OpenSearchDomainConfig) {
    super(scope, id);

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
  private validateConfig(): void {
    const errors: string[] = [];

    // ドメイン名検証
    if (!this.config.domainName || this.config.domainName.trim().length === 0) {
      errors.push('ドメイン名が空です');
    } else {
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
  private createSecurityGroup(): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'OpenSearchSecurityGroup', {
      vpc: this.config.networkConfig.vpc!,
      description: `Security group for OpenSearch domain ${this.config.domainName}`,
      allowAllOutbound: true,
    });

    // HTTPS (443) アクセス許可（VPC内のみ）
    sg.addIngressRule(
      ec2.Peer.ipv4(this.config.networkConfig.vpc!.vpcCidrBlock),
      ec2.Port.tcp(443),
      'HTTPS access to OpenSearch from VPC'
    );

    // OpenSearch API (9200) アクセス許可（VPC内のみ）
    sg.addIngressRule(
      ec2.Peer.ipv4(this.config.networkConfig.vpc!.vpcCidrBlock),
      ec2.Port.tcp(9200),
      'OpenSearch API access from VPC'
    );

    return sg;
  }

  /**
   * IAMアクセスロール作成（セキュリティ強化版）
   */
  private createAccessRole(): iam.Role {
    const role = new iam.Role(this, 'OpenSearchAccessRole', {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('lambda.amazonaws.com'),
        new iam.ServicePrincipal('ec2.amazonaws.com'),
        // 本番環境ではAccountRootPrincipalを除外
        ...(this.config.environment !== 'prod' ? [new iam.AccountRootPrincipal()] : [])
      ),
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
  private createOpenSearchDomain(): opensearch.Domain {
    // ドメイン設定
    const domainProps: opensearch.DomainProps = {
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
          principals: [this.accessRole!],
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
  private createCloudWatchLogs(): void {
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
  private createOutputs(): OpenSearchDomainOutputs {
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
  private applyTags(): void {
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
  public createMultimodalIndexTemplate(): string {
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
  public getPerformanceOptimizationSettings(): Record<string, any> {
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
  public createCloudWatchAlarms(): void {
    if (!this.config.monitoringConfig.logsEnabled) return;

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