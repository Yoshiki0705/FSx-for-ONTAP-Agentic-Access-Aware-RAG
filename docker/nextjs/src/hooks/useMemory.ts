/**
 * useMemory フック
 * 
 * @description
 * Memory Provider抽象化レイヤーを使用するReact Hook
 * モードに応じてDynamoDBまたはAgentCore Memoryを自動選択
 * 
 * @usage
 * ```typescript
 * const { createSession, addMessage, getMessages } = useMemory('agent');
 * 
 * const sessionId = await createSession('agent', 'user123');
 * await addMessage(sessionId, { ... });
 * const messages = await getMessages(sessionId);
 * ```
 */

import { useMemo, useCallback } from 'react';
import {
  MemoryProvider,
  DynamoDBMemoryProvider,
  AgentCoreMemoryProvider,
  ChatSession,
  Message
} from '../providers/MemoryProvider';

export interface UseMemoryOptions {
  mode: 'kb' | 'agent';
  useAgentCoreForKB?: boolean; // KBモードでもAgentCore Memoryを使用するか
}

export function useMemory(options: UseMemoryOptions | 'kb' | 'agent') {
  // オプションの正規化
  const normalizedOptions: UseMemoryOptions = typeof options === 'string'
    ? { mode: options, useAgentCoreForKB: false }
    : options;

  const { mode, useAgentCoreForKB } = normalizedOptions;

  // Provider選択
  const provider = useMemo<MemoryProvider>(() => {
    // Agentモードは常にAgentCore Memoryを使用
    if (mode === 'agent') {
      console.log('[useMemory] AgentCore Memory Providerを使用（Agentモード）');
      return new AgentCoreMemoryProvider();
    }

    // KBモードは設定に応じて選択
    if (useAgentCoreForKB) {
      console.log('[useMemory] AgentCore Memory Providerを使用（KBモード）');
      return new AgentCoreMemoryProvider();
    }

    console.log('[useMemory] DynamoDB Providerを使用（KBモード）');
    return new DynamoDBMemoryProvider();
  }, [mode, useAgentCoreForKB]);

  // セッション作成
  const createSession = useCallback(
    async (sessionMode: 'kb' | 'agent', userId: string): Promise<string> => {
      console.log('[useMemory] セッション作成:', { sessionMode, userId });
      return provider.createSession(sessionMode, userId);
    },
    [provider]
  );

  // セッション取得
  const getSession = useCallback(
    async (sessionId: string): Promise<ChatSession | null> => {
      console.log('[useMemory] セッション取得:', sessionId);
      return provider.getSession(sessionId);
    },
    [provider]
  );

  // セッション一覧取得
  const listSessions = useCallback(
    async (userId: string): Promise<ChatSession[]> => {
      console.log('[useMemory] セッション一覧取得:', userId);
      return provider.listSessions(userId);
    },
    [provider]
  );

  // セッション削除
  const deleteSession = useCallback(
    async (sessionId: string): Promise<void> => {
      console.log('[useMemory] セッション削除:', sessionId);
      return provider.deleteSession(sessionId);
    },
    [provider]
  );

  // メッセージ追加
  const addMessage = useCallback(
    async (sessionId: string, message: Message): Promise<void> => {
      console.log('[useMemory] メッセージ追加:', { sessionId, messageId: message.id });
      return provider.addMessage(sessionId, message);
    },
    [provider]
  );

  // メッセージ取得
  const getMessages = useCallback(
    async (sessionId: string, limit?: number): Promise<Message[]> => {
      console.log('[useMemory] メッセージ取得:', { sessionId, limit });
      return provider.getMessages(sessionId, limit);
    },
    [provider]
  );

  // メッセージ検索
  const searchMessages = useCallback(
    async (query: string, userId: string): Promise<Message[]> => {
      console.log('[useMemory] メッセージ検索:', { query, userId });
      return provider.searchMessages(query, userId);
    },
    [provider]
  );

  return {
    // Provider情報
    providerType: provider instanceof AgentCoreMemoryProvider ? 'agentcore' : 'dynamodb',
    
    // セッション管理
    createSession,
    getSession,
    listSessions,
    deleteSession,
    
    // メッセージ管理
    addMessage,
    getMessages,
    
    // 検索
    searchMessages
  };
}
