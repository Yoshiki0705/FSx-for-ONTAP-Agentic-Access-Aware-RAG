/**
 * Request shapes that offline gates could not catch before (Issue #228).
 *
 * 1. The S3 Vectors index used by Bedrock Knowledge Bases must list AMAZON_BEDROCK_TEXT and
 *    AMAZON_BEDROCK_METADATA as non-filterable, within the limit of 10 non-filterable keys.
 * 2. The S3 access point custom resource must send CreateAndAttachS3AccessPoint and
 *    DetachAndDeleteS3AccessPoint in the shape of the FSx API reference, read the created access
 *    point from S3AccessPointAttachment.S3AccessPoint, and fail the resource on a rejected create.
 *
 * Neither case calls AWS. They pin the shapes; they do not prove that the services accept them.
 */
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { DemoAIStack } from '../../lib/stacks/demo/demo-ai-stack';
import { DemoStorageStack, S3AP_API_SHAPES_JS } from '../../lib/stacks/demo/demo-storage-stack';

type Shapes = {
  clientRequestToken: (requestId: string, suffix?: string) => string;
  buildCreateAndAttachRequest: (n: string, v: string, t: string, u: string, token: string) => any;
  buildDetachAndDeleteRequest: (n: string, token: string) => any;
  parseCreateAndAttachResponse: (b: any) => { arn: string; alias: string };
};

// The same text that is embedded in the inline Lambda.
const shapes: Shapes = new Function(
  `${S3AP_API_SHAPES_JS}; return { clientRequestToken, buildCreateAndAttachRequest, buildDetachAndDeleteRequest, parseCreateAndAttachResponse };`,
)();

describe('S3 Vectors index non-filterable keys', () => {
  const app = new cdk.App();
  const stack = new DemoAIStack(app, 'TestAIShapes', {
    projectName: 'testproj',
    environment: 'dev',
    userAccessTableName: 'test-user-access',
    userAccessTableArn: 'arn:aws:dynamodb:ap-northeast-1:123456789012:table/test-user-access',
    env: { account: '123456789012', region: 'ap-northeast-1' },
  });
  const resources = Template.fromStack(stack).findResources('AWS::CloudFormation::CustomResource');
  const keys: string[] = Object.values(resources)
    .map((r: any) => r.Properties?.NonFilterableMetadataKeys)
    .filter((v: unknown): v is string => typeof v === 'string')
    .flatMap((v) => JSON.parse(v));

  it('lists the keys Bedrock Knowledge Bases writes the chunk text and metadata under', () => {
    expect(keys).toEqual(expect.arrayContaining(['AMAZON_BEDROCK_TEXT', 'AMAZON_BEDROCK_METADATA']));
  });

  it('stays within 10 non-filterable keys and has no duplicates', () => {
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.length).toBeLessThanOrEqual(10);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('no longer lists the unused chunk_text key', () => {
    expect(keys).not.toContain('chunk_text');
  });
});

describe('FSx S3 access point API shapes', () => {
  it('builds CreateAndAttachS3AccessPoint with Name, Type and OntapConfiguration (UNIX)', () => {
    expect(shapes.buildCreateAndAttachRequest('demo-s3ap', 'fsvol-0123456789abcdef0', 'UNIX', 'root', 'tok-1')).toEqual({
      ClientRequestToken: 'tok-1',
      Name: 'demo-s3ap',
      Type: 'ONTAP',
      OntapConfiguration: {
        VolumeId: 'fsvol-0123456789abcdef0',
        FileSystemIdentity: { Type: 'UNIX', UnixUser: { Name: 'root' } },
      },
    });
  });

  it('builds the WINDOWS identity under OntapConfiguration', () => {
    const body = shapes.buildCreateAndAttachRequest('demo-s3ap', 'fsvol-0123456789abcdef0', 'WINDOWS', 'Admin', 'tok-2');
    expect(body.OntapConfiguration.FileSystemIdentity).toEqual({ Type: 'WINDOWS', WindowsUser: { Name: 'Admin' } });
    expect(body).not.toHaveProperty('VolumeId');
    expect(body).not.toHaveProperty('FileSystemIdentity');
    expect(body).not.toHaveProperty('S3AccessPointConfiguration');
  });

  it('deletes by Name, not by an ARN key', () => {
    expect(shapes.buildDetachAndDeleteRequest('demo-s3ap', 'tok-3')).toEqual({ ClientRequestToken: 'tok-3', Name: 'demo-s3ap' });
  });

  it('derives a ClientRequestToken FSx accepts from the CloudFormation request ID', () => {
    const id = 'bb3ef3b1-8e5a-4b4e-9c35-6f0b2a2e3d41';
    const token = shapes.clientRequestToken(id, 'new');
    expect(token).toBe(`${id}-new`);
    expect(token).toMatch(/^[A-Za-z0-9_.-]{1,63}$/);
    // Same event delivered twice gives the same token (idempotent); create and delete differ.
    expect(shapes.clientRequestToken(id, 'new')).toBe(token);
    expect(shapes.clientRequestToken(id, 'del')).not.toBe(token);
    expect(shapes.clientRequestToken('x'.repeat(80) + '/+=', 'new')).toMatch(/^[A-Za-z0-9_.-]{1,63}$/);
    expect(() => shapes.clientRequestToken('', '')).toThrow();
  });

  it('reads the ARN and alias from S3AccessPointAttachment.S3AccessPoint', () => {
    const body = {
      S3AccessPointAttachment: {
        Name: 'demo-s3ap',
        S3AccessPoint: {
          ResourceARN: 'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/demo-s3ap',
          Alias: 'demo-s3ap-abcdefgh-ext-s3alias',
        },
      },
    };
    expect(shapes.parseCreateAndAttachResponse(body)).toEqual({
      arn: 'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/demo-s3ap',
      alias: 'demo-s3ap-abcdefgh-ext-s3alias',
    });
    expect(shapes.parseCreateAndAttachResponse({ S3AccessPointArn: 'x' })).toEqual({ arn: '', alias: '' });
  });

  it('embeds the shapes in the generated handler, which parses, and fails a rejected create', () => {
    // getS3ApCreatorCode does not use instance state, so it can be called without synthesizing.
    const code: string = (DemoStorageStack.prototype as any).getS3ApCreatorCode.call({});
    expect(() => new Function('require', 'exports', 'process', code)).not.toThrow();
    expect(code).toContain('function buildCreateAndAttachRequest(');
    expect(code).toContain("clientRequestToken(event.RequestId, 'new')");
    expect(code).toContain("buildDetachAndDeleteRequest(apName, clientRequestToken(event.RequestId, 'del'))");
    expect(code).toContain("buildDetachAndDeleteRequest(oldName, clientRequestToken(event.RequestId, 'upd'))");
    expect(code).not.toContain('S3AccessPointConfiguration');
    expect(code).not.toContain('S3AccessPointArn:');
    expect(code).toMatch(/sendCfnResponse\(event, 'FAILED', 'fsx-s3-ap-failed-'/);
  });
});
