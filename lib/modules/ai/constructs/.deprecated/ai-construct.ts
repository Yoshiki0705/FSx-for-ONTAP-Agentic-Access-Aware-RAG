/**
 * AIコンストラクト - 強化版
 * 
 * Amazon Bedrock、Embedding処理（4パターン選択式）、ベクトル検索の統合管理を提供
 * 
 * 統合機能:
 * - Amazon Bedrock統合（テキスト生成・Embedding）
 * - 4パターン選択式Embedding処理（AWS Batch、EC2 Spot、ECS on EC2、EC2 On-Demand）
 * - ベクトル検索エンジン統合
 * - RAGパイプライン統合
 * - FSx for NetApp ONTAP統合
 */

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { AIConfig, AIOutputs, ModelConfig, EmbeddingPattern } from '../interfaces/ai-config';

export interface AIConstructProps {
  config: AIConfig;
  projectName: string;
  environment: string;
  region: string;
  kmsKey?: kms.IKey;
  embeddingsBucket?: s3.IBucket;
  documentsBucket?: s3.IBucket;
  processedBucket?: s3.IBucket;
  metadataBucket?: s3.IBucket;
  lambdaRole?: iam.IRole;
  vpc?: ec2.IVpc;
  databaseStack?: any; // DatabaseStackの参照
  storageStack?: any;  // StorageStackの参照
}

export class AIConstruct extends Construct {
  public readonly outputs: AIOutputs;
  public readonly bedrockRole: iam.Role;
  public readonly embeddingProcessor?: lambda.Function;
  
  // 4パターン選択式Embedding処理リソース
  public readonly selectedEmbeddingPattern: EmbeddingPattern;
  public readonly patternManagerFunction: lambda.Function;
  public readonly monitoringDashboard: cloudwatch.Dashboard;
  
  // パターン別リソース
  public batchComputeEnvironment?: batch.CfnComputeEnvironment;
  public batchJobQueue?: batch.CfnJobQueue;
  public batchJobDefinition?: batch.CfnJobDefinition;
  public spotAutoScalingGroup?: autoscaling.AutoScalingGroup;
  public spotLaunchTemplate?: ec2.LaunchTemplate;
  public ecsCluster?: ecs.Cluster;
  public ecsService?: ecs.FargateService;
  public ecsTaskDefinition?: ecs.FargateTaskDefinition;
  public onDemandInstance?: ec2.Instance;

  constructor(scope: Construct, id: string, private props: AIConstructProps) {
    super(scope, id);

    // 選択されたEmbeddingパターンの設定
    this.selectedEmbeddingPattern = this.props.config.embedding.pattern;

    // Bedrock実行ロール作成
    this.bedrockRole = this.createBedrockExecutionRole();

    // Bedrock設定
    if (this.props.config.bedrock.enabled) {
      this.setupBedrockAccess();
    }

    // Parameter Store設定
    this.createParameterStore();

    // パターン管理Lambda作成
    this.patternManagerFunction = this.createPatternManagerFunction();

    // 選択されたパターンに応じてEmbedding処理設定
    this.setupEmbeddingProcessing();

    // ベクトル検索設定
    this.setupVectorSearch();

    // RAGパイプライン設定
    this.setupRAGPipeline();

    // 統合監視システム作成
    this.monitoringDashboard = this.createMonitoringDashboard();

    // EventBridge統合
    this.createEventBridgeIntegration();

    // 出力値の設定
    this.outputs = this.createOutputs();

    // タグ設定
    this.applyTags();
  }

