/**
 * 権限フィルタリングエンジン
 *
 * OpenSearch検索結果に対するリアルタイム権限フィルタリング
 */
import { UserPermission, PermissionFilterConfig, AccessControlResult } from '../interfaces/permission-config';
export declare class PermissionFilterEngine {
    private config;
    private permissionCache;
    constructor(config: PermissionFilterConfig);
    /**
     * ユーザー権限に基づくOpenSearch検索クエリフィルター生成
     */
    generateSearchFilter(userPermission: UserPermission): any;
    /**
     * 検索結果の後処理フィルタリング
     */
    filterSearchResults(searchResults: any[], userPermission: UserPermission): {
        filteredResults: any[];
        auditLog: AccessControlResult[];
    };
    /**
     * 個別ドキュメントアクセス権限チェック
     */
    checkDocumentAccess(document: any, userPermission: UserPermission): AccessControlResult;
    /**
     * 役職階層取得
     */
    private getRoleHierarchy;
    /**
     * アクセス可能なデータ分類レベル取得
     */
    private getAccessibleClassifications;
    /**
     * 時間制限チェック
     */
    private checkTimeRestrictions;
    /**
     * 権限キャッシュクリア
     */
    clearCache(): void;
    /**
     * 統計情報取得
     */
    getStatistics(): any;
}
