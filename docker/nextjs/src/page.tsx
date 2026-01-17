'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useSafeTranslations } from './hooks/useSafeTranslations';
import { useChatStore } from './store/useChatStore';
import { Message, ChatSession } from './types/chat';
import { ModelSelector } from './components/bedrock/ModelSelector';
import { RegionSelector } from './components/bedrock/RegionSelector';
import { DEFAULT_MODEL_ID, getModelById } from './config/bedrock-models';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { LanguageSelector } from './components/ui/LanguageSelector';
import { ErrorMessage, createErrorDetails, type ErrorDetails } from './components/ui/ErrorMessage';
import { ResizableSidebar } from './components/ui/ResizableSidebar';
import { Header } from './components/Header';
import { type Locale } from './i18n/config';

// エラーアクションの型定義
interface ErrorAction {
  type: 'request_admin' | 'enable_model' | 'change_region' | 'retry';
  label: string;
  enabled: boolean;
  requiresPermission?: 'admin' | 'user';
}

// エラーメッセージとアクションボタンを表示するコンポーネント
interface ErrorMessageWithActionsProps {
  error: string;
  actions?: ErrorAction[];
  onAction: (actionType: string) => void;
  isProcessing?: boolean;
}

function ErrorMessageWithActions({ error, actions, onAction, isProcessing }: ErrorMessageWithActionsProps) {
  return (
    <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <span className="text-red-400 text-xl">⚠️</span>
        </div>
        <div className="ml-3 flex-1">
          <div className="text-sm whitespace-pre-wrap mb-3">{error}</div>
          
          {actions && actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {actions.map((action) => (
                <button
                  key={action.type}
                  onClick={() => onAction(action.type)}
                  disabled={!action.enabled || isProcessing}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    action.enabled && !isProcessing
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isProcessing ? (
                    <span className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>処理中...</span>
                    </span>
                  ) : (
                    action.label
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Markdownライクなテキストをレンダリングするコンポーネント
function MessageContent({ text, onRetry }: { text: string; onRetry?: () => void }) {
  // エラー詳細が含まれているかチェック
  const errorDetailsMatch = text.match(/\*\*(AGENT_ERROR_DETAILS|RAG_ERROR_DETAILS|SEND_ERROR_DETAILS)\*\*([\s\S]*?)\*\*END_ERROR_DETAILS\*\*/);
  
  if (errorDetailsMatch) {
    try {
      const errorDetails: ErrorDetails = JSON.parse(errorDetailsMatch[2]);
      const remainingText = text.replace(errorDetailsMatch[0], '').trim();
      
      return (
        <div className="space-y-3">
          <ErrorMessage 
            error={errorDetails} 
            onRetry={onRetry}
            className="mb-3"
          />
          {remainingText && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {remainingText}
            </div>
          )}
        </div>
      );
    } catch (e) {
      console.error('Failed to parse error details:', e);
      // パースに失敗した場合は通常の表示にフォールバック
    }
  }

  // **text** を <strong>text</strong> に変換
  const formatText = (text: string) => {
    return text
      .split(/(\*\*[^*]+\*\*)/g)
      .map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const content = part.slice(2, -2);
          return <strong key={index} className="font-semibold text-gray-900 dark:text-gray-100">{content}</strong>;
        }
        return part;
      });
  };

  return (
    <div className="space-y-1">
      {text.split('\n').map((line, lineIndex) => {
        const trimmedLine = line.trim();

        if (trimmedLine === '') {
          return <div key={lineIndex} className="h-2" />;
        }

        // リスト項目の処理
        if (trimmedLine.startsWith('• ')) {
          return (
            <div key={lineIndex} className="flex items-start space-x-2 ml-2">
              <span className="text-blue-600 dark:text-blue-400 font-bold mt-0.5">•</span>
              <span className="flex-1">{formatText(trimmedLine.slice(2))}</span>
            </div>
          );
        }

        // セクションヘッダー（**で囲まれた行）の処理
        if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**') && trimmedLine.length > 4) {
          const content = trimmedLine.slice(2, -2);
          return (
            <div key={lineIndex} className="font-semibold text-gray-900 dark:text-gray-100 mt-3 mb-1">
              {content}
            </div>
          );
        }

        return (
          <div key={lineIndex}>
            {formatText(trimmedLine)}
          </div>
        );
      })}
    </div>
  );
}

export default function ChatbotPage() {
  const { t } = useSafeTranslations();
  const locale = useLocale();
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);
  const [selectedModelName, setSelectedModelName] = useState('Amazon Nova Pro');
  const [userDirectories, setUserDirectories] = useState<any>(null);
  const [isLoadingDirectories, setIsLoadingDirectories] = useState(false);
  const [errorActions, setErrorActions] = useState<ErrorAction[]>([]);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionMessage, setActionMessage] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
    agentMode,
    setAgentMode,
    selectedAgentId,
    setSelectedAgentId
  } = useChatStore();

  useEffect(() => {
    // クライアントサイドでのみ実行
    setIsClient(true);
    
    if (typeof window === 'undefined') return;
    
    // 認証チェック
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/signin');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
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
        const newSession: ChatSession = {
          id: `session_${Date.now()}`,
          title: `チャット - ${new Date().toLocaleDateString('ja-JP')}`,
          messages: [{
            id: '1',
            content: `こんにちは、${parsedUser.username}さん！

**Permission-aware RAG Chatbot**へようこそ🎉

**あなたのアクセス権限:**
• **ユーザー**: ${parsedUser.username}
• **ロール**: ${parsedUser.role || 'User'}
• **アクセス可能ディレクトリ**: 取得中...

*FSx for ONTAPから実際のディレクトリ権限を確認しています*

**利用可能な機能:**
• 📄 文書検索・質問応答
• 🔐 権限ベースアクセス制御

**現在のAIモデル:**
• **${getModelById(DEFAULT_MODEL_ID)?.name || 'Amazon Nova Pro'}** - Amazon提供モデル

**チャット履歴設定:**
${saveHistory ? '✅ 履歴保存が有効です。会話は自動保存されます。' : '❌ 履歴保存が無効です。セッション終了時に削除されます。'}

**質問例:**
• "アクセス可能な文書を検索してください"
• "過去の資料を参考にXXXのパワーポイントを作成してください。元ファイルのパスも教えてください"

何でもお気軽にご質問ください！`,
            role: 'assistant',
            timestamp: Date.now()
          }],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          userId: parsedUser.username,
          mode: 'kb',
          model: selectedModelId,
          region: 'ap-northeast-1'
        };

        setCurrentSession(newSession);
      }
    } catch (error) {
      console.error('Failed to parse user data:', error);
      router.push('/signin');
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages]);

  // モデル選択時にヘッダー表示を更新するためのuseEffect
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
            if (selectedModel) {
              console.log('Found selected model info:', selectedModel);
              setSelectedModelName(selectedModel.modelName);
            } else {
              console.log('Model not found in API, using fallback');
              // フォールバック: getModelByIdを使用
              const fallbackModel = getModelById(selectedModelId);
              if (fallbackModel) {
                console.log('Using fallback model:', fallbackModel);
                setSelectedModelName(fallbackModel.name);
              } else {
                console.log('No fallback model found, using model ID as name');
                setSelectedModelName(selectedModelId);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to update model info:', error);
        // エラー時もフォールバックを試行
        const fallbackModel = getModelById(selectedModelId);
        if (fallbackModel) {
          setSelectedModelName(fallbackModel.name);
        }
      }
    };
    
    updateModelInfo();
    
    // セッションのモデルも更新
    if (currentSession) {
      setCurrentSession({
        ...currentSession,
        model: selectedModelId
      });
    }
  }, [selectedModelId]);

  // ディレクトリ情報が取得されたら初期メッセージを更新
  useEffect(() => {
    if (userDirectories && currentSession && user && currentSession.messages.length > 0) {
      // 初期メッセージのみを更新（無限ループを防ぐ）
      const firstMessage = currentSession.messages[0];
      if (firstMessage && firstMessage.id === '1' && firstMessage.role === 'assistant' && !firstMessage.content.includes('FSx for ONTAP実環境')) {
        // ディレクトリ情報の表示形式を決定
        let directoryDisplay = '';
        let directoryNote = '';
        
        switch (userDirectories.directoryType) {
          case 'actual':
            directoryDisplay = userDirectories.accessibleDirectories.join(', ');
            directoryNote = `✅ **FSx for ONTAP実環境**: ${userDirectories.fsxFileSystemId}から取得`;
            break;
          case 'test':
            directoryDisplay = userDirectories.accessibleDirectories.join(', ');
            directoryNote = `🧪 **テストユーザー**: シミュレートされた権限`;
            break;
          case 'simulated':
            directoryDisplay = userDirectories.accessibleDirectories.join(', ');
            directoryNote = `⚠️ **シミュレーション**: FSxは利用可能ですが権限情報を取得できませんでした`;
            break;
          case 'unavailable':
            directoryDisplay = userDirectories.accessibleDirectories.join(', ');
            directoryNote = `❌ **FSx利用不可**: フォールバックディレクトリを表示`;
            break;
          default:
            directoryDisplay = '/shared, /public, /user/' + user.username;
            directoryNote = `❓ **不明**: デフォルトディレクトリを表示`;
        }

        const updatedText = `こんにちは、${user.username}さん！

**Permission-aware RAG Chatbot**へようこそ🎉

**あなたのアクセス権限:**
• **ユーザー**: ${user.username}
• **ロール**: ${user.role || 'User'}
• **アクセス可能ディレクトリ**: ${directoryDisplay}

${directoryNote}

**権限詳細:**
• **読み取り**: ${userDirectories.permissions.read ? '✅ 可能' : '❌ 不可'}
• **書き込み**: ${userDirectories.permissions.write ? '✅ 可能' : '❌ 不可'}
• **実行**: ${userDirectories.permissions.execute ? '✅ 可能' : '❌ 不可'}

**利用可能な機能:**
• � 文書検索ス・質問応答
• 🔐 権限ベースアクセス制御

**現在のAIモデル:**
• **${getModelById(DEFAULT_MODEL_ID)?.name || 'Amazon Nova Pro'}** - Amazon提供モデル

**チャット履歴設定:**
${saveHistory ? '✅ 履歴保存が有効です。会話は自動保存されます。' : '❌ 履歴保存が無効です。セッション終了時に削除されます。'}

**質問例:**
• "アクセス可能な文書を検索してください"
• "過去の資料を参考にXXXのパワーポイントを作成してください。元ファイルのパスも教えてください"

何でもお気軽にご質問ください！`;

        const updatedMessages = [...currentSession.messages];
        updatedMessages[0] = { ...firstMessage, content: updatedText };
        setCurrentSession({ ...currentSession, messages: updatedMessages });
      }
    }
  }, [userDirectories]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  /**
   * エラーアクションを処理
   */
  const handleErrorAction = async (actionType: string) => {
    if (!user || !currentSession) return;

    setIsProcessingAction(true);
    setActionMessage('');

    try {
      console.log(`🎯 エラーアクション実行: ${actionType}`);

      switch (actionType) {
        case 'enable_model':
          // モデルアクセスを申請
          await handleEnableModel();
          break;

        case 'request_admin':
          // 管理者に依頼
          await handleRequestAdmin();
          break;

        case 'change_region':
          // リージョン変更を促す
          setActionMessage('リージョンセレクターから別のリージョンを選択してください。');
          break;

        case 'retry':
          // 再試行
          setActionMessage('しばらく待ってから再度お試しください。');
          break;

        default:
          console.warn(`未知のアクションタイプ: ${actionType}`);
      }
    } catch (error: any) {
      console.error(`❌ アクション実行エラー: ${actionType}`, error);
      setActionMessage(`エラーが発生しました: ${error.message}`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  /**
   * モデルアクセスを申請（admin権限）
   */
  const handleEnableModel = async () => {
    try {
      console.log(`🚀 モデルアクセス申請開始: ${selectedModelId}`);

      const response = await fetch('/api/bedrock/enable-model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: selectedModelId,
          userId: user.username,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setActionMessage(`✅ ${data.message}`);
        
        // 成功メッセージをチャットに追加
        if (currentSession) {
          const successMessage: Message = {
            id: Date.now().toString(),
            content: `✅ モデルアクセスが有効化されました！\n\nモデル「${selectedModelId}」が利用可能になりました。\n再度メッセージを送信してください。`,
            role: 'assistant',
            timestamp: Date.now()
          };
          addMessage(successMessage);
        }
        
        // エラーアクションをクリア
        setErrorActions([]);
      } else {
        setActionMessage(`❌ ${data.message}`);
      }
    } catch (error: any) {
      console.error('❌ モデルアクセス申請エラー:', error);
      setActionMessage(`❌ モデルアクセス申請に失敗しました: ${error.message}`);
    }
  };

  /**
   * 管理者に依頼（user権限）
   */
  const handleRequestAdmin = async () => {
    try {
      console.log(`📧 管理者依頼送信開始: ${selectedModelId}`);

      const response = await fetch('/api/bedrock/request-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: selectedModelId,
          userId: user.username,
          userName: user.username,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setActionMessage(`✅ ${data.message}`);
        
        // 成功メッセージをチャットに追加
        if (currentSession) {
          const successMessage: Message = {
            id: Date.now().toString(),
            content: `✅ 管理者に依頼を送信しました！\n\nモデル「${selectedModelId}」の有効化を管理者に依頼しました。\n承認されるまでしばらくお待ちください。`,
            role: 'assistant',
            timestamp: Date.now()
          };
          addMessage(successMessage);
        }
        
        // エラーアクションをクリア
        setErrorActions([]);
      } else {
        setActionMessage(`❌ ${data.message}`);
      }
    } catch (error: any) {
      console.error('❌ 管理者依頼送信エラー:', error);
      setActionMessage(`❌ 管理者依頼の送信に失敗しました: ${error.message}`);
    }
  };

  const generateAgentResponse = async (query: string): Promise<string> => {
    try {
      console.log('🤖 [Agent] Sending request to Bedrock Agent API:', { 
        query: query.substring(0, 100), 
        user: user.username,
        selectedAgentId: selectedAgentId
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
        }),
      });

      console.log('Bedrock Agent API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Bedrock Agent API error response:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Bedrock Agent API response data:', { success: data.success, answerLength: data.answer?.length });

      if (data.success) {
        return data.answer;
      } else {
        // 構造化されたエラーレスポンスの場合
        if (data.error && typeof data.error === 'object') {
          const errorDetails = data.error;
          return `**AGENT_ERROR_DETAILS**${JSON.stringify(errorDetails)}**END_ERROR_DETAILS**

Bedrock Agent でエラーが発生しました: ${errorDetails.message}`;
        }
        
        // 従来のエラーレスポンスの場合
        throw new Error(data.error || data.message || 'Unknown error');
      }
    } catch (error: unknown) {
      console.error('Bedrock Agent API Error:', error);
      
      const errorDetails = createErrorDetails(error as Error, {
        userId: user.username,
        apiUrl: '/api/bedrock/agent-invoke'
      }, {
        code: 'AGENT_API_ERROR',
        retryable: true,
        suggestions: [
          'ブラウザのコンソールログを確認してください',
          '通常モードに切り替えてみてください',
          '問題が続く場合は、システム管理者にお問い合わせください'
        ]
      });

      // エラー詳細をJSONとして保存（後でErrorMessageコンポーネントで使用）
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return `**AGENT_ERROR_DETAILS**${JSON.stringify(errorDetails)}**END_ERROR_DETAILS**

Bedrock Agent API でエラーが発生しました: ${errorMessage}`;
    }
  };

  const generateRAGResponse = async (query: string): Promise<string> => {
    try {
      console.log('Sending request to Bedrock API:', { query: query.substring(0, 100), user: user.username, modelId: selectedModelId });
      
      // 実際のBedrock API呼び出し
      const response = await fetch('/api/bedrock/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: query,
          userId: user.username,
          permissions: user.permissions || ['基本機能'],
          modelId: selectedModelId
        }),
      });

      console.log('Bedrock API response status:', response.status);

      const data = await response.json();
      console.log('Bedrock API response data:', data);

      if (data.success) {
        // エラーアクションをクリア
        setErrorActions([]);
        setActionMessage('');
        return data.answer;
      } else {
        // エラーレスポンスの処理
        console.error('Bedrock API error:', data);
        
        // 構造化されたエラーレスポンスの場合
        if (data.error && typeof data.error === 'object') {
          const errorDetails = data.error;
          return `**RAG_ERROR_DETAILS**${JSON.stringify(errorDetails)}**END_ERROR_DETAILS**

Bedrock API でエラーが発生しました: ${errorDetails.message}`;
        }
        
        // 従来のエラーレスポンスの場合
        if (data.actions && data.actions.length > 0) {
          setErrorActions(data.actions);
        }
        
        // エラーメッセージを返す
        return data.error || data.message || 'Unknown error';
      }
    } catch (error: unknown) {
      console.error('Bedrock API Error:', error);

      // エラーの詳細をログ出力
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }

      const errorDetails = createErrorDetails(error as Error, {
        modelId: selectedModelId,
        modelName: getModelById(selectedModelId)?.name,
        userId: user.username,
        apiUrl: '/api/bedrock/chat'
      }, {
        code: 'BEDROCK_API_ERROR',
        retryable: true,
        suggestions: [
          'ブラウザのコンソールログを確認してください',
          '別のモデルを選択してみてください',
          '問題が続く場合は、システム管理者にお問い合わせください'
        ]
      });

      // エラー詳細をJSONとして保存（後でErrorMessageコンポーネントで使用）
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return `**RAG_ERROR_DETAILS**${JSON.stringify(errorDetails)}**END_ERROR_DETAILS**

Bedrock API でエラーが発生しました: ${errorMessage}`;
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading || !currentSession) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputText,
      role: 'user',
      timestamp: Date.now()
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
        timestamp: Date.now()
      };

      addMessage(botResponse);

      // 履歴保存が有効な場合のみ保存
      if (saveHistory) {
        await saveChatHistory();
      }
    } catch (error: unknown) {
      console.error('Message sending error:', error);
      
      const errorDetails = createErrorDetails(error as Error, {
        userId: user.username,
        apiUrl: agentMode ? '/api/bedrock/agent-invoke' : '/api/bedrock/chat'
      }, {
        code: 'MESSAGE_SEND_ERROR',
        retryable: true,
        suggestions: [
          'しばらく時間をおいてから再試行してください',
          'インターネット接続を確認してください',
          'ブラウザを再読み込みしてください'
        ]
      });

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `**SEND_ERROR_DETAILS**${JSON.stringify(errorDetails)}**END_ERROR_DETAILS**

申し訳ございません。メッセージの送信中にエラーが発生しました。`,
        role: 'assistant',
        timestamp: Date.now()
      };
      addMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('user');
    router.push('/signin');
  };

  if (!isClient || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex overflow-hidden">
      {/* リサイズ可能なサイドバー */}
      <ResizableSidebar isOpen={sidebarOpen} minWidth={240} maxWidth={480} defaultWidth={320}>
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('sidebar.settingsPanel')}</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* 新しいチャット */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  if (!user) return;
                  const newSession: ChatSession = {
                    id: `session_${Date.now()}`,
                    title: `${t('sidebar.newChat')} - ${new Date().toLocaleDateString(locale)}`,
                    messages: [],
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    userId: user.username,
                    mode: 'kb',
                    model: selectedModelId,
                    region: 'ap-northeast-1'
                  };
                  setCurrentSession(newSession);
                  if (saveHistory) {
                    addChatSession(newSession);
                  }
                }}
                className="w-full px-2 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors"
              >
                + {t('sidebar.newChat')}
              </button>
            </div>

            {/* チャット履歴セクション */}
            {saveHistory && chatSessions && Array.isArray(chatSessions) && chatSessions.length > 0 && (
              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sidebar.chatHistory')}</h3>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {(chatSessions || []).slice(0, 3).map((session: ChatSession) => (
                    <button
                      key={session.id}
                      onClick={() => setCurrentSession(session)}
                      className={`w-full text-left p-1 rounded-md text-xs transition-colors ${currentSession?.id === session.id
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                    >
                      <div className="font-medium truncate text-xs">{session.title}</div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs">
                        {new Date(session.updatedAt).toLocaleDateString(locale)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ユーザー情報セクション */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('sidebar.userInfo')}</h3>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {user.username} ({user.role || 'User'})
              </div>
            </div>

            {/* FSxディレクトリ情報セクション */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('sidebar.accessPermissions')}</h3>
              {isLoadingDirectories ? (
                <div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                  <span>{t('sidebar.permissionsChecking')}</span>
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
                        {userDirectories.directoryType === 'actual' && t('sidebar.fsxActual')}
                        {userDirectories.directoryType === 'test' && t('sidebar.fsxTest')}
                        {userDirectories.directoryType === 'simulated' && t('sidebar.fsxSimulated')}
                        {userDirectories.directoryType === 'unavailable' && t('sidebar.fsxUnavailable')}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    <div>📁 {t('sidebar.directories').replace('{count}', userDirectories.accessibleDirectories.length.toString())}</div>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={userDirectories.permissions.read ? 'text-green-600' : 'text-red-600'}>
                        {userDirectories.permissions.read ? '✅' : '❌'} {t('sidebar.readPermission')}
                      </span>
                      <span className={userDirectories.permissions.write ? 'text-green-600' : 'text-red-600'}>
                        {userDirectories.permissions.write ? '✅' : '❌'} {t('sidebar.writePermission')}
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
                  {t('sidebar.permissionsChecking')}
                </div>
              )}
            </div>

            {/* Bedrockリージョン選択セクション */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <RegionSelector locale={locale} />
            </div>

            {/* チャット履歴設定セクション */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sidebar.chatHistorySettings')}</h3>
              <button
                onClick={() => setSaveHistory(!saveHistory)}
                className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                  saveHistory
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 font-medium'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-base">{saveHistory ? '💾' : '🚫'}</span>
                  <div className="flex-1">
                    <div className="font-medium">{saveHistory ? t('sidebar.historySaving') : t('sidebar.historyDisabled')}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {saveHistory ? t('sidebar.autoSave') : t('sidebar.sessionOnly')}
                    </div>
                  </div>
                  {saveHistory && <span className="text-green-600 dark:text-green-400">✓</span>}
                </div>
              </button>
            </div>

            {/* 動作モード切り替えセクション */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sidebar.operationMode')}</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setAgentMode(false)}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                    !agentMode
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 font-medium'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-base">📚</span>
                    <div className="flex-1">
                      <div className="font-medium">{t('chat.knowledgeBaseMode')}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {t('chat.kbFeature1')}
                      </div>
                    </div>
                    {!agentMode && <span className="text-blue-600 dark:text-blue-400">✓</span>}
                  </div>
                </button>
                
                <button
                  onClick={() => setAgentMode(true)}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                    agentMode
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 font-medium'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-base">🤖</span>
                    <div className="flex-1">
                      <div className="font-medium">{t('chat.agentMode')}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {t('chat.agentFeature1')}
                      </div>
                    </div>
                    {agentMode && <span className="text-purple-600 dark:text-purple-400">✓</span>}
                  </div>
                </button>
              </div>
              
              <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                {agentMode ? (
                  <div className="space-y-1">
                    <div className="font-medium text-purple-700">{t('chat.agentFeatures')}</div>
                    <div>{t('chat.agentFeature1')}</div>
                    <div>{t('chat.agentFeature2')}</div>
                    <div>{t('chat.agentFeature3')}</div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="font-medium text-blue-700">{t('chat.kbFeatures')}</div>
                    <div>{t('chat.kbFeature1')}</div>
                    <div>{t('chat.kbFeature2')}</div>
                    <div>{t('chat.kbFeature3')}</div>
                  </div>
                )}
              </div>
            </div>

            {/* AIモデル選択セクション */}
            <div className="p-2 border-b border-gray-200">
              <ModelSelector
                selectedModelId={selectedModelId}
                onModelChange={setSelectedModelId}
                showAdvancedFilters={true}
              />
            </div>

            {/* 権限制御状態セクション */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('sidebar.permissionControl')}</h3>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-green-600">✅</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">{t('sidebar.basicFeaturesAvailable')}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-blue-600">🔐</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">{t('sidebar.advancedControlActive')}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('sidebar.restrictedModelsNote')}
                </div>
              </div>
            </div>

            {/* システム情報セクション */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('sidebar.systemInfo')}</h3>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <div>✅ {t('sidebar.healthy')}</div>
                <div>🌍 {process.env.NEXT_PUBLIC_BEDROCK_REGION || 'ap-northeast-1'}</div>
              </div>
            </div>
          </div>
        </div>
      </ResizableSidebar>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ヘッダー - Header component使用 */}
        <Header 
          locale={locale as Locale}
          showSidebarToggle={true}
          onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
          agentMode={agentMode}
          saveHistory={saveHistory}
        />

        {/* チャットエリア */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* メッセージリスト */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-4">
            {currentSession?.messages?.map((message: Message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-sm md:max-w-md lg:max-w-lg xl:max-w-2xl px-4 py-3 rounded-lg ${message.role === 'user'
                    ? 'bg-blue-600 text-white mr-2'
                    : 'bg-white text-gray-900 shadow-sm border ml-2'
                    }`}
                >
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">
                    <MessageContent 
                      text={message.content} 
                      onRetry={message.role === 'assistant' ? () => {
                        // 最後のユーザーメッセージを再送信
                        const userMessages = currentSession?.messages?.filter((m: Message) => m.role === 'user') || [];
                        const lastUserMessage = userMessages[userMessages.length - 1];
                        if (lastUserMessage) {
                          setInputText(lastUserMessage.content);
                          // フォームを自動送信
                          setTimeout(() => {
                            const form = document.querySelector('form');
                            if (form) {
                              form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                            }
                          }, 100);
                        }
                      } : undefined}
                    />
                  </div>
                  <p className={`text-xs mt-2 ${message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                    {new Date(message.timestamp).toLocaleTimeString('ja-JP')}
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
                      {agentMode ? (
                        <>
                          <div>🤖 Agent処理中...</div>
                          <div className="text-xs text-gray-500 mt-1">
                            アクション実行 → 文書検索 → 回答生成
                          </div>
                        </>
                      ) : (
                        <>
                          <div>🔍 文書を検索中...</div>
                          <div className="text-xs text-gray-500 mt-1">AIで回答を生成中...</div>
                        </>
                      )}
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
                placeholder={t('chatbot.input.placeholder')}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-700 text-sm"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !inputText.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {t('chatbot.input.send')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
