/**
 * FSx Permission Service
 * ONTAP REST APIとSSM PowerShellを使用してFSx for ONTAPのACLを照会し、ユーザー権限を取得するサービス
 * 
 * Validates: Requirements 1.2, 1.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.2
 */

import { SSMClient, SendCommandCommand, GetCommandInvocationCommand } from '@aws-sdk/client-ssm';
import { getOntapClient, OntapRestApiClient } from './ontap-rest-api-client';
import { 
  PowerShellAclEntry, 
  PowerShellAclResponse, 
  SsmCommandResult, 
  PowerShellExecutionParams 
} from './types';

// 型定義
export interface DirectoryPermission {
  path: string;
  permissions: ('read' | 'write')[];
  owner: string;
  group: string;
}

export interface FsxPermissionServiceConfig {
  volumeUuid?: string;  // ONTAPボリュームUUID
  volumeName?: string;  // ONTAPボリューム名（UUIDがない場合）
  adEc2InstanceId?: string;  // Active Directory EC2インスタンスID（SSM用）
  ssmTimeout?: number;  // SSMタイムアウト（秒）、デフォルト: 30
}

/**
 * FSx Permission Service実装
 */
export class FsxPermissionService {
  private config: FsxPermissionServiceConfig;
  private ontapClient: OntapRestApiClient;
  private cache: Map<string, { data: DirectoryPermission[]; timestamp: number }>;
  private volumeUuidCache: string | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分

  private ssmClient: SSMClient;

  constructor(config: FsxPermissionServiceConfig) {
    this.config = config;
    this.ontapClient = getOntapClient();
    this.ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.cache = new Map();
    console.log('FsxPermissionService initialized with ONTAP REST API and SSM PowerShell');
  }

  /**
   * ボリュームUUIDを取得（キャッシュ付き）
   */
  private async getVolumeUuid(): Promise<string> {
    // 設定で指定されている場合はそれを使用
    if (this.config.volumeUuid) {
      return this.config.volumeUuid;
    }

    // キャッシュチェック
    if (this.volumeUuidCache) {
      return this.volumeUuidCache;
    }

    // ボリューム名から検索
    if (this.config.volumeName) {
      const volumes = await this.ontapClient.listVolumes();
      const volume = volumes.find((v) => v.name === this.config.volumeName);

      if (!volume) {
        throw new FsxUnavailableError(`Volume not found: ${this.config.volumeName}`);
      }

      this.volumeUuidCache = volume.uuid;
      return volume.uuid;
    }

    // どちらも指定されていない場合は最初のボリュームを使用
    const volumes = await this.ontapClient.listVolumes();
    if (volumes.length === 0) {
      throw new FsxUnavailableError('No volumes found');
    }

    this.volumeUuidCache = volumes[0].uuid;
    console.log(`Using first volume: ${volumes[0].name} (${volumes[0].uuid})`);
    return volumes[0].uuid;
  }

  /**
   * ユーザーのアクセス可能ディレクトリを取得
   * Validates: Requirements 1.4, 5.1
   */
  async queryUserPermissions(userId: string): Promise<DirectoryPermission[]> {
    console.log(`Querying permissions for user: ${userId} via ONTAP REST API`);

    // キャッシュチェック
    const cached = this.getCachedPermissions(userId);
    if (cached) {
      console.log('Returning cached permissions');
      return cached;
    }

    try {
      // ボリュームUUIDを取得
      const volumeUuid = await this.getVolumeUuid();

      // ONTAP REST APIでユーザーのアクセス可能ディレクトリを取得
      const accessibleDirs = await this.ontapClient.getUserAccessibleDirectories(
        volumeUuid,
        userId
      );

      console.log(`User ${userId} has access to ${accessibleDirs.length} directories`);

      // キャッシュに保存
      this.setCachedPermissions(userId, accessibleDirs);

      return accessibleDirs;
    } catch (error) {
      console.error('Error querying FSx permissions via ONTAP REST API:', error);
      throw new FsxUnavailableError(`Failed to query FSx permissions: ${error.message}`);
    }
  }

