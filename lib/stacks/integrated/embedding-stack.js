"use strict";
/**
 * 統合Embeddingスタック
 *
 * モジュラーアーキテクチャに基づくEmbedding・AI統合管理
 * - Lambda 関数（Embedding処理）
 * - AI/ML サービス (Bedrock)
 * - バッチ処理（AWS Batch）
 * - コンテナサービス (ECS)
 * - 統一命名規則: Component="Embedding"
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
exports.EmbeddingStack = void 0;
// AWS CDK コアライブラリ
const cdk = __importStar(require("aws-cdk-lib"));
class EmbeddingStack extends cdk.Stack {
    // AI/ML統合（Phase 1未実装）
    // public readonly aiConstruct?: AIConstruct;
    // Embedding Batch統合（Phase 1未実装）
    embeddingBatchIntegration;
    // public readonly batchIntegrationTest?: BatchIntegrationTest;
    embeddingConfig;
    // SQLite負荷試験コンストラクト（既存実装を保持）
    sqliteLoadTest;
    windowsSqlite;
    // Embeddingリソース（既存実装を保持）
    lambdaFunctions;
    ecsCluster;
    batchJobQueue;
    // AI/MLリソース（既存実装を保持）
    bedrockModels;
    embeddingFunction;
    // Bedrock Agent（Phase 4統合 - 新機能）
    bedrockAgent;
    agentArn;
    agentAliasArn;
    // Bedrock Guardrails（Phase 5 - SecurityStackから取得）
    guardrailArn;
    constructor(scope, id, props) {
        console.log('🔧 コンストラクタ開始: super()呼び出し前');
        super(scope, id, props);
        console.log('🔧 super()呼び出し完了');
        console.log('🤖 EmbeddingStack初期化開始...');
        console.log(`📝 スタック名: ${id}`);
        // VPCとサブネット情報のログ出力
        if (props.vpc) {
            console.log(`📡 VPC情報: ${props.vpc.vpcId || 'VPCオブジェクト'}`);
        }
        if (props.privateSubnetIds) {
            console.log(`🔒 Private Subnets: ${props.privateSubnetIds.join(', ')}`);
        }
        if (props.publicSubnetIds) {
            console.log(`🌐 Public Subnets: ${props.publicSubnetIds.join(', ')}`);
        }
        if (props.s3BucketNames) {
            console.log(`🪣 S3 Buckets: ${Object.keys(props.s3BucketNames).join(', ')}`);
        }
        // コスト配布タグの適用（AWS Batch専用タグを含む）
        // 最小限実装のため、一時的にスキップ
        /*
        const taggingConfig = PermissionAwareRAGTags.getStandardConfig(
          props.projectName,
          props.environment
        );
        TaggingStrategy.applyTagsToStack(this, taggingConfig);
        */
        // propsの分解代入（最小限実装のため、一時的にスキップ）
        /*
        const {
          aiConfig,
          embeddingConfig,
          projectName,
          environment,
          vpcId,
          privateSubnetIds,
          securityGroupIds,
          kmsKeyArn,
          s3BucketArns,
          dynamoDbTableArns,
          openSearchCollectionArn,
          enableBatchIntegration = false, // デフォルトfalseに変更（最小限実装）
          enableBatchTesting = false,
          imagePath = 'embedding-server',
          imageTag = 'latest',
          // SQLite負荷試験設定
          enableSqliteLoadTest = false,
          enableWindowsLoadTest = false,
          fsxFileSystemId,
          fsxSvmId,
          fsxVolumeId,
          fsxMountPath,
          fsxNfsEndpoint,
          fsxCifsEndpoint,
          fsxCifsShareName,
          keyPairName,
          bedrockRegion,
          bedrockModelId,
          scheduleExpression,
          maxvCpus,
          instanceTypes,
          windowsInstanceType
        } = props;
        */
        console.log('📝 Step 1: Embedding設定の初期化');
        // Embedding設定の初期化（既存実装を保持）
        // EmbeddingConfigFactoryは依存関係の問題があるため、propsから直接取得
        this.embeddingConfig = props.embeddingConfig;
        console.log('📝 Step 2: EmbeddingConstruct初期化');
        console.log('🧠 EmbeddingConstruct初期化開始...');
        console.log('EmbeddingConstruct initialized (stub)');
        console.log('✅ EmbeddingConstruct初期化完了');
        // 共通リソース設定（既存実装を保持）
        // 最小限実装のため、一時的にスキップ
        // const commonResources: EmbeddingCommonResources = this.createCommonResources(props);
        // AI Embeddingコンストラクト作成（既存実装を保持 - オプション）
        // AIConstructは依存関係の問題があるため、一時的にスキップ
        // if (aiConfig) {
        //   try {
        //     //     this.aiConstruct = new AIConstruct(this, 'EmbeddingAiConstruct', {  // Phase 1未実装
        //       config: aiConfig,
        //       projectName,
        //       environment,
        //       kmsKey: kmsKeyArn,
        //     });
        //   } catch (error) {
        //     console.warn('AIConstruct初期化をスキップ:', error);
        //   }
        // }
        // AWS Batch統合（既存実装を保持 - オプション）
        // EmbeddingConfigの型の問題があるため、一時的にスキップ
        // if (enableBatchIntegration && this.embeddingConfig?.awsBatch?.enabled) {
        //   try {
        //     this.embeddingBatchIntegration = new EmbeddingBatchIntegration(this, 'EmbeddingBatchIntegration', {
        //       config: this.embeddingConfig,
        //       projectName,
        //       environment,
        //       commonResources,
        //       imagePath,
        //       imageTag,
        //     });
        //     if (enableBatchTesting) {
        //     //       this.batchIntegrationTest = new BatchIntegrationTest(this, 'BatchIntegrationTest', {  // Phase 1未実装
        //         batchIntegration: this.embeddingBatchIntegration,
        //         config: this.embeddingConfig,
        //         projectName,
        //         environment,
        //         notificationTopicArn: this.embeddingConfig.monitoring?.alerts?.snsTopicArn,
        //       });
        //     }
        //   } catch (error) {
        //     console.warn('Batch統合の初期化をスキップ:', error);
        //   }
        // }
        // SQLite負荷試験統合（既存実装を保持 - オプション）
        // 最小限実装のため、一時的にスキップ
        /*
        if (enableSqliteLoadTest && fsxFileSystemId && fsxSvmId && fsxVolumeId) {
          try {
            this.sqliteLoadTest = new SqliteLoadTest(this, 'SqliteLoadTest', {
              projectName,
              environment,
              vpc: commonResources.vpc.vpc,
              privateSubnets: commonResources.vpc.privateSubnets,
              securityGroup: commonResources.securityGroups.commonSecurityGroup,
              fsxFileSystemId,
              fsxSvmId,
              fsxVolumeId,
              fsxMountPath: fsxMountPath || '/sqlite-load-test',
              fsxNfsEndpoint: fsxNfsEndpoint || `${fsxSvmId}.${fsxFileSystemId}.fsx.${this.region}.amazonaws.com`,
              bedrockRegion: bedrockRegion || this.region,
              bedrockModelId: bedrockModelId || 'amazon.titan-embed-text-v1',
              scheduleExpression: scheduleExpression || 'cron(0 2 * * ? *)',
              enableScheduledExecution: true,
              maxvCpus: maxvCpus || 20,
              instanceTypes: instanceTypes || ['m5.large', 'm5.xlarge'],
            });
    
            // Windows SQLite負荷試験（既存実装を保持 - オプション）
            if (enableWindowsLoadTest && keyPairName && fsxCifsEndpoint && fsxCifsShareName) {
              this.windowsSqlite = new WindowsSqlite(this, 'WindowsSqlite', {
                projectName,
                environment,
                vpc: commonResources.vpc.vpc,
                privateSubnet: commonResources.vpc.privateSubnets[0],
                securityGroup: commonResources.securityGroups.commonSecurityGroup,
                keyPairName,
                fsxFileSystemId,
                fsxSvmId,
                fsxVolumeId,
                fsxMountPath: fsxMountPath || '/sqlite-load-test',
                fsxCifsEndpoint,
                fsxCifsShareName,
                instanceType: windowsInstanceType || 't3.medium',
                enableDetailedMonitoring: environment === 'prod',
              });
            }
          } catch (error) {
            console.warn('SQLite負荷試験統合の初期化をスキップ:', error);
            // SQLite負荷試験の初期化に失敗してもスタック全体は継続
          }
        }
        */
        // Bedrock Agent統合（Phase 4 - 有効化されている場合）
        // 最小限実装のため、一時的にスキップ
        /*
        const useBedrockAgent = this.node.tryGetContext('useBedrockAgent') ?? props.useBedrockAgent ?? false;
        if (useBedrockAgent) {
          this.bedrockAgent = this.createBedrockAgent(props);
          this.agentArn = this.bedrockAgent.agentArn;
          this.agentAliasArn = this.bedrockAgent.agentAliasArn;
        }
        */
        console.log('📝 Step 3: 主要リソースの参照を設定');
        // 主要リソースの参照を設定（既存実装を保持）
        this.lambdaFunctions = {};
        this.ecsCluster = undefined;
        this.batchJobQueue = undefined;
        this.bedrockModels = {};
        this.embeddingFunction = undefined;
        // 最小限のEmbedding Lambda関数を作成
        const embeddingLambda = new cdk.aws_lambda.Function(this, 'EmbeddingFunction', {
            functionName: `${props.projectName}-${props.environment}-embedding`,
            runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
            handler: 'index.handler',
            code: cdk.aws_lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Embedding function called:', JSON.stringify(event));
          return {
            statusCode: 200,
            body: JSON.stringify({
              message: 'Embedding function placeholder',
              timestamp: new Date().toISOString()
            })
          };
        };
      `),
            timeout: cdk.Duration.seconds(30),
            memorySize: 512,
            environment: {
                PROJECT_NAME: props.projectName,
                ENVIRONMENT: props.environment,
            },
        });
        // Lambda関数をリストに追加
        this.lambdaFunctions['embedding'] = embeddingLambda;
        this.embeddingFunction = embeddingLambda;
        // Bedrock モデルIDを設定（プレースホルダー）
        this.bedrockModels['titan-embed'] = 'amazon.titan-embed-text-v1';
        console.log('📝 Step 4: コンストラクタ完了');
        console.log('✅ EmbeddingStack初期化完了');
        // CloudFormation出力
        // 最小限実装のため、一時的にスキップ
        this.createOutputs();
        // スタックレベルのタグ設定
        // 最小限実装のため、一時的にスキップ
        this.applyStackTags(props.projectName, props.environment);
    }
    /**
     * 共通リソース作成
     */
    createCommonResources(props) {
        // 既存のVPCを使用するか、新規作成
        let vpc;
        if (props.vpcId) {
            vpc = cdk.aws_ec2.Vpc.fromLookup(this, 'ExistingVpc', {
                vpcId: props.vpcId,
            });
        }
        else {
            vpc = new cdk.aws_ec2.Vpc(this, 'EmbeddingVpc', {
                maxAzs: 3,
                natGateways: 2,
                enableDnsHostnames: true,
                enableDnsSupport: true,
            });
        }
        // セキュリティグループ作成
        const commonSecurityGroup = new cdk.aws_ec2.SecurityGroup(this, 'EmbeddingCommonSecurityGroup', {
            vpc,
            description: 'Common security group for Embedding resources',
            allowAllOutbound: true,
        });
        // HTTPSアクセス許可
        commonSecurityGroup.addIngressRule(cdk.aws_ec2.Peer.anyIpv4(), cdk.aws_ec2.Port.tcp(443), 'HTTPS access');
        // VPC内通信許可
        commonSecurityGroup.addIngressRule(cdk.aws_ec2.Peer.ipv4(vpc.vpcCidrBlock), cdk.aws_ec2.Port.allTraffic(), 'VPC internal communication');
        return {
            vpc: {
                vpc,
                privateSubnets: vpc.privateSubnets,
                publicSubnets: vpc.publicSubnets,
                availabilityZones: vpc.availabilityZones,
            },
            securityGroups: {
                commonSecurityGroup,
            },
            iam: {
                commonServiceRole: this.createCommonServiceRole(),
            },
            logging: {
                commonLogGroup: this.createCommonLogGroup(),
            },
            storage: {},
        };
    }
    /**
     * 共通サービスロール作成
     */
    createCommonServiceRole() {
        return new cdk.aws_iam.Role(this, 'EmbeddingCommonServiceRole', {
            assumedBy: new cdk.aws_iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });
    }
    /**
     * 共通ロググループ作成（既存実装を保持）
     */
    createCommonLogGroup() {
        const logGroupName = this.embeddingConfig
            ? `/aws/embedding/${this.embeddingConfig.projectName}-${this.embeddingConfig.environment}`
            : `/aws/embedding/default`;
        return new cdk.aws_logs.LogGroup(this, 'EmbeddingCommonLogGroup', {
            logGroupName,
            retention: cdk.aws_logs.RetentionDays.ONE_MONTH,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
    }
    /**
     * CloudFormation出力の作成（統一命名規則適用）
     * 既存実装を保持 + Phase 4のBedrock Agent統合
     */
    createOutputs() {
        // Embedding Lambda 関数情報（既存実装を保持）
        if (this.lambdaFunctions && Object.keys(this.lambdaFunctions).length > 0) {
            Object.entries(this.lambdaFunctions).forEach(([name, func]) => {
                new cdk.CfnOutput(this, `EmbeddingLambdaFunction${name}Name`, {
                    value: func.functionName,
                    description: `Embedding Lambda Function ${name} Name`,
                    exportName: `${this.stackName}-EmbeddingLambdaFunction${name}Name`,
                });
                new cdk.CfnOutput(this, `EmbeddingLambdaFunction${name}Arn`, {
                    value: func.functionArn,
                    description: `Embedding Lambda Function ${name} ARN`,
                    exportName: `${this.stackName}-EmbeddingLambdaFunction${name}Arn`,
                });
            });
        }
        // Embedding ECS クラスター情報（既存実装を保持）
        if (this.ecsCluster) {
            new cdk.CfnOutput(this, 'EmbeddingEcsClusterName', {
                value: this.ecsCluster.clusterName,
                description: 'Embedding ECS Cluster Name',
                exportName: `${this.stackName}-EmbeddingEcsClusterName`,
            });
            new cdk.CfnOutput(this, 'EmbeddingEcsClusterArn', {
                value: this.ecsCluster.clusterArn,
                description: 'Embedding ECS Cluster ARN',
                exportName: `${this.stackName}-EmbeddingEcsClusterArn`,
            });
        }
        // Embedding Batch統合情報（既存実装を保持）
        if (this.embeddingBatchIntegration) {
            const batchInfo = this.embeddingBatchIntegration.getIntegrationInfo();
            new cdk.CfnOutput(this, 'EmbeddingBatchComputeEnvironmentName', {
                value: batchInfo.batchConstruct.computeEnvironment,
                description: 'Embedding Batch Compute Environment Name',
                exportName: `${this.stackName}-EmbeddingBatchComputeEnvironmentName`,
            });
            new cdk.CfnOutput(this, 'EmbeddingBatchJobQueueName', {
                value: batchInfo.batchConstruct.jobQueue,
                description: 'Embedding Batch Job Queue Name',
                exportName: `${this.stackName}-EmbeddingBatchJobQueueName`,
            });
        }
        // Embedding Bedrock モデル情報（既存実装を保持）
        if (this.bedrockModels && Object.keys(this.bedrockModels).length > 0) {
            Object.entries(this.bedrockModels).forEach(([name, modelId]) => {
                new cdk.CfnOutput(this, `EmbeddingBedrockModel${name}Id`, {
                    value: modelId,
                    description: `Embedding Bedrock Model ${name} ID`,
                    exportName: `${this.stackName}-EmbeddingBedrockModel${name}Id`,
                });
            });
        }
        // Embedding関数情報（既存実装を保持）
        if (this.embeddingFunction) {
            new cdk.CfnOutput(this, 'EmbeddingFunctionName', {
                value: this.embeddingFunction.functionName,
                description: 'Embedding Function Name',
                exportName: `${this.stackName}-EmbeddingFunctionName`,
            });
            new cdk.CfnOutput(this, 'EmbeddingFunctionArn', {
                value: this.embeddingFunction.functionArn,
                description: 'Embedding Function ARN',
                exportName: `${this.stackName}-EmbeddingFunctionArn`,
            });
        }
        // Bedrock Agent情報（Phase 4統合）
        if (this.bedrockAgent) {
            new cdk.CfnOutput(this, 'RAGMode', {
                value: 'agent',
                description: 'RAG Mode (agent or knowledge-base)',
                exportName: `${this.stackName}-RAGMode`,
            });
            new cdk.CfnOutput(this, 'BedrockAgentArn', {
                value: this.agentArn || 'N/A',
                description: 'Bedrock Agent ARN',
                exportName: `${this.stackName}-BedrockAgentArn`,
            });
            new cdk.CfnOutput(this, 'BedrockAgentAliasArn', {
                value: this.agentAliasArn || 'N/A',
                description: 'Bedrock Agent Alias ARN',
                exportName: `${this.stackName}-BedrockAgentAliasArn`,
            });
        }
        else {
            new cdk.CfnOutput(this, 'RAGMode', {
                value: 'knowledge-base',
                description: 'RAG Mode (agent or knowledge-base)',
                exportName: `${this.stackName}-RAGMode`,
            });
        }
    }
    /**
     * スタックレベルのタグ設定（統一命名規則適用）
     */
    applyStackTags(projectName, environment) {
        cdk.Tags.of(this).add('Project', projectName);
        cdk.Tags.of(this).add('Environment', environment);
        cdk.Tags.of(this).add('Stack', 'EmbeddingStack');
        cdk.Tags.of(this).add('Component', 'Embedding');
        cdk.Tags.of(this).add('ManagedBy', 'CDK');
        cdk.Tags.of(this).add('CostCenter', `${projectName}-${environment}-embedding`);
    }
    /**
     * 他のスタックで使用するためのEmbeddingリソース情報を取得
     */
    getEmbeddingInfo() {
        return {
            lambdaFunctions: this.lambdaFunctions,
            ecsCluster: this.ecsCluster,
            batchJobQueue: this.batchJobQueue,
            bedrockModels: this.bedrockModels,
            embeddingFunction: this.embeddingFunction,
        };
    }
    /**
     * 特定のLambda関数を取得
     */
    getLambdaFunction(name) {
        return this.lambdaFunctions[name];
    }
    /**
     * 特定のBedrockモデルIDを取得
     */
    getBedrockModelId(name) {
        return this.bedrockModels[name];
    }
    /**
     * Lambda関数用のIAMポリシーステートメントを生成
     */
    getLambdaExecutionPolicyStatements() {
        const statements = [];
        // Bedrock アクセス権限
        statements.push(new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
            ],
            resources: Object.values(this.bedrockModels).map(modelId => `arn:aws:bedrock:${this.region}::foundation-model/${modelId}`),
        }));
        // CloudWatch Logs アクセス権限
        statements.push(new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
            ],
            resources: [`arn:aws:logs:${this.region}:${this.account}:*`],
        }));
        // X-Ray トレーシング権限
        statements.push(new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
                'xray:PutTraceSegments',
                'xray:PutTelemetryRecords',
            ],
            resources: ['*'],
        }));
        return statements;
    }
    /**
     * ECS タスク用のIAMポリシーステートメントを生成
     */
    getEcsTaskPolicyStatements() {
        const statements = [];
        // ECS タスク実行権限
        statements.push(new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
                'ecr:GetAuthorizationToken',
                'ecr:BatchCheckLayerAvailability',
                'ecr:GetDownloadUrlForLayer',
                'ecr:BatchGetImage',
            ],
            resources: ['*'],
        }));
        // CloudWatch Logs アクセス権限
        statements.push(new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
                'logs:CreateLogStream',
                'logs:PutLogEvents',
            ],
            resources: [`arn:aws:logs:${this.region}:${this.account}:log-group:/ecs/*`],
        }));
        return statements;
    }
    /**
     * Batch統合情報を取得（既存実装を保持）
     */
    getBatchIntegrationInfo() {
        return this.embeddingBatchIntegration?.getIntegrationInfo();
    }
    /**
     * Batchジョブを実行（既存実装を保持）
     */
    async submitBatchJob(jobName, parameters) {
        return this.embeddingBatchIntegration?.submitEmbeddingJob(jobName, parameters);
    }
    /**
     * Batchジョブ状況を取得（既存実装を保持）
     */
    getBatchJobStatus() {
        return this.embeddingBatchIntegration?.getJobStatus();
    }
    /**
     * Batch統合テスト実行（Phase 1未実装）
     */
    // public async runBatchIntegrationTest(testType: 'basic' | 'fsx' | 'recovery' = 'basic'): Promise<string | undefined> {
    //   if (!this.batchIntegrationTest) {
    //     return undefined;
    //   }
    //
    //   switch (testType) {
    //     case 'basic':
    //       return this.batchIntegrationTest.runBasicTest();
    //     case 'fsx':
    //       return this.batchIntegrationTest.runFsxMountTest();
    //     case 'recovery':
    //       return this.batchIntegrationTest.runAutoRecoveryTest();
    //     default:
    //       return this.batchIntegrationTest.runBasicTest();
    //   }
    // }
    /**
     * Embedding設定を取得（既存実装を保持）
     */
    getEmbeddingConfig() {
        return this.embeddingConfig;
    }
    /**
     * SQLite負荷試験ジョブを実行
     */
    submitSqliteLoadTestJob(jobName) {
        if (!this.sqliteLoadTest) {
            return undefined;
        }
        return this.sqliteLoadTest.submitJob(jobName);
    }
    /**
     * SQLite負荷試験統合情報を取得
     */
    getSqliteLoadTestInfo() {
        if (!this.sqliteLoadTest) {
            return undefined;
        }
        return {
            computeEnvironment: this.sqliteLoadTest.computeEnvironment.ref,
            jobQueue: this.sqliteLoadTest.jobQueue.ref,
            jobDefinition: this.sqliteLoadTest.jobDefinition.ref,
            logGroup: this.sqliteLoadTest.logGroup.logGroupName,
            scheduledRule: this.sqliteLoadTest.scheduledRule?.ruleArn,
        };
    }
    /**
     * Windows SQLite負荷試験情報を取得
     */
    getWindowsSqliteInfo() {
        if (!this.windowsSqlite) {
            return undefined;
        }
        return {
            instanceId: this.windowsSqlite.instance.instanceId,
            privateIp: this.windowsSqlite.instance.instancePrivateIp,
            bastionHostPublicIp: this.windowsSqlite.bastionHost?.instancePublicIp,
        };
    }
    /**
     * Bedrock Agent作成（Phase 4統合）
     * 最小限実装のため、一時的にコメントアウト
     */
    /*
    private createBedrockAgent(props: EmbeddingStackProps): BedrockAgentConstruct {
      // Agent Instruction取得
      const instruction = getAgentInstruction(props.agentInstructionPreset || 'standard');
  
      // Action Groups設定
      const actionGroups = props.documentSearchLambdaArn
        ? [
            {
              actionGroupName: 'document_search',
              description: '権限認識型文書検索',
              actionGroupExecutor: props.documentSearchLambdaArn,
              apiSchema: {
                payload: JSON.stringify(require('../../../lambda/bedrock-agent-actions/document-search-schema.json')),
              },
            },
          ]
        : undefined;
  
      return new BedrockAgentConstruct(this, 'BedrockAgent', {
        enabled: true,
        projectName: props.projectName,
        environment: props.environment,
        agentName: `${props.projectName}-${props.environment}-rag-agent`,
        agentDescription: '権限認識型RAGシステムのAIアシスタント',
        foundationModel: props.foundationModel || 'anthropic.claude-v2',
        instruction: instruction,
        knowledgeBaseArn: props.knowledgeBaseArn,
        actionGroups: actionGroups,
        idleSessionTTLInSeconds: 600,
        // Guardrails適用（Phase 5 - SecurityStackから取得）
        guardrailArn: props.guardrailArn,
        guardrailVersion: props.guardrailArn ? 'DRAFT' : undefined,
      });
    }
    */
    /**
     * CDKコンテキスト設定例を取得
     */
    static getContextExample(environment) {
        return {
            projectName: 'permission-aware-rag',
            environment,
            region: 'ap-northeast-1',
            // Embedding Batch設定
            'embedding:enableAwsBatch': true,
            'embedding:enableEcsOnEC2': false,
            'embedding:enableSpotFleet': false,
            'embedding:enableMonitoring': true,
            'embedding:enableAutoScaling': true,
            // Batch設定
            'embedding:batch:namePrefix': `${environment}-embedding-batch`,
            'embedding:batch:imageUri': `123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/embedding-server:${environment}`,
            'embedding:batch:vcpus': environment === 'prod' ? 4 : 2,
            'embedding:batch:memory': environment === 'prod' ? 8192 : 4096,
            'embedding:batch:useSpotInstances': environment !== 'prod',
            // Job Definition設定
            'embedding:jobDefinition:name': `${environment}-embedding-job-definition`,
            'embedding:jobDefinition:cpu': environment === 'prod' ? 4 : 2,
            'embedding:jobDefinition:memoryMiB': environment === 'prod' ? 8192 : 4096,
            'embedding:jobDefinition:timeoutHours': 1,
            'embedding:jobDefinition:retryAttempts': 3,
            // FSx統合設定
            'embedding:fsx:fileSystemId': 'fs-0123456789abcdef0',
            'embedding:fsx:cifsdataVolName': 'smb_share',
            'embedding:fsx:ragdbVolPath': '/smb_share/ragdb',
            // Active Directory設定
            'embedding:ad:domain': 'example.com',
            'embedding:ad:username': 'admin',
            'embedding:ad:passwordSecretArn': 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:ad-password-abc123',
            // Bedrock設定
            'embedding:bedrock:region': 'us-east-1',
            'embedding:bedrock:modelId': 'amazon.titan-embed-text-v1',
            // OpenSearch設定
            'embedding:openSearch:collectionName': `${environment}-embedding-collection`,
            'embedding:openSearch:indexName': 'documents',
            // 監視設定
            'embedding:monitoring:alerts:enabled': true,
            'embedding:monitoring:cloudWatch:createDashboard': true,
            'embedding:monitoring:xray:tracingEnabled': true,
            // Bedrock Agent設定（Phase 4）
            'useBedrockAgent': false, // デフォルト: Knowledge Baseモード
            'agentInstructionPreset': 'standard', // standard, financial, healthcare
            'foundationModel': 'anthropic.claude-v2',
        };
    }
}
exports.EmbeddingStack = EmbeddingStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW1iZWRkaW5nLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZW1iZWRkaW5nLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7O0dBU0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsa0JBQWtCO0FBQ2xCLGlEQUFtQztBQStFbkMsTUFBYSxjQUFlLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDM0Msc0JBQXNCO0lBQ3RCLDZDQUE2QztJQUU3QyxnQ0FBZ0M7SUFDaEIseUJBQXlCLENBQTZCO0lBQ3RFLCtEQUErRDtJQUMvQyxlQUFlLENBQW1CO0lBRWxELDZCQUE2QjtJQUNiLGNBQWMsQ0FBa0I7SUFDaEMsYUFBYSxDQUFpQjtJQUU5Qyx5QkFBeUI7SUFDVCxlQUFlLENBQTZDO0lBQzVELFVBQVUsQ0FBdUI7SUFDakMsYUFBYSxDQUEwQjtJQUV2RCxxQkFBcUI7SUFDTCxhQUFhLENBQTRCO0lBQ3pDLGlCQUFpQixDQUEyQjtJQUU1RCxpQ0FBaUM7SUFDakIsWUFBWSxDQUF5QjtJQUNyQyxRQUFRLENBQVU7SUFDbEIsYUFBYSxDQUFVO0lBRXZDLGtEQUFrRDtJQUNsQyxZQUFZLENBQVU7SUFFdEMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUEwQjtRQUNsRSxPQUFPLENBQUMsR0FBRyxDQUFDLDRCQUE0QixDQUFDLENBQUM7UUFDMUMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDeEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBRWhDLE9BQU8sQ0FBQyxHQUFHLENBQUMsMkJBQTJCLENBQUMsQ0FBQztRQUN6QyxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUUvQixtQkFBbUI7UUFDbkIsSUFBSSxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDZCxPQUFPLENBQUMsR0FBRyxDQUFDLGFB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MEJBQTBCLEVBQUUsV0FBVztZQUN2QywyQkFBMkIsRUFBRSw0QkFBNEI7WUFFekQsZUFBZTtZQUNmLHFDQUFxQyxFQUFFLEdBQUcsV0FBVyx1QkFBdUI7WUFDNUUsZ0NBQWdDLEVBQUUsV0FBVztZQUU3QyxPQUFPO1lBQ1AscUNBQXFDLEVBQUUsSUFBSTtZQUMzQyxpREFBaUQsRUFBRSxJQUFJO1lBQ3ZELDBDQUEwQyxFQUFFLElBQUk7WUFFaEQsMkJBQTJCO1lBQzNCLGlCQUFpQixFQUFFLEtBQUssRUFBRywyQkFBMkI7WUFDdEQsd0JBQXdCLEVBQUUsVUFBVSxFQUFHLGtDQUFrQztZQUN6RSxpQkFBaUIsRUFBRSxxQkFBcUI7U0FDekMsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQTl2QkQsd0NBOHZCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog57Wx5ZCIRW1iZWRkaW5n44K544K/44OD44KvXG4gKiBcbiAqIOODouOCuOODpeODqeODvOOCouODvOOCreODhuOCr+ODgeODo+OBq+WfuuOBpeOBj0VtYmVkZGluZ+ODu0FJ57Wx5ZCI566h55CGXG4gKiAtIExhbWJkYSDplqLmlbDvvIhFbWJlZGRpbmflh6bnkIbvvIlcbiAqIC0gQUkvTUwg44K144O844OT44K5IChCZWRyb2NrKVxuICogLSDjg5Djg4Pjg4Hlh6bnkIbvvIhBV1MgQmF0Y2jvvIlcbiAqIC0g44Kz44Oz44OG44OK44K144O844OT44K5IChFQ1MpXG4gKiAtIOe1seS4gOWRveWQjeimj+WJhzogQ29tcG9uZW50PVwiRW1iZWRkaW5nXCJcbiAqL1xuXG4vLyBBV1MgQ0RLIOOCs+OCouODqeOCpOODluODqeODqlxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG4vLyDjg6Ljgrjjg6Xjg7zjg6vmp4vmiJDopoHntKBcbi8vIGltcG9ydCB7IEFJQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9haS9jb25zdHJ1Y3RzL2FpLWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBCZWRyb2NrQWdlbnRDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi9tb2R1bGVzL2FpL2NvbnN0cnVjdHMvYmVkcm9jay1hZ2VudC1jb25zdHJ1Y3QnO1xuaW1wb3J0IHsgRW1iZWRkaW5nQmF0Y2hJbnRlZ3JhdGlvbiB9IGZyb20gJy4uLy4uL21vZHVsZXMvZW1iZWRkaW5nL2NvbnN0cnVjdHMvZW1iZWRkaW5nLWJhdGNoLWludGVncmF0aW9uJztcbi8vIGltcG9ydCB7IEJhdGNoSW50ZWdyYXRpb25UZXN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9lbWJlZGRpbmcvY29uc3RydWN0cy9iYXRjaC1pbnRlZ3JhdGlvbi10ZXN0JztcbmltcG9ydCB7IFNxbGl0ZUxvYWRUZXN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9lbWJlZGRpbmcvY29uc3RydWN0cy9zcWxpdGUtbG9hZC10ZXN0JztcbmltcG9ydCB7IFdpbmRvd3NTcWxpdGUgfSBmcm9tICcuLi8uLi9tb2R1bGVzL2VtYmVkZGluZy9jb25zdHJ1Y3RzL3dpbmRvd3Mtc3FsaXRlJztcbmltcG9ydCB7IGdldEFnZW50SW5zdHJ1Y3Rpb24gfSBmcm9tICcuLi8uLi9tb2R1bGVzL2FpL3Byb21wdHMvYWdlbnQtaW5zdHJ1Y3Rpb24nO1xuXG4vLyDjgqTjg7Pjgr/jg7zjg5Xjgqfjg7zjgrnjg7voqK3lrppcbmltcG9ydCB7IEFpQ29uZmlnIH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9haS9pbnRlcmZhY2VzL2FpLWNvbmZpZyc7XG5pbXBvcnQgeyBFbWJlZGRpbmdDb25maWcgfSBmcm9tICcuLi8uLi9tb2R1bGVzL2FpL2ludGVyZmFjZXMvZW1iZWRkaW5nLWNvbmZpZyc7XG5pbXBvcnQgeyBFbWJlZGRpbmdDb21tb25SZXNvdXJjZXMgfSBmcm9tICcuLi8uLi9tb2R1bGVzL2VtYmVkZGluZy9pbnRlcmZhY2VzL21vZHVsZS1pbnRlcmZhY2VzJztcblxuLy8g6Kit5a6a44OV44Kh44Kv44OI44Oq44O844O75oim55Wl77yI5LiA5pmC55qE44Gr44Kz44Oh44Oz44OI44Ki44Km44OI77yJXG4vLyBpbXBvcnQgeyBFbWJlZGRpbmdDb25maWdGYWN0b3J5IH0gZnJvbSAnLi4vLi4vY29uZmlnL2Vudmlyb25tZW50cy9lbWJlZGRpbmctY29uZmlnLWZhY3RvcnknO1xuaW1wb3J0IHsgVGFnZ2luZ1N0cmF0ZWd5LCBQZXJtaXNzaW9uQXdhcmVSQUdUYWdzIH0gZnJvbSAnLi4vLi4vY29uZmlnL3RhZ2dpbmctY29uZmlnJztcblxuZXhwb3J0IGludGVyZmFjZSBFbWJlZGRpbmdTdGFja0NvbmZpZyB7XG4gIHJlYWRvbmx5IGFpPzogYW55O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEVtYmVkZGluZ1N0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHJlYWRvbmx5IGNvbmZpZzogRW1iZWRkaW5nU3RhY2tDb25maWc7IC8vIOWei+WuieWFqOOBque1seWQiOioreWumuOCquODluOCuOOCp+OCr+ODiFxuICByZWFkb25seSBwcm9qZWN0TmFtZTogc3RyaW5nOyAvLyDjg5fjg63jgrjjgqfjgq/jg4jlkI3vvIjjgrPjgrnjg4jphY3luIPnlKjvvIlcbiAgcmVhZG9ubHkgZW52aXJvbm1lbnQ6IHN0cmluZzsgLy8g55Kw5aKD5ZCN77yI44Kz44K544OI6YWN5biD55So77yJXG4gIHJlYWRvbmx5IHZwYz86IGFueTsgLy8gVlBD77yITmV0d29ya2luZ1N0YWNr44GL44KJ77yJXG4gIHJlYWRvbmx5IHByaXZhdGVTdWJuZXRJZHM/OiBzdHJpbmdbXTsgLy8g44OX44Op44Kk44OZ44O844OI44K144OW44ON44OD44OISURcbiAgcmVhZG9ubHkgcHVibGljU3VibmV0SWRzPzogc3RyaW5nW107IC8vIOODkeODluODquODg+OCr+OCteODluODjeODg+ODiElEXG4gIHJlYWRvbmx5IHMzQnVja2V0TmFtZXM/OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9OyAvLyBTM+ODkOOCseODg+ODiOWQje+8iERhdGFTdGFja+OBi+OCie+8iVxuICBcbiAgLy8g5pen44OX44Ot44OR44OG44Kj77yI5b6M5pa55LqS5o+b5oCn44Gu44Gf44KB5L+d5oyB77yJXG4gIGFpQ29uZmlnPzogQWlDb25maWc7XG4gIGVtYmVkZGluZ0NvbmZpZz86IEVtYmVkZGluZ0NvbmZpZztcbiAgdnBjSWQ/OiBzdHJpbmc7XG4gIHNlY3VyaXR5R3JvdXBJZHM/OiBzdHJpbmdbXTtcbiAga21zS2V5QXJuPzogc3RyaW5nO1xuICBzM0J1Y2tldEFybnM/OiBzdHJpbmdbXTtcbiAgZHluYW1vRGJUYWJsZUFybnM/OiBzdHJpbmdbXTtcbiAgb3BlblNlYXJjaENvbGxlY3Rpb25Bcm4/OiBzdHJpbmc7XG4gIFxuICAvLyDmlrDjgZfjgYRFbWJlZGRpbmfoqK3lrppcbiAgZW5hYmxlQmF0Y2hJbnRlZ3JhdGlvbj86IGJvb2xlYW47XG4gIGVuYWJsZUJhdGNoVGVzdGluZz86IGJvb2xlYW47XG4gIGltYWdlUGF0aD86IHN0cmluZztcbiAgaW1hZ2VUYWc/OiBzdHJpbmc7XG4gIFxuICAvLyBTUUxpdGXosqDojbfoqabpqJPoqK3lrppcbiAgZW5hYmxlU3FsaXRlTG9hZFRlc3Q/OiBib29sZWFuO1xuICBlbmFibGVXaW5kb3dzTG9hZFRlc3Q/OiBib29sZWFuO1xuICBmc3hGaWxlU3lzdGVtSWQ/OiBzdHJpbmc7XG4gIGZzeFN2bUlkPzogc3RyaW5nO1xuICBmc3hWb2x1bWVJZD86IHN0cmluZztcbiAgZnN4TW91bnRQYXRoPzogc3RyaW5nO1xuICBmc3hOZnNFbmRwb2ludD86IHN0cmluZztcbiAgZnN4Q2lmc0VuZHBvaW50Pzogc3RyaW5nO1xuICBmc3hDaWZzU2hhcmVOYW1lPzogc3RyaW5nO1xuICBrZXlQYWlyTmFtZT86IHN0cmluZztcbiAgYmVkcm9ja1JlZ2lvbj86IHN0cmluZztcbiAgYmVkcm9ja01vZGVsSWQ/OiBzdHJpbmc7XG4gIHNjaGVkdWxlRXhwcmVzc2lvbj86IHN0cmluZztcbiAgbWF4dkNwdXM/OiBudW1iZXI7XG4gIGluc3RhbmNlVHlwZXM/OiBzdHJpbmdbXTtcbiAgd2luZG93c0luc3RhbmNlVHlwZT86IHN0cmluZztcbiAgXG4gIC8vIEJlZHJvY2sgQWdlbnToqK3lrprvvIhQaGFzZSA057Wx5ZCI77yJXG4gIHVzZUJlZHJvY2tBZ2VudD86IGJvb2xlYW47XG4gIGtub3dsZWRnZUJhc2VBcm4/OiBzdHJpbmc7XG4gIGRvY3VtZW50U2VhcmNoTGFtYmRhQXJuPzogc3RyaW5nO1xuICBhZ2VudEluc3RydWN0aW9uUHJlc2V0PzogJ3N0YW5kYXJkJyB8ICdmaW5hbmNpYWwnIHwgJ2hlYWx0aGNhcmUnO1xuICBmb3VuZGF0aW9uTW9kZWw/OiBzdHJpbmc7XG4gIFxuICAvLyBCZWRyb2NrIEd1YXJkcmFpbHPoqK3lrprvvIhQaGFzZSA1IC0gU2VjdXJpdHlTdGFja+OBi+OCieWPluW+l++8iVxuICBndWFyZHJhaWxBcm4/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBFbWJlZGRpbmdTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIC8vIEFJL01M57Wx5ZCI77yIUGhhc2UgMeacquWun+ijhe+8iVxuICAvLyBwdWJsaWMgcmVhZG9ubHkgYWlDb25zdHJ1Y3Q/OiBBSUNvbnN0cnVjdDtcbiAgXG4gIC8vIEVtYmVkZGluZyBCYXRjaOe1seWQiO+8iFBoYXNlIDHmnKrlrp/oo4XvvIlcbiAgcHVibGljIHJlYWRvbmx5IGVtYmVkZGluZ0JhdGNoSW50ZWdyYXRpb24/OiBFbWJlZGRpbmdCYXRjaEludGVncmF0aW9uO1xuICAvLyBwdWJsaWMgcmVhZG9ubHkgYmF0Y2hJbnRlZ3JhdGlvblRlc3Q/OiBCYXRjaEludGVncmF0aW9uVGVzdDtcbiAgcHVibGljIHJlYWRvbmx5IGVtYmVkZGluZ0NvbmZpZz86IEVtYmVkZGluZ0NvbmZpZztcbiAgXG4gIC8vIFNRTGl0ZeiyoOiNt+ippumok+OCs+ODs+OCueODiOODqeOCr+ODiO+8iOaXouWtmOWun+ijheOCkuS/neaMge+8iVxuICBwdWJsaWMgcmVhZG9ubHkgc3FsaXRlTG9hZFRlc3Q/OiBTcWxpdGVMb2FkVGVzdDtcbiAgcHVibGljIHJlYWRvbmx5IHdpbmRvd3NTcWxpdGU/OiBXaW5kb3dzU3FsaXRlO1xuICBcbiAgLy8gRW1iZWRkaW5n44Oq44K944O844K577yI5pei5a2Y5a6f6KOF44KS5L+d5oyB77yJXG4gIHB1YmxpYyByZWFkb25seSBsYW1iZGFGdW5jdGlvbnM6IHsgW2tleTogc3RyaW5nXTogY2RrLmF3c19sYW1iZGEuRnVuY3Rpb24gfTtcbiAgcHVibGljIHJlYWRvbmx5IGVjc0NsdXN0ZXI/OiBjZGsuYXdzX2Vjcy5DbHVzdGVyO1xuICBwdWJsaWMgcmVhZG9ubHkgYmF0Y2hKb2JRdWV1ZT86IGNkay5hd3NfYmF0Y2guSm9iUXVldWU7XG4gIFxuICAvLyBBSS9NTOODquOCveODvOOCue+8iOaXouWtmOWun+ijheOCkuS/neaMge+8iVxuICBwdWJsaWMgcmVhZG9ubHkgYmVkcm9ja01vZGVsczogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfTtcbiAgcHVibGljIHJlYWRvbmx5IGVtYmVkZGluZ0Z1bmN0aW9uPzogY2RrLmF3c19sYW1iZGEuRnVuY3Rpb247XG4gIFxuICAvLyBCZWRyb2NrIEFnZW5077yIUGhhc2UgNOe1seWQiCAtIOaWsOapn+iDve+8iVxuICBwdWJsaWMgcmVhZG9ubHkgYmVkcm9ja0FnZW50PzogQmVkcm9ja0FnZW50Q29uc3RydWN0O1xuICBwdWJsaWMgcmVhZG9ubHkgYWdlbnRBcm4/OiBzdHJpbmc7XG4gIHB1YmxpYyByZWFkb25seSBhZ2VudEFsaWFzQXJuPzogc3RyaW5nO1xuICBcbiAgLy8gQmVkcm9jayBHdWFyZHJhaWxz77yIUGhhc2UgNSAtIFNlY3VyaXR5U3RhY2vjgYvjgonlj5blvpfvvIlcbiAgcHVibGljIHJlYWRvbmx5IGd1YXJkcmFpbEFybj86IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogRW1iZWRkaW5nU3RhY2tQcm9wcykge1xuICAgIGNvbnNvbGUubG9nKCfwn5SnIOOCs+ODs+OCueODiOODqeOCr+OCv+mWi+Wnizogc3VwZXIoKeWRvOOBs+WHuuOBl+WJjScpO1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuICAgIGNvbnNvbGUubG9nKCfwn5SnIHN1cGVyKCnlkbzjgbPlh7rjgZflrozkuoYnKTtcblxuICAgIGNvbnNvbGUubG9nKCfwn6SWIEVtYmVkZGluZ1N0YWNr5Yid5pyf5YyW6ZaL5aeLLi4uJyk7XG4gICAgY29uc29sZS5sb2coYPCfk50g44K544K/44OD44Kv5ZCNOiAke2lkfWApO1xuICAgIFxuICAgIC8vIFZQQ+OBqOOCteODluODjeODg+ODiOaDheWgseOBruODreOCsOWHuuWKm1xuICAgIGlmIChwcm9wcy52cGMpIHtcbiAgICAgIGNvbnNvbGUubG9nKGDwn5OhIFZQQ+aDheWgsTogJHtwcm9wcy52cGMudnBjSWQgfHwgJ1ZQQ+OCquODluOCuOOCp+OCr+ODiCd9YCk7XG4gICAgfVxuICAgIGlmIChwcm9wcy5wcml2YXRlU3VibmV0SWRzKSB7XG4gICAgICBjb25zb2xlLmxvZyhg8J+UkiBQcml2YXRlIFN1Ym5ldHM6ICR7cHJvcHMucHJpdmF0ZVN1Ym5ldElkcy5qb2luKCcsICcpfWApO1xuICAgIH1cbiAgICBpZiAocHJvcHMucHVibGljU3VibmV0SWRzKSB7XG4gICAgICBjb25zb2xlLmxvZyhg8J+MkCBQdWJsaWMgU3VibmV0czogJHtwcm9wcy5wdWJsaWNTdWJuZXRJZHMuam9pbignLCAnKX1gKTtcbiAgICB9XG4gICAgaWYgKHByb3BzLnMzQnVja2V0TmFtZXMpIHtcbiAgICAgIGNvbnNvbGUubG9nKGDwn6qjIFMzIEJ1Y2tldHM6ICR7T2JqZWN0LmtleXMocHJvcHMuczNCdWNrZXROYW1lcykuam9pbignLCAnKX1gKTtcbiAgICB9XG5cbiAgICAvLyDjgrPjgrnjg4jphY3luIPjgr/jgrDjga7pgannlKjvvIhBV1MgQmF0Y2jlsILnlKjjgr/jgrDjgpLlkKvjgoDvvIlcbiAgICAvLyDmnIDlsI/pmZDlrp/oo4Xjga7jgZ/jgoHjgIHkuIDmmYLnmoTjgavjgrnjgq3jg4Pjg5dcbiAgICAvKlxuICAgIGNvbnN0IHRhZ2dpbmdDb25maWcgPSBQZXJtaXNzaW9uQXdhcmVSQUdUYWdzLmdldFN0YW5kYXJkQ29uZmlnKFxuICAgICAgcHJvcHMucHJvamVjdE5hbWUsXG4gICAgICBwcm9wcy5lbnZpcm9ubWVudFxuICAgICk7XG4gICAgVGFnZ2luZ1N0cmF0ZWd5LmFwcGx5VGFnc1RvU3RhY2sodGhpcywgdGFnZ2luZ0NvbmZpZyk7XG4gICAgKi9cblxuICAgIC8vIHByb3Bz44Gu5YiG6Kej5Luj5YWl77yI5pyA5bCP6ZmQ5a6f6KOF44Gu44Gf44KB44CB5LiA5pmC55qE44Gr44K544Kt44OD44OX77yJXG4gICAgLypcbiAgICBjb25zdCB7IFxuICAgICAgYWlDb25maWcsIFxuICAgICAgZW1iZWRkaW5nQ29uZmlnLFxuICAgICAgcHJvamVjdE5hbWUsIFxuICAgICAgZW52aXJvbm1lbnQsXG4gICAgICB2cGNJZCxcbiAgICAgIHByaXZhdGVTdWJuZXRJZHMsXG4gICAgICBzZWN1cml0eUdyb3VwSWRzLFxuICAgICAga21zS2V5QXJuLFxuICAgICAgczNCdWNrZXRBcm5zLFxuICAgICAgZHluYW1vRGJUYWJsZUFybnMsXG4gICAgICBvcGVuU2VhcmNoQ29sbGVjdGlvbkFybixcbiAgICAgIGVuYWJsZUJhdGNoSW50ZWdyYXRpb24gPSBmYWxzZSwgLy8g44OH44OV44Kp44Or44OIZmFsc2XjgavlpInmm7TvvIjmnIDlsI/pmZDlrp/oo4XvvIlcbiAgICAgIGVuYWJsZUJhdGNoVGVzdGluZyA9IGZhbHNlLFxuICAgICAgaW1hZ2VQYXRoID0gJ2VtYmVkZGluZy1zZXJ2ZXInLFxuICAgICAgaW1hZ2VUYWcgPSAnbGF0ZXN0JyxcbiAgICAgIC8vIFNRTGl0ZeiyoOiNt+ippumok+ioreWumlxuICAgICAgZW5hYmxlU3FsaXRlTG9hZFRlc3QgPSBmYWxzZSxcbiAgICAgIGVuYWJsZVdpbmRvd3NMb2FkVGVzdCA9IGZhbHNlLFxuICAgICAgZnN4RmlsZVN5c3RlbUlkLFxuICAgICAgZnN4U3ZtSWQsXG4gICAgICBmc3hWb2x1bWVJZCxcbiAgICAgIGZzeE1vdW50UGF0aCxcbiAgICAgIGZzeE5mc0VuZHBvaW50LFxuICAgICAgZnN4Q2lmc0VuZHBvaW50LFxuICAgICAgZnN4Q2lmc1NoYXJlTmFtZSxcbiAgICAgIGtleVBhaXJOYW1lLFxuICAgICAgYmVkcm9ja1JlZ2lvbixcbiAgICAgIGJlZHJvY2tNb2RlbElkLFxuICAgICAgc2NoZWR1bGVFeHByZXNzaW9uLFxuICAgICAgbWF4dkNwdXMsXG4gICAgICBpbnN0YW5jZVR5cGVzLFxuICAgICAgd2luZG93c0luc3RhbmNlVHlwZVxuICAgIH0gPSBwcm9wcztcbiAgICAqL1xuXG4gICAgY29uc29sZS5sb2coJ/Cfk50gU3RlcCAxOiBFbWJlZGRpbmfoqK3lrprjga7liJ3mnJ/ljJYnKTtcbiAgICAvLyBFbWJlZGRpbmfoqK3lrprjga7liJ3mnJ/ljJbvvIjml6LlrZjlrp/oo4XjgpLkv53mjIHvvIlcbiAgICAvLyBFbWJlZGRpbmdDb25maWdGYWN0b3J544Gv5L6d5a2Y6Zai5L+C44Gu5ZWP6aGM44GM44GC44KL44Gf44KB44CBcHJvcHPjgYvjgonnm7TmjqXlj5blvpdcbiAgICB0aGlzLmVtYmVkZGluZ0NvbmZpZyA9IHByb3BzLmVtYmVkZGluZ0NvbmZpZztcbiAgICBcbiAgICBjb25zb2xlLmxvZygn8J+TnSBTdGVwIDI6IEVtYmVkZGluZ0NvbnN0cnVjdOWIneacn+WMlicpO1xuICAgIGNvbnNvbGUubG9nKCfwn6egIEVtYmVkZGluZ0NvbnN0cnVjdOWIneacn+WMlumWi+Wniy4uLicpO1xuICAgIGNvbnNvbGUubG9nKCdFbWJlZGRpbmdDb25zdHJ1Y3QgaW5pdGlhbGl6ZWQgKHN0dWIpJyk7XG4gICAgY29uc29sZS5sb2coJ+KchSBFbWJlZGRpbmdDb25zdHJ1Y3TliJ3mnJ/ljJblrozkuoYnKTtcbiAgICBcbiAgICAvLyDlhbHpgJrjg6rjgr3jg7zjgrnoqK3lrprvvIjml6LlrZjlrp/oo4XjgpLkv53mjIHvvIlcbiAgICAvLyDmnIDlsI/pmZDlrp/oo4Xjga7jgZ/jgoHjgIHkuIDmmYLnmoTjgavjgrnjgq3jg4Pjg5dcbiAgICAvLyBjb25zdCBjb21tb25SZXNvdXJjZXM6IEVtYmVkZGluZ0NvbW1vblJlc291cmNlcyA9IHRoaXMuY3JlYXRlQ29tbW9uUmVzb3VyY2VzKHByb3BzKTtcbiAgICBcbiAgICAvLyBBSSBFbWJlZGRpbmfjgrPjg7Pjgrnjg4jjg6njgq/jg4jkvZzmiJDvvIjml6LlrZjlrp/oo4XjgpLkv53mjIEgLSDjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICAvLyBBSUNvbnN0cnVjdOOBr+S+neWtmOmWouS/guOBruWVj+mhjOOBjOOBguOCi+OBn+OCgeOAgeS4gOaZgueahOOBq+OCueOCreODg+ODl1xuICAgIC8vIGlmIChhaUNvbmZpZykge1xuICAgIC8vICAgdHJ5IHtcbiAgICAvLyAgICAgLy8gICAgIHRoaXMuYWlDb25zdHJ1Y3QgPSBuZXcgQUlDb25zdHJ1Y3QodGhpcywgJ0VtYmVkZGluZ0FpQ29uc3RydWN0JywgeyAgLy8gUGhhc2UgMeacquWun+ijhVxuICAgIC8vICAgICAgIGNvbmZpZzogYWlDb25maWcsXG4gICAgLy8gICAgICAgcHJvamVjdE5hbWUsXG4gICAgLy8gICAgICAgZW52aXJvbm1lbnQsXG4gICAgLy8gICAgICAga21zS2V5OiBrbXNLZXlBcm4sXG4gICAgLy8gICAgIH0pO1xuICAgIC8vICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAvLyAgICAgY29uc29sZS53YXJuKCdBSUNvbnN0cnVjdOWIneacn+WMluOCkuOCueOCreODg+ODlzonLCBlcnJvcik7XG4gICAgLy8gICB9XG4gICAgLy8gfVxuXG4gICAgLy8gQVdTIEJhdGNo57Wx5ZCI77yI5pei5a2Y5a6f6KOF44KS5L+d5oyBIC0g44Kq44OX44K344On44Oz77yJXG4gICAgLy8gRW1iZWRkaW5nQ29uZmln44Gu5Z6L44Gu5ZWP6aGM44GM44GC44KL44Gf44KB44CB5LiA5pmC55qE44Gr44K544Kt44OD44OXXG4gICAgLy8gaWYgKGVuYWJsZUJhdGNoSW50ZWdyYXRpb24gJiYgdGhpcy5lbWJlZGRpbmdDb25maWc/LmF3c0JhdGNoPy5lbmFibGVkKSB7XG4gICAgLy8gICB0cnkge1xuICAgIC8vICAgICB0aGlzLmVtYmVkZGluZ0JhdGNoSW50ZWdyYXRpb24gPSBuZXcgRW1iZWRkaW5nQmF0Y2hJbnRlZ3JhdGlvbih0aGlzLCAnRW1iZWRkaW5nQmF0Y2hJbnRlZ3JhdGlvbicsIHtcbiAgICAvLyAgICAgICBjb25maWc6IHRoaXMuZW1iZWRkaW5nQ29uZmlnLFxuICAgIC8vICAgICAgIHByb2plY3ROYW1lLFxuICAgIC8vICAgICAgIGVudmlyb25tZW50LFxuICAgIC8vICAgICAgIGNvbW1vblJlc291cmNlcyxcbiAgICAvLyAgICAgICBpbWFnZVBhdGgsXG4gICAgLy8gICAgICAgaW1hZ2VUYWcsXG4gICAgLy8gICAgIH0pO1xuICAgIC8vICAgICBpZiAoZW5hYmxlQmF0Y2hUZXN0aW5nKSB7XG4gICAgLy8gICAgIC8vICAgICAgIHRoaXMuYmF0Y2hJbnRlZ3JhdGlvblRlc3QgPSBuZXcgQmF0Y2hJbnRlZ3JhdGlvblRlc3QodGhpcywgJ0JhdGNoSW50ZWdyYXRpb25UZXN0JywgeyAgLy8gUGhhc2UgMeacquWun+ijhVxuICAgIC8vICAgICAgICAgYmF0Y2hJbnRlZ3JhdGlvbjogdGhpcy5lbWJlZGRpbmdCYXRjaEludGVncmF0aW9uLFxuICAgIC8vICAgICAgICAgY29uZmlnOiB0aGlzLmVtYmVkZGluZ0NvbmZpZyxcbiAgICAvLyAgICAgICAgIHByb2plY3ROYW1lLFxuICAgIC8vICAgICAgICAgZW52aXJvbm1lbnQsXG4gICAgLy8gICAgICAgICBub3RpZmljYXRpb25Ub3BpY0FybjogdGhpcy5lbWJlZGRpbmdDb25maWcubW9uaXRvcmluZz8uYWxlcnRzPy5zbnNUb3BpY0FybixcbiAgICAvLyAgICAgICB9KTtcbiAgICAvLyAgICAgfVxuICAgIC8vICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAvLyAgICAgY29uc29sZS53YXJuKCdCYXRjaOe1seWQiOOBruWIneacn+WMluOCkuOCueOCreODg+ODlzonLCBlcnJvcik7XG4gICAgLy8gICB9XG4gICAgLy8gfVxuXG4gICAgLy8gU1FMaXRl6LKg6I236Kmm6aiT57Wx5ZCI77yI5pei5a2Y5a6f6KOF44KS5L+d5oyBIC0g44Kq44OX44K344On44Oz77yJXG4gICAgLy8g5pyA5bCP6ZmQ5a6f6KOF44Gu44Gf44KB44CB5LiA5pmC55qE44Gr44K544Kt44OD44OXXG4gICAgLypcbiAgICBpZiAoZW5hYmxlU3FsaXRlTG9hZFRlc3QgJiYgZnN4RmlsZVN5c3RlbUlkICYmIGZzeFN2bUlkICYmIGZzeFZvbHVtZUlkKSB7XG4gICAgICB0cnkge1xuICAgICAgICB0aGlzLnNxbGl0ZUxvYWRUZXN0ID0gbmV3IFNxbGl0ZUxvYWRUZXN0KHRoaXMsICdTcWxpdGVMb2FkVGVzdCcsIHtcbiAgICAgICAgICBwcm9qZWN0TmFtZSxcbiAgICAgICAgICBlbnZpcm9ubWVudCxcbiAgICAgICAgICB2cGM6IGNvbW1vblJlc291cmNlcy52cGMudnBjLFxuICAgICAgICAgIHByaXZhdGVTdWJuZXRzOiBjb21tb25SZXNvdXJjZXMudnBjLnByaXZhdGVTdWJuZXRzLFxuICAgICAgICAgIHNlY3VyaXR5R3JvdXA6IGNvbW1vblJlc291cmNlcy5zZWN1cml0eUdyb3Vwcy5jb21tb25TZWN1cml0eUdyb3VwLFxuICAgICAgICAgIGZzeEZpbGVTeXN0ZW1JZCxcbiAgICAgICAgICBmc3hTdm1JZCxcbiAgICAgICAgICBmc3hWb2x1bWVJZCxcbiAgICAgICAgICBmc3hNb3VudFBhdGg6IGZzeE1vdW50UGF0aCB8fCAnL3NxbGl0ZS1sb2FkLXRlc3QnLFxuICAgICAgICAgIGZzeE5mc0VuZHBvaW50OiBmc3hOZnNFbmRwb2ludCB8fCBgJHtmc3hTdm1JZH0uJHtmc3hGaWxlU3lzdGVtSWR9LmZzeC4ke3RoaXMucmVnaW9ufS5hbWF6b25hd3MuY29tYCxcbiAgICAgICAgICBiZWRyb2NrUmVnaW9uOiBiZWRyb2NrUmVnaW9uIHx8IHRoaXMucmVnaW9uLFxuICAgICAgICAgIGJlZHJvY2tNb2RlbElkOiBiZWRyb2NrTW9kZWxJZCB8fCAnYW1hem9uLnRpdGFuLWVtYmVkLXRleHQtdjEnLFxuICAgICAgICAgIHNjaGVkdWxlRXhwcmVzc2lvbjogc2NoZWR1bGVFeHByZXNzaW9uIHx8ICdjcm9uKDAgMiAqICogPyAqKScsXG4gICAgICAgICAgZW5hYmxlU2NoZWR1bGVkRXhlY3V0aW9uOiB0cnVlLFxuICAgICAgICAgIG1heHZDcHVzOiBtYXh2Q3B1cyB8fCAyMCxcbiAgICAgICAgICBpbnN0YW5jZVR5cGVzOiBpbnN0YW5jZVR5cGVzIHx8IFsnbTUubGFyZ2UnLCAnbTUueGxhcmdlJ10sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFdpbmRvd3MgU1FMaXRl6LKg6I236Kmm6aiT77yI5pei5a2Y5a6f6KOF44KS5L+d5oyBIC0g44Kq44OX44K344On44Oz77yJXG4gICAgICAgIGlmIChlbmFibGVXaW5kb3dzTG9hZFRlc3QgJiYga2V5UGFpck5hbWUgJiYgZnN4Q2lmc0VuZHBvaW50ICYmIGZzeENpZnNTaGFyZU5hbWUpIHtcbiAgICAgICAgICB0aGlzLndpbmRvd3NTcWxpdGUgPSBuZXcgV2luZG93c1NxbGl0ZSh0aGlzLCAnV2luZG93c1NxbGl0ZScsIHtcbiAgICAgICAgICAgIHByb2plY3ROYW1lLFxuICAgICAgICAgICAgZW52aXJvbm1lbnQsXG4gICAgICAgICAgICB2cGM6IGNvbW1vblJlc291cmNlcy52cGMudnBjLFxuICAgICAgICAgICAgcHJpdmF0ZVN1Ym5ldDogY29tbW9uUmVzb3VyY2VzLnZwYy5wcml2YXRlU3VibmV0c1swXSxcbiAgICAgICAgICAgIHNlY3VyaXR5R3JvdXA6IGNvbW1vblJlc291cmNlcy5zZWN1cml0eUdyb3Vwcy5jb21tb25TZWN1cml0eUdyb3VwLFxuICAgICAgICAgICAga2V5UGFpck5hbWUsXG4gICAgICAgICAgICBmc3hGaWxlU3lzdGVtSWQsXG4gICAgICAgICAgICBmc3hTdm1JZCxcbiAgICAgICAgICAgIGZzeFZvbHVtZUlkLFxuICAgICAgICAgICAgZnN4TW91bnRQYXRoOiBmc3hNb3VudFBhdGggfHwgJy9zcWxpdGUtbG9hZC10ZXN0JyxcbiAgICAgICAgICAgIGZzeENpZnNFbmRwb2ludCxcbiAgICAgICAgICAgIGZzeENpZnNTaGFyZU5hbWUsXG4gICAgICAgICAgICBpbnN0YW5jZVR5cGU6IHdpbmRvd3NJbnN0YW5jZVR5cGUgfHwgJ3QzLm1lZGl1bScsXG4gICAgICAgICAgICBlbmFibGVEZXRhaWxlZE1vbml0b3Jpbmc6IGVudmlyb25tZW50ID09PSAncHJvZCcsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignU1FMaXRl6LKg6I236Kmm6aiT57Wx5ZCI44Gu5Yid5pyf5YyW44KS44K544Kt44OD44OXOicsIGVycm9yKTtcbiAgICAgICAgLy8gU1FMaXRl6LKg6I236Kmm6aiT44Gu5Yid5pyf5YyW44Gr5aSx5pWX44GX44Gm44KC44K544K/44OD44Kv5YWo5L2T44Gv57aZ57aaXG4gICAgICB9XG4gICAgfVxuICAgICovXG5cbiAgICAvLyBCZWRyb2NrIEFnZW5057Wx5ZCI77yIUGhhc2UgNCAtIOacieWKueWMluOBleOCjOOBpuOBhOOCi+WgtOWQiO+8iVxuICAgIC8vIOacgOWwj+mZkOWun+ijheOBruOBn+OCgeOAgeS4gOaZgueahOOBq+OCueOCreODg+ODl1xuICAgIC8qXG4gICAgY29uc3QgdXNlQmVkcm9ja0FnZW50ID0gdGhpcy5ub2RlLnRyeUdldENvbnRleHQoJ3VzZUJlZHJvY2tBZ2VudCcpID8/IHByb3BzLnVzZUJlZHJvY2tBZ2VudCA/PyBmYWxzZTtcbiAgICBpZiAodXNlQmVkcm9ja0FnZW50KSB7XG4gICAgICB0aGlzLmJlZHJvY2tBZ2VudCA9IHRoaXMuY3JlYXRlQmVkcm9ja0FnZW50KHByb3BzKTtcbiAgICAgIHRoaXMuYWdlbnRBcm4gPSB0aGlzLmJlZHJvY2tBZ2VudC5hZ2VudEFybjtcbiAgICAgIHRoaXMuYWdlbnRBbGlhc0FybiA9IHRoaXMuYmVkcm9ja0FnZW50LmFnZW50QWxpYXNBcm47XG4gICAgfVxuICAgICovXG5cbiAgICBjb25zb2xlLmxvZygn8J+TnSBTdGVwIDM6IOS4u+imgeODquOCveODvOOCueOBruWPgueFp+OCkuioreWumicpO1xuICAgIC8vIOS4u+imgeODquOCveODvOOCueOBruWPgueFp+OCkuioreWumu+8iOaXouWtmOWun+ijheOCkuS/neaMge+8iVxuICAgIHRoaXMubGFtYmRhRnVuY3Rpb25zID0ge307XG4gICAgdGhpcy5lY3NDbHVzdGVyID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuYmF0Y2hKb2JRdWV1ZSA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmJlZHJvY2tNb2RlbHMgPSB7fTtcbiAgICB0aGlzLmVtYmVkZGluZ0Z1bmN0aW9uID0gdW5kZWZpbmVkO1xuXG4gICAgLy8g5pyA5bCP6ZmQ44GuRW1iZWRkaW5nIExhbWJkYemWouaVsOOCkuS9nOaIkFxuICAgIGNvbnN0IGVtYmVkZGluZ0xhbWJkYSA9IG5ldyBjZGsuYXdzX2xhbWJkYS5GdW5jdGlvbih0aGlzLCAnRW1iZWRkaW5nRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1lbWJlZGRpbmdgLFxuICAgICAgcnVudGltZTogY2RrLmF3c19sYW1iZGEuUnVudGltZS5OT0RFSlNfMjJfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGNkay5hd3NfbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdFbWJlZGRpbmcgZnVuY3Rpb24gY2FsbGVkOicsIEpTT04uc3RyaW5naWZ5KGV2ZW50KSk7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgbWVzc2FnZTogJ0VtYmVkZGluZyBmdW5jdGlvbiBwbGFjZWhvbGRlcicsXG4gICAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH07XG4gICAgICAgIH07XG4gICAgICBgKSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFBST0pFQ1RfTkFNRTogcHJvcHMucHJvamVjdE5hbWUsXG4gICAgICAgIEVOVklST05NRU5UOiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGHplqLmlbDjgpLjg6rjgrnjg4jjgavov73liqBcbiAgICB0aGlzLmxhbWJkYUZ1bmN0aW9uc1snZW1iZWRkaW5nJ10gPSBlbWJlZGRpbmdMYW1iZGE7XG4gICAgdGhpcy5lbWJlZGRpbmdGdW5jdGlvbiA9IGVtYmVkZGluZ0xhbWJkYTtcblxuICAgIC8vIEJlZHJvY2sg44Oi44OH44OrSUTjgpLoqK3lrprvvIjjg5fjg6zjg7zjgrnjg5vjg6vjg4Djg7zvvIlcbiAgICB0aGlzLmJlZHJvY2tNb2RlbHNbJ3RpdGFuLWVtYmVkJ10gPSAnYW1hem9uLnRpdGFuLWVtYmVkLXRleHQtdjEnO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKCfwn5OdIFN0ZXAgNDog44Kz44Oz44K544OI44Op44Kv44K/5a6M5LqGJyk7XG4gICAgY29uc29sZS5sb2coJ+KchSBFbWJlZGRpbmdTdGFja+WIneacn+WMluWujOS6hicpO1xuXG4gICAgLy8gQ2xvdWRGb3JtYXRpb27lh7rliptcbiAgICAvLyDmnIDlsI/pmZDlrp/oo4Xjga7jgZ/jgoHjgIHkuIDmmYLnmoTjgavjgrnjgq3jg4Pjg5dcbiAgICB0aGlzLmNyZWF0ZU91dHB1dHMoKTtcblxuICAgIC8vIOOCueOCv+ODg+OCr+ODrOODmeODq+OBruOCv+OCsOioreWumlxuICAgIC8vIOacgOWwj+mZkOWun+ijheOBruOBn+OCgeOAgeS4gOaZgueahOOBq+OCueOCreODg+ODl1xuICAgIHRoaXMuYXBwbHlTdGFja1RhZ3MocHJvcHMucHJvamVjdE5hbWUsIHByb3BzLmVudmlyb25tZW50KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlhbHpgJrjg6rjgr3jg7zjgrnkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQ29tbW9uUmVzb3VyY2VzKHByb3BzOiBFbWJlZGRpbmdTdGFja1Byb3BzKTogRW1iZWRkaW5nQ29tbW9uUmVzb3VyY2VzIHtcbiAgICAvLyDml6LlrZjjga5WUEPjgpLkvb/nlKjjgZnjgovjgYvjgIHmlrDopo/kvZzmiJBcbiAgICBsZXQgdnBjOiBjZGsuYXdzX2VjMi5JVnBjO1xuICAgIFxuICAgIGlmIChwcm9wcy52cGNJZCkge1xuICAgICAgdnBjID0gY2RrLmF3c19lYzIuVnBjLmZyb21Mb29rdXAodGhpcywgJ0V4aXN0aW5nVnBjJywge1xuICAgICAgICB2cGNJZDogcHJvcHMudnBjSWQsXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdnBjID0gbmV3IGNkay5hd3NfZWMyLlZwYyh0aGlzLCAnRW1iZWRkaW5nVnBjJywge1xuICAgICAgICBtYXhBenM6IDMsXG4gICAgICAgIG5hdEdhdGV3YXlzOiAyLFxuICAgICAgICBlbmFibGVEbnNIb3N0bmFtZXM6IHRydWUsXG4gICAgICAgIGVuYWJsZURuc1N1cHBvcnQ6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fkvZzmiJBcbiAgICBjb25zdCBjb21tb25TZWN1cml0eUdyb3VwID0gbmV3IGNkay5hd3NfZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ0VtYmVkZGluZ0NvbW1vblNlY3VyaXR5R3JvdXAnLCB7XG4gICAgICB2cGMsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvbW1vbiBzZWN1cml0eSBncm91cCBmb3IgRW1iZWRkaW5nIHJlc291cmNlcycsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gSFRUUFPjgqLjgq/jgrvjgrnoqLHlj69cbiAgICBjb21tb25TZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgY2RrLmF3c19lYzIuUGVlci5hbnlJcHY0KCksXG4gICAgICBjZGsuYXdzX2VjMi5Qb3J0LnRjcCg0NDMpLFxuICAgICAgJ0hUVFBTIGFjY2VzcydcbiAgICApO1xuXG4gICAgLy8gVlBD5YaF6YCa5L+h6Kix5Y+vXG4gICAgY29tbW9uU2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShcbiAgICAgIGNkay5hd3NfZWMyLlBlZXIuaXB2NCh2cGMudnBjQ2lkckJsb2NrKSxcbiAgICAgIGNkay5hd3NfZWMyLlBvcnQuYWxsVHJhZmZpYygpLFxuICAgICAgJ1ZQQyBpbnRlcm5hbCBjb21tdW5pY2F0aW9uJ1xuICAgICk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgdnBjOiB7XG4gICAgICAgIHZwYyxcbiAgICAgICAgcHJpdmF0ZVN1Ym5ldHM6IHZwYy5wcml2YXRlU3VibmV0cyxcbiAgICAgICAgcHVibGljU3VibmV0czogdnBjLnB1YmxpY1N1Ym5ldHMsXG4gICAgICAgIGF2YWlsYWJpbGl0eVpvbmVzOiB2cGMuYXZhaWxhYmlsaXR5Wm9uZXMsXG4gICAgICB9LFxuICAgICAgc2VjdXJpdHlHcm91cHM6IHtcbiAgICAgICAgY29tbW9uU2VjdXJpdHlHcm91cCxcbiAgICAgIH0sXG4gICAgICBpYW06IHtcbiAgICAgICAgY29tbW9uU2VydmljZVJvbGU6IHRoaXMuY3JlYXRlQ29tbW9uU2VydmljZVJvbGUoKSxcbiAgICAgIH0sXG4gICAgICBsb2dnaW5nOiB7XG4gICAgICAgIGNvbW1vbkxvZ0dyb3VwOiB0aGlzLmNyZWF0ZUNvbW1vbkxvZ0dyb3VwKCksXG4gICAgICB9LFxuICAgICAgc3RvcmFnZToge30sXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlhbHpgJrjgrXjg7zjg5Pjgrnjg63jg7zjg6vkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQ29tbW9uU2VydmljZVJvbGUoKTogY2RrLmF3c19pYW0uUm9sZSB7XG4gICAgcmV0dXJuIG5ldyBjZGsuYXdzX2lhbS5Sb2xlKHRoaXMsICdFbWJlZGRpbmdDb21tb25TZXJ2aWNlUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGNkay5hd3NfaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgY2RrLmF3c19pYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog5YWx6YCa44Ot44Kw44Kw44Or44O844OX5L2c5oiQ77yI5pei5a2Y5a6f6KOF44KS5L+d5oyB77yJXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUNvbW1vbkxvZ0dyb3VwKCk6IGNkay5hd3NfbG9ncy5Mb2dHcm91cCB7XG4gICAgY29uc3QgbG9nR3JvdXBOYW1lID0gdGhpcy5lbWJlZGRpbmdDb25maWdcbiAgICAgID8gYC9hd3MvZW1iZWRkaW5nLyR7dGhpcy5lbWJlZGRpbmdDb25maWcucHJvamVjdE5hbWV9LSR7dGhpcy5lbWJlZGRpbmdDb25maWcuZW52aXJvbm1lbnR9YFxuICAgICAgOiBgL2F3cy9lbWJlZGRpbmcvZGVmYXVsdGA7XG4gICAgICBcbiAgICByZXR1cm4gbmV3IGNkay5hd3NfbG9ncy5Mb2dHcm91cCh0aGlzLCAnRW1iZWRkaW5nQ29tbW9uTG9nR3JvdXAnLCB7XG4gICAgICBsb2dHcm91cE5hbWUsXG4gICAgICByZXRlbnRpb246IGNkay5hd3NfbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ2xvdWRGb3JtYXRpb27lh7rlipvjga7kvZzmiJDvvIjntbHkuIDlkb3lkI3opo/liYfpgannlKjvvIlcbiAgICog5pei5a2Y5a6f6KOF44KS5L+d5oyBICsgUGhhc2UgNOOBrkJlZHJvY2sgQWdlbnTntbHlkIhcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlT3V0cHV0cygpOiB2b2lkIHtcbiAgICAvLyBFbWJlZGRpbmcgTGFtYmRhIOmWouaVsOaDheWgse+8iOaXouWtmOWun+ijheOCkuS/neaMge+8iVxuICAgIGlmICh0aGlzLmxhbWJkYUZ1bmN0aW9ucyAmJiBPYmplY3Qua2V5cyh0aGlzLmxhbWJkYUZ1bmN0aW9ucykubGVuZ3RoID4gMCkge1xuICAgICAgT2JqZWN0LmVudHJpZXModGhpcy5sYW1iZGFGdW5jdGlvbnMpLmZvckVhY2goKFtuYW1lLCBmdW5jXSkgPT4ge1xuICAgICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgRW1iZWRkaW5nTGFtYmRhRnVuY3Rpb24ke25hbWV9TmFtZWAsIHtcbiAgICAgICAgICB2YWx1ZTogZnVuYy5mdW5jdGlvbk5hbWUsXG4gICAgICAgICAgZGVzY3JpcHRpb246IGBFbWJlZGRpbmcgTGFtYmRhIEZ1bmN0aW9uICR7bmFtZX0gTmFtZWAsXG4gICAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUVtYmVkZGluZ0xhbWJkYUZ1bmN0aW9uJHtuYW1lfU5hbWVgLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgRW1iZWRkaW5nTGFtYmRhRnVuY3Rpb24ke25hbWV9QXJuYCwge1xuICAgICAgICAgIHZhbHVlOiBmdW5jLmZ1bmN0aW9uQXJuLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBgRW1iZWRkaW5nIExhbWJkYSBGdW5jdGlvbiAke25hbWV9IEFSTmAsXG4gICAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUVtYmVkZGluZ0xhbWJkYUZ1bmN0aW9uJHtuYW1lfUFybmAsXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gRW1iZWRkaW5nIEVDUyDjgq/jg6njgrnjgr/jg7zmg4XloLHvvIjml6LlrZjlrp/oo4XjgpLkv53mjIHvvIlcbiAgICBpZiAodGhpcy5lY3NDbHVzdGVyKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRW1iZWRkaW5nRWNzQ2x1c3Rlck5hbWUnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmVjc0NsdXN0ZXIuY2x1c3Rlck5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnRW1iZWRkaW5nIEVDUyBDbHVzdGVyIE5hbWUnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tRW1iZWRkaW5nRWNzQ2x1c3Rlck5hbWVgLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdFbWJlZGRpbmdFY3NDbHVzdGVyQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5lY3NDbHVzdGVyLmNsdXN0ZXJBcm4sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnRW1iZWRkaW5nIEVDUyBDbHVzdGVyIEFSTicsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1FbWJlZGRpbmdFY3NDbHVzdGVyQXJuYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEVtYmVkZGluZyBCYXRjaOe1seWQiOaDheWgse+8iOaXouWtmOWun+ijheOCkuS/neaMge+8iVxuICAgIGlmICh0aGlzLmVtYmVkZGluZ0JhdGNoSW50ZWdyYXRpb24pIHtcbiAgICAgIGNvbnN0IGJhdGNoSW5mbyA9IHRoaXMuZW1iZWRkaW5nQmF0Y2hJbnRlZ3JhdGlvbi5nZXRJbnRlZ3JhdGlvbkluZm8oKTtcbiAgICAgIFxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0VtYmVkZGluZ0JhdGNoQ29tcHV0ZUVudmlyb25tZW50TmFtZScsIHtcbiAgICAgICAgdmFsdWU6IGJhdGNoSW5mby5iYXRjaENvbnN0cnVjdC5jb21wdXRlRW52aXJvbm1lbnQsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnRW1iZWRkaW5nIEJhdGNoIENvbXB1dGUgRW52aXJvbm1lbnQgTmFtZScsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1FbWJlZGRpbmdCYXRjaENvbXB1dGVFbnZpcm9ubWVudE5hbWVgLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdFbWJlZGRpbmdCYXRjaEpvYlF1ZXVlTmFtZScsIHtcbiAgICAgICAgdmFsdWU6IGJhdGNoSW5mby5iYXRjaENvbnN0cnVjdC5qb2JRdWV1ZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICdFbWJlZGRpbmcgQmF0Y2ggSm9iIFF1ZXVlIE5hbWUnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tRW1iZWRkaW5nQmF0Y2hKb2JRdWV1ZU5hbWVgLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gRW1iZWRkaW5nIEJlZHJvY2sg44Oi44OH44Or5oOF5aCx77yI5pei5a2Y5a6f6KOF44KS5L+d5oyB77yJXG4gICAgaWYgKHRoaXMuYmVkcm9ja01vZGVscyAmJiBPYmplY3Qua2V5cyh0aGlzLmJlZHJvY2tNb2RlbHMpLmxlbmd0aCA+IDApIHtcbiAgICAgIE9iamVjdC5lbnRyaWVzKHRoaXMuYmVkcm9ja01vZGVscykuZm9yRWFjaCgoW25hbWUsIG1vZGVsSWRdKSA9PiB7XG4gICAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBFbWJlZGRpbmdCZWRyb2NrTW9kZWwke25hbWV9SWRgLCB7XG4gICAgICAgICAgdmFsdWU6IG1vZGVsSWQsXG4gICAgICAgICAgZGVzY3JpcHRpb246IGBFbWJlZGRpbmcgQmVkcm9jayBNb2RlbCAke25hbWV9IElEYCxcbiAgICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tRW1iZWRkaW5nQmVkcm9ja01vZGVsJHtuYW1lfUlkYCxcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBFbWJlZGRpbmfplqLmlbDmg4XloLHvvIjml6LlrZjlrp/oo4XjgpLkv53mjIHvvIlcbiAgICBpZiAodGhpcy5lbWJlZGRpbmdGdW5jdGlvbikge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0VtYmVkZGluZ0Z1bmN0aW9uTmFtZScsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuZW1iZWRkaW5nRnVuY3Rpb24uZnVuY3Rpb25OYW1lLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0VtYmVkZGluZyBGdW5jdGlvbiBOYW1lJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUVtYmVkZGluZ0Z1bmN0aW9uTmFtZWAsXG4gICAgICB9KTtcblxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0VtYmVkZGluZ0Z1bmN0aW9uQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5lbWJlZGRpbmdGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdFbWJlZGRpbmcgRnVuY3Rpb24gQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUVtYmVkZGluZ0Z1bmN0aW9uQXJuYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEJlZHJvY2sgQWdlbnTmg4XloLHvvIhQaGFzZSA057Wx5ZCI77yJXG4gICAgaWYgKHRoaXMuYmVkcm9ja0FnZW50KSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUkFHTW9kZScsIHtcbiAgICAgICAgdmFsdWU6ICdhZ2VudCcsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnUkFHIE1vZGUgKGFnZW50IG9yIGtub3dsZWRnZS1iYXNlKScsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1SQUdNb2RlYCxcbiAgICAgIH0pO1xuXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQmVkcm9ja0FnZW50QXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudEFybiB8fCAnTi9BJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdCZWRyb2NrIEFnZW50IEFSTicsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1CZWRyb2NrQWdlbnRBcm5gLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdCZWRyb2NrQWdlbnRBbGlhc0FybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYWdlbnRBbGlhc0FybiB8fCAnTi9BJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdCZWRyb2NrIEFnZW50IEFsaWFzIEFSTicsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1CZWRyb2NrQWdlbnRBbGlhc0FybmAsXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1JBR01vZGUnLCB7XG4gICAgICAgIHZhbHVlOiAna25vd2xlZGdlLWJhc2UnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1JBRyBNb2RlIChhZ2VudCBvciBrbm93bGVkZ2UtYmFzZSknLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tUkFHTW9kZWAsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44K544K/44OD44Kv44Os44OZ44Or44Gu44K/44Kw6Kit5a6a77yI57Wx5LiA5ZG95ZCN6KaP5YmH6YGp55So77yJXG4gICAqL1xuICBwcml2YXRlIGFwcGx5U3RhY2tUYWdzKHByb2plY3ROYW1lOiBzdHJpbmcsIGVudmlyb25tZW50OiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1Byb2plY3QnLCBwcm9qZWN0TmFtZSk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdFbnZpcm9ubWVudCcsIGVudmlyb25tZW50KTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1N0YWNrJywgJ0VtYmVkZGluZ1N0YWNrJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdDb21wb25lbnQnLCAnRW1iZWRkaW5nJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdNYW5hZ2VkQnknLCAnQ0RLJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdDb3N0Q2VudGVyJywgYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWVtYmVkZGluZ2ApO1xuICB9XG5cbiAgLyoqXG4gICAqIOS7luOBruOCueOCv+ODg+OCr+OBp+S9v+eUqOOBmeOCi+OBn+OCgeOBrkVtYmVkZGluZ+ODquOCveODvOOCueaDheWgseOCkuWPluW+l1xuICAgKi9cbiAgcHVibGljIGdldEVtYmVkZGluZ0luZm8oKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGxhbWJkYUZ1bmN0aW9uczogdGhpcy5sYW1iZGFGdW5jdGlvbnMsXG4gICAgICBlY3NDbHVzdGVyOiB0aGlzLmVjc0NsdXN0ZXIsXG4gICAgICBiYXRjaEpvYlF1ZXVlOiB0aGlzLmJhdGNoSm9iUXVldWUsXG4gICAgICBiZWRyb2NrTW9kZWxzOiB0aGlzLmJlZHJvY2tNb2RlbHMsXG4gICAgICBlbWJlZGRpbmdGdW5jdGlvbjogdGhpcy5lbWJlZGRpbmdGdW5jdGlvbixcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOeJueWumuOBrkxhbWJkYemWouaVsOOCkuWPluW+l1xuICAgKi9cbiAgcHVibGljIGdldExhbWJkYUZ1bmN0aW9uKG5hbWU6IHN0cmluZyk6IGNkay5hd3NfbGFtYmRhLkZ1bmN0aW9uIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5sYW1iZGFGdW5jdGlvbnNbbmFtZV07XG4gIH1cblxuICAvKipcbiAgICog54m55a6a44GuQmVkcm9ja+ODouODh+ODq0lE44KS5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgZ2V0QmVkcm9ja01vZGVsSWQobmFtZTogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5iZWRyb2NrTW9kZWxzW25hbWVdO1xuICB9XG5cbiAgLyoqXG4gICAqIExhbWJkYemWouaVsOeUqOOBrklBTeODneODquOCt+ODvOOCueODhuODvOODiOODoeODs+ODiOOCkueUn+aIkFxuICAgKi9cbiAgcHVibGljIGdldExhbWJkYUV4ZWN1dGlvblBvbGljeVN0YXRlbWVudHMoKTogY2RrLmF3c19pYW0uUG9saWN5U3RhdGVtZW50W10ge1xuICAgIGNvbnN0IHN0YXRlbWVudHM6IGNkay5hd3NfaWFtLlBvbGljeVN0YXRlbWVudFtdID0gW107XG5cbiAgICAvLyBCZWRyb2NrIOOCouOCr+OCu+OCueaoqemZkFxuICAgIHN0YXRlbWVudHMucHVzaChuZXcgY2RrLmF3c19pYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogY2RrLmF3c19pYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbCcsXG4gICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IE9iamVjdC52YWx1ZXModGhpcy5iZWRyb2NrTW9kZWxzKS5tYXAobW9kZWxJZCA9PiBcbiAgICAgICAgYGFybjphd3M6YmVkcm9jazoke3RoaXMucmVnaW9ufTo6Zm91bmRhdGlvbi1tb2RlbC8ke21vZGVsSWR9YFxuICAgICAgKSxcbiAgICB9KSk7XG5cbiAgICAvLyBDbG91ZFdhdGNoIExvZ3Mg44Ki44Kv44K744K55qip6ZmQXG4gICAgc3RhdGVtZW50cy5wdXNoKG5ldyBjZGsuYXdzX2lhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBjZGsuYXdzX2lhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdsb2dzOkNyZWF0ZUxvZ0dyb3VwJyxcbiAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nU3RyZWFtJyxcbiAgICAgICAgJ2xvZ3M6UHV0TG9nRXZlbnRzJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtgYXJuOmF3czpsb2dzOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fToqYF0sXG4gICAgfSkpO1xuXG4gICAgLy8gWC1SYXkg44OI44Os44O844K344Oz44Kw5qip6ZmQXG4gICAgc3RhdGVtZW50cy5wdXNoKG5ldyBjZGsuYXdzX2lhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBjZGsuYXdzX2lhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICd4cmF5OlB1dFRyYWNlU2VnbWVudHMnLFxuICAgICAgICAneHJheTpQdXRUZWxlbWV0cnlSZWNvcmRzJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIHJldHVybiBzdGF0ZW1lbnRzO1xuICB9XG5cbiAgLyoqXG4gICAqIEVDUyDjgr/jgrnjgq/nlKjjga5JQU3jg53jg6rjgrfjg7zjgrnjg4bjg7zjg4jjg6Hjg7Pjg4jjgpLnlJ/miJBcbiAgICovXG4gIHB1YmxpYyBnZXRFY3NUYXNrUG9saWN5U3RhdGVtZW50cygpOiBjZGsuYXdzX2lhbS5Qb2xpY3lTdGF0ZW1lbnRbXSB7XG4gICAgY29uc3Qgc3RhdGVtZW50czogY2RrLmF3c19pYW0uUG9saWN5U3RhdGVtZW50W10gPSBbXTtcblxuICAgIC8vIEVDUyDjgr/jgrnjgq/lrp/ooYzmqKnpmZBcbiAgICBzdGF0ZW1lbnRzLnB1c2gobmV3IGNkay5hd3NfaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGNkay5hd3NfaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2VjcjpHZXRBdXRob3JpemF0aW9uVG9rZW4nLFxuICAgICAgICAnZWNyOkJhdGNoQ2hlY2tMYXllckF2YWlsYWJpbGl0eScsXG4gICAgICAgICdlY3I6R2V0RG93bmxvYWRVcmxGb3JMYXllcicsXG4gICAgICAgICdlY3I6QmF0Y2hHZXRJbWFnZScsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KSk7XG5cbiAgICAvLyBDbG91ZFdhdGNoIExvZ3Mg44Ki44Kv44K744K55qip6ZmQXG4gICAgc3RhdGVtZW50cy5wdXNoKG5ldyBjZGsuYXdzX2lhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBjZGsuYXdzX2lhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdsb2dzOkNyZWF0ZUxvZ1N0cmVhbScsXG4gICAgICAgICdsb2dzOlB1dExvZ0V2ZW50cycsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbYGFybjphd3M6bG9nczoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06bG9nLWdyb3VwOi9lY3MvKmBdLFxuICAgIH0pKTtcblxuICAgIHJldHVybiBzdGF0ZW1lbnRzO1xuICB9XG5cbiAgLyoqXG4gICAqIEJhdGNo57Wx5ZCI5oOF5aCx44KS5Y+W5b6X77yI5pei5a2Y5a6f6KOF44KS5L+d5oyB77yJXG4gICAqL1xuICBwdWJsaWMgZ2V0QmF0Y2hJbnRlZ3JhdGlvbkluZm8oKTogUmVjb3JkPHN0cmluZywgYW55PiB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuZW1iZWRkaW5nQmF0Y2hJbnRlZ3JhdGlvbj8uZ2V0SW50ZWdyYXRpb25JbmZvKCk7XG4gIH1cblxuICAvKipcbiAgICogQmF0Y2jjgrjjg6fjg5bjgpLlrp/ooYzvvIjml6LlrZjlrp/oo4XjgpLkv53mjIHvvIlcbiAgICovXG4gIHB1YmxpYyBhc3luYyBzdWJtaXRCYXRjaEpvYihqb2JOYW1lOiBzdHJpbmcsIHBhcmFtZXRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4pOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuICAgIHJldHVybiB0aGlzLmVtYmVkZGluZ0JhdGNoSW50ZWdyYXRpb24/LnN1Ym1pdEVtYmVkZGluZ0pvYihqb2JOYW1lLCBwYXJhbWV0ZXJzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBCYXRjaOOCuOODp+ODlueKtuazgeOCkuWPluW+l++8iOaXouWtmOWun+ijheOCkuS/neaMge+8iVxuICAgKi9cbiAgcHVibGljIGdldEJhdGNoSm9iU3RhdHVzKCk6IFJlY29yZDxzdHJpbmcsIGFueT4gfCB1bmRlZmluZWQge1xuICAgIHJldHVybiB0aGlzLmVtYmVkZGluZ0JhdGNoSW50ZWdyYXRpb24/LmdldEpvYlN0YXR1cygpO1xuICB9XG5cbiAgLyoqXG4gICAqIEJhdGNo57Wx5ZCI44OG44K544OI5a6f6KGM77yIUGhhc2UgMeacquWun+ijhe+8iVxuICAgKi9cbiAgLy8gcHVibGljIGFzeW5jIHJ1bkJhdGNoSW50ZWdyYXRpb25UZXN0KHRlc3RUeXBlOiAnYmFzaWMnIHwgJ2ZzeCcgfCAncmVjb3ZlcnknID0gJ2Jhc2ljJyk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG4gIC8vICAgaWYgKCF0aGlzLmJhdGNoSW50ZWdyYXRpb25UZXN0KSB7XG4gIC8vICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAvLyAgIH1cbiAgLy9cbiAgLy8gICBzd2l0Y2ggKHRlc3RUeXBlKSB7XG4gIC8vICAgICBjYXNlICdiYXNpYyc6XG4gIC8vICAgICAgIHJldHVybiB0aGlzLmJhdGNoSW50ZWdyYXRpb25UZXN0LnJ1bkJhc2ljVGVzdCgpO1xuICAvLyAgICAgY2FzZSAnZnN4JzpcbiAgLy8gICAgICAgcmV0dXJuIHRoaXMuYmF0Y2hJbnRlZ3JhdGlvblRlc3QucnVuRnN4TW91bnRUZXN0KCk7XG4gIC8vICAgICBjYXNlICdyZWNvdmVyeSc6XG4gIC8vICAgICAgIHJldHVybiB0aGlzLmJhdGNoSW50ZWdyYXRpb25UZXN0LnJ1bkF1dG9SZWNvdmVyeVRlc3QoKTtcbiAgLy8gICAgIGRlZmF1bHQ6XG4gIC8vICAgICAgIHJldHVybiB0aGlzLmJhdGNoSW50ZWdyYXRpb25UZXN0LnJ1bkJhc2ljVGVzdCgpO1xuICAvLyAgIH1cbiAgLy8gfVxuXG4gIC8qKlxuICAgKiBFbWJlZGRpbmfoqK3lrprjgpLlj5blvpfvvIjml6LlrZjlrp/oo4XjgpLkv53mjIHvvIlcbiAgICovXG4gIHB1YmxpYyBnZXRFbWJlZGRpbmdDb25maWcoKTogRW1iZWRkaW5nQ29uZmlnIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5lbWJlZGRpbmdDb25maWc7XG4gIH1cblxuICAvKipcbiAgICogU1FMaXRl6LKg6I236Kmm6aiT44K444On44OW44KS5a6f6KGMXG4gICAqL1xuICBwdWJsaWMgc3VibWl0U3FsaXRlTG9hZFRlc3RKb2Ioam9iTmFtZT86IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gICAgaWYgKCF0aGlzLnNxbGl0ZUxvYWRUZXN0KSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zcWxpdGVMb2FkVGVzdC5zdWJtaXRKb2Ioam9iTmFtZSk7XG4gIH1cblxuICAvKipcbiAgICogU1FMaXRl6LKg6I236Kmm6aiT57Wx5ZCI5oOF5aCx44KS5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgZ2V0U3FsaXRlTG9hZFRlc3RJbmZvKCk6IFJlY29yZDxzdHJpbmcsIGFueT4gfCB1bmRlZmluZWQge1xuICAgIGlmICghdGhpcy5zcWxpdGVMb2FkVGVzdCkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgY29tcHV0ZUVudmlyb25tZW50OiB0aGlzLnNxbGl0ZUxvYWRUZXN0LmNvbXB1dGVFbnZpcm9ubWVudC5yZWYsXG4gICAgICBqb2JRdWV1ZTogdGhpcy5zcWxpdGVMb2FkVGVzdC5qb2JRdWV1ZS5yZWYsXG4gICAgICBqb2JEZWZpbml0aW9uOiB0aGlzLnNxbGl0ZUxvYWRUZXN0LmpvYkRlZmluaXRpb24ucmVmLFxuICAgICAgbG9nR3JvdXA6IHRoaXMuc3FsaXRlTG9hZFRlc3QubG9nR3JvdXAubG9nR3JvdXBOYW1lLFxuICAgICAgc2NoZWR1bGVkUnVsZTogdGhpcy5zcWxpdGVMb2FkVGVzdC5zY2hlZHVsZWRSdWxlPy5ydWxlQXJuLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogV2luZG93cyBTUUxpdGXosqDojbfoqabpqJPmg4XloLHjgpLlj5blvpdcbiAgICovXG4gIHB1YmxpYyBnZXRXaW5kb3dzU3FsaXRlSW5mbygpOiBSZWNvcmQ8c3RyaW5nLCBhbnk+IHwgdW5kZWZpbmVkIHtcbiAgICBpZiAoIXRoaXMud2luZG93c1NxbGl0ZSkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgaW5zdGFuY2VJZDogdGhpcy53aW5kb3dzU3FsaXRlLmluc3RhbmNlLmluc3RhbmNlSWQsXG4gICAgICBwcml2YXRlSXA6IHRoaXMud2luZG93c1NxbGl0ZS5pbnN0YW5jZS5pbnN0YW5jZVByaXZhdGVJcCxcbiAgICAgIGJhc3Rpb25Ib3N0UHVibGljSXA6IHRoaXMud2luZG93c1NxbGl0ZS5iYXN0aW9uSG9zdD8uaW5zdGFuY2VQdWJsaWNJcCxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEJlZHJvY2sgQWdlbnTkvZzmiJDvvIhQaGFzZSA057Wx5ZCI77yJXG4gICAqIOacgOWwj+mZkOWun+ijheOBruOBn+OCgeOAgeS4gOaZgueahOOBq+OCs+ODoeODs+ODiOOCouOCpuODiFxuICAgKi9cbiAgLypcbiAgcHJpdmF0ZSBjcmVhdGVCZWRyb2NrQWdlbnQocHJvcHM6IEVtYmVkZGluZ1N0YWNrUHJvcHMpOiBCZWRyb2NrQWdlbnRDb25zdHJ1Y3Qge1xuICAgIC8vIEFnZW50IEluc3RydWN0aW9u5Y+W5b6XXG4gICAgY29uc3QgaW5zdHJ1Y3Rpb24gPSBnZXRBZ2VudEluc3RydWN0aW9uKHByb3BzLmFnZW50SW5zdHJ1Y3Rpb25QcmVzZXQgfHwgJ3N0YW5kYXJkJyk7XG5cbiAgICAvLyBBY3Rpb24gR3JvdXBz6Kit5a6aXG4gICAgY29uc3QgYWN0aW9uR3JvdXBzID0gcHJvcHMuZG9jdW1lbnRTZWFyY2hMYW1iZGFBcm5cbiAgICAgID8gW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGFjdGlvbkdyb3VwTmFtZTogJ2RvY3VtZW50X3NlYXJjaCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aoqemZkOiqjeitmOWei+aWh+abuOaknOe0oicsXG4gICAgICAgICAgICBhY3Rpb25Hcm91cEV4ZWN1dG9yOiBwcm9wcy5kb2N1bWVudFNlYXJjaExhbWJkYUFybixcbiAgICAgICAgICAgIGFwaVNjaGVtYToge1xuICAgICAgICAgICAgICBwYXlsb2FkOiBKU09OLnN0cmluZ2lmeShyZXF1aXJlKCcuLi8uLi8uLi9sYW1iZGEvYmVkcm9jay1hZ2VudC1hY3Rpb25zL2RvY3VtZW50LXNlYXJjaC1zY2hlbWEuanNvbicpKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXVxuICAgICAgOiB1bmRlZmluZWQ7XG5cbiAgICByZXR1cm4gbmV3IEJlZHJvY2tBZ2VudENvbnN0cnVjdCh0aGlzLCAnQmVkcm9ja0FnZW50Jywge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIHByb2plY3ROYW1lOiBwcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgIGVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgIGFnZW50TmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LXJhZy1hZ2VudGAsXG4gICAgICBhZ2VudERlc2NyaXB0aW9uOiAn5qip6ZmQ6KqN6K2Y5Z6LUkFH44K344K544OG44Og44GuQUnjgqLjgrfjgrnjgr/jg7Pjg4gnLFxuICAgICAgZm91bmRhdGlvbk1vZGVsOiBwcm9wcy5mb3VuZGF0aW9uTW9kZWwgfHwgJ2FudGhyb3BpYy5jbGF1ZGUtdjInLFxuICAgICAgaW5zdHJ1Y3Rpb246IGluc3RydWN0aW9uLFxuICAgICAga25vd2xlZGdlQmFzZUFybjogcHJvcHMua25vd2xlZGdlQmFzZUFybixcbiAgICAgIGFjdGlvbkdyb3VwczogYWN0aW9uR3JvdXBzLFxuICAgICAgaWRsZVNlc3Npb25UVExJblNlY29uZHM6IDYwMCxcbiAgICAgIC8vIEd1YXJkcmFpbHPpgannlKjvvIhQaGFzZSA1IC0gU2VjdXJpdHlTdGFja+OBi+OCieWPluW+l++8iVxuICAgICAgZ3VhcmRyYWlsQXJuOiBwcm9wcy5ndWFyZHJhaWxBcm4sXG4gICAgICBndWFyZHJhaWxWZXJzaW9uOiBwcm9wcy5ndWFyZHJhaWxBcm4gPyAnRFJBRlQnIDogdW5kZWZpbmVkLFxuICAgIH0pO1xuICB9XG4gICovXG5cbiAgLyoqXG4gICAqIENES+OCs+ODs+ODhuOCreOCueODiOioreWumuS+i+OCkuWPluW+l1xuICAgKi9cbiAgcHVibGljIHN0YXRpYyBnZXRDb250ZXh0RXhhbXBsZShlbnZpcm9ubWVudDogc3RyaW5nKTogUmVjb3JkPHN0cmluZywgYW55PiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHByb2plY3ROYW1lOiAncGVybWlzc2lvbi1hd2FyZS1yYWcnLFxuICAgICAgZW52aXJvbm1lbnQsXG4gICAgICByZWdpb246ICdhcC1ub3J0aGVhc3QtMScsXG4gICAgICBcbiAgICAgIC8vIEVtYmVkZGluZyBCYXRjaOioreWumlxuICAgICAgJ2VtYmVkZGluZzplbmFibGVBd3NCYXRjaCc6IHRydWUsXG4gICAgICAnZW1iZWRkaW5nOmVuYWJsZUVjc09uRUMyJzogZmFsc2UsXG4gICAgICAnZW1iZWRkaW5nOmVuYWJsZVNwb3RGbGVldCc6IGZhbHNlLFxuICAgICAgJ2VtYmVkZGluZzplbmFibGVNb25pdG9yaW5nJzogdHJ1ZSxcbiAgICAgICdlbWJlZGRpbmc6ZW5hYmxlQXV0b1NjYWxpbmcnOiB0cnVlLFxuICAgICAgXG4gICAgICAvLyBCYXRjaOioreWumlxuICAgICAgJ2VtYmVkZGluZzpiYXRjaDpuYW1lUHJlZml4JzogYCR7ZW52aXJvbm1lbnR9LWVtYmVkZGluZy1iYXRjaGAsXG4gICAgICAnZW1iZWRkaW5nOmJhdGNoOmltYWdlVXJpJzogYDEyMzQ1Njc4OTAxMi5ka3IuZWNyLmFwLW5vcnRoZWFzdC0xLmFtYXpvbmF3cy5jb20vZW1iZWRkaW5nLXNlcnZlcjoke2Vudmlyb25tZW50fWAsXG4gICAgICAnZW1iZWRkaW5nOmJhdGNoOnZjcHVzJzogZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IDQgOiAyLFxuICAgICAgJ2VtYmVkZGluZzpiYXRjaDptZW1vcnknOiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gODE5MiA6IDQwOTYsXG4gICAgICAnZW1iZWRkaW5nOmJhdGNoOnVzZVNwb3RJbnN0YW5jZXMnOiBlbnZpcm9ubWVudCAhPT0gJ3Byb2QnLFxuICAgICAgXG4gICAgICAvLyBKb2IgRGVmaW5pdGlvbuioreWumlxuICAgICAgJ2VtYmVkZGluZzpqb2JEZWZpbml0aW9uOm5hbWUnOiBgJHtlbnZpcm9ubWVudH0tZW1iZWRkaW5nLWpvYi1kZWZpbml0aW9uYCxcbiAgICAgICdlbWJlZGRpbmc6am9iRGVmaW5pdGlvbjpjcHUnOiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gNCA6IDIsXG4gICAgICAnZW1iZWRkaW5nOmpvYkRlZmluaXRpb246bWVtb3J5TWlCJzogZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IDgxOTIgOiA0MDk2LFxuICAgICAgJ2VtYmVkZGluZzpqb2JEZWZpbml0aW9uOnRpbWVvdXRIb3Vycyc6IDEsXG4gICAgICAnZW1iZWRkaW5nOmpvYkRlZmluaXRpb246cmV0cnlBdHRlbXB0cyc6IDMsXG4gICAgICBcbiAgICAgIC8vIEZTeOe1seWQiOioreWumlxuICAgICAgJ2VtYmVkZGluZzpmc3g6ZmlsZVN5c3RlbUlkJzogJ2ZzLTAxMjM0NTY3ODlhYmNkZWYwJyxcbiAgICAgICdlbWJlZGRpbmc6ZnN4OmNpZnNkYXRhVm9sTmFtZSc6ICdzbWJfc2hhcmUnLFxuICAgICAgJ2VtYmVkZGluZzpmc3g6cmFnZGJWb2xQYXRoJzogJy9zbWJfc2hhcmUvcmFnZGInLFxuICAgICAgXG4gICAgICAvLyBBY3RpdmUgRGlyZWN0b3J56Kit5a6aXG4gICAgICAnZW1iZWRkaW5nOmFkOmRvbWFpbic6ICdleGFtcGxlLmNvbScsXG4gICAgICAnZW1iZWRkaW5nOmFkOnVzZXJuYW1lJzogJ2FkbWluJyxcbiAgICAgICdlbWJlZGRpbmc6YWQ6cGFzc3dvcmRTZWNyZXRBcm4nOiAnYXJuOmF3czpzZWNyZXRzbWFuYWdlcjphcC1ub3J0aGVhc3QtMToxMjM0NTY3ODkwMTI6c2VjcmV0OmFkLXBhc3N3b3JkLWFiYzEyMycsXG4gICAgICBcbiAgICAgIC8vIEJlZHJvY2voqK3lrppcbiAgICAgICdlbWJlZGRpbmc6YmVkcm9jazpyZWdpb24nOiAndXMtZWFzdC0xJyxcbiAgICAgICdlbWJlZGRpbmc6YmVkcm9jazptb2RlbElkJzogJ2FtYXpvbi50aXRhbi1lbWJlZC10ZXh0LXYxJyxcbiAgICAgIFxuICAgICAgLy8gT3BlblNlYXJjaOioreWumlxuICAgICAgJ2VtYmVkZGluZzpvcGVuU2VhcmNoOmNvbGxlY3Rpb25OYW1lJzogYCR7ZW52aXJvbm1lbnR9LWVtYmVkZGluZy1jb2xsZWN0aW9uYCxcbiAgICAgICdlbWJlZGRpbmc6b3BlblNlYXJjaDppbmRleE5hbWUnOiAnZG9jdW1lbnRzJyxcbiAgICAgIFxuICAgICAgLy8g55uj6KaW6Kit5a6aXG4gICAgICAnZW1iZWRkaW5nOm1vbml0b3Jpbmc6YWxlcnRzOmVuYWJsZWQnOiB0cnVlLFxuICAgICAgJ2VtYmVkZGluZzptb25pdG9yaW5nOmNsb3VkV2F0Y2g6Y3JlYXRlRGFzaGJvYXJkJzogdHJ1ZSxcbiAgICAgICdlbWJlZGRpbmc6bW9uaXRvcmluZzp4cmF5OnRyYWNpbmdFbmFibGVkJzogdHJ1ZSxcbiAgICAgIFxuICAgICAgLy8gQmVkcm9jayBBZ2VudOioreWumu+8iFBoYXNlIDTvvIlcbiAgICAgICd1c2VCZWRyb2NrQWdlbnQnOiBmYWxzZSwgIC8vIOODh+ODleOCqeODq+ODiDogS25vd2xlZGdlIEJhc2Xjg6Ljg7zjg4lcbiAgICAgICdhZ2VudEluc3RydWN0aW9uUHJlc2V0JzogJ3N0YW5kYXJkJywgIC8vIHN0YW5kYXJkLCBmaW5hbmNpYWwsIGhlYWx0aGNhcmVcbiAgICAgICdmb3VuZGF0aW9uTW9kZWwnOiAnYW50aHJvcGljLmNsYXVkZS12MicsXG4gICAgfTtcbiAgfVxufVxuIl19