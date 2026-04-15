'use client';

import { ErrorBoundary } from '../../../components/ui/ErrorBoundary';

// Force dynamic rendering to prevent SSR errors with client-only hooks
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
import { RegionConfigManager } from '../../../config/region-config-manager';
import { AgentModeSidebar } from '../../../components/bedrock/AgentModeSidebar';
import { useAgentStore } from '../../../store/useAgentStore';
import { CardGrid } from '../../../components/cards/CardGrid';
import { CollapsiblePanel } from '../../../components/ui/CollapsiblePanel';
import { resolveAgentForCard, findAgentByCategory } from '../../../services/cardAgentBindingService';
import { useCardAgentMappingStore } from '../../../store/useCardAgentMappingStore';
import type { CardData } from '../../../constants/card-constants';
import { getCardsByMode, AGENT_CATEGORY_MAP } from '../../../constants/card-constants';
import { ImageUploadZone } from '@/components/chat/ImageUploadZone';
import { ImagePreview } from '@/components/chat/ImagePreview';
import { ImageThumbnail } from '@/components/chat/ImageThumbnail';
import { ImageModal } from '@/components/chat/ImageModal';
import type { ImageAttachment } from '@/types/image-upload';
import { routeQuery, DEFAULT_SMART_ROUTER_CONFIG } from '@/lib/smart-router';
import { useSmartRoutingStore } from '@/store/useSmartRoutingStore';
import { ResponseMetadata } from '@/components/chat/ResponseMetadata';
import { RoutingToggle } from '@/components/sidebar/RoutingToggle';
import { useMemory } from '@/hooks/useMemory';
import type { Message as MemoryMessage } from '@/providers/MemoryProvider';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';
// AgentModeToggle removed in Task 8.2 — replaced by UnifiedModeToggle
import MultiAgentTraceTimeline from '@/components/chat/MultiAgentTraceTimeline';
import MultiAgentExecutionStatus from '@/components/chat/MultiAgentExecutionStatus';
import CollaboratorDetailPanel from '@/components/chat/CollaboratorDetailPanel';
import CostSummary from '@/components/chat/CostSummary';
import { useAgentTeamStore } from '@/store/useAgentTeamStore';
import type { MultiAgentTraceResult } from '@/types/multi-agent';
import UnifiedModeToggle from '@/components/chat/UnifiedModeToggle';
import type { ChatMode } from '@/components/chat/UnifiedModeToggle';
import HeaderAgentSelector from '@/components/chat/HeaderAgentSelector';
import type { AgentListItem } from '@/components/chat/HeaderAgentSelector';
import ModelIndicator from '@/components/bedrock/ModelIndicator';
import { UserMenu } from '@/components/ui/UserMenu';
import { OverflowMenu } from '@/components/ui/OverflowMenu';
import type { OverflowMenuItem } from '@/components/ui/OverflowMenu';
import { useHeaderStore } from '@/store/useHeaderStore';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

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
    
    const ragDirectoryDisplay = Array.isArray(userDirectories.ragAccessibleDirectories)
      ? userDirectories.ragAccessibleDirectories.join(', ')
      : '';
    
    const embeddedDirectoryDisplay = Array.isArray(userDirectories.embeddedDirectories)
      ? userDirectories.embeddedDirectories.join(', ')
      : '';
    
    console.log('✅ [generateInitialMessageWithDirectories] Directory display:', directoryDisplay, 'RAG:', ragDirectoryDisplay);
    
    // ディレクトリタイプに応じたメッセージを取得
    let directoryNote = '';
    const fsxId = userDirectories.fsxFileSystemId || '';
    
    switch (userDirectories.directoryType) {
      case 'actual':
        directoryNote = t('introduction.directoryType.actual', { fsxId });
        break;
      case 'sid-based':
        directoryNote = t('introduction.directoryType.sidBased') || '🔐 SIDベースのアクセス権限';
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
• **📁 ${t('introduction.fsxDirectories') || 'FSxアクセス可能ディレクトリ'}**: ${directoryDisplay}
• **🔍 ${t('introduction.ragDirectories') || 'RAG検索可能ディレクトリ'}**: ${ragDirectoryDisplay || directoryDisplay}${embeddedDirectoryDisplay && embeddedDirectoryDisplay === (ragDirectoryDisplay || directoryDisplay) ? `
• **📚 ${t('introduction.embeddedDirectories') || 'Embedding対象ディレクトリ'}**: ${embeddedDirectoryDisplay}` : ''}

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

// MultiAgentModeToggleWrapper removed in Task 8.2 — integrated into UnifiedModeToggle

/** Wrapper to reactively render MultiAgentExecutionStatus from Zustand store */
function MultiAgentExecutionStatusDisplay() {
  const executionStatus = useAgentTeamStore((s) => s.executionStatus);
  if (!executionStatus) return null;
  return <MultiAgentExecutionStatus status={executionStatus} />;
}

function ChatbotPageContent() {
  // 翻訳フック（名前空間なし - 完全パスで翻訳キーを指定）
  const t = useTranslations();
  const tFsx = useTranslations('fsx');      // FSx情報用の翻訳フック
  const tSidebar = useTranslations('sidebar');  // サイドバー用の翻訳フック
  
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
    inputPlaceholder: t('chat.inputPlaceholder'),
    send: t('chat.send'),
    
    // Chatbott
    sidebarToggleClose: t('chatbot.sidebarToggleClose'),
    sidebarToggleOpen: t('chatbot.sidebarToggleOpen'),
    title: t('chatbot.title'),
    
    // Auth (signOutButton removed in Task 8.2 — handled by UserMenu)
    
    // Model
    requestAccess: t('model.requestAccess'),
    
  }), [t]);
  
  // Zustandストアを強制的に初期化（Next.js 15のTree Shaking対策）
  const regionStore = useRegionStore();
  
  // トークン自動リフレッシュ（OIDC IdPセッション無効化時は再認証リダイレクト）
  useTokenRefresh();
  
  // ✅ 2026-01-19: useAuthStoreと同期してuser stateを管理（sign-out fix）
  const authStore = useAuthStore();
  const { session, isAuthenticated } = authStore;
  
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);
  const [messageCitations, setMessageCitations] = useState<Record<string, CitationItem[]>>({});
  
  // Image upload state (Task 11.1)
  const [attachedImage, setAttachedImage] = useState<ImageAttachment | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalData, setImageModalData] = useState<{base64Data: string; mimeType: string} | null>(null);
  
  // Per-message routing decisions (Task 11.4)
  const [messageRoutingDecisions, setMessageRoutingDecisions] = useState<Record<string, { modelName: string; isAutoRouted: boolean; isManualOverride: boolean; classification?: 'simple' | 'complex'; confidence?: number; hasImageAnalysis?: boolean }>>({});
  
  // Smart Routing store (Task 11.2)
  const { isEnabled: smartRoutingEnabled, isAutoMode, setLastClassification } = useSmartRoutingStore();
  
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
  // sidebarOpen は useHeaderStore に移行済み（Task 8.4）
  const sidebarOpen = useHeaderStore((s) => s.sidebarOpen);
  const setSidebarOpen = useHeaderStore((s) => s.setSidebarOpen);
  const toggleSidebar = useHeaderStore((s) => s.toggleSidebar);

  // Task 9.3: レスポンシブサイドバー — md Breakpoint (768px) 未満で自動折りたたみ + オーバーレイ表示
  const [isBelowMd, setIsBelowMd] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const MD_BREAKPOINT = 768;

    const handleResize = () => {
      const below = window.innerWidth < MD_BREAKPOINT;
      setIsBelowMd(below);
      // md 未満になったらサイドバーを自動折りたたみ
      if (below) {
        setSidebarOpen(false);
      }
    };

    // 初期チェック
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setSidebarOpen]);
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);
  const [selectedModelName, setSelectedModelName] = useState('Amazon Nova Pro');
  const [userDirectories, setUserDirectories] = useState<any>(null);
  const [availableModelCount, setAvailableModelCount] = useState<number>(0);
  const [isLoadingDirectories, setIsLoadingDirectories] = useState(false);

  // Agent/KBモード切替 — useHeaderStore.chatMode から派生（Task 8.4）
  const headerChatModeFromStore = useHeaderStore((s) => s.chatMode);
  const setHeaderChatMode = useHeaderStore((s) => s.setChatMode);
  const agentMode = headerChatModeFromStore !== 'kb';
  const setAgentMode = useCallback((isAgent: boolean) => {
    if (!isAgent) {
      setHeaderChatMode('kb');
    } else {
      // Agent モード ON 時は useAgentTeamStore の agentMode で single/multi を判定
      const teamMode = useAgentTeamStore.getState().agentMode;
      setHeaderChatMode(teamMode === 'multi' ? 'multi-agent' : 'single-agent');
    }
  }, [setHeaderChatMode]);

  const searchParams = useSearchParams();
  // ページロード時に URL クエリパラメータから useHeaderStore.chatMode を初期化（Task 8.4）
  useEffect(() => {
    const modeParam = searchParams.get('mode');
    let targetChatMode: ChatMode;
    if (modeParam === 'multi-agent') {
      targetChatMode = 'multi-agent';
    } else if (modeParam === 'agent') {
      targetChatMode = 'single-agent';
    } else {
      targetChatMode = 'kb';
    }
    if (targetChatMode !== headerChatModeFromStore) {
      console.log(`🔄 [ChatbotPage] Mode sync from URL: ${headerChatModeFromStore} → ${targetChatMode}`);
      setHeaderChatMode(targetChatMode);
      // multi-agent の場合は useAgentTeamStore も同期
      if (targetChatMode === 'multi-agent') {
        useAgentTeamStore.getState().setAgentMode('multi');
      } else if (targetChatMode === 'single-agent') {
        useAgentTeamStore.getState().setAgentMode('single');
      }
    }
  }, [searchParams]);
  const { selectedAgentId } = useAgentStore();

  // === AgentCore Memory統合 (Task 10) ===
  // ENABLE_AGENTCORE_MEMORY はサーバーサイド環境変数のため、APIプローブで検出
  const [agentCoreMemoryEnabled, setAgentCoreMemoryEnabled] = useState(false);
  const [memorySessionId, setMemorySessionId] = useState<string | null>(null);

  // AgentCore Memory有効性をAPIプローブで検出
  useEffect(() => {
    const checkAgentCoreMemory = async () => {
      try {
        const res = await fetch('/api/agentcore/memory/session', { method: 'GET' });
        // 501 = not enabled, 401 = enabled but not authenticated, 200/400 = enabled
        if (res.status !== 501) {
          console.log('[AgentCore Memory] 有効を検出');
          setAgentCoreMemoryEnabled(true);
        } else {
          console.log('[AgentCore Memory] 無効（501）');
          setAgentCoreMemoryEnabled(false);
        }
      } catch (err) {
        console.warn('[AgentCore Memory] 検出失敗（無効として扱う）:', err);
        setAgentCoreMemoryEnabled(false);
      }
    };
    checkAgentCoreMemory();
  }, []);

  // useAgentCoreForKB を ENABLE_AGENTCORE_MEMORY 環境変数に連動 (Sub-task 10.4)
  const useAgentCoreForKB = agentCoreMemoryEnabled;

  // useMemory フック — モードと環境変数に応じてProvider自動選択
  const memory = useMemory({
    mode: agentMode ? 'agent' : 'kb',
    useAgentCoreForKB,
  });
  // === AgentCore Memory統合 ここまで ===
  
  // エラーアクション関連のstate（将来の拡張用）
  // const [errorActions, setErrorActions] = useState<any[]>([]);
  // const [actionMessage, setActionMessage] = useState('');
  // const [isProcessingAction, setIsProcessingAction] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ワークフロー選択イベントリスナー
  useEffect(() => {
    const handleWorkflow = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.prompt) {
        setInputText(detail.prompt);
      }
    };
    window.addEventListener('agent-workflow-selected', handleWorkflow);
    return () => window.removeEventListener('agent-workflow-selected', handleWorkflow);
  }, []);
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

  // モデル数を取得
  useEffect(() => {
    fetch('/api/bedrock/region-info')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAvailableModelCount(data.data.availableModelsCount || 0);
        }
      })
      .catch(() => {});
  }, [regionStore.selectedRegion]);

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
        
        // SID情報はサーバーサイド（KB Retrieve API）でDynamoDBから取得するため、
        // フロントエンドでのSID取得は不要
        
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

  // === AgentCore Memory セッション作成 (Task 10) ===
  // ユーザー認証完了 + AgentCore Memory有効時にメモリセッションを作成
  useEffect(() => {
    if (!user || !agentCoreMemoryEnabled || memorySessionId) return;

    const createMemorySession = async () => {
      try {
        const mode = agentMode ? 'agent' : 'kb';
        const sessionId = await memory.createSession(mode, user.username || user.userId);
        setMemorySessionId(sessionId);
        console.log('[AgentCore Memory] セッション作成成功:', sessionId);
      } catch (err) {
        // セッション作成失敗は非致命的 — メモリなしで動作継続
        console.warn('[AgentCore Memory] セッション作成失敗（非致命的）:', err);
      }
    };
    createMemorySession();
  }, [user, agentCoreMemoryEnabled, agentMode]);

  // モード切替時にメモリセッションをリセット（独立管理: Req 6.4）
  useEffect(() => {
    if (agentCoreMemoryEnabled && user) {
      setMemorySessionId(null); // 次のuseEffectで新セッション作成
    }
  }, [agentMode]);
  // === AgentCore Memory セッション作成 ここまで ===

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

  const generateRAGResponse = async (query: string, imageData?: string, imageMimeType?: string, routing?: { isAutoRouted: boolean; classification?: { classification: 'simple' | 'complex' } | null }): Promise<{ answer: string; citations: CitationItem[] }> => {
    try {
      console.log('📚 [KB] Sending request to Bedrock KB API:', { query: query.substring(0, 100), user: user.username, modelId: selectedModelId });
      
      const currentRegion = typeof window !== 'undefined' 
        ? localStorage.getItem('selectedRegion') || 'ap-northeast-1'
        : 'ap-northeast-1';
      
      const knowledgeBaseId = typeof window !== 'undefined'
        ? localStorage.getItem('selectedKnowledgeBaseId') || process.env.NEXT_PUBLIC_BEDROCK_KB_ID || ''
        : '';
      
      // KB Retrieve APIを使用（KB IDはサーバーサイドでBEDROCK_KB_ID環境変数にフォールバック）
      {
        console.log(`📚 [KB] Using KB Retrieve API: knowledgeBaseId=${knowledgeBaseId || '(server-side fallback)'}`);
        
        const response = await fetch('/api/bedrock/kb/retrieve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            ...(knowledgeBaseId ? { knowledgeBaseId } : {}),
            modelId: selectedModelId,
            userId: user.username,
            region: currentRegion,
            ...(imageData ? { imageData, imageMimeType } : {}),
            // Smart Routing メトリクス用
            ...(routing ? {
              isAutoRouted: routing.isAutoRouted,
              ...(routing.classification ? { routingClassification: routing.classification.classification } : {}),
            } : {}),
            // AgentCore Memory: KBモード会話コンテキスト用セッションID (Task 11)
            ...(agentCoreMemoryEnabled && memorySessionId ? { memorySessionId } : {}),
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

  // Agent モードのレスポンス生成（InvokeAgent API）
  // Bedrock AgentのInvokeAgent APIを直接呼び出し、Agentの多段階推論を活用
  // Permission-awareはAgent側のKB設定またはAction Groupで実現
  // フォールバック: Agent呼び出し失敗時はKB Retrieve + SIDフィルタリング（ハイブリッド方式）
  //
  // Multi-Agent モード統合:
  // Zustand storeの agentMode === 'multi' かつ selectedTeam が存在する場合、
  // /api/bedrock/agent-team/invoke を呼び出し、multiAgentTrace を返す。
  // それ以外は従来の Single Agent 呼び出し（/api/bedrock/agent）を使用。
  const generateAgentResponse = async (query: string): Promise<{ answer: string; citations: CitationItem[]; multiAgentTrace?: MultiAgentTraceResult }> => {
    // Multi-Agent モード判定
    const { agentMode: multiMode, selectedTeam, setExecutionStatus } = useAgentTeamStore.getState();

    if (multiMode === 'multi' && selectedTeam) {
      return await generateMultiAgentResponse(query, selectedTeam, setExecutionStatus);
    }

    // --- Single Agent モード（従来ロジック） ---
    try {
      const currentRegion = typeof window !== 'undefined'
        ? localStorage.getItem('selectedRegion') || 'ap-northeast-1'
        : 'ap-northeast-1';

      console.log('🤖 [Agent] InvokeAgent:', {
        query: query.substring(0, 100),
        agentId: selectedAgentId,
        region: currentRegion,
      });

      // Step 1: InvokeAgent APIを呼び出し
      const agentResponse = await fetch('/api/bedrock/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          userId: user.username,
          sessionId: currentSession?.id || `session-${Date.now()}`,
          selectedAgentId: selectedAgentId || undefined,
          action: 'invoke',
        }),
      });

      const agentData = await agentResponse.json();

      if (agentData.success && agentData.answer) {
        console.log('✅ [Agent] InvokeAgent success');
        // Agent応答からcitationを抽出（traceにKB検索結果が含まれる場合）
        const agentCitations: CitationItem[] = [];
        if (agentData.metadata?.citations) {
          for (const c of agentData.metadata.citations) {
            agentCitations.push({
              fileName: c.fileName || c.sourceUri?.split('/').pop() || 'Unknown',
              s3Uri: c.sourceUri || c.s3Uri || '',
              content: c.content || c.text || '',
              metadata: c.metadata || {},
            });
          }
        }
        // traceからKB検索結果を抽出
        if (agentData.metadata?.trace) {
          for (const t of agentData.metadata.trace) {
            const refs = t?.trace?.orchestrationTrace?.observation?.knowledgeBaseLookupOutput?.retrievedReferences;
            if (refs) {
              for (const ref of refs) {
                const uri = ref.location?.s3Location?.uri || '';
                agentCitations.push({
                  fileName: uri.split('/').pop() || 'Unknown',
                  s3Uri: uri,
                  content: ref.content?.text || '',
                  metadata: {},
                });
              }
            }
          }
        }
        return { answer: agentData.answer, citations: agentCitations };
      }

      // Agent呼び出し失敗 → フォールバック: KB Retrieve + SIDフィルタリング
      console.warn('⚠️ [Agent] InvokeAgent failed, falling back to KB hybrid:', agentData.error);
      return await generateAgentFallback(query, currentRegion);
    } catch (error) {
      console.error('❌ [Agent] Error, falling back to KB hybrid:', error);
      const currentRegion = typeof window !== 'undefined'
        ? localStorage.getItem('selectedRegion') || 'ap-northeast-1'
        : 'ap-northeast-1';
      return await generateAgentFallback(query, currentRegion);
    }
  };

  // Multi-Agent モードのレスポンス生成（/api/bedrock/agent-team/invoke）
  // Supervisor Agent経由でCollaborator Agentチェーンを実行し、
  // multiAgentTrace（タイムライン、コスト、Guardrail結果）を返す。
  const generateMultiAgentResponse = async (
    query: string,
    team: import('@/types/multi-agent').AgentTeamConfig,
    setExecutionStatus: (status: import('@/types/multi-agent').MultiAgentExecutionStatus | null) => void,
  ): Promise<{ answer: string; citations: CitationItem[]; multiAgentTrace?: MultiAgentTraceResult }> => {
    try {
      console.log('🤖 [Multi-Agent] Invoking team:', {
        teamId: team.teamId,
        teamName: team.teamName,
        collaboratorCount: team.collaborators.length,
        routingMode: team.routingMode,
        query: query.substring(0, 100),
      });

      // リアルタイムステータス: 実行開始
      const collaboratorMap = new Map<string, {
        role: import('@/types/multi-agent').CollaboratorRole;
        name: string;
        status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
        elapsedMs: number;
      }>();
      for (const c of team.collaborators) {
        collaboratorMap.set(c.agentId || c.name, {
          role: (c.role || 'retrieval') as import('@/types/multi-agent').CollaboratorRole,
          name: c.name,
          status: 'pending',
          elapsedMs: 0,
        });
      }
      setExecutionStatus({
        isExecuting: true,
        currentPhase: 'routing',
        collaboratorStatuses: collaboratorMap,
        elapsedMs: 0,
        estimatedCostUsd: 0,
      });

      const response = await fetch('/api/bedrock/agent-team/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: team.teamId,
          message: query,
          userId: user.username,
          sessionId: currentSession?.id || `team-session-${Date.now()}`,
        }),
      });

      const data = await response.json();

      // リアルタイムステータス: 実行完了
      setExecutionStatus(null);

      if (data.success && data.response) {
        console.log('✅ [Multi-Agent] Invoke success:', {
          responseLength: data.response.length,
          hasTrace: !!data.multiAgentTrace,
          collaboratorCount: data.multiAgentTrace?.collaboratorTraces?.length ?? 0,
          estimatedCost: data.multiAgentTrace?.estimatedCostUsd,
        });

        // citationの抽出（multiAgentTraceのcollaboratorTracesから）
        const agentCitations: CitationItem[] = [];
        if (data.multiAgentTrace?.collaboratorTraces) {
          for (const ct of data.multiAgentTrace.collaboratorTraces) {
            if (ct.citations) {
              for (const c of ct.citations) {
                agentCitations.push({
                  fileName: c.fileName || c.sourceUri?.split('/').pop() || 'Unknown',
                  s3Uri: c.sourceUri || c.s3Uri || '',
                  content: c.content || c.text || '',
                  metadata: c.metadata || {},
                });
              }
            }
          }
        }

        return {
          answer: data.response,
          citations: agentCitations,
          multiAgentTrace: data.multiAgentTrace as MultiAgentTraceResult | undefined,
        };
      }

      // Multi-Agent呼び出し失敗 → KB Retrieveフォールバック
      console.warn('⚠️ [Multi-Agent] Invoke failed, falling back to KB hybrid:', data.error);
      const fallbackRegion = typeof window !== 'undefined'
        ? localStorage.getItem('selectedRegion') || 'ap-northeast-1'
        : 'ap-northeast-1';
      return await generateAgentFallback(query, fallbackRegion);
    } catch (error) {
      console.error('❌ [Multi-Agent] Error, falling back to single agent:', error);
      setExecutionStatus(null);
      // フォールバック: agentMode を一時的にsingleとして再帰呼び出しを避ける
      const currentRegion = typeof window !== 'undefined'
        ? localStorage.getItem('selectedRegion') || 'ap-northeast-1'
        : 'ap-northeast-1';
      return await generateAgentFallback(query, currentRegion);
    }
  };

  // Agent フォールバック: KB Retrieve + SIDフィルタリング + Converse
  const generateAgentFallback = async (query: string, region: string): Promise<{ answer: string; citations: CitationItem[] }> => {
    try {
      const knowledgeBaseId = typeof window !== 'undefined'
        ? localStorage.getItem('selectedKnowledgeBaseId') || process.env.NEXT_PUBLIC_BEDROCK_KB_ID || ''
        : '';

      console.log('🔄 [Agent Fallback] KB Retrieve + SID Filter');
      const response = await fetch('/api/bedrock/kb/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          ...(knowledgeBaseId ? { knowledgeBaseId } : {}),
          modelId: selectedModelId,
          userId: user.username,
          region,
          agentMode: true,
        }),
      });

      const data = await response.json();
      if (data.success) {
        return {
          answer: data.answer || 'No response',
          citations: (data.citations || []).map((c: any) => ({
            fileName: c.fileName || 'Unknown',
            s3Uri: c.s3Uri || '',
            content: c.content || '',
            metadata: c.metadata || {},
          })),
        };
      }
      throw new Error(data.error || 'Fallback failed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        answer: `**Agent エラー**\n\n• **Agent ID**: ${selectedAgentId || '未選択'}\n• **時刻**: ${new Date().toLocaleString('ja-JP')}\n\n**詳細:** ${errorMessage}`,
        citations: [],
      };
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

    // === AgentCore Memory: ユーザーメッセージ記録 (Sub-task 10.2) ===
    // Fire-and-forget: メモリ記録失敗は既存フローをブロックしない
    if (agentCoreMemoryEnabled && memorySessionId) {
      const memMsg: MemoryMessage = {
        id: userMessage.id,
        content: userMessage.content,
        role: 'user',
        timestamp: userMessage.timestamp || Date.now(),
        sessionId: memorySessionId,
      };
      memory.addMessage(memorySessionId, memMsg).catch((err) => {
        console.warn('[AgentCore Memory] ユーザーメッセージ記録失敗（非致命的）:', err);
      });
    }

    // === AgentCore Memory: 会話コンテキスト取得 (Sub-task 10.3) ===
    // Agent/KB呼び出し前に短期メモリから直近の会話を取得
    // 失敗してもAPI呼び出しはブロックしない
    let conversationContext: string | undefined;
    if (agentCoreMemoryEnabled && memorySessionId) {
      try {
        const recentMessages = await memory.getMessages(memorySessionId, 10);
        if (recentMessages.length > 0) {
          conversationContext = recentMessages
            .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n');
          console.log('[AgentCore Memory] 会話コンテキスト取得成功:', {
            messageCount: recentMessages.length,
            contextLength: conversationContext.length,
          });
        }
      } catch (err) {
        console.warn('[AgentCore Memory] コンテキスト取得失敗（コンテキストなしで続行）:', err);
      }
    }

    // Smart Routing (Task 11.2)
    const routingDecision = routeQuery(
      currentInput,
      smartRoutingEnabled,
      isAutoMode,
      selectedModelId,
      DEFAULT_SMART_ROUTER_CONFIG
    );
    if (routingDecision.classification) {
      setLastClassification(routingDecision.classification);
    }

    // Capture image data before clearing (Task 11.1)
    const currentImageData = attachedImage?.base64Data;
    const currentImageMimeType = attachedImage?.mimeType;
    const hadImage = !!attachedImage;
    setAttachedImage(null);

    try {
      // モードに応じてRAG処理またはAgent処理を実行
      const { answer: responseText, citations, multiAgentTrace } = agentMode
        ? await generateAgentResponse(currentInput)
        : { ...await generateRAGResponse(currentInput, currentImageData, currentImageMimeType, routingDecision), multiAgentTrace: undefined };

      const botMessageId = `bot-${Date.now()}`;
      const botResponse: Message & { multiAgentTrace?: MultiAgentTraceResult } = {
        id: botMessageId,
        content: responseText,
        role: 'assistant',
        timestamp: Date.now(),
        sessionId: currentSession.id,
        ...(multiAgentTrace ? { multiAgentTrace } : {}),
      };

      addMessage(botResponse);

      // === AgentCore Memory: アシスタントメッセージ記録 (Sub-task 10.2) ===
      // Fire-and-forget: メモリ記録失敗は既存フローをブロックしない
      if (agentCoreMemoryEnabled && memorySessionId) {
        const memBotMsg: MemoryMessage = {
          id: botResponse.id,
          content: botResponse.content,
          role: 'assistant',
          timestamp: botResponse.timestamp || Date.now(),
          sessionId: memorySessionId,
        };
        memory.addMessage(memorySessionId, memBotMsg).catch((err) => {
          console.warn('[AgentCore Memory] アシスタントメッセージ記録失敗（非致命的）:', err);
        });
      }

      // Store routing decision for this bot message (Task 11.4)
      const routedModelName = getModelById(routingDecision.modelId)?.name || routingDecision.modelId;
      setMessageRoutingDecisions(prev => ({
        ...prev,
        [botMessageId]: {
          modelName: routedModelName,
          isAutoRouted: routingDecision.isAutoRouted,
          isManualOverride: smartRoutingEnabled && !routingDecision.isAutoRouted,
          classification: routingDecision.classification?.classification,
          confidence: routingDecision.classification?.confidence,
          hasImageAnalysis: hadImage,
        },
      }));

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
  
  // signOutButtonRef useEffect removed in Task 8.2 — sign-out is now handled by UserMenu

  // === Task 8.1 / 8.4: Header Flexbox layout — state & handlers for new components ===

  // headerChatMode は useHeaderStore.chatMode から直接取得（Task 8.4 で統合済み）
  const headerChatMode: ChatMode = headerChatModeFromStore;

  // Multi-Agent が利用可能かどうか
  // 1. Agent Teams が1つ以上作成されている場合
  // 2. Supervisor Agent ID が環境変数で設定されている場合（CDK enableMultiAgent=true）
  const hasTeams = useAgentTeamStore((s) => s.teams.length > 0);
  const [hasSupervisor, setHasSupervisor] = useState(false);
  const featureFlags = useFeatureFlags();
  const headerMultiAgentAvailable = hasTeams || hasSupervisor || featureFlags.multiAgentEnabled;
  useEffect(() => {
    fetch('/api/bedrock/agent-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list' }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.teams) && d.teams.length > 0) {
          useAgentTeamStore.getState().setTeams(d.teams);
        }
      })
      .catch(() => {});

    // Supervisor Agent ID の存在確認（CDK enableMultiAgent=true 時に設定される）
    fetch('/api/bedrock/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list' }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.agents)) {
          const hasSupervisorAgent = d.agents.some((a: any) =>
            a.agentName?.includes('supervisor') || a.agentId === process.env.NEXT_PUBLIC_SUPERVISOR_AGENT_ID
          );
          setHasSupervisor(hasSupervisorAgent);
        }
      })
      .catch(() => {});
  }, []);

  // UnifiedModeToggle のモード変更ハンドラ（useHeaderStore.setChatMode と同期 — Task 8.4）
  const handleHeaderModeChange = useCallback((mode: ChatMode) => {
    // useHeaderStore.chatMode を更新
    setHeaderChatMode(mode);

    if (mode === 'kb') {
      const url = new URL(window.location.href);
      url.searchParams.delete('mode');
      window.history.replaceState({}, '', url.toString());
    } else {
      const teamMode = mode === 'multi-agent' ? 'multi' : 'single';
      useAgentTeamStore.getState().setAgentMode(teamMode);
      const url = new URL(window.location.href);
      url.searchParams.set('mode', mode === 'multi-agent' ? 'multi-agent' : 'agent');
      window.history.replaceState({}, '', url.toString());
      // Multi モード切替時に selectedTeam が未設定なら最初の Team を選択
      if (teamMode === 'multi') {
        const { selectedTeam, teams, setSelectedTeam } = useAgentTeamStore.getState();
        if (!selectedTeam && teams.length > 0) {
          setSelectedTeam(teams[0]);
        }
      }
    }
  }, [setHeaderChatMode]);

  // HeaderAgentSelector 用の Agent リスト（API から取得）
  const [headerAgentList, setHeaderAgentList] = useState<AgentListItem[]>([]);
  useEffect(() => {
    if (!agentMode) return;
    fetch(`/api/bedrock/agents/list?region=${regionStore.selectedRegion}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.agents) {
          setHeaderAgentList(
            d.agents.map((a: any) => ({
              agentId: a.agentId,
              agentName: a.agentName || a.agentId,
              status: a.status === 'PREPARED' ? 'PREPARED' : a.status === 'FAILED' ? 'FAILED' : 'NOT_PREPARED',
            }))
          );
        }
      })
      .catch(() => {});
  }, [agentMode, regionStore.selectedRegion]);

  // ModelIndicator 用のモデルリスト
  const [headerModelList, setHeaderModelList] = useState<Array<{ modelId: string; modelName: string }>>([]);
  useEffect(() => {
    fetch('/api/bedrock/region-info')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.availableModels) {
          setHeaderModelList(
            d.data.availableModels.map((m: any) => ({
              modelId: m.modelId,
              modelName: m.modelName || m.modelId,
            }))
          );
        }
      })
      .catch(() => {});
  }, [regionStore.selectedRegion]);

  // OverflowMenu 用のアイテム（sm 未満で表示される項目）
  const headerOverflowItems: OverflowMenuItem[] = useMemo(() => [
    {
      id: 'language',
      label: t('common.language') ?? 'Language',
      onClick: () => {
        // LanguageSwitcher はドロップダウンなので、OverflowMenu 内では簡易的にトグル
        // 実際の言語切替は LanguageSwitcher コンポーネントが担当
      },
    },
    {
      id: 'theme',
      label: themeStore.effectiveTheme === 'dark' ? 'Light Mode' : 'Dark Mode',
      onClick: () => {
        themeStore.setTheme(themeStore.effectiveTheme === 'dark' ? 'light' : 'dark');
      },
    },
    {
      id: 'agent-directory',
      label: t('agentDirectory.nav.agents'),
      onClick: () => {
        router.push(`/${memoizedLocale}/genai/agents`);
      },
    },
  ], [t, themeStore, router, memoizedLocale]);

  // === End Task 8.1 header state ===

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
      {/* Task 9.3: md 未満時のバックドロップ — クリックでサイドバーを閉じる */}
      {isBelowMd && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* サイドバー（モードに応じて切替） — Task 9.2: 折りたたみアニメーション + aria-hidden, Task 9.3: レスポンシブオーバーレイ */}
      <div
        className={`
          ${isBelowMd
            ? `fixed top-0 left-0 h-full z-50 ${sidebarOpen ? 'w-80' : 'w-0'}`
            : `${sidebarOpen ? 'w-80' : 'w-0'} flex-shrink-0`
          }
          transition-all duration-300 ease-in-out overflow-hidden bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
        `}
        aria-hidden={!sidebarOpen}
      >
        {agentMode ? (
          /* Agentモードサイドバー */
          <AgentModeSidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onNewChat={() => {
              if (!user) return;
              const sessionTitle = memoizedLocale === 'en'
                ? `New Chat - ${new Date().toLocaleDateString('en-US')}`
                : `新しいチャット - ${new Date().toLocaleDateString('ja-JP')}`;
              setCurrentSession({
                id: `session-${Date.now()}`,
                title: sessionTitle,
                messages: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }}
            selectedModelId={selectedModelId}
            onModelChange={setSelectedModelId}
            onCreateAgent={() => {
              router.push(`/${memoizedLocale}/genai/agents`);
            }}
            userName={user?.username}
            userEmail={user?.email || user?.username}
            userRole={user?.role}
            userDirectories={userDirectories}
            locale={memoizedLocale}
          />
        ) : (
          /* KBモードサイドバー */
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
                    {userDirectories.accessibleDirectories.length > 0 && (
                      <div className="mt-1 ml-4 text-gray-500 dark:text-gray-500">
                        {userDirectories.accessibleDirectories.join(', ')}
                      </div>
                    )}
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

            {/* チャット履歴設定セクション（独立項目） */}
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

            {/* システム管理 CollapsiblePanel */}
            <CollapsiblePanel title={tSidebar('systemSettings')} icon="⚙️" storageKey="system-settings">

            {/* Bedrockリージョン選択セクション */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('region.bedrockRegion')}</h3>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <div>🌍 {RegionConfigManager.getRegionDisplayName(regionStore.selectedRegion)} ({regionStore.selectedRegion})</div>
                <div>🤖 {availableModelCount}モデル利用可能</div>
              </div>
              <RegionSelector />
            </div>

            {/* AIモデル選択セクション */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              {/* ✅ Task 2 Fix: Agent mode時も通常のModelSelectorを使用 */}
              <ModelSelector
                mode={agentMode ? 'agent' : 'kb'}
                selectedModelId={selectedModelId}
                onModelChange={setSelectedModelId}
                showAdvancedFilters={true}
              />
            </div>

            {/* Smart Routing Toggle (Task 11.3) */}
            <RoutingToggle locale={memoizedLocale} />

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

            </CollapsiblePanel>
          </div>
        </div>
        )}
      </div>

      {/* メインコンテンツ — Task 9.3: Chat_Area 最低幅 320px */}
      <div className="flex-1 flex flex-col min-w-[320px] transition-all duration-300">
        {/* ヘッダー — Flexbox左右グループレイアウト (Task 8.1) */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 flex-shrink-0">
          <div className="px-3 sm:px-4 lg:px-6">
            <div className="flex items-center h-14 gap-3">
              {/* 左グループ: flex-1 で残りスペースを吸収、Agent_Selector の幅変動を吸収 */}
              <div className="flex flex-1 min-w-0 items-center gap-2">
                {/* サイドバートグル */}
                <button
                  onClick={toggleSidebar}
                  aria-label={sidebarOpen ? translations.sidebarToggleClose : translations.sidebarToggleOpen}
                  className="p-2 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0 transition-colors"
                  title={sidebarOpen ? translations.sidebarToggleClose : translations.sidebarToggleOpen}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>

                {/* アプリタイトル */}
                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate flex-shrink-0">{translations.title}</h1>

                {/* UnifiedModeToggle (KB / Single Agent / Multi Agent) */}
                <UnifiedModeToggle
                  mode={headerChatMode}
                  onModeChange={handleHeaderModeChange}
                  multiAgentAvailable={headerMultiAgentAvailable}
                />

                {/* HeaderAgentSelector — Agent モード時のみ表示 */}
                {agentMode && (() => {
                  // Multi Agent: Supervisor/Team のみ表示、Single Agent: Supervisor以外を表示
                  const teams = useAgentTeamStore.getState().teams;
                  const supervisorIds = new Set(teams.map((t: any) => t.supervisorAgentId).filter(Boolean));
                  const filteredAgents = headerChatMode === 'multi-agent'
                    ? headerAgentList.filter((a) => supervisorIds.has(a.agentId))
                    : headerAgentList.filter((a) => !supervisorIds.has(a.agentId));
                  return (
                    <HeaderAgentSelector
                      selectedAgentId={selectedAgentId}
                      onAgentChange={(agentId) => {
                        useAgentStore.getState().setSelectedAgentId(agentId);
                      }}
                      agents={filteredAgents}
                      locale={memoizedLocale}
                    />
                  );
                })()}
              </div>

              {/* 右グループ: flex-shrink-0 で固定幅、モード切替に関わらず位置安定 */}
              <div className="flex flex-shrink-0 items-center gap-2">
                {/* 言語切り替え (sm以上で表示、sm未満はOverflowMenuへ) */}
                <div className="hidden sm:block">
                  <LanguageSwitcher currentLocale={memoizedLocale} variant="dropdown" />
                </div>

                {/* テーマ切替 (sm以上で表示、sm未満はOverflowMenuへ) */}
                <div className="hidden sm:block">
                  <ThemeToggle variant="icon" />
                </div>

                {/* UserMenu */}
                <UserMenu
                  username={user?.username ?? ''}
                  locale={memoizedLocale}
                  onSignOut={handleSignOut}
                />

                {/* OverflowMenu (sm未満で表示) */}
                <OverflowMenu items={headerOverflowItems} />
              </div>
            </div>
          </div>
        </header>

        {/* チャットエリア */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* メッセージリスト */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-4 bg-white dark:bg-gray-900">
            {(() => {
              const hasUserMessages = currentSession?.messages?.some(m => m.role === 'user') ?? false;
              console.log('🎨 [ChatbotPage] Rendering messages area:', {
                hasCurrentSession: !!currentSession,
                currentSessionId: currentSession?.id,
                messagesCount: currentSession?.messages?.length,
                messagesIsArray: Array.isArray(currentSession?.messages),
                hasUserMessages,
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

            {!(currentSession?.messages?.some(m => m.role === 'user') ?? false) && user && (
              <CardGrid
                mode={agentMode ? 'agent' : 'kb'}
                locale={memoizedLocale}
                selectedAgentId={agentMode ? selectedAgentId : null}
                onCardClick={async (prompt, label, cardId) => {
                  setInputText(prompt);
                  if (agentMode && cardId) {
                    // Agent mode: resolve agent via bindingService
                    try {
                      const agentCards = getCardsByMode('agent');
                      const card = agentCards.find(c => c.id === cardId);
                      if (card) {
                        const mappingStore = useCardAgentMappingStore.getState();
                        // First try cache and static
                        if (card.agentId) {
                          useAgentStore.getState().setSelectedAgentId(card.agentId);
                          console.log(`✅ [CardGrid] Agent resolved (static): ${card.agentId}`);
                        } else {
                          const cached = mappingStore.getMapping(card.id);
                          if (cached) {
                            useAgentStore.getState().setSelectedAgentId(cached.agentId);
                            console.log(`✅ [CardGrid] Agent resolved (cache): ${cached.agentId}`);
                          } else {
                            // Search by category keywords
                            const categoryConfig = AGENT_CATEGORY_MAP[card.category];
                            if (categoryConfig) {
                              const found = await findAgentByCategory(card.category, categoryConfig);
                              if (found) {
                                mappingStore.setMapping(card.id, {
                                  agentId: found.agentId,
                                  agentAliasId: found.agentAliasId,
                                  resolvedAt: Date.now(),
                                });
                                useAgentStore.getState().setSelectedAgentId(found.agentId);
                                console.log(`✅ [CardGrid] Agent resolved (search): ${found.agentId}`);
                              } else {
                                // No agent found → redirect to Agent Directory creation form
                                console.log(`🔄 [CardGrid] No agent found for category "${card.category}", redirecting to Agent Directory creator`);
                                router.push(`/${memoizedLocale}/genai/agents?create=${card.category}`);
                                return;
                              }
                            }
                          }
                        }
                      }
                    } catch (err) {
                      console.warn('⚠️ [CardGrid] Agent resolution failed, redirecting to creator:', err);
                      const agentCards = getCardsByMode('agent');
                      const card = agentCards.find(c => c.id === cardId);
                      if (card?.category) {
                        router.push(`/${memoizedLocale}/genai/agents?create=${card.category}`);
                        return;
                      }
                    }
                    window.dispatchEvent(new CustomEvent('agent-workflow-selected', {
                      detail: { prompt, label },
                      bubbles: true,
                    }));
                  }
                }}
                username={user.username}
                role={user.role || 'User'}
                userDirectories={userDirectories}
              />
            )}
            
            {(currentSession?.messages?.some(m => m.role === 'user') ?? false) && currentSession?.messages?.map((message: Message, index) => {
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
                    {/* ResponseMetadata (Task 11.4) */}
                    {message.role === 'assistant' && messageRoutingDecisions[message.id] && (
                      <ResponseMetadata
                        modelName={messageRoutingDecisions[message.id].modelName}
                        isAutoRouted={messageRoutingDecisions[message.id].isAutoRouted}
                        isManualOverride={messageRoutingDecisions[message.id].isManualOverride}
                        classification={messageRoutingDecisions[message.id].classification}
                        confidence={messageRoutingDecisions[message.id].confidence}
                        hasImageAnalysis={messageRoutingDecisions[message.id].hasImageAnalysis}
                        locale={memoizedLocale}
                      />
                    )}
                    {/* Multi-Agent Trace Display (conditionally rendered when trace data present) */}
                    {message.role === 'assistant' && (message as any).multiAgentTrace && (
                      <div className="mt-3 space-y-2">
                        <MultiAgentTraceTimeline trace={(message as any).multiAgentTrace as MultiAgentTraceResult} />
                        {((message as any).multiAgentTrace as MultiAgentTraceResult).collaboratorTraces.map((ct) => (
                          <CollaboratorDetailPanel key={ct.collaboratorAgentId} trace={ct} />
                        ))}
                        <CostSummary trace={(message as any).multiAgentTrace as MultiAgentTraceResult} />
                      </div>
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
                  {/* Multi-Agent リアルタイムステータス表示 */}
                  <MultiAgentExecutionStatusDisplay />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 入力エリア */}
          <div className="border-t dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex-shrink-0">
            {/* ワークフロー選択に戻るボタン（チャット中のみ表示） */}
            {(currentSession?.messages?.some(m => m.role === 'user') ?? false) && (
              <div className="max-w-4xl mx-auto mb-2">
                <button
                  onClick={() => {
                    // 新しいセッションを作成してカードグリッドに戻る
                    let initialMessageText: string;
                    if (userDirectories) {
                      initialMessageText = generateInitialMessageWithDirectories(
                        user.username, user.role || 'User', userDirectories, t
                      );
                    } else {
                      initialMessageText = generateInitialMessage(
                        user.username, user.role || 'User', t
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
                    setInputText('');
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors flex items-center space-x-1"
                >
                  <span>🔄</span>
                  <span>{t('chat.returnToWorkflow')}</span>
                </button>
              </div>
            )}
            {attachedImage && (
              <div className="mb-2 max-w-4xl mx-auto">
                <ImagePreview image={attachedImage} onRemove={() => setAttachedImage(null)} />
              </div>
            )}
            <form onSubmit={handleSendMessage} className="flex space-x-3 max-w-4xl mx-auto">
              <ImageUploadZone
                onImageSelected={(img) => setAttachedImage(img)}
                onError={(err) => console.warn('[ImageUpload]', err)}
                disabled={isLoading}
                locale={memoizedLocale}
              />
              <button
                type="button"
                onClick={() => {
                  if (!user) return;
                  let initialMessageText: string;
                  if (userDirectories) {
                    initialMessageText = generateInitialMessageWithDirectories(user.username, user.role || 'User', userDirectories, t);
                  } else {
                    initialMessageText = generateInitialMessage(user.username, user.role || 'User', t);
                  }
                  const newSession: ChatSession = {
                    id: Date.now().toString(),
                    title: translations.newChat,
                    messages: [{ id: '1', content: initialMessageText, role: 'assistant', timestamp: Date.now() }],
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    userId: user.username,
                  };
                  setCurrentSession(newSession);
                  addChatSession(newSession);
                  setInputText('');
                }}
                className="px-3 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex-shrink-0"
                title={translations.newChatShortcut}
              >
                ➕
              </button>
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
      {/* ImageModal (Task 11.1) */}
      {imageModalOpen && imageModalData && (
        <ImageModal
          base64Data={imageModalData.base64Data}
          mimeType={imageModalData.mimeType}
          isOpen={imageModalOpen}
          onClose={() => { setImageModalOpen(false); setImageModalData(null); }}
        />
      )}
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
