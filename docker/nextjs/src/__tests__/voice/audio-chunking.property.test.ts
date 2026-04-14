/**
 * Property 2: 音声データチャンク分割の正確性
 * 任意の長さの PCM 音声バッファに対して、チャンク分割関数は各チャンクが
 * 正確に 1600 サンプル（16kHz × 100ms）を含み、最後のチャンクのみそれ以下を許容し、
 * 全チャンク結合が元バッファと一致することを検証。
 *
 * **Validates: Requirements 3.2**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { splitAudioIntoChunks, CHUNK_SAMPLE_COUNT } from '@/types/voice';

describe('Property 2: Audio Chunking Accuracy', () => {
  it('each chunk except the last should have exactly CHUNK_SAMPLE_COUNT samples', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50000 }),
        (bufferLength: number) => {
          const buffer = new Float32Array(bufferLength);
          // Fill with sequential values for verification
          for (let i = 0; i < bufferLength; i++) {
            buffer[i] = i / bufferLength;
          }

          const chunks = splitAudioIntoChunks(buffer);

          // All chunks except the last must be exactly CHUNK_SAMPLE_COUNT
          for (let i = 0; i < chunks.length - 1; i++) {
            expect(chunks[i].length).toBe(CHUNK_SAMPLE_COUNT);
          }

          // Last chunk must be <= CHUNK_SAMPLE_COUNT
          if (chunks.length > 0) {
            expect(chunks[chunks.length - 1].length).toBeLessThanOrEqual(CHUNK_SAMPLE_COUNT);
            expect(chunks[chunks.length - 1].length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('concatenating all chunks should produce the original buffer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        (bufferLength: number) => {
          const buffer = new Float32Array(bufferLength);
          for (let i = 0; i < bufferLength; i++) {
            buffer[i] = Math.sin(i * 0.01);
          }

          const chunks = splitAudioIntoChunks(buffer);

          // Concatenate all chunks
          const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
          expect(totalLength).toBe(bufferLength);

          const reconstructed = new Float32Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) {
            reconstructed.set(chunk, offset);
            offset += chunk.length;
          }

          // Verify exact match
          for (let i = 0; i < bufferLength; i++) {
            expect(reconstructed[i]).toBe(buffer[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('number of chunks should be ceil(bufferLength / CHUNK_SAMPLE_COUNT)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50000 }),
        (bufferLength: number) => {
          const buffer = new Float32Array(bufferLength);
          const chunks = splitAudioIntoChunks(buffer);

          const expectedChunks = Math.ceil(bufferLength / CHUNK_SAMPLE_COUNT);
          expect(chunks.length).toBe(expectedChunks);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('empty buffer should produce no chunks', () => {
    const buffer = new Float32Array(0);
    const chunks = splitAudioIntoChunks(buffer);
    expect(chunks.length).toBe(0);
  });
});
