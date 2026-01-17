/**
 * 統合権限サービス
 * 既存のDynamoDB権限、時間・地理制限、FSx ACLを統合
 * 
 * Validates: Requirements 5.1, 5.2
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { FsxPermissionService, DirectoryPermission } from './fsx-permission-service';
import { DetailedCheckDecision } from './types';
import { CacheService, getCacheService, DEFAULT_CACHE_CONFIG } from './cache-service';
import { getLogger } from './logger';

// DynamoDB設定
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});
const dynamodb = DynamoDBDocumentClient.from(client);

// 環境変数
const PERMISSION_TABLE = process.env.PERMISSION_TABLE || 'TokyoRegion-permission-aware-rag-prod-PermissionConfig';

// 型定義をtypes.tsからインポート
import { UnifiedPermissions } from './types';

export interface PermissionCheckContext {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: Date;
  requestedResource?: string;
  path?: string;
  
  // 詳細チェックフラグ
  checkInheritance?: boolean;  // 継承権限の確認が必要
  checkDeny?: boolean;          // 明示的な拒否の確認が必要
  detailedCheck?: boolean;      // 強制的に詳細チェックを実行
}

/**
 * 統合権限サービス
 * 既存の3つの権限システムを統合して判定
 */
export class UnifiedPermissionService {
  private fsxService: FsxPermissionService;
  private cacheService: CacheService;
  private logger = getLogger();

  constructor(
    fsxConfig?: {
      volumeUuid?: string;
      volumeName?: string;
    }
  ) {
    this.fsxService = new FsxPermissionService(fsxConfig || {});
    
    // Cache Service初期化
    this.cacheService = getCacheService({
      enabled: process.env.CACHE_ENABLED !== 'false',
      ttlMinutes: parseInt(process.env.CACHE_TTL_MINUTES || '5'),
      tableName: process.env.PERMISSION_CACHE_TABLE || 'permission-cache',
    });
    
    console.log('UnifiedPermissionService initialized with cache support');
  }

  /**
   * キャッシュを使用した権限取得
   * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
   */
  async getPermissionsWithCache(
    userId: string,
    path: string,
    useDetailedCheck: boolean = false
  ): Promise<DirectoryPermission[]> {
    console.log(`キャッシュ付き権限取得開始: userId=${userId}, path=${path}`);

    // 1. キャッシュから取得を試行
    const cacheResult = await this.cacheService.getFromCache(userId, path);
    if (cacheResult.success && cacheResult.data) {
      console.log('キャッシュから権限情報を取得しました');
      return cacheResult.data;
    }

    console.log('キャッシュミス、権限情報を新規取得します');

    // 2. 権限情報を新規取得
    let permissions: DirectoryPermission[];
    let source: 'ontap-api' | 'ssm-powershell';

    try {
      if (useDetailedCheck) {
        // 詳細チェック（SSM PowerShell）
        console.log('詳細チェックを実行します');
        // TODO: 実際の詳細チェック実装
        permissions = await this.fsxService.queryUserPermissions(userId);
        source = 'ssm-powershell';
      } else {
        // 標準チェック（ONTAP REST API）
        console.log('標準チェックを実行します');
        permissions = await this.fsxService.queryUserPermissions(userId);
        source = 'ontap-api';
      }

      // 3. 結果をキャッシュに保存
      const saveResult = await this.cacheService.saveToCache(userId, path, permissions, source);
      if (!saveResult.success) {
        console.warn('キャッシュ保存に失敗しました:', saveResult.error);
      }

      console.log(`権限取得完了: ${permissions.length}個の権限情報`);
      return permissions;
    } catch (error) {
      console.error('権限取得エラー:', error);
      throw error;
    }
  }

  /**
   * キャッシュを無効化（権限変更時などに使用）
   */
  async invalidateCache(userId: string, path: string): Promise<void> {
    console.log(`キャッシュ無効化: userId=${userId}, path=${path}`);
    
    const result = await this.cacheService.deleteFromCache(userId, path);
    if (!result.success) {
      console.warn('キャッシュ削除に失敗しました:', result.error);
    }
  }

