/**
 * Memory Provider抽象化レイヤー
 * 
 * @description
 * DynamoDBとAgentCore Memoryの両方をサポートする抽象化レイヤー
 * 
 * @usage
 * ```typescript
 * const provider = mode === 'agent' 
 *   ? new AgentCoreMemoryProvider() 
 *   : new DynamoDBMemoryProvider();
 * 
 * await provider.createSession('kb');
 * await provider.addMessage(sessionId, message);
 * ```
 */

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  userId: string;
  mode?: 'kb' | 'agent';
}

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
  sessionId?: string;
}

/**
 * Memory Provider インターフェース
 */
export interface MemoryProvider {
  // セッション管理
  createSession(mode: 'kb' | 'agent', userId: string): Promise<string>;
  getSession(sessionId: string): Promise<ChatSession | null>;
  listSessions(userId: string): Promise<ChatSession[]>;
  deleteSession(sessionId: string): Promise<void>;
  
  // メッセージ管理
  addMessage(sessionId: string, message: Message): Promise<void>;
  getMessages(sessionId: string, limit?: number): Promise<Message[]>;
  
  // 検索
  searchMessages(query: string, userId: string): Promise<Message[]>;
}

/**
 * DynamoDB Memory Provider
 * 
 * @description
 * 既存のDynamoDB方式を使用するProvider
 */
export class DynamoDBMemoryProvider implements MemoryProvider {
  async createSession(mode: 'kb' | 'agent', userId: string): Promise<string> {
    const response = await fetch('/api/chat/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        userId,
        mode
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create session');
    }

    const data = await response.json();
    return data.sessionId;
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    const response = await fetch(`/api/chat/history?sessionId=${sessionId}`);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.session;
  }

  async listSessions(userId: string): Promise<ChatSession[]> {
    const response = await fetch(`/api/chat/history?userId=${userId}`);
    
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.sessions || [];
  }

  async deleteSession(sessionId: string): Promise<void> {
    await fetch('/api/chat/history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    await fetch('/api/chat/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'addMessage',
        sessionId,
        message
      })
    });
  }

  async getMessages(sessionId: string, limit: number = 50): Promise<Message[]> {
    const response = await fetch(`/api/chat/history?sessionId=${sessionId}&limit=${limit}`);
    
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.messages || [];
  }

  async searchMessages(query: string, userId: string): Promise<Message[]> {
    const response = await fetch(`/api/chat/history/search?query=${encodeURIComponent(query)}&userId=${userId}`);
    
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.messages || [];
  }
}

/**
 * AgentCore Memory Provider
 * 
 * @description
 * AgentCore Memoryを使用するProvider
 */
export class AgentCoreMemoryProvider implements MemoryProvider {
  async createSession(mode: 'kb' | 'agent', userId: string): Promise<string> {
    const response = await fetch('/api/agentcore/memory/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, userId })
    });

    if (!response.ok) {
      throw new Error('Failed to create session');
    }

    const data = await response.json();
    return data.session.sessionId;
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    const response = await fetch(`/api/agentcore/memory/session?sessionId=${sessionId}`);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const session = data.session;

    // AgentCore Memory形式からChatSession形式に変換
    return {
      id: session.sessionId,
      title: `Chat - ${new Date(session.createdAt).toLocaleDateString()}`,
      messages: [],
      createdAt: new Date(session.createdAt).getTime(),
      updatedAt: new Date(session.createdAt).getTime(),
      userId: session.userId,
      mode: session.mode
    };
  }

  async listSessions(userId: string): Promise<ChatSession[]> {
    try {
      const response = await fetch('/api/agentcore/memory/session');
      if (!response.ok) {
        console.warn('[AgentCore Memory] listSessions failed:', response.status);
        return [];
      }
      const data = await response.json();
      if (!data.success || !Array.isArray(data.sessions)) {
        return [];
      }
      return data.sessions.map((s: any) => ({
        id: s.sessionId,
        title: s.title || `Session ${s.sessionId.substring(0, 8)}`,
        messages: [],
        createdAt: new Date(s.createdAt || Date.now()).getTime(),
        updatedAt: new Date(s.updatedAt || s.createdAt || Date.now()).getTime(),
        userId,
        mode: s.mode || 'agent',
      }));
    } catch (err) {
      console.error('[AgentCore Memory] listSessions error:', err);
      return [];
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    await fetch(`/api/agentcore/memory/session?sessionId=${sessionId}`, {
      method: 'DELETE'
    });
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    await fetch('/api/agentcore/memory/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        event: {
          type: message.role === 'user' ? 'USER_MESSAGE' : 'ASSISTANT_MESSAGE',
          content: message.content,
          timestamp: message.timestamp,
          metadata: {
            messageId: message.id
          }
        }
      })
    });
  }

  async getMessages(sessionId: string, limit: number = 50): Promise<Message[]> {
    const response = await fetch(`/api/agentcore/memory/event?sessionId=${sessionId}&k=${limit}`);
    
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    
    // AgentCore Memory形式からMessage形式に変換
    return data.events.map((event: any) => ({
      id: event.id,
      content: event.content,
      role: event.type === 'USER_MESSAGE' ? 'user' : 'assistant',
      timestamp: event.timestamp,
      sessionId
    }));
  }

  async searchMessages(query: string, userId: string): Promise<Message[]> {
    // AgentCore Memoryの長期メモリ検索を使用
    // 注: sessionIdが必要だが、userIdからセッションを特定する必要がある
    // 現在は簡易実装
    console.warn('[AgentCore Memory] searchMessages requires sessionId');
    return [];
  }
}
