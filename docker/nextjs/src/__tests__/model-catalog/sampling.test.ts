/**
 * Sampling parameters learned from a model's own error (src/lib/model-catalog/sampling.ts).
 * The messages are the ones Bedrock returned in ap-northeast-1 on 2026-11-15.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  messagesSampling,
  rejectedBy,
  resetSamplingMemory,
  samplingFor,
  withSampling,
} from '@/lib/model-catalog/sampling';

const err = (message: string, name = 'ValidationException') => Object.assign(new Error(message), { name });
const HAIKU_55 = err('The model returned the following errors: `temperature` is deprecated for this model.');
const SONNET_46 = err(
  'The model returned the following errors: `temperature` and `top_p` cannot both be specified for this model. Please use only one.',
);

beforeEach(() => resetSamplingMemory());

describe('reading the error', () => {
  it('drops a deprecated parameter', () => {
    expect(rejectedBy(HAIKU_55)).toEqual(['temperature']);
  });

  it('keeps temperature when only one of temperature and top_p is allowed', () => {
    expect(rejectedBy(SONNET_46)).toEqual(['topP']);
  });

  it('ignores errors that name no sampling parameter, or are not validation errors', () => {
    expect(rejectedBy(err('Input is too long for requested model.'))).toEqual([]);
    expect(rejectedBy(err('`temperature` is deprecated', 'ThrottlingException'))).toEqual([]);
    expect(rejectedBy(undefined)).toEqual([]);
  });
});

describe('calling with the sampling a model accepts', () => {
  it('retries once without the rejected parameter and remembers it', async () => {
    const seen: unknown[] = [];
    const call = async (s: object) => {
      seen.push(s);
      if ('temperature' in s) throw HAIKU_55;
      return 'ok';
    };
    expect(await withSampling('jp.anthropic.claude-haiku-5-5', { temperature: 0.1 }, call)).toBe('ok');
    expect(seen).toEqual([{ temperature: 0.1 }, {}]);
    // The second call goes straight to the accepted form.
    seen.length = 0;
    expect(await withSampling('jp.anthropic.claude-haiku-5-5', { temperature: 0.1 }, call)).toBe('ok');
    expect(seen).toEqual([{}]);
  });

  it('learns per model, not globally', async () => {
    await withSampling('m1', { temperature: 0.7, topP: 0.9 }, async (s) => {
      if ('topP' in s) throw SONNET_46;
      return 1;
    });
    expect(samplingFor('m1', { temperature: 0.7, topP: 0.9 })).toEqual({ temperature: 0.7 });
    expect(samplingFor('m2', { temperature: 0.7, topP: 0.9 })).toEqual({ temperature: 0.7, topP: 0.9 });
  });

  it('passes other errors through without retrying', async () => {
    let calls = 0;
    const boom = err('Malformed input request');
    await expect(
      withSampling('m', { temperature: 0.1 }, async () => {
        calls++;
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(calls).toBe(1);
  });

  it('writes the Messages API field names', () => {
    expect(messagesSampling({ temperature: 0.1, topP: 0.9, topK: 5 })).toEqual({ temperature: 0.1, top_p: 0.9, top_k: 5 });
  });
});

describe('reading the answer', () => {
  it('joins every text block and skips the others', async () => {
    const { joinText } = await import('@/lib/model-catalog/response');
    expect(joinText([{ type: 'thinking', thinking: '...' }, { type: 'text', text: 'A' }, { type: 'text', text: 'B' }])).toBe('AB');
    // Converse blocks carry no `type`
    expect(joinText([{ reasoningContent: {} }, { text: 'answer' }])).toBe('answer');
    expect(joinText(undefined)).toBe('');
  });
});
