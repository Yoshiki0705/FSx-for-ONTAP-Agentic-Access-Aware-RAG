import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as logs from 'aws-cdk-lib/aws-logs';

/**
 * FSx for ONTAP S3 Access Point用のBedrock Knowledge Base（S3 Vectors使用）
 * 
 * このスタックは以下のリソースを作成します：
 * 1. S3バケット（ベクトルストレージ用）
 * 2. IAMロール（Knowledge Base実行用）
 * 3. Bedrock Knowledge Base（S3 Vectors設定）
 * 4. データソース（FSx for ONTAP S3 Access Point）
 */
export class BedrockKnowledgeBaseS3VectorsStack extends cdk.Stack {
  public readonly knowledgeBaseId: string;
  public readonly knowledgeBaseArn: string;
  public readonly vectorBucketArn: string;
  public readonly indexArn: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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
    s3VectorsHandlerRole.addToPolicy(
      new iam.PolicyStatement({
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
      })
    );

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
    kbExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3vectors:QueryVectors',
          's3vectors:PutVectors',
          's3vectors:GetVectors',
          's3vectors:DeleteVectors',
          's3vectors:ListVectors',
        ],
        resources: [vectorBucketArn, indexArn],
      })
    );

    // FSx for ONTAP S3 Access Pointへのアクセス権限
    kbExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetObject', 's3:ListBucket'],
        resources: [
          `arn:aws:s3:::${s3AccessPointAlias}`,
          `arn:aws:s3:::${s3AccessPointAlias}/*`,
          `arn:aws:s3:${region}:${accountId}:accesspoint/s3ap-vol1`,
          `arn:aws:s3:${region}:${accountId}:accesspoint/s3ap-vol1/*`,
        ],
      })
    );

    // Bedrockモデルへのアクセス権限
    kbExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${region}::foundation-model/amazon.titan-embed-text-v2:0`,
        ],
      })
    );

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
      } as any, // S3 Vectorsの型定義が不完全なため、anyを使用
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
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AWSLambdaBasicExecutionRole'
          ),
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
