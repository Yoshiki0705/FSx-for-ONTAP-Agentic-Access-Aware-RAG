/**
 * The model catalog settings in DemoWebAppStack: the environment the catalog reads, the
 * IAM it needs, and no model ID baked into the stack (tiers are family patterns).
 */
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { DemoWebAppStack } from '../../lib/stacks/demo/demo-webapp-stack';

function synth(extra: Record<string, unknown> = {}) {
  const app = new cdk.App();
  const env = { account: '123456789012', region: 'ap-northeast-1' };
  const dep = new cdk.Stack(app, 'Dep', { env });
  const vpc = new ec2.Vpc(dep, 'Vpc');
  const sg = new ec2.SecurityGroup(dep, 'Sg', { vpc });
  const userPool = new cognito.UserPool(dep, 'Pool');
  const stack = new DemoWebAppStack(app, 'TestWebAppModels', {
    projectName: 'testproj',
    environment: 'dev',
    vpc,
    lambdaSg: sg,
    userPool,
    userPoolClient: userPool.addClient('Client'),
    knowledgeBaseId: 'kb-test-123',
    imageUri: 'latest',
    permissionCacheTable: new dynamodb.Table(dep, 'PCT', { partitionKey: { name: 'cacheKey', type: dynamodb.AttributeType.STRING } }),
    userAccessTable: new dynamodb.Table(dep, 'UAT', { partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING } }),
    ...extra,
    env,
  } as any);
  return Template.fromStack(stack);
}

function webAppEnv(template: Template): Record<string, unknown> {
  const fns = template.findResources('AWS::Lambda::Function', { Properties: { FunctionName: 'testproj-dev-webapp' } });
  const [fn] = Object.values(fns) as any[];
  return fn.Properties.Environment.Variables;
}

describe('model catalog settings', () => {
  it('defaults to the nearest profile and passes no family when none is configured', () => {
    const env = webAppEnv(synth());
    expect(env.MODEL_PROFILE_PREFERENCE).toBe('nearest');
    expect(Object.keys(env).filter((k) => k.startsWith('MODEL_FAMILY_'))).toEqual([]);
  });

  it('passes configured families and the global preference', () => {
    const env = webAppEnv(
      synth({ models: { families: { standard: 'anthropic.claude-*sonnet*', voice: 'amazon.nova-*sonic*' }, profilePreference: 'global' } }),
    );
    expect(env.MODEL_FAMILY_STANDARD).toBe('anthropic.claude-*sonnet*');
    expect(env.MODEL_FAMILY_VOICE).toBe('amazon.nova-*sonic*');
    expect(env.MODEL_PROFILE_PREFERENCE).toBe('global');
  });

  it('grants the catalog APIs', () => {
    synth().hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith([
              'bedrock:ListFoundationModels',
              'bedrock:ListInferenceProfiles',
              'bedrock:GetFoundationModelAvailability',
            ]),
          }),
        ]),
      },
    });
  });

  it('lets voice call the voice family, not one pinned model', () => {
    const template = synth({ enableVoiceChat: true });
    expect(webAppEnv(template).NOVA_SONIC_MODEL_ID).toBeUndefined();
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'bedrock:InvokeModelWithBidirectionalStream',
            Resource: Match.objectLike({
              'Fn::Join': Match.arrayWith([Match.arrayWith([Match.stringLikeRegexp('foundation-model/amazon\\.nova-\\*sonic\\*$')])]),
            }),
          }),
        ]),
      },
    });
  });
});
