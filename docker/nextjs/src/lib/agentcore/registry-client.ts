/**
 * Agent Registry client
 *
 * Talks to AWS Agent Registry in its own `agent-registry` namespace.
 *
 * The service used to live in the `bedrock-agentcore` namespace (public preview).
 * AWS moved it on 2026-08-06 and shuts the old namespace down on 2026-10-30, and an
 * account that had no registry on 2026-08-06 cannot use the old one at all. See the
 * migration guide: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/registry-faq.html
 *
 * - Data plane (search, browse, read approved records): @aws-sdk/client-agent-registry
 * - Control plane (publish, delete):                    @aws-sdk/client-agent-registry-control
 *
 * Settings:
 * - AGENT_REGISTRY_ARN    registry ARN (arn:aws:agent-registry:<region>:<account>:registry/<id>) or bare id
 * - AGENT_REGISTRY_REGION region of the registry; defaults to the region in the ARN, then AWS_REGION
 * - ENABLE_AGENT_REGISTRY must be 'true'
 *
 * The rest of the app works with `RegistryRecord` (types/registry.ts). The mapping from the
 * service's records to that shape is in `toRegistryRecord` / `toRegistryRecordDetail`.
 */

import {
  AgentRegistryClient,
  BatchGetDiscoverableRegistryRecordCommand,
  SearchDiscoverableRegistryRecordsCommand,
} from '@aws-sdk/client-agent-registry';
import {
  AgentRegistryControlClient,
  CreateRegistryRecordCommand,
  DeleteRegistryRecordCommand,
  GetRegistryRecordCommand,
  SubmitRegistryRecordForApprovalCommand,
} from '@aws-sdk/client-agent-registry-control';
import type {
  RegistryRecord,
  RegistryRecordDetail,
  RegistrySearchResponse,
} from '@/types/registry';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const DEFAULT_MAX_RESULTS = 20;
/** A new record is CREATING for a few seconds and cannot be submitted until it is DRAFT. */
const CREATE_POLL_INTERVAL_MS = 1_000;
const CREATE_POLL_MAX_ATTEMPTS = 20;

// ---------------------------------------------------------------------------
// Mapping between the service's record types and the app's resource types
// ---------------------------------------------------------------------------

type ServiceRecordType = 'AGENT' | 'MCP' | 'SKILL' | 'CUSTOM';

const RECORD_TYPE_TO_RESOURCE_TYPE: Record<ServiceRecordType, RegistryRecord['resourceType']> = {
  AGENT: 'Agent',
  MCP: 'McpServer',
  SKILL: 'Tool',
  CUSTOM: 'Custom',
};

const RESOURCE_TYPE_TO_RECORD_TYPE: Record<string, ServiceRecordType> = {
  Agent: 'AGENT',
  McpServer: 'MCP',
  Tool: 'SKILL',
  Custom: 'CUSTOM',
};

/**
 * The service has more states than the screen shows. Draft and pending records are not
 * published yet, so both read as PENDING; a rejected or deprecated record is not offered
 * for use, so both read as REJECTED. The data plane returns approved records, so in practice
 * this only matters for detail views opened from the control plane.
 */
function toApprovalStatus(status: string | undefined): RegistryRecord['approvalStatus'] {
  switch (status) {
    case 'APPROVED':
      return 'APPROVED';
    case 'REJECTED':
    case 'DEPRECATED':
      return 'REJECTED';
    default:
      return 'PENDING';
  }
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : '';
}

/** Parse the JSON text of a descriptor, or return an empty object when it is not JSON. */
function parseDescriptorData(data: unknown): Record<string, any> {
  if (typeof data !== 'string' || !data) return {};
  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : {};
  } catch {
    return {};
  }
}

/** Summary fields shared by search results and details. */
export function toRegistryRecord(record: Record<string, any>): RegistryRecord {
  return {
    resourceId: record.recordId ?? '',
    resourceName: record.displayName || record.name || '',
    resourceType: RECORD_TYPE_TO_RESOURCE_TYPE[record.recordType as ServiceRecordType] ?? 'Custom',
    description: record.description ?? '',
    // The data plane does not return who published a record.
    publisherName: '',
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
    approvalStatus: toApprovalStatus(record.status),
  };
}

