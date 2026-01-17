'use client'

import React, { useEffect, useCallback } from 'react'
import { Plus, MessageSquare } from 'lucide-react'

interface NewChatButtonProps {
  onNewChat: () => void
  hasUnsavedMessages?: boolean
  className?: string
  variant?: 'default' | 'compact' | 'icon-only'
}

type ButtonVariant = 'default' | 'compact' | 'icon-only'

export function NewChatButton({ 
  onNewChat, 
  hasUnsavedMessages = false, 
  className = '',
  variant = 'default'
}: NewChatButtonProps) {

  const handleNewChat = useCallback(() => {
    if (hasUnsavedMessages) {
      // 未保存の会話がある場合は確認ダイアログを表示
      const confirmed = window.confirm(
        '現在の会話は保存されていません。新しいチャットを開始しますか？'
      )
      if (!confirmed) return
    }
    
    onNewChat()
  }, [hasUnsavedMessages, onNewChat])

  // キーボードショートカット (Ctrl+N)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault()
        handleNewChat()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleNewChat])

  // バリアント別のスタイル
  const getButtonStyles = () => {
    const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
    
    switch (variant) {
      case 'compact':
        return `${baseStyles} h-8 px-3 text-sm bg-primary text-primary-foreground hover:bg-primary/90`
      case 'icon-only':
        return `${baseStyles} h-9 w-9 bg-primary text-primary-foreground hover:bg-primary/90`
      default:
        return `${baseStyles} h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90`
    }
  }

  const getContent = () => {
    switch (variant) {
      case 'icon-only':
        return <Plus className="h-4 w-4" />
      case 'compact':
        return (
          <>
            <Plus className="h-4 w-4 mr-1" />
            新規
          </>
        )
      default:
        return (
          <>
            <MessageSquare className="h-4 w-4 mr-2" />
            新しいチャット
            <span className="ml-2 text-xs opacity-70">Ctrl+N</span>
          </>
        )
    }
  }

  return (
    <button
      onClick={handleNewChat}
      className={`${getButtonStyles()} ${className}`}
      title="新しいチャットを開始 (Ctrl+N)"
      aria-label="新しいチャットを開始"
    >
      {getContent()}
    </button>
  )
}