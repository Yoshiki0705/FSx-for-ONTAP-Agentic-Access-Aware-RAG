export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  sessionId?: string;
  metadata?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  mode?: 'agent' | 'kb';
  model?: string;
  region?: string;
  agentId?: string;
  userId?: string;
}

export interface SessionMetadata {
  id: string;
  title: string;
  messageCount: number;
  lastMessage: string;
  createdAt: number;
  updatedAt: number;
  mode: 'agent' | 'kb';
}

export interface ChatSettings {
  temperature: number;
  maxTokens: number;
  topP: number;
  model: string;
  saveHistory: boolean;
}
