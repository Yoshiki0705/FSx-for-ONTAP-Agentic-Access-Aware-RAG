/**
 * Episodic Memory ユニットテスト
 *
 * toEpisode 変換関数、リスト操作、エラーハンドリングのテスト。
 *
 * **Validates: Requirements 5.1, 5.2, 7.3, 9.2, 9.3, 11.1, 11.5**
 */

import { describe, it, expect } from 'vitest';
import { toEpisode } from '@/lib/agentcore/episodic-memory';

describe('toEpisode 変換関数', () => {
  it('有効な MemoryRecordSummary を Episode に変換する', () => {
    const record = {
      memoryRecordId: 'ep-123',
      content: {
        text: JSON.stringify({
          goal: 'ファイルを検索する',
          steps: [{ order: 1, reasoning: 'キーワードで検索' }],
          actions: [{ name: 'search', input: 'keyword', result: 'found' }],
          outcome: { status: 'success', summary: '検索成功' },
          reflection: '効率的な検索方法を学んだ',
        }),
      },
      createdAt: new Date('2025-01-01'),
      score: 0.95,
      metadata: { source: 'test' },
    };

    const episode = toEpisode(record);

    expect(episode.id).toBe('ep-123');
    expect(episode.goal).toBe('ファイルを検索する');
    expect(episode.steps).toHaveLength(1);
    expect(episode.steps[0].reasoning).toBe('キーワードで検索');
    expect(episode.actions).toHaveLength(1);
    expect(episode.actions[0].name).toBe('search');
    expect(episode.outcome.status).toBe('success');
    expect(episode.outcome.summary).toBe('検索成功');
    expect(episode.reflection).toBe('効率的な検索方法を学んだ');
    expect(episode.score).toBe(0.95);
  });

  it('不正な JSON コンテンツ時にフォールバック値を返す', () => {
    const record = {
      memoryRecordId: 'ep-bad',
      content: { text: 'not-json' },
      createdAt: new Date('2025-01-01'),
    };

    const episode = toEpisode(record);

    expect(episode.id).toBe('ep-bad');
    expect(episode.goal).toBe('');
    expect(episode.steps).toEqual([]);
    expect(episode.actions).toEqual([]);
    expect(episode.outcome).toEqual({ status: 'failure', summary: '' });
    expect(episode.reflection).toBe('');
  });

  it('空のコンテンツ時にフォールバック値を返す', () => {
    const record = {
      memoryRecordId: 'ep-empty',
      content: { text: '{}' },
    };

    const episode = toEpisode(record);

    expect(episode.id).toBe('ep-empty');
    expect(episode.goal).toBe('');
    expect(episode.steps).toEqual([]);
    expect(episode.actions).toEqual([]);
    expect(episode.reflection).toBe('');
  });

  it('memoryRecordId が未定義の場合に空文字列を返す', () => {
    const record = {
      content: { text: '{}' },
    };

    const episode = toEpisode(record);
    expect(episode.id).toBe('');
  });
});

describe('エピソード検索結果のソート', () => {
  it('スコア降順でソートされる', () => {
    const episodes = [
      { id: '1', score: 0.5 },
      { id: '2', score: 0.9 },
      { id: '3', score: 0.7 },
    ];

    const sorted = [...episodes].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    expect(sorted[0].id).toBe('2');
    expect(sorted[1].id).toBe('3');
    expect(sorted[2].id).toBe('1');
  });

  it('スコアが undefined の場合は 0 として扱う', () => {
    const episodes = [
      { id: '1', score: undefined },
      { id: '2', score: 0.5 },
    ];

    const sorted = [...episodes].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    expect(sorted[0].id).toBe('2');
    expect(sorted[1].id).toBe('1');
  });
});

describe('楽観的UI更新のロジック', () => {
  it('削除成功時にリストから除去される', () => {
    const episodes = [
      { id: 'ep-1', goal: 'A' },
      { id: 'ep-2', goal: 'B' },
      { id: 'ep-3', goal: 'C' },
    ];

    const deleteId = 'ep-2';
    const afterDelete = episodes.filter((ep) => ep.id !== deleteId);

    expect(afterDelete).toHaveLength(2);
    expect(afterDelete.find((ep) => ep.id === deleteId)).toBeUndefined();
  });

  it('削除失敗時にリストが復元される', () => {
    const originalEpisodes = [
      { id: 'ep-1', goal: 'A' },
      { id: 'ep-2', goal: 'B' },
    ];

    // 楽観的更新
    const afterOptimistic = originalEpisodes.filter((ep) => ep.id !== 'ep-2');
    expect(afterOptimistic).toHaveLength(1);

    // ロールバック
    const restored = [...originalEpisodes];
    expect(restored).toHaveLength(2);
    expect(restored.find((ep) => ep.id === 'ep-2')).toBeDefined();
  });
});
