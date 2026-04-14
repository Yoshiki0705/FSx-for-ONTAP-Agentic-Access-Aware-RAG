/**
 * Agent Registry クライアント
 *
 * AWS AgentCore Registry API へのアクセスを抽象化するクライアントクラス。
 * SDK コマンド（boto3 互換）による実装。
 *
 * Agent Registry は Preview API（2026年4月〜）。
 * SDK に search_registry_records / create_registry_record 等のコマンドが追加済み。
 * コントロールプレーン: bedrock-agentcore-control（レジストリ・レコード管理）
 * データプレーン: bedrock-agentcore（検索）
 *
 * - AGENT_REGISTRY_REGION 環境変数からリージョンを取得
 * - AGENT_REGISTRY_ARN 環境変数からレジストリ ARN を取得
 * - タイムアウト 15 秒（クロスリージョン考慮）
 * - 最大 3 回リトライ（エクスポネンシャルバックオフ: 1s, 2s, 4s）
 * - ENABLE_AGENT_REGISTRY チェック
 *
 * Requirements: 10.2, 11.5, 11.8
 */

import type {
  RegistryRecord,
  RegistryRecordDetail,
  RegistrySearchResponse,
} from '@/types/registry';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const DEFAULT_MAX_RESULTS = 20;

// ---------------------------------------------------------------------------
// Types (internal)
// ---------------------------------------------------------------------------

interface RegistryClientConfig {
  region: string;
  registryArn: string;
  timeoutMs: number;
  maxRetries: number;
}

interface RegistryError {
  code: string;
  message: string;
  statusCode?: number;
  retryable: boolean;
}

// ---------------------------------------------------------------------------
// Helper: delay for exponential backoff
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// RegistryClient
// ---------------------------------------------------------------------------

export class RegistryClient {
  private config: RegistryClientConfig;

  constructor() {
    const region =
      process.env.AGENT_REGISTRY_REGION ||
      process.env.AWS_REGION ||
      'ap-northeast-1';

    const registryArn = process.env.AGENT_REGISTRY_ARN || '';

    this.config = {
      region,
      registryArn,
      timeoutMs: TIMEOUT_MS,
      maxRetries: MAX_RETRIES,
    };
  }

  // -----------------------------------------------------------------------
  // Public: feature-flag guard
  // -----------------------------------------------------------------------

  /** Returns true when the Agent Registry feature is enabled. */
  isEnabled(): boolean {
    return process.env.ENABLE_AGENT_REGISTRY === 'true';
  }

  /** Returns the configured registry region. */
  getRegion(): string {
    return this.config.region;
  }

  // -----------------------------------------------------------------------
  // Public: CRUD operations
  // -----------------------------------------------------------------------

  /**
   * Search registry records using the data plane API.
   * Uses SearchRegistryRecords (hybrid semantic + keyword search).
   */
  async searchResources(params: {
    query: string;
    resourceType?: string;
    nextToken?: string;
    maxResults?: number;
  }): Promise<RegistrySearchResponse> {
    this.ensureEnabled();

    const maxResults = Math.min(params.maxResults ?? DEFAULT_MAX_RESULTS, DEFAULT_MAX_RESULTS);

    try {
      const response = await this.callWithRetry<RegistrySearchResponse>(
        'searchRegistryRecords',
        {
          searchQuery: params.query || '*',
          registryIds: [this.config.registryArn],
          maxResults,
          ...(params.resourceType && {
            filters: { descriptorType: { '$eq': params.resourceType } },
          }),
        },
      );

      return response;
    } catch (error) {
      console.error('[RegistryClient] searchResources error:', error);
      throw this.wrapError(error);
    }
  }

  /**
   * Get a single registry record detail.
   * Uses GetRegistryRecord from the control plane.
   */
  async getResource(resourceId: string): Promise<RegistryRecordDetail> {
    this.ensureEnabled();

    try {
      const response = await this.callWithRetry<RegistryRecordDetail>(
        'getRegistryRecord',
        { registryId: this.config.registryArn, registryRecordId: resourceId },
        'control',
      );
      return response;
    } catch (error) {
      console.error('[RegistryClient] getResource error:', error);
      throw this.wrapError(error);
    }
  }

  /**
   * Create (publish) a registry record.
   * Uses CreateRegistryRecord from the control plane.
   */
  async createResource(params: {
    resourceName: string;
    resourceType: string;
    description: string;
    metadata: Record<string, unknown>;
  }): Promise<{ resourceId: string; status: string }> {
    this.ensureEnabled();

    try {
      const response = await this.callWithRetry<{
        resourceId: string;
        status: string;
      }>('createRegistryRecord', {
        registryId: this.config.registryArn,
        name: params.resourceName,
        description: params.description,
        descriptorType: params.resourceType,
        descriptor: JSON.stringify(params.metadata),
      }, 'control');
      return response;
    } catch (error) {
      console.error('[RegistryClient] createResource error:', error);
      throw this.wrapError(error);
    }
  }

  /**
   * Delete a registry record.
   * Uses DeleteRegistryRecord from the control plane.
   */
  async deleteResource(resourceId: string): Promise<{ success: boolean }> {
    this.ensureEnabled();

    try {
      await this.callWithRetry<Record<string, unknown>>(
        'deleteRegistryRecord',
        { registryId: this.config.registryArn, registryRecordId: resourceId },
        'control',
      );
      return { success: true };
    } catch (error) {
      console.error('[RegistryClient] deleteResource error:', error);
      throw this.wrapError(error);
    }
  }

