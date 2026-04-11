/**
 * Unit tests for MultiAgentExecutionStatus component
 *
 * Validates: Requirements 7.1, 7.6, 15.1
 *
 * Tests:
 * - Renders with correct ARIA attributes (role="status", aria-live="polite")
 * - Displays current phase indicator
 * - Shows collaborator list with correct status icons
 * - Applies animate-pulse to running collaborators
 * - Displays elapsed time and estimated cost in footer
 * - Formats time values correctly (ms vs seconds)
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import MultiAgentExecutionStatus from '@/components/chat/MultiAgentExecutionStatus';
import type { MultiAgentExecutionStatus as ExecutionStatusType } from '@/types/multi-agent';

function createStatus(
  overrides: Partial<ExecutionStatusType> = {},
): ExecutionStatusType {
  return {
    isExecuting: true,
    currentPhase: 'executing',
    collaboratorStatuses: new Map([
      [
        'perm-1',
        {
          role: 'permission-resolver' as const,
          name: 'Permission Resolver',
          status: 'completed' as const,
          elapsedMs: 120,
        },
      ],
      [
        'ret-1',
        {
          role: 'retrieval' as const,
          name: 'Retrieval Agent',
          status: 'running' as const,
          elapsedMs: 350,
        },
      ],
      [
        'ana-1',
        {
          role: 'analysis' as const,
          name: 'Analysis Agent',
          status: 'pending' as const,
          elapsedMs: 0,
        },
      ],
    ]),
    elapsedMs: 1200,
    estimatedCostUsd: 0.08,
    ...overrides,
  };
}

function renderComponent(status: ExecutionStatusType) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: ReturnType<typeof createRoot>;

  act(() => {
    root = createRoot(container);
    root.render(<MultiAgentExecutionStatus status={status} />);
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

describe('MultiAgentExecutionStatus', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.useRealTimers();
  });

  describe('accessibility', () => {
    it('renders with role="status" and aria-live="polite"', () => {
      const { container, cleanup } = renderComponent(createStatus());

      const statusEl = container.querySelector('[role="status"]');
      expect(statusEl).not.toBeNull();
      expect(statusEl?.getAttribute('aria-live')).toBe('polite');
      expect(statusEl?.getAttribute('aria-label')).toBe(
        'マルチエージェント実行ステータス',
      );

      cleanup();
    });
  });

  describe('phase indicator', () => {
    it('displays routing phase label', () => {
      const { container, cleanup } = renderComponent(
        createStatus({ currentPhase: 'routing' }),
      );

      expect(container.textContent).toContain('Supervisor: タスク分解中...');
      cleanup();
    });

    it('displays executing phase label', () => {
      const { container, cleanup } = renderComponent(
        createStatus({ currentPhase: 'executing' }),
      );

      expect(container.textContent).toContain(
        'Supervisor: Collaborator実行中...',
      );
      cleanup();
    });

    it('displays completed phase label', () => {
      const { container, cleanup } = renderComponent(
        createStatus({ currentPhase: 'completed', isExecuting: false }),
      );

      expect(container.textContent).toContain('Supervisor: 完了');
      cleanup();
    });

    it('displays error phase label', () => {
      const { container, cleanup } = renderComponent(
        createStatus({ currentPhase: 'error', isExecuting: false }),
      );

      expect(container.textContent).toContain('Supervisor: エラー');
      cleanup();
    });
  });

  describe('collaborator list', () => {
    it('renders all collaborators', () => {
      const { container, cleanup } = renderComponent(createStatus());

      const items = container.querySelectorAll('li');
      expect(items.length).toBe(3);

      cleanup();
    });

    it('shows correct status icons for each state', () => {
      const { container, cleanup } = renderComponent(createStatus());
      const text = container.textContent ?? '';

      // completed → ✅
      expect(text).toContain('✅');
      // running → ⏳
      expect(text).toContain('⏳');
      // pending → ○
      expect(text).toContain('○');

      cleanup();
    });

    it('shows collaborator names', () => {
      const { container, cleanup } = renderComponent(createStatus());
      const text = container.textContent ?? '';

      expect(text).toContain('Permission Resolver');
      expect(text).toContain('Retrieval Agent');
      expect(text).toContain('Analysis Agent');

      cleanup();
    });

    it('shows elapsed time for non-pending collaborators', () => {
      const { container, cleanup } = renderComponent(createStatus());
      const text = container.textContent ?? '';

      expect(text).toContain('120ms');
      expect(text).toContain('350ms');
      // pending shows ---
      expect(text).toContain('---');

      cleanup();
    });

    it('applies animate-pulse class to running collaborators', () => {
      const { container, cleanup } = renderComponent(createStatus());

      const items = container.querySelectorAll('li');
      // items[1] is the running collaborator (Retrieval Agent)
      expect(items[1].className).toContain('animate-pulse');
      // items[0] (completed) and items[2] (pending) should NOT have animate-pulse
      expect(items[0].className).not.toContain('animate-pulse');
      expect(items[2].className).not.toContain('animate-pulse');

      cleanup();
    });

    it('shows failed and skipped status icons', () => {
      const status = createStatus({
        collaboratorStatuses: new Map([
          [
            'fail-1',
            {
              role: 'analysis' as const,
              name: 'Failed Agent',
              status: 'failed' as const,
              elapsedMs: 500,
            },
          ],
          [
            'skip-1',
            {
              role: 'output' as const,
              name: 'Skipped Agent',
              status: 'skipped' as const,
              elapsedMs: 0,
            },
          ],
        ]),
      });

      const { container, cleanup } = renderComponent(status);
      const text = container.textContent ?? '';

      expect(text).toContain('❌');
      expect(text).toContain('⏭️');

      cleanup();
    });
  });

  describe('footer', () => {
    it('displays total elapsed time', () => {
      const { container, cleanup } = renderComponent(createStatus());
      const text = container.textContent ?? '';

      expect(text).toContain('経過時間:');
      expect(text).toContain('1.2s');

      cleanup();
    });

    it('displays estimated cost', () => {
      const { container, cleanup } = renderComponent(createStatus());
      const text = container.textContent ?? '';

      expect(text).toContain('推定コスト:');
      expect(text).toContain('~$0.08');

      cleanup();
    });

    it('formats small costs with 4 decimal places', () => {
      const { container, cleanup } = renderComponent(
        createStatus({ estimatedCostUsd: 0.0037 }),
      );
      const text = container.textContent ?? '';

      expect(text).toContain('~$0.0037');

      cleanup();
    });

    it('formats sub-second elapsed time in ms', () => {
      const { container, cleanup } = renderComponent(
        createStatus({ elapsedMs: 450 }),
      );
      const text = container.textContent ?? '';

      expect(text).toContain('450ms');

      cleanup();
    });
  });

  describe('role icons', () => {
    it('shows role-specific icons for collaborators', () => {
      const { container, cleanup } = renderComponent(createStatus());
      const text = container.textContent ?? '';

      // permission-resolver → 🔒
      expect(text).toContain('🔒');
      // retrieval → 📚
      expect(text).toContain('📚');
      // analysis → 📊
      expect(text).toContain('📊');

      cleanup();
    });
  });
});
