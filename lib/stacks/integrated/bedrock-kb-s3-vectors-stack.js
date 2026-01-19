"use strict";
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
exports.BedrockKnowledgeBaseS3VectorsStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const cr = __importStar(require("aws-cdk-lib/custom-resources"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
/**
 * FSx for ONTAP S3 Access Point用のBedrock Knowledge Base（S3 Vectors使用）
 *
 * このスタックは以下のリソースを作成します：
 * 1. S3バケット（ベクトルストレージ用）
 * 2. IAMロール（Knowledge Base実行用）
 * 3. Bedrock Knowledge Base（S3 Vectors設定）
 * 4. データソース（FSx for ONTAP S3 Access Point）
 */
class BedrockKnowledgeBaseS3VectorsStack extends cdk.Stack {
    knowledgeBaseId;
    knowledgeBaseArn;
    vectorBucketArn;
    indexArn;
    constructor(scope, id, props) {
        super(scope, id, props);
        // アカウントIDの取得
        const accountId = cdk.Stack.of(this).account;
        const region = cdk.Stack.of(this).region;
        // FSx for ONTAP S3 Access Pointのエイリアス（環境変数から取得）
        const s3AccessPointAlias = process.env.FSX_S3_ACCESS_POINT_ALIAS ||
            's3ap-vol1-as4junacgq4qruokkqwno71pjsyjruse1a-ext-s3alias';
        // ========================================
        // 1. Custom Resource Lambda（S3 Vectors管理用）
        // ========================================
        const s3VectorsHandlerRole = new iam.Role(this, 'S3VectorsHandlerRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });
        // S3 Vectors権限を追加
        s3VectorsHandlerRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                's3vectors:CreateVectorBucket',
                's3vectors:DeleteVectorBucket',
                's3vectors:ListVectorBuckets',
                's3vectors:CreateIndex',
                's3vectors:DeleteIndex',
                's3vectors:ListIndexes',
            ],
            resources: ['*'],
        }));
        // Custom Resource Lambda関数
        const s3VectorsHandler = new lambda.Function(this, 'S3VectorsHandler', {
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
import json
import boto3
import cfnresponse

s3vectors = boto3.client('s3vectors')

def handler(event, context):
    try:
        request_type = event['RequestType']
        props = event['ResourceProperties']
        
        if request_type == 'Create':
            # Vector Bucket作成
            bucket_name = props['VectorBucketName']
            try:
                response = s3vectors.create_vector_bucket(vectorBucketName=bucket_name)
                bucket_arn = response['vectorBucketArn']
            except s3vectors.exceptions.ConflictException:
                # 既に存在する場合
                buckets = s3vectors.list_vector_buckets()
                bucket_arn = next(
                    (b['vectorBucketArn'] for b in buckets['vectorBuckets'] 
                     if b['vectorBucketName'] == bucket_name),
                    None
                )
            
            # Vector Index作成
            index_name = props['IndexName']
            try:
                index_response = s3vectors.create_index(
                    vectorBucketName=bucket_name,
                    indexName=index_name,
                    dataType='float32',
                    dimension=int(props['Dimension']),
                    distanceMetric=props['DistanceMetric']
                )
                index_arn = index_response['indexArn']
            except s3vectors.exceptions.ConflictException:
                # 既に存在する場合
                indexes = s3vectors.list_indexes(vectorBucketName=bucket_name)
                index_arn = next(
                    (i['indexArn'] for i in indexes['indexes'] 
                     if i['indexName'] == index_name),
                    None
                )
            
            cfnresponse.send(event, context, cfnresponse.SUCCESS, {
                'VectorBucketArn': bucket_arn,
                'IndexArn': index_arn
            })
            
        elif request_type == 'Delete':
            # 削除は手動で行う（データ保護のため）
            cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
            
        else:
            cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
            
    except Exception as e:
        print(f'Error: {str(e)}')
        cfnresponse.send(event, context, cfnresponse.FAILED, {
            'Error': str(e)
        })
`),
            role: s3VectorsHandlerRole,
            timeout: cdk.Duration.minutes(5),
        });
        // ========================================
        // 2. S3 Vector Bucket & Index（Custom Resource）
        // ========================================
        const vectorBucketName = 'fsx-ontap-kb-vectors';
        const indexName = 'fsx-ontap-index';
        const s3VectorsProvider = new cr.Provider(this, 'S3VectorsProvider', {
            onEventHandler: s3VectorsHandler,
            logRetention: logs.RetentionDays.ONE_DAY,
        });
        const s3VectorsResource = new cdk.CustomResource(this, 'S3VectorsResource', {
            serviceToken: s3VectorsProvider.serviceToken,
            properties: {
                VectorBucketName: vectorBucketName,
                IndexName: indexName,
                Dimension: 1024, // Titan Embed Text V2
                DistanceMetric: 'cosine',
            },
        });
        const vectorBucketArn = s3VectorsResource.getAttString('VectorBucketArn');
        const indexArn = s3VectorsResource.getAttString('IndexArn');
        // ========================================
        // 3. IAMロール（Knowledge Base実行用）
        // ========================================
        const kbExecutionRole = new iam.Role(this, 'KBExecutionRole', {
            // roleName を削除してCDKに自動生成させる（重複を防ぐため）
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
            description: 'Bedrock Knowledge Base実行ロール（S3 Vectors + FSx for ONTAP S3 Access Point）',
        });
        // S3 Vectors権限
        kbExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                's3vectors:QueryVectors',
                's3vectors:PutVectors',
                's3vectors:GetVectors',
                's3vectors:DeleteVectors',
                's3vectors:ListVectors',
            ],
            resources: [vectorBucketArn, indexArn],
        }));
        // FSx for ONTAP S3 Access Pointへのアクセス権限
        kbExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['s3:GetObject', 's3:ListBucket'],
            resources: [
                `arn:aws:s3:::${s3AccessPointAlias}`,
                `arn:aws:s3:::${s3AccessPointAlias}/*`,
                `arn:aws:s3:${region}:${accountId}:accesspoint/s3ap-vol1`,
                `arn:aws:s3:${region}:${accountId}:accesspoint/s3ap-vol1/*`,
            ],
        }));
        // Bedrockモデルへのアクセス権限
        kbExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            resources: [
                `arn:aws:bedrock:${region}::foundation-model/amazon.titan-embed-text-v2:0`,
            ],
        }));
        // ========================================
        // 4. Bedrock Knowledge Base（S3 Vectors）
        // ========================================
        const knowledgeBase = new cdk.aws_bedrock.CfnKnowledgeBase(this, 'KnowledgeBase', {
            name: 'fsx-ontap-kb-s3vectors',
            description: 'FSx for ONTAP S3 Access Point用のKnowledge Base（S3 Vectors使用）',
            roleArn: kbExecutionRole.roleArn,
            knowledgeBaseConfiguration: {
                type: 'VECTOR',
                vectorKnowledgeBaseConfiguration: {
                    embeddingModelArn: `arn:aws:bedrock:${region}::foundation-model/amazon.titan-embed-text-v2:0`,
                },
            },
            storageConfiguration: {
                type: 'S3_VECTORS',
                s3VectorsConfiguration: {
                    vectorBucketArn: vectorBucketArn,
                    indexArn: indexArn,
                },
            }, // S3 Vectorsの型定義が不完全なため、anyを使用
        });
        // 依存関係の設定
        knowledgeBase.node.addDependency(kbExecutionRole);
        knowledgeBase.node.addDependency(s3VectorsResource);
        // ========================================
        // 5. データソース（FSx for ONTAP S3 Access Point）
        // ========================================
        // Custom Resourceを使用してデータソースを作成
        const dataSourceHandler = new lambda.Function(this, 'DataSourceHandler', {
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
import json
import boto3
import cfnresponse

bedrock = boto3.client('bedrock-agent')

def handler(event, context):
    try:
        request_type = event['RequestType']
        props = event['ResourceProperties']
        
        if request_type == 'Create':
            kb_id = props['KnowledgeBaseId']
            response = bedrock.create_data_source(
                knowledgeBaseId=kb_id,
                name='fsx-ontap-documents',
                description='FSx for ONTAP S3 Access Point上のドキュメント',
                dataSourceConfiguration={
                    'type': 'S3',
                    's3Configuration': {
                        'bucketArn': props['BucketArn'],
                        'inclusionPrefixes': ['test-data/documents/']
                    }
                }
            )
            data_source_id = response['dataSource']['dataSourceId']
            cfnresponse.send(event, context, cfnresponse.SUCCESS, {
                'DataSourceId': data_source_id
            })
            
        elif request_type == 'Delete':
            kb_id = props['KnowledgeBaseId']
            ds_id = event['PhysicalResourceId']
            try:
                bedrock.delete_data_source(
                    knowledgeBaseId=kb_id,
                    dataSourceId=ds_id
                )
            except:
                pass
            cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
            
        else:
            cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
            
    except Exception as e:
        print(f'Error: {str(e)}')
        cfnresponse.send(event, context, cfnresponse.FAILED, {
            'Error': str(e)
        })
`),
            role: new iam.Role(this, 'DataSourceHandlerRole', {
                assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
                managedPolicies: [
                    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
                ],
                inlinePolicies: {
                    BedrockAccess: new iam.PolicyDocument({
                        statements: [
                            new iam.PolicyStatement({
                                effect: iam.Effect.ALLOW,
                                actions: [
                                    'bedrock:CreateDataSource',
                                    'bedrock:DeleteDataSource',
                                    'bedrock:GetDataSource',
                                ],
                                resources: ['*'],
                            }),
                        ],
                    }),
                },
            }),
            timeout: cdk.Duration.minutes(5),
        });
        const dataSourceProvider = new cr.Provider(this, 'DataSourceProvider', {
            onEventHandler: dataSourceHandler,
            logRetention: logs.RetentionDays.ONE_DAY,
        });
        const dataSourceResource = new cdk.CustomResource(this, 'DataSourceResource', {
            serviceToken: dataSourceProvider.serviceToken,
            properties: {
                KnowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
                BucketArn: `arn:aws:s3:::${s3AccessPointAlias}`,
            },
        });
        dataSourceResource.node.addDependency(knowledgeBase);
        const dataSourceId = dataSourceResource.getAttString('DataSourceId');
        // ========================================
        // 出力
        // ========================================
        this.knowledgeBaseId = knowledgeBase.attrKnowledgeBaseId;
        this.knowledgeBaseArn = knowledgeBase.attrKnowledgeBaseArn;
        this.vectorBucketArn = vectorBucketArn;
        this.indexArn = indexArn;
        new cdk.CfnOutput(this, 'KnowledgeBaseId', {
            value: this.knowledgeBaseId,
            description: 'Bedrock Knowledge Base ID',
            exportName: 'BedrockKnowledgeBaseId-S3Vectors',
        });
        new cdk.CfnOutput(this, 'KnowledgeBaseArn', {
            value: this.knowledgeBaseArn,
            description: 'Bedrock Knowledge Base ARN',
            exportName: 'BedrockKnowledgeBaseArn-S3Vectors',
        });
        new cdk.CfnOutput(this, 'VectorBucketName', {
            value: vectorBucketName,
            description: 'S3 Vectors Bucket Name',
            exportName: 'BedrockVectorBucketName-S3Vectors',
        });
        new cdk.CfnOutput(this, 'DataSourceId', {
            value: dataSourceId,
            description: 'Bedrock Data Source ID',
            exportName: 'BedrockDataSourceId-S3Vectors',
        });
        new cdk.CfnOutput(this, 'S3AccessPointAlias', {
            value: s3AccessPointAlias,
            description: 'FSx for ONTAP S3 Access Point Alias',
            exportName: 'FSxS3AccessPointAlias',
        });
        new cdk.CfnOutput(this, 'VectorBucketArn', {
            value: vectorBucketArn,
            description: 'S3 Vector Bucket ARN',
            exportName: 'VectorBucketArn-S3Vectors',
        });
        new cdk.CfnOutput(this, 'IndexArn', {
            value: indexArn,
            description: 'S3 Vector Index ARN',
            exportName: 'VectorIndexArn-S3Vectors',
        });
        new cdk.CfnOutput(this, 'ExecutionRoleArn', {
            value: kbExecutionRole.roleArn,
            description: 'Knowledge Base Execution Role ARN',
            exportName: 'BedrockKBExecutionRoleArn-S3Vectors',
        });
        // タグ付け
        cdk.Tags.of(this).add('Project', 'Permission-aware-RAG');
        cdk.Tags.of(this).add('Component', 'Bedrock-KB-S3Vectors');
        cdk.Tags.of(this).add('Environment', 'Production');
    }
}
exports.BedrockKnowledgeBaseS3VectorsStack = BedrockKnowledgeBaseS3VectorsStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1rYi1zMy12ZWN0b3JzLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYmVkcm9jay1rYi1zMy12ZWN0b3JzLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBRW5DLHlEQUEyQztBQUUzQywrREFBaUQ7QUFDakQsaUVBQW1EO0FBQ25ELDJEQUE2QztBQUU3Qzs7Ozs7Ozs7R0FRRztBQUNILE1BQWEsa0NBQW1DLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDL0MsZUFBZSxDQUFTO0lBQ3hCLGdCQUFnQixDQUFTO0lBQ3pCLGVBQWUsQ0FBUztJQUN4QixRQUFRLENBQVM7SUFFakMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixhQUFhO1FBQ2IsTUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDO1FBQzdDLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQztRQUV6QyxnREFBZ0Q7UUFDaEQsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLHlCQUF5QjtZQUM5RCwwREFBMEQsQ0FBQztRQUU3RCwyQ0FBMkM7UUFDM0MsMkNBQTJDO1FBQzNDLDJDQUEyQztRQUMzQyxNQUFNLG9CQUFvQixHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDdEUsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLHNCQUFzQixDQUFDO1lBQzNELGVBQWUsRUFBRTtnQkFDZixHQUFHLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLDBD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Q0FBbUM7WUFDaEQsVUFBVSxFQUFFLHFDQUFxQztTQUNsRCxDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO1FBQ3pELEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsc0JBQXNCLENBQUMsQ0FBQztRQUMzRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQ3JELENBQUM7Q0FDRjtBQTFYRCxnRkEwWEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgY3IgZnJvbSAnYXdzLWNkay1saWIvY3VzdG9tLXJlc291cmNlcyc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcblxuLyoqXG4gKiBGU3ggZm9yIE9OVEFQIFMzIEFjY2VzcyBQb2ludOeUqOOBrkJlZHJvY2sgS25vd2xlZGdlIEJhc2XvvIhTMyBWZWN0b3Jz5L2/55So77yJXG4gKiBcbiAqIOOBk+OBruOCueOCv+ODg+OCr+OBr+S7peS4i+OBruODquOCveODvOOCueOCkuS9nOaIkOOBl+OBvuOBme+8mlxuICogMS4gUzPjg5DjgrHjg4Pjg4jvvIjjg5njgq/jg4jjg6vjgrnjg4jjg6zjg7zjgrjnlKjvvIlcbiAqIDIuIElBTeODreODvOODq++8iEtub3dsZWRnZSBCYXNl5a6f6KGM55So77yJXG4gKiAzLiBCZWRyb2NrIEtub3dsZWRnZSBCYXNl77yIUzMgVmVjdG9yc+ioreWumu+8iVxuICogNC4g44OH44O844K/44K944O844K577yIRlN4IGZvciBPTlRBUCBTMyBBY2Nlc3MgUG9pbnTvvIlcbiAqL1xuZXhwb3J0IGNsYXNzIEJlZHJvY2tLbm93bGVkZ2VCYXNlUzNWZWN0b3JzU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkga25vd2xlZGdlQmFzZUlkOiBzdHJpbmc7XG4gIHB1YmxpYyByZWFkb25seSBrbm93bGVkZ2VCYXNlQXJuOiBzdHJpbmc7XG4gIHB1YmxpYyByZWFkb25seSB2ZWN0b3JCdWNrZXRBcm46IHN0cmluZztcbiAgcHVibGljIHJlYWRvbmx5IGluZGV4QXJuOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8g44Ki44Kr44Km44Oz44OISUTjga7lj5blvpdcbiAgICBjb25zdCBhY2NvdW50SWQgPSBjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudDtcbiAgICBjb25zdCByZWdpb24gPSBjZGsuU3RhY2sub2YodGhpcykucmVnaW9uO1xuXG4gICAgLy8gRlN4IGZvciBPTlRBUCBTMyBBY2Nlc3MgUG9pbnTjga7jgqjjgqTjg6rjgqLjgrnvvIjnkrDlooPlpInmlbDjgYvjgonlj5blvpfvvIlcbiAgICBjb25zdCBzM0FjY2Vzc1BvaW50QWxpYXMgPSBwcm9jZXNzLmVudi5GU1hfUzNfQUNDRVNTX1BPSU5UX0FMSUFTIHx8IFxuICAgICAgJ3MzYXAtdm9sMS1hczRqdW5hY2dxNHFydW9ra3F3bm83MXBqc3lqcnVzZTFhLWV4dC1zM2FsaWFzJztcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyAxLiBDdXN0b20gUmVzb3VyY2UgTGFtYmRh77yIUzMgVmVjdG9yc+euoeeQhueUqO+8iVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBjb25zdCBzM1ZlY3RvcnNIYW5kbGVyUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnUzNWZWN0b3JzSGFuZGxlclJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBTMyBWZWN0b3Jz5qip6ZmQ44KS6L+95YqgXG4gICAgczNWZWN0b3JzSGFuZGxlclJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdzM3ZlY3RvcnM6Q3JlYXRlVmVjdG9yQnVja2V0JyxcbiAgICAgICAgICAnczN2ZWN0b3JzOkRlbGV0ZVZlY3RvckJ1Y2tldCcsXG4gICAgICAgICAgJ3MzdmVjdG9yczpMaXN0VmVjdG9yQnVja2V0cycsXG4gICAgICAgICAgJ3MzdmVjdG9yczpDcmVhdGVJbmRleCcsXG4gICAgICAgICAgJ3MzdmVjdG9yczpEZWxldGVJbmRleCcsXG4gICAgICAgICAgJ3MzdmVjdG9yczpMaXN0SW5kZXhlcycsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBDdXN0b20gUmVzb3VyY2UgTGFtYmRh6Zai5pWwXG4gICAgY29uc3QgczNWZWN0b3JzSGFuZGxlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1MzVmVjdG9yc0hhbmRsZXInLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMixcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuaW1wb3J0IGpzb25cbmltcG9ydCBib3RvM1xuaW1wb3J0IGNmbnJlc3BvbnNlXG5cbnMzdmVjdG9ycyA9IGJvdG8zLmNsaWVudCgnczN2ZWN0b3JzJylcblxuZGVmIGhhbmRsZXIoZXZlbnQsIGNvbnRleHQpOlxuICAgIHRyeTpcbiAgICAgICAgcmVxdWVzdF90eXBlID0gZXZlbnRbJ1JlcXVlc3RUeXBlJ11cbiAgICAgICAgcHJvcHMgPSBldmVudFsnUmVzb3VyY2VQcm9wZXJ0aWVzJ11cbiAgICAgICAgXG4gICAgICAgIGlmIHJlcXVlc3RfdHlwZSA9PSAnQ3JlYXRlJzpcbiAgICAgICAgICAgICMgVmVjdG9yIEJ1Y2tldOS9nOaIkFxuICAgICAgICAgICAgYnVja2V0X25hbWUgPSBwcm9wc1snVmVjdG9yQnVja2V0TmFtZSddXG4gICAgICAgICAgICB0cnk6XG4gICAgICAgICAgICAgICAgcmVzcG9uc2UgPSBzM3ZlY3RvcnMuY3JlYXRlX3ZlY3Rvcl9idWNrZXQodmVjdG9yQnVja2V0TmFtZT1idWNrZXRfbmFtZSlcbiAgICAgICAgICAgICAgICBidWNrZXRfYXJuID0gcmVzcG9uc2VbJ3ZlY3RvckJ1Y2tldEFybiddXG4gICAgICAgICAgICBleGNlcHQgczN2ZWN0b3JzLmV4Y2VwdGlvbnMuQ29uZmxpY3RFeGNlcHRpb246XG4gICAgICAgICAgICAgICAgIyDml6LjgavlrZjlnKjjgZnjgovloLTlkIhcbiAgICAgICAgICAgICAgICBidWNrZXRzID0gczN2ZWN0b3JzLmxpc3RfdmVjdG9yX2J1Y2tldHMoKVxuICAgICAgICAgICAgICAgIGJ1Y2tldF9hcm4gPSBuZXh0KFxuICAgICAgICAgICAgICAgICAgICAoYlsndmVjdG9yQnVja2V0QXJuJ10gZm9yIGIgaW4gYnVja2V0c1sndmVjdG9yQnVja2V0cyddIFxuICAgICAgICAgICAgICAgICAgICAgaWYgYlsndmVjdG9yQnVja2V0TmFtZSddID09IGJ1Y2tldF9uYW1lKSxcbiAgICAgICAgICAgICAgICAgICAgTm9uZVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgIyBWZWN0b3IgSW5kZXjkvZzmiJBcbiAgICAgICAgICAgIGluZGV4X25hbWUgPSBwcm9wc1snSW5kZXhOYW1lJ11cbiAgICAgICAgICAgIHRyeTpcbiAgICAgICAgICAgICAgICBpbmRleF9yZXNwb25zZSA9IHMzdmVjdG9ycy5jcmVhdGVfaW5kZXgoXG4gICAgICAgICAgICAgICAgICAgIHZlY3RvckJ1Y2tldE5hbWU9YnVja2V0X25hbWUsXG4gICAgICAgICAgICAgICAgICAgIGluZGV4TmFtZT1pbmRleF9uYW1lLFxuICAgICAgICAgICAgICAgICAgICBkYXRhVHlwZT0nZmxvYXQzMicsXG4gICAgICAgICAgICAgICAgICAgIGRpbWVuc2lvbj1pbnQocHJvcHNbJ0RpbWVuc2lvbiddKSxcbiAgICAgICAgICAgICAgICAgICAgZGlzdGFuY2VNZXRyaWM9cHJvcHNbJ0Rpc3RhbmNlTWV0cmljJ11cbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgaW5kZXhfYXJuID0gaW5kZXhfcmVzcG9uc2VbJ2luZGV4QXJuJ11cbiAgICAgICAgICAgIGV4Y2VwdCBzM3ZlY3RvcnMuZXhjZXB0aW9ucy5Db25mbGljdEV4Y2VwdGlvbjpcbiAgICAgICAgICAgICAgICAjIOaXouOBq+WtmOWcqOOBmeOCi+WgtOWQiFxuICAgICAgICAgICAgICAgIGluZGV4ZXMgPSBzM3ZlY3RvcnMubGlzdF9pbmRleGVzKHZlY3RvckJ1Y2tldE5hbWU9YnVja2V0X25hbWUpXG4gICAgICAgICAgICAgICAgaW5kZXhfYXJuID0gbmV4dChcbiAgICAgICAgICAgICAgICAgICAgKGlbJ2luZGV4QXJuJ10gZm9yIGkgaW4gaW5kZXhlc1snaW5kZXhlcyddIFxuICAgICAgICAgICAgICAgICAgICAgaWYgaVsnaW5kZXhOYW1lJ10gPT0gaW5kZXhfbmFtZSksXG4gICAgICAgICAgICAgICAgICAgIE5vbmVcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNmbnJlc3BvbnNlLnNlbmQoZXZlbnQsIGNvbnRleHQsIGNmbnJlc3BvbnNlLlNVQ0NFU1MsIHtcbiAgICAgICAgICAgICAgICAnVmVjdG9yQnVja2V0QXJuJzogYnVja2V0X2FybixcbiAgICAgICAgICAgICAgICAnSW5kZXhBcm4nOiBpbmRleF9hcm5cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBcbiAgICAgICAgZWxpZiByZXF1ZXN0X3R5cGUgPT0gJ0RlbGV0ZSc6XG4gICAgICAgICAgICAjIOWJiumZpOOBr+aJi+WLleOBp+ihjOOBhu+8iOODh+ODvOOCv+S/neitt+OBruOBn+OCge+8iVxuICAgICAgICAgICAgY2ZucmVzcG9uc2Uuc2VuZChldmVudCwgY29udGV4dCwgY2ZucmVzcG9uc2UuU1VDQ0VTUywge30pXG4gICAgICAgICAgICBcbiAgICAgICAgZWxzZTpcbiAgICAgICAgICAgIGNmbnJlc3BvbnNlLnNlbmQoZXZlbnQsIGNvbnRleHQsIGNmbnJlc3BvbnNlLlNVQ0NFU1MsIHt9KVxuICAgICAgICAgICAgXG4gICAgZXhjZXB0IEV4Y2VwdGlvbiBhcyBlOlxuICAgICAgICBwcmludChmJ0Vycm9yOiB7c3RyKGUpfScpXG4gICAgICAgIGNmbnJlc3BvbnNlLnNlbmQoZXZlbnQsIGNvbnRleHQsIGNmbnJlc3BvbnNlLkZBSUxFRCwge1xuICAgICAgICAgICAgJ0Vycm9yJzogc3RyKGUpXG4gICAgICAgIH0pXG5gKSxcbiAgICAgIHJvbGU6IHMzVmVjdG9yc0hhbmRsZXJSb2xlLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gMi4gUzMgVmVjdG9yIEJ1Y2tldCAmIEluZGV477yIQ3VzdG9tIFJlc291cmNl77yJXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGNvbnN0IHZlY3RvckJ1Y2tldE5hbWUgPSAnZnN4LW9udGFwLWtiLXZlY3RvcnMnO1xuICAgIGNvbnN0IGluZGV4TmFtZSA9ICdmc3gtb250YXAtaW5kZXgnO1xuXG4gICAgY29uc3QgczNWZWN0b3JzUHJvdmlkZXIgPSBuZXcgY3IuUHJvdmlkZXIodGhpcywgJ1MzVmVjdG9yc1Byb3ZpZGVyJywge1xuICAgICAgb25FdmVudEhhbmRsZXI6IHMzVmVjdG9yc0hhbmRsZXIsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfREFZLFxuICAgIH0pO1xuXG4gICAgY29uc3QgczNWZWN0b3JzUmVzb3VyY2UgPSBuZXcgY2RrLkN1c3RvbVJlc291cmNlKHRoaXMsICdTM1ZlY3RvcnNSZXNvdXJjZScsIHtcbiAgICAgIHNlcnZpY2VUb2tlbjogczNWZWN0b3JzUHJvdmlkZXIuc2VydmljZVRva2VuLFxuICAgICAgcHJvcGVydGllczoge1xuICAgICAgICBWZWN0b3JCdWNrZXROYW1lOiB2ZWN0b3JCdWNrZXROYW1lLFxuICAgICAgICBJbmRleE5hbWU6IGluZGV4TmFtZSxcbiAgICAgICAgRGltZW5zaW9uOiAxMDI0LCAvLyBUaXRhbiBFbWJlZCBUZXh0IFYyXG4gICAgICAgIERpc3RhbmNlTWV0cmljOiAnY29zaW5lJyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCB2ZWN0b3JCdWNrZXRBcm4gPSBzM1ZlY3RvcnNSZXNvdXJjZS5nZXRBdHRTdHJpbmcoJ1ZlY3RvckJ1Y2tldEFybicpO1xuICAgIGNvbnN0IGluZGV4QXJuID0gczNWZWN0b3JzUmVzb3VyY2UuZ2V0QXR0U3RyaW5nKCdJbmRleEFybicpO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIDMuIElBTeODreODvOODq++8iEtub3dsZWRnZSBCYXNl5a6f6KGM55So77yJXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGNvbnN0IGtiRXhlY3V0aW9uUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnS0JFeGVjdXRpb25Sb2xlJywge1xuICAgICAgLy8gcm9sZU5hbWUg44KS5YmK6Zmk44GX44GmQ0RL44Gr6Ieq5YuV55Sf5oiQ44GV44Gb44KL77yI6YeN6KSH44KS6Ziy44GQ44Gf44KB77yJXG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnYmVkcm9jay5hbWF6b25hd3MuY29tJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ0JlZHJvY2sgS25vd2xlZGdlIEJhc2Xlrp/ooYzjg63jg7zjg6vvvIhTMyBWZWN0b3JzICsgRlN4IGZvciBPTlRBUCBTMyBBY2Nlc3MgUG9pbnTvvIknLFxuICAgIH0pO1xuXG4gICAgLy8gUzMgVmVjdG9yc+aoqemZkFxuICAgIGtiRXhlY3V0aW9uUm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ3MzdmVjdG9yczpRdWVyeVZlY3RvcnMnLFxuICAgICAgICAgICdzM3ZlY3RvcnM6UHV0VmVjdG9ycycsXG4gICAgICAgICAgJ3MzdmVjdG9yczpHZXRWZWN0b3JzJyxcbiAgICAgICAgICAnczN2ZWN0b3JzOkRlbGV0ZVZlY3RvcnMnLFxuICAgICAgICAgICdzM3ZlY3RvcnM6TGlzdFZlY3RvcnMnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFt2ZWN0b3JCdWNrZXRBcm4sIGluZGV4QXJuXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEZTeCBmb3IgT05UQVAgUzMgQWNjZXNzIFBvaW5044G444Gu44Ki44Kv44K744K55qip6ZmQXG4gICAga2JFeGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFsnczM6R2V0T2JqZWN0JywgJ3MzOkxpc3RCdWNrZXQnXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgYGFybjphd3M6czM6Ojoke3MzQWNjZXNzUG9pbnRBbGlhc31gLFxuICAgICAgICAgIGBhcm46YXdzOnMzOjo6JHtzM0FjY2Vzc1BvaW50QWxpYXN9LypgLFxuICAgICAgICAgIGBhcm46YXdzOnMzOiR7cmVnaW9ufToke2FjY291bnRJZH06YWNjZXNzcG9pbnQvczNhcC12b2wxYCxcbiAgICAgICAgICBgYXJuOmF3czpzMzoke3JlZ2lvbn06JHthY2NvdW50SWR9OmFjY2Vzc3BvaW50L3MzYXAtdm9sMS8qYCxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEJlZHJvY2vjg6Ljg4fjg6vjgbjjga7jgqLjgq/jgrvjgrnmqKnpmZBcbiAgICBrYkV4ZWN1dGlvblJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogWydiZWRyb2NrOkludm9rZU1vZGVsJywgJ2JlZHJvY2s6SW52b2tlTW9kZWxXaXRoUmVzcG9uc2VTdHJlYW0nXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgYGFybjphd3M6YmVkcm9jazoke3JlZ2lvbn06OmZvdW5kYXRpb24tbW9kZWwvYW1hem9uLnRpdGFuLWVtYmVkLXRleHQtdjI6MGAsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gNC4gQmVkcm9jayBLbm93bGVkZ2UgQmFzZe+8iFMzIFZlY3RvcnPvvIlcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgY29uc3Qga25vd2xlZGdlQmFzZSA9IG5ldyBjZGsuYXdzX2JlZHJvY2suQ2ZuS25vd2xlZGdlQmFzZSh0aGlzLCAnS25vd2xlZGdlQmFzZScsIHtcbiAgICAgIG5hbWU6ICdmc3gtb250YXAta2ItczN2ZWN0b3JzJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRlN4IGZvciBPTlRBUCBTMyBBY2Nlc3MgUG9pbnTnlKjjga5Lbm93bGVkZ2UgQmFzZe+8iFMzIFZlY3RvcnPkvb/nlKjvvIknLFxuICAgICAgcm9sZUFybjoga2JFeGVjdXRpb25Sb2xlLnJvbGVBcm4sXG4gICAgICBrbm93bGVkZ2VCYXNlQ29uZmlndXJhdGlvbjoge1xuICAgICAgICB0eXBlOiAnVkVDVE9SJyxcbiAgICAgICAgdmVjdG9yS25vd2xlZGdlQmFzZUNvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICBlbWJlZGRpbmdNb2RlbEFybjogYGFybjphd3M6YmVkcm9jazoke3JlZ2lvbn06OmZvdW5kYXRpb24tbW9kZWwvYW1hem9uLnRpdGFuLWVtYmVkLXRleHQtdjI6MGAsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgc3RvcmFnZUNvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgdHlwZTogJ1MzX1ZFQ1RPUlMnLFxuICAgICAgICBzM1ZlY3RvcnNDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgdmVjdG9yQnVja2V0QXJuOiB2ZWN0b3JCdWNrZXRBcm4sXG4gICAgICAgICAgaW5kZXhBcm46IGluZGV4QXJuLFxuICAgICAgICB9LFxuICAgICAgfSBhcyBhbnksIC8vIFMzIFZlY3RvcnPjga7lnovlrprnvqnjgYzkuI3lrozlhajjgarjgZ/jgoHjgIFhbnnjgpLkvb/nlKhcbiAgICB9KTtcblxuICAgIC8vIOS+neWtmOmWouS/guOBruioreWumlxuICAgIGtub3dsZWRnZUJhc2Uubm9kZS5hZGREZXBlbmRlbmN5KGtiRXhlY3V0aW9uUm9sZSk7XG4gICAga25vd2xlZGdlQmFzZS5ub2RlLmFkZERlcGVuZGVuY3koczNWZWN0b3JzUmVzb3VyY2UpO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIDUuIOODh+ODvOOCv+OCveODvOOCue+8iEZTeCBmb3IgT05UQVAgUzMgQWNjZXNzIFBvaW5077yJXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEN1c3RvbSBSZXNvdXJjZeOCkuS9v+eUqOOBl+OBpuODh+ODvOOCv+OCveODvOOCueOCkuS9nOaIkFxuICAgIGNvbnN0IGRhdGFTb3VyY2VIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnRGF0YVNvdXJjZUhhbmRsZXInLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMixcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuaW1wb3J0IGpzb25cbmltcG9ydCBib3RvM1xuaW1wb3J0IGNmbnJlc3BvbnNlXG5cbmJlZHJvY2sgPSBib3RvMy5jbGllbnQoJ2JlZHJvY2stYWdlbnQnKVxuXG5kZWYgaGFuZGxlcihldmVudCwgY29udGV4dCk6XG4gICAgdHJ5OlxuICAgICAgICByZXF1ZXN0X3R5cGUgPSBldmVudFsnUmVxdWVzdFR5cGUnXVxuICAgICAgICBwcm9wcyA9IGV2ZW50WydSZXNvdXJjZVByb3BlcnRpZXMnXVxuICAgICAgICBcbiAgICAgICAgaWYgcmVxdWVzdF90eXBlID09ICdDcmVhdGUnOlxuICAgICAgICAgICAga2JfaWQgPSBwcm9wc1snS25vd2xlZGdlQmFzZUlkJ11cbiAgICAgICAgICAgIHJlc3BvbnNlID0gYmVkcm9jay5jcmVhdGVfZGF0YV9zb3VyY2UoXG4gICAgICAgICAgICAgICAga25vd2xlZGdlQmFzZUlkPWtiX2lkLFxuICAgICAgICAgICAgICAgIG5hbWU9J2ZzeC1vbnRhcC1kb2N1bWVudHMnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPSdGU3ggZm9yIE9OVEFQIFMzIEFjY2VzcyBQb2ludOS4iuOBruODieOCreODpeODoeODs+ODiCcsXG4gICAgICAgICAgICAgICAgZGF0YVNvdXJjZUNvbmZpZ3VyYXRpb249e1xuICAgICAgICAgICAgICAgICAgICAndHlwZSc6ICdTMycsXG4gICAgICAgICAgICAgICAgICAgICdzM0NvbmZpZ3VyYXRpb24nOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAnYnVja2V0QXJuJzogcHJvcHNbJ0J1Y2tldEFybiddLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ2luY2x1c2lvblByZWZpeGVzJzogWyd0ZXN0LWRhdGEvZG9jdW1lbnRzLyddXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApXG4gICAgICAgICAgICBkYXRhX3NvdXJjZV9pZCA9IHJlc3BvbnNlWydkYXRhU291cmNlJ11bJ2RhdGFTb3VyY2VJZCddXG4gICAgICAgICAgICBjZm5yZXNwb25zZS5zZW5kKGV2ZW50LCBjb250ZXh0LCBjZm5yZXNwb25zZS5TVUNDRVNTLCB7XG4gICAgICAgICAgICAgICAgJ0RhdGFTb3VyY2VJZCc6IGRhdGFfc291cmNlX2lkXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgXG4gICAgICAgIGVsaWYgcmVxdWVzdF90eXBlID09ICdEZWxldGUnOlxuICAgICAgICAgICAga2JfaWQgPSBwcm9wc1snS25vd2xlZGdlQmFzZUlkJ11cbiAgICAgICAgICAgIGRzX2lkID0gZXZlbnRbJ1BoeXNpY2FsUmVzb3VyY2VJZCddXG4gICAgICAgICAgICB0cnk6XG4gICAgICAgICAgICAgICAgYmVkcm9jay5kZWxldGVfZGF0YV9zb3VyY2UoXG4gICAgICAgICAgICAgICAgICAgIGtub3dsZWRnZUJhc2VJZD1rYl9pZCxcbiAgICAgICAgICAgICAgICAgICAgZGF0YVNvdXJjZUlkPWRzX2lkXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgZXhjZXB0OlxuICAgICAgICAgICAgICAgIHBhc3NcbiAgICAgICAgICAgIGNmbnJlc3BvbnNlLnNlbmQoZXZlbnQsIGNvbnRleHQsIGNmbnJlc3BvbnNlLlNVQ0NFU1MsIHt9KVxuICAgICAgICAgICAgXG4gICAgICAgIGVsc2U6XG4gICAgICAgICAgICBjZm5yZXNwb25zZS5zZW5kKGV2ZW50LCBjb250ZXh0LCBjZm5yZXNwb25zZS5TVUNDRVNTLCB7fSlcbiAgICAgICAgICAgIFxuICAgIGV4Y2VwdCBFeGNlcHRpb24gYXMgZTpcbiAgICAgICAgcHJpbnQoZidFcnJvcjoge3N0cihlKX0nKVxuICAgICAgICBjZm5yZXNwb25zZS5zZW5kKGV2ZW50LCBjb250ZXh0LCBjZm5yZXNwb25zZS5GQUlMRUQsIHtcbiAgICAgICAgICAgICdFcnJvcic6IHN0cihlKVxuICAgICAgICB9KVxuYCksXG4gICAgICByb2xlOiBuZXcgaWFtLlJvbGUodGhpcywgJ0RhdGFTb3VyY2VIYW5kbGVyUm9sZScsIHtcbiAgICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZShcbiAgICAgICAgICAgICdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlJ1xuICAgICAgICAgICksXG4gICAgICAgIF0sXG4gICAgICAgIGlubGluZVBvbGljaWVzOiB7XG4gICAgICAgICAgQmVkcm9ja0FjY2VzczogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICAgJ2JlZHJvY2s6Q3JlYXRlRGF0YVNvdXJjZScsXG4gICAgICAgICAgICAgICAgICAnYmVkcm9jazpEZWxldGVEYXRhU291cmNlJyxcbiAgICAgICAgICAgICAgICAgICdiZWRyb2NrOkdldERhdGFTb3VyY2UnLFxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGRhdGFTb3VyY2VQcm92aWRlciA9IG5ldyBjci5Qcm92aWRlcih0aGlzLCAnRGF0YVNvdXJjZVByb3ZpZGVyJywge1xuICAgICAgb25FdmVudEhhbmRsZXI6IGRhdGFTb3VyY2VIYW5kbGVyLFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX0RBWSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGRhdGFTb3VyY2VSZXNvdXJjZSA9IG5ldyBjZGsuQ3VzdG9tUmVzb3VyY2UodGhpcywgJ0RhdGFTb3VyY2VSZXNvdXJjZScsIHtcbiAgICAgIHNlcnZpY2VUb2tlbjogZGF0YVNvdXJjZVByb3ZpZGVyLnNlcnZpY2VUb2tlbixcbiAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgS25vd2xlZGdlQmFzZUlkOiBrbm93bGVkZ2VCYXNlLmF0dHJLbm93bGVkZ2VCYXNlSWQsXG4gICAgICAgIEJ1Y2tldEFybjogYGFybjphd3M6czM6Ojoke3MzQWNjZXNzUG9pbnRBbGlhc31gLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGRhdGFTb3VyY2VSZXNvdXJjZS5ub2RlLmFkZERlcGVuZGVuY3koa25vd2xlZGdlQmFzZSk7XG5cbiAgICBjb25zdCBkYXRhU291cmNlSWQgPSBkYXRhU291cmNlUmVzb3VyY2UuZ2V0QXR0U3RyaW5nKCdEYXRhU291cmNlSWQnKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyDlh7rliptcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgdGhpcy5rbm93bGVkZ2VCYXNlSWQgPSBrbm93bGVkZ2VCYXNlLmF0dHJLbm93bGVkZ2VCYXNlSWQ7XG4gICAgdGhpcy5rbm93bGVkZ2VCYXNlQXJuID0ga25vd2xlZGdlQmFzZS5hdHRyS25vd2xlZGdlQmFzZUFybjtcbiAgICB0aGlzLnZlY3RvckJ1Y2tldEFybiA9IHZlY3RvckJ1Y2tldEFybjtcbiAgICB0aGlzLmluZGV4QXJuID0gaW5kZXhBcm47XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnS25vd2xlZGdlQmFzZUlkJywge1xuICAgICAgdmFsdWU6IHRoaXMua25vd2xlZGdlQmFzZUlkLFxuICAgICAgZGVzY3JpcHRpb246ICdCZWRyb2NrIEtub3dsZWRnZSBCYXNlIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdCZWRyb2NrS25vd2xlZGdlQmFzZUlkLVMzVmVjdG9ycycsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnS25vd2xlZGdlQmFzZUFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmtub3dsZWRnZUJhc2VBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0JlZHJvY2sgS25vd2xlZGdlIEJhc2UgQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdCZWRyb2NrS25vd2xlZGdlQmFzZUFybi1TM1ZlY3RvcnMnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ZlY3RvckJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdmVjdG9yQnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUzMgVmVjdG9ycyBCdWNrZXQgTmFtZScsXG4gICAgICBleHBvcnROYW1lOiAnQmVkcm9ja1ZlY3RvckJ1Y2tldE5hbWUtUzNWZWN0b3JzJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEYXRhU291cmNlSWQnLCB7XG4gICAgICB2YWx1ZTogZGF0YVNvdXJjZUlkLFxuICAgICAgZGVzY3JpcHRpb246ICdCZWRyb2NrIERhdGEgU291cmNlIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdCZWRyb2NrRGF0YVNvdXJjZUlkLVMzVmVjdG9ycycsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUzNBY2Nlc3NQb2ludEFsaWFzJywge1xuICAgICAgdmFsdWU6IHMzQWNjZXNzUG9pbnRBbGlhcyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRlN4IGZvciBPTlRBUCBTMyBBY2Nlc3MgUG9pbnQgQWxpYXMnLFxuICAgICAgZXhwb3J0TmFtZTogJ0ZTeFMzQWNjZXNzUG9pbnRBbGlhcycsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVmVjdG9yQnVja2V0QXJuJywge1xuICAgICAgdmFsdWU6IHZlY3RvckJ1Y2tldEFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnUzMgVmVjdG9yIEJ1Y2tldCBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogJ1ZlY3RvckJ1Y2tldEFybi1TM1ZlY3RvcnMnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0luZGV4QXJuJywge1xuICAgICAgdmFsdWU6IGluZGV4QXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdTMyBWZWN0b3IgSW5kZXggQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdWZWN0b3JJbmRleEFybi1TM1ZlY3RvcnMnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0V4ZWN1dGlvblJvbGVBcm4nLCB7XG4gICAgICB2YWx1ZToga2JFeGVjdXRpb25Sb2xlLnJvbGVBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0tub3dsZWRnZSBCYXNlIEV4ZWN1dGlvbiBSb2xlIEFSTicsXG4gICAgICBleHBvcnROYW1lOiAnQmVkcm9ja0tCRXhlY3V0aW9uUm9sZUFybi1TM1ZlY3RvcnMnLFxuICAgIH0pO1xuXG4gICAgLy8g44K/44Kw5LuY44GRXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdQcm9qZWN0JywgJ1Blcm1pc3Npb24tYXdhcmUtUkFHJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdDb21wb25lbnQnLCAnQmVkcm9jay1LQi1TM1ZlY3RvcnMnKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50JywgJ1Byb2R1Y3Rpb24nKTtcbiAgfVxufVxuIl19