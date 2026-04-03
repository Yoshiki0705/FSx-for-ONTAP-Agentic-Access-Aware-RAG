/**
 * ONTAP REST API クライアント
 * FSx for NetApp ONTAP Management APIを使用して権限情報を取得
 * 
 * このクライアントは、FSx for ONTAPのManagement Endpointに接続し、
 * CIFS Share ACL情報を取得します。認証情報はSecrets Managerから取得します。
 * 
 * 参考: https://dev.classmethod.jp/articles/amazon-fsx-for-netapp-ontap-operation-with-ontap-rest-api/
 * ONTAP REST API ドキュメント: https://library.netapp.com/ecmdocs/ECMLP2858435/html/index.html
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { 
  OntapCredentials, 
  OntapAclRecord, 
  OntapAclResponse 
} from './types';
import { 
  FsxUnavailableError, 
  ConfigurationError, 
  TimeoutError,
  ParseError 
} from './errors';

// ========================================
// Name-Mapping インターフェース (Task 7.1)
// ========================================

/**
 * ONTAP Name-Mappingルール
 * 
 * UNIXユーザー名とWindowsユーザー名の対応付けルールを表します。
 * 
 * @property direction - マッピング方向（unix-win: UNIX→Windows, win-unix: Windows→UNIX）
 * @property pattern - マッチングパターン（正規表現）
 * @property replacement - 置換文字列
 */
export interface NameMappingRule {
  direction: 'unix-win' | 'win-unix';
  pattern: string;
  replacement: string;
}

/**
 * ONTAP Name-Mapping APIレスポンス
 */
interface NameMappingResponse {
  records: Array<{
    direction: string;
    pattern: string;
    replacement: string;
  }>;
  num_records: number;
}

// ========================================
// Name-Mapping ユーティリティ関数 (Task 7.2)
// ========================================

/**
 * UNIXユーザー名からWindowsユーザー名へのマッピングを解決する
 * 
 * UNIX→Windowsマッピングルールを順番に適用し、最初にマッチしたルールの
 * 置換結果を返す。マッチするルールがない場合はnullを返す。
 * 
 * @param unixUsername - UNIXユーザー名
 * @param rules - Name-Mappingルール配列
 * @returns マッピングされたWindowsユーザー名、またはnull
 */
export function resolveWindowsUser(unixUsername: string, rules: NameMappingRule[]): string | null {
  // UNIX→Windowsルールのみフィルタ
  const unixToWinRules = rules.filter(r => r.direction === 'unix-win');

  for (const rule of unixToWinRules) {
    try {
      const regex = new RegExp(`^${rule.pattern}$`);
      if (regex.test(unixUsername)) {
        const result = unixUsername.replace(regex, rule.replacement);
        return result;
      }
    } catch {
      // 不正な正規表現パターンはスキップ
      console.warn(`[NameMapping] Invalid regex pattern: ${rule.pattern}`);
    }
  }

  return null;
}

// Secrets Manager クライアント
const secretsManager = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

export interface OntapVolume {
  uuid: string;
  name: string;
  svm: {
    name: string;
    uuid: string;
  };
  state: string;
}

export interface OntapFile {
  path: string;
  name: string;
  type: 'directory' | 'file';
  size: number;
  unix_permissions: number;
  owner: string;
  group: string;
}

export interface OntapAcl {
  access: 'access_allow' | 'access_deny';
  user?: string;
  group?: string;
  rights: string[];
}

export interface OntapFileAclResponse {
  acls: OntapAcl[];
  control_flags: string;
  owner: string;
  group: string;
}

/**
 * ONTAP REST API クライアント
 * 
 * FSx for ONTAP Management Endpointとの通信を担当します。
 * CIFS Share ACL情報の取得に特化しています。
 */
export class OntapRestApiClient {
  private baseUrl: string;
  private credentialsCache: { data: OntapCredentials; timestamp: number } | null = null;
  private readonly CACHE_TTL = 3600000; // 1時間
  private readonly REQUEST_TIMEOUT = 10000; // 10秒

