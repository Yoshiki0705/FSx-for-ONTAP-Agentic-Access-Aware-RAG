/**
 * Integration Test: ヘッダー統合テスト
 *
 * UnifiedModeToggle + HeaderAgentSelector + ModelIndicator を組み合わせて
 * ヘッダー全体のモード切替フローを検証する。
 *
 * Scenario 1: Full mode switch cycle — KB → Single Agent → Multi Agent → KB
 *   各モードで正しいコンポーネントがレンダリングされることを検証
 *
 * Scenario 2: Mode switch → model fallback → toast notification flow
 *   モード切替時にモデルが利用不可の場合、フォールバック＋トースト通知が発生することを検証
 *
 * Requirements: 1.1, 1.2, 1.3, 5.5, 6.1, 6.2
 */

import React, { useState, useCallback, useEffect } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// --- Mocks ---

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string>) => {
    const translations: Record<string, string> = {
      // UnifiedModeToggle
      kb: 'KB',
      singleAgent: 'Single Agent',
      multiAgent: 'Multi Agent',
      label: 'Chat mode',
      // HeaderAgentSelector
      placeholder: 'Select Agent',
      noAgents: 'No agents',
      // ModelIndicator
      fallbackNotice: `Model changed: ${params?.previous ?? ''} → ${params?.current ?? ''}`,
    };
    return translations[key] ?? key;
  },
}));

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/genai',
}));

const mockSetChatMode = jest.fn();
jest.mock('@/store/useHeaderStore', () => ({
  useHeaderStore: (selector: (s: any) => any) =>
    selector({ setChatMode: mockSetChatMode }),
}));

import UnifiedModeToggle from '../../components/chat/UnifiedModeToggle';
import type { UnifiedModeToggleProps } from '../../components/chat/UnifiedModeToggle';
import HeaderAgentSelector from '../../components/chat/HeaderAgentSelector';
import type { AgentListItem } from '../../components/chat/HeaderAgentSelector';
import ModelIndicator from '../../components/bedrock/ModelIndicator';
import type { ChatMode } from '../../utils/modelCompatibility';

// --- Test Harness ---

/** Shared model lists for KB and Agent modes */
const KB_MODELS = [
  { modelId: 'anthropic.claude-3-sonnet', modelName: 'Claude 3 Sonnet' },
  { modelId: 'anthropic.claude-3-haiku', modelName: 'Claude 3 Haiku' },
  { modelId: 'amazon.nova-pro', modelName: 'Amazon Nova Pro' },
];

const AGENT_MODELS = [
  { modelId: 'anthropic.claude-3-sonnet', modelName: 'Claude 3 Sonnet' },
  { modelId: 'amazon.nova-pro', modelName: 'Amazon Nova Pro' },
];

const AGENTS: AgentListItem[] = [
  { agentId: 'agent-1', agentName: 'Research Agent', status: 'PREPARED' },
  { agentId: 'agent-2', agentName: 'Code Agent', status: 'NOT_PREPARED' },
];

/**
 * HeaderIntegrationHarness renders the three header components together,
 * wiring up shared state so mode switches propagate correctly.
 */
function HeaderIntegrationHarness({
  initialMode = 'kb',
  initialModelId = 'anthropic.claude-3-sonnet',
  multiAgentAvailable = true,
}: {
  initialMode?: ChatMode;
  initialModelId?: string;
  multiAgentAvailable?: boolean;
}) {
  const [mode, setMode] = useState<ChatMode>(initialMode);
  const [selectedModelId, setSelectedModelId] = useState(initialModelId);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>('agent-1');

  const isAgentMode = mode === 'single-agent' || mode === 'multi-agent';
  const currentModels = isAgentMode ? AGENT_MODELS : KB_MODELS;
  const currentModelName =
    currentModels.find((m) => m.modelId === selectedModelId)?.modelName ??
    selectedModelId;

  const handleModeChange = useCallback((newMode: ChatMode) => {
    setMode(newMode);
  }, []);

  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModelId(modelId);
  }, []);

  return (
    <div data-testid="header-harness" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Left group */}
      <div data-testid="left-group" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        <UnifiedModeToggle
          mode={mode}
          onModeChange={handleModeChange}
          multiAgentAvailable={multiAgentAvailable}
        />
        {isAgentMode && (
          <HeaderAgentSelector
            selectedAgentId={selectedAgentId}
            onAgentChange={setSelectedAgentId}
            agents={AGENTS}
          />
        )}
      </div>

      {/* Right group */}
      <div data-testid="right-group" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <ModelIndicator
          selectedModelId={selectedModelId}
          selectedModelName={currentModelName}
          onModelChange={handleModelChange}
          mode={isAgentMode ? 'agent' : 'kb'}
          models={currentModels}
        />
      </div>

      {/* Current mode indicator for test assertions */}
      <span data-testid="current-mode">{mode}</span>
    </div>
  );
}

