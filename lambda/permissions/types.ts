/**
 * FSx for ONTAPハイブリッド権限管理API - 型定義
 * 
 * このファイルは、権限管理システムで使用される全ての型定義を提供します。
 * 既存のAD自動連係・SID自動取得システムと統合し、ONTAP REST APIと
 * SSM PowerShellを組み合わせた権限チェック機能をサポートします。
 */

/**
 * ユーザーSID情報
 * 
 * user-access-tableから取得されるユーザーのSID情報を表します。
 * AD自動連係システムによって自動的に取得・更新されます。
 * 
 * @property userId - ユーザーID（プライマリキー）
 * @property SID - ユーザーとグループのSID配列 [userSID, groupSID1, groupSID2, ...]
 * @property userSID - 個人SID（S-1-5-21-xxx-xxx-xxx-xxxx形式）
 * @property displayName - 表示名（オプション）
 * @property email - メールアドレス（オプション）
 * @property samAccountName - SAMアカウント名（オプション）
 * @property memberOf - 所属グループのDN配列（オプション）
 * @property groups - グループ情報の配列（オプション）
 * @property source - データソース（Lambda-AD | Fallback | Demo）
 * @property createdAt - 作成日時（ISO 8601形式）
 * @property updatedAt - 更新日時（ISO 8601形式）
 * @property lastADSync - 最終AD同期日時（オプション、ISO 8601形式）
 * @property uid - NFS用のUID（オプション）
 * @property gid - NFS用のGID（オプション）
 * @property unixGroups - NFS用のグループ情報配列（オプション）
 */
export interface UserSIDInfo {
  userId: string;
  SID: string[];
  userSID: string;
  displayName?: string;
  email?: string;
  samAccountName?: string;
  memberOf?: string[];
  groups?: Array<{
    Name: string;
    SID: string;
  }>;
  source: 'Lambda-AD' | 'Fallback' | 'Demo';
  createdAt: string;
  updatedAt: string;
  lastADSync?: string;
  uid?: number;
  gid?: number;
  unixGroups?: Array<{
    name: string;
    gid: number;
  }>;
}



/**
 * ディレクトリ権限
 * 
 * 特定のパスに対する権限情報を表します。
 * 
 * @property path - ファイルパスまたはディレクトリパス
 * @property permissions - 権限リスト（read | write）
 * @property owner - 所有者（SIDまたはアカウント名）
 * @property group - グループ（SIDまたはグループ名）
 */
export interface DirectoryPermission {
  path: string;
  permissions: ('read' | 'write')[];
  owner: string;
  group: string;
}

/**
 * 統合権限情報
 * 
 * 既存のUnifiedPermissions型と互換性を保ちながら、
 * FSx for ONTAPの権限情報を統合したレスポンス型です。
 * 
 * @property userId - ユーザーID
 * @property userName - ユーザー名
 * @property role - ロール
 * @property permissionLevel - 権限レベル
 * @property department - 部署（オプション）
 * @property applicationPermissions - アプリケーション権限リスト
 * @property accessibleDirectories - アクセス可能なディレクトリリスト
 * @property timeRestrictions - 時間制限
 * @property geographicRestrictions - 地理的制限
 * @property overallAccess - 全体的なアクセス権限
 * @property sidInfo - SID情報
 */
export interface UnifiedPermissions {
  userId: string;
  userName: string;
  role: string;
  permissionLevel: 'admin' | 'emergency' | 'security' | 'system' | 'project' | 'basic';
  department?: string;
  applicationPermissions: string[];
  accessibleDirectories: DirectoryPermission[];
  timeRestrictions: {
    allowedHours?: string;
    timezone?: string;
  };
  geographicRestrictions: {
    allowedRegions?: string[];
    deniedRegions?: string[];
  };
  overallAccess: {
    canRead: boolean;
    canWrite: boolean;
    canDelete: boolean;
    canAdmin: boolean;
  };
  sidInfo: {
    userSID: string;
    groupSIDs: string[];
    groups: Array<{
      Name: string;
      SID: string;
    }>;
  };
}

/**
 * ONTAP ACLレコード
 * 
 * ONTAP REST APIから返されるACLレコードの型定義です。
 * 
 * @property user_or_group - ユーザーまたはグループのSID
 * @property permission - 権限レベル（full_control | change | read | no_access）
 * @property type - ACLタイプ（allow | deny）
 */
export interface OntapAclRecord {
  user_or_group: string;
  permission: 'full_control' | 'change' | 'read' | 'no_access';
  type?: 'allow' | 'deny';
}