  /**
   * コンストラクタ
   * 
   * @param managementEndpoint - FSx Management Endpoint（オプション、環境変数から取得）
   */
  constructor(managementEndpoint?: string) {
    const endpoint = managementEndpoint || process.env.FSX_MANAGEMENT_ENDPOINT;
    
    if (!endpoint) {
      throw new ConfigurationError(
        'FSX_MANAGEMENT_ENDPOINT is not configured',
        { 
          message: 'FSX_MANAGEMENT_ENDPOINT environment variable must be set',
          providedValue: endpoint 
        }
      );
    }

    // HTTPSプロトコルを追加（必要な場合）
    this.baseUrl = endpoint.startsWith('https://') 
      ? endpoint 
      : `https://${endpoint}`;
  }

  /**
   * Secrets Managerから認証情報を取得
   * 
   * 認証情報は1時間キャッシュされます。
   * 
   * @returns ONTAP認証情報
   * @throws ConfigurationError - Secrets Managerから認証情報を取得できない場合
   */
  private async getCredentials(): Promise<OntapCredentials> {
    // キャッシュチェック
    if (this.credentialsCache) {
      const age = Date.now() - this.credentialsCache.timestamp;
      if (age < this.CACHE_TTL) {
        console.log('Using cached ONTAP credentials');
        return this.credentialsCache.data;
      }
    }

    const secretName = process.env.ONTAP_CREDENTIALS_SECRET_NAME;
    if (!secretName) {
      throw new ConfigurationError(
        'ONTAP_CREDENTIALS_SECRET_NAME is not configured',
        { 
          message: 'ONTAP_CREDENTIALS_SECRET_NAME environment variable must be set' 
        }
      );
    }

    try {
      console.log(`Fetching ONTAP credentials from Secrets Manager: ${secretName}`);
      
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await secretsManager.send(command);

      if (!response.SecretString) {
        throw new ConfigurationError(
          'ONTAP credentials secret is empty',
          { secretName }
        );
      }

      const credentials = JSON.parse(response.SecretString) as OntapCredentials;

      // 認証情報の検証
      if (!credentials.username || !credentials.password) {
        throw new ConfigurationError(
          'ONTAP credentials are incomplete',
          { 
            secretName,
            hasUsername: !!credentials.username,
            hasPassword: !!credentials.password
          }
        );
      }

      // キャッシュに保存
      this.credentialsCache = {
        data: credentials,
        timestamp: Date.now(),
      };

      console.log('Successfully retrieved ONTAP credentials');
      return credentials;
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }
      
      throw new ConfigurationError(
        `Failed to retrieve ONTAP credentials from Secrets Manager: ${(error as Error).message}`,
        { 
          secretName,
          originalError: (error as Error).message 
        }
      );
    }
  }

  /**
   * ONTAP REST APIリクエストを実行
   * 
   * @param method - HTTPメソッド
   * @param path - APIパス（/api/から始まる）
   * @param body - リクエストボディ（オプション）
   * @returns APIレスポンス
   * @throws FsxUnavailableError - ONTAP APIが利用できない場合
   * @throws TimeoutError - リクエストがタイムアウトした場合
   */
  async request<T = any>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: any
  ): Promise<T> {
    const credentials = await this.getCredentials();
    const url = `${this.baseUrl}${path}`;

    // Basic認証ヘッダーを作成
    const auth = Buffer.from(
      `${credentials.username}:${credentials.password}`
    ).toString('base64');

    const headers: Record<string, string> = {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.REQUEST_TIMEOUT),
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      console.log(`ONTAP API Request: ${method} ${path}`);
      
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new FsxUnavailableError(
          `ONTAP API error: ${response.status} ${response.statusText}`,
          {
            method,
            path,
            statusCode: response.status,
            statusText: response.statusText,
            errorBody: errorText
          }
        );
      }

      // レスポンスが空の場合
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.log('ONTAP API returned non-JSON response');
        return {} as T;
      }

      const data = await response.json() as T;
      console.log(`ONTAP API Response: ${method} ${path} - Success`);
      
      return data;
    } catch (error) {
      // タイムアウトエラー
      if ((error as Error).name === 'AbortError' || (error as Error).name === 'TimeoutError') {
        throw new TimeoutError(
          `ONTAP API request timed out after ${this.REQUEST_TIMEOUT}ms`,
          { method, path, timeout: this.REQUEST_TIMEOUT }
        );
      }

      // FSx利用不可エラー
      if (error instanceof FsxUnavailableError) {
        throw error;
      }

      // その他のネットワークエラー
      throw new FsxUnavailableError(
        `ONTAP API request failed: ${(error as Error).message}`,
        { 
          method, 
          path, 
          originalError: (error as Error).message 
        }
      );
    }
  }

  /**
   * CIFS Share ACLを取得
   * 
   * 指定されたSVMとShare名のACL情報を取得します。
   * 
   * @param svm - SVM名
   * @param share - Share名
   * @returns ONTAP ACLレスポンス
   * @throws FsxUnavailableError - ONTAP APIが利用できない場合
   * @throws ParseError - レスポンスのパースに失敗した場合
   * 
   * Validates: Requirements 2.3, 2.4
   */
  async getCifsShareAcl(svm: string, share: string): Promise<OntapAclResponse> {
    const path = `/api/protocols/cifs/shares/${encodeURIComponent(svm)}/${encodeURIComponent(share)}/acls`;
    
    try {
      const response = await this.request<OntapAclResponse>('GET', path);
      
      // レスポンスの検証
      if (!response.records || !Array.isArray(response.records)) {
        throw new ParseError(
          'Invalid ONTAP ACL response format',
          {
            svm,
            share,
            response,
            expectedFormat: '{ records: OntapAclRecord[], num_records: number }'
          }
        );
      }

      console.log(`Retrieved ${response.records.length} ACL records for ${svm}/${share}`);
      return response;
    } catch (error) {
      if (error instanceof FsxUnavailableError || 
          error instanceof TimeoutError || 
          error instanceof ParseError) {
        throw error;
      }

      throw new FsxUnavailableError(
        `Failed to get CIFS Share ACL: ${(error as Error).message}`,
        { svm, share, originalError: (error as Error).message }
      );
    }
  }

  /**
   * ボリューム一覧を取得
   */
  async listVolumes(): Promise<OntapVolume[]> {
    interface VolumesResponse {
      records: OntapVolume[];
      num_records: number;
    }

    const response = await this.request<VolumesResponse>('GET', '/api/storage/volumes');
    return response.records || [];
  }

  /**
   * 特定ボリュームの情報を取得
   */
  async getVolume(volumeUuid: string): Promise<OntapVolume> {
    return await this.request<OntapVolume>('GET', `/api/storage/volumes/${volumeUuid}`);
  }

  /**
   * ボリューム内のファイル/ディレクトリ一覧を取得
   */
  async listFiles(volumeUuid: string, directoryPath: string = '/'): Promise<OntapFile[]> {
    interface FilesResponse {
      records: OntapFile[];
      num_records: number;
    }

    // パスをエンコード
    const encodedPath = encodeURIComponent(directoryPath);

    const response = await this.request<FilesResponse>(
      'GET',
      `/api/storage/volumes/${volumeUuid}/files/${encodedPath}`
    );

    return response.records || [];
  }

  /**
   * ディレクトリ一覧を取得
   */
  async listDirectories(volumeUuid: string, parentPath: string = '/'): Promise<OntapFile[]> {
    const files = await this.listFiles(volumeUuid, parentPath);
    return files.filter((file) => file.type === 'directory');
  }

  /**
   * ファイル/ディレクトリのACLを取得
   */
  async getFileAcl(volumeUuid: string, filePath: string): Promise<OntapFileAclResponse> {
    // パスをエンコード
    const encodedPath = encodeURIComponent(filePath);

    return await this.request<OntapFileAclResponse>(
      'GET',
      `/api/storage/volumes/${volumeUuid}/files/${encodedPath}/acl`
    );
  }

  /**
   * ファイル/ディレクトリの詳細情報を取得
   */
  async getFileInfo(volumeUuid: string, filePath: string): Promise<OntapFile> {
    // パスをエンコード
    const encodedPath = encodeURIComponent(filePath);

    return await this.request<OntapFile>(
      'GET',
      `/api/storage/volumes/${volumeUuid}/files/${encodedPath}`
    );
  }

  /**
   * ユーザーがファイル/ディレクトリにアクセス可能かチェック
   */
  async checkUserAccess(
    volumeUuid: string,
    filePath: string,
    userId: string
  ): Promise<{ read: boolean; write: boolean }> {
    try {
      const acl = await this.getFileAcl(volumeUuid, filePath);

      // ACLからユーザーの権限を判定
      const userAcls = acl.acls.filter(
        (entry) => entry.access === 'access_allow' && entry.user === userId
      );

      const hasRead = userAcls.some((entry) =>
        entry.rights.some((right) => ['read_data', 'list_directory', 'read_attributes'].includes(right))
      );

      const hasWrite = userAcls.some((entry) =>
        entry.rights.some((right) => ['write_data', 'add_file', 'write_attributes'].includes(right))
      );

      return { read: hasRead, write: hasWrite };
    } catch (error) {
      console.error(`Failed to check user access for ${filePath}:`, error);
      return { read: false, write: false };
    }
  }

  /**
   * ユーザーがアクセス可能なディレクトリ一覧を取得
   */
  async getUserAccessibleDirectories(
    volumeUuid: string,
    userId: string
  ): Promise<Array<{ path: string; permissions: ('read' | 'write')[]; owner: string; group: string }>> {
    try {
      // ルートディレクトリのディレクトリ一覧を取得
      const directories = await this.listDirectories(volumeUuid, '/');

      const accessibleDirs: Array<{
        path: string;
        permissions: ('read' | 'write')[];
        owner: string;
        group: string;
      }> = [];

      // 各ディレクトリの権限をチェック
      for (const dir of directories) {
        const access = await this.checkUserAccess(volumeUuid, dir.path, userId);

        const permissions: ('read' | 'write')[] = [];
        if (access.read) permissions.push('read');
        if (access.write) permissions.push('write');

        // アクセス権限がある場合のみ追加
        if (permissions.length > 0) {
          accessibleDirs.push({
            path: dir.path,
            permissions,
            owner: dir.owner,
            group: dir.group,
          });
        }
      }

      return accessibleDirs;
    } catch (error) {
      console.error('Failed to get user accessible directories:', error);
      throw error;
    }
  }

  /**
   * Name-Mappingルールを取得 (Task 7.1)
   * 
   * 指定されたSVMのname-mappingルールを取得します。
   * ONTAP REST API接続失敗時はリトライ1回を実行し、それでも失敗した場合は
   * 空配列を返してエラーをログに記録します。
   * 
   * @param svmUuid - SVM UUID
   * @returns Name-Mappingルール配列
   * 
   * Validates: Requirements 7.1
   */
  async getNameMappingRules(svmUuid: string): Promise<NameMappingRule[]> {
    const path = `/api/name-services/name-mappings?svm.uuid=${encodeURIComponent(svmUuid)}`;

    const attempt = async (): Promise<NameMappingRule[]> => {
      const response = await this.request<NameMappingResponse>('GET', path);

      if (!response.records || !Array.isArray(response.records)) {
        throw new ParseError(
          'Invalid name-mapping response format',
          { svmUuid, response: JSON.stringify(response) }
        );
      }

      return response.records.map(r => ({
        direction: r.direction === 'win_to_unix' ? 'win-unix' as const : 'unix-win' as const,
        pattern: r.pattern,
        replacement: r.replacement,
      }));
    };

    try {
      return await attempt();
    } catch (firstError) {
      // リトライ1回
      console.warn(`[ONTAP] getNameMappingRules first attempt failed, retrying:`, (firstError as Error).message);
      try {
        return await attempt();
      } catch (retryError) {
        console.error(`[ONTAP] getNameMappingRules retry failed:`, (retryError as Error).message);
        return [];
      }
    }
  }

  /**
   * ヘルスチェック
   * 
   * ONTAP REST APIが正常に動作しているかを確認します。
   * 
   * @returns 正常な場合true、異常な場合false
   */
  async healthCheck(): Promise<boolean> {
    try {
      // クラスター情報を取得してヘルスチェック
      await this.request('GET', '/api/cluster');
      console.log('ONTAP API health check: OK');
      return true;
    } catch (error) {
      console.error('ONTAP API health check failed:', error);
      return false;
    }
  }

  /**
   * 接続テスト
   * 
   * ONTAP REST APIへの接続をテストし、詳細な情報を返します。
   * 
   * @returns 接続テスト結果
   */
  async testConnection(): Promise<{
    success: boolean;
    endpoint: string;
    error?: string;
    clusterInfo?: any;
  }> {
    try {
      const clusterInfo = await this.request('GET', '/api/cluster');
      return {
        success: true,
        endpoint: this.baseUrl,
        clusterInfo
      };
    } catch (error) {
      return {
        success: false,
        endpoint: this.baseUrl,
        error: (error as Error).message
      };
    }
  }

  /**
   * NFSエクスポートポリシーを取得
   * 
   * 指定されたSVMのNFSエクスポートポリシー情報を取得します。
   * 
   * @param svm - SVM名
   * @param policyName - エクスポートポリシー名（オプション）
   * @returns NFSエクスポートポリシーレスポンス
   * @throws FsxUnavailableError - ONTAP APIが利用できない場合
   * @throws ParseError - レスポンスのパースに失敗した場合
   * 
   * Validates: Requirements 9.3
   */
  async getNfsExportPolicies(svm: string, policyName?: string): Promise<import('./types').NfsExportPolicyResponse> {
    let path = `/api/protocols/nfs/export-policies?svm.name=${encodeURIComponent(svm)}`;
    
    if (policyName) {
      path += `&name=${encodeURIComponent(policyName)}`;
    }
    
    // ルール情報も含めて取得
    path += '&fields=rules';
    
    try {
      const response = await this.request<import('./types').NfsExportPolicyResponse>('GET', path);
      
      // レスポンスの検証
      if (!response.records || !Array.isArray(response.records)) {
        throw new ParseError(
          'Invalid NFS export policy response format',
          {
            svm,
            policyName,
            response: JSON.stringify(response)
          }
        );
      }
      
      return response;
    } catch (error) {
      if (error instanceof ParseError || error instanceof FsxUnavailableError) {
        throw error;
      }
      
      throw new FsxUnavailableError(
        `Failed to get NFS export policies: ${(error as Error).message}`,
        { svm, policyName, error: (error as Error).message }
      );
    }
  }

  /**
   * ボリュームのNFSエクスポートポリシーを取得
   * 
   * 指定されたボリュームに適用されているNFSエクスポートポリシーを取得します。
   * 
   * @param volumeUuid - ボリュームUUID
   * @returns NFSエクスポートポリシーレスポンス
   * @throws FsxUnavailableError - ONTAP APIが利用できない場合
   * 
   * Validates: Requirements 9.3
   */
  async getVolumeExportPolicy(volumeUuid: string): Promise<import('./types').NfsExportPolicyResponse> {
    try {
      // ボリューム情報を取得してエクスポートポリシー名を取得
      const volumeInfo = await this.request<{
        nas?: {
          export_policy?: {
            name: string;
          };
        };
        svm?: {
          name: string;
        };
      }>('GET', `/api/storage/volumes/${volumeUuid}?fields=nas.export_policy,svm.name`);
      
      if (!volumeInfo.nas?.export_policy?.name || !volumeInfo.svm?.name) {
        throw new ParseError(
          'Volume does not have NFS export policy',
          { volumeUuid, volumeInfo: JSON.stringify(volumeInfo) }
        );
      }
      
      // エクスポートポリシーの詳細を取得
      return await this.getNfsExportPolicies(
        volumeInfo.svm.name,
        volumeInfo.nas.export_policy.name
      );
    } catch (error) {
      if (error instanceof ParseError || error instanceof FsxUnavailableError) {
        throw error;
      }
      
      throw new FsxUnavailableError(
        `Failed to get volume export policy: ${(error as Error).message}`,
        { volumeUuid, error: (error as Error).message }
      );
    }
  }
}

/**
 * ONTAP REST APIクライアントのシングルトンインスタンス
 * 
 * Lambda関数内で再利用されるため、シングルトンパターンを使用します。
 */
let ontapClientInstance: OntapRestApiClient | null = null;

/**
 * ONTAP REST APIクライアントのシングルトンインスタンスを取得
 * 
 * @param managementEndpoint - FSx Management Endpoint（オプション）
 * @returns OntapRestApiClientインスタンス
 * @throws ConfigurationError - 環境変数が設定されていない場合
 */
export function getOntapClient(managementEndpoint?: string): OntapRestApiClient {
  if (!ontapClientInstance) {
    ontapClientInstance = new OntapRestApiClient(managementEndpoint);
  }
  return ontapClientInstance;
}

/**
 * シングルトンインスタンスをリセット
 * 
 * テスト用途で使用します。
 */
export function resetOntapClient(): void {
  ontapClientInstance = null;
}
