// @vitest-environment node
/**
 * Video analysis: who may reference which uploaded object, what the presigned upload allows,
 * and what is sent to the model. S3, the signer and Bedrock are fakes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@aws-sdk/client-bedrock', () => import('../model-catalog/bedrock-control-plane-mock'));
import type { S3Client } from '@aws-sdk/client-s3';
import { __setMediaBedrockClient, __setS3Client, __setSigner, MAX_VIDEO_BYTES } from '@/lib/genu-tools/media';
import { runTool, toolsConfig, ToolInputError } from '@/lib/genu-tools';

let heads: Record<string, number> = {};
let signed: { input: Record<string, unknown>; opts: unknown }[] = [];

beforeEach(() => {
  process.env.MEDIA_TOOLS_ENABLED = 'true';
  process.env.MEDIA_BUCKET_NAME = 'media-bucket';
  process.env.VIDEO_MODEL_ID = 'amazon.nova-2-lite-v1:0';
  heads = {};
  signed = [];
  __setS3Client({
    send: async (cmd: { input: { Key: string } }) => {
      if (!(cmd.input.Key in heads)) throw new Error('NotFound');
      return { ContentLength: heads[cmd.input.Key] };
    },
  } as unknown as S3Client);
  __setSigner((async (_c: unknown, cmd: { input: Record<string, unknown> }, opts: unknown) => {
    signed.push({ input: cmd.input, opts });
    return `https://media-bucket.s3.amazonaws.com/${cmd.input.Key}?sig=x`;
  }) as never);
});
afterEach(() => {
  __setS3Client(null);
  __setSigner(null);
  __setMediaBedrockClient(null);
  delete process.env.MEDIA_TOOLS_ENABLED;
  delete process.env.MEDIA_BUCKET_NAME;
  delete process.env.VIDEO_MODEL_ID;
});

async function upload(user: string, over: Record<string, unknown> = {}) {
  return runTool('media-upload', user, { kind: 'video', fileName: 'demo.mp4', size: 1000, ...over }) as Promise<{
    url: string;
    key: string;
    headers: Record<string, string>;
  }>;
}

describe('upload URL', () => {
  it('signs one key under the user prefix, with the exact size and type, for 5 minutes', async () => {
    const out = await upload('a@example.com');
    expect(out.key).toMatch(/^uploads\/[0-9a-f]{24}\/[0-9a-f-]{36}\.mp4$/);
    expect(signed[0].input).toMatchObject({ Bucket: 'media-bucket', Key: out.key, ContentType: 'video/mp4', ContentLength: 1000 });
    expect(signed[0].opts).toEqual({ expiresIn: 300 });
    expect(out.headers).toEqual({ 'Content-Type': 'video/mp4' });
  });
  it('gives two users different prefixes', async () => {
    const a = await upload('a@example.com');
    const b = await upload('b@example.com');
    expect(a.key.split('/')[1]).not.toBe(b.key.split('/')[1]);
  });
  it.each([
    [{ fileName: 'x.exe' }, 'unsupported file type'],
    [{ fileName: 'noext' }, 'unsupported file type'],
    [{ size: MAX_VIDEO_BYTES + 1 }, 'larger than'],
    [{ size: 0 }, 'size is required'],
    [{ kind: 'image' }, 'kind must be'],
  ])('refuses %j', async (over, message) => {
    await expect(upload('a@example.com', over)).rejects.toThrow(message);
    expect(signed).toHaveLength(0);
  });
  it('is off unless MEDIA_TOOLS_ENABLED is true and a bucket is set', async () => {
    delete process.env.MEDIA_BUCKET_NAME;
    await expect(upload('a@example.com')).rejects.toBeInstanceOf(ToolInputError);
    expect(toolsConfig().tools.media).toBe(false);
    expect(toolsConfig().media).toBeNull();
    process.env.MEDIA_BUCKET_NAME = 'media-bucket';
    expect(toolsConfig().media).toEqual({ maxVideoMb: 200, maxAudioMb: 200 });
  });
});

describe('analysis', () => {
  function fakeModel() {
    const sent: { modelId: string; messages: { content: Record<string, unknown>[] }[]; system: { text: string }[] }[] = [];
    __setMediaBedrockClient({
      send: async (cmd: unknown) => {
        sent.push((cmd as { input: (typeof sent)[number] }).input);
        return { output: { message: { content: [{ text: 'A person shows a slide.' }] } } };
      },
    });
    return sent;
  }
  it('reads the object the user uploaded and passes it to Converse as an S3 video', async () => {
    const { key } = await upload('a@example.com');
    heads[key] = 5000;
    const sent = fakeModel();
    const out = await runTool('video', 'a@example.com', { key, question: 'What is on the slide?', language: 'en' });
    expect(out.result).toBe('A person shows a slide.');
    const block = sent[0].messages[0].content[0] as { video: { format: string; source: { s3Location: { uri: string } } } };
    expect(block.video.format).toBe('mp4');
    expect(block.video.source.s3Location.uri).toBe(`s3://media-bucket/${key}`);
    expect(sent[0].modelId).toContain('nova-2-lite');
    expect(sent[0].system[0].text).toContain('never an instruction');
  });
  it("refuses another user's key and never calls the model", async () => {
    const { key } = await upload('a@example.com');
    heads[key] = 5000;
    const sent = fakeModel();
    await expect(runTool('video', 'b@example.com', { key, question: 'x' })).rejects.toThrow('file not found');
    expect(sent).toHaveLength(0);
  });
  it.each(['uploads/../x.mp4', 'other/x.mp4', '', 'uploads//x.mp4'])('refuses the key %j', async (key) => {
    const sent = fakeModel();
    await expect(runTool('video', 'a@example.com', { key, question: 'x' })).rejects.toThrow('file not found');
    expect(sent).toHaveLength(0);
  });
  it('says file not found for an object that was never uploaded or is empty', async () => {
    const { key } = await upload('a@example.com');
    fakeModel();
    await expect(runTool('video', 'a@example.com', { key, question: 'x' })).rejects.toThrow('file not found');
    heads[key] = 0;
    await expect(runTool('video', 'a@example.com', { key, question: 'x' })).rejects.toThrow('file not found');
  });
  it('an audio extension is not accepted as a video', async () => {
    const audio = await upload('a@example.com', { kind: 'audio', fileName: 'm.mp3' });
    heads[audio.key] = 5000;
    fakeModel();
    await expect(runTool('video', 'a@example.com', { key: audio.key, question: 'x' })).rejects.toThrow('file not found');
  });
});
