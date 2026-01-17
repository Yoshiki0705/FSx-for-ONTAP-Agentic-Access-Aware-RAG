'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { ChatSession, Message } from '@/types/chat';

/**
 * 保存ステータスの型定義
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * チャット履歴管理フック（DynamoDB対応版）
 * 
 * DynamoDB APIを使用してチャット履歴を永続化
 * セッション管理、メッセージ追加、履歴削除などの機能を提供
 */
export function useChatHistory() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const { isAuthenticated, session } = useAuthStore();

  // DynamoDBから履歴を読み込み
  useEffect(() => {
    const loadHistory = async () => {
      if (!isAuthenticated) {
        console.log('[useChatHistory] 未認証のため履歴読み込みスキップ');
        setIsLoaded(true);
        return;
      }

      try {
        console.log('[useChatHistory] DynamoDBから履歴読み込み開始');
        
        const response = await fetch('/api/chat/history', {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
          const loadedSessions = data.sessions.map((s: any) => ({
            id: s.sessionId,
            title: s.title,
            messages: s.messages.map((m: any) => ({
              ...m,
              timestamp: typeof m.timestamp === 'string' ? new Date(m.timestamp).getTime() : m.timestamp
            })),
            createdAt: typeof s.createdAt === 'string' ? new Date(s.createdAt).getTime() : s.createdAt,
            updatedAt: typeof s.updatedAt === 'string' ? new Date(s.updatedAt).getTime() : s.updatedAt,
            mode: s.mode,
            model: s.model || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            region: s.region || 'ap-northeast-1'
          }));
          
          setSessions(loadedSessions);
          console.log('[useChatHistory] 履歴読み込み成功:', loadedSessions.length);
        }
      } catch (error) {
        console.error('[useChatHistory] 履歴読み込みエラー:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadHistory();
  }, [isAuthenticated]);

  // 履歴を保存（DynamoDB）
  const saveHistory = useCallback(async (session: ChatSession) => {
    if (!isAuthenticated) {
      console.warn('[useChatHistory] 未認証のため保存スキップ');
      return;
    }

    try {
      setSaveStatus('saving');
      
      const response = await fetch('/api/chat/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: session.id,
          title: session.title,
          messages: session.messages,
          mode: session.mode,
          model: session.model,
          region: session.region,
          agentId: session.agentId,
          createdAt: new Date(session.createdAt).toISOString(),
          updatedAt: new Date(session.updatedAt).toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setSaveStatus('saved');
        console.log('[useChatHistory] 保存成功:', session.id);
        
        // 保存成功後、ステータスをリセット
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('[useChatHistory] 保存エラー:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [isAuthenticated]);

  // 新しいセッションを作成
  const createSession = useCallback((mode: 'kb' | 'agent' = 'agent') => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: '新しいチャット',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mode,
      model: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      region: 'ap-northeast-1'
    };
    
    const newSessions = [newSession, ...sessions];
    setSessions(newSessions);
    setCurrentSessionId(newSession.id);
    
    // DynamoDBに保存
    saveHistory(newSession);
    
    console.log('[useChatHistory] 新規セッション作成:', newSession.id);
    return newSession.id;
  }, [sessions, saveHistory]);

  // メッセージを追加
  const addMessage = useCallback((sessionId: string, message: Message) => {
    const newSessions = sessions.map(session => {
      if (session.id === sessionId) {
        const updatedMessages = [...session.messages, message];
        const updatedSession = {
          ...session,
          messages: updatedMessages,
          updatedAt: Date.now(),  // numberに変更
          title: session.messages.length === 0 && message.role === 'user'
            ? message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '')
            : session.title
        };
        
        // DynamoDBに保存
        saveHistory(updatedSession);
        
        return updatedSession;
      }
      return session;
    });
    
    setSessions(newSessions);
    console.log('[useChatHistory] メッセージ追加:', sessionId);
  }, [sessions, saveHistory]);

  // セッションを削除
  const deleteSession = useCallback(async (sessionId: string) => {
    if (!isAuthenticated) {
      console.warn('[useChatHistory] 未認証のため削除スキップ');
      return;
    }

    try {
      const response = await fetch(`/api/chat/history?sessionId=${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const newSessions = sessions.filter(s => s.id !== sessionId);
        setSessions(newSessions);
        
        if (currentSessionId === sessionId) {
          setCurrentSessionId('');
        }
        
        console.log('[useChatHistory] セッション削除成功:', sessionId);
      }
    } catch (error) {
      console.error('[useChatHistory] 削除エラー:', error);
    }
  }, [sessions, currentSessionId, isAuthenticated]);

  // 全履歴を削除
  const clearAllHistory = useCallback(async () => {
    if (!isAuthenticated) {
      console.warn('[useChatHistory] 未認証のためクリアスキップ');
      return;
    }

    try {
      // 全セッションを削除
      await Promise.all(sessions.map(s => deleteSession(s.id)));
      
      setSessions([]);
      setCurrentSessionId('');
      console.log('[useChatHistory] 全履歴クリア成功');
    } catch (error) {
      console.error('[useChatHistory] 全履歴クリアエラー:', error);
    }
  }, [sessions, deleteSession, isAuthenticated]);

  // セッションを取得
  const getSession = useCallback((sessionId: string) => {
    return sessions.find(s => s.id === sessionId);
  }, [sessions]);

  // セッションを切り替え
  const switchSession = useCallback((sessionId: string) => {
    const session = getSession(sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      console.log('[useChatHistory] セッション切り替え:', sessionId);
      return session;
    }
    return null;
  }, [getSession]);

  return {
    sessions,
    currentSessionId,
    isLoaded,
    saveStatus,
    setCurrentSessionId,
    createSession,
    addMessage,
    deleteSession,
    clearAllHistory,
    getSession,
    switchSession
  };
}
