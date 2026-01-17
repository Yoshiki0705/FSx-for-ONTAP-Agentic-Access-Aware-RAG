'use client';

import { useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ThemeToggle } from '../ui/ThemeToggle';

export function Header() {
  const router = useRouter();
  const [username, setUsername] = useState<string>('');

  useEffect(() => {
    // ユーザー名を取得
    const user = localStorage.getItem('username') || 'User';
    setUsername(user);
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('isAuthenticated');
    router.push('/');
  };

  return (
    <header className="bg-netapp-blue dark:bg-gray-800 text-white shadow-lg transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold">🔷 NetApp RAG System</h1>
            <span className="ml-4 text-sm opacity-75">Permission-aware with FSx ONTAP</span>
          </div>
          <div className="flex items-center space-x-4">
            {/* ユーザー情報 */}
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span className="text-sm">{username}</span>
            </div>

            {/* ダークモード切り替え - ThemeToggleコンポーネントを使用 */}
            <ThemeToggle variant="icon" />

            {/* サインアウト */}
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="サインアウト"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">サインアウト</span>
            </button>

            {/* ステータス */}
            <div className="flex items-center space-x-2">
              <span className="text-sm">Lambda v2.2.0</span>
              <div className="w-3 h-3 bg-green-400 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