/** Detail fields, read from the record's descriptors. A descriptor that is not JSON adds nothing. */
export function toRegistryRecordDetail(record: Record<string, any>): RegistryRecordDetail {
  const base = toRegistryRecord(record);
  const descriptors = (record.descriptors ?? {}) as Record<string, any>;
  const detail: RegistryRecordDetail = {
    ...base,
    protocols: [],
    relatedServices: [],
    invocationMethod: '',
  };

  const agentCard = parseDescriptorData(descriptors.a2aAgentCard?.data);
  if (descriptors.a2aAgentCard) {
    detail.protocols = ['A2A'];
    detail.invocationMethod = typeof agentCard.url === 'string' ? agentCard.url : '';
    detail.relatedServices = Array.isArray(agentCard.skills)
      ? agentCard.skills.map((s: any) => String(s?.name ?? s?.id ?? '')).filter(Boolean)
      : [];
  }

  const mcp = parseDescriptorData(descriptors.mcpServer?.data);
  if (descriptors.mcpServer) {
    const tools = parseDescriptorData(descriptors.mcpServer.additionalData?.tools?.data);
    const toolList: any[] = Array.isArray(tools.tools) ? tools.tools : [];
    detail.protocols = ['MCP'];
    detail.mcpServerInfo = {
      endpointUrl: String(mcp.url ?? mcp.remotes?.[0]?.url ?? ''),
      tools: toolList.map((t) => String(t?.name ?? '')).filter(Boolean),
      authMethod: '',
    };
    detail.invocationMethod = detail.mcpServerInfo.endpointUrl;
  }

  // A Bedrock agent published from this app is stored as a custom record whose data names the agent.
  const custom = parseDescriptorData(descriptors.custom?.data);
  if (typeof custom.foundationModel === 'string') {
    detail.agentInfo = {
      foundationModel: custom.foundationModel,
      actionGroups: Array.isArray(custom.actionGroups) ? custom.actionGroups.map(String) : [],
      knowledgeBases: Array.isArray(custom.knowledgeBases) ? custom.knowledgeBases.map(String) : [],
    };
  }
  return detail;
}

/**
 * Record names are the registry's unique key: letters, digits and `_ - . /`, at most 64 characters.
 * Publishing the same agent twice is refused by the service as a conflict, which is what we want.
 */
export function toRecordName(resourceName: string): string {
  const cleaned = resourceName.replace(/[^A-Za-z0-9_\-./]/g, '-').replace(/^[^A-Za-z0-9]+/, '');
  return (cleaned || 'record').slice(0, 64);
}

/** `arn:aws:agent-registry:<region>:<account>:registry/<id>` gives region and id; a bare id gives neither. */
export function parseRegistryRef(ref: string): { region?: string; id: string } {
  const match = /^arn:aws[a-z-]*:agent-registry:([a-z0-9-]+):\d{12}:registry\/([A-Za-z0-9]+)$/.exec(ref);
  return match ? { region: match[1], id: match[2] } : { id: ref };
}

function recordIdFromArn(arn: string | undefined): string {
  return (arn ?? '').split('/').pop() ?? '';
}

// ---------------------------------------------------------------------------
// Types (internal)
// ---------------------------------------------------------------------------

interface RegistryClientConfig {
  region: string;
  registryRef: string;
  timeoutMs: number;
  maxAttempts: number;
}

interface RegistryError {
  code: string;
  message: string;
  statusCode?: number;
  retryable: boolean;
}

// ---------------------------------------------------------------------------
// RegistryClient
// ---------------------------------------------------------------------------

export class RegistryClient {
  private config: RegistryClientConfig;
  private dataClient?: AgentRegistryClient;
  private controlClient?: AgentRegistryControlClient;

