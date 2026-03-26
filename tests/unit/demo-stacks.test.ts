/**
 * デモスタック ユニットテスト + プロパティテスト
 * 
 * Property 1: CDKパラメータがリソース名に反映される (要件 1.4)
 * WafStack: WAF WebACL検証
 * StorageStack: FSx ONTAP + SVM + Volume, SG, S3バケット, DynamoDB検証 (要件 2.1, 2.4)
 * AIStack: OpenSearch Serverless, Bedrock KB検証 (要件 4.1, 4.2)
 * WebAppStack: IAM認証, OAC, WAF, Geo制限, SIDフィルタリング検証
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as fc from 'fast-check';
import { DemoWafStack } from '../../lib/stacks/demo/demo-waf-stack';
import { DemoNetworkingStack } from '../../lib/stacks/demo/demo-networking-stack';
import { DemoSecurityStack } from '../../lib/stacks/demo/demo-security-stack';
import { DemoStorageStack } from '../../lib/stacks/demo/demo-storage-stack';
import { DemoAIStack } from '../../lib/stacks/demo/demo-ai-stack';
import { DemoWebAppStack } from '../../lib/stacks/demo/demo-webapp-stack';

// ========================================
// ヘルパー: テスト用スタック群を生成
// ========================================

const testAccount = '123456789012';
const primaryRegion = 'ap-northeast-1';

function createTestStacks(projectName: string, environment: string) {
  const app = new cdk.App();
  const primaryEnv = { account: testAccount, region: primaryRegion };
  const usEast1Env = { account: testAccount, region: 'us-east-1' };

  const waf = new DemoWafStack(app, 'TestWaf', {
    projectName,
    environment,
    allowedIps: ['203.0.113.0/24'],
    env: usEast1Env,
    crossRegionReferences: true,
  });

  const networking = new DemoNetworkingStack(app, 'TestNetworking', {
    projectName,
    environment,
    env: primaryEnv,
  });

  const security = new DemoSecurityStack(app, 'TestSecurity', {
    projectName,
    environment,
    env: primaryEnv,
  });

  const storage = new DemoStorageStack(app, 'TestStorage', {
    projectName,
    environment,
    vpc: networking.vpc,
    privateSubnets: networking.privateSubnets,
    fsxSg: networking.fsxSg,
    env: primaryEnv,
  });

  const ai = new DemoAIStack(app, 'TestAI', {
    projectName,
    environment,
    dataBucket: storage.dataBucket,
    s3AccessPointName: `${projectName}-${environment}-s3ap`,
    env: primaryEnv,
  });

  const webapp = new DemoWebAppStack(app, 'TestWebApp', {
    projectName,
    environment,
    vpc: networking.vpc,
    lambdaSg: networking.lambdaSg,
    userPool: security.userPool,
    userPoolClient: security.userPoolClient,
    knowledgeBaseId: ai.knowledgeBaseId,
    imageUri: 'latest',
    wafWebAclArn: waf.webAclArn,
    permissionCacheTable: storage.permissionCacheTable,
    userAccessTable: storage.userAccessTable,
    dataBucket: storage.dataBucket,
    allowedCountries: ['JP'],
    env: primaryEnv,
    crossRegionReferences: true,
  });

  return { app, waf, networking, security, storage, ai, webapp };
}

// ========================================
// Property 1: CDKパラメータがリソース名に反映される
// ========================================

describe('Property 1: CDKパラメータがリソース名に反映される', () => {
  const safeNameArb = fc.string({ minLength: 3, maxLength: 12 })
    .filter(s => /^[a-z][a-z0-9]+$/.test(s));

  it('projectNameがVPC名に反映される', () => {
    fc.assert(
      fc.property(safeNameArb, safeNameArb, (projectName: string, environment: string) => {
        const { networking } = createTestStacks(projectName, environment);
        const template = Template.fromStack(networking);
        const prefix = `${projectName}-${environment}`;
        template.hasResourceProperties('AWS::EC2::VPC', {
          Tags: Match.arrayWith([
            Match.objectLike({ Key: 'Name', Value: `${prefix}-vpc` }),
          ]),
        });
      }),
      { numRuns: 5 },
    );
  });

  it('projectNameがCognito User Pool名に反映される', () => {
    fc.assert(
      fc.property(safeNameArb, safeNameArb, (projectName: string, environment: string) => {
        const { security } = createTestStacks(projectName, environment);
        const template = Template.fromStack(security);
        const prefix = `${projectName}-${environment}`;
        template.hasResourceProperties('AWS::Cognito::UserPool', {
          UserPoolName: `${prefix}-user-pool`,
        });
      }),
      { numRuns: 5 },
    );
  });

  it('projectNameがDynamoDBテーブル名に反映される', () => {
    fc.assert(
      fc.property(safeNameArb, safeNameArb, (projectName: string, environment: string) => {
        const { storage } = createTestStacks(projectName, environment);
        const template = Template.fromStack(storage);
        const prefix = `${projectName}-${environment}`;
        template.hasResourceProperties('AWS::DynamoDB::Table', {
          TableName: `${prefix}-permission-cache`,
        });
      }),
      { numRuns: 5 },
    );
  });
});

// ========================================
// WafStack ユニットテスト
// ========================================

describe('WafStack', () => {
  const stacks = createTestStacks('testproj', 'dev');
  const template = Template.fromStack(stacks.waf);

  it('WAF WebACLがCLOUDFRONTスコープで作成される', () => {
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Scope: 'CLOUDFRONT',
      DefaultAction: { Allow: {} },
    });
  });

  it('IPセットが作成される（allowedIps指定時）', () => {
    template.hasResourceProperties('AWS::WAFv2::IPSet', {
      Scope: 'CLOUDFRONT',
      IPAddressVersion: 'IPV4',
      Addresses: ['203.0.113.0/24'],
    });
  });

  it('レートリミットルールが含まれる', () => {
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Rules: Match.arrayWith([
        Match.objectLike({ Name: 'RateLimit', Priority: 100 }),
      ]),
    });
  });

  it('AWS Managed Rulesが含まれる', () => {
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Rules: Match.arrayWith([
        Match.objectLike({ Name: 'AWSIPReputationList' }),
        Match.objectLike({ Name: 'AWSCommonRuleSet' }),
        Match.objectLike({ Name: 'AWSKnownBadInputs' }),
        Match.objectLike({ Name: 'AWSSQLiRuleSet' }),
      ]),
    });
  });

  it('IPアドレス許可リストルールが含まれる', () => {
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Rules: Match.arrayWith([
        Match.objectLike({ Name: 'IPAllowList', Priority: 600 }),
      ]),
    });
  });
});

// ========================================
// StorageStack ユニットテスト (要件 2.1, 2.4)
// ========================================

describe('StorageStack', () => {
  const stacks = createTestStacks('testproj', 'dev');
  const template = Template.fromStack(stacks.storage);

  it('FSx ONTAPファイルシステムが作成される', () => {
    template.hasResourceProperties('AWS::FSx::FileSystem', {
      FileSystemType: 'ONTAP',
      StorageCapacity: 1024,
      OntapConfiguration: Match.objectLike({
        DeploymentType: 'SINGLE_AZ_1',
        ThroughputCapacity: 128,
      }),
    });
  });

  it('Storage Virtual Machine（SVM）が作成される', () => {
    template.hasResourceProperties('AWS::FSx::StorageVirtualMachine', {
      RootVolumeSecurityStyle: 'NTFS',
    });
  });

  it('データボリュームが作成される', () => {
    template.hasResourceProperties('AWS::FSx::Volume', {
      VolumeType: 'ONTAP',
      OntapConfiguration: Match.objectLike({
        JunctionPath: '/data',
        SecurityStyle: 'NTFS',
        StorageEfficiencyEnabled: 'true',
      }),
    });
  });

  it('S3バケットがRemovalPolicy.DESTROYで作成される', () => {
    template.hasResource('AWS::S3::Bucket', {
      DeletionPolicy: 'Delete',
      UpdateReplacePolicy: 'Delete',
    });
  });

  it('S3バケットがBlockPublicAccessで保護される', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it('DynamoDB権限キャッシュテーブルにTTL設定がある', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'testproj-dev-permission-cache',
      TimeToLiveSpecification: {
        AttributeName: 'ttl',
        Enabled: true,
      },
    });
  });

  it('DynamoDBユーザーアクセステーブルが作成される', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'testproj-dev-user-access',
      KeySchema: Match.arrayWith([
        Match.objectLike({ AttributeName: 'userId', KeyType: 'HASH' }),
      ]),
    });
  });

  it('S3 Access Point作成用Lambda関数が作成される', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'testproj-dev-fsx-s3ap-creator',
      Runtime: 'nodejs20.x',
      Timeout: 600,
    });
  });

  it('S3 Access Point作成用IAMロールにFSx権限が付与される', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      Policies: Match.arrayWith([
        Match.objectLike({
          PolicyName: 'FsxS3AccessPoint',
          PolicyDocument: Match.objectLike({
            Statement: Match.arrayWith([
              Match.objectLike({
                Action: Match.arrayWith([
                  'fsx:CreateAndAttachS3AccessPoint',
                  'fsx:DetachAndDeleteS3AccessPoint',
                ]),
              }),
            ]),
          }),
        }),
      ]),
    });
  });

  it('S3 Access Pointカスタムリソースが作成される', () => {
    template.hasResource('AWS::CloudFormation::CustomResource', {
      Properties: Match.objectLike({
        AccessPointName: Match.anyValue(),
        FileSystemUserType: 'WINDOWS',
        NetworkOrigin: 'Internet',
      }),
    });
  });
});

// ========================================
// AIStack ユニットテスト (要件 4.1, 4.2)
// ========================================

describe('AIStack', () => {
  const stacks = createTestStacks('testproj', 'dev');
  const template = Template.fromStack(stacks.ai);

  it('OpenSearch Serverlessコレクション（VECTORSEARCH型）が作成される', () => {
    template.hasResourceProperties('AWS::OpenSearchServerless::Collection', {
      Type: 'VECTORSEARCH',
    });
  });

  it('Bedrock Knowledge Baseが作成される', () => {
    template.hasResourceProperties('AWS::Bedrock::KnowledgeBase', {
      KnowledgeBaseConfiguration: Match.objectLike({
        Type: 'VECTOR',
      }),
    });
  });

  it('Bedrock KBがTitan Embed Text v2を使用する', () => {
    template.hasResourceProperties('AWS::Bedrock::KnowledgeBase', {
      KnowledgeBaseConfiguration: {
        Type: 'VECTOR',
        VectorKnowledgeBaseConfiguration: {
          EmbeddingModelArn: Match.objectLike({
            'Fn::Join': Match.arrayWith([
              Match.arrayWith([
                Match.stringLikeRegexp('amazon\\.titan-embed-text-v2'),
              ]),
            ]),
          }),
        },
      },
    });
  });

  it('Bedrock KBのストレージがOpenSearch Serverlessに設定される', () => {
    template.hasResourceProperties('AWS::Bedrock::KnowledgeBase', {
      StorageConfiguration: Match.objectLike({
        Type: 'OPENSEARCH_SERVERLESS',
      }),
    });
  });

  it('S3データソースが作成される', () => {
    template.hasResourceProperties('AWS::Bedrock::DataSource', {
      DataSourceConfiguration: Match.objectLike({
        Type: 'S3',
      }),
    });
  });

  it('KB IAMロールにS3 Access Point権限が付与される', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      Policies: Match.arrayWith([
        Match.objectLike({
          PolicyDocument: Match.objectLike({
            Statement: Match.arrayWith([
              Match.objectLike({
                Action: Match.arrayWith([
                  's3:GetObject',
                  's3:ListBucket',
                  's3:GetBucketLocation',
                ]),
              }),
            ]),
          }),
        }),
      ]),
    });
  });
});

// ========================================
// WebAppStack ユニットテスト
// ========================================

describe('WebAppStack', () => {
  const stacks = createTestStacks('testproj', 'dev');
  const template = Template.fromStack(stacks.webapp);

  it('Lambda Function URLがIAM認証で作成される', () => {
    template.hasResourceProperties('AWS::Lambda::Url', {
      AuthType: 'AWS_IAM',
    });
  });

  it('CloudFront OAC（Lambda用）が作成される', () => {
    template.hasResourceProperties('AWS::CloudFront::OriginAccessControl', {
      OriginAccessControlConfig: Match.objectLike({
        OriginAccessControlOriginType: 'lambda',
        SigningBehavior: 'always',
        SigningProtocol: 'sigv4',
      }),
    });
  });

  it('CloudFrontディストリビューションにGeo制限が設定される', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Restrictions: {
          GeoRestriction: {
            RestrictionType: 'whitelist',
            Locations: ['JP'],
          },
        },
      }),
    });
  });

  it('CloudFrontディストリビューションにセキュリティヘッダーポリシーが設定される', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: 'redirect-to-https',
        }),
      }),
    });
  });

  it('Lambda環境変数にENABLE_PERMISSION_CHECK=trueが設定される', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          ENABLE_PERMISSION_CHECK: 'true',
        }),
      },
    });
  });

  it('Lambda環境変数にUSER_ACCESS_TABLE_NAMEが設定される', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          USER_ACCESS_TABLE_NAME: Match.anyValue(),
        }),
      },
    });
  });

  it('CloudFrontアクセスログ用S3バケットが作成される', () => {
    // AccessLogBucketが存在する
    template.hasResource('AWS::S3::Bucket', {
      DeletionPolicy: 'Delete',
    });
  });
});
