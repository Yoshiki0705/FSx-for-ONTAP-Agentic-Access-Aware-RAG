"use strict";
/**
 * 統合ファイル整理システム - 同期マネージャー
 *
 * 環境間同期実行機能を提供し、
 * 整合性検証とレポート生成を実行します。
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
exports.SyncManager = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const index_js_1 = require("../types/index.js");
const structure_comparator_js_1 = require("./structure-comparator.js");
const directory_creator_js_1 = require("../structure/directory-creator.js");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * 同期マネージャー
 *
 * 環境間の同期実行と整合性検証を提供します。
 */
class SyncManager {
    structureComparator;
    directoryCreator;
    sshConfig;
    maxRetries = 3;
    constructor(sshConfig) {
        this.sshConfig = sshConfig;
        this.structureComparator = new structure_comparator_js_1.StructureComparator(sshConfig);
        this.directoryCreator = new directory_creator_js_1.DirectoryCreator({}, sshConfig); // 簡略化
    }
    /**
     * 環境間同期を実行
     */
    async executeSync(localRootPath = '.', ec2RootPath = '/home/ubuntu', options = {
        direction: 'bidirectional',
        dryRun: false,
        overwriteExisting: false,
        syncPermissions: true,
        createBackup: true,
        excludePatterns: ['node_modules', '.git', 'cdk.out']
    }) {
        const syncId = `sync-${Date.now()}`;
        const startTime = Date.now();
        console.log(`🔄 環境間同期を開始: ${options.direction} (${options.dryRun ? 'ドライラン' : '実行'})`);
        try {
            // 事前構造比較
            const comparison = await this.structureComparator.compareStructures(localRootPath, ec2RootPath);
            console.log(`📊 事前比較完了: 一致率${comparison.matchPercentage.toFixed(1)}%, 差分${comparison.differences.length}個`);
            // バックアップ作成（オプション）
            if (options.createBackup && !options.dryRun) {
                await this.createSyncBackup(localRootPath, ec2RootPath);
            }
            // 同期実行
            const syncResult = await this.performSync(comparison, options, syncId, startTime);
            // 事後検証
            if (!options.dryRun && syncResult.success) {
                await this.verifySyncResult(localRootPath, ec2RootPath, syncResult);
            }
            console.log(`${syncResult.success ? '✅' : '⚠️'} 環境間同期完了: ${syncResult.statistics.syncedFiles}ファイル同期 (${syncResult.processingTime}ms)`);
            return syncResult;
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.SYNC_FAILED, `環境間同期に失敗しました: ${error}`, undefined, undefined, error);
        }
    }
    /**
     * 同期を実行
     */
    async performSync(comparison, options, syncId, startTime) {
        const syncedItems = [];
        const failedItems = [];
        const errors = [];
        // 同期対象の差分をフィルタリング
        const targetDifferences = this.filterSyncTargets(comparison.differences, options);
        console.log(`🎯 同期対象: ${targetDifferences.length}個の差分`);
        // 差分を処理
        for (const difference of targetDifferences) {
            try {
                const result = await this.processSyncDifference(difference, options);
                if (result) {
                    syncedItems.push(result);
                }
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                failedItems.push({
                    path: difference.path,
                    error: errorMsg,
                    attempts: 1
                });
                errors.push(`${difference.path}: ${errorMsg}`);
            }
        }
        // 統計情報の生成
        const statistics = this.generateSyncStatistics(syncedItems, failedItems);
        const processingTime = Date.now() - startTime;
        return {
            syncId,
            syncTime: new Date(),
            success: failedItems.length === 0,
            direction: options.direction,
            statistics,
            syncedItems,
            failedItems,
            errors,
            processingTime
        };
    }
    /**
     * 同期対象をフィルタリング
     */
    filterSyncTargets(differences, options) {
        return differences.filter(diff => {
            // 除外パターンのチェック
            for (const pattern of options.excludePatterns) {
                if (diff.path.includes(pattern)) {
                    return false;
                }
            }
            // 同期方向のチェック
            if (options.direction === 'local_to_ec2' && diff.environment === 'local') {
                return false;
            }
            if (options.direction === 'ec2_to_local' && diff.environment === 'ec2') {
                return false;
            }
            // ファイルタイプのチェック
            if (options.includeFileTypes && options.includeFileTypes.length > 0) {
                const ext = path.extname(diff.path);
                if (!options.includeFileTypes.includes(ext)) {
                    return false;
                }
            }
            return true;
        });
    }
    /**
     * 個別差分を処理
     */
    async processSyncDifference(difference, options) {
        const itemStartTime = Date.now();
        if (options.dryRun) {
            console.log(`🔍 [ドライラン] ${difference.type}: ${difference.path}`);
            return {
                type: difference.type.includes('directory') ? 'directory' : 'file',
                sourcePath: difference.path,
                targetPath: difference.path,
                action: 'created', // 仮の値
                processingTime: Date.now() - itemStartTime
            };
        }
        switch (difference.type) {
            case 'missing_directory':
                return await this.syncMissingDirectory(difference, options, itemStartTime);
            case 'missing_file':
                return await this.syncMissingFile(difference, options, itemStartTime);
            case 'permission_mismatch':
                return await this.syncPermissions(difference, options, itemStartTime);
            case 'size_mismatch':
                return await this.syncFileContent(difference, options, itemStartTime);
            default:
                console.warn(`⚠️ 未対応の差分タイプ: ${difference.type}`);
                return null;
        }
    }
    /**
     * 不足ディレクトリを同期
     */
    async syncMissingDirectory(difference, options, startTime) {
        const targetEnv = difference.environment;
        if (targetEnv === 'ec2') {
            await this.executeSSHCommand(`mkdir -p "${difference.path}"`);
        }
        else {
            await fs.mkdir(difference.path, { recursive: true });
        }
        console.log(`📁 ディレクトリ作成: ${difference.path} (${targetEnv})`);
        return {
            type: 'directory',
            sourcePath: difference.path,
            targetPath: difference.path,
            action: 'created',
            processingTime: Date.now() - startTime
        };
    }
    /**
     * 不足ファイルを同期
     */
    async syncMissingFile(difference, options, startTime) {
        const targetEnv = difference.environment;
        if (targetEnv === 'ec2') {
            // ローカルからEC2へ
            await this.copyFileToEC2(difference.path, difference.path);
        }
        else {
            // EC2からローカルへ
            await this.copyFileFromEC2(difference.path, difference.path);
        }
        console.log(`📄 ファイル同期: ${difference.path} → ${targetEnv}`);
        return {
            type: 'file',
            sourcePath: difference.path,
            targetPath: difference.path,
            action: 'created',
            processingTime: Date.now() - startTime
        };
    }
    /**
     * 権限を同期
     */
    async syncPermissions(difference, options, startTime) {
        if (!options.syncPermissions) {
            return null;
        }
        const targetEnv = difference.environment;
        const expectedPermissions = difference.details.expected;
        if (targetEnv === 'ec2') {
            await this.executeSSHCommand(`chmod ${expectedPermissions} "${difference.path}"`);
        }
        else {
            await fs.chmod(difference.path, parseInt(expectedPermissions, 8));
        }
        console.log(`🔒 権限同期: ${difference.path} → ${expectedPermissions} (${targetEnv})`);
        return {
            type: 'file',
            sourcePath: difference.path,
            targetPath: difference.path,
            action: 'permission_updated',
            processingTime: Date.now() - startTime
        };
    }
    /**
     * ファイル内容を同期
     */
    async syncFileContent(difference, options, startTime) {
        const targetEnv = difference.environment;
        if (!options.overwriteExisting) {
            throw new Error(`ファイル上書きが無効です: ${difference.path}`);
        }
        if (targetEnv === 'ec2') {
            await this.copyFileToEC2(difference.path, difference.path);
        }
        else {
            await this.copyFileFromEC2(difference.path, difference.path);
        }
        console.log(`🔄 ファイル更新: ${difference.path} (${targetEnv})`);
        return {
            type: 'file',
            sourcePath: difference.path,
            targetPath: difference.path,
            action: 'updated',
            size: difference.details.expected || 0,
            processingTime: Date.now() - startTime
        };
    }
    /**
     * ローカルファイルをEC2にコピー
     */
    async copyFileToEC2(localPath, ec2Path) {
        if (!this.sshConfig) {
            throw new Error('SSH設定が必要です');
        }
        const scpCommand = `scp -i "${this.sshConfig.keyPath}" -o ConnectTimeout=${this.sshConfig.timeout / 1000} -o StrictHostKeyChecking=no -P ${this.sshConfig.port} "${localPath}" ${this.sshConfig.user}@${this.sshConfig.host}:"${ec2Path}"`;
        await execAsync(scpCommand, { timeout: this.sshConfig.timeout });
    }
    /**
     * EC2ファイルをローカルにコピー
     */
    async copyFileFromEC2(ec2Path, localPath) {
        if (!this.sshConfig) {
            throw new Error('SSH設定が必要です');
        }
        // ローカルディレクトリを作成
        const localDir = path.dirname(localPath);
        await fs.mkdir(localDir, { recursive: true });
        const scpCommand = `scp -i "${this.sshConfig.keyPath}" -o ConnectTimeout=${this.sshConfig.timeout / 1000} -o StrictHostKeyChecking=no -P ${this.sshConfig.port} ${this.sshConfig.user}@${this.sshConfig.host}:"${ec2Path}" "${localPath}"`;
        await execAsync(scpCommand, { timeout: this.sshConfig.timeout });
    }
    /**
     * 同期統計を生成
     */
    generateSyncStatistics(syncedItems, failedItems) {
        const directories = syncedItems.filter(item => item.type === 'directory');
        const files = syncedItems.filter(item => item.type === 'file');
        return {
            processedDirectories: directories.length,
            processedFiles: files.length,
            createdDirectories: directories.filter(item => item.action === 'created').length,
            syncedFiles: files.filter(item => item.action === 'created' || item.action === 'updated').length,
            deletedItems: syncedItems.filter(item => item.action === 'deleted').length,
            permissionUpdates: syncedItems.filter(item => item.action === 'permission_updated').length,
            totalDataSize: files.reduce((sum, item) => sum + (item.size || 0), 0),
            skippedItems: failedItems.length
        };
    }
    /**
     * 同期バックアップを作成
     */
    async createSyncBackup(localRootPath, ec2RootPath) {
        console.log('💾 同期前バックアップを作成中...');
        const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
        // ローカルバックアップ
        const localBackupPath = `backup-local-${backupTimestamp}`;
        await execAsync(`cp -r "${localRootPath}" "${localBackupPath}"`);
        // EC2バックアップ
        const ec2BackupPath = `/tmp/backup-ec2-${backupTimestamp}`;
        await this.executeSSHCommand(`cp -r "${ec2RootPath}" "${ec2BackupPath}"`);
        console.log('✅ 同期前バックアップ作成完了');
    }
    /**
     * 同期結果を検証
     */
    async verifySyncResult(localRootPath, ec2RootPath, syncResult) {
        console.log('🔍 同期結果を検証中...');
        const postComparison = await this.structureComparator.compareStructures(localRootPath, ec2RootPath);
        if (postComparison.matchPercentage > 95) {
            console.log(`✅ 同期検証成功: 一致率${postComparison.matchPercentage.toFixed(1)}%`);
        }
        else {
            console.warn(`⚠️ 同期検証で問題を検出: 一致率${postComparison.matchPercentage.toFixed(1)}%`);
        }
    }
    /**
     * 整合性検証を実行
     */
    async verifyConsistency(localRootPath = '.', ec2RootPath = '/home/ubuntu') {
        const verificationId = `verification-${Date.now()}`;
        const startTime = Date.now();
        console.log('🔍 環境間整合性検証を開始...');
        try {
            const comparison = await this.structureComparator.compareStructures(localRootPath, ec2RootPath);
            const inconsistencies = comparison.differences.map(diff => ({
                path: diff.path,
                type: this.mapDifferenceToInconsistency(diff.type),
                details: diff.details.description,
                severity: diff.severity
            }));
            const verificationTime = Date.now() - startTime;
            const isConsistent = inconsistencies.length === 0;
            console.log(`${isConsistent ? '✅' : '⚠️'} 整合性検証完了: ${inconsistencies.length}個の不整合 (${verificationTime}ms)`);
            return {
                verificationId,
                verificationTime: new Date(),
                isConsistent,
                inconsistencies,
                statistics: {
                    totalItems: comparison.summary.totalItems,
                    consistentItems: comparison.summary.matchingItems,
                    inconsistentItems: inconsistencies.length,
                    verificationTime
                }
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.VALIDATION_FAILED, `整合性検証に失敗しました: ${error}`, undefined, undefined, error);
        }
    }
    /**
     * 差分タイプを不整合タイプにマップ
     */
    mapDifferenceToInconsistency(diffType) {
        switch (diffType) {
            case 'missing_directory':
            case 'missing_file':
            case 'extra_directory':
            case 'extra_file':
                return 'missing';
            case 'size_mismatch':
                return 'size_mismatch';
            case 'permission_mismatch':
                return 'permission_mismatch';
            case 'content_mismatch':
                return 'content_mismatch';
            default:
                return 'missing';
        }
    }
    /**
     * 同期レポートを生成
     */
    generateSyncReport(syncResult) {
        const { statistics, syncedItems, failedItems } = syncResult;
        const successRate = Math.round(((statistics.syncedFiles + statistics.createdDirectories) /
            (statistics.processedFiles + statistics.processedDirectories)) * 100);
        return `
# 環境間同期レポート

## 同期サマリー
- **同期日時**: ${syncResult.syncTime.toLocaleString('ja-JP')}
- **同期ID**: ${syncResult.syncId}
- **同期方向**: ${syncResult.direction}
- **成功**: ${syncResult.success ? 'はい' : 'いいえ'}
- **処理時間**: ${Math.round(syncResult.processingTime / 1000)}秒

## 同期統計
- **処理ディレクトリ数**: ${statistics.processedDirectories}個
- **処理ファイル数**: ${statistics.processedFiles}個
- **作成ディレクトリ数**: ${statistics.createdDirectories}個
- **同期ファイル数**: ${statistics.syncedFiles}個
- **権限更新数**: ${statistics.permissionUpdates}個
- **総データサイズ**: ${Math.round(statistics.totalDataSize / 1024 / 1024)}MB
- **成功率**: ${successRate}%

## 同期されたアイテム（上位10件）
${syncedItems.slice(0, 10).map(item => `- **${item.type}**: ${item.sourcePath} (${item.action})`).join('\n') || '- 同期アイテムなし'}
${syncedItems.length > 10 ? `\n... 他${syncedItems.length - 10}個` : ''}

## 失敗したアイテム
${failedItems.map(item => `- **${item.path}**: ${item.error}`).join('\n') || '- 失敗なし'}

## パフォーマンス
- **平均処理時間**: ${Math.round(syncResult.processingTime / (statistics.processedFiles + statistics.processedDirectories))}ms/アイテム
- **スループット**: ${Math.round((statistics.processedFiles + statistics.processedDirectories) / (syncResult.processingTime / 1000))}アイテム/秒
- **データ転送速度**: ${Math.round(statistics.totalDataSize / 1024 / (syncResult.processingTime / 1000))}KB/秒

## エラー詳細
${syncResult.errors.length > 0 ?
            syncResult.errors.map(error => `- ${error}`).join('\n') :
            '- エラーなし'}
`;
    }
    /**
     * SSH コマンドを実行
     */
    async executeSSHCommand(command) {
        if (!this.sshConfig) {
            throw new Error('SSH設定が必要です');
        }
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
}
exports.SyncManager = SyncManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3luYy1tYW5hZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic3luYy1tYW5hZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7R0FLRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxnREFBa0M7QUFDbEMsMkNBQTZCO0FBQzdCLGlEQUFxQztBQUNyQywrQkFBaUM7QUFDakMsZ0RBSzJCO0FBRTNCLHVFQUEwRztBQUMxRyw0RUFBcUU7QUFFckUsTUFBTSxTQUFTLEdBQUcsSUFBQSxnQkFBUyxFQUFDLG9CQUFJLENBQUMsQ0FBQztBQXFJbEM7Ozs7R0FJRztBQUNILE1BQWEsV0FBVztJQUNMLG1CQUFtQixDQUFzQjtJQUN6QyxnQkFBZ0IsQ0FBbUI7SUFDbkMsU0FBUyxDQUFhO0lBQ3RCLFVBQVUsR0FBVyxDQUFDLENBQUM7SUFFeEMsWUFBWSxTQUFxQjtRQUMvQixJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztRQUMzQixJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSw2Q0FBbUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUM5RCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSx1Q0FBZ0IsQ0FBQyxFQUFTLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxNQUFNO0lBQzVFLENBQUM7SUFFRDs7T0FFRztJQUNJLEtBQUssQ0FBQyxXQUFXLENBQ3RCLGdCQUF3QixHQUFHLEVBQzNCLGNBQXNCLGNBQWMsRUFDcEMsVUFBdUI7UUFDckIsU0FBUyxFQUFFLGVBQWU7UUFDMUIsTUFBTSxFQUFFLEtBQUs7UUFDYixpQkFBaUIsRUFBRSxLQUFLO1FBQ3hCLGVBQWUsRUFBRSxJQUFJO1FBQ3JCLFlBQVksRUFBRSxJQUFJO1FBQ2xCLGVBQWUsRUFBRSxDQUFDLGNBQWMsRUFBRSxNQUFNLEVBQUUsU0FBUyxDQUFDO0tBQ3JEO1FBRUQsTUFBTSxNQUFNLEdBQUcsUUFBUSxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQztR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TUFBTSxJQUFJLDRCQUFpQixDQUN6QixnQ0FBcUIsQ0FBQyxxQkFBcUIsRUFDM0MscUJBQXFCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLEVBQzFDLFNBQVMsRUFDVCxLQUFLLEVBQ0wsS0FBSyxDQUNOLENBQUM7WUFDSixDQUFDO1lBQ0QsTUFBTSxLQUFLLENBQUM7UUFDZCxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBbGlCRCxrQ0FraUJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiDntbHlkIjjg5XjgqHjgqTjg6vmlbTnkIbjgrfjgrnjg4bjg6AgLSDlkIzmnJ/jg57jg43jg7zjgrjjg6Pjg7xcbiAqIFxuICog55Kw5aKD6ZaT5ZCM5pyf5a6f6KGM5qmf6IO944KS5o+Q5L6b44GX44CBXG4gKiDmlbTlkIjmgKfmpJzoqLzjgajjg6zjg53jg7zjg4jnlJ/miJDjgpLlrp/ooYzjgZfjgb7jgZnjgIJcbiAqL1xuXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgeyBcbiAgRW52aXJvbm1lbnQsXG4gIEZpbGVJbmZvLFxuICBPcmdhbml6YXRpb25FcnJvcixcbiAgT3JnYW5pemF0aW9uRXJyb3JUeXBlXG59IGZyb20gJy4uL3R5cGVzL2luZGV4LmpzJztcbmltcG9ydCB7IFNTSENvbmZpZyB9IGZyb20gJy4uL3NjYW5uZXJzL2VjMi1zY2FubmVyLmpzJztcbmltcG9ydCB7IFN0cnVjdHVyZUNvbXBhcmF0b3IsIFN0cnVjdHVyZUNvbXBhcmlzb24sIFN0cnVjdHVyZURpZmZlcmVuY2UgfSBmcm9tICcuL3N0cnVjdHVyZS1jb21wYXJhdG9yLmpzJztcbmltcG9ydCB7IERpcmVjdG9yeUNyZWF0b3IgfSBmcm9tICcuLi9zdHJ1Y3R1cmUvZGlyZWN0b3J5LWNyZWF0b3IuanMnO1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYyk7XG5cbi8qKlxuICog5ZCM5pyf44Kq44OX44K344On44OzXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3luY09wdGlvbnMge1xuICAvKiog5ZCM5pyf5pa55ZCRICovXG4gIGRpcmVjdGlvbjogJ2xvY2FsX3RvX2VjMicgfCAnZWMyX3RvX2xvY2FsJyB8ICdiaWRpcmVjdGlvbmFsJztcbiAgLyoqIOODieODqeOCpOODqeODs+ODouODvOODiSAqL1xuICBkcnlSdW46IGJvb2xlYW47XG4gIC8qKiDml6LlrZjjg5XjgqHjgqTjg6vjgpLkuIrmm7jjgY3jgZnjgovjgYsgKi9cbiAgb3ZlcndyaXRlRXhpc3Rpbmc6IGJvb2xlYW47XG4gIC8qKiDmqKnpmZDjgoLlkIzmnJ/jgZnjgovjgYsgKi9cbiAgc3luY1Blcm1pc3Npb25zOiBib29sZWFuO1xuICAvKiog44OQ44OD44Kv44Ki44OD44OX44KS5L2c5oiQ44GZ44KL44GLICovXG4gIGNyZWF0ZUJhY2t1cDogYm9vbGVhbjtcbiAgLyoqIOmZpOWkluODkeOCv+ODvOODsyAqL1xuICBleGNsdWRlUGF0dGVybnM6IHN0cmluZ1tdO1xuICAvKiog5ZCM5pyf5a++6LGh44Gu44OV44Kh44Kk44Or44K/44Kk44OXICovXG4gIGluY2x1ZGVGaWxlVHlwZXM/OiBzdHJpbmdbXTtcbn1cblxuLyoqXG4gKiDlkIzmnJ/ntZDmnpxcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTeW5jUmVzdWx0IHtcbiAgLyoqIOWQjOacn0lEICovXG4gIHN5bmNJZDogc3RyaW5nO1xuICAvKiog5ZCM5pyf5pmC5Yi7ICovXG4gIHN5bmNUaW1lOiBEYXRlO1xuICAvKiog5oiQ5Yqf44GX44Gf44GL44Gp44GG44GLICovXG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIC8qKiDlkIzmnJ/mlrnlkJEgKi9cbiAgZGlyZWN0aW9uOiBzdHJpbmc7XG4gIC8qKiDlkIzmnJ/ntbHoqIggKi9cbiAgc3RhdGlzdGljczogU3luY1N0YXRpc3RpY3M7XG4gIC8qKiDlkIzmnJ/jgZXjgozjgZ/jgqLjgqTjg4bjg6AgKi9cbiAgc3luY2VkSXRlbXM6IFN5bmNlZEl0ZW1bXTtcbiAgLyoqIOWkseaVl+OBl+OBn+OCouOCpOODhuODoCAqL1xuICBmYWlsZWRJdGVtczogRmFpbGVkSXRlbVtdO1xuICAvKiog44Ko44Op44O8ICovXG4gIGVycm9yczogc3RyaW5nW107XG4gIC8qKiDlh6bnkIbmmYLplpMgKi9cbiAgcHJvY2Vzc2luZ1RpbWU6IG51bWJlcjtcbn1cblxuLyoqXG4gKiDlkIzmnJ/ntbHoqIhcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTeW5jU3RhdGlzdGljcyB7XG4gIC8qKiDlh6bnkIbjgZfjgZ/jg4fjgqPjg6zjgq/jg4jjg6rmlbAgKi9cbiAgcHJvY2Vzc2VkRGlyZWN0b3JpZXM6IG51bWJlcjtcbiAgLyoqIOWHpueQhuOBl+OBn+ODleOCoeOCpOODq+aVsCAqL1xuICBwcm9jZXNzZWRGaWxlczogbnVtYmVyO1xuICAvKiog5L2c5oiQ44GX44Gf44OH44Kj44Os44Kv44OI44Oq5pWwICovXG4gIGNyZWF0ZWREaXJlY3RvcmllczogbnVtYmVyO1xuICAvKiog5ZCM5pyf44GX44Gf44OV44Kh44Kk44Or5pWwICovXG4gIHN5bmNlZEZpbGVzOiBudW1iZXI7XG4gIC8qKiDliYrpmaTjgZfjgZ/jgqLjgqTjg4bjg6DmlbAgKi9cbiAgZGVsZXRlZEl0ZW1zOiBudW1iZXI7XG4gIC8qKiDmqKnpmZDjgpLmm7TmlrDjgZfjgZ/jgqLjgqTjg4bjg6DmlbAgKi9cbiAgcGVybWlzc2lvblVwZGF0ZXM6IG51bWJlcjtcbiAgLyoqIOe3j+ODh+ODvOOCv+OCteOCpOOCuiAqL1xuICB0b3RhbERhdGFTaXplOiBudW1iZXI7XG4gIC8qKiDjgrnjgq3jg4Pjg5fjgZfjgZ/jgqLjgqTjg4bjg6DmlbAgKi9cbiAgc2tpcHBlZEl0ZW1zOiBudW1iZXI7XG59XG5cbi8qKlxuICog5ZCM5pyf44GV44KM44Gf44Ki44Kk44OG44OgXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3luY2VkSXRlbSB7XG4gIC8qKiDjgqLjgqTjg4bjg6Djgr/jgqTjg5cgKi9cbiAgdHlwZTogJ2RpcmVjdG9yeScgfCAnZmlsZSc7XG4gIC8qKiDjgr3jg7zjgrnjg5HjgrkgKi9cbiAgc291cmNlUGF0aDogc3RyaW5nO1xuICAvKiog44K/44O844Ky44OD44OI44OR44K5ICovXG4gIHRhcmdldFBhdGg6IHN0cmluZztcbiAgLyoqIOOCouOCr+OCt+ODp+ODsyAqL1xuICBhY3Rpb246ICdjcmVhdGVkJyB8ICd1cGRhdGVkJyB8ICdkZWxldGVkJyB8ICdwZXJtaXNzaW9uX3VwZGF0ZWQnO1xuICAvKiog44K144Kk44K677yI44OV44Kh44Kk44Or44Gu5aC05ZCI77yJICovXG4gIHNpemU/OiBudW1iZXI7XG4gIC8qKiDlh6bnkIbmmYLplpMgKi9cbiAgcHJvY2Vzc2luZ1RpbWU6IG51bWJlcjtcbn1cblxuLyoqXG4gKiDlpLHmlZfjgZfjgZ/jgqLjgqTjg4bjg6BcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBGYWlsZWRJdGVtIHtcbiAgLyoqIOOCouOCpOODhuODoOODkeOCuSAqL1xuICBwYXRoOiBzdHJpbmc7XG4gIC8qKiDjgqjjg6njg7zjg6Hjg4Pjgrvjg7zjgrggKi9cbiAgZXJyb3I6IHN0cmluZztcbiAgLyoqIOippuihjOWbnuaVsCAqL1xuICBhdHRlbXB0czogbnVtYmVyO1xufVxuXG4vKipcbiAqIOaVtOWQiOaAp+aknOiovOe1kOaenFxuICovXG5leHBvcnQgaW50ZXJmYWNlIENvbnNpc3RlbmN5VmVyaWZpY2F0aW9uIHtcbiAgLyoqIOaknOiovElEICovXG4gIHZlcmlmaWNhdGlvbklkOiBzdHJpbmc7XG4gIC8qKiDmpJzoqLzmmYLliLsgKi9cbiAgdmVyaWZpY2F0aW9uVGltZTogRGF0ZTtcbiAgLyoqIOaVtOWQiOaAp+OBjOWPluOCjOOBpuOBhOOCi+OBiyAqL1xuICBpc0NvbnNpc3RlbnQ6IGJvb2xlYW47XG4gIC8qKiDkuI3mlbTlkIjpoIXnm64gKi9cbiAgaW5jb25zaXN0ZW5jaWVzOiBJbmNvbnNpc3RlbmN5SXRlbVtdO1xuICAvKiog5qSc6Ki857Wx6KiIICovXG4gIHN0YXRpc3RpY3M6IHtcbiAgICB0b3RhbEl0ZW1zOiBudW1iZXI7XG4gICAgY29uc2lzdGVudEl0ZW1zOiBudW1iZXI7XG4gICAgaW5jb25zaXN0ZW50SXRlbXM6IG51bWJlcjtcbiAgICB2ZXJpZmljYXRpb25UaW1lOiBudW1iZXI7XG4gIH07XG59XG5cbi8qKlxuICog5LiN5pW05ZCI6aCF55uuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSW5jb25zaXN0ZW5jeUl0ZW0ge1xuICAvKiog44OR44K5ICovXG4gIHBhdGg6IHN0cmluZztcbiAgLyoqIOS4jeaVtOWQiOOCv+OCpOODlyAqL1xuICB0eXBlOiAnbWlzc2luZycgfCAnc2l6ZV9taXNtYXRjaCcgfCAncGVybWlzc2lvbl9taXNtYXRjaCcgfCAnY29udGVudF9taXNtYXRjaCc7XG4gIC8qKiDoqbPntLAgKi9cbiAgZGV0YWlsczogc3RyaW5nO1xuICAvKiog6YeN6KaB5bqmICovXG4gIHNldmVyaXR5OiAnbG93JyB8ICdtZWRpdW0nIHwgJ2hpZ2gnIHwgJ2NyaXRpY2FsJztcbn1cblxuLyoqXG4gKiDlkIzmnJ/jg57jg43jg7zjgrjjg6Pjg7xcbiAqIFxuICog55Kw5aKD6ZaT44Gu5ZCM5pyf5a6f6KGM44Go5pW05ZCI5oCn5qSc6Ki844KS5o+Q5L6b44GX44G+44GZ44CCXG4gKi9cbmV4cG9ydCBjbGFzcyBTeW5jTWFuYWdlciB7XG4gIHByaXZhdGUgcmVhZG9ubHkgc3RydWN0dXJlQ29tcGFyYXRvcjogU3RydWN0dXJlQ29tcGFyYXRvcjtcbiAgcHJpdmF0ZSByZWFkb25seSBkaXJlY3RvcnlDcmVhdG9yOiBEaXJlY3RvcnlDcmVhdG9yO1xuICBwcml2YXRlIHJlYWRvbmx5IHNzaENvbmZpZz86IFNTSENvbmZpZztcbiAgcHJpdmF0ZSByZWFkb25seSBtYXhSZXRyaWVzOiBudW1iZXIgPSAzO1xuXG4gIGNvbnN0cnVjdG9yKHNzaENvbmZpZz86IFNTSENvbmZpZykge1xuICAgIHRoaXMuc3NoQ29uZmlnID0gc3NoQ29uZmlnO1xuICAgIHRoaXMuc3RydWN0dXJlQ29tcGFyYXRvciA9IG5ldyBTdHJ1Y3R1cmVDb21wYXJhdG9yKHNzaENvbmZpZyk7XG4gICAgdGhpcy5kaXJlY3RvcnlDcmVhdG9yID0gbmV3IERpcmVjdG9yeUNyZWF0b3Ioe30gYXMgYW55LCBzc2hDb25maWcpOyAvLyDnsKHnlaXljJZcbiAgfVxuXG4gIC8qKlxuICAgKiDnkrDlooPplpPlkIzmnJ/jgpLlrp/ooYxcbiAgICovXG4gIHB1YmxpYyBhc3luYyBleGVjdXRlU3luYyhcbiAgICBsb2NhbFJvb3RQYXRoOiBzdHJpbmcgPSAnLicsXG4gICAgZWMyUm9vdFBhdGg6IHN0cmluZyA9ICcvaG9tZS91YnVudHUnLFxuICAgIG9wdGlvbnM6IFN5bmNPcHRpb25zID0ge1xuICAgICAgZGlyZWN0aW9uOiAnYmlkaXJlY3Rpb25hbCcsXG4gICAgICBkcnlSdW46IGZhbHNlLFxuICAgICAgb3ZlcndyaXRlRXhpc3Rpbmc6IGZhbHNlLFxuICAgICAgc3luY1Blcm1pc3Npb25zOiB0cnVlLFxuICAgICAgY3JlYXRlQmFja3VwOiB0cnVlLFxuICAgICAgZXhjbHVkZVBhdHRlcm5zOiBbJ25vZGVfbW9kdWxlcycsICcuZ2l0JywgJ2Nkay5vdXQnXVxuICAgIH1cbiAgKTogUHJvbWlzZTxTeW5jUmVzdWx0PiB7XG4gICAgY29uc3Qgc3luY0lkID0gYHN5bmMtJHtEYXRlLm5vdygpfWA7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICBcbiAgICBjb25zb2xlLmxvZyhg8J+UhCDnkrDlooPplpPlkIzmnJ/jgpLplovlp4s6ICR7b3B0aW9ucy5kaXJlY3Rpb259ICgke29wdGlvbnMuZHJ5UnVuID8gJ+ODieODqeOCpOODqeODsycgOiAn5a6f6KGMJ30pYCk7XG5cbiAgICB0cnkge1xuICAgICAgLy8g5LqL5YmN5qeL6YCg5q+U6LyDXG4gICAgICBjb25zdCBjb21wYXJpc29uID0gYXdhaXQgdGhpcy5zdHJ1Y3R1cmVDb21wYXJhdG9yLmNvbXBhcmVTdHJ1Y3R1cmVzKGxvY2FsUm9vdFBhdGgsIGVjMlJvb3RQYXRoKTtcbiAgICAgIGNvbnNvbGUubG9nKGDwn5OKIOS6i+WJjeavlOi8g+WujOS6hjog5LiA6Ie0546HJHtjb21wYXJpc29uLm1hdGNoUGVyY2VudGFnZS50b0ZpeGVkKDEpfSUsIOW3ruWIhiR7Y29tcGFyaXNvbi5kaWZmZXJlbmNlcy5sZW5ndGh95YCLYCk7XG5cbiAgICAgIC8vIOODkOODg+OCr+OCouODg+ODl+S9nOaIkO+8iOOCquODl+OCt+ODp+ODs++8iVxuICAgICAgaWYgKG9wdGlvbnMuY3JlYXRlQmFja3VwICYmICFvcHRpb25zLmRyeVJ1bikge1xuICAgICAgICBhd2FpdCB0aGlzLmNyZWF0ZVN5bmNCYWNrdXAobG9jYWxSb290UGF0aCwgZWMyUm9vdFBhdGgpO1xuICAgICAgfVxuXG4gICAgICAvLyDlkIzmnJ/lrp/ooYxcbiAgICAgIGNvbnN0IHN5bmNSZXN1bHQgPSBhd2FpdCB0aGlzLnBlcmZvcm1TeW5jKGNvbXBhcmlzb24sIG9wdGlvbnMsIHN5bmNJZCwgc3RhcnRUaW1lKTtcblxuICAgICAgLy8g5LqL5b6M5qSc6Ki8XG4gICAgICBpZiAoIW9wdGlvbnMuZHJ5UnVuICYmIHN5bmNSZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICBhd2FpdCB0aGlzLnZlcmlmeVN5bmNSZXN1bHQobG9jYWxSb290UGF0aCwgZWMyUm9vdFBhdGgsIHN5bmNSZXN1bHQpO1xuICAgICAgfVxuXG4gICAgICBjb25zb2xlLmxvZyhgJHtzeW5jUmVzdWx0LnN1Y2Nlc3MgPyAn4pyFJyA6ICfimqDvuI8nfSDnkrDlooPplpPlkIzmnJ/lrozkuoY6ICR7c3luY1Jlc3VsdC5zdGF0aXN0aWNzLnN5bmNlZEZpbGVzfeODleOCoeOCpOODq+WQjOacnyAoJHtzeW5jUmVzdWx0LnByb2Nlc3NpbmdUaW1lfW1zKWApO1xuXG4gICAgICByZXR1cm4gc3luY1Jlc3VsdDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuU1lOQ19GQUlMRUQsXG4gICAgICAgIGDnkrDlooPplpPlkIzmnJ/jgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3J9YCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDlkIzmnJ/jgpLlrp/ooYxcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgcGVyZm9ybVN5bmMoXG4gICAgY29tcGFyaXNvbjogU3RydWN0dXJlQ29tcGFyaXNvbixcbiAgICBvcHRpb25zOiBTeW5jT3B0aW9ucyxcbiAgICBzeW5jSWQ6IHN0cmluZyxcbiAgICBzdGFydFRpbWU6IG51bWJlclxuICApOiBQcm9taXNlPFN5bmNSZXN1bHQ+IHtcbiAgICBjb25zdCBzeW5jZWRJdGVtczogU3luY2VkSXRlbVtdID0gW107XG4gICAgY29uc3QgZmFpbGVkSXRlbXM6IEZhaWxlZEl0ZW1bXSA9IFtdO1xuICAgIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcblxuICAgIC8vIOWQjOacn+WvvuixoeOBruW3ruWIhuOCkuODleOCo+ODq+OCv+ODquODs+OCsFxuICAgIGNvbnN0IHRhcmdldERpZmZlcmVuY2VzID0gdGhpcy5maWx0ZXJTeW5jVGFyZ2V0cyhjb21wYXJpc29uLmRpZmZlcmVuY2VzLCBvcHRpb25zKTtcblxuICAgIGNvbnNvbGUubG9nKGDwn46vIOWQjOacn+WvvuixoTogJHt0YXJnZXREaWZmZXJlbmNlcy5sZW5ndGh95YCL44Gu5beu5YiGYCk7XG5cbiAgICAvLyDlt67liIbjgpLlh6bnkIZcbiAgICBmb3IgKGNvbnN0IGRpZmZlcmVuY2Ugb2YgdGFyZ2V0RGlmZmVyZW5jZXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucHJvY2Vzc1N5bmNEaWZmZXJlbmNlKGRpZmZlcmVuY2UsIG9wdGlvbnMpO1xuICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgc3luY2VkSXRlbXMucHVzaChyZXN1bHQpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zdCBlcnJvck1zZyA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKTtcbiAgICAgICAgZmFpbGVkSXRlbXMucHVzaCh7XG4gICAgICAgICAgcGF0aDogZGlmZmVyZW5jZS5wYXRoLFxuICAgICAgICAgIGVycm9yOiBlcnJvck1zZyxcbiAgICAgICAgICBhdHRlbXB0czogMVxuICAgICAgICB9KTtcbiAgICAgICAgZXJyb3JzLnB1c2goYCR7ZGlmZmVyZW5jZS5wYXRofTogJHtlcnJvck1zZ31gKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyDntbHoqIjmg4XloLHjga7nlJ/miJBcbiAgICBjb25zdCBzdGF0aXN0aWNzID0gdGhpcy5nZW5lcmF0ZVN5bmNTdGF0aXN0aWNzKHN5bmNlZEl0ZW1zLCBmYWlsZWRJdGVtcyk7XG4gICAgY29uc3QgcHJvY2Vzc2luZ1RpbWUgPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHN5bmNJZCxcbiAgICAgIHN5bmNUaW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgc3VjY2VzczogZmFpbGVkSXRlbXMubGVuZ3RoID09PSAwLFxuICAgICAgZGlyZWN0aW9uOiBvcHRpb25zLmRpcmVjdGlvbixcbiAgICAgIHN0YXRpc3RpY3MsXG4gICAgICBzeW5jZWRJdGVtcyxcbiAgICAgIGZhaWxlZEl0ZW1zLFxuICAgICAgZXJyb3JzLFxuICAgICAgcHJvY2Vzc2luZ1RpbWVcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOWQjOacn+WvvuixoeOCkuODleOCo+ODq+OCv+ODquODs+OCsFxuICAgKi9cbiAgcHJpdmF0ZSBmaWx0ZXJTeW5jVGFyZ2V0cyhkaWZmZXJlbmNlczogU3RydWN0dXJlRGlmZmVyZW5jZVtdLCBvcHRpb25zOiBTeW5jT3B0aW9ucyk6IFN0cnVjdHVyZURpZmZlcmVuY2VbXSB7XG4gICAgcmV0dXJuIGRpZmZlcmVuY2VzLmZpbHRlcihkaWZmID0+IHtcbiAgICAgIC8vIOmZpOWkluODkeOCv+ODvOODs+OBruODgeOCp+ODg+OCr1xuICAgICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIG9wdGlvbnMuZXhjbHVkZVBhdHRlcm5zKSB7XG4gICAgICAgIGlmIChkaWZmLnBhdGguaW5jbHVkZXMocGF0dGVybikpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8g5ZCM5pyf5pa55ZCR44Gu44OB44Kn44OD44KvXG4gICAgICBpZiAob3B0aW9ucy5kaXJlY3Rpb24gPT09ICdsb2NhbF90b19lYzInICYmIGRpZmYuZW52aXJvbm1lbnQgPT09ICdsb2NhbCcpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKG9wdGlvbnMuZGlyZWN0aW9uID09PSAnZWMyX3RvX2xvY2FsJyAmJiBkaWZmLmVudmlyb25tZW50ID09PSAnZWMyJykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIC8vIOODleOCoeOCpOODq+OCv+OCpOODl+OBruODgeOCp+ODg+OCr1xuICAgICAgaWYgKG9wdGlvbnMuaW5jbHVkZUZpbGVUeXBlcyAmJiBvcHRpb25zLmluY2x1ZGVGaWxlVHlwZXMubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBleHQgPSBwYXRoLmV4dG5hbWUoZGlmZi5wYXRoKTtcbiAgICAgICAgaWYgKCFvcHRpb25zLmluY2x1ZGVGaWxlVHlwZXMuaW5jbHVkZXMoZXh0KSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlgIvliKXlt67liIbjgpLlh6bnkIZcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgcHJvY2Vzc1N5bmNEaWZmZXJlbmNlKFxuICAgIGRpZmZlcmVuY2U6IFN0cnVjdHVyZURpZmZlcmVuY2UsXG4gICAgb3B0aW9uczogU3luY09wdGlvbnNcbiAgKTogUHJvbWlzZTxTeW5jZWRJdGVtIHwgbnVsbD4ge1xuICAgIGNvbnN0IGl0ZW1TdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuXG4gICAgaWYgKG9wdGlvbnMuZHJ5UnVuKSB7XG4gICAgICBjb25zb2xlLmxvZyhg8J+UjSBb44OJ44Op44Kk44Op44OzXSAke2RpZmZlcmVuY2UudHlwZX06ICR7ZGlmZmVyZW5jZS5wYXRofWApO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZTogZGlmZmVyZW5jZS50eXBlLmluY2x1ZGVzKCdkaXJlY3RvcnknKSA/ICdkaXJlY3RvcnknIDogJ2ZpbGUnLFxuICAgICAgICBzb3VyY2VQYXRoOiBkaWZmZXJlbmNlLnBhdGgsXG4gICAgICAgIHRhcmdldFBhdGg6IGRpZmZlcmVuY2UucGF0aCxcbiAgICAgICAgYWN0aW9uOiAnY3JlYXRlZCcsIC8vIOS7ruOBruWApFxuICAgICAgICBwcm9jZXNzaW5nVGltZTogRGF0ZS5ub3coKSAtIGl0ZW1TdGFydFRpbWVcbiAgICAgIH07XG4gICAgfVxuXG4gICAgc3dpdGNoIChkaWZmZXJlbmNlLnR5cGUpIHtcbiAgICAgIGNhc2UgJ21pc3NpbmdfZGlyZWN0b3J5JzpcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuc3luY01pc3NpbmdEaXJlY3RvcnkoZGlmZmVyZW5jZSwgb3B0aW9ucywgaXRlbVN0YXJ0VGltZSk7XG4gICAgICBcbiAgICAgIGNhc2UgJ21pc3NpbmdfZmlsZSc6XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnN5bmNNaXNzaW5nRmlsZShkaWZmZXJlbmNlLCBvcHRpb25zLCBpdGVtU3RhcnRUaW1lKTtcbiAgICAgIFxuICAgICAgY2FzZSAncGVybWlzc2lvbl9taXNtYXRjaCc6XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnN5bmNQZXJtaXNzaW9ucyhkaWZmZXJlbmNlLCBvcHRpb25zLCBpdGVtU3RhcnRUaW1lKTtcbiAgICAgIFxuICAgICAgY2FzZSAnc2l6ZV9taXNtYXRjaCc6XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnN5bmNGaWxlQ29udGVudChkaWZmZXJlbmNlLCBvcHRpb25zLCBpdGVtU3RhcnRUaW1lKTtcbiAgICAgIFxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgY29uc29sZS53YXJuKGDimqDvuI8g5pyq5a++5b+c44Gu5beu5YiG44K/44Kk44OXOiAke2RpZmZlcmVuY2UudHlwZX1gKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOS4jei2s+ODh+OCo+ODrOOCr+ODiOODquOCkuWQjOacn1xuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBzeW5jTWlzc2luZ0RpcmVjdG9yeShcbiAgICBkaWZmZXJlbmNlOiBTdHJ1Y3R1cmVEaWZmZXJlbmNlLFxuICAgIG9wdGlvbnM6IFN5bmNPcHRpb25zLFxuICAgIHN0YXJ0VGltZTogbnVtYmVyXG4gICk6IFByb21pc2U8U3luY2VkSXRlbT4ge1xuICAgIGNvbnN0IHRhcmdldEVudiA9IGRpZmZlcmVuY2UuZW52aXJvbm1lbnQ7XG4gICAgXG4gICAgaWYgKHRhcmdldEVudiA9PT0gJ2VjMicpIHtcbiAgICAgIGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoYG1rZGlyIC1wIFwiJHtkaWZmZXJlbmNlLnBhdGh9XCJgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXdhaXQgZnMubWtkaXIoZGlmZmVyZW5jZS5wYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZyhg8J+TgSDjg4fjgqPjg6zjgq/jg4jjg6rkvZzmiJA6ICR7ZGlmZmVyZW5jZS5wYXRofSAoJHt0YXJnZXRFbnZ9KWApO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdkaXJlY3RvcnknLFxuICAgICAgc291cmNlUGF0aDogZGlmZmVyZW5jZS5wYXRoLFxuICAgICAgdGFyZ2V0UGF0aDogZGlmZmVyZW5jZS5wYXRoLFxuICAgICAgYWN0aW9uOiAnY3JlYXRlZCcsXG4gICAgICBwcm9jZXNzaW5nVGltZTogRGF0ZS5ub3coKSAtIHN0YXJ0VGltZVxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog5LiN6Laz44OV44Kh44Kk44Or44KS5ZCM5pyfXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHN5bmNNaXNzaW5nRmlsZShcbiAgICBkaWZmZXJlbmNlOiBTdHJ1Y3R1cmVEaWZmZXJlbmNlLFxuICAgIG9wdGlvbnM6IFN5bmNPcHRpb25zLFxuICAgIHN0YXJ0VGltZTogbnVtYmVyXG4gICk6IFByb21pc2U8U3luY2VkSXRlbT4ge1xuICAgIGNvbnN0IHRhcmdldEVudiA9IGRpZmZlcmVuY2UuZW52aXJvbm1lbnQ7XG4gICAgXG4gICAgaWYgKHRhcmdldEVudiA9PT0gJ2VjMicpIHtcbiAgICAgIC8vIOODreODvOOCq+ODq+OBi+OCiUVDMuOBuFxuICAgICAgYXdhaXQgdGhpcy5jb3B5RmlsZVRvRUMyKGRpZmZlcmVuY2UucGF0aCwgZGlmZmVyZW5jZS5wYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRUMy44GL44KJ44Ot44O844Kr44Or44G4XG4gICAgICBhd2FpdCB0aGlzLmNvcHlGaWxlRnJvbUVDMihkaWZmZXJlbmNlLnBhdGgsIGRpZmZlcmVuY2UucGF0aCk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coYPCfk4Qg44OV44Kh44Kk44Or5ZCM5pyfOiAke2RpZmZlcmVuY2UucGF0aH0g4oaSICR7dGFyZ2V0RW52fWApO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdmaWxlJyxcbiAgICAgIHNvdXJjZVBhdGg6IGRpZmZlcmVuY2UucGF0aCxcbiAgICAgIHRhcmdldFBhdGg6IGRpZmZlcmVuY2UucGF0aCxcbiAgICAgIGFjdGlvbjogJ2NyZWF0ZWQnLFxuICAgICAgcHJvY2Vzc2luZ1RpbWU6IERhdGUubm93KCkgLSBzdGFydFRpbWVcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOaoqemZkOOCkuWQjOacn1xuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBzeW5jUGVybWlzc2lvbnMoXG4gICAgZGlmZmVyZW5jZTogU3RydWN0dXJlRGlmZmVyZW5jZSxcbiAgICBvcHRpb25zOiBTeW5jT3B0aW9ucyxcbiAgICBzdGFydFRpbWU6IG51bWJlclxuICApOiBQcm9taXNlPFN5bmNlZEl0ZW0gfCBudWxsPiB7XG4gICAgaWYgKCFvcHRpb25zLnN5bmNQZXJtaXNzaW9ucykge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgdGFyZ2V0RW52ID0gZGlmZmVyZW5jZS5lbnZpcm9ubWVudDtcbiAgICBjb25zdCBleHBlY3RlZFBlcm1pc3Npb25zID0gZGlmZmVyZW5jZS5kZXRhaWxzLmV4cGVjdGVkO1xuXG4gICAgaWYgKHRhcmdldEVudiA9PT0gJ2VjMicpIHtcbiAgICAgIGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoYGNobW9kICR7ZXhwZWN0ZWRQZXJtaXNzaW9uc30gXCIke2RpZmZlcmVuY2UucGF0aH1cImApO1xuICAgIH0gZWxzZSB7XG4gICAgICBhd2FpdCBmcy5jaG1vZChkaWZmZXJlbmNlLnBhdGgsIHBhcnNlSW50KGV4cGVjdGVkUGVybWlzc2lvbnMsIDgpKTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZyhg8J+UkiDmqKnpmZDlkIzmnJ86ICR7ZGlmZmVyZW5jZS5wYXRofSDihpIgJHtleHBlY3RlZFBlcm1pc3Npb25zfSAoJHt0YXJnZXRFbnZ9KWApO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdmaWxlJyxcbiAgICAgIHNvdXJjZVBhdGg6IGRpZmZlcmVuY2UucGF0aCxcbiAgICAgIHRhcmdldFBhdGg6IGRpZmZlcmVuY2UucGF0aCxcbiAgICAgIGFjdGlvbjogJ3Blcm1pc3Npb25fdXBkYXRlZCcsXG4gICAgICBwcm9jZXNzaW5nVGltZTogRGF0ZS5ub3coKSAtIHN0YXJ0VGltZVxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog44OV44Kh44Kk44Or5YaF5a6544KS5ZCM5pyfXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHN5bmNGaWxlQ29udGVudChcbiAgICBkaWZmZXJlbmNlOiBTdHJ1Y3R1cmVEaWZmZXJlbmNlLFxuICAgIG9wdGlvbnM6IFN5bmNPcHRpb25zLFxuICAgIHN0YXJ0VGltZTogbnVtYmVyXG4gICk6IFByb21pc2U8U3luY2VkSXRlbT4ge1xuICAgIGNvbnN0IHRhcmdldEVudiA9IGRpZmZlcmVuY2UuZW52aXJvbm1lbnQ7XG4gICAgXG4gICAgaWYgKCFvcHRpb25zLm92ZXJ3cml0ZUV4aXN0aW5nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYOODleOCoeOCpOODq+S4iuabuOOBjeOBjOeEoeWKueOBp+OBmTogJHtkaWZmZXJlbmNlLnBhdGh9YCk7XG4gICAgfVxuXG4gICAgaWYgKHRhcmdldEVudiA9PT0gJ2VjMicpIHtcbiAgICAgIGF3YWl0IHRoaXMuY29weUZpbGVUb0VDMihkaWZmZXJlbmNlLnBhdGgsIGRpZmZlcmVuY2UucGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGF3YWl0IHRoaXMuY29weUZpbGVGcm9tRUMyKGRpZmZlcmVuY2UucGF0aCwgZGlmZmVyZW5jZS5wYXRoKTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZyhg8J+UhCDjg5XjgqHjgqTjg6vmm7TmlrA6ICR7ZGlmZmVyZW5jZS5wYXRofSAoJHt0YXJnZXRFbnZ9KWApO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdmaWxlJyxcbiAgICAgIHNvdXJjZVBhdGg6IGRpZmZlcmVuY2UucGF0aCxcbiAgICAgIHRhcmdldFBhdGg6IGRpZmZlcmVuY2UucGF0aCxcbiAgICAgIGFjdGlvbjogJ3VwZGF0ZWQnLFxuICAgICAgc2l6ZTogZGlmZmVyZW5jZS5kZXRhaWxzLmV4cGVjdGVkIHx8IDAsXG4gICAgICBwcm9jZXNzaW5nVGltZTogRGF0ZS5ub3coKSAtIHN0YXJ0VGltZVxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog44Ot44O844Kr44Or44OV44Kh44Kk44Or44KSRUMy44Gr44Kz44OU44O8XG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGNvcHlGaWxlVG9FQzIobG9jYWxQYXRoOiBzdHJpbmcsIGVjMlBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghdGhpcy5zc2hDb25maWcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignU1NI6Kit5a6a44GM5b+F6KaB44Gn44GZJyk7XG4gICAgfVxuXG4gICAgY29uc3Qgc2NwQ29tbWFuZCA9IGBzY3AgLWkgXCIke3RoaXMuc3NoQ29uZmlnLmtleVBhdGh9XCIgLW8gQ29ubmVjdFRpbWVvdXQ9JHt0aGlzLnNzaENvbmZpZy50aW1lb3V0ISAvIDEwMDB9IC1vIFN0cmljdEhvc3RLZXlDaGVja2luZz1ubyAtUCAke3RoaXMuc3NoQ29uZmlnLnBvcnR9IFwiJHtsb2NhbFBhdGh9XCIgJHt0aGlzLnNzaENvbmZpZy51c2VyfUAke3RoaXMuc3NoQ29uZmlnLmhvc3R9OlwiJHtlYzJQYXRofVwiYDtcbiAgICBcbiAgICBhd2FpdCBleGVjQXN5bmMoc2NwQ29tbWFuZCwgeyB0aW1lb3V0OiB0aGlzLnNzaENvbmZpZy50aW1lb3V0IH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEVDMuODleOCoeOCpOODq+OCkuODreODvOOCq+ODq+OBq+OCs+ODlOODvFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBjb3B5RmlsZUZyb21FQzIoZWMyUGF0aDogc3RyaW5nLCBsb2NhbFBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghdGhpcy5zc2hDb25maWcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignU1NI6Kit5a6a44GM5b+F6KaB44Gn44GZJyk7XG4gICAgfVxuXG4gICAgLy8g44Ot44O844Kr44Or44OH44Kj44Os44Kv44OI44Oq44KS5L2c5oiQXG4gICAgY29uc3QgbG9jYWxEaXIgPSBwYXRoLmRpcm5hbWUobG9jYWxQYXRoKTtcbiAgICBhd2FpdCBmcy5ta2Rpcihsb2NhbERpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cbiAgICBjb25zdCBzY3BDb21tYW5kID0gYHNjcCAtaSBcIiR7dGhpcy5zc2hDb25maWcua2V5UGF0aH1cIiAtbyBDb25uZWN0VGltZW91dD0ke3RoaXMuc3NoQ29uZmlnLnRpbWVvdXQhIC8gMTAwMH0gLW8gU3RyaWN0SG9zdEtleUNoZWNraW5nPW5vIC1QICR7dGhpcy5zc2hDb25maWcucG9ydH0gJHt0aGlzLnNzaENvbmZpZy51c2VyfUAke3RoaXMuc3NoQ29uZmlnLmhvc3R9OlwiJHtlYzJQYXRofVwiIFwiJHtsb2NhbFBhdGh9XCJgO1xuICAgIFxuICAgIGF3YWl0IGV4ZWNBc3luYyhzY3BDb21tYW5kLCB7IHRpbWVvdXQ6IHRoaXMuc3NoQ29uZmlnLnRpbWVvdXQgfSk7XG4gIH1cblxuICAvKipcbiAgICog5ZCM5pyf57Wx6KiI44KS55Sf5oiQXG4gICAqL1xuICBwcml2YXRlIGdlbmVyYXRlU3luY1N0YXRpc3RpY3Moc3luY2VkSXRlbXM6IFN5bmNlZEl0ZW1bXSwgZmFpbGVkSXRlbXM6IEZhaWxlZEl0ZW1bXSk6IFN5bmNTdGF0aXN0aWNzIHtcbiAgICBjb25zdCBkaXJlY3RvcmllcyA9IHN5bmNlZEl0ZW1zLmZpbHRlcihpdGVtID0+IGl0ZW0udHlwZSA9PT0gJ2RpcmVjdG9yeScpO1xuICAgIGNvbnN0IGZpbGVzID0gc3luY2VkSXRlbXMuZmlsdGVyKGl0ZW0gPT4gaXRlbS50eXBlID09PSAnZmlsZScpO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBwcm9jZXNzZWREaXJlY3RvcmllczogZGlyZWN0b3JpZXMubGVuZ3RoLFxuICAgICAgcHJvY2Vzc2VkRmlsZXM6IGZpbGVzLmxlbmd0aCxcbiAgICAgIGNyZWF0ZWREaXJlY3RvcmllczogZGlyZWN0b3JpZXMuZmlsdGVyKGl0ZW0gPT4gaXRlbS5hY3Rpb24gPT09ICdjcmVhdGVkJykubGVuZ3RoLFxuICAgICAgc3luY2VkRmlsZXM6IGZpbGVzLmZpbHRlcihpdGVtID0+IGl0ZW0uYWN0aW9uID09PSAnY3JlYXRlZCcgfHwgaXRlbS5hY3Rpb24gPT09ICd1cGRhdGVkJykubGVuZ3RoLFxuICAgICAgZGVsZXRlZEl0ZW1zOiBzeW5jZWRJdGVtcy5maWx0ZXIoaXRlbSA9PiBpdGVtLmFjdGlvbiA9PT0gJ2RlbGV0ZWQnKS5sZW5ndGgsXG4gICAgICBwZXJtaXNzaW9uVXBkYXRlczogc3luY2VkSXRlbXMuZmlsdGVyKGl0ZW0gPT4gaXRlbS5hY3Rpb24gPT09ICdwZXJtaXNzaW9uX3VwZGF0ZWQnKS5sZW5ndGgsXG4gICAgICB0b3RhbERhdGFTaXplOiBmaWxlcy5yZWR1Y2UoKHN1bSwgaXRlbSkgPT4gc3VtICsgKGl0ZW0uc2l6ZSB8fCAwKSwgMCksXG4gICAgICBza2lwcGVkSXRlbXM6IGZhaWxlZEl0ZW1zLmxlbmd0aFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog5ZCM5pyf44OQ44OD44Kv44Ki44OD44OX44KS5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGNyZWF0ZVN5bmNCYWNrdXAobG9jYWxSb290UGF0aDogc3RyaW5nLCBlYzJSb290UGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc29sZS5sb2coJ/Cfkr4g5ZCM5pyf5YmN44OQ44OD44Kv44Ki44OD44OX44KS5L2c5oiQ5LitLi4uJyk7XG4gICAgXG4gICAgY29uc3QgYmFja3VwVGltZXN0YW1wID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnJlcGxhY2UoL1s6Ll0vZywgJy0nKTtcbiAgICBcbiAgICAvLyDjg63jg7zjgqvjg6vjg5Djg4Pjgq/jgqLjg4Pjg5dcbiAgICBjb25zdCBsb2NhbEJhY2t1cFBhdGggPSBgYmFja3VwLWxvY2FsLSR7YmFja3VwVGltZXN0YW1wfWA7XG4gICAgYXdhaXQgZXhlY0FzeW5jKGBjcCAtciBcIiR7bG9jYWxSb290UGF0aH1cIiBcIiR7bG9jYWxCYWNrdXBQYXRofVwiYCk7XG4gICAgXG4gICAgLy8gRUMy44OQ44OD44Kv44Ki44OD44OXXG4gICAgY29uc3QgZWMyQmFja3VwUGF0aCA9IGAvdG1wL2JhY2t1cC1lYzItJHtiYWNrdXBUaW1lc3RhbXB9YDtcbiAgICBhd2FpdCB0aGlzLmV4ZWN1dGVTU0hDb21tYW5kKGBjcCAtciBcIiR7ZWMyUm9vdFBhdGh9XCIgXCIke2VjMkJhY2t1cFBhdGh9XCJgKTtcbiAgICBcbiAgICBjb25zb2xlLmxvZygn4pyFIOWQjOacn+WJjeODkOODg+OCr+OCouODg+ODl+S9nOaIkOWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIOWQjOacn+e1kOaenOOCkuaknOiovFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyB2ZXJpZnlTeW5jUmVzdWx0KFxuICAgIGxvY2FsUm9vdFBhdGg6IHN0cmluZyxcbiAgICBlYzJSb290UGF0aDogc3RyaW5nLFxuICAgIHN5bmNSZXN1bHQ6IFN5bmNSZXN1bHRcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc29sZS5sb2coJ/CflI0g5ZCM5pyf57WQ5p6c44KS5qSc6Ki85LitLi4uJyk7XG4gICAgXG4gICAgY29uc3QgcG9zdENvbXBhcmlzb24gPSBhd2FpdCB0aGlzLnN0cnVjdHVyZUNvbXBhcmF0b3IuY29tcGFyZVN0cnVjdHVyZXMobG9jYWxSb290UGF0aCwgZWMyUm9vdFBhdGgpO1xuICAgIFxuICAgIGlmIChwb3N0Q29tcGFyaXNvbi5tYXRjaFBlcmNlbnRhZ2UgPiA5NSkge1xuICAgICAgY29uc29sZS5sb2coYOKchSDlkIzmnJ/mpJzoqLzmiJDlip86IOS4gOiHtOeOhyR7cG9zdENvbXBhcmlzb24ubWF0Y2hQZXJjZW50YWdlLnRvRml4ZWQoMSl9JWApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLndhcm4oYOKaoO+4jyDlkIzmnJ/mpJzoqLzjgafllY/poYzjgpLmpJzlh7o6IOS4gOiHtOeOhyR7cG9zdENvbXBhcmlzb24ubWF0Y2hQZXJjZW50YWdlLnRvRml4ZWQoMSl9JWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDmlbTlkIjmgKfmpJzoqLzjgpLlrp/ooYxcbiAgICovXG4gIHB1YmxpYyBhc3luYyB2ZXJpZnlDb25zaXN0ZW5jeShcbiAgICBsb2NhbFJvb3RQYXRoOiBzdHJpbmcgPSAnLicsXG4gICAgZWMyUm9vdFBhdGg6IHN0cmluZyA9ICcvaG9tZS91YnVudHUnXG4gICk6IFByb21pc2U8Q29uc2lzdGVuY3lWZXJpZmljYXRpb24+IHtcbiAgICBjb25zdCB2ZXJpZmljYXRpb25JZCA9IGB2ZXJpZmljYXRpb24tJHtEYXRlLm5vdygpfWA7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICBcbiAgICBjb25zb2xlLmxvZygn8J+UjSDnkrDlooPplpPmlbTlkIjmgKfmpJzoqLzjgpLplovlp4suLi4nKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb21wYXJpc29uID0gYXdhaXQgdGhpcy5zdHJ1Y3R1cmVDb21wYXJhdG9yLmNvbXBhcmVTdHJ1Y3R1cmVzKGxvY2FsUm9vdFBhdGgsIGVjMlJvb3RQYXRoKTtcbiAgICAgIFxuICAgICAgY29uc3QgaW5jb25zaXN0ZW5jaWVzOiBJbmNvbnNpc3RlbmN5SXRlbVtdID0gY29tcGFyaXNvbi5kaWZmZXJlbmNlcy5tYXAoZGlmZiA9PiAoe1xuICAgICAgICBwYXRoOiBkaWZmLnBhdGgsXG4gICAgICAgIHR5cGU6IHRoaXMubWFwRGlmZmVyZW5jZVRvSW5jb25zaXN0ZW5jeShkaWZmLnR5cGUpLFxuICAgICAgICBkZXRhaWxzOiBkaWZmLmRldGFpbHMuZGVzY3JpcHRpb24sXG4gICAgICAgIHNldmVyaXR5OiBkaWZmLnNldmVyaXR5XG4gICAgICB9KSk7XG5cbiAgICAgIGNvbnN0IHZlcmlmaWNhdGlvblRpbWUgPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgY29uc3QgaXNDb25zaXN0ZW50ID0gaW5jb25zaXN0ZW5jaWVzLmxlbmd0aCA9PT0gMDtcblxuICAgICAgY29uc29sZS5sb2coYCR7aXNDb25zaXN0ZW50ID8gJ+KchScgOiAn4pqg77iPJ30g5pW05ZCI5oCn5qSc6Ki85a6M5LqGOiAke2luY29uc2lzdGVuY2llcy5sZW5ndGh95YCL44Gu5LiN5pW05ZCIICgke3ZlcmlmaWNhdGlvblRpbWV9bXMpYCk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHZlcmlmaWNhdGlvbklkLFxuICAgICAgICB2ZXJpZmljYXRpb25UaW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICBpc0NvbnNpc3RlbnQsXG4gICAgICAgIGluY29uc2lzdGVuY2llcyxcbiAgICAgICAgc3RhdGlzdGljczoge1xuICAgICAgICAgIHRvdGFsSXRlbXM6IGNvbXBhcmlzb24uc3VtbWFyeS50b3RhbEl0ZW1zLFxuICAgICAgICAgIGNvbnNpc3RlbnRJdGVtczogY29tcGFyaXNvbi5zdW1tYXJ5Lm1hdGNoaW5nSXRlbXMsXG4gICAgICAgICAgaW5jb25zaXN0ZW50SXRlbXM6IGluY29uc2lzdGVuY2llcy5sZW5ndGgsXG4gICAgICAgICAgdmVyaWZpY2F0aW9uVGltZVxuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5WQUxJREFUSU9OX0ZBSUxFRCxcbiAgICAgICAgYOaVtOWQiOaAp+aknOiovOOBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtlcnJvcn1gLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgZXJyb3IgYXMgRXJyb3JcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOW3ruWIhuOCv+OCpOODl+OCkuS4jeaVtOWQiOOCv+OCpOODl+OBq+ODnuODg+ODl1xuICAgKi9cbiAgcHJpdmF0ZSBtYXBEaWZmZXJlbmNlVG9JbmNvbnNpc3RlbmN5KGRpZmZUeXBlOiBzdHJpbmcpOiAnbWlzc2luZycgfCAnc2l6ZV9taXNtYXRjaCcgfCAncGVybWlzc2lvbl9taXNtYXRjaCcgfCAnY29udGVudF9taXNtYXRjaCcge1xuICAgIHN3aXRjaCAoZGlmZlR5cGUpIHtcbiAgICAgIGNhc2UgJ21pc3NpbmdfZGlyZWN0b3J5JzpcbiAgICAgIGNhc2UgJ21pc3NpbmdfZmlsZSc6XG4gICAgICBjYXNlICdleHRyYV9kaXJlY3RvcnknOlxuICAgICAgY2FzZSAnZXh0cmFfZmlsZSc6XG4gICAgICAgIHJldHVybiAnbWlzc2luZyc7XG4gICAgICBjYXNlICdzaXplX21pc21hdGNoJzpcbiAgICAgICAgcmV0dXJuICdzaXplX21pc21hdGNoJztcbiAgICAgIGNhc2UgJ3Blcm1pc3Npb25fbWlzbWF0Y2gnOlxuICAgICAgICByZXR1cm4gJ3Blcm1pc3Npb25fbWlzbWF0Y2gnO1xuICAgICAgY2FzZSAnY29udGVudF9taXNtYXRjaCc6XG4gICAgICAgIHJldHVybiAnY29udGVudF9taXNtYXRjaCc7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gJ21pc3NpbmcnO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDlkIzmnJ/jg6zjg53jg7zjg4jjgpLnlJ/miJBcbiAgICovXG4gIHB1YmxpYyBnZW5lcmF0ZVN5bmNSZXBvcnQoc3luY1Jlc3VsdDogU3luY1Jlc3VsdCk6IHN0cmluZyB7XG4gICAgY29uc3QgeyBzdGF0aXN0aWNzLCBzeW5jZWRJdGVtcywgZmFpbGVkSXRlbXMgfSA9IHN5bmNSZXN1bHQ7XG4gICAgY29uc3Qgc3VjY2Vzc1JhdGUgPSBNYXRoLnJvdW5kKCgoc3RhdGlzdGljcy5zeW5jZWRGaWxlcyArIHN0YXRpc3RpY3MuY3JlYXRlZERpcmVjdG9yaWVzKSAvIFxuICAgICAgKHN0YXRpc3RpY3MucHJvY2Vzc2VkRmlsZXMgKyBzdGF0aXN0aWNzLnByb2Nlc3NlZERpcmVjdG9yaWVzKSkgKiAxMDApO1xuXG4gICAgcmV0dXJuIGBcbiMg55Kw5aKD6ZaT5ZCM5pyf44Os44Od44O844OIXG5cbiMjIOWQjOacn+OCteODnuODquODvFxuLSAqKuWQjOacn+aXpeaZgioqOiAke3N5bmNSZXN1bHQuc3luY1RpbWUudG9Mb2NhbGVTdHJpbmcoJ2phLUpQJyl9XG4tICoq5ZCM5pyfSUQqKjogJHtzeW5jUmVzdWx0LnN5bmNJZH1cbi0gKirlkIzmnJ/mlrnlkJEqKjogJHtzeW5jUmVzdWx0LmRpcmVjdGlvbn1cbi0gKirmiJDlip8qKjogJHtzeW5jUmVzdWx0LnN1Y2Nlc3MgPyAn44Gv44GEJyA6ICfjgYTjgYTjgYgnfVxuLSAqKuWHpueQhuaZgumWkyoqOiAke01hdGgucm91bmQoc3luY1Jlc3VsdC5wcm9jZXNzaW5nVGltZSAvIDEwMDApfeenklxuXG4jIyDlkIzmnJ/ntbHoqIhcbi0gKirlh6bnkIbjg4fjgqPjg6zjgq/jg4jjg6rmlbAqKjogJHtzdGF0aXN0aWNzLnByb2Nlc3NlZERpcmVjdG9yaWVzfeWAi1xuLSAqKuWHpueQhuODleOCoeOCpOODq+aVsCoqOiAke3N0YXRpc3RpY3MucHJvY2Vzc2VkRmlsZXN95YCLXG4tICoq5L2c5oiQ44OH44Kj44Os44Kv44OI44Oq5pWwKio6ICR7c3RhdGlzdGljcy5jcmVhdGVkRGlyZWN0b3JpZXN95YCLXG4tICoq5ZCM5pyf44OV44Kh44Kk44Or5pWwKio6ICR7c3RhdGlzdGljcy5zeW5jZWRGaWxlc33lgItcbi0gKirmqKnpmZDmm7TmlrDmlbAqKjogJHtzdGF0aXN0aWNzLnBlcm1pc3Npb25VcGRhdGVzfeWAi1xuLSAqKue3j+ODh+ODvOOCv+OCteOCpOOCuioqOiAke01hdGgucm91bmQoc3RhdGlzdGljcy50b3RhbERhdGFTaXplIC8gMTAyNCAvIDEwMjQpfU1CXG4tICoq5oiQ5Yqf546HKio6ICR7c3VjY2Vzc1JhdGV9JVxuXG4jIyDlkIzmnJ/jgZXjgozjgZ/jgqLjgqTjg4bjg6DvvIjkuIrkvY0xMOS7tu+8iVxuJHtzeW5jZWRJdGVtcy5zbGljZSgwLCAxMCkubWFwKGl0ZW0gPT4gXG4gIGAtICoqJHtpdGVtLnR5cGV9Kio6ICR7aXRlbS5zb3VyY2VQYXRofSAoJHtpdGVtLmFjdGlvbn0pYFxuKS5qb2luKCdcXG4nKSB8fCAnLSDlkIzmnJ/jgqLjgqTjg4bjg6DjgarjgZcnfVxuJHtzeW5jZWRJdGVtcy5sZW5ndGggPiAxMCA/IGBcXG4uLi4g5LuWJHtzeW5jZWRJdGVtcy5sZW5ndGggLSAxMH3lgItgIDogJyd9XG5cbiMjIOWkseaVl+OBl+OBn+OCouOCpOODhuODoFxuJHtmYWlsZWRJdGVtcy5tYXAoaXRlbSA9PiBcbiAgYC0gKioke2l0ZW0ucGF0aH0qKjogJHtpdGVtLmVycm9yfWBcbikuam9pbignXFxuJykgfHwgJy0g5aSx5pWX44Gq44GXJ31cblxuIyMg44OR44OV44Kp44O844Oe44Oz44K5XG4tICoq5bmz5Z2H5Yem55CG5pmC6ZaTKio6ICR7TWF0aC5yb3VuZChzeW5jUmVzdWx0LnByb2Nlc3NpbmdUaW1lIC8gKHN0YXRpc3RpY3MucHJvY2Vzc2VkRmlsZXMgKyBzdGF0aXN0aWNzLnByb2Nlc3NlZERpcmVjdG9yaWVzKSl9bXMv44Ki44Kk44OG44OgXG4tICoq44K544Or44O844OX44OD44OIKio6ICR7TWF0aC5yb3VuZCgoc3RhdGlzdGljcy5wcm9jZXNzZWRGaWxlcyArIHN0YXRpc3RpY3MucHJvY2Vzc2VkRGlyZWN0b3JpZXMpIC8gKHN5bmNSZXN1bHQucHJvY2Vzc2luZ1RpbWUgLyAxMDAwKSl944Ki44Kk44OG44OgL+enklxuLSAqKuODh+ODvOOCv+i7oumAgemAn+W6pioqOiAke01hdGgucm91bmQoc3RhdGlzdGljcy50b3RhbERhdGFTaXplIC8gMTAyNCAvIChzeW5jUmVzdWx0LnByb2Nlc3NpbmdUaW1lIC8gMTAwMCkpfUtCL+enklxuXG4jIyDjgqjjg6njg7zoqbPntLBcbiR7c3luY1Jlc3VsdC5lcnJvcnMubGVuZ3RoID4gMCA/IFxuICBzeW5jUmVzdWx0LmVycm9ycy5tYXAoZXJyb3IgPT4gYC0gJHtlcnJvcn1gKS5qb2luKCdcXG4nKSA6IFxuICAnLSDjgqjjg6njg7zjgarjgZcnXG59XG5gO1xuICB9XG5cbiAgLyoqXG4gICAqIFNTSCDjgrPjg57jg7Pjg4njgpLlrp/ooYxcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZXhlY3V0ZVNTSENvbW1hbmQoY29tbWFuZDogc3RyaW5nKTogUHJvbWlzZTx7IHN0ZG91dDogc3RyaW5nOyBzdGRlcnI6IHN0cmluZyB9PiB7XG4gICAgaWYgKCF0aGlzLnNzaENvbmZpZykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdTU0joqK3lrprjgYzlv4XopoHjgafjgZknKTtcbiAgICB9XG5cbiAgICBjb25zdCBzc2hDb21tYW5kID0gYHNzaCAtaSBcIiR7dGhpcy5zc2hDb25maWcua2V5UGF0aH1cIiAtbyBDb25uZWN0VGltZW91dD0ke3RoaXMuc3NoQ29uZmlnLnRpbWVvdXQhIC8gMTAwMH0gLW8gU3RyaWN0SG9zdEtleUNoZWNraW5nPW5vIC1wICR7dGhpcy5zc2hDb25maWcucG9ydH0gJHt0aGlzLnNzaENvbmZpZy51c2VyfUAke3RoaXMuc3NoQ29uZmlnLmhvc3R9IFwiJHtjb21tYW5kfVwiYDtcbiAgICBcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZXhlY0FzeW5jKHNzaENvbW1hbmQsIHsgXG4gICAgICAgIHRpbWVvdXQ6IHRoaXMuc3NoQ29uZmlnLnRpbWVvdXQsXG4gICAgICAgIG1heEJ1ZmZlcjogMTAyNCAqIDEwMjQgKiAxMCAvLyAxME1CXG4gICAgICB9KTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgaWYgKGVycm9yLmNvZGUgPT09ICdFVElNRURPVVQnKSB7XG4gICAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuU1NIX0NPTk5FQ1RJT05fRkFJTEVELFxuICAgICAgICAgIGBTU0jmjqXntprjgYzjgr/jgqTjg6DjgqLjgqbjg4jjgZfjgb7jgZfjgZ86ICR7dGhpcy5zc2hDb25maWcuaG9zdH1gLFxuICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICAnZWMyJyxcbiAgICAgICAgICBlcnJvclxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG59Il19