  // -----------------------------------------------------------------------
  // Private: SDK-based transport
  // -----------------------------------------------------------------------

  private async callWithRetry<T>(
    operation: string,
    params: Record<string, unknown>,
    plane: 'data' | 'control' = 'data',
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await this.executeOperation<T>(operation, params, plane);
        return result;
      } catch (error: any) {
        lastError = error;
        const statusCode = error?.statusCode ?? error?.$metadata?.httpStatusCode;

        const isRetryable =
          (statusCode && statusCode >= 500) ||
          error?.name === 'TimeoutError' ||
          error?.code === 'ETIMEDOUT';

        if (!isRetryable || attempt === this.config.maxRetries) {
          throw error;
        }

        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        console.warn(
          `[RegistryClient] ${operation} attempt ${attempt} failed, retrying in ${backoffMs}ms...`,
        );
        await delay(backoffMs);
      }
    }

    throw lastError;
  }

  /**
   * Execute a single API operation using the AWS SDK.
   *
   * Uses @aws-sdk/client-bedrock-agentcore for data plane (search)
   * and @aws-sdk/client-bedrock-agentcore-control for control plane (CRUD).
   *
   * Falls back to SigV4-signed HTTP if SDK commands are not available.
   */
  private async executeOperation<T>(
    operation: string,
    params: Record<string, unknown>,
    plane: 'data' | 'control' = 'data',
  ): Promise<T> {
    // Use SigV4-signed HTTP for now (SDK commands may not be in Node.js SDK yet)
    const serviceName = plane === 'control'
      ? 'bedrock-agentcore'
      : 'bedrock-agentcore';
    const endpoint = `https://${serviceName}.${this.config.region}.amazonaws.com`;

    // Map operation names to REST paths
    const pathMap: Record<string, { path: string; method: string }> = {
      searchRegistryRecords: { path: '/registry-records/search', method: 'POST' },
      getRegistryRecord: { path: `/registries/${encodeURIComponent(String(params.registryId))}/records/${encodeURIComponent(String(params.registryRecordId))}`, method: 'GET' },
      createRegistryRecord: { path: `/registries/${encodeURIComponent(String(params.registryId))}/records`, method: 'POST' },
      deleteRegistryRecord: { path: `/registries/${encodeURIComponent(String(params.registryId))}/records/${encodeURIComponent(String(params.registryRecordId))}`, method: 'DELETE' },
      listRegistryRecords: { path: `/registries/${encodeURIComponent(String(params.registryId))}/records`, method: 'GET' },
    };

    const route = pathMap[operation];
    if (!route) {
      throw new Error(`Unknown registry operation: ${operation}`);
    }

    const url = `${endpoint}${route.path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const { defaultProvider } = await import('@aws-sdk/credential-provider-node');
      const { SignatureV4 } = await import('@smithy/signature-v4');
      const { Sha256 } = await import('@aws-crypto/sha256-js');
      const { HttpRequest } = await import('@smithy/protocol-http');

      const credentials = defaultProvider();
      const signer = new SignatureV4({
        service: 'bedrock-agentcore',
        region: this.config.region,
        credentials,
        sha256: Sha256,
      });

      // For GET/DELETE, don't send body; for POST, send params as body
      const hasBody = route.method === 'POST';
      const body = hasBody ? JSON.stringify(params) : undefined;

      const parsedUrl = new URL(url);
      const httpRequest = new HttpRequest({
        method: route.method,
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname,
        headers: {
          'Content-Type': 'application/json',
          host: parsedUrl.hostname,
        },
        ...(body && { body }),
      });

      const signedRequest = await signer.sign(httpRequest);

      const response = await fetch(url, {
        method: route.method,
        headers: signedRequest.headers as Record<string, string>,
        ...(body && { body }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        const error: any = new Error(
          `AgentCore Registry ${operation} failed: ${response.status} ${response.statusText}`,
        );
        error.statusCode = response.status;
        error.body = errorBody;
        throw error;
      }

      const text = await response.text();
      if (!text) return {} as T;
      return JSON.parse(text) as T;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        const timeoutError: any = new Error(
          `AgentCore Registry ${operation} timed out after ${this.config.timeoutMs}ms`,
        );
        timeoutError.name = 'TimeoutError';
        timeoutError.code = 'ETIMEDOUT';
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // -----------------------------------------------------------------------
  // Private: helpers
  // -----------------------------------------------------------------------

  private ensureEnabled(): void {
    if (!this.isEnabled()) {
      throw Object.assign(
        new Error('Agent Registry is not enabled. Set ENABLE_AGENT_REGISTRY=true.'),
        { code: 'REGISTRY_DISABLED', statusCode: 404, retryable: false },
      );
    }
  }

  private wrapError(error: unknown): RegistryError {
    if (error && typeof error === 'object' && 'code' in error) {
      return error as RegistryError;
    }
    const message =
      error instanceof Error ? error.message : 'Unknown registry error';
    return {
      code: 'REGISTRY_ERROR',
      message,
      retryable: false,
    };
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
