/**
 * Agent Directory Types
 * Agent Directory UI用の型定義
 */

import type { AgentSummary } from '@/hooks/useAgentsList';
import type { ToolProfile, TrustLevel, DataBoundary } from './multi-agent';

/**
 * Action Group概要情報
 */
export interface ActionGroupSummary {
  actionGroupId: string;
  actionGroupName: string;
  actionGroupState: string;
  description?: string;
}

/**
 * Agent詳細情報（GetAgentCommandレスポンスに対応）
 */
export interface AgentDetail {
  agentId: string;
  agentName: string;
  agentStatus: string;
  description?: string;
  instruction?: string;
  foundationModel?: string;
  agentVersion?: string;
  createdAt?: string;
  updatedAt?: string;
  agentResourceRoleArn?: string;
  idleSessionTTLInSeconds?: number;
  actionGroups?: ActionGroupSummary[];
  toolProfiles?: ToolProfile[];
  trustLevel?: TrustLevel;
  dataBoundary?: DataBoundary;
  agentCollaboration?: 'SUPERVISOR' | 'COLLABORATOR' | 'DISABLED';
  teamId?: string;
  policyText?: string;
  policyId?: string;
}

/**
 * テンプレートからのAgent作成進捗
 */
export interface CreationProgress {
  category: string;
  step: 'creating' | 'preparing' | 'creating-alias' | 'completed' | 'error';
  message: string;
}

/**
 * Agent更新フォームデータ
 */
export interface UpdateAgentFormData {
  agentName: string;       // 3文字以上必須
  description: string;
  instruction: string;
  foundationModel: string;
}

export type { AgentSummary };
