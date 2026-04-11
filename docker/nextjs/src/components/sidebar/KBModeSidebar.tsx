'use client';

import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useChatSearch } from '@/hooks/useChatSearch';
import { ModelSelector } from '../bedrock/ModelSelector';
import { RegionSelector } from '../bedrock/RegionSelector';
import { ChatHistorySearch } from '../search/ChatHistorySearch';
import type { ChatSession } from '@/types/chat';

/**
 * KBModeSidebarコンポーネントのProps
 * 
 * Round 15修正:
 * - useLocale()の使用を削除
 * - localeをpropsとして受け取る（動的インポート対応）
 */
interface KBModeSidebarProps {
  // ロケール（親から渡される - useLocale()の代わり）
  locale: string;
  // サイドバーの開閉状態
  isOpen: boolean;
  // サイドバーを閉じるコールバック
  onClose: () => void;
  // 現在のセッションID
  currentSessionId?: string;
  // 新しいチャットを作成するコールバック
  onNewChat: () => void;
  // ユーザー名
  userName: string;
  // ユーザーメールアドレス
  userEmail?: string;
  // チャット履歴保存設定
  saveHistory: boolean;
  // チャット履歴保存設定変更コールバック
  onSaveHistoryChange: (value: boolean) => void;
  // チャットセッションリスト
  chatSessions: ChatSession[];
  // セッション選択コールバック
  onSessionSelect: (session: ChatSession) => void;
  // ✅ セッション削除コールバック（追加）
  onSessionDelete?: (sessionId: string) => void;
  // selectedModelID
  selectedModelId: string;
  // モデル変更コールバック
  onModelChange: (modelId: string) => void;
  // ユーザーディレクトリ情報
  userDirectories: any;
  // ディレクトリ情報読み込み中フラグ
  isLoadingDirectories: boolean;
  // ユーザーロール
  userRole?: string;
}

/**
 * Knowledge Baseモード専用サイドバーコンポーネント
 * 
 * KBモード固有の要素を表示：
 * - ユーザー情報
 * - FSxディレクトリ情報（アクセス権限）
 * - Bedrockt("region.region")選択
 * - チャット履歴設定
 * - AIモデル選択（通常のModelSelector）
 * - 権限制御状態
 */
