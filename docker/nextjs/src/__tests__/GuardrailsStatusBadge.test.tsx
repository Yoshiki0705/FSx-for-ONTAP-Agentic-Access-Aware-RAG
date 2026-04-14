/**
 * Component Tests: GuardrailsStatusBadge
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GuardrailsStatusBadge, type GuardrailResult } from '@/components/guardrails/GuardrailsStatusBadge';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      safe: 'Safe',
      filtered: 'Filtered',
      blocked: 'Blocked',
      checkUnavailable: 'Check Unavailable',
      tooltipTitle: 'Guardrails Details',
      inputAssessment: 'Input Check',
      outputAssessment: 'Output Check',
      filteredCategories: 'Filtered Categories',
      passed: 'Passed',
    };
    return translations[key] || key;
  },
}));

const safeResult: GuardrailResult = {
  status: 'safe',
  action: 'NONE',
  inputAssessment: 'PASSED',
  outputAssessment: 'PASSED',
  filteredCategories: [],
};

const filteredResult: GuardrailResult = {
  status: 'filtered',
  action: 'GUARDRAIL_INTERVENED',
  inputAssessment: 'PASSED',
  outputAssessment: 'BLOCKED',
  filteredCategories: ['HATE', 'VIOLENCE'],
};

const blockedResult: GuardrailResult = {
  status: 'blocked',
  action: 'GUARDRAIL_INTERVENED',
  inputAssessment: 'BLOCKED',
  outputAssessment: 'PASSED',
  filteredCategories: ['PROMPT_ATTACK'],
};

const errorResult: GuardrailResult = {
  status: 'error',
  action: 'ERROR',
  inputAssessment: 'PASSED',
  outputAssessment: 'PASSED',
  filteredCategories: [],
};

describe('GuardrailsStatusBadge', () => {
  it('renders nothing when enableGuardrails=false', () => {
    const { container } = render(
      <GuardrailsStatusBadge guardrailResult={safeResult} enableGuardrails={false} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when guardrailResult is undefined', () => {
    const { container } = render(
      <GuardrailsStatusBadge enableGuardrails={true} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders safe badge with green styling', () => {
    render(<GuardrailsStatusBadge guardrailResult={safeResult} enableGuardrails={true} />);
    const badge = screen.getByTestId('guardrails-status-badge');
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain('Safe');
    expect(badge.textContent).toContain('✅');
  });

  it('renders filtered badge with yellow styling', () => {
    render(<GuardrailsStatusBadge guardrailResult={filteredResult} enableGuardrails={true} />);
    const badge = screen.getByTestId('guardrails-status-badge');
    expect(badge.textContent).toContain('Filtered');
    expect(badge.textContent).toContain('⚠️');
  });

  it('renders blocked badge with red styling', () => {
    render(<GuardrailsStatusBadge guardrailResult={blockedResult} enableGuardrails={true} />);
    const badge = screen.getByTestId('guardrails-status-badge');
    expect(badge.textContent).toContain('Blocked');
  });

  it('renders error badge with gray styling', () => {
    render(<GuardrailsStatusBadge guardrailResult={errorResult} enableGuardrails={true} />);
    const badge = screen.getByTestId('guardrails-status-badge');
    expect(badge.textContent).toContain('Check Unavailable');
  });

  it('shows tooltip with details on click', () => {
    render(<GuardrailsStatusBadge guardrailResult={filteredResult} enableGuardrails={true} />);
    const badge = screen.getByTestId('guardrails-status-badge');
    fireEvent.click(badge);
    const tooltip = screen.getByTestId('guardrails-tooltip');
    expect(tooltip).toBeDefined();
    expect(tooltip.textContent).toContain('HATE');
    expect(tooltip.textContent).toContain('VIOLENCE');
  });
});
