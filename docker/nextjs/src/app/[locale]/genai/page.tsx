'use client';

import { ErrorBoundary } from '../../../components/ui/ErrorBoundary';

// Force dynamic rendering to prevent SSR errors with client-only hooks
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useChatStore } from '../../../store';
import type { Message, ChatSession } from '../../../store';
import { useAuthStore } from '../../../store/useAuthStore';
import { useRegionStore } from '../../../store/useRegionStore';
import { ModelSelector } from '../../../components/bedrock/ModelSelector';
import { RegionSelector } from '../../../components/bedrock/RegionSelector';
import { DEFAULT_MODEL_ID, getModelById } from '../../../config/bedrock-models';
import { ThemeToggle } from '../../../components/ui/ThemeToggle';
import { MessageContent } from '../../../components/chat/MessageContent';
import { CitationDisplay, CitationItem } from '../../../components/chat/CitationDisplay';
import { useThemeStore, initializeThemeListener } from '../../../store/useThemeStore';
import { LanguageSwitcher } from '../../../components/ui/LanguageSwitcher';

// エラーメッセージ表示用の型定義（将来の拡張用）
// interface ErrorDisplayProps {
//   message: string;
// }

// サポートされているロケール一覧（全8言語対応）
const SUPPORTED_LOCALES = ['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'fr', 'de', 'es'] as const;
type SupportedLocale = typeof SUPPORTED_LOCALES[number];

// ロケール検証とサニタイゼーション関数
const validateAndSanitizeLocale = (locale: string): SupportedLocale => {
  // 基本的なサニタイゼーション
  const sanitized = locale.trim().slice(0, 5);
  
  // サポートされているロケールかチェック
  if (SUPPORTED_LOCALES.includes(sanitized as SupportedLocale)) {
    return sanitized as SupportedLocale;
  }
  
  // デフォルトロケールにフォールバック
  console.warn(`[Locale] Unsupported locale: ${locale}, falling back to 'ja'`);
  return 'ja';
};

// FSxディレクトリセクション生成関数（Phase 4: FSx Directory Display）
// 2026-01-20: Added FSx directory display functionality
async function generateFsxDirectoriesSection(
  tFsx: any,  // useTranslations('fsx')
  userId: string
): Promise<string> {
  console.log('📁 [generateFsxDirectoriesSection] Starting...', { userId, hasTFsx: !!tFsx });

  // ✅ Validate translation function
  if (!tFsx || typeof tFsx !== 'function') {
    console.error('❌ [generateFsxDirectoriesSection] Invalid tFsx function:', tFsx);
    return '';
  }

  try {
    // 1. Fetch FSx directories from API
    console.log('🔄 [generateFsxDirectoriesSection] Fetching directories from API...');
    const response = await fetch(`/api/fsx/user-directories?userId=${encodeURIComponent(userId)}`);
    
    if (!response.ok) {
      console.error('❌ [generateFsxDirectoriesSection] API error:', response.status);
      return `\n\n**📁 ${tFsx('accessibleDirectories')}**\n${tFsx('errorLoadingDirectories')}`;
    }

    const data = await response.json();
    console.log('✅ [generateFsxDirectoriesSection] Data received:', {
      totalDirectories: data.totalDirectories,
      totalSize: data.totalSize,
      dataSource: data.dataSource
    });

    // 2. Check if directories exist
    if (!data.accessibleDirectories || data.accessibleDirectories.length === 0) {
      console.warn('⚠️ [generateFsxDirectoriesSection] No directories found');
      return `\n\n**📁 ${tFsx('accessibleDirectories')}**\n${tFsx('noDirectories')}`;
    }

    // 3. Format directories list
    const directoriesList = data.accessibleDirectories
      .map((dir: any) => {
        const permissions = dir.permissions.join(', ');
        return `• **${dir.path}**: ${dir.description}\n  - ${permissions} | ${dir.size} | ${dir.fileCount.toLocaleString()} files`;
      })
      .join('\n');

    // 4. Build FSx section
    const fsxSection = `

**📁 ${tFsx('accessibleDirectories')}**

**${tFsx('summary')}**
• **${tFsx('totalDirectories')}**: ${data.totalDirectories}
• **${tFsx('totalSize')}**: ${data.totalSize}
• **${tFsx('dataSource')}**: ${data.dataSource === 'simulated' ? tFsx('simulated') : tFsx('real')}

${directoriesList}`;

    console.log('✅ [generateFsxDirectoriesSection] FSx section generated, length:', fsxSection.length);
    return fsxSection;

  } catch (error) {
    console.error('❌ [generateFsxDirectoriesSection] Error:', error);
    return `\n\n**📁 ${tFsx('accessibleDirectories')}**\n${tFsx('errorLoadingDirectories')}`;
  }
}

// 初期メッセージ生成関数（ロケール対応・i18n対応）
// 2026-01-14: Enhanced null safety to prevent undefined errors
// 2026-01-14 v4: Added comprehensive logging and defensive checks
// 2026-01-22: Added SID information display (Phase 5)
const generateInitialMessage = (
  username: string, 
  role: string, 
  t: any,  // useTranslations() - ルートレベルの翻訳フック
  sid?: string,  // AD SID (Optional - Phase 5)
  distinguishedName?: string  // Distinguished Name (Optional - Phase 5)
): string => {
  console.log('🔍 [generateInitialMessage] Starting...', { 
    username, 
    role, 
    sid,
    distinguishedName,
    hasT: !!t, 
    tType: typeof t 
  });

  // ✅ Validate translation function
  if (!t || typeof t !== 'function') {
    console.error('❌ [generateInitialMessage] Invalid t function:', t);
    return `Welcome, ${username}!\n\nTranslation system is not available. Please reload the page.`;
  }

  try {
    // Test translation function before using it
    const testTranslation = t('introduction.welcome', { username });
    console.log('✅ [generateInitialMessage] Translation test passed:', testTranslation?.substring(0, 50));

    // SID情報セクション（利用可能な場合）
    const sidSection = sid ? `
• **AD SID**: ${sid}${distinguishedName ? `
• **Distinguished Name**: ${distinguishedName}` : ''}` : '';

    const message = `${t('introduction.welcome', { username })}

**${t('introduction.title')}**

**${t('introduction.yourPermissions')}**
• **${t('introduction.user')}**: ${username}
• **${t('introduction.role')}**: ${role || 'User'}${sidSection}
• **${t('introduction.accessibleDirectories')}**: ${t('introduction.loading')}

*${t('introduction.checkingPermissions')}*

**${t('introduction.availableFeatures')}**
• ${t('introduction.documentSearch')}
• ${t('introduction.permissionControl')}

${t('introduction.askAnything')}`;

    console.log('✅ [generateInitialMessage] Message generated successfully, length:', message?.length);
    return message;
  } catch (error) {
    console.error('❌ [generateInitialMessage] Error generating message:', error);
    return `Welcome, ${username}!\n\nAn error occurred while loading the introduction message.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

// Agent Mode用の初期メッセージ生成関数は削除済み（KBモード専用デモ）
// 2026-01-14: Enhanced null safety to prevent undefined errors
// 2026-01-14 v4: Added comprehensive logging and defensive checks
// 2026-01-22: Added SID information display (Phase 5)
const generateInitialMessageWithDirectories = (
  username: string,
  role: string,
  userDirectories: any,
  t: any,  // useTranslations() - ルートレベルの翻訳フック
  sid?: string,  // AD SID (Optional - Phase 5)
  distinguishedName?: string  // Distinguished Name (Optional - Phase 5)
): string => {
  console.log('🔍 [generateInitialMessageWithDirectories] Starting...', { 
    username, 
    role, 
    sid,
    distinguishedName,
    hasUserDirectories: !!userDirectories,
    hasT: !!t,
    tType: typeof t,
    userDirectoriesType: typeof userDirectories
  });

  // ✅ Validate translation function
  if (!t || typeof t !== 'function') {
    console.error('❌ [generateInitialMessageWithDirectories] Invalid t function:', t);
    return `Welcome, ${username}!\n\nTranslation system is not available. Please reload the page.`;
  }

  // ✅ Validate userDirectories
  if (!userDirectories || typeof userDirectories !== 'object') {
    console.error('❌ [generateInitialMessageWithDirectories] Invalid userDirectories:', userDirectories);
    return generateInitialMessage(username, role, t, sid, distinguishedName);
  }

  try {
    const directoryDisplay = Array.isArray(userDirectories.accessibleDirectories) 
      ? userDirectories.accessibleDirectories.join(', ')
      : 'N/A';
    
    console.log('✅ [generateInitialMessageWithDirectories] Directory display:', directoryDisplay);
    
    // ディレクトリタイプに応じたメッセージを取得
    let directoryNote = '';
    const fsxId = userDirectories.fsxFileSystemId || '';
    
    switch (userDirectories.directoryType) {
      case 'actual':
        directoryNote = t('introduction.directoryType.actual', { fsxId });
        break;
      case 'test':
        directoryNote = t('introduction.directoryType.test');
        break;
      case 'simulated':
        directoryNote = t('introduction.directoryType.simulated');
        break;
      case 'unavailable':
        directoryNote = t('introduction.directoryType.unavailable');
        break;
      default:
        directoryNote = t('introduction.directoryType.unknown');
    }

    console.log('✅ [generateInitialMessageWithDirectories] Directory note:', directoryNote?.substring(0, 50));

    // SID情報セクション（利用可能な場合）
    const sidSection = sid ? `
• **AD SID**: ${sid}${distinguishedName ? `
• **Distinguished Name**: ${distinguishedName}` : ''}` : '';

    const message = `${t('introduction.welcome', { username })}

**${t('introduction.title')}**

**${t('introduction.yourPermissions')}**
• **${t('introduction.user')}**: ${username}
• **${t('introduction.role')}**: ${role || 'User'}${sidSection}
• **${t('introduction.accessibleDirectories')}**: ${directoryDisplay}

${directoryNote}

**${t('introduction.permissionDetails')}**
• **${t('introduction.read')}**: ${userDirectories.permissions?.read ? t('introduction.available') : t('introduction.unavailable')}
• **${t('introduction.write')}**: ${userDirectories.permissions?.write ? t('introduction.available') : t('introduction.unavailable')}
• **${t('introduction.execute')}**: ${userDirectories.permissions?.execute ? t('introduction.available') : t('introduction.unavailable')}

**${t('introduction.availableFeatures')}**
• ${t('introduction.documentSearch')}
• ${t('introduction.permissionControl')}

${t('introduction.askAnything')}`;

    console.log('✅ [generateInitialMessageWithDirectories] Message generated successfully, length:', message?.length);
    return message;
  } catch (error) {
    console.error('❌ [generateInitialMessageWithDirectories] Error generating message:', error);
    return generateInitialMessage(username, role, t);
  }
};

// Markdownライクなテキストをレンダリングするコンポーネント
// 2026-01-14: Enhanced null safety for Agent mode compatibility
// 2026-01-14 v2: Added try-catch and additional validation to prevent runtime errors
// 2026-01-14 v4: Added comprehensive logging
function MessageContent({ content }: { content: string }) {
  console.log('🔍 [MessageContent] Rendering...', {
    hasContent: !!content,
    contentType: typeof content,
    contentLength: content?.length,
    contentPreview: content?.substring(0, 50)
  });

  // ✅ Null/undefined check to prevent "Cannot read properties of undefined (reading 'length')" error
  // This validation is critical for Agent mode where content structure may vary
  if (!content || typeof content !== 'string') {
    console.warn('⚠️ [MessageContent] Invalid content:', content);
    return <div className="text-gray-500">No content available</div>;
  }

  // **content** を <strong>content</strong> に変換
  const formatText = (text: string) => {
    if (!text || typeof text !== 'string') {
      return text;
    }
    
    try {
      return text
        .split(/(\*\*[^*]+\*\*)/g)
        .map((part, index) => {
          if (part && part.startsWith('**') && part.endsWith('**')) {
            const innerContent = part.slice(2, -2);
            return <strong key={index} className="font-semibold text-gray-900">{innerContent}</strong>;
          }
          return part;
        });
    } catch (error) {
      console.error('❌ [MessageContent.formatText] Error:', error);
      return text;
    }
  };

  try {
    // ✅ Additional validation before split
    const contentString = String(content || '');
    const lines = contentString.split('\n');
    
    console.log('✅ [MessageContent] Content split into lines:', lines.length);
    
    if (!Array.isArray(lines) || lines.length === 0) {
      console.warn('⚠️ [MessageContent] Invalid lines array:', lines);
      return <div className="text-gray-500">Content format error</div>;
    }

    return (
      <div className="space-y-1">
        {lines.map((line, lineIndex) => {
          try {
            const trimmedLine = (line || '').trim();

            if (trimmedLine === '') {
              return <div key={lineIndex} className="h-2" />;
            }

            // リスト項目の処理
            if (trimmedLine.startsWith('• ')) {
              return (
                <div key={lineIndex} className="flex items-start space-x-2 ml-2">
                  <span className="text-blue-600 font-bold mt-0.5">•</span>
                  <span className="flex-1">{formatText(trimmedLine.slice(2))}</span>
                </div>
              );
            }

            // セクションヘッダー（**で囲まれた行）の処理
            if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**') && trimmedLine.length > 4) {
              const headerContent = trimmedLine.slice(2, -2);
              return (
                <div key={lineIndex} className="font-semibold text-gray-900 mt-3 mb-1">
                  {headerContent}
                </div>
              );
            }

            return (
              <div key={lineIndex}>
                {formatText(trimmedLine)}
              </div>
            );
          } catch (lineError) {
            console.error(`❌ [MessageContent] Error processing line ${lineIndex}:`, lineError);
            return <div key={lineIndex} className="text-red-500">Error rendering line</div>;
          }
        })}
      </div>
    );
  } catch (error) {
    console.error('❌ [MessageContent] Fatal error:', error);
    return <div className="text-red-500">Error rendering message content</div>;
  }
}

function ChatbotPageContent() {
  // 翻訳フック（名前空間なし - 完全パスで翻訳キーを指定）
  const t = useTranslations();
  const tFsx = useTranslations('fsx');      // FSx情報用の翻訳フック
  
  // next-intlの正しいロケール取得方法を使用（hydration mismatch回避）
  const currentLocale = useLocale();
  const memoizedLocale = useMemo(() => validateAndSanitizeLocale(currentLocale), [currentLocale]);
  
  // Tree Shaking対策: 全ての翻訳キーを事前に取得（実際に存在するキーのみ使用）
  const translations = useMemo(() => ({
    // Sidebar
    settingsPanel: t('sidebar.settingsPanel'),
    userInfo: t('sidebar.userInfo'),
    accessPermissions: t('sidebar.accessPermissions'),
    chatHistorySettings: t('sidebar.chatHistorySettings'),
    historySaving: t('sidebar.historySaving'),
    historyDisabled: t('sidebar.historyDisabled'),
    autoSave: t('sidebar.autoSave'),
    sessionOnly: t('sidebar.sessionOnly'),
    operationMode: t('sidebar.operationMode'),
    permissionControl: t('sidebar.permissionControl'),
    
    // Common
    loading: t('common.loading'),
    
    // Permissions
    fsxEnvironment: t('permissions.fsxEnvironment'),
    testEnvironment: t('permissions.testEnvironment'),
    simulation: t('permissions.simulation'),
    fsxUnavailable: t('permissions.fsxUnavailable'),
    read: t('permissions.read'),
    write: t('permissions.write'),
    available: t('permissions.available'),
    directories: t('permissions.directories'),  // 追加: t is not defined エラーの修正
    
    // Chatt
    newChat: t('chat.newChat'),
    chatHistory: t('chat.chatHistory'),
    newChatShortcut: t('chat.newChatShortcut'),
    kbFeatures: t('chat.kbFeatures'),
    kbFeature1: t('chat.kbFeature1'),
    kbFeature2: t('chat.kbFeature2'),
    kbFeature3: t('chat.kbFeature3'),
    inputPlaceholder: t('chat.inputPlaceholder'),
    send: t('chat.send'),
    
    // Chatbott
    sidebarToggleClose: t('chatbot.sidebarToggleClose'),
    sidebarToggleOpen: t('chatbot.sidebarToggleOpen'),
    title: t('chatbot.title'),
    
    // Auth
    signOutButton: t('auth.signOutButton'),
    
    // Model
    requestAccess: t('model.requestAccess'),
    
  }), [t]);
  
  // Zustandストアを強制的に初期化（Next.js 15のTree Shaking対策）
  const regionStore = useRegionStore();
  
  // ✅ 2026-01-19: useAuthStoreと同期してuser stateを管理（sign-out fix）
  const authStore = useAuthStore();
  const { session, isAuthenticated } = authStore;
  
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);
  const [messageCitations, setMessageCitations] = useState<Record<string, CitationItem[]>>({});
  
  // エラーメッセージは直接文字列で定義（翻訳キーが存在しないため）
  const errorMessages = useMemo(() => ({
    genericError: t('error.generic'),
  }), [t]);
  
  // テーマストアを取得
  const themeStore = useThemeStore();
  
  // テーマの初期化
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cleanup = initializeThemeListener();
      
      console.log('🎨 [ChatbotPage] テーマ初期化完了:', {
        theme: themeStore.theme,
        effectiveTheme: themeStore.effectiveTheme
      });
      
      return cleanup;
    }
  }, []);
  
  // テーマ変更を監視してDOMを強制更新
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement;
      const body = window.document.body;
      
      // 既存のテーマクラスを削除
      root.classList.remove('light', 'dark');
      body.classList.remove('light', 'dark');
      
      // 新しいテーマクラスを追加
      root.classList.add(themeStore.effectiveTheme);
      body.classList.add(themeStore.effectiveTheme);
      
      // 背景色を設定
      if (themeStore.effectiveTheme === 'dark') {
        root.style.backgroundColor = '#1f2937';
        body.style.backgroundColor = '#1f2937';
      } else {
        root.style.backgroundColor = '#ffffff';
        body.style.backgroundColor = '#ffffff';
      }
      
      console.log('🎨 [ChatbotPage] テーマDOM更新:', {
        effectiveTheme: themeStore.effectiveTheme,
        htmlClasses: root.className,
        bodyClasses: body.className
      });
    }
  }, [themeStore.effectiveTheme]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);
  const [selectedModelName, setSelectedModelName] = useState('Amazon Nova Pro');
  const [userDirectories, setUserDirectories] = useState<any>(null);
  const [isLoadingDirectories, setIsLoadingDirectories] = useState(false);
  
  // エラーアクション関連のstate（将来の拡張用）
  // const [errorActions, setErrorActions] = useState<any[]>([]);
  // const [actionMessage, setActionMessage] = useState('');
  // const [isProcessingAction, setIsProcessingAction] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const signOutButtonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  // チャットストアの使用
  const {
    currentSession,
    setCurrentSession,
    addMessage,
    saveHistory,
    setSaveHistory,
    saveChatHistory,
    loadChatHistory,
    chatSessions,
    addChatSession,
  } = useChatStore();
  
  // RegionStoreの初期化
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // localStorageから最新の値を読み込んで設定
    const storedRegion = localStorage.getItem('selectedRegion');
    if (storedRegion && storedRegion !== regionStore.selectedRegion) {
      console.log('✅ [ChatbotPage] localStorageからリージョンを復元:', storedRegion);
      regionStore.setRegion(storedRegion);
    }
    
    console.log('✅ [ChatbotPage] RegionStore初期化完了:', {
      currentRegion: regionStore.selectedRegion,
      isLoading: regionStore.isChangingRegion
    });
  }, []);

  // ✅ 2026-01-17: useAuthStoreとlocal user stateを同期（race condition対策）
  useEffect(() => {
    console.log('🔄 [ChatbotPage] Syncing user state with useAuthStore...', {
      isAuthenticated,
      hasSession: !!session,
      sessionUser: session?.user?.username
    });

    if (isAuthenticated && session?.user) {
      // useAuthStoreのsessionからlocal user stateを更新
      setUser({
        username: session.user.username,
        userId: session.user.username,
        role: session.user.role || 'user',
        permissions: session.user.permissions || []
      });
      console.log('✅ [ChatbotPage] User state synced:', session.user.username);
    } else if (!isAuthenticated) {
      // 認証されていない場合はuserをnullに設定
      setUser(null);
      console.log('⚠️ [ChatbotPage] User state cleared (not authenticated)');
    }
  }, [isAuthenticated, session]);

  useEffect(() => {
    // クライアントサイドでのみ実行
    setIsClient(true);
    
    if (typeof window === 'undefined') return;
    
    // 認証チェック: Cookie/JWT認証を使用
    const checkAuth = async () => {
      try {
        // まずlocalStorageをチェック（後方互換性のため）
        const userData = localStorage.getItem('user');
        let parsedUser;
        
        if (userData) {
          parsedUser = JSON.parse(userData);
        }
        
        // セッションAPIでJWTからroleを取得（localStorageのroleが古い場合に対応）
        try {
          const response = await fetch('/api/auth/session');
          const data = await response.json();
          
          if (data.success && data.session) {
            if (parsedUser) {
              // localStorageのユーザー情報にセッションAPIのroleを反映
              parsedUser.role = data.session.role || parsedUser.role || 'user';
              localStorage.setItem('user', JSON.stringify(parsedUser));
            } else {
              // localStorageにない場合はセッションAPIから作成
              parsedUser = {
                username: data.session.username,
                userId: data.session.userId,
                role: data.session.role || 'user',
                permissions: []
              };
              localStorage.setItem('user', JSON.stringify(parsedUser));
            }
          } else if (!parsedUser) {
            console.error('認証失敗: セッションが見つかりません');
            router.push('/signin');
            return;
          }
        } catch (sessionError) {
          console.warn('⚠️ セッションAPI呼び出し失敗、localStorageのデータを使用:', sessionError);
          if (!parsedUser) {
            router.push('/signin');
            return;
          }
        }
        
        // ✅ Phase 5マイグレーション: SID/DNが存在しない場合、Get SID APIを呼び出し
        if (parsedUser && !parsedUser.sid) {
          console.log('🔄 [ChatbotPage Phase 5] Migrating user object to Phase 5 format (adding SID/DN)...');
          
          try {
            const response = await fetch('/api/auth/get-sid', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                userId: parsedUser.username,
                forceRefresh: false 
              }),
            });
            
            if (response.ok) {
              const sidData = await response.json();
              parsedUser.sid = sidData.sid;
              parsedUser.distinguishedName = sidData.distinguishedName;
              
              // localStorageを更新
              localStorage.setItem('user', JSON.stringify(parsedUser));
              console.log('✅ [ChatbotPage Phase 5] User object migrated successfully:', {
                username: parsedUser.username,
                hasSid: !!parsedUser.sid,
                hasDistinguishedName: !!parsedUser.distinguishedName
              });
            } else {
              console.warn('⚠️ [ChatbotPage Phase 5] Get SID API failed, continuing without SID/DN');
            }
          } catch (error) {
            console.error('❌ [ChatbotPage Phase 5] Migration failed:', error);
            // エラーが発生しても続行（SID/DNなしで動作）
          }
        } else if (parsedUser?.sid) {
          console.log('✅ [ChatbotPage Phase 5] User object already has SID/DN:', {
            username: parsedUser.username,
            sid: parsedUser.sid?.substring(0, 20) + '...'
          });
        }
        
        setUser(parsedUser);

        // ✅ 2026-01-19 v3: useAuthStoreを直接更新してHeader.tsxのサインアウトボタンを有効化
        // checkSession()はCookie認証に依存し失敗するため、localStorageから取得したユーザー情報で直接更新
        console.log('🔄 [ChatbotPage v3] Syncing authentication state with useAuthStore...', {
          username: parsedUser.username,
          role: parsedUser.role
        });
        
        // useAuthStoreの状態を直接設定（Zustand setState使用）
        const session = {
          user: {
            username: parsedUser.username,
            role: parsedUser.role || 'user',
            permissions: parsedUser.permissions || []
          },
          loginTime: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          lastActivity: new Date().toISOString()
        };
        
        // Zustand storeを正しく更新（setState使用）
        useAuthStore.setState({
          isAuthenticated: true,
          session: session,
          isLoading: false
        });
        
        console.log('✅ [ChatbotPage v3] useAuthStore updated directly:', {
          isAuthenticated: true,
          hasSession: true,
          sessionUser: parsedUser.username
        });

        // FSxディレクトリ情報の取得
        const fetchUserDirectories = async () => {
          setIsLoadingDirectories(true);
          try {
            const response = await fetch(`/api/fsx/directories?username=${parsedUser.username}`);
            if (response.ok) {
              const data = await response.json();
              if (data.success) {
                setUserDirectories(data.data);
              }
            }
          } catch (error) {
            console.error('Failed to fetch user directories:', error);
          } finally {
            setIsLoadingDirectories(false);
          }
        };

        fetchUserDirectories();

        // チャット履歴の読み込み（設定が有効な場合のみ）
        if (saveHistory) {
          loadChatHistory(parsedUser.username);
        }

        // ✅ FIX v16: Validate currentSession.messages after loading history
        // If currentSession exists but messages is undefined/invalid (NOT an array), reset it
        // ⚠️ IMPORTANT: Do NOT check length === 0, as new sessions have empty messages array
        if (currentSession && !Array.isArray(currentSession.messages)) {
          console.warn('⚠️ [ChatbotPage] currentSession has invalid messages (not an array), resetting session:', {
            sessionId: currentSession.id,
            messagesType: typeof currentSession.messages,
            messagesIsArray: Array.isArray(currentSession.messages)
          });
          setCurrentSession(null); // Reset to trigger new session creation
        }

        // 新しいセッションの作成（既存セッションがない場合）
        if (!currentSession) {
          console.log('🔄 [ChatbotPage] Creating new session...');

          const sessionTitle = memoizedLocale === 'en' 
            ? `Chat - ${new Date().toLocaleDateString('en-US')}`
            : `チャット - ${new Date().toLocaleDateString('ja-JP')}`;
            
          // KBモード用の初期メッセージを生成
          let initialMessageText: string;
          
          try {
            initialMessageText = generateInitialMessage(
              parsedUser.username,
              parsedUser.role || 'User',
              t,
              parsedUser?.sid,
              parsedUser?.distinguishedName
            );
            console.log('✅ [ChatbotPage] KB mode initial message generated, length:', initialMessageText?.length);
          } catch (error) {
            console.error('❌ [ChatbotPage] Error generating initial message:', error);
            initialMessageText = `Welcome, ${parsedUser.username}!\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
          
          const newSession: ChatSession = {
            id: `session_${Date.now()}`,
            title: sessionTitle,
            messages: [{
              id: '1',
              content: initialMessageText,
              role: 'assistant',
              timestamp: Date.now()
            }],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            userId: parsedUser.username
          };

          console.log('✅ [ChatbotPage] New session created:', {
            sessionId: newSession.id,
            messageCount: newSession.messages.length,
            firstMessageLength: newSession.messages[0]?.content?.length
          });

          setCurrentSession(newSession);
        }
      } catch (error) {
        console.error('認証チェックエラー:', error);
        router.push('/signin');
      }
    };
    
    checkAuth();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages]);

  // モデル変更イベントリスナー（Phase 2.1: Enhanced with Introduction Text update)
  // モデル変更イベントリスナー
  useEffect(() => {
    const handleModelChange = (event: CustomEvent) => {
      const { modelId } = event.detail;
      console.log('🔄 [ChatbotPage] モデル変更イベント受信:', modelId);
      setSelectedModelId(modelId);
    };

    window.addEventListener('modelChanged', handleModelChange as EventListener);
    return () => {
      window.removeEventListener('modelChanged', handleModelChange as EventListener);
    };
  }, []);

  // Region変更イベントリスナー（ログのみ）
  useEffect(() => {
    const handleRegionChange = (event: CustomEvent) => {
      const { region } = event.detail;
      console.log('🌍 [ChatbotPage] リージョン変更イベント受信:', region);
    };

    window.addEventListener('regionChanged', handleRegionChange as EventListener);
    return () => {
      window.removeEventListener('regionChanged', handleRegionChange as EventListener);
    };
  }, []);

  // currentSession変更の監視
  useEffect(() => {
    console.log('🔍 [ChatbotPage] currentSession changed:', {
      sessionId: currentSession?.id,
      messagesLength: currentSession?.messages?.length,
      firstMessageLength: currentSession?.messages?.[0]?.content?.length,
      firstMessagePreview: currentSession?.messages?.[0]?.content?.substring(0, 100),
      updateKey: (currentSession as any)?._updateKey,
      timestamp: Date.now()
    });
  }, [currentSession]);

  // モデル選択時にヘッダー表示を更新するためのuseEffectt
  useEffect(() => {
    // モデル変更時の処理（必要に応じて追加の処理を行う）
    console.log('Selected model changed to:', selectedModelId);
    
    // モデル情報を動的に取得してキャッシュを更新
    const updateModelInfo = async () => {
      try {
        const response = await fetch('/api/bedrock/region-info');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            // 利用可能なモデルと利用不可能なモデルを統合
            const allModels = [
              ...(data.data.availableModels || []),
              ...(data.data.unavailableModels || [])
            ];
            
            console.log('All models from API:', allModels.length);
            console.log('Available models:', data.data.availableModels?.length || 0);
            console.log('Unavailable models:', data.data.unavailableModels?.length || 0);
            console.log('Looking for model:', selectedModelId);
            
            // 選択されたモデルの情報をログ出力
            const selectedModel = allModels.find(m => m.modelId === selectedModelId);
            if (selectedModel && selectedModel.modelName) {
              console.log('Found selected model info:', selectedModel);
              setSelectedModelName(selectedModel.modelName);
            } else {
              console.log('Model not found in API, using fallback');
              // フォールバック: getModelByIdを使用
              const fallbackModel = getModelById(selectedModelId);
              if (fallbackModel && fallbackModel.name) {
                console.log('Using fallback model:', fallbackModel);
                setSelectedModelName(fallbackModel.name);
              } else {
                console.log('No fallback model found, using default name');
                // モデルIDから表示名を生成
                const displayName = selectedModelId
                  .replace(/^(amazon|anthropic|meta|mistral|ai21|cohere|deepseek|openai|qwen)\./, '')
                  .split(/[-.]/)
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ');
                setSelectedModelName(displayName || 'Amazon Nova Pro');
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to update model info:', error);
      }
    };
    
    updateModelInfo();
  }, [selectedModelId]);

  // ディレクトリ情報が取得されたら初期メッセージを更新（多言語対応）
  // ✅ FIX v10: Added Array.isArray() check to prevent "Cannot read properties of undefined (reading 'length')" error
  // ✅ FIX v13: Added enhanced logging to identify which hook causes currentSession to become undefined
  useEffect(() => {
    console.log('🔍 [useEffect Hook 2: ディレクトリ情報取得] Starting...', {
      hasUserDirectories: !!userDirectories,
      hasCurrentSession: !!currentSession,
      currentSessionId: currentSession?.id,
      hasUser: !!user,
      messagesType: typeof currentSession?.messages,
      messagesIsArray: Array.isArray(currentSession?.messages),
      messagesLength: currentSession?.messages?.length,
      timestamp: Date.now()
    });
    
    // ✅ CRITICAL FIX v10: Check currentSession AND messages is an array before accessing length
    if (!userDirectories || !currentSession || !user) {
      console.log('⚠️ [useEffect Hook 2: ディレクトリ情報取得] Early return - validation failed:', {
        hasUserDirectories: !!userDirectories,
        hasCurrentSession: !!currentSession,
        hasUser: !!user
      });
      return;
    }
    
    if (!Array.isArray(currentSession.messages) || currentSession.messages.length === 0) {
      console.warn('⚠️ [useEffect Hook 2: ディレクトリ情報取得] messages is not an array or empty:', {
        messagesType: typeof currentSession.messages,
        messagesIsArray: Array.isArray(currentSession.messages),
        messagesLength: currentSession.messages?.length
      });
      return;
    }
    
    // 初期メッセージのみを更新（無限ループを防ぐ）
    const firstMessage = currentSession.messages[0];
    const checkText = memoizedLocale === 'en' ? 'FSx for ONTAP Production' : 'FSx for ONTAP実環境';
    
    if (firstMessage && firstMessage.id === '1' && firstMessage.role === 'assistant' && !firstMessage.content.includes(checkText)) {
      // 多言語対応の初期メッセージを生成
      // コンポーネントレベルのtを使用
      const updatedText = generateInitialMessageWithDirectories(
        user.username,
        user.role || 'User',
        userDirectories,
        t  // Use component-level t
      );

      const updatedMessages = [...currentSession.messages];
      updatedMessages[0] = { ...firstMessage, content: updatedText };
      setCurrentSession({ ...currentSession, messages: updatedMessages });
      console.log('✅ [useEffect Hook 2: ディレクトリ情報取得] Updated message');
    } else {
      console.log('⚠️ [useEffect Hook 2: ディレクトリ情報取得] Skipped - message already contains directory info');
    }
    
    console.log('✅ [useEffect Hook 2: ディレクトリ情報取得] Completed successfully');
  }, [userDirectories, memoizedLocale]);

  // ロケール変更時に初期メッセージを更新（Introduction文の言語切り替え対応）
  useEffect(() => {
    if (!currentSession || !user) return;
    if (!Array.isArray(currentSession.messages) || currentSession.messages.length === 0) return;
    
    const firstMessage = currentSession.messages[0];
    if (!firstMessage || firstMessage.id !== '1' || firstMessage.role !== 'assistant') return;
    
    console.log('🌐 [ChatbotPage] ロケール変更検出 - Introduction文を更新:', memoizedLocale);
    
    // KBモード用の初期メッセージを再生成
    const updatedText = userDirectories
      ? generateInitialMessageWithDirectories(user.username, user.role || 'User', userDirectories, t)
      : generateInitialMessage(user.username, user.role || 'User', t);
    
    const updatedMessages = [...currentSession.messages];
    updatedMessages[0] = { ...firstMessage, content: updatedText };
    setCurrentSession({ ...currentSession, messages: updatedMessages });
  }, [memoizedLocale, t]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // エラーアクション処理関数（将来の拡張用）
  // const handleErrorAction = async (actionType: string) => {
  //   // 実装は将来の拡張時に追加
  // };

  const generateRAGResponse = async (query: string): Promise<{ answer: string; citations: CitationItem[] }> => {
    try {
      console.log('📚 [KB] Sending request to Bedrock KB API:', { query: query.substring(0, 100), user: user.username, modelId: selectedModelId });
      
      const currentRegion = typeof window !== 'undefined' 
        ? localStorage.getItem('selectedRegion') || 'ap-northeast-1'
        : 'ap-northeast-1';
      
      const knowledgeBaseId = typeof window !== 'undefined'
        ? localStorage.getItem('selectedKnowledgeBaseId') || process.env.NEXT_PUBLIC_BEDROCK_KB_ID || ''
        : '';
      
      // KB IDが設定されている場合はKB Retrieve APIを使用
      if (knowledgeBaseId) {
        console.log(`📚 [KB] Using KB Retrieve API: knowledgeBaseId=${knowledgeBaseId}`);
        
        const response = await fetch('/api/bedrock/kb/retrieve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            knowledgeBaseId,
            modelId: selectedModelId,
            userId: user.username,
            region: currentRegion,
            sessionId: currentSession?.id,
          }),
        });

        const data = await response.json();

        if (data.success) {
          if (data.filterLog) {
            console.log('🔐 [KB] Permission filter log:', data.filterLog);
          }

          return { answer: data.answer, citations: data.citations || [] };
        }
        
        // KB Retrieve APIがエラーの場合、フォールバック
        console.warn('⚠️ [KB] KB Retrieve API failed, falling back to chat API:', data.error);
      }
      
      // フォールバック: 通常のBedrock Chat API
      console.log(`📚 [KB] Using fallback Chat API`);
      
      const response = await fetch('/api/bedrock/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          userId: user.username,
          modelId: selectedModelId,
          region: currentRegion,
          locale: memoizedLocale,
          sessionId: currentSession?.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        return { answer: data.answer, citations: [] };
      }
      
      // エラーレスポンスの処理
      const errorMessage = typeof data.error === 'string' ? data.error : 
                         data.error?.message || 'Unknown error';
      throw new Error(errorMessage);
    } catch (error) {
      console.error('❌ [KB] Bedrock API Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return { answer: `**Knowledge Base エラー**

• **モデル**: ${getModelById(selectedModelId)?.name || selectedModelId}
• **ユーザー**: ${user.username}
• **リージョン**: ${regionStore.selectedRegion}
• **時刻**: ${new Date().toLocaleString('ja-JP')}

**対処方法:**
1. リージョンを変更してみてください
2. 別のモデルを選択してみてください
3. しばらく待ってから再試行してください

**詳細:** ${errorMessage}`, citations: [] };
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading || !currentSession) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputText,
      role: 'user',
      timestamp: Date.now(),
      sessionId: currentSession.id
    };

    addMessage(userMessage);
    const currentInput = inputText;
    setInputText('');
    setIsLoading(true);

    try {
      // KBモードでRAG処理
      const { answer: responseText, citations } = await generateRAGResponse(currentInput);

      const botMessageId = `bot-${Date.now()}`;
      const botResponse: Message = {
        id: botMessageId,
        content: responseText,
        role: 'assistant',
        timestamp: Date.now(),
        sessionId: currentSession.id
      };

      addMessage(botResponse);

      // Citation情報をボットメッセージIDと紐付けて保存
      if (citations.length > 0) {
        setMessageCitations(prev => ({
          ...prev,
          [botMessageId]: citations,
        }));
      }

      // 履歴保存が有効な場合のみ保存
      if (saveHistory) {
        await saveChatHistory();
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `An error occurred while processing your request.\n\n**Error Details:**\n• System connection timeout\n• Retry count: 3\n• Error code: RAG-500\n\nPlease try again later.`,
        role: 'assistant',
        timestamp: Date.now(),
        sessionId: currentSession.id
      };
      addMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ v16: handleSignOut function with CSRF token support and stable handler attachment
  // Ref is defined at the top with other refs (line ~565)
  // useEffect now uses empty dependency array to prevent handler cleanup during re-renders
  
  const handleSignOut = async () => {
    const signOutVersion = 'v16'; // ✅ v16: Fixed useEffect dependency array (2026-01-19)
    console.log(`🔘 [handleSignOut ${signOutVersion}] Sign-out button clicked!`);
    try {
      // CSRF tokenを取得
      console.log(`🔄 [handleSignOut ${signOutVersion}] Fetching CSRF token...`);
      const csrfResponse = await fetch('/api/auth/csrf-token');
      if (!csrfResponse.ok) {
        const errorText = await csrfResponse.text();
        console.warn(`⚠️ [handleSignOut ${signOutVersion}] Failed to get CSRF token (${csrfResponse.status}):`, errorText);
        throw new Error(`Failed to get CSRF token: ${csrfResponse.status}`);
      }
      const { token: csrfToken } = await csrfResponse.json();
      console.log(`✅ [handleSignOut ${signOutVersion}] CSRF token obtained:`, csrfToken?.substring(0, 20) + '...');

      // サインアウトAPIを呼び出し
      console.log(`🔄 [handleSignOut ${signOutVersion}] Calling sign-out API...`);
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken  // ✅ CSRFトークンをヘッダーに含める
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`⚠️ [handleSignOut ${signOutVersion}] Sign-out API failed (${response.status}):`, errorText);
        throw new Error(`Sign-out failed: ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`✅ [handleSignOut ${signOutVersion}] Sign-out API succeeded:`, result);
    } catch (error) {
      console.error(`❌ [handleSignOut ${signOutVersion}] Sign-out error:`, error);
      // エラーが発生してもローカルクリーンアップは実行
    } finally {
      // ✅ 必ずローカルストレージをクリアしてリダイレクト
      console.log(`🧹 [handleSignOut ${signOutVersion}] Cleaning up local storage and redirecting...`);
      localStorage.removeItem('user');
      localStorage.removeItem('session');
      localStorage.removeItem('chatSessions');
      
      // ✅ useAuthStoreもクリア（Header.tsxのサインアウトボタンと同期）
      useAuthStore.setState({
        isAuthenticated: false,
        session: null,
        isLoading: false
      });
      console.log(`✅ [handleSignOut ${signOutVersion}] useAuthStore cleared`);
      
      // サインインページにリダイレクト
      const redirectUrl = `/${memoizedLocale}/signin`;
      console.log(`🔄 [handleSignOut ${signOutVersion}] Redirecting to ${redirectUrl}`);
      window.location.href = redirectUrl;
    }
  };
  
  // ✅ v17: Attach event handler after user is loaded
  // setTimeout ensures DOM is fully updated before attaching handler
  // Dependency on user ensures handler is attached after user state is loaded
  useEffect(() => {
    // Skip if user is not loaded yet
    if (!user) {
      console.log('⏳ [useEffect v17] Waiting for user to load...');
      return;
    }
    
    console.log('🔧 [useEffect v17] User loaded, attaching sign-out button handler...');
    
    // Use setTimeout with 100ms delay to ensure button is fully rendered
    const timeoutId = setTimeout(() => {
      const button = signOutButtonRef.current;
      
      if (button) {
        console.log('✅ [useEffect v17] Button ref found, attaching onclick handler');
        button.onclick = (e) => {
          e.preventDefault();
          console.log('🔘 [DOM onclick v17] Sign-out button clicked - calling handleSignOut()');
          handleSignOut();
        };
      } else {
        console.warn('⚠️ [useEffect v17] Button ref not found');
      }
    }, 100); // 100ms delay to ensure button is fully rendered
    
    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      const button = signOutButtonRef.current;
      if (button) {
        console.log('🧹 [useEffect v17] Cleaning up onclick handler');
        button.onclick = null;
      }
    };
  }, [user]); // ✅ v17: Dependency on user - attach handler after user is loaded

  // ✅ v5: Early return check AFTER handleSignOut is defined
  if (!isClient || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white dark:bg-gray-900 flex overflow-hidden">
      {/* KBモードサイドバー */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0`}>
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{translations.settingsPanel}</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
            {/* 新しいチャット */}
            <div className="p-3 border-b border-gray-200">
              <button
                onClick={() => {
                  if (!user) return;
                  const sessionTitle = memoizedLocale === 'en' 
                    ? `New Chat - ${new Date().toLocaleDateString('en-US')}`
                    : `新しいチャット - ${new Date().toLocaleDateString('ja-JP')}`;
                  
                  // KBモード用の初期メッセージを生成
                  const initialMessageText = userDirectories
                    ? generateInitialMessageWithDirectories(
                        user.username,
                        user.role || 'User',
                        userDirectories,
                        t
                      )
                    : generateInitialMessage(
                        user.username,
                        user.role || 'User',
                        t
                      );
                  
                  const newSession: ChatSession = {
                    id: `session_${Date.now()}`,
                    title: sessionTitle,
                    messages: [{
                      id: '1',
                      content: initialMessageText,
                      role: 'assistant',
                      timestamp: Date.now()
                    }],
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    userId: user.username
                  };
                  setCurrentSession(newSession);
                  if (saveHistory) {
                    addChatSession(newSession);
                  }
                }}
                className="w-full px-2 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors"
              >
                + {translations.newChat}
              </button>
            </div>

            {/* チャット履歴セクション */}
            {saveHistory && Array.isArray(chatSessions) && chatSessions.length > 0 && (
              <div className="p-2 border-b border-gray-200">
                <h3 className="text-xs font-medium text-gray-700 mb-2">{translations.chatHistory}</h3>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {chatSessions && Array.isArray(chatSessions) && chatSessions.slice(0, 3).map((session: ChatSession) => (
                    <button
                      key={session.id}
                      onClick={() => setCurrentSession(session)}
                      className={`w-full text-left p-1 rounded-md text-xs transition-colors ${currentSession?.id === session.id
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      <div className="font-medium truncate text-xs">{session.title}</div>
                      <div className="text-gray-500 text-xs">
                        {new Date(session.updatedAt).toLocaleDateString('ja-JP')}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ユーザー情報セクション */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{translations.userInfo}</h3>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {user.username} ({user.role || 'User'})
              </div>
            </div>

            {/* FSxディレクトリ情報セクション */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{translations.accessPermissions}</h3>
              {isLoadingDirectories ? (
                <div className="flex items-center space-x-2 text-xs text-gray-600">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                  <span>{translations.loading}</span>
                </div>
              ) : userDirectories ? (
                <div className="space-y-1">
                  <div className="text-xs">
                    <div className="flex items-center space-x-1">
                      {userDirectories.directoryType === 'actual' && <span className="text-green-600">✅</span>}
                      {userDirectories.directoryType === 'test' && <span className="text-blue-600">🧪</span>}
                      {userDirectories.directoryType === 'simulated' && <span className="text-yellow-600">⚠️</span>}
                      {userDirectories.directoryType === 'unavailable' && <span className="text-red-600">❌</span>}
                      <span className="font-medium text-gray-700">
                        {userDirectories.directoryType === 'actual' && translations.fsxEnvironment}
                        {userDirectories.directoryType === 'test' && translations.testEnvironment}
                        {userDirectories.directoryType === 'simulated' && translations.simulation}
                        {userDirectories.directoryType === 'unavailable' && translations.fsxUnavailable}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">
                    <div>📁 {translations.directories.replace('{count}', userDirectories.accessibleDirectories.length.toString())}</div>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={userDirectories.permissions.read ? 'text-green-600' : 'text-red-600'}>
                        {userDirectories.permissions.read ? '✅' : '❌'} {translations.read}
                      </span>
                      <span className={userDirectories.permissions.write ? 'text-green-600' : 'text-red-600'}>
                        {userDirectories.permissions.write ? '✅' : '❌'} {translations.write}
                      </span>
                    </div>
                  </div>
                  {userDirectories.fsxFileSystemId && (
                    <div className="text-xs text-gray-500 mt-1">
                      FSx: {userDirectories.fsxFileSystemId.substring(0, 12)}...
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-gray-600">
                  {translations.loading}
                </div>
              )}
            </div>

            {/* Bedrockリージョン選択セクション */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('region.bedrockRegion')}</h3>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <div>🌍 東京 (ap-northeast-1)</div>
                <div>🤖 37モデル利用可能</div>
                <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs mt-1">
                  {t('region.change')}
                </button>
              </div>
            </div>

            {/* チャット履歴設定セクション */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{translations.chatHistorySettings}</h3>
              <button
                onClick={() => {
                  console.log('[Chatbot] チャット履歴設定切り替え:', !saveHistory);
                  setSaveHistory(!saveHistory);
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
                    <div className="font-medium">{saveHistory ? translations.historySaving : translations.historyDisabled}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {saveHistory ? translations.autoSave : translations.sessionOnly}
                    </div>
                  </div>
                  {saveHistory && <span className="text-green-600 dark:text-green-400">✓</span>}
                </div>
              </button>
            </div>

            {/* 動作モード情報セクション（読み取り専用） */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <div className="font-medium mb-2 text-gray-700 dark:text-gray-300">
                  {translations.operationMode}: 📚 Knowledge Base
                </div>
                <div className="space-y-1 text-blue-700 dark:text-blue-400">
                  <div className="font-medium">{translations.kbFeatures}</div>
                  <div>{translations.kbFeature1}</div>
                  <div>{translations.kbFeature2}</div>
                  <div>{translations.kbFeature3}</div>
                </div>
              </div>
            </div>

            {/* AIモデル選択セクション */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              {/* ✅ Task 2 Fix: Agent mode時も通常のModelSelectorを使用 */}
              <ModelSelector
                mode="kb"
                selectedModelId={selectedModelId}
                onModelChange={setSelectedModelId}
                showAdvancedFilters={true}
              />
            </div>

            {/* 権限制御状態セクション */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{translations.permissionControl}</h3>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-green-600">✅</span>
                  <span className="text-xs text-gray-600">{translations.available}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-blue-600">🔐</span>
                  <span className="text-xs text-gray-600">{translations.permissionControl}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {translations.requestAccess}
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        {/* ヘッダー */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 flex-shrink-0">
          <div className="px-3 sm:px-4 lg:px-6">
            <div className="flex justify-between items-center h-14">
              <div className="flex items-center">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 mr-2 transition-colors"
                  title={sidebarOpen ? translations.sidebarToggleClose : translations.sidebarToggleOpen}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div className="flex items-center space-x-3">
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{translations.title}</h1>
                  
                  {/* 新しいチャットボタン */}
                  <button
                    onClick={() => {
                      if (!user) return;
                      
                      // Knowledge Baseモード用の初期メッセージ
                      let initialMessageText: string;
                      if (userDirectories) {
                        initialMessageText = generateInitialMessageWithDirectories(
                          user.username,
                          user.role || 'User',
                          userDirectories,
                          t
                        );
                      } else {
                        initialMessageText = generateInitialMessage(
                          user.username,
                          user.role || 'User',
                          t
                        );
                      }
                      
                      const initialMessages: Message[] = [{
                        id: '1',
                        content: initialMessageText,
                        role: 'assistant',
                        timestamp: Date.now()
                      }];
                      
                      const newSession: ChatSession = {
                        id: Date.now().toString(),
                        title: translations.newChat,
                        messages: initialMessages,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        userId: user.username,
                      };
                      setCurrentSession(newSession);
                      addChatSession(newSession);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors flex items-center space-x-1 shadow-sm"
                    title={translations.newChatShortcut}
                  >
                    <span>➕</span>
                    <span>{translations.newChat}</span>
                  </button>
                  <div className="flex items-center space-x-2">
                    {saveHistory && (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                        {translations.historySaving}
                      </span>
                    )}
                    <span className="px-2 py-1 text-sm bg-blue-100 text-blue-900 rounded-full font-medium">
                      {selectedModelName}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {/* 言語切り替え */}
                <LanguageSwitcher currentLocale={memoizedLocale} variant="dropdown" />
                
                {/* KBモード表示 */}
                <span className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <span>📚</span>
                  <span>Knowledge Base</span>
                </span>
                
                <ThemeToggle variant="icon" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('auth.welcomeMessage', { username: user?.username })}
                </span>
                <button
                  ref={signOutButtonRef}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  {translations.signOutButton}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* チャットエリア */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* メッセージリスト */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-4 bg-white dark:bg-gray-900">
            {(() => {
              console.log('🎨 [ChatbotPage] Rendering messages area:', {
                hasCurrentSession: !!currentSession,
                currentSessionId: currentSession?.id,
                messagesCount: currentSession?.messages?.length,
                messagesIsArray: Array.isArray(currentSession?.messages),
              });
              return null;
            })()}
            
            {!currentSession && (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                ⚠️ No current session (currentSession is null/undefined)
              </div>
            )}
            
            {currentSession && (!currentSession.messages || !Array.isArray(currentSession.messages) || currentSession.messages.length === 0) && (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                ⚠️ No messages in session (messages: {JSON.stringify({
                  exists: !!currentSession.messages,
                  isArray: Array.isArray(currentSession.messages),
                  length: currentSession.messages?.length
                })})
              </div>
            )}
            
            {currentSession?.messages?.map((message: Message, index) => {
              console.log(`🎨 [ChatbotPage v17] Rendering message ${index}:`, {
                id: message.id,
                role: message.role,
                contentType: typeof message.content,
                contentLength: message.content?.length,
                contentPreview: message.content?.substring(0, 50)
              });
              
              return (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-sm md:max-w-md lg:max-w-lg xl:max-w-2xl px-4 py-3 rounded-lg ${message.role === 'user'
                      ? 'bg-blue-600 text-white mr-2'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm border dark:border-gray-700 ml-2'
                      }`}
                  >
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      <MessageContent content={message.content} />
                    </div>
                    {/* Citation表示（アシスタントメッセージのみ） */}
                    {message.role === 'assistant' && messageCitations[message.id] && (
                      <CitationDisplay citations={messageCitations[message.id]} />
                    )}
                    <p className={`text-xs mt-2 ${message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                      {message.timestamp ? new Date(message.timestamp).toLocaleTimeString('ja-JP') : ''}
                    </p>
                  </div>
                </div>
              );
            })}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-900 shadow-sm border rounded-lg px-4 py-3 ml-2">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <div className="text-sm">
                      {translations.loading}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 入力エリア */}
          <div className="border-t dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex-shrink-0">
            <form onSubmit={handleSendMessage} className="flex space-x-3 max-w-4xl mx-auto">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={translations.inputPlaceholder}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-sm"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !inputText.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {translations.send}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// Suspenseでラップしたメインコンポーネント
export default function ChatbotPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }>
        <ChatbotPageContent />
      </Suspense>
    </ErrorBoundary>
  );
}
