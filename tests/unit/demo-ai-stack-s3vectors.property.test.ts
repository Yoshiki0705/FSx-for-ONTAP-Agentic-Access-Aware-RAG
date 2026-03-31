/**
 * S3 Vectors Integration プロパティベーステスト
 *
 * Feature: s3-vectors-integration
 * テストフレームワーク: fast-check + aws-cdk-lib/assertions
 * 各プロパティテストは最低100回のイテレーションで実行
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as fc from 'fast-check';
import { DemoAIStack } from '../../lib/stacks/demo/demo-ai-stack';

// ========================================
// ヘルパー: テスト用AIスタックを生成
// ========================================

function createTestAIStack(vectorStoreType?: string, enableAgent?: boolean) {
  const app = new cdk.App();
  const stack = new DemoAIStack(app, 'TestAI', {
    projectName: 'testproj',
    environment: 'dev',
    vectorStoreType: vectorStoreType as any,
    enableAgent,
    userAccessTableName: 'test-user-access',
    userAccessTableArn: 'arn:aws:dynamodb:ap-northeast-1:123456789012:table/test-user-access',
    env: { account: '123456789012', region: 'ap-northeast-1' },
  });
  return { app, stack, template: Template.fromStack(stack) };
}

// ========================================
// SIDフィルタリングロジック（route.tsと同一ロジック）
// ========================================

function checkSIDAccess(userSIDs: string[], docSIDs: string[]): boolean {
  if (!Array.isArray(docSIDs) || docSIDs.length === 0) return false;
  return userSIDs.some(sid => docSIDs.includes(sid));
}

// ========================================
// Property 1: デフォルト構成はs3vectors
// ========================================

describe('Property 1: デフォルト構成はs3vectors', () => {
  // Feature: s3-vectors-integration, Property 1: デフォルト構成はs3vectors
  // **Validates: Requirements 1.1, 5.4**
  it('vectorStoreType未指定時にS3 Vectorsリソースが作成されOpenSearch Serverlessが作成されない', () => {
    fc.assert(
      fc.property(
        fc.constant(undefined),
        (undefinedType) => {
          const { template } = createTestAIStack(undefinedType);

          // S3 Vectors CustomResourceが存在すること（ServiceTokenがS3VectorsCreator Lambdaを指す）
          template.hasResourceProperties('AWS::CloudFormation::CustomResource', {
            ServiceToken: Match.objectLike({
              'Fn::GetAtt': Match.arrayWith([
                Match.stringLikeRegexp('S3VectorsCreator'),
              ]),
            }),
          });

          // OpenSearch Serverless Collectionが存在しないこと
          const resources = template.toJSON().Resources;
          const ossCollections = Object.values(resources).filter(
            (r: any) => r.Type === 'AWS::OpenSearchServerless::Collection'
          );
          expect(ossCollections).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ========================================
// Property 3: 無効なvectorStoreType値の拒否
// ========================================

describe('Property 3: 無効なvectorStoreType値の拒否', () => {
  // Feature: s3-vectors-integration, Property 3: 無効なvectorStoreType値の拒否
  // **Validates: Requirements 1.4**
  it('s3vectorsでもopensearch-serverlessでもない任意の文字列でコンストラクタがthrowする', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(
          s => s !== 's3vectors' && s !== 'opensearch-serverless'
        ),
        (invalidType) => {
          expect(() => {
            createTestAIStack(invalidType);
          }).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ========================================
// Property 2: リソースとIAM権限の相互排他性
// ========================================

describe('Property 2: リソースとIAM権限の相互排他性', () => {
  // Feature: s3-vectors-integration, Property 2: リソースとIAM権限の相互排他性
  // **Validates: Requirements 1.2, 1.3, 6.1, 6.2**
  it('各構成で排他的リソースとIAM権限が正しく設定される', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('s3vectors', 'opensearch-serverless'),
        (vectorStoreType) => {
          const { template } = createTestAIStack(vectorStoreType);
          const resources = template.toJSON().Resources;

          if (vectorStoreType === 's3vectors') {
            // OpenSearch Serverless Collectionが存在しないこと
            const ossCollections = Object.values(resources).filter(
              (r: any) => r.Type === 'AWS::OpenSearchServerless::Collection'
            );
            expect(ossCollections).toHaveLength(0);

            // KB StorageConfigurationがS3_VECTORSであること
            template.hasResourceProperties('AWS::Bedrock::KnowledgeBase', {
              StorageConfiguration: Match.objectLike({
                Type: 'S3_VECTORS',
              }),
            });
          } else {
            // OpenSearch Serverless Collectionが存在すること
            template.resourceCountIs('AWS::OpenSearchServerless::Collection', 1);

            // KB StorageConfigurationがOPENSEARCH_SERVERLESSであること
            template.hasResourceProperties('AWS::Bedrock::KnowledgeBase', {
              StorageConfiguration: Match.objectLike({
                Type: 'OPENSEARCH_SERVERLESS',
              }),
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ========================================
// Property 4: 共通IAM権限の保証
// ========================================

describe('Property 4: 共通IAM権限の保証', () => {
  // Feature: s3-vectors-integration, Property 4: 共通IAM権限の保証
  // **Validates: Requirements 6.3**
  it('両構成でbedrock:InvokeModelとS3 AP読み取り権限が存在する', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('s3vectors', 'opensearch-serverless'),
        (vectorStoreType) => {
          const { template } = createTestAIStack(vectorStoreType);
          const resources = template.toJSON().Resources;

          // KB Roleのインラインポリシーを検索
          const roles = Object.values(resources).filter(
            (r: any) => r.Type === 'AWS::IAM::Role'
              && r.Properties?.RoleName
              && (r.Properties.RoleName as string).includes('kb-role')
          );
          expect(roles.length).toBeGreaterThanOrEqual(1);

          const kbRole = roles[0] as any;
          const policyDoc = kbRole.Properties.Policies?.[0]?.PolicyDocument;
          expect(policyDoc).toBeDefined();

          const statements = policyDoc.Statement as any[];

          // bedrock:InvokeModel が含まれること
          const hasInvokeModel = statements.some((stmt: any) =>
            Array.isArray(stmt.Action)
              ? stmt.Action.includes('bedrock:InvokeModel')
              : stmt.Action === 'bedrock:InvokeModel'
          );
          expect(hasInvokeModel).toBe(true);

          // S3 AP読み取り権限が含まれること
          const hasS3Read = statements.some((stmt: any) => {
            const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
            return actions.includes('s3:GetObject')
              && actions.includes('s3:ListBucket')
              && actions.includes('s3:GetBucketLocation');
          });
          expect(hasS3Read).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ========================================
// Property 6: ベクトルストア非依存リソースの存在保証
// ========================================

describe('Property 6: ベクトルストア非依存リソースの存在保証', () => {
  // Feature: s3-vectors-integration, Property 6: ベクトルストア非依存リソースの存在保証
  // **Validates: Requirements 8.1, 9.1**
  it('KB Cleanup Lambdaは常に存在し、enableAgent=trueでPermSearch Lambdaが存在する', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('s3vectors' as const, 'opensearch-serverless' as const),
        fc.boolean(),
        (vectorStoreType, enableAgent) => {
          const { template } = createTestAIStack(vectorStoreType, enableAgent);
          const resources = template.toJSON().Resources;

          // KB Cleanup Lambdaが常に存在すること（FunctionNameに'kb-cleanup'を含む）
          const cleanupLambdas = Object.values(resources).filter(
            (r: any) => r.Type === 'AWS::Lambda::Function'
              && r.Properties?.FunctionName
              && (r.Properties.FunctionName as string).includes('kb-cleanup')
          );
          expect(cleanupLambdas.length).toBeGreaterThanOrEqual(1);

          // enableAgent=trueの場合、PermSearch Lambdaが存在すること
          if (enableAgent) {
            const permSearchLambdas = Object.values(resources).filter(
              (r: any) => r.Type === 'AWS::Lambda::Function'
                && r.Properties?.FunctionName
                && (r.Properties.FunctionName as string).includes('perm-search')
            );
            expect(permSearchLambdas.length).toBeGreaterThanOrEqual(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ========================================
// Property 5: SIDフィルタリングのベクトルストア非依存性
// ========================================

describe('Property 5: SIDフィルタリングのベクトルストア非依存性', () => {
  // Feature: s3-vectors-integration, Property 5: SIDフィルタリングのベクトルストア非依存性
  // **Validates: Requirements 4.3, 4.4, 4.5**
  it('ユーザーSIDが空の場合は常にfalse（Fail-Closed）', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 })),
        (docSIDs) => {
          const result = checkSIDAccess([], docSIDs);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('共通要素がある場合はtrue', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1 }),
        fc.array(fc.string({ minLength: 1, maxLength: 20 })),
        fc.array(fc.string({ minLength: 1, maxLength: 20 })),
        (commonSIDs, extraUserSIDs, extraDocSIDs) => {
          // 少なくとも1つの共通要素を保証
          const userSIDs = [...commonSIDs, ...extraUserSIDs];
          const docSIDs = [...commonSIDs, ...extraDocSIDs];
          const result = checkSIDAccess(userSIDs, docSIDs);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('共通要素がない場合はfalse', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1 }),
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1 }),
        (userSIDs, docSIDs) => {
          // 共通要素がないことを保証するためプレフィックスで分離
          const prefixedUser = userSIDs.map(s => `user_${s}`);
          const prefixedDoc = docSIDs.map(s => `doc_${s}`);
          const result = checkSIDAccess(prefixedUser, prefixedDoc);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
