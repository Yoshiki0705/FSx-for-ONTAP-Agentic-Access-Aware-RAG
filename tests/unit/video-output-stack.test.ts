/**
 * The bucket that receives generated videos: private, encrypted, SSL only, objects gone after 1 day.
 */
import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { DemoVideoOutputStack } from '../../lib/stacks/demo/demo-video-output-stack';

describe('DemoVideoOutputStack', () => {
  const app = new cdk.App();
  const stack = new DemoVideoOutputStack(app, 'TestVideoOut', { projectName: 'testproj', environment: 'dev', env: { account: '123456789012', region: 'us-west-2' } });
  const t = Template.fromStack(stack);
  it('creates one private encrypted bucket that deletes objects after 1 day', () => {
    t.resourceCountIs('AWS::S3::Bucket', 1);
    t.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: Match.anyValue(),
      PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
      LifecycleConfiguration: { Rules: Match.arrayWith([Match.objectLike({ ExpirationInDays: 1, Status: 'Enabled' })]) },
    });
  });
  it('refuses non-TLS requests', () => {
    t.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Effect: 'Deny', Condition: { Bool: { 'aws:SecureTransport': 'false' } } })]) },
    });
  });
});
