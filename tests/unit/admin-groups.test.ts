/**
 * The administrator role comes from a group: the security stack creates the Cognito group and
 * the web app receives the group names (lib/stacks/demo/admin-groups.ts).
 */
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Template } from 'aws-cdk-lib/assertions';
import { DemoSecurityStack } from '../../lib/stacks/demo/demo-security-stack';
import { DemoWebAppStack } from '../../lib/stacks/demo/demo-webapp-stack';

const env = { account: '123456789012', region: 'ap-northeast-1' };

function securityTemplate(context: Record<string, unknown> = {}) {
  const app = new cdk.App({ context });
  const dep = new cdk.Stack(app, 'Dep', { env });
  const stack = new DemoSecurityStack(app, 'Sec', { projectName: 'testproj', environment: 'dev', env, vpc: new ec2.Vpc(dep, 'Vpc') });
  return Template.fromStack(stack);
}

function webAppEnv(context: Record<string, unknown> = {}): Record<string, unknown> {
  const app = new cdk.App({ context });
  const dep = new cdk.Stack(app, 'Dep', { env });
  const vpc = new ec2.Vpc(dep, 'Vpc');
  const userPool = new cognito.UserPool(dep, 'Pool');
  const stack = new DemoWebAppStack(app, 'Web', {
    projectName: 'testproj',
    environment: 'dev',
    vpc,
    lambdaSg: new ec2.SecurityGroup(dep, 'Sg', { vpc }),
    userPool,
    userPoolClient: userPool.addClient('Client'),
    knowledgeBaseId: 'kb-test-123',
    imageUri: 'latest',
    permissionCacheTable: new dynamodb.Table(dep, 'PCT', { partitionKey: { name: 'cacheKey', type: dynamodb.AttributeType.STRING } }),
    userAccessTable: new dynamodb.Table(dep, 'UAT', { partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING } }),
    env,
  } as any);
  const fns = Template.fromStack(stack).findResources('AWS::Lambda::Function', { Properties: { FunctionName: 'testproj-dev-webapp' } });
  const [fn] = Object.values(fns) as any[];
  return fn.Properties.Environment.Variables;
}

describe('administrator group', () => {
  it('creates the Cognito group admins by default', () => {
    securityTemplate().hasResourceProperties('AWS::Cognito::UserPoolGroup', { GroupName: 'admins' });
  });

  it('passes admins to the web app by default', () => {
    expect(webAppEnv().ADMIN_GROUP_NAMES).toBe('admins');
  });

  it('creates the first name as the Cognito group and passes all names', () => {
    const context = { adminGroupNames: 'rag-admins, Domain Admins' };
    securityTemplate(context).hasResourceProperties('AWS::Cognito::UserPoolGroup', { GroupName: 'rag-admins' });
    expect(webAppEnv(context).ADMIN_GROUP_NAMES).toBe('rag-admins,Domain Admins');
  });

  it('refuses a first name Cognito cannot use as a group name', () => {
    expect(() => securityTemplate({ adminGroupNames: 'Domain Admins' })).toThrow(/no whitespace/);
    expect(() => securityTemplate({ adminGroupNames: ' , ' })).toThrow(/at least one group/);
  });
});
