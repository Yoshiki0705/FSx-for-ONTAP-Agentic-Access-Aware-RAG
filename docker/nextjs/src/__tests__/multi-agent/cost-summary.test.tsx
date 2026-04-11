/**
 * Unit tests for CostSummary component
 *
 * Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5
 *
 * Tests:
 * - Total metrics display (execution time, tokens, cost)
 * - Per-collaborator cost breakdown bars
 * - Single Agent mode comparison display
 * - Supervisor routing overhead display
 * - Collapse/expand behavior
 * - Accessibility attributes
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import CostSummary from '@/components/chat/CostSummary';
import type { MultiAgentTraceResult, AgentTeamTraceEvent } from '@/types/multi-agent';

// ===== Fixtures =====

function makeCollaboratorTrace(
  overrides: Partial<AgentTeamTraceEvent> = {},
): AgentTeamTraceEvent {
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

function makeTrace(overrides: Partial<MultiAgentTraceResult> = {}): MultiAgentTraceResult {
  return {
    traceId: 'trace-001',
    sessionId: 'session-001',
    teamId: 'team-001',
    routingMode: 'supervisor_router',
    routingReason: '単純な事実確認クエリ',
    routingOverheadMs: 45,
    supervisorAgentId: 'supervisor-001',
    collaboratorTraces: [
      makeCollaboratorTrace({
        collaboratorAgentId: 'agent-pr',
        collaboratorRole: 'permission-resolver',
        collaboratorName: 'Perm.Resolver',
        executionTimeMs: 120,
        startTimeMs: 0,
        inputTokens: 450,
        outputTokens: 120,
      }),
      makeCollaboratorTrace({
        collaboratorAgentId: 'agent-ret',
        collaboratorRole: 'retrieval',
        collaboratorName: 'Retrieval',
        executionTimeMs: 280,
        startTimeMs: 120,
        inputTokens: 800,
        outputTokens: 1200,
      }),
      makeCollaboratorTrace({
        collaboratorAgentId: 'agent-ana',
        collaboratorRole: 'analysis',
        collaboratorName: 'Analysis',
        executionTimeMs: 180,
        startTimeMs: 400,
        inputTokens: 1500,
        outputTokens: 600,
      }),
    ],
    totalExecutionTimeMs: 625,
    totalInputTokens: 2750,
    totalOutputTokens: 1920,
    estimatedCostUsd: 0.037,
    ...overrides,
  };
}

// ===== Helpers =====

function renderComponent(
  trace: MultiAgentTraceResult,
  defaultCollapsed = false,
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: ReturnType<typeof createRoot>;

  act(() => {
    root = createRoot(container);
    root.render(<CostSummary trace={trace} defaultCollapsed={defaultCollapsed} />);
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

function clickToggle(container: HTMLElement) {
  const button = container.querySelector('button');
  if (button) act(() => { button.click(); });
}

// ===== Tests =====

describe('CostSummary', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('total metrics display', () => {
    it('shows total execution time', () => {
      const { container, cleanup } = renderComponent(makeTrace());
      const text = container.textContent ?? '';

      expect(text).toContain('625ms');
      expect(text).toContain('合計実行時間');

      cleanup();
    });

    it('shows total input and output tokens', () => {
      const { container, cleanup } = renderComponent(makeTrace());
      const text = container.textContent ?? '';

      expect(text).toContain('2.8K');  // 2750 → 2.8K
      expect(text).toContain('1.9K');  // 1920 → 1.9K
      expect(text).toContain('入力トークン');
      expect(text).toContain('出力トークン');

      cleanup();
    });

    it('shows estimated cost', () => {
      const { container, cleanup } = renderComponent(makeTrace());
      const text = container.textContent ?? '';

      expect(text).toContain('$0.037');
      expect(text).toContain('推定コスト');

      cleanup();
    });

    it('formats execution time in seconds for large values', () => {
      const { container, cleanup } = renderComponent(
        makeTrace({ totalExecutionTimeMs: 2500 }),
      );
      const text = container.textContent ?? '';

      expect(text).toContain('2.5s');

      cleanup();
    });
  });

  describe('per-collaborator cost breakdown', () => {
    it('shows cost breakdown section', () => {
      const { container, cleanup } = renderComponent(makeTrace());
      const text = container.textContent ?? '';

      expect(text).toContain('Per-Collaborator コスト内訳');

      cleanup();
    });

    it('shows each collaborator name in the breakdown', () => {
      const { container, cleanup } = renderComponent(makeTrace());
      const text = container.textContent ?? '';

      expect(text).toContain('Perm.Resolver');
      expect(text).toContain('Retrieval');
      expect(text).toContain('Analysis');

      cleanup();
    });

    it('shows Supervisor as a separate line item', () => {
      const { container, cleanup } = renderComponent(makeTrace());
      const text = container.textContent ?? '';

      expect(text).toContain('Supervisor');

      cleanup();
    });

    it('shows percentage values for each item', () => {
      const { container, cleanup } = renderComponent(makeTrace());
      const text = container.textContent ?? '';

      // Should contain percentage signs
      expect(text).toMatch(/%/);

      cleanup();
    });

    it('does not show breakdown when cost is zero', () => {
      const { container, cleanup } = renderComponent(
        makeTrace({ estimatedCostUsd: 0 }),
      );
      const text = container.textContent ?? '';

      expect(text).not.toContain('Per-Collaborator コスト内訳');

      cleanup();
    });
  });

  describe('supervisor routing overhead', () => {
    it('shows routing overhead when present', () => {
      const { container, cleanup } = renderComponent(makeTrace());
      const text = container.textContent ?? '';

      expect(text).toContain('Supervisorルーティングオーバーヘッド');
      expect(text).toContain('45ms');

      cleanup();
    });

    it('hides routing overhead when zero', () => {
      const { container, cleanup } = renderComponent(
        makeTrace({ routingOverheadMs: 0 }),
      );
      const text = container.textContent ?? '';

      expect(text).not.toContain('Supervisorルーティングオーバーヘッド');

      cleanup();
    });
  });

  describe('single agent mode comparison', () => {
    it('shows single agent estimated cost', () => {
      const { container, cleanup } = renderComponent(makeTrace());
      const text = container.textContent ?? '';

      expect(text).toContain('Single Agentモードでの推定');

      cleanup();
    });

    it('shows cost increase amount and percentage', () => {
      const { container, cleanup } = renderComponent(makeTrace());
      const text = container.textContent ?? '';

      expect(text).toContain('マルチエージェントによる増加');
      expect(text).toContain('+');
      expect(text).toContain('200%');  // ~1/3 heuristic → +200%

      cleanup();
    });
  });

  describe('collapse/expand', () => {
    it('starts expanded by default', () => {
      const { container, cleanup } = renderComponent(makeTrace());
      const text = container.textContent ?? '';

      expect(text).toContain('合計実行時間');
      expect(text).toContain('Per-Collaborator コスト内訳');

      cleanup();
    });

    it('starts collapsed when defaultCollapsed=true', () => {
      const { container, cleanup } = renderComponent(makeTrace(), true);
      const text = container.textContent ?? '';

      expect(text).toContain('コスト推定');
      expect(text).not.toContain('合計実行時間');

      cleanup();
    });

    it('shows header cost even when collapsed', () => {
      const { container, cleanup } = renderComponent(makeTrace(), true);
      const text = container.textContent ?? '';

      expect(text).toContain('$0.037');

      cleanup();
    });

    it('toggles on click', () => {
      const { container, cleanup } = renderComponent(makeTrace(), true);

      expect(container.textContent).not.toContain('合計実行時間');

      clickToggle(container);
      expect(container.textContent).toContain('合計実行時間');

      clickToggle(container);
      expect(container.textContent).not.toContain('合計実行時間');

      cleanup();
    });
  });

  describe('accessibility', () => {
    it('has region role with aria-label', () => {
      const { container, cleanup } = renderComponent(makeTrace());

      const region = container.querySelector('[role="region"]');
      expect(region).not.toBeNull();
      expect(region?.getAttribute('aria-label')).toBe('コストサマリー');

      cleanup();
    });

    it('has aria-expanded on toggle button', () => {
      const { container, cleanup } = renderComponent(makeTrace(), true);

      const button = container.querySelector('button');
      expect(button?.getAttribute('aria-expanded')).toBe('false');

      clickToggle(container);
      expect(button?.getAttribute('aria-expanded')).toBe('true');

      cleanup();
    });

    it('has aria-label on cost breakdown list', () => {
      const { container, cleanup } = renderComponent(makeTrace());

      const list = container.querySelector('[role="list"]');
      expect(list).not.toBeNull();
      expect(list?.getAttribute('aria-label')).toBe('Collaboratorコスト内訳');

      cleanup();
    });

    it('has aria-label on metric cards', () => {
      const { container, cleanup } = renderComponent(makeTrace());

      const cards = container.querySelectorAll('[aria-label*="合計実行時間"]');
      expect(cards.length).toBe(1);

      cleanup();
    });
  });

  describe('edge cases', () => {
    it('handles trace with no collaborators', () => {
      const { container, cleanup } = renderComponent(
        makeTrace({ collaboratorTraces: [], estimatedCostUsd: 0 }),
      );
      const text = container.textContent ?? '';

      expect(text).toContain('コスト推定');
      expect(text).not.toContain('Per-Collaborator コスト内訳');

      cleanup();
    });

    it('handles very small costs', () => {
      const { container, cleanup } = renderComponent(
        makeTrace({ estimatedCostUsd: 0.0005 }),
      );
      const text = container.textContent ?? '';

      expect(text).toContain('<$0.001');

      cleanup();
    });

    it('handles large token counts', () => {
      const { container, cleanup } = renderComponent(
        makeTrace({ totalInputTokens: 1_500_000, totalOutputTokens: 800_000 }),
      );
      const text = container.textContent ?? '';

      expect(text).toContain('1.5M');
      expect(text).toContain('800.0K');

      cleanup();
    });
  });
});
