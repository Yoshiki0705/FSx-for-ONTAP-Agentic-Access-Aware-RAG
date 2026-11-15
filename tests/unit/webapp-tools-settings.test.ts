/**
 * The GenU-style tools in DemoWebAppStack: the per-user use case table, the environment the
 * tools read, and image generation staying off (no region, no model) unless enabled.
 */
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { DemoWebAppStack } from '../../lib/stacks/demo/demo-webapp-stack';

function synth(tools?: Record<string, unknown>) {
  const app = new cdk.App();
  const env = { account: '123456789012', region: 'ap-northeast-1' };
  const dep = new cdk.Stack(app, 'Dep', { env });
  const vpc = new ec2.Vpc(dep, 'Vpc');
  const sg = new ec2.SecurityGroup(dep, 'Sg', { vpc });
  const userPool = new cognito.UserPool(dep, 'Pool');
  const stack = new DemoWebAppStack(app, 'TestWebAppTools', {
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
    ...(tools ? { tools } : {}),
    env,
  } as any);
  return Template.fromStack(stack);
}

function webAppEnv(template: Template): Record<string, unknown> {
  const fns = template.findResources('AWS::Lambda::Function', { Properties: { FunctionName: 'testproj-dev-webapp' } });
  const [fn] = Object.values(fns) as any[];
  return fn.Properties.Environment.Variables;
}

describe('GenU-style tools settings', () => {
  it('creates the use case table keyed by user and use case', () => {
    synth().hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'testproj-dev-user-use-cases',
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'useCaseId', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    });
  });

  it('keeps image generation off by default and passes no region or model', () => {
    const env = webAppEnv(synth());
    expect(env.IMAGE_GENERATION_ENABLED).toBe('false');
    expect(env.IMAGE_GENERATION_REGION).toBeUndefined();
    expect(env.IMAGE_GENERATION_MODEL_ID).toBeUndefined();
    expect(env.WEB_EXTRACT_ENABLED).toBe('true');
    expect(env.USE_CASES_TABLE_NAME).toBeDefined();
  });

  it('passes the region and model when image generation is enabled', () => {
    const env = webAppEnv(
      synth({ enableWebExtract: false, enableImageGeneration: true, imageGenerationRegion: 'us-west-2', imageGenerationModelId: 'us.stability.stable-image-core-v1:1' }),
    );
    expect(env.IMAGE_GENERATION_ENABLED).toBe('true');
    expect(env.IMAGE_GENERATION_REGION).toBe('us-west-2');
    expect(env.IMAGE_GENERATION_MODEL_ID).toBe('us.stability.stable-image-core-v1:1');
    expect(env.WEB_EXTRACT_ENABLED).toBe('false');
  });

  it('grants the web app only item-level access to the use case table', () => {
    synth().hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:DeleteItem', 'dynamodb:Query'],
            Resource: Match.arrayWith([Match.objectLike({ 'Fn::GetAtt': [Match.stringLikeRegexp('UserUseCasesTable'), 'Arn'] })]),
          }),
        ]),
      },
    });
  });
});

describe('code tool (enableCodeInterpreter)', () => {
  const on = { enableWebExtract: true, enableImageGeneration: false, imageGenerationRegion: 'us-west-2', imageGenerationModelId: 'x', enableCodeInterpreter: true };
  function webAppFn(template: Template): any {
    const [fn] = Object.values(template.findResources('AWS::Lambda::Function', { Properties: { FunctionName: 'testproj-dev-webapp' } })) as any[];
    return fn;
  }
  it('is off by default: no setting on, 30 s timeout, no Code Interpreter permission', () => {
    const t = synth();
    expect(webAppEnv(t).CODE_INTERPRETER_ENABLED).toBe('false');
    expect(webAppFn(t).Properties.Timeout).toBe(30);
    expect(JSON.stringify(t.toJSON())).not.toContain('InvokeCodeInterpreter');
  });
  it('turns the tool on, gives the function 60 s, and grants only the three session actions on the built-in interpreter', () => {
    const t = synth(on);
    expect(webAppEnv(t).CODE_INTERPRETER_ENABLED).toBe('true');
    expect(webAppFn(t).Properties.Timeout).toBe(60);
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: ['bedrock-agentcore:StartCodeInterpreterSession', 'bedrock-agentcore:InvokeCodeInterpreter', 'bedrock-agentcore:StopCodeInterpreterSession'],
            Resource: { 'Fn::Join': ['', ['arn:aws:bedrock-agentcore:', { Ref: 'AWS::Region' }, ':aws:code-interpreter/aws.codeinterpreter.v1']] },
          }),
        ]),
      },
    });
  });
  it('makes CloudFront wait 60 s for the origin only when the tool is on', () => {
    const readTimeouts = (t: Template) =>
      Object.values(t.findResources('AWS::CloudFront::Distribution')).flatMap((d: any) => (d.Properties.DistributionConfig.Origins || []).map((o: any) => o.CustomOriginConfig?.OriginReadTimeout));
    expect(readTimeouts(synth(on))).toContain(60);
    expect(readTimeouts(synth())).not.toContain(60);
  });
});
describe('media tools (enableMediaTools)', () => {
  const on = { enableWebExtract: true, enableImageGeneration: false, imageGenerationRegion: 'us-west-2', imageGenerationModelId: 'x', enableMediaTools: true, videoModelId: 'amazon.nova-2-lite-v1:0' };
  it('is off by default: no bucket, no setting', () => {
    const t = synth();
    expect(webAppEnv(t).MEDIA_TOOLS_ENABLED).toBe('false');
    expect(webAppEnv(t).MEDIA_BUCKET_NAME).toBeUndefined();
    t.resourceCountIs('AWS::S3::Bucket', 1);
  });
  it('creates an encrypted private staging bucket that deletes objects after 1 day, and passes its name and the model', () => {
    const t = synth(on);
    expect(webAppEnv(t).MEDIA_TOOLS_ENABLED).toBe('true');
    expect(webAppEnv(t).MEDIA_BUCKET_NAME).toBeDefined();
    expect(webAppEnv(t).VIDEO_MODEL_ID).toBe('amazon.nova-2-lite-v1:0');
    t.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: Match.anyValue(),
      PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
      LifecycleConfiguration: { Rules: Match.arrayWith([Match.objectLike({ ExpirationInDays: 1, Status: 'Enabled' })]) },
      CorsConfiguration: { CorsRules: [Match.objectLike({ AllowedMethods: ['PUT'] })] },
    });
  });
  it('lets the web app put and get only under uploads/ and transcripts/, run its own Transcribe jobs, and gives it 60 s', () => {
    const t = synth(on);
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: ['s3:PutObject', 's3:GetObject'],
            Resource: [Match.objectLike({ 'Fn::Join': ['', [Match.anyValue(), '/uploads/*']] }), Match.objectLike({ 'Fn::Join': ['', [Match.anyValue(), '/transcripts/*']] })],
          }),
          Match.objectLike({ Action: ['transcribe:StartTranscriptionJob', 'transcribe:GetTranscriptionJob'], Resource: Match.objectLike({ 'Fn::Join': Match.anyValue() }) }),
        ]),
      },
    });
    const [fn] = Object.values(t.findResources('AWS::Lambda::Function', { Properties: { FunctionName: 'testproj-dev-webapp' } })) as any[];
    expect(fn.Properties.Timeout).toBe(60);
  });
});

