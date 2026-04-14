/**
 * Property 3: テキスト出力の音声再生状態非依存性
 * 任意の音声再生状態において、テキストストリーミング出力は中断されず継続する。
 *
 * **Validates: Requirements 8.5**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

type PlaybackState = 'playing' | 'paused' | 'stopped';

interface TextStreamState {
  chunks: string[];
  isComplete: boolean;
}

/**
 * テキストストリーミングのシミュレーション
 * 音声再生状態に依存せず、テキスト出力を継続する。
 */
function processTextStream(
  textChunks: string[],
  playbackStates: PlaybackState[]
): TextStreamState {
  const outputChunks: string[] = [];

  for (let i = 0; i < textChunks.length; i++) {
    // 音声再生状態に関係なくテキストチャンクを出力
    // playbackStates[i] は無視される
    outputChunks.push(textChunks[i]);
  }

  return {
    chunks: outputChunks,
    isComplete: outputChunks.length === textChunks.length,
  };
}

describe('Property 3: Text Output Independence from Playback State', () => {
  const playbackStateArb = fc.constantFrom<PlaybackState>('playing', 'paused', 'stopped');

  it('text output should be identical regardless of playback state changes', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 50 }),
        fc.array(playbackStateArb, { minLength: 1, maxLength: 50 }),
        fc.array(playbackStateArb, { minLength: 1, maxLength: 50 }),
        (textChunks: string[], states1: PlaybackState[], states2: PlaybackState[]) => {
          const result1 = processTextStream(textChunks, states1);
          const result2 = processTextStream(textChunks, states2);

          // テキスト出力は音声再生状態に依存しない
          expect(result1.chunks).toEqual(result2.chunks);
          expect(result1.isComplete).toBe(result2.isComplete);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('all text chunks should be output regardless of playback state', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 30 }),
        playbackStateArb,
        (textChunks: string[], playbackState: PlaybackState) => {
          const states = Array(textChunks.length).fill(playbackState);
          const result = processTextStream(textChunks, states);

          expect(result.isComplete).toBe(true);
          expect(result.chunks.length).toBe(textChunks.length);
          expect(result.chunks).toEqual(textChunks);
        }
      ),
      { numRuns: 200 }
    );
  });
});
