import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  sessionId?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

interface ChatStore {
  // チャット履歴設定
  saveHistory: boolean;
  setSaveHistory: (save: boolean) => void;
  
  // Agentモード設定
  agentMode: boolean;
  setAgentMode: (enabled: boolean) => void;
  
  // 選択されたAgent ID
  selectedAgentId: string | null;
  setSelectedAgentId: (agentId: string | null) => void;
  
  // 現在のセッション
  currentSession: ChatSession | null;
  setCurrentSession: (session: ChatSession | null) => void;
  
  // チャット履歴
  chatSessions: ChatSession[];
  setChatSessions: (sessions: ChatSession[]) => void;
  addChatSession: (session: ChatSession) => void;
  updateChatSession: (sessionId: string, updates: Partial<ChatSession>) => void;
  deleteChatSession: (sessionId: string) => void;
  
  // メッセージ管理
  addMessage: (message: ChatMessage) => void;
  clearCurrentMessages: () => void;
  
  // 履歴の保存/読み込み
  saveChatHistory: () => Promise<void>;
  loadChatHistory: (userId: string) => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  // デフォルト設定: 履歴保存は有効
  saveHistory: true,
  setSaveHistory: (save) => {
    console.log('[ChatStore] 履歴保存設定変更:', save);
    set({ saveHistory: save });
  },
  
  // デフォルト設定: Agentモードは無効
  agentMode: false,
  setAgentMode: (enabled) => {
    console.log('[ChatStore] Agentモード変更:', enabled);
    set({ agentMode: enabled });
  },
  
  // デフォルト設定: Agent未選択
  selectedAgentId: null,
  setSelectedAgentId: (agentId) => {
    console.log('[ChatStore] 選択Agent ID変更:', agentId);
    set({ selectedAgentId: agentId });
  },
  
  currentSession: null,
  setCurrentSession: (session) => {
    // ✅ FIX v7: Ensure messages is always an array to prevent "Cannot read properties of undefined (reading 'length')" error
    if (session && (!session.messages || !Array.isArray(session.messages))) {
      console.warn('⚠️ [ChatStore] Invalid messages array detected, initializing as empty array:', session);
      session = {
        ...session,
        messages: []
      };
    }
    set({ currentSession: session });
  },
  
  chatSessions: [],
  setChatSessions: (sessions) => set({ chatSessions: sessions }),
  
  addChatSession: (session) => set((state) => ({
    chatSessions: [session, ...state.chatSessions]
  })),
  
  updateChatSession: (sessionId, updates) => set((state) => ({
    chatSessions: state.chatSessions.map(session =>
      session.id === sessionId ? { ...session, ...updates } : session
    ),
    currentSession: state.currentSession?.id === sessionId 
      ? { ...state.currentSession, ...updates }
      : state.currentSession
  })),
  
  deleteChatSession: (sessionId) => set((state) => ({
    chatSessions: state.chatSessions.filter(session => session.id !== sessionId),
    currentSession: state.currentSession?.id === sessionId ? null : state.currentSession
  })),
  
  addMessage: (message) => set((state) => {
    if (!state.currentSession) return state;
    
    const updatedSession = {
      ...state.currentSession,
      messages: [...state.currentSession.messages, message],
      updatedAt: new Date()
    };
    
    return {
      currentSession: updatedSession,
      chatSessions: state.chatSessions.map(session =>
        session.id === updatedSession.id ? updatedSession : session
      )
    };
  }),
  
  clearCurrentMessages: () => set((state) => ({
    currentSession: state.currentSession ? {
      ...state.currentSession,
      messages: []
    } : null
  })),
  
  // DynamoDBへの保存（実装時にAPI呼び出しに置き換え）
  saveChatHistory: async () => {
    const { currentSession, saveHistory } = get();
    if (!saveHistory || !currentSession) return;
    
    try {
      // TODO: DynamoDBへの保存API呼び出し
      console.log('Saving chat history to DynamoDB:', currentSession);
      
      // 実際の実装では以下のようなAPI呼び出しになります：
      // await fetch('/api/chat/save', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(currentSession)
      // });
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  },
  
  // DynamoDBからの読み込み（実装時にAPI呼び出しに置き換え）
  loadChatHistory: async (userId: string) => {
    const { saveHistory } = get();
    if (!saveHistory) return;
    
    try {
      // TODO: DynamoDBからの読み込みAPI呼び出し
      console.log('Loading chat history from DynamoDB for user:', userId);
      
      // 実際の実装では以下のようなAPI呼び出しになります：
      // const response = await fetch(`/api/chat/history/${userId}`);
      // const sessions = await response.json();
      // set({ chatSessions: sessions });
      
      // 現在はローカルストレージから読み込み（デモ用）
      const savedSessions = localStorage.getItem(`chatHistory_${userId}`);
      if (savedSessions) {
        const sessions = JSON.parse(savedSessions).map((session: any) => ({
          ...session,
          createdAt: new Date(session.createdAt),
          updatedAt: new Date(session.updatedAt),
          messages: session.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
        set({ chatSessions: sessions });
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }
}));