  /**
   * 特定ファイルへのアクセス権限をチェック
   * Validates: Requirements 1.2, 1.3
   */
  async checkFileAccess(userId: string, filePath: string): Promise<boolean> {
    console.log(`Checking file access for user ${userId}: ${filePath} via ONTAP REST API`);

    try {
      const volumeUuid = await this.getVolumeUuid();

      // ONTAP REST APIでアクセス権限をチェック
      const access = await this.ontapClient.checkUserAccess(volumeUuid, filePath, userId);

      return access.read;
    } catch (error) {
      console.error('Error checking file access via ONTAP REST API:', error);
      return false;
    }
  }

  /**
   * アクセス可能なディレクトリ一覧を取得
   * Validates: Requirements 1.4
   */
  async listAccessibleDirectories(userId: string): Promise<string[]> {
    const permissions = await this.queryUserPermissions(userId);
    return permissions.map(p => p.path);
  }



  /**
   * SSM Run Commandを使用してPowerShellスクリプトを実行
   * Validates: Requirements 4.1
   */
  private async executePowerShellScript(params: PowerShellExecutionParams): Promise<SsmCommandResult> {
    const { instanceId, filePath, timeout = 30 } = params;

    console.log(`SSM PowerShell実行開始: instanceId=${instanceId}, filePath=${filePath}`);

    try {
      // PowerShellスクリプトを生成
      const script = this.generateGetAclScript(filePath);

      // SSM Run Commandを実行
      const sendCommand = new SendCommandCommand({
        InstanceIds: [instanceId],
        DocumentName: 'AWS-RunPowerShellScript',
        Parameters: {
          commands: [script],
        },
        TimeoutSeconds: timeout,
      });

      const startTime = Date.now();
      const sendResult = await this.ssmClient.send(sendCommand);
      const commandId = sendResult.Command?.CommandId;

      if (!commandId) {
        throw new Error('SSM Command ID not returned');
      }

      console.log(`SSM Command送信完了: commandId=${commandId}`);

      // コマンド実行完了を待機
      const result = await this.waitForCommandCompletion(commandId, instanceId, timeout);
      const executionTime = Date.now() - startTime;

      console.log(`SSM PowerShell実行完了: status=${result.status}, time=${executionTime}ms`);

      return {
        ...result,
        executionTime,
      };
    } catch (error) {
      console.error('SSM PowerShell実行エラー:', error);
      throw new Error(`SSM execution failed: ${error.message}`);
    }
  }