export function KBModeSidebar({
  locale,
  isOpen,
  currentSessionId,
  onNewChat,
  userName,
  saveHistory,
  onSaveHistoryChange,
  chatSessions,
  onSessionSelect,
  onSessionDelete, // ✅ 追加
  selectedModelId,
  onModelChange,
  userDirectories,
  isLoadingDirectories,
  userRole = 'User'
}: KBModeSidebarProps) {
  const t = useCustomTranslations(locale);
  
  // チャット履歴検索
  const {
    searchQuery,
    updateSearchQuery,
    searchResults,
    loadSearchHistory,
    clearSearchHistory,
    searchHistory
  } = useChatSearch({
    sessions: chatSessions,
    threshold: 0.3,
    keys: ['messages.content', 'id']
  });

  // 検索結果からセッションリストを抽出
  const filteredSessions = searchResults.map(result => result.item);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 h-full flex flex-col">
      {/* ヘッダー */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('sidebar.settingsPanel')}</h2>
      </div>

      {/* スクロール可能なコンテンツエリア */}
      <div className="flex-1 overflow-y-auto">
        {/* 新しいチャットボタン */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={onNewChat}
            className="w-full px-2 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors"
          >
            + {t('chat.newChat')}
          </button>
        </div>

        {/* チャット履歴セクション */}
        {saveHistory && Array.isArray(chatSessions) && chatSessions.length > 0 && (
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('chat.chatHistory')}</h3>
            
            {/* 検索バー */}
            <div className="mb-2">
              <ChatHistorySearch
                value={searchQuery}
                onChange={updateSearchQuery}
                onClear={() => updateSearchQuery('')}
                searchHistory={searchHistory}
                onHistorySelect={updateSearchQuery}
                onClearHistory={clearSearchHistory}
                placeholder={t('search.placeholder')}
              />
            </div>
            
            {/* 検索結果またはセッションリスト */}
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {filteredSessions.slice(0, 3).map((session: ChatSession) => (
                <div
                  key={session.id}
                  className={`relative group w-full text-left p-1 rounded-md text-xs transition-colors ${
                    currentSessionId === session.id
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                      : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  <button
                    onClick={() => onSessionSelect(session)}
                    className="w-full text-left"
                  >
                    <div className="font-medium truncate text-xs pr-6">{session.title}</div>
                    <div className="text-gray-500 dark:text-gray-400 text-xs">
                      {new Date(session.updatedAt).toLocaleDateString('ja-JP')}
                    </div>
                  </button>
                  {/* ✅ 削除ボタン（追加） */}
                  {onSessionDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('このチャット履歴を削除しますか？')) {
                          onSessionDelete(session.id);
                        }
                      }}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                      title="削除"
                    >
                      <svg className="w-3 h-3 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ユーザー情報セクション */}
        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('sidebar.userInfo')}</h3>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {userName} ({userRole})
          </div>
        </div>

        {/* FSxディレクトリ情報セクション */}
        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('sidebar.accessPermissions')}</h3>
          {isLoadingDirectories ? (
            <div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
              <span>{t('common.loading')}</span>
            </div>
          ) : userDirectories ? (
            <div className="space-y-1">
              <div className="text-xs">
                <div className="flex items-center space-x-1">
                  {userDirectories.directoryType === 'actual' && <span className="text-green-600">✅</span>}
                  {userDirectories.directoryType === 'test' && <span className="text-blue-600">🧪</span>}
                  {userDirectories.directoryType === 'simulated' && <span className="text-yellow-600">⚠️</span>}
                  {userDirectories.directoryType === 'unavailable' && <span className="text-red-600">❌</span>}
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {userDirectories.directoryType === 'actual' && t('permissions.fsxEnvironment')}
                    {userDirectories.directoryType === 'test' && t('permissions.testEnvironment')}
                    {userDirectories.directoryType === 'simulated' && t('permissions.simulation')}
                    {userDirectories.directoryType === 'unavailable' && t('permissions.fsxUnavailable')}
                  </span>
                </div>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <div>📁 {t('permissions.directories', { count: userDirectories.accessibleDirectories?.length || 0 })}</div>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={userDirectories.permissions.read ? 'text-green-600' : 'text-red-600'}>
                    {userDirectories.permissions.read ? '✅' : '❌'} {t('permissions.read')}
                  </span>
                  <span className={userDirectories.permissions.write ? 'text-green-600' : 'text-red-600'}>
                    {userDirectories.permissions.write ? '✅' : '❌'} {t('permissions.write')}
                  </span>
                </div>
              </div>
              {userDirectories.fsxFileSystemId && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  FSx: {userDirectories.fsxFileSystemId.substring(0, 12)}...
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {t('error.generic')}
            </div>
          )}
        </div>

        {/* Bedrockリージョン選択セクション */}
        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
          <RegionSelector />
        </div>

        {/* チャット履歴設定セクション */}
        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sidebar.chatHistorySettings')}</h3>
          <button
            onClick={() => {
              console.log('[KBModeSidebar] チャット履歴設定切り替え:', !saveHistory);
              onSaveHistoryChange(!saveHistory);
            }}
            className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
              saveHistory
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 font-medium'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <div className="flex items-center space-x-2">
              <span className="text-base">{saveHistory ? '💾' : '🚫'}</span>
              <div className="flex-1">
                <div className="font-medium">{saveHistory ? t('sidebar.historySaving') : t('sidebar.noHistorySaving')}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {saveHistory ? t('sidebar.autoSave') : t('sidebar.deleteOnSessionEnd')}
                </div>
              </div>
              {saveHistory && <span className="text-green-600 dark:text-green-400">✓</span>}
            </div>
          </button>
        </div>

        {/* AIモデル選択セクション */}
        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
          <ModelSelector
            selectedModelId={selectedModelId}
            onModelChange={onModelChange}
            showAdvancedFilters={true}
          />
        </div>

        {/* 権限制御状態セクション */}
        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('sidebar.permissionControl')}</h3>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-green-600">✅</span>
              <span className="text-xs text-gray-600 dark:text-gray-400">{t('permissions.available')}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-blue-600">🔐</span>
              <span className="text-xs text-gray-600 dark:text-gray-400">{t('sidebar.permissionControl')}</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('model.requestAccess')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
