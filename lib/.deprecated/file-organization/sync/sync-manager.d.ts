/**
 * 統合ファイル整理システム - 同期マネージャー
 *
 * 環境間同期実行機能を提供し、
 * 整合性検証とレポート生成を実行します。
 */
import { SSHConfig } from '../scanners/ec2-scanner.js';
/**
 * 同期オプション
 */
export interface SyncOptions {
    /** 同期方向 */
    direction: 'local_to_ec2' | 'ec2_to_local' | 'bidirectional';
    /** ドライランモード */
    dryRun: boolean;
    /** 既存ファイルを上書きするか */
    overwriteExisting: boolean;
    /** 権限も同期するか */
    syncPermissions: boolean;
    /** バックアップを作成するか */
    createBackup: boolean;
    /** 除外パターン */
    excludePatterns: string[];
    /** 同期対象のファイルタイプ */
    includeFileTypes?: string[];
}
/**
 * 同期結果
 */
export interface SyncResult {
    /** 同期ID */
    syncId: string;
    /** 同期時刻 */
    syncTime: Date;
    /** 成功したかどうか */
    success: boolean;
    /** 同期方向 */
    direction: string;
    /** 同期統計 */
    statistics: SyncStatistics;
    /** 同期されたアイテム */
    syncedItems: SyncedItem[];
    /** 失敗したアイテム */
    failedItems: FailedItem[];
    /** エラー */
    errors: string[];
    /** 処理時間 */
    processingTime: number;
}
/**
 * 同期統計
 */
export interface SyncStatistics {
    /** 処理したディレクトリ数 */
    processedDirectories: number;
    /** 処理したファイル数 */
    processedFiles: number;
    /** 作成したディレクトリ数 */
    createdDirectories: number;
    /** 同期したファイル数 */
    syncedFiles: number;
    /** 削除したアイテム数 */
    deletedItems: number;
    /** 権限を更新したアイテム数 */
    permissionUpdates: number;
    /** 総データサイズ */
    totalDataSize: number;
    /** スキップしたアイテム数 */
    skippedItems: number;
}
/**
 * 同期されたアイテム
 */
export interface SyncedItem {
    /** アイテムタイプ */
    type: 'directory' | 'file';
    /** ソースパス */
    sourcePath: string;
    /** ターゲットパス */
    targetPath: string;
    /** アクション */
    action: 'created' | 'updated' | 'deleted' | 'permission_updated';
    /** サイズ（ファイルの場合） */
    size?: number;
    /** 処理時間 */
    processingTime: number;
}
/**
 * 失敗したアイテム
 */
export interface FailedItem {
    /** アイテムパス */
    path: string;
    /** エラーメッセージ */
    error: string;
    /** 試行回数 */
    attempts: number;
}
/**
 * 整合性検証結果
 */
export interface ConsistencyVerification {
    /** 検証ID */
    verificationId: string;
    /** 検証時刻 */
    verificationTime: Date;
    /** 整合性が取れているか */
    isConsistent: boolean;
    /** 不整合項目 */
    inconsistencies: InconsistencyItem[];
    /** 検証統計 */
    statistics: {
        totalItems: number;
        consistentItems: number;
        inconsistentItems: number;
        verificationTime: number;
    };
}
/**
 * 不整合項目
 */
export interface InconsistencyItem {
    /** パス */
    path: string;
    /** 不整合タイプ */
    type: 'missing' | 'size_mismatch' | 'permission_mismatch' | 'content_mismatch';
    /** 詳細 */
    details: string;
    /** 重要度 */
    severity: 'low' | 'medium' | 'high' | 'critical';
}
/**
 * 同期マネージャー
 *
 * 環境間の同期実行と整合性検証を提供します。
 */
export declare class SyncManager {
    private readonly structureComparator;
    private readonly directoryCreator;
    private readonly sshConfig?;
    private readonly maxRetries;
    constructor(sshConfig?: SSHConfig);
    /**
     * 環境間同期を実行
     */
    executeSync(localRootPath?: string, ec2RootPath?: string, options?: SyncOptions): Promise<SyncResult>;
    /**
     * 同期を実行
     */
    private performSync;
    /**
     * 同期対象をフィルタリング
     */
    private filterSyncTargets;
    /**
     * 個別差分を処理
     */
    private processSyncDifference;
    /**
     * 不足ディレクトリを同期
     */
    private syncMissingDirectory;
    /**
     * 不足ファイルを同期
     */
    private syncMissingFile;
    /**
     * 権限を同期
     */
    private syncPermissions;
    /**
     * ファイル内容を同期
     */
    private syncFileContent;
    /**
     * ローカルファイルをEC2にコピー
     */
    private copyFileToEC2;
    /**
     * EC2ファイルをローカルにコピー
     */
    private copyFileFromEC2;
    /**
     * 同期統計を生成
     */
    private generateSyncStatistics;
    /**
     * 同期バックアップを作成
     */
    private createSyncBackup;
    /**
     * 同期結果を検証
     */
    private verifySyncResult;
    /**
     * 整合性検証を実行
     */
    verifyConsistency(localRootPath?: string, ec2RootPath?: string): Promise<ConsistencyVerification>;
    /**
     * 差分タイプを不整合タイプにマップ
     */
    private mapDifferenceToInconsistency;
    /**
     * 同期レポートを生成
     */
    generateSyncReport(syncResult: SyncResult): string;
    /**
     * SSH コマンドを実行
     */
    private executeSSHCommand;
}