  /**
   * Get-AclコマンドレットのPowerShellスクリプトを生成
   * Validates: Requirements 4.2, 4.3
   */
  private generateGetAclScript(filePath: string): string {
    // ファイルパスをエスケープ
    const escapedPath = filePath.replace(/'/g, "''");

    // PowerShellスクリプト生成
    const script = `
$ErrorActionPreference = 'Stop'
try {
    $acl = Get-Acl -Path '${escapedPath}'
    $result = @{
        Owner = $acl.Owner
        Group = $acl.Group
        Access = @($acl.Access | ForEach-Object {
            @{
                IdentityReference = $_.IdentityReference.Value
                FileSystemRights = $_.FileSystemRights.ToString()
                AccessControlType = $_.AccessControlType.ToString()
                IsInherited = $_.IsInherited
                InheritanceFlags = $_.InheritanceFlags.ToString()
                PropagationFlags = $_.PropagationFlags.ToString()
            }
        })
    }
    $result | ConvertTo-Json -Depth 10 -Compress
} catch {
    Write-Error "Failed to get ACL: $_"
    exit 1
}
`.trim();

    console.log('PowerShellスクリプト生成完了');
    return script;
  }

  /**
   * SSM Commandの実行完了を待機
   */
  private async waitForCommandCompletion(
    commandId: string,
    instanceId: string,
    timeout: number
  ): Promise<SsmCommandResult> {
    const maxAttempts = Math.ceil(timeout / 2); // 2秒ごとにポーリング
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;

      const getCommand = new GetCommandInvocationCommand({
        CommandId: commandId,
        InstanceId: instanceId,
      });

      const result = await this.ssmClient.send(getCommand);
      const status = result.Status;

      if (status === 'Success') {
        return {
          commandId,
          status: 'Success',
          output: result.StandardOutputContent || '',
        };
      }

      if (status === 'Failed') {
        return {
          commandId,
          status: 'Failed',
          error: result.StandardErrorContent || 'Unknown error',
        };
      }

      if (status === 'TimedOut') {
        return {
          commandId,
          status: 'TimedOut',
          error: 'Command execution timed out',
        };
      }

      if (status === 'Cancelled') {
        return {
          commandId,
          status: 'Cancelled',
          error: 'Command was cancelled',
        };
      }

      // まだ実行中の場合は待機
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // タイムアウト
    return {
      commandId,
      status: 'TimedOut',
      error: 'Polling timeout exceeded',
    };
  }

  /**
   * PowerShell ACLレスポンスをパース
   * Validates: Requirements 4.4
   */
  private parsePowerShellAclResponse(output: string): PowerShellAclResponse {
    try {
      const parsed = JSON.parse(output);

      // 必須フィールドの検証
      if (!parsed.Owner || !parsed.Access || !Array.isArray(parsed.Access)) {
        throw new Error('Invalid ACL response format');
      }

      return {
        Owner: parsed.Owner,
        Group: parsed.Group || 'unknown',
        Access: parsed.Access.map((entry: any) => ({
          IdentityReference: entry.IdentityReference || '',
          FileSystemRights: entry.FileSystemRights || '',
          AccessControlType: entry.AccessControlType || 'Allow',
          IsInherited: entry.IsInherited || false,
          InheritanceFlags: entry.InheritanceFlags || 'None',
          PropagationFlags: entry.PropagationFlags || 'None',
        })),
      };
    } catch (error) {
      console.error('PowerShell ACLレスポンスのパースエラー:', error);
      throw new Error(`Failed to parse PowerShell ACL response: ${error.message}`);
    }
  }

  /**
   * ファイルレベルの詳細な権限を取得（SSM PowerShell使用）
   * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
   */
  async getDetailedFilePermissions(filePath: string): Promise<PowerShellAclResponse> {
    console.log(`詳細権限取得開始: filePath=${filePath}`);

    // AD EC2インスタンスIDの確認
    const instanceId = this.config.adEc2InstanceId || process.env.AD_EC2_INSTANCE_ID;
    if (!instanceId) {
      throw new Error('AD EC2 Instance ID not configured');
    }

    try {
      // SSM PowerShellスクリプトを実行
      const result = await this.executePowerShellScript({
        instanceId,
        filePath,
        timeout: this.config.ssmTimeout || 30,
      });

      // 実行結果の確認
      if (result.status !== 'Success') {
        console.error(`SSM実行失敗: status=${result.status}, error=${result.error}`);
        
        // タイムアウトの場合は特別なエラーをスロー（ONTAP REST APIへのフォールバック用）
        // Validates: Requirements 4.6
        if (result.status === 'TimedOut') {
          console.log('SSMタイムアウト検出、ONTAP REST APIにフォールバック');
          throw new Error('SSM_TIMEOUT_FALLBACK_TO_ONTAP');
        }
        
        throw new Error(`SSM execution failed: ${result.error}`);
      }

      // レスポンスをパース
      const aclResponse = this.parsePowerShellAclResponse(result.output || '');

      console.log(`詳細権限取得完了: ${aclResponse.Access.length}個のACLエントリ`);
      return aclResponse;
    } catch (error) {
      console.error('詳細権限取得エラー:', error);
      
      // エラーハンドリング: タイムアウトの場合はONTAP REST APIにフォールバック
      // Validates: Requirements 4.6
      if (error.message.includes('SSM_TIMEOUT_FALLBACK_TO_ONTAP')) {
        throw error;  // そのまま再スロー
      }

      throw error;
    }
  }

  /**
   * キャッシュから権限を取得
   */
  private getCachedPermissions(userId: string): DirectoryPermission[] | null {
    const cached = this.cache.get(userId);
    
    if (!cached) {
      return null;
    }

    // キャッシュの有効期限をチェック
    const now = Date.now();
    if (now - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(userId);
      return null;
    }

    return cached.data;
  }

  /**
   * 権限をキャッシュに保存
   */
  private setCachedPermissions(userId: string, permissions: DirectoryPermission[]): void {
    this.cache.set(userId, {
      data: permissions,
      timestamp: Date.now(),
    });
  }
}

// カスタムエラークラス
export class FsxUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FsxUnavailableError';
  }
}