// --- Tests ---

describe('Header Integration: Full mode switch cycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Validates: Requirements 1.1, 1.2, 6.1, 6.2
  it('KB → Single Agent → Multi Agent → KB renders correctly at each step', () => {
    render(<HeaderIntegrationHarness initialMode="kb" multiAgentAvailable={true} />);

    // --- Step 1: KB mode ---
    expect(screen.getByTestId('current-mode')).toHaveTextContent('kb');
    // Agent selector should NOT be visible in KB mode
    expect(screen.queryByRole('button', { name: /Select Agent/i })).not.toBeInTheDocument();
    // Mode toggle radiogroup is present
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    // KB radio is checked
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('aria-checked', 'true'); // KB

    // --- Step 2: Switch to Single Agent ---
    fireEvent.click(radios[1]); // Single Agent button
    expect(screen.getByTestId('current-mode')).toHaveTextContent('single-agent');
    // Agent selector should now be visible (shows selected agent name "Research Agent")
    expect(screen.getByText('Research Agent')).toBeInTheDocument();
    // Single Agent radio is checked
    const radiosAfterSingle = screen.getAllByRole('radio');
    expect(radiosAfterSingle[1]).toHaveAttribute('aria-checked', 'true');

    // --- Step 3: Switch to Multi Agent ---
    fireEvent.click(radiosAfterSingle[2]); // Multi Agent button
    expect(screen.getByTestId('current-mode')).toHaveTextContent('multi-agent');
    // Agent selector still visible in multi-agent mode
    expect(screen.getByText('Research Agent')).toBeInTheDocument();
    // Multi Agent radio is checked
    const radiosAfterMulti = screen.getAllByRole('radio');
    expect(radiosAfterMulti[2]).toHaveAttribute('aria-checked', 'true');

    // --- Step 4: Switch back to KB ---
    fireEvent.click(radiosAfterMulti[0]); // KB button
    expect(screen.getByTestId('current-mode')).toHaveTextContent('kb');
    // Agent selector should be hidden again in KB mode
    expect(screen.queryByText('Research Agent')).not.toBeInTheDocument();
    // KB radio is checked
    const radiosAfterKb = screen.getAllByRole('radio');
    expect(radiosAfterKb[0]).toHaveAttribute('aria-checked', 'true');
  });

  // Validates: Requirement 1.3
  it('URL query params are updated on each mode switch', () => {
    render(<HeaderIntegrationHarness initialMode="kb" />);

    const radios = screen.getAllByRole('radio');

    // KB → Single Agent
    fireEvent.click(radios[1]);
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('mode=agent'),
      expect.anything(),
    );

    mockReplace.mockClear();

    // Single Agent → Multi Agent
    const radios2 = screen.getAllByRole('radio');
    fireEvent.click(radios2[2]);
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('mode=multi-agent'),
      expect.anything(),
    );

    mockReplace.mockClear();

    // Multi Agent → KB (mode param removed)
    const radios3 = screen.getAllByRole('radio');
    fireEvent.click(radios3[0]);
    expect(mockReplace).toHaveBeenCalledWith(
      expect.not.stringContaining('mode='),
      expect.anything(),
    );
  });

  // Validates: Requirements 6.1, 6.2
  it('right group (ModelIndicator) remains present regardless of mode', () => {
    render(<HeaderIntegrationHarness initialMode="kb" />);

    const rightGroup = screen.getByTestId('right-group');

    // KB mode — right group exists
    expect(rightGroup).toBeInTheDocument();

    // Switch to Single Agent
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]);

    // Right group still present
    expect(screen.getByTestId('right-group')).toBeInTheDocument();

    // Switch to Multi Agent
    const radios2 = screen.getAllByRole('radio');
    fireEvent.click(radios2[2]);
    expect(screen.getByTestId('right-group')).toBeInTheDocument();

    // Back to KB
    const radios3 = screen.getAllByRole('radio');
    fireEvent.click(radios3[0]);
    expect(screen.getByTestId('right-group')).toBeInTheDocument();
  });
});

