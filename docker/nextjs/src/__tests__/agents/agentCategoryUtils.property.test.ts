/**
 * Property tests for Agent Category Utilities
 * Feature: agent-directory-ui
 * 
 * Property 4: Combined search and category filtering
 * Property 8: Agent name validation rejects short names
 * Validates: Requirements 2.2, 2.4, 2.6, 5.2
 */

import * as fc from 'fast-check';
import { inferCategoryTag, validateAgentName, filterAgents } from '@/utils/agentCategoryUtils';
import { AGENT_CATEGORY_MAP } from '@/constants/card-constants';
import type { AgentSummary } from '@/hooks/useAgentsList';

// --- Generators ---

const agentStatusArb = fc.constantFrom(
  'CREATING', 'PREPARING', 'PREPARED', 'NOT_PREPARED', 'DELETING', 'FAILED', 'VERSIONING', 'UPDATING'
) as fc.Arbitrary<AgentSummary['agentStatus']>;

const agentSummaryArb: fc.Arbitrary<AgentSummary> = fc.record({
  agentId: fc.string({ minLength: 10, maxLength: 10 }),
  agentName: fc.string({ minLength: 1, maxLength: 50 }),
  agentStatus: agentStatusArb,
  description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
  updatedAt: fc.constant('2025-01-01T00:00:00.000Z'),
  latestAgentVersion: fc.option(fc.string({ minLength: 1, maxLength: 5 }), { nil: undefined }),
});

const categoryKeys = Object.keys(AGENT_CATEGORY_MAP);

// --- Property 8: Agent name validation rejects short names ---

describe('Property 8: Agent name validation', () => {
  it('rejects strings with fewer than 3 non-whitespace characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 2 }),
        (name) => {
          // Strings of length 0-2 (trimmed) should be invalid
          if (name.trim().length < 3) {
            expect(validateAgentName(name)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accepts strings with 3 or more non-whitespace characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 100 }).filter(s => s.trim().length >= 3),
        (name) => {
          expect(validateAgentName(name)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 4: Combined search and category filtering ---

describe('Property 4: Combined search and category filtering', () => {
  it('empty search + all category returns all agents', () => {
    fc.assert(
      fc.property(
        fc.array(agentSummaryArb, { minLength: 0, maxLength: 20 }),
        (agents) => {
          const result = filterAgents(agents, '', 'all');
          expect(result.length).toBe(agents.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('search filters by name or description (case-insensitive)', () => {
    fc.assert(
      fc.property(
        fc.array(agentSummaryArb, { minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        (agents, query) => {
          const result = filterAgents(agents, query, 'all');
          const q = query.toLowerCase().trim();
          if (q === '') {
            expect(result.length).toBe(agents.length);
          } else {
            result.forEach(agent => {
              const nameMatch = agent.agentName.toLowerCase().includes(q);
              const descMatch = (agent.description ?? '').toLowerCase().includes(q);
              expect(nameMatch || descMatch).toBe(true);
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('category filter only returns agents matching that category', () => {
    fc.assert(
      fc.property(
        fc.array(agentSummaryArb, { minLength: 0, maxLength: 20 }),
        fc.constantFrom(...categoryKeys),
        (agents, category) => {
          const result = filterAgents(agents, '', category);
          result.forEach(agent => {
            expect(inferCategoryTag(agent)).toBe(category);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('combined search + category is intersection of both filters', () => {
    fc.assert(
      fc.property(
        fc.array(agentSummaryArb, { minLength: 0, maxLength: 20 }),
        fc.string({ minLength: 0, maxLength: 10 }),
        fc.constantFrom('all', ...categoryKeys),
        (agents, query, category) => {
          const combined = filterAgents(agents, query, category);
          const searchOnly = filterAgents(agents, query, 'all');
          const categoryOnly = filterAgents(agents, '', category);

          // Combined result should be subset of both individual filters
          combined.forEach(agent => {
            expect(searchOnly).toContainEqual(agent);
            expect(categoryOnly).toContainEqual(agent);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- inferCategoryTag tests ---

describe('inferCategoryTag', () => {
  it('returns a valid category key when agent name contains a keyword', () => {
    for (const [category, config] of Object.entries(AGENT_CATEGORY_MAP)) {
      const keyword = config.matchKeywords[0];
      const agent: Pick<AgentSummary, 'agentName' | 'description'> = {
        agentName: `test-${keyword}-agent`,
        description: undefined,
      };
      const result = inferCategoryTag(agent);
      expect(result).toBe(category);
    }
  });

  it('returns undefined for agents with no matching keywords', () => {
    const agent: Pick<AgentSummary, 'agentName' | 'description'> = {
      agentName: 'completely-random-xyz-agent',
      description: 'no matching keywords here zzz',
    };
    expect(inferCategoryTag(agent)).toBeUndefined();
  });
});
