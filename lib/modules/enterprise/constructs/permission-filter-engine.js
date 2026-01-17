"use strict";
/**
 * 権限フィルタリングエンジン
 *
 * OpenSearch検索結果に対するリアルタイム権限フィルタリング
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionFilterEngine = void 0;
class PermissionFilterEngine {
    config;
    permissionCache = new Map();
    constructor(config) {
        this.config = config;
    }
    /**
     * ユーザー権限に基づくOpenSearch検索クエリフィルター生成
     */
    generateSearchFilter(userPermission) {
        if (!this.config.enabled) {
            return {}; // 権限チェック無効時は制限なし
        }
        // 管理者バイパス
        if (this.config.adminBypass && userPermission.roleLevel === 'admin') {
            return {};
        }
        // 複合フィルター構築
        const filters = [];
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
    filterSearchResults(searchResults, userPermission) {
        const filteredResults = [];
        const auditLog = [];
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
    checkDocumentAccess(document, userPermission) {
        const timestamp = new Date();
        const auditInfo = {
            timestamp,
            userId: userPermission.userId,
            action: 'document_access',
            resource: document.document_id || 'unknown',
            result: 'deny'
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
        const appliedRules = [];
        const reasons = [];
        // 1. ユーザー直接権限チェック
        const userPermissions = document.user_permissions || [];
        if (userPermissions.includes(userPermission.userId) ||
            userPermissions.includes('public') ||
            userPermissions.includes('all')) {
            appliedRules.push('user_direct');
        }
        else {
            reasons.push('User not in allowed list');
        }
        // 2. 組織権限チェック
        const allowedOrgs = document.allowed_organizations || [];
        if (allowedOrgs.includes(userPermission.organization) ||
            allowedOrgs.includes('public') ||
            allowedOrgs.includes('all')) {
            appliedRules.push('organization');
        }
        else {
            reasons.push('Organization not allowed');
        }
        // 3. 部署権限チェック
        if (userPermission.department) {
            const allowedDepts = document.allowed_departments || [];
            if (allowedDepts.includes(userPermission.department) ||
                allowedDepts.includes('public') ||
                allowedDepts.includes('all')) {
                appliedRules.push('department');
            }
            else {
                reasons.push('Department not allowed');
            }
        }
        // 4. 役職レベルチェック
        const requiredLevel = document.required_role_level || 'guest';
        const roleHierarchy = this.getRoleHierarchy(userPermission.roleLevel);
        if (roleHierarchy.includes(requiredLevel)) {
            appliedRules.push('role_level');
        }
        else {
            reasons.push(`Insufficient role level: required ${requiredLevel}, user has ${userPermission.roleLevel}`);
        }
        // 5. データ分類レベルチェック
        const docClassification = document.data_classification || 'public';
        const accessibleClassifications = this.getAccessibleClassifications(userPermission.dataClassificationLevel);
        if (accessibleClassifications.includes(docClassification)) {
            appliedRules.push('data_classification');
        }
        else {
            reasons.push(`Insufficient data classification access: document is ${docClassification}`);
        }
        // 6. タグベース権限チェック
        const docTags = document.tags || [];
        if (docTags.length === 0 ||
            docTags.some((tag) => userPermission.accessibleTags.includes(tag))) {
            appliedRules.push('tags');
        }
        else {
            reasons.push('No matching tags');
        }
        // 7. プロジェクトベース権限チェック
        const docProjects = document.projects || [];
        if (docProjects.length === 0 ||
            docProjects.some((project) => userPermission.accessibleProjects.includes(project))) {
            appliedRules.push('projects');
        }
        else {
            reasons.push('No matching projects');
        }
        // 8. 地理的制限チェック
        const docGeoRestrictions = document.geographic_restrictions || [];
        if (docGeoRestrictions.length === 0 ||
            !userPermission.geographicRestrictions ||
            docGeoRestrictions.some((geo) => userPermission.geographicRestrictions.includes(geo))) {
            appliedRules.push('geographic');
        }
        else {
            reasons.push('Geographic restrictions not met');
        }
        // 9. 時間制限チェック
        const timeRestrictions = document.time_restrictions;
        if (!timeRestrictions || this.checkTimeRestrictions(timeRestrictions, timestamp)) {
            appliedRules.push('time_restrictions');
        }
        else {
            reasons.push('Time restrictions not met');
        }
        // アクセス判定（デフォルト拒否モードの場合は全ルールが適用される必要がある）
        const allowed = this.config.defaultDeny
            ? appliedRules.length >= 8 // 全チェック項目をパス
            : appliedRules.length > 0; // 1つでもパスすればOK
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
    getRoleHierarchy(roleLevel) {
        const hierarchy = {
            'admin': ['admin', 'manager', 'user', 'guest'],
            'manager': ['manager', 'user', 'guest'],
            'user': ['user', 'guest'],
            'guest': ['guest']
        };
        return hierarchy[roleLevel] || ['guest'];
    }
    /**
     * アクセス可能なデータ分類レベル取得
     */
    getAccessibleClassifications(userLevel) {
        const classifications = {
            'restricted': ['restricted', 'confidential', 'internal', 'public'],
            'confidential': ['confidential', 'internal', 'public'],
            'internal': ['internal', 'public'],
            'public': ['public']
        };
        return classifications[userLevel] || ['public'];
    }
    /**
     * 時間制限チェック
     */
    checkTimeRestrictions(timeRestrictions, currentTime) {
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
    clearCache() {
        this.permissionCache.clear();
    }
    /**
     * 統計情報取得
     */
    getStatistics() {
        return {
            cacheSize: this.permissionCache.size,
            config: this.config,
            timestamp: new Date().toISOString()
        };
    }
}
exports.PermissionFilterEngine = PermissionFilterEngine;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVybWlzc2lvbi1maWx0ZXItZW5naW5lLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicGVybWlzc2lvbi1maWx0ZXItZW5naW5lLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7OztHQUlHOzs7QUFJSCxNQUFhLHNCQUFzQjtJQUN6QixNQUFNLENBQXlCO0lBQy9CLGVBQWUsR0FBcUIsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUV0RCxZQUFZLE1BQThCO1FBQ3hDLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0lBQ3ZCLENBQUM7SUFFRDs7T0FFRztJQUNJLG9CQUFvQixDQUFDLGNBQThCO1FBQ3hELElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3pCLE9BQU8sRUFBRSxDQUFDLENBQUMsaUJBQWlCO1FBQzlCLENBQUM7UUFFRCxVQUFVO1FBQ1YsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsSUFBSSxjQUFjLENBQUMsU0FBUyxLQUFLLE9BQU8sRUFBRSxDQUFDO1lBQ3BFLE9BQU8sRUFBRSxDQUFDO1FBQ1osQ0FBQztRQUVELFlBQVk7UUFDWixNQUFNLE9BQU8sR0FBVSxFQUFFLENBQUM7UUFFMUIsa0JBQWtCO1FBQ2xCLE9BQU8sQ0FBQyxJQUFJLENBQUM7WUFDWCxLQUFLLEVBQUU7Z0JBQ0wsa0JBQWtCLEVBQUUsQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUM7YUFDN0Q7U0FDRixDQUFDLENBQUM7UUFFSCxnQkFBZ0I7UUFDaEIsT0FBTyxDQUFDLElBQUksQ0FBQztZQUNYLEtBQUssRUFBRTtnQkFDTCx1QkFBdUIsRUFBRSxDQUFDLGNBQWMsQ0FBQyxZQUFZLEVBQUUsUUFBUSxFQUFFLEtBQUssQ0FBQzthQUN4RTtTQUNGLENBQUMsQ0FBQztRQUVILDhCQUE4QjtRQUM5QixJQUFJLGNBQWMsQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUM5QixPQUFP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RCx3REF3WEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOaoqemZkOODleOCo+ODq+OCv+ODquODs+OCsOOCqOODs+OCuOODs1xuICogXG4gKiBPcGVuU2VhcmNo5qSc57Si57WQ5p6c44Gr5a++44GZ44KL44Oq44Ki44Or44K/44Kk44Og5qip6ZmQ44OV44Kj44Or44K/44Oq44Oz44KwXG4gKi9cblxuaW1wb3J0IHsgVXNlclBlcm1pc3Npb24sIERvY3VtZW50UGVybWlzc2lvbiwgUGVybWlzc2lvbkZpbHRlckNvbmZpZywgQWNjZXNzQ29udHJvbFJlc3VsdCB9IGZyb20gJy4uL2ludGVyZmFjZXMvcGVybWlzc2lvbi1jb25maWcnO1xuXG5leHBvcnQgY2xhc3MgUGVybWlzc2lvbkZpbHRlckVuZ2luZSB7XG4gIHByaXZhdGUgY29uZmlnOiBQZXJtaXNzaW9uRmlsdGVyQ29uZmlnO1xuICBwcml2YXRlIHBlcm1pc3Npb25DYWNoZTogTWFwPHN0cmluZywgYW55PiA9IG5ldyBNYXAoKTtcblxuICBjb25zdHJ1Y3Rvcihjb25maWc6IFBlcm1pc3Npb25GaWx0ZXJDb25maWcpIHtcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgfVxuXG4gIC8qKlxuICAgKiDjg6bjg7zjgrbjg7zmqKnpmZDjgavln7rjgaXjgY9PcGVuU2VhcmNo5qSc57Si44Kv44Ko44Oq44OV44Kj44Or44K/44O855Sf5oiQXG4gICAqL1xuICBwdWJsaWMgZ2VuZXJhdGVTZWFyY2hGaWx0ZXIodXNlclBlcm1pc3Npb246IFVzZXJQZXJtaXNzaW9uKTogYW55IHtcbiAgICBpZiAoIXRoaXMuY29uZmlnLmVuYWJsZWQpIHtcbiAgICAgIHJldHVybiB7fTsgLy8g5qip6ZmQ44OB44Kn44OD44Kv54Sh5Yq55pmC44Gv5Yi26ZmQ44Gq44GXXG4gICAgfVxuXG4gICAgLy8g566h55CG6ICF44OQ44Kk44OR44K5XG4gICAgaWYgKHRoaXMuY29uZmlnLmFkbWluQnlwYXNzICYmIHVzZXJQZXJtaXNzaW9uLnJvbGVMZXZlbCA9PT0gJ2FkbWluJykge1xuICAgICAgcmV0dXJuIHt9O1xuICAgIH1cblxuICAgIC8vIOikh+WQiOODleOCo+ODq+OCv+ODvOani+eviVxuICAgIGNvbnN0IGZpbHRlcnM6IGFueVtdID0gW107XG5cbiAgICAvLyAxLiDjg6bjg7zjgrbjg7zjg5njg7zjgrnjg5XjgqPjg6vjgr/jg7xcbiAgICBmaWx0ZXJzLnB1c2goe1xuICAgICAgdGVybXM6IHtcbiAgICAgICAgJ3VzZXJfcGVybWlzc2lvbnMnOiBbdXNlclBlcm1pc3Npb24udXNlcklkLCAncHVibGljJywgJ2FsbCddXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyAyLiDntYTnuZTjg5njg7zjgrnjg5XjgqPjg6vjgr/jg7xcbiAgICBmaWx0ZXJzLnB1c2goe1xuICAgICAgdGVybXM6IHtcbiAgICAgICAgJ2FsbG93ZWRfb3JnYW5pemF0aW9ucyc6IFt1c2VyUGVybWlzc2lvbi5vcmdhbml6YXRpb24sICdwdWJsaWMnLCAnYWxsJ11cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIDMuIOmDqOe9suODmeODvOOCueODleOCo+ODq+OCv+ODvO+8iOmDqOe9suOBjOaMh+WumuOBleOCjOOBpuOBhOOCi+WgtOWQiO+8iVxuICAgIGlmICh1c2VyUGVybWlzc2lvbi5kZXBhcnRtZW50KSB7XG4gICAgICBmaWx0ZXJzLnB1c2goe1xuICAgICAgICB0ZXJtczoge1xuICAgICAgICAgICdhbGxvd2VkX2RlcGFydG1lbnRzJzogW3VzZXJQZXJtaXNzaW9uLmRlcGFydG1lbnQsICdwdWJsaWMnLCAnYWxsJ11cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gNC4g5b256IG344Os44OZ44Or44OV44Kj44Or44K/44O8XG4gICAgY29uc3Qgcm9sZUhpZXJhcmNoeSA9IHRoaXMuZ2V0Um9sZUhpZXJhcmNoeSh1c2VyUGVybWlzc2lvbi5yb2xlTGV2ZWwpO1xuICAgIGZpbHRlcnMucHVzaCh7XG4gICAgICB0ZXJtczoge1xuICAgICAgICAncmVxdWlyZWRfcm9sZV9sZXZlbCc6IHJvbGVIaWVyYXJjaHlcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIDUuIOODh+ODvOOCv+WIhumhnuODrOODmeODq+ODleOCo+ODq+OCv+ODvFxuICAgIGNvbnN0IGFjY2Vzc2libGVDbGFzc2lmaWNhdGlvbnMgPSB0aGlzLmdldEFjY2Vzc2libGVDbGFzc2lmaWNhdGlvbnModXNlclBlcm1pc3Npb24uZGF0YUNsYXNzaWZpY2F0aW9uTGV2ZWwpO1xuICAgIGZpbHRlcnMucHVzaCh7XG4gICAgICB0ZXJtczoge1xuICAgICAgICAnZGF0YV9jbGFzc2lmaWNhdGlvbic6IGFjY2Vzc2libGVDbGFzc2lmaWNhdGlvbnNcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIDYuIOOCv+OCsOODmeODvOOCueODleOCo+ODq+OCv+ODvFxuICAgIGlmICh1c2VyUGVybWlzc2lvbi5hY2Nlc3NpYmxlVGFncy5sZW5ndGggPiAwKSB7XG4gICAgICBmaWx0ZXJzLnB1c2goe1xuICAgICAgICBib29sOiB7XG4gICAgICAgICAgc2hvdWxkOiBbXG4gICAgICAgICAgICB7IHRlcm1zOiB7ICd0YWdzJzogdXNlclBlcm1pc3Npb24uYWNjZXNzaWJsZVRhZ3MgfSB9LFxuICAgICAgICAgICAgeyBib29sOiB7IG11c3Rfbm90OiB7IGV4aXN0czogeyBmaWVsZDogJ3RhZ3MnIH0gfSB9IH0gLy8g44K/44Kw44Gq44GX44OJ44Kt44Ol44Oh44Oz44OI44KC6Kix5Y+vXG4gICAgICAgICAgXVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyA3LiDjg5fjg63jgrjjgqfjgq/jg4jjg5njg7zjgrnjg5XjgqPjg6vjgr/jg7xcbiAgICBpZiAodXNlclBlcm1pc3Npb24uYWNjZXNzaWJsZVByb2plY3RzLmxlbmd0aCA+IDApIHtcbiAgICAgIGZpbHRlcnMucHVzaCh7XG4gICAgICAgIGJvb2w6IHtcbiAgICAgICAgICBzaG91bGQ6IFtcbiAgICAgICAgICAgIHsgdGVybXM6IHsgJ3Byb2plY3RzJzogdXNlclBlcm1pc3Npb24uYWNjZXNzaWJsZVByb2plY3RzIH0gfSxcbiAgICAgICAgICAgIHsgYm9vbDogeyBtdXN0X25vdDogeyBleGlzdHM6IHsgZmllbGQ6ICdwcm9qZWN0cycgfSB9IH0gfSAvLyDjg5fjg63jgrjjgqfjgq/jg4jmnKrmjIflrprjgoLoqLHlj69cbiAgICAgICAgICBdXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIDguIOWcsOeQhueahOWItumZkOODleOCo+ODq+OCv+ODvFxuICAgIGlmICh1c2VyUGVybWlzc2lvbi5nZW9ncmFwaGljUmVzdHJpY3Rpb25zICYmIHVzZXJQZXJtaXNzaW9uLmdlb2dyYXBoaWNSZXN0cmljdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgZmlsdGVycy5wdXNoKHtcbiAgICAgICAgYm9vbDoge1xuICAgICAgICAgIHNob3VsZDogW1xuICAgICAgICAgICAgeyB0ZXJtczogeyAnZ2VvZ3JhcGhpY19yZXN0cmljdGlvbnMnOiB1c2VyUGVybWlzc2lvbi5nZW9ncmFwaGljUmVzdHJpY3Rpb25zIH0gfSxcbiAgICAgICAgICAgIHsgYm9vbDogeyBtdXN0X25vdDogeyBleGlzdHM6IHsgZmllbGQ6ICdnZW9ncmFwaGljX3Jlc3RyaWN0aW9ucycgfSB9IH0gfVxuICAgICAgICAgIF1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gOS4g5pmC6ZaT44OZ44O844K55Yi26ZmQ77yI54++5Zyo5pmC5Yi744OB44Kn44OD44Kv77yJXG4gICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKTtcbiAgICBmaWx0ZXJzLnB1c2goe1xuICAgICAgYm9vbDoge1xuICAgICAgICBzaG91bGQ6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBib29sOiB7XG4gICAgICAgICAgICAgIG11c3Q6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICByYW5nZToge1xuICAgICAgICAgICAgICAgICAgICAndGltZV9yZXN0cmljdGlvbnMudmFsaWRfZnJvbSc6IHtcbiAgICAgICAgICAgICAgICAgICAgICBsdGU6IG5vdy50b0lTT1N0cmluZygpXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIHJhbmdlOiB7XG4gICAgICAgICAgICAgICAgICAgICd0aW1lX3Jlc3RyaWN0aW9ucy52YWxpZF91bnRpbCc6IHtcbiAgICAgICAgICAgICAgICAgICAgICBndGU6IG5vdy50b0lTT1N0cmluZygpXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICAgIHsgYm9vbDogeyBtdXN0X25vdDogeyBleGlzdHM6IHsgZmllbGQ6ICd0aW1lX3Jlc3RyaWN0aW9ucycgfSB9IH0gfVxuICAgICAgICBdXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyDopIflkIjjg5XjgqPjg6vjgr/jg7zov5TljbRcbiAgICByZXR1cm4ge1xuICAgICAgYm9vbDoge1xuICAgICAgICBtdXN0OiBmaWx0ZXJzXG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmpJzntKLntZDmnpzjga7lvozlh6bnkIbjg5XjgqPjg6vjgr/jg6rjg7PjgrBcbiAgICovXG4gIHB1YmxpYyBmaWx0ZXJTZWFyY2hSZXN1bHRzKFxuICAgIHNlYXJjaFJlc3VsdHM6IGFueVtdLFxuICAgIHVzZXJQZXJtaXNzaW9uOiBVc2VyUGVybWlzc2lvblxuICApOiB7IGZpbHRlcmVkUmVzdWx0czogYW55W10sIGF1ZGl0TG9nOiBBY2Nlc3NDb250cm9sUmVzdWx0W10gfSB7XG4gICAgY29uc3QgZmlsdGVyZWRSZXN1bHRzOiBhbnlbXSA9IFtdO1xuICAgIGNvbnN0IGF1ZGl0TG9nOiBBY2Nlc3NDb250cm9sUmVzdWx0W10gPSBbXTtcblxuICAgIGZvciAoY29uc3QgcmVzdWx0IG9mIHNlYXJjaFJlc3VsdHMpIHtcbiAgICAgIGNvbnN0IGFjY2Vzc1Jlc3VsdCA9IHRoaXMuY2hlY2tEb2N1bWVudEFjY2VzcyhyZXN1bHQuX3NvdXJjZSwgdXNlclBlcm1pc3Npb24pO1xuICAgICAgXG4gICAgICBhdWRpdExvZy5wdXNoKGFjY2Vzc1Jlc3VsdCk7XG4gICAgICBcbiAgICAgIGlmIChhY2Nlc3NSZXN1bHQuYWxsb3dlZCkge1xuICAgICAgICBmaWx0ZXJlZFJlc3VsdHMucHVzaChyZXN1bHQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7IGZpbHRlcmVkUmVzdWx0cywgYXVkaXRMb2cgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlgIvliKXjg4njgq3jg6Xjg6Hjg7Pjg4jjgqLjgq/jgrvjgrnmqKnpmZDjg4Hjgqfjg4Pjgq9cbiAgICovXG4gIHB1YmxpYyBjaGVja0RvY3VtZW50QWNjZXNzKFxuICAgIGRvY3VtZW50OiBhbnksXG4gICAgdXNlclBlcm1pc3Npb246IFVzZXJQZXJtaXNzaW9uXG4gICk6IEFjY2Vzc0NvbnRyb2xSZXN1bHQge1xuICAgIGNvbnN0IHRpbWVzdGFtcCA9IG5ldyBEYXRlKCk7XG4gICAgY29uc3QgYXVkaXRJbmZvID0ge1xuICAgICAgdGltZXN0YW1wLFxuICAgICAgdXNlcklkOiB1c2VyUGVybWlzc2lvbi51c2VySWQsXG4gICAgICBhY3Rpb246ICdkb2N1bWVudF9hY2Nlc3MnLFxuICAgICAgcmVzb3VyY2U6IGRvY3VtZW50LmRvY3VtZW50X2lkIHx8ICd1bmtub3duJyxcbiAgICAgIHJlc3VsdDogJ2RlbnknIGFzICdhbGxvdycgfCAnZGVueSdcbiAgICB9O1xuXG4gICAgLy8g5qip6ZmQ44OB44Kn44OD44Kv54Sh5Yq55pmCXG4gICAgaWYgKCF0aGlzLmNvbmZpZy5lbmFibGVkKSB7XG4gICAgICBhdWRpdEluZm8ucmVzdWx0ID0gJ2FsbG93JztcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGFsbG93ZWQ6IHRydWUsXG4gICAgICAgIHJlYXNvbjogJ1Blcm1pc3Npb24gY2hlY2tpbmcgZGlzYWJsZWQnLFxuICAgICAgICBhcHBsaWVkUnVsZXM6IFsnZGlzYWJsZWQnXSxcbiAgICAgICAgYXVkaXRJbmZvXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIOeuoeeQhuiAheODkOOCpOODkeOCuVxuICAgIGlmICh0aGlzLmNvbmZpZy5hZG1pbkJ5cGFzcyAmJiB1c2VyUGVybWlzc2lvbi5yb2xlTGV2ZWwgPT09ICdhZG1pbicpIHtcbiAgICAgIGF1ZGl0SW5mby5yZXN1bHQgPSAnYWxsb3cnO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYWxsb3dlZDogdHJ1ZSxcbiAgICAgICAgcmVhc29uOiAnQWRtaW4gYnlwYXNzJyxcbiAgICAgICAgYXBwbGllZFJ1bGVzOiBbJ2FkbWluX2J5cGFzcyddLFxuICAgICAgICBhdWRpdEluZm9cbiAgICAgIH07XG4gICAgfVxuXG4gICAgY29uc3QgYXBwbGllZFJ1bGVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHJlYXNvbnM6IHN0cmluZ1tdID0gW107XG5cbiAgICAvLyAxLiDjg6bjg7zjgrbjg7znm7TmjqXmqKnpmZDjg4Hjgqfjg4Pjgq9cbiAgICBjb25zdCB1c2VyUGVybWlzc2lvbnMgPSBkb2N1bWVudC51c2VyX3Blcm1pc3Npb25zIHx8IFtdO1xuICAgIGlmICh1c2VyUGVybWlzc2lvbnMuaW5jbHVkZXModXNlclBlcm1pc3Npb24udXNlcklkKSB8fCBcbiAgICAgICAgdXNlclBlcm1pc3Npb25zLmluY2x1ZGVzKCdwdWJsaWMnKSB8fCBcbiAgICAgICAgdXNlclBlcm1pc3Npb25zLmluY2x1ZGVzKCdhbGwnKSkge1xuICAgICAgYXBwbGllZFJ1bGVzLnB1c2goJ3VzZXJfZGlyZWN0Jyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlYXNvbnMucHVzaCgnVXNlciBub3QgaW4gYWxsb3dlZCBsaXN0Jyk7XG4gICAgfVxuXG4gICAgLy8gMi4g57WE57mU5qip6ZmQ44OB44Kn44OD44KvXG4gICAgY29uc3QgYWxsb3dlZE9yZ3MgPSBkb2N1bWVudC5hbGxvd2VkX29yZ2FuaXphdGlvbnMgfHwgW107XG4gICAgaWYgKGFsbG93ZWRPcmdzLmluY2x1ZGVzKHVzZXJQZXJtaXNzaW9uLm9yZ2FuaXphdGlvbikgfHwgXG4gICAgICAgIGFsbG93ZWRPcmdzLmluY2x1ZGVzKCdwdWJsaWMnKSB8fCBcbiAgICAgICAgYWxsb3dlZE9yZ3MuaW5jbHVkZXMoJ2FsbCcpKSB7XG4gICAgICBhcHBsaWVkUnVsZXMucHVzaCgnb3JnYW5pemF0aW9uJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlYXNvbnMucHVzaCgnT3JnYW5pemF0aW9uIG5vdCBhbGxvd2VkJyk7XG4gICAgfVxuXG4gICAgLy8gMy4g6YOo572y5qip6ZmQ44OB44Kn44OD44KvXG4gICAgaWYgKHVzZXJQZXJtaXNzaW9uLmRlcGFydG1lbnQpIHtcbiAgICAgIGNvbnN0IGFsbG93ZWREZXB0cyA9IGRvY3VtZW50LmFsbG93ZWRfZGVwYXJ0bWVudHMgfHwgW107XG4gICAgICBpZiAoYWxsb3dlZERlcHRzLmluY2x1ZGVzKHVzZXJQZXJtaXNzaW9uLmRlcGFydG1lbnQpIHx8IFxuICAgICAgICAgIGFsbG93ZWREZXB0cy5pbmNsdWRlcygncHVibGljJykgfHwgXG4gICAgICAgICAgYWxsb3dlZERlcHRzLmluY2x1ZGVzKCdhbGwnKSkge1xuICAgICAgICBhcHBsaWVkUnVsZXMucHVzaCgnZGVwYXJ0bWVudCcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVhc29ucy5wdXNoKCdEZXBhcnRtZW50IG5vdCBhbGxvd2VkJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gNC4g5b256IG344Os44OZ44Or44OB44Kn44OD44KvXG4gICAgY29uc3QgcmVxdWlyZWRMZXZlbCA9IGRvY3VtZW50LnJlcXVpcmVkX3JvbGVfbGV2ZWwgfHwgJ2d1ZXN0JztcbiAgICBjb25zdCByb2xlSGllcmFyY2h5ID0gdGhpcy5nZXRSb2xlSGllcmFyY2h5KHVzZXJQZXJtaXNzaW9uLnJvbGVMZXZlbCk7XG4gICAgaWYgKHJvbGVIaWVyYXJjaHkuaW5jbHVkZXMocmVxdWlyZWRMZXZlbCkpIHtcbiAgICAgIGFwcGxpZWRSdWxlcy5wdXNoKCdyb2xlX2xldmVsJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlYXNvbnMucHVzaChgSW5zdWZmaWNpZW50IHJvbGUgbGV2ZWw6IHJlcXVpcmVkICR7cmVxdWlyZWRMZXZlbH0sIHVzZXIgaGFzICR7dXNlclBlcm1pc3Npb24ucm9sZUxldmVsfWApO1xuICAgIH1cblxuICAgIC8vIDUuIOODh+ODvOOCv+WIhumhnuODrOODmeODq+ODgeOCp+ODg+OCr1xuICAgIGNvbnN0IGRvY0NsYXNzaWZpY2F0aW9uID0gZG9jdW1lbnQuZGF0YV9jbGFzc2lmaWNhdGlvbiB8fCAncHVibGljJztcbiAgICBjb25zdCBhY2Nlc3NpYmxlQ2xhc3NpZmljYXRpb25zID0gdGhpcy5nZXRBY2Nlc3NpYmxlQ2xhc3NpZmljYXRpb25zKHVzZXJQZXJtaXNzaW9uLmRhdGFDbGFzc2lmaWNhdGlvbkxldmVsKTtcbiAgICBpZiAoYWNjZXNzaWJsZUNsYXNzaWZpY2F0aW9ucy5pbmNsdWRlcyhkb2NDbGFzc2lmaWNhdGlvbikpIHtcbiAgICAgIGFwcGxpZWRSdWxlcy5wdXNoKCdkYXRhX2NsYXNzaWZpY2F0aW9uJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlYXNvbnMucHVzaChgSW5zdWZmaWNpZW50IGRhdGEgY2xhc3NpZmljYXRpb24gYWNjZXNzOiBkb2N1bWVudCBpcyAke2RvY0NsYXNzaWZpY2F0aW9ufWApO1xuICAgIH1cblxuICAgIC8vIDYuIOOCv+OCsOODmeODvOOCueaoqemZkOODgeOCp+ODg+OCr1xuICAgIGNvbnN0IGRvY1RhZ3MgPSBkb2N1bWVudC50YWdzIHx8IFtdO1xuICAgIGlmIChkb2NUYWdzLmxlbmd0aCA9PT0gMCB8fCBcbiAgICAgICAgZG9jVGFncy5zb21lKCh0YWc6IHN0cmluZykgPT4gdXNlclBlcm1pc3Npb24uYWNjZXNzaWJsZVRhZ3MuaW5jbHVkZXModGFnKSkpIHtcbiAgICAgIGFwcGxpZWRSdWxlcy5wdXNoKCd0YWdzJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlYXNvbnMucHVzaCgnTm8gbWF0Y2hpbmcgdGFncycpO1xuICAgIH1cblxuICAgIC8vIDcuIOODl+ODreOCuOOCp+OCr+ODiOODmeODvOOCueaoqemZkOODgeOCp+ODg+OCr1xuICAgIGNvbnN0IGRvY1Byb2plY3RzID0gZG9jdW1lbnQucHJvamVjdHMgfHwgW107XG4gICAgaWYgKGRvY1Byb2plY3RzLmxlbmd0aCA9PT0gMCB8fCBcbiAgICAgICAgZG9jUHJvamVjdHMuc29tZSgocHJvamVjdDogc3RyaW5nKSA9PiB1c2VyUGVybWlzc2lvbi5hY2Nlc3NpYmxlUHJvamVjdHMuaW5jbHVkZXMocHJvamVjdCkpKSB7XG4gICAgICBhcHBsaWVkUnVsZXMucHVzaCgncHJvamVjdHMnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVhc29ucy5wdXNoKCdObyBtYXRjaGluZyBwcm9qZWN0cycpO1xuICAgIH1cblxuICAgIC8vIDguIOWcsOeQhueahOWItumZkOODgeOCp+ODg+OCr1xuICAgIGNvbnN0IGRvY0dlb1Jlc3RyaWN0aW9ucyA9IGRvY3VtZW50Lmdlb2dyYXBoaWNfcmVzdHJpY3Rpb25zIHx8IFtdO1xuICAgIGlmIChkb2NHZW9SZXN0cmljdGlvbnMubGVuZ3RoID09PSAwIHx8IFxuICAgICAgICAhdXNlclBlcm1pc3Npb24uZ2VvZ3JhcGhpY1Jlc3RyaWN0aW9ucyB8fFxuICAgICAgICBkb2NHZW9SZXN0cmljdGlvbnMuc29tZSgoZ2VvOiBzdHJpbmcpID0+IHVzZXJQZXJtaXNzaW9uLmdlb2dyYXBoaWNSZXN0cmljdGlvbnMhLmluY2x1ZGVzKGdlbykpKSB7XG4gICAgICBhcHBsaWVkUnVsZXMucHVzaCgnZ2VvZ3JhcGhpYycpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZWFzb25zLnB1c2goJ0dlb2dyYXBoaWMgcmVzdHJpY3Rpb25zIG5vdCBtZXQnKTtcbiAgICB9XG5cbiAgICAvLyA5LiDmmYLplpPliLbpmZDjg4Hjgqfjg4Pjgq9cbiAgICBjb25zdCB0aW1lUmVzdHJpY3Rpb25zID0gZG9jdW1lbnQudGltZV9yZXN0cmljdGlvbnM7XG4gICAgaWYgKCF0aW1lUmVzdHJpY3Rpb25zIHx8IHRoaXMuY2hlY2tUaW1lUmVzdHJpY3Rpb25zKHRpbWVSZXN0cmljdGlvbnMsIHRpbWVzdGFtcCkpIHtcbiAgICAgIGFwcGxpZWRSdWxlcy5wdXNoKCd0aW1lX3Jlc3RyaWN0aW9ucycpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZWFzb25zLnB1c2goJ1RpbWUgcmVzdHJpY3Rpb25zIG5vdCBtZXQnKTtcbiAgICB9XG5cbiAgICAvLyDjgqLjgq/jgrvjgrnliKTlrprvvIjjg4fjg5Xjgqnjg6vjg4jmi5LlkKbjg6Ljg7zjg4njga7loLTlkIjjga/lhajjg6vjg7zjg6vjgYzpgannlKjjgZXjgozjgovlv4XopoHjgYzjgYLjgovvvIlcbiAgICBjb25zdCBhbGxvd2VkID0gdGhpcy5jb25maWcuZGVmYXVsdERlbnkgXG4gICAgICA/IGFwcGxpZWRSdWxlcy5sZW5ndGggPj0gOCAvLyDlhajjg4Hjgqfjg4Pjgq/poIXnm67jgpLjg5HjgrlcbiAgICAgIDogYXBwbGllZFJ1bGVzLmxlbmd0aCA+IDA7ICAvLyAx44Gk44Gn44KC44OR44K544GZ44KM44GwT0tcblxuICAgIGF1ZGl0SW5mby5yZXN1bHQgPSBhbGxvd2VkID8gJ2FsbG93JyA6ICdkZW55JztcblxuICAgIHJldHVybiB7XG4gICAgICBhbGxvd2VkLFxuICAgICAgcmVhc29uOiBhbGxvd2VkID8gJ0FjY2VzcyBncmFudGVkJyA6IHJlYXNvbnMuam9pbignOyAnKSxcbiAgICAgIGFwcGxpZWRSdWxlcyxcbiAgICAgIGF1ZGl0SW5mb1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog5b256IG36ZqO5bGk5Y+W5b6XXG4gICAqL1xuICBwcml2YXRlIGdldFJvbGVIaWVyYXJjaHkocm9sZUxldmVsOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgaGllcmFyY2h5ID0ge1xuICAgICAgJ2FkbWluJzogWydhZG1pbicsICdtYW5hZ2VyJywgJ3VzZXInLCAnZ3Vlc3QnXSxcbiAgICAgICdtYW5hZ2VyJzogWydtYW5hZ2VyJywgJ3VzZXInLCAnZ3Vlc3QnXSxcbiAgICAgICd1c2VyJzogWyd1c2VyJywgJ2d1ZXN0J10sXG4gICAgICAnZ3Vlc3QnOiBbJ2d1ZXN0J11cbiAgICB9O1xuICAgIHJldHVybiBoaWVyYXJjaHlbcm9sZUxldmVsIGFzIGtleW9mIHR5cGVvZiBoaWVyYXJjaHldIHx8IFsnZ3Vlc3QnXTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgqLjgq/jgrvjgrnlj6/og73jgarjg4fjg7zjgr/liIbpoZ7jg6zjg5njg6vlj5blvpdcbiAgICovXG4gIHByaXZhdGUgZ2V0QWNjZXNzaWJsZUNsYXNzaWZpY2F0aW9ucyh1c2VyTGV2ZWw6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCBjbGFzc2lmaWNhdGlvbnMgPSB7XG4gICAgICAncmVzdHJpY3RlZCc6IFsncmVzdHJpY3RlZCcsICdjb25maWRlbnRpYWwnLCAnaW50ZXJuYWwnLCAncHVibGljJ10sXG4gICAgICAnY29uZmlkZW50aWFsJzogWydjb25maWRlbnRpYWwnLCAnaW50ZXJuYWwnLCAncHVibGljJ10sXG4gICAgICAnaW50ZXJuYWwnOiBbJ2ludGVybmFsJywgJ3B1YmxpYyddLFxuICAgICAgJ3B1YmxpYyc6IFsncHVibGljJ11cbiAgICB9O1xuICAgIHJldHVybiBjbGFzc2lmaWNhdGlvbnNbdXNlckxldmVsIGFzIGtleW9mIHR5cGVvZiBjbGFzc2lmaWNhdGlvbnNdIHx8IFsncHVibGljJ107XG4gIH1cblxuICAvKipcbiAgICog5pmC6ZaT5Yi26ZmQ44OB44Kn44OD44KvXG4gICAqL1xuICBwcml2YXRlIGNoZWNrVGltZVJlc3RyaWN0aW9ucyh0aW1lUmVzdHJpY3Rpb25zOiBhbnksIGN1cnJlbnRUaW1lOiBEYXRlKTogYm9vbGVhbiB7XG4gICAgLy8g5pyJ5Yq55pyf6ZaT44OB44Kn44OD44KvXG4gICAgaWYgKHRpbWVSZXN0cmljdGlvbnMudmFsaWRfZnJvbSAmJiBuZXcgRGF0ZSh0aW1lUmVzdHJpY3Rpb25zLnZhbGlkX2Zyb20pID4gY3VycmVudFRpbWUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHRpbWVSZXN0cmljdGlvbnMudmFsaWRfdW50aWwgJiYgbmV3IERhdGUodGltZVJlc3RyaWN0aW9ucy52YWxpZF91bnRpbCkgPCBjdXJyZW50VGltZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIOaZgumWk+W4r+WItumZkOODgeOCp+ODg+OCr1xuICAgIGlmICh0aW1lUmVzdHJpY3Rpb25zLmFsbG93ZWRfaG91cnMpIHtcbiAgICAgIGNvbnN0IGN1cnJlbnRIb3VyID0gY3VycmVudFRpbWUuZ2V0SG91cnMoKTtcbiAgICAgIGlmICghdGltZVJlc3RyaWN0aW9ucy5hbGxvd2VkX2hvdXJzLmluY2x1ZGVzKGN1cnJlbnRIb3VyKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8g5puc5pel5Yi26ZmQ44OB44Kn44OD44KvXG4gICAgaWYgKHRpbWVSZXN0cmljdGlvbnMuYWxsb3dlZF9kYXlzKSB7XG4gICAgICBjb25zdCBjdXJyZW50RGF5ID0gY3VycmVudFRpbWUuZ2V0RGF5KCk7XG4gICAgICBpZiAoIXRpbWVSZXN0cmljdGlvbnMuYWxsb3dlZF9kYXlzLmluY2x1ZGVzKGN1cnJlbnREYXkpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmqKnpmZDjgq3jg6Pjg4Pjgrfjg6Xjgq/jg6rjgqJcbiAgICovXG4gIHB1YmxpYyBjbGVhckNhY2hlKCk6IHZvaWQge1xuICAgIHRoaXMucGVybWlzc2lvbkNhY2hlLmNsZWFyKCk7XG4gIH1cblxuICAvKipcbiAgICog57Wx6KiI5oOF5aCx5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgZ2V0U3RhdGlzdGljcygpOiBhbnkge1xuICAgIHJldHVybiB7XG4gICAgICBjYWNoZVNpemU6IHRoaXMucGVybWlzc2lvbkNhY2hlLnNpemUsXG4gICAgICBjb25maWc6IHRoaXMuY29uZmlnLFxuICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICB9O1xuICB9XG59Il19