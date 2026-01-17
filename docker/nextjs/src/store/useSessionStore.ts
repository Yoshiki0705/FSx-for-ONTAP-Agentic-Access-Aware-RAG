'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatSession, SessionMetadata } from '@/types/chat';

/**
 * セッション管理ストア
 * チャットセッションの作成、読み込み、保存、削除を管理
 */
interface SessionState {
  // State
  sessions: SessionMetadata[];
  activeSessionId: string | null;
  
  // Actions
  createSession: (session: Omit<ChatSession, 'id' | 'createdAt' | 'updatedAt'>) => string;
  loadSession: (sessionId: string) => ChatSession | null;
  saveSession: (session: ChatSession) => void;
  deleteSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string | null) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;
  getSessionMetadata: (sessionId: string) => SessionMetadata | null;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      
      /**
       * 新しいセッションを作成
       */
      createSession: (sessionData) => {
        console.log('[useSessionStore] Creating new session', sessionData);
        
        const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = Date.now();
        
        const session: ChatSession = {
          ...sessionData,
          id,
          createdAt: now,
          updatedAt: now
        };
        
        // セッションを個別に保存
        if (typeof window !== 'undefined') {
          localStorage.setItem(`chat-session-${id}`, JSON.stringify(session));
          console.log('[useSessionStore] Saved session to localStorage:', id);
        }
        
        // メタデータを作成
        const metadata: SessionMetadata = {
          id,
          title: session.title,
          messageCount: session.messages.length,
          lastMessage: session.messages[session.messages.length - 1]?.content || '',
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          mode: session.mode
        };
        
        set(state => ({
          sessions: [...state.sessions, metadata],
          activeSessionId: id
        }));
        
        console.log('[useSessionStore] Session created successfully:', id);
        return id;
      },
      
      /**
       * セッションを読み込み
       */
      loadSession: (sessionId) => {
        console.log('[useSessionStore] Loading session:', sessionId);
        
        if (typeof window === 'undefined') {
          console.log('[useSessionStore] Cannot load session: window is undefined');
          return null;
        }
        
        const stored = localStorage.getItem(`chat-session-${sessionId}`);
        if (!stored) {
          console.log('[useSessionStore] Session not found:', sessionId);
          return null;
        }
        
        try {
          const session = JSON.parse(stored);
          console.log('[useSessionStore] Session loaded successfully:', sessionId);
          return session;
        } catch (error) {
          console.error('[useSessionStore] Failed to parse session:', error);
          return null;
        }
      },
      
      /**
       * セッションを保存
       */
      saveSession: (session) => {
        console.log('[useSessionStore] Saving session:', session.id);
        
        const now = Date.now();
        const updatedSession = {
          ...session,
          updatedAt: now
        };
        
        // セッションを個別に保存
        if (typeof window !== 'undefined') {
          localStorage.setItem(`chat-session-${session.id}`, JSON.stringify(updatedSession));
          console.log('[useSessionStore] Session saved to localStorage:', session.id);
        }
        
        // メタデータを更新
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === session.id
              ? {
                  ...s,
                  title: session.title,
                  messageCount: session.messages.length,
                  lastMessage: session.messages[session.messages.length - 1]?.content || '',
                  updatedAt: now
                }
              : s
          )
        }));
        
        console.log('[useSessionStore] Session metadata updated:', session.id);
      },
      
      /**
       * セッションを削除
       */
      deleteSession: (sessionId) => {
        console.log('[useSessionStore] Deleting session:', sessionId);
        
        // 個別セッションを削除
        if (typeof window !== 'undefined') {
          localStorage.removeItem(`chat-session-${sessionId}`);
          console.log('[useSessionStore] Session removed from localStorage:', sessionId);
        }
        
        // メタデータから削除
        set(state => ({
          sessions: state.sessions.filter(s => s.id !== sessionId),
          activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId
        }));
        
        console.log('[useSessionStore] Session deleted successfully:', sessionId);
      },
      
      /**
       * アクティブセッションを設定
       * @param sessionId - セッションID（nullの場合はクリア）
       */
      setActiveSession: (sessionId) => {
        console.log('[useSessionStore] Setting active session:', sessionId);
        set({ activeSessionId: sessionId });
      },
      
      /**
       * セッションタイトルを更新
       */
      updateSessionTitle: (sessionId, title) => {
        console.log('[useSessionStore] Updating session title:', sessionId, title);
        
        const session = get().loadSession(sessionId);
        if (!session) {
          console.log('[useSessionStore] Cannot update title: session not found');
          return;
        }
        
        const updatedSession = { ...session, title };
        get().saveSession(updatedSession);
      },
      
      /**
       * セッションメタデータを取得
       */
      getSessionMetadata: (sessionId) => {
        return get().sessions.find(s => s.id === sessionId) || null;
      }
    }),
    {
      name: 'chat-sessions',
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId
      })
    }
  )
);
