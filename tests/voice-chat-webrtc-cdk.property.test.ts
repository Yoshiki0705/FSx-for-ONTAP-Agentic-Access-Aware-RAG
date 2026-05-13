/**
 * CDK Property-Based Tests: Voice Chat Phase 2 — voiceChatMode
 * 
 * Property 1: voiceChatMode パラメータバリデーション
 * Property 2: enableVoiceChat 前提条件
 * Property 10: CDK 後方互換性
 */

import * as cdk from 'aws-cdk-lib';
import * as fc from 'fast-check';
import { DemoAIStack } from '../lib/stacks/demo/demo-ai-stack';

describe('Voice Chat WebRTC CDK Properties', () => {
  const baseProps = {
    projectName: 'test',
    environment: 'dev',
    enableVoiceChat: true,
    vectorStoreType: 's3vectors' as const,
  };

  // Property 1: voiceChatMode パラメータバリデーション
  describe('Property 1: voiceChatMode parameter validation', () => {
    it('should accept only "rest" and "webrtc" as valid values', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (randomMode) => {
            const app = new cdk.App();
            const validModes = ['rest', 'webrtc'];
            const stackId = `TestStack-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

            if (validModes.includes(randomMode)) {
              // Valid values should not throw
              expect(() => {
                new DemoAIStack(app, stackId, {
                  ...baseProps,
                  voiceChatMode: randomMode as 'rest' | 'webrtc',
                });
              }).not.toThrow();
            } else {
              // Invalid values should throw validation error
              expect(() => {
                new DemoAIStack(app, `${stackId}-inv`, {
                  ...baseProps,
                  voiceChatMode: randomMode as any,
                });
              }).toThrow(/Invalid voiceChatMode/);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should default to "rest" when voiceChatMode is not specified', () => {
      const app = new cdk.App();
      // Should not throw and should create stack successfully
      expect(() => {
        new DemoAIStack(app, 'TestStack-default', {
          ...baseProps,
          // voiceChatMode not specified
        });
      }).not.toThrow();
    });
  });

  // Property 2: enableVoiceChat 前提条件
  describe('Property 2: enableVoiceChat prerequisite', () => {
    it('should not create voice resources when enableVoiceChat is false regardless of voiceChatMode', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('rest', 'webrtc'),
          (mode) => {
            const app = new cdk.App();
            const stackId = `TestStack-novoice-${mode}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
            const stack = new DemoAIStack(app, stackId, {
              ...baseProps,
              enableVoiceChat: false,
              voiceChatMode: mode as 'rest' | 'webrtc',
            });

            const template = cdk.assertions.Template.fromStack(stack);

            // VoiceChatEnabled output should be 'false'
            template.hasOutput('VoiceChatEnabled', {
              Value: 'false',
            });

            // No KVS Signaling Channel should exist
            template.resourceCountIs('AWS::KinesisVideo::SignalingChannel', 0);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // Property 10: CDK 後方互換性
  describe('Property 10: CDK backward compatibility', () => {
    it('should not create WebRTC resources when voiceChatMode is "rest" or unset', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(undefined, 'rest'),
          (mode) => {
            const app = new cdk.App();
            const stackId = `TestStack-compat-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
            const stack = new DemoAIStack(app, stackId, {
              ...baseProps,
              voiceChatMode: mode as any,
            });

            const template = cdk.assertions.Template.fromStack(stack);

            // No KVS Signaling Channel
            template.resourceCountIs('AWS::KinesisVideo::SignalingChannel', 0);

            // No AgentCore Runtime agent
            expect(() => {
              template.hasResource('AWS::BedrockAgentCore::AgentRuntime', {});
            }).toThrow();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should create WebRTC resources only when voiceChatMode is "webrtc"', () => {
      const app = new cdk.App();
      const stack = new DemoAIStack(app, 'TestStack-webrtc', {
        ...baseProps,
        voiceChatMode: 'webrtc',
      });

      const template = cdk.assertions.Template.fromStack(stack);

      // KVS Signaling Channel should exist
      template.resourceCountIs('AWS::KinesisVideo::SignalingChannel', 1);
      template.hasResourceProperties('AWS::KinesisVideo::SignalingChannel', {
        Name: 'test-dev-voice-signaling',
        Type: 'SINGLE_MASTER',
        MessageTtlSeconds: 60,
      });
    });

    it('voiceChatMode should be independent of other parameters', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // enableAgent
          fc.boolean(), // enableAgentCoreMemory
          fc.constantFrom('s3vectors', 'opensearch-serverless'),
          fc.boolean(), // enableMonitoring
          (enableAgent, enableAgentCoreMemory, vectorStoreType, _enableMonitoring) => {
            const app = new cdk.App();
            const stackId = `TestStack-indep-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
            // Should not throw regardless of other parameter combinations
            expect(() => {
              new DemoAIStack(app, stackId, {
                ...baseProps,
                enableAgent,
                enableAgentCoreMemory: enableAgent && enableAgentCoreMemory,
                vectorStoreType: vectorStoreType as 's3vectors' | 'opensearch-serverless',
                voiceChatMode: 'rest',
              });
            }).not.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
