/**
 * Unit Test: UnifiedModeToggle コンポーネント
 *
 * 3モード表示、アクティブ状態のスタイル、Multi無効時の挙動、
 * ARIA属性、キーボードナビゲーションを検証する。
 *
 * Requirements: 1.1, 1.2, 1.4, 1.5
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// --- Mocks ---

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      kb: 'KB',
      singleAgent: 'Single Agent',
      multiAgent: 'Multi Agent',
      label: 'Chat mode',
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

// --- Helpers ---

function renderToggle(props: Partial<React.ComponentProps<typeof UnifiedModeToggle>> = {}) {
  const defaultProps: React.ComponentProps<typeof UnifiedModeToggle> = {
    mode: 'kb',
    onModeChange: jest.fn(),
    multiAgentAvailable: true,
    ...props,
  };
  return render(<UnifiedModeToggle {...defaultProps} />);
}

// --- Tests ---

describe('UnifiedModeToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Validates: Requirement 1.1
  describe('renders all 3 mode buttons', () => {
    it('displays KB, Single, and Multi buttons', () => {
      renderToggle();

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);

      expect(screen.getByText('KB')).toBeInTheDocument();
      expect(screen.getByText('Single')).toBeInTheDocument();
      expect(screen.getByText('Multi')).toBeInTheDocument();
    });
  });

  // Validates: Requirement 1.2
  describe('active mode styling', () => {
    it('applies blue styles when KB is active', () => {
      renderToggle({ mode: 'kb' });

      const kbButton = screen.getAllByRole('radio')[0];
      expect(kbButton.className).toContain('bg-blue-50');
      expect(kbButton.className).toContain('text-blue-600');
    });

    it('applies purple styles when single-agent is active', () => {
      renderToggle({ mode: 'single-agent' });

      const singleButton = screen.getAllByRole('radio')[1];
      expect(singleButton.className).toContain('bg-purple-50');
      expect(singleButton.className).toContain('text-purple-600');
    });

    it('applies purple styles when multi-agent is active', () => {
      renderToggle({ mode: 'multi-agent' });

      const multiButton = screen.getAllByRole('radio')[2];
      expect(multiButton.className).toContain('bg-purple-50');
      expect(multiButton.className).toContain('text-purple-600');
    });
  });

  // Validates: Requirement 1.4
  describe('multiAgentAvailable=false disables Multi button', () => {
    it('disables the Multi button when multiAgentAvailable is false', () => {
      renderToggle({ multiAgentAvailable: false });

      const multiButton = screen.getAllByRole('radio')[2];
      expect(multiButton).toBeDisabled();
    });

    it('does not call onModeChange when clicking disabled Multi button', () => {
      const onModeChange = jest.fn();
      renderToggle({ multiAgentAvailable: false, onModeChange });

      const multiButton = screen.getAllByRole('radio')[2];
      fireEvent.click(multiButton);

      expect(onModeChange).not.toHaveBeenCalled();
    });
  });

  // Validates: Requirement 1.5
  describe('ARIA attributes', () => {
    it('has role="radiogroup" on the container', () => {
      renderToggle();

      const radiogroup = screen.getByRole('radiogroup');
      expect(radiogroup).toBeInTheDocument();
    });

    it('has role="radio" on each button', () => {
      renderToggle();

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);
    });

    it('sets aria-checked=true on the active mode button', () => {
      renderToggle({ mode: 'single-agent' });

      const radios = screen.getAllByRole('radio');
      // KB
      expect(radios[0]).toHaveAttribute('aria-checked', 'false');
      // Single Agent (active)
      expect(radios[1]).toHaveAttribute('aria-checked', 'true');
      // Multi Agent
      expect(radios[2]).toHaveAttribute('aria-checked', 'false');
    });

    it('sets aria-label on the radiogroup', () => {
      renderToggle();

      const radiogroup = screen.getByRole('radiogroup');
      expect(radiogroup).toHaveAttribute('aria-label', 'Chat mode');
    });
  });

  // Validates: Requirement 1.5 (keyboard navigation)
  describe('keyboard navigation', () => {
    it('ArrowRight moves from KB to Single Agent', () => {
      const onModeChange = jest.fn();
      renderToggle({ mode: 'kb', onModeChange });

      const kbButton = screen.getAllByRole('radio')[0];
      fireEvent.keyDown(kbButton, { key: 'ArrowRight' });

      expect(onModeChange).toHaveBeenCalledWith('single-agent');
    });

    it('ArrowLeft moves from Single Agent to KB', () => {
      const onModeChange = jest.fn();
      renderToggle({ mode: 'single-agent', onModeChange });

      const singleButton = screen.getAllByRole('radio')[1];
      fireEvent.keyDown(singleButton, { key: 'ArrowLeft' });

      expect(onModeChange).toHaveBeenCalledWith('kb');
    });

    it('ArrowRight skips disabled Multi Agent', () => {
      const onModeChange = jest.fn();
      renderToggle({ mode: 'single-agent', onModeChange, multiAgentAvailable: false });

      const singleButton = screen.getAllByRole('radio')[1];
      fireEvent.keyDown(singleButton, { key: 'ArrowRight' });

      expect(onModeChange).toHaveBeenCalledWith('kb');
    });
  });
});