describe('Header Integration: Model fallback on mode switch', () => {
  let toastEvents: CustomEvent[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    toastEvents = [];

    // Listen for toast notification events
    const handler = (e: Event) => {
      toastEvents.push(e as CustomEvent);
    };
    window.addEventListener('toastNotification', handler);

    // Cleanup after each test
    return () => {
      window.removeEventListener('toastNotification', handler);
    };
  });

  // Validates: Requirement 5.5
  it('triggers model fallback and toast when switching to a mode where current model is unavailable', () => {
    // Start in KB mode with a model that is NOT available in Agent mode
    // 'anthropic.claude-3-haiku' is in KB_MODELS but NOT in AGENT_MODELS
    render(
      <HeaderIntegrationHarness
        initialMode="kb"
        initialModelId="anthropic.claude-3-haiku"
      />,
    );

    // Verify initial state — model is Claude 3 Haiku
    expect(screen.getByTestId('current-mode')).toHaveTextContent('kb');

    // Switch to Single Agent mode — this should trigger fallback
    const radios = screen.getAllByRole('radio');
    act(() => {
      fireEvent.click(radios[1]); // Single Agent
    });

    expect(screen.getByTestId('current-mode')).toHaveTextContent('single-agent');

    // A toastNotification event should have been dispatched
    expect(toastEvents.length).toBeGreaterThanOrEqual(1);
    const lastToast = toastEvents[toastEvents.length - 1];
    expect(lastToast.detail).toHaveProperty('type', 'info');
    expect(lastToast.detail).toHaveProperty('message');
  });

  // Validates: Requirement 5.5
  it('does NOT trigger fallback when current model is available in the target mode', () => {
    // 'anthropic.claude-3-sonnet' is available in both KB_MODELS and AGENT_MODELS
    render(
      <HeaderIntegrationHarness
        initialMode="kb"
        initialModelId="anthropic.claude-3-sonnet"
      />,
    );

    // Switch to Single Agent mode — no fallback needed
    const radios = screen.getAllByRole('radio');
    act(() => {
      fireEvent.click(radios[1]);
    });

    expect(screen.getByTestId('current-mode')).toHaveTextContent('single-agent');

    // No toast should have been dispatched
    expect(toastEvents).toHaveLength(0);
  });

  // Validates: Requirements 5.5, 6.1, 6.2
  it('model fallback dispatches modelChanged event for sidebar sync', () => {
    const modelChangedEvents: CustomEvent[] = [];
    const handler = (e: Event) => {
      modelChangedEvents.push(e as CustomEvent);
    };
    window.addEventListener('modelChanged', handler);

    // Start with a KB-only model
    render(
      <HeaderIntegrationHarness
        initialMode="kb"
        initialModelId="anthropic.claude-3-haiku"
      />,
    );

    // Switch to Agent mode — triggers fallback
    const radios = screen.getAllByRole('radio');
    act(() => {
      fireEvent.click(radios[1]);
    });

    // modelChanged event should have been dispatched with the fallback model
    expect(modelChangedEvents.length).toBeGreaterThanOrEqual(1);
    const lastEvent = modelChangedEvents[modelChangedEvents.length - 1];
    // The fallback model should be the first model in AGENT_MODELS
    expect(lastEvent.detail.modelId).toBe(AGENT_MODELS[0].modelId);

    window.removeEventListener('modelChanged', handler);
  });
});
