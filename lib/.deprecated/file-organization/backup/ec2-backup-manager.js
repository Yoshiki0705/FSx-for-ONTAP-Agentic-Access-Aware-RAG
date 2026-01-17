"use strict";
/**
 * 統合ファイル整理システム - EC2バックアップ管理
 *
 * EC2環境でのSSH接続によるリモートファイルバックアップ作成、復元、管理機能を提供します。
 * SSH経由での安全なファイル操作をサポートします。
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
exports.EC2BackupManager = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const index_js_1 = require("../types/index.js");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * EC2バックアップ管理
 *
 * SSH接続を使用してEC2環境でのファイルバックアップ機能を提供し、
 * リモート環境での安全なファイル操作をサポートします。
 */
class EC2BackupManager {
    sshConfig;
    backupRootDir;
    maxBackupSize;
    constructor(sshConfig, backupRootDir = '/home/ubuntu/backups', maxBackupSize = 1024 * 1024 * 1024 // 1GB
    ) {
        this.sshConfig = {
            port: 22,
            timeout: 30000,
            ...sshConfig
        };
        this.backupRootDir = backupRootDir;
        this.maxBackupSize = maxBackupSize;
    }
    /**
     * バックアップを作成
     */
    async createBackup(files, backupId) {
        const startTime = Date.now();
        console.log(`💾 EC2バックアップを作成中: ${backupId}`);
        try {
            // リモートバックアップディレクトリの作成
            const backupPath = path.posix.join(this.backupRootDir, backupId);
            const escapedBackupPath = this.escapeFilePath(backupPath);
            await this.executeSSHCommand(`mkdir -p ${escapedBackupPath}/files`);
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
            console.log(`✅ EC2バックアップ作成完了: ${backupFiles.length}ファイル (${processingTime}ms)`);
            return {
                backupId,
                timestamp: new Date(),
                files: backupFiles,
                totalSize,
                success: errors.length === 0,
                error: errors.length > 0 ? errors.join('; ') : undefined,
                environment: 'ec2',
                backupPath
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `EC2バックアップ作成に失敗しました: ${error}`, undefined, 'ec2', error);
        }
    }
    /**
     * バックアップを復元
     */
    async restoreBackup(backupId) {
        const startTime = Date.now();
        console.log(`🔄 EC2バックアップを復元中: ${backupId}`);
        try {
            const backupPath = path.posix.join(this.backupRootDir, backupId);
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
            console.log(`✅ EC2バックアップ復元完了: ${restoredFiles.length}ファイル (${processingTime}ms)`);
            return {
                restoreId: `restore-${Date.now()}`,
                success: errors.length === 0,
                restoredFileCount: restoredFiles.length,
                restoredFiles,
                error: errors.length > 0 ? errors.join('; ') : undefined,
                restoreTime: new Date(),
                environment: 'ec2'
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `EC2バックアップ復元に失敗しました: ${error}`, undefined, 'ec2', error);
        }
    }
    /**
     * バックアップ一覧を取得
     */
    async listBackups() {
        try {
            // リモートバックアップディレクトリの存在確認
            try {
                const escapedBackupRootDir = this.escapeFilePath(this.backupRootDir);
                await this.executeSSHCommand(`test -d ${escapedBackupRootDir}`);
            }
            catch {
                return []; // ディレクトリが存在しない場合は空配列を返す
            }
            const escapedBackupRootDir = this.escapeFilePath(this.backupRootDir);
            const { stdout } = await this.executeSSHCommand(`find ${escapedBackupRootDir} -maxdepth 1 -type d -not -path ${escapedBackupRootDir}`);
            const backupDirs = stdout.trim().split('\n').filter(line => line.length > 0);
            const backups = [];
            for (const backupDir of backupDirs) {
                try {
                    const backupId = path.basename(backupDir);
                    const metadata = await this.loadBackupMetadata(backupDir);
                    backups.push({
                        backupId,
                        createdAt: new Date(metadata.timestamp),
                        fileCount: metadata.files.length,
                        totalSize: metadata.totalSize,
                        description: `EC2バックアップ (${metadata.files.length}ファイル)`,
                        environment: 'ec2',
                        backupPath: backupDir
                    });
                }
                catch (error) {
                    console.warn(`バックアップメタデータ読み込みエラー: ${backupDir}`, error);
                }
            }
            // 作成日時でソート（新しい順）
            return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `EC2バックアップ一覧取得に失敗しました: ${error}`, undefined, 'ec2', error);
        }
    }
    /**
     * 古いバックアップを削除
     */
    async cleanupOldBackups(retentionDays) {
        console.log(`🧹 EC2環境で${retentionDays}日より古いバックアップを削除中...`);
        try {
            const backups = await this.listBackups();
            const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
            let deletedCount = 0;
            for (const backup of backups) {
                if (backup.createdAt < cutoffDate) {
                    try {
                        await this.deleteBackup(backup.backupId);
                        deletedCount++;
                        console.log(`🗑️  古いEC2バックアップを削除: ${backup.backupId}`);
                    }
                    catch (error) {
                        console.warn(`EC2バックアップ削除エラー: ${backup.backupId}`, error);
                    }
                }
            }
            console.log(`✅ EC2バックアップクリーンアップ完了: ${deletedCount}個削除`);
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `EC2バックアップクリーンアップに失敗しました: ${error}`, undefined, 'ec2', error);
        }
    }
    /**
     * バックアップを削除
     */
    async deleteBackup(backupId) {
        try {
            const backupPath = path.posix.join(this.backupRootDir, backupId);
            if (await this.backupExists(backupPath)) {
                const escapedBackupPath = this.escapeFilePath(backupPath);
                await this.executeSSHCommand(`rm -rf ${escapedBackupPath}`);
            }
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `EC2バックアップ削除に失敗しました: ${backupId}`, undefined, 'ec2', error);
        }
    }
    /**
     * バックアップの整合性を検証
     */
    async verifyBackup(backupId) {
        try {
            const backupPath = path.posix.join(this.backupRootDir, backupId);
            const metadata = await this.loadBackupMetadata(backupPath);
            const errors = [];
            let checkedFiles = 0;
            for (const fileInfo of metadata.files) {
                try {
                    const backupFileName = path.basename(fileInfo.originalPath);
                    const backupFilePath = path.posix.join(backupPath, 'files', backupFileName);
                    // ファイルの存在確認
                    const escapedBackupFilePath = this.escapeFilePath(backupFilePath);
                    await this.executeSSHCommand(`test -f ${escapedBackupFilePath}`);
                    // チェックサムの検証
                    const actualChecksum = await this.calculateRemoteChecksum(backupFilePath);
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
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `EC2バックアップ検証に失敗しました: ${backupId}`, undefined, 'ec2', error);
        }
    }
    /**
     * SSH接続テスト
     */
    async testConnection() {
        try {
            const { stdout } = await this.executeSSHCommand('echo "connection_test"');
            return stdout.trim() === 'connection_test';
        }
        catch (error) {
            console.error('EC2 SSH接続テストに失敗しました:', error);
            return false;
        }
    }
    /**
     * ファイルパスをSSHコマンド用にエスケープ
     */
    escapeFilePath(filePath) {
        // シングルクォートでエスケープし、内部のシングルクォートは特別処理
        return `'${filePath.replace(/'/g, "'\"'\"'")}'`;
    }
    /**
     * 単一ファイルをバックアップ
     */
    async backupSingleFile(filePath, backupPath) {
        try {
            // ファイルパスをエスケープ
            const escapedFilePath = this.escapeFilePath(filePath);
            // ファイルの存在確認とサイズ取得
            const { stdout: statOutput } = await this.executeSSHCommand(`stat -c "%s" ${escapedFilePath} 2>/dev/null || echo "ERROR"`);
            if (statOutput.trim() === 'ERROR') {
                return null;
            }
            const fileSize = parseInt(statOutput.trim(), 10);
            const fileName = path.basename(filePath);
            const backupFilePath = path.posix.join(backupPath, 'files', fileName);
            const escapedBackupFilePath = this.escapeFilePath(backupFilePath);
            // ファイルをコピー
            await this.executeSSHCommand(`cp ${escapedFilePath} ${escapedBackupFilePath}`);
            // チェックサムを計算
            const checksum = await this.calculateRemoteChecksum(backupFilePath);
            return {
                originalPath: filePath,
                backupPath: backupFilePath,
                size: fileSize,
                checksum,
                backupTime: new Date()
            };
        }
        catch (error) {
            console.warn(`EC2ファイルバックアップエラー: ${filePath}`, error);
            return null;
        }
    }
    /**
     * 単一ファイルを復元
     */
    async restoreSingleFile(fileInfo, backupPath) {
        try {
            // ファイルパスをエスケープ
            const escapedBackupPath = this.escapeFilePath(fileInfo.backupPath);
            const escapedOriginalPath = this.escapeFilePath(fileInfo.originalPath);
            // バックアップファイルの存在確認
            await this.executeSSHCommand(`test -f ${escapedBackupPath}`);
            // チェックサムの検証
            const actualChecksum = await this.calculateRemoteChecksum(fileInfo.backupPath);
            if (actualChecksum !== fileInfo.checksum) {
                throw new Error('チェックサム不一致');
            }
            // 復元先ディレクトリの作成
            const targetDir = path.dirname(fileInfo.originalPath);
            const escapedTargetDir = this.escapeFilePath(targetDir);
            await this.executeSSHCommand(`mkdir -p ${escapedTargetDir}`);
            // ファイルを復元
            await this.executeSSHCommand(`cp ${escapedBackupPath} ${escapedOriginalPath}`);
        }
        catch (error) {
            throw new Error(`EC2ファイル復元エラー: ${error}`);
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
            environment: 'ec2',
            version: '1.0.0'
        };
        const metadataContent = JSON.stringify(metadata, null, 2);
        const metadataPath = path.posix.join(backupPath, 'metadata.json');
        // リモートファイルに書き込み
        const escapedMetadataPath = this.escapeFilePath(metadataPath);
        await this.executeSSHCommand(`cat > ${escapedMetadataPath} << 'EOF'\n${metadataContent}\nEOF`);
    }
    /**
     * バックアップメタデータを読み込み
     */
    async loadBackupMetadata(backupPath) {
        const metadataPath = path.posix.join(backupPath, 'metadata.json');
        const escapedMetadataPath = this.escapeFilePath(metadataPath);
        const { stdout } = await this.executeSSHCommand(`cat ${escapedMetadataPath}`);
        return JSON.parse(stdout);
    }
    /**
     * バックアップの存在確認
     */
    async backupExists(backupPath) {
        try {
            const metadataPath = path.posix.join(backupPath, 'metadata.json');
            const escapedMetadataPath = this.escapeFilePath(metadataPath);
            await this.executeSSHCommand(`test -f ${escapedMetadataPath}`);
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
            // バックアップディレクトリの権限設定
            const escapedBackupPath = this.escapeFilePath(backupPath);
            await this.executeSSHCommand(`chmod 755 ${escapedBackupPath}`);
            // メタデータファイルの権限設定
            const metadataPath = path.posix.join(backupPath, 'metadata.json');
            const escapedMetadataPath = this.escapeFilePath(metadataPath);
            await this.executeSSHCommand(`chmod 644 ${escapedMetadataPath}`);
            // バックアップファイルディレクトリの権限設定
            const filesPath = path.posix.join(backupPath, 'files');
            const escapedFilesPath = this.escapeFilePath(filesPath);
            await this.executeSSHCommand(`chmod -R 644 ${escapedFilesPath}`);
        }
        catch (error) {
            console.warn('EC2バックアップ権限設定エラー:', error);
        }
    }
    /**
     * リモートファイルのチェックサムを計算
     */
    async calculateRemoteChecksum(filePath) {
        try {
            const escapedFilePath = this.escapeFilePath(filePath);
            const { stdout } = await this.executeSSHCommand(`sha256sum ${escapedFilePath} | cut -d' ' -f1`);
            return stdout.trim();
        }
        catch (error) {
            throw new Error(`リモートチェックサム計算エラー: ${error}`);
        }
    }
    /**
     * SSH コマンドを実行
     */
    async executeSSHCommand(command) {
        const sshCommand = `ssh -i "${this.sshConfig.keyPath}" -o ConnectTimeout=${this.sshConfig.timeout / 1000} -o StrictHostKeyChecking=no -p ${this.sshConfig.port} ${this.sshConfig.user}@${this.sshConfig.host} "${command}"`;
        try {
            const result = await execAsync(sshCommand, {
                timeout: this.sshConfig.timeout,
                maxBuffer: 1024 * 1024 * 10 // 10MB
            });
            return result;
        }
        catch (error) {
            if (error.code === 'ETIMEDOUT') {
                throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.SSH_CONNECTION_FAILED, `SSH接続がタイムアウトしました: ${this.sshConfig.host}`, undefined, 'ec2', error);
            }
            throw error;
        }
    }
    /**
     * EC2環境のディスク使用量を確認
     */
    async checkDiskSpace() {
        try {
            const escapedBackupRootDir = this.escapeFilePath(this.backupRootDir);
            const { stdout } = await this.executeSSHCommand(`df ${escapedBackupRootDir} | tail -1 | awk '{print $2,$3,$4,$5}' | sed 's/%//'`);
            const [total, used, available, usagePercentage] = stdout.trim().split(' ').map(Number);
            return {
                available: available * 1024, // KB to bytes
                used: used * 1024,
                total: total * 1024,
                usagePercentage
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `EC2ディスク容量確認に失敗しました: ${error}`, undefined, 'ec2', error);
        }
    }
    /**
     * バックアップサイズを取得
     */
    async getBackupSize(backupId) {
        try {
            const backupPath = path.posix.join(this.backupRootDir, backupId);
            const metadata = await this.loadBackupMetadata(backupPath);
            return metadata.totalSize;
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `EC2バックアップサイズ取得に失敗しました: ${backupId}`, undefined, 'ec2', error);
        }
    }
    /**
     * バックアップの圧縮
     */
    async compressBackup(backupId) {
        try {
            const backupPath = path.posix.join(this.backupRootDir, backupId);
            const compressedPath = `${backupPath}.tar.gz`;
            // バックアップディレクトリを圧縮
            const escapedCompressedPath = this.escapeFilePath(compressedPath);
            const escapedBackupRootDir = this.escapeFilePath(this.backupRootDir);
            const escapedBackupId = this.escapeFilePath(backupId);
            const escapedBackupPath = this.escapeFilePath(backupPath);
            await this.executeSSHCommand(`tar -czf ${escapedCompressedPath} -C ${escapedBackupRootDir} ${escapedBackupId}`);
            // 元のディレクトリを削除
            await this.executeSSHCommand(`rm -rf ${escapedBackupPath}`);
            console.log(`✅ EC2バックアップを圧縮しました: ${backupId}`);
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `EC2バックアップ圧縮に失敗しました: ${backupId}`, undefined, 'ec2', error);
        }
    }
    /**
     * 圧縮されたバックアップを展開
     */
    async decompressBackup(backupId) {
        try {
            const compressedPath = path.posix.join(this.backupRootDir, `${backupId}.tar.gz`);
            // 圧縮ファイルを展開
            const escapedCompressedPath = this.escapeFilePath(compressedPath);
            const escapedBackupRootDir = this.escapeFilePath(this.backupRootDir);
            await this.executeSSHCommand(`tar -xzf ${escapedCompressedPath} -C ${escapedBackupRootDir}`);
            // 圧縮ファイルを削除
            await this.executeSSHCommand(`rm -f ${escapedCompressedPath}`);
            console.log(`✅ EC2バックアップを展開しました: ${backupId}`);
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `EC2バックアップ展開に失敗しました: ${backupId}`, undefined, 'ec2', error);
        }
    }
}
exports.EC2BackupManager = EC2BackupManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWMyLWJhY2t1cC1tYW5hZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZWMyLWJhY2t1cC1tYW5hZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7R0FLRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBcUM7QUFDckMsK0JBQWlDO0FBQ2pDLDJDQUE2QjtBQUU3QixnREFRMkI7QUFHM0IsTUFBTSxTQUFTLEdBQUcsSUFBQSxnQkFBUyxFQUFDLG9CQUFJLENBQUMsQ0FBQztBQUVsQzs7Ozs7R0FLRztBQUNILE1BQWEsZ0JBQWdCO0lBQ1YsU0FBUyxDQUFZO0lBQ3JCLGFBQWEsQ0FBUztJQUN0QixhQUFhLENBQVM7SUFFdkMsWUFDRSxTQUFvQixFQUNwQixnQkFBd0Isc0JBQXNCLEVBQzlDLGdCQUF3QixJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNOztRQUVqRCxJQUFJLENBQUMsU0FBUyxHQUFHO1lBQ2YsSUFBSSxFQUFFLEVBQUU7WUFDUixPQUFPLEVBQUUsS0FBSztZQUNkLEdBQUcsU0FBUztTQUNiLENBQUM7UUFDRixJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNuQyxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztJQUNyQyxDQUFDO0lBRUQ7O09BRUc7SUFDSSxLQUFLLENBQUMsWUFBWSxDQUFDLEtBQWUsRUFBRSxRQUFnQjtRQUN6RCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDN0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUU3QyxJQUFJLENBQUM7WUFDSCxzQkFBc0I7WUFDdEIsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUNqRSxNQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxj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O1lBQ1osTUFBTSxxQkFBcUIsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQ2xFLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDckUsTUFBTSxJQUFJLENBQUMsaUJBQWlCLENBQUMsWUFBWSxxQkFBcUIsT0FBTyxvQkFBb0IsRUFBRSxDQUFDLENBQUM7WUFFN0YsWUFBWTtZQUNaLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFNBQVMscUJBQXFCLEVBQUUsQ0FBQyxDQUFDO1lBRS9ELE9BQU8sQ0FBQyxHQUFHLENBQUMsdUJBQXVCLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDakQsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixNQUFNLElBQUksNEJBQWlCLENBQ3pCLGdDQUFxQixDQUFDLGFBQWEsRUFDbkMsdUJBQXVCLFFBQVEsRUFBRSxFQUNqQyxTQUFTLEVBQ1QsS0FBSyxFQUNMLEtBQWMsQ0FDZixDQUFDO1FBQ0osQ0FBQztJQUNILENBQUM7Q0FDRjtBQWhtQkQsNENBZ21CQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog57Wx5ZCI44OV44Kh44Kk44Or5pW055CG44K344K544OG44OgIC0gRUMy44OQ44OD44Kv44Ki44OD44OX566h55CGXG4gKiBcbiAqIEVDMueSsOWig+OBp+OBrlNTSOaOpee2muOBq+OCiOOCi+ODquODouODvOODiOODleOCoeOCpOODq+ODkOODg+OCr+OCouODg+ODl+S9nOaIkOOAgeW+qeWFg+OAgeeuoeeQhuapn+iDveOCkuaPkOS+m+OBl+OBvuOBmeOAglxuICogU1NI57WM55Sx44Gn44Gu5a6J5YWo44Gq44OV44Kh44Kk44Or5pON5L2c44KS44K144Od44O844OI44GX44G+44GZ44CCXG4gKi9cblxuaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgY3J5cHRvIGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgeyBcbiAgQmFja3VwTWFuYWdlcixcbiAgQmFja3VwUmVzdWx0LCBcbiAgUmVzdG9yZVJlc3VsdCwgXG4gIEJhY2t1cEluZm8sIFxuICBCYWNrdXBGaWxlSW5mbyxcbiAgT3JnYW5pemF0aW9uRXJyb3IsXG4gIE9yZ2FuaXphdGlvbkVycm9yVHlwZVxufSBmcm9tICcuLi90eXBlcy9pbmRleC5qcyc7XG5pbXBvcnQgeyBTU0hDb25maWcgfSBmcm9tICcuLi9zY2FubmVycy9lYzItc2Nhbm5lci5qcyc7XG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKTtcblxuLyoqXG4gKiBFQzLjg5Djg4Pjgq/jgqLjg4Pjg5fnrqHnkIZcbiAqIFxuICogU1NI5o6l57aa44KS5L2/55So44GX44GmRUMy55Kw5aKD44Gn44Gu44OV44Kh44Kk44Or44OQ44OD44Kv44Ki44OD44OX5qmf6IO944KS5o+Q5L6b44GX44CBXG4gKiDjg6rjg6Ljg7zjg4jnkrDlooPjgafjga7lronlhajjgarjg5XjgqHjgqTjg6vmk43kvZzjgpLjgrXjg53jg7zjg4jjgZfjgb7jgZnjgIJcbiAqL1xuZXhwb3J0IGNsYXNzIEVDMkJhY2t1cE1hbmFnZXIgaW1wbGVtZW50cyBCYWNrdXBNYW5hZ2VyIHtcbiAgcHJpdmF0ZSByZWFkb25seSBzc2hDb25maWc6IFNTSENvbmZpZztcbiAgcHJpdmF0ZSByZWFkb25seSBiYWNrdXBSb290RGlyOiBzdHJpbmc7XG4gIHByaXZhdGUgcmVhZG9ubHkgbWF4QmFja3VwU2l6ZTogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHNzaENvbmZpZzogU1NIQ29uZmlnLFxuICAgIGJhY2t1cFJvb3REaXI6IHN0cmluZyA9ICcvaG9tZS91YnVudHUvYmFja3VwcycsXG4gICAgbWF4QmFja3VwU2l6ZTogbnVtYmVyID0gMTAyNCAqIDEwMjQgKiAxMDI0IC8vIDFHQlxuICApIHtcbiAgICB0aGlzLnNzaENvbmZpZyA9IHtcbiAgICAgIHBvcnQ6IDIyLFxuICAgICAgdGltZW91dDogMzAwMDAsXG4gICAgICAuLi5zc2hDb25maWdcbiAgICB9O1xuICAgIHRoaXMuYmFja3VwUm9vdERpciA9IGJhY2t1cFJvb3REaXI7XG4gICAgdGhpcy5tYXhCYWNrdXBTaXplID0gbWF4QmFja3VwU2l6ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg5Djg4Pjgq/jgqLjg4Pjg5fjgpLkvZzmiJBcbiAgICovXG4gIHB1YmxpYyBhc3luYyBjcmVhdGVCYWNrdXAoZmlsZXM6IHN0cmluZ1tdLCBiYWNrdXBJZDogc3RyaW5nKTogUHJvbWlzZTxCYWNrdXBSZXN1bHQ+IHtcbiAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIGNvbnNvbGUubG9nKGDwn5K+IEVDMuODkOODg+OCr+OCouODg+ODl+OCkuS9nOaIkOS4rTogJHtiYWNrdXBJZH1gKTtcblxuICAgIHRyeSB7XG4gICAgICAvLyDjg6rjg6Ljg7zjg4jjg5Djg4Pjgq/jgqLjg4Pjg5fjg4fjgqPjg6zjgq/jg4jjg6rjga7kvZzmiJBcbiAgICAgIGNvbnN0IGJhY2t1cFBhdGggPSBwYXRoLnBvc2l4LmpvaW4odGhpcy5iYWNrdXBSb290RGlyLCBiYWNrdXBJZCk7XG4gICAgICBjb25zdCBlc2NhcGVkQmFja3VwUGF0aCA9IHRoaXMuZXNjYXBlRmlsZVBhdGgoYmFja3VwUGF0aCk7XG4gICAgICBhd2FpdCB0aGlzLmV4ZWN1dGVTU0hDb21tYW5kKGBta2RpciAtcCAke2VzY2FwZWRCYWNrdXBQYXRofS9maWxlc2ApO1xuXG4gICAgICAvLyDjg5Djg4Pjgq/jgqLjg4Pjg5fjg5XjgqHjgqTjg6vmg4XloLFcbiAgICAgIGNvbnN0IGJhY2t1cEZpbGVzOiBCYWNrdXBGaWxlSW5mb1tdID0gW107XG4gICAgICBsZXQgdG90YWxTaXplID0gMDtcbiAgICAgIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcblxuICAgICAgLy8g44OV44Kh44Kk44Or44KS5YCL5Yil44Gr44OQ44OD44Kv44Ki44OD44OXXG4gICAgICBmb3IgKGNvbnN0IGZpbGVQYXRoIG9mIGZpbGVzKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgZmlsZUluZm8gPSBhd2FpdCB0aGlzLmJhY2t1cFNpbmdsZUZpbGUoZmlsZVBhdGgsIGJhY2t1cFBhdGgpO1xuICAgICAgICAgIGlmIChmaWxlSW5mbykge1xuICAgICAgICAgICAgYmFja3VwRmlsZXMucHVzaChmaWxlSW5mbyk7XG4gICAgICAgICAgICB0b3RhbFNpemUgKz0gZmlsZUluZm8uc2l6ZTtcblxuICAgICAgICAgICAgLy8g44K144Kk44K65Yi26ZmQ44OB44Kn44OD44KvXG4gICAgICAgICAgICBpZiAodG90YWxTaXplID4gdGhpcy5tYXhCYWNrdXBTaXplKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihg44OQ44OD44Kv44Ki44OD44OX44K144Kk44K644GM5Yi26ZmQ44KS6LaF44GI44G+44GX44GfOiAke3RvdGFsU2l6ZX0gPiAke3RoaXMubWF4QmFja3VwU2l6ZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgY29uc3QgZXJyb3JNc2cgPSBg44OV44Kh44Kk44Or44OQ44OD44Kv44Ki44OD44OX5aSx5pWXOiAke2ZpbGVQYXRofSAtICR7ZXJyb3J9YDtcbiAgICAgICAgICBlcnJvcnMucHVzaChlcnJvck1zZyk7XG4gICAgICAgICAgY29uc29sZS53YXJuKGVycm9yTXNnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyDjg5Djg4Pjgq/jgqLjg4Pjg5fjg6Hjgr/jg4fjg7zjgr/jga7kvZzmiJBcbiAgICAgIGF3YWl0IHRoaXMuY3JlYXRlQmFja3VwTWV0YWRhdGEoYmFja3VwUGF0aCwgYmFja3VwSWQsIGJhY2t1cEZpbGVzLCB0b3RhbFNpemUpO1xuXG4gICAgICAvLyDjg5Djg4Pjgq/jgqLjg4Pjg5fjg4fjgqPjg6zjgq/jg4jjg6rjga7mqKnpmZDoqK3lrppcbiAgICAgIGF3YWl0IHRoaXMuc2V0QmFja3VwUGVybWlzc2lvbnMoYmFja3VwUGF0aCk7XG5cbiAgICAgIGNvbnN0IHByb2Nlc3NpbmdUaW1lID0gRGF0ZS5ub3coKSAtIHN0YXJ0VGltZTtcbiAgICAgIGNvbnNvbGUubG9nKGDinIUgRUMy44OQ44OD44Kv44Ki44OD44OX5L2c5oiQ5a6M5LqGOiAke2JhY2t1cEZpbGVzLmxlbmd0aH3jg5XjgqHjgqTjg6sgKCR7cHJvY2Vzc2luZ1RpbWV9bXMpYCk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGJhY2t1cElkLFxuICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCksXG4gICAgICAgIGZpbGVzOiBiYWNrdXBGaWxlcyxcbiAgICAgICAgdG90YWxTaXplLFxuICAgICAgICBzdWNjZXNzOiBlcnJvcnMubGVuZ3RoID09PSAwLFxuICAgICAgICBlcnJvcjogZXJyb3JzLmxlbmd0aCA+IDAgPyBlcnJvcnMuam9pbignOyAnKSA6IHVuZGVmaW5lZCxcbiAgICAgICAgZW52aXJvbm1lbnQ6ICdlYzInLFxuICAgICAgICBiYWNrdXBQYXRoXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5CQUNLVVBfRkFJTEVELFxuICAgICAgICBgRUMy44OQ44OD44Kv44Ki44OD44OX5L2c5oiQ44Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yfWAsXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgJ2VjMicsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg5Djg4Pjgq/jgqLjg4Pjg5fjgpLlvqnlhYNcbiAgICovXG4gIHB1YmxpYyBhc3luYyByZXN0b3JlQmFja3VwKGJhY2t1cElkOiBzdHJpbmcpOiBQcm9taXNlPFJlc3RvcmVSZXN1bHQ+IHtcbiAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIGNvbnNvbGUubG9nKGDwn5SEIEVDMuODkOODg+OCr+OCouODg+ODl+OCkuW+qeWFg+S4rTogJHtiYWNrdXBJZH1gKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBiYWNrdXBQYXRoID0gcGF0aC5wb3NpeC5qb2luKHRoaXMuYmFja3VwUm9vdERpciwgYmFja3VwSWQpO1xuICAgICAgXG4gICAgICAvLyDjg5Djg4Pjgq/jgqLjg4Pjg5fjga7lrZjlnKjnorroqo1cbiAgICAgIGlmICghYXdhaXQgdGhpcy5iYWNrdXBFeGlzdHMoYmFja3VwUGF0aCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGDjg5Djg4Pjgq/jgqLjg4Pjg5fjgYzopovjgaTjgYvjgorjgb7jgZvjgpM6ICR7YmFja3VwSWR9YCk7XG4gICAgICB9XG5cbiAgICAgIC8vIOODoeOCv+ODh+ODvOOCv+OBruiqreOBv+i+vOOBv1xuICAgICAgY29uc3QgbWV0YWRhdGEgPSBhd2FpdCB0aGlzLmxvYWRCYWNrdXBNZXRhZGF0YShiYWNrdXBQYXRoKTtcbiAgICAgIGNvbnN0IHJlc3RvcmVkRmlsZXM6IHN0cmluZ1tdID0gW107XG4gICAgICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG5cbiAgICAgIC8vIOODleOCoeOCpOODq+OCkuWAi+WIpeOBq+W+qeWFg1xuICAgICAgZm9yIChjb25zdCBmaWxlSW5mbyBvZiBtZXRhZGF0YS5maWxlcykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IHRoaXMucmVzdG9yZVNpbmdsZUZpbGUoZmlsZUluZm8sIGJhY2t1cFBhdGgpO1xuICAgICAgICAgIHJlc3RvcmVkRmlsZXMucHVzaChmaWxlSW5mby5vcmlnaW5hbFBhdGgpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnN0IGVycm9yTXNnID0gYOODleOCoeOCpOODq+W+qeWFg+WkseaVlzogJHtmaWxlSW5mby5vcmlnaW5hbFBhdGh9IC0gJHtlcnJvcn1gO1xuICAgICAgICAgIGVycm9ycy5wdXNoKGVycm9yTXNnKTtcbiAgICAgICAgICBjb25zb2xlLndhcm4oZXJyb3JNc2cpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHByb2Nlc3NpbmdUaW1lID0gRGF0ZS5ub3coKSAtIHN0YXJ0VGltZTtcbiAgICAgIGNvbnNvbGUubG9nKGDinIUgRUMy44OQ44OD44Kv44Ki44OD44OX5b6p5YWD5a6M5LqGOiAke3Jlc3RvcmVkRmlsZXMubGVuZ3RofeODleOCoeOCpOODqyAoJHtwcm9jZXNzaW5nVGltZX1tcylgKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdG9yZUlkOiBgcmVzdG9yZS0ke0RhdGUubm93KCl9YCxcbiAgICAgICAgc3VjY2VzczogZXJyb3JzLmxlbmd0aCA9PT0gMCxcbiAgICAgICAgcmVzdG9yZWRGaWxlQ291bnQ6IHJlc3RvcmVkRmlsZXMubGVuZ3RoLFxuICAgICAgICByZXN0b3JlZEZpbGVzLFxuICAgICAgICBlcnJvcjogZXJyb3JzLmxlbmd0aCA+IDAgPyBlcnJvcnMuam9pbignOyAnKSA6IHVuZGVmaW5lZCxcbiAgICAgICAgcmVzdG9yZVRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgIGVudmlyb25tZW50OiAnZWMyJ1xuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuQkFDS1VQX0ZBSUxFRCxcbiAgICAgICAgYEVDMuODkOODg+OCr+OCouODg+ODl+W+qeWFg+OBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtlcnJvcn1gLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICdlYzInLFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44OQ44OD44Kv44Ki44OD44OX5LiA6Kan44KS5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgbGlzdEJhY2t1cHMoKTogUHJvbWlzZTxCYWNrdXBJbmZvW10+IHtcbiAgICB0cnkge1xuICAgICAgLy8g44Oq44Oi44O844OI44OQ44OD44Kv44Ki44OD44OX44OH44Kj44Os44Kv44OI44Oq44Gu5a2Y5Zyo56K66KqNXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBlc2NhcGVkQmFja3VwUm9vdERpciA9IHRoaXMuZXNjYXBlRmlsZVBhdGgodGhpcy5iYWNrdXBSb290RGlyKTtcbiAgICAgICAgYXdhaXQgdGhpcy5leGVjdXRlU1NIQ29tbWFuZChgdGVzdCAtZCAke2VzY2FwZWRCYWNrdXBSb290RGlyfWApO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIHJldHVybiBbXTsgLy8g44OH44Kj44Os44Kv44OI44Oq44GM5a2Y5Zyo44GX44Gq44GE5aC05ZCI44Gv56m66YWN5YiX44KS6L+U44GZXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGVzY2FwZWRCYWNrdXBSb290RGlyID0gdGhpcy5lc2NhcGVGaWxlUGF0aCh0aGlzLmJhY2t1cFJvb3REaXIpO1xuICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoYGZpbmQgJHtlc2NhcGVkQmFja3VwUm9vdERpcn0gLW1heGRlcHRoIDEgLXR5cGUgZCAtbm90IC1wYXRoICR7ZXNjYXBlZEJhY2t1cFJvb3REaXJ9YCk7XG4gICAgICBjb25zdCBiYWNrdXBEaXJzID0gc3Rkb3V0LnRyaW0oKS5zcGxpdCgnXFxuJykuZmlsdGVyKGxpbmUgPT4gbGluZS5sZW5ndGggPiAwKTtcbiAgICAgIGNvbnN0IGJhY2t1cHM6IEJhY2t1cEluZm9bXSA9IFtdO1xuXG4gICAgICBmb3IgKGNvbnN0IGJhY2t1cERpciBvZiBiYWNrdXBEaXJzKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgYmFja3VwSWQgPSBwYXRoLmJhc2VuYW1lKGJhY2t1cERpcik7XG4gICAgICAgICAgY29uc3QgbWV0YWRhdGEgPSBhd2FpdCB0aGlzLmxvYWRCYWNrdXBNZXRhZGF0YShiYWNrdXBEaXIpO1xuICAgICAgICAgIFxuICAgICAgICAgIGJhY2t1cHMucHVzaCh7XG4gICAgICAgICAgICBiYWNrdXBJZCxcbiAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUobWV0YWRhdGEudGltZXN0YW1wKSxcbiAgICAgICAgICAgIGZpbGVDb3VudDogbWV0YWRhdGEuZmlsZXMubGVuZ3RoLFxuICAgICAgICAgICAgdG90YWxTaXplOiBtZXRhZGF0YS50b3RhbFNpemUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYEVDMuODkOODg+OCr+OCouODg+ODlyAoJHttZXRhZGF0YS5maWxlcy5sZW5ndGh944OV44Kh44Kk44OrKWAsXG4gICAgICAgICAgICBlbnZpcm9ubWVudDogJ2VjMicsXG4gICAgICAgICAgICBiYWNrdXBQYXRoOiBiYWNrdXBEaXJcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYOODkOODg+OCr+OCouODg+ODl+ODoeOCv+ODh+ODvOOCv+iqreOBv+i+vOOBv+OCqOODqeODvDogJHtiYWNrdXBEaXJ9YCwgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIOS9nOaIkOaXpeaZguOBp+OCveODvOODiO+8iOaWsOOBl+OBhOmghu+8iVxuICAgICAgcmV0dXJuIGJhY2t1cHMuc29ydCgoYSwgYikgPT4gYi5jcmVhdGVkQXQuZ2V0VGltZSgpIC0gYS5jcmVhdGVkQXQuZ2V0VGltZSgpKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuQkFDS1VQX0ZBSUxFRCxcbiAgICAgICAgYEVDMuODkOODg+OCr+OCouODg+ODl+S4gOimp+WPluW+l+OBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtlcnJvcn1gLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICdlYzInLFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog5Y+k44GE44OQ44OD44Kv44Ki44OD44OX44KS5YmK6ZmkXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgY2xlYW51cE9sZEJhY2t1cHMocmV0ZW50aW9uRGF5czogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc29sZS5sb2coYPCfp7kgRUMy55Kw5aKD44GnJHtyZXRlbnRpb25EYXlzfeaXpeOCiOOCiuWPpOOBhOODkOODg+OCr+OCouODg+ODl+OCkuWJiumZpOS4rS4uLmApO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGJhY2t1cHMgPSBhd2FpdCB0aGlzLmxpc3RCYWNrdXBzKCk7XG4gICAgICBjb25zdCBjdXRvZmZEYXRlID0gbmV3IERhdGUoRGF0ZS5ub3coKSAtIHJldGVudGlvbkRheXMgKiAyNCAqIDYwICogNjAgKiAxMDAwKTtcbiAgICAgIGxldCBkZWxldGVkQ291bnQgPSAwO1xuXG4gICAgICBmb3IgKGNvbnN0IGJhY2t1cCBvZiBiYWNrdXBzKSB7XG4gICAgICAgIGlmIChiYWNrdXAuY3JlYXRlZEF0IDwgY3V0b2ZmRGF0ZSkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmRlbGV0ZUJhY2t1cChiYWNrdXAuYmFja3VwSWQpO1xuICAgICAgICAgICAgZGVsZXRlZENvdW50Kys7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhg8J+Xke+4jyAg5Y+k44GERUMy44OQ44OD44Kv44Ki44OD44OX44KS5YmK6ZmkOiAke2JhY2t1cC5iYWNrdXBJZH1gKTtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBFQzLjg5Djg4Pjgq/jgqLjg4Pjg5fliYrpmaTjgqjjg6njg7w6ICR7YmFja3VwLmJhY2t1cElkfWAsIGVycm9yKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc29sZS5sb2coYOKchSBFQzLjg5Djg4Pjgq/jgqLjg4Pjg5fjgq/jg6rjg7zjg7PjgqLjg4Pjg5flrozkuoY6ICR7ZGVsZXRlZENvdW50feWAi+WJiumZpGApO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5CQUNLVVBfRkFJTEVELFxuICAgICAgICBgRUMy44OQ44OD44Kv44Ki44OD44OX44Kv44Oq44O844Oz44Ki44OD44OX44Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yfWAsXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgJ2VjMicsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg5Djg4Pjgq/jgqLjg4Pjg5fjgpLliYrpmaRcbiAgICovXG4gIHB1YmxpYyBhc3luYyBkZWxldGVCYWNrdXAoYmFja3VwSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBiYWNrdXBQYXRoID0gcGF0aC5wb3NpeC5qb2luKHRoaXMuYmFja3VwUm9vdERpciwgYmFja3VwSWQpO1xuICAgICAgXG4gICAgICBpZiAoYXdhaXQgdGhpcy5iYWNrdXBFeGlzdHMoYmFja3VwUGF0aCkpIHtcbiAgICAgICAgY29uc3QgZXNjYXBlZEJhY2t1cFBhdGggPSB0aGlzLmVzY2FwZUZpbGVQYXRoKGJhY2t1cFBhdGgpO1xuICAgICAgICBhd2FpdCB0aGlzLmV4ZWN1dGVTU0hDb21tYW5kKGBybSAtcmYgJHtlc2NhcGVkQmFja3VwUGF0aH1gKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuQkFDS1VQX0ZBSUxFRCxcbiAgICAgICAgYEVDMuODkOODg+OCr+OCouODg+ODl+WJiumZpOOBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtiYWNrdXBJZH1gLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICdlYzInLFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44OQ44OD44Kv44Ki44OD44OX44Gu5pW05ZCI5oCn44KS5qSc6Ki8XG4gICAqL1xuICBwdWJsaWMgYXN5bmMgdmVyaWZ5QmFja3VwKGJhY2t1cElkOiBzdHJpbmcpOiBQcm9taXNlPHtcbiAgICB2YWxpZDogYm9vbGVhbjtcbiAgICBlcnJvcnM6IHN0cmluZ1tdO1xuICAgIGNoZWNrZWRGaWxlczogbnVtYmVyO1xuICB9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGJhY2t1cFBhdGggPSBwYXRoLnBvc2l4LmpvaW4odGhpcy5iYWNrdXBSb290RGlyLCBiYWNrdXBJZCk7XG4gICAgICBjb25zdCBtZXRhZGF0YSA9IGF3YWl0IHRoaXMubG9hZEJhY2t1cE1ldGFkYXRhKGJhY2t1cFBhdGgpO1xuICAgICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgbGV0IGNoZWNrZWRGaWxlcyA9IDA7XG5cbiAgICAgIGZvciAoY29uc3QgZmlsZUluZm8gb2YgbWV0YWRhdGEuZmlsZXMpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBiYWNrdXBGaWxlTmFtZSA9IHBhdGguYmFzZW5hbWUoZmlsZUluZm8ub3JpZ2luYWxQYXRoKTtcbiAgICAgICAgICBjb25zdCBiYWNrdXBGaWxlUGF0aCA9IHBhdGgucG9zaXguam9pbihiYWNrdXBQYXRoLCAnZmlsZXMnLCBiYWNrdXBGaWxlTmFtZSk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8g44OV44Kh44Kk44Or44Gu5a2Y5Zyo56K66KqNXG4gICAgICAgICAgY29uc3QgZXNjYXBlZEJhY2t1cEZpbGVQYXRoID0gdGhpcy5lc2NhcGVGaWxlUGF0aChiYWNrdXBGaWxlUGF0aCk7XG4gICAgICAgICAgYXdhaXQgdGhpcy5leGVjdXRlU1NIQ29tbWFuZChgdGVzdCAtZiAke2VzY2FwZWRCYWNrdXBGaWxlUGF0aH1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDjg4Hjgqfjg4Pjgq/jgrXjg6Djga7mpJzoqLxcbiAgICAgICAgICBjb25zdCBhY3R1YWxDaGVja3N1bSA9IGF3YWl0IHRoaXMuY2FsY3VsYXRlUmVtb3RlQ2hlY2tzdW0oYmFja3VwRmlsZVBhdGgpO1xuICAgICAgICAgIGlmIChhY3R1YWxDaGVja3N1bSAhPT0gZmlsZUluZm8uY2hlY2tzdW0pIHtcbiAgICAgICAgICAgIGVycm9ycy5wdXNoKGDjg4Hjgqfjg4Pjgq/jgrXjg6DkuI3kuIDoh7Q6ICR7ZmlsZUluZm8ub3JpZ2luYWxQYXRofWApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBjaGVja2VkRmlsZXMrKztcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBlcnJvcnMucHVzaChg44OV44Kh44Kk44Or5qSc6Ki844Ko44Op44O8OiAke2ZpbGVJbmZvLm9yaWdpbmFsUGF0aH0gLSAke2Vycm9yfWApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHZhbGlkOiBlcnJvcnMubGVuZ3RoID09PSAwLFxuICAgICAgICBlcnJvcnMsXG4gICAgICAgIGNoZWNrZWRGaWxlc1xuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuQkFDS1VQX0ZBSUxFRCxcbiAgICAgICAgYEVDMuODkOODg+OCr+OCouODg+ODl+aknOiovOOBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtiYWNrdXBJZH1gLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICdlYzInLFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU1NI5o6l57aa44OG44K544OIXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgdGVzdENvbm5lY3Rpb24oKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCB0aGlzLmV4ZWN1dGVTU0hDb21tYW5kKCdlY2hvIFwiY29ubmVjdGlvbl90ZXN0XCInKTtcbiAgICAgIHJldHVybiBzdGRvdXQudHJpbSgpID09PSAnY29ubmVjdGlvbl90ZXN0JztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignRUMyIFNTSOaOpee2muODhuOCueODiOOBq+WkseaVl+OBl+OBvuOBl+OBnzonLCBlcnJvcik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODleOCoeOCpOODq+ODkeOCueOCklNTSOOCs+ODnuODs+ODieeUqOOBq+OCqOOCueOCseODvOODl1xuICAgKi9cbiAgcHJpdmF0ZSBlc2NhcGVGaWxlUGF0aChmaWxlUGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAvLyDjgrfjg7PjgrDjg6vjgq/jgqnjg7zjg4jjgafjgqjjgrnjgrHjg7zjg5fjgZfjgIHlhoXpg6jjga7jgrfjg7PjgrDjg6vjgq/jgqnjg7zjg4jjga/nibnliKXlh6bnkIZcbiAgICByZXR1cm4gYCcke2ZpbGVQYXRoLnJlcGxhY2UoLycvZywgXCInXFxcIidcXFwiJ1wiKX0nYDtcbiAgfVxuXG4gIC8qKlxuICAgKiDljZjkuIDjg5XjgqHjgqTjg6vjgpLjg5Djg4Pjgq/jgqLjg4Pjg5dcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgYmFja3VwU2luZ2xlRmlsZShmaWxlUGF0aDogc3RyaW5nLCBiYWNrdXBQYXRoOiBzdHJpbmcpOiBQcm9taXNlPEJhY2t1cEZpbGVJbmZvIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICAvLyDjg5XjgqHjgqTjg6vjg5HjgrnjgpLjgqjjgrnjgrHjg7zjg5dcbiAgICAgIGNvbnN0IGVzY2FwZWRGaWxlUGF0aCA9IHRoaXMuZXNjYXBlRmlsZVBhdGgoZmlsZVBhdGgpO1xuICAgICAgXG4gICAgICAvLyDjg5XjgqHjgqTjg6vjga7lrZjlnKjnorroqo3jgajjgrXjgqTjgrrlj5blvpdcbiAgICAgIGNvbnN0IHsgc3Rkb3V0OiBzdGF0T3V0cHV0IH0gPSBhd2FpdCB0aGlzLmV4ZWN1dGVTU0hDb21tYW5kKGBzdGF0IC1jIFwiJXNcIiAke2VzY2FwZWRGaWxlUGF0aH0gMj4vZGV2L251bGwgfHwgZWNobyBcIkVSUk9SXCJgKTtcbiAgICAgIFxuICAgICAgaWYgKHN0YXRPdXRwdXQudHJpbSgpID09PSAnRVJST1InKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBmaWxlU2l6ZSA9IHBhcnNlSW50KHN0YXRPdXRwdXQudHJpbSgpLCAxMCk7XG4gICAgICBjb25zdCBmaWxlTmFtZSA9IHBhdGguYmFzZW5hbWUoZmlsZVBhdGgpO1xuICAgICAgY29uc3QgYmFja3VwRmlsZVBhdGggPSBwYXRoLnBvc2l4LmpvaW4oYmFja3VwUGF0aCwgJ2ZpbGVzJywgZmlsZU5hbWUpO1xuICAgICAgY29uc3QgZXNjYXBlZEJhY2t1cEZpbGVQYXRoID0gdGhpcy5lc2NhcGVGaWxlUGF0aChiYWNrdXBGaWxlUGF0aCk7XG5cbiAgICAgIC8vIOODleOCoeOCpOODq+OCkuOCs+ODlOODvFxuICAgICAgYXdhaXQgdGhpcy5leGVjdXRlU1NIQ29tbWFuZChgY3AgJHtlc2NhcGVkRmlsZVBhdGh9ICR7ZXNjYXBlZEJhY2t1cEZpbGVQYXRofWApO1xuXG4gICAgICAvLyDjg4Hjgqfjg4Pjgq/jgrXjg6DjgpLoqIjnrpdcbiAgICAgIGNvbnN0IGNoZWNrc3VtID0gYXdhaXQgdGhpcy5jYWxjdWxhdGVSZW1vdGVDaGVja3N1bShiYWNrdXBGaWxlUGF0aCk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9yaWdpbmFsUGF0aDogZmlsZVBhdGgsXG4gICAgICAgIGJhY2t1cFBhdGg6IGJhY2t1cEZpbGVQYXRoLFxuICAgICAgICBzaXplOiBmaWxlU2l6ZSxcbiAgICAgICAgY2hlY2tzdW0sXG4gICAgICAgIGJhY2t1cFRpbWU6IG5ldyBEYXRlKClcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUud2FybihgRUMy44OV44Kh44Kk44Or44OQ44OD44Kv44Ki44OD44OX44Ko44Op44O8OiAke2ZpbGVQYXRofWAsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDljZjkuIDjg5XjgqHjgqTjg6vjgpLlvqnlhYNcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgcmVzdG9yZVNpbmdsZUZpbGUoZmlsZUluZm86IEJhY2t1cEZpbGVJbmZvLCBiYWNrdXBQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgLy8g44OV44Kh44Kk44Or44OR44K544KS44Ko44K544Kx44O844OXXG4gICAgICBjb25zdCBlc2NhcGVkQmFja3VwUGF0aCA9IHRoaXMuZXNjYXBlRmlsZVBhdGgoZmlsZUluZm8uYmFja3VwUGF0aCk7XG4gICAgICBjb25zdCBlc2NhcGVkT3JpZ2luYWxQYXRoID0gdGhpcy5lc2NhcGVGaWxlUGF0aChmaWxlSW5mby5vcmlnaW5hbFBhdGgpO1xuICAgICAgXG4gICAgICAvLyDjg5Djg4Pjgq/jgqLjg4Pjg5fjg5XjgqHjgqTjg6vjga7lrZjlnKjnorroqo1cbiAgICAgIGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoYHRlc3QgLWYgJHtlc2NhcGVkQmFja3VwUGF0aH1gKTtcblxuICAgICAgLy8g44OB44Kn44OD44Kv44K144Og44Gu5qSc6Ki8XG4gICAgICBjb25zdCBhY3R1YWxDaGVja3N1bSA9IGF3YWl0IHRoaXMuY2FsY3VsYXRlUmVtb3RlQ2hlY2tzdW0oZmlsZUluZm8uYmFja3VwUGF0aCk7XG4gICAgICBpZiAoYWN0dWFsQ2hlY2tzdW0gIT09IGZpbGVJbmZvLmNoZWNrc3VtKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcign44OB44Kn44OD44Kv44K144Og5LiN5LiA6Ie0Jyk7XG4gICAgICB9XG5cbiAgICAgIC8vIOW+qeWFg+WFiOODh+OCo+ODrOOCr+ODiOODquOBruS9nOaIkFxuICAgICAgY29uc3QgdGFyZ2V0RGlyID0gcGF0aC5kaXJuYW1lKGZpbGVJbmZvLm9yaWdpbmFsUGF0aCk7XG4gICAgICBjb25zdCBlc2NhcGVkVGFyZ2V0RGlyID0gdGhpcy5lc2NhcGVGaWxlUGF0aCh0YXJnZXREaXIpO1xuICAgICAgYXdhaXQgdGhpcy5leGVjdXRlU1NIQ29tbWFuZChgbWtkaXIgLXAgJHtlc2NhcGVkVGFyZ2V0RGlyfWApO1xuXG4gICAgICAvLyDjg5XjgqHjgqTjg6vjgpLlvqnlhYNcbiAgICAgIGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoYGNwICR7ZXNjYXBlZEJhY2t1cFBhdGh9ICR7ZXNjYXBlZE9yaWdpbmFsUGF0aH1gKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFQzLjg5XjgqHjgqTjg6vlvqnlhYPjgqjjg6njg7w6ICR7ZXJyb3J9YCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODkOODg+OCr+OCouODg+ODl+ODoeOCv+ODh+ODvOOCv+OCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBjcmVhdGVCYWNrdXBNZXRhZGF0YShcbiAgICBiYWNrdXBQYXRoOiBzdHJpbmcsIFxuICAgIGJhY2t1cElkOiBzdHJpbmcsIFxuICAgIGZpbGVzOiBCYWNrdXBGaWxlSW5mb1tdLCBcbiAgICB0b3RhbFNpemU6IG51bWJlclxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBtZXRhZGF0YSA9IHtcbiAgICAgIGJhY2t1cElkLFxuICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLFxuICAgICAgZmlsZXMsXG4gICAgICB0b3RhbFNpemUsXG4gICAgICBlbnZpcm9ubWVudDogJ2VjMicsXG4gICAgICB2ZXJzaW9uOiAnMS4wLjAnXG4gICAgfTtcblxuICAgIGNvbnN0IG1ldGFkYXRhQ29udGVudCA9IEpTT04uc3RyaW5naWZ5KG1ldGFkYXRhLCBudWxsLCAyKTtcbiAgICBjb25zdCBtZXRhZGF0YVBhdGggPSBwYXRoLnBvc2l4LmpvaW4oYmFja3VwUGF0aCwgJ21ldGFkYXRhLmpzb24nKTtcbiAgICBcbiAgICAvLyDjg6rjg6Ljg7zjg4jjg5XjgqHjgqTjg6vjgavmm7jjgY3ovrzjgb9cbiAgICBjb25zdCBlc2NhcGVkTWV0YWRhdGFQYXRoID0gdGhpcy5lc2NhcGVGaWxlUGF0aChtZXRhZGF0YVBhdGgpO1xuICAgIGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoYGNhdCA+ICR7ZXNjYXBlZE1ldGFkYXRhUGF0aH0gPDwgJ0VPRidcXG4ke21ldGFkYXRhQ29udGVudH1cXG5FT0ZgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg5Djg4Pjgq/jgqLjg4Pjg5fjg6Hjgr/jg4fjg7zjgr/jgpLoqq3jgb/ovrzjgb9cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgbG9hZEJhY2t1cE1ldGFkYXRhKGJhY2t1cFBhdGg6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgY29uc3QgbWV0YWRhdGFQYXRoID0gcGF0aC5wb3NpeC5qb2luKGJhY2t1cFBhdGgsICdtZXRhZGF0YS5qc29uJyk7XG4gICAgY29uc3QgZXNjYXBlZE1ldGFkYXRhUGF0aCA9IHRoaXMuZXNjYXBlRmlsZVBhdGgobWV0YWRhdGFQYXRoKTtcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgdGhpcy5leGVjdXRlU1NIQ29tbWFuZChgY2F0ICR7ZXNjYXBlZE1ldGFkYXRhUGF0aH1gKTtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShzdGRvdXQpO1xuICB9XG5cbiAgLyoqXG4gICAqIOODkOODg+OCr+OCouODg+ODl+OBruWtmOWcqOeiuuiqjVxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBiYWNrdXBFeGlzdHMoYmFja3VwUGF0aDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG1ldGFkYXRhUGF0aCA9IHBhdGgucG9zaXguam9pbihiYWNrdXBQYXRoLCAnbWV0YWRhdGEuanNvbicpO1xuICAgICAgY29uc3QgZXNjYXBlZE1ldGFkYXRhUGF0aCA9IHRoaXMuZXNjYXBlRmlsZVBhdGgobWV0YWRhdGFQYXRoKTtcbiAgICAgIGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoYHRlc3QgLWYgJHtlc2NhcGVkTWV0YWRhdGFQYXRofWApO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODkOODg+OCr+OCouODg+ODl+ODh+OCo+ODrOOCr+ODiOODquOBruaoqemZkOioreWumlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBzZXRCYWNrdXBQZXJtaXNzaW9ucyhiYWNrdXBQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgLy8g44OQ44OD44Kv44Ki44OD44OX44OH44Kj44Os44Kv44OI44Oq44Gu5qip6ZmQ6Kit5a6aXG4gICAgICBjb25zdCBlc2NhcGVkQmFja3VwUGF0aCA9IHRoaXMuZXNjYXBlRmlsZVBhdGgoYmFja3VwUGF0aCk7XG4gICAgICBhd2FpdCB0aGlzLmV4ZWN1dGVTU0hDb21tYW5kKGBjaG1vZCA3NTUgJHtlc2NhcGVkQmFja3VwUGF0aH1gKTtcbiAgICAgIFxuICAgICAgLy8g44Oh44K/44OH44O844K/44OV44Kh44Kk44Or44Gu5qip6ZmQ6Kit5a6aXG4gICAgICBjb25zdCBtZXRhZGF0YVBhdGggPSBwYXRoLnBvc2l4LmpvaW4oYmFja3VwUGF0aCwgJ21ldGFkYXRhLmpzb24nKTtcbiAgICAgIGNvbnN0IGVzY2FwZWRNZXRhZGF0YVBhdGggPSB0aGlzLmVzY2FwZUZpbGVQYXRoKG1ldGFkYXRhUGF0aCk7XG4gICAgICBhd2FpdCB0aGlzLmV4ZWN1dGVTU0hDb21tYW5kKGBjaG1vZCA2NDQgJHtlc2NhcGVkTWV0YWRhdGFQYXRofWApO1xuICAgICAgXG4gICAgICAvLyDjg5Djg4Pjgq/jgqLjg4Pjg5fjg5XjgqHjgqTjg6vjg4fjgqPjg6zjgq/jg4jjg6rjga7mqKnpmZDoqK3lrppcbiAgICAgIGNvbnN0IGZpbGVzUGF0aCA9IHBhdGgucG9zaXguam9pbihiYWNrdXBQYXRoLCAnZmlsZXMnKTtcbiAgICAgIGNvbnN0IGVzY2FwZWRGaWxlc1BhdGggPSB0aGlzLmVzY2FwZUZpbGVQYXRoKGZpbGVzUGF0aCk7XG4gICAgICBhd2FpdCB0aGlzLmV4ZWN1dGVTU0hDb21tYW5kKGBjaG1vZCAtUiA2NDQgJHtlc2NhcGVkRmlsZXNQYXRofWApO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLndhcm4oJ0VDMuODkOODg+OCr+OCouODg+ODl+aoqemZkOioreWumuOCqOODqeODvDonLCBlcnJvcik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODquODouODvOODiOODleOCoeOCpOODq+OBruODgeOCp+ODg+OCr+OCteODoOOCkuioiOeul1xuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBjYWxjdWxhdGVSZW1vdGVDaGVja3N1bShmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZXNjYXBlZEZpbGVQYXRoID0gdGhpcy5lc2NhcGVGaWxlUGF0aChmaWxlUGF0aCk7XG4gICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgdGhpcy5leGVjdXRlU1NIQ29tbWFuZChgc2hhMjU2c3VtICR7ZXNjYXBlZEZpbGVQYXRofSB8IGN1dCAtZCcgJyAtZjFgKTtcbiAgICAgIHJldHVybiBzdGRvdXQudHJpbSgpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYOODquODouODvOODiOODgeOCp+ODg+OCr+OCteODoOioiOeul+OCqOODqeODvDogJHtlcnJvcn1gKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU1NIIOOCs+ODnuODs+ODieOCkuWun+ihjFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBleGVjdXRlU1NIQ29tbWFuZChjb21tYW5kOiBzdHJpbmcpOiBQcm9taXNlPHsgc3Rkb3V0OiBzdHJpbmc7IHN0ZGVycjogc3RyaW5nIH0+IHtcbiAgICBjb25zdCBzc2hDb21tYW5kID0gYHNzaCAtaSBcIiR7dGhpcy5zc2hDb25maWcua2V5UGF0aH1cIiAtbyBDb25uZWN0VGltZW91dD0ke3RoaXMuc3NoQ29uZmlnLnRpbWVvdXQhIC8gMTAwMH0gLW8gU3RyaWN0SG9zdEtleUNoZWNraW5nPW5vIC1wICR7dGhpcy5zc2hDb25maWcucG9ydH0gJHt0aGlzLnNzaENvbmZpZy51c2VyfUAke3RoaXMuc3NoQ29uZmlnLmhvc3R9IFwiJHtjb21tYW5kfVwiYDtcbiAgICBcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZXhlY0FzeW5jKHNzaENvbW1hbmQsIHsgXG4gICAgICAgIHRpbWVvdXQ6IHRoaXMuc3NoQ29uZmlnLnRpbWVvdXQsXG4gICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAxMCAvLyAxME1CXG4gICAgICB9KTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgaWYgKGVycm9yLmNvZGUgPT09ICdFVElNRURPVVQnKSB7XG4gICAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuU1NIX0NPTk5FQ1RJT05fRkFJTEVELFxuICAgICAgICAgIGBTU0jmjqXntprjgYzjgr/jgqTjg6DjgqLjgqbjg4jjgZfjgb7jgZfjgZ86ICR7dGhpcy5zc2hDb25maWcuaG9zdH1gLFxuICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICAnZWMyJyxcbiAgICAgICAgICBlcnJvclxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEVDMueSsOWig+OBruODh+OCo+OCueOCr+S9v+eUqOmHj+OCkueiuuiqjVxuICAgKi9cbiAgcHVibGljIGFzeW5jIGNoZWNrRGlza1NwYWNlKCk6IFByb21pc2U8e1xuICAgIGF2YWlsYWJsZTogbnVtYmVyO1xuICAgIHVzZWQ6IG51bWJlcjtcbiAgICB0b3RhbDogbnVtYmVyO1xuICAgIHVzYWdlUGVyY2VudGFnZTogbnVtYmVyO1xuICB9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGVzY2FwZWRCYWNrdXBSb290RGlyID0gdGhpcy5lc2NhcGVGaWxlUGF0aCh0aGlzLmJhY2t1cFJvb3REaXIpO1xuICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoYGRmICR7ZXNjYXBlZEJhY2t1cFJvb3REaXJ9IHwgdGFpbCAtMSB8IGF3ayAne3ByaW50ICQyLCQzLCQ0LCQ1fScgfCBzZWQgJ3MvJS8vJ2ApO1xuICAgICAgY29uc3QgW3RvdGFsLCB1c2VkLCBhdmFpbGFibGUsIHVzYWdlUGVyY2VudGFnZV0gPSBzdGRvdXQudHJpbSgpLnNwbGl0KCcgJykubWFwKE51bWJlcik7XG4gICAgICBcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGF2YWlsYWJsZTogYXZhaWxhYmxlICogMTAyNCwgLy8gS0IgdG8gYnl0ZXNcbiAgICAgICAgdXNlZDogdXNlZCAqIDEwMjQsXG4gICAgICAgIHRvdGFsOiB0b3RhbCAqIDEwMjQsXG4gICAgICAgIHVzYWdlUGVyY2VudGFnZVxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuQkFDS1VQX0ZBSUxFRCxcbiAgICAgICAgYEVDMuODh+OCo+OCueOCr+WuuemHj+eiuuiqjeOBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtlcnJvcn1gLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICdlYzInLFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44OQ44OD44Kv44Ki44OD44OX44K144Kk44K644KS5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgZ2V0QmFja3VwU2l6ZShiYWNrdXBJZDogc3RyaW5nKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgYmFja3VwUGF0aCA9IHBhdGgucG9zaXguam9pbih0aGlzLmJhY2t1cFJvb3REaXIsIGJhY2t1cElkKTtcbiAgICAgIGNvbnN0IG1ldGFkYXRhID0gYXdhaXQgdGhpcy5sb2FkQmFja3VwTWV0YWRhdGEoYmFja3VwUGF0aCk7XG4gICAgICByZXR1cm4gbWV0YWRhdGEudG90YWxTaXplO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5CQUNLVVBfRkFJTEVELFxuICAgICAgICBgRUMy44OQ44OD44Kv44Ki44OD44OX44K144Kk44K65Y+W5b6X44Gr5aSx5pWX44GX44G+44GX44GfOiAke2JhY2t1cElkfWAsXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgJ2VjMicsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg5Djg4Pjgq/jgqLjg4Pjg5fjga7lnKfnuK5cbiAgICovXG4gIHB1YmxpYyBhc3luYyBjb21wcmVzc0JhY2t1cChiYWNrdXBJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGJhY2t1cFBhdGggPSBwYXRoLnBvc2l4LmpvaW4odGhpcy5iYWNrdXBSb290RGlyLCBiYWNrdXBJZCk7XG4gICAgICBjb25zdCBjb21wcmVzc2VkUGF0aCA9IGAke2JhY2t1cFBhdGh9LnRhci5nemA7XG4gICAgICBcbiAgICAgIC8vIOODkOODg+OCr+OCouODg+ODl+ODh+OCo+ODrOOCr+ODiOODquOCkuWcp+e4rlxuICAgICAgY29uc3QgZXNjYXBlZENvbXByZXNzZWRQYXRoID0gdGhpcy5lc2NhcGVGaWxlUGF0aChjb21wcmVzc2VkUGF0aCk7XG4gICAgICBjb25zdCBlc2NhcGVkQmFja3VwUm9vdERpciA9IHRoaXMuZXNjYXBlRmlsZVBhdGgodGhpcy5iYWNrdXBSb290RGlyKTtcbiAgICAgIGNvbnN0IGVzY2FwZWRCYWNrdXBJZCA9IHRoaXMuZXNjYXBlRmlsZVBhdGgoYmFja3VwSWQpO1xuICAgICAgY29uc3QgZXNjYXBlZEJhY2t1cFBhdGggPSB0aGlzLmVzY2FwZUZpbGVQYXRoKGJhY2t1cFBhdGgpO1xuICAgICAgYXdhaXQgdGhpcy5leGVjdXRlU1NIQ29tbWFuZChgdGFyIC1jemYgJHtlc2NhcGVkQ29tcHJlc3NlZFBhdGh9IC1DICR7ZXNjYXBlZEJhY2t1cFJvb3REaXJ9ICR7ZXNjYXBlZEJhY2t1cElkfWApO1xuICAgICAgXG4gICAgICAvLyDlhYPjga7jg4fjgqPjg6zjgq/jg4jjg6rjgpLliYrpmaRcbiAgICAgIGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoYHJtIC1yZiAke2VzY2FwZWRCYWNrdXBQYXRofWApO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhg4pyFIEVDMuODkOODg+OCr+OCouODg+ODl+OCkuWcp+e4ruOBl+OBvuOBl+OBnzogJHtiYWNrdXBJZH1gKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuQkFDS1VQX0ZBSUxFRCxcbiAgICAgICAgYEVDMuODkOODg+OCr+OCouODg+ODl+Wcp+e4ruOBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtiYWNrdXBJZH1gLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICdlYzInLFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog5Zyn57iu44GV44KM44Gf44OQ44OD44Kv44Ki44OD44OX44KS5bGV6ZaLXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgZGVjb21wcmVzc0JhY2t1cChiYWNrdXBJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNvbXByZXNzZWRQYXRoID0gcGF0aC5wb3NpeC5qb2luKHRoaXMuYmFja3VwUm9vdERpciwgYCR7YmFja3VwSWR9LnRhci5nemApO1xuICAgICAgXG4gICAgICAvLyDlnKfnuK7jg5XjgqHjgqTjg6vjgpLlsZXplotcbiAgICAgIGNvbnN0IGVzY2FwZWRDb21wcmVzc2VkUGF0aCA9IHRoaXMuZXNjYXBlRmlsZVBhdGgoY29tcHJlc3NlZFBhdGgpO1xuICAgICAgY29uc3QgZXNjYXBlZEJhY2t1cFJvb3REaXIgPSB0aGlzLmVzY2FwZUZpbGVQYXRoKHRoaXMuYmFja3VwUm9vdERpcik7XG4gICAgICBhd2FpdCB0aGlzLmV4ZWN1dGVTU0hDb21tYW5kKGB0YXIgLXh6ZiAke2VzY2FwZWRDb21wcmVzc2VkUGF0aH0gLUMgJHtlc2NhcGVkQmFja3VwUm9vdERpcn1gKTtcbiAgICAgIFxuICAgICAgLy8g5Zyn57iu44OV44Kh44Kk44Or44KS5YmK6ZmkXG4gICAgICBhd2FpdCB0aGlzLmV4ZWN1dGVTU0hDb21tYW5kKGBybSAtZiAke2VzY2FwZWRDb21wcmVzc2VkUGF0aH1gKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYOKchSBFQzLjg5Djg4Pjgq/jgqLjg4Pjg5fjgpLlsZXplovjgZfjgb7jgZfjgZ86ICR7YmFja3VwSWR9YCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgT3JnYW5pemF0aW9uRXJyb3JUeXBlLkJBQ0tVUF9GQUlMRUQsXG4gICAgICAgIGBFQzLjg5Djg4Pjgq/jgqLjg4Pjg5flsZXplovjgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7YmFja3VwSWR9YCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAnZWMyJyxcbiAgICAgICAgZXJyb3IgYXMgRXJyb3JcbiAgICAgICk7XG4gICAgfVxuICB9XG59Il19