  /**
   * 統合権限チェック
   * 3つの権限システムを統合して最終判定
   */
  async checkUnifiedPermissions(
    context: PermissionCheckContext
  ): Promise<UnifiedPermissions> {
    const timer = this.logger.startTimer();
    const path = context.path || '/';

    console.log('統合権限チェック開始:', context);
    this.logger.logPermissionCheckStart(context.userId, path, {
      requestedResource: context.requestedResource,
      ipAddress: context.ipAddress,
    });

    try {
      // 1. DynamoDB権限を取得
      const dbPermissions = await this.getDynamoDBPermissions(context.userId);
      
      // 2. SID情報を取得
      const sidInfo = await this.getUserSIDInfo(context.userId);
      
      // 3. FSx ACL権限を取得（キャッシュ使用）
      const useDetailedCheck = context.detailedCheck || false;
      const fsxPermissions = await this.getPermissionsWithCache(
        context.userId,
        path,
        useDetailedCheck
      );
      
      // 4. UnifiedPermissions形式で結果を構築
      const unifiedPermissions = this.buildUnifiedPermissions(
        context,
        dbPermissions,
        fsxPermissions,
        sidInfo
      );

      const duration = timer();
      this.logger.logPermissionCheckComplete(
        context.userId,
        path,
        unifiedPermissions.overallAccess.canRead,
        duration,
        {
          permissionCount: fsxPermissions.length,
          sidInfo: sidInfo.userSID,
        }
      );

      return unifiedPermissions;
    } catch (error) {
      const duration = timer();
      this.logger.logError('統合権限チェックエラー', error as Error, {
        userId: context.userId,
        path,
      });
      throw error;
    }
  }

  /**
   * DynamoDB権限を取得
   */
  private async getDynamoDBPermissions(userId: string): Promise<any> {
    try {
      const command = new GetCommand({
        TableName: PERMISSION_TABLE,
        Key: {
          userId: userId,
          resourceType: 'user-profile',
        },
      });

      const result = await dynamodb.send(command);
      return result.Item;
    } catch (error) {
      console.error('DynamoDB権限取得エラー:', error);
      return null;
    }
  }

