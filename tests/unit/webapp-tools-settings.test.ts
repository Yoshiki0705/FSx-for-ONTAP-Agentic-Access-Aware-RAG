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

function synth(tools?: Record<string, unknown>, extra: Record<string, unknown> = {}) {
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
    expect(env.IMAGE_TO_IMAGE_MODEL_ID).toBeUndefined();
  });

  it('passes the image-to-image model only with image generation on', () => {
    const tools = { enableWebExtract: true, imageGenerationRegion: 'us-west-2', imageGenerationModelId: 'stability.stable-image-core-v1:1', imageToImageModelId: 'stability.sd3-5-large-v1:0' };
    expect(webAppEnv(synth({ ...tools, enableImageGeneration: true })).IMAGE_TO_IMAGE_MODEL_ID).toBe('stability.sd3-5-large-v1:0');
    expect(webAppEnv(synth({ ...tools, enableImageGeneration: false })).IMAGE_TO_IMAGE_MODEL_ID).toBeUndefined();
  });

  it('grants the web app only item-level access to the use case table', () => {
    synth().hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:DeleteItem', 'dynamodb:Query', 'dynamodb:UpdateItem'],
            Resource: Match.arrayWith([Match.objectLike({ 'Fn::GetAtt': [Match.stringLikeRegexp('UserUseCasesTable'), 'Arn'] })]),
          }),
        ]),
      },
    });
  });
  it('gives the use case table a sparse index of shared items, readable by the web app', () => {
    const t = synth();
    t.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'testproj-dev-user-use-cases',
      GlobalSecondaryIndexes: [
        Match.objectLike({
          IndexName: 'shared-index',
          KeySchema: [
            { AttributeName: 'sharedPartition', KeyType: 'HASH' },
            { AttributeName: 'useCaseId', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        }),
      ],
    });
    // The grant covers the index ARN as well as the table.
    expect(JSON.stringify(t.findResources('AWS::IAM::Policy'))).toMatch(/UserUseCasesTable[^"]*","Arn"\]\},"\/index\/\*"/);
  });
  it('keeps use case sharing off unless enabled', () => {
    expect(webAppEnv(synth()).USE_CASE_SHARING_ENABLED).toBe('false');
    expect(webAppEnv(synth({ enableUseCaseSharing: true })).USE_CASE_SHARING_ENABLED).toBe('true');
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
describe('video generation (enableVideoGeneration)', () => {
  const on = { enableWebExtract: true, enableImageGeneration: false, imageGenerationRegion: 'us-west-2', imageGenerationModelId: 'x', enableVideoGeneration: true, videoGenerationRegion: 'us-west-2', videoGenerationModelId: 'luma.ray-v2:0' };
  it('is off by default: no region, model or bucket in the environment', () => {
    const env = webAppEnv(synth());
    expect(env.VIDEO_GENERATION_ENABLED).toBe('false');
    expect(env.VIDEO_GENERATION_REGION).toBeUndefined();
    expect(env.VIDEO_OUTPUT_BUCKET).toBeUndefined();
  });
  it('stays off without an output bucket even when enabled', () => {
    expect(webAppEnv(synth(on)).VIDEO_GENERATION_ENABLED).toBe('false');
  });
  it('passes the Region, model and bucket, and grants only the model, async-invoke reads and the videos/ prefix', () => {
    const t = synth(on, { videoOutputBucketName: 'out-bucket' });
    const env = webAppEnv(t);
    expect(env.VIDEO_GENERATION_ENABLED).toBe('true');
    expect(env.VIDEO_GENERATION_REGION).toBe('us-west-2');
    expect(env.VIDEO_GENERATION_MODEL_ID).toBe('luma.ray-v2:0');
    expect(env.VIDEO_OUTPUT_BUCKET).toBe('out-bucket');
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({ Action: ['bedrock:InvokeModel', 'bedrock:StartAsyncInvoke'], Resource: 'arn:aws:bedrock:us-west-2::foundation-model/luma.ray-v2:0' }),
          Match.objectLike({ Action: 'bedrock:GetAsyncInvoke', Resource: Match.objectLike({ 'Fn::Join': Match.anyValue() }) }),
          Match.objectLike({ Action: ['s3:PutObject', 's3:GetObject'], Resource: 'arn:aws:s3:::out-bucket/videos/*' }),
        ]),
      },
    });
  });
});
describe('session and CSRF token keys', () => {
  it('generates both keys per deployment and passes them as dynamic references, not values', () => {
    const t = synth();
    const secrets = t.findResources('AWS::SecretsManager::Secret');
    const names = Object.values(secrets).map((r: any) => r.Properties.Name);
    expect(names).toEqual(expect.arrayContaining(['testproj-dev-webapp-jwt-key', 'testproj-dev-webapp-csrf-key']));
    for (const r of Object.values(secrets) as any[]) {
      expect(r.Properties.GenerateSecretString).toMatchObject({ PasswordLength: 64 });
    }
    const env = webAppEnv(t);
    for (const key of ['JWT_SECRET', 'CSRF_SECRET']) {
      const value = JSON.stringify(env[key]);
      expect(value).toContain('{{resolve:secretsmanager:');
      expect(value).not.toMatch(/change-in-production/);
    }
  });
});
describe('feedback (enableFeedback)', () => {
  const feedbackProps = { feedback: { enabled: true, retentionDays: 90 } };
  function webAppRole(t: Template) {
    return JSON.stringify(Object.values(t.findResources('AWS::IAM::Policy')));
  }
  it('is off by default: no collector, no table, no setting', () => {
    const t = synth();
    expect(webAppEnv(t).FEEDBACK_FUNCTION_NAME).toBeUndefined();
    expect(JSON.stringify(t.toJSON())).not.toContain('rag-feedback');
    expect(JSON.stringify(t.toJSON())).not.toContain('feedback-collector');
  });
  it('is off when the flag is set to false', () => {
    const t = synth(undefined, { feedback: { enabled: false, retentionDays: 90 } });
    expect(webAppEnv(t).FEEDBACK_FUNCTION_NAME).toBeUndefined();
  });
  it('adds the table and the collector, and tells the web app which function to invoke', () => {
    const t = synth(undefined, feedbackProps);
    expect(webAppEnv(t).FEEDBACK_FUNCTION_NAME).toBeDefined();
    t.hasResourceProperties('AWS::DynamoDB::Table', { TableName: 'testproj-dev-rag-feedback' });
    t.hasResourceProperties('AWS::Lambda::Function', { FunctionName: 'testproj-dev-feedback-collector', Environment: { Variables: Match.objectLike({ TTL_DAYS: '90' }) } });
  });
  it('lets the web app invoke only the collector, and gives it no access to the feedback table', () => {
    const t = synth(undefined, feedbackProps);
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({ Action: 'lambda:InvokeFunction', Resource: Match.arrayWith([Match.objectLike({ 'Fn::GetAtt': [Match.stringLikeRegexp('FeedbackCollectorFn'), 'Arn'] })]) }),
        ]),
      },
    });
    // The only policy that mentions the feedback table is the collector's own write access.
    const webAppPolicies = Object.entries(t.findResources('AWS::IAM::Policy')).filter(([id]) => /WebAppFn/.test(id));
    expect(JSON.stringify(webAppPolicies)).not.toMatch(/FeedbackTable/);
    expect(webAppRole(t)).toContain('FeedbackTable');
  });
});

