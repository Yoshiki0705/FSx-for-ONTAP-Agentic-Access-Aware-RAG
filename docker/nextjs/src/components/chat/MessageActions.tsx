'use client';

import { useState } from 'react';

interface MessageActionsProps {
  messageId: string;
  content: string;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  onCopy?: (content: string) => void;
}

/**
 * メッセージアクションコンポーネント
 * 編集、削除、コピーなどのアクションを提供
 */
export function MessageActions({
  messageId,
  content,
  onEdit,
  onDelete,
  onCopy,
}: MessageActionsProps) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleDelete = () => {
    if (onDelete) {
      onDelete(messageId);
      setShowConfirmDelete(false);
    }
  };

  const handleCopy = () => {
    if (onCopy) {
      onCopy(content);
    }
  };

  return (
    <div className="absolute top-2 right-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {/* コピーボタン */}
      {onCopy && (
        <button
          onClick={handleCopy}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="メッセージをコピー"
          title="コピー"
        >
          <svg
            className="w-4 h-4 text-gray-500 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </button>
      )}

      {/* 削除ボタン */}
      {onDelete && (
        <>
          {!showConfirmDelete ? (
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
              aria-label="メッセージを削除"
              title="削除"
            >
              <svg
                className="w-4 h-4 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          ) : (
            <div className="flex items-center space-x-1 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1">
              <span className="text-xs text-red-600 dark:text-red-400 whitespace-nowrap">
                削除しますか？
              </span>
              <button
                onClick={handleDelete}
                className="px-2 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                はい
              </button>
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                いいえ
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
