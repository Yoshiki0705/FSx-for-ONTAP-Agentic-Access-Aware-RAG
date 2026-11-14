/**
 * Image generation. Off unless CDK sets IMAGE_GENERATION_ENABLED (context
 * `enableImageGeneration`). The model is called in IMAGE_GENERATION_REGION, which can be
 * outside Japan: the prompt and the generated image are then processed in that region, and
 * the screen says so before the user sends anything.
 *
 * The request body is the Stability AI text-to-image shape on Amazon Bedrock (prompt,
 * negative_prompt, aspect_ratio, seed, output_format); the response carries base64 images
 * and a finish reason per image. Images are returned to the browser and not stored.
 */
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { ToolInputError } from './text-model';

export const DEFAULT_IMAGE_MODEL = 'stability.stable-image-core-v1:1';
export const DEFAULT_IMAGE_REGION = 'us-west-2';
export const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '3:2', '2:3', '4:5', '5:4', '21:9', '9:21'] as const;
const MAX_PROMPT_CHARS = 2_000;

export interface ImageConfig {
  enabled: boolean;
  region: string;
  modelId: string;
  /** True when the model runs outside the region the app is deployed in. */
  crossRegion: boolean;
}

export function imageConfig(): ImageConfig {
  const region = process.env.IMAGE_GENERATION_REGION || DEFAULT_IMAGE_REGION;
  const home = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-northeast-1';
  return {
    enabled: process.env.IMAGE_GENERATION_ENABLED === 'true',
    region,
    modelId: process.env.IMAGE_GENERATION_MODEL_ID || DEFAULT_IMAGE_MODEL,
    crossRegion: region !== home,
  };
}

const clients = new Map<string, BedrockRuntimeClient>();
let override: { send: (cmd: unknown) => Promise<unknown> } | null = null;
export function __setImageClient(c: { send: (cmd: unknown) => Promise<unknown> } | null): void {
  override = c;
}
function bedrock(region: string): { send: (cmd: unknown) => Promise<unknown> } {
  if (override) return override;
  let c = clients.get(region);
  if (!c) {
    c = new BedrockRuntimeClient({ region, maxAttempts: 3 });
    clients.set(region, c);
  }
  return c as unknown as { send: (cmd: unknown) => Promise<unknown> };
}

export interface ImageRequest {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  seed?: number;
}

export function buildImageBody(req: ImageRequest): Record<string, unknown> {
  const prompt = (req.prompt || '').trim();
  if (!prompt) throw new ToolInputError('prompt is required');
  if (prompt.length > MAX_PROMPT_CHARS) throw new ToolInputError(`prompt is longer than ${MAX_PROMPT_CHARS} characters`);
  const aspect = req.aspectRatio || '1:1';
  if (!ASPECT_RATIOS.includes(aspect as (typeof ASPECT_RATIOS)[number])) throw new ToolInputError(`unsupported aspect ratio: ${aspect}`);
  const body: Record<string, unknown> = { prompt, aspect_ratio: aspect, output_format: 'png' };
  const negative = (req.negativePrompt || '').trim();
  if (negative) body.negative_prompt = negative.slice(0, MAX_PROMPT_CHARS);
  if (Number.isInteger(req.seed) && (req.seed as number) >= 0 && (req.seed as number) <= 4294967294) body.seed = req.seed;
  return body;
}

export class ImageFilteredError extends Error {}

export async function generateImage(req: ImageRequest): Promise<{ imageBase64: string; modelId: string; region: string; seed?: number }> {
  const config = imageConfig();
  if (!config.enabled) throw new ToolInputError('image generation is not enabled');
  const out = (await bedrock(config.region).send(
    new InvokeModelCommand({
      modelId: config.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(buildImageBody(req)),
    }),
  )) as { body?: Uint8Array };
  const parsed = JSON.parse(new TextDecoder().decode(out.body || new Uint8Array())) as {
    images?: string[];
    finish_reasons?: (string | null)[];
    seeds?: number[];
  };
  const reason = parsed.finish_reasons?.[0];
  if (reason) throw new ImageFilteredError(String(reason));
  const imageBase64 = parsed.images?.[0];
  if (!imageBase64) throw new Error('the model returned no image');
  return { imageBase64, modelId: config.modelId, region: config.region, seed: parsed.seeds?.[0] };
}
