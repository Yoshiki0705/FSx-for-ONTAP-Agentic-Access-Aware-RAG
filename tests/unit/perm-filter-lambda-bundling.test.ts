/**
 * The Permission Filter Lambda (usePermissionFilterLambda=true) must ship code the Node.js
 * runtime can load. The WebApp falls back to the inline filter when the invocation fails, so a
 * broken asset does not fail any request: it only changes filterLog.source from 'lambda' to
 * 'inline'. This test loads the synthesized asset the way the runtime does.
 *
 * It does not call AWS and does not prove that the deployed function returns correct results.
 */
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Template } from 'aws-cdk-lib/assertions';
import * as fs from 'fs';
import * as path from 'path';
import { DemoWebAppStack } from '../../lib/stacks/demo/demo-webapp-stack';

function synth(usePermissionFilterLambda: boolean) {
  const outdir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'permfilter-'));
  const app = new cdk.App({ outdir });
  const dep = new cdk.Stack(app, 'Dep', { env: { account: '123456789012', region: 'ap-northeast-1' } });
  const vpc = new ec2.Vpc(dep, 'Vpc');
  const sg = new ec2.SecurityGroup(dep, 'Sg', { vpc });
  const userPool = new cognito.UserPool(dep, 'Pool');
  const client = userPool.addClient('Client');
  const userAccessTable = new dynamodb.Table(dep, 'UAT', {
    partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  });
  const permissionCacheTable = new dynamodb.Table(dep, 'PCT', {
    partitionKey: { name: 'cacheKey', type: dynamodb.AttributeType.STRING },
  });
  const stack = new DemoWebAppStack(app, 'TestWebAppPermFilter', {
    projectName: 'testproj',
    environment: 'dev',
    vpc,
    lambdaSg: sg,
    userPool,
    userPoolClient: client,
    knowledgeBaseId: 'kb-test-123',
    imageUri: 'latest',
    permissionCacheTable,
    userAccessTable,
    usePermissionFilterLambda,
    env: { account: '123456789012', region: 'ap-northeast-1' },
  } as any);
  const assembly = app.synth();
  return { stack, template: Template.fromStack(stack), outdir: assembly.directory };
}

describe('Permission Filter Lambda asset', () => {
  it('is absent when usePermissionFilterLambda is false', () => {
    const { template } = synth(false);
    template.resourcePropertiesCountIs('AWS::Lambda::Function', { FunctionName: 'testproj-dev-perm-filter' }, 0);
  });

  it('ships a bundled index.js whose handler the runtime can load', () => {
    const { template, outdir } = synth(true);
    const fns = template.findResources('AWS::Lambda::Function', {
      Properties: { FunctionName: 'testproj-dev-perm-filter' },
    });
    const [fn] = Object.values(fns) as any[];
    expect(fn).toBeDefined();
    expect(fn.Properties.Handler).toBe('index.handler');
    expect(fn.Properties.Runtime).toBe('nodejs22.x');

    // Asset metadata is off in this app, so locate the staged asset by the hash in S3Key.
    const s3Key: string = fn.Properties.Code.S3Key;
    const hash = s3Key.replace(/\.zip$/, '');
    const assetDir = path.join(outdir, `asset.${hash}`);
    const files = fs.readdirSync(assetDir);
    expect(files).toContain('index.js');
    expect(files.filter((f) => f.endsWith('.ts'))).toEqual([]);

    // Load it as the runtime would: the module resolves and exports a handler function.
    const mod = require(path.join(assetDir, 'index.js'));
    expect(typeof mod.handler).toBe('function');
  }, 120_000);
});
