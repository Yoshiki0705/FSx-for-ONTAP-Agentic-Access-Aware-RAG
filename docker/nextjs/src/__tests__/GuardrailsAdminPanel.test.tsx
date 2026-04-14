/**
 * Component Tests: GuardrailsAdminPanel
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GuardrailsAdminPanel } from '@/components/guardrails/GuardrailsAdminPanel';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      title: 'Guardrails',
      enabled: 'Enabled',
      disabled: 'Disabled',
      guardrailId: 'Guardrail ID',
      accountGuardrails: 'Account Guardrails',
      orgGuardrails: 'Org Guardrails',
      orgEnabled: 'Org Guardrails: Enabled',
      orgNotConfigured: 'Org Guardrails: Not Configured',
      orgUnavailable: 'Org Guardrails: Unavailable',
      contentFilters: 'Content Filters',
      piiDetection: 'PII Detection',
    };
    return translations[key] || key;
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('GuardrailsAdminPanel', () => {
  it('renders nothing when enableGuardrails=false', () => {
    const { container } = render(
      <GuardrailsAdminPanel enableGuardrails={false} isAdmin={true} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when isAdmin=false', () => {
    const { container } = render(
      <GuardrailsAdminPanel enableGuardrails={true} isAdmin={false} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders panel when enableGuardrails=true and isAdmin=true', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        enabled: true,
        guardrailId: 'gr-test-123',
        standaloneGuardrails: [],
        organizationalSafeguards: [],
        orgStatus: 'not_configured',
      }),
    });

    render(<GuardrailsAdminPanel enableGuardrails={true} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('guardrails-admin-panel')).toBeDefined();
    });
  });

  it('shows error message when API fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<GuardrailsAdminPanel enableGuardrails={true} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('guardrails-error')).toBeDefined();
    });
  });

  it('displays org safeguards status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        enabled: true,
        guardrailId: 'gr-test-456',
        standaloneGuardrails: [],
        organizationalSafeguards: [
          { guardrailId: 'org-gr-1', name: 'OrgPolicy', guardrailArn: 'arn:aws:bedrock:us-east-1:123:organizational-guardrail/org-gr-1' },
        ],
        orgStatus: 'enabled',
      }),
    });

    render(<GuardrailsAdminPanel enableGuardrails={true} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('org-guardrails-section')).toBeDefined();
    });
  });

  it('is read-only (no edit buttons or inputs)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        enabled: true,
        guardrailId: 'gr-test',
        standaloneGuardrails: [],
        organizationalSafeguards: [],
        orgStatus: 'not_configured',
      }),
    });

    render(<GuardrailsAdminPanel enableGuardrails={true} isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('guardrails-admin-panel')).toBeDefined();
    });

    // No input elements, no edit buttons
    const panel = screen.getByTestId('guardrails-admin-panel');
    expect(panel.querySelectorAll('input').length).toBe(0);
    expect(panel.querySelectorAll('textarea').length).toBe(0);
  });
});
