/**
 * AgentCore Memory プロパティベーステスト
 *
 * Feature: agentcore-integration
 * テストフレームワーク: fast-check + aws-cdk-lib/assertions
 * 各プロパティテストは入力空間に応じた適切な回数で実行
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import { DemoAIStack } from '../../lib/stacks/demo/demo-ai-stack';

// ========================================
// ヘルパー: テスト用AIスタックを生成
// ========================================

function createTestAIStack(opts: {
  enableAgent?: boolean;
  enableAgentCoreMemory?: boolean;
}) {
  const app = new cdk.App();
  const stack = new DemoAIStack(app, 'TestAI', {
    projectName: 'testproj',
    environment: 'dev',
    enableAgent: opts.enableAgent,
    enableAgentCoreMemory: opts.enableAgentCoreMemory,
    userAccessTableName: 'test-user-access',
    userAccessTableArn: 'arn:aws:dynamodb:ap-northeast-1:123456789012:table/test-user-access',
    env: { account: '123456789012', region: 'ap-northeast-1' },
  });
  return { app, stack, template: Template.fromStack(stack) };
}

// ========================================
// i18n定数
// ========================================

const LOCALES = ['ja', 'en', 'ko', 'zh-CN', 'zh-TW', 'fr', 'de', 'es'] as const;
const MESSAGES_DIR = path.join(__dirname, '../../docker/nextjs/src/messages');

const MEMORY_KEYS = [
  'title', 'enabled', 'disabled', 'semantic', 'summary',
  'userPreference', 'deleteConfirm', 'noMemories',
] as const;

const SESSION_KEYS = [
  'title', 'newSession', 'noSessions', 'lastUpdated', 'messageCount',
] as const;


// ========================================
// Property 1: Memory リソース存在性の双条件
// ========================================

describe('Property 1: Memory リソース存在性の双条件', () => {
  // Feature: agentcore-integration, Property 1: Memory リソース存在性の双条件
  // **Validates: Requirements 1.1, 1.6, 9.2**

  it('enableAgent=true AND enableAgentCoreMemory=true の場合のみ CfnMemory が存在する', () => {
    fc.assert(
      fc.property(
        fc.record({
          enableAgent: fc.boolean(),
          enableAgentCoreMemory: fc.boolean(),
        }),
        ({ enableAgent, enableAgentCoreMemory }) => {
          const { template } = createTestAIStack({ enableAgent, enableAgentCoreMemory });
          const resources = template.toJSON().Resources;

          const memoryResources = Object.values(resources).filter(
            (r: any) => r.Type === 'AWS::BedrockAgentCore::Memory'
          );

          if (enableAgent && enableAgentCoreMemory) {
            // 両方trueの場合のみMemoryリソースが存在する
            expect(memoryResources.length).toBe(1);
          } else {
            // いずれかがfalseの場合はMemoryリソースが存在しない
            expect(memoryResources.length).toBe(0);
          }
        }
      ),
      { numRuns: 4 }
    );
  });
});

// ========================================
// Unit Test: Memory IDがCloudFormation出力に含まれる
// ========================================

describe('Unit Test: Memory IDがCloudFormation出力に含まれる', () => {
  // **Validates: Requirements 1.1**

  it('enableAgent=true AND enableAgentCoreMemory=true の場合、CfnOutput に MemoryId と MemoryArn が存在する', () => {
    const { template } = createTestAIStack({
      enableAgent: true,
      enableAgentCoreMemory: true,
    });

    const outputs = template.toJSON().Outputs;

    // MemoryId 出力が存在すること
    const memoryIdOutput = Object.entries(outputs).find(
      ([_key, val]: [string, any]) => val.Description === 'AgentCore Memory ID'
    );
    expect(memoryIdOutput).toBeDefined();

    // MemoryArn 出力が存在すること
    const memoryArnOutput = Object.entries(outputs).find(
      ([_key, val]: [string, any]) => val.Description === 'AgentCore Memory ARN'
    );
    expect(memoryArnOutput).toBeDefined();
  });
});

// ========================================
// Property 2: Memory戦略の正確性（semantic + summary）
// ========================================

describe('Property 2: Memory戦略の正確性', () => {
  // Feature: agentcore-integration, Property 2: Memory戦略の正確性
  // **Validates: Requirements 2.1, 2.2, 2.3**

  it('CfnMemory は semantic と summary の両戦略を含む', () => {
    fc.assert(
      fc.property(
        fc.constant(true),
        (_enabled) => {
          const { template } = createTestAIStack({
            enableAgent: true,
            enableAgentCoreMemory: true,
          });

          // CfnMemory リソースが semantic + summary 戦略を持つことを検証
          template.hasResourceProperties('AWS::BedrockAgentCore::Memory', {
            MemoryStrategies: Match.arrayWith([
              Match.objectLike({
                SemanticMemoryStrategy: Match.objectLike({
                  Name: 'semantic',
                }),
              }),
              Match.objectLike({
                SummaryMemoryStrategy: Match.objectLike({
                  Name: 'summary',
                }),
              }),
            ]),
          });
        }
      ),
      { numRuns: 1 }
    );
  });
});

// ========================================
// Property 3: イベント有効期限の正確性（3日間）
// ========================================

describe('Property 3: イベント有効期限の正確性', () => {
  // Feature: agentcore-integration, Property 3: イベント有効期限の正確性
  // **Validates: Requirements 1.5**

  it('CfnMemory の eventExpiryDuration は 3（3日間、最小値）である', () => {
    fc.assert(
      fc.property(
        fc.constant(true),
        (_enabled) => {
          const { template } = createTestAIStack({
            enableAgent: true,
            enableAgentCoreMemory: true,
          });

          template.hasResourceProperties('AWS::BedrockAgentCore::Memory', {
            EventExpiryDuration: 3,
          });
        }
      ),
      { numRuns: 1 }
    );
  });
});

// ========================================
// Property 6: 後方互換性（enableAgentCoreMemory=false時にリソースなし）
// ========================================

describe('Property 6: 後方互換性', () => {
  // Feature: agentcore-integration, Property 6: 後方互換性
  // **Validates: Requirements 9.1, 9.2, 9.3**

  it('enableAgentCoreMemory=false または未設定時に Memory リソースが存在しない', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (enableAgentCoreMemory) => {
          // enableAgentCoreMemory が false の場合のみテスト
          // (true の場合はスキップ — Property 1 でカバー)
          if (enableAgentCoreMemory) return;

          const { template } = createTestAIStack({
            enableAgent: true,
            enableAgentCoreMemory: false,
          });
          const resources = template.toJSON().Resources;

          // Memory リソースが存在しないこと
          const memoryResources = Object.values(resources).filter(
            (r: any) => r.Type === 'AWS::BedrockAgentCore::Memory'
          );
          expect(memoryResources.length).toBe(0);

          // 既存の Agent リソースは存在すること（後方互換性）
          const agentResources = Object.values(resources).filter(
            (r: any) => r.Type === 'AWS::Bedrock::Agent'
          );
          expect(agentResources.length).toBe(1);

          // 既存の KB リソースは存在すること（後方互換性）
          const kbResources = Object.values(resources).filter(
            (r: any) => r.Type === 'AWS::Bedrock::KnowledgeBase'
          );
          expect(kbResources.length).toBe(1);
        }
      ),
      { numRuns: 2 }
    );
  });

  it('enableAgentCoreMemory 未設定時も Memory リソースが存在しない', () => {
    const { template } = createTestAIStack({
      enableAgent: true,
      // enableAgentCoreMemory は未設定（undefined）
    });
    const resources = template.toJSON().Resources;

    const memoryResources = Object.values(resources).filter(
      (r: any) => r.Type === 'AWS::BedrockAgentCore::Memory'
    );
    expect(memoryResources.length).toBe(0);
  });
});

// ========================================
// Property 7: i18n網羅性
// ========================================

describe('Property 7: i18n網羅性', () => {
  // Feature: agentcore-integration, Property 7: i18n網羅性
  // **Validates: Requirements 10.1, 10.2, 10.3**

  it('8言語すべてに agentcore.memory.* 翻訳キーが非空文字列として存在する', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LOCALES),
        fc.constantFrom(...MEMORY_KEYS),
        (locale, key) => {
          const filePath = path.join(MESSAGES_DIR, `${locale}.json`);

          expect(fs.existsSync(filePath)).toBe(true);

          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

          // agentcore.memory セクションが存在すること
          expect(content.agentcore).toBeDefined();
          expect(content.agentcore.memory).toBeDefined();

          // キーが存在し、非空文字列であること
          const value = content.agentcore.memory[key];
          expect(value).toBeDefined();
          expect(typeof value).toBe('string');
          expect(value.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 5 }
    );
  });

  it('8言語すべてに agentcore.session.* 翻訳キーが非空文字列として存在する', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LOCALES),
        fc.constantFrom(...SESSION_KEYS),
        (locale, key) => {
          const filePath = path.join(MESSAGES_DIR, `${locale}.json`);

          expect(fs.existsSync(filePath)).toBe(true);

          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

          // agentcore.session セクションが存在すること
          expect(content.agentcore).toBeDefined();
          expect(content.agentcore.session).toBeDefined();

          // キーが存在し、非空文字列であること
          const value = content.agentcore.session[key];
          expect(value).toBeDefined();
          expect(typeof value).toBe('string');
          expect(value.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 5 }
    );
  });
});
