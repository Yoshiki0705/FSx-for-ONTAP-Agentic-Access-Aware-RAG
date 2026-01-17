'use client';

import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';

import React from 'react';
import { AlertTriangle, RefreshCw, ExternalLink, Copy, CheckCircle } from 'lucide-react';

// エラーコードの型定義を追加
export type ErrorCode = 
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'PERMISSION_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'SERVER_ERROR'
  | 'TIMEOUT_ERROR'
  | 'UNKNOWN_ERROR';

export interface ErrorDetails {
  code?: ErrorCode | string; // 既存のstring型も許可（後方互換性）
  message: string;
  details?: string;
  timestamp?: Date;
  context?: {
    modelId?: string;
    modelName?: string;
    userId?: string;
    apiUrl?: string;
    requestId?: string;
  };
  suggestions?: readonly string[]; // 読み取り専用配列で安全性向上
  retryable?: boolean;
}

interface ErrorMessageProps {
  error: ErrorDetails;
  onRetry?: () => void;
  onDismiss?: () => void;
  onReport?: (error: ErrorDetails) => void; // エラーレポート機能追加
  className?: string;
  compact?: boolean;
  showReportButton?: boolean; // レポートボタンの表示制御
}

export function ErrorMessage({ 
  error, 
  onRetry, 
  onDismiss, 
  onReport,
  className = '', 
  compact = false,
  showReportButton = false
}: ErrorMessageProps) {
  const [copied, setCopied] = React.useState(false);

  // パフォーマンス最適化: useCallbackでメモ化
  const handleCopyError = React.useCallback(async () => {
    const errorText = `
エラーコード: ${error.code || 'UNKNOWN'}
エラーメッセージ: ${error.message}
${error.details ? `詳細: ${error.details}` : ''}
時刻: ${error.timestamp?.toLocaleString('ja-JP') || new Date().toLocaleString('ja-JP')}
${error.context ? `
コンテキスト:
- モデル: ${error.context.modelName || 'Unknown'} (${error.context.modelId || 'Unknown'})
- ユーザー: ${error.context.userId || 'Unknown'}
- API URL: ${error.context.apiUrl || 'Unknown'}
- リクエストID: ${error.context.requestId || 'Unknown'}
` : ''}
    `.trim();

    try {
      await navigator.clipboard.writeText(errorText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('クリップボードへのコピーに失敗しました:', err);
    }
  }, [error]);

  // パフォーマンス最適化: useMemoでメモ化
  const errorIcon = React.useMemo(() => {
    if (error.code?.startsWith('NETWORK')) {
      return <AlertTriangle className="h-5 w-5 text-orange-500" />;
    }
    if (error.code?.startsWith('AUTH')) {
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    }
    if (error.code?.startsWith('RATE_LIMIT')) {
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
    return <AlertTriangle className="h-5 w-5 text-red-500" />;
  }, [error.code]);

  const colors = React.useMemo(() => {
    if (error.code?.startsWith('NETWORK')) {
      return {
        bg: 'bg-orange-50 dark:bg-orange-900/20',
        border: 'border-orange-200 dark:border-orange-800',
        text: 'text-orange-800 dark:text-orange-200'
      };
    }
    if (error.code?.startsWith('AUTH')) {
      return {
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-200 dark:border-red-800',
        text: 'text-red-800 dark:text-red-200'
      };
    }
    if (error.code?.startsWith('RATE_LIMIT')) {
      return {
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        border: 'border-yellow-200 dark:border-yellow-800',
        text: 'text-yellow-800 dark:text-yellow-200'
      };
    }
    return {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-800 dark:text-red-200'
    };
  }, [error.code]);

  if (compact) {
    return (
      <div className={`p-3 rounded-lg border ${colors.bg} ${colors.border} ${className}`}>
        <div className="flex items-center space-x-2">
          {errorIcon}
          <span className={`text-sm font-medium ${colors.text}`}>
            {error.message}
          </span>
          {error.retryable && onRetry && (
            <button
              onClick={onRetry}
              className={`ml-auto p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 ${colors.text}`}
              title="再試行"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-lg border ${colors.bg} ${colors.border} ${className}`}>
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          {errorIcon}
          <div>
            <h3 className={`font-semibold ${colors.text}`}>
              {error.code ? `エラー ${error.code}` : 'エラーが発生しました'}
            </h3>
            <p className={`text-sm ${colors.text} opacity-90`}>
              {error.timestamp?.toLocaleString('ja-JP') || new Date().toLocaleString('ja-JP')}
            </p>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 ${colors.text}`}
            title="閉じる"
          >
            ×
          </button>
        )}
      </div>

      {/* エラーメッセージ */}
      <div className={`mb-3 ${colors.text}`}>
        <p className="font-medium mb-1">{error.message}</p>
        {error.details && (
          <p className="text-sm opacity-90">{error.details}</p>
        )}
      </div>

      {/* コンテキスト情報 */}
      {error.context && (
        <div className={`mb-3 p-3 rounded bg-black/5 dark:bg-white/5 ${colors.text}`}>
          <h4 className="text-sm font-medium mb-2">詳細情報</h4>
          <div className="text-xs space-y-1 opacity-90">
            {error.context.modelName && (
              <div>モデル: {error.context.modelName} ({error.context.modelId})</div>
            )}
            {error.context.userId && (
              <div>ユーザー: {error.context.userId}</div>
            )}
            {error.context.apiUrl && (
              <div>API: {error.context.apiUrl}</div>
            )}
            {error.context.requestId && (
              <div>リクエストID: {error.context.requestId}</div>
            )}
          </div>
        </div>
      )}

      {/* 対処方法 */}
      {error.suggestions && error.suggestions.length > 0 && (
        <div className={`mb-3 ${colors.text}`}>
          <h4 className="text-sm font-medium mb-2">対処方法</h4>
          <ul className="text-sm space-y-1 opacity-90">
            {error.suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start space-x-2">
                <span className="text-xs mt-1">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex items-center space-x-2">
        {error.retryable && onRetry && (
          <button
            onClick={onRetry}
            className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md border ${colors.border} ${colors.text} hover:bg-black/5 dark:hover:bg-white/5 transition-colors`}
            aria-label="エラーを再試行する"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>再試行</span>
          </button>
        )}
        
        <button
          onClick={handleCopyError}
          className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md border ${colors.border} ${colors.text} hover:bg-black/5 dark:hover:bg-white/5 transition-colors`}
          aria-label={copied ? "エラー情報をコピーしました" : "エラー情報をクリップボードにコピーする"}
        >
          {copied ? (
            <>
              <CheckCircle className="h-4 w-4" aria-hidden="true" />
              <span>コピー済み</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" aria-hidden="true" />
              <span>エラー情報をコピー</span>
            </>
          )}
        </button>

        {showReportButton && onReport && (
          <button
            onClick={() => onReport(error)}
            className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md border ${colors.border} ${colors.text} hover:bg-black/5 dark:hover:bg-white/5 transition-colors`}
            aria-label="エラーを報告する"
          >
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span>報告</span>
          </button>
        )}

        <a
          href="https://docs.aws.amazon.com/bedrock/"
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md border ${colors.border} ${colors.text} hover:bg-black/5 dark:hover:bg-white/5 transition-colors`}
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          <span>ヘルプ</span>
        </a>
      </div>
    </div>
  );
}

// エラー詳細を生成するヘルパー関数
export function createErrorDetails(
  error: Error | string,
  context?: ErrorDetails['context'],
  options?: {
    code?: ErrorCode | string;
    retryable?: boolean;
    suggestions?: readonly string[];
  }
): ErrorDetails {
  const message = typeof error === 'string' ? error : error.message;
  const timestamp = new Date();

  // エラーメッセージからエラーコードを推測（型安全性向上）
  let code: ErrorCode | string = options?.code || 'UNKNOWN_ERROR';
  if (!options?.code) {
    if (message.includes('Network') || message.includes('fetch')) {
      code = 'NETWORK_ERROR' as const;
    } else if (message.includes('401') || message.includes('Unauthorized')) {
      code = 'AUTH_ERROR' as const;
    } else if (message.includes('403') || message.includes('Forbidden')) {
      code = 'PERMISSION_ERROR' as const;
    } else if (message.includes('429') || message.includes('Rate limit')) {
      code = 'RATE_LIMIT_ERROR' as const;
    } else if (message.includes('500') || message.includes('Internal Server Error')) {
      code = 'SERVER_ERROR' as const;
    } else if (message.includes('timeout')) {
      code = 'TIMEOUT_ERROR' as const;
    } else {
      code = 'UNKNOWN_ERROR' as const;
    }
  }

  // デフォルトの対処方法を生成
  let suggestions = options?.suggestions;
  if (!suggestions) {
    suggestions = [];
    
    if (code === 'NETWORK_ERROR') {
      suggestions = [
        'インターネット接続を確認してください',
        'しばらく時間をおいてから再試行してください',
        'ブラウザを再読み込みしてください'
      ];
    } else if (code === 'AUTH_ERROR') {
      suggestions = [
        'ログイン状態を確認してください',
        '再度ログインしてください',
        'アカウントの権限を確認してください'
      ];
    } else if (code === 'PERMISSION_ERROR') {
      suggestions = [
        'このモデルへのアクセス権限を確認してください',
        'システム管理者にお問い合わせください',
        '別のモデルを選択してみてください'
      ];
    } else if (code === 'RATE_LIMIT_ERROR') {
      suggestions = [
        'しばらく時間をおいてから再試行してください',
        'リクエストの頻度を下げてください'
      ];
    } else if (code === 'SERVER_ERROR') {
      suggestions = [
        'しばらく時間をおいてから再試行してください',
        'システム管理者にお問い合わせください',
        'エラー情報をコピーして報告してください'
      ];
    } else if (code === 'TIMEOUT_ERROR') {
      suggestions = [
        '再試行してください',
        'より短いメッセージで試してください',
        'インターネット接続を確認してください'
      ];
    } else {
      suggestions = [
        '再試行してください',
        'ブラウザを再読み込みしてください',
        'システム管理者にお問い合わせください'
      ];
    }
  }

  return {
    code,
    message,
    timestamp,
    context,
    suggestions,
    retryable: options?.retryable ?? ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'SERVER_ERROR'].includes(code)
  };
}