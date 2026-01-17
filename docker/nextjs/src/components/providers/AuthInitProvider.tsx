/**
 * AuthInitProvider
 * アプリケーション初期化時に認証状態をチェックするプロバイダー
 * 
 * Task 3.2: 設定永続化システム実装 - 認証状態初期化
 * 作成日時: 2026-01-07
 */

'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * AuthInitProvider
 * 
 * 機能:
 * - アプリケーション起動時に認証状態をチェック
 * - セッションの有効性を確認
 * - 認証状態をuseAuthStoreに反映
 * 
 * 使用方法:
 * ```tsx
 * // app/[locale]/layout.tsx
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <ThemeProvider>
 *           <AuthInitProvider>
 *             <PreferencesSyncProvider>
 *               {children}
 *             </PreferencesSyncProvider>
 *           </AuthInitProvider>
 *         </ThemeProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function AuthInitProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { checkSession } = useAuthStore();

  useEffect(() => {
    console.log('🔐 [AuthInitProvider] 認証状態チェック開始');
    
    const initAuth = async () => {
      try {
        const isValid = await checkSession();
        console.log('🔐 [AuthInitProvider] 認証状態チェック完了:', { isValid });
      } catch (error) {
        console.error('🔐 [AuthInitProvider] 認証状態チェックエラー:', error);
      }
    };

    initAuth();
  }, [checkSession]);

  return <>{children}</>;
}