describe('rerank after the SID filter', () => {
  const policies = (t: Template) => JSON.stringify(Object.entries(t.findResources('AWS::IAM::Policy')).filter(([id]) => /WebAppFn/.test(id)));
  it('is off by default: no model, no candidates, no bedrock:Rerank', () => {
    const t = synth();
    expect(webAppEnv(t).RERANK_MODEL_ID).toBeUndefined();
    expect(webAppEnv(t).RERANK_CANDIDATES).toBeUndefined();
    expect(policies(t)).not.toContain('bedrock:Rerank');
  });
  it('passes the model and candidates and grants bedrock:Rerank when enabled', () => {
    const t = synth(undefined, { rerank: { modelId: 'amazon.rerank-v1:0', candidates: 25 } });
    expect(webAppEnv(t).RERANK_MODEL_ID).toBe('amazon.rerank-v1:0');
    expect(webAppEnv(t).RERANK_CANDIDATES).toBe('25');
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Sid: 'RerankAfterSidFilter', Action: 'bedrock:Rerank', Resource: '*' })]) },
    });
  });
});
describe('Bedrock Flows', () => {
  const policies = (t: Template) => JSON.stringify(Object.entries(t.findResources('AWS::IAM::Policy')).filter(([id]) => /WebAppFn/.test(id)));
  const flows = [
    { key: 'summary', flowId: 'FLOWAAAAA1', aliasId: 'ALIASAAAA1', name: 'Summary', description: 'd' },
    { key: 'other', flowId: 'FLOWAAAAA1', aliasId: 'ALIASBBBB2', name: 'Other', description: '' },
  ];
  it('is off by default: no setting, no flow permissions', () => {
    const t = synth();
    expect(webAppEnv(t).FLOWS_CONFIG).toBeUndefined();
    expect(policies(t)).not.toContain('bedrock:InvokeFlow');
  });
  it('passes the registered flows and grants only their aliases and flows', () => {
    const t = synth(undefined, { flows });
    expect(JSON.parse(webAppEnv(t).FLOWS_CONFIG as string)).toEqual(flows);
    const p = policies(t);
    expect(p).toContain('InvokeRegisteredFlows');
    expect(p).toContain(':flow/FLOWAAAAA1/alias/ALIASAAAA1');
    expect(p).toContain(':flow/FLOWAAAAA1/alias/ALIASBBBB2');
    expect(p).toContain('ReadRegisteredFlowVersions');
    expect(p).not.toMatch(/flow\/\*/);
  });
});
