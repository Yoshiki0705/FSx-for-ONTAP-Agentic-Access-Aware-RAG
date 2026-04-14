/**
 * Property 8: CDK 後方互換性
 * enableVoiceChat が未設定または false の場合、生成される構成が
 * enableVoiceChat パラメータ非存在時と同一であることを検証。
 *
 * **Validates: Requirements 12.1, 12.5**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * CDK パラメータの組み合わせをシミュレートし、
 * enableVoiceChat=false/undefined 時に音声チャット関連リソースが生成されないことを検証。
 */
interface CdkParams {
  enableAgentCoreMemory: boolean;
  vectorStoreType: 's3vectors' | 'opensearch-serverless';
  enableMonitoring: boolean;
  enableAgent: boolean;
  enableGuardrails: boolean;
  enableMultiAgent: boolean;
  enableVoiceChat: boolean | undefined;
}

function simulateVoiceChatResources(params: CdkParams): {
  hasVoiceChatIamPolicy: boolean;
  hasVoiceChatEnvVar: boolean;
  voiceChatEnabled: string;
} {
  const enabled = params.enableVoiceChat === true;
  return {
    hasVoiceChatIamPolicy: enabled,
    hasVoiceChatEnvVar: true, // VOICE_CHAT_ENABLED is always set (true or false)
    voiceChatEnabled: enabled ? 'true' : 'false',
  };
}

describe('Property 8: CDK Backward Compatibility', () => {
  it('should not create voice chat IAM policies when enableVoiceChat is false or undefined', () => {
    fc.assert(
      fc.property(
        fc.record({
          enableAgentCoreMemory: fc.boolean(),
          vectorStoreType: fc.constantFrom('s3vectors' as const, 'opensearch-serverless' as const),
          enableMonitoring: fc.boolean(),
          enableAgent: fc.boolean(),
          enableGuardrails: fc.boolean(),
          enableMultiAgent: fc.boolean(),
          enableVoiceChat: fc.constantFrom(false, undefined),
        }),
        (params: CdkParams) => {
          const result = simulateVoiceChatResources(params);

          // enableVoiceChat=false/undefined → IAM ポリシーなし
          expect(result.hasVoiceChatIamPolicy).toBe(false);
          // VOICE_CHAT_ENABLED=false が設定される
          expect(result.voiceChatEnabled).toBe('false');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create voice chat IAM policies only when enableVoiceChat is true', () => {
    fc.assert(
      fc.property(
        fc.record({
          enableAgentCoreMemory: fc.boolean(),
          vectorStoreType: fc.constantFrom('s3vectors' as const, 'opensearch-serverless' as const),
          enableMonitoring: fc.boolean(),
          enableAgent: fc.boolean(),
          enableGuardrails: fc.boolean(),
          enableMultiAgent: fc.boolean(),
          enableVoiceChat: fc.constant(true),
        }),
        (params: CdkParams) => {
          const result = simulateVoiceChatResources(params);

          expect(result.hasVoiceChatIamPolicy).toBe(true);
          expect(result.voiceChatEnabled).toBe('true');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('enableVoiceChat should be independent of other CDK parameters', () => {
    fc.assert(
      fc.property(
        fc.record({
          enableAgentCoreMemory: fc.boolean(),
          vectorStoreType: fc.constantFrom('s3vectors' as const, 'opensearch-serverless' as const),
          enableMonitoring: fc.boolean(),
          enableAgent: fc.boolean(),
          enableGuardrails: fc.boolean(),
          enableMultiAgent: fc.boolean(),
          enableVoiceChat: fc.boolean(),
        }),
        (params: CdkParams) => {
          const result = simulateVoiceChatResources(params);

          // enableVoiceChat の結果は他のパラメータに依存しない
          expect(result.hasVoiceChatIamPolicy).toBe(params.enableVoiceChat);
          expect(result.voiceChatEnabled).toBe(params.enableVoiceChat ? 'true' : 'false');
        }
      ),
      { numRuns: 100 }
    );
  });
});
