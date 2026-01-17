// API レスポンス型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// ヘルスチェック型
export interface HealthCheck {
  status: string;
  timestamp: string;
  service: string;
  environment: string;
  version: string;
}

// ユーザー型
export interface User {
  id: string;
  username: string;
  email?: string;
  roles: string[];
  permissions: string[];
}

// セッション型
export interface Session {
  sessionId: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

// 文書型
export interface Document {
  id: string;
  title: string;
  content: string;
  path: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

// 検索結果型
export interface SearchResult {
  documents: Document[];
  total: number;
  query: string;
  took: number;
}

// UX Enhancement型定義のエクスポート
export * from './theme';
export * from './settings';
export * from './toast';
export * from './modal';
export * from './ui';
