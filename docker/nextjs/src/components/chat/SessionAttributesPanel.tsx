'use client';

import { useState } from 'react';


interface SessionAttributesPanelProps {
  attributes: Record<string, string>;
  onUpdate: (attributes: Record<string, string>) => void;
}

/**
 * Bedrock Agent のセッション属性を表示・編集するコンポーネント
 * 
 * AWSドキュメントに基づいた実装:
 * - sessionAttributes: セッション全体で永続化される属性
 * - promptSessionAttributes: プロンプト単位で永続化される属性
 * 
 * 使用例:
 * - ユーザーの好みを保存
 * - 会話のコンテキストを維持
 * - カスタムメタデータの管理
 */
export function SessionAttributesPanel({ attributes, onUpdate }: SessionAttributesPanelProps) {
  
  const [isEditing, setIsEditing] = useState(false);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleAdd = () => {
    if (newKey.trim() && newValue.trim()) {
      onUpdate({
        ...attributes,
        [newKey.trim()]: newValue.trim()
      });
      setNewKey('');
      setNewValue('');
    }
  };

  const handleUpdate = (key: string) => {
    if (editValue.trim()) {
      const updated = { ...attributes };
      delete updated[key];
      updated[editKey.trim()] = editValue.trim();
      onUpdate(updated);
      setIsEditing(false);
      setEditKey('');
      setEditValue('');
    }
  };

  const handleDelete = (key: string) => {
    const updated = { ...attributes };
    delete updated[key];
    onUpdate(updated);
  };

  const startEdit = (key: string, value: string) => {
    setIsEditing(true);
    setEditKey(key);
    setEditValue(value);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditKey('');
    setEditValue('');
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          💾 セッション属性 ({Object.keys(attributes).length})
        </h3>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Bedrock Agentに渡されるセッション属性
        </div>
      </div>

      {/* 既存の属性リスト */}
      {Object.keys(attributes).length > 0 ? (
        <div className="space-y-2">
          {Object.entries(attributes).map(([key, value]) => (
            <div
              key={key}
              className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-3"
            >
              {isEditing && editKey === key ? (
                // 編集モード
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editKey}
                    onChange={(e) => setEditKey(e.target.value)}
                    className="w-full px-2 py-1 text-xs border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="キー"
                  />
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full px-2 py-1 text-xs border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="値"
                    rows={2}
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleUpdate(key)}
                      className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      保存
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                // 表示モード
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-purple-700 dark:text-purple-400 mb-1">
                      🔑 {key}
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 break-words">
                      {value}
                    </div>
                  </div>
                  <div className="flex space-x-1 ml-2">
                    <button
                      onClick={() => startEdit(key, value)}
                      className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                      title="編集"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(key)}
                      className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      title="削除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
          セッション属性はありません
        </div>
      )}

      {/* 新しい属性を追加 */}
      <div className="border-t dark:border-gray-700 pt-3">
        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          ➕ 新しい属性を追加
        </div>
        <div className="space-y-2">
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="w-full px-3 py-2 text-xs border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="キー（例: userPreference）"
          />
          <textarea
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="w-full px-3 py-2 text-xs border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="値（例: detailed）"
            rows={2}
          />
          <button
            onClick={handleAdd}
            disabled={!newKey.trim() || !newValue.trim()}
            className="w-full px-4 py-2 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            属性を追加
          </button>
        </div>
      </div>

      {/* 使用例のヒント */}
      <details className="text-xs">
        <summary className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
          💡 使用例
        </summary>
        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded space-y-2">
          <div>
            <span className="font-medium">userPreference:</span> "detailed" - 詳細な回答を要求
          </div>
          <div>
            <span className="font-medium">language:</span> "ja-JP" - 言語設定
          </div>
          <div>
            <span className="font-medium">conversationContext:</span> "technical_support" - 会話のコンテキスト
          </div>
          <div>
            <span className="font-medium">userId:</span> "user123" - ユーザーID
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            これらの属性はBedrock Agentの動作をカスタマイズするために使用されます
          </div>
        </div>
      </details>
    </div>
  );
}