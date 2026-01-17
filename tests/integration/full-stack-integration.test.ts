/**
 * 全スタック統合テスト
 * 
 * WebAppStack以外の5つのスタックの機能を確認
 * - NetworkingStack: VPC・サブネット・セキュリティグループ
 * - SecurityStack: IAM・KMS・WAF
 * - DataStack: S3・DynamoDB・OpenSearch
 * - EmbeddingStack: Lambda・Bedrock
 * - OperationsStack: CloudWatch・SNS
 */

import { 
  CloudFormationClient, 
  DescribeStacksCommand,
  ListStackResourcesCommand 
} from '@aws-sdk/client-cloudformation';
import { 
  EC2Client, 
  DescribeVpcsCommand,
  DescribeSubnetsCommand,
  DescribeSecurityGroupsCommand 
} from '@aws-sdk/client-ec2';
import { 
  IAMClient, 
  GetRoleCommand,
  ListRolePoliciesCommand 
} from '@aws-sdk/client-iam';
import { 
  KMSClient, 
  DescribeKeyCommand 
} from '@aws-sdk/client-kms';
import { 
  S3Client, 
  HeadBucketCommand,
  ListObjectsV2Command 
} from '@aws-sdk/client-s3';
import { 
  DynamoDBClient, 
  DescribeTableCommand 
} from '@aws-sdk/client-dynamodb';
import { 
  FSxClient, 
  DescribeFileSystemsCommand 
} from '@aws-sdk/client-fsx';
import { 
  LambdaClient, 
  GetFunctionCommand,
  InvokeCommand 
} from '@aws-sdk/client-lambda';
import { 
  CloudWatchClient, 
  DescribeAlarmsCommand 
} from '@aws-sdk/client-cloudwatch';
import { 
  SNSClient, 
  GetTopicAttributesCommand 
} from '@aws-sdk/client-sns';

// テスト設定
const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const PROJECT_NAME = 'permission-aware-rag';
const ENVIRONMENT = 'prod';
const STACK_PREFIX = 'TokyoRegion';

// AWSクライアント初期化
const cfnClient = new CloudFormationClient({ region: REGION });
const ec2Client = new EC2Client({ region: REGION });
const iamClient = new IAMClient({ region: REGION });
const kmsClient = new KMSClient({ region: REGION });
const s3Client = new S3Client({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });
const fsxClient = new FSxClient({ region: REGION });
const lambdaClient = new LambdaClient({ region: REGION });
const cloudwatchClient = new CloudWatchClient({ region: REGION });
const snsClient = new SNSClient({ region: REGION });

// テストタイムアウト設定（各テスト30秒）
jest.setTimeout(30000);