/**
 * ONTAP ACLレスポンス
 * 
 * ONTAP REST API `/api/protocols/cifs/shares/{svm}/{share}/acls` のレスポンス型です。
 * 
 * @property records - ACLレコードの配列
 * @property num_records - レコード数
 */
export interface OntapAclResponse {
  records: OntapAclRecord[];
  num_records: number;
}

/**
 * PowerShell ACLエントリ
 * 
 * PowerShell Get-Aclコマンドから返されるACLエントリの型定義です。
 * 
 * @property IdentityReference - ユーザーまたはグループのSID
 * @property FileSystemRights - ファイルシステム権限
 * @property AccessControlType - アクセス制御タイプ（Allow | Deny）
 * @property IsInherited - 継承フラグ
 * @property InheritanceFlags - 継承フラグ
 * @property PropagationFlags - 伝播フラグ
 */
export interface PowerShellAclEntry {
  IdentityReference: string;
  FileSystemRights: string;
  AccessControlType: 'Allow' | 'Deny';
  IsInherited: boolean;
  InheritanceFlags: string;
  PropagationFlags: string;
}

/**
 * PowerShell ACLレスポンス
 * 
 * PowerShell Get-Aclコマンドから返されるACL情報の型定義です。
 * 
 * @property Owner - 所有者のSIDまたはアカウント名
 * @property Group - グループのSIDまたはグループ名
 * @property Access - ACLエントリの配列
 */
export interface PowerShellAclResponse {
  Owner: string;
  Group: string;
  Access: PowerShellAclEntry[];
}

/**
 * 計算された権限
 * 
 * SIDマッチングと権限計算の結果を表します。
 * 
 * @property read - 読み取り権限
 * @property write - 書き込み権限
 * @property admin - 管理者権限
 */
export interface CalculatedPermissions {
  read: boolean;
  write: boolean;
  admin: boolean;
}

/**
 * キャッシュエントリ
 * 
 * DynamoDBに保存される権限キャッシュのエントリです。
 * 
 * @property cacheKey - キャッシュキー（userId:path形式）
 * @property userId - ユーザーID
 * @property path - ファイルパスまたはShare名
 * @property permissions - キャッシュされた権限情報
 * @property ttl - TTL（Unix timestamp、秒単位）
 * @property createdAt - 作成日時（ISO 8601形式）
 */
export interface PermissionCacheEntry {
  cacheKey: string;
  userId: string;
  path: string;
  permissions: UnifiedPermissions;
  ttl: number;
  createdAt: string;
}

/**
 * Share パス情報
 * 
 * パスからSVMとShare名を抽出した結果を表します。
 * 
 * @property svm - SVM名
 * @property share - Share名
 * @property subPath - Share内のサブパス（オプション）
 */
export interface SharePathInfo {
  svm: string;
  share: string;
  subPath?: string;
}

/**
 * ONTAP認証情報
 * 
 * Secrets Managerから取得されるONTAP認証情報です。
 * 
 * @property username - ユーザー名
 * @property password - パスワード
 */
export interface OntapCredentials {
  username: string;
  password: string;
}

/**
 * SSMコマンド結果
 * 
 * SSM Run Commandの実行結果を表します。
 * 
 * @property commandId - コマンドID
 * @property status - ステータス（Success | Failed | TimedOut | Cancelled）
 * @property output - 標準出力
 * @property error - 標準エラー出力（オプション）
 * @property executionTime - 実行時間（ミリ秒、オプション）
 */
export interface SsmCommandResult {
  commandId: string;
  status: 'Success' | 'Failed' | 'TimedOut' | 'Cancelled';
  output?: string;
  error?: string;
  executionTime?: number;
}

/**
 * PowerShellスクリプトの実行パラメータ
 */
export interface PowerShellExecutionParams {
  instanceId: string;
  filePath: string;
  timeout?: number;  // タイムアウト（秒）、デフォルト: 30
}



/**
 * 詳細チェック判定結果
 */
export interface DetailedCheckDecision {
  required: boolean;            // 詳細チェックが必要かどうか
  reason: string;               // 判定理由
  method: 'ontap-only' | 'ssm-powershell' | 'hybrid';  // 使用する権限チェック方法
}

/**
 * キャッシュ設定
 * 
 * キャッシュ機能の設定を表します。
 * 
 * @property enabled - キャッシュ機能の有効/無効
 * @property ttlMinutes - TTL（分）、デフォルト: 5分
 * @property tableName - DynamoDBテーブル名
 */
