import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * Property-Based Test: Agent一覧の完全性 (Property 5)
 *
 * Feature: ui-ux-optimization, Property 5: Agent一覧の完全性
 *
 * 任意のAgentリスト（0件以上）に対して、HeaderAgentSelectorのドロップダウン展開時に
 * 表示されるAgent数はリストの件数と一致し、各AgentのAgent名とステータスが表示されること。
 *
 * **Validates: Requirements 3.4**
 */

import React from 'react';
import * as fc from 'fast-check';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// --- Mocks ---

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      placeholder: 'Select Agent',
      label: 'Agent selector',
      noAgents: 'No agents available',
    };
    return translations[key] ?? key;
  },
}));

import HeaderAgentSelector, {
  AgentListItem,
} from '../../components/chat/HeaderAgentSelector';

// Feature: ui-ux-optimization, Property 5: Agent一覧の完全性
describe('Feature: ui-ux-optimization, Property 5: Agent一覧の完全性', () => {
  afterEach(() => {
    cleanup();
  });

  // Reusable arbitrary for generating printable, non-whitespace agent names/IDs
  const alphanumArb = fc
    .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 20 })
    .map((chars) => chars.join(''));

  const agentArb = fc.record({
    agentId: alphanumArb,
    agentName: alphanumArb,
    status: fc.constantFrom(
      'PREPARED' as const,
      'NOT_PREPARED' as const,
      'FAILED' as const,
    ),
  });

  /** Deduplicate agents by agentId and agentName */
  function dedup(agents: AgentListItem[]): AgentListItem[] {
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    return agents.filter((a) => {
      if (seenIds.has(a.agentId) || seenNames.has(a.agentName)) return false;
      seenIds.add(a.agentId);
      seenNames.add(a.agentName);
      return true;
    });
  }

  it('ドロップダウン展開時の表示Agent数がリスト件数と一致する', () => {
    fc.assert(
      fc.property(
        fc.array(agentArb, { minLength: 0, maxLength: 20 }),
        (agents: AgentListItem[]) => {
          const uniqueAgents = dedup(agents);

          cleanup();
          render(
            React.createElement(HeaderAgentSelector, {
              selectedAgentId: null,
              onAgentChange: vi.fn(),
              agents: uniqueAgents,
              disabled: false,
            }),
          );

          // Click to open dropdown
          const trigger = screen.getByRole('button');
          fireEvent.click(trigger);

          if (uniqueAgents.length === 0) {
            // When no agents, the "no agents" message should be shown
            expect(screen.getByText('No agents available')).toBeInTheDocument();
          } else {
            // Count displayed options
            const options = screen.getAllByRole('option');
            expect(options).toHaveLength(uniqueAgents.length);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('各Agent名がドロップダウン内に表示される', () => {
    fc.assert(
      fc.property(
        fc.array(agentArb, { minLength: 1, maxLength: 10 }),
        (agents: AgentListItem[]) => {
          const uniqueAgents = dedup(agents);
          fc.pre(uniqueAgents.length > 0);

          cleanup();
          render(
            React.createElement(HeaderAgentSelector, {
              selectedAgentId: null,
              onAgentChange: vi.fn(),
              agents: uniqueAgents,
              disabled: false,
            }),
          );

          // Click to open dropdown
          const trigger = screen.getByRole('button');
          fireEvent.click(trigger);

          // Each agent name should be present in the document
          for (const agent of uniqueAgents) {
            expect(screen.getByText(agent.agentName)).toBeInTheDocument();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('各Agentのステータスがドロップダウン内に表示される', () => {
    fc.assert(
      fc.property(
        fc.array(agentArb, { minLength: 1, maxLength: 10 }),
        (agents: AgentListItem[]) => {
          const uniqueAgents = dedup(agents);
          fc.pre(uniqueAgents.length > 0);

          cleanup();
          render(
            React.createElement(HeaderAgentSelector, {
              selectedAgentId: null,
              onAgentChange: vi.fn(),
              agents: uniqueAgents,
              disabled: false,
            }),
          );

          // Click to open dropdown
          const trigger = screen.getByRole('button');
          fireEvent.click(trigger);

          // Each agent's status should be present as an aria-label on the status icon
          for (const agent of uniqueAgents) {
            const statusIcons = screen.getAllByLabelText(agent.status);
            expect(statusIcons.length).toBeGreaterThanOrEqual(1);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
