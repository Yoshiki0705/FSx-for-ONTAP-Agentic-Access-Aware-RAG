/**
 * デモスタック ユニットテスト + プロパティテスト
 * 
 * Property 1: CDKパラメータがリソース名に反映される (要件 1.4)
 * StorageStack: FSx ONTAP, SG, S3バケット検証 (要件 2.1, 2.4)
 * AIStack: OpenSearch Serverless, Bedrock KB検証 (要件 4.1, 4.2)
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as fc from 'fast-check';
import { DemoNetworkingStack } from '../../lib/stacks/demo/demo-networking-stack';
import { DemoSecurityStack } from '../../lib/stacks/demo/demo-security-stack';
import { DemoStorageStack } from '../../lib/stacks/demo/demo-storage-stack';
import { DemoAIStack } from '../../lib/stacks/demo/demo-ai-stack';

// ========================================
// ヘルパー: テスト用スタック群を生成
// ========================================

function createTestStacks(projectName: string, environment: string) {
  const app = new cdk.App();

  const networking = new DemoNetworkingStack(app, 'TestNetworking', {
    projectName,
    environment,
  });

  const security = new DemoSecurityStack(app, 'TestSecurity', {
    projectName,
    environment,
  });

  const storage = new DemoStorageStack(app, 'TestStorage', {
    projectName,
    environment,
    vpc: networking.vpc,
    privateSubnets: networking.privateSubnets,
    fsxSg: networking.fsxSg,
  });

  const ai = new DemoAIStack(app, 'TestAI', {
    projectName,
    environment,
    dataBucket: storage.dataBucket,
  });

  return { app, networking, security, storage, ai };
}

// ========================================
// Property 1: CDKパラメータがリソース名に反映される
// ========================================

describe('Property 1: CDKパラメータがリソース名に反映される', () => {
  // CDKリソース名に使える安全な文字列を生成
  const safeNameArb = fc.string({ minLength: 3, maxLength: 12 })
    .filter(s => /^[a-z][a-z0-9]+$/.test(s));

  it('projectNameがVPC名に反映される', () => {
    fc.assert(
      fc.property(safeNameArb, safeNameArb, (projectName: string, environment: string) => {
        const { networking } = createTestStacks(projectName, environment);
        const template = Template.fromStack(networking);
        const prefix = `${projectName}-${environment}`;

        // VPC名にprefixが含まれる
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
      TimeToLiveSpecification: {
        AttributeName: 'ttl',
        Enabled: true,
      },
    });
  });

  it('DynamoDB権限キャッシュテーブルのPKがcacheKey', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: Match.arrayWith([
        Match.objectLike({ AttributeName: 'cacheKey', KeyType: 'HASH' }),
      ]),
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

  it('暗号化ポリシーが作成される', () => {
    template.hasResourceProperties('AWS::OpenSearchServerless::SecurityPolicy', {
      Type: 'encryption',
    });
  });

  it('ネットワークポリシーが作成される', () => {
    template.hasResourceProperties('AWS::OpenSearchServerless::SecurityPolicy', {
      Type: 'network',
    });
  });
});
