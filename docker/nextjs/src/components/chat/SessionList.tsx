'use client';

import React, { useState } from 'react';
import { useSessionStore } from '@/store/useSessionStore';
import { SessionMetadata } from '@/types/chat';

/**
 * セッション一覧コンポーネント
 * セッションの表示、切り替え、削除、検索機能を提供
 */
export function SessionList() {
  const { sessions, activeSessionId, setActiveSession, deleteSession } = useSessionStore();
  const [searchQuery, setSearchQuery] = useState('');

  // 検索フィルタリング
  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 日付でグループ化
  const groupedSessions = {
    today: [] as SessionMetadata[],
    yesterday: [] as SessionMetadata[],
    thisWeek: [] as SessionMetadata[],
    older: [] as SessionMetadata[]
  };

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const oneWeekMs = 7 * oneDayMs;

  filteredSessions.forEach(session => {
    const age = now - session.updatedAt;
    if (age < oneDayMs) {
      groupedSessions.today.push(session);
    } else if (age < 2 * oneDayMs) {
      groupedSessions.yesterday.push(session);
    } else if (age < oneWeekMs) {
      groupedSessions.thisWeek.push(session);
    } else {
      groupedSessions.older.push(session);
    }
  });

  const groupLabels = {
    today: '今日',
    yesterday: '昨日',
    thisWeek: '今週',
    older: '過去'
  };

  return (
    <div style={{ padding: '16px' }}>
      {/* 検索バー */}
      <input
        type="text"
        placeholder="セッションを検索..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid #ddd',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '14px'
        }}
      />

      {/* セッション一覧 */}
      {Object.entries(groupedSessions).map(([group, groupSessions]) => {
        if (groupSessions.length === 0) return null;

        return (
          <div key={group} style={{ marginBottom: '24px' }}>
            <h3 style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              color: '#666',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {groupLabels[group as keyof typeof groupLabels]}
            </h3>
            {groupSessions.map(session => (
              <div
                key={session.id}
                onClick={() => setActiveSession(session.id)}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  borderRadius: '8px',
                  backgroundColor: session.id === activeSessionId ? '#e3f2fd' : 'white',
                  border: session.id === activeSessionId ? '2px solid #2196f3' : '1px solid #e0e0e0',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (session.id !== activeSessionId) {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }
                }}
                onMouseLeave={(e) => {
                  if (session.id !== activeSessionId) {
                    e.currentTarget.style.backgroundColor = 'white';
                  }
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'flex-start'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: '600',
                      marginBottom: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {session.title}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#666',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginBottom: '4px'
                    }}>
                      {session.lastMessage}
                    </div>
                    <div style={{ 
                      fontSize: '11px', 
                      color: '#999',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>{session.messageCount}件のメッセージ</span>
                      <span>•</span>
                      <span>{new Date(session.updatedAt).toLocaleDateString('ja-JP', {
                        month: 'short',
                        day: 'numeric'
                      })}</span>
                      <span>•</span>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: session.mode === 'agent' ? '#e8f5e9' : '#fff3e0',
                        color: session.mode === 'agent' ? '#2e7d32' : '#e65100',
                        fontSize: '10px',
                        fontWeight: '600'
                      }}>
                        {session.mode === 'agent' ? 'Agent' : 'KB'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('このセッションを削除しますか？')) {
                        deleteSession(session.id);
                      }
                    }}
                    style={{
                      padding: '4px 8px',
                      border: 'none',
                      background: 'transparent',
                      color: '#f44336',
                      cursor: 'pointer',
                      fontSize: '18px',
                      marginLeft: '8px',
                      flexShrink: 0
                    }}
                    title="セッションを削除"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {/* セッションが見つからない場合 */}
      {filteredSessions.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '32px 16px',
          color: '#999',
          fontSize: '14px'
        }}>
          {searchQuery ? 'セッションが見つかりませんでした' : 'セッションがありません'}
        </div>
      )}
    </div>
  );
}