export interface CacheConfig {
  enabled: boolean;
  ttlMinutes: number;
  tableName: string;
}

/**
 * キャッシュエントリ（詳細版）
 * 
 * DynamoDBに保存される権限キャッシュの詳細エントリです。
 * 
 * @property cacheKey - キャッシュキー（userId:path形式）
 * @property userId - ユーザーID
 * @property path - ファイルパスまたはShare名
 * @property permissions - キャッシュされた権限情報
 * @property timestamp - キャッシュ作成時刻（Unix timestamp、秒単位）
 * @property ttl - TTL（Unix timestamp、秒単位）
 * @property source - 権限情報の取得元
 */
export interface CacheEntry {
  cacheKey: string;
  userId: string;
  path: string;
  permissions: DirectoryPermission[];
  timestamp: number;
  ttl: number;
  source: 'ontap-api' | 'ssm-powershell';
}

/**
 * キャッシュ操作結果
 * 
 * キャッシュ操作の結果を表します。
 * 
 * @property success - 操作成功フラグ
 * @property data - 取得されたデータ（オプション）
 * @property error - エラーメッセージ（オプション）
 * @property fromCache - キャッシュからの取得かどうか
 */
export interface CacheResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  fromCache: boolean;
}

/**
 * NFSエクスポートポリシールール
 * 
 * ONTAP REST APIから返されるNFSエクスポートポリシールールの型定義です。
 * 
 * @property clients - クライアントマッチパターン（IPアドレス、ホスト名、ネットグループ等）
 * @property ro_rule - 読み取り専用ルール（sys | krb5 | krb5i | krb5p | none | never | any）
 * @property rw_rule - 読み書きルール（sys | krb5 | krb5i | krb5p | none | never | any）
 * @property superuser - スーパーユーザールール（sys | krb5 | krb5i | krb5p | none | any）
 * @property anonymous_user - 匿名ユーザーのUID（デフォルト: 65534）
 */
export interface NfsExportPolicyRule {
  clients: Array<{ match: string }>;
  ro_rule: string[];
  rw_rule: string[];
  superuser: string[];
  anonymous_user?: string;
}

/**
 * NFSエクスポートポリシー
 * 
 * ONTAP REST APIから返されるNFSエクスポートポリシーの型定義です。
 * 
 * @property name - エクスポートポリシー名
 * @property id - エクスポートポリシーID
 * @property rules - エクスポートポリシールールの配列
 */
export interface NfsExportPolicy {
  name: string;
  id: number;
  rules: NfsExportPolicyRule[];
}

/**
 * NFSエクスポートポリシーレスポンス
 * 
 * ONTAP REST API `/api/protocols/nfs/export-policies` のレスポンス型です。
 * 
 * @property records - エクスポートポリシーの配列
 * @property num_records - レコード数
 */
export interface NfsExportPolicyResponse {
  records: NfsExportPolicy[];
  num_records: number;
}

/**
 * POSIX権限
 * 
 * POSIX権限モデルに基づく権限情報を表します。
 * 
 * @property owner - 所有者権限（rwx形式）
 * @property group - グループ権限（rwx形式）
 * @property other - その他のユーザー権限（rwx形式）
 * @property mode - 8進数表記の権限モード（例: 0755）
 */
export interface PosixPermissions {
  owner: {
    read: boolean;
    write: boolean;
    execute: boolean;
  };
  group: {
    read: boolean;
    write: boolean;
    execute: boolean;
  };
  other: {
    read: boolean;
    write: boolean;
    execute: boolean;
  };
  mode: string;
}

/**
 * プロトコルタイプ
 * 
 * サポートされるファイルアクセスプロトコルを表します。
 */
export type ProtocolType = 'SMB' | 'NFS' | 'BOTH';

/**
 * 権限チェックコンテキスト（拡張版）
 * 
 * 権限チェックリクエストのコンテキスト情報を表します。
 * NFSプロトコル対応を含みます。
 * 
 * @property userId - ユーザーID
 * @property path - チェック対象のパス
 * @property protocol - 使用するプロトコル（SMB | NFS | BOTH）
 * @property detailedCheck - 詳細チェックを強制するフラグ（オプション）
 * @property checkInheritance - 継承権限をチェックするフラグ（オプション）
 * @property checkDeny - 拒否権限をチェックするフラグ（オプション）
 */
export interface PermissionCheckContext {
  userId: string;
  path: string;
  protocol?: ProtocolType;
  detailedCheck?: boolean;
  checkInheritance?: boolean;
  checkDeny?: boolean;
}
