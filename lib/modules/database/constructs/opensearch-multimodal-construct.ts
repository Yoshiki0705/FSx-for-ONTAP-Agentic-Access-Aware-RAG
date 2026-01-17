/**
 * OpenSearch Multimodal Embeddingクラスター構築
 * 
 * Titan Multimodal Embedding用に最適化されたOpenSearchクラスター
 * - ベクトル検索最適化
 * - 高性能インスタンス設定
 * - セキュリティ強化
 * - 監視・ログ設定
 */

import * as cdk from 'aws-cdk-lib';
import * as opensearch from 'aws-cdk-lib/aws-opensearchserverless';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
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

export class OpenSearchMultimodalConstruct extends Construct {
  public readonly collection: opensearch.CfnCollection;
  public readonly outputs: OpenSearchMultimodalOutputs;
  private readonly securityGroup?: ec2.SecurityGroup;
  private readonly accessRole?: iam.Role;
  private config: OpenSearchMultimodalConfig;

  constructor(scope: Construct, id: string, config: OpenSearchMultimodalConfig) {
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
  private validateConfig(): void {
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
   * IAMアクセスロール作成
   */
  private createAccessRole(): iam.Role {
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
  private createOpenSearchCollection(): opensearch.CfnCollection {
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
  private createSecurityPolicy(): opensearch.CfnSecurityPolicy {
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
  private createNetworkPolicy(): opensearch.CfnSecurityPolicy {
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
  private createDataAccessPolicy(): opensearch.CfnAccessPolicy {
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
        Principal: [this.accessRole!.roleArn]
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
  private createCollectionTags(): cdk.CfnTag[] {
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
  private createCloudWatchLogs(): void {
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
  private createOutputs(): OpenSearchMultimodalOutputs {
    return {
      domainArn: this.collection.attrArn,
      domainEndpoint: this.collection.attrCollectionEndpoint,
      kibanaEndpoint: this.collection.attrDashboardEndpoint,
      domainName: this.collection.name!,
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
   * Titan Multimodal Embedding用インデックス作成
   */
  public createMultimodalIndex(): string {
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
  public getPerformanceOptimizationSettings(): Record<string, any> {
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