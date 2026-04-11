/**
 * Unit tests for CollaboratorDetailPanel component
 *
 * Validates: Requirements 7.2, 7.3, 7.4, 7.5
 *
 * Tests:
 * - Renders collapsed header with agent name, role icon, status, execution time
 * - Expands on click to show token counts and role-specific details
 * - Permission Resolver: shows resolved SID/UID/GID
 * - Retrieval Agent: shows KB ID, filter conditions, citation counts
 * - Access denied warning with reason when accessDenied=true
 * - Collapsible input/output context JSON view
 * - Error display for failed traces
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import CollaboratorDetailPanel from '@/components/chat/CollaboratorDetailPanel';
import type { AgentTeamTraceEvent } from '@/types/multi-agent';

// ===== Fixtures =====

function makeTrace(overrides: Partial<AgentTeamTraceEvent> = {}): AgentTeamTraceEvent {
  return {
    collaboratorAgentId: 'agent-001',
    collaboratorRole: 'analysis',
    collaboratorName: 'Analysis Agent',
    taskDescription: 'Analyze context',
    executionTimeMs: 250,
    startTimeMs: 400,
    inputTokens: 1500,
    outputTokens: 600,
    accessDenied: false,
    status: 'COMPLETED',
    ...overrides,
  };
}

const permissionResolverTrace = makeTrace({
  collaboratorAgentId: 'agent-pr',
  collaboratorRole: 'permission-resolver',
  collaboratorName: 'Permission Resolver',
  executionTimeMs: 120,
  startTimeMs: 0,
  inputTokens: 450,
  outputTokens: 120,
  outputContext: {
    sids: ['S-1-5-21-1234'],
    groupSids: ['S-1-5-21-5678'],
    uid: 1001,
    gid: 1001,
    unixGroups: ['developers', 'staff'],
  },
});

const retrievalTrace = makeTrace({
  collaboratorAgentId: 'agent-ret',
  collaboratorRole: 'retrieval',
  collaboratorName: 'Retrieval Agent',
  executionTimeMs: 280,
  startTimeMs: 120,
  inputTokens: 800,
  outputTokens: 1200,
  kbFiltersApplied: { sid: ['S-1-5-21-1234'], uid: ['1001'] },
  citationsReturned: 3,
  citationsFiltered: 2,
  outputContext: { kbId: 'kb-xxxx-yyyy' },
});

const accessDeniedTrace = makeTrace({
  collaboratorAgentId: 'agent-pr-denied',
  collaboratorRole: 'permission-resolver',
  collaboratorName: 'Permission Resolver',
  accessDenied: true,
  accessDeniedReason: 'User Access Tableにユーザー権限情報が存在しません',
  outputContext: { sids: [], groupSids: [], accessDenied: true },
});

// ===== Helpers =====

function renderComponent(
  trace: AgentTeamTraceEvent,
  defaultCollapsed = true,
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: ReturnType<typeof createRoot>;

  act(() => {
    root = createRoot(container);
    root.render(
      <CollaboratorDetailPanel trace={trace} defaultCollapsed={defaultCollapsed} />,
    );
  });

  return {
    container,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function clickButton(container: HTMLElement, text?: string) {
  const buttons = container.querySelectorAll('button');
  if (text) {
    const btn = Array.from(buttons).find((b) => b.textContent?.includes(text));
    if (btn) act(() => { btn.click(); });
  } else {
    // Click the first button (header toggle)
    if (buttons[0]) act(() => { buttons[0].click(); });
  }
}

// ===== Tests =====

describe('CollaboratorDetailPanel', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('collapsed header', () => {
    it('renders agent name, status, and execution time', () => {
      const { container, cleanup } = renderComponent(makeTrace());
      const text = container.textContent ?? '';

      expect(text).toContain('Analysis Agent');
      expect(text).toContain('完了');
      expect(text).toContain('250ms');

      cleanup();
    });

    it('shows role icon for the collaborator', () => {
      const { container, cleanup } = renderComponent(makeTrace());
      const text = container.textContent ?? '';

      // analysis → 📊
      expect(text).toContain('📊');

      cleanup();
    });

    it('does not show token counts when collapsed', () => {
      const { container, cleanup } = renderComponent(makeTrace());
      const text = container.textContent ?? '';

      expect(text).not.toContain('入力トークン');
      expect(text).not.toContain('出力トークン');

      cleanup();
    });
  });

  describe('expand/collapse', () => {
    it('expands on click to show details', () => {
      const { container, cleanup } = renderComponent(makeTrace());

      clickButton(container);
      const text = container.textContent ?? '';

      expect(text).toContain('入力トークン');
      expect(text).toContain('出力トークン');
      expect(text).toContain('実行時間');

      cleanup();
    });

    it('can start expanded when defaultCollapsed=false', () => {
      const { container, cleanup } = renderComponent(makeTrace(), false);
      const text = container.textContent ?? '';

      expect(text).toContain('入力トークン');

      cleanup();
    });

    it('collapses again on second click', () => {
      const { container, cleanup } = renderComponent(makeTrace());

      clickButton(container);
      expect(container.textContent).toContain('入力トークン');

      clickButton(container);
      expect(container.textContent).not.toContain('入力トークン');

      cleanup();
    });
  });

  describe('token counts', () => {
    it('formats large token counts with K suffix', () => {
      const { container, cleanup } = renderComponent(
        makeTrace({ inputTokens: 1500, outputTokens: 600 }),
        false,
      );
      const text = container.textContent ?? '';

      expect(text).toContain('1.5K');
      expect(text).toContain('600');

      cleanup();
    });

    it('shows dash for undefined token counts', () => {
      const { container, cleanup } = renderComponent(
        makeTrace({ inputTokens: undefined, outputTokens: undefined }),
        false,
      );
      const text = container.textContent ?? '';

      // Should show dashes for undefined tokens
      const dashCount = (text.match(/—/g) || []).length;
      expect(dashCount).toBeGreaterThanOrEqual(2);

      cleanup();
    });
  });

  describe('Permission Resolver details', () => {
    it('shows SID/UID/GID details from outputContext', () => {
      const { container, cleanup } = renderComponent(permissionResolverTrace, false);
      const text = container.textContent ?? '';

      expect(text).toContain('🔑 権限解決結果');
      expect(text).toContain('S-1-5-21-1234');
      expect(text).toContain('S-1-5-21-5678');
      expect(text).toContain('1001');
      expect(text).toContain('developers, staff');

      cleanup();
    });

    it('shows "なし" when SIDs are empty', () => {
      const trace = makeTrace({
        collaboratorRole: 'permission-resolver',
        collaboratorName: 'Permission Resolver',
        outputContext: { sids: [], groupSids: [] },
      });
      const { container, cleanup } = renderComponent(trace, false);
      const text = container.textContent ?? '';

      expect(text).toContain('なし');

      cleanup();
    });
  });

  describe('Retrieval Agent details', () => {
    it('shows KB ID, filter conditions, and citation counts', () => {
      const { container, cleanup } = renderComponent(retrievalTrace, false);
      const text = container.textContent ?? '';

      expect(text).toContain('📚 検索結果詳細');
      expect(text).toContain('kb-xxxx-yyyy');
      expect(text).toContain('3件');
      expect(text).toContain('2件');

      cleanup();
    });

    it('shows filter conditions applied', () => {
      const { container, cleanup } = renderComponent(retrievalTrace, false);
      const text = container.textContent ?? '';

      expect(text).toContain('フィルタ条件');
      expect(text).toContain('sid');
      expect(text).toContain('S-1-5-21-1234');

      cleanup();
    });
  });

  describe('access denied', () => {
    it('shows access denied warning when accessDenied=true', () => {
      const { container, cleanup } = renderComponent(accessDeniedTrace, false);
      const text = container.textContent ?? '';

      expect(text).toContain('アクセス拒否が発生しました');
      expect(text).toContain('User Access Tableにユーザー権限情報が存在しません');

      cleanup();
    });

    it('shows access denied badge in collapsed header', () => {
      const { container, cleanup } = renderComponent(accessDeniedTrace);
      const text = container.textContent ?? '';

      expect(text).toContain('🚫 拒否');

      cleanup();
    });

    it('has alert role on access denied warning', () => {
      const { container, cleanup } = renderComponent(accessDeniedTrace, false);

      const alert = container.querySelector('[role="alert"]');
      expect(alert).not.toBeNull();

      cleanup();
    });

    it('does not show access denied warning when accessDenied=false', () => {
      const { container, cleanup } = renderComponent(makeTrace(), false);
      const text = container.textContent ?? '';

      expect(text).not.toContain('アクセス拒否が発生しました');
      expect(text).not.toContain('🚫 拒否');

      cleanup();
    });
  });

  describe('error display', () => {
    it('shows error message when trace has error', () => {
      const { container, cleanup } = renderComponent(
        makeTrace({ status: 'FAILED', error: 'Lambda timeout' }),
        false,
      );
      const text = container.textContent ?? '';

      expect(text).toContain('Lambda timeout');

      cleanup();
    });
  });

  describe('collapsible JSON context', () => {
    it('shows input/output context toggle buttons', () => {
      const { container, cleanup } = renderComponent(
        makeTrace({
          inputContext: { userId: 'user-001' },
          outputContext: { summary: 'test' },
        }),
        false,
      );
      const text = container.textContent ?? '';

      expect(text).toContain('入力コンテキスト');
      expect(text).toContain('出力コンテキスト');

      cleanup();
    });

    it('expands JSON on click', () => {
      const { container, cleanup } = renderComponent(
        makeTrace({ inputContext: { userId: 'user-001' } }),
        false,
      );

      // Click the input context toggle
      clickButton(container, '入力コンテキスト');
      const text = container.textContent ?? '';

      expect(text).toContain('user-001');

      cleanup();
    });

    it('does not show context toggles when context is empty', () => {
      const { container, cleanup } = renderComponent(
        makeTrace({ inputContext: undefined, outputContext: undefined }),
        false,
      );
      const text = container.textContent ?? '';

      expect(text).not.toContain('入力コンテキスト');
      expect(text).not.toContain('出力コンテキスト');

      cleanup();
    });
  });

  describe('accessibility', () => {
    it('has correct aria-label on the region', () => {
      const { container, cleanup } = renderComponent(makeTrace());

      const region = container.querySelector('[role="region"]');
      expect(region).not.toBeNull();
      expect(region?.getAttribute('aria-label')).toBe('Analysis Agent 詳細パネル');

      cleanup();
    });

    it('has aria-expanded on the toggle button', () => {
      const { container, cleanup } = renderComponent(makeTrace());

      const button = container.querySelector('button');
      expect(button?.getAttribute('aria-expanded')).toBe('false');

      clickButton(container);
      expect(button?.getAttribute('aria-expanded')).toBe('true');

      cleanup();
    });
  });

  describe('role-specific sections', () => {
    it('does not show permission resolver section for analysis role', () => {
      const { container, cleanup } = renderComponent(makeTrace(), false);
      const text = container.textContent ?? '';

      expect(text).not.toContain('🔑 権限解決結果');
      expect(text).not.toContain('📚 検索結果詳細');

      cleanup();
    });

    it('does not show retrieval section for output role', () => {
      const { container, cleanup } = renderComponent(
        makeTrace({ collaboratorRole: 'output', collaboratorName: 'Output Agent' }),
        false,
      );
      const text = container.textContent ?? '';

      expect(text).not.toContain('📚 検索結果詳細');

      cleanup();
    });
  });
});
