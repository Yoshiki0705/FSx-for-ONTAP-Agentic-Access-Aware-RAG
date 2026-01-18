'use client';

import { ErrorBoundary } from '../../../components/ui/ErrorBoundary';

// Force dynamic rendering to prevent SSR errors with client-only hooks
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useChatStore } from '../../../store';
import type { Message, ChatSession } from '../../../store';
import { useAuthStore } from '../../../store/useAuthStore';
import { useRegionStore } from '../../../store/useRegionStore';
import { ModelSelector } from '../../../components/bedrock/ModelSelector';
import { RegionSelector } from '../../../components/bedrock/RegionSelector';
import { AgentModelSelector } from '../../../components/bedrock/AgentModelSelector';
import { DEFAULT_MODEL_ID, getModelById } from '../../../config/bedrock-models';
import { ThemeToggle } from '../../../components/ui/ThemeToggle';
import { AgentTraceDisplay } from '../../../components/chat/AgentTraceDisplay';
import { SessionAttributesPanel } from '../../../components/chat/SessionAttributesPanel';
import { MessageContent } from '../../../components/chat/MessageContent';
import { useAgentMode, useAgentTraces, useSessionAttributes, useAgentUI } from '../../../hooks/useAgentMode';
import { useAgentInfo } from '../../../hooks/useAgentInfo';
import { useThemeStore, initializeThemeListener } from '../../../store/useThemeStore';
import { ModeSwitchableSidebar } from '../../../components/sidebar/ModeSwitchableSidebar';
import { LanguageSwitcher } from '../../../components/ui/LanguageSwitcher';
import { ModeSwitcher } from '../../../components/ui/ModeSwitcher';

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

