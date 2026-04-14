'use client';

import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';
import { Message } from '@/types/chat';
import { MessageActions } from './MessageActions';
import { CodeBlock, InlineCode } from './CodeBlock';
import { GuardrailsStatusBadge } from '@/components/guardrails/GuardrailsStatusBadge';
import { EpisodeReferenceBadge } from './EpisodeReferenceBadge';

interface MessageListProps {
  messages: Message[];
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  onCopy?: (content: string) => void;
}

/**
 * メッセージリストコンポーネント
 * チャット履歴を表示し、メッセージアクションを提供
 */
export function MessageList({ messages, onEdit, onDelete, onCopy }: MessageListProps) {
  const locale = useLocale();
  const t = useCustomTranslations(locale);

  /**
   * メッセージ内容をパースしてコードブロックを検出
   */
  const parseMessageContent = (content: string) => {
    const parts: Array<{ type: 'text' | 'code' | 'inline-code'; content: string; language?: string }> = [];
    
    // コードブロックのパターン: ```language\ncode\n```
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    // インラインコードのパターン: `code`
    const inlineCodeRegex = /`([^`]+)`/g;
    
    let lastIndex = 0;
    let match;
    
    // コードブロックを検出
    while ((match = codeBlockRegex.exec(content)) !== null) {
      // コードブロック前のテキスト
      if (match.index > lastIndex) {
        const textBefore = content.substring(lastIndex, match.index);
        parts.push({ type: 'text', content: textBefore });
      }
      
      // コードブロック
      parts.push({
        type: 'code',
        content: match[2].trim(),
        language: match[1] || 'text'
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // 残りのテキスト
    if (lastIndex < content.length) {
      parts.push({ type: 'text', content: content.substring(lastIndex) });
    }
    
    // テキスト部分のインラインコードを処理
    const processedParts: typeof parts = [];
    parts.forEach(part => {
      if (part.type === 'text') {
        const textParts: typeof parts = [];
        let textLastIndex = 0;
        let inlineMatch;
        
        while ((inlineMatch = inlineCodeRegex.exec(part.content)) !== null) {
          if (inlineMatch.index > textLastIndex) {
            textParts.push({
              type: 'text',
              content: part.content.substring(textLastIndex, inlineMatch.index)
            });
          }
          
          textParts.push({
            type: 'inline-code',
            content: inlineMatch[1]
          });
          
          textLastIndex = inlineMatch.index + inlineMatch[0].length;
        }
        
        if (textLastIndex < part.content.length) {
          textParts.push({
            type: 'text',
            content: part.content.substring(textLastIndex)
          });
        }
        
        processedParts.push(...textParts);
      } else {
        processedParts.push(part);
      }
    });
    
    return processedParts;
  };

  /**
   * メッセージ内容をレンダリング
   */
  const renderMessageContent = (content: string) => {
    const parts = parseMessageContent(content);
    
    return parts.map((part, index) => {
      switch (part.type) {
        case 'code':
          return <CodeBlock key={index} code={part.content} language={part.language} />;
        case 'inline-code':
          return <InlineCode key={index}>{part.content}</InlineCode>;
        case 'text':
          return (
            <span key={index} className="whitespace-pre-wrap">
              {part.content}
            </span>
          );
        default:
          return null;
      }
    });
  };

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`group relative max-w-[80%] rounded-lg px-4 py-3 ${
              message.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            }`}
          >
            {/* メッセージ内容 */}
            <div className="text-sm">
              {renderMessageContent(message.content)}
            </div>

            {/* タイムスタンプ */}
            {message.timestamp && (
              <div
                className={`mt-1 text-xs ${
                  message.role === 'user'
                    ? 'text-blue-200'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {new Date(message.timestamp).toLocaleTimeString('ja-JP', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            )}

            {/* メッセージアクション */}
            <div className="flex items-center gap-2 mt-1">
              {/* Guardrails Status Badge (assistant messages only) */}
              {message.role === 'assistant' && (message as any).guardrailResult && (
                <GuardrailsStatusBadge
                  guardrailResult={(message as any).guardrailResult}
                  enableGuardrails={true}
                />
              )}
              {/* Episode Reference Badge (assistant messages only) */}
              {message.role === 'assistant' && (message as any).episodeReferenced && (
                <EpisodeReferenceBadge
                  episodeCount={(message as any).episodeCount || 0}
                />
              )}
            </div>
            <MessageActions
              messageId={message.id}
              content={message.content}
              onEdit={onEdit}
              onDelete={onDelete}
              onCopy={onCopy}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