  constructor() {
    const registryRef = process.env.AGENT_REGISTRY_ARN || '';
    const region =
      process.env.AGENT_REGISTRY_REGION ||
      parseRegistryRef(registryRef).region ||
      process.env.AWS_REGION ||
      'ap-northeast-1';

    this.config = { region, registryRef, timeoutMs: TIMEOUT_MS, maxAttempts: MAX_ATTEMPTS };
  }

  /** Returns true when the Agent Registry feature is enabled. */
  isEnabled(): boolean {
    return process.env.ENABLE_AGENT_REGISTRY === 'true';
  }

  /** Returns the configured registry region. */
  getRegion(): string {
    return this.config.region;
  }

  // -----------------------------------------------------------------------
  // Public operations
  // -----------------------------------------------------------------------

  /**
   * Search approved records. An empty query lists the newest records first.
   * `resourceType` is one of the app's names (Agent, McpServer, Tool, Custom).
   */
  async searchResources(params: {
    query: string;
    resourceType?: string;
    nextToken?: string;
    maxResults?: number;
  }): Promise<RegistrySearchResponse & { registryRegion: string }> {
    this.ensureReady();
    const maxResults = Math.min(params.maxResults ?? DEFAULT_MAX_RESULTS, DEFAULT_MAX_RESULTS);
    const recordType = params.resourceType ? RESOURCE_TYPE_TO_RECORD_TYPE[params.resourceType] : undefined;

    try {
      const response = await this.data().send(
        new SearchDiscoverableRegistryRecordsCommand({
          searchQuery: params.query === '*' ? '' : params.query ?? '',
          registryIds: [this.config.registryRef],
          maxResults,
          ...(params.nextToken && { nextToken: params.nextToken }),
          ...(recordType && { filters: { recordType: { $eq: recordType } } }),
        }),
        { abortSignal: AbortSignal.timeout(this.config.timeoutMs) },
      );
      const records = (response.registryRecords ?? []).map((r) => toRegistryRecord(r));
      return {
        records,
        nextToken: response.nextToken,
        totalCount: records.length,
        registryRegion: this.config.region,
      };
    } catch (error) {
      console.error('[RegistryClient] searchResources error:', error);
      throw this.wrapError(error);
    }
  }

  /** Read one approved record, with the detail fields taken from its descriptors. */
  async getResource(resourceId: string): Promise<RegistryRecordDetail> {
    this.ensureReady();
    try {
      const response = await this.data().send(
        new BatchGetDiscoverableRegistryRecordCommand({
          entries: [{ registryId: this.config.registryRef, recordIds: [resourceId] }],
        }),
        { abortSignal: AbortSignal.timeout(this.config.timeoutMs) },
      );
      const record = response.registryRecords?.[0];
      if (!record) {
        const reason = response.errors?.[0];
        throw Object.assign(new Error(reason?.message ?? `Registry record not found: ${resourceId}`), {
          code: reason?.errorCode ?? 'RESOURCE_NOT_FOUND',
          statusCode: reason?.errorCode === 'ACCESS_DENIED' ? 403 : 404,
          retryable: false,
        });
      }
      return toRegistryRecordDetail(record);
    } catch (error) {
      console.error('[RegistryClient] getResource error:', error);
      throw this.wrapError(error);
    }
  }

  /**
   * Publish a record: create it as a custom record whose data is the metadata, then submit it
   * for approval. The status returned is the registry's: APPROVED when the registry approves
   * automatically, PENDING_APPROVAL when a curator has to.
   */
  async createResource(params: {
    resourceName: string;
    resourceType: string;
    description: string;
    metadata: Record<string, unknown>;
  }): Promise<{ resourceId: string; status: string }> {
    this.ensureReady();
    try {
      const created = await this.control().send(
        new CreateRegistryRecordCommand({
          registryId: this.config.registryRef,
          name: toRecordName(params.resourceName),
          displayName: params.resourceName.slice(0, 255),
          description: params.description || undefined,
          recordType: 'CUSTOM',
          descriptors: { custom: { data: JSON.stringify({ ...params.metadata, resourceType: params.resourceType }) } },
        }),
        { abortSignal: AbortSignal.timeout(this.config.timeoutMs) },
      );
      const resourceId = recordIdFromArn(created.recordArn);
      await this.waitUntilCreated(resourceId, created.status);
      const submitted = await this.control().send(
        new SubmitRegistryRecordForApprovalCommand({
          registryId: this.config.registryRef,
          recordId: resourceId,
        }),
        { abortSignal: AbortSignal.timeout(this.config.timeoutMs) },
      );
      return { resourceId, status: submitted.status ?? created.status ?? 'PENDING_APPROVAL' };
    } catch (error) {
      console.error('[RegistryClient] createResource error:', error);
      throw this.wrapError(error);
    }
  }

