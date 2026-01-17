'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Loader2, CheckCircle, AlertCircle, Settings } from 'lucide-react'

interface StreamingResponseProps {
  content: string
  isStreaming: boolean
  isComplete: boolean
  hasError?: boolean
  errorMessage?: string
  toolCalls?: ToolCall[]
  onComplete?: () => void
  className?: string // カスタムスタイリング対応
  maxDisplayLength?: number // 表示制限対応
}

interface ToolCall {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  description?: string
  result?: string
}

export default function StreamingResponse({
  content,
  isStreaming,
  isComplete,
  hasError = false,
  errorMessage,
  toolCalls = [],
  onComplete,
  className = '',
  maxDisplayLength = 10000 // デフォルト制限
}: StreamingResponseProps) {
  const [displayedContent, setDisplayedContent] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<NodeJS.Timeout | null>(null)

  // ストリーミング表示のアニメーション（パフォーマンス最適化版）
  useEffect(() => {
    // 前のアニメーションをクリーンアップ
    if (animationRef.current) {
      clearTimeout(animationRef.current)
    }

    if (isStreaming && content.length > displayedContent.length) {
      // 長いコンテンツの場合は表示制限を適用
      const targetLength = Math.min(content.length, maxDisplayLength)
      
      if (currentIndex < targetLength) {
        // バッチ処理で複数文字を一度に表示（パフォーマンス向上）
        const batchSize = Math.max(1, Math.floor(targetLength / 100))
        const nextIndex = Math.min(currentIndex + batchSize, targetLength)
        
        animationRef.current = setTimeout(() => {
          setDisplayedContent(content.slice(0, nextIndex))
          setCurrentIndex(nextIndex)
        }, 30) // 30ms間隔に調整
      }
    } else if (!isStreaming) {
      // ストリーミング終了時は全コンテンツを表示
      const finalContent = content.slice(0, maxDisplayLength)
      setDisplayedContent(finalContent)
      setCurrentIndex(finalContent.length)
    }

    // クリーンアップ関数
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current)
      }
    }
  }, [content, currentIndex, isStreaming, displayedContent.length, maxDisplayLength])

  // 完了時のコールバック
  useEffect(() => {
    if (isComplete && onComplete) {
      onComplete()
    }
  }, [isComplete, onComplete])

  // 自動スクロール（エラーハンドリング付き）
  useEffect(() => {
    try {
      if (contentRef.current) {
        contentRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'end',
          inline: 'nearest'
        })
      }
    } catch (error) {
      // スクロールエラーを無視（古いブラウザ対応）
      console.warn('Scroll animation not supported:', error)
    }
  }, [displayedContent])

  return (
    <div className={`space-y-3 ${className}`}>
      {/* ツール呼び出しの表示 */}
      {toolCalls.length > 0 && (
        <div className="space-y-2" role="status" aria-label="ツール実行状況">
          <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
            <Settings className="w-3 h-3" />
            ツールを実行中...
          </div>
          {toolCalls.map((tool) => (
            <div
              key={tool.id}
              className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm"
              role="status"
              aria-label={`${tool.name} ${tool.status}`}
            >
              {tool.status === 'pending' && (
                <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
              )}
              {tool.status === 'running' && (
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              )}
              {tool.status === 'completed' && (
                <CheckCircle className="w-4 h-4 text-green-600" />
              )}
              {tool.status === 'error' && (
                <AlertCircle className="w-4 h-4 text-red-600" />
              )}
              <span className="text-gray-700 dark:text-gray-300">
                {tool.name}
                {tool.description && (
                  <span className="text-gray-500 ml-1">- {tool.description}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* メインコンテンツ */}
      <div
        ref={contentRef}
        className="prose prose-sm max-w-none dark:prose-invert"
        role="main"
        aria-live="polite"
        aria-label="AI応答コンテンツ"
      >
        {hasError ? (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <div className="font-medium text-red-800 dark:text-red-200">
                エラーが発生しました
              </div>
              {errorMessage && (
                <div className="text-sm text-red-600 dark:text-red-300 mt-1">
                  {errorMessage}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="whitespace-pre-wrap break-words">
              {displayedContent}
              {isStreaming && (
                <span className="inline-block w-2 h-5 bg-blue-600 animate-pulse ml-1" />
              )}
            </div>
            
            {/* ステータスインジケーター */}
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
              {isStreaming && (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>応答を生成中...</span>
                </>
              )}
              {isComplete && !isStreaming && (
                <>
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span>完了</span>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}