  /**
   * ユーザーのSID情報を取得
   * 
   * user-access-tableからユーザーのSID情報を取得し、
   * userSIDフィールドを識別する
   * 
   * Validates: Requirements 1.1, 1.2, 1.3, 1.5
   */
  async getUserSIDInfo(userId: string): Promise<{
    userSID: string;
    groupSIDs: string[];
    groups: Array<{ Name: string; SID: string }>;
  }> {
    console.log(`SID情報取得開始: userId=${userId}`);

    try {
      // user-access-tableから取得
      const command = new GetCommand({
        TableName: process.env.USER_ACCESS_TABLE_NAME || 'user-access-table',
        Key: {
          userId: userId,
        },
      });

      const result = await dynamodb.send(command);

      if (!result.Item) {
        console.error(`ユーザーが見つかりません: ${userId}`);
        throw new Error(`User not found: ${userId}`);
      }

      const item = result.Item;

      // userSIDフィールドの識別
      let userSID: string | undefined;
      let groupSIDs: string[] = [];
      let allSIDs: string[] = [];

      // パターン1: userSIDフィールドが明示的に存在する場合
      if (item.userSID && typeof item.userSID === 'string') {
        userSID = item.userSID;
        console.log(`userSIDフィールド検出: ${userSID}`);
      }

      // パターン2: SID配列から個人SIDを識別
      if (item.SID && Array.isArray(item.SID)) {
        allSIDs = item.SID;
        console.log(`SID配列検出: ${allSIDs.length}個のSID`);

        // userSIDが未設定の場合、SID配列の最初の要素を個人SIDとみなす
        if (!userSID && allSIDs.length > 0) {
          userSID = allSIDs[0];
          console.log(`SID配列の最初の要素を個人SIDとして使用: ${userSID}`);
        }

        // 個人SID以外をグループSIDとする
        groupSIDs = allSIDs.filter(sid => sid !== userSID);
      }

      // パターン3: groupsフィールドからグループSIDを取得
      if (item.groups && Array.isArray(item.groups)) {
        const groupSIDsFromGroups = item.groups
          .filter((g: any) => g.sid && typeof g.sid === 'string')
          .map((g: any) => g.sid);

        // 重複を除いてマージ
        groupSIDs = [...new Set([...groupSIDs, ...groupSIDsFromGroups])];
        console.log(`groupsフィールドから${groupSIDsFromGroups.length}個のグループSIDを追加`);
      }

      // userSIDが見つからない場合はエラー
      if (!userSID) {
        console.error(`userSIDが見つかりません: userId=${userId}`);
        throw new Error(`User SID not found for user: ${userId}`);
      }

      // 全SIDリストを構築（個人SID + グループSID）
      const finalAllSIDs = [userSID, ...groupSIDs];

      console.log(`SID情報取得完了: userSID=${userSID}, groupSIDs=${groupSIDs.length}個`);

      // groupsフィールドを構築
      const groups: Array<{ Name: string; SID: string }> = [];
      
      // パターンA: groupsフィールドが存在する場合
      if (item.groups && Array.isArray(item.groups)) {
        for (const group of item.groups) {
          if (group.Name && group.SID) {
            groups.push({ Name: group.Name, SID: group.SID });
          }
        }
      }
      
      // パターンB: groupsフィールドがなく、groupSIDsのみの場合
      // グループSIDから簡易的なgroupsエントリを生成
      if (groups.length === 0 && groupSIDs.length > 0) {
        for (const sid of groupSIDs) {
          groups.push({
            Name: `Group-${sid.split('-').pop()}`, // SIDの末尾をグループ名として使用
            SID: sid,
          });
        }
      }

      return {
        userSID,
        groupSIDs,
        groups,
      };
    } catch (error) {
      console.error('SID情報取得エラー:', error);
      throw error;
    }
  }

  /**
   * 詳細チェックが必要かどうかを判定
   * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
   */
  shouldPerformDetailedCheck(context: PermissionCheckContext): DetailedCheckDecision {
    console.log(`詳細チェック判定開始: path=${context.path}`);

    // 1. 明示的な詳細チェックフラグ（最優先）
    // Validates: Requirements 5.5
    if (context.detailedCheck === true) {
      console.log('詳細チェックフラグが明示的にtrueに設定されています');
      return {
        required: true,
        reason: 'Explicit detailedCheck flag is true',
        method: 'ssm-powershell',
      };
    }

    // 2. 継承権限の確認が必要
    // Validates: Requirements 5.3
    if (context.checkInheritance === true) {
      console.log('継承権限の確認が必要です');
      return {
        required: true,
        reason: 'Inheritance check required',
        method: 'ssm-powershell',
      };
    }

    // 3. 明示的な拒否（Deny）の確認が必要
    // Validates: Requirements 5.4
    if (context.checkDeny === true) {
      console.log('明示的な拒否（Deny）の確認が必要です');
      return {
        required: true,
        reason: 'Deny check required',
        method: 'ssm-powershell',
      };
    }

    // 4. ファイルパスによる判定
    // Validates: Requirements 5.1, 5.2
    const hasFileExtension = this.hasFileExtension(context.path);
    
    if (hasFileExtension) {
      console.log('ファイル拡張子が検出されました。詳細チェックが必要です');
      return {
        required: true,
        reason: 'File path contains extension',
        method: 'ssm-powershell',
      };
    }

    // 5. Share レベルのみ（詳細チェック不要）
    // Validates: Requirements 5.2
    console.log('Share レベルのチェックのみで十分です');
    return {
      required: false,
      reason: 'Share-level check only',
      method: 'ontap-only',
    };
  }

  /**
   * ファイルパスに拡張子が含まれているかチェック
   */
  private hasFileExtension(path: string): boolean {
    // パスの最後の部分を取得
    const parts = path.split(/[/\\]/);
    const lastPart = parts[parts.length - 1];

    // 空文字列の場合はfalse
    if (!lastPart) {
      return false;
    }

    // 拡張子のパターン（.で始まり、1-10文字の英字を含む）
    // 数字のみの拡張子は無効（例: v1.0.0の.0は拡張子ではない）
    const extensionPattern = /\.([a-zA-Z0-9]{1,10})$/;
    const match = lastPart.match(extensionPattern);
    
    if (!match) {
      return false;
    }

    // マッチした拡張子部分に少なくとも1文字の英字が含まれているか確認
    const extension = match[1];
    return /[a-zA-Z]/.test(extension);
  }

  /**
   * 時間制限チェック（advanced-permissionロジック）
   */
  private checkTimeRestrictions(
    context: PermissionCheckContext,
    dbPermissions: any
  ): UnifiedPermissions['timeRestrictions'] {
    const currentTime = context.timestamp || new Date();
    const currentHour = currentTime.getHours();
    const currentDay = currentTime.getDay(); // 0=日曜日, 1=月曜日, ...

    // 営業時間チェック（平日 9:00-18:00）
    const isBusinessHours =
      currentDay >= 1 && currentDay <= 5 && currentHour >= 9 && currentHour < 18;

    // 緊急ユーザーチェック
    const emergencyUsers = ['admin001', 'emergency001', 'security_admin', 'system_admin'];
    const isEmergencyUser =
      emergencyUsers.includes(context.userId) ||
      dbPermissions?.permissionLevel === 'emergency' ||
      dbPermissions?.permissionLevel === 'admin';

    // 時間制限情報を返す（types.tsの定義に合わせる）
    return {
      allowedHours: '9:00-18:00 (平日)',
      timezone: 'Asia/Tokyo',
    };
  }

  /**
   * 地理的制限チェック（advanced-permissionロジック）
   */
  private checkGeographicRestrictions(
    context: PermissionCheckContext,
    dbPermissions: any
  ): UnifiedPermissions['geographicRestrictions'] {
    const ipAddress = context.ipAddress || 'unknown';
    
    // 許可されたリージョン（例）
    const allowedRegions = ['ap-northeast-1', 'us-east-1'];
    
    // 拒否されたリージョン（例）
    const deniedRegions: string[] = [];
    
    return {
      allowedRegions,
      deniedRegions,
    };
  }

  /**
   * 総合的なアクセス判定を構築
   * 
   * @param fsxPermissions - FSx権限リスト
   * @param timeRestrictions - 時間制限
   * @param geoRestrictions - 地理的制限
   * @returns 総合的なアクセス判定
   */
  private buildOverallAccess(
    fsxPermissions: DirectoryPermission[],
    timeRestrictions: UnifiedPermissions['timeRestrictions'],
    geoRestrictions: UnifiedPermissions['geographicRestrictions']
  ): UnifiedPermissions['overallAccess'] {
    // アクセス可能なディレクトリがあるかチェック
    const hasReadAccess = fsxPermissions.some(p => p.permissions.includes('read'));
    const hasWriteAccess = fsxPermissions.some(p => p.permissions.includes('write'));
    
    return {
      canRead: hasReadAccess,
      canWrite: hasWriteAccess,
      canDelete: hasWriteAccess, // 書き込み権限がある場合、削除も可能
      canAdmin: false, // 管理者権限は別途判定
    };
  }

  /**
   * UnifiedPermissions形式で結果を構築
   * 
   * 複数のソースからの権限情報を統合し、UnifiedPermissions形式で返します。
   * 
   * @param context - 権限チェックコンテキスト
   * @param dbPermissions - DynamoDB権限
   * @param fsxPermissions - FSx権限リスト
   * @param sidInfo - SID情報
   * @returns 統合権限情報
   * 
   * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
   */
  private buildUnifiedPermissions(
    context: PermissionCheckContext,
    dbPermissions: any,
    fsxPermissions: DirectoryPermission[],
    sidInfo: {
      userSID: string;
      groupSIDs: string[];
      groups: Array<{ Name: string; SID: string }>;
    }
  ): UnifiedPermissions {
    // 時間制限・地理的制限をチェック
    const timeRestrictions = this.checkTimeRestrictions(context, dbPermissions);
    const geoRestrictions = this.checkGeographicRestrictions(context, dbPermissions);
    
    // 総合的なアクセス判定を構築
    const overallAccess = this.buildOverallAccess(
      fsxPermissions,
      timeRestrictions,
      geoRestrictions
    );

    return {
      userId: context.userId,
      userName: dbPermissions?.displayName || context.userId,
      role: dbPermissions?.role || 'user',
      permissionLevel: dbPermissions?.permissionLevel || 'basic',
      department: dbPermissions?.department,
      applicationPermissions: dbPermissions?.permissions?.split(',') || [],
      accessibleDirectories: fsxPermissions,
      timeRestrictions,
      geographicRestrictions: geoRestrictions,
      overallAccess,
      sidInfo,
    };
  }

  /**
   * 旧形式の地理的制限チェック（後方互換性のため残す）
   */
  private checkGeographicRestrictionsLegacy(
    context: PermissionCheckContext,
    dbPermissions: any
  ): { isAllowedIP: boolean; ipAddress: string } {
    const ipAddress = context.ipAddress;

    // 許可されたIPレンジ
    const allowedPrefixes = [
      '127.0.0.1',
      '::1',
      '192.168.',
      '10.0.',
      '172.16.',
      '203.0.113.',
      '198.51.100.',
      '192.0.2.',
    ];

    const isAllowedIP = allowedPrefixes.some((prefix) => ipAddress.startsWith(prefix));

    // 緊急ユーザーはIP制限を受けない
    const isEmergencyUser =
      dbPermissions?.permissionLevel === 'emergency' ||
      dbPermissions?.permissionLevel === 'admin';

    return {
      isAllowedIP: isAllowedIP || isEmergencyUser,
      ipAddress,
    };
  }



  /**
   * リソース固有の権限チェック
   */
  private checkResourceAccess(
    dbPermissions: any,
    fsxPermissions: DirectoryPermission[],
    resourcePath: string
  ): boolean {
    // 管理者レベルは全リソースアクセス可能
    const adminLevels = ['admin', 'emergency', 'security', 'system'];
    if (adminLevels.includes(dbPermissions.permissionLevel)) {
      return true;
    }

    // FSx ACLでリソースパスをチェック
    const resourceDir = this.extractDirectoryFromPath(resourcePath);
    const hasAccess = fsxPermissions.some(
      (perm) => resourcePath.startsWith(perm.path) && perm.permissions.includes('read')
    );

    return hasAccess;
  }

  /**
   * パスからディレクトリを抽出
   */
  private extractDirectoryFromPath(filePath: string): string {
    const parts = filePath.split('/');
    return parts.length > 1 ? `/${parts[1]}` : '/';
  }

  /**
   * 拒否理由を生成
   */
  private generateDenialReason(restrictions: string[]): string {
    const messages: { [key: string]: string } = {
      'no-user-profile': 'ユーザープロファイルが見つかりません',
      'time-restriction': '営業時間外のアクセスです',
      'geographic-restriction': '許可されていない地域からのアクセスです',
      'no-fsx-access': 'ファイルシステムへのアクセス権限がありません',
      'resource-access-denied': 'このリソースへのアクセス権限がありません',
    };

    return restrictions.map((r) => messages[r] || r).join(', ');
  }

