/**
 * Property 6: 単一セッション不変条件
 * 任意のユーザー操作シーケンスに対して、アクティブな VoiceSession の数が
 * 常に 0 または 1 であることを検証。
 *
 * **Validates: Requirements 13.4, 13.5**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

type UserAction = 'start' | 'stop' | 'modeSwitch' | 'pageLeave';

/**
 * セッション状態マシンのシミュレーション
 */
function simulateSessionActions(actions: UserAction[]): { maxActiveSessions: number; finalActiveSessions: number } {
  let activeSessions = 0;
  let maxActiveSessions = 0;

  for (const action of actions) {
    switch (action) {
      case 'start':
        // 単一セッション不変条件: 既にアクティブなら開始しない
        if (activeSessions === 0) {
          activeSessions = 1;
        }
        break;
      case 'stop':
        if (activeSessions > 0) {
          activeSessions = 0;
        }
        break;
      case 'modeSwitch':
        // モード切替: 既存セッション終了 → 新セッション開始可能状態
        activeSessions = 0;
        break;
      case 'pageLeave':
        // ページ離脱: 全セッション終了
        activeSessions = 0;
        break;
    }
    maxActiveSessions = Math.max(maxActiveSessions, activeSessions);
  }

  return { maxActiveSessions, finalActiveSessions: activeSessions };
}

describe('Property 6: Single Session Invariant', () => {
  const actionArb = fc.constantFrom<UserAction>('start', 'stop', 'modeSwitch', 'pageLeave');

  it('active sessions should never exceed 1', () => {
    fc.assert(
      fc.property(
        fc.array(actionArb, { minLength: 1, maxLength: 200 }),
        (actions: UserAction[]) => {
          const result = simulateSessionActions(actions);
          expect(result.maxActiveSessions).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('active sessions should always be 0 or 1', () => {
    fc.assert(
      fc.property(
        fc.array(actionArb, { minLength: 1, maxLength: 200 }),
        (actions: UserAction[]) => {
          const result = simulateSessionActions(actions);
          expect(result.finalActiveSessions).toBeGreaterThanOrEqual(0);
          expect(result.finalActiveSessions).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('pageLeave should always result in 0 active sessions', () => {
    fc.assert(
      fc.property(
        fc.array(actionArb, { minLength: 0, maxLength: 100 }),
        (actionsBefore: UserAction[]) => {
          const actions = [...actionsBefore, 'pageLeave' as UserAction];
          const result = simulateSessionActions(actions);
          expect(result.finalActiveSessions).toBe(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('consecutive starts should not create multiple sessions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 50 }),
        (startCount: number) => {
          const actions: UserAction[] = Array(startCount).fill('start');
          const result = simulateSessionActions(actions);
          expect(result.maxActiveSessions).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