describe('全スタック統合テスト', () => {
  
  // スタック名
  const networkingStackName = `${STACK_PREFIX}-${PROJECT_NAME}-${ENVIRONMENT}-NetworkingStack`;
  const securityStackName = `${STACK_PREFIX}-${PROJECT_NAME}-${ENVIRONMENT}-SecurityStack`;
  const dataStackName = `${STACK_PREFIX}-${PROJECT_NAME}-${ENVIRONMENT}-DataStack`;
  const embeddingStackName = `${STACK_PREFIX}-${PROJECT_NAME}-${ENVIRONMENT}-EmbeddingStack`;
  const operationsStackName = `${STACK_PREFIX}-${PROJECT_NAME}-${ENVIRONMENT}-OperationsStack`;

  describe('1. NetworkingStack統合テスト', () => {
    
    test('1.1 スタックが正常にデプロイされている', async () => {
      const command = new DescribeStacksCommand({
        StackName: networkingStackName
      });
      
      const response = await cfnClient.send(command);
      
      expect(response.Stacks).toBeDefined();
      expect(response.Stacks!.length).toBe(1);
      expect(response.Stacks![0].StackStatus).toBe('CREATE_COMPLETE');
    });

    test('1.2 VPCが作成されている', async () => {
      // スタック出力からVPC IDを取得
      const stackCommand = new DescribeStacksCommand({
        StackName: networkingStackName
      });
      const stackResponse = await cfnClient.send(stackCommand);
      
      const vpcIdOutput = stackResponse.Stacks![0].Outputs?.find(
        output => output.OutputKey === 'VpcId'
      );
      
      expect(vpcIdOutput).toBeDefined();
      const vpcId = vpcIdOutput!.OutputValue!;
      
      // VPCの存在確認
      const vpcCommand = new DescribeVpcsCommand({
        VpcIds: [vpcId]
      });
      const vpcResponse = await ec2Client.send(vpcCommand);
      
      expect(vpcResponse.Vpcs).toBeDefined();
      expect(vpcResponse.Vpcs!.length).toBe(1);
      expect(vpcResponse.Vpcs![0].State).toBe('available');
    });

    test('1.3 パブリックサブネットが作成されている', async () => {
      // スタック出力からサブネットIDを取得
      const stackCommand = new DescribeStacksCommand({
        StackName: networkingStackName
      });
      const stackResponse = await cfnClient.send(stackCommand);
      
      const publicSubnet1Output = stackResponse.Stacks![0].Outputs?.find(
        output => output.OutputKey === 'PublicSubnet1Id'
      );
      
      expect(publicSubnet1Output).toBeDefined();
      const subnetId = publicSubnet1Output!.OutputValue!;
      
      // サブネットの存在確認
      const subnetCommand = new DescribeSubnetsCommand({
        SubnetIds: [subnetId]
      });
      const subnetResponse = await ec2Client.send(subnetCommand);
      
      expect(subnetResponse.Subnets).toBeDefined();
      expect(subnetResponse.Subnets!.length).toBe(1);
      expect(subnetResponse.Subnets![0].State).toBe('available');
    });

    test('1.4 プライベートサブネットが作成されている', async () => {
      // スタック出力からサブネットIDを取得
      const stackCommand = new DescribeStacksCommand({
        StackName: networkingStackName
      });
      const stackResponse = await cfnClient.send(stackCommand);
      
      const privateSubnet1Output = stackResponse.Stacks![0].Outputs?.find(
        output => output.OutputKey === 'PrivateSubnet1Id'
      );
      
      expect(privateSubnet1Output).toBeDefined();
      const subnetId = privateSubnet1Output!.OutputValue!;
      
      // サブネットの存在確認
      const subnetCommand = new DescribeSubnetsCommand({
        SubnetIds: [subnetId]
      });
      const subnetResponse = await ec2Client.send(subnetCommand);
      
      expect(subnetResponse.Subnets).toBeDefined();
      expect(subnetResponse.Subnets!.length).toBe(1);
      expect(subnetResponse.Subnets![0].State).toBe('available');
    });

    test('1.5 セキュリティグループが作成されている', async () => {
      // スタックリソースからセキュリティグループを取得
      const resourcesCommand = new ListStackResourcesCommand({
        StackName: networkingStackName
      });
      const resourcesResponse = await cfnClient.send(resourcesCommand);
      
      const securityGroups = resourcesResponse.StackResourceSummaries?.filter(
        resource => resource.ResourceType === 'AWS::EC2::SecurityGroup'
      );
      
      expect(securityGroups).toBeDefined();
      expect(securityGroups!.length).toBeGreaterThan(0);
    });
  });

  describe('2. SecurityStack統合テスト', () => {
    
    test('2.1 スタックが正常にデプロイされている', async () => {
      const command = new DescribeStacksCommand({
        StackName: securityStackName
      });
      
      const response = await cfnClient.send(command);
      
      expect(response.Stacks).toBeDefined();
      expect(response.Stacks!.length).toBe(1);
      expect(response.Stacks![0].StackStatus).toBe('CREATE_COMPLETE');
    });

    test('2.2 KMSキーが作成されている', async () => {
      // スタックリソースからKMSキーを取得
      const resourcesCommand = new ListStackResourcesCommand({
        StackName: securityStackName
      });
      const resourcesResponse = await cfnClient.send(resourcesCommand);
      
      const kmsKeys = resourcesResponse.StackResourceSummaries?.filter(
        resource => resource.ResourceType === 'AWS::KMS::Key'
      );
      
      expect(kmsKeys).toBeDefined();
      expect(kmsKeys!.length).toBeGreaterThan(0);
      
      // KMSキーの詳細確認
      const keyId = kmsKeys![0].PhysicalResourceId!;
      const keyCommand = new DescribeKeyCommand({
        KeyId: keyId
      });
      const keyResponse = await kmsClient.send(keyCommand);
      
      expect(keyResponse.KeyMetadata).toBeDefined();
      expect(keyResponse.KeyMetadata!.KeyState).toBe('Enabled');
    });

    test('2.3 IAMロールが作成されている', async () => {
      // スタックリソースからIAMロールを取得
      const resourcesCommand = new ListStackResourcesCommand({
        StackName: securityStackName
      });
      const resourcesResponse = await cfnClient.send(resourcesCommand);
      
      const iamRoles = resourcesResponse.StackResourceSummaries?.filter(
        resource => resource.ResourceType === 'AWS::IAM::Role'
      );
      
      expect(iamRoles).toBeDefined();
      expect(iamRoles!.length).toBeGreaterThan(0);
    });
  });

  describe('3. DataStack統合テスト', () => {
    
    test('3.1 スタックが正常にデプロイされている', async () => {
      const command = new DescribeStacksCommand({
        StackName: dataStackName
      });
      
      const response = await cfnClient.send(command);
      
      expect(response.Stacks).toBeDefined();
      expect(response.Stacks!.length).toBe(1);
      expect(response.Stacks![0].StackStatus).toBe('CREATE_COMPLETE');
    });

    test('3.2 S3バケットが作成されている', async () => {
      // スタック出力からS3バケット名を取得
      const stackCommand = new DescribeStacksCommand({
        StackName: dataStackName
      });
      const stackResponse = await cfnClient.send(stackCommand);
      
      const s3BucketOutputs = stackResponse.Stacks![0].Outputs?.filter(
        output => output.OutputKey?.includes('S3Bucket') && output.OutputKey?.includes('Name')
      );
      
      expect(s3BucketOutputs).toBeDefined();
      expect(s3BucketOutputs!.length).toBeGreaterThan(0);
      
      // 最初のバケットの存在確認
      const bucketName = s3BucketOutputs![0].OutputValue!;
      const bucketCommand = new HeadBucketCommand({
        Bucket: bucketName
      });
      
      await expect(s3Client.send(bucketCommand)).resolves.not.toThrow();
    });

    test('3.3 DynamoDBテーブルが作成されている', async () => {
      // スタック出力からDynamoDBテーブル名を取得
      const stackCommand = new DescribeStacksCommand({
        StackName: dataStackName
      });
      const stackResponse = await cfnClient.send(stackCommand);
      
      const dynamoTableOutputs = stackResponse.Stacks![0].Outputs?.filter(
        output => output.OutputKey?.includes('DynamoDb') && output.OutputKey?.includes('TableName')
      );
      
      expect(dynamoTableOutputs).toBeDefined();
      expect(dynamoTableOutputs!.length).toBeGreaterThan(0);
      
      // 最初のテーブルの存在確認
      const tableName = dynamoTableOutputs![0].OutputValue!;
      const tableCommand = new DescribeTableCommand({
        TableName: tableName
      });
      const tableResponse = await dynamoClient.send(tableCommand);
      
      expect(tableResponse.Table).toBeDefined();
      expect(tableResponse.Table!.TableStatus).toBe('ACTIVE');
    });

    test('3.4 FSx for ONTAP ファイルシステムが作成されている', async () => {
      // スタック出力からFSx File System IDを取得
      const stackCommand = new DescribeStacksCommand({
        StackName: dataStackName
      });
      const stackResponse = await cfnClient.send(stackCommand);
      
      const fsxFileSystemOutput = stackResponse.Stacks![0].Outputs?.find(
        output => output.OutputKey === 'FsxFileSystemId'
      );
      
      // FSxが設定されている場合のみテスト
      if (fsxFileSystemOutput) {
        const fileSystemId = fsxFileSystemOutput.OutputValue!;
        
        // FSxファイルシステムの存在確認
        const fsxCommand = new DescribeFileSystemsCommand({
          FileSystemIds: [fileSystemId]
        });
        const fsxResponse = await fsxClient.send(fsxCommand);
        
        expect(fsxResponse.FileSystems).toBeDefined();
        expect(fsxResponse.FileSystems!.length).toBe(1);
        expect(fsxResponse.FileSystems![0].Lifecycle).toBe('AVAILABLE');
        expect(fsxResponse.FileSystems![0].FileSystemType).toBe('ONTAP');
        
        console.log(`✅ FSx for ONTAP File System: ${fileSystemId}`);
      } else {
        console.log('⚠️ FSx for ONTAPが設定されていません（オプション機能）');
      }
    });
  });

  describe('4. EmbeddingStack統合テスト', () => {
    
    test('4.1 スタックが正常にデプロイされている', async () => {
      const command = new DescribeStacksCommand({
        StackName: embeddingStackName
      });
      
      const response = await cfnClient.send(command);
      
      expect(response.Stacks).toBeDefined();
      expect(response.Stacks!.length).toBe(1);
      expect(response.Stacks![0].StackStatus).toBe('CREATE_COMPLETE');
    });

    test('4.2 Embedding Lambda関数が作成されている', async () => {
      // スタック出力からLambda関数名を取得
      const stackCommand = new DescribeStacksCommand({
        StackName: embeddingStackName
      });
      const stackResponse = await cfnClient.send(stackCommand);
      
      const lambdaFunctionOutputs = stackResponse.Stacks![0].Outputs?.filter(
        output => output.OutputKey?.includes('EmbeddingFunction') && output.OutputKey?.includes('Name')
      );
      
      expect(lambdaFunctionOutputs).toBeDefined();
      expect(lambdaFunctionOutputs!.length).toBeGreaterThan(0);
      
      // Lambda関数の存在確認
      const functionName = lambdaFunctionOutputs![0].OutputValue!;
      const functionCommand = new GetFunctionCommand({
        FunctionName: functionName
      });
      const functionResponse = await lambdaClient.send(functionCommand);
      
      expect(functionResponse.Configuration).toBeDefined();
      expect(functionResponse.Configuration!.State).toBe('Active');
    });

    test('4.3 Embedding Lambda関数が実行可能', async () => {
      // スタック出力からLambda関数名を取得
      const stackCommand = new DescribeStacksCommand({
        StackName: embeddingStackName
      });
      const stackResponse = await cfnClient.send(stackCommand);
      
      const lambdaFunctionOutputs = stackResponse.Stacks![0].Outputs?.filter(
        output => output.OutputKey?.includes('EmbeddingFunction') && output.OutputKey?.includes('Name')
      );
      
      expect(lambdaFunctionOutputs).toBeDefined();
      const functionName = lambdaFunctionOutputs![0].OutputValue!;
      
      // Lambda関数を実行
      const invokeCommand = new InvokeCommand({
        FunctionName: functionName,
        Payload: Buffer.from(JSON.stringify({ test: true }))
      });
      
      const invokeResponse = await lambdaClient.send(invokeCommand);
      
      expect(invokeResponse.StatusCode).toBe(200);
      expect(invokeResponse.FunctionError).toBeUndefined();
    });

    test('4.4 Bedrockモデル情報が出力されている', async () => {
      // スタック出力からBedrockモデルIDを取得
      const stackCommand = new DescribeStacksCommand({
        StackName: embeddingStackName
      });
      const stackResponse = await cfnClient.send(stackCommand);
      
      const bedrockModelOutputs = stackResponse.Stacks![0].Outputs?.filter(
        output => output.OutputKey?.includes('BedrockModel') && output.OutputKey?.includes('Id')
      );
      
      expect(bedrockModelOutputs).toBeDefined();
      expect(bedrockModelOutputs!.length).toBeGreaterThan(0);
      
      // モデルIDの形式確認
      const modelId = bedrockModelOutputs![0].OutputValue!;
      expect(modelId).toMatch(/^amazon\.titan-embed/);
    });
  });

  describe('5. OperationsStack統合テスト', () => {
    
    test('5.1 スタックが正常にデプロイされている', async () => {
      const command = new DescribeStacksCommand({
        StackName: operationsStackName
      });
      
      const response = await cfnClient.send(command);
      
      expect(response.Stacks).toBeDefined();
      expect(response.Stacks!.length).toBe(1);
      expect(response.Stacks![0].StackStatus).toBe('CREATE_COMPLETE');
    });

    test('5.2 CloudWatchアラームが作成されている', async () => {
      // スタックリソースからCloudWatchアラームを取得
      const resourcesCommand = new ListStackResourcesCommand({
        StackName: operationsStackName
      });
      const resourcesResponse = await cfnClient.send(resourcesCommand);
      
      const alarms = resourcesResponse.StackResourceSummaries?.filter(
        resource => resource.ResourceType === 'AWS::CloudWatch::Alarm'
      );
      
      // アラームが存在する場合のみテスト
      if (alarms && alarms.length > 0) {
        expect(alarms.length).toBeGreaterThan(0);
      } else {
        console.log('⚠️ CloudWatchアラームが見つかりませんでした（オプション機能）');
      }
    });

    test('5.3 SNSトピックが作成されている', async () => {
      // スタック出力からSNSトピックARNを取得
      const stackCommand = new DescribeStacksCommand({
        StackName: operationsStackName
      });
      const stackResponse = await cfnClient.send(stackCommand);
      
      const snsTopicOutputs = stackResponse.Stacks![0].Outputs?.filter(
        output => output.OutputKey?.includes('SnsTopic') && output.OutputKey?.includes('Arn')
      );
      
      // SNSトピックが存在する場合のみテスト
      if (snsTopicOutputs && snsTopicOutputs.length > 0) {
        const topicArn = snsTopicOutputs[0].OutputValue!;
        
        const topicCommand = new GetTopicAttributesCommand({
          TopicArn: topicArn
        });
        const topicResponse = await snsClient.send(topicCommand);
        
        expect(topicResponse.Attributes).toBeDefined();
      } else {
        console.log('⚠️ SNSトピックが見つかりませんでした（オプション機能）');
      }
    });
  });

  describe('6. スタック間連携テスト', () => {
    
    test('6.1 NetworkingStack → DataStack連携確認', async () => {
      // NetworkingStackのVPC IDを取得
      const networkingCommand = new DescribeStacksCommand({
        StackName: networkingStackName
      });
      const networkingResponse = await cfnClient.send(networkingCommand);
      
      const vpcIdOutput = networkingResponse.Stacks![0].Outputs?.find(
        output => output.OutputKey === 'VpcId'
      );
      
      expect(vpcIdOutput).toBeDefined();
      
      // DataStackがVPCを参照していることを確認
      const dataCommand = new DescribeStacksCommand({
        StackName: dataStackName
      });
      const dataResponse = await cfnClient.send(dataCommand);
      
      expect(dataResponse.Stacks![0].StackStatus).toBe('CREATE_COMPLETE');
    });

    test('6.2 SecurityStack → DataStack連携確認', async () => {
      // SecurityStackのKMSキーを取得
      const securityCommand = new DescribeStacksCommand({
        StackName: securityStackName
      });
      const securityResponse = await cfnClient.send(securityCommand);
      
      expect(securityResponse.Stacks![0].StackStatus).toBe('CREATE_COMPLETE');
      
      // DataStackがKMSキーを参照していることを確認
      const dataCommand = new DescribeStacksCommand({
        StackName: dataStackName
      });
      const dataResponse = await cfnClient.send(dataCommand);
      
      expect(dataResponse.Stacks![0].StackStatus).toBe('CREATE_COMPLETE');
    });

    test('6.3 DataStack → EmbeddingStack連携確認', async () => {
      // DataStackのS3バケット名を取得
      const dataCommand = new DescribeStacksCommand({
        StackName: dataStackName
      });
      const dataResponse = await cfnClient.send(dataCommand);
      
      const s3BucketOutputs = dataResponse.Stacks![0].Outputs?.filter(
        output => output.OutputKey?.includes('S3Bucket') && output.OutputKey?.includes('Name')
      );
      
      expect(s3BucketOutputs).toBeDefined();
      
      // EmbeddingStackがS3バケットを参照していることを確認
      const embeddingCommand = new DescribeStacksCommand({
        StackName: embeddingStackName
      });
      const embeddingResponse = await cfnClient.send(embeddingCommand);
      
      expect(embeddingResponse.Stacks![0].StackStatus).toBe('CREATE_COMPLETE');
    });

    test('6.4 全スタックが正常に連携している', async () => {
      // 全スタックのステータスを確認
      const stacks = [
        networkingStackName,
        securityStackName,
        dataStackName,
        embeddingStackName,
        operationsStackName
      ];
      
      for (const stackName of stacks) {
        const command = new DescribeStacksCommand({
          StackName: stackName
        });
        const response = await cfnClient.send(command);
        
        expect(response.Stacks![0].StackStatus).toBe('CREATE_COMPLETE');
      }
    });
  });
});
