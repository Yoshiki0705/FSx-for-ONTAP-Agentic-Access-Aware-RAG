/**
 * KB Selector 型定義 - Advanced RAG Features
 *
 * Knowledge Base接続UIで使用する型を定義。
 * Agent作成・編集時のKB選択、接続・解除・一覧取得APIの
 * リクエスト/レスポンス型を含む。
 *
 * @version 1.0.0
 */

/** Knowledge Base概要情報（KB一覧取得APIレスポンス） */
export interface KnowledgeBaseSummary {
  id: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'CREATING' | 'DELETING' | 'UPDATING' | 'FAILED';
  updatedAt?: string;
  dataSourceCount: number;
}

/** AgentとKBの接続情報 */
export interface AgentKnowledgeBaseAssociation {
  knowledgeBaseId: string;
  knowledgeBaseState: 'ENABLED' | 'DISABLED';
  description?: string;
  updatedAt?: string;
}

/** KB接続リクエスト */
export interface AssociateKBRequest {
  action: 'associateKnowledgeBase';
  agentId: string;
  agentVersion: string;
  knowledgeBaseId: string;
  description?: string;
}

/** KB解除リクエスト */
export interface DisassociateKBRequest {
  action: 'disassociateKnowledgeBase';
  agentId: string;
  agentVersion: string;
  knowledgeBaseId: string;
}

/** 接続KB一覧取得リクエスト */
export interface ListAgentKBsRequest {
  action: 'listAgentKnowledgeBases';
  agentId: string;
  agentVersion: string;
}
