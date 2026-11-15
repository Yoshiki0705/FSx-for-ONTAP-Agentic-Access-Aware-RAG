/**
 * DemoVideoOutputStack
 *
 * The bucket that receives generated videos. Bedrock writes the output of an asynchronous
 * invocation to a bucket in the same Region as the model, and the only video-output model
 * found (Luma Ray v2) runs in us-west-2, so the bucket lives there and the web app in
 * ap-northeast-1 reads its name through a cross-Region reference (same pattern as
 * DemoWafStack). Objects are deleted after 1 day.
 *
 * Enabled by `enableVideoGeneration=true`.
 */
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

export interface DemoVideoOutputStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
}

export class DemoVideoOutputStack extends cdk.Stack {
  /** Name of the output bucket, passed to the WebApp stack as a cross-Region reference. */
  public readonly bucketName: string;

  constructor(scope: Construct, id: string, props: DemoVideoOutputStackProps) {
    super(scope, id, props);
    const prefix = `${props.projectName}-${props.environment}`;
    const bucket = new s3.Bucket(this, 'VideoOutputBucket', {
      bucketName: `${prefix}-video-output-${cdk.Aws.ACCOUNT_ID}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [{ expiration: cdk.Duration.days(1), abortIncompleteMultipartUploadAfter: cdk.Duration.days(1) }],
    });
    this.bucketName = bucket.bucketName;
    NagSuppressions.addResourceSuppressions(bucket, [
      {
        id: 'AwsSolutions-S1',
        reason: 'Transient output bucket: objects are deleted after 1 day and are reachable only through download URLs the web app signed for one key. There is no log bucket in this stack, and a second bucket for logs would hold more data for longer than the videos themselves.',
      },
    ]);
  }
}
