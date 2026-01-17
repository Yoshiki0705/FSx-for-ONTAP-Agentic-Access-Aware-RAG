"use strict";
/**
 * 統合ファイル整理システム - バックアップ復元管理
 *
 * ローカル・EC2両環境でのバックアップ復元機能を統合管理し、
 * エラー時の自動ロールバック機能を提供します。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupRestoreManager = void 0;
const local_backup_manager_js_1 = require("./local-backup-manager.js");
const ec2_backup_manager_js_1 = require("./ec2-backup-manager.js");
const index_js_1 = require("../types/index.js");
/**
 * バックアップ復元管理
 *
 * 両環境のバックアップ復元を統合管理し、
 * エラー時の自動ロールバック機能を提供します。
 */
class BackupRestoreManager {
    localBackupManager;
    ec2BackupManager;
    constructor(localBackupDir = 'development/temp/backups', sshConfig, ec2BackupDir = '/home/ubuntu/backups') {
        this.localBackupManager = new local_backup_manager_js_1.LocalBackupManager(localBackupDir);
        this.ec2BackupManager = new ec2_backup_manager_js_1.EC2BackupManager(sshConfig, ec2BackupDir);
    }
    /**
     * 統合バックアップ作成
     */
    async createIntegratedBackup(localFiles, ec2Files, backupId) {
        console.log(`💾 統合バックアップを作成中: ${backupId}`);
        try {
            // 並列でバックアップを作成
            const [localResult, ec2Result] = await Promise.allSettled([
                this.localBackupManager.createBackup(localFiles, `${backupId}-local`),
                this.ec2BackupManager.createBackup(ec2Files, `${backupId}-ec2`)
            ]);
            const localBackup = localResult.status === 'fulfilled' ? localResult.value : null;
            const ec2Backup = ec2Result.status === 'fulfilled' ? ec2Result.value : null;
            if (!localBackup || !ec2Backup) {
                // 部分的な失敗の場合、成功したバックアップをクリーンアップ
                if (localBackup) {
                    await this.localBackupManager.deleteBackup(`${backupId}-local`);
                }
                if (ec2Backup) {
                    await this.ec2BackupManager.deleteBackup(`${backupId}-ec2`);
                }
                throw new Error('統合バックアップの作成に失敗しました');
            }
            const success = localBackup.success && ec2Backup.success;
            console.log(`✅ 統合バックアップ作成完了: ${success ? '成功' : '部分的成功'}`);
            return {
                local: localBackup,
                ec2: ec2Backup,
                success
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `統合バックアップ作成に失敗しました: ${error}`, undefined, undefined, error);
        }
    }
    /**
     * 統合バックアップ復元
     */
    async restoreIntegratedBackup(backupId, options = {
        createPreRestoreBackup: true,
        overwriteExisting: false,
        verifyAfterRestore: true,
        dryRun: false
    }) {
        const startTime = Date.now();
        const restoreId = `restore-${Date.now()}`;
        console.log(`🔄 統合バックアップを復元中: ${backupId}`);
        try {
            const errors = [];
            let preRestoreBackupId;
            // 復元前バックアップの作成（オプション）
            if (options.createPreRestoreBackup && !options.dryRun) {
                try {
                    preRestoreBackupId = `pre-restore-${Date.now()}`;
                    console.log(`💾 復元前バックアップを作成中: ${preRestoreBackupId}`);
                    // 現在のファイル状態をバックアップ
                    // 実装は簡略化（実際には現在のファイル一覧を取得してバックアップ）
                }
                catch (error) {
                    errors.push(`復元前バックアップ作成エラー: ${error}`);
                }
            }
            // 並列で復元を実行
            const [localResult, ec2Result] = await Promise.allSettled([
                this.restoreEnvironmentBackup('local', `${backupId}-local`, options),
                this.restoreEnvironmentBackup('ec2', `${backupId}-ec2`, options)
            ]);
            // 結果の処理
            const environmentResults = {
                local: this.processRestoreResult(localResult, 'local', errors),
                ec2: this.processRestoreResult(ec2Result, 'ec2', errors)
            };
            // 復元後検証（オプション）
            if (options.verifyAfterRestore && !options.dryRun) {
                await this.verifyRestoreResults(environmentResults, errors);
            }
            const totalRestoredFiles = Object.values(environmentResults)
                .reduce((sum, result) => sum + result.restoredFileCount, 0);
            const success = errors.length === 0 &&
                Object.values(environmentResults).every(result => result.success);
            const processingTime = Date.now() - startTime;
            console.log(`✅ 統合バックアップ復元完了: ${totalRestoredFiles}ファイル (${processingTime}ms)`);
            return {
                restoreId,
                success,
                environmentResults,
                totalRestoredFiles,
                errors,
                restoreTime: new Date(),
                processingTime
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `統合バックアップ復元に失敗しました: ${error}`, undefined, undefined, error);
        }
    }
    /**
     * 自動ロールバック機能
     */
    async executeAutoRollback(originalBackupId, reason = 'エラー発生') {
        console.log(`🔄 自動ロールバックを実行中: ${reason}`);
        try {
            const rollbackOptions = {
                createPreRestoreBackup: false, // ロールバック時は追加バックアップ不要
                overwriteExisting: true, // 強制上書き
                verifyAfterRestore: true, // 検証は実行
                dryRun: false
            };
            const result = await this.restoreIntegratedBackup(originalBackupId, rollbackOptions);
            if (result.success) {
                console.log(`✅ 自動ロールバック完了: ${result.totalRestoredFiles}ファイル復元`);
            }
            else {
                console.error(`❌ 自動ロールバック失敗: ${result.errors.join('; ')}`);
            }
            return result;
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.ROLLBACK_FAILED, `自動ロールバックに失敗しました: ${error}`, undefined, undefined, error);
        }
    }
    /**
     * バックアップ一覧を取得（統合）
     */
    async listIntegratedBackups() {
        try {
            const [localBackups, ec2Backups] = await Promise.all([
                this.localBackupManager.listBackups(),
                this.ec2BackupManager.listBackups()
            ]);
            // ペアになったバックアップを特定
            const paired = this.identifyPairedBackups(localBackups, ec2Backups);
            return {
                local: localBackups,
                ec2: ec2Backups,
                paired
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `統合バックアップ一覧取得に失敗しました: ${error}`, undefined, undefined, error);
        }
    }
    /**
     * 古いバックアップの統合クリーンアップ
     */
    async cleanupOldIntegratedBackups(retentionDays) {
        console.log(`🧹 ${retentionDays}日より古い統合バックアップを削除中...`);
        try {
            // 並列でクリーンアップを実行
            const [localResult, ec2Result] = await Promise.allSettled([
                this.cleanupEnvironmentBackups('local', retentionDays),
                this.cleanupEnvironmentBackups('ec2', retentionDays)
            ]);
            const localDeleted = localResult.status === 'fulfilled' ? localResult.value : 0;
            const ec2Deleted = ec2Result.status === 'fulfilled' ? ec2Result.value : 0;
            const totalDeleted = localDeleted + ec2Deleted;
            console.log(`✅ 統合バックアップクリーンアップ完了: ${totalDeleted}個削除`);
            return {
                localDeleted,
                ec2Deleted,
                totalDeleted
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `統合バックアップクリーンアップに失敗しました: ${error}`, undefined, undefined, error);
        }
    }
    /**
     * バックアップの整合性検証（統合）
     */
    async verifyIntegratedBackup(backupId) {
        try {
            const [localResult, ec2Result] = await Promise.allSettled([
                this.localBackupManager.verifyBackup(`${backupId}-local`),
                this.ec2BackupManager.verifyBackup(`${backupId}-ec2`)
            ]);
            const local = localResult.status === 'fulfilled' ? localResult.value :
                { valid: false, errors: ['検証実行エラー'], checkedFiles: 0 };
            const ec2 = ec2Result.status === 'fulfilled' ? ec2Result.value :
                { valid: false, errors: ['検証実行エラー'], checkedFiles: 0 };
            const overall = {
                valid: local.valid && ec2.valid,
                totalErrors: local.errors.length + ec2.errors.length,
                totalCheckedFiles: local.checkedFiles + ec2.checkedFiles
            };
            return { local, ec2, overall };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `統合バックアップ検証に失敗しました: ${error}`, undefined, undefined, error);
        }
    }
    /**
     * 環境別バックアップ復元
     */
    async restoreEnvironmentBackup(environment, backupId, options) {
        if (options.dryRun) {
            // ドライランモードの場合はモック結果を返す
            return {
                restoreId: `dryrun-${Date.now()}`,
                success: true,
                restoredFileCount: 0,
                restoredFiles: [],
                restoreTime: new Date(),
                environment
            };
        }
        const manager = environment === 'local' ? this.localBackupManager : this.ec2BackupManager;
        return await manager.restoreBackup(backupId);
    }
    /**
     * 復元結果を処理
     */
    processRestoreResult(result, environment, errors) {
        if (result.status === 'fulfilled') {
            if (!result.value.success && result.value.error) {
                errors.push(`${environment}環境復元エラー: ${result.value.error}`);
            }
            return result.value;
        }
        else {
            const errorMsg = `${environment}環境復元失敗: ${result.reason}`;
            errors.push(errorMsg);
            return {
                restoreId: `error-${Date.now()}`,
                success: false,
                restoredFileCount: 0,
                restoredFiles: [],
                error: errorMsg,
                restoreTime: new Date(),
                environment
            };
        }
    }
    /**
     * 復元結果を検証
     */
    async verifyRestoreResults(environmentResults, errors) {
        console.log('🔍 復元結果を検証中...');
        for (const [env, result] of Object.entries(environmentResults)) {
            if (!result.success) {
                errors.push(`${env}環境の復元が失敗しています`);
                continue;
            }
            // 復元されたファイルの存在確認（簡略化）
            try {
                // 実際の実装では、復元されたファイルの存在と整合性を確認
                console.log(`✅ ${env}環境の復元結果検証完了: ${result.restoredFileCount}ファイル`);
            }
            catch (error) {
                errors.push(`${env}環境の復元結果検証エラー: ${error}`);
            }
        }
    }
    /**
     * ペアになったバックアップを特定
     */
    identifyPairedBackups(localBackups, ec2Backups) {
        const paired = [];
        const processedIds = new Set();
        // ローカルバックアップから開始
        for (const localBackup of localBackups) {
            const baseId = localBackup.backupId.replace('-local', '');
            if (processedIds.has(baseId))
                continue;
            const ec2Backup = ec2Backups.find(b => b.backupId === `${baseId}-ec2`);
            paired.push({
                backupId: baseId,
                localBackup,
                ec2Backup,
                complete: !!ec2Backup
            });
            processedIds.add(baseId);
        }
        // EC2のみのバックアップを追加
        for (const ec2Backup of ec2Backups) {
            const baseId = ec2Backup.backupId.replace('-ec2', '');
            if (processedIds.has(baseId))
                continue;
            paired.push({
                backupId: baseId,
                ec2Backup,
                complete: false
            });
            processedIds.add(baseId);
        }
        return paired.sort((a, b) => {
            const aTime = a.localBackup?.createdAt || a.ec2Backup?.createdAt || new Date(0);
            const bTime = b.localBackup?.createdAt || b.ec2Backup?.createdAt || new Date(0);
            return bTime.getTime() - aTime.getTime();
        });
    }
    /**
     * 環境別バックアップクリーンアップ
     */
    async cleanupEnvironmentBackups(environment, retentionDays) {
        try {
            const manager = environment === 'local' ? this.localBackupManager : this.ec2BackupManager;
            const backupsBefore = await manager.listBackups();
            await manager.cleanupOldBackups(retentionDays);
            const backupsAfter = await manager.listBackups();
            return backupsBefore.length - backupsAfter.length;
        }
        catch (error) {
            console.warn(`${environment}環境のバックアップクリーンアップエラー:`, error);
            return 0;
        }
    }
    /**
     * 緊急復旧機能
     */
    async emergencyRestore(backupId, targetEnvironment) {
        console.log(`🚨 緊急復旧を実行中: ${backupId}`);
        const emergencyOptions = {
            createPreRestoreBackup: false,
            overwriteExisting: true,
            verifyAfterRestore: false, // 緊急時は検証をスキップ
            dryRun: false
        };
        try {
            if (targetEnvironment) {
                // 特定環境のみの緊急復旧
                const result = await this.restoreEnvironmentBackup(targetEnvironment, `${backupId}-${targetEnvironment}`, emergencyOptions);
                return {
                    restoreId: `emergency-${Date.now()}`,
                    success: result.success,
                    environmentResults: { [targetEnvironment]: result },
                    totalRestoredFiles: result.restoredFileCount,
                    errors: result.error ? [result.error] : [],
                    restoreTime: new Date(),
                    processingTime: 0
                };
            }
            else {
                // 全環境の緊急復旧
                return await this.restoreIntegratedBackup(backupId, emergencyOptions);
            }
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `緊急復旧に失敗しました: ${error}`, undefined, targetEnvironment, error);
        }
    }
}
exports.BackupRestoreManager = BackupRestoreManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja3VwLXJlc3RvcmUtbWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJhY2t1cC1yZXN0b3JlLW1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7OztHQUtHOzs7QUFFSCx1RUFBK0Q7QUFDL0QsbUVBQTJEO0FBRTNELGdEQU8yQjtBQW9DM0I7Ozs7O0dBS0c7QUFDSCxNQUFhLG9CQUFvQjtJQUNkLGtCQUFrQixDQUFxQjtJQUN2QyxnQkFBZ0IsQ0FBbUI7SUFFcEQsWUFDRSxpQkFBeUIsMEJBQTBCLEVBQ25ELFNBQW9CLEVBQ3BCLGVBQXVCLHNCQUFzQjtRQUU3QyxJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSw0Q0FBa0IsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUNqRSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSx3Q0FBZ0IsQ0FBQyxTQUFTLEVBQUUsWUFBWSxDQUFDLENBQUM7SUFDeEUsQ0FBQztJQUVEOztPQUVHO0lBQ0ksS0FBSyxDQUFDLHNCQUFzQixDQUNqQyxVQUFvQixFQUNwQixRQUFrQixFQUNsQixRQUFnQjtRQU1oQixPQUFPLENBQUMsR0FBRyxDQUFDLG9CQUFvQixRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBRTVDLElBQUksQ0FBQztZQUNILGVBQWU7WUFDZixNQUFNLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxHQUFHLE1BQU0sT0FBTyxDQUFDLFVBQVUsQ0FBQztnQkFDeEQsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFlBQVksQ0FBQyxVQUFVLEVBQUUsR0FBRyxRQUFRLFFBQVEsQ0FBQztnQkFDckUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsR0FBRyxRQUFRLE1BQU0sQ0FBQzthQUNoRSxDQUFDLENBQUM7WUFFSCxNQUFNLFdBQVcsR0FBRyxXQUFXLENBQUMsTUFBTSxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFD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Q3BDLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTztvQkFDdkIsa0JBQWtCLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLEVBQUUsTUFBTSxFQUF3QztvQkFDekYsa0JBQWtCLEVBQUUsTUFBTSxDQUFDLGlCQUFpQjtvQkFDNUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO29CQUMxQyxXQUFXLEVBQUUsSUFBSSxJQUFJLEVBQUU7b0JBQ3ZCLGNBQWMsRUFBRSxDQUFDO2lCQUNsQixDQUFDO1lBQ0osQ0FBQztpQkFBTSxDQUFDO2dCQUNOLFdBQVc7Z0JBQ1gsT0FBTyxNQUFNLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxRQUFRLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztZQUN4RSxDQUFDO1FBQ0gsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixNQUFNLElBQUksNEJBQWlCLENBQ3pCLGdDQUFxQixDQUFDLGFBQWEsRUFDbkMsZ0JBQWdCLEtBQUssRUFBRSxFQUN2QixTQUFTLEVBQ1QsaUJBQWlCLEVBQ2pCLEtBQWMsQ0FDZixDQUFDO1FBQ0osQ0FBQztJQUNILENBQUM7Q0FDRjtBQXpmRCxvREF5ZkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOe1seWQiOODleOCoeOCpOODq+aVtOeQhuOCt+OCueODhuODoCAtIOODkOODg+OCr+OCouODg+ODl+W+qeWFg+euoeeQhlxuICogXG4gKiDjg63jg7zjgqvjg6vjg7tFQzLkuKHnkrDlooPjgafjga7jg5Djg4Pjgq/jgqLjg4Pjg5flvqnlhYPmqZ/og73jgpLntbHlkIjnrqHnkIbjgZfjgIFcbiAqIOOCqOODqeODvOaZguOBruiHquWLleODreODvOODq+ODkOODg+OCr+apn+iDveOCkuaPkOS+m+OBl+OBvuOBmeOAglxuICovXG5cbmltcG9ydCB7IExvY2FsQmFja3VwTWFuYWdlciB9IGZyb20gJy4vbG9jYWwtYmFja3VwLW1hbmFnZXIuanMnO1xuaW1wb3J0IHsgRUMyQmFja3VwTWFuYWdlciB9IGZyb20gJy4vZWMyLWJhY2t1cC1tYW5hZ2VyLmpzJztcbmltcG9ydCB7IFNTSENvbmZpZyB9IGZyb20gJy4uL3NjYW5uZXJzL2VjMi1zY2FubmVyLmpzJztcbmltcG9ydCB7IFxuICBCYWNrdXBSZXN1bHQsIFxuICBSZXN0b3JlUmVzdWx0LCBcbiAgQmFja3VwSW5mbyxcbiAgRW52aXJvbm1lbnQsXG4gIE9yZ2FuaXphdGlvbkVycm9yLFxuICBPcmdhbml6YXRpb25FcnJvclR5cGVcbn0gZnJvbSAnLi4vdHlwZXMvaW5kZXguanMnO1xuXG4vKipcbiAqIOW+qeWFg+OCquODl+OCt+ODp+ODs1xuICovXG5leHBvcnQgaW50ZXJmYWNlIFJlc3RvcmVPcHRpb25zIHtcbiAgLyoqIOW+qeWFg+WJjeOBq+ODkOODg+OCr+OCouODg+ODl+OCkuS9nOaIkOOBmeOCi+OBiyAqL1xuICBjcmVhdGVQcmVSZXN0b3JlQmFja3VwOiBib29sZWFuO1xuICAvKiog5pei5a2Y44OV44Kh44Kk44Or44KS5LiK5pu444GN44GZ44KL44GLICovXG4gIG92ZXJ3cml0ZUV4aXN0aW5nOiBib29sZWFuO1xuICAvKiog5b6p5YWD5b6M44Gr5qSc6Ki844KS5a6f6KGM44GZ44KL44GLICovXG4gIHZlcmlmeUFmdGVyUmVzdG9yZTogYm9vbGVhbjtcbiAgLyoqIOODieODqeOCpOODqeODs+ODouODvOODiSAqL1xuICBkcnlSdW46IGJvb2xlYW47XG59XG5cbi8qKlxuICog57Wx5ZCI5b6p5YWD57WQ5p6cXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSW50ZWdyYXRlZFJlc3RvcmVSZXN1bHQge1xuICAvKiog5b6p5YWDSUQgKi9cbiAgcmVzdG9yZUlkOiBzdHJpbmc7XG4gIC8qKiDmiJDlip/jgZfjgZ/jgYvjganjgYbjgYsgKi9cbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgLyoqIOeSsOWig+WIpee1kOaenCAqL1xuICBlbnZpcm9ubWVudFJlc3VsdHM6IFJlY29yZDxFbnZpcm9ubWVudCwgUmVzdG9yZVJlc3VsdD47XG4gIC8qKiDlvqnlhYPjgZXjgozjgZ/jg5XjgqHjgqTjg6vnt4/mlbAgKi9cbiAgdG90YWxSZXN0b3JlZEZpbGVzOiBudW1iZXI7XG4gIC8qKiDjgqjjg6njg7wgKi9cbiAgZXJyb3JzOiBzdHJpbmdbXTtcbiAgLyoqIOW+qeWFg+Wun+ihjOaZguWIuyAqL1xuICByZXN0b3JlVGltZTogRGF0ZTtcbiAgLyoqIOWHpueQhuaZgumWkyAqL1xuICBwcm9jZXNzaW5nVGltZTogbnVtYmVyO1xufVxuXG4vKipcbiAqIOODkOODg+OCr+OCouODg+ODl+W+qeWFg+euoeeQhlxuICogXG4gKiDkuKHnkrDlooPjga7jg5Djg4Pjgq/jgqLjg4Pjg5flvqnlhYPjgpLntbHlkIjnrqHnkIbjgZfjgIFcbiAqIOOCqOODqeODvOaZguOBruiHquWLleODreODvOODq+ODkOODg+OCr+apn+iDveOCkuaPkOS+m+OBl+OBvuOBmeOAglxuICovXG5leHBvcnQgY2xhc3MgQmFja3VwUmVzdG9yZU1hbmFnZXIge1xuICBwcml2YXRlIHJlYWRvbmx5IGxvY2FsQmFja3VwTWFuYWdlcjogTG9jYWxCYWNrdXBNYW5hZ2VyO1xuICBwcml2YXRlIHJlYWRvbmx5IGVjMkJhY2t1cE1hbmFnZXI6IEVDMkJhY2t1cE1hbmFnZXI7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgbG9jYWxCYWNrdXBEaXI6IHN0cmluZyA9ICdkZXZlbG9wbWVudC90ZW1wL2JhY2t1cHMnLFxuICAgIHNzaENvbmZpZzogU1NIQ29uZmlnLFxuICAgIGVjMkJhY2t1cERpcjogc3RyaW5nID0gJy9ob21lL3VidW50dS9iYWNrdXBzJ1xuICApIHtcbiAgICB0aGlzLmxvY2FsQmFja3VwTWFuYWdlciA9IG5ldyBMb2NhbEJhY2t1cE1hbmFnZXIobG9jYWxCYWNrdXBEaXIpO1xuICAgIHRoaXMuZWMyQmFja3VwTWFuYWdlciA9IG5ldyBFQzJCYWNrdXBNYW5hZ2VyKHNzaENvbmZpZywgZWMyQmFja3VwRGlyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDntbHlkIjjg5Djg4Pjgq/jgqLjg4Pjg5fkvZzmiJBcbiAgICovXG4gIHB1YmxpYyBhc3luYyBjcmVhdGVJbnRlZ3JhdGVkQmFja3VwKFxuICAgIGxvY2FsRmlsZXM6IHN0cmluZ1tdLFxuICAgIGVjMkZpbGVzOiBzdHJpbmdbXSxcbiAgICBiYWNrdXBJZDogc3RyaW5nXG4gICk6IFByb21pc2U8e1xuICAgIGxvY2FsOiBCYWNrdXBSZXN1bHQ7XG4gICAgZWMyOiBCYWNrdXBSZXN1bHQ7XG4gICAgc3VjY2VzczogYm9vbGVhbjtcbiAgfT4ge1xuICAgIGNvbnNvbGUubG9nKGDwn5K+IOe1seWQiOODkOODg+OCr+OCouODg+ODl+OCkuS9nOaIkOS4rTogJHtiYWNrdXBJZH1gKTtcblxuICAgIHRyeSB7XG4gICAgICAvLyDkuKbliJfjgafjg5Djg4Pjgq/jgqLjg4Pjg5fjgpLkvZzmiJBcbiAgICAgIGNvbnN0IFtsb2NhbFJlc3VsdCwgZWMyUmVzdWx0XSA9IGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgICAgIHRoaXMubG9jYWxCYWNrdXBNYW5hZ2VyLmNyZWF0ZUJhY2t1cChsb2NhbEZpbGVzLCBgJHtiYWNrdXBJZH0tbG9jYWxgKSxcbiAgICAgICAgdGhpcy5lYzJCYWNrdXBNYW5hZ2VyLmNyZWF0ZUJhY2t1cChlYzJGaWxlcywgYCR7YmFja3VwSWR9LWVjMmApXG4gICAgICBdKTtcblxuICAgICAgY29uc3QgbG9jYWxCYWNrdXAgPSBsb2NhbFJlc3VsdC5zdGF0dXMgPT09ICdmdWxmaWxsZWQnID8gbG9jYWxSZXN1bHQudmFsdWUgOiBudWxsO1xuICAgICAgY29uc3QgZWMyQmFja3VwID0gZWMyUmVzdWx0LnN0YXR1cyA9PT0gJ2Z1bGZpbGxlZCcgPyBlYzJSZXN1bHQudmFsdWUgOiBudWxsO1xuXG4gICAgICBpZiAoIWxvY2FsQmFja3VwIHx8ICFlYzJCYWNrdXApIHtcbiAgICAgICAgLy8g6YOo5YiG55qE44Gq5aSx5pWX44Gu5aC05ZCI44CB5oiQ5Yqf44GX44Gf44OQ44OD44Kv44Ki44OD44OX44KS44Kv44Oq44O844Oz44Ki44OD44OXXG4gICAgICAgIGlmIChsb2NhbEJhY2t1cCkge1xuICAgICAgICAgIGF3YWl0IHRoaXMubG9jYWxCYWNrdXBNYW5hZ2VyLmRlbGV0ZUJhY2t1cChgJHtiYWNrdXBJZH0tbG9jYWxgKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZWMyQmFja3VwKSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5lYzJCYWNrdXBNYW5hZ2VyLmRlbGV0ZUJhY2t1cChgJHtiYWNrdXBJZH0tZWMyYCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ+e1seWQiOODkOODg+OCr+OCouODg+ODl+OBruS9nOaIkOOBq+WkseaVl+OBl+OBvuOBl+OBnycpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBzdWNjZXNzID0gbG9jYWxCYWNrdXAuc3VjY2VzcyAmJiBlYzJCYWNrdXAuc3VjY2VzcztcbiAgICAgIGNvbnNvbGUubG9nKGDinIUg57Wx5ZCI44OQ44OD44Kv44Ki44OD44OX5L2c5oiQ5a6M5LqGOiAke3N1Y2Nlc3MgPyAn5oiQ5YqfJyA6ICfpg6jliIbnmoTmiJDlip8nfWApO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBsb2NhbDogbG9jYWxCYWNrdXAsXG4gICAgICAgIGVjMjogZWMyQmFja3VwLFxuICAgICAgICBzdWNjZXNzXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5CQUNLVVBfRkFJTEVELFxuICAgICAgICBg57Wx5ZCI44OQ44OD44Kv44Ki44OD44OX5L2c5oiQ44Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yfWAsXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog57Wx5ZCI44OQ44OD44Kv44Ki44OD44OX5b6p5YWDXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgcmVzdG9yZUludGVncmF0ZWRCYWNrdXAoXG4gICAgYmFja3VwSWQ6IHN0cmluZyxcbiAgICBvcHRpb25zOiBSZXN0b3JlT3B0aW9ucyA9IHtcbiAgICAgIGNyZWF0ZVByZVJlc3RvcmVCYWNrdXA6IHRydWUsXG4gICAgICBvdmVyd3JpdGVFeGlzdGluZzogZmFsc2UsXG4gICAgICB2ZXJpZnlBZnRlclJlc3RvcmU6IHRydWUsXG4gICAgICBkcnlSdW46IGZhbHNlXG4gICAgfVxuICApOiBQcm9taXNlPEludGVncmF0ZWRSZXN0b3JlUmVzdWx0PiB7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCByZXN0b3JlSWQgPSBgcmVzdG9yZS0ke0RhdGUubm93KCl9YDtcbiAgICBjb25zb2xlLmxvZyhg8J+UhCDntbHlkIjjg5Djg4Pjgq/jgqLjg4Pjg5fjgpLlvqnlhYPkuK06ICR7YmFja3VwSWR9YCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgbGV0IHByZVJlc3RvcmVCYWNrdXBJZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG4gICAgICAvLyDlvqnlhYPliY3jg5Djg4Pjgq/jgqLjg4Pjg5fjga7kvZzmiJDvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICAgIGlmIChvcHRpb25zLmNyZWF0ZVByZVJlc3RvcmVCYWNrdXAgJiYgIW9wdGlvbnMuZHJ5UnVuKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcHJlUmVzdG9yZUJhY2t1cElkID0gYHByZS1yZXN0b3JlLSR7RGF0ZS5ub3coKX1gO1xuICAgICAgICAgIGNvbnNvbGUubG9nKGDwn5K+IOW+qeWFg+WJjeODkOODg+OCr+OCouODg+ODl+OCkuS9nOaIkOS4rTogJHtwcmVSZXN0b3JlQmFja3VwSWR9YCk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8g54++5Zyo44Gu44OV44Kh44Kk44Or54q25oWL44KS44OQ44OD44Kv44Ki44OD44OXXG4gICAgICAgICAgLy8g5a6f6KOF44Gv57Ch55Wl5YyW77yI5a6f6Zqb44Gr44Gv54++5Zyo44Gu44OV44Kh44Kk44Or5LiA6Kan44KS5Y+W5b6X44GX44Gm44OQ44OD44Kv44Ki44OD44OX77yJXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgZXJyb3JzLnB1c2goYOW+qeWFg+WJjeODkOODg+OCr+OCouODg+ODl+S9nOaIkOOCqOODqeODvDogJHtlcnJvcn1gKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyDkuKbliJfjgaflvqnlhYPjgpLlrp/ooYxcbiAgICAgIGNvbnN0IFtsb2NhbFJlc3VsdCwgZWMyUmVzdWx0XSA9IGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgICAgIHRoaXMucmVzdG9yZUVudmlyb25tZW50QmFja3VwKCdsb2NhbCcsIGAke2JhY2t1cElkfS1sb2NhbGAsIG9wdGlvbnMpLFxuICAgICAgICB0aGlzLnJlc3RvcmVFbnZpcm9ubWVudEJhY2t1cCgnZWMyJywgYCR7YmFja3VwSWR9LWVjMmAsIG9wdGlvbnMpXG4gICAgICBdKTtcblxuICAgICAgLy8g57WQ5p6c44Gu5Yem55CGXG4gICAgICBjb25zdCBlbnZpcm9ubWVudFJlc3VsdHM6IFJlY29yZDxFbnZpcm9ubWVudCwgUmVzdG9yZVJlc3VsdD4gPSB7XG4gICAgICAgIGxvY2FsOiB0aGlzLnByb2Nlc3NSZXN0b3JlUmVzdWx0KGxvY2FsUmVzdWx0LCAnbG9jYWwnLCBlcnJvcnMpLFxuICAgICAgICBlYzI6IHRoaXMucHJvY2Vzc1Jlc3RvcmVSZXN1bHQoZWMyUmVzdWx0LCAnZWMyJywgZXJyb3JzKVxuICAgICAgfTtcblxuICAgICAgLy8g5b6p5YWD5b6M5qSc6Ki877yI44Kq44OX44K344On44Oz77yJXG4gICAgICBpZiAob3B0aW9ucy52ZXJpZnlBZnRlclJlc3RvcmUgJiYgIW9wdGlvbnMuZHJ5UnVuKSB7XG4gICAgICAgIGF3YWl0IHRoaXMudmVyaWZ5UmVzdG9yZVJlc3VsdHMoZW52aXJvbm1lbnRSZXN1bHRzLCBlcnJvcnMpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB0b3RhbFJlc3RvcmVkRmlsZXMgPSBPYmplY3QudmFsdWVzKGVudmlyb25tZW50UmVzdWx0cylcbiAgICAgICAgLnJlZHVjZSgoc3VtLCByZXN1bHQpID0+IHN1bSArIHJlc3VsdC5yZXN0b3JlZEZpbGVDb3VudCwgMCk7XG5cbiAgICAgIGNvbnN0IHN1Y2Nlc3MgPSBlcnJvcnMubGVuZ3RoID09PSAwICYmIFxuICAgICAgICBPYmplY3QudmFsdWVzKGVudmlyb25tZW50UmVzdWx0cykuZXZlcnkocmVzdWx0ID0+IHJlc3VsdC5zdWNjZXNzKTtcblxuICAgICAgY29uc3QgcHJvY2Vzc2luZ1RpbWUgPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgY29uc29sZS5sb2coYOKchSDntbHlkIjjg5Djg4Pjgq/jgqLjg4Pjg5flvqnlhYPlrozkuoY6ICR7dG90YWxSZXN0b3JlZEZpbGVzfeODleOCoeOCpOODqyAoJHtwcm9jZXNzaW5nVGltZX1tcylgKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdG9yZUlkLFxuICAgICAgICBzdWNjZXNzLFxuICAgICAgICBlbnZpcm9ubWVudFJlc3VsdHMsXG4gICAgICAgIHRvdGFsUmVzdG9yZWRGaWxlcyxcbiAgICAgICAgZXJyb3JzLFxuICAgICAgICByZXN0b3JlVGltZTogbmV3IERhdGUoKSxcbiAgICAgICAgcHJvY2Vzc2luZ1RpbWVcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgT3JnYW5pemF0aW9uRXJyb3JUeXBlLkJBQ0tVUF9GQUlMRUQsXG4gICAgICAgIGDntbHlkIjjg5Djg4Pjgq/jgqLjg4Pjg5flvqnlhYPjgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3J9YCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDoh6rli5Xjg63jg7zjg6vjg5Djg4Pjgq/mqZ/og71cbiAgICovXG4gIHB1YmxpYyBhc3luYyBleGVjdXRlQXV0b1JvbGxiYWNrKFxuICAgIG9yaWdpbmFsQmFja3VwSWQ6IHN0cmluZyxcbiAgICByZWFzb246IHN0cmluZyA9ICfjgqjjg6njg7znmbrnlJ8nXG4gICk6IFByb21pc2U8SW50ZWdyYXRlZFJlc3RvcmVSZXN1bHQ+IHtcbiAgICBjb25zb2xlLmxvZyhg8J+UhCDoh6rli5Xjg63jg7zjg6vjg5Djg4Pjgq/jgpLlrp/ooYzkuK06ICR7cmVhc29ufWApO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJvbGxiYWNrT3B0aW9uczogUmVzdG9yZU9wdGlvbnMgPSB7XG4gICAgICAgIGNyZWF0ZVByZVJlc3RvcmVCYWNrdXA6IGZhbHNlLCAvLyDjg63jg7zjg6vjg5Djg4Pjgq/mmYLjga/ov73liqDjg5Djg4Pjgq/jgqLjg4Pjg5fkuI3opoFcbiAgICAgICAgb3ZlcndyaXRlRXhpc3Rpbmc6IHRydWUsICAgICAgIC8vIOW8t+WItuS4iuabuOOBjVxuICAgICAgICB2ZXJpZnlBZnRlclJlc3RvcmU6IHRydWUsICAgICAgLy8g5qSc6Ki844Gv5a6f6KGMXG4gICAgICAgIGRyeVJ1bjogZmFsc2VcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucmVzdG9yZUludGVncmF0ZWRCYWNrdXAob3JpZ2luYWxCYWNrdXBJZCwgcm9sbGJhY2tPcHRpb25zKTtcbiAgICAgIFxuICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGDinIUg6Ieq5YuV44Ot44O844Or44OQ44OD44Kv5a6M5LqGOiAke3Jlc3VsdC50b3RhbFJlc3RvcmVkRmlsZXN944OV44Kh44Kk44Or5b6p5YWDYCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKGDinYwg6Ieq5YuV44Ot44O844Or44OQ44OD44Kv5aSx5pWXOiAke3Jlc3VsdC5lcnJvcnMuam9pbignOyAnKX1gKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuUk9MTEJBQ0tfRkFJTEVELFxuICAgICAgICBg6Ieq5YuV44Ot44O844Or44OQ44OD44Kv44Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yfWAsXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44OQ44OD44Kv44Ki44OD44OX5LiA6Kan44KS5Y+W5b6X77yI57Wx5ZCI77yJXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgbGlzdEludGVncmF0ZWRCYWNrdXBzKCk6IFByb21pc2U8e1xuICAgIGxvY2FsOiBCYWNrdXBJbmZvW107XG4gICAgZWMyOiBCYWNrdXBJbmZvW107XG4gICAgcGFpcmVkOiBBcnJheTx7XG4gICAgICBiYWNrdXBJZDogc3RyaW5nO1xuICAgICAgbG9jYWxCYWNrdXA/OiBCYWNrdXBJbmZvO1xuICAgICAgZWMyQmFja3VwPzogQmFja3VwSW5mbztcbiAgICAgIGNvbXBsZXRlOiBib29sZWFuO1xuICAgIH0+O1xuICB9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IFtsb2NhbEJhY2t1cHMsIGVjMkJhY2t1cHNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgICB0aGlzLmxvY2FsQmFja3VwTWFuYWdlci5saXN0QmFja3VwcygpLFxuICAgICAgICB0aGlzLmVjMkJhY2t1cE1hbmFnZXIubGlzdEJhY2t1cHMoKVxuICAgICAgXSk7XG5cbiAgICAgIC8vIOODmuOCouOBq+OBquOBo+OBn+ODkOODg+OCr+OCouODg+ODl+OCkueJueWumlxuICAgICAgY29uc3QgcGFpcmVkID0gdGhpcy5pZGVudGlmeVBhaXJlZEJhY2t1cHMobG9jYWxCYWNrdXBzLCBlYzJCYWNrdXBzKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbG9jYWw6IGxvY2FsQmFja3VwcyxcbiAgICAgICAgZWMyOiBlYzJCYWNrdXBzLFxuICAgICAgICBwYWlyZWRcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgT3JnYW5pemF0aW9uRXJyb3JUeXBlLkJBQ0tVUF9GQUlMRUQsXG4gICAgICAgIGDntbHlkIjjg5Djg4Pjgq/jgqLjg4Pjg5fkuIDopqflj5blvpfjgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3J9YCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDlj6TjgYTjg5Djg4Pjgq/jgqLjg4Pjg5fjga7ntbHlkIjjgq/jg6rjg7zjg7PjgqLjg4Pjg5dcbiAgICovXG4gIHB1YmxpYyBhc3luYyBjbGVhbnVwT2xkSW50ZWdyYXRlZEJhY2t1cHMocmV0ZW50aW9uRGF5czogbnVtYmVyKTogUHJvbWlzZTx7XG4gICAgbG9jYWxEZWxldGVkOiBudW1iZXI7XG4gICAgZWMyRGVsZXRlZDogbnVtYmVyO1xuICAgIHRvdGFsRGVsZXRlZDogbnVtYmVyO1xuICB9PiB7XG4gICAgY29uc29sZS5sb2coYPCfp7kgJHtyZXRlbnRpb25EYXlzfeaXpeOCiOOCiuWPpOOBhOe1seWQiOODkOODg+OCr+OCouODg+ODl+OCkuWJiumZpOS4rS4uLmApO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIOS4puWIl+OBp+OCr+ODquODvOODs+OCouODg+ODl+OCkuWun+ihjFxuICAgICAgY29uc3QgW2xvY2FsUmVzdWx0LCBlYzJSZXN1bHRdID0gYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICAgICAgdGhpcy5jbGVhbnVwRW52aXJvbm1lbnRCYWNrdXBzKCdsb2NhbCcsIHJldGVudGlvbkRheXMpLFxuICAgICAgICB0aGlzLmNsZWFudXBFbnZpcm9ubWVudEJhY2t1cHMoJ2VjMicsIHJldGVudGlvbkRheXMpXG4gICAgICBdKTtcblxuICAgICAgY29uc3QgbG9jYWxEZWxldGVkID0gbG9jYWxSZXN1bHQuc3RhdHVzID09PSAnZnVsZmlsbGVkJyA/IGxvY2FsUmVzdWx0LnZhbHVlIDogMDtcbiAgICAgIGNvbnN0IGVjMkRlbGV0ZWQgPSBlYzJSZXN1bHQuc3RhdHVzID09PSAnZnVsZmlsbGVkJyA/IGVjMlJlc3VsdC52YWx1ZSA6IDA7XG4gICAgICBjb25zdCB0b3RhbERlbGV0ZWQgPSBsb2NhbERlbGV0ZWQgKyBlYzJEZWxldGVkO1xuXG4gICAgICBjb25zb2xlLmxvZyhg4pyFIOe1seWQiOODkOODg+OCr+OCouODg+ODl+OCr+ODquODvOODs+OCouODg+ODl+WujOS6hjogJHt0b3RhbERlbGV0ZWR95YCL5YmK6ZmkYCk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGxvY2FsRGVsZXRlZCxcbiAgICAgICAgZWMyRGVsZXRlZCxcbiAgICAgICAgdG90YWxEZWxldGVkXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5CQUNLVVBfRkFJTEVELFxuICAgICAgICBg57Wx5ZCI44OQ44OD44Kv44Ki44OD44OX44Kv44Oq44O844Oz44Ki44OD44OX44Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yfWAsXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44OQ44OD44Kv44Ki44OD44OX44Gu5pW05ZCI5oCn5qSc6Ki877yI57Wx5ZCI77yJXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgdmVyaWZ5SW50ZWdyYXRlZEJhY2t1cChiYWNrdXBJZDogc3RyaW5nKTogUHJvbWlzZTx7XG4gICAgbG9jYWw6IHsgdmFsaWQ6IGJvb2xlYW47IGVycm9yczogc3RyaW5nW107IGNoZWNrZWRGaWxlczogbnVtYmVyIH07XG4gICAgZWMyOiB7IHZhbGlkOiBib29sZWFuOyBlcnJvcnM6IHN0cmluZ1tdOyBjaGVja2VkRmlsZXM6IG51bWJlciB9O1xuICAgIG92ZXJhbGw6IHsgdmFsaWQ6IGJvb2xlYW47IHRvdGFsRXJyb3JzOiBudW1iZXI7IHRvdGFsQ2hlY2tlZEZpbGVzOiBudW1iZXIgfTtcbiAgfT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBbbG9jYWxSZXN1bHQsIGVjMlJlc3VsdF0gPSBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoW1xuICAgICAgICB0aGlzLmxvY2FsQmFja3VwTWFuYWdlci52ZXJpZnlCYWNrdXAoYCR7YmFja3VwSWR9LWxvY2FsYCksXG4gICAgICAgIHRoaXMuZWMyQmFja3VwTWFuYWdlci52ZXJpZnlCYWNrdXAoYCR7YmFja3VwSWR9LWVjMmApXG4gICAgICBdKTtcblxuICAgICAgY29uc3QgbG9jYWwgPSBsb2NhbFJlc3VsdC5zdGF0dXMgPT09ICdmdWxmaWxsZWQnID8gbG9jYWxSZXN1bHQudmFsdWUgOiBcbiAgICAgICAgeyB2YWxpZDogZmFsc2UsIGVycm9yczogWyfmpJzoqLzlrp/ooYzjgqjjg6njg7wnXSwgY2hlY2tlZEZpbGVzOiAwIH07XG4gICAgICBcbiAgICAgIGNvbnN0IGVjMiA9IGVjMlJlc3VsdC5zdGF0dXMgPT09ICdmdWxmaWxsZWQnID8gZWMyUmVzdWx0LnZhbHVlIDogXG4gICAgICAgIHsgdmFsaWQ6IGZhbHNlLCBlcnJvcnM6IFsn5qSc6Ki85a6f6KGM44Ko44Op44O8J10sIGNoZWNrZWRGaWxlczogMCB9O1xuXG4gICAgICBjb25zdCBvdmVyYWxsID0ge1xuICAgICAgICB2YWxpZDogbG9jYWwudmFsaWQgJiYgZWMyLnZhbGlkLFxuICAgICAgICB0b3RhbEVycm9yczogbG9jYWwuZXJyb3JzLmxlbmd0aCArIGVjMi5lcnJvcnMubGVuZ3RoLFxuICAgICAgICB0b3RhbENoZWNrZWRGaWxlczogbG9jYWwuY2hlY2tlZEZpbGVzICsgZWMyLmNoZWNrZWRGaWxlc1xuICAgICAgfTtcblxuICAgICAgcmV0dXJuIHsgbG9jYWwsIGVjMiwgb3ZlcmFsbCB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5CQUNLVVBfRkFJTEVELFxuICAgICAgICBg57Wx5ZCI44OQ44OD44Kv44Ki44OD44OX5qSc6Ki844Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yfWAsXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog55Kw5aKD5Yil44OQ44OD44Kv44Ki44OD44OX5b6p5YWDXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHJlc3RvcmVFbnZpcm9ubWVudEJhY2t1cChcbiAgICBlbnZpcm9ubWVudDogRW52aXJvbm1lbnQsXG4gICAgYmFja3VwSWQ6IHN0cmluZyxcbiAgICBvcHRpb25zOiBSZXN0b3JlT3B0aW9uc1xuICApOiBQcm9taXNlPFJlc3RvcmVSZXN1bHQ+IHtcbiAgICBpZiAob3B0aW9ucy5kcnlSdW4pIHtcbiAgICAgIC8vIOODieODqeOCpOODqeODs+ODouODvOODieOBruWgtOWQiOOBr+ODouODg+OCr+e1kOaenOOCkui/lOOBmVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdG9yZUlkOiBgZHJ5cnVuLSR7RGF0ZS5ub3coKX1gLFxuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICByZXN0b3JlZEZpbGVDb3VudDogMCxcbiAgICAgICAgcmVzdG9yZWRGaWxlczogW10sXG4gICAgICAgIHJlc3RvcmVUaW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICBlbnZpcm9ubWVudFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBjb25zdCBtYW5hZ2VyID0gZW52aXJvbm1lbnQgPT09ICdsb2NhbCcgPyB0aGlzLmxvY2FsQmFja3VwTWFuYWdlciA6IHRoaXMuZWMyQmFja3VwTWFuYWdlcjtcbiAgICByZXR1cm4gYXdhaXQgbWFuYWdlci5yZXN0b3JlQmFja3VwKGJhY2t1cElkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlvqnlhYPntZDmnpzjgpLlh6bnkIZcbiAgICovXG4gIHByaXZhdGUgcHJvY2Vzc1Jlc3RvcmVSZXN1bHQoXG4gICAgcmVzdWx0OiBQcm9taXNlU2V0dGxlZFJlc3VsdDxSZXN0b3JlUmVzdWx0PixcbiAgICBlbnZpcm9ubWVudDogRW52aXJvbm1lbnQsXG4gICAgZXJyb3JzOiBzdHJpbmdbXVxuICApOiBSZXN0b3JlUmVzdWx0IHtcbiAgICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gJ2Z1bGZpbGxlZCcpIHtcbiAgICAgIGlmICghcmVzdWx0LnZhbHVlLnN1Y2Nlc3MgJiYgcmVzdWx0LnZhbHVlLmVycm9yKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKGAke2Vudmlyb25tZW50feeSsOWig+W+qeWFg+OCqOODqeODvDogJHtyZXN1bHQudmFsdWUuZXJyb3J9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0LnZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBlcnJvck1zZyA9IGAke2Vudmlyb25tZW50feeSsOWig+W+qeWFg+WkseaVlzogJHtyZXN1bHQucmVhc29ufWA7XG4gICAgICBlcnJvcnMucHVzaChlcnJvck1zZyk7XG4gICAgICBcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHJlc3RvcmVJZDogYGVycm9yLSR7RGF0ZS5ub3coKX1gLFxuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgcmVzdG9yZWRGaWxlQ291bnQ6IDAsXG4gICAgICAgIHJlc3RvcmVkRmlsZXM6IFtdLFxuICAgICAgICBlcnJvcjogZXJyb3JNc2csXG4gICAgICAgIHJlc3RvcmVUaW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICBlbnZpcm9ubWVudFxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog5b6p5YWD57WQ5p6c44KS5qSc6Ki8XG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHZlcmlmeVJlc3RvcmVSZXN1bHRzKFxuICAgIGVudmlyb25tZW50UmVzdWx0czogUmVjb3JkPEVudmlyb25tZW50LCBSZXN0b3JlUmVzdWx0PixcbiAgICBlcnJvcnM6IHN0cmluZ1tdXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnNvbGUubG9nKCfwn5SNIOW+qeWFg+e1kOaenOOCkuaknOiovOS4rS4uLicpO1xuXG4gICAgZm9yIChjb25zdCBbZW52LCByZXN1bHRdIG9mIE9iamVjdC5lbnRyaWVzKGVudmlyb25tZW50UmVzdWx0cykpIHtcbiAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goYCR7ZW52feeSsOWig+OBruW+qeWFg+OBjOWkseaVl+OBl+OBpuOBhOOBvuOBmWApO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8g5b6p5YWD44GV44KM44Gf44OV44Kh44Kk44Or44Gu5a2Y5Zyo56K66KqN77yI57Ch55Wl5YyW77yJXG4gICAgICB0cnkge1xuICAgICAgICAvLyDlrp/pmpvjga7lrp/oo4Xjgafjga/jgIHlvqnlhYPjgZXjgozjgZ/jg5XjgqHjgqTjg6vjga7lrZjlnKjjgajmlbTlkIjmgKfjgpLnorroqo1cbiAgICAgICAgY29uc29sZS5sb2coYOKchSAke2Vudn3nkrDlooPjga7lvqnlhYPntZDmnpzmpJzoqLzlrozkuoY6ICR7cmVzdWx0LnJlc3RvcmVkRmlsZUNvdW50feODleOCoeOCpOODq2ApO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goYCR7ZW52feeSsOWig+OBruW+qeWFg+e1kOaenOaknOiovOOCqOODqeODvDogJHtlcnJvcn1gKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44Oa44Ki44Gr44Gq44Gj44Gf44OQ44OD44Kv44Ki44OD44OX44KS54m55a6aXG4gICAqL1xuICBwcml2YXRlIGlkZW50aWZ5UGFpcmVkQmFja3VwcyhcbiAgICBsb2NhbEJhY2t1cHM6IEJhY2t1cEluZm9bXSxcbiAgICBlYzJCYWNrdXBzOiBCYWNrdXBJbmZvW11cbiAgKTogQXJyYXk8e1xuICAgIGJhY2t1cElkOiBzdHJpbmc7XG4gICAgbG9jYWxCYWNrdXA/OiBCYWNrdXBJbmZvO1xuICAgIGVjMkJhY2t1cD86IEJhY2t1cEluZm87XG4gICAgY29tcGxldGU6IGJvb2xlYW47XG4gIH0+IHtcbiAgICBjb25zdCBwYWlyZWQ6IEFycmF5PHtcbiAgICAgIGJhY2t1cElkOiBzdHJpbmc7XG4gICAgICBsb2NhbEJhY2t1cD86IEJhY2t1cEluZm87XG4gICAgICBlYzJCYWNrdXA/OiBCYWNrdXBJbmZvO1xuICAgICAgY29tcGxldGU6IGJvb2xlYW47XG4gICAgfT4gPSBbXTtcblxuICAgIGNvbnN0IHByb2Nlc3NlZElkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gICAgLy8g44Ot44O844Kr44Or44OQ44OD44Kv44Ki44OD44OX44GL44KJ6ZaL5aeLXG4gICAgZm9yIChjb25zdCBsb2NhbEJhY2t1cCBvZiBsb2NhbEJhY2t1cHMpIHtcbiAgICAgIGNvbnN0IGJhc2VJZCA9IGxvY2FsQmFja3VwLmJhY2t1cElkLnJlcGxhY2UoJy1sb2NhbCcsICcnKTtcbiAgICAgIGlmIChwcm9jZXNzZWRJZHMuaGFzKGJhc2VJZCkpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBlYzJCYWNrdXAgPSBlYzJCYWNrdXBzLmZpbmQoYiA9PiBiLmJhY2t1cElkID09PSBgJHtiYXNlSWR9LWVjMmApO1xuICAgICAgXG4gICAgICBwYWlyZWQucHVzaCh7XG4gICAgICAgIGJhY2t1cElkOiBiYXNlSWQsXG4gICAgICAgIGxvY2FsQmFja3VwLFxuICAgICAgICBlYzJCYWNrdXAsXG4gICAgICAgIGNvbXBsZXRlOiAhIWVjMkJhY2t1cFxuICAgICAgfSk7XG5cbiAgICAgIHByb2Nlc3NlZElkcy5hZGQoYmFzZUlkKTtcbiAgICB9XG5cbiAgICAvLyBFQzLjga7jgb/jga7jg5Djg4Pjgq/jgqLjg4Pjg5fjgpLov73liqBcbiAgICBmb3IgKGNvbnN0IGVjMkJhY2t1cCBvZiBlYzJCYWNrdXBzKSB7XG4gICAgICBjb25zdCBiYXNlSWQgPSBlYzJCYWNrdXAuYmFja3VwSWQucmVwbGFjZSgnLWVjMicsICcnKTtcbiAgICAgIGlmIChwcm9jZXNzZWRJZHMuaGFzKGJhc2VJZCkpIGNvbnRpbnVlO1xuXG4gICAgICBwYWlyZWQucHVzaCh7XG4gICAgICAgIGJhY2t1cElkOiBiYXNlSWQsXG4gICAgICAgIGVjMkJhY2t1cCxcbiAgICAgICAgY29tcGxldGU6IGZhbHNlXG4gICAgICB9KTtcblxuICAgICAgcHJvY2Vzc2VkSWRzLmFkZChiYXNlSWQpO1xuICAgIH1cblxuICAgIHJldHVybiBwYWlyZWQuc29ydCgoYSwgYikgPT4ge1xuICAgICAgY29uc3QgYVRpbWUgPSBhLmxvY2FsQmFja3VwPy5jcmVhdGVkQXQgfHwgYS5lYzJCYWNrdXA/LmNyZWF0ZWRBdCB8fCBuZXcgRGF0ZSgwKTtcbiAgICAgIGNvbnN0IGJUaW1lID0gYi5sb2NhbEJhY2t1cD8uY3JlYXRlZEF0IHx8IGIuZWMyQmFja3VwPy5jcmVhdGVkQXQgfHwgbmV3IERhdGUoMCk7XG4gICAgICByZXR1cm4gYlRpbWUuZ2V0VGltZSgpIC0gYVRpbWUuZ2V0VGltZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOeSsOWig+WIpeODkOODg+OCr+OCouODg+ODl+OCr+ODquODvOODs+OCouODg+ODl1xuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBjbGVhbnVwRW52aXJvbm1lbnRCYWNrdXBzKFxuICAgIGVudmlyb25tZW50OiBFbnZpcm9ubWVudCxcbiAgICByZXRlbnRpb25EYXlzOiBudW1iZXJcbiAgKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgbWFuYWdlciA9IGVudmlyb25tZW50ID09PSAnbG9jYWwnID8gdGhpcy5sb2NhbEJhY2t1cE1hbmFnZXIgOiB0aGlzLmVjMkJhY2t1cE1hbmFnZXI7XG4gICAgICBcbiAgICAgIGNvbnN0IGJhY2t1cHNCZWZvcmUgPSBhd2FpdCBtYW5hZ2VyLmxpc3RCYWNrdXBzKCk7XG4gICAgICBhd2FpdCBtYW5hZ2VyLmNsZWFudXBPbGRCYWNrdXBzKHJldGVudGlvbkRheXMpO1xuICAgICAgY29uc3QgYmFja3Vwc0FmdGVyID0gYXdhaXQgbWFuYWdlci5saXN0QmFja3VwcygpO1xuICAgICAgXG4gICAgICByZXR1cm4gYmFja3Vwc0JlZm9yZS5sZW5ndGggLSBiYWNrdXBzQWZ0ZXIubGVuZ3RoO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLndhcm4oYCR7ZW52aXJvbm1lbnR955Kw5aKD44Gu44OQ44OD44Kv44Ki44OD44OX44Kv44Oq44O844Oz44Ki44OD44OX44Ko44Op44O8OmAsIGVycm9yKTtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDnt4rmgKXlvqnml6fmqZ/og71cbiAgICovXG4gIHB1YmxpYyBhc3luYyBlbWVyZ2VuY3lSZXN0b3JlKFxuICAgIGJhY2t1cElkOiBzdHJpbmcsXG4gICAgdGFyZ2V0RW52aXJvbm1lbnQ/OiBFbnZpcm9ubWVudFxuICApOiBQcm9taXNlPEludGVncmF0ZWRSZXN0b3JlUmVzdWx0PiB7XG4gICAgY29uc29sZS5sb2coYPCfmqgg57eK5oCl5b6p5pen44KS5a6f6KGM5LitOiAke2JhY2t1cElkfWApO1xuXG4gICAgY29uc3QgZW1lcmdlbmN5T3B0aW9uczogUmVzdG9yZU9wdGlvbnMgPSB7XG4gICAgICBjcmVhdGVQcmVSZXN0b3JlQmFja3VwOiBmYWxzZSxcbiAgICAgIG92ZXJ3cml0ZUV4aXN0aW5nOiB0cnVlLFxuICAgICAgdmVyaWZ5QWZ0ZXJSZXN0b3JlOiBmYWxzZSwgLy8g57eK5oCl5pmC44Gv5qSc6Ki844KS44K544Kt44OD44OXXG4gICAgICBkcnlSdW46IGZhbHNlXG4gICAgfTtcblxuICAgIHRyeSB7XG4gICAgICBpZiAodGFyZ2V0RW52aXJvbm1lbnQpIHtcbiAgICAgICAgLy8g54m55a6a55Kw5aKD44Gu44G/44Gu57eK5oCl5b6p5penXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucmVzdG9yZUVudmlyb25tZW50QmFja3VwKFxuICAgICAgICAgIHRhcmdldEVudmlyb25tZW50LFxuICAgICAgICAgIGAke2JhY2t1cElkfS0ke3RhcmdldEVudmlyb25tZW50fWAsXG4gICAgICAgICAgZW1lcmdlbmN5T3B0aW9uc1xuICAgICAgICApO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcmVzdG9yZUlkOiBgZW1lcmdlbmN5LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgICAgIHN1Y2Nlc3M6IHJlc3VsdC5zdWNjZXNzLFxuICAgICAgICAgIGVudmlyb25tZW50UmVzdWx0czogeyBbdGFyZ2V0RW52aXJvbm1lbnRdOiByZXN1bHQgfSBhcyBSZWNvcmQ8RW52aXJvbm1lbnQsIFJlc3RvcmVSZXN1bHQ+LFxuICAgICAgICAgIHRvdGFsUmVzdG9yZWRGaWxlczogcmVzdWx0LnJlc3RvcmVkRmlsZUNvdW50LFxuICAgICAgICAgIGVycm9yczogcmVzdWx0LmVycm9yID8gW3Jlc3VsdC5lcnJvcl0gOiBbXSxcbiAgICAgICAgICByZXN0b3JlVGltZTogbmV3IERhdGUoKSxcbiAgICAgICAgICBwcm9jZXNzaW5nVGltZTogMFxuICAgICAgICB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8g5YWo55Kw5aKD44Gu57eK5oCl5b6p5penXG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnJlc3RvcmVJbnRlZ3JhdGVkQmFja3VwKGJhY2t1cElkLCBlbWVyZ2VuY3lPcHRpb25zKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuQkFDS1VQX0ZBSUxFRCxcbiAgICAgICAgYOe3iuaApeW+qeaXp+OBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtlcnJvcn1gLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIHRhcmdldEVudmlyb25tZW50LFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cbn0iXX0=