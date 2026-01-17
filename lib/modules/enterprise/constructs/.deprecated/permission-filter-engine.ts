/**
 * 権限フィルタリングエンジン
 * 
 * OpenSearch検索結果に対するリアルタイム権限フィルタリング
 */

import { UserPermission, DocumentPermission, PermissionFilterConfig, AccessControlResult } from '../interfaces/permission-config';

export class PermissionFilterEngine {
  private config: PermissionFilterConfig;
  private permissionCache: Map<string, any> = new Map();

  constructor(config: PermissionFilterConfig) {
    this.config = config;
  }

  /**
   * ユーザー権限に基づくOpenSearch検索クエリフィルター生成
   */
  public generateSearchFilter(userPermission: UserPermission): any {
    if (!this.config.enabled) {
      return {}; // 権限チェック無効時は制限なし
    }

    // 管理者バイパス
    if (this.config.adminBypass && userPermission.roleLevel === 'admin') {
      return {};
    }

    // 複合フィルター構築
    const filters: any[] = [];

    // 1. ユーザーベースフィルター
    filters.push({
      terms: {
        'user_permissions': [userPermission.userId, 'public', 'all']
      }
    });

    // 2. 組織ベースフィルター
    filters.push({
      terms: {
        'allowed_organizations': [userPermission.organization, 'public', 'all']
      }
    });

    // 3. 部署ベースフィルター（部署が指定されている場合）
    if (userPermission.department) {
      filters.push({
        terms: {
          'allowed_departments': [userPermission.department, 'public', 'all']
        }
      });
    }

    // 4. 役職レベルフィルター
    const roleHierarchy = this.getRoleHierarchy(userPermission.roleLevel);
    filters.push({
      terms: {
        'required_role_level': roleHierarchy
      }
    });

    // 5. データ分類レベルフィルター
    const accessibleClassifications = this.getAccessibleClassifications(userPermission.dataClassificationLevel);
    filters.push({
      terms: {
        'data_classification': accessibleClassifications
      }
    });

    // 6. タグベースフィルター
    if (userPermission.accessibleTags.length > 0) {
      filters.push({
        bool: {
          should: [
            { terms: { 'tags': userPermission.accessibleTags } },
            { bool: { must_not: { exists: { field: 'tags' } } } } // タグなしドキュメントも許可
          ]
        }
      });
    }

    // 7. プロジェクトベースフィルター
    if (userPermission.accessibleProjects.length > 0) {
      filters.push({
        bool: {
          should: [
            { terms: { 'projects': userPermission.accessibleProjects } },
            { bool: { must_not: { exists: { field: 'projects' } } } } // プロジェクト未指定も許可
          ]
        }
      });
    }

    // 8. 地理的制限フィルター
    if (userPermission.geographicRestrictions && userPermission.geographicRestrictions.length > 0) {
      filters.push({
        bool: {
          should: [
            { terms: { 'geographic_restrictions': userPermission.geographicRestrictions } },
            { bool: { must_not: { exists: { field: 'geographic_restrictions' } } } }
          ]
        }
      });
    }

    // 9. 時間ベース制限（現在時刻チェック）
    const now = new Date();
    filters.push({
      bool: {
        should: [
          {
            bool: {
              must: [
                {
                  range: {
                    'time_restrictions.valid_from': {
                      lte: now.toISOString()
                    }
                  }
                },
                {
                  range: {
                    'time_restrictions.valid_until': {
                      gte: now.toISOString()
                    }
                  }
                }
              ]
            }
          },
          { bool: { must_not: { exists: { field: 'time_restrictions' } } } }
        ]
      }
    });

    // 複合フィルター返却
    return {
      bool: {
        must: filters
      }
    };
  }

  /**
   * 検索結果の後処理フィルタリング
   */
  public filterSearchResults(
    searchResults: any[],
    userPermission: UserPermission
  ): { filteredResults: any[], auditLog: AccessControlResult[] } {
    const filteredResults: any[] = [];
    const auditLog: AccessControlResult[] = [];

    for (const result of searchResults) {
      const accessResult = this.checkDocumentAccess(result._source, userPermission);
      
      auditLog.push(accessResult);
      
      if (accessResult.allowed) {
        filteredResults.push(result);
      }
    }

    return { filteredResults, auditLog };
  }

  /**
   * 個別ドキュメントアクセス権限チェック
   */
  public checkDocumentAccess(
    document: any,
    userPermission: UserPermission
  ): AccessControlResult {
    const timestamp = new Date();
    const auditInfo = {
      timestamp,
      userId: userPermission.userId,
      action: 'document_access',
      resource: document.document_id || 'unknown',
      result: 'deny' as 'allow' | 'deny'
    };

    // 権限チェック無効時
    if (!this.config.enabled) {
      auditInfo.result = 'allow';
      return {
        allowed: true,
        reason: 'Permission checking disabled',
        appliedRules: ['disabled'],
        auditInfo
      };
    }

    // 管理者バイパス
    if (this.config.adminBypass && userPermission.roleLevel === 'admin') {
      auditInfo.result = 'allow';
      return {
        allowed: true,
        reason: 'Admin bypass',
        appliedRules: ['admin_bypass'],
        auditInfo
      };
    }

    const appliedRules: string[] = [];
    const reasons: string[] = [];

    // 1. ユーザー直接権限チェック
    const userPermissions = document.user_permissions || [];
    if (userPermissions.includes(userPermission.userId) || 
        userPermissions.includes('public') || 
        userPermissions.includes('all')) {
      appliedRules.push('user_direct');
    } else {
      reasons.push('User not in allowed list');
    }

    // 2. 組織権限チェック
    const allowedOrgs = document.allowed_organizations || [];
    if (allowedOrgs.includes(userPermission.organization) || 
        allowedOrgs.includes('public') || 
        allowedOrgs.includes('all')) {
      appliedRules.push('organization');
    } else {
      reasons.push('Organization not allowed');
    }

    // 3. 部署権限チェック
    if (userPermission.department) {
      const allowedDepts = document.allowed_departments || [];
      if (allowedDepts.includes(userPermission.department) || 
          allowedDepts.includes('public') || 
          allowedDepts.includes('all')) {
        appliedRules.push('department');
      } else {
        reasons.push('Department not allowed');
      }
    }

    // 4. 役職レベルチェック
    const requiredLevel = document.required_role_level || 'guest';
    const roleHierarchy = this.getRoleHierarchy(userPermission.roleLevel);
    if (roleHierarchy.includes(requiredLevel)) {
      appliedRules.push('role_level');
    } else {
      reasons.push(`Insufficient role level: required ${requiredLevel}, user has ${userPermission.roleLevel}`);
    }

    // 5. データ分類レベルチェック
    const docClassification = document.data_classification || 'public';
    const accessibleClassifications = this.getAccessibleClassifications(userPermission.dataClassificationLevel);
    if (accessibleClassifications.includes(docClassification)) {
      appliedRules.push('data_classification');
    } else {
      reasons.push(`Insufficient data classification access: document is ${docClassification}`);
    }

    // 6. タグベース権限チェック
    const docTags = document.tags || [];
    if (docTags.length === 0 || 
        docTags.some((tag: string) => userPermission.accessibleTags.includes(tag))) {
      appliedRules.push('tags');
    } else {
      reasons.push('No matching tags');
    }

    // 7. プロジェクトベース権限チェック
    const docProjects = document.projects || [];
    if (docProjects.length === 0 || 
        docProjects.some((project: string) => userPermission.accessibleProjects.includes(project))) {
      appliedRules.push('projects');
    } else {
      reasons.push('No matching projects');
    }

    // 8. 地理的制限チェック
    const docGeoRestrictions = document.geographic_restrictions || [];
    if (docGeoRestrictions.length === 0 || 
        !userPermission.geographicRestrictions ||
        docGeoRestrictions.some((geo: string) => userPermission.geographicRestrictions!.includes(geo))) {
      appliedRules.push('geographic');
    } else {
      reasons.push('Geographic restrictions not met');
    }

    // 9. 時間制限チェック
    const timeRestrictions = document.time_restrictions;
    if (!timeRestrictions || this.checkTimeRestrictions(timeRestrictions, timestamp)) {
      appliedRules.push('time_restrictions');
    } else {
      reasons.push('Time restrictions not met');
    }

    // アクセス判定（デフォルト拒否モードの場合は全ルールが適用される必要がある）
    const allowed = this.config.defaultDeny 
      ? appliedRules.length >= 8 // 全チェック項目をパス
      : appliedRules.length > 0;  // 1つでもパスすればOK

    auditInfo.result = allowed ? 'allow' : 'deny';

    return {
      allowed,
      reason: allowed ? 'Access granted' : reasons.join('; '),
      appliedRules,
      auditInfo
    };
  }

  /**
   * 役職階層取得
   */
  private getRoleHierarchy(roleLevel: string): string[] {
    const hierarchy = {
      'admin': ['admin', 'manager', 'user', 'guest'],
      'manager': ['manager', 'user', 'guest'],
      'user': ['user', 'guest'],
      'guest': ['guest']
    };
    return hierarchy[roleLevel as keyof typeof hierarchy] || ['guest'];
  }

  /**
   * アクセス可能なデータ分類レベル取得
   */
  private getAccessibleClassifications(userLevel: string): string[] {
    const classifications = {
      'restricted': ['restricted', 'confidential', 'internal', 'public'],
      'confidential': ['confidential', 'internal', 'public'],
      'internal': ['internal', 'public'],
      'public': ['public']
    };
    return classifications[userLevel as keyof typeof classifications] || ['public'];
  }

  /**
   * 時間制限チェック
   */
  private checkTimeRestrictions(timeRestrictions: any, currentTime: Date): boolean {
    // 有効期間チェック
    if (timeRestrictions.valid_from && new Date(timeRestrictions.valid_from) > currentTime) {
      return false;
    }
    if (timeRestrictions.valid_until && new Date(timeRestrictions.valid_until) < currentTime) {
      return false;
    }

    // 時間帯制限チェック
    if (timeRestrictions.allowed_hours) {
      const currentHour = currentTime.getHours();
      if (!timeRestrictions.allowed_hours.includes(currentHour)) {
        return false;
      }
    }

    // 曜日制限チェック
    if (timeRestrictions.allowed_days) {
      const currentDay = currentTime.getDay();
      if (!timeRestrictions.allowed_days.includes(currentDay)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 権限キャッシュクリア
   */
  public clearCache(): void {
    this.permissionCache.clear();
  }

  /**
   * 統計情報取得
   */
  public getStatistics(): any {
    return {
      cacheSize: this.permissionCache.size,
      config: this.config,
      timestamp: new Date().toISOString()
    };
  }
}