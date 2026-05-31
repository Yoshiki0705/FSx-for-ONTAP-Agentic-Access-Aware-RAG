/**
 * CDK Assertion Tests — EventDrivenAgentConstruct
 *
 * Verifies:
 * - Lambda function is created with correct configuration
 * - DynamoDB execution table is created with TTL
 * - EventBridge rules are created for KB Ingestion and BREAK_GLASS
 * - EventBridge Scheduler is created when enabled
 * - Locale-aware prompts are set correctly
 * - Feature flags control resource creation
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { EventDrivenAgentConstruct } from '../lib/constructs/event-driven-agent-construct';

describe('EventDrivenAgentConstruct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'ap-northeast-1' },
    });
  });

  describe('Basic creation', () => {
    it('creates Lambda function with correct runtime and handler', () => {
      new EventDrivenAgentConstruct(stack, 'Test', {
        prefix: 'test-prefix',
        agentId: 'agent-123',
        agentAliasId: 'alias-456',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'test-prefix-agent-trigger',
        Runtime: 'nodejs22.x',
        Handler: 'handler.handler',
        Timeout: 30,
        MemorySize: 256,
      });
    });

    it('creates DynamoDB table with TTL enabled', () => {
      new EventDrivenAgentConstruct(stack, 'Test', {
        prefix: 'test-prefix',
        agentId: 'agent-123',
        agentAliasId: 'alias-456',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'test-prefix-agent-trigger-executions',
        KeySchema: [
          { AttributeName: 'triggerId', KeyType: 'HASH' },
          { AttributeName: 'executionId', KeyType: 'RANGE' },
        ],
        TimeToLiveSpecification: {
          AttributeName: 'ttl',
          Enabled: true,
        },
      });
    });

    it('grants Lambda permission to invoke Bedrock Agent', () => {
      new EventDrivenAgentConstruct(stack, 'Test', {
        prefix: 'test-prefix',
        agentId: 'agent-123',
        agentAliasId: 'alias-456',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'bedrock:InvokeAgent',
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });

  describe('EventBridge Rules', () => {
    it('creates KB Ingestion Complete rule by default', () => {
      new EventDrivenAgentConstruct(stack, 'Test', {
        prefix: 'test-prefix',
        agentId: 'agent-123',
        agentAliasId: 'alias-456',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Events::Rule', {
        EventPattern: {
          source: ['aws.bedrock'],
          'detail-type': ['Bedrock Knowledge Base Ingestion Job State Change'],
          detail: { status: ['COMPLETE'] },
        },
      });
    });

    it('filters KB Ingestion rule by knowledgeBaseId when provided', () => {
      new EventDrivenAgentConstruct(stack, 'Test', {
        prefix: 'test-prefix',
        agentId: 'agent-123',
        agentAliasId: 'alias-456',
        knowledgeBaseId: 'kb-789',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Events::Rule', {
        EventPattern: {
          detail: {
            status: ['COMPLETE'],
            knowledgeBaseId: ['kb-789'],
          },
        },
      });
    });

    it('does not create BREAK_GLASS rule when disabled', () => {
      new EventDrivenAgentConstruct(stack, 'Test', {
        prefix: 'test-prefix',
        agentId: 'agent-123',
        agentAliasId: 'alias-456',
        enableBreakGlassTrigger: false,
      });

      const template = Template.fromStack(stack);
      // Should only have 1 EventBridge rule (KB Ingestion)
      template.resourceCountIs('AWS::Events::Rule', 1);
    });

    it('creates BREAK_GLASS rule when enabled', () => {
      new EventDrivenAgentConstruct(stack, 'Test', {
        prefix: 'test-prefix',
        agentId: 'agent-123',
        agentAliasId: 'alias-456',
        enableBreakGlassTrigger: true,
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Events::Rule', {
        EventPattern: {
          source: ['custom.fsxn-ops'],
          'detail-type': ['Capacity Guardrail BREAK_GLASS Activated'],
        },
      });
    });
  });

  describe('EventBridge Scheduler', () => {
    it('does not create scheduler when disabled', () => {
      new EventDrivenAgentConstruct(stack, 'Test', {
        prefix: 'test-prefix',
        agentId: 'agent-123',
        agentAliasId: 'alias-456',
        enableScheduledTrigger: false,
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::Scheduler::Schedule', 0);
    });

    it('creates scheduler with default cron when enabled', () => {
      new EventDrivenAgentConstruct(stack, 'Test', {
        prefix: 'test-prefix',
        agentId: 'agent-123',
        agentAliasId: 'alias-456',
        enableScheduledTrigger: true,
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Scheduler::Schedule', {
        ScheduleExpression: 'cron(0 0 * * ? *)',
        ScheduleExpressionTimezone: 'Asia/Tokyo',
        State: 'ENABLED',
      });
    });
  });

  describe('Locale-aware prompts', () => {
    it('uses Japanese prompts by default', () => {
      new EventDrivenAgentConstruct(stack, 'Test', {
        prefix: 'test-prefix',
        agentId: 'agent-123',
        agentAliasId: 'alias-456',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: Match.objectLike({
            AGENT_LOCALE: 'ja',
            KB_INGESTION_PROMPT: Match.stringLikeRegexp('ナレッジベース'),
          }),
        },
      });
    });

    it('uses English prompts when agentLocale=en', () => {
      new EventDrivenAgentConstruct(stack, 'Test', {
        prefix: 'test-prefix',
        agentId: 'agent-123',
        agentAliasId: 'alias-456',
        agentLocale: 'en',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: Match.objectLike({
            AGENT_LOCALE: 'en',
            KB_INGESTION_PROMPT: Match.stringLikeRegexp('New documents'),
          }),
        },
      });
    });

    it('allows custom prompt override regardless of locale', () => {
      const customPrompt = 'Custom prompt for testing';
      new EventDrivenAgentConstruct(stack, 'Test', {
        prefix: 'test-prefix',
        agentId: 'agent-123',
        agentAliasId: 'alias-456',
        agentLocale: 'ja',
        kbIngestionPrompt: customPrompt,
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: Match.objectLike({
            KB_INGESTION_PROMPT: customPrompt,
          }),
        },
      });
    });
  });

  describe('Feature flag: enableKbIngestionTrigger=false', () => {
    it('does not create any EventBridge rules when KB trigger is disabled', () => {
      new EventDrivenAgentConstruct(stack, 'Test', {
        prefix: 'test-prefix',
        agentId: 'agent-123',
        agentAliasId: 'alias-456',
        enableKbIngestionTrigger: false,
        enableBreakGlassTrigger: false,
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::Events::Rule', 0);
    });
  });
});
