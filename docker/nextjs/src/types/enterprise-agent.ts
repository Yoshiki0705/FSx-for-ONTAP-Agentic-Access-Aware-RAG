/**
 * Enterprise Agent Enhancement Types
 * Tool Selection, Guardrails, Inference Profiles, Organization Sharing, Background Agent
 */

import type { UpdateAgentFormData } from './agent-directory';

// ---------------------------------------------------------------------------
// Tool Selection (Action Groups)
// ---------------------------------------------------------------------------

/** Available action group template for selection UI */
export interface AvailableActionGroup {
  name: string;
  description: string;
  lambdaArn?: string;
  isDefault?: boolean;
}

// ---------------------------------------------------------------------------
// Guardrails
// ---------------------------------------------------------------------------

/** Guardrail summary from ListGuardrails API */
export interface GuardrailSummary {
  guardrailId: string;
  name: string;
  description?: string;
  status: string;
  version: string;
}

// ---------------------------------------------------------------------------
// Inference Profiles & Cost Tags
// ---------------------------------------------------------------------------

/** Inference profile summary from ListInferenceProfiles API */
export interface InferenceProfileSummary {
  inferenceProfileArn: string;
  inferenceProfileName: string;
  modelId: string;
  status: string;
}

/** Cost allocation tags for department/project tracking */
export interface CostTags {
  department: string;
  project: string;
}

// ---------------------------------------------------------------------------
// Extended Agent Form Data
// ---------------------------------------------------------------------------

/** Extends UpdateAgentFormData with enterprise features */
export interface ExtendedAgentFormData extends UpdateAgentFormData {
  selectedActionGroups: string[];
  guardrailEnabled: boolean;
  guardrailId: string | null;
  guardrailVersion: string | null;
  inferenceProfileArn: string | null;
  costTags: CostTags;
}

// ---------------------------------------------------------------------------
// Organization Sharing — Agent Config JSON
// ---------------------------------------------------------------------------

/** Portable agent configuration for export/import/sharing */
export interface AgentConfig {
  schemaVersion: '1.0';
  agentName: string;
  description: string;
  instruction: string;
  foundationModel: string;
  actionGroups: ActionGroupConfig[];
  guardrail?: {
    guardrailId: string;
    guardrailVersion: string;
  };
  costTags?: CostTags;
  inferenceProfileArn?: string;
  exportedAt: string;
  exportedBy?: string;
}

export interface ActionGroupConfig {
  name: string;
  description: string;
}

/** Metadata for a shared agent config stored in S3 */
export interface SharedAgentConfig {
  key: string;
  agentName: string;
  description: string;
  foundationModel: string;
  uploadedAt: string;
  uploadedBy?: string;
  size: number;
}

// ---------------------------------------------------------------------------
// Background Agent — Scheduled Tasks
// ---------------------------------------------------------------------------

/** Schedule task definition */
export interface ScheduleTask {
  scheduleId: string;
  agentId: string;
  agentName: string;
  cronExpression: string;
  description: string;
  inputPrompt: string;
  enabled: boolean;
  nextExecutionTime?: string;
  createdAt: string;
  updatedAt: string;
}

/** Parameters for creating a new schedule */
export interface CreateScheduleParams {
  agentId: string;
  cronExpression: string;
  description: string;
  inputPrompt: string;
  enabled: boolean;
}

/** Execution history record (DynamoDB) */
export interface ExecutionRecord {
  executionId: string;
  scheduleId: string;
  agentId: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  inputPrompt: string;
  responseSummary?: string;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

// ---------------------------------------------------------------------------
// Component Props
// ---------------------------------------------------------------------------

export interface ActionGroupSelectorProps {
  agentId?: string;
  selectedGroups: string[];
  onSelectionChange: (groups: string[]) => void;
  disabled?: boolean;
}

export interface GuardrailSettingsProps {
  enabled: boolean;
  guardrailId: string | null;
  guardrailVersion: string | null;
  onEnabledChange: (enabled: boolean) => void;
  onGuardrailChange: (id: string, version: string) => void;
  disabled?: boolean;
}

export interface InferenceProfileSelectorProps {
  profileArn: string | null;
  costTags: CostTags;
  onProfileChange: (arn: string | null) => void;
  onCostTagsChange: (tags: CostTags) => void;
  disabled?: boolean;
}

export interface ImportDialogProps {
  onImport: (config: AgentConfig) => Promise<void>;
  onCancel: () => void;
  isImporting: boolean;
}

export interface SharedConfigPreviewProps {
  config: AgentConfig;
  onImport: () => void;
  onCancel: () => void;
}

export interface ScheduleFormProps {
  agentId: string;
  existingSchedule?: ScheduleTask;
  onSave: (schedule: CreateScheduleParams) => Promise<void>;
  onCancel: () => void;
}

export interface ExecutionHistoryListProps {
  scheduleId: string;
  executions: ExecutionRecord[];
  isLoading: boolean;
}
