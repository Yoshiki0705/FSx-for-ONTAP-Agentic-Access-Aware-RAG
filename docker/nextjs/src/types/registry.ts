/**
 * Agent Registry 型定義
 *
 * AWS Agent Registry（Amazon Bedrock AgentCore）統合で使用する
 * リクエスト/レスポンスおよびデータモデルの型定義。
 *
 * Requirements: 2.2, 3.2
 */

// ---------------------------------------------------------------------------
// Data Models
// ---------------------------------------------------------------------------

/** Registry 検索結果レコード */
export interface RegistryRecord {
  resourceId: string;
  resourceName: string;
  resourceType: 'Agent' | 'Tool' | 'McpServer' | 'Custom';
  description: string;
  publisherName: string;
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
  approvalStatus: 'APPROVED' | 'PENDING' | 'REJECTED';
}

/** Registry レコード詳細（検索結果 + 追加メタデータ） */
export interface RegistryRecordDetail extends RegistryRecord {
  protocols: string[];
  relatedServices: string[];
  invocationMethod: string;

  /** Agent タイプ固有情報 */
  agentInfo?: {
    foundationModel: string;
    actionGroups: string[];
    knowledgeBases: string[];
  };

  /** MCP サーバータイプ固有情報 */
  mcpServerInfo?: {
    endpointUrl: string;
    tools: string[];
    authMethod: string;
  };
}

// ---------------------------------------------------------------------------
// API Request / Response
// ---------------------------------------------------------------------------

/** POST /api/bedrock/agent-registry/search */
export interface RegistrySearchRequest {
  query: string;
  resourceType?: string;
  nextToken?: string;
  maxResults?: number;
}

/** POST /api/bedrock/agent-registry/search レスポンス */
export interface RegistrySearchResponse {
  records: RegistryRecord[];
  nextToken?: string;
  totalCount: number;
}

/** POST /api/bedrock/agent-registry/detail */
export interface RegistryDetailRequest {
  resourceId: string;
}

/** POST /api/bedrock/agent-registry/import */
export interface RegistryImportRequest {
  resourceId: string;
}

/** POST /api/bedrock/agent-registry/import レスポンス */
export interface RegistryImportResponse {
  success: boolean;
  agentId?: string;
  agentName?: string;
  error?: string;
}

/** POST /api/bedrock/agent-registry/publish */
export interface RegistryPublishRequest {
  agentId: string;
  description?: string;
}

/** POST /api/bedrock/agent-registry/publish レスポンス */
export interface RegistryPublishResponse {
  success: boolean;
  resourceId?: string;
  status?: 'PENDING_APPROVAL' | 'PUBLISHED';
  error?: string;
}
