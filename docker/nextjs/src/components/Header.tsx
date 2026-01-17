'use client';

import { useRouter } from 'next/navigation';
import { LogOut, User, Menu } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ThemeToggle } from './ui/ThemeToggle';
import { LanguageSwitcher } from './ui/LanguageSwitcher';
import { useAuthStore } from '@/store/useAuthStore';
import { useCSRFToken } from '@/hooks/useCSRFToken';
import { type Locale } from '../i18n/config';

interface HeaderProps {
  locale: Locale;
  showSidebarToggle?: boolean;
  onSidebarToggle?: () => void;
  agentMode?: boolean;
  saveHistory?: boolean;
}

export function Header({ 
  locale,
  showSidebarToggle = false,
  onSidebarToggle,
  agentMode,
  saveHistory
}: HeaderProps) {
  const router = useRouter();
  const { isAuthenticated, session, signOut, checkSession } = useAuthStore();
  const { token: csrfToken } = useCSRFToken();
  const [hasMounted, setHasMounted] = useState(false);
  const FIXED_SIDEBAR_WIDTH = 320; // 固定幅
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default open

  useEffect(() => {
    setHasMounted(true);
    // セッション有効性チェック
    if (!checkSession() && isAuthenticated) {
      router.push(`/${locale}/signin`);
    }

    // サイドバー開閉状態の監視のみ
    const handleSidebarToggle = (e: CustomEvent) => {
      setIsSidebarOpen(e.detail.isOpen);
    };
    window.addEventListener('sidebar-toggle' as any, handleSidebarToggle as any);

    return () => {
      window.removeEventListener('sidebar-toggle' as any, handleSidebarToggle as any);
    };
  }, [checkSession, isAuthenticated, locale, router]);

  const handleSignOut = async () => {
    if (!csrfToken) {
      console.error('CSRF token not available for signout');
      return;
    }
    
    await signOut(csrfToken);
    router.push(`/${locale}/signin`);
  };

  if (!hasMounted) {
    return null; // SSR hydration問題を回避
  }

  // サイドバーが開いている場合のみmarginLeftを適用（固定幅320px）
  const headerMarginLeft = isSidebarOpen ? FIXED_SIDEBAR_WIDTH : 0;

  return (
    <header 
      className="bg-blue-600 dark:bg-gray-800 shadow-lg transition-all duration-300"
      style={{
        marginLeft: showSidebarToggle ? 0 : `${headerMarginLeft}px`
      }}
    >
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4 gap-4">
          {/* 左側: サイドバートグル */}
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {showSidebarToggle && onSidebarToggle && (
              <button
                onClick={onSidebarToggle}
                className="p-2 rounded-md text-white hover:bg-white/10 transition-colors flex-shrink-0"
                aria-label="サイドバーを切り替え"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
          </div>
          
          {/* 右側: バッジ + コントロール */}
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            {/* バッジ類 */}
            {(agentMode !== undefined || saveHistory !== undefined) && (
              <div className="flex items-center space-x-1 sm:space-x-2">
                {agentMode && (
                  <span className="px-1.5 sm:px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full font-medium whitespace-nowrap">
                    🤖 Agent
                  </span>
                )}
                {saveHistory && (
                  <span className="px-1.5 sm:px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full whitespace-nowrap hidden sm:inline">
                    履歴保存
                  </span>
                )}
              </div>
            )}

            {/* ユーザー情報 */}
            {isAuthenticated && session && (
              <div className="flex items-center space-x-2 text-white">
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">{session.user.username}</span>
                <span className="text-xs opacity-90">({session.user.role})</span>
              </div>
            )}

            {/* 言語切り替え */}
            <LanguageSwitcher 
              currentLocale={locale}
              variant="dropdown"
            />

            {/* ダークモード切り替え */}
            <ThemeToggle variant="icon" />

            {/* サインアウト */}
            {isAuthenticated && (
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-white"
                aria-label="サインアウト"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">サインアウト</span>
              </button>
            )}

            {/* ステータス - 環境変数で制御 */}
            {process.env.NEXT_PUBLIC_SHOW_VERSION === 'true' && (
              <div className="flex items-center space-x-2 text-white">
                <span className="text-sm opacity-90">Lambda v2.3.0</span>
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