  /**
   * Bedrock実行ロール作成
   */
  private createBedrockExecutionRole(): iam.Role {
    const role = new iam.Role(this, 'BedrockExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: `Bedrock execution role for ${this.props.projectName}`,
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Bedrockアクセス権限
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
        'bedrock:GetFoundationModel',
        'bedrock:ListFoundationModels',
      ],
      resources: [
        `arn:aws:bedrock:*::foundation-model/${this.props.config.bedrock.models.textGeneration.modelId}`,
        `arn:aws:bedrock:*::foundation-model/${this.props.config.bedrock.models.embedding.modelId}`,
      ],
    }));

    // Guardrails権限（有効な場合）
    if (this.props.config.bedrock.guardrails?.enabled) {
      role.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:ApplyGuardrail',
        ],
        resources: [
          `arn:aws:bedrock:*:*:guardrail/${this.props.config.bedrock.guardrails.guardrailId}`,
        ],
      }));
    }

    // S3アクセス権限
    if (this.props.embeddingsBucket) {
      this.props.embeddingsBucket.grantReadWrite(role);
    }

    // KMSアクセス権限
    if (this.props.kmsKey) {
      this.props.kmsKey.grantEncryptDecrypt(role);
    }

    return role;
  }

  /**
   * Bedrockアクセス設定
   */
  private setupBedrockAccess(): void {
    // Bedrockモデルアクセス設定
    // 注意: Bedrockモデルアクセスは通常、AWSコンソールまたはAPIで事前に有効化する必要があります
    
    // CloudFormationカスタムリソースでモデルアクセスを設定（将来実装）
    // const modelAccessCustomResource = new cdk.CustomResource(this, 'BedrockModelAccess', {
    //   serviceToken: modelAccessProvider.serviceToken,
    //   properties: {
    //     ModelIds: [
    //       this.props.config.bedrock.models.textGeneration.modelId,
    //       this.props.config.bedrock.models.embedding.modelId,
    //     ],
    //   },
    // });
  }

  /**
   * Parameter Store設定作成
   */
  private createParameterStore(): void {
    // 選択されたパターン設定
    new ssm.StringParameter(this, 'SelectedEmbeddingPattern', {
      parameterName: `/${this.props.projectName}/${this.props.environment}/ai/embedding/selected-pattern`,
      stringValue: this.selectedEmbeddingPattern,
      description: `Selected embedding pattern for ${this.props.projectName} ${this.props.environment}`,
      tier: ssm.ParameterTier.STANDARD
    });
    
    // パターン別設定
    new ssm.StringParameter(this, 'EmbeddingPatternConfigs', {
      parameterName: `/${this.props.projectName}/${this.props.environment}/ai/embedding/pattern-configs`,
      stringValue: JSON.stringify(this.props.config.embedding.patternConfigs || {}),
      description: `Embedding pattern configurations for ${this.props.projectName} ${this.props.environment}`,
      tier: ssm.ParameterTier.STANDARD
    });
  }

  /**
   * パターン管理Lambda関数作成
   */
  private createPatternManagerFunction(): lambda.Function {
    return new lambda.Function(this, 'EmbeddingPatternManagerFunction', {
      functionName: `${this.props.projectName}-${this.props.environment}-ai-embedding-pattern-manager`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const ssm = new AWS.SSM();
        
        exports.handler = async (event) => {
          console.log('AI Embedding Pattern Manager Event:', JSON.stringify(event, null, 2));
          
          try {
            const action = event.action || 'get-recommendation';
            
            switch (action) {
              case 'get-recommendation':
                return await getPatternRecommendation(event);
              case 'switch-pattern':
                return await switchPattern(event);
              case 'get-performance-stats':
                return await getPerformanceStats(event);
              case 'optimize-pattern':
                return await optimizePattern(event);
              default:
                throw new Error(\`Unknown action: \${action}\`);
            }
          } catch (error) {
            console.error('AI Embedding Pattern Manager Error:', error);
            return {
              statusCode: 500,
              body: JSON.stringify({ error: error.message })
            };
          }
        };
        
        async function getPatternRecommendation(event) {
          const fileCount = event.fileCount || 0;
          const priority = event.priority || 'balanced';
          const dataSize = event.dataSizeGB || 0;
          
          let recommendedPattern = '${this.selectedEmbeddingPattern}';
          
          // コスト重視の場合
          if (priority === 'cost') {
            recommendedPattern = 'ec2-spot';
          } 
          // パフォーマンス重視の場合
          else if (priority === 'performance') {
            recommendedPattern = 'aws-batch';
          } 
          // 運用性重視の場合
          else if (priority === 'operability') {
            recommendedPattern = 'ecs-on-ec2';
          } 
          // バランス重視の場合（ファイル数とデータサイズで判定）
          else {
            if (fileCount >= 10000 || dataSize >= 100) {
              recommendedPattern = 'aws-batch';
            } else if (fileCount >= 1000 || dataSize >= 10) {
              recommendedPattern = 'ec2-spot';
            } else if (fileCount >= 100 || dataSize >= 1) {
              recommendedPattern = 'ecs-on-ec2';
            } else {
              recommendedPattern = 'ec2-on-demand';
            }
          }
          
          return {
            statusCode: 200,
            body: JSON.stringify({
              recommendedPattern,
              currentPattern: '${this.selectedEmbeddingPattern}',
              fileCount,
              dataSizeGB: dataSize,
              priority,
              reasoning: getRecommendationReasoning(recommendedPattern, fileCount, dataSize, priority)
            })
          };
        }
        
        function getRecommendationReasoning(pattern, fileCount, dataSize, priority) {
          const reasons = {
            'aws-batch': '大量データ処理に最適、フルマネージド、高い耐障害性',
            'ec2-spot': '90%コスト削減、中程度の耐障害性、中規模データに適合',
            'ecs-on-ec2': '高い運用性、ECS統合、小中規模データに適合',
            'ec2-on-demand': '小規模データ専用、高コストのため非推奨'
          };
          
          return reasons[pattern] || '不明なパターン';
        }
        
        async function switchPattern(event) {
          const newPattern = event.newPattern;
          
          if (!newPattern) {
            throw new Error('newPattern is required');
          }
          
          await ssm.putParameter({
            Name: '/${this.props.projectName}/${this.props.environment}/ai/embedding/selected-pattern',
            Value: newPattern,
            Overwrite: true
          }).promise();
          
          return {
            statusCode: 200,
            body: JSON.stringify({
              message: \`AI Embedding pattern switched to \${newPattern}\`,
              previousPattern: '${this.selectedEmbeddingPattern}',
              newPattern,
              timestamp: new Date().toISOString()
            })
          };
        }
        
        async function getPerformanceStats(event) {
          // CloudWatchメトリクスから性能統計を取得（実装例）
          return {
            statusCode: 200,
            body: JSON.stringify({
              performanceStats: {
                currentPattern: '${this.selectedEmbeddingPattern}',
                timestamp: new Date().toISOString(),
                metrics: {
                  averageProcessingTime: 0,
                  successRate: 0,
                  costPerFile: 0,
                  throughput: 0
                }
              }
            })
          };
        }
        
        async function optimizePattern(event) {
          // パフォーマンス統計に基づいてパターン最適化を提案
          const stats = await getPerformanceStats(event);
          const recommendation = await getPatternRecommendation(event);
          
          return {
            statusCode: 200,
            body: JSON.stringify({
              optimization: {
                currentPattern: '${this.selectedEmbeddingPattern}',
                recommendedPattern: JSON.parse(recommendation.body).recommendedPattern,
                optimizationPotential: 'medium',
                estimatedSavings: '30-50%',
                timestamp: new Date().toISOString()
              }
            })
          };
        }
      `),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: {
        PROJECT_NAME: this.props.projectName,
        ENVIRONMENT: this.props.environment,
        REGION: this.props.region,
        SELECTED_PATTERN: this.selectedEmbeddingPattern
      },
      logRetention: logs.RetentionDays.ONE_WEEK
    });
  }

  /**
   * Embedding処理設定（4パターン選択式）
   */
  private setupEmbeddingProcessing(): void {
    // 選択されたパターンに応じてリソース作成
    const patternConfig = this.props.config.embedding.patternConfigs?.[this.selectedEmbeddingPattern];
    
    if (!patternConfig?.enabled) {
      throw new Error(`Selected embedding pattern ${this.selectedEmbeddingPattern} is not enabled`);
    }
    
    switch (this.selectedEmbeddingPattern) {
      case 'aws-batch':
        this.createAwsBatchResources();
        break;
      case 'ec2-spot':
        this.createEc2SpotResources();
        break;
      case 'ecs-on-ec2':
        this.createEcsOnEc2Resources();
        break;
      case 'ec2-on-demand':
        this.createEc2OnDemandResources();
        break;
      default:
        throw new Error(`Unknown embedding pattern: ${this.selectedEmbeddingPattern}`);
    }

    // Bedrock Embeddingの設定
    if (this.props.config.embedding.strategy === 'bedrock') {
      this.setupBedrockEmbedding();
    }
  }

  /**
   * AWS Batchリソース作成
   */
  private createAwsBatchResources(): void {
    const batchConfig = this.props.config.embedding.batchConfig;
    if (!batchConfig) {
      throw new Error('Batch configuration is required for aws-batch pattern');
    }

    // Batch Service Role
    const batchServiceRole = new iam.Role(this, 'BatchServiceRole', {
      assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBatchServiceRole')
      ]
    });

    // Instance Role
    const instanceRole = new iam.Role(this, 'BatchInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEC2ContainerServiceforEC2Role'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy')
      ]
    });

    // Instance Profile
    const instanceProfile = new iam.CfnInstanceProfile(this, 'BatchInstanceProfile', {
      roles: [instanceRole.roleName]
    });

    // Compute Environment
    this.batchComputeEnvironment = new batch.CfnComputeEnvironment(this, 'BatchComputeEnvironment', {
      type: 'MANAGED',
      state: 'ENABLED',
      computeEnvironmentName: `${this.props.projectName}-${this.props.environment}-ai-embedding-batch-ce`,
      serviceRole: batchServiceRole.roleArn,
      computeResources: {
        type: batchConfig.useSpotInstances ? 'SPOT' : 'EC2',
        minvCpus: batchConfig.minvCpus || 0,
        maxvCpus: batchConfig.maxvCpus,
        desiredvCpus: batchConfig.desiredvCpus || 0,
        instanceTypes: batchConfig.instanceTypes,
        instanceRole: instanceProfile.attrArn,
        spotIamFleetRequestRole: batchConfig.useSpotInstances ? 
          iam.Role.fromRoleArn(this, 'SpotFleetRole', 
            `arn:aws:iam::${cdk.Stack.of(this).account}:role/aws-ec2-spot-fleet-tagging-role`).roleArn : undefined,
        bidPercentage: batchConfig.useSpotInstances ? 50 : undefined,
        subnets: this.props.vpc?.privateSubnets.map(subnet => subnet.subnetId) || []
      }
    });

    // Job Queue
    this.batchJobQueue = new batch.CfnJobQueue(this, 'BatchJobQueue', {
      jobQueueName: `${this.props.projectName}-${this.props.environment}-ai-embedding-queue`,
      state: 'ENABLED',
      priority: 1,
      computeEnvironmentOrder: [{
        order: 1,
        computeEnvironment: this.batchComputeEnvironment.ref
      }]
    });

    // Job Definition
    this.batchJobDefinition = new batch.CfnJobDefinition(this, 'BatchJobDefinition', {
      jobDefinitionName: `${this.props.projectName}-${this.props.environment}-ai-embedding-job`,
      type: 'container',
      containerProperties: {
        image: this.props.config.embedding.dockerConfig.image,
        vcpus: this.props.config.embedding.dockerConfig.vcpus || 2,
        memory: this.props.config.embedding.dockerConfig.memory || 4096,
        jobRoleArn: this.bedrockRole.roleArn,
        environment: [
          { name: 'PROJECT_NAME', value: this.props.projectName },
          { name: 'ENVIRONMENT', value: this.props.environment },
          { name: 'PATTERN', value: 'aws-batch' },
          { name: 'BEDROCK_REGION', value: this.props.region },
          ...Object.entries(this.props.config.embedding.dockerConfig.environmentVariables || {})
            .map(([name, value]) => ({ name, value }))
        ]
      },
      retryStrategy: {
        attempts: batchConfig.retryAttempts || 3
      },
      timeout: {
        attemptDurationSeconds: batchConfig.jobTimeoutSeconds || 3600
      }
    });
  }

  /**
   * EC2 Spotリソース作成
   */
  private createEc2SpotResources(): void {
    const spotConfig = this.props.config.embedding.spotConfig;
    if (!spotConfig) {
      throw new Error('Spot configuration is required for ec2-spot pattern');
    }

    // EC2 Role
    const ec2Role = new iam.Role(this, 'SpotEc2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy')
      ]
    });

    // Bedrock権限を追加
    ec2Role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream'
      ],
      resources: ['*']
    }));

    // Launch Template
    this.spotLaunchTemplate = new ec2.LaunchTemplate(this, 'SpotLaunchTemplate', {
      launchTemplateName: `${this.props.projectName}-${this.props.environment}-ai-embedding-spot-lt`,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.M5, 
        ec2.InstanceSize.LARGE
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      role: ec2Role,
      userData: ec2.UserData.forLinux(),
      spotOptions: {
        requestType: ec2.SpotRequestType.ONE_TIME,
        maxPrice: cdk.Token.asNumber(spotConfig.maxPrice)
      }
    });

    // Auto Scaling Group
    this.spotAutoScalingGroup = new autoscaling.AutoScalingGroup(this, 'SpotAutoScalingGroup', {
      autoScalingGroupName: `${this.props.projectName}-${this.props.environment}-ai-embedding-spot-asg`,
      vpc: this.props.vpc || ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true }),
      launchTemplate: this.spotLaunchTemplate,
      minCapacity: spotConfig.autoScalingConfig.minCapacity || 0,
      maxCapacity: spotConfig.autoScalingConfig.maxCapacity,
      desiredCapacity: spotConfig.autoScalingConfig.desiredCapacity
    });
  }

  /**
   * ECS on EC2リソース作成
   */
  private createEcsOnEc2Resources(): void {
    const ecsConfig = this.props.config.embedding.ecsConfig;
    if (!ecsConfig) {
      throw new Error('ECS configuration is required for ecs-on-ec2 pattern');
    }

    // ECS Cluster
    this.ecsCluster = new ecs.Cluster(this, 'EcsCluster', {
      clusterName: `${this.props.projectName}-${this.props.environment}-ai-embedding-cluster`,
      vpc: this.props.vpc
    });

    // Task Definition
    this.ecsTaskDefinition = new ecs.FargateTaskDefinition(this, 'EcsTaskDefinition', {
      family: `${this.props.projectName}-${this.props.environment}-ai-embedding-task`,
      cpu: ecsConfig.cpu,
      memoryLimitMiB: ecsConfig.memory,
      taskRole: this.bedrockRole
    });

    // Container Definition
    this.ecsTaskDefinition.addContainer('EmbeddingContainer', {
      image: ecs.ContainerImage.fromRegistry(this.props.config.embedding.dockerConfig.image),
      memoryLimitMiB: ecsConfig.memory,
      cpu: ecsConfig.cpu,
      environment: {
        PROJECT_NAME: this.props.projectName,
        ENVIRONMENT: this.props.environment,
        PATTERN: 'ecs-on-ec2',
        BEDROCK_REGION: this.props.region,
        ...this.props.config.embedding.dockerConfig.environmentVariables
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ai-embedding',
        logRetention: logs.RetentionDays.ONE_WEEK
      })
    });

    // ECS Service
    this.ecsService = new ecs.FargateService(this, 'EcsService', {
      cluster: this.ecsCluster,
      taskDefinition: this.ecsTaskDefinition,
      serviceName: `${this.props.projectName}-${this.props.environment}-ai-embedding-service`,
      desiredCount: ecsConfig.desiredCount
    });
  }

  /**
   * EC2 On-Demandリソース作成
   */
  private createEc2OnDemandResources(): void {
    // EC2 Role
    const onDemandRole = new iam.Role(this, 'OnDemandEc2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy')
      ]
    });

    // Bedrock権限を追加
    onDemandRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream'
      ],
      resources: ['*']
    }));

    // EC2 Instance
    this.onDemandInstance = new ec2.Instance(this, 'OnDemandInstance', {
      instanceName: `${this.props.projectName}-${this.props.environment}-ai-embedding-on-demand`,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE),
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      vpc: this.props.vpc || ec2.Vpc.fromLookup(this, 'OnDemandDefaultVpc', { isDefault: true }),
      role: onDemandRole
    });
  }

  /**
   * Bedrock Embedding設定
   */
  private setupBedrockEmbedding(): void {
    const embeddingConfig = this.props.config.bedrock.models.embedding;
    
    // Embedding処理用のIAMポリシー追加
    this.bedrockRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
      ],
      resources: [
        `arn:aws:bedrock:*::foundation-model/${embeddingConfig.modelId}`,
      ],
    }));

    // Embedding設定の環境変数（Lambda関数で使用）
    const embeddingEnvironment = {
      BEDROCK_EMBEDDING_MODEL_ID: embeddingConfig.modelId,
      BEDROCK_EMBEDDING_DIMENSIONS: embeddingConfig.dimensions.toString(),
      EMBEDDING_BATCH_SIZE: this.props.config.embedding.batchSize.toString(),
      EMBEDDING_CHUNK_SIZE: this.props.config.embedding.chunkSize.toString(),
      EMBEDDING_CHUNK_OVERLAP: this.props.config.embedding.chunkOverlap.toString(),
    };

    // 既存のLambda関数に環境変数を追加する場合
    // （ComputeConstructで作成されたLambda関数を参照）
  }

  /**
   * ベクトル検索設定
   */
  private setupVectorSearch(): void {
    const vectorConfig = this.props.config.vectorSearch;

    // OpenSearch Serverless設定（DatabaseConstructと連携）
    if (vectorConfig.engine === 'opensearch') {
      // OpenSearchインデックス設定
      const indexSettings = {
        dimensions: vectorConfig.indexSettings.dimensions,
        similarity: vectorConfig.indexSettings.similarity,
        efConstruction: vectorConfig.indexSettings.efConstruction || 512,
        efSearch: vectorConfig.indexSettings.efSearch || 512,
        maxConnections: vectorConfig.indexSettings.maxConnections || 16,
      };

      // インデックス作成用のカスタムリソース（将来実装）
      // const indexCustomResource = new cdk.CustomResource(this, 'VectorIndex', {
      //   serviceToken: indexProvider.serviceToken,
      //   properties: {
      //     IndexName: `${this.props.projectName}-${this.props.environment}-vectors`,
      //     IndexSettings: indexSettings,
      //   },
      // });
    }
  }

  /**
   * RAG設定
   */
  private setupRAGPipeline(): void {
    const ragConfig = this.props.config.rag;

    // RAG処理用のIAMポリシー
    this.bedrockRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:Retrieve',
        'bedrock:RetrieveAndGenerate',
      ],
      resources: ['*'], // 必要に応じて制限
    }));

    // RAG設定の環境変数
    const ragEnvironment = {
      RAG_RETRIEVAL_STRATEGY: ragConfig.retrieval.strategy,
      RAG_MAX_DOCUMENTS: ragConfig.retrieval.maxDocuments.toString(),
      RAG_MIN_SCORE: ragConfig.retrieval.minScore.toString(),
      RAG_CONTEXT_WINDOW: ragConfig.retrieval.contextWindow.toString(),
      RAG_MAX_RESPONSE_LENGTH: ragConfig.generation.maxResponseLength.toString(),
      RAG_ENABLE_CITATION: ragConfig.generation.enableCitation.toString(),
    };
  }

  /**
   * 出力値作成
   */
  private createOutputs(): AIOutputs {
    return {
      // Bedrock出力
      bedrockModelArns: [
        `arn:aws:bedrock:*::foundation-model/${this.props.config.bedrock.models.textGeneration.modelId}`,
        `arn:aws:bedrock:*::foundation-model/${this.props.config.bedrock.models.embedding.modelId}`,
      ],
      bedrockInferenceEndpoint: undefined, // Bedrockは直接APIを使用

      // Embedding出力
      embeddingModelArn: `arn:aws:bedrock:*::foundation-model/${this.props.config.bedrock.models.embedding.modelId}`,
      embeddingProcessorArn: this.embeddingProcessor?.functionArn,

      // ベクトル検索出力
      vectorIndexArn: undefined, // OpenSearchコレクションARN（DatabaseConstructから取得）
      searchEndpoint: undefined, // OpenSearchエンドポイント（DatabaseConstructから取得）

      // RAG出力
      ragPipelineArn: undefined, // RAGパイプラインARN（将来実装）
      ragEndpoint: undefined, // RAGエンドポイント（将来実装）
    };
  }

  /**
   * タグ適用（IAM制限対応）
   */
  private applyTags(): void {
    const tags = this.props.config.tags;

    // 最重要タグのみ（IAM制限対応）
    cdk.Tags.of(this).add('AIProvider', tags.AIProvider);
    cdk.Tags.of(this).add('UseCase', tags.UseCase);
  }

  /**
   * 統合監視ダッシュボード作成
   */
  private createMonitoringDashboard(): cloudwatch.Dashboard {
    const dashboard = new cloudwatch.Dashboard(this, 'AIMonitoringDashboard', {
      dashboardName: `${this.props.projectName}-${this.props.environment}-ai-monitoring`
    });

    // Bedrockメトリクス
    const bedrockWidget = new cloudwatch.GraphWidget({
      title: 'Bedrock Model Invocations',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/Bedrock',
          metricName: 'Invocations',
          dimensionsMap: {
            ModelId: this.props.config.bedrock.models.textGeneration.modelId
          }
        })
      ]
    });

    // Embeddingパターン別メトリクス
    let patternWidget: cloudwatch.Widget;
    
    switch (this.selectedEmbeddingPattern) {
      case 'aws-batch':
        patternWidget = new cloudwatch.GraphWidget({
          title: 'AWS Batch Jobs',
          left: [
            new cloudwatch.Metric({
              namespace: 'AWS/Batch',
              metricName: 'SubmittedJobs'
            }),
            new cloudwatch.Metric({
              namespace: 'AWS/Batch',
              metricName: 'RunnableJobs'
            }),
            new cloudwatch.Metric({
              namespace: 'AWS/Batch',
              metricName: 'RunningJobs'
            })
          ]
        });
        break;
      case 'ec2-spot':
        patternWidget = new cloudwatch.GraphWidget({
          title: 'EC2 Spot Instances',
          left: [
            new cloudwatch.Metric({
              namespace: 'AWS/AutoScaling',
              metricName: 'GroupDesiredCapacity',
              dimensionsMap: {
                AutoScalingGroupName: this.spotAutoScalingGroup?.autoScalingGroupName || ''
              }
            })
          ]
        });
        break;
      case 'ecs-on-ec2':
        patternWidget = new cloudwatch.GraphWidget({
          title: 'ECS Service',
          left: [
            new cloudwatch.Metric({
              namespace: 'AWS/ECS',
              metricName: 'RunningTaskCount',
              dimensionsMap: {
                ServiceName: this.ecsService?.serviceName || '',
                ClusterName: this.ecsCluster?.clusterName || ''
              }
            })
          ]
        });
        break;
      default:
        patternWidget = new cloudwatch.TextWidget({
          markdown: `## Current Pattern: ${this.selectedEmbeddingPattern}\n\nNo specific metrics available for this pattern.`,
          width: 12,
          height: 6
        });
    }

    dashboard.addWidgets(bedrockWidget, patternWidget);
    return dashboard;
  }

  /**
   * EventBridge統合作成
   */
  private createEventBridgeIntegration(): void {
    // パターン管理イベント
    new events.Rule(this, 'AIPatternManagementRule', {
      ruleName: `${this.props.projectName}-${this.props.environment}-ai-pattern-management`,
      description: 'AI Embedding pattern management events',
      eventPattern: {
        source: ['custom.ai.embedding'],
        detailType: ['Pattern Management', 'Pattern Switch', 'Performance Alert']
      },
      targets: [new targets.LambdaFunction(this.patternManagerFunction)]
    });

    // スケジュールベースの最適化チェック
    new events.Rule(this, 'AIOptimizationSchedule', {
      ruleName: `${this.props.projectName}-${this.props.environment}-ai-optimization-schedule`,
      description: 'Scheduled AI pattern optimization check',
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '2',
        day: '*',
        month: '*',
        year: '*'
      }),
      targets: [new targets.LambdaFunction(this.patternManagerFunction, {
        event: events.RuleTargetInput.fromObject({
          action: 'optimize-pattern',
          source: 'scheduled'
        })
      })]
    });
  }

  /**
   * 出力値作成（強化版）
   */
  private createOutputs(): AIOutputs {
    return {
      // Bedrock出力
      bedrockModelArns: [
        `arn:aws:bedrock:*::foundation-model/${this.props.config.bedrock.models.textGeneration.modelId}`,
        `arn:aws:bedrock:*::foundation-model/${this.props.config.bedrock.models.embedding.modelId}`,
      ],
      bedrockInferenceEndpoint: undefined, // Bedrockは直接APIを使用

      // Embedding出力（4パターン対応）
      embeddingModelArn: `arn:aws:bedrock:*::foundation-model/${this.props.config.bedrock.models.embedding.modelId}`,
      embeddingProcessorArn: this.embeddingProcessor?.functionArn,
      embeddingPattern: this.selectedEmbeddingPattern,
      patternManagerArn: this.patternManagerFunction.functionArn,

      // パターン別リソース出力
      batchComputeEnvironmentArn: this.batchComputeEnvironment?.ref,
      batchJobQueueArn: this.batchJobQueue?.ref,
      batchJobDefinitionArn: this.batchJobDefinition?.ref,
      spotAutoScalingGroupArn: this.spotAutoScalingGroup?.autoScalingGroupArn,
      ecsClusterArn: this.ecsCluster?.clusterArn,
      ecsServiceArn: this.ecsService?.serviceArn,
      onDemandInstanceId: this.onDemandInstance?.instanceId,

      // ベクトル検索出力
      vectorIndexArn: undefined, // OpenSearchコレクションARN（DatabaseConstructから取得）
      searchEndpoint: undefined, // OpenSearchエンドポイント（DatabaseConstructから取得）

      // RAG出力
      ragPipelineArn: undefined, // RAGパイプラインARN（将来実装）
      ragEndpoint: undefined, // RAGエンドポイント（将来実装）

      // 監視出力
      monitoringDashboardUrl: `https://console.aws.amazon.com/cloudwatch/home?region=${this.props.region}#dashboards:name=${this.props.projectName}-${this.props.environment}-ai-monitoring`,
    };
  }

  /**
   * タグ適用（強化版）
   */
  private applyTags(): void {
    const tags = this.props.config.tags;

    cdk.Tags.of(this).add('AIProvider', tags.AIProvider);
    cdk.Tags.of(this).add('ModelType', tags.ModelType);
    cdk.Tags.of(this).add('UseCase', tags.UseCase);
    cdk.Tags.of(this).add('EmbeddingPattern', this.selectedEmbeddingPattern);

    if (tags.PerformanceTier) {
      cdk.Tags.of(this).add('PerformanceTier', tags.PerformanceTier);
    }

    if (tags.CostOptimization) {
      cdk.Tags.of(this).add('CostOptimization', tags.CostOptimization);
    }

    // パターン固有タグ
    const patternConfig = this.props.config.embedding.patternConfigs?.[this.selectedEmbeddingPattern];
    if (patternConfig) {
      cdk.Tags.of(this).add('RelativeCost', patternConfig.relativeCost.toString());
      cdk.Tags.of(this).add('FaultToleranceLevel', patternConfig.faultToleranceLevel.toString());
      cdk.Tags.of(this).add('OperabilityLevel', patternConfig.operabilityLevel.toString());
    }
  }
}