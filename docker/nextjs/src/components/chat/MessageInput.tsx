'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  showCharCount?: boolean;
}

/**
 * 拡張メッセージ入力コンポーネント
 * 複数行入力、自動高さ調整、文字数カウンター
 */
export function MessageInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = 'メッセージを入力してください...',
  maxLength = 4000,
  showCharCount = true,
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [rows, setRows] = useState(1);

  // 自動高さ調整
  useEffect(() => {
    if (textareaRef.current) {
      // リセット
      textareaRef.current.style.height = 'auto';
      
      // 新しい高さを計算
      const scrollHeight = textareaRef.current.scrollHeight;
      const lineHeight = 24; // 1.5rem
      const maxRows = 10;
      const minRows = 1;
      
      const calculatedRows = Math.min(
        Math.max(Math.ceil(scrollHeight / lineHeight), minRows),
        maxRows
      );
      
      setRows(calculatedRows);
      textareaRef.current.style.height = `${calculatedRows * lineHeight}px`;
    }
  }, [value]);

  // キーボードイベントハンドラー
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift+Enter: 改行
    if (e.key === 'Enter' && e.shiftKey) {
      return; // デフォルトの改行動作を許可
    }

    // Enter: 送信
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit();
      }
    }
  };

  // 文字数の計算
  const charCount = value.length;
  const isNearLimit = charCount > maxLength * 0.9;
  const isOverLimit = charCount > maxLength;

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        rows={rows}
        className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-sm resize-none"
        aria-label="メッセージ入力"
        aria-describedby="message-input-help"
      />

      {/* ヘルプテキスト */}
      <div id="message-input-help" className="sr-only">
        メッセージを入力してください。Enterキーで送信、Shift+Enterで改行できます。
      </div>

      {/* 文字数カウンター */}
      {showCharCount && (
        <div
          className={`absolute bottom-2 right-2 text-xs ${
            isOverLimit
              ? 'text-red-600 dark:text-red-400 font-semibold'
              : isNearLimit
              ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-gray-400 dark:text-gray-500'
          }`}
          aria-live="polite"
          aria-atomic="true"
        >
          {charCount} / {maxLength}
        </div>
      )}

      {/* 送信ヒント */}
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 font-mono">
          Enter
        </kbd>
        <span className="mx-1">で送信、</span>
        <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 font-mono">
          Shift + Enter
        </kbd>
        <span className="mx-1">で改行</span>
      </div>
    </div>
  );
}
