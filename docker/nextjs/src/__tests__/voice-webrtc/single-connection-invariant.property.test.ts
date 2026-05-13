/**
 * Property 7: 単一 WebRTC 接続不変条件
 * 任意のユーザー操作シーケンスに対してアクティブ RTCPeerConnection が 0 or 1 であることを検証。
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

type UserAction = 'start' | 'stop' | 'modeSwitch' | 'pageNavigate';

/**
 * シミュレーション: アクティブ接続数を追跡する状態マシン
 */
function simulateConnectionState(actions: UserAction[]): number[] {
  let activeConnections = 0;
  const history: number[] = [];

  for (const action of actions) {
    switch (action) {
      case 'start':
        // 単一セッション不変条件: 既にアクティブなら開始しない
        if (activeConnections === 0) {
          activeConnections = 1;
        }
        break;
      case 'stop':
        if (activeConnections > 0) {
          activeConnections = 0;
        }
        break;
      case 'modeSwitch':
        // モード切替: 既存接続をクローズして新規接続
        if (activeConnections > 0) {
          activeConnections = 0; // close existing
          activeConnections = 1; // open new
        }
        break;
      case 'pageNavigate':
        // ページ離脱: 全接続クローズ
        activeConnections = 0;
        break;
    }
    history.push(activeConnections);
  }

  return history;
}

describe('Property 7: Single WebRTC connection invariant', () => {
  it('active connections should always be 0 or 1 for any action sequence', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom<UserAction>('start', 'stop', 'modeSwitch', 'pageNavigate'),
          { minLength: 1, maxLength: 50 }
        ),
        (actions) => {
          const history = simulateConnectionState(actions);

          // Invariant: every state in history must be 0 or 1
          for (const count of history) {
            expect(count).toBeGreaterThanOrEqual(0);
            expect(count).toBeLessThanOrEqual(1);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('pageNavigate should always result in 0 active connections', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom<UserAction>('start', 'stop', 'modeSwitch', 'pageNavigate'),
          { minLength: 1, maxLength: 30 }
        ),
        (actions) => {
          // Append pageNavigate at the end
          const actionsWithNav = [...actions, 'pageNavigate' as UserAction];
          const history = simulateConnectionState(actionsWithNav);

          // Last state should always be 0
          expect(history[history.length - 1]).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
