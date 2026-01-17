'use client';

import React from 'react';

interface MessageContentProps {
  content: string;
}

export function MessageContent({ content }: MessageContentProps) {
  console.log('🔍 [MessageContent] Rendering...', {
    hasContent: !!content,
    contentType: typeof content,
    contentLength: content?.length,
    contentPreview: content?.substring(0, 50)
  });

  // ✅ Null/undefined check to prevent "Cannot read properties of undefined (reading 'length')" error
  if (!content || typeof content !== 'string') {
    console.warn('⚠️ [MessageContent] Invalid content:', content);
    return <div className="text-gray-500 dark:text-gray-400">No content available</div>;
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
            return <strong key={index} className="font-semibold text-gray-900 dark:text-gray-100">{innerContent}</strong>;
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
      return <div className="text-gray-500 dark:text-gray-400">Content format error</div>;
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
                  <span className="text-blue-600 dark:text-blue-400 font-bold mt-0.5">•</span>
                  <span className="flex-1">{formatText(trimmedLine.slice(2))}</span>
                </div>
              );
            }

            // セクションヘッダー（**で囲まれた行）の処理
            if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**') && trimmedLine.length > 4) {
              const headerContent = trimmedLine.slice(2, -2);
              return (
                <div key={lineIndex} className="font-semibold text-gray-900 dark:text-gray-100 mt-3 mb-1">
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
