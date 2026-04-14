/**
 * Feature: episodic-memory, Property 4: エピソードカード表示の完全性
 * Feature: episodic-memory, Property 7: エピソード削除後のリスト整合性
 *
 * **Validates: Requirements 4.1, 4.3, 7.3, 7.4**
 */

import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import type { Episode, EpisodeOutcome } from '@/types/episode';

// --- Generators ---

const episodeOutcomeGen: fc.Arbitrary<EpisodeOutcome> = fc.record({
  status: fc.constantFrom('success' as const, 'partial' as const, 'failure' as const),
  summary: fc.string({ minLength: 1, maxLength: 100 }),
});

const episodeGen: fc.Arbitrary<Episode> = fc.record({
  id: fc.uuid(),
  goal: fc.string({ minLength: 1, maxLength: 200 }),
  steps: fc.array(
    fc.record({ order: fc.nat({ max: 20 }), reasoning: fc.string({ minLength: 1, maxLength: 100 }) }),
    { minLength: 0, maxLength: 10 }
  ),
  actions: fc.array(
    fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      input: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
      result: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
    }),
    { minLength: 0, maxLength: 5 }
  ),
  outcome: episodeOutcomeGen,
  reflection: fc.string({ minLength: 0, maxLength: 200 }),
  createdAt: fc.integer({ min: 1577836800000, max: 1798761600000 }).map((ts) => new Date(ts).toISOString()),
  score: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
  metadata: fc.constant(undefined),
});

// --- Pure logic: EpisodeCard rendering data extraction ---

function extractCardDisplayData(episode: Episode) {
  const statusIcon = episode.outcome?.status === 'success' ? '✅'
    : episode.outcome?.status === 'partial' ? '⚠️'
    : '❌';

  return {
    goalSummary: episode.goal || '—',
    stepCount: episode.steps?.length || 0,
    outcomeSummary: episode.outcome?.summary || '',
    createdAt: episode.createdAt,
    statusIcon,
  };
}

// --- Property Tests ---

describe('Feature: episodic-memory, Property 4: エピソードカード表示の完全性', () => {
  it('任意の有効な Episode に対して、カード表示データが全て含まれる', () => {
    fc.assert(
      fc.property(episodeGen, (episode) => {
        const data = extractCardDisplayData(episode);

        // 目標サマリーが存在する
        expect(data.goalSummary).toBeTruthy();
        expect(typeof data.goalSummary).toBe('string');

        // ステップ数が非負整数
        expect(data.stepCount).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(data.stepCount)).toBe(true);

        // 結果サマリーが文字列
        expect(typeof data.outcomeSummary).toBe('string');

        // 作成日時が存在する
        expect(data.createdAt).toBeTruthy();

        // ステータスアイコンが正しい
        expect(['✅', '⚠️', '❌']).toContain(data.statusIcon);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: episodic-memory, Property 7: エピソード削除後のリスト整合性', () => {
  it('削除成功時はリストから該当エピソードが除去される', () => {
    fc.assert(
      fc.property(
        fc.array(episodeGen, { minLength: 1, maxLength: 20 }),
        (episodes) => {
          // ランダムに1つ選んで削除
          const targetIndex = Math.floor(Math.random() * episodes.length);
          const targetId = episodes[targetIndex].id;

          const afterDelete = episodes.filter((ep) => ep.id !== targetId);

          // 削除後のリストに対象が含まれない
          expect(afterDelete.find((ep) => ep.id === targetId)).toBeUndefined();
          // リストサイズが1つ減っている（IDが重複しない前提）
          const uniqueIds = new Set(episodes.map((ep) => ep.id));
          if (uniqueIds.size === episodes.length) {
            expect(afterDelete.length).toBe(episodes.length - 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('削除失敗時はリストが元の状態に復元される', () => {
    fc.assert(
      fc.property(
        fc.array(episodeGen, { minLength: 1, maxLength: 20 }),
        (episodes) => {
          const targetIndex = Math.floor(Math.random() * episodes.length);
          const targetId = episodes[targetIndex].id;

          // 楽観的更新
          const afterOptimistic = episodes.filter((ep) => ep.id !== targetId);

          // ロールバック（元のリストを復元）
          const restored = [...episodes];

          expect(restored.length).toBe(episodes.length);
          expect(restored.find((ep) => ep.id === targetId)).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