// 初期メッセージ生成関数（ロケール対応・i18n対応）
// 2026-01-14: Enhanced null safety to prevent undefined errors
// 2026-01-14 v4: Added comprehensive logging and defensive checks
const generateInitialMessage = (
  username: string, 
  role: string, 
  t: any  // useTranslations() - ルートレベルの翻訳フック
): string => {
  console.log('🔍 [generateInitialMessage] Starting...', { 
    username, 
    role, 
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

    const message = `${t('introduction.welcome', { username })}

**${t('introduction.title')}**

**${t('introduction.yourPermissions')}**
• **${t('introduction.user')}**: ${username}
• **${t('introduction.role')}**: ${role || 'User'}
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

// Agentモード用の初期メッセージ生成関数（Agent情報付き）
// 2026-01-14: Enhanced null safety to prevent "Cannot read properties of undefined" errors
// 2026-01-14 v4: Added comprehensive logging and defensive checks
const generateAgentModeInitialMessage = (
  username: string,
  role: string,
  userDirectories: any,
  agentInfo: any,
  t: any,      // useTranslations() - ルートレベルの翻訳フック
  tAgent: any  // useTranslations('agent') - Agent情報用
): string => {
  console.log('🔍 [generateAgentModeInitialMessage] Starting...', { 
    username, 
    role, 
    hasUserDirectories: !!userDirectories,
    hasAgentInfo: !!agentInfo,
    hasT: !!t, 
    hasTAgent: !!tAgent,
    tType: typeof t,
    tAgentType: typeof tAgent
  });

  // ✅ Validate all parameters to prevent undefined errors
  if (!t || typeof t !== 'function') {
    console.error('❌ [generateAgentModeInitialMessage] Invalid t function:', t);
    return `Welcome to Agent Mode, ${username}!\n\nTranslation system is not available. Please reload the page.`;
  }
  
  if (!tAgent || typeof tAgent !== 'function') {
    console.error('❌ [generateAgentModeInitialMessage] Invalid tAgent function:', tAgent);
    return `Welcome to Agent Mode, ${username}!\n\nAgent translation system is not available. Please reload the page.`;
  }

  let baseMessage: string;
  
  try {
    baseMessage = userDirectories 
      ? generateInitialMessageWithDirectories(username, role, userDirectories, t)
      : generateInitialMessage(username, role, t);

    console.log('✅ [generateAgentModeInitialMessage] Base message generated, length:', baseMessage?.length);
  } catch (error) {
    console.error('❌ [generateAgentModeInitialMessage] Error generating base message:', error);
    baseMessage = `Welcome, ${username}!\n\nError generating base message: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }

  // ✅ Validate baseMessage before proceeding
  if (!baseMessage || typeof baseMessage !== 'string') {
    console.error('❌ [generateAgentModeInitialMessage] Invalid baseMessage:', baseMessage);
    return `Welcome to Agent Mode, ${username}!\n\nError: Failed to generate base message`;
  }

  // Agent情報が利用可能な場合は追加（動的Agent情報を使用）
  if (agentInfo && typeof agentInfo === 'object') {
    try {
      console.log('🤖 [generateAgentModeInitialMessage] Adding agent info section...', {
        agentId: agentInfo.agentId,
        agentName: agentInfo.agentName,
        status: agentInfo.agentStatus || agentInfo.status
      });

      // Test tAgent function before using it
      const testTranslation = tAgent('information');
      console.log('✅ [generateAgentModeInitialMessage] tAgent test passed:', testTranslation);

      const agentSection = `

**🤖 ${tAgent('information')}**
• **${tAgent('agentId')}**: ${agentInfo.agentId || 'N/A'}
• **${tAgent('agentName')}**: ${agentInfo.agentName || agentInfo.name || 'N/A'}
• **${tAgent('version')}**: ${agentInfo.agentVersion || agentInfo.latestAgentVersion || 'N/A'}
• **${tAgent('status')}**: ${agentInfo.agentStatus || agentInfo.status || 'N/A'}
• **${tAgent('model')}**: ${agentInfo.foundationModel || 'N/A'}
• **${tAgent('lastUpdated')}**: ${agentInfo.updatedAt ? new Date(agentInfo.updatedAt).toLocaleDateString('ja-JP') : 'N/A'}

**🧠 ${tAgent('features')}**
• **${tAgent('multiStepReasoning')}**: ${tAgent('multiStepReasoningDesc')}
• **${tAgent('automaticDocumentSearch')}**: ${tAgent('automaticDocumentSearchDesc')}
• **${tAgent('contextOptimization')}**: ${tAgent('contextOptimizationDesc')}

${tAgent('modeDescription')}`;

      console.log('✅ [generateAgentModeInitialMessage] Agent section generated, length:', agentSection?.length);
      return baseMessage + agentSection;
    } catch (error) {
      console.error('❌ [generateAgentModeInitialMessage] Error generating agent section:', error);
      // Fallback to base message if agent section generation fails
      return baseMessage + `\n\n**Agent Mode**\n\nError loading agent information: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  // Agent情報が利用できない場合のフォールバック
  try {
    console.log('⚠️ [generateAgentModeInitialMessage] No agent info, using fallback...');

    const agentFallbackSection = `

**🤖 ${tAgent('information')}**
${tAgent('modeDescription')}

**🧠 ${tAgent('features')}**
• **${tAgent('multiStepReasoning')}**: ${tAgent('multiStepReasoningDesc')}
• **${tAgent('automaticDocumentSearch')}**: ${tAgent('automaticDocumentSearchDesc')}
• **${tAgent('contextOptimization')}**: ${tAgent('contextOptimizationDesc')}`;

    console.log('✅ [generateAgentModeInitialMessage] Fallback section generated');
    return baseMessage + agentFallbackSection;
  } catch (error) {
    console.error('❌ [generateAgentModeInitialMessage] Error generating fallback section:', error);
    // Return base message if fallback generation fails
    return baseMessage + `\n\n**Agent Mode**\n\nLoading agent information...`;
  }
};
// 2026-01-14: Enhanced null safety to prevent undefined errors
// 2026-01-14 v4: Added comprehensive logging and defensive checks
const generateInitialMessageWithDirectories = (
  username: string,
  role: string,
  userDirectories: any,
  t: any  // useTranslations() - ルートレベルの翻訳フック
): string => {
  console.log('🔍 [generateInitialMessageWithDirectories] Starting...', { 
    username, 
    role, 
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
    return generateInitialMessage(username, role, t);
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

    const message = `${t('introduction.welcome', { username })}

**${t('introduction.title')}**

**${t('introduction.yourPermissions')}**
• **${t('introduction.user')}**: ${username}
• **${t('introduction.role')}**: ${role || 'User'}
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
  const tAgent = useTranslations('agent');  // Agent情報用の翻訳フック
  
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
    agentModeLabel: t('chat.agentModeLabel'),
    showTrace: t('chat.showTrace'),
    showSessionAttributes: t('chat.showSessionAttributes'),
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
    
    // Agent features (use existing keys)
    agentFeatures: t('agent.features'),
    agentFeature1: t('agent.multiStepReasoning'),
    agentFeature2: t('agent.automaticDocumentSearch'),
    agentFeature3: t('agent.contextOptimization'),  // 修正: permissionAwareAccess → contextOptimization
  }), [t]);
  
  // Zustandストアを強制的に初期化（Next.js 15のTree Shaking対策）
  const regionStore = useRegionStore();
  
  // ✅ 2026-01-17: useAuthStoreと同期してuser stateを管理
  const { session, isAuthenticated } = useAuthStore();
  
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);
  
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
  const lastAgentModeRef = useRef<boolean | null>(null); // ✅ Track last agent mode to detect changes
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
    selectedAgentId,
    setSelectedAgentId
  } = useChatStore();
  
  // Agent関連の状態管理（カスタムフック使用）
  const { agentMode, setAgentMode } = useAgentMode();
  const { agentTraces, setAgentTraces } = useAgentTraces();
  const { sessionAttributes, setSessionAttributes } = useSessionAttributes();
  const { showAgentTrace, setShowAgentTrace, showSessionAttributes, setShowSessionAttributes } = useAgentUI();
  
  // 環境変数からAgent IDを取得
  const agentId = typeof window !== 'undefined' 
    ? process.env.NEXT_PUBLIC_BEDROCK_AGENT_ID || ''
    : '';
  
  // Agent情報を取得（Agentモード時のみ）
  const { agentInfo } = useAgentInfo({
    agentId,
    enabled: agentMode && !!agentId,
    onSuccess: (data) => {
      console.log('✅ [ChatbotPage] Agent情報取得成功:', data);
      // モデル名を更新
      if (data.foundationModel) {
        setSelectedModelId(data.foundationModel);
      }
    },
    onError: (error) => {
      console.error('❌ [ChatbotPage] Agent情報取得エラー:', error);
    }
  });
  
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
        } else {
          // localStorageにない場合は、セッションAPIで確認
          const response = await fetch('/api/auth/session');
          const data = await response.json();
          
          if (!data.success || !data.session) {
            console.error('認証失敗: セッションが見つかりません');
            router.push('/signin');
            return;
          }
          
          // セッションAPIから取得したユーザー情報を使用
          // ✅ 実際のAPIレスポンス構造: data.session.{sessionId, userId, username, expiresAt}
          parsedUser = {
            username: data.session.username,
            userId: data.session.userId,
            role: 'user',
            permissions: []
          };
          
          // localStorageにも保存（次回のため）
          localStorage.setItem('user', JSON.stringify(parsedUser));
        }
        
        setUser(parsedUser);

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

        // 新しいセッションの作成（既存セッションがない場合）
        if (!currentSession) {
          console.log('🔄 [ChatbotPage] Creating new session...', {
            hasT: !!t,
            hasTAgent: !!tAgent,
            locale: memoizedLocale
          });

          const sessionTitle = memoizedLocale === 'en' 
            ? `Chat - ${new Date().toLocaleDateString('en-US')}`
            : `チャット - ${new Date().toLocaleDateString('ja-JP')}`;
            
          // 初期メッセージはクライアントサイドで生成（hydration mismatch回避）
          // Agentモードかどうかで初期メッセージを切り替え
          let initialMessageText: string;
          
          // URLからAgentモードかどうかを判定
          const urlParams = new URLSearchParams(window.location.search);
          const isAgentMode = urlParams.get('mode') === 'agent';
          
          console.log('🔍 [ChatbotPage] Initial session mode detection:', {
            isAgentMode,
            urlMode: urlParams.get('mode'),
            hasAgentInfo: !!agentInfo
          });
          
          if (isAgentMode) {
            console.log('🤖 [ChatbotPage] Generating Agent mode initial message...');
            // Agentモード用の初期メッセージ（Agent情報は後で更新）
            try {
              initialMessageText = generateAgentModeInitialMessage(
                parsedUser?.username || 'Unknown',  // ✅ 2026-01-17: Null safety
                parsedUser?.role || 'User',
                null, // userDirectoriesは後で更新
                null, // agentInfoは後で更新
                t, // Introduction用翻訳フック
                tAgent // Agent情報用翻訳フック
              );
              console.log('✅ [ChatbotPage] Agent mode initial message generated, length:', initialMessageText?.length);
            } catch (error) {
              console.error('❌ [ChatbotPage] Error generating Agent mode initial message:', error);
              initialMessageText = `Welcome to Agent Mode, ${parsedUser.username}!\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
          } else {
            console.log('📚 [ChatbotPage] Generating KB mode initial message...');
            // 通常の初期メッセージ
            try {
              initialMessageText = generateInitialMessage(
                parsedUser.username,
                parsedUser.role || 'User',
                t
              );
              console.log('✅ [ChatbotPage] KB mode initial message generated, length:', initialMessageText?.length);
            } catch (error) {
              console.error('❌ [ChatbotPage] Error generating KB mode initial message:', error);
              initialMessageText = `Welcome, ${parsedUser.username}!\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
          }
          
          console.log('🔍 [ChatbotPage] Initial message text preview:', initialMessageText?.substring(0, 100));
          
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

  // Agent選択変更イベントリスナー（Issue 3対応）
  useEffect(() => {
    const handleAgentSelectionChange = (event: CustomEvent) => {
      const { agentInfo, executionStatus, progressReport } = event.detail;
      console.log('🤖 [ChatbotPage] Agent選択変更イベント受信:', {
        hasAgentInfo: !!agentInfo,
        agentId: agentInfo?.agentId,
        hasExecutionStatus: !!executionStatus,
        hasProgressReport: !!progressReport,
        timestamp: event.detail.timestamp
      });
      
      // Introduction textを即座に更新（agentInfoがnullの場合も含む）
      // ✅ CRITICAL FIX: Check if messages is an array before accessing length
      if (agentMode && currentSession && user && Array.isArray(currentSession.messages) && currentSession.messages.length > 0) {
        const firstMessage = currentSession.messages[0];
        
        if (firstMessage && firstMessage.id === '1' && firstMessage.role === 'assistant') {
          console.log('🔄 [ChatbotPage] Agent選択変更によるIntroduction文更新:', agentInfo?.agentId || 'null (Agent選択解除)');
          
          try {
            const updatedText = generateAgentModeInitialMessage(
              user?.username || 'Unknown',  // ✅ 2026-01-17: Null safety
              user?.role || 'User',
              userDirectories,
              agentInfo, // 選択されたAgent情報を使用（nullの場合はフォールバック表示）
              t, // Introduction用翻訳フック
              tAgent // Agent情報用翻訳フック
            );
            
            console.log('✅ [ChatbotPage] Introduction文生成完了, length:', updatedText?.length);
            
            // ✅ FIX v4: Remove Session ID check to allow state update
            // メッセージを更新（新しいオブジェクト参照を作成してReactの再レンダリングを確実にトリガー）
            setCurrentSession(prevSession => {
              // ✅ Only check if prevSession exists and has valid messages array
              if (!prevSession || !Array.isArray(prevSession.messages)) {
                console.warn('⚠️ [ChatbotPage] Invalid session state, skipping update');
                return prevSession;
              }
              
              const updatedMessages = [...prevSession.messages];
              updatedMessages[0] = { 
                ...firstMessage, 
                content: updatedText,
                timestamp: Date.now(),
                updatedAt: Date.now()  // ✅ 追加: 更新時刻を記録
              };
              
              const newSession = { 
                ...prevSession, 
                messages: updatedMessages,
                updatedAt: Date.now()
              };
              
              console.log('✅ [ChatbotPage] Session state updated:', {
                sessionId: newSession.id,
                messageCount: newSession.messages.length,
                firstMessageLength: newSession.messages[0]?.content?.length
              });
              
              return newSession;
            });
            
            console.log('✅ [ChatbotPage] Agent選択変更によるIntroduction文更新完了');
          } catch (error) {
            console.error('❌ [ChatbotPage] Introduction文更新エラー:', error);
          }
        }
      } else {
        console.warn('⚠️ [ChatbotPage] Introduction文更新スキップ:', {
          agentMode,
          hasCurrentSession: !!currentSession,
          hasUser: !!user,
          messagesIsArray: Array.isArray(currentSession?.messages),
          messagesLength: currentSession?.messages?.length
        });
      }
    };

    window.addEventListener('agent-selection-changed', handleAgentSelectionChange as EventListener);
    console.log('👂 [ChatbotPage] agent-selection-changedイベントリスナー登録');
    
    return () => {
      window.removeEventListener('agent-selection-changed', handleAgentSelectionChange as EventListener);
      console.log('🔇 [ChatbotPage] agent-selection-changedイベントリスナー解除');
    };
  }, [agentMode, currentSession, user, userDirectories, t, tAgent]);  // ✅ FIX v3: currentSession全体を依存配列に追加

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

  // Agent情報が取得されたときにIntroduction Textを更新（Agentモード時のみ）
  useEffect(() => {
    // ✅ CRITICAL FIX: Check if messages is an array before accessing length
    if (agentMode && agentInfo && currentSession && user && Array.isArray(currentSession.messages) && currentSession.messages.length > 0) {
      const firstMessage = currentSession.messages[0];
      
      if (firstMessage && firstMessage.id === '1' && firstMessage.role === 'assistant') {
        console.log('🤖 [ChatbotPage] Agent情報取得完了 - Introduction文を更新:', agentInfo);
        
        // Agent情報を含む初期メッセージを生成
        const updatedText = generateAgentModeInitialMessage(
          user?.username || 'Unknown',  // ✅ 2026-01-17: Null safety
          user?.role || 'User',
          userDirectories,
          agentInfo,
          t, // Introduction用翻訳フック
          tAgent // Agent情報用翻訳フック
        );
        
        // メッセージを更新（新しいオブジェクトを作成して状態更新を確実にする）
        setCurrentSession(prevSession => {
          if (!prevSession || prevSession.id !== currentSession.id) return prevSession;
          
          const updatedMessages = [...prevSession.messages];
          updatedMessages[0] = { 
            ...firstMessage, 
            content: updatedText,
            timestamp: Date.now() // タイムスタンプを更新して変更を明確にする
          };
          
          return { 
            ...prevSession, 
            messages: updatedMessages,
            updatedAt: Date.now()
          };
        });
        
        console.log('✅ [ChatbotPage] Agent情報付きIntroduction文を更新完了');
      }
    }
  }, [agentMode, agentInfo, currentSession?.id, user?.username, userDirectories, t, tAgent]); // ✅ FIX: Add tAgent to dependency array

  // ディレクトリ情報が取得されたら初期メッセージを更新（多言語対応）
  useEffect(() => {
    // ✅ CRITICAL FIX: Check if messages is an array before accessing length
    if (userDirectories && currentSession && user && Array.isArray(currentSession.messages) && currentSession.messages.length > 0) {
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
      }
    }
  }, [userDirectories, memoizedLocale]);

  // モード切り替え時にIntroduction Textを更新
  useEffect(() => {
    // ✅ FIX: Only update if mode actually changed (prevent infinite loop)
    if (lastAgentModeRef.current === agentMode) {
      console.log('🔍 [ChatbotPage] モード変更なし - スキップ:', { agentMode });
      return;
    }
    
    // Update the ref to track current mode
    lastAgentModeRef.current = agentMode;
    
    // ✅ CRITICAL FIX: Early return if user is null to prevent "Cannot read properties of null" error
    if (!user) {
      console.log('⚠️ [ChatbotPage] User is null, skipping mode switch initialization');
      return;
    }
    
    // ✅ FIX: セッションが存在しない場合は新しいセッションを作成
    if (!currentSession) {
      console.log('🆕 [ChatbotPage] モード切り替え時にセッションが存在しないため、新規作成:', { agentMode });
      
      const sessionTitle = memoizedLocale === 'en' 
        ? `Chat - ${new Date().toLocaleDateString('en-US')}`
        : `チャット - ${new Date().toLocaleDateString('ja-JP')}`;
      
      let initialMessageText: string;
      
      if (agentMode) {
        // Agentモード: Agent情報を含む初期メッセージ
        initialMessageText = generateAgentModeInitialMessage(
          user.username,  // ✅ Safe: user is not null here
          user.role || 'User',
          userDirectories,
          agentInfo,
          t,
          tAgent
        );
      } else {
        // Knowledge Baseモード: 通常の初期メッセージ
        if (userDirectories) {
          initialMessageText = generateInitialMessageWithDirectories(
            user.username,  // ✅ Safe: user is not null here
            user.role || 'User',
            userDirectories,
            t
          );
        } else {
          initialMessageText = generateInitialMessage(
            user.username,  // ✅ Safe: user is not null here
            user.role || 'User',
            t
          );
        }
      }
      
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: sessionTitle,
        messages: [
          {
            id: '1',
            role: 'assistant',
            content: initialMessageText,
            timestamp: Date.now()
          }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      setCurrentSession(newSession);
      console.log('✅ [ChatbotPage] モード切り替え時に新規セッション作成完了');
      return;
    }
    
    // ✅ CRITICAL FIX: Check if messages is an array before accessing length
    if (!Array.isArray(currentSession.messages) || currentSession.messages.length === 0) {
      console.log('⚠️ [ChatbotPage] セッションは存在するがメッセージが空のため、初期メッセージを追加');
      
      let initialMessageText: string;
      
      if (agentMode) {
        initialMessageText = generateAgentModeInitialMessage(
          user?.username || 'Unknown',  // ✅ 2026-01-17: Null safety
          user?.role || 'User',
          userDirectories,
          agentInfo,
          t,
          tAgent
        );
      } else {
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
      }
      
      setCurrentSession(prevSession => ({
        ...prevSession!,
        messages: [
          {
            id: '1',
            role: 'assistant',
            content: initialMessageText,
            timestamp: Date.now()
          }
        ],
        updatedAt: Date.now()
      }));
      
      console.log('✅ [ChatbotPage] 初期メッセージ追加完了');
      return;
    }
    
    const firstMessage = currentSession.messages[0];
    
    if (firstMessage && firstMessage.id === '1' && firstMessage.role === 'assistant') {
      console.log('🔄 [ChatbotPage] モード切り替え検出 - Introduction文を更新:', { agentMode, hasAgentInfo: !!agentInfo });
      
      let updatedText: string;
      
      if (agentMode) {
        // Agentモード: Agent情報を含む初期メッセージ
        updatedText = generateAgentModeInitialMessage(
          user.username,
          user.role || 'User',
          userDirectories,
          agentInfo,
          t, // Introduction用翻訳フック
          tAgent // Agent情報用翻訳フック
        );
      } else {
        // Knowledge Baseモード: 通常の初期メッセージ
        if (userDirectories) {
          updatedText = generateInitialMessageWithDirectories(
            user.username,
            user.role || 'User',
            userDirectories,
            t // Introduction用翻訳フック
          );
        } else {
          updatedText = generateInitialMessage(
            user.username,
            user.role || 'User',
            t // Introduction用翻訳フック
          );
        }
      }
      
      // メッセージを更新（状態更新を確実にする）
      setCurrentSession(prevSession => {
        if (!prevSession) return prevSession;
        
        const updatedMessages = [...prevSession.messages];
        updatedMessages[0] = { 
          ...firstMessage, 
          content: updatedText,
          timestamp: Date.now()
        };
        
        return { 
          ...prevSession, 
          messages: updatedMessages,
          updatedAt: Date.now()
        };
      });
      
      console.log('✅ [ChatbotPage] モード切り替えによるIntroduction文更新完了');
    }
  }, [agentMode, user, userDirectories, agentInfo, t, tAgent]); // ✅ FIX: Add all dependencies including tAgent

  // ロケール変更時に初期メッセージを更新（Introduction文の言語切り替え対応）
  useEffect(() => {
    // ✅ CRITICAL FIX: Check if messages is an array before accessing length
    if (!currentSession || !user || !Array.isArray(currentSession.messages) || currentSession.messages.length === 0) return;
    
    // 初期メッセージのみを更新（無限ループを防ぐ）
    const firstMessage = currentSession.messages[0];
    
    if (firstMessage && firstMessage.id === '1' && firstMessage.role === 'assistant') {
      console.log('🌐 [ChatbotPage] ロケール変更検出 - Introduction文を更新:', memoizedLocale);
      
      let updatedText: string;
      
      if (agentMode) {
        // Agentモード: Agent情報を含む初期メッセージ
        updatedText = generateAgentModeInitialMessage(
          user.username,
          user.role || 'User',
          userDirectories,
          agentInfo,
          t, // Introduction用翻訳フック
          tAgent // Agent情報用翻訳フック
        );
      } else {
        // Knowledge Baseモード: 通常の初期メッセージ
        if (userDirectories) {
          updatedText = generateInitialMessageWithDirectories(
            user.username,
            user.role || 'User',
            userDirectories,
            t // Introduction用翻訳フック
          );
        } else {
          updatedText = generateInitialMessage(
            user.username,
            user.role || 'User',
            t // Introduction用翻訳フック
          );
        }
      }
      
      // メッセージを更新
      const updatedMessages = [...currentSession.messages];
      updatedMessages[0] = { ...firstMessage, content: updatedText };
      setCurrentSession({ ...currentSession, messages: updatedMessages });
      
      console.log('✅ [ChatbotPage] Introduction文を更新完了');
    }
  }, [memoizedLocale, agentMode, agentInfo, t, tAgent]); // ✅ FIX: Add tAgent to dependency array

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // エラーアクション処理関数（将来の拡張用）
  // const handleErrorAction = async (actionType: string) => {
  //   // 実装は将来の拡張時に追加
  // };

  const generateAgentResponse = async (query: string): Promise<string> => {
    try {
      console.log('🤖 [Agent] Sending request to Bedrock Agent API:', { 
        query: query.substring(0, 100), 
        user: user.username,
        sessionId: currentSession?.id,
        selectedAgentId: selectedAgentId, // ✅ Add selected Agent ID
        sessionAttributes: sessionAttributes,
        locale: memoizedLocale,
        region: regionStore.selectedRegion
      });
      
      const response = await fetch('/api/bedrock/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: query,
          userId: user.username,
          sessionId: currentSession?.id,
          selectedAgentId: selectedAgentId, // ✅ Add selected Agent ID
          region: regionStore.selectedRegion, // リージョンパラメータを追加
          locale: memoizedLocale, // メモ化された検証済みロケールを追加
          sessionAttributes: sessionAttributes, // セッション属性を送信
          enableTrace: true, // トレースを有効化
        }),
      });

      console.log('🤖 [Agent] Bedrock Agent API response status:', response.status);

      const data = await response.json();
      console.log('✅ [Agent] Bedrock Agent API response data:', { 
        success: data.success, 
        answerLength: data.answer?.length,
        hasTrace: !!data.trace,
        hasSessionAttributes: !!data.sessionAttributes,
        hasError: !!data.error
      });

      if (data.success) {
        // トレース情報を保存
        if (data.trace) {
          console.log('📊 [Agent] Trace received:', data.trace);
          setAgentTraces(prev => [...prev, {
            timestamp: Date.now(),
            query: query,
            trace: data.trace
          }]);
        }
        
        // セッション属性を更新
        if (data.sessionAttributes) {
          console.log('💾 [Agent] Session attributes updated:', data.sessionAttributes);
          setSessionAttributes(data.sessionAttributes);
        }
        
        return data.answer;
      } else {
        // エラーレスポンスの処理
        console.error('❌ [Agent] Bedrock Agent API error response:', data);
        
        // 構造化エラーがある場合はユーザーフレンドリーなメッセージを表示
        if (data.error && typeof data.error === 'object') {
          const errorData = data.error;
          let message = '';
          
          // ユーザーフレンドリーメッセージを優先
          if (errorData.userFriendlyMessage) {
            message += `${errorData.userFriendlyMessage}\n\n`;
          } else if (errorData.message) {
            message += `${errorData.message}\n\n`;
          }
          
          if (errorData.actionRequired) {
            message += `**Action Required:**\n${errorData.actionRequired}\n\n`;
          }
          
          if (errorData.availableRegionsDisplay && errorData.availableRegionsDisplay.length > 0) {
            message += `**Available Regions:**\n`;
            errorData.availableRegionsDisplay.forEach((region: any) => {
              message += `• ${region.flag} ${region.name}\n`;
            });
            message += `\n`;
          }
          
          if (errorData.suggestions && errorData.suggestions.length > 0) {
            message += `**Solutions:**\n`;
            errorData.suggestions.forEach((suggestion: any, index: number) => {
              if (typeof suggestion === 'object' && suggestion.title) {
                message += `${index + 1}. **${suggestion.title}**\n   ${suggestion.description}\n\n`;
              } else {
                message += `${index + 1}. ${suggestion}\n\n`;
              }
            });
          }
          
          // 追加の説明とガイダンス
          message += `**Hints:**\n`;
          message += `• Try changing the region from the sidebar\n`;
          message += `• Switch to Knowledge Base mode if Agent mode is unavailable\n`;
          message += `• Contact your administrator for access to restricted models`;
          
          return message;
        }
        
        // フォールバック: 従来のエラー処理
        const errorMessage = data.error?.message || data.error || 'Unknown error';
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('❌ [Agent] Bedrock Agent API Error:', error);
      
      // フォールバック: 従来のエラーメッセージ
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return `**Error Occurred**

**Details:**
• Message: ${errorMessage}
• User: ${user.username}
• Session ID: ${currentSession?.id}
• Timestamp: ${new Date().toLocaleString(memoizedLocale === 'ja' ? 'ja-JP' : 'en-US')}

**Solutions:**
1. **Switch to Knowledge Base mode**
2. **Try a different region**
3. **Contact administrator if the problem persists**`;
    }
  };

  const generateRAGResponse = async (query: string): Promise<string> => {
    try {
      console.log('Sending request to Bedrock API:', { query: query.substring(0, 100), user: user.username, modelId: selectedModelId, agentMode });
      
      // localStorageから現在のリージョンを取得
      const currentRegion = typeof window !== 'undefined' 
        ? localStorage.getItem('selectedRegion') || 'us-east-1'
        : 'us-east-1';
      
      console.log(`[ChatbotPage] Sending chat request with region: ${currentRegion}, agentMode: ${agentMode}`);
      
      // Agent/KBモードに応じてAPIエンドポイントを切り替え
      const apiEndpoint = agentMode ? '/api/bedrock/agent' : '/api/bedrock/chat';
      console.log(`[ChatbotPage] Using API endpoint: ${apiEndpoint}`);
      
      // 実際のBedrock API呼び出し
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: query,
          userId: user.username,
          permissions: user.permissions || ['基本機能'],
          modelId: selectedModelId,
          region: currentRegion,
          locale: memoizedLocale, // メモ化された検証済みロケールを追加
          sessionId: currentSession?.id,
          sessionAttributes: agentMode ? sessionAttributes : undefined
        }),
      });

      console.log('Bedrock API response status:', response.status);

      const data = await response.json();
      console.log('Bedrock API response data:', data);

      if (data.success) {
        // エラーアクションをクリア（将来の拡張用）
        // setErrorActions([]);
        // setActionMessage('');
        
        // Agentモードの場合、トレースとセッション属性を保存
        if (agentMode && data.agentTrace) {
          console.log('[ChatbotPage] Agent trace received:', data.agentTrace);
          setAgentTraces(prev => [...prev, data.agentTrace]);
        }
        
        if (agentMode && data.sessionAttributes) {
          console.log('[ChatbotPage] Session attributes received:', data.sessionAttributes);
          setSessionAttributes(data.sessionAttributes);
        }
        
        return data.answer;
      } else {
        // エラーレスポンスの処理
        console.error('Bedrock API error:', data);
        
        // エラーアクションを設定（将来の拡張用）
        // if (data.actions && data.actions.length > 0) {
        //   setErrorActions(data.actions);
        // }
        
        // 構造化エラーがある場合はユーザーフレンドリーなメッセージを表示
        if (data.error && typeof data.error === 'object') {
          const errorData = data.error;
          let message = '';
          
          // ユーザーフレンドリーメッセージを優先
          if (errorData.userFriendlyMessage) {
            message += `${errorData.userFriendlyMessage}\n\n`;
          } else if (errorData.message) {
            message += `${errorData.message}\n\n`;
          }
          
          if (errorData.actionRequired) {
            message += `**Action Required:**\n${errorData.actionRequired}\n\n`;
          }
          
          if (errorData.availableRegionsDisplay && errorData.availableRegionsDisplay.length > 0) {
            message += `**Available Regions:**\n`;
            errorData.availableRegionsDisplay.forEach((region: any) => {
              message += `• ${region.flag} ${region.name}\n`;
            });
            message += `\n`;
          }
          
          if (errorData.suggestions && errorData.suggestions.length > 0) {
            message += `**Solutions:**\n`;
            errorData.suggestions.forEach((suggestion: any, index: number) => {
              if (typeof suggestion === 'object' && suggestion.title) {
                message += `${index + 1}. **${suggestion.title}**\n   ${suggestion.description}\n\n`;
              } else {
                message += `${index + 1}. ${suggestion}\n\n`;
              }
            });
          }
          
          // 追加の説明とガイダンス
          message += `**Hints:**\n`;
          message += `• Try changing the region from the sidebar\n`;
          message += `• Switch to Knowledge Base mode if Agent mode is unavailable\n`;
          message += `• Contact your administrator for access to restricted models`;
          
          return message;
        }
        
        // フォールバック: 従来のエラー処理
        const errorMessage = typeof data.error === 'string' ? data.error : 
                           data.error?.message || 'Unknown error';
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Bedrock API Error:', error);

      // エラーの詳細をログ出力
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }

      // 実際のエラーメッセージを返す（デバッグ用）
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // エラーメッセージは直接文字列で定義（翻訳キーが存在しないため）
      return `**Knowledge Base Mode Error**

**Current Situation:**
• **Model Used**: ${getModelById(selectedModelId)?.name || 'Unknown'} (${selectedModelId})
• **User**: ${user.username}
• **Current Region**: ${regionStore.selectedRegion}
• **Timestamp**: ${new Date().toLocaleString(memoizedLocale === 'ja' ? 'ja-JP' : 'en-US')}

**Solutions:**

1. **Switch to Agent Mode**
   Agent mode may have better availability in your region.

2. **Change Region**
   Try selecting a different region from the sidebar.

3. **Select Different Model**
   Some models may not be available in your current region.

4. **Wait and Retry**
   Temporary service issues may resolve automatically.

**Hints:**
• Agent mode often has better regional availability
• Available Regions: us-east-1, us-west-2, eu-west-1, eu-central-1
• Contact your administrator if the problem persists

**Technical Details:** ${errorMessage}`;
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
      // Agentモードまたは通常モードでRAG処理
      const responseText = agentMode 
        ? await generateAgentResponse(currentInput)
        : await generateRAGResponse(currentInput);

      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: responseText,
        role: 'assistant',
        timestamp: Date.now(),
        sessionId: currentSession.id
      };

      addMessage(botResponse);

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

  const handleSignOut = async () => {
    try {
      // CSRF tokenを取得
      const csrfResponse = await fetch('/api/auth/csrf-token');
      if (!csrfResponse.ok) {
        throw new Error('Failed to get CSRF token');
      }
      const { token: csrfToken } = await csrfResponse.json();

      // サインアウトAPIを呼び出し
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        }
      });

      if (!response.ok) {
        throw new Error('Sign-out failed');
      }
    } catch (error) {
      console.error('Sign-out error:', error);
    } finally {
      // ローカルストレージをクリア
      localStorage.removeItem('user');
      // サインインページにリダイレクト
      router.push('/signin');
    }
  };

  if (!isClient || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white dark:bg-gray-900 flex overflow-hidden">
      {/* Agentモード時はModeSwitchableSidebarを表示 */}
      {agentMode ? (
        <Suspense fallback={<div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700" />}>
          <ModeSwitchableSidebar
            locale={memoizedLocale}
            agentMode={agentMode}
            currentSessionId={currentSession?.id}
            sessions={Array.isArray(chatSessions) ? chatSessions : []}
            onNewChat={() => {
              if (!user) return;
              const sessionTitle = memoizedLocale === 'en' 
                ? `New Chat - ${new Date().toLocaleDateString('en-US')}`
                : `新しいチャット - ${new Date().toLocaleDateString('ja-JP')}`;
              
              // Agentモード用の初期メッセージを生成
              const initialMessageText = generateAgentModeInitialMessage(
                user.username,
                user.role || 'User',
                userDirectories,
                agentInfo, // 現在のAgent情報を使用
                t, // Introduction用翻訳フック
                tAgent // Agent情報用翻訳フック
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
            onSessionSwitch={(sessionId) => {
              const session = Array.isArray(chatSessions) ? chatSessions.find(s => s.id === sessionId) : null;
              if (session) {
                setCurrentSession(session);
              }
            }}
            onSessionDelete={(sessionId) => {
              // セッション削除処理
              const updatedSessions = Array.isArray(chatSessions) ? chatSessions.filter(s => s.id !== sessionId) : [];
              // チャットストアを更新（実装に応じて調整）
              console.log('Delete session:', sessionId);
            }}
            userName={user.username}
            userEmail={user.email}
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
            selectedModelId={selectedModelId}
            onModelChange={setSelectedModelId}
            onCreateAgent={() => {
              // Agent作成処理（将来の実装）
              console.log('Create new agent requested');
            }}
          />
        </Suspense>
      ) : (
        /* KBモード時は既存のサイドバーを表示 */
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
                  {translations.operationMode}: {agentMode ? '🤖 Agent' : '📚 Knowledge Base'}
                </div>
                {agentMode ? (
                  <div className="space-y-1 text-purple-700 dark:text-purple-400">
                    <div className="font-medium">{translations.agentFeatures}</div>
                    <div>{translations.agentFeature1}</div>
                    <div>{translations.agentFeature2}</div>
                    <div>{translations.agentFeature3}</div>
                  </div>
                ) : (
                  <div className="space-y-1 text-blue-700 dark:text-blue-400">
                    <div className="font-medium">{translations.kbFeatures}</div>
                    <div>{translations.kbFeature1}</div>
                    <div>{translations.kbFeature2}</div>
                    <div>{translations.kbFeature3}</div>
                  </div>
                )}
              </div>
            </div>

            {/* AIモデル選択セクション */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              {agentMode && agentId ? (
                // Agentモード: AgentModelSelectorを使用
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300">Agent Model</h3>
                  <AgentModelSelector
                    agentId={agentId}
                    currentModelId={agentInfo?.foundationModel || selectedModelId || ''}
                    onModelChange={(modelId) => {
                      console.log('🔄 [ChatbotPage] Agent モデル変更:', modelId);
                      setSelectedModelId(modelId);
                    }}
                  />
                </div>
              ) : (
                // Knowledge Baseモード: 通常のModelSelectorを使用
                <ModelSelector
                  selectedModelId={selectedModelId}
                  onModelChange={setSelectedModelId}
                  showAdvancedFilters={true}
                />
              )}
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
      )}

      {/* メインコンテンツ - Agentモード時はサイドバー幅分のmarginを追加 */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${agentMode && sidebarOpen ? 'ml-[320px]' : ''}`}>
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
                      
                      // モードに応じた初期メッセージを生成
                      let initialMessages: Message[] = [];
                      
                      if (agentMode) {
                        // Agentモード用の初期メッセージ
                        const initialMessageText = generateAgentModeInitialMessage(
                          user.username,
                          user.role || 'User',
                          userDirectories,
                          agentInfo,
                          t,  // ✅ Fixed: use t instead of tIntro
                          tAgent   // ✅ Fixed: add tAgent parameter
                        );
                        
                        initialMessages = [{
                          id: '1',
                          content: initialMessageText,
                          role: 'assistant',
                          timestamp: Date.now()
                        }];
                      } else {
                        // Knowledge Baseモード用の初期メッセージ
                        let initialMessageText: string;
                        if (userDirectories) {
                          initialMessageText = generateInitialMessageWithDirectories(
                            user.username,
                            user.role || 'User',
                            userDirectories,
                            t  // ✅ Fixed: use t instead of tIntro
                          );
                        } else {
                          initialMessageText = generateInitialMessage(
                            user.username,
                            user.role || 'User',
                            t  // ✅ Fixed: use t instead of tIntro
                          );
                        }
                        
                        initialMessages = [{
                          id: '1',
                          content: initialMessageText,
                          role: 'assistant',
                          timestamp: Date.now()
                        }];
                      }
                      
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
                
                {/* Agent/KBモード切り替えドロップダウン */}
                <ModeSwitcher
                  agentMode={agentMode}
                  onModeChange={setAgentMode}
                />
                
                <ThemeToggle variant="icon" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('auth.welcomeMessage', { username: user?.username })}
                </span>
                <button
                  onClick={handleSignOut}
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
          {/* Agent UI コントロール（Agentモード時のみ表示） */}
          {agentMode && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border-b dark:border-purple-800 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
                  {translations.agentModeLabel}
                </span>
                <button
                  onClick={() => setShowAgentTrace(!showAgentTrace)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    showAgentTrace
                      ? 'bg-purple-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                  }`}
                >
                  {showAgentTrace ? translations.showTrace.replace('表示', '非表示') : translations.showTrace}
                </button>
                <button
                  onClick={() => setShowSessionAttributes(!showSessionAttributes)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    showSessionAttributes
                      ? 'bg-purple-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                  }`}
                >
                  {showSessionAttributes ? translations.showSessionAttributes.replace('表示', '非表示') : translations.showSessionAttributes}
                </button>
              </div>
              <div className="text-xs text-purple-700 dark:text-purple-300">
                {t('chat.traceCount', { count: agentTraces.length, attributeCount: Object.keys(sessionAttributes).length })}
              </div>
            </div>
          )}
          
          {/* Agent トレース表示パネル */}
          {agentMode && showAgentTrace && agentTraces.length > 0 && (
            <div className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <AgentTraceDisplay traces={agentTraces} />
            </div>
          )}
          
          {/* セッション属性表示パネル */}
          {agentMode && showSessionAttributes && Object.keys(sessionAttributes).length > 0 && (
            <div className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <SessionAttributesPanel 
                attributes={sessionAttributes}
                onUpdate={setSessionAttributes}
              />
            </div>
          )}
          
          {/* メッセージリスト */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-4 bg-white dark:bg-gray-900">
            {currentSession?.messages?.map((message: Message) => (
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
                  <p className={`text-xs mt-2 ${message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                    {message.timestamp ? new Date(message.timestamp).toLocaleTimeString('ja-JP') : ''}
                  </p>
                </div>
              </div>
            ))}
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