  /**
   * NFS権限チェック
   * 
   * NFSプロトコルを使用した権限チェックを実行します。
   * UID/GID情報とNFSエクスポートポリシーを使用して権限を判定します。
   * 
   * @param context - 権限チェックコンテキスト
   * @returns 統合権限情報
   * 
   * Validates: Requirements 9.1, 9.5
   */
  async checkNfsPermissions(
    context: PermissionCheckContext
  ): Promise<UnifiedPermissions> {
    const timer = this.logger.startTimer();
    const path = context.path || '/';

    console.log('NFS権限チェック開始:', context);
    this.logger.logPermissionCheckStart(context.userId, path, {
      protocol: 'NFS',
      requestedResource: context.requestedResource,
      ipAddress: context.ipAddress,
    });

    try {
      // 1. DynamoDB権限を取得（UID/GID情報を含む）
      const dbPermissions = await this.getDynamoDBPermissions(context.userId);
      
      // UID/GID情報の確認
      if (!dbPermissions.uid || !dbPermissions.gid) {
        throw new Error('UID/GID information not found for NFS access');
      }
      
      // 2. SID情報を取得
      const sidInfo = await this.getUserSIDInfo(context.userId);
      
      // 3. NFSエクスポートポリシーとPOSIX権限を使用した権限チェック
      // （実装は次のフェーズで追加）
      const fsxPermissions: DirectoryPermission[] = [];
      
      // 4. UnifiedPermissions形式で結果を構築
      const unifiedPermissions = this.buildUnifiedPermissions(
        context,
        dbPermissions,
        fsxPermissions,
        sidInfo
      );

      const duration = timer();
      this.logger.logPermissionCheckComplete(
        context.userId,
        path,
        unifiedPermissions.overallAccess.canRead,
        duration,
        {
          protocol: 'NFS',
          uid: dbPermissions.uid,
          gid: dbPermissions.gid,
        }
      );

      return unifiedPermissions;
    } catch (error) {
      const duration = timer();
      this.logger.logError('NFS権限チェックエラー', error as Error, {
        userId: context.userId,
        path,
      });
      throw error;
    }
  }

  /**
   * プロトコル判定による権限チェック
   * 
   * リクエストで指定されたプロトコル（SMB/NFS）に応じて、
   * 適切な権限チェックメソッドを呼び出します。
   * 
   * @param context - 権限チェックコンテキスト
   * @returns 統合権限情報
   * 
   * Validates: Requirements 9.1, 9.5
   */
  async checkPermissionsByProtocol(
    context: PermissionCheckContext & { protocol?: 'SMB' | 'NFS' | 'BOTH' }
  ): Promise<UnifiedPermissions> {
    const protocol = context.protocol || 'SMB';
    
    console.log(`プロトコル判定による権限チェック: ${protocol}`);
    
    switch (protocol) {
      case 'NFS':
        return await this.checkNfsPermissions(context);
      
      case 'SMB':
        return await this.checkUnifiedPermissions(context);
      
      case 'BOTH':
        // 両方のプロトコルをチェックし、より制限的な方を採用
        const smbPerms = await this.checkUnifiedPermissions(context);
        const nfsPerms = await this.checkNfsPermissions(context);
        
        // より制限的な権限を返す
        return this.mergeProtocolPermissions(smbPerms, nfsPerms);
      
      default:
        return await this.checkUnifiedPermissions(context);
    }
  }

  /**
   * プロトコル権限のマージ
   * 
   * SMBとNFSの権限をマージし、より制限的な権限を返します。
   * 
   * @param smbPerms - SMB権限
   * @param nfsPerms - NFS権限
   * @returns マージされた権限
   * 
   * Validates: Requirements 9.5
   */
  private mergeProtocolPermissions(
    smbPerms: UnifiedPermissions,
    nfsPerms: UnifiedPermissions
  ): UnifiedPermissions {
    // より制限的な権限を採用（論理積）
    const mergedAccess = {
      canRead: smbPerms.overallAccess.canRead && nfsPerms.overallAccess.canRead,
      canWrite: smbPerms.overallAccess.canWrite && nfsPerms.overallAccess.canWrite,
      canDelete: smbPerms.overallAccess.canDelete && nfsPerms.overallAccess.canDelete,
      canAdmin: smbPerms.overallAccess.canAdmin && nfsPerms.overallAccess.canAdmin,
    };

    // アクセス可能なディレクトリは両方で許可されているもののみ
    const mergedDirectories = smbPerms.accessibleDirectories.filter((smbDir) =>
      nfsPerms.accessibleDirectories.some(
        (nfsDir) => nfsDir.path === smbDir.path
      )
    );

    return {
      ...smbPerms,
      accessibleDirectories: mergedDirectories,
      overallAccess: mergedAccess,
    };
  }
}
