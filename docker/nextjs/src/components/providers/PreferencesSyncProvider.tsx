/**
 * PreferencesSyncProvider
 * ユーザー設定をDynamoDBとZustand Storeで同期するプロバイダー
 * 
 * Task 3.2: 設定永続化システム実装
 * 作成日時: 2026-01-07
 */

'use client';

import { usePreferencesSync } from '@/hooks/usePreferencesSync';

/**
 * PreferencesSyncProvider
 * 
 * 機能:
 * - アプリケーション起動時にDynamoDBからユーザー設定を読み込み
 * - Zustand Storeに設定を反映
 * - 設定変更時にDynamoDBに自動保存
 * 
 * 使用方法:
 * ```tsx
 * // app/[locale]/layout.tsx
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <PreferencesSyncProvider>
 *           {children}
 *         </PreferencesSyncProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function PreferencesSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // DynamoDBとZustand Storeを同期
  usePreferencesSync();

  return <>{children}</>;
}
