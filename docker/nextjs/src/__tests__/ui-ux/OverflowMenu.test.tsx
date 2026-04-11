/**
 * Unit Test: OverflowMenu & UserMenu コンポーネント
 *
 * OverflowMenu:
 *   - ARIA属性 (aria-haspopup, aria-expanded)
 *   - Escapeキーでメニューを閉じ、フォーカスをトリガーに戻す
 *   - 外部クリックでメニューを閉じる
 *   - メニュー項目のラベル・アイコン表示
 *   - メニュー項目クリックで onClick 呼び出し＋メニュー閉じ
 *
 * UserMenu:
 *   - ユーザー名表示
 *   - クリックで Agent Directory リンク・Sign Out ボタン表示
 *   - aria-expanded トグル
 *   - Escapeキーでメニューを閉じる
 *
 * Requirements: 9.3, 9.6
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// --- Mocks ---

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      label: 'More options',
      agentDirectory: 'Agent Directory',
      signOut: 'Sign Out',
    };
    return translations[key] ?? key;
  },
}));

jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: any;
  }) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  };
});

import { OverflowMenu, OverflowMenuItem } from '../../components/ui/OverflowMenu';
import { UserMenu } from '../../components/ui/UserMenu';

// --- Helpers ---

function createItems(count: number = 3): OverflowMenuItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    label: `Item ${i}`,
    icon: <span data-testid={`icon-${i}`}>🔧</span>,
    onClick: jest.fn(),
  }));
}

// --- OverflowMenu Tests ---

describe('OverflowMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Validates: Requirement 9.3
  describe('ARIA attributes', () => {
    it('sets aria-haspopup="true" on the trigger button', () => {
      render(<OverflowMenu items={createItems()} />);

      const trigger = screen.getByRole('button', { name: 'More options' });
      expect(trigger).toHaveAttribute('aria-haspopup', 'true');
    });

    it('sets aria-expanded="false" when menu is closed', () => {
      render(<OverflowMenu items={createItems()} />);

      const trigger = screen.getByRole('button', { name: 'More options' });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('sets aria-expanded="true" when menu is open', () => {
      render(<OverflowMenu items={createItems()} />);

      const trigger = screen.getByRole('button', { name: 'More options' });
      fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
  });

  // Validates: Requirement 9.6
  describe('Escape key closes menu and returns focus to trigger', () => {
    it('closes the menu on Escape key press', () => {
      render(<OverflowMenu items={createItems()} />);

      const trigger = screen.getByRole('button', { name: 'More options' });
      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('returns focus to the trigger button after Escape', () => {
      render(<OverflowMenu items={createItems()} />);

      const trigger = screen.getByRole('button', { name: 'More options' });
      fireEvent.click(trigger);

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(document.activeElement).toBe(trigger);
    });
  });

  describe('outside click closes menu', () => {
    it('closes the menu when clicking outside', () => {
      render(
        <div>
          <OverflowMenu items={createItems()} />
          <button data-testid="outside">Outside</button>
        </div>
      );

      const trigger = screen.getByRole('button', { name: 'More options' });
      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      fireEvent.mouseDown(screen.getByTestId('outside'));

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('menu items render correctly', () => {
    it('renders all menu items with labels', () => {
      const items = createItems(3);
      render(<OverflowMenu items={items} />);

      const trigger = screen.getByRole('button', { name: 'More options' });
      fireEvent.click(trigger);

      expect(screen.getByText('Item 0')).toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });

    it('renders icons for menu items', () => {
      const items = createItems(2);
      render(<OverflowMenu items={items} />);

      const trigger = screen.getByRole('button', { name: 'More options' });
      fireEvent.click(trigger);

      expect(screen.getByTestId('icon-0')).toBeInTheDocument();
      expect(screen.getByTestId('icon-1')).toBeInTheDocument();
    });

    it('renders menu items with role="menuitem"', () => {
      render(<OverflowMenu items={createItems(2)} />);

      const trigger = screen.getByRole('button', { name: 'More options' });
      fireEvent.click(trigger);

      const menuItems = screen.getAllByRole('menuitem');
      expect(menuItems).toHaveLength(2);
    });
  });

  describe('click on menu item calls onClick and closes menu', () => {
    it('calls onClick when a menu item is clicked', () => {
      const items = createItems(2);
      render(<OverflowMenu items={items} />);

      const trigger = screen.getByRole('button', { name: 'More options' });
      fireEvent.click(trigger);

      fireEvent.click(screen.getByText('Item 0'));

      expect(items[0].onClick).toHaveBeenCalledTimes(1);
    });

    it('closes the menu after clicking a menu item', () => {
      const items = createItems(2);
      render(<OverflowMenu items={items} />);

      const trigger = screen.getByRole('button', { name: 'More options' });
      fireEvent.click(trigger);
      fireEvent.click(screen.getByText('Item 1'));

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });
});

// --- UserMenu Tests ---

describe('UserMenu', () => {
  const defaultProps = {
    username: 'testuser',
    locale: 'en',
    onSignOut: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('renders username', () => {
    it('displays the username', () => {
      render(<UserMenu {...defaultProps} />);

      expect(screen.getByText('testuser')).toBeInTheDocument();
    });
  });

  describe('click opens dropdown with Agent Directory and Sign Out', () => {
    it('shows Agent Directory link and Sign Out button on click', () => {
      render(<UserMenu {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /testuser/i });
      fireEvent.click(trigger);

      expect(screen.getByText('Agent Directory')).toBeInTheDocument();
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });

    it('Agent Directory links to the correct locale path', () => {
      render(<UserMenu {...defaultProps} locale="ja" />);

      const trigger = screen.getByRole('button', { name: /testuser/i });
      fireEvent.click(trigger);

      const link = screen.getByText('Agent Directory').closest('a');
      expect(link).toHaveAttribute('href', '/ja/genai/agents');
    });

    it('calls onSignOut when Sign Out is clicked', () => {
      const onSignOut = jest.fn();
      render(<UserMenu {...defaultProps} onSignOut={onSignOut} />);

      const trigger = screen.getByRole('button', { name: /testuser/i });
      fireEvent.click(trigger);
      fireEvent.click(screen.getByText('Sign Out'));

      expect(onSignOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('aria-expanded attribute toggles', () => {
    it('sets aria-expanded="false" when menu is closed', () => {
      render(<UserMenu {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /testuser/i });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('sets aria-expanded="true" when menu is open', () => {
      render(<UserMenu {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /testuser/i });
      fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('toggles aria-expanded on repeated clicks', () => {
      render(<UserMenu {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /testuser/i });

      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Escape key closes menu', () => {
    it('closes the dropdown on Escape key press', () => {
      render(<UserMenu {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /testuser/i });
      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('returns focus to the trigger button after Escape', () => {
      render(<UserMenu {...defaultProps} />);

      const trigger = screen.getByRole('button', { name: /testuser/i });
      fireEvent.click(trigger);

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(document.activeElement).toBe(trigger);
    });
  });
});
