/**
 * CDK Snapshot Tests: Voice Chat Phase 2
 * WebRTC モード時のリソース構成スナップショットを検証。
 * REST モード時に WebRTC 固有リソースが含まれないことを検証。
 */

import * as cdk from 'aws-cdk-lib';
import { DemoAIStack } from '../lib/stacks/demo/demo-ai-stack';

describe('Voice Chat WebRTC CDK Snapshot Tests', () => {
  const baseProps = {
    projectName: 'test',
    environment: 'dev',
    enableVoiceChat: true,
    vectorStoreType: 's3vectors' as const,
  };

  describe('WebRTC mode resources', () => {
    it('should create KVS Signaling Channel when voiceChatMode is "webrtc"', () => {
      const app = new cdk.App();
      const stack = new DemoAIStack(app, 'WebRTCStack', {
        ...baseProps,
        voiceChatMode: 'webrtc',
      });

      const template = cdk.assertions.Template.fromStack(stack);

      // KVS Signaling Channel
      template.hasResourceProperties('AWS::KinesisVideo::SignalingChannel', {
        Name: 'test-dev-voice-signaling',
        Type: 'SINGLE_MASTER',
        MessageTtlSeconds: 60,
      });

      // AgentCore Runtime Agent
      template.hasResource('AWS::BedrockAgentCore::AgentRuntime', {});

      // IAM Role for Voice Agent
      template.hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'test-dev-voice-agent-role',
      });
    });

    it('should output WebRTC-specific CfnOutputs', () => {
      const app = new cdk.App();
      const stack = new DemoAIStack(app, 'WebRTCOutputStack', {
        ...baseProps,
        voiceChatMode: 'webrtc',
      });

      const template = cdk.assertions.Template.fromStack(stack);

      template.hasOutput('VoiceChatMode', { Value: 'webrtc' });
      template.hasOutput('VoiceSignalingChannelArn', {});
      template.hasOutput('VoiceAgentId', {});
      template.hasOutput('VoiceAgentScaling', {});
    });
  });

  describe('REST mode resources (backward compatibility)', () => {
    it('should NOT create WebRTC resources when voiceChatMode is "rest"', () => {
      const app = new cdk.App();
      const stack = new DemoAIStack(app, 'RESTStack', {
        ...baseProps,
        voiceChatMode: 'rest',
      });

      const template = cdk.assertions.Template.fromStack(stack);

      // No KVS Signaling Channel
      template.resourceCountIs('AWS::KinesisVideo::SignalingChannel', 0);

      // No AgentCore Runtime
      expect(() => {
        template.hasResource('AWS::BedrockAgentCore::AgentRuntime', {});
      }).toThrow();

      // VoiceChatMode output should be 'rest'
      template.hasOutput('VoiceChatMode', { Value: 'rest' });
    });

    it('should NOT create WebRTC resources when voiceChatMode is unset (default)', () => {
      const app = new cdk.App();
      const stack = new DemoAIStack(app, 'DefaultStack', {
        ...baseProps,
        // voiceChatMode not specified — defaults to 'rest'
      });

      const template = cdk.assertions.Template.fromStack(stack);

      // No KVS Signaling Channel
      template.resourceCountIs('AWS::KinesisVideo::SignalingChannel', 0);

      // VoiceChatMode output should be 'rest'
      template.hasOutput('VoiceChatMode', { Value: 'rest' });
    });
  });

  describe('enableVoiceChat=false', () => {
    it('should not create any voice resources regardless of voiceChatMode', () => {
      const app = new cdk.App();
      const stack = new DemoAIStack(app, 'DisabledStack', {
        ...baseProps,
        enableVoiceChat: false,
        voiceChatMode: 'webrtc',
      });

      const template = cdk.assertions.Template.fromStack(stack);

      // VoiceChatEnabled should be 'false'
      template.hasOutput('VoiceChatEnabled', { Value: 'false' });

      // No KVS resources
      template.resourceCountIs('AWS::KinesisVideo::SignalingChannel', 0);
    });
  });
});
