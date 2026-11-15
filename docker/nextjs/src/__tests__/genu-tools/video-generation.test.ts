// @vitest-environment node
/**
 * Video generation: what is sent to the model, who may read a job, and the download URL.
 * Bedrock, S3 and the signer are fakes.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __setVideoClients, __setVideoSigner, videoPrefix } from '@/lib/genu-tools/video-generation';
import { runTool, toolsConfig, ToolInputError } from '@/lib/genu-tools';

const ARN = 'arn:aws:bedrock:us-west-2:123456789012:async-invoke/abc123def456';
let started: Record<string, unknown>[] = [];
let jobs: Record<string, { status: string; failureMessage?: string; s3Uri: string }> = {};
let signedKeys: { bucket: string; key: string; expiresIn: number }[] = [];
let startError: { name: string } | null = null;

beforeEach(() => {
  process.env.VIDEO_GENERATION_ENABLED = 'true';
  process.env.VIDEO_GENERATION_REGION = 'us-west-2';
  process.env.VIDEO_GENERATION_MODEL_ID = 'luma.test-model:0';
  process.env.VIDEO_OUTPUT_BUCKET = 'video-out';
  process.env.AWS_REGION = 'ap-northeast-1';
  started = [];
  jobs = {};
  signedKeys = [];
  startError = null;
  __setVideoClients(
    {
      send: async (cmd: { constructor: { name: string }; input: Record<string, unknown> }) => {
        if (cmd.constructor.name === 'StartAsyncInvokeCommand') {
          if (startError) throw Object.assign(new Error('x'), startError);
          started.push(cmd.input);
          return { invocationArn: ARN };
        }
        const job = jobs[cmd.input.invocationArn as string];
        if (!job) throw new Error('ResourceNotFound');
        return { status: job.status, failureMessage: job.failureMessage, outputDataConfig: { s3OutputDataConfig: { s3Uri: job.s3Uri } } };
      },
    },
    { send: async () => ({}) },
  );
  __setVideoSigner((async (_c: unknown, cmd: { input: { Bucket: string; Key: string } }, opts: { expiresIn: number }) => {
    signedKeys.push({ bucket: cmd.input.Bucket, key: cmd.input.Key, expiresIn: opts.expiresIn });
    return `https://video-out.s3.us-west-2.amazonaws.com/${cmd.input.Key}?sig=x`;
  }) as never);
});
afterEach(() => {
  __setVideoClients(null, null);
  __setVideoSigner(null);
  for (const k of ['ENABLED', 'REGION', 'MODEL_ID']) delete process.env[`VIDEO_GENERATION_${k}`];
  delete process.env.VIDEO_OUTPUT_BUCKET;
});

const start = (user: string, over: Record<string, unknown> = {}) =>
  runTool('video-generate-start', user, { prompt: 'a paper boat', aspectRatio: '16:9', resolution: '540p', ...over });

describe('start', () => {
  it('starts one job in the video Region with the checked parameters and an output folder under the user prefix', async () => {
    const out = (await start('a@example.com')) as { invocationArn: string; region: string };
    expect(out).toEqual({ invocationArn: ARN, region: 'us-west-2' });
    const input = started[0] as { modelId: string; modelInput: Record<string, string>; outputDataConfig: { s3OutputDataConfig: { s3Uri: string } } };
    expect(input.modelId).toBe('luma.test-model:0');
    expect(input.modelInput).toEqual({ prompt: 'a paper boat', aspect_ratio: '16:9', resolution: '540p', duration: '5s' });
    expect(input.outputDataConfig.s3OutputDataConfig.s3Uri).toMatch(
      new RegExp(`^s3://video-out/${videoPrefix('a@example.com')}[0-9a-f-]{36}/$`),
    );
  });
  it.each([
    [{ prompt: '  ' }, 'prompt is required'],
    [{ prompt: 'x'.repeat(2001) }, 'longer than'],
    [{ aspectRatio: '4:3' }, 'unsupported aspect ratio'],
    [{ resolution: '1080p' }, 'unsupported resolution'],
  ])('refuses %j and starts nothing', async (over, message) => {
    await expect(start('a@example.com', over)).rejects.toThrow(message);
    expect(started).toHaveLength(0);
  });
  it('turns a throttling answer into a "busy" message', async () => {
    startError = { name: 'ThrottlingException' };
    await expect(start('a@example.com')).rejects.toThrow('busy');
  });
  it('is off unless enabled and a bucket is set', async () => {
    expect(toolsConfig().tools.videoGeneration).toBe(true);
    expect(toolsConfig().videoGeneration).toEqual({ region: 'us-west-2', modelId: 'luma.test-model:0', crossRegion: true });
    delete process.env.VIDEO_OUTPUT_BUCKET;
    await expect(start('a@example.com')).rejects.toBeInstanceOf(ToolInputError);
    expect(toolsConfig().tools.videoGeneration).toBe(false);
    expect(toolsConfig().videoGeneration).toBeNull();
  });
});

describe('status', () => {
  const mine = (user: string) => `s3://video-out/${videoPrefix(user)}11111111-1111-1111-1111-111111111111/`;
  it('returns a 10-minute download URL for the output of a finished job', async () => {
    jobs[ARN] = { status: 'Completed', s3Uri: mine('a@example.com') };
    const out = (await runTool('video-generate-status', 'a@example.com', { invocationArn: ARN })) as { status: string; url: string };
    expect(out.status).toBe('Completed');
    expect(signedKeys).toEqual([{ bucket: 'video-out', key: `${videoPrefix('a@example.com')}11111111-1111-1111-1111-111111111111/output.mp4`, expiresIn: 600 }]);
    expect(out.url).toContain('output.mp4');
  });
  it('reports progress and failure without a URL', async () => {
    jobs[ARN] = { status: 'InProgress', s3Uri: mine('a@example.com') };
    expect(await runTool('video-generate-status', 'a@example.com', { invocationArn: ARN })).toEqual({ status: 'InProgress' });
    jobs[ARN] = { status: 'Failed', failureMessage: 'content blocked', s3Uri: mine('a@example.com') };
    expect(await runTool('video-generate-status', 'a@example.com', { invocationArn: ARN })).toEqual({ status: 'Failed', reason: 'content blocked' });
    expect(signedKeys).toHaveLength(0);
  });
  it("refuses another user's job even with a valid ARN, and signs nothing", async () => {
    jobs[ARN] = { status: 'Completed', s3Uri: mine('a@example.com') };
    await expect(runTool('video-generate-status', 'b@example.com', { invocationArn: ARN })).rejects.toThrow('job not found');
    expect(signedKeys).toHaveLength(0);
  });
  it('refuses a job whose output is in another bucket or outside the videos prefix', async () => {
    jobs[ARN] = { status: 'Completed', s3Uri: `s3://other-bucket/${videoPrefix('a@example.com')}x/` };
    await expect(runTool('video-generate-status', 'a@example.com', { invocationArn: ARN })).rejects.toThrow('job not found');
    jobs[ARN] = { status: 'Completed', s3Uri: `s3://video-out/uploads/x/` };
    await expect(runTool('video-generate-status', 'a@example.com', { invocationArn: ARN })).rejects.toThrow('job not found');
  });
  it.each(['', 'not-an-arn', 'arn:aws:bedrock:us-west-2:123456789012:async-invoke/../x', 'arn:aws:bedrock:us-west-2:123456789012:model/abc123def456'])(
    'refuses the malformed ARN %j',
    async (arn) => {
      await expect(runTool('video-generate-status', 'a@example.com', { invocationArn: arn })).rejects.toThrow('job not found');
    },
  );
  it('says job not found for an unknown ARN', async () => {
    await expect(runTool('video-generate-status', 'a@example.com', { invocationArn: ARN })).rejects.toThrow('job not found');
  });
});
