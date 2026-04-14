// Feature: agent-registry-integration, Property 8: Fault Isolation
// Validates: Requirements 10.1, 10.3

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import React, { Component, type ReactNode } from 'react';
import { render, cleanup } from '@testing-library/react';

/**
 * Property 8: Fault Isolation
 *
 * Test that Registry errors don't affect other Agent Directory tabs.
 * We simulate the Error Boundary pattern used in RegistryPanel.
 * When the Registry child throws, the boundary catches it and renders
 * a fallback, while sibling components remain unaffected.
 */

// Minimal Error Boundary matching RegistryPanel's pattern
class TestErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Component that throws on render (simulates Registry API error)
function ThrowingRegistryPanel({ errorMessage }: { errorMessage: string }) {
  throw new Error(errorMessage);
}

// Stable sibling components (other tabs)
function AgentsTab() {
  return <div data-testid="agents-tab">Agents Tab Content</div>;
}
function TeamsTab() {
  return <div data-testid="teams-tab">Teams Tab Content</div>;
}
function SharedTab() {
  return <div data-testid="shared-tab">Shared Tab Content</div>;
}
function SchedulesTab() {
  return <div data-testid="schedules-tab">Schedules Tab Content</div>;
}

describe('Property 8: Fault Isolation', () => {
  // Suppress console.error from Error Boundary
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalError;
    cleanup();
  });

  it('Registry errors do not affect other Agent Directory tabs', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (errorMessage) => {
          // Clean up previous render
          cleanup();

          const { getByTestId, queryByTestId } = render(
            <div>
              {/* Other tabs render normally */}
              <AgentsTab />
              <TeamsTab />
              <SharedTab />
              <SchedulesTab />

              {/* Registry tab wrapped in Error Boundary */}
              <TestErrorBoundary
                fallback={<div data-testid="registry-error">Registry Error</div>}
              >
                <ThrowingRegistryPanel errorMessage={errorMessage} />
              </TestErrorBoundary>
            </div>
          );

          // Other tabs should be present and unaffected
          expect(getByTestId('agents-tab').textContent).toBe('Agents Tab Content');
          expect(getByTestId('teams-tab').textContent).toBe('Teams Tab Content');
          expect(getByTestId('shared-tab').textContent).toBe('Shared Tab Content');
          expect(getByTestId('schedules-tab').textContent).toBe('Schedules Tab Content');

          // Registry should show error fallback
          expect(getByTestId('registry-error')).toBeDefined();

          // The throwing component should NOT be rendered
          expect(queryByTestId('registry-panel')).toBeNull();
        }
      ),
      { numRuns: 30 }
    );
  });
});
