"use strict";
/**
 * Embedding Stack
 * Embedding統合スタック - 統一命名規則適用
 *
 * 統合機能:
 * - AWS Batch、ECS、Lambda、Bedrock、埋め込み、RAG、文書処理
 * - Component="Embedding"による統一命名規則
 * - 設定・変更容易性を担保するモジュール化アーキテクチャ
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
const aws_cdk_lib_1 = require("aws-cdk-lib");
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
class EmbeddingStack extends aws_cdk_lib_1.Stack {
    documentProcessorFunction;
    embeddingFunction;
    ragQueryFunction;
    ecsCluster;
    bedrockRole;
    tempProcessingBucket;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { config } = props;
        // 統一命名規則のためのregionPrefix設定
        const regionPrefix = config.regionPrefix || this.getRegionPrefix(config.region);
        const enhancedConfig = { ...config, regionPrefix };
        // Create temporary processing bucket for Markitdown
        this.tempProcessingBucket = this.createTempProcessingBucket(enhancedConfig);
        // Create ECS Cluster if needed
        if (enhancedConfig.embedding.ecs.enabled && props.vpc) {
            this.createEcsCluster(enhancedConfig, props.vpc);
        }
        // Create Bedrock IAM Role
        if (enhancedConfig.features.ai.bedrock) {
            this.createBedrockRole(enhancedConfig, this.tempProcessingBucket);
        }
        // Create Lambda functions
        if (enhancedConfig.embedding.lambda) {
            this.createLambdaFunctions(enhancedConfig, props, this.tempProcessingBucket);
        }
    }
    createEcsCluster(config, vpc) {
        this.ecsCluster = new ecs.Cluster(this, 'EmbeddingEcsCluster', {
            clusterName: `${config.regionPrefix}-${config.projectName}-${config.environment}-Embedding-EcsCluster`,
            vpc,
            containerInsights: true
        });
        // Add EC2 capacity provider with ECS configuration
        this.ecsCluster.addCapacity('EmbeddingEC2Capacity', {
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, config.embedding.ecs.instanceType.includes('large') ? ec2.InstanceSize.LARGE : ec2.InstanceSize.XLARGE),
            minCapacity: config.embedding.ecs.minCapacity,
            maxCapacity: config.embedding.ecs.maxCapacity,
            desiredCapacity: config.embedding.ecs.desiredCapacity
        });
    }
    createTempProcessingBucket(config) {
        const tempBucket = new s3.Bucket(this, 'EmbeddingTempProcessingBucket', {
            bucketName: `${config.regionPrefix}-${config.projectName}-${config.environment}-embedding-temp-processing`,
            removalPolicy: config.environment === 'prod' ?
                aws_cdk_lib_1.RemovalPolicy.RETAIN : aws_cdk_lib_1.RemovalPolicy.DESTROY,
            autoDeleteObjects: config.environment !== 'prod',
            versioned: false,
            lifecycleRules: [
                {
                    id: 'DeleteTempFiles',
                    enabled: true,
                    expiration: aws_cdk_lib_1.Duration.days(1), // 1日後に自動削除
                    abortIncompleteMultipartUploadAfter: aws_cdk_lib_1.Duration.hours(1)
                }
            ],
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true
        });
        return tempBucket;
    }
    createBedrockRole(config, tempBucket) {
        this.bedrockRole = new iam.Role(this, 'EmbeddingBedrockRole', {
            roleName: `${config.regionPrefix}-${config.projectName}-${config.environment}-Embedding-BedrockRole`,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
            ]
        });
        // Add Bedrock permissions
        this.bedrockRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
                'bedrock:ListFoundationModels',
                'bedrock:GetFoundationModel'
            ],
            resources: ['*']
        }));
        // Add CloudWatch Logs permissions for Markitdown processing
        this.bedrockRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
                'logs:DescribeLogGroups',
                'logs:DescribeLogStreams'
            ],
            resources: [
                `arn:aws:logs:${config.region}:${this.account}:log-group:/aws/lambda/${config.regionPrefix}-${config.projectName}-*`,
                `arn:aws:logs:${config.region}:${this.account}:log-group:/aws/lambda/${config.regionPrefix}-${config.projectName}-*:*`
            ]
        }));
        // Add X-Ray tracing permissions
        this.bedrockRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'xray:PutTraceSegments',
                'xray:PutTelemetryRecords'
            ],
            resources: ['*']
        }));
        // Add Systems Manager Parameter Store permissions for configuration
        this.bedrockRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'ssm:GetParameter',
                'ssm:GetParameters',
                'ssm:GetParametersByPath'
            ],
            resources: [
                `arn:aws:ssm:${config.region}:${this.account}:parameter/${config.regionPrefix}-${config.projectName}/*`
            ]
        }));
        // Add temporary file storage permissions (for Markitdown processing)
        tempBucket.grantReadWrite(this.bedrockRole);
        // Add additional S3 permissions for processing
        this.bedrockRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                's3:ListBucket',
                's3:GetBucketLocation',
                's3:GetBucketVersioning'
            ],
            resources: [tempBucket.bucketArn]
        }));
    }
    createLambdaFunctions(config, props, tempBucket) {
        // Create Markitdown dependencies layer
        const markitdownLayer = new lambda.LayerVersion(this, 'EmbeddingMarkitdownLayer', {
            layerVersionName: `${config.regionPrefix}-${config.projectName}-${config.environment}-Embedding-MarkitdownLayer`,
            description: 'Markitdown library and dependencies for document processing',
            code: lambda.Code.fromAsset('lambda/layers/markitdown'),
            compatibleRuntimes: [lambda.Runtime.PYTHON_3_11],
            compatibleArchitectures: [lambda.Architecture.X86_64]
        });
        // Common Lambda configuration
        const commonLambdaProps = {
            runtime: lambda.Runtime.PYTHON_3_11,
            timeout: aws_cdk_lib_1.Duration.minutes(15),
            memorySize: 1024,
            environment: {
                REGION: config.region,
                PROJECT_NAME: config.projectName,
                ENVIRONMENT: config.environment,
                DOCUMENTS_TABLE: props.documentsTable?.tableName || '',
                EMBEDDINGS_TABLE: props.embeddingsTable?.tableName || '',
                DOCUMENTS_BUCKET: props.documentsBucket?.bucketName || '',
                TEMP_PROCESSING_BUCKET: tempBucket.bucketName
            },
            logRetention: logs.RetentionDays.ONE_MONTH,
            tracing: lambda.Tracing.ACTIVE // X-Ray tracing enabled
        };
        // Document Processor Function with Markitdown Integration
        this.documentProcessorFunction = new lambda.Function(this, 'EmbeddingDocumentProcessorFunction', {
            ...commonLambdaProps,
            functionName: `${config.regionPrefix}-${config.projectName}-${config.environment}-Embedding-DocumentProcessor`,
            description: 'Process uploaded documents with Markitdown integration and extract text',
            handler: 'document_processor.lambda_handler',
            code: lambda.Code.fromAsset('lambda/documentprocessor'),
            timeout: aws_cdk_lib_1.Duration.minutes(15),
            memorySize: 2048, // Markitdown処理のためメモリを増加
            environment: {
                ...commonLambdaProps.environment,
                MARKITDOWN_ENVIRONMENT: config.environment,
                MARKITDOWN_CONFIG_PATH: '/opt/config/markitdown-config.json',
                ENABLE_MARKITDOWN: 'true',
                ENABLE_LANGCHAIN_FALLBACK: 'true',
                MAX_FILE_SIZE_MB: '50',
                PROCESSING_TIMEOUT_SECONDS: '300',
                LOG_LEVEL: config.environment === 'prod' ? 'INFO' : 'DEBUG'
            },
            layers: [markitdownLayer],
            role: this.bedrockRole
        });
        // Embedding Function
        if (config.features.ai.embedding) {
            this.embeddingFunction = new lambda.Function(this, 'EmbeddingFunction', {
                ...commonLambdaProps,
                functionName: `${config.regionPrefix}-${config.projectName}-${config.environment}-Embedding-Function`,
                description: 'Generate embeddings using Amazon Bedrock',
                handler: 'index.lambda_handler',
                code: lambda.Code.fromInline(`
import json
import boto3
import os
from typing import Dict, Any, List

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Embedding generation function
    Uses Amazon Bedrock to generate embeddings for text chunks
    """
    print(f"Generating embeddings for event: {json.dumps(event)}")
    
    bedrock = boto3.client('bedrock-runtime', region_name=os.environ['REGION'])
    
    # TODO: Implement embedding generation logic
    # 1. Use Bedrock Titan Embeddings model
    # 2. Generate embeddings for text chunks
    # 3. Store embeddings in DynamoDB
    # 4. Update OpenSearch index
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Embeddings generated successfully',
            'embeddingCount': event.get('chunkCount', 0)
        })
    }
        `),
                role: this.bedrockRole
            });
        }
        // RAG Query Function
        if (config.features.ai.rag) {
            this.ragQueryFunction = new lambda.Function(this, 'EmbeddingRagQueryFunction', {
                ...commonLambdaProps,
                functionName: `${config.regionPrefix}-${config.projectName}-${config.environment}-Embedding-RagQuery`,
                description: 'Handle RAG queries using retrieval and generation',
                handler: 'index.lambda_handler',
                code: lambda.Code.fromInline(`
import json
import boto3
import os
from typing import Dict, Any, List

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    RAG query function
    Retrieves relevant documents and generates responses using Bedrock
    """
    print(f"Processing RAG query: {json.dumps(event)}")
    
    bedrock = boto3.client('bedrock-runtime', region_name=os.environ['REGION'])
    
    query = event.get('query', '')
    user_id = event.get('userId', '')
    
    # TODO: Implement RAG logic
    # 1. Generate query embedding
    # 2. Search similar documents in OpenSearch
    # 3. Retrieve relevant document chunks
    # 4. Apply permission filtering based on user
    # 5. Generate response using Bedrock Claude/Titan
    # 6. Log query for audit purposes
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'query': query,
            'response': 'This is a placeholder response. Implement RAG logic here.',
            'sources': [],
            'userId': user_id
        })
    }
        `),
                role: this.bedrockRole
            });
        }
        // Grant permissions to Lambda functions
        if (props.documentsTable) {
            props.documentsTable.grantReadWriteData(this.documentProcessorFunction);
            if (this.embeddingFunction) {
                props.documentsTable.grantReadData(this.embeddingFunction);
            }
            if (this.ragQueryFunction) {
                props.documentsTable.grantReadData(this.ragQueryFunction);
            }
        }
        if (props.embeddingsTable) {
            if (this.embeddingFunction) {
                props.embeddingsTable.grantReadWriteData(this.embeddingFunction);
            }
            if (this.ragQueryFunction) {
                props.embeddingsTable.grantReadData(this.ragQueryFunction);
            }
        }
        if (props.documentsBucket) {
            props.documentsBucket.grantRead(this.documentProcessorFunction);
            if (this.embeddingFunction) {
                props.documentsBucket.grantRead(this.embeddingFunction);
            }
        }
        // Grant temporary bucket access to document processor
        tempBucket.grantReadWrite(this.documentProcessorFunction);
        // Grant CloudWatch metrics permissions
        this.documentProcessorFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'cloudwatch:PutMetricData'
            ],
            resources: ['*'],
            conditions: {
                StringEquals: {
                    'cloudwatch:namespace': `${config.regionPrefix}-${config.projectName}/Embedding`
                }
            }
        }));
    }
    /**
     * リージョンからregionPrefixを取得
     */
    getRegionPrefix(region) {
        const regionMapping = {
            'ap-northeast-1': 'TokyoRegion',
            'ap-northeast-3': 'OsakaRegion',
            'us-east-1': 'USEast1Region',
            'us-west-2': 'USWest2Region',
            'eu-west-1': 'EuropeRegion',
            'eu-central-1': 'FrankfurtRegion'
        };
        return regionMapping[region] || `${region.replace(/-/g, '')}Region`;
    }
}
exports.EmbeddingStack = EmbeddingStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW1iZWRkaW5nLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZW1iZWRkaW5nLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7R0FRRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCw2Q0FBeUU7QUFHekUsK0RBQWlEO0FBQ2pELHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MseURBQTJDO0FBQzNDLDJEQUE2QztBQUU3Qyx1REFBeUM7QUFXekMsTUFBYSxjQUFlLFNBQVEsbUJBQUs7SUFDaEMseUJBQXlCLENBQW1CO0lBQzVDLGlCQUFpQixDQUFtQjtJQUNwQyxnQkFBZ0IsQ0FBbUI7SUFDbkMsVUFBVSxDQUFlO0lBQ3pCLFdBQVcsQ0FBWTtJQUN2QixvQkFBb0IsQ0FBYTtJQUV4QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTBCO1FBQ2xFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFekIsMkJBQTJCO1FBQzNCLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxZQUFZLElBQUksSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDaEYsTUFBTSxjQUFjLEdBQUcsRUFBRSxHQUFHLE1BQU0sRUFBRSxZQUFZLEVBQUUsQ0FBQztRQUVuRCxvREFBb0Q7UUFDcEQsSUFBSSxDQUFDLG9CQUFvQixHQUFHLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUU1RSwrQkFBK0I7UUFDL0IsSUFBSSxjQUFjLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ3RELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ25ELENBQUM7UUFFRCwwQkFBMEI7UUFDMUIsSUFBSSxjQUFjLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN2QyxJQUFJLENBQUMsaUJBQWlCLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQ3BFLENBQUM7UUFFRCwwQkFBMEI7UUFDMUIsSUFBSSxjQUFjLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3BDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxjQUFjLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQy9FLENBQUM7SUFDSCxDQUFDO0lBRU8sZ0JBQWdCLENBQUMsTUFBdUIsRUFBRSxHQUFhO1FBQzdELElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUM3RCxXQUFXLEVBQUUsR0FBRyxNQUFNLENBQUMsWUFBWSxJQUFJLE1BQU0sQ0FBQyxXQUFXLElBQUksTUFBTSxDQUFDLFdBQVcsdUJBQXVCO1lBQ3RHLEdBQUc7WUFDSCxpQkFBaUIsRUFBRSxJQUFJO1NBQ3hCLENBQUMsQ0FBQztRQUVILG1EQUFtRDtRQUNuRCxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxzQkFBc0IsRUFBRTtZQUNsRCxZQUFZLEVBQUUsR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQy9CLEdBQUcsQ0FBQyxhQUFhLENBQUMsRUFBRSxFQUNwQixNQUFNLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQ3ZHO1lBQ0QsV0FBVyxFQUFFLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFdBQVc7WUFDN0MsV0FBVyxFQUFFLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFdBQVc7WUFDN0MsZUFBZSxFQUFFLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLGVBQWU7U0FDdEQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLDBCQUEwQixDQUFDLE1BQXVCO1FBQ3hELE1BQU0sVUFBVSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsK0JBQStCLEVBQUU7WUFDdEUsVUFBVSxFQUFFLEdBQUcsTUFBTSxDQUFDLFlBQVksSUFBSSxNQUFNLENBQUMsV0FBVyxJQUFJLE1BQU0sQ0FBQyxXQUFXLDRCQUE0QjtZQUMxRyxhQUFhLEVBQUUsTUFBTSxDQUFDLFdBQVcsS0FBSyxNQUFNLENBQUMsQ0FBQztnQkFDNUMsMkJBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLDJCQUFhLENBQUMsT0FBTztZQUM5QyxpQkFBaUIsRUFBRSxNQUFNLENBQUMsV0FBVyxLQUFLLE1BQU07WUFDaEQsU0FBUyxFQUFFLEtBQUs7WUFDaEIsY0FBYyxFQUFFO2dCQUNkO29CQUNFLEVBQUUsRUFBRSxpQkFBaUI7b0JBQ3JCLE9BQU8sRUFBRSxJQUFJO29CQUNiLFVBQVUsRUFBRSxzQkFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxXQUFXO29CQUN6QyxtQ0FBbUMsRUFBRSxzQkFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7aUJBQ3ZEO2FBQ0Y7WUFDRCxVQUFVLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixDQUFDLFVBQVU7WUFDMUMsaUJBQWlCLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFNBQVM7WUFDakQsVUFBVSxFQUFFLElBQUk7U0FDakIsQ0FBQyxDQUFDO1FBRUgsT0FBTyxVQUFVLENBQUM7SUFDcEIsQ0FBQztJQUVPLGlCQUFpQixDQUFDLE1BQXVCLEVBQUUsVUFBcUI7UUFDdEUsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQzVELFFBQVEsRUFBRSxHQUFHLE1BQU0sQ0FBQyxZQUFZLElBQUksTUFBTSxDQUFDLFdBQVcsSUFBSSxNQUFNLENBQUMsV0FBVyx3QkFBd0I7WUFDcEcsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLHNCQUFzQixDQUFDO1lBQzNELGVBQWUsRUFBRTtnQkFDZixHQUFHLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLDBDQUEwQyxDQUFDO2dCQUN0RixHQUFHLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLDhDQUE4QyxDQUFDO2FBQzNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsMEJBQTBCO1FBQzFCLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUNuRCxNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sRUFBRTtnQkFDUCxxQkFBcUI7Z0JBQ3JCLHVDQUF1QztnQkFDdkMsOEJBQThCO2dCQUM5Qiw0QkFBNEI7YUFDN0I7WUFDRCxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7U0FDakIsQ0FBQyxDQUFDLENBQUM7UUFFSiw0REFBNEQ7UUFDNUQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ25ELE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDeEIsT0FBTyxFQUFFO2dCQUNQLHFCQUFxQjtnQkFDckIsc0JBQXNCO2dCQUN0QixtQkFBbUI7Z0JBQ25CLHdCQUF3QjtnQkFDeEIseUJBQXlCO2FBQzFCO1lBQ0QsU0FBUyxFQUFFO2dCQUNULGdCQUFnQixNQUFNLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxPQUFPLDBCQUEwQixNQUFNLENBQUMsWUFBWSxJQUFJLE1BQU0sQ0FBQyxXQUFXLElBQUk7Z0JBQ3BILGdCQUFnQixNQUFNLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxPQUFPLDBCQUEwQixNQUFNLENBQUMsWUFBWSxJQUFJLE1BQU0sQ0FBQyxXQUFXLE1BQU07YUFDdkg7U0FDRixDQUFDLENBQUMsQ0FBQztRQUVKLGdDQUFnQztRQUNoQyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDbkQsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztZQUN4QixPQUFPLEVBQUU7Z0JBQ1AsdUJBQXVCO2dCQUN2QiwwQkFBMEI7YUFDM0I7WUFDRCxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7U0FDakIsQ0FBQyxDQUFDLENBQUM7UUFFSixvRUFBb0U7UUFDcEUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ25ELE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDeEIsT0FBTyxFQUFFO2dCQUNQLGtCQUFrQjtnQkFDbEIsbUJBQW1CO2dCQUNuQix5QkFBeUI7YUFDMUI7WUFDRCxTQUFTLEVBQUU7Z0JBQ1QsZUFBZSxNQUFNLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxPQUFPLGNBQWMsTUFBTSxDQUFDLFlBQVksSUFBSSxNQUFNLENBQUMsV0FBVyxJQUFJO2FBQ3hHO1NBQ0YsQ0FBQyxDQUFDLENBQUM7UUFFSixxRUFBcUU7UUFDckUsVUFBVSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFNUMsK0NBQStDO1FBQy9DLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUNuRCxNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sRUFBRTtnQkFDUCxlQUFlO2dCQUNmLHNCQUFzQjtnQkFDdEIsd0JBQXdCO2FBQ3pCO1lBQ0QsU0FBUyxFQUFFLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQztTQUNsQyxDQUFDLENBQUMsQ0FBQztJQUNOLENBQUM7SUFFTyxxQkFBcUIsQ0FBQyxNQUF1QixFQUFFLEtBQTBCLEVBQUUsVUFBcUI7UUFDdEcsdUNBQXVDO1FBQ3ZDLE1BQU0sZUFBZSxHQUFHLElBQUksTUFBTSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsMEJBQTBCLEVBQUU7WUFDaEYsZ0JBQWdCLEVBQUUsR0FBRyxNQUFNLENBQUMsWUFBWSxJQUFJLE1BQU0sQ0FBQyxXQUFXLElBQUksTUFBTSxDQUFDLFdBQVcsNEJBQTRCO1lBQ2hILFdBQVcsRUFBRSw2REFBNkQ7WUFDMUUsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLDBCQUEwQixDQUFDO1lBQ3ZELGtCQUFrQixFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUM7WUFDaEQsdUJBQXVCLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQztTQUN0RCxDQUFDLENBQUM7UUFFSCw4QkFBOEI7UUFDOUIsTUFBTSxpQkFBaUIsR0FBRztZQUN4QixPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxzQkFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDN0IsVUFBVSxFQUFFLElBQUk7WUFDaEIsV0FBVyxFQUFFO2dCQUNYLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTTtnQkFDckIsWUFBWSxFQUFFLE1BQU0sQ0FBQyxXQUFXO2dCQUNoQyxXQUFXLEVBQUUsTUFBTSxDQUFDLFdBQVc7Z0JBQy9CLGVBQWUsRUFBRSxLQUFLLENBQUMsY0FBYyxFQUFFLFNBQVMsSUFBSSxFQUFFO2dCQUN0RCxnQkFBZ0IsRUFBRSxLQUFLLENBQUMsZUFBZSxFQUFFLFNBQVMsSUFBSSxFQUFFO2dCQUN4RCxnQkFBZ0IsRUFBRSxLQUFLLENBQUMsZUFBZSxFQUFFLFVBQVUsSUFBSSxFQUFFO2dCQUN6RCxzQkFBc0IsRUFBRSxVQUFVLENBQUMsVUFBVTthQUM5QztZQUNELFlBQVksRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVM7WUFDMUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLHdCQUF3QjtTQUN4RCxDQUFDO1FBRUYsMERBQTBEO1FBQzFELElBQUksQ0FBQyx5QkFBeUIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLG9DQUFvQyxFQUFFO1lBQy9GLEdBQUcsaUJBQWlCO1lBQ3BCLFlBQVksRUFBRSxHQUFHLE1BQU0sQ0FBQyxZQUFZLElBQUksTUFBTSxDQUFDLFdBQVcsSUFBSSxNQUFNLENBQUMsV0FBVyw4QkFBOEI7WUFDOUcsV0FBVyxFQUFFLHlFQUF5RTtZQUN0RixPQUFPLEVBQUUsbUNBQW1DO1lBQzVDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQywwQkFBMEIsQ0FBQztZQUN2RCxPQUFPLEVBQUUsc0JBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQzdCLFVBQVUsRUFBRSxJQUFJLEVBQUUsd0JBQXdCO1lBQzFDLFdBQVcsRUFBRTtnQkFDWCxHQUFHLGlCQUFpQixDQUFDLFdBQVc7Z0JBQ2hDLHNCQUFzQixFQUFFLE1BQU0sQ0FBQyxXQUFXO2dCQUMxQyxzQkFBc0IsRUFBRSxvQ0FBb0M7Z0JBQzVELGlCQUFpQixFQUFFLE1BQU07Z0JBQ3pCLHlCQUF5QixFQUFFLE1BQU07Z0JBQ2pDLGdCQUFnQixFQUFFLElBQUk7Z0JBQ3RCLDBCQUEwQixFQUFFLEtBQUs7Z0JBQ2pDLFNBQVMsRUFBRSxNQUFNLENBQUMsV0FBVyxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPO2FBQzVEO1lBQ0QsTUFBTSxFQUFFLENBQUMsZUFBZSxDQUFDO1lBQ3pCLElBQUksRUFBRSxJQUFJLENBQUMsV0FBVztTQUN2QixDQUFDLENBQUM7UUFFSCxxQkFBcUI7UUFDckIsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNqQyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtnQkFDdEUsR0FBRyxpQkFBaUI7Z0JBQ3BCLFlBQVksRUFBRSxHQUFHLE1BQU0sQ0FBQyxZQUFZLElBQUksTUFBTSxDQUFDLFdBQVcsSUFBSSxNQUFNLENBQUMsV0FBVyxxQkFBcUI7Z0JBQ3JHLFdBQVcsRUFBRSwwQ0FBMEM7Z0JBQ3ZELE9BQU8sRUFBRSxzQkFBc0I7Z0JBQy9CLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztTQTRCNUIsQ0FBQztnQkFDRixJQUFJLEVBQUUsSUFBSSxDQUFDLFdBQVc7YUFDdkIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELHFCQUFxQjtRQUNyQixJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQzNCLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLDJCQUEyQixFQUFFO2dCQUM3RSxHQUFHLGlCQUFpQjtnQkFDcEIsWUFBWSxFQUFFLEdBQUcsTUFBTSxDQUFDLFlBQVksSUFBSSxNQUFNLENBQUMsV0FBVyxJQUFJLE1BQU0sQ0FBQyxXQUFXLHFCQUFxQjtnQkFDckcsV0FBVyxFQUFFLG1EQUFtRDtnQkFDaEUsT0FBTyxFQUFFLHNCQUFzQjtnQkFDL0IsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztTQW1DNUIsQ0FBQztnQkFDRixJQUFJLEVBQUUsSUFBSSxDQUFDLFdBQVc7YUFDdkIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELHdDQUF3QztRQUN4QyxJQUFJLEtBQUssQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN6QixLQUFLLENBQUMsY0FBYyxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1lBQ3hFLElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7Z0JBQzNCLEtBQUssQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1lBQzdELENBQUM7WUFDRCxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO2dCQUMxQixLQUFLLENBQUMsY0FBYyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztZQUM1RCxDQUFDO1FBQ0gsQ0FBQztRQUVELElBQUksS0FBSyxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQzFCLElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7Z0JBQzNCLEtBQUssQ0FBQyxlQUFlLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDbkUsQ0FBQztZQUNELElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7Z0JBQzFCLEtBQUssQ0FBQyxlQUFlLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1lBQzdELENBQUM7UUFDSCxDQUFDO1FBRUQsSUFBSSxLQUFLLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDMUIsS0FBSyxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLENBQUM7WUFDaEUsSUFBSSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztnQkFDM0IsS0FBSyxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDMUQsQ0FBQztRQUNILENBQUM7UUFFRCxzREFBc0Q7UUFDdEQsVUFBVSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMseUJBQXlCLENBQUMsQ0FBQztRQUUxRCx1Q0FBdUM7UUFDdkMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLGVBQWUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDckUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztZQUN4QixPQUFPLEVBQUU7Z0JBQ1AsMEJBQTBCO2FBQzNCO1lBQ0QsU0FBUyxFQUFFLENBQUMsR0FBRyxDQUFDO1lBQ2hCLFVBQVUsRUFBRTtnQkFDVixZQUFZLEVBQUU7b0JBQ1osc0JBQXNCLEVBQUUsR0FBRyxNQUFNLENBQUMsWUFBWSxJQUFJLE1BQU0sQ0FBQyxXQUFXLFlBQVk7aUJBQ2pGO2FBQ0Y7U0FDRixDQUFDLENBQUMsQ0FBQztJQUNOLENBQUM7SUFFRDs7T0FFRztJQUNLLGVBQWUsQ0FBQyxNQUFjO1FBQ3BDLE1BQU0sYUFBYSxHQUEyQjtZQUM1QyxnQkFBZ0IsRUFBRSxhQUFhO1lBQy9CLGdCQUFnQixFQUFFLGFBQWE7WUFDL0IsV0FBVyxFQUFFLGVBQWU7WUFDNUIsV0FBVyxFQUFFLGVBQWU7WUFDNUIsV0FBVyxFQUFFLGNBQWM7WUFDM0IsY0FBYyxFQUFFLGlCQUFpQjtTQUNsQyxDQUFDO1FBRUYsT0FBTyxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsUUFBUSxDQUFDO0lBQ3RFLENBQUM7Q0FDRjtBQWhXRCx3Q0FnV0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEVtYmVkZGluZyBTdGFja1xuICogRW1iZWRkaW5n57Wx5ZCI44K544K/44OD44KvIC0g57Wx5LiA5ZG95ZCN6KaP5YmH6YGp55SoXG4gKiBcbiAqIOe1seWQiOapn+iDvTpcbiAqIC0gQVdTIEJhdGNo44CBRUNT44CBTGFtYmRh44CBQmVkcm9ja+OAgeWfi+OCgei+vOOBv+OAgVJBR+OAgeaWh+abuOWHpueQhlxuICogLSBDb21wb25lbnQ9XCJFbWJlZGRpbmdcIuOBq+OCiOOCi+e1seS4gOWRveWQjeimj+WJh1xuICogLSDoqK3lrprjg7vlpInmm7TlrrnmmJPmgKfjgpLmi4Xkv53jgZnjgovjg6Ljgrjjg6Xjg7zjg6vljJbjgqLjg7zjgq3jg4bjgq/jg4Hjg6NcbiAqL1xuXG5pbXBvcnQgeyBTdGFjaywgU3RhY2tQcm9wcywgRHVyYXRpb24sIFJlbW92YWxQb2xpY3kgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBlY3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcyc7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0IHsgR2xvYmFsUmFnQ29uZmlnIH0gZnJvbSAnLi4vLi4vdHlwZXMvZ2xvYmFsLWNvbmZpZyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRW1iZWRkaW5nU3RhY2tQcm9wcyBleHRlbmRzIFN0YWNrUHJvcHMge1xuICBjb25maWc6IEdsb2JhbFJhZ0NvbmZpZztcbiAgdnBjPzogZWMyLklWcGM7XG4gIGRvY3VtZW50c1RhYmxlPzogZHluYW1vZGIuSVRhYmxlO1xuICBlbWJlZGRpbmdzVGFibGU/OiBkeW5hbW9kYi5JVGFibGU7XG4gIGRvY3VtZW50c0J1Y2tldD86IHMzLklCdWNrZXQ7XG59XG5cbmV4cG9ydCBjbGFzcyBFbWJlZGRpbmdTdGFjayBleHRlbmRzIFN0YWNrIHtcbiAgcHVibGljIGRvY3VtZW50UHJvY2Vzc29yRnVuY3Rpb24/OiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyBlbWJlZGRpbmdGdW5jdGlvbj86IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJhZ1F1ZXJ5RnVuY3Rpb24/OiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyBlY3NDbHVzdGVyPzogZWNzLkNsdXN0ZXI7XG4gIHB1YmxpYyBiZWRyb2NrUm9sZT86IGlhbS5Sb2xlO1xuICBwdWJsaWMgdGVtcFByb2Nlc3NpbmdCdWNrZXQ/OiBzMy5CdWNrZXQ7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEVtYmVkZGluZ1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgY29uZmlnIH0gPSBwcm9wcztcbiAgICBcbiAgICAvLyDntbHkuIDlkb3lkI3opo/liYfjga7jgZ/jgoHjga5yZWdpb25QcmVmaXjoqK3lrppcbiAgICBjb25zdCByZWdpb25QcmVmaXggPSBjb25maWcucmVnaW9uUHJlZml4IHx8IHRoaXMuZ2V0UmVnaW9uUHJlZml4KGNvbmZpZy5yZWdpb24pO1xuICAgIGNvbnN0IGVuaGFuY2VkQ29uZmlnID0geyAuLi5jb25maWcsIHJlZ2lvblByZWZpeCB9O1xuXG4gICAgLy8gQ3JlYXRlIHRlbXBvcmFyeSBwcm9jZXNzaW5nIGJ1Y2tldCBmb3IgTWFya2l0ZG93blxuICAgIHRoaXMudGVtcFByb2Nlc3NpbmdCdWNrZXQgPSB0aGlzLmNyZWF0ZVRlbXBQcm9jZXNzaW5nQnVja2V0KGVuaGFuY2VkQ29uZmlnKTtcblxuICAgIC8vIENyZWF0ZSBFQ1MgQ2x1c3RlciBpZiBuZWVkZWRcbiAgICBpZiAoZW5oYW5jZWRDb25maWcuZW1iZWRkaW5nLmVjcy5lbmFibGVkICYmIHByb3BzLnZwYykge1xuICAgICAgdGhpcy5jcmVhdGVFY3NDbHVzdGVyKGVuaGFuY2VkQ29uZmlnLCBwcm9wcy52cGMpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSBCZWRyb2NrIElBTSBSb2xlXG4gICAgaWYgKGVuaGFuY2VkQ29uZmlnLmZlYXR1cmVzLmFpLmJlZHJvY2spIHtcbiAgICAgIHRoaXMuY3JlYXRlQmVkcm9ja1JvbGUoZW5oYW5jZWRDb25maWcsIHRoaXMudGVtcFByb2Nlc3NpbmdCdWNrZXQpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSBMYW1iZGEgZnVuY3Rpb25zXG4gICAgaWYgKGVuaGFuY2VkQ29uZmlnLmVtYmVkZGluZy5sYW1iZGEpIHtcbiAgICAgIHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb25zKGVuaGFuY2VkQ29uZmlnLCBwcm9wcywgdGhpcy50ZW1wUHJvY2Vzc2luZ0J1Y2tldCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVFY3NDbHVzdGVyKGNvbmZpZzogR2xvYmFsUmFnQ29uZmlnLCB2cGM6IGVjMi5JVnBjKTogdm9pZCB7XG4gICAgdGhpcy5lY3NDbHVzdGVyID0gbmV3IGVjcy5DbHVzdGVyKHRoaXMsICdFbWJlZGRpbmdFY3NDbHVzdGVyJywge1xuICAgICAgY2x1c3Rlck5hbWU6IGAke2NvbmZpZy5yZWdpb25QcmVmaXh9LSR7Y29uZmlnLnByb2plY3ROYW1lfS0ke2NvbmZpZy5lbnZpcm9ubWVudH0tRW1iZWRkaW5nLUVjc0NsdXN0ZXJgLFxuICAgICAgdnBjLFxuICAgICAgY29udGFpbmVySW5zaWdodHM6IHRydWVcbiAgICB9KTtcblxuICAgIC8vIEFkZCBFQzIgY2FwYWNpdHkgcHJvdmlkZXIgd2l0aCBFQ1MgY29uZmlndXJhdGlvblxuICAgIHRoaXMuZWNzQ2x1c3Rlci5hZGRDYXBhY2l0eSgnRW1iZWRkaW5nRUMyQ2FwYWNpdHknLCB7XG4gICAgICBpbnN0YW5jZVR5cGU6IGVjMi5JbnN0YW5jZVR5cGUub2YoXG4gICAgICAgIGVjMi5JbnN0YW5jZUNsYXNzLk01LCBcbiAgICAgICAgY29uZmlnLmVtYmVkZGluZy5lY3MuaW5zdGFuY2VUeXBlLmluY2x1ZGVzKCdsYXJnZScpID8gZWMyLkluc3RhbmNlU2l6ZS5MQVJHRSA6IGVjMi5JbnN0YW5jZVNpemUuWExBUkdFXG4gICAgICApLFxuICAgICAgbWluQ2FwYWNpdHk6IGNvbmZpZy5lbWJlZGRpbmcuZWNzLm1pbkNhcGFjaXR5LFxuICAgICAgbWF4Q2FwYWNpdHk6IGNvbmZpZy5lbWJlZGRpbmcuZWNzLm1heENhcGFjaXR5LFxuICAgICAgZGVzaXJlZENhcGFjaXR5OiBjb25maWcuZW1iZWRkaW5nLmVjcy5kZXNpcmVkQ2FwYWNpdHlcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlVGVtcFByb2Nlc3NpbmdCdWNrZXQoY29uZmlnOiBHbG9iYWxSYWdDb25maWcpOiBzMy5CdWNrZXQge1xuICAgIGNvbnN0IHRlbXBCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdFbWJlZGRpbmdUZW1wUHJvY2Vzc2luZ0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGAke2NvbmZpZy5yZWdpb25QcmVmaXh9LSR7Y29uZmlnLnByb2plY3ROYW1lfS0ke2NvbmZpZy5lbnZpcm9ubWVudH0tZW1iZWRkaW5nLXRlbXAtcHJvY2Vzc2luZ2AsXG4gICAgICByZW1vdmFsUG9saWN5OiBjb25maWcuZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IFxuICAgICAgICBSZW1vdmFsUG9saWN5LlJFVEFJTiA6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiBjb25maWcuZW52aXJvbm1lbnQgIT09ICdwcm9kJyxcbiAgICAgIHZlcnNpb25lZDogZmFsc2UsXG4gICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdEZWxldGVUZW1wRmlsZXMnLFxuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgZXhwaXJhdGlvbjogRHVyYXRpb24uZGF5cygxKSwgLy8gMeaXpeW+jOOBq+iHquWLleWJiumZpFxuICAgICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZEFmdGVyOiBEdXJhdGlvbi5ob3VycygxKVxuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIGVuZm9yY2VTU0w6IHRydWVcbiAgICB9KTtcblxuICAgIHJldHVybiB0ZW1wQnVja2V0O1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVCZWRyb2NrUm9sZShjb25maWc6IEdsb2JhbFJhZ0NvbmZpZywgdGVtcEJ1Y2tldDogczMuQnVja2V0KTogdm9pZCB7XG4gICAgdGhpcy5iZWRyb2NrUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnRW1iZWRkaW5nQmVkcm9ja1JvbGUnLCB7XG4gICAgICByb2xlTmFtZTogYCR7Y29uZmlnLnJlZ2lvblByZWZpeH0tJHtjb25maWcucHJvamVjdE5hbWV9LSR7Y29uZmlnLmVudmlyb25tZW50fS1FbWJlZGRpbmctQmVkcm9ja1JvbGVgLFxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlJyksXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYVZQQ0FjY2Vzc0V4ZWN1dGlvblJvbGUnKVxuICAgICAgXVxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEJlZHJvY2sgcGVybWlzc2lvbnNcbiAgICB0aGlzLmJlZHJvY2tSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWwnLFxuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbFdpdGhSZXNwb25zZVN0cmVhbScsXG4gICAgICAgICdiZWRyb2NrOkxpc3RGb3VuZGF0aW9uTW9kZWxzJyxcbiAgICAgICAgJ2JlZHJvY2s6R2V0Rm91bmRhdGlvbk1vZGVsJ1xuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ11cbiAgICB9KSk7XG5cbiAgICAvLyBBZGQgQ2xvdWRXYXRjaCBMb2dzIHBlcm1pc3Npb25zIGZvciBNYXJraXRkb3duIHByb2Nlc3NpbmdcbiAgICB0aGlzLmJlZHJvY2tSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nR3JvdXAnLFxuICAgICAgICAnbG9nczpDcmVhdGVMb2dTdHJlYW0nLFxuICAgICAgICAnbG9nczpQdXRMb2dFdmVudHMnLFxuICAgICAgICAnbG9nczpEZXNjcmliZUxvZ0dyb3VwcycsXG4gICAgICAgICdsb2dzOkRlc2NyaWJlTG9nU3RyZWFtcydcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6bG9nczoke2NvbmZpZy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpsb2ctZ3JvdXA6L2F3cy9sYW1iZGEvJHtjb25maWcucmVnaW9uUHJlZml4fS0ke2NvbmZpZy5wcm9qZWN0TmFtZX0tKmAsXG4gICAgICAgIGBhcm46YXdzOmxvZ3M6JHtjb25maWcucmVnaW9ufToke3RoaXMuYWNjb3VudH06bG9nLWdyb3VwOi9hd3MvbGFtYmRhLyR7Y29uZmlnLnJlZ2lvblByZWZpeH0tJHtjb25maWcucHJvamVjdE5hbWV9LSo6KmBcbiAgICAgIF1cbiAgICB9KSk7XG5cbiAgICAvLyBBZGQgWC1SYXkgdHJhY2luZyBwZXJtaXNzaW9uc1xuICAgIHRoaXMuYmVkcm9ja1JvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAneHJheTpQdXRUcmFjZVNlZ21lbnRzJyxcbiAgICAgICAgJ3hyYXk6UHV0VGVsZW1ldHJ5UmVjb3JkcydcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgfSkpO1xuXG4gICAgLy8gQWRkIFN5c3RlbXMgTWFuYWdlciBQYXJhbWV0ZXIgU3RvcmUgcGVybWlzc2lvbnMgZm9yIGNvbmZpZ3VyYXRpb25cbiAgICB0aGlzLmJlZHJvY2tSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXInLFxuICAgICAgICAnc3NtOkdldFBhcmFtZXRlcnMnLFxuICAgICAgICAnc3NtOkdldFBhcmFtZXRlcnNCeVBhdGgnXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOnNzbToke2NvbmZpZy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpwYXJhbWV0ZXIvJHtjb25maWcucmVnaW9uUHJlZml4fS0ke2NvbmZpZy5wcm9qZWN0TmFtZX0vKmBcbiAgICAgIF1cbiAgICB9KSk7XG5cbiAgICAvLyBBZGQgdGVtcG9yYXJ5IGZpbGUgc3RvcmFnZSBwZXJtaXNzaW9ucyAoZm9yIE1hcmtpdGRvd24gcHJvY2Vzc2luZylcbiAgICB0ZW1wQnVja2V0LmdyYW50UmVhZFdyaXRlKHRoaXMuYmVkcm9ja1JvbGUpO1xuICAgIFxuICAgIC8vIEFkZCBhZGRpdGlvbmFsIFMzIHBlcm1pc3Npb25zIGZvciBwcm9jZXNzaW5nXG4gICAgdGhpcy5iZWRyb2NrUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdzMzpMaXN0QnVja2V0JyxcbiAgICAgICAgJ3MzOkdldEJ1Y2tldExvY2F0aW9uJyxcbiAgICAgICAgJ3MzOkdldEJ1Y2tldFZlcnNpb25pbmcnXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbdGVtcEJ1Y2tldC5idWNrZXRBcm5dXG4gICAgfSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVMYW1iZGFGdW5jdGlvbnMoY29uZmlnOiBHbG9iYWxSYWdDb25maWcsIHByb3BzOiBFbWJlZGRpbmdTdGFja1Byb3BzLCB0ZW1wQnVja2V0OiBzMy5CdWNrZXQpOiB2b2lkIHtcbiAgICAvLyBDcmVhdGUgTWFya2l0ZG93biBkZXBlbmRlbmNpZXMgbGF5ZXJcbiAgICBjb25zdCBtYXJraXRkb3duTGF5ZXIgPSBuZXcgbGFtYmRhLkxheWVyVmVyc2lvbih0aGlzLCAnRW1iZWRkaW5nTWFya2l0ZG93bkxheWVyJywge1xuICAgICAgbGF5ZXJWZXJzaW9uTmFtZTogYCR7Y29uZmlnLnJlZ2lvblByZWZpeH0tJHtjb25maWcucHJvamVjdE5hbWV9LSR7Y29uZmlnLmVudmlyb25tZW50fS1FbWJlZGRpbmctTWFya2l0ZG93bkxheWVyYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTWFya2l0ZG93biBsaWJyYXJ5IGFuZCBkZXBlbmRlbmNpZXMgZm9yIGRvY3VtZW50IHByb2Nlc3NpbmcnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvbGF5ZXJzL21hcmtpdGRvd24nKSxcbiAgICAgIGNvbXBhdGlibGVSdW50aW1lczogW2xhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExXSxcbiAgICAgIGNvbXBhdGlibGVBcmNoaXRlY3R1cmVzOiBbbGFtYmRhLkFyY2hpdGVjdHVyZS5YODZfNjRdXG4gICAgfSk7XG5cbiAgICAvLyBDb21tb24gTGFtYmRhIGNvbmZpZ3VyYXRpb25cbiAgICBjb25zdCBjb21tb25MYW1iZGFQcm9wcyA9IHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxuICAgICAgdGltZW91dDogRHVyYXRpb24ubWludXRlcygxNSksXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgUkVHSU9OOiBjb25maWcucmVnaW9uLFxuICAgICAgICBQUk9KRUNUX05BTUU6IGNvbmZpZy5wcm9qZWN0TmFtZSxcbiAgICAgICAgRU5WSVJPTk1FTlQ6IGNvbmZpZy5lbnZpcm9ubWVudCxcbiAgICAgICAgRE9DVU1FTlRTX1RBQkxFOiBwcm9wcy5kb2N1bWVudHNUYWJsZT8udGFibGVOYW1lIHx8ICcnLFxuICAgICAgICBFTUJFRERJTkdTX1RBQkxFOiBwcm9wcy5lbWJlZGRpbmdzVGFibGU/LnRhYmxlTmFtZSB8fCAnJyxcbiAgICAgICAgRE9DVU1FTlRTX0JVQ0tFVDogcHJvcHMuZG9jdW1lbnRzQnVja2V0Py5idWNrZXROYW1lIHx8ICcnLFxuICAgICAgICBURU1QX1BST0NFU1NJTkdfQlVDS0VUOiB0ZW1wQnVja2V0LmJ1Y2tldE5hbWVcbiAgICAgIH0sXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkUgLy8gWC1SYXkgdHJhY2luZyBlbmFibGVkXG4gICAgfTtcblxuICAgIC8vIERvY3VtZW50IFByb2Nlc3NvciBGdW5jdGlvbiB3aXRoIE1hcmtpdGRvd24gSW50ZWdyYXRpb25cbiAgICB0aGlzLmRvY3VtZW50UHJvY2Vzc29yRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdFbWJlZGRpbmdEb2N1bWVudFByb2Nlc3NvckZ1bmN0aW9uJywge1xuICAgICAgLi4uY29tbW9uTGFtYmRhUHJvcHMsXG4gICAgICBmdW5jdGlvbk5hbWU6IGAke2NvbmZpZy5yZWdpb25QcmVmaXh9LSR7Y29uZmlnLnByb2plY3ROYW1lfS0ke2NvbmZpZy5lbnZpcm9ubWVudH0tRW1iZWRkaW5nLURvY3VtZW50UHJvY2Vzc29yYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUHJvY2VzcyB1cGxvYWRlZCBkb2N1bWVudHMgd2l0aCBNYXJraXRkb3duIGludGVncmF0aW9uIGFuZCBleHRyYWN0IHRleHQnLFxuICAgICAgaGFuZGxlcjogJ2RvY3VtZW50X3Byb2Nlc3Nvci5sYW1iZGFfaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9kb2N1bWVudHByb2Nlc3NvcicpLFxuICAgICAgdGltZW91dDogRHVyYXRpb24ubWludXRlcygxNSksXG4gICAgICBtZW1vcnlTaXplOiAyMDQ4LCAvLyBNYXJraXRkb3du5Yem55CG44Gu44Gf44KB44Oh44Oi44Oq44KS5aKX5YqgXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25MYW1iZGFQcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgICAgTUFSS0lURE9XTl9FTlZJUk9OTUVOVDogY29uZmlnLmVudmlyb25tZW50LFxuICAgICAgICBNQVJLSVRET1dOX0NPTkZJR19QQVRIOiAnL29wdC9jb25maWcvbWFya2l0ZG93bi1jb25maWcuanNvbicsXG4gICAgICAgIEVOQUJMRV9NQVJLSVRET1dOOiAndHJ1ZScsXG4gICAgICAgIEVOQUJMRV9MQU5HQ0hBSU5fRkFMTEJBQ0s6ICd0cnVlJyxcbiAgICAgICAgTUFYX0ZJTEVfU0laRV9NQjogJzUwJyxcbiAgICAgICAgUFJPQ0VTU0lOR19USU1FT1VUX1NFQ09ORFM6ICczMDAnLFxuICAgICAgICBMT0dfTEVWRUw6IGNvbmZpZy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gJ0lORk8nIDogJ0RFQlVHJ1xuICAgICAgfSxcbiAgICAgIGxheWVyczogW21hcmtpdGRvd25MYXllcl0sXG4gICAgICByb2xlOiB0aGlzLmJlZHJvY2tSb2xlXG4gICAgfSk7XG5cbiAgICAvLyBFbWJlZGRpbmcgRnVuY3Rpb25cbiAgICBpZiAoY29uZmlnLmZlYXR1cmVzLmFpLmVtYmVkZGluZykge1xuICAgICAgdGhpcy5lbWJlZGRpbmdGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0VtYmVkZGluZ0Z1bmN0aW9uJywge1xuICAgICAgICAuLi5jb21tb25MYW1iZGFQcm9wcyxcbiAgICAgICAgZnVuY3Rpb25OYW1lOiBgJHtjb25maWcucmVnaW9uUHJlZml4fS0ke2NvbmZpZy5wcm9qZWN0TmFtZX0tJHtjb25maWcuZW52aXJvbm1lbnR9LUVtYmVkZGluZy1GdW5jdGlvbmAsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnR2VuZXJhdGUgZW1iZWRkaW5ncyB1c2luZyBBbWF6b24gQmVkcm9jaycsXG4gICAgICAgIGhhbmRsZXI6ICdpbmRleC5sYW1iZGFfaGFuZGxlcicsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuaW1wb3J0IGpzb25cbmltcG9ydCBib3RvM1xuaW1wb3J0IG9zXG5mcm9tIHR5cGluZyBpbXBvcnQgRGljdCwgQW55LCBMaXN0XG5cbmRlZiBsYW1iZGFfaGFuZGxlcihldmVudDogRGljdFtzdHIsIEFueV0sIGNvbnRleHQ6IEFueSkgLT4gRGljdFtzdHIsIEFueV06XG4gICAgXCJcIlwiXG4gICAgRW1iZWRkaW5nIGdlbmVyYXRpb24gZnVuY3Rpb25cbiAgICBVc2VzIEFtYXpvbiBCZWRyb2NrIHRvIGdlbmVyYXRlIGVtYmVkZGluZ3MgZm9yIHRleHQgY2h1bmtzXG4gICAgXCJcIlwiXG4gICAgcHJpbnQoZlwiR2VuZXJhdGluZyBlbWJlZGRpbmdzIGZvciBldmVudDoge2pzb24uZHVtcHMoZXZlbnQpfVwiKVxuICAgIFxuICAgIGJlZHJvY2sgPSBib3RvMy5jbGllbnQoJ2JlZHJvY2stcnVudGltZScsIHJlZ2lvbl9uYW1lPW9zLmVudmlyb25bJ1JFR0lPTiddKVxuICAgIFxuICAgICMgVE9ETzogSW1wbGVtZW50IGVtYmVkZGluZyBnZW5lcmF0aW9uIGxvZ2ljXG4gICAgIyAxLiBVc2UgQmVkcm9jayBUaXRhbiBFbWJlZGRpbmdzIG1vZGVsXG4gICAgIyAyLiBHZW5lcmF0ZSBlbWJlZGRpbmdzIGZvciB0ZXh0IGNodW5rc1xuICAgICMgMy4gU3RvcmUgZW1iZWRkaW5ncyBpbiBEeW5hbW9EQlxuICAgICMgNC4gVXBkYXRlIE9wZW5TZWFyY2ggaW5kZXhcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgICAnc3RhdHVzQ29kZSc6IDIwMCxcbiAgICAgICAgJ2JvZHknOiBqc29uLmR1bXBzKHtcbiAgICAgICAgICAgICdtZXNzYWdlJzogJ0VtYmVkZGluZ3MgZ2VuZXJhdGVkIHN1Y2Nlc3NmdWxseScsXG4gICAgICAgICAgICAnZW1iZWRkaW5nQ291bnQnOiBldmVudC5nZXQoJ2NodW5rQ291bnQnLCAwKVxuICAgICAgICB9KVxuICAgIH1cbiAgICAgICAgYCksXG4gICAgICAgIHJvbGU6IHRoaXMuYmVkcm9ja1JvbGVcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFJBRyBRdWVyeSBGdW5jdGlvblxuICAgIGlmIChjb25maWcuZmVhdHVyZXMuYWkucmFnKSB7XG4gICAgICB0aGlzLnJhZ1F1ZXJ5RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdFbWJlZGRpbmdSYWdRdWVyeUZ1bmN0aW9uJywge1xuICAgICAgICAuLi5jb21tb25MYW1iZGFQcm9wcyxcbiAgICAgICAgZnVuY3Rpb25OYW1lOiBgJHtjb25maWcucmVnaW9uUHJlZml4fS0ke2NvbmZpZy5wcm9qZWN0TmFtZX0tJHtjb25maWcuZW52aXJvbm1lbnR9LUVtYmVkZGluZy1SYWdRdWVyeWAsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnSGFuZGxlIFJBRyBxdWVyaWVzIHVzaW5nIHJldHJpZXZhbCBhbmQgZ2VuZXJhdGlvbicsXG4gICAgICAgIGhhbmRsZXI6ICdpbmRleC5sYW1iZGFfaGFuZGxlcicsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuaW1wb3J0IGpzb25cbmltcG9ydCBib3RvM1xuaW1wb3J0IG9zXG5mcm9tIHR5cGluZyBpbXBvcnQgRGljdCwgQW55LCBMaXN0XG5cbmRlZiBsYW1iZGFfaGFuZGxlcihldmVudDogRGljdFtzdHIsIEFueV0sIGNvbnRleHQ6IEFueSkgLT4gRGljdFtzdHIsIEFueV06XG4gICAgXCJcIlwiXG4gICAgUkFHIHF1ZXJ5IGZ1bmN0aW9uXG4gICAgUmV0cmlldmVzIHJlbGV2YW50IGRvY3VtZW50cyBhbmQgZ2VuZXJhdGVzIHJlc3BvbnNlcyB1c2luZyBCZWRyb2NrXG4gICAgXCJcIlwiXG4gICAgcHJpbnQoZlwiUHJvY2Vzc2luZyBSQUcgcXVlcnk6IHtqc29uLmR1bXBzKGV2ZW50KX1cIilcbiAgICBcbiAgICBiZWRyb2NrID0gYm90bzMuY2xpZW50KCdiZWRyb2NrLXJ1bnRpbWUnLCByZWdpb25fbmFtZT1vcy5lbnZpcm9uWydSRUdJT04nXSlcbiAgICBcbiAgICBxdWVyeSA9IGV2ZW50LmdldCgncXVlcnknLCAnJylcbiAgICB1c2VyX2lkID0gZXZlbnQuZ2V0KCd1c2VySWQnLCAnJylcbiAgICBcbiAgICAjIFRPRE86IEltcGxlbWVudCBSQUcgbG9naWNcbiAgICAjIDEuIEdlbmVyYXRlIHF1ZXJ5IGVtYmVkZGluZ1xuICAgICMgMi4gU2VhcmNoIHNpbWlsYXIgZG9jdW1lbnRzIGluIE9wZW5TZWFyY2hcbiAgICAjIDMuIFJldHJpZXZlIHJlbGV2YW50IGRvY3VtZW50IGNodW5rc1xuICAgICMgNC4gQXBwbHkgcGVybWlzc2lvbiBmaWx0ZXJpbmcgYmFzZWQgb24gdXNlclxuICAgICMgNS4gR2VuZXJhdGUgcmVzcG9uc2UgdXNpbmcgQmVkcm9jayBDbGF1ZGUvVGl0YW5cbiAgICAjIDYuIExvZyBxdWVyeSBmb3IgYXVkaXQgcHVycG9zZXNcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgICAnc3RhdHVzQ29kZSc6IDIwMCxcbiAgICAgICAgJ2JvZHknOiBqc29uLmR1bXBzKHtcbiAgICAgICAgICAgICdxdWVyeSc6IHF1ZXJ5LFxuICAgICAgICAgICAgJ3Jlc3BvbnNlJzogJ1RoaXMgaXMgYSBwbGFjZWhvbGRlciByZXNwb25zZS4gSW1wbGVtZW50IFJBRyBsb2dpYyBoZXJlLicsXG4gICAgICAgICAgICAnc291cmNlcyc6IFtdLFxuICAgICAgICAgICAgJ3VzZXJJZCc6IHVzZXJfaWRcbiAgICAgICAgfSlcbiAgICB9XG4gICAgICAgIGApLFxuICAgICAgICByb2xlOiB0aGlzLmJlZHJvY2tSb2xlXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyB0byBMYW1iZGEgZnVuY3Rpb25zXG4gICAgaWYgKHByb3BzLmRvY3VtZW50c1RhYmxlKSB7XG4gICAgICBwcm9wcy5kb2N1bWVudHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5kb2N1bWVudFByb2Nlc3NvckZ1bmN0aW9uKTtcbiAgICAgIGlmICh0aGlzLmVtYmVkZGluZ0Z1bmN0aW9uKSB7XG4gICAgICAgIHByb3BzLmRvY3VtZW50c1RhYmxlLmdyYW50UmVhZERhdGEodGhpcy5lbWJlZGRpbmdGdW5jdGlvbik7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5yYWdRdWVyeUZ1bmN0aW9uKSB7XG4gICAgICAgIHByb3BzLmRvY3VtZW50c1RhYmxlLmdyYW50UmVhZERhdGEodGhpcy5yYWdRdWVyeUZ1bmN0aW9uKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocHJvcHMuZW1iZWRkaW5nc1RhYmxlKSB7XG4gICAgICBpZiAodGhpcy5lbWJlZGRpbmdGdW5jdGlvbikge1xuICAgICAgICBwcm9wcy5lbWJlZGRpbmdzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHRoaXMuZW1iZWRkaW5nRnVuY3Rpb24pO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMucmFnUXVlcnlGdW5jdGlvbikge1xuICAgICAgICBwcm9wcy5lbWJlZGRpbmdzVGFibGUuZ3JhbnRSZWFkRGF0YSh0aGlzLnJhZ1F1ZXJ5RnVuY3Rpb24pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwcm9wcy5kb2N1bWVudHNCdWNrZXQpIHtcbiAgICAgIHByb3BzLmRvY3VtZW50c0J1Y2tldC5ncmFudFJlYWQodGhpcy5kb2N1bWVudFByb2Nlc3NvckZ1bmN0aW9uKTtcbiAgICAgIGlmICh0aGlzLmVtYmVkZGluZ0Z1bmN0aW9uKSB7XG4gICAgICAgIHByb3BzLmRvY3VtZW50c0J1Y2tldC5ncmFudFJlYWQodGhpcy5lbWJlZGRpbmdGdW5jdGlvbik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gR3JhbnQgdGVtcG9yYXJ5IGJ1Y2tldCBhY2Nlc3MgdG8gZG9jdW1lbnQgcHJvY2Vzc29yXG4gICAgdGVtcEJ1Y2tldC5ncmFudFJlYWRXcml0ZSh0aGlzLmRvY3VtZW50UHJvY2Vzc29yRnVuY3Rpb24pO1xuICAgIFxuICAgIC8vIEdyYW50IENsb3VkV2F0Y2ggbWV0cmljcyBwZXJtaXNzaW9uc1xuICAgIHRoaXMuZG9jdW1lbnRQcm9jZXNzb3JGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnY2xvdWR3YXRjaDpQdXRNZXRyaWNEYXRhJ1xuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgIFN0cmluZ0VxdWFsczoge1xuICAgICAgICAgICdjbG91ZHdhdGNoOm5hbWVzcGFjZSc6IGAke2NvbmZpZy5yZWdpb25QcmVmaXh9LSR7Y29uZmlnLnByb2plY3ROYW1lfS9FbWJlZGRpbmdgXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSk7XG4gIH1cblxuICAvKipcbiAgICog44Oq44O844K444On44Oz44GL44KJcmVnaW9uUHJlZml444KS5Y+W5b6XXG4gICAqL1xuICBwcml2YXRlIGdldFJlZ2lvblByZWZpeChyZWdpb246IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgcmVnaW9uTWFwcGluZzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgICdhcC1ub3J0aGVhc3QtMSc6ICdUb2t5b1JlZ2lvbicsXG4gICAgICAnYXAtbm9ydGhlYXN0LTMnOiAnT3Nha2FSZWdpb24nLFxuICAgICAgJ3VzLWVhc3QtMSc6ICdVU0Vhc3QxUmVnaW9uJyxcbiAgICAgICd1cy13ZXN0LTInOiAnVVNXZXN0MlJlZ2lvbicsXG4gICAgICAnZXUtd2VzdC0xJzogJ0V1cm9wZVJlZ2lvbicsXG4gICAgICAnZXUtY2VudHJhbC0xJzogJ0ZyYW5rZnVydFJlZ2lvbidcbiAgICB9O1xuICAgIFxuICAgIHJldHVybiByZWdpb25NYXBwaW5nW3JlZ2lvbl0gfHwgYCR7cmVnaW9uLnJlcGxhY2UoLy0vZywgJycpfVJlZ2lvbmA7XG4gIH1cbn0iXX0=