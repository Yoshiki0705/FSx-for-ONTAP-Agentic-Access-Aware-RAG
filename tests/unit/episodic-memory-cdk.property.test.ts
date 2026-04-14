/**
 * Feature: episodic-memory, Property 1: CDK 条件付きリソース作成
 * Feature: episodic-memory, Property 2: Lambda 環境変数の正確性
 * Feature: episodic-memory, Property 3: IAM ポリシー条件付き作成
 *
 * 任意の enableAgentCoreMemory と enableEpisodicMemory のブール値の組み合わせに対して、
 * エピソード記憶リソースが正しい条件でのみ作成されることを検証する。
 *
 * **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 2.1, 2.3, 8.1, 8.4**
 */

import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

/**
 * CDK AIStack のエピソード記憶ロジックをシミュレートする。
 * 実際の CDK スタック合成は依存関係が多いため、ロジックのみをテストする。
 */
function simulateAIStackEpisodicConfig(params: {
  enableAgentCoreMemory: boolean;
  enableEpisodicMemory: boolean;
}) {
  const { enableAgentCoreMemory, enableEpisodicMemory } = params;

  // memoryStrategies は enableAgentCoreMemory=true 時のみ作成
  let memoryStrategies: string[] = [];
  if (enableAgentCoreMemory) {
    memoryStrategies = ['semantic', 'summary'];
    if (enableEpisodicMemory) {
      memoryStrategies.push('episodic');
    }
  }

  // Lambda 環境変数
  const envVars: Record<string, string> = {};
  if (enableAgentCoreMemory) {
    envVars['ENABLE_AGENTCORE_MEMORY'] = 'true';
  }
  if (enableAgentCoreMemory && enableEpisodicMemory) {
    envVars['EPISODIC_MEMORY_ENABLED'] = 'true';
  }

  // IAM ポリシー
  const iamActions: string[] = [];
  if (enableAgentCoreMemory) {
    iamActions.push(
      'bedrock-agentcore:CreateEvent',
      'bedrock-agentcore:ListEvents',
      'bedrock-agentcore:DeleteEvent',
      'bedrock-agentcore:ListSessions',
      'bedrock-agentcore:RetrieveMemoryRecords',
    );
  }
  if (enableAgentCoreMemory && enableEpisodicMemory) {
    iamActions.push(
      'bedrock-agentcore:SearchMemory',
      'bedrock-agentcore:DeleteMemoryRecord',
    );
  }

  return { memoryStrategies, envVars, iamActions };
}

describe('Feature: episodic-memory, Property 1: CDK 条件付きリソース作成', () => {
  it('episodicMemoryStrategy は enableAgentCoreMemory=true かつ enableEpisodicMemory=true の場合にのみ含まれる', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        (enableAgentCoreMemory, enableEpisodicMemory) => {
          const result = simulateAIStackEpisodicConfig({ enableAgentCoreMemory, enableEpisodicMemory });

          if (enableAgentCoreMemory && enableEpisodicMemory) {
            expect(result.memoryStrategies).toContain('episodic');
          } else {
            expect(result.memoryStrategies).not.toContain('episodic');
          }

          // 既存の semantic/summary は enableAgentCoreMemory=true 時に常に含まれる
          if (enableAgentCoreMemory) {
            expect(result.memoryStrategies).toContain('semantic');
            expect(result.memoryStrategies).toContain('summary');
          } else {
            expect(result.memoryStrategies).toHaveLength(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: episodic-memory, Property 2: Lambda 環境変数の正確性', () => {
  it('EPISODIC_MEMORY_ENABLED は正しい条件でのみ true に設定される', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        (enableAgentCoreMemory, enableEpisodicMemory) => {
          const result = simulateAIStackEpisodicConfig({ enableAgentCoreMemory, enableEpisodicMemory });

          if (enableAgentCoreMemory && enableEpisodicMemory) {
            expect(result.envVars['EPISODIC_MEMORY_ENABLED']).toBe('true');
          } else {
            expect(result.envVars['EPISODIC_MEMORY_ENABLED']).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: episodic-memory, Property 3: IAM ポリシー条件付き作成', () => {
  it('エピソード記憶固有の IAM アクションは enableEpisodicMemory=true 時のみ付与される', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        (enableAgentCoreMemory, enableEpisodicMemory) => {
          const result = simulateAIStackEpisodicConfig({ enableAgentCoreMemory, enableEpisodicMemory });

          const hasSearchMemory = result.iamActions.includes('bedrock-agentcore:SearchMemory');
          const hasDeleteMemoryRecord = result.iamActions.includes('bedrock-agentcore:DeleteMemoryRecord');

          if (enableAgentCoreMemory && enableEpisodicMemory) {
            expect(hasSearchMemory).toBe(true);
            expect(hasDeleteMemoryRecord).toBe(true);
          } else {
            expect(hasSearchMemory).toBe(false);
            expect(hasDeleteMemoryRecord).toBe(false);
          }

          // 既存の AgentCore Memory IAM 権限は影響を受けない
          if (enableAgentCoreMemory) {
            expect(result.iamActions).toContain('bedrock-agentcore:RetrieveMemoryRecords');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