  /** Delete a record. */
  async deleteResource(resourceId: string): Promise<{ success: boolean }> {
    this.ensureReady();
    try {
      await this.control().send(
        new DeleteRegistryRecordCommand({ registryId: this.config.registryRef, recordId: resourceId }),
        { abortSignal: AbortSignal.timeout(this.config.timeoutMs) },
      );
      return { success: true };
    } catch (error) {
      console.error('[RegistryClient] deleteResource error:', error);
      throw this.wrapError(error);
    }
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  /** Wait until the record has left CREATING. Throws if creation fails or takes too long. */
  private async waitUntilCreated(recordId: string, initialStatus?: string): Promise<void> {
    let status = initialStatus;
    for (let attempt = 0; status === 'CREATING' && attempt < CREATE_POLL_MAX_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, CREATE_POLL_INTERVAL_MS));
      const current = await this.control().send(
        new GetRegistryRecordCommand({ registryId: this.config.registryRef, recordId }),
        { abortSignal: AbortSignal.timeout(this.config.timeoutMs) },
      );
      status = current.status;
    }
    if (status === 'CREATING' || status === 'CREATE_FAILED') {
      throw Object.assign(new Error(`Registry record ${recordId} did not become ready (status ${status}).`), {
        code: 'RECORD_NOT_READY',
        statusCode: 502,
        retryable: status === 'CREATING',
      });
    }
  }

  private data(): AgentRegistryClient {
    this.dataClient ??= new AgentRegistryClient({ region: this.config.region, maxAttempts: this.config.maxAttempts });
    return this.dataClient;
  }

  private control(): AgentRegistryControlClient {
    this.controlClient ??= new AgentRegistryControlClient({ region: this.config.region, maxAttempts: this.config.maxAttempts });
    return this.controlClient;
  }

  private ensureReady(): void {
    if (!this.isEnabled()) {
      throw Object.assign(
        new Error('Agent Registry is not enabled. Set ENABLE_AGENT_REGISTRY=true.'),
        { code: 'REGISTRY_DISABLED', statusCode: 404, retryable: false },
      );
    }
    // Without this the service is asked about an empty registry id and answers with a bare 400.
    if (!this.config.registryRef) {
      throw Object.assign(
        new Error('No registry is configured. Set AGENT_REGISTRY_ARN to the ARN of an AWS Agent Registry registry (arn:aws:agent-registry:<region>:<account>:registry/<id>).'),
        { code: 'REGISTRY_NOT_CONFIGURED', statusCode: 503, retryable: false },
      );
    }
  }

  private wrapError(error: unknown): RegistryError {
    if (error && typeof error === 'object') {
      const e = error as { name?: string; code?: string; message?: string; statusCode?: number; retryable?: boolean; $metadata?: { httpStatusCode?: number } };
      const statusCode = e.statusCode ?? e.$metadata?.httpStatusCode;
      return {
        code: e.code ?? e.name ?? 'REGISTRY_ERROR',
        message: e.message ?? 'Unknown registry error',
        statusCode,
        retryable: e.retryable ?? (typeof statusCode === 'number' && statusCode >= 500),
      };
    }
    return { code: 'REGISTRY_ERROR', message: 'Unknown registry error', retryable: false };
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let _instance: RegistryClient | null = null;

/** Get (or create) the singleton RegistryClient instance. */
export function getRegistryClient(): RegistryClient {
  if (!_instance) {
    _instance = new RegistryClient();
  }
  return _instance;
}
