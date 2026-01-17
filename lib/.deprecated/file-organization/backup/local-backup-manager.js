"use strict";
/**
 * 統合ファイル整理システム - ローカルバックアップ管理
 *
 * ローカル環境でのファイルバックアップ作成、復元、管理機能を提供します。
 * 安全なファイル移動のための包括的なバックアップシステムです。
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalBackupManager = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const index_js_1 = require("../types/index.js");
/**
 * ローカルバックアップ管理
 *
 * ローカル環境でのファイルバックアップ機能を提供し、
 * 安全なファイル操作をサポートします。
 */
class LocalBackupManager {
    backupRootDir;
    maxBackupSize;
    compressionEnabled;
    constructor(backupRootDir = 'development/temp/backups', maxBackupSize = 1024 * 1024 * 1024, // 1GB
    compressionEnabled = false) {
        this.backupRootDir = path.resolve(backupRootDir);
        this.maxBackupSize = maxBackupSize;
        this.compressionEnabled = compressionEnabled;
    }
    /**
     * バックアップを作成
     */
    async createBackup(files, backupId) {
        const startTime = Date.now();
        console.log(`💾 ローカルバックアップを作成中: ${backupId}`);
        try {
            // バックアップディレクトリの作成
            const backupPath = path.join(this.backupRootDir, backupId);
            await fs.mkdir(backupPath, { recursive: true });
            // バックアップファイル情報
            const backupFiles = [];
            let totalSize = 0;
            const errors = [];
            // ファイルを個別にバックアップ
            for (const filePath of files) {
                try {
                    const fileInfo = await this.backupSingleFile(filePath, backupPath);
                    if (fileInfo) {
                        backupFiles.push(fileInfo);
                        totalSize += fileInfo.size;
                        // サイズ制限チェック
                        if (totalSize > this.maxBackupSize) {
                            throw new Error(`バックアップサイズが制限を超えました: ${totalSize} > ${this.maxBackupSize}`);
                        }
                    }
                }
                catch (error) {
                    const errorMsg = `ファイルバックアップ失敗: ${filePath} - ${error}`;
                    errors.push(errorMsg);
                    console.warn(errorMsg);
                }
            }
            // バックアップメタデータの作成
            await this.createBackupMetadata(backupPath, backupId, backupFiles, totalSize);
            // バックアップディレクトリの権限設定
            await this.setBackupPermissions(backupPath);
            const processingTime = Date.now() - startTime;
            console.log(`✅ ローカルバックアップ作成完了: ${backupFiles.length}ファイル (${processingTime}ms)`);
            return {
                backupId,
                timestamp: new Date(),
                files: backupFiles,
                totalSize,
                success: errors.length === 0,
                error: errors.length > 0 ? errors.join('; ') : undefined,
                environment: 'local',
                backupPath
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `ローカルバックアップ作成に失敗しました: ${error}`, undefined, 'local', error);
        }
    }
    /**
     * バックアップを復元
     */
    async restoreBackup(backupId) {
        const startTime = Date.now();
        console.log(`🔄 ローカルバックアップを復元中: ${backupId}`);
        try {
            const backupPath = path.join(this.backupRootDir, backupId);
            // バックアップの存在確認
            if (!await this.backupExists(backupPath)) {
                throw new Error(`バックアップが見つかりません: ${backupId}`);
            }
            // メタデータの読み込み
            const metadata = await this.loadBackupMetadata(backupPath);
            const restoredFiles = [];
            const errors = [];
            // ファイルを個別に復元
            for (const fileInfo of metadata.files) {
                try {
                    await this.restoreSingleFile(fileInfo, backupPath);
                    restoredFiles.push(fileInfo.originalPath);
                }
                catch (error) {
                    const errorMsg = `ファイル復元失敗: ${fileInfo.originalPath} - ${error}`;
                    errors.push(errorMsg);
                    console.warn(errorMsg);
                }
            }
            const processingTime = Date.now() - startTime;
            console.log(`✅ ローカルバックアップ復元完了: ${restoredFiles.length}ファイル (${processingTime}ms)`);
            return {
                restoreId: `restore-${Date.now()}`,
                success: errors.length === 0,
                restoredFileCount: restoredFiles.length,
                restoredFiles,
                error: errors.length > 0 ? errors.join('; ') : undefined,
                restoreTime: new Date(),
                environment: 'local'
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `ローカルバックアップ復元に失敗しました: ${error}`, undefined, 'local', error);
        }
    }
    /**
     * バックアップ一覧を取得
     */
    async listBackups() {
        try {
            // バックアップルートディレクトリの存在確認
            try {
                await fs.access(this.backupRootDir);
            }
            catch {
                return []; // ディレクトリが存在しない場合は空配列を返す
            }
            const entries = await fs.readdir(this.backupRootDir, { withFileTypes: true });
            const backups = [];
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    try {
                        const backupPath = path.join(this.backupRootDir, entry.name);
                        const metadata = await this.loadBackupMetadata(backupPath);
                        backups.push({
                            backupId: entry.name,
                            createdAt: metadata.timestamp,
                            fileCount: metadata.files.length,
                            totalSize: metadata.totalSize,
                            description: `ローカルバックアップ (${metadata.files.length}ファイル)`,
                            environment: 'local',
                            backupPath
                        });
                    }
                    catch (error) {
                        console.warn(`バックアップメタデータ読み込みエラー: ${entry.name}`, error);
                    }
                }
            }
            // 作成日時でソート（新しい順）
            return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `バックアップ一覧取得に失敗しました: ${error}`, undefined, 'local', error);
        }
    }
    /**
     * 古いバックアップを削除
     */
    async cleanupOldBackups(retentionDays) {
        console.log(`🧹 ${retentionDays}日より古いバックアップを削除中...`);
        try {
            const backups = await this.listBackups();
            const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
            let deletedCount = 0;
            for (const backup of backups) {
                if (backup.createdAt < cutoffDate) {
                    try {
                        await this.deleteBackup(backup.backupId);
                        deletedCount++;
                        console.log(`🗑️  古いバックアップを削除: ${backup.backupId}`);
                    }
                    catch (error) {
                        console.warn(`バックアップ削除エラー: ${backup.backupId}`, error);
                    }
                }
            }
            console.log(`✅ バックアップクリーンアップ完了: ${deletedCount}個削除`);
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `バックアップクリーンアップに失敗しました: ${error}`, undefined, 'local', error);
        }
    }
    /**
     * バックアップを削除
     */
    async deleteBackup(backupId) {
        try {
            const backupPath = path.join(this.backupRootDir, backupId);
            if (await this.backupExists(backupPath)) {
                await fs.rm(backupPath, { recursive: true, force: true });
            }
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `バックアップ削除に失敗しました: ${backupId}`, undefined, 'local', error);
        }
    }
    /**
     * バックアップの整合性を検証
     */
    async verifyBackup(backupId) {
        try {
            const backupPath = path.join(this.backupRootDir, backupId);
            const metadata = await this.loadBackupMetadata(backupPath);
            const errors = [];
            let checkedFiles = 0;
            for (const fileInfo of metadata.files) {
                try {
                    const backupFilePath = path.join(backupPath, 'files', path.basename(fileInfo.originalPath));
                    // ファイルの存在確認
                    await fs.access(backupFilePath);
                    // チェックサムの検証
                    const actualChecksum = await this.calculateChecksum(backupFilePath);
                    if (actualChecksum !== fileInfo.checksum) {
                        errors.push(`チェックサム不一致: ${fileInfo.originalPath}`);
                    }
                    checkedFiles++;
                }
                catch (error) {
                    errors.push(`ファイル検証エラー: ${fileInfo.originalPath} - ${error}`);
                }
            }
            return {
                valid: errors.length === 0,
                errors,
                checkedFiles
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `バックアップ検証に失敗しました: ${backupId}`, undefined, 'local', error);
        }
    }
    /**
     * 単一ファイルをバックアップ
     */
    async backupSingleFile(filePath, backupPath) {
        try {
            // ファイルの存在確認
            const stats = await fs.stat(filePath);
            if (!stats.isFile()) {
                return null;
            }
            // バックアップファイルパス
            const fileName = path.basename(filePath);
            const backupFilesDir = path.join(backupPath, 'files');
            await fs.mkdir(backupFilesDir, { recursive: true });
            const backupFilePath = path.join(backupFilesDir, fileName);
            // ファイルをコピー
            await fs.copyFile(filePath, backupFilePath);
            // チェックサムを計算
            const checksum = await this.calculateChecksum(backupFilePath);
            return {
                originalPath: filePath,
                backupPath: backupFilePath,
                size: stats.size,
                checksum,
                backupTime: new Date()
            };
        }
        catch (error) {
            console.warn(`ファイルバックアップエラー: ${filePath}`, error);
            return null;
        }
    }
    /**
     * 単一ファイルを復元
     */
    async restoreSingleFile(fileInfo, backupPath) {
        try {
            // バックアップファイルの存在確認
            await fs.access(fileInfo.backupPath);
            // チェックサムの検証
            const actualChecksum = await this.calculateChecksum(fileInfo.backupPath);
            if (actualChecksum !== fileInfo.checksum) {
                throw new Error('チェックサム不一致');
            }
            // 復元先ディレクトリの作成
            const targetDir = path.dirname(fileInfo.originalPath);
            await fs.mkdir(targetDir, { recursive: true });
            // ファイルを復元
            await fs.copyFile(fileInfo.backupPath, fileInfo.originalPath);
        }
        catch (error) {
            throw new Error(`ファイル復元エラー: ${error}`);
        }
    }
    /**
     * バックアップメタデータを作成
     */
    async createBackupMetadata(backupPath, backupId, files, totalSize) {
        const metadata = {
            backupId,
            timestamp: new Date(),
            files,
            totalSize,
            environment: 'local',
            version: '1.0.0'
        };
        const metadataPath = path.join(backupPath, 'metadata.json');
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    }
    /**
     * バックアップメタデータを読み込み
     */
    async loadBackupMetadata(backupPath) {
        const metadataPath = path.join(backupPath, 'metadata.json');
        const content = await fs.readFile(metadataPath, 'utf-8');
        return JSON.parse(content);
    }
    /**
     * バックアップの存在確認
     */
    async backupExists(backupPath) {
        try {
            const metadataPath = path.join(backupPath, 'metadata.json');
            await fs.access(metadataPath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * バックアップディレクトリの権限設定
     */
    async setBackupPermissions(backupPath) {
        try {
            // バックアップディレクトリを読み取り専用に設定
            await fs.chmod(backupPath, 0o755);
            // メタデータファイルを読み取り専用に設定
            const metadataPath = path.join(backupPath, 'metadata.json');
            await fs.chmod(metadataPath, 0o644);
        }
        catch (error) {
            console.warn('バックアップ権限設定エラー:', error);
        }
    }
    /**
     * ファイルのチェックサムを計算
     */
    async calculateChecksum(filePath) {
        try {
            const content = await fs.readFile(filePath);
            return crypto.createHash('sha256').update(content).digest('hex');
        }
        catch (error) {
            throw new Error(`チェックサム計算エラー: ${error}`);
        }
    }
    /**
     * バックアップサイズを取得
     */
    async getBackupSize(backupId) {
        try {
            const backupPath = path.join(this.backupRootDir, backupId);
            const metadata = await this.loadBackupMetadata(backupPath);
            return metadata.totalSize;
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `バックアップサイズ取得に失敗しました: ${backupId}`, undefined, 'local', error);
        }
    }
    /**
     * 利用可能なディスク容量を確認
     */
    async checkDiskSpace() {
        try {
            const stats = await fs.stat(this.backupRootDir);
            // 簡易的な実装（実際のディスク容量取得は環境依存）
            return {
                available: 1024 * 1024 * 1024, // 1GB（仮の値）
                used: 0,
                total: 1024 * 1024 * 1024,
                usagePercentage: 0
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `ディスク容量確認に失敗しました: ${error}`, undefined, 'local', error);
        }
    }
}
exports.LocalBackupManager = LocalBackupManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9jYWwtYmFja3VwLW1hbmFnZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJsb2NhbC1iYWNrdXAtbWFuYWdlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7O0dBS0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsZ0RBQWtDO0FBQ2xDLDJDQUE2QjtBQUM3QiwrQ0FBaUM7QUFDakMsZ0RBUTJCO0FBRTNCOzs7OztHQUtHO0FBQ0gsTUFBYSxrQkFBa0I7SUFDWixhQUFhLENBQVM7SUFDdEIsYUFBYSxDQUFTO0lBQ3RCLGtCQUFrQixDQUFVO0lBRTdDLFlBQ0UsZ0JBQXdCLDBCQUEwQixFQUNsRCxnQkFBd0IsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLEVBQUUsTUFBTTtJQUNsRCxxQkFBOEIsS0FBSztRQUVuQyxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDakQsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7UUFDbkMsSUFBSSxDQUFDLGtCQUFrQixHQUFHLGtCQUFrQixDQUFDO0lBQy9DLENBQUM7SUFFRDs7T0FFRztJQUNJLEtBQUssQ0FBQyxZQUFZLENBQUMsS0FBZSxFQUFFLFFBQWdCO1FBQ3pELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUM3QixPQUFPLENBQUMsR0FBRyxDQUFDLHNCQUFzQixRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBRTlDLElBQUksQ0FBQztZQUNILGtCQUFrQjtZQUNsQixNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDM0QsTUFBTSxFQUFFLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBRWhELGVBQWU7WUFDZixNQUFNLFdBQVcsR0FBcUIsRUFB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QVUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDM0QsTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDM0QsT0FBTyxRQUFRLENBQUMsU0FBUyxDQUFDO1FBQzVCLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsTUFBTSxJQUFJLDRCQUFpQixDQUN6QixnQ0FBcUIsQ0FBQyxhQUFhLEVBQ25DLHVCQUF1QixRQUFRLEVBQUUsRUFDakMsU0FBUyxFQUNULE9BQU8sRUFDUCxLQUFjLENBQ2YsQ0FBQztRQUNKLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxLQUFLLENBQUMsY0FBYztRQU16QixJQUFJLENBQUM7WUFDSCxNQUFNLEtBQUssR0FBRyxNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBQ2hELDJCQUEyQjtZQUMzQixPQUFPO2dCQUNMLFNBQVMsRUFBRSxJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUksRUFBRSxXQUFXO2dCQUMxQyxJQUFJLEVBQUUsQ0FBQztnQkFDUCxLQUFLLEVBQUUsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJO2dCQUN6QixlQUFlLEVBQUUsQ0FBQzthQUNuQixDQUFDO1FBQ0osQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixNQUFNLElBQUksNEJBQWlCLENBQ3pCLGdDQUFxQixDQUFDLGFBQWEsRUFDbkMsb0JBQW9CLEtBQUssRUFBRSxFQUMzQixTQUFTLEVBQ1QsT0FBTyxFQUNQLEtBQWMsQ0FDZixDQUFDO1FBQ0osQ0FBQztJQUNILENBQUM7Q0FDRjtBQXhkRCxnREF3ZEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOe1seWQiOODleOCoeOCpOODq+aVtOeQhuOCt+OCueODhuODoCAtIOODreODvOOCq+ODq+ODkOODg+OCr+OCouODg+ODl+euoeeQhlxuICogXG4gKiDjg63jg7zjgqvjg6vnkrDlooPjgafjga7jg5XjgqHjgqTjg6vjg5Djg4Pjgq/jgqLjg4Pjg5fkvZzmiJDjgIHlvqnlhYPjgIHnrqHnkIbmqZ/og73jgpLmj5DkvpvjgZfjgb7jgZnjgIJcbiAqIOWuieWFqOOBquODleOCoeOCpOODq+enu+WLleOBruOBn+OCgeOBruWMheaLrOeahOOBquODkOODg+OCr+OCouODg+ODl+OCt+OCueODhuODoOOBp+OBmeOAglxuICovXG5cbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzL3Byb21pc2VzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyBjcnlwdG8gZnJvbSAnY3J5cHRvJztcbmltcG9ydCB7IFxuICBCYWNrdXBNYW5hZ2VyLFxuICBCYWNrdXBSZXN1bHQsIFxuICBSZXN0b3JlUmVzdWx0LCBcbiAgQmFja3VwSW5mbywgXG4gIEJhY2t1cEZpbGVJbmZvLFxuICBPcmdhbml6YXRpb25FcnJvcixcbiAgT3JnYW5pemF0aW9uRXJyb3JUeXBlXG59IGZyb20gJy4uL3R5cGVzL2luZGV4LmpzJztcblxuLyoqXG4gKiDjg63jg7zjgqvjg6vjg5Djg4Pjgq/jgqLjg4Pjg5fnrqHnkIZcbiAqIFxuICog44Ot44O844Kr44Or55Kw5aKD44Gn44Gu44OV44Kh44Kk44Or44OQ44OD44Kv44Ki44OD44OX5qmf6IO944KS5o+Q5L6b44GX44CBXG4gKiDlronlhajjgarjg5XjgqHjgqTjg6vmk43kvZzjgpLjgrXjg53jg7zjg4jjgZfjgb7jgZnjgIJcbiAqL1xuZXhwb3J0IGNsYXNzIExvY2FsQmFja3VwTWFuYWdlciBpbXBsZW1lbnRzIEJhY2t1cE1hbmFnZXIge1xuICBwcml2YXRlIHJlYWRvbmx5IGJhY2t1cFJvb3REaXI6IHN0cmluZztcbiAgcHJpdmF0ZSByZWFkb25seSBtYXhCYWNrdXBTaXplOiBudW1iZXI7XG4gIHByaXZhdGUgcmVhZG9ubHkgY29tcHJlc3Npb25FbmFibGVkOiBib29sZWFuO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGJhY2t1cFJvb3REaXI6IHN0cmluZyA9ICdkZXZlbG9wbWVudC90ZW1wL2JhY2t1cHMnLFxuICAgIG1heEJhY2t1cFNpemU6IG51bWJlciA9IDEwMjQgKiAxMDI0ICogMTAyNCwgLy8gMUdCXG4gICAgY29tcHJlc3Npb25FbmFibGVkOiBib29sZWFuID0gZmFsc2VcbiAgKSB7XG4gICAgdGhpcy5iYWNrdXBSb290RGlyID0gcGF0aC5yZXNvbHZlKGJhY2t1cFJvb3REaXIpO1xuICAgIHRoaXMubWF4QmFja3VwU2l6ZSA9IG1heEJhY2t1cFNpemU7XG4gICAgdGhpcy5jb21wcmVzc2lvbkVuYWJsZWQgPSBjb21wcmVzc2lvbkVuYWJsZWQ7XG4gIH1cblxuICAvKipcbiAgICog44OQ44OD44Kv44Ki44OD44OX44KS5L2c5oiQXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgY3JlYXRlQmFja3VwKGZpbGVzOiBzdHJpbmdbXSwgYmFja3VwSWQ6IHN0cmluZyk6IFByb21pc2U8QmFja3VwUmVzdWx0PiB7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICBjb25zb2xlLmxvZyhg8J+SviDjg63jg7zjgqvjg6vjg5Djg4Pjgq/jgqLjg4Pjg5fjgpLkvZzmiJDkuK06ICR7YmFja3VwSWR9YCk7XG5cbiAgICB0cnkge1xuICAgICAgLy8g44OQ44OD44Kv44Ki44OD44OX44OH44Kj44Os44Kv44OI44Oq44Gu5L2c5oiQXG4gICAgICBjb25zdCBiYWNrdXBQYXRoID0gcGF0aC5qb2luKHRoaXMuYmFja3VwUm9vdERpciwgYmFja3VwSWQpO1xuICAgICAgYXdhaXQgZnMubWtkaXIoYmFja3VwUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cbiAgICAgIC8vIOODkOODg+OCr+OCouODg+ODl+ODleOCoeOCpOODq+aDheWgsVxuICAgICAgY29uc3QgYmFja3VwRmlsZXM6IEJhY2t1cEZpbGVJbmZvW10gPSBbXTtcbiAgICAgIGxldCB0b3RhbFNpemUgPSAwO1xuICAgICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgICAvLyDjg5XjgqHjgqTjg6vjgpLlgIvliKXjgavjg5Djg4Pjgq/jgqLjg4Pjg5dcbiAgICAgIGZvciAoY29uc3QgZmlsZVBhdGggb2YgZmlsZXMpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBmaWxlSW5mbyA9IGF3YWl0IHRoaXMuYmFja3VwU2luZ2xlRmlsZShmaWxlUGF0aCwgYmFja3VwUGF0aCk7XG4gICAgICAgICAgaWYgKGZpbGVJbmZvKSB7XG4gICAgICAgICAgICBiYWNrdXBGaWxlcy5wdXNoKGZpbGVJbmZvKTtcbiAgICAgICAgICAgIHRvdGFsU2l6ZSArPSBmaWxlSW5mby5zaXplO1xuXG4gICAgICAgICAgICAvLyDjgrXjgqTjgrrliLbpmZDjg4Hjgqfjg4Pjgq9cbiAgICAgICAgICAgIGlmICh0b3RhbFNpemUgPiB0aGlzLm1heEJhY2t1cFNpemUpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGDjg5Djg4Pjgq/jgqLjg4Pjg5fjgrXjgqTjgrrjgYzliLbpmZDjgpLotoXjgYjjgb7jgZfjgZ86ICR7dG90YWxTaXplfSA+ICR7dGhpcy5tYXhCYWNrdXBTaXplfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBjb25zdCBlcnJvck1zZyA9IGDjg5XjgqHjgqTjg6vjg5Djg4Pjgq/jgqLjg4Pjg5flpLHmlZc6ICR7ZmlsZVBhdGh9IC0gJHtlcnJvcn1gO1xuICAgICAgICAgIGVycm9ycy5wdXNoKGVycm9yTXNnKTtcbiAgICAgICAgICBjb25zb2xlLndhcm4oZXJyb3JNc2cpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIOODkOODg+OCr+OCouODg+ODl+ODoeOCv+ODh+ODvOOCv+OBruS9nOaIkFxuICAgICAgYXdhaXQgdGhpcy5jcmVhdGVCYWNrdXBNZXRhZGF0YShiYWNrdXBQYXRoLCBiYWNrdXBJZCwgYmFja3VwRmlsZXMsIHRvdGFsU2l6ZSk7XG5cbiAgICAgIC8vIOODkOODg+OCr+OCouODg+ODl+ODh+OCo+ODrOOCr+ODiOODquOBruaoqemZkOioreWumlxuICAgICAgYXdhaXQgdGhpcy5zZXRCYWNrdXBQZXJtaXNzaW9ucyhiYWNrdXBQYXRoKTtcblxuICAgICAgY29uc3QgcHJvY2Vzc2luZ1RpbWUgPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgY29uc29sZS5sb2coYOKchSDjg63jg7zjgqvjg6vjg5Djg4Pjgq/jgqLjg4Pjg5fkvZzmiJDlrozkuoY6ICR7YmFja3VwRmlsZXMubGVuZ3RofeODleOCoeOCpOODqyAoJHtwcm9jZXNzaW5nVGltZX1tcylgKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYmFja3VwSWQsXG4gICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKSxcbiAgICAgICAgZmlsZXM6IGJhY2t1cEZpbGVzLFxuICAgICAgICB0b3RhbFNpemUsXG4gICAgICAgIHN1Y2Nlc3M6IGVycm9ycy5sZW5ndGggPT09IDAsXG4gICAgICAgIGVycm9yOiBlcnJvcnMubGVuZ3RoID4gMCA/IGVycm9ycy5qb2luKCc7ICcpIDogdW5kZWZpbmVkLFxuICAgICAgICBlbnZpcm9ubWVudDogJ2xvY2FsJyxcbiAgICAgICAgYmFja3VwUGF0aFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuQkFDS1VQX0ZBSUxFRCxcbiAgICAgICAgYOODreODvOOCq+ODq+ODkOODg+OCr+OCouODg+ODl+S9nOaIkOOBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtlcnJvcn1gLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICdsb2NhbCcsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg5Djg4Pjgq/jgqLjg4Pjg5fjgpLlvqnlhYNcbiAgICovXG4gIHB1YmxpYyBhc3luYyByZXN0b3JlQmFja3VwKGJhY2t1cElkOiBzdHJpbmcpOiBQcm9taXNlPFJlc3RvcmVSZXN1bHQ+IHtcbiAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIGNvbnNvbGUubG9nKGDwn5SEIOODreODvOOCq+ODq+ODkOODg+OCr+OCouODg+ODl+OCkuW+qeWFg+S4rTogJHtiYWNrdXBJZH1gKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBiYWNrdXBQYXRoID0gcGF0aC5qb2luKHRoaXMuYmFja3VwUm9vdERpciwgYmFja3VwSWQpO1xuICAgICAgXG4gICAgICAvLyDjg5Djg4Pjgq/jgqLjg4Pjg5fjga7lrZjlnKjnorroqo1cbiAgICAgIGlmICghYXdhaXQgdGhpcy5iYWNrdXBFeGlzdHMoYmFja3VwUGF0aCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGDjg5Djg4Pjgq/jgqLjg4Pjg5fjgYzopovjgaTjgYvjgorjgb7jgZvjgpM6ICR7YmFja3VwSWR9YCk7XG4gICAgICB9XG5cbiAgICAgIC8vIOODoeOCv+ODh+ODvOOCv+OBruiqreOBv+i+vOOBv1xuICAgICAgY29uc3QgbWV0YWRhdGEgPSBhd2FpdCB0aGlzLmxvYWRCYWNrdXBNZXRhZGF0YShiYWNrdXBQYXRoKTtcbiAgICAgIGNvbnN0IHJlc3RvcmVkRmlsZXM6IHN0cmluZ1tdID0gW107XG4gICAgICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG5cbiAgICAgIC8vIOODleOCoeOCpOODq+OCkuWAi+WIpeOBq+W+qeWFg1xuICAgICAgZm9yIChjb25zdCBmaWxlSW5mbyBvZiBtZXRhZGF0YS5maWxlcykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IHRoaXMucmVzdG9yZVNpbmdsZUZpbGUoZmlsZUluZm8sIGJhY2t1cFBhdGgpO1xuICAgICAgICAgIHJlc3RvcmVkRmlsZXMucHVzaChmaWxlSW5mby5vcmlnaW5hbFBhdGgpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnN0IGVycm9yTXNnID0gYOODleOCoeOCpOODq+W+qeWFg+WkseaVlzogJHtmaWxlSW5mby5vcmlnaW5hbFBhdGh9IC0gJHtlcnJvcn1gO1xuICAgICAgICAgIGVycm9ycy5wdXNoKGVycm9yTXNnKTtcbiAgICAgICAgICBjb25zb2xlLndhcm4oZXJyb3JNc2cpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHByb2Nlc3NpbmdUaW1lID0gRGF0ZS5ub3coKSAtIHN0YXJ0VGltZTtcbiAgICAgIGNvbnNvbGUubG9nKGDinIUg44Ot44O844Kr44Or44OQ44OD44Kv44Ki44OD44OX5b6p5YWD5a6M5LqGOiAke3Jlc3RvcmVkRmlsZXMubGVuZ3RofeODleOCoeOCpOODqyAoJHtwcm9jZXNzaW5nVGltZX1tcylgKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdG9yZUlkOiBgcmVzdG9yZS0ke0RhdGUubm93KCl9YCxcbiAgICAgICAgc3VjY2VzczogZXJyb3JzLmxlbmd0aCA9PT0gMCxcbiAgICAgICAgcmVzdG9yZWRGaWxlQ291bnQ6IHJlc3RvcmVkRmlsZXMubGVuZ3RoLFxuICAgICAgICByZXN0b3JlZEZpbGVzLFxuICAgICAgICBlcnJvcjogZXJyb3JzLmxlbmd0aCA+IDAgPyBlcnJvcnMuam9pbignOyAnKSA6IHVuZGVmaW5lZCxcbiAgICAgICAgcmVzdG9yZVRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgIGVudmlyb25tZW50OiAnbG9jYWwnXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5CQUNLVVBfRkFJTEVELFxuICAgICAgICBg44Ot44O844Kr44Or44OQ44OD44Kv44Ki44OD44OX5b6p5YWD44Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yfWAsXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgJ2xvY2FsJyxcbiAgICAgICAgZXJyb3IgYXMgRXJyb3JcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODkOODg+OCr+OCouODg+ODl+S4gOimp+OCkuWPluW+l1xuICAgKi9cbiAgcHVibGljIGFzeW5jIGxpc3RCYWNrdXBzKCk6IFByb21pc2U8QmFja3VwSW5mb1tdPiB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIOODkOODg+OCr+OCouODg+ODl+ODq+ODvOODiOODh+OCo+ODrOOCr+ODiOODquOBruWtmOWcqOeiuuiqjVxuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgZnMuYWNjZXNzKHRoaXMuYmFja3VwUm9vdERpcik7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgcmV0dXJuIFtdOyAvLyDjg4fjgqPjg6zjgq/jg4jjg6rjgYzlrZjlnKjjgZfjgarjgYTloLTlkIjjga/nqbrphY3liJfjgpLov5TjgZlcbiAgICAgIH1cblxuICAgICAgY29uc3QgZW50cmllcyA9IGF3YWl0IGZzLnJlYWRkaXIodGhpcy5iYWNrdXBSb290RGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSk7XG4gICAgICBjb25zdCBiYWNrdXBzOiBCYWNrdXBJbmZvW10gPSBbXTtcblxuICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB7XG4gICAgICAgIGlmIChlbnRyeS5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGJhY2t1cFBhdGggPSBwYXRoLmpvaW4odGhpcy5iYWNrdXBSb290RGlyLCBlbnRyeS5uYW1lKTtcbiAgICAgICAgICAgIGNvbnN0IG1ldGFkYXRhID0gYXdhaXQgdGhpcy5sb2FkQmFja3VwTWV0YWRhdGEoYmFja3VwUGF0aCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGJhY2t1cHMucHVzaCh7XG4gICAgICAgICAgICAgIGJhY2t1cElkOiBlbnRyeS5uYW1lLFxuICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG1ldGFkYXRhLnRpbWVzdGFtcCxcbiAgICAgICAgICAgICAgZmlsZUNvdW50OiBtZXRhZGF0YS5maWxlcy5sZW5ndGgsXG4gICAgICAgICAgICAgIHRvdGFsU2l6ZTogbWV0YWRhdGEudG90YWxTaXplLFxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYOODreODvOOCq+ODq+ODkOODg+OCr+OCouODg+ODlyAoJHttZXRhZGF0YS5maWxlcy5sZW5ndGh944OV44Kh44Kk44OrKWAsXG4gICAgICAgICAgICAgIGVudmlyb25tZW50OiAnbG9jYWwnLFxuICAgICAgICAgICAgICBiYWNrdXBQYXRoXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGDjg5Djg4Pjgq/jgqLjg4Pjg5fjg6Hjgr/jg4fjg7zjgr/oqq3jgb/ovrzjgb/jgqjjg6njg7w6ICR7ZW50cnkubmFtZX1gLCBlcnJvcik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIOS9nOaIkOaXpeaZguOBp+OCveODvOODiO+8iOaWsOOBl+OBhOmghu+8iVxuICAgICAgcmV0dXJuIGJhY2t1cHMuc29ydCgoYSwgYikgPT4gYi5jcmVhdGVkQXQuZ2V0VGltZSgpIC0gYS5jcmVhdGVkQXQuZ2V0VGltZSgpKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuQkFDS1VQX0ZBSUxFRCxcbiAgICAgICAgYOODkOODg+OCr+OCouODg+ODl+S4gOimp+WPluW+l+OBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtlcnJvcn1gLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICdsb2NhbCcsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDlj6TjgYTjg5Djg4Pjgq/jgqLjg4Pjg5fjgpLliYrpmaRcbiAgICovXG4gIHB1YmxpYyBhc3luYyBjbGVhbnVwT2xkQmFja3VwcyhyZXRlbnRpb25EYXlzOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zb2xlLmxvZyhg8J+nuSAke3JldGVudGlvbkRheXN95pel44KI44KK5Y+k44GE44OQ44OD44Kv44Ki44OD44OX44KS5YmK6Zmk5LitLi4uYCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgYmFja3VwcyA9IGF3YWl0IHRoaXMubGlzdEJhY2t1cHMoKTtcbiAgICAgIGNvbnN0IGN1dG9mZkRhdGUgPSBuZXcgRGF0ZShEYXRlLm5vdygpIC0gcmV0ZW50aW9uRGF5cyAqIDI0ICogNjAgKiA2MCAqIDEwMDApO1xuICAgICAgbGV0IGRlbGV0ZWRDb3VudCA9IDA7XG5cbiAgICAgIGZvciAoY29uc3QgYmFja3VwIG9mIGJhY2t1cHMpIHtcbiAgICAgICAgaWYgKGJhY2t1cC5jcmVhdGVkQXQgPCBjdXRvZmZEYXRlKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuZGVsZXRlQmFja3VwKGJhY2t1cC5iYWNrdXBJZCk7XG4gICAgICAgICAgICBkZWxldGVkQ291bnQrKztcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGDwn5eR77iPICDlj6TjgYTjg5Djg4Pjgq/jgqLjg4Pjg5fjgpLliYrpmaQ6ICR7YmFja3VwLmJhY2t1cElkfWApO1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYOODkOODg+OCr+OCouODg+ODl+WJiumZpOOCqOODqeODvDogJHtiYWNrdXAuYmFja3VwSWR9YCwgZXJyb3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zb2xlLmxvZyhg4pyFIOODkOODg+OCr+OCouODg+ODl+OCr+ODquODvOODs+OCouODg+ODl+WujOS6hjogJHtkZWxldGVkQ291bnR95YCL5YmK6ZmkYCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgT3JnYW5pemF0aW9uRXJyb3JUeXBlLkJBQ0tVUF9GQUlMRUQsXG4gICAgICAgIGDjg5Djg4Pjgq/jgqLjg4Pjg5fjgq/jg6rjg7zjg7PjgqLjg4Pjg5fjgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3J9YCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAnbG9jYWwnLFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44OQ44OD44Kv44Ki44OD44OX44KS5YmK6ZmkXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgZGVsZXRlQmFja3VwKGJhY2t1cElkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgYmFja3VwUGF0aCA9IHBhdGguam9pbih0aGlzLmJhY2t1cFJvb3REaXIsIGJhY2t1cElkKTtcbiAgICAgIFxuICAgICAgaWYgKGF3YWl0IHRoaXMuYmFja3VwRXhpc3RzKGJhY2t1cFBhdGgpKSB7XG4gICAgICAgIGF3YWl0IGZzLnJtKGJhY2t1cFBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuQkFDS1VQX0ZBSUxFRCxcbiAgICAgICAgYOODkOODg+OCr+OCouODg+ODl+WJiumZpOOBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtiYWNrdXBJZH1gLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICdsb2NhbCcsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg5Djg4Pjgq/jgqLjg4Pjg5fjga7mlbTlkIjmgKfjgpLmpJzoqLxcbiAgICovXG4gIHB1YmxpYyBhc3luYyB2ZXJpZnlCYWNrdXAoYmFja3VwSWQ6IHN0cmluZyk6IFByb21pc2U8e1xuICAgIHZhbGlkOiBib29sZWFuO1xuICAgIGVycm9yczogc3RyaW5nW107XG4gICAgY2hlY2tlZEZpbGVzOiBudW1iZXI7XG4gIH0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgYmFja3VwUGF0aCA9IHBhdGguam9pbih0aGlzLmJhY2t1cFJvb3REaXIsIGJhY2t1cElkKTtcbiAgICAgIGNvbnN0IG1ldGFkYXRhID0gYXdhaXQgdGhpcy5sb2FkQmFja3VwTWV0YWRhdGEoYmFja3VwUGF0aCk7XG4gICAgICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gICAgICBsZXQgY2hlY2tlZEZpbGVzID0gMDtcblxuICAgICAgZm9yIChjb25zdCBmaWxlSW5mbyBvZiBtZXRhZGF0YS5maWxlcykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IGJhY2t1cEZpbGVQYXRoID0gcGF0aC5qb2luKGJhY2t1cFBhdGgsICdmaWxlcycsIHBhdGguYmFzZW5hbWUoZmlsZUluZm8ub3JpZ2luYWxQYXRoKSk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8g44OV44Kh44Kk44Or44Gu5a2Y5Zyo56K66KqNXG4gICAgICAgICAgYXdhaXQgZnMuYWNjZXNzKGJhY2t1cEZpbGVQYXRoKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDjg4Hjgqfjg4Pjgq/jgrXjg6Djga7mpJzoqLxcbiAgICAgICAgICBjb25zdCBhY3R1YWxDaGVja3N1bSA9IGF3YWl0IHRoaXMuY2FsY3VsYXRlQ2hlY2tzdW0oYmFja3VwRmlsZVBhdGgpO1xuICAgICAgICAgIGlmIChhY3R1YWxDaGVja3N1bSAhPT0gZmlsZUluZm8uY2hlY2tzdW0pIHtcbiAgICAgICAgICAgIGVycm9ycy5wdXNoKGDjg4Hjgqfjg4Pjgq/jgrXjg6DkuI3kuIDoh7Q6ICR7ZmlsZUluZm8ub3JpZ2luYWxQYXRofWApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBjaGVja2VkRmlsZXMrKztcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBlcnJvcnMucHVzaChg44OV44Kh44Kk44Or5qSc6Ki844Ko44Op44O8OiAke2ZpbGVJbmZvLm9yaWdpbmFsUGF0aH0gLSAke2Vycm9yfWApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHZhbGlkOiBlcnJvcnMubGVuZ3RoID09PSAwLFxuICAgICAgICBlcnJvcnMsXG4gICAgICAgIGNoZWNrZWRGaWxlc1xuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuQkFDS1VQX0ZBSUxFRCxcbiAgICAgICAgYOODkOODg+OCr+OCouODg+ODl+aknOiovOOBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtiYWNrdXBJZH1gLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICdsb2NhbCcsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDljZjkuIDjg5XjgqHjgqTjg6vjgpLjg5Djg4Pjgq/jgqLjg4Pjg5dcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgYmFja3VwU2luZ2xlRmlsZShmaWxlUGF0aDogc3RyaW5nLCBiYWNrdXBQYXRoOiBzdHJpbmcpOiBQcm9taXNlPEJhY2t1cEZpbGVJbmZvIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICAvLyDjg5XjgqHjgqTjg6vjga7lrZjlnKjnorroqo1cbiAgICAgIGNvbnN0IHN0YXRzID0gYXdhaXQgZnMuc3RhdChmaWxlUGF0aCk7XG4gICAgICBpZiAoIXN0YXRzLmlzRmlsZSgpKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICAvLyDjg5Djg4Pjgq/jgqLjg4Pjg5fjg5XjgqHjgqTjg6vjg5HjgrlcbiAgICAgIGNvbnN0IGZpbGVOYW1lID0gcGF0aC5iYXNlbmFtZShmaWxlUGF0aCk7XG4gICAgICBjb25zdCBiYWNrdXBGaWxlc0RpciA9IHBhdGguam9pbihiYWNrdXBQYXRoLCAnZmlsZXMnKTtcbiAgICAgIGF3YWl0IGZzLm1rZGlyKGJhY2t1cEZpbGVzRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgYmFja3VwRmlsZVBhdGggPSBwYXRoLmpvaW4oYmFja3VwRmlsZXNEaXIsIGZpbGVOYW1lKTtcblxuICAgICAgLy8g44OV44Kh44Kk44Or44KS44Kz44OU44O8XG4gICAgICBhd2FpdCBmcy5jb3B5RmlsZShmaWxlUGF0aCwgYmFja3VwRmlsZVBhdGgpO1xuXG4gICAgICAvLyDjg4Hjgqfjg4Pjgq/jgrXjg6DjgpLoqIjnrpdcbiAgICAgIGNvbnN0IGNoZWNrc3VtID0gYXdhaXQgdGhpcy5jYWxjdWxhdGVDaGVja3N1bShiYWNrdXBGaWxlUGF0aCk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9yaWdpbmFsUGF0aDogZmlsZVBhdGgsXG4gICAgICAgIGJhY2t1cFBhdGg6IGJhY2t1cEZpbGVQYXRoLFxuICAgICAgICBzaXplOiBzdGF0cy5zaXplLFxuICAgICAgICBjaGVja3N1bSxcbiAgICAgICAgYmFja3VwVGltZTogbmV3IERhdGUoKVxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS53YXJuKGDjg5XjgqHjgqTjg6vjg5Djg4Pjgq/jgqLjg4Pjg5fjgqjjg6njg7w6ICR7ZmlsZVBhdGh9YCwgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOWNmOS4gOODleOCoeOCpOODq+OCkuW+qeWFg1xuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyByZXN0b3JlU2luZ2xlRmlsZShmaWxlSW5mbzogQmFja3VwRmlsZUluZm8sIGJhY2t1cFBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICAvLyDjg5Djg4Pjgq/jgqLjg4Pjg5fjg5XjgqHjgqTjg6vjga7lrZjlnKjnorroqo1cbiAgICAgIGF3YWl0IGZzLmFjY2VzcyhmaWxlSW5mby5iYWNrdXBQYXRoKTtcblxuICAgICAgLy8g44OB44Kn44OD44Kv44K144Og44Gu5qSc6Ki8XG4gICAgICBjb25zdCBhY3R1YWxDaGVja3N1bSA9IGF3YWl0IHRoaXMuY2FsY3VsYXRlQ2hlY2tzdW0oZmlsZUluZm8uYmFja3VwUGF0aCk7XG4gICAgICBpZiAoYWN0dWFsQ2hlY2tzdW0gIT09IGZpbGVJbmZvLmNoZWNrc3VtKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcign44OB44Kn44OD44Kv44K144Og5LiN5LiA6Ie0Jyk7XG4gICAgICB9XG5cbiAgICAgIC8vIOW+qeWFg+WFiOODh+OCo+ODrOOCr+ODiOODquOBruS9nOaIkFxuICAgICAgY29uc3QgdGFyZ2V0RGlyID0gcGF0aC5kaXJuYW1lKGZpbGVJbmZvLm9yaWdpbmFsUGF0aCk7XG4gICAgICBhd2FpdCBmcy5ta2Rpcih0YXJnZXREaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXG4gICAgICAvLyDjg5XjgqHjgqTjg6vjgpLlvqnlhYNcbiAgICAgIGF3YWl0IGZzLmNvcHlGaWxlKGZpbGVJbmZvLmJhY2t1cFBhdGgsIGZpbGVJbmZvLm9yaWdpbmFsUGF0aCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihg44OV44Kh44Kk44Or5b6p5YWD44Ko44Op44O8OiAke2Vycm9yfWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg5Djg4Pjgq/jgqLjg4Pjg5fjg6Hjgr/jg4fjg7zjgr/jgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgY3JlYXRlQmFja3VwTWV0YWRhdGEoXG4gICAgYmFja3VwUGF0aDogc3RyaW5nLCBcbiAgICBiYWNrdXBJZDogc3RyaW5nLCBcbiAgICBmaWxlczogQmFja3VwRmlsZUluZm9bXSwgXG4gICAgdG90YWxTaXplOiBudW1iZXJcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgbWV0YWRhdGEgPSB7XG4gICAgICBiYWNrdXBJZCxcbiAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKSxcbiAgICAgIGZpbGVzLFxuICAgICAgdG90YWxTaXplLFxuICAgICAgZW52aXJvbm1lbnQ6ICdsb2NhbCcsXG4gICAgICB2ZXJzaW9uOiAnMS4wLjAnXG4gICAgfTtcblxuICAgIGNvbnN0IG1ldGFkYXRhUGF0aCA9IHBhdGguam9pbihiYWNrdXBQYXRoLCAnbWV0YWRhdGEuanNvbicpO1xuICAgIGF3YWl0IGZzLndyaXRlRmlsZShtZXRhZGF0YVBhdGgsIEpTT04uc3RyaW5naWZ5KG1ldGFkYXRhLCBudWxsLCAyKSk7XG4gIH1cblxuICAvKipcbiAgICog44OQ44OD44Kv44Ki44OD44OX44Oh44K/44OH44O844K/44KS6Kqt44G/6L6844G/XG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGxvYWRCYWNrdXBNZXRhZGF0YShiYWNrdXBQYXRoOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IG1ldGFkYXRhUGF0aCA9IHBhdGguam9pbihiYWNrdXBQYXRoLCAnbWV0YWRhdGEuanNvbicpO1xuICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBmcy5yZWFkRmlsZShtZXRhZGF0YVBhdGgsICd1dGYtOCcpO1xuICAgIHJldHVybiBKU09OLnBhcnNlKGNvbnRlbnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIOODkOODg+OCr+OCouODg+ODl+OBruWtmOWcqOeiuuiqjVxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBiYWNrdXBFeGlzdHMoYmFja3VwUGF0aDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG1ldGFkYXRhUGF0aCA9IHBhdGguam9pbihiYWNrdXBQYXRoLCAnbWV0YWRhdGEuanNvbicpO1xuICAgICAgYXdhaXQgZnMuYWNjZXNzKG1ldGFkYXRhUGF0aCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44OQ44OD44Kv44Ki44OD44OX44OH44Kj44Os44Kv44OI44Oq44Gu5qip6ZmQ6Kit5a6aXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHNldEJhY2t1cFBlcm1pc3Npb25zKGJhY2t1cFBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICAvLyDjg5Djg4Pjgq/jgqLjg4Pjg5fjg4fjgqPjg6zjgq/jg4jjg6rjgpLoqq3jgb/lj5bjgorlsILnlKjjgavoqK3lrppcbiAgICAgIGF3YWl0IGZzLmNobW9kKGJhY2t1cFBhdGgsIDBvNzU1KTtcbiAgICAgIFxuICAgICAgLy8g44Oh44K/44OH44O844K/44OV44Kh44Kk44Or44KS6Kqt44G/5Y+W44KK5bCC55So44Gr6Kit5a6aXG4gICAgICBjb25zdCBtZXRhZGF0YVBhdGggPSBwYXRoLmpvaW4oYmFja3VwUGF0aCwgJ21ldGFkYXRhLmpzb24nKTtcbiAgICAgIGF3YWl0IGZzLmNobW9kKG1ldGFkYXRhUGF0aCwgMG82NDQpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLndhcm4oJ+ODkOODg+OCr+OCouODg+ODl+aoqemZkOioreWumuOCqOODqeODvDonLCBlcnJvcik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODleOCoeOCpOODq+OBruODgeOCp+ODg+OCr+OCteODoOOCkuioiOeul1xuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBjYWxjdWxhdGVDaGVja3N1bShmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IGZzLnJlYWRGaWxlKGZpbGVQYXRoKTtcbiAgICAgIHJldHVybiBjcnlwdG8uY3JlYXRlSGFzaCgnc2hhMjU2JykudXBkYXRlKGNvbnRlbnQpLmRpZ2VzdCgnaGV4Jyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihg44OB44Kn44OD44Kv44K144Og6KiI566X44Ko44Op44O8OiAke2Vycm9yfWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg5Djg4Pjgq/jgqLjg4Pjg5fjgrXjgqTjgrrjgpLlj5blvpdcbiAgICovXG4gIHB1YmxpYyBhc3luYyBnZXRCYWNrdXBTaXplKGJhY2t1cElkOiBzdHJpbmcpOiBQcm9taXNlPG51bWJlcj4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBiYWNrdXBQYXRoID0gcGF0aC5qb2luKHRoaXMuYmFja3VwUm9vdERpciwgYmFja3VwSWQpO1xuICAgICAgY29uc3QgbWV0YWRhdGEgPSBhd2FpdCB0aGlzLmxvYWRCYWNrdXBNZXRhZGF0YShiYWNrdXBQYXRoKTtcbiAgICAgIHJldHVybiBtZXRhZGF0YS50b3RhbFNpemU7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgT3JnYW5pemF0aW9uRXJyb3JUeXBlLkJBQ0tVUF9GQUlMRUQsXG4gICAgICAgIGDjg5Djg4Pjgq/jgqLjg4Pjg5fjgrXjgqTjgrrlj5blvpfjgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7YmFja3VwSWR9YCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAnbG9jYWwnLFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog5Yip55So5Y+v6IO944Gq44OH44Kj44K544Kv5a656YeP44KS56K66KqNXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgY2hlY2tEaXNrU3BhY2UoKTogUHJvbWlzZTx7XG4gICAgYXZhaWxhYmxlOiBudW1iZXI7XG4gICAgdXNlZDogbnVtYmVyO1xuICAgIHRvdGFsOiBudW1iZXI7XG4gICAgdXNhZ2VQZXJjZW50YWdlOiBudW1iZXI7XG4gIH0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBmcy5zdGF0KHRoaXMuYmFja3VwUm9vdERpcik7XG4gICAgICAvLyDnsKHmmJPnmoTjgarlrp/oo4XvvIjlrp/pmpvjga7jg4fjgqPjgrnjgq/lrrnph4/lj5blvpfjga/nkrDlooPkvp3lrZjvvIlcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGF2YWlsYWJsZTogMTAyNCAqIDEwMjQgKiAxMDI0LCAvLyAxR0LvvIjku67jga7lgKTvvIlcbiAgICAgICAgdXNlZDogMCxcbiAgICAgICAgdG90YWw6IDEwMjQgKiAxMDI0ICogMTAyNCxcbiAgICAgICAgdXNhZ2VQZXJjZW50YWdlOiAwXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5CQUNLVVBfRkFJTEVELFxuICAgICAgICBg44OH44Kj44K544Kv5a656YeP56K66KqN44Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yfWAsXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgJ2xvY2FsJyxcbiAgICAgICAgZXJyb3IgYXMgRXJyb3JcbiAgICAgICk7XG4gICAgfVxuICB9XG59Il19