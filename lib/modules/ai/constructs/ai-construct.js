"use strict";
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
exports.AIConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const batch = __importStar(require("aws-cdk-lib/aws-batch"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const autoscaling = __importStar(require("aws-cdk-lib/aws-autoscaling"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const ssm = __importStar(require("aws-cdk-lib/aws-ssm"));
const constructs_1 = require("constructs");
class AIConstruct extends constructs_1.Construct {
    props;
    outputs;
    bedrockRole;
    embeddingProcessor;
    // 4パターン選択式Embedding処理リソース
    selectedEmbeddingPattern;
    patternManagerFunction;
    monitoringDashboard;
    // パターン別リソース
    batchComputeEnvironment;
    batchJobQueue;
    batchJobDefinition;
    spotAutoScalingGroup;
    spotLaunchTemplate;
    ecsCluster;
    ecsService;
    ecsTaskDefinition;
    onDemandInstance;
    constructor(scope, id, props) {
        super(scope, id);
        this.props = props;
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
    createBedrockExecutionRole() {
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
    setupBedrockAccess() {
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
    createParameterStore() {
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
    createPatternManagerFunction() {
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
    setupEmbeddingProcessing() {
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
    createAwsBatchResources() {
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
                    iam.Role.fromRoleArn(this, 'SpotFleetRole', `arn:aws:iam::${cdk.Stack.of(this).account}:role/aws-ec2-spot-fleet-tagging-role`).roleArn : undefined,
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
    createEc2SpotResources() {
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
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE),
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
    createEcsOnEc2Resources() {
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
    createEc2OnDemandResources() {
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
    setupBedrockEmbedding() {
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
    setupVectorSearch() {
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
    setupRAGPipeline() {
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
    createOutputs() {
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
    applyTags() {
        const tags = this.props.config.tags;
        // 最重要タグのみ（IAM制限対応）
        cdk.Tags.of(this).add('AIProvider', tags.AIProvider);
        cdk.Tags.of(this).add('UseCase', tags.UseCase);
    }
    /**
     * 統合監視ダッシュボード作成
     */
    createMonitoringDashboard() {
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
        let patternWidget;
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
    createEventBridgeIntegration() {
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
    createOutputs() {
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
    applyTags() {
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
exports.AIConstruct = AIConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWktY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYWktY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7R0FXRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFDbkMseURBQTJDO0FBQzNDLCtEQUFpRDtBQUdqRCw2REFBK0M7QUFDL0MseURBQTJDO0FBQzNDLHlEQUEyQztBQUMzQyx5RUFBMkQ7QUFDM0QsK0RBQWlEO0FBQ2pELHdFQUEwRDtBQUMxRCx1RUFBeUQ7QUFDekQsMkRBQTZDO0FBQzdDLHlEQUEyQztBQUMzQywyQ0FBdUM7QUFtQnZDLE1BQWEsV0FBWSxTQUFRLHNCQUFTO0lBcUJVO0lBcEJsQyxPQUFPLENBQVk7SUFDbkIsV0FBVyxDQUFXO0lBQ3RCLGtCQUFrQixDQUFtQjtJQUVyRCwwQkFBMEI7SUFDVix3QkFBd0IsQ0FBbUI7SUFDM0Msc0JBQXNCLENBQWtCO0lBQ3hDLG1CQUFtQixDQUF1QjtJQUUxRCxZQUFZO0lBQ0wsdUJBQXVCLENBQStCO0lBQ3RELGFBQWEsQ0FBcUI7SUFDbEMsa0JBQWtCLENBQTBCO0lBQzVDLG9CQUFvQixDQUFnQztJQUNwRCxrQkFBa0IsQ0FBc0I7SUFDeEMsVUFBVSxDQUFlO0lBQ3pCLFVBQVUsQ0FBc0I7SUFDaEMsaUJBQWlCLENBQTZCO0lBQzlDLGdCQUFnQixDQUFnQjtJQUV2QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFVLEtBQXVCO1FBQ3ZFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFEK0IsVUFBSyxHQUFMLEtBQUssQ0FBa0I7UUFHdkUsd0JBQXdCO1FBQ3hCLElBQUksQ0FBQyx3QkFBd0IsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDO1FBRXBFLGlCQUFpQjtRQUNqQixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQywwQkFB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Q0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsYUFBYSxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQzdFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsRUFBRSxhQUFhLENBQUMsbUJBQW1CLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztZQUMzRixHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLEVBQUUsYUFBYSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDdkYsQ0FBQztJQUNILENBQUM7Q0FDRjtBQXA0QkQsa0NBbzRCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQUnjgrPjg7Pjgrnjg4jjg6njgq/jg4ggLSDlvLfljJbniYhcbiAqIFxuICogQW1hem9uIEJlZHJvY2vjgIFFbWJlZGRpbmflh6bnkIbvvIg044OR44K/44O844Oz6YG45oqe5byP77yJ44CB44OZ44Kv44OI44Or5qSc57Si44Gu57Wx5ZCI566h55CG44KS5o+Q5L6bXG4gKiBcbiAqIOe1seWQiOapn+iDvTpcbiAqIC0gQW1hem9uIEJlZHJvY2vntbHlkIjvvIjjg4bjgq3jgrnjg4jnlJ/miJDjg7tFbWJlZGRpbmfvvIlcbiAqIC0gNOODkeOCv+ODvOODs+mBuOaKnuW8j0VtYmVkZGluZ+WHpueQhu+8iEFXUyBCYXRjaOOAgUVDMiBTcG9044CBRUNTIG9uIEVDMuOAgUVDMiBPbi1EZW1hbmTvvIlcbiAqIC0g44OZ44Kv44OI44Or5qSc57Si44Ko44Oz44K444Oz57Wx5ZCIXG4gKiAtIFJBR+ODkeOCpOODl+ODqeOCpOODs+e1seWQiFxuICogLSBGU3ggZm9yIE5ldEFwcCBPTlRBUOe1seWQiFxuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMga21zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1rbXMnO1xuaW1wb3J0ICogYXMgYmF0Y2ggZnJvbSAnYXdzLWNkay1saWIvYXdzLWJhdGNoJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIGVjcyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWNzJztcbmltcG9ydCAqIGFzIGF1dG9zY2FsaW5nIGZyb20gJ2F3cy1jZGstbGliL2F3cy1hdXRvc2NhbGluZyc7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgKiBhcyB0YXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMtdGFyZ2V0cyc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgc3NtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zc20nO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBBSUNvbmZpZywgQUlPdXRwdXRzLCBNb2RlbENvbmZpZywgRW1iZWRkaW5nUGF0dGVybiB9IGZyb20gJy4uL2ludGVyZmFjZXMvYWktY29uZmlnJztcblxuZXhwb3J0IGludGVyZmFjZSBBSUNvbnN0cnVjdFByb3BzIHtcbiAgY29uZmlnOiBBSUNvbmZpZztcbiAgcHJvamVjdE5hbWU6IHN0cmluZztcbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgcmVnaW9uOiBzdHJpbmc7XG4gIGttc0tleT86IGttcy5JS2V5O1xuICBlbWJlZGRpbmdzQnVja2V0PzogczMuSUJ1Y2tldDtcbiAgZG9jdW1lbnRzQnVja2V0PzogczMuSUJ1Y2tldDtcbiAgcHJvY2Vzc2VkQnVja2V0PzogczMuSUJ1Y2tldDtcbiAgbWV0YWRhdGFCdWNrZXQ/OiBzMy5JQnVja2V0O1xuICBsYW1iZGFSb2xlPzogaWFtLklSb2xlO1xuICB2cGM/OiBlYzIuSVZwYztcbiAgZGF0YWJhc2VTdGFjaz86IGFueTsgLy8gRGF0YWJhc2VTdGFja+OBruWPgueFp1xuICBzdG9yYWdlU3RhY2s/OiBhbnk7ICAvLyBTdG9yYWdlU3RhY2vjga7lj4Lnhadcbn1cblxuZXhwb3J0IGNsYXNzIEFJQ29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IG91dHB1dHM6IEFJT3V0cHV0cztcbiAgcHVibGljIHJlYWRvbmx5IGJlZHJvY2tSb2xlOiBpYW0uUm9sZTtcbiAgcHVibGljIHJlYWRvbmx5IGVtYmVkZGluZ1Byb2Nlc3Nvcj86IGxhbWJkYS5GdW5jdGlvbjtcbiAgXG4gIC8vIDTjg5Hjgr/jg7zjg7Ppgbjmip7lvI9FbWJlZGRpbmflh6bnkIbjg6rjgr3jg7zjgrlcbiAgcHVibGljIHJlYWRvbmx5IHNlbGVjdGVkRW1iZWRkaW5nUGF0dGVybjogRW1iZWRkaW5nUGF0dGVybjtcbiAgcHVibGljIHJlYWRvbmx5IHBhdHRlcm5NYW5hZ2VyRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IG1vbml0b3JpbmdEYXNoYm9hcmQ6IGNsb3Vkd2F0Y2guRGFzaGJvYXJkO1xuICBcbiAgLy8g44OR44K/44O844Oz5Yil44Oq44K944O844K5XG4gIHB1YmxpYyBiYXRjaENvbXB1dGVFbnZpcm9ubWVudD86IGJhdGNoLkNmbkNvbXB1dGVFbnZpcm9ubWVudDtcbiAgcHVibGljIGJhdGNoSm9iUXVldWU/OiBiYXRjaC5DZm5Kb2JRdWV1ZTtcbiAgcHVibGljIGJhdGNoSm9iRGVmaW5pdGlvbj86IGJhdGNoLkNmbkpvYkRlZmluaXRpb247XG4gIHB1YmxpYyBzcG90QXV0b1NjYWxpbmdHcm91cD86IGF1dG9zY2FsaW5nLkF1dG9TY2FsaW5nR3JvdXA7XG4gIHB1YmxpYyBzcG90TGF1bmNoVGVtcGxhdGU/OiBlYzIuTGF1bmNoVGVtcGxhdGU7XG4gIHB1YmxpYyBlY3NDbHVzdGVyPzogZWNzLkNsdXN0ZXI7XG4gIHB1YmxpYyBlY3NTZXJ2aWNlPzogZWNzLkZhcmdhdGVTZXJ2aWNlO1xuICBwdWJsaWMgZWNzVGFza0RlZmluaXRpb24/OiBlY3MuRmFyZ2F0ZVRhc2tEZWZpbml0aW9uO1xuICBwdWJsaWMgb25EZW1hbmRJbnN0YW5jZT86IGVjMi5JbnN0YW5jZTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcml2YXRlIHByb3BzOiBBSUNvbnN0cnVjdFByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIC8vIOmBuOaKnuOBleOCjOOBn0VtYmVkZGluZ+ODkeOCv+ODvOODs+OBruioreWumlxuICAgIHRoaXMuc2VsZWN0ZWRFbWJlZGRpbmdQYXR0ZXJuID0gdGhpcy5wcm9wcy5jb25maWcuZW1iZWRkaW5nLnBhdHRlcm47XG5cbiAgICAvLyBCZWRyb2Nr5a6f6KGM44Ot44O844Or5L2c5oiQXG4gICAgdGhpcy5iZWRyb2NrUm9sZSA9IHRoaXMuY3JlYXRlQmVkcm9ja0V4ZWN1dGlvblJvbGUoKTtcblxuICAgIC8vIEJlZHJvY2voqK3lrppcbiAgICBpZiAodGhpcy5wcm9wcy5jb25maWcuYmVkcm9jay5lbmFibGVkKSB7XG4gICAgICB0aGlzLnNldHVwQmVkcm9ja0FjY2VzcygpO1xuICAgIH1cblxuICAgIC8vIFBhcmFtZXRlciBTdG9yZeioreWumlxuICAgIHRoaXMuY3JlYXRlUGFyYW1ldGVyU3RvcmUoKTtcblxuICAgIC8vIOODkeOCv+ODvOODs+euoeeQhkxhbWJkYeS9nOaIkFxuICAgIHRoaXMucGF0dGVybk1hbmFnZXJGdW5jdGlvbiA9IHRoaXMuY3JlYXRlUGF0dGVybk1hbmFnZXJGdW5jdGlvbigpO1xuXG4gICAgLy8g6YG45oqe44GV44KM44Gf44OR44K/44O844Oz44Gr5b+c44GY44GmRW1iZWRkaW5n5Yem55CG6Kit5a6aXG4gICAgdGhpcy5zZXR1cEVtYmVkZGluZ1Byb2Nlc3NpbmcoKTtcblxuICAgIC8vIOODmeOCr+ODiOODq+aknOe0ouioreWumlxuICAgIHRoaXMuc2V0dXBWZWN0b3JTZWFyY2goKTtcblxuICAgIC8vIFJBR+ODkeOCpOODl+ODqeOCpOODs+ioreWumlxuICAgIHRoaXMuc2V0dXBSQUdQaXBlbGluZSgpO1xuXG4gICAgLy8g57Wx5ZCI55uj6KaW44K344K544OG44Og5L2c5oiQXG4gICAgdGhpcy5tb25pdG9yaW5nRGFzaGJvYXJkID0gdGhpcy5jcmVhdGVNb25pdG9yaW5nRGFzaGJvYXJkKCk7XG5cbiAgICAvLyBFdmVudEJyaWRnZee1seWQiFxuICAgIHRoaXMuY3JlYXRlRXZlbnRCcmlkZ2VJbnRlZ3JhdGlvbigpO1xuXG4gICAgLy8g5Ye65Yqb5YCk44Gu6Kit5a6aXG4gICAgdGhpcy5vdXRwdXRzID0gdGhpcy5jcmVhdGVPdXRwdXRzKCk7XG5cbiAgICAvLyDjgr/jgrDoqK3lrppcbiAgICB0aGlzLmFwcGx5VGFncygpO1xuICB9XG5cbiAgLyoqXG4gICAqIEJlZHJvY2vlrp/ooYzjg63jg7zjg6vkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQmVkcm9ja0V4ZWN1dGlvblJvbGUoKTogaWFtLlJvbGUge1xuICAgIGNvbnN0IHJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0JlZHJvY2tFeGVjdXRpb25Sb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBkZXNjcmlwdGlvbjogYEJlZHJvY2sgZXhlY3V0aW9uIHJvbGUgZm9yICR7dGhpcy5wcm9wcy5wcm9qZWN0TmFtZX1gLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEJlZHJvY2vjgqLjgq/jgrvjgrnmqKnpmZBcbiAgICByb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWwnLFxuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbFdpdGhSZXNwb25zZVN0cmVhbScsXG4gICAgICAgICdiZWRyb2NrOkdldEZvdW5kYXRpb25Nb2RlbCcsXG4gICAgICAgICdiZWRyb2NrOkxpc3RGb3VuZGF0aW9uTW9kZWxzJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6YmVkcm9jazoqOjpmb3VuZGF0aW9uLW1vZGVsLyR7dGhpcy5wcm9wcy5jb25maWcuYmVkcm9jay5tb2RlbHMudGV4dEdlbmVyYXRpb24ubW9kZWxJZH1gLFxuICAgICAgICBgYXJuOmF3czpiZWRyb2NrOio6OmZvdW5kYXRpb24tbW9kZWwvJHt0aGlzLnByb3BzLmNvbmZpZy5iZWRyb2NrLm1vZGVscy5lbWJlZGRpbmcubW9kZWxJZH1gLFxuICAgICAgXSxcbiAgICB9KSk7XG5cbiAgICAvLyBHdWFyZHJhaWxz5qip6ZmQ77yI5pyJ5Yq544Gq5aC05ZCI77yJXG4gICAgaWYgKHRoaXMucHJvcHMuY29uZmlnLmJlZHJvY2suZ3VhcmRyYWlscz8uZW5hYmxlZCkge1xuICAgICAgcm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdiZWRyb2NrOkFwcGx5R3VhcmRyYWlsJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgYGFybjphd3M6YmVkcm9jazoqOio6Z3VhcmRyYWlsLyR7dGhpcy5wcm9wcy5jb25maWcuYmVkcm9jay5ndWFyZHJhaWxzLmd1YXJkcmFpbElkfWAsXG4gICAgICAgIF0sXG4gICAgICB9KSk7XG4gICAgfVxuXG4gICAgLy8gUzPjgqLjgq/jgrvjgrnmqKnpmZBcbiAgICBpZiAodGhpcy5wcm9wcy5lbWJlZGRpbmdzQnVja2V0KSB7XG4gICAgICB0aGlzLnByb3BzLmVtYmVkZGluZ3NCdWNrZXQuZ3JhbnRSZWFkV3JpdGUocm9sZSk7XG4gICAgfVxuXG4gICAgLy8gS01T44Ki44Kv44K744K55qip6ZmQXG4gICAgaWYgKHRoaXMucHJvcHMua21zS2V5KSB7XG4gICAgICB0aGlzLnByb3BzLmttc0tleS5ncmFudEVuY3J5cHREZWNyeXB0KHJvbGUpO1xuICAgIH1cblxuICAgIHJldHVybiByb2xlO1xuICB9XG5cbiAgLyoqXG4gICAqIEJlZHJvY2vjgqLjgq/jgrvjgrnoqK3lrppcbiAgICovXG4gIHByaXZhdGUgc2V0dXBCZWRyb2NrQWNjZXNzKCk6IHZvaWQge1xuICAgIC8vIEJlZHJvY2vjg6Ljg4fjg6vjgqLjgq/jgrvjgrnoqK3lrppcbiAgICAvLyDms6jmhI86IEJlZHJvY2vjg6Ljg4fjg6vjgqLjgq/jgrvjgrnjga/pgJrluLjjgIFBV1PjgrPjg7Pjgr3jg7zjg6vjgb7jgZ/jga9BUEnjgafkuovliY3jgavmnInlirnljJbjgZnjgovlv4XopoHjgYzjgYLjgorjgb7jgZlcbiAgICBcbiAgICAvLyBDbG91ZEZvcm1hdGlvbuOCq+OCueOCv+ODoOODquOCveODvOOCueOBp+ODouODh+ODq+OCouOCr+OCu+OCueOCkuioreWumu+8iOWwhuadpeWun+ijhe+8iVxuICAgIC8vIGNvbnN0IG1vZGVsQWNjZXNzQ3VzdG9tUmVzb3VyY2UgPSBuZXcgY2RrLkN1c3RvbVJlc291cmNlKHRoaXMsICdCZWRyb2NrTW9kZWxBY2Nlc3MnLCB7XG4gICAgLy8gICBzZXJ2aWNlVG9rZW46IG1vZGVsQWNjZXNzUHJvdmlkZXIuc2VydmljZVRva2VuLFxuICAgIC8vICAgcHJvcGVydGllczoge1xuICAgIC8vICAgICBNb2RlbElkczogW1xuICAgIC8vICAgICAgIHRoaXMucHJvcHMuY29uZmlnLmJlZHJvY2subW9kZWxzLnRleHRHZW5lcmF0aW9uLm1vZGVsSWQsXG4gICAgLy8gICAgICAgdGhpcy5wcm9wcy5jb25maWcuYmVkcm9jay5tb2RlbHMuZW1iZWRkaW5nLm1vZGVsSWQsXG4gICAgLy8gICAgIF0sXG4gICAgLy8gICB9LFxuICAgIC8vIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcmFtZXRlciBTdG9yZeioreWumuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVQYXJhbWV0ZXJTdG9yZSgpOiB2b2lkIHtcbiAgICAvLyDpgbjmip7jgZXjgozjgZ/jg5Hjgr/jg7zjg7PoqK3lrppcbiAgICBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnU2VsZWN0ZWRFbWJlZGRpbmdQYXR0ZXJuJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogYC8ke3RoaXMucHJvcHMucHJvamVjdE5hbWV9LyR7dGhpcy5wcm9wcy5lbnZpcm9ubWVudH0vYWkvZW1iZWRkaW5nL3NlbGVjdGVkLXBhdHRlcm5gLFxuICAgICAgc3RyaW5nVmFsdWU6IHRoaXMuc2VsZWN0ZWRFbWJlZGRpbmdQYXR0ZXJuLFxuICAgICAgZGVzY3JpcHRpb246IGBTZWxlY3RlZCBlbWJlZGRpbmcgcGF0dGVybiBmb3IgJHt0aGlzLnByb3BzLnByb2plY3ROYW1lfSAke3RoaXMucHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIHRpZXI6IHNzbS5QYXJhbWV0ZXJUaWVyLlNUQU5EQVJEXG4gICAgfSk7XG4gICAgXG4gICAgLy8g44OR44K/44O844Oz5Yil6Kit5a6aXG4gICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ0VtYmVkZGluZ1BhdHRlcm5Db25maWdzJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogYC8ke3RoaXMucHJvcHMucHJvamVjdE5hbWV9LyR7dGhpcy5wcm9wcy5lbnZpcm9ubWVudH0vYWkvZW1iZWRkaW5nL3BhdHRlcm4tY29uZmlnc2AsXG4gICAgICBzdHJpbmdWYWx1ZTogSlNPTi5zdHJpbmdpZnkodGhpcy5wcm9wcy5jb25maWcuZW1iZWRkaW5nLnBhdHRlcm5Db25maWdzIHx8IHt9KSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgRW1iZWRkaW5nIHBhdHRlcm4gY29uZmlndXJhdGlvbnMgZm9yICR7dGhpcy5wcm9wcy5wcm9qZWN0TmFtZX0gJHt0aGlzLnByb3BzLmVudmlyb25tZW50fWAsXG4gICAgICB0aWVyOiBzc20uUGFyYW1ldGVyVGllci5TVEFOREFSRFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOODkeOCv+ODvOODs+euoeeQhkxhbWJkYemWouaVsOS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVQYXR0ZXJuTWFuYWdlckZ1bmN0aW9uKCk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgcmV0dXJuIG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0VtYmVkZGluZ1BhdHRlcm5NYW5hZ2VyRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGAke3RoaXMucHJvcHMucHJvamVjdE5hbWV9LSR7dGhpcy5wcm9wcy5lbnZpcm9ubWVudH0tYWktZW1iZWRkaW5nLXBhdHRlcm4tbWFuYWdlcmAsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuICAgICAgICBjb25zdCBBV1MgPSByZXF1aXJlKCdhd3Mtc2RrJyk7XG4gICAgICAgIGNvbnN0IHNzbSA9IG5ldyBBV1MuU1NNKCk7XG4gICAgICAgIFxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnQUkgRW1iZWRkaW5nIFBhdHRlcm4gTWFuYWdlciBFdmVudDonLCBKU09OLnN0cmluZ2lmeShldmVudCwgbnVsbCwgMikpO1xuICAgICAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhY3Rpb24gPSBldmVudC5hY3Rpb24gfHwgJ2dldC1yZWNvbW1lbmRhdGlvbic7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHN3aXRjaCAoYWN0aW9uKSB7XG4gICAgICAgICAgICAgIGNhc2UgJ2dldC1yZWNvbW1lbmRhdGlvbic6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGdldFBhdHRlcm5SZWNvbW1lbmRhdGlvbihldmVudCk7XG4gICAgICAgICAgICAgIGNhc2UgJ3N3aXRjaC1wYXR0ZXJuJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgc3dpdGNoUGF0dGVybihldmVudCk7XG4gICAgICAgICAgICAgIGNhc2UgJ2dldC1wZXJmb3JtYW5jZS1zdGF0cyc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGdldFBlcmZvcm1hbmNlU3RhdHMoZXZlbnQpO1xuICAgICAgICAgICAgICBjYXNlICdvcHRpbWl6ZS1wYXR0ZXJuJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgb3B0aW1pemVQYXR0ZXJuKGV2ZW50KTtcbiAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXFxgVW5rbm93biBhY3Rpb246IFxcJHthY3Rpb259XFxgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignQUkgRW1iZWRkaW5nIFBhdHRlcm4gTWFuYWdlciBFcnJvcjonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBzdGF0dXNDb2RlOiA1MDAsXG4gICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfSlcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gZ2V0UGF0dGVyblJlY29tbWVuZGF0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgY29uc3QgZmlsZUNvdW50ID0gZXZlbnQuZmlsZUNvdW50IHx8IDA7XG4gICAgICAgICAgY29uc3QgcHJpb3JpdHkgPSBldmVudC5wcmlvcml0eSB8fCAnYmFsYW5jZWQnO1xuICAgICAgICAgIGNvbnN0IGRhdGFTaXplID0gZXZlbnQuZGF0YVNpemVHQiB8fCAwO1xuICAgICAgICAgIFxuICAgICAgICAgIGxldCByZWNvbW1lbmRlZFBhdHRlcm4gPSAnJHt0aGlzLnNlbGVjdGVkRW1iZWRkaW5nUGF0dGVybn0nO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIOOCs+OCueODiOmHjeimluOBruWgtOWQiFxuICAgICAgICAgIGlmIChwcmlvcml0eSA9PT0gJ2Nvc3QnKSB7XG4gICAgICAgICAgICByZWNvbW1lbmRlZFBhdHRlcm4gPSAnZWMyLXNwb3QnO1xuICAgICAgICAgIH0gXG4gICAgICAgICAgLy8g44OR44OV44Kp44O844Oe44Oz44K56YeN6KaW44Gu5aC05ZCIXG4gICAgICAgICAgZWxzZSBpZiAocHJpb3JpdHkgPT09ICdwZXJmb3JtYW5jZScpIHtcbiAgICAgICAgICAgIHJlY29tbWVuZGVkUGF0dGVybiA9ICdhd3MtYmF0Y2gnO1xuICAgICAgICAgIH0gXG4gICAgICAgICAgLy8g6YGL55So5oCn6YeN6KaW44Gu5aC05ZCIXG4gICAgICAgICAgZWxzZSBpZiAocHJpb3JpdHkgPT09ICdvcGVyYWJpbGl0eScpIHtcbiAgICAgICAgICAgIHJlY29tbWVuZGVkUGF0dGVybiA9ICdlY3Mtb24tZWMyJztcbiAgICAgICAgICB9IFxuICAgICAgICAgIC8vIOODkOODqeODs+OCuemHjeimluOBruWgtOWQiO+8iOODleOCoeOCpOODq+aVsOOBqOODh+ODvOOCv+OCteOCpOOCuuOBp+WIpOWumu+8iVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKGZpbGVDb3VudCA+PSAxMDAwMCB8fCBkYXRhU2l6ZSA+PSAxMDApIHtcbiAgICAgICAgICAgICAgcmVjb21tZW5kZWRQYXR0ZXJuID0gJ2F3cy1iYXRjaCc7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGZpbGVDb3VudCA+PSAxMDAwIHx8IGRhdGFTaXplID49IDEwKSB7XG4gICAgICAgICAgICAgIHJlY29tbWVuZGVkUGF0dGVybiA9ICdlYzItc3BvdCc7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGZpbGVDb3VudCA+PSAxMDAgfHwgZGF0YVNpemUgPj0gMSkge1xuICAgICAgICAgICAgICByZWNvbW1lbmRlZFBhdHRlcm4gPSAnZWNzLW9uLWVjMic7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZWNvbW1lbmRlZFBhdHRlcm4gPSAnZWMyLW9uLWRlbWFuZCc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgIHJlY29tbWVuZGVkUGF0dGVybixcbiAgICAgICAgICAgICAgY3VycmVudFBhdHRlcm46ICcke3RoaXMuc2VsZWN0ZWRFbWJlZGRpbmdQYXR0ZXJufScsXG4gICAgICAgICAgICAgIGZpbGVDb3VudCxcbiAgICAgICAgICAgICAgZGF0YVNpemVHQjogZGF0YVNpemUsXG4gICAgICAgICAgICAgIHByaW9yaXR5LFxuICAgICAgICAgICAgICByZWFzb25pbmc6IGdldFJlY29tbWVuZGF0aW9uUmVhc29uaW5nKHJlY29tbWVuZGVkUGF0dGVybiwgZmlsZUNvdW50LCBkYXRhU2l6ZSwgcHJpb3JpdHkpXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGZ1bmN0aW9uIGdldFJlY29tbWVuZGF0aW9uUmVhc29uaW5nKHBhdHRlcm4sIGZpbGVDb3VudCwgZGF0YVNpemUsIHByaW9yaXR5KSB7XG4gICAgICAgICAgY29uc3QgcmVhc29ucyA9IHtcbiAgICAgICAgICAgICdhd3MtYmF0Y2gnOiAn5aSn6YeP44OH44O844K/5Yem55CG44Gr5pyA6YGp44CB44OV44Or44Oe44ON44O844K444OJ44CB6auY44GE6ICQ6Zqc5a6z5oCnJyxcbiAgICAgICAgICAgICdlYzItc3BvdCc6ICc5MCXjgrPjgrnjg4jliYrmuJvjgIHkuK3nqIvluqbjga7ogJDpmpzlrrPmgKfjgIHkuK3opo/mqKHjg4fjg7zjgr/jgavpganlkIgnLFxuICAgICAgICAgICAgJ2Vjcy1vbi1lYzInOiAn6auY44GE6YGL55So5oCn44CBRUNT57Wx5ZCI44CB5bCP5Lit6KaP5qih44OH44O844K/44Gr6YGp5ZCIJyxcbiAgICAgICAgICAgICdlYzItb24tZGVtYW5kJzogJ+Wwj+imj+aooeODh+ODvOOCv+WwgueUqOOAgemrmOOCs+OCueODiOOBruOBn+OCgemdnuaOqOWlqCdcbiAgICAgICAgICB9O1xuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiByZWFzb25zW3BhdHRlcm5dIHx8ICfkuI3mmI7jgarjg5Hjgr/jg7zjg7MnO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBhc3luYyBmdW5jdGlvbiBzd2l0Y2hQYXR0ZXJuKGV2ZW50KSB7XG4gICAgICAgICAgY29uc3QgbmV3UGF0dGVybiA9IGV2ZW50Lm5ld1BhdHRlcm47XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKCFuZXdQYXR0ZXJuKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ25ld1BhdHRlcm4gaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgc3NtLnB1dFBhcmFtZXRlcih7XG4gICAgICAgICAgICBOYW1lOiAnLyR7dGhpcy5wcm9wcy5wcm9qZWN0TmFtZX0vJHt0aGlzLnByb3BzLmVudmlyb25tZW50fS9haS9lbWJlZGRpbmcvc2VsZWN0ZWQtcGF0dGVybicsXG4gICAgICAgICAgICBWYWx1ZTogbmV3UGF0dGVybixcbiAgICAgICAgICAgIE92ZXJ3cml0ZTogdHJ1ZVxuICAgICAgICAgIH0pLnByb21pc2UoKTtcbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICBtZXNzYWdlOiBcXGBBSSBFbWJlZGRpbmcgcGF0dGVybiBzd2l0Y2hlZCB0byBcXCR7bmV3UGF0dGVybn1cXGAsXG4gICAgICAgICAgICAgIHByZXZpb3VzUGF0dGVybjogJyR7dGhpcy5zZWxlY3RlZEVtYmVkZGluZ1BhdHRlcm59JyxcbiAgICAgICAgICAgICAgbmV3UGF0dGVybixcbiAgICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gZ2V0UGVyZm9ybWFuY2VTdGF0cyhldmVudCkge1xuICAgICAgICAgIC8vIENsb3VkV2F0Y2jjg6Hjg4jjg6rjgq/jgrnjgYvjgonmgKfog73ntbHoqIjjgpLlj5blvpfvvIjlrp/oo4XkvovvvIlcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICBwZXJmb3JtYW5jZVN0YXRzOiB7XG4gICAgICAgICAgICAgICAgY3VycmVudFBhdHRlcm46ICcke3RoaXMuc2VsZWN0ZWRFbWJlZGRpbmdQYXR0ZXJufScsXG4gICAgICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgbWV0cmljczoge1xuICAgICAgICAgICAgICAgICAgYXZlcmFnZVByb2Nlc3NpbmdUaW1lOiAwLFxuICAgICAgICAgICAgICAgICAgc3VjY2Vzc1JhdGU6IDAsXG4gICAgICAgICAgICAgICAgICBjb3N0UGVyRmlsZTogMCxcbiAgICAgICAgICAgICAgICAgIHRocm91Z2hwdXQ6IDBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gb3B0aW1pemVQYXR0ZXJuKGV2ZW50KSB7XG4gICAgICAgICAgLy8g44OR44OV44Kp44O844Oe44Oz44K557Wx6KiI44Gr5Z+644Gl44GE44Gm44OR44K/44O844Oz5pyA6YGp5YyW44KS5o+Q5qGIXG4gICAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBnZXRQZXJmb3JtYW5jZVN0YXRzKGV2ZW50KTtcbiAgICAgICAgICBjb25zdCByZWNvbW1lbmRhdGlvbiA9IGF3YWl0IGdldFBhdHRlcm5SZWNvbW1lbmRhdGlvbihldmVudCk7XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgb3B0aW1pemF0aW9uOiB7XG4gICAgICAgICAgICAgICAgY3VycmVudFBhdHRlcm46ICcke3RoaXMuc2VsZWN0ZWRFbWJlZGRpbmdQYXR0ZXJufScsXG4gICAgICAgICAgICAgICAgcmVjb21tZW5kZWRQYXR0ZXJuOiBKU09OLnBhcnNlKHJlY29tbWVuZGF0aW9uLmJvZHkpLnJlY29tbWVuZGVkUGF0dGVybixcbiAgICAgICAgICAgICAgICBvcHRpbWl6YXRpb25Qb3RlbnRpYWw6ICdtZWRpdW0nLFxuICAgICAgICAgICAgICAgIGVzdGltYXRlZFNhdmluZ3M6ICczMC01MCUnLFxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgYCksXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBQUk9KRUNUX05BTUU6IHRoaXMucHJvcHMucHJvamVjdE5hbWUsXG4gICAgICAgIEVOVklST05NRU5UOiB0aGlzLnByb3BzLmVudmlyb25tZW50LFxuICAgICAgICBSRUdJT046IHRoaXMucHJvcHMucmVnaW9uLFxuICAgICAgICBTRUxFQ1RFRF9QQVRURVJOOiB0aGlzLnNlbGVjdGVkRW1iZWRkaW5nUGF0dGVyblxuICAgICAgfSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogRW1iZWRkaW5n5Yem55CG6Kit5a6a77yINOODkeOCv+ODvOODs+mBuOaKnuW8j++8iVxuICAgKi9cbiAgcHJpdmF0ZSBzZXR1cEVtYmVkZGluZ1Byb2Nlc3NpbmcoKTogdm9pZCB7XG4gICAgLy8g6YG45oqe44GV44KM44Gf44OR44K/44O844Oz44Gr5b+c44GY44Gm44Oq44K944O844K55L2c5oiQXG4gICAgY29uc3QgcGF0dGVybkNvbmZpZyA9IHRoaXMucHJvcHMuY29uZmlnLmVtYmVkZGluZy5wYXR0ZXJuQ29uZmlncz8uW3RoaXMuc2VsZWN0ZWRFbWJlZGRpbmdQYXR0ZXJuXTtcbiAgICBcbiAgICBpZiAoIXBhdHRlcm5Db25maWc/LmVuYWJsZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgU2VsZWN0ZWQgZW1iZWRkaW5nIHBhdHRlcm4gJHt0aGlzLnNlbGVjdGVkRW1iZWRkaW5nUGF0dGVybn0gaXMgbm90IGVuYWJsZWRgKTtcbiAgICB9XG4gICAgXG4gICAgc3dpdGNoICh0aGlzLnNlbGVjdGVkRW1iZWRkaW5nUGF0dGVybikge1xuICAgICAgY2FzZSAnYXdzLWJhdGNoJzpcbiAgICAgICAgdGhpcy5jcmVhdGVBd3NCYXRjaFJlc291cmNlcygpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2VjMi1zcG90JzpcbiAgICAgICAgdGhpcy5jcmVhdGVFYzJTcG90UmVzb3VyY2VzKCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnZWNzLW9uLWVjMic6XG4gICAgICAgIHRoaXMuY3JlYXRlRWNzT25FYzJSZXNvdXJjZXMoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdlYzItb24tZGVtYW5kJzpcbiAgICAgICAgdGhpcy5jcmVhdGVFYzJPbkRlbWFuZFJlc291cmNlcygpO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBlbWJlZGRpbmcgcGF0dGVybjogJHt0aGlzLnNlbGVjdGVkRW1iZWRkaW5nUGF0dGVybn1gKTtcbiAgICB9XG5cbiAgICAvLyBCZWRyb2NrIEVtYmVkZGluZ+OBruioreWumlxuICAgIGlmICh0aGlzLnByb3BzLmNvbmZpZy5lbWJlZGRpbmcuc3RyYXRlZ3kgPT09ICdiZWRyb2NrJykge1xuICAgICAgdGhpcy5zZXR1cEJlZHJvY2tFbWJlZGRpbmcoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQVdTIEJhdGNo44Oq44K944O844K55L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUF3c0JhdGNoUmVzb3VyY2VzKCk6IHZvaWQge1xuICAgIGNvbnN0IGJhdGNoQ29uZmlnID0gdGhpcy5wcm9wcy5jb25maWcuZW1iZWRkaW5nLmJhdGNoQ29uZmlnO1xuICAgIGlmICghYmF0Y2hDb25maWcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQmF0Y2ggY29uZmlndXJhdGlvbiBpcyByZXF1aXJlZCBmb3IgYXdzLWJhdGNoIHBhdHRlcm4nKTtcbiAgICB9XG5cbiAgICAvLyBCYXRjaCBTZXJ2aWNlIFJvbGVcbiAgICBjb25zdCBiYXRjaFNlcnZpY2VSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdCYXRjaFNlcnZpY2VSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2JhdGNoLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NCYXRjaFNlcnZpY2VSb2xlJylcbiAgICAgIF1cbiAgICB9KTtcblxuICAgIC8vIEluc3RhbmNlIFJvbGVcbiAgICBjb25zdCBpbnN0YW5jZVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0JhdGNoSW5zdGFuY2VSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2VjMi5hbWF6b25hd3MuY29tJyksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQW1hem9uRUMyQ29udGFpbmVyU2VydmljZWZvckVDMlJvbGUnKSxcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdBbWF6b25TM0Z1bGxBY2Nlc3MnKSxcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdDbG91ZFdhdGNoQWdlbnRTZXJ2ZXJQb2xpY3knKVxuICAgICAgXVxuICAgIH0pO1xuXG4gICAgLy8gSW5zdGFuY2UgUHJvZmlsZVxuICAgIGNvbnN0IGluc3RhbmNlUHJvZmlsZSA9IG5ldyBpYW0uQ2ZuSW5zdGFuY2VQcm9maWxlKHRoaXMsICdCYXRjaEluc3RhbmNlUHJvZmlsZScsIHtcbiAgICAgIHJvbGVzOiBbaW5zdGFuY2VSb2xlLnJvbGVOYW1lXVxuICAgIH0pO1xuXG4gICAgLy8gQ29tcHV0ZSBFbnZpcm9ubWVudFxuICAgIHRoaXMuYmF0Y2hDb21wdXRlRW52aXJvbm1lbnQgPSBuZXcgYmF0Y2guQ2ZuQ29tcHV0ZUVudmlyb25tZW50KHRoaXMsICdCYXRjaENvbXB1dGVFbnZpcm9ubWVudCcsIHtcbiAgICAgIHR5cGU6ICdNQU5BR0VEJyxcbiAgICAgIHN0YXRlOiAnRU5BQkxFRCcsXG4gICAgICBjb21wdXRlRW52aXJvbm1lbnROYW1lOiBgJHt0aGlzLnByb3BzLnByb2plY3ROYW1lfS0ke3RoaXMucHJvcHMuZW52aXJvbm1lbnR9LWFpLWVtYmVkZGluZy1iYXRjaC1jZWAsXG4gICAgICBzZXJ2aWNlUm9sZTogYmF0Y2hTZXJ2aWNlUm9sZS5yb2xlQXJuLFxuICAgICAgY29tcHV0ZVJlc291cmNlczoge1xuICAgICAgICB0eXBlOiBiYXRjaENvbmZpZy51c2VTcG90SW5zdGFuY2VzID8gJ1NQT1QnIDogJ0VDMicsXG4gICAgICAgIG1pbnZDcHVzOiBiYXRjaENvbmZpZy5taW52Q3B1cyB8fCAwLFxuICAgICAgICBtYXh2Q3B1czogYmF0Y2hDb25maWcubWF4dkNwdXMsXG4gICAgICAgIGRlc2lyZWR2Q3B1czogYmF0Y2hDb25maWcuZGVzaXJlZHZDcHVzIHx8IDAsXG4gICAgICAgIGluc3RhbmNlVHlwZXM6IGJhdGNoQ29uZmlnLmluc3RhbmNlVHlwZXMsXG4gICAgICAgIGluc3RhbmNlUm9sZTogaW5zdGFuY2VQcm9maWxlLmF0dHJBcm4sXG4gICAgICAgIHNwb3RJYW1GbGVldFJlcXVlc3RSb2xlOiBiYXRjaENvbmZpZy51c2VTcG90SW5zdGFuY2VzID8gXG4gICAgICAgICAgaWFtLlJvbGUuZnJvbVJvbGVBcm4odGhpcywgJ1Nwb3RGbGVldFJvbGUnLCBcbiAgICAgICAgICAgIGBhcm46YXdzOmlhbTo6JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06cm9sZS9hd3MtZWMyLXNwb3QtZmxlZXQtdGFnZ2luZy1yb2xlYCkucm9sZUFybiA6IHVuZGVmaW5lZCxcbiAgICAgICAgYmlkUGVyY2VudGFnZTogYmF0Y2hDb25maWcudXNlU3BvdEluc3RhbmNlcyA/IDUwIDogdW5kZWZpbmVkLFxuICAgICAgICBzdWJuZXRzOiB0aGlzLnByb3BzLnZwYz8ucHJpdmF0ZVN1Ym5ldHMubWFwKHN1Ym5ldCA9PiBzdWJuZXQuc3VibmV0SWQpIHx8IFtdXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBKb2IgUXVldWVcbiAgICB0aGlzLmJhdGNoSm9iUXVldWUgPSBuZXcgYmF0Y2guQ2ZuSm9iUXVldWUodGhpcywgJ0JhdGNoSm9iUXVldWUnLCB7XG4gICAgICBqb2JRdWV1ZU5hbWU6IGAke3RoaXMucHJvcHMucHJvamVjdE5hbWV9LSR7dGhpcy5wcm9wcy5lbnZpcm9ubWVudH0tYWktZW1iZWRkaW5nLXF1ZXVlYCxcbiAgICAgIHN0YXRlOiAnRU5BQkxFRCcsXG4gICAgICBwcmlvcml0eTogMSxcbiAgICAgIGNvbXB1dGVFbnZpcm9ubWVudE9yZGVyOiBbe1xuICAgICAgICBvcmRlcjogMSxcbiAgICAgICAgY29tcHV0ZUVudmlyb25tZW50OiB0aGlzLmJhdGNoQ29tcHV0ZUVudmlyb25tZW50LnJlZlxuICAgICAgfV1cbiAgICB9KTtcblxuICAgIC8vIEpvYiBEZWZpbml0aW9uXG4gICAgdGhpcy5iYXRjaEpvYkRlZmluaXRpb24gPSBuZXcgYmF0Y2guQ2ZuSm9iRGVmaW5pdGlvbih0aGlzLCAnQmF0Y2hKb2JEZWZpbml0aW9uJywge1xuICAgICAgam9iRGVmaW5pdGlvbk5hbWU6IGAke3RoaXMucHJvcHMucHJvamVjdE5hbWV9LSR7dGhpcy5wcm9wcy5lbnZpcm9ubWVudH0tYWktZW1iZWRkaW5nLWpvYmAsXG4gICAgICB0eXBlOiAnY29udGFpbmVyJyxcbiAgICAgIGNvbnRhaW5lclByb3BlcnRpZXM6IHtcbiAgICAgICAgaW1hZ2U6IHRoaXMucHJvcHMuY29uZmlnLmVtYmVkZGluZy5kb2NrZXJDb25maWcuaW1hZ2UsXG4gICAgICAgIHZjcHVzOiB0aGlzLnByb3BzLmNvbmZpZy5lbWJlZGRpbmcuZG9ja2VyQ29uZmlnLnZjcHVzIHx8IDIsXG4gICAgICAgIG1lbW9yeTogdGhpcy5wcm9wcy5jb25maWcuZW1iZWRkaW5nLmRvY2tlckNvbmZpZy5tZW1vcnkgfHwgNDA5NixcbiAgICAgICAgam9iUm9sZUFybjogdGhpcy5iZWRyb2NrUm9sZS5yb2xlQXJuLFxuICAgICAgICBlbnZpcm9ubWVudDogW1xuICAgICAgICAgIHsgbmFtZTogJ1BST0pFQ1RfTkFNRScsIHZhbHVlOiB0aGlzLnByb3BzLnByb2plY3ROYW1lIH0sXG4gICAgICAgICAgeyBuYW1lOiAnRU5WSVJPTk1FTlQnLCB2YWx1ZTogdGhpcy5wcm9wcy5lbnZpcm9ubWVudCB9LFxuICAgICAgICAgIHsgbmFtZTogJ1BBVFRFUk4nLCB2YWx1ZTogJ2F3cy1iYXRjaCcgfSxcbiAgICAgICAgICB7IG5hbWU6ICdCRURST0NLX1JFR0lPTicsIHZhbHVlOiB0aGlzLnByb3BzLnJlZ2lvbiB9LFxuICAgICAgICAgIC4uLk9iamVjdC5lbnRyaWVzKHRoaXMucHJvcHMuY29uZmlnLmVtYmVkZGluZy5kb2NrZXJDb25maWcuZW52aXJvbm1lbnRWYXJpYWJsZXMgfHwge30pXG4gICAgICAgICAgICAubWFwKChbbmFtZSwgdmFsdWVdKSA9PiAoeyBuYW1lLCB2YWx1ZSB9KSlcbiAgICAgICAgXVxuICAgICAgfSxcbiAgICAgIHJldHJ5U3RyYXRlZ3k6IHtcbiAgICAgICAgYXR0ZW1wdHM6IGJhdGNoQ29uZmlnLnJldHJ5QXR0ZW1wdHMgfHwgM1xuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IHtcbiAgICAgICAgYXR0ZW1wdER1cmF0aW9uU2Vjb25kczogYmF0Y2hDb25maWcuam9iVGltZW91dFNlY29uZHMgfHwgMzYwMFxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEVDMiBTcG9044Oq44K944O844K55L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUVjMlNwb3RSZXNvdXJjZXMoKTogdm9pZCB7XG4gICAgY29uc3Qgc3BvdENvbmZpZyA9IHRoaXMucHJvcHMuY29uZmlnLmVtYmVkZGluZy5zcG90Q29uZmlnO1xuICAgIGlmICghc3BvdENvbmZpZykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdTcG90IGNvbmZpZ3VyYXRpb24gaXMgcmVxdWlyZWQgZm9yIGVjMi1zcG90IHBhdHRlcm4nKTtcbiAgICB9XG5cbiAgICAvLyBFQzIgUm9sZVxuICAgIGNvbnN0IGVjMlJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ1Nwb3RFYzJSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2VjMi5hbWF6b25hd3MuY29tJyksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdBbWF6b25TU01NYW5hZ2VkSW5zdGFuY2VDb3JlJyksXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQW1hem9uUzNGdWxsQWNjZXNzJyksXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQ2xvdWRXYXRjaEFnZW50U2VydmVyUG9saWN5JylcbiAgICAgIF1cbiAgICB9KTtcblxuICAgIC8vIEJlZHJvY2vmqKnpmZDjgpLov73liqBcbiAgICBlYzJSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWwnLFxuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbFdpdGhSZXNwb25zZVN0cmVhbSdcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgfSkpO1xuXG4gICAgLy8gTGF1bmNoIFRlbXBsYXRlXG4gICAgdGhpcy5zcG90TGF1bmNoVGVtcGxhdGUgPSBuZXcgZWMyLkxhdW5jaFRlbXBsYXRlKHRoaXMsICdTcG90TGF1bmNoVGVtcGxhdGUnLCB7XG4gICAgICBsYXVuY2hUZW1wbGF0ZU5hbWU6IGAke3RoaXMucHJvcHMucHJvamVjdE5hbWV9LSR7dGhpcy5wcm9wcy5lbnZpcm9ubWVudH0tYWktZW1iZWRkaW5nLXNwb3QtbHRgLFxuICAgICAgaW5zdGFuY2VUeXBlOiBlYzIuSW5zdGFuY2VUeXBlLm9mKFxuICAgICAgICBlYzIuSW5zdGFuY2VDbGFzcy5NNSwgXG4gICAgICAgIGVjMi5JbnN0YW5jZVNpemUuTEFSR0VcbiAgICAgICksXG4gICAgICBtYWNoaW5lSW1hZ2U6IGVjMi5NYWNoaW5lSW1hZ2UubGF0ZXN0QW1hem9uTGludXgyKCksXG4gICAgICByb2xlOiBlYzJSb2xlLFxuICAgICAgdXNlckRhdGE6IGVjMi5Vc2VyRGF0YS5mb3JMaW51eCgpLFxuICAgICAgc3BvdE9wdGlvbnM6IHtcbiAgICAgICAgcmVxdWVzdFR5cGU6IGVjMi5TcG90UmVxdWVzdFR5cGUuT05FX1RJTUUsXG4gICAgICAgIG1heFByaWNlOiBjZGsuVG9rZW4uYXNOdW1iZXIoc3BvdENvbmZpZy5tYXhQcmljZSlcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIEF1dG8gU2NhbGluZyBHcm91cFxuICAgIHRoaXMuc3BvdEF1dG9TY2FsaW5nR3JvdXAgPSBuZXcgYXV0b3NjYWxpbmcuQXV0b1NjYWxpbmdHcm91cCh0aGlzLCAnU3BvdEF1dG9TY2FsaW5nR3JvdXAnLCB7XG4gICAgICBhdXRvU2NhbGluZ0dyb3VwTmFtZTogYCR7dGhpcy5wcm9wcy5wcm9qZWN0TmFtZX0tJHt0aGlzLnByb3BzLmVudmlyb25tZW50fS1haS1lbWJlZGRpbmctc3BvdC1hc2dgLFxuICAgICAgdnBjOiB0aGlzLnByb3BzLnZwYyB8fCBlYzIuVnBjLmZyb21Mb29rdXAodGhpcywgJ0RlZmF1bHRWcGMnLCB7IGlzRGVmYXVsdDogdHJ1ZSB9KSxcbiAgICAgIGxhdW5jaFRlbXBsYXRlOiB0aGlzLnNwb3RMYXVuY2hUZW1wbGF0ZSxcbiAgICAgIG1pbkNhcGFjaXR5OiBzcG90Q29uZmlnLmF1dG9TY2FsaW5nQ29uZmlnLm1pbkNhcGFjaXR5IHx8IDAsXG4gICAgICBtYXhDYXBhY2l0eTogc3BvdENvbmZpZy5hdXRvU2NhbGluZ0NvbmZpZy5tYXhDYXBhY2l0eSxcbiAgICAgIGRlc2lyZWRDYXBhY2l0eTogc3BvdENvbmZpZy5hdXRvU2NhbGluZ0NvbmZpZy5kZXNpcmVkQ2FwYWNpdHlcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFQ1Mgb24gRUMy44Oq44K944O844K55L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUVjc09uRWMyUmVzb3VyY2VzKCk6IHZvaWQge1xuICAgIGNvbnN0IGVjc0NvbmZpZyA9IHRoaXMucHJvcHMuY29uZmlnLmVtYmVkZGluZy5lY3NDb25maWc7XG4gICAgaWYgKCFlY3NDb25maWcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRUNTIGNvbmZpZ3VyYXRpb24gaXMgcmVxdWlyZWQgZm9yIGVjcy1vbi1lYzIgcGF0dGVybicpO1xuICAgIH1cblxuICAgIC8vIEVDUyBDbHVzdGVyXG4gICAgdGhpcy5lY3NDbHVzdGVyID0gbmV3IGVjcy5DbHVzdGVyKHRoaXMsICdFY3NDbHVzdGVyJywge1xuICAgICAgY2x1c3Rlck5hbWU6IGAke3RoaXMucHJvcHMucHJvamVjdE5hbWV9LSR7dGhpcy5wcm9wcy5lbnZpcm9ubWVudH0tYWktZW1iZWRkaW5nLWNsdXN0ZXJgLFxuICAgICAgdnBjOiB0aGlzLnByb3BzLnZwY1xuICAgIH0pO1xuXG4gICAgLy8gVGFzayBEZWZpbml0aW9uXG4gICAgdGhpcy5lY3NUYXNrRGVmaW5pdGlvbiA9IG5ldyBlY3MuRmFyZ2F0ZVRhc2tEZWZpbml0aW9uKHRoaXMsICdFY3NUYXNrRGVmaW5pdGlvbicsIHtcbiAgICAgIGZhbWlseTogYCR7dGhpcy5wcm9wcy5wcm9qZWN0TmFtZX0tJHt0aGlzLnByb3BzLmVudmlyb25tZW50fS1haS1lbWJlZGRpbmctdGFza2AsXG4gICAgICBjcHU6IGVjc0NvbmZpZy5jcHUsXG4gICAgICBtZW1vcnlMaW1pdE1pQjogZWNzQ29uZmlnLm1lbW9yeSxcbiAgICAgIHRhc2tSb2xlOiB0aGlzLmJlZHJvY2tSb2xlXG4gICAgfSk7XG5cbiAgICAvLyBDb250YWluZXIgRGVmaW5pdGlvblxuICAgIHRoaXMuZWNzVGFza0RlZmluaXRpb24uYWRkQ29udGFpbmVyKCdFbWJlZGRpbmdDb250YWluZXInLCB7XG4gICAgICBpbWFnZTogZWNzLkNvbnRhaW5lckltYWdlLmZyb21SZWdpc3RyeSh0aGlzLnByb3BzLmNvbmZpZy5lbWJlZGRpbmcuZG9ja2VyQ29uZmlnLmltYWdlKSxcbiAgICAgIG1lbW9yeUxpbWl0TWlCOiBlY3NDb25maWcubWVtb3J5LFxuICAgICAgY3B1OiBlY3NDb25maWcuY3B1LFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgUFJPSkVDVF9OQU1FOiB0aGlzLnByb3BzLnByb2plY3ROYW1lLFxuICAgICAgICBFTlZJUk9OTUVOVDogdGhpcy5wcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgICAgUEFUVEVSTjogJ2Vjcy1vbi1lYzInLFxuICAgICAgICBCRURST0NLX1JFR0lPTjogdGhpcy5wcm9wcy5yZWdpb24sXG4gICAgICAgIC4uLnRoaXMucHJvcHMuY29uZmlnLmVtYmVkZGluZy5kb2NrZXJDb25maWcuZW52aXJvbm1lbnRWYXJpYWJsZXNcbiAgICAgIH0sXG4gICAgICBsb2dnaW5nOiBlY3MuTG9nRHJpdmVycy5hd3NMb2dzKHtcbiAgICAgICAgc3RyZWFtUHJlZml4OiAnYWktZW1iZWRkaW5nJyxcbiAgICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUtcbiAgICAgIH0pXG4gICAgfSk7XG5cbiAgICAvLyBFQ1MgU2VydmljZVxuICAgIHRoaXMuZWNzU2VydmljZSA9IG5ldyBlY3MuRmFyZ2F0ZVNlcnZpY2UodGhpcywgJ0Vjc1NlcnZpY2UnLCB7XG4gICAgICBjbHVzdGVyOiB0aGlzLmVjc0NsdXN0ZXIsXG4gICAgICB0YXNrRGVmaW5pdGlvbjogdGhpcy5lY3NUYXNrRGVmaW5pdGlvbixcbiAgICAgIHNlcnZpY2VOYW1lOiBgJHt0aGlzLnByb3BzLnByb2plY3ROYW1lfS0ke3RoaXMucHJvcHMuZW52aXJvbm1lbnR9LWFpLWVtYmVkZGluZy1zZXJ2aWNlYCxcbiAgICAgIGRlc2lyZWRDb3VudDogZWNzQ29uZmlnLmRlc2lyZWRDb3VudFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEVDMiBPbi1EZW1hbmTjg6rjgr3jg7zjgrnkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlRWMyT25EZW1hbmRSZXNvdXJjZXMoKTogdm9pZCB7XG4gICAgLy8gRUMyIFJvbGVcbiAgICBjb25zdCBvbkRlbWFuZFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ09uRGVtYW5kRWMyUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdlYzIuYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQW1hem9uU1NNTWFuYWdlZEluc3RhbmNlQ29yZScpLFxuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ0FtYXpvblMzRnVsbEFjY2VzcycpLFxuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ0Nsb3VkV2F0Y2hBZ2VudFNlcnZlclBvbGljeScpXG4gICAgICBdXG4gICAgfSk7XG5cbiAgICAvLyBCZWRyb2Nr5qip6ZmQ44KS6L+95YqgXG4gICAgb25EZW1hbmRSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWwnLFxuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbFdpdGhSZXNwb25zZVN0cmVhbSdcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgfSkpO1xuXG4gICAgLy8gRUMyIEluc3RhbmNlXG4gICAgdGhpcy5vbkRlbWFuZEluc3RhbmNlID0gbmV3IGVjMi5JbnN0YW5jZSh0aGlzLCAnT25EZW1hbmRJbnN0YW5jZScsIHtcbiAgICAgIGluc3RhbmNlTmFtZTogYCR7dGhpcy5wcm9wcy5wcm9qZWN0TmFtZX0tJHt0aGlzLnByb3BzLmVudmlyb25tZW50fS1haS1lbWJlZGRpbmctb24tZGVtYW5kYCxcbiAgICAgIGluc3RhbmNlVHlwZTogZWMyLkluc3RhbmNlVHlwZS5vZihlYzIuSW5zdGFuY2VDbGFzcy5NNSwgZWMyLkluc3RhbmNlU2l6ZS5MQVJHRSksXG4gICAgICBtYWNoaW5lSW1hZ2U6IGVjMi5NYWNoaW5lSW1hZ2UubGF0ZXN0QW1hem9uTGludXgyKCksXG4gICAgICB2cGM6IHRoaXMucHJvcHMudnBjIHx8IGVjMi5WcGMuZnJvbUxvb2t1cCh0aGlzLCAnT25EZW1hbmREZWZhdWx0VnBjJywgeyBpc0RlZmF1bHQ6IHRydWUgfSksXG4gICAgICByb2xlOiBvbkRlbWFuZFJvbGVcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBCZWRyb2NrIEVtYmVkZGluZ+ioreWumlxuICAgKi9cbiAgcHJpdmF0ZSBzZXR1cEJlZHJvY2tFbWJlZGRpbmcoKTogdm9pZCB7XG4gICAgY29uc3QgZW1iZWRkaW5nQ29uZmlnID0gdGhpcy5wcm9wcy5jb25maWcuYmVkcm9jay5tb2RlbHMuZW1iZWRkaW5nO1xuICAgIFxuICAgIC8vIEVtYmVkZGluZ+WHpueQhueUqOOBrklBTeODneODquOCt+ODvOi/veWKoFxuICAgIHRoaXMuYmVkcm9ja1JvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbCcsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmJlZHJvY2s6Kjo6Zm91bmRhdGlvbi1tb2RlbC8ke2VtYmVkZGluZ0NvbmZpZy5tb2RlbElkfWAsXG4gICAgICBdLFxuICAgIH0pKTtcblxuICAgIC8vIEVtYmVkZGluZ+ioreWumuOBrueSsOWig+WkieaVsO+8iExhbWJkYemWouaVsOOBp+S9v+eUqO+8iVxuICAgIGNvbnN0IGVtYmVkZGluZ0Vudmlyb25tZW50ID0ge1xuICAgICAgQkVEUk9DS19FTUJFRERJTkdfTU9ERUxfSUQ6IGVtYmVkZGluZ0NvbmZpZy5tb2RlbElkLFxuICAgICAgQkVEUk9DS19FTUJFRERJTkdfRElNRU5TSU9OUzogZW1iZWRkaW5nQ29uZmlnLmRpbWVuc2lvbnMudG9TdHJpbmcoKSxcbiAgICAgIEVNQkVERElOR19CQVRDSF9TSVpFOiB0aGlzLnByb3BzLmNvbmZpZy5lbWJlZGRpbmcuYmF0Y2hTaXplLnRvU3RyaW5nKCksXG4gICAgICBFTUJFRERJTkdfQ0hVTktfU0laRTogdGhpcy5wcm9wcy5jb25maWcuZW1iZWRkaW5nLmNodW5rU2l6ZS50b1N0cmluZygpLFxuICAgICAgRU1CRURESU5HX0NIVU5LX09WRVJMQVA6IHRoaXMucHJvcHMuY29uZmlnLmVtYmVkZGluZy5jaHVua092ZXJsYXAudG9TdHJpbmcoKSxcbiAgICB9O1xuXG4gICAgLy8g5pei5a2Y44GuTGFtYmRh6Zai5pWw44Gr55Kw5aKD5aSJ5pWw44KS6L+95Yqg44GZ44KL5aC05ZCIXG4gICAgLy8g77yIQ29tcHV0ZUNvbnN0cnVjdOOBp+S9nOaIkOOBleOCjOOBn0xhbWJkYemWouaVsOOCkuWPgueFp++8iVxuICB9XG5cbiAgLyoqXG4gICAqIOODmeOCr+ODiOODq+aknOe0ouioreWumlxuICAgKi9cbiAgcHJpdmF0ZSBzZXR1cFZlY3RvclNlYXJjaCgpOiB2b2lkIHtcbiAgICBjb25zdCB2ZWN0b3JDb25maWcgPSB0aGlzLnByb3BzLmNvbmZpZy52ZWN0b3JTZWFyY2g7XG5cbiAgICAvLyBPcGVuU2VhcmNoIFNlcnZlcmxlc3PoqK3lrprvvIhEYXRhYmFzZUNvbnN0cnVjdOOBqOmAo+aQuu+8iVxuICAgIGlmICh2ZWN0b3JDb25maWcuZW5naW5lID09PSAnb3BlbnNlYXJjaCcpIHtcbiAgICAgIC8vIE9wZW5TZWFyY2jjgqTjg7Pjg4fjg4Pjgq/jgrnoqK3lrppcbiAgICAgIGNvbnN0IGluZGV4U2V0dGluZ3MgPSB7XG4gICAgICAgIGRpbWVuc2lvbnM6IHZlY3RvckNvbmZpZy5pbmRleFNldHRpbmdzLmRpbWVuc2lvbnMsXG4gICAgICAgIHNpbWlsYXJpdHk6IHZlY3RvckNvbmZpZy5pbmRleFNldHRpbmdzLnNpbWlsYXJpdHksXG4gICAgICAgIGVmQ29uc3RydWN0aW9uOiB2ZWN0b3JDb25maWcuaW5kZXhTZXR0aW5ncy5lZkNvbnN0cnVjdGlvbiB8fCA1MTIsXG4gICAgICAgIGVmU2VhcmNoOiB2ZWN0b3JDb25maWcuaW5kZXhTZXR0aW5ncy5lZlNlYXJjaCB8fCA1MTIsXG4gICAgICAgIG1heENvbm5lY3Rpb25zOiB2ZWN0b3JDb25maWcuaW5kZXhTZXR0aW5ncy5tYXhDb25uZWN0aW9ucyB8fCAxNixcbiAgICAgIH07XG5cbiAgICAgIC8vIOOCpOODs+ODh+ODg+OCr+OCueS9nOaIkOeUqOOBruOCq+OCueOCv+ODoOODquOCveODvOOCue+8iOWwhuadpeWun+ijhe+8iVxuICAgICAgLy8gY29uc3QgaW5kZXhDdXN0b21SZXNvdXJjZSA9IG5ldyBjZGsuQ3VzdG9tUmVzb3VyY2UodGhpcywgJ1ZlY3RvckluZGV4Jywge1xuICAgICAgLy8gICBzZXJ2aWNlVG9rZW46IGluZGV4UHJvdmlkZXIuc2VydmljZVRva2VuLFxuICAgICAgLy8gICBwcm9wZXJ0aWVzOiB7XG4gICAgICAvLyAgICAgSW5kZXhOYW1lOiBgJHt0aGlzLnByb3BzLnByb2plY3ROYW1lfS0ke3RoaXMucHJvcHMuZW52aXJvbm1lbnR9LXZlY3RvcnNgLFxuICAgICAgLy8gICAgIEluZGV4U2V0dGluZ3M6IGluZGV4U2V0dGluZ3MsXG4gICAgICAvLyAgIH0sXG4gICAgICAvLyB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUkFH6Kit5a6aXG4gICAqL1xuICBwcml2YXRlIHNldHVwUkFHUGlwZWxpbmUoKTogdm9pZCB7XG4gICAgY29uc3QgcmFnQ29uZmlnID0gdGhpcy5wcm9wcy5jb25maWcucmFnO1xuXG4gICAgLy8gUkFH5Yem55CG55So44GuSUFN44Od44Oq44K344O8XG4gICAgdGhpcy5iZWRyb2NrUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdiZWRyb2NrOlJldHJpZXZlJyxcbiAgICAgICAgJ2JlZHJvY2s6UmV0cmlldmVBbmRHZW5lcmF0ZScsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSwgLy8g5b+F6KaB44Gr5b+c44GY44Gm5Yi26ZmQXG4gICAgfSkpO1xuXG4gICAgLy8gUkFH6Kit5a6a44Gu55Kw5aKD5aSJ5pWwXG4gICAgY29uc3QgcmFnRW52aXJvbm1lbnQgPSB7XG4gICAgICBSQUdfUkVUUklFVkFMX1NUUkFURUdZOiByYWdDb25maWcucmV0cmlldmFsLnN0cmF0ZWd5LFxuICAgICAgUkFHX01BWF9ET0NVTUVOVFM6IHJhZ0NvbmZpZy5yZXRyaWV2YWwubWF4RG9jdW1lbnRzLnRvU3RyaW5nKCksXG4gICAgICBSQUdfTUlOX1NDT1JFOiByYWdDb25maWcucmV0cmlldmFsLm1pblNjb3JlLnRvU3RyaW5nKCksXG4gICAgICBSQUdfQ09OVEVYVF9XSU5ET1c6IHJhZ0NvbmZpZy5yZXRyaWV2YWwuY29udGV4dFdpbmRvdy50b1N0cmluZygpLFxuICAgICAgUkFHX01BWF9SRVNQT05TRV9MRU5HVEg6IHJhZ0NvbmZpZy5nZW5lcmF0aW9uLm1heFJlc3BvbnNlTGVuZ3RoLnRvU3RyaW5nKCksXG4gICAgICBSQUdfRU5BQkxFX0NJVEFUSU9OOiByYWdDb25maWcuZ2VuZXJhdGlvbi5lbmFibGVDaXRhdGlvbi50b1N0cmluZygpLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog5Ye65Yqb5YCk5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZU91dHB1dHMoKTogQUlPdXRwdXRzIHtcbiAgICByZXR1cm4ge1xuICAgICAgLy8gQmVkcm9ja+WHuuWKm1xuICAgICAgYmVkcm9ja01vZGVsQXJuczogW1xuICAgICAgICBgYXJuOmF3czpiZWRyb2NrOio6OmZvdW5kYXRpb24tbW9kZWwvJHt0aGlzLnByb3BzLmNvbmZpZy5iZWRyb2NrLm1vZGVscy50ZXh0R2VuZXJhdGlvbi5tb2RlbElkfWAsXG4gICAgICAgIGBhcm46YXdzOmJlZHJvY2s6Kjo6Zm91bmRhdGlvbi1tb2RlbC8ke3RoaXMucHJvcHMuY29uZmlnLmJlZHJvY2subW9kZWxzLmVtYmVkZGluZy5tb2RlbElkfWAsXG4gICAgICBdLFxuICAgICAgYmVkcm9ja0luZmVyZW5jZUVuZHBvaW50OiB1bmRlZmluZWQsIC8vIEJlZHJvY2vjga/nm7TmjqVBUEnjgpLkvb/nlKhcblxuICAgICAgLy8gRW1iZWRkaW5n5Ye65YqbXG4gICAgICBlbWJlZGRpbmdNb2RlbEFybjogYGFybjphd3M6YmVkcm9jazoqOjpmb3VuZGF0aW9uLW1vZGVsLyR7dGhpcy5wcm9wcy5jb25maWcuYmVkcm9jay5tb2RlbHMuZW1iZWRkaW5nLm1vZGVsSWR9YCxcbiAgICAgIGVtYmVkZGluZ1Byb2Nlc3NvckFybjogdGhpcy5lbWJlZGRpbmdQcm9jZXNzb3I/LmZ1bmN0aW9uQXJuLFxuXG4gICAgICAvLyDjg5njgq/jg4jjg6vmpJzntKLlh7rliptcbiAgICAgIHZlY3RvckluZGV4QXJuOiB1bmRlZmluZWQsIC8vIE9wZW5TZWFyY2jjgrPjg6zjgq/jgrfjg6fjg7NBUk7vvIhEYXRhYmFzZUNvbnN0cnVjdOOBi+OCieWPluW+l++8iVxuICAgICAgc2VhcmNoRW5kcG9pbnQ6IHVuZGVmaW5lZCwgLy8gT3BlblNlYXJjaOOCqOODs+ODieODneOCpOODs+ODiO+8iERhdGFiYXNlQ29uc3RydWN044GL44KJ5Y+W5b6X77yJXG5cbiAgICAgIC8vIFJBR+WHuuWKm1xuICAgICAgcmFnUGlwZWxpbmVBcm46IHVuZGVmaW5lZCwgLy8gUkFH44OR44Kk44OX44Op44Kk44OzQVJO77yI5bCG5p2l5a6f6KOF77yJXG4gICAgICByYWdFbmRwb2ludDogdW5kZWZpbmVkLCAvLyBSQUfjgqjjg7Pjg4njg53jgqTjg7Pjg4jvvIjlsIbmnaXlrp/oo4XvvIlcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOOCv+OCsOmBqeeUqO+8iElBTeWItumZkOWvvuW/nO+8iVxuICAgKi9cbiAgcHJpdmF0ZSBhcHBseVRhZ3MoKTogdm9pZCB7XG4gICAgY29uc3QgdGFncyA9IHRoaXMucHJvcHMuY29uZmlnLnRhZ3M7XG5cbiAgICAvLyDmnIDph43opoHjgr/jgrDjga7jgb/vvIhJQU3liLbpmZDlr77lv5zvvIlcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0FJUHJvdmlkZXInLCB0YWdzLkFJUHJvdmlkZXIpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnVXNlQ2FzZScsIHRhZ3MuVXNlQ2FzZSk7XG4gIH1cblxuICAvKipcbiAgICog57Wx5ZCI55uj6KaW44OA44OD44K344Ol44Oc44O844OJ5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZU1vbml0b3JpbmdEYXNoYm9hcmQoKTogY2xvdWR3YXRjaC5EYXNoYm9hcmQge1xuICAgIGNvbnN0IGRhc2hib2FyZCA9IG5ldyBjbG91ZHdhdGNoLkRhc2hib2FyZCh0aGlzLCAnQUlNb25pdG9yaW5nRGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogYCR7dGhpcy5wcm9wcy5wcm9qZWN0TmFtZX0tJHt0aGlzLnByb3BzLmVudmlyb25tZW50fS1haS1tb25pdG9yaW5nYFxuICAgIH0pO1xuXG4gICAgLy8gQmVkcm9ja+ODoeODiOODquOCr+OCuVxuICAgIGNvbnN0IGJlZHJvY2tXaWRnZXQgPSBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICB0aXRsZTogJ0JlZHJvY2sgTW9kZWwgSW52b2NhdGlvbnMnLFxuICAgICAgbGVmdDogW1xuICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogJ0FXUy9CZWRyb2NrJyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnSW52b2NhdGlvbnMnLFxuICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgIE1vZGVsSWQ6IHRoaXMucHJvcHMuY29uZmlnLmJlZHJvY2subW9kZWxzLnRleHRHZW5lcmF0aW9uLm1vZGVsSWRcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICBdXG4gICAgfSk7XG5cbiAgICAvLyBFbWJlZGRpbmfjg5Hjgr/jg7zjg7PliKXjg6Hjg4jjg6rjgq/jgrlcbiAgICBsZXQgcGF0dGVybldpZGdldDogY2xvdWR3YXRjaC5XaWRnZXQ7XG4gICAgXG4gICAgc3dpdGNoICh0aGlzLnNlbGVjdGVkRW1iZWRkaW5nUGF0dGVybikge1xuICAgICAgY2FzZSAnYXdzLWJhdGNoJzpcbiAgICAgICAgcGF0dGVybldpZGdldCA9IG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICB0aXRsZTogJ0FXUyBCYXRjaCBKb2JzJyxcbiAgICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQmF0Y2gnLFxuICAgICAgICAgICAgICBtZXRyaWNOYW1lOiAnU3VibWl0dGVkSm9icydcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0JhdGNoJyxcbiAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ1J1bm5hYmxlSm9icydcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0JhdGNoJyxcbiAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ1J1bm5pbmdKb2JzJ1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICBdXG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2VjMi1zcG90JzpcbiAgICAgICAgcGF0dGVybldpZGdldCA9IG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICB0aXRsZTogJ0VDMiBTcG90IEluc3RhbmNlcycsXG4gICAgICAgICAgbGVmdDogW1xuICAgICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0F1dG9TY2FsaW5nJyxcbiAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ0dyb3VwRGVzaXJlZENhcGFjaXR5JyxcbiAgICAgICAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgICAgICAgIEF1dG9TY2FsaW5nR3JvdXBOYW1lOiB0aGlzLnNwb3RBdXRvU2NhbGluZ0dyb3VwPy5hdXRvU2NhbGluZ0dyb3VwTmFtZSB8fCAnJ1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIF1cbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnZWNzLW9uLWVjMic6XG4gICAgICAgIHBhdHRlcm5XaWRnZXQgPSBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgICAgdGl0bGU6ICdFQ1MgU2VydmljZScsXG4gICAgICAgICAgbGVmdDogW1xuICAgICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0VDUycsXG4gICAgICAgICAgICAgIG1ldHJpY05hbWU6ICdSdW5uaW5nVGFza0NvdW50JyxcbiAgICAgICAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgICAgICAgIFNlcnZpY2VOYW1lOiB0aGlzLmVjc1NlcnZpY2U/LnNlcnZpY2VOYW1lIHx8ICcnLFxuICAgICAgICAgICAgICAgIENsdXN0ZXJOYW1lOiB0aGlzLmVjc0NsdXN0ZXI/LmNsdXN0ZXJOYW1lIHx8ICcnXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgXVxuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBwYXR0ZXJuV2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guVGV4dFdpZGdldCh7XG4gICAgICAgICAgbWFya2Rvd246IGAjIyBDdXJyZW50IFBhdHRlcm46ICR7dGhpcy5zZWxlY3RlZEVtYmVkZGluZ1BhdHRlcm59XFxuXFxuTm8gc3BlY2lmaWMgbWV0cmljcyBhdmFpbGFibGUgZm9yIHRoaXMgcGF0dGVybi5gLFxuICAgICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgICBoZWlnaHQ6IDZcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoYmVkcm9ja1dpZGdldCwgcGF0dGVybldpZGdldCk7XG4gICAgcmV0dXJuIGRhc2hib2FyZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBFdmVudEJyaWRnZee1seWQiOS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVFdmVudEJyaWRnZUludGVncmF0aW9uKCk6IHZvaWQge1xuICAgIC8vIOODkeOCv+ODvOODs+euoeeQhuOCpOODmeODs+ODiFxuICAgIG5ldyBldmVudHMuUnVsZSh0aGlzLCAnQUlQYXR0ZXJuTWFuYWdlbWVudFJ1bGUnLCB7XG4gICAgICBydWxlTmFtZTogYCR7dGhpcy5wcm9wcy5wcm9qZWN0TmFtZX0tJHt0aGlzLnByb3BzLmVudmlyb25tZW50fS1haS1wYXR0ZXJuLW1hbmFnZW1lbnRgLFxuICAgICAgZGVzY3JpcHRpb246ICdBSSBFbWJlZGRpbmcgcGF0dGVybiBtYW5hZ2VtZW50IGV2ZW50cycsXG4gICAgICBldmVudFBhdHRlcm46IHtcbiAgICAgICAgc291cmNlOiBbJ2N1c3RvbS5haS5lbWJlZGRpbmcnXSxcbiAgICAgICAgZGV0YWlsVHlwZTogWydQYXR0ZXJuIE1hbmFnZW1lbnQnLCAnUGF0dGVybiBTd2l0Y2gnLCAnUGVyZm9ybWFuY2UgQWxlcnQnXVxuICAgICAgfSxcbiAgICAgIHRhcmdldHM6IFtuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbih0aGlzLnBhdHRlcm5NYW5hZ2VyRnVuY3Rpb24pXVxuICAgIH0pO1xuXG4gICAgLy8g44K544Kx44K444Ol44O844Or44OZ44O844K544Gu5pyA6YGp5YyW44OB44Kn44OD44KvXG4gICAgbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdBSU9wdGltaXphdGlvblNjaGVkdWxlJywge1xuICAgICAgcnVsZU5hbWU6IGAke3RoaXMucHJvcHMucHJvamVjdE5hbWV9LSR7dGhpcy5wcm9wcy5lbnZpcm9ubWVudH0tYWktb3B0aW1pemF0aW9uLXNjaGVkdWxlYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2NoZWR1bGVkIEFJIHBhdHRlcm4gb3B0aW1pemF0aW9uIGNoZWNrJyxcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuY3Jvbih7XG4gICAgICAgIG1pbnV0ZTogJzAnLFxuICAgICAgICBob3VyOiAnMicsXG4gICAgICAgIGRheTogJyonLFxuICAgICAgICBtb250aDogJyonLFxuICAgICAgICB5ZWFyOiAnKidcbiAgICAgIH0pLFxuICAgICAgdGFyZ2V0czogW25ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKHRoaXMucGF0dGVybk1hbmFnZXJGdW5jdGlvbiwge1xuICAgICAgICBldmVudDogZXZlbnRzLlJ1bGVUYXJnZXRJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICAgICBhY3Rpb246ICdvcHRpbWl6ZS1wYXR0ZXJuJyxcbiAgICAgICAgICBzb3VyY2U6ICdzY2hlZHVsZWQnXG4gICAgICAgIH0pXG4gICAgICB9KV1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlh7rlipvlgKTkvZzmiJDvvIjlvLfljJbniYjvvIlcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlT3V0cHV0cygpOiBBSU91dHB1dHMge1xuICAgIHJldHVybiB7XG4gICAgICAvLyBCZWRyb2Nr5Ye65YqbXG4gICAgICBiZWRyb2NrTW9kZWxBcm5zOiBbXG4gICAgICAgIGBhcm46YXdzOmJlZHJvY2s6Kjo6Zm91bmRhdGlvbi1tb2RlbC8ke3RoaXMucHJvcHMuY29uZmlnLmJlZHJvY2subW9kZWxzLnRleHRHZW5lcmF0aW9uLm1vZGVsSWR9YCxcbiAgICAgICAgYGFybjphd3M6YmVkcm9jazoqOjpmb3VuZGF0aW9uLW1vZGVsLyR7dGhpcy5wcm9wcy5jb25maWcuYmVkcm9jay5tb2RlbHMuZW1iZWRkaW5nLm1vZGVsSWR9YCxcbiAgICAgIF0sXG4gICAgICBiZWRyb2NrSW5mZXJlbmNlRW5kcG9pbnQ6IHVuZGVmaW5lZCwgLy8gQmVkcm9ja+OBr+ebtOaOpUFQSeOCkuS9v+eUqFxuXG4gICAgICAvLyBFbWJlZGRpbmflh7rlipvvvIg044OR44K/44O844Oz5a++5b+c77yJXG4gICAgICBlbWJlZGRpbmdNb2RlbEFybjogYGFybjphd3M6YmVkcm9jazoqOjpmb3VuZGF0aW9uLW1vZGVsLyR7dGhpcy5wcm9wcy5jb25maWcuYmVkcm9jay5tb2RlbHMuZW1iZWRkaW5nLm1vZGVsSWR9YCxcbiAgICAgIGVtYmVkZGluZ1Byb2Nlc3NvckFybjogdGhpcy5lbWJlZGRpbmdQcm9jZXNzb3I/LmZ1bmN0aW9uQXJuLFxuICAgICAgZW1iZWRkaW5nUGF0dGVybjogdGhpcy5zZWxlY3RlZEVtYmVkZGluZ1BhdHRlcm4sXG4gICAgICBwYXR0ZXJuTWFuYWdlckFybjogdGhpcy5wYXR0ZXJuTWFuYWdlckZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuXG4gICAgICAvLyDjg5Hjgr/jg7zjg7PliKXjg6rjgr3jg7zjgrnlh7rliptcbiAgICAgIGJhdGNoQ29tcHV0ZUVudmlyb25tZW50QXJuOiB0aGlzLmJhdGNoQ29tcHV0ZUVudmlyb25tZW50Py5yZWYsXG4gICAgICBiYXRjaEpvYlF1ZXVlQXJuOiB0aGlzLmJhdGNoSm9iUXVldWU/LnJlZixcbiAgICAgIGJhdGNoSm9iRGVmaW5pdGlvbkFybjogdGhpcy5iYXRjaEpvYkRlZmluaXRpb24/LnJlZixcbiAgICAgIHNwb3RBdXRvU2NhbGluZ0dyb3VwQXJuOiB0aGlzLnNwb3RBdXRvU2NhbGluZ0dyb3VwPy5hdXRvU2NhbGluZ0dyb3VwQXJuLFxuICAgICAgZWNzQ2x1c3RlckFybjogdGhpcy5lY3NDbHVzdGVyPy5jbHVzdGVyQXJuLFxuICAgICAgZWNzU2VydmljZUFybjogdGhpcy5lY3NTZXJ2aWNlPy5zZXJ2aWNlQXJuLFxuICAgICAgb25EZW1hbmRJbnN0YW5jZUlkOiB0aGlzLm9uRGVtYW5kSW5zdGFuY2U/Lmluc3RhbmNlSWQsXG5cbiAgICAgIC8vIOODmeOCr+ODiOODq+aknOe0ouWHuuWKm1xuICAgICAgdmVjdG9ySW5kZXhBcm46IHVuZGVmaW5lZCwgLy8gT3BlblNlYXJjaOOCs+ODrOOCr+OCt+ODp+ODs0FSTu+8iERhdGFiYXNlQ29uc3RydWN044GL44KJ5Y+W5b6X77yJXG4gICAgICBzZWFyY2hFbmRwb2ludDogdW5kZWZpbmVkLCAvLyBPcGVuU2VhcmNo44Ko44Oz44OJ44Od44Kk44Oz44OI77yIRGF0YWJhc2VDb25zdHJ1Y3TjgYvjgonlj5blvpfvvIlcblxuICAgICAgLy8gUkFH5Ye65YqbXG4gICAgICByYWdQaXBlbGluZUFybjogdW5kZWZpbmVkLCAvLyBSQUfjg5HjgqTjg5fjg6njgqTjg7NBUk7vvIjlsIbmnaXlrp/oo4XvvIlcbiAgICAgIHJhZ0VuZHBvaW50OiB1bmRlZmluZWQsIC8vIFJBR+OCqOODs+ODieODneOCpOODs+ODiO+8iOWwhuadpeWun+ijhe+8iVxuXG4gICAgICAvLyDnm6Poppblh7rliptcbiAgICAgIG1vbml0b3JpbmdEYXNoYm9hcmRVcmw6IGBodHRwczovL2NvbnNvbGUuYXdzLmFtYXpvbi5jb20vY2xvdWR3YXRjaC9ob21lP3JlZ2lvbj0ke3RoaXMucHJvcHMucmVnaW9ufSNkYXNoYm9hcmRzOm5hbWU9JHt0aGlzLnByb3BzLnByb2plY3ROYW1lfS0ke3RoaXMucHJvcHMuZW52aXJvbm1lbnR9LWFpLW1vbml0b3JpbmdgLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog44K/44Kw6YGp55So77yI5by35YyW54mI77yJXG4gICAqL1xuICBwcml2YXRlIGFwcGx5VGFncygpOiB2b2lkIHtcbiAgICBjb25zdCB0YWdzID0gdGhpcy5wcm9wcy5jb25maWcudGFncztcblxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQUlQcm92aWRlcicsIHRhZ3MuQUlQcm92aWRlcik7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdNb2RlbFR5cGUnLCB0YWdzLk1vZGVsVHlwZSk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdVc2VDYXNlJywgdGFncy5Vc2VDYXNlKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0VtYmVkZGluZ1BhdHRlcm4nLCB0aGlzLnNlbGVjdGVkRW1iZWRkaW5nUGF0dGVybik7XG5cbiAgICBpZiAodGFncy5QZXJmb3JtYW5jZVRpZXIpIHtcbiAgICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnUGVyZm9ybWFuY2VUaWVyJywgdGFncy5QZXJmb3JtYW5jZVRpZXIpO1xuICAgIH1cblxuICAgIGlmICh0YWdzLkNvc3RPcHRpbWl6YXRpb24pIHtcbiAgICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQ29zdE9wdGltaXphdGlvbicsIHRhZ3MuQ29zdE9wdGltaXphdGlvbik7XG4gICAgfVxuXG4gICAgLy8g44OR44K/44O844Oz5Zu65pyJ44K/44KwXG4gICAgY29uc3QgcGF0dGVybkNvbmZpZyA9IHRoaXMucHJvcHMuY29uZmlnLmVtYmVkZGluZy5wYXR0ZXJuQ29uZmlncz8uW3RoaXMuc2VsZWN0ZWRFbWJlZGRpbmdQYXR0ZXJuXTtcbiAgICBpZiAocGF0dGVybkNvbmZpZykge1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdSZWxhdGl2ZUNvc3QnLCBwYXR0ZXJuQ29uZmlnLnJlbGF0aXZlQ29zdC50b1N0cmluZygpKTtcbiAgICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRmF1bHRUb2xlcmFuY2VMZXZlbCcsIHBhdHRlcm5Db25maWcuZmF1bHRUb2xlcmFuY2VMZXZlbC50b1N0cmluZygpKTtcbiAgICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnT3BlcmFiaWxpdHlMZXZlbCcsIHBhdHRlcm5Db25maWcub3BlcmFiaWxpdHlMZXZlbC50b1N0cmluZygpKTtcbiAgICB9XG4gIH1cbn0iXX0=