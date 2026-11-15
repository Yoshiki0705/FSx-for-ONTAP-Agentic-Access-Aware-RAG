/**
 * Video generation. Off unless CDK sets VIDEO_GENERATION_ENABLED (context
 * `enableVideoGeneration`). The model runs in VIDEO_GENERATION_REGION, which can be outside
 * Japan: the prompt and the generated video are then processed and stored there, and the
 * screen says so before the user sends anything.
 *
 * Two calls from the browser: `video-generate-start` starts a Bedrock asynchronous
 * invocation that writes to a bucket in that Region, and `video-generate-status` is polled
 * until the job is finished, then returns a short-lived download URL. A job belongs to the
 * user whose prefix (`videos/<hash of the user id>/`) its output location carries; the
 * service's own answer for the job decides that, not anything the browser sends.
 */
import { createHash, randomUUID } from 'node:crypto';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BedrockRuntimeClient, GetAsyncInvokeCommand, StartAsyncInvokeCommand } from '@aws-sdk/client-bedrock-runtime';
import { ToolInputError } from './text-model';

export const DEFAULT_VIDEO_REGION = 'us-west-2';
/** Values checked against the model on 2026-11-15 (us-west-2). */
export const VIDEO_ASPECTS = ['16:9', '9:16'] as const;
export const VIDEO_RESOLUTIONS = ['540p', '720p'] as const;
const MAX_PROMPT_CHARS = 2_000;
const DOWNLOAD_URL_SECONDS = 600;

export interface VideoGenerationConfig {
  enabled: boolean;
  region: string;
  modelId: string;
  bucket: string;
  /** True when the model runs outside the region the app is deployed in. */
  crossRegion: boolean;
}

export function videoGenerationConfig(): VideoGenerationConfig {
  const region = process.env.VIDEO_GENERATION_REGION || DEFAULT_VIDEO_REGION;
  const home = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-northeast-1';
  const bucket = process.env.VIDEO_OUTPUT_BUCKET || '';
  return {
    enabled: process.env.VIDEO_GENERATION_ENABLED === 'true' && !!bucket,
    region,
    modelId: process.env.VIDEO_GENERATION_MODEL_ID || '',
    bucket,
    crossRegion: region !== home,
  };
}

type Sender = { send: (cmd: unknown) => Promise<unknown> };
let bedrockOverride: Sender | null = null;
let s3Override: Sender | null = null;
export function __setVideoClients(b: Sender | null, s3: Sender | null): void {
  bedrockOverride = b;
  s3Override = s3;
}
let signer: typeof getSignedUrl = getSignedUrl;
export function __setVideoSigner(f: typeof getSignedUrl | null): void {
  signer = f ?? getSignedUrl;
}
const bedrockClients = new Map<string, BedrockRuntimeClient>();
function bedrock(region: string): Sender {
  if (bedrockOverride) return bedrockOverride;
  let c = bedrockClients.get(region);
  if (!c) {
    c = new BedrockRuntimeClient({ region, maxAttempts: 3 });
    bedrockClients.set(region, c);
  }
  return c as unknown as Sender;
}
const s3Clients = new Map<string, S3Client>();
function s3(region: string): Sender {
  if (s3Override) return s3Override;
  let c = s3Clients.get(region);
  if (!c) {
    c = new S3Client({ region, maxAttempts: 3 });
    s3Clients.set(region, c);
  }
  return c as unknown as Sender;
}

export function videoPrefix(userId: string): string {
  return `videos/${createHash('sha256').update(userId).digest('hex').slice(0, 24)}/`;
}

function requireEnabled(): VideoGenerationConfig {
  const cfg = videoGenerationConfig();
  if (!cfg.enabled || !cfg.modelId) throw new ToolInputError('video generation is not enabled');
  return cfg;
}

export async function startVideo(
  userId: string,
  input: { prompt: string; aspectRatio: string; resolution: string },
): Promise<{ invocationArn: string; region: string }> {
  const cfg = requireEnabled();
  const prompt = input.prompt.trim();
  if (!prompt) throw new ToolInputError('prompt is required');
  if (prompt.length > MAX_PROMPT_CHARS) throw new ToolInputError(`prompt is longer than ${MAX_PROMPT_CHARS} characters`);
  if (!(VIDEO_ASPECTS as readonly string[]).includes(input.aspectRatio)) throw new ToolInputError(`unsupported aspect ratio: ${input.aspectRatio}`);
  if (!(VIDEO_RESOLUTIONS as readonly string[]).includes(input.resolution)) throw new ToolInputError(`unsupported resolution: ${input.resolution}`);
  try {
    const out = (await bedrock(cfg.region).send(
      new StartAsyncInvokeCommand({
        modelId: cfg.modelId,
        modelInput: { prompt, aspect_ratio: input.aspectRatio, resolution: input.resolution, duration: '5s' },
        outputDataConfig: { s3OutputDataConfig: { s3Uri: `s3://${cfg.bucket}/${videoPrefix(userId)}${randomUUID()}/` } },
      }),
    )) as { invocationArn?: string };
    if (!out.invocationArn) throw new Error('no invocation ARN');
    return { invocationArn: out.invocationArn, region: cfg.region };
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === 'ThrottlingException' || name === 'ServiceQuotaExceededException') {
      throw new ToolInputError('the video service is busy; try again in a minute');
    }
    if (name === 'ValidationException') throw new ToolInputError('the prompt was not accepted by the model');
    throw e;
  }
}

const ARN_PATTERN = /^arn:aws:bedrock:[a-z0-9-]+:\d{12}:async-invoke\/[A-Za-z0-9]{6,40}$/;

export async function videoStatus(
  userId: string,
  input: { invocationArn: string },
): Promise<{ status: string; url?: string; reason?: string }> {
  const cfg = requireEnabled();
  if (typeof input.invocationArn !== 'string' || !ARN_PATTERN.test(input.invocationArn)) throw new ToolInputError('job not found');
  const mine = `s3://${cfg.bucket}/${videoPrefix(userId)}`;
  let job: { status?: string; failureMessage?: string; outputDataConfig?: { s3OutputDataConfig?: { s3Uri?: string } } };
  try {
    job = (await bedrock(cfg.region).send(new GetAsyncInvokeCommand({ invocationArn: input.invocationArn }))) as typeof job;
  } catch {
    throw new ToolInputError('job not found');
  }
  const out = job.outputDataConfig?.s3OutputDataConfig?.s3Uri || '';
  if (!out.startsWith(mine) || out.includes('..')) throw new ToolInputError('job not found');
  if (job.status === 'Failed') return { status: 'Failed', reason: (job.failureMessage || '').slice(0, 300) };
  if (job.status !== 'Completed') return { status: 'InProgress' };
  const key = `${out.slice(`s3://${cfg.bucket}/`.length).replace(/\/?$/, '/')}output.mp4`;
  const url = await signer(s3(cfg.region) as unknown as S3Client, new GetObjectCommand({ Bucket: cfg.bucket, Key: key }), {
    expiresIn: DOWNLOAD_URL_SECONDS,
  });
  return { status: 'Completed', url };
}
