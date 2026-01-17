"use strict";
/**
 * 統合ファイル整理システム - 権限マネージャー
 *
 * ファイルタイプ別の権限設定機能を提供し、
 * セキュリティ要件に応じた適切な権限管理を実行します。
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
exports.PermissionManager = void 0;
const fs = __importStar(require("fs/promises"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const index_js_1 = require("../types/index.js");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * 権限マネージャー
 *
 * ファイルタイプ別の権限設定と環境別権限調整を提供します。
 */
class PermissionManager {
    sshConfig;
    permissionRules;
    constructor(sshConfig) {
        this.sshConfig = sshConfig;
        this.permissionRules = this.initializePermissionRules();
    }
    /**
     * 複数ファイルの権限を一括設定
     */
    async setPermissions(files, classifications, environment) {
        const startTime = Date.now();
        console.log(`🔒 ${environment}環境で${files.length}個のファイル権限を設定中...`);
        try {
            const results = [];
            const errorSummary = {};
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const classification = classifications[i];
                try {
                    const result = await this.setSingleFilePermission(file, classification, environment);
                    results.push(result);
                    if (!result.success && result.error) {
                        errorSummary[result.error] = (errorSummary[result.error] || 0) + 1;
                    }
                }
                catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    results.push({
                        filePath: file.path,
                        previousPermissions: 'unknown',
                        newPermissions: 'unknown',
                        success: false,
                        error: errorMsg,
                        processingTime: 0
                    });
                    errorSummary[errorMsg] = (errorSummary[errorMsg] || 0) + 1;
                }
            }
            const totalProcessingTime = Date.now() - startTime;
            const successfulUpdates = results.filter(r => r.success).length;
            const failedUpdates = results.filter(r => !r.success).length;
            console.log(`${successfulUpdates > 0 ? '✅' : '⚠️'} ${environment}権限設定完了: ${successfulUpdates}/${files.length}個成功 (${totalProcessingTime}ms)`);
            return {
                totalFiles: files.length,
                successfulUpdates,
                failedUpdates,
                skippedFiles: 0,
                totalProcessingTime,
                environment,
                results,
                errorSummary
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.PERMISSION_FAILED, `${environment}環境の権限設定に失敗しました: ${error}`, undefined, environment, error);
        }
    }
    /**
     * 単一ファイルの権限を設定
     */
    async setSingleFilePermission(file, classification, environment) {
        const startTime = Date.now();
        try {
            // 現在の権限を取得
            const previousPermissions = await this.getCurrentPermissions(file.path, environment);
            // 適切な権限を決定
            const targetPermissions = this.determineTargetPermissions(file, classification);
            // 権限が既に正しい場合はスキップ
            if (previousPermissions === targetPermissions) {
                return {
                    filePath: file.path,
                    previousPermissions,
                    newPermissions: targetPermissions,
                    success: true,
                    processingTime: Date.now() - startTime
                };
            }
            // 権限を設定
            await this.applyPermissions(file.path, targetPermissions, environment);
            // 設定後の権限を確認
            const newPermissions = await this.getCurrentPermissions(file.path, environment);
            const success = newPermissions === targetPermissions;
            if (success) {
                console.log(`🔒 権限設定完了: ${file.path} (${previousPermissions} → ${newPermissions})`);
            }
            else {
                console.warn(`⚠️ 権限設定が不完全: ${file.path} (期待値: ${targetPermissions}, 実際: ${newPermissions})`);
            }
            return {
                filePath: file.path,
                previousPermissions,
                newPermissions,
                success,
                error: success ? undefined : `権限設定が不完全: 期待値${targetPermissions}, 実際${newPermissions}`,
                processingTime: Date.now() - startTime
            };
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`❌ 権限設定エラー: ${file.path} - ${errorMsg}`);
            return {
                filePath: file.path,
                previousPermissions: 'unknown',
                newPermissions: 'unknown',
                success: false,
                error: errorMsg,
                processingTime: Date.now() - startTime
            };
        }
    }
    /**
     * 権限設定ルールを初期化
     */
    initializePermissionRules() {
        return [
            // スクリプトファイル
            {
                fileType: 'script',
                permissions: '755',
                description: '実行可能スクリプト',
                condition: (filePath) => filePath.endsWith('.sh') || filePath.endsWith('.py') || filePath.endsWith('.js')
            },
            // 機密設定ファイル
            {
                fileType: 'config',
                permissions: '600',
                description: '機密設定ファイル',
                condition: (filePath) => filePath.includes('secret') ||
                    filePath.includes('env') ||
                    filePath.includes('key') ||
                    filePath.includes('password') ||
                    filePath.includes('credential')
            },
            // 一般設定ファイル
            {
                fileType: 'config',
                permissions: '644',
                description: '一般設定ファイル'
            },
            // ドキュメントファイル
            {
                fileType: 'document',
                permissions: '644',
                description: 'ドキュメントファイル'
            },
            // テストファイル
            {
                fileType: 'test',
                permissions: '644',
                description: 'テストファイル'
            },
            // ログファイル
            {
                fileType: 'log',
                permissions: '644',
                description: 'ログファイル'
            },
            // その他のファイル
            {
                fileType: 'other',
                permissions: '644',
                description: 'その他のファイル'
            }
        ];
    }
    /**
     * 適切な権限を決定
     */
    determineTargetPermissions(file, classification) {
        // 分類結果に基づいてルールを検索
        for (const rule of this.permissionRules) {
            if (rule.fileType === classification.fileType) {
                // 条件がある場合は条件をチェック
                if (rule.condition) {
                    if (rule.condition(file.path)) {
                        return rule.permissions;
                    }
                }
                else {
                    return rule.permissions;
                }
            }
        }
        // デフォルト権限
        return '644';
    }
    /**
     * 現在の権限を取得
     */
    async getCurrentPermissions(filePath, environment) {
        try {
            if (environment === 'local') {
                const stats = await fs.stat(filePath);
                return (stats.mode & parseInt('777', 8)).toString(8);
            }
            else {
                const result = await this.executeSSHCommand(`stat -c "%a" "${filePath}"`);
                return result.stdout.trim();
            }
        }
        catch (error) {
            throw new Error(`権限取得に失敗: ${error}`);
        }
    }
    /**
     * 権限を適用
     */
    async applyPermissions(filePath, permissions, environment) {
        try {
            if (environment === 'local') {
                await fs.chmod(filePath, parseInt(permissions, 8));
            }
            else {
                await this.executeSSHCommand(`chmod ${permissions} "${filePath}"`);
            }
        }
        catch (error) {
            throw new Error(`権限設定に失敗: ${error}`);
        }
    }
    /**
     * 権限設定の検証
     */
    async validatePermissions(files, classifications, environment) {
        console.log(`🔍 ${environment}環境の権限設定を検証中...`);
        const issues = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const classification = classifications[i];
            try {
                const expectedPermissions = this.determineTargetPermissions(file, classification);
                const actualPermissions = await this.getCurrentPermissions(file.path, environment);
                if (actualPermissions !== expectedPermissions) {
                    issues.push({
                        filePath: file.path,
                        expectedPermissions,
                        actualPermissions,
                        issue: `権限が期待値と異なります`
                    });
                }
            }
            catch (error) {
                issues.push({
                    filePath: file.path,
                    expectedPermissions: 'unknown',
                    actualPermissions: 'unknown',
                    issue: `権限確認に失敗: ${error}`
                });
            }
        }
        const valid = issues.length === 0;
        if (valid) {
            console.log('✅ 権限設定検証完了: 問題なし');
        }
        else {
            console.warn(`⚠️ 権限設定検証で${issues.length}個の問題を検出`);
        }
        return { valid, issues };
    }
    /**
     * 権限修復を実行
     */
    async repairPermissions(files, classifications, environment) {
        console.log(`🔧 ${environment}環境の権限修復を実行中...`);
        // 検証を実行
        const validation = await this.validatePermissions(files, classifications, environment);
        if (validation.valid) {
            console.log('✅ 権限修復不要: 全て正常です');
            return {
                totalFiles: files.length,
                successfulUpdates: 0,
                failedUpdates: 0,
                skippedFiles: files.length,
                totalProcessingTime: 0,
                environment,
                results: [],
                errorSummary: {}
            };
        }
        // 問題のあるファイルのみ修復
        const problematicFiles = validation.issues.map(issue => files.find(f => f.path === issue.filePath)).filter(Boolean);
        const problematicClassifications = validation.issues.map(issue => classifications[files.findIndex(f => f.path === issue.filePath)]).filter(Boolean);
        return await this.setPermissions(problematicFiles, problematicClassifications, environment);
    }
    /**
     * 権限設定レポートを生成
     */
    generatePermissionReport(summary) {
        const successRate = Math.round((summary.successfulUpdates / summary.totalFiles) * 100);
        // エラー統計の整理
        const errorDetails = Object.entries(summary.errorSummary)
            .map(([error, count]) => `- ${error}: ${count}件`)
            .join('\n');
        // 権限変更の統計
        const permissionChanges = {};
        summary.results
            .filter(r => r.success && r.previousPermissions !== r.newPermissions)
            .forEach(r => {
            const change = `${r.previousPermissions} → ${r.newPermissions}`;
            permissionChanges[change] = (permissionChanges[change] || 0) + 1;
        });
        const changeDetails = Object.entries(permissionChanges)
            .map(([change, count]) => `- ${change}: ${count}件`)
            .join('\n');
        return `
# ${summary.environment.toUpperCase()}環境 権限設定レポート

## 実行サマリー
- **実行日時**: ${new Date().toLocaleString('ja-JP')}
- **環境**: ${summary.environment}
- **処理ファイル数**: ${summary.totalFiles}個
- **成功**: ${summary.successfulUpdates}個
- **失敗**: ${summary.failedUpdates}個
- **スキップ**: ${summary.skippedFiles}個
- **成功率**: ${successRate}%
- **処理時間**: ${Math.round(summary.totalProcessingTime / 1000)}秒

## 権限変更統計
${changeDetails || '- 権限変更なし'}

## エラー統計
${errorDetails || '- エラーなし'}

## パフォーマンス
- **平均処理時間**: ${Math.round(summary.totalProcessingTime / summary.totalFiles)}ms/ファイル
- **処理スループット**: ${Math.round(summary.totalFiles / (summary.totalProcessingTime / 1000))}ファイル/秒

## 権限設定ルール適用状況
${this.permissionRules.map(rule => `- **${rule.fileType}**: ${rule.permissions} (${rule.description})`).join('\n')}

## 詳細結果（失敗のみ）
${summary.results
            .filter(r => !r.success)
            .slice(0, 20)
            .map(r => `- ${r.filePath}: ${r.error}`)
            .join('\n') || '- 失敗なし'}
${summary.results.filter(r => !r.success).length > 20 ?
            `\n... 他${summary.results.filter(r => !r.success).length - 20}件` : ''}
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
    /**
     * 権限設定の統計情報を取得
     */
    getPermissionStatistics(summary) {
        // ファイルタイプ別統計（簡略化）
        const byFileType = {
            script: { total: 0, success: 0, failed: 0 },
            document: { total: 0, success: 0, failed: 0 },
            config: { total: 0, success: 0, failed: 0 },
            test: { total: 0, success: 0, failed: 0 },
            log: { total: 0, success: 0, failed: 0 },
            other: { total: 0, success: 0, failed: 0 }
        };
        // 権限別統計
        const byPermission = {};
        // 処理時間統計
        const processingTimes = summary.results.map(r => r.processingTime).sort((a, b) => a - b);
        const processingTimeStats = {
            min: processingTimes[0] || 0,
            max: processingTimes[processingTimes.length - 1] || 0,
            average: processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length || 0,
            median: processingTimes[Math.floor(processingTimes.length / 2)] || 0
        };
        // 権限別カウント
        summary.results.forEach(result => {
            if (result.success && result.newPermissions) {
                byPermission[result.newPermissions] = (byPermission[result.newPermissions] || 0) + 1;
            }
        });
        return {
            byFileType,
            byPermission,
            processingTimeStats
        };
    }
}
exports.PermissionManager = PermissionManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVybWlzc2lvbi1tYW5hZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicGVybWlzc2lvbi1tYW5hZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7R0FLRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxnREFBa0M7QUFDbEMsaURBQXFDO0FBQ3JDLCtCQUFpQztBQUNqQyxnREFPMkI7QUFHM0IsTUFBTSxTQUFTLEdBQUcsSUFBQSxnQkFBUyxFQUFDLG9CQUFJLENBQUMsQ0FBQztBQXdEbEM7Ozs7R0FJRztBQUNILE1BQWEsaUJBQWlCO0lBQ1gsU0FBUyxDQUFhO0lBQ3RCLGVBQWUsQ0FBbUI7SUFFbkQsWUFBWSxTQUFxQjtRQUMvQixJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztRQUMzQixJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxDQUFDO0lBQzFELENBQUM7SUFFRDs7T0FFRztJQUNJLEtBQUssQ0FBQyxjQUFjLENBQ3pCLEtBQWlCLEVBQ2pCLGVBQXVDLEVBQ3ZDLFdBQXdCO1FBRXhCLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUM3QixPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sV0FBVyxNQUFNLEtBQUssQ0FBQyxNQUFNLGlCQUFpQixDQUFDLENBQUM7UUFFbEUsSUFBSSxDQUFDO1lBQ0gsTUFBTSxPQUFPLEdBQXVCLEVBQUUsQ0FBQztZQUN2QyxNQUFNLFlBQVksR0FBMkIsRUFBRSxDQUFDO1lBRWhELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQ3RDLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDdEIsTUFBTSxjQUFjLEdBQUcsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUUxQyxJQUFJ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T0FBTyxJQUFJLE1BQU0sQ0FBQyxjQUFjLEVBQUUsQ0FBQztnQkFDNUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3ZGLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILE9BQU87WUFDTCxVQUFVO1lBQ1YsWUFBWTtZQUNaLG1CQUFtQjtTQUNwQixDQUFDO0lBQ0osQ0FBQztDQUNGO0FBbmZELDhDQW1mQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog57Wx5ZCI44OV44Kh44Kk44Or5pW055CG44K344K544OG44OgIC0g5qip6ZmQ44Oe44ON44O844K444Oj44O8XG4gKiBcbiAqIOODleOCoeOCpOODq+OCv+OCpOODl+WIpeOBruaoqemZkOioreWumuapn+iDveOCkuaPkOS+m+OBl+OAgVxuICog44K744Kt44Ol44Oq44OG44Kj6KaB5Lu244Gr5b+c44GY44Gf6YGp5YiH44Gq5qip6ZmQ566h55CG44KS5a6f6KGM44GX44G+44GZ44CCXG4gKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgeyBcbiAgRmlsZUluZm8sXG4gIENsYXNzaWZpY2F0aW9uUmVzdWx0LFxuICBFbnZpcm9ubWVudCxcbiAgRmlsZVR5cGUsXG4gIE9yZ2FuaXphdGlvbkVycm9yLFxuICBPcmdhbml6YXRpb25FcnJvclR5cGVcbn0gZnJvbSAnLi4vdHlwZXMvaW5kZXguanMnO1xuaW1wb3J0IHsgU1NIQ29uZmlnIH0gZnJvbSAnLi4vc2Nhbm5lcnMvZWMyLXNjYW5uZXIuanMnO1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYyk7XG5cbi8qKlxuICog5qip6ZmQ6Kit5a6a44Or44O844OrXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUGVybWlzc2lvblJ1bGUge1xuICAvKiog44OV44Kh44Kk44Or44K/44Kk44OXICovXG4gIGZpbGVUeXBlOiBGaWxlVHlwZTtcbiAgLyoqIOaoqemZkO+8iDjpgLLmlbDmloflrZfliJfvvIkgKi9cbiAgcGVybWlzc2lvbnM6IHN0cmluZztcbiAgLyoqIOiqrOaYjiAqL1xuICBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICAvKiog5p2h5Lu277yI44Kq44OX44K344On44Oz77yJICovXG4gIGNvbmRpdGlvbj86IChmaWxlUGF0aDogc3RyaW5nKSA9PiBib29sZWFuO1xufVxuXG4vKipcbiAqIOaoqemZkOioreWumue1kOaenFxuICovXG5leHBvcnQgaW50ZXJmYWNlIFBlcm1pc3Npb25SZXN1bHQge1xuICAvKiog44OV44Kh44Kk44Or44OR44K5ICovXG4gIGZpbGVQYXRoOiBzdHJpbmc7XG4gIC8qKiDoqK3lrprliY3jga7mqKnpmZAgKi9cbiAgcHJldmlvdXNQZXJtaXNzaW9uczogc3RyaW5nO1xuICAvKiog6Kit5a6a5b6M44Gu5qip6ZmQICovXG4gIG5ld1Blcm1pc3Npb25zOiBzdHJpbmc7XG4gIC8qKiDmiJDlip/jgZfjgZ/jgYvjganjgYbjgYsgKi9cbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgLyoqIOOCqOODqeODvOODoeODg+OCu+ODvOOCuCAqL1xuICBlcnJvcj86IHN0cmluZztcbiAgLyoqIOWHpueQhuaZgumWk++8iOODn+ODquenku+8iSAqL1xuICBwcm9jZXNzaW5nVGltZTogbnVtYmVyO1xufVxuXG4vKipcbiAqIOaoqemZkOioreWumuOCteODnuODquODvFxuICovXG5leHBvcnQgaW50ZXJmYWNlIFBlcm1pc3Npb25TdW1tYXJ5IHtcbiAgLyoqIOWHpueQhuOBl+OBn+ODleOCoeOCpOODq+aVsCAqL1xuICB0b3RhbEZpbGVzOiBudW1iZXI7XG4gIC8qKiDmiJDlip/jgZfjgZ/jg5XjgqHjgqTjg6vmlbAgKi9cbiAgc3VjY2Vzc2Z1bFVwZGF0ZXM6IG51bWJlcjtcbiAgLyoqIOWkseaVl+OBl+OBn+ODleOCoeOCpOODq+aVsCAqL1xuICBmYWlsZWRVcGRhdGVzOiBudW1iZXI7XG4gIC8qKiDjgrnjgq3jg4Pjg5fjgZfjgZ/jg5XjgqHjgqTjg6vmlbAgKi9cbiAgc2tpcHBlZEZpbGVzOiBudW1iZXI7XG4gIC8qKiDnt4/lh6bnkIbmmYLplpMgKi9cbiAgdG90YWxQcm9jZXNzaW5nVGltZTogbnVtYmVyO1xuICAvKiog55Kw5aKDICovXG4gIGVudmlyb25tZW50OiBFbnZpcm9ubWVudDtcbiAgLyoqIOips+e0sOe1kOaenCAqL1xuICByZXN1bHRzOiBQZXJtaXNzaW9uUmVzdWx0W107XG4gIC8qKiDjgqjjg6njg7zntbHoqIggKi9cbiAgZXJyb3JTdW1tYXJ5OiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+O1xufVxuXG4vKipcbiAqIOaoqemZkOODnuODjeODvOOCuOODo+ODvFxuICogXG4gKiDjg5XjgqHjgqTjg6vjgr/jgqTjg5fliKXjga7mqKnpmZDoqK3lrprjgajnkrDlooPliKXmqKnpmZDoqr/mlbTjgpLmj5DkvpvjgZfjgb7jgZnjgIJcbiAqL1xuZXhwb3J0IGNsYXNzIFBlcm1pc3Npb25NYW5hZ2VyIHtcbiAgcHJpdmF0ZSByZWFkb25seSBzc2hDb25maWc/OiBTU0hDb25maWc7XG4gIHByaXZhdGUgcmVhZG9ubHkgcGVybWlzc2lvblJ1bGVzOiBQZXJtaXNzaW9uUnVsZVtdO1xuXG4gIGNvbnN0cnVjdG9yKHNzaENvbmZpZz86IFNTSENvbmZpZykge1xuICAgIHRoaXMuc3NoQ29uZmlnID0gc3NoQ29uZmlnO1xuICAgIHRoaXMucGVybWlzc2lvblJ1bGVzID0gdGhpcy5pbml0aWFsaXplUGVybWlzc2lvblJ1bGVzKCk7XG4gIH1cblxuICAvKipcbiAgICog6KSH5pWw44OV44Kh44Kk44Or44Gu5qip6ZmQ44KS5LiA5ous6Kit5a6aXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgc2V0UGVybWlzc2lvbnMoXG4gICAgZmlsZXM6IEZpbGVJbmZvW10sIFxuICAgIGNsYXNzaWZpY2F0aW9uczogQ2xhc3NpZmljYXRpb25SZXN1bHRbXSwgXG4gICAgZW52aXJvbm1lbnQ6IEVudmlyb25tZW50XG4gICk6IFByb21pc2U8UGVybWlzc2lvblN1bW1hcnk+IHtcbiAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIGNvbnNvbGUubG9nKGDwn5SSICR7ZW52aXJvbm1lbnR955Kw5aKD44GnJHtmaWxlcy5sZW5ndGh95YCL44Gu44OV44Kh44Kk44Or5qip6ZmQ44KS6Kit5a6a5LitLi4uYCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0czogUGVybWlzc2lvblJlc3VsdFtdID0gW107XG4gICAgICBjb25zdCBlcnJvclN1bW1hcnk6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7fTtcblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmaWxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBmaWxlID0gZmlsZXNbaV07XG4gICAgICAgIGNvbnN0IGNsYXNzaWZpY2F0aW9uID0gY2xhc3NpZmljYXRpb25zW2ldO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5zZXRTaW5nbGVGaWxlUGVybWlzc2lvbihmaWxlLCBjbGFzc2lmaWNhdGlvbiwgZW52aXJvbm1lbnQpO1xuICAgICAgICAgIHJlc3VsdHMucHVzaChyZXN1bHQpO1xuXG4gICAgICAgICAgaWYgKCFyZXN1bHQuc3VjY2VzcyAmJiByZXN1bHQuZXJyb3IpIHtcbiAgICAgICAgICAgIGVycm9yU3VtbWFyeVtyZXN1bHQuZXJyb3JdID0gKGVycm9yU3VtbWFyeVtyZXN1bHQuZXJyb3JdIHx8IDApICsgMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgY29uc3QgZXJyb3JNc2cgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XG4gICAgICAgICAgcmVzdWx0cy5wdXNoKHtcbiAgICAgICAgICAgIGZpbGVQYXRoOiBmaWxlLnBhdGgsXG4gICAgICAgICAgICBwcmV2aW91c1Blcm1pc3Npb25zOiAndW5rbm93bicsXG4gICAgICAgICAgICBuZXdQZXJtaXNzaW9uczogJ3Vua25vd24nLFxuICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICBlcnJvcjogZXJyb3JNc2csXG4gICAgICAgICAgICBwcm9jZXNzaW5nVGltZTogMFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGVycm9yU3VtbWFyeVtlcnJvck1zZ10gPSAoZXJyb3JTdW1tYXJ5W2Vycm9yTXNnXSB8fCAwKSArIDE7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgdG90YWxQcm9jZXNzaW5nVGltZSA9IERhdGUubm93KCkgLSBzdGFydFRpbWU7XG4gICAgICBjb25zdCBzdWNjZXNzZnVsVXBkYXRlcyA9IHJlc3VsdHMuZmlsdGVyKHIgPT4gci5zdWNjZXNzKS5sZW5ndGg7XG4gICAgICBjb25zdCBmYWlsZWRVcGRhdGVzID0gcmVzdWx0cy5maWx0ZXIociA9PiAhci5zdWNjZXNzKS5sZW5ndGg7XG5cbiAgICAgIGNvbnNvbGUubG9nKGAke3N1Y2Nlc3NmdWxVcGRhdGVzID4gMCA/ICfinIUnIDogJ+KaoO+4jyd9ICR7ZW52aXJvbm1lbnR95qip6ZmQ6Kit5a6a5a6M5LqGOiAke3N1Y2Nlc3NmdWxVcGRhdGVzfS8ke2ZpbGVzLmxlbmd0aH3lgIvmiJDlip8gKCR7dG90YWxQcm9jZXNzaW5nVGltZX1tcylgKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG90YWxGaWxlczogZmlsZXMubGVuZ3RoLFxuICAgICAgICBzdWNjZXNzZnVsVXBkYXRlcyxcbiAgICAgICAgZmFpbGVkVXBkYXRlcyxcbiAgICAgICAgc2tpcHBlZEZpbGVzOiAwLFxuICAgICAgICB0b3RhbFByb2Nlc3NpbmdUaW1lLFxuICAgICAgICBlbnZpcm9ubWVudCxcbiAgICAgICAgcmVzdWx0cyxcbiAgICAgICAgZXJyb3JTdW1tYXJ5XG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5QRVJNSVNTSU9OX0ZBSUxFRCxcbiAgICAgICAgYCR7ZW52aXJvbm1lbnR955Kw5aKD44Gu5qip6ZmQ6Kit5a6a44Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yfWAsXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgZW52aXJvbm1lbnQsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDljZjkuIDjg5XjgqHjgqTjg6vjga7mqKnpmZDjgpLoqK3lrppcbiAgICovXG4gIHB1YmxpYyBhc3luYyBzZXRTaW5nbGVGaWxlUGVybWlzc2lvbihcbiAgICBmaWxlOiBGaWxlSW5mbywgXG4gICAgY2xhc3NpZmljYXRpb246IENsYXNzaWZpY2F0aW9uUmVzdWx0LCBcbiAgICBlbnZpcm9ubWVudDogRW52aXJvbm1lbnRcbiAgKTogUHJvbWlzZTxQZXJtaXNzaW9uUmVzdWx0PiB7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcblxuICAgIHRyeSB7XG4gICAgICAvLyDnj77lnKjjga7mqKnpmZDjgpLlj5blvpdcbiAgICAgIGNvbnN0IHByZXZpb3VzUGVybWlzc2lvbnMgPSBhd2FpdCB0aGlzLmdldEN1cnJlbnRQZXJtaXNzaW9ucyhmaWxlLnBhdGgsIGVudmlyb25tZW50KTtcblxuICAgICAgLy8g6YGp5YiH44Gq5qip6ZmQ44KS5rG65a6aXG4gICAgICBjb25zdCB0YXJnZXRQZXJtaXNzaW9ucyA9IHRoaXMuZGV0ZXJtaW5lVGFyZ2V0UGVybWlzc2lvbnMoZmlsZSwgY2xhc3NpZmljYXRpb24pO1xuXG4gICAgICAvLyDmqKnpmZDjgYzml6LjgavmraPjgZfjgYTloLTlkIjjga/jgrnjgq3jg4Pjg5dcbiAgICAgIGlmIChwcmV2aW91c1Blcm1pc3Npb25zID09PSB0YXJnZXRQZXJtaXNzaW9ucykge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGZpbGVQYXRoOiBmaWxlLnBhdGgsXG4gICAgICAgICAgcHJldmlvdXNQZXJtaXNzaW9ucyxcbiAgICAgICAgICBuZXdQZXJtaXNzaW9uczogdGFyZ2V0UGVybWlzc2lvbnMsXG4gICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICBwcm9jZXNzaW5nVGltZTogRGF0ZS5ub3coKSAtIHN0YXJ0VGltZVxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICAvLyDmqKnpmZDjgpLoqK3lrppcbiAgICAgIGF3YWl0IHRoaXMuYXBwbHlQZXJtaXNzaW9ucyhmaWxlLnBhdGgsIHRhcmdldFBlcm1pc3Npb25zLCBlbnZpcm9ubWVudCk7XG5cbiAgICAgIC8vIOioreWumuW+jOOBruaoqemZkOOCkueiuuiqjVxuICAgICAgY29uc3QgbmV3UGVybWlzc2lvbnMgPSBhd2FpdCB0aGlzLmdldEN1cnJlbnRQZXJtaXNzaW9ucyhmaWxlLnBhdGgsIGVudmlyb25tZW50KTtcblxuICAgICAgY29uc3Qgc3VjY2VzcyA9IG5ld1Blcm1pc3Npb25zID09PSB0YXJnZXRQZXJtaXNzaW9ucztcbiAgICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGDwn5SSIOaoqemZkOioreWumuWujOS6hjogJHtmaWxlLnBhdGh9ICgke3ByZXZpb3VzUGVybWlzc2lvbnN9IOKGkiAke25ld1Blcm1pc3Npb25zfSlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUud2Fybihg4pqg77iPIOaoqemZkOioreWumuOBjOS4jeWujOWFqDogJHtmaWxlLnBhdGh9ICjmnJ/lvoXlgKQ6ICR7dGFyZ2V0UGVybWlzc2lvbnN9LCDlrp/pmps6ICR7bmV3UGVybWlzc2lvbnN9KWApO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBmaWxlUGF0aDogZmlsZS5wYXRoLFxuICAgICAgICBwcmV2aW91c1Blcm1pc3Npb25zLFxuICAgICAgICBuZXdQZXJtaXNzaW9ucyxcbiAgICAgICAgc3VjY2VzcyxcbiAgICAgICAgZXJyb3I6IHN1Y2Nlc3MgPyB1bmRlZmluZWQgOiBg5qip6ZmQ6Kit5a6a44GM5LiN5a6M5YWoOiDmnJ/lvoXlgKQke3RhcmdldFBlcm1pc3Npb25zfSwg5a6f6ZqbJHtuZXdQZXJtaXNzaW9uc31gLFxuICAgICAgICBwcm9jZXNzaW5nVGltZTogRGF0ZS5ub3coKSAtIHN0YXJ0VGltZVxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc3QgZXJyb3JNc2cgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XG4gICAgICBjb25zb2xlLmVycm9yKGDinYwg5qip6ZmQ6Kit5a6a44Ko44Op44O8OiAke2ZpbGUucGF0aH0gLSAke2Vycm9yTXNnfWApO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBmaWxlUGF0aDogZmlsZS5wYXRoLFxuICAgICAgICBwcmV2aW91c1Blcm1pc3Npb25zOiAndW5rbm93bicsXG4gICAgICAgIG5ld1Blcm1pc3Npb25zOiAndW5rbm93bicsXG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBlcnJvcjogZXJyb3JNc2csXG4gICAgICAgIHByb2Nlc3NpbmdUaW1lOiBEYXRlLm5vdygpIC0gc3RhcnRUaW1lXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDmqKnpmZDoqK3lrprjg6vjg7zjg6vjgpLliJ3mnJ/ljJZcbiAgICovXG4gIHByaXZhdGUgaW5pdGlhbGl6ZVBlcm1pc3Npb25SdWxlcygpOiBQZXJtaXNzaW9uUnVsZVtdIHtcbiAgICByZXR1cm4gW1xuICAgICAgLy8g44K544Kv44Oq44OX44OI44OV44Kh44Kk44OrXG4gICAgICB7XG4gICAgICAgIGZpbGVUeXBlOiAnc2NyaXB0JyxcbiAgICAgICAgcGVybWlzc2lvbnM6ICc3NTUnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+Wun+ihjOWPr+iDveOCueOCr+ODquODl+ODiCcsXG4gICAgICAgIGNvbmRpdGlvbjogKGZpbGVQYXRoKSA9PiBmaWxlUGF0aC5lbmRzV2l0aCgnLnNoJykgfHwgZmlsZVBhdGguZW5kc1dpdGgoJy5weScpIHx8IGZpbGVQYXRoLmVuZHNXaXRoKCcuanMnKVxuICAgICAgfSxcbiAgICAgIFxuICAgICAgLy8g5qmf5a+G6Kit5a6a44OV44Kh44Kk44OrXG4gICAgICB7XG4gICAgICAgIGZpbGVUeXBlOiAnY29uZmlnJyxcbiAgICAgICAgcGVybWlzc2lvbnM6ICc2MDAnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+apn+WvhuioreWumuODleOCoeOCpOODqycsXG4gICAgICAgIGNvbmRpdGlvbjogKGZpbGVQYXRoKSA9PiBcbiAgICAgICAgICBmaWxlUGF0aC5pbmNsdWRlcygnc2VjcmV0JykgfHwgXG4gICAgICAgICAgZmlsZVBhdGguaW5jbHVkZXMoJ2VudicpIHx8IFxuICAgICAgICAgIGZpbGVQYXRoLmluY2x1ZGVzKCdrZXknKSB8fFxuICAgICAgICAgIGZpbGVQYXRoLmluY2x1ZGVzKCdwYXNzd29yZCcpIHx8XG4gICAgICAgICAgZmlsZVBhdGguaW5jbHVkZXMoJ2NyZWRlbnRpYWwnKVxuICAgICAgfSxcbiAgICAgIFxuICAgICAgLy8g5LiA6Iis6Kit5a6a44OV44Kh44Kk44OrXG4gICAgICB7XG4gICAgICAgIGZpbGVUeXBlOiAnY29uZmlnJyxcbiAgICAgICAgcGVybWlzc2lvbnM6ICc2NDQnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+S4gOiIrOioreWumuODleOCoeOCpOODqydcbiAgICAgIH0sXG4gICAgICBcbiAgICAgIC8vIOODieOCreODpeODoeODs+ODiOODleOCoeOCpOODq1xuICAgICAge1xuICAgICAgICBmaWxlVHlwZTogJ2RvY3VtZW50JyxcbiAgICAgICAgcGVybWlzc2lvbnM6ICc2NDQnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+ODieOCreODpeODoeODs+ODiOODleOCoeOCpOODqydcbiAgICAgIH0sXG4gICAgICBcbiAgICAgIC8vIOODhuOCueODiOODleOCoeOCpOODq1xuICAgICAge1xuICAgICAgICBmaWxlVHlwZTogJ3Rlc3QnLFxuICAgICAgICBwZXJtaXNzaW9uczogJzY0NCcsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn44OG44K544OI44OV44Kh44Kk44OrJ1xuICAgICAgfSxcbiAgICAgIFxuICAgICAgLy8g44Ot44Kw44OV44Kh44Kk44OrXG4gICAgICB7XG4gICAgICAgIGZpbGVUeXBlOiAnbG9nJyxcbiAgICAgICAgcGVybWlzc2lvbnM6ICc2NDQnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+ODreOCsOODleOCoeOCpOODqydcbiAgICAgIH0sXG4gICAgICBcbiAgICAgIC8vIOOBneOBruS7luOBruODleOCoeOCpOODq1xuICAgICAge1xuICAgICAgICBmaWxlVHlwZTogJ290aGVyJyxcbiAgICAgICAgcGVybWlzc2lvbnM6ICc2NDQnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+OBneOBruS7luOBruODleOCoeOCpOODqydcbiAgICAgIH1cbiAgICBdO1xuICB9XG5cbiAgLyoqXG4gICAqIOmBqeWIh+OBquaoqemZkOOCkuaxuuWumlxuICAgKi9cbiAgcHJpdmF0ZSBkZXRlcm1pbmVUYXJnZXRQZXJtaXNzaW9ucyhmaWxlOiBGaWxlSW5mbywgY2xhc3NpZmljYXRpb246IENsYXNzaWZpY2F0aW9uUmVzdWx0KTogc3RyaW5nIHtcbiAgICAvLyDliIbpoZ7ntZDmnpzjgavln7rjgaXjgYTjgabjg6vjg7zjg6vjgpLmpJzntKJcbiAgICBmb3IgKGNvbnN0IHJ1bGUgb2YgdGhpcy5wZXJtaXNzaW9uUnVsZXMpIHtcbiAgICAgIGlmIChydWxlLmZpbGVUeXBlID09PSBjbGFzc2lmaWNhdGlvbi5maWxlVHlwZSkge1xuICAgICAgICAvLyDmnaHku7bjgYzjgYLjgovloLTlkIjjga/mnaHku7bjgpLjg4Hjgqfjg4Pjgq9cbiAgICAgICAgaWYgKHJ1bGUuY29uZGl0aW9uKSB7XG4gICAgICAgICAgaWYgKHJ1bGUuY29uZGl0aW9uKGZpbGUucGF0aCkpIHtcbiAgICAgICAgICAgIHJldHVybiBydWxlLnBlcm1pc3Npb25zO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gcnVsZS5wZXJtaXNzaW9ucztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIOODh+ODleOCqeODq+ODiOaoqemZkFxuICAgIHJldHVybiAnNjQ0JztcbiAgfVxuXG4gIC8qKlxuICAgKiDnj77lnKjjga7mqKnpmZDjgpLlj5blvpdcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZ2V0Q3VycmVudFBlcm1pc3Npb25zKGZpbGVQYXRoOiBzdHJpbmcsIGVudmlyb25tZW50OiBFbnZpcm9ubWVudCk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgdHJ5IHtcbiAgICAgIGlmIChlbnZpcm9ubWVudCA9PT0gJ2xvY2FsJykge1xuICAgICAgICBjb25zdCBzdGF0cyA9IGF3YWl0IGZzLnN0YXQoZmlsZVBhdGgpO1xuICAgICAgICByZXR1cm4gKHN0YXRzLm1vZGUgJiBwYXJzZUludCgnNzc3JywgOCkpLnRvU3RyaW5nKDgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5leGVjdXRlU1NIQ29tbWFuZChgc3RhdCAtYyBcIiVhXCIgXCIke2ZpbGVQYXRofVwiYCk7XG4gICAgICAgIHJldHVybiByZXN1bHQuc3Rkb3V0LnRyaW0oKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGDmqKnpmZDlj5blvpfjgavlpLHmlZc6ICR7ZXJyb3J9YCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOaoqemZkOOCkumBqeeUqFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBhcHBseVBlcm1pc3Npb25zKGZpbGVQYXRoOiBzdHJpbmcsIHBlcm1pc3Npb25zOiBzdHJpbmcsIGVudmlyb25tZW50OiBFbnZpcm9ubWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICBpZiAoZW52aXJvbm1lbnQgPT09ICdsb2NhbCcpIHtcbiAgICAgICAgYXdhaXQgZnMuY2htb2QoZmlsZVBhdGgsIHBhcnNlSW50KHBlcm1pc3Npb25zLCA4KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhd2FpdCB0aGlzLmV4ZWN1dGVTU0hDb21tYW5kKGBjaG1vZCAke3Blcm1pc3Npb25zfSBcIiR7ZmlsZVBhdGh9XCJgKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGDmqKnpmZDoqK3lrprjgavlpLHmlZc6ICR7ZXJyb3J9YCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOaoqemZkOioreWumuOBruaknOiovFxuICAgKi9cbiAgcHVibGljIGFzeW5jIHZhbGlkYXRlUGVybWlzc2lvbnMoXG4gICAgZmlsZXM6IEZpbGVJbmZvW10sIFxuICAgIGNsYXNzaWZpY2F0aW9uczogQ2xhc3NpZmljYXRpb25SZXN1bHRbXSwgXG4gICAgZW52aXJvbm1lbnQ6IEVudmlyb25tZW50XG4gICk6IFByb21pc2U8e1xuICAgIHZhbGlkOiBib29sZWFuO1xuICAgIGlzc3VlczogQXJyYXk8e1xuICAgICAgZmlsZVBhdGg6IHN0cmluZztcbiAgICAgIGV4cGVjdGVkUGVybWlzc2lvbnM6IHN0cmluZztcbiAgICAgIGFjdHVhbFBlcm1pc3Npb25zOiBzdHJpbmc7XG4gICAgICBpc3N1ZTogc3RyaW5nO1xuICAgIH0+O1xuICB9PiB7XG4gICAgY29uc29sZS5sb2coYPCflI0gJHtlbnZpcm9ubWVudH3nkrDlooPjga7mqKnpmZDoqK3lrprjgpLmpJzoqLzkuK0uLi5gKTtcblxuICAgIGNvbnN0IGlzc3VlczogQXJyYXk8e1xuICAgICAgZmlsZVBhdGg6IHN0cmluZztcbiAgICAgIGV4cGVjdGVkUGVybWlzc2lvbnM6IHN0cmluZztcbiAgICAgIGFjdHVhbFBlcm1pc3Npb25zOiBzdHJpbmc7XG4gICAgICBpc3N1ZTogc3RyaW5nO1xuICAgIH0+ID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZpbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBmaWxlID0gZmlsZXNbaV07XG4gICAgICBjb25zdCBjbGFzc2lmaWNhdGlvbiA9IGNsYXNzaWZpY2F0aW9uc1tpXTtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZXhwZWN0ZWRQZXJtaXNzaW9ucyA9IHRoaXMuZGV0ZXJtaW5lVGFyZ2V0UGVybWlzc2lvbnMoZmlsZSwgY2xhc3NpZmljYXRpb24pO1xuICAgICAgICBjb25zdCBhY3R1YWxQZXJtaXNzaW9ucyA9IGF3YWl0IHRoaXMuZ2V0Q3VycmVudFBlcm1pc3Npb25zKGZpbGUucGF0aCwgZW52aXJvbm1lbnQpO1xuXG4gICAgICAgIGlmIChhY3R1YWxQZXJtaXNzaW9ucyAhPT0gZXhwZWN0ZWRQZXJtaXNzaW9ucykge1xuICAgICAgICAgIGlzc3Vlcy5wdXNoKHtcbiAgICAgICAgICAgIGZpbGVQYXRoOiBmaWxlLnBhdGgsXG4gICAgICAgICAgICBleHBlY3RlZFBlcm1pc3Npb25zLFxuICAgICAgICAgICAgYWN0dWFsUGVybWlzc2lvbnMsXG4gICAgICAgICAgICBpc3N1ZTogYOaoqemZkOOBjOacn+W+heWApOOBqOeVsOOBquOCiuOBvuOBmWBcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgaXNzdWVzLnB1c2goe1xuICAgICAgICAgIGZpbGVQYXRoOiBmaWxlLnBhdGgsXG4gICAgICAgICAgZXhwZWN0ZWRQZXJtaXNzaW9uczogJ3Vua25vd24nLFxuICAgICAgICAgIGFjdHVhbFBlcm1pc3Npb25zOiAndW5rbm93bicsXG4gICAgICAgICAgaXNzdWU6IGDmqKnpmZDnorroqo3jgavlpLHmlZc6ICR7ZXJyb3J9YFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB2YWxpZCA9IGlzc3Vlcy5sZW5ndGggPT09IDA7XG5cbiAgICBpZiAodmFsaWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfinIUg5qip6ZmQ6Kit5a6a5qSc6Ki85a6M5LqGOiDllY/poYzjgarjgZcnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS53YXJuKGDimqDvuI8g5qip6ZmQ6Kit5a6a5qSc6Ki844GnJHtpc3N1ZXMubGVuZ3RofeWAi+OBruWVj+mhjOOCkuaknOWHumApO1xuICAgIH1cblxuICAgIHJldHVybiB7IHZhbGlkLCBpc3N1ZXMgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmqKnpmZDkv67lvqnjgpLlrp/ooYxcbiAgICovXG4gIHB1YmxpYyBhc3luYyByZXBhaXJQZXJtaXNzaW9ucyhcbiAgICBmaWxlczogRmlsZUluZm9bXSwgXG4gICAgY2xhc3NpZmljYXRpb25zOiBDbGFzc2lmaWNhdGlvblJlc3VsdFtdLCBcbiAgICBlbnZpcm9ubWVudDogRW52aXJvbm1lbnRcbiAgKTogUHJvbWlzZTxQZXJtaXNzaW9uU3VtbWFyeT4ge1xuICAgIGNvbnNvbGUubG9nKGDwn5SnICR7ZW52aXJvbm1lbnR955Kw5aKD44Gu5qip6ZmQ5L+u5b6p44KS5a6f6KGM5LitLi4uYCk7XG5cbiAgICAvLyDmpJzoqLzjgpLlrp/ooYxcbiAgICBjb25zdCB2YWxpZGF0aW9uID0gYXdhaXQgdGhpcy52YWxpZGF0ZVBlcm1pc3Npb25zKGZpbGVzLCBjbGFzc2lmaWNhdGlvbnMsIGVudmlyb25tZW50KTtcblxuICAgIGlmICh2YWxpZGF0aW9uLnZhbGlkKSB7XG4gICAgICBjb25zb2xlLmxvZygn4pyFIOaoqemZkOS/ruW+qeS4jeimgTog5YWo44Gm5q2j5bi444Gn44GZJyk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3RhbEZpbGVzOiBmaWxlcy5sZW5ndGgsXG4gICAgICAgIHN1Y2Nlc3NmdWxVcGRhdGVzOiAwLFxuICAgICAgICBmYWlsZWRVcGRhdGVzOiAwLFxuICAgICAgICBza2lwcGVkRmlsZXM6IGZpbGVzLmxlbmd0aCxcbiAgICAgICAgdG90YWxQcm9jZXNzaW5nVGltZTogMCxcbiAgICAgICAgZW52aXJvbm1lbnQsXG4gICAgICAgIHJlc3VsdHM6IFtdLFxuICAgICAgICBlcnJvclN1bW1hcnk6IHt9XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIOWVj+mhjOOBruOBguOCi+ODleOCoeOCpOODq+OBruOBv+S/ruW+qVxuICAgIGNvbnN0IHByb2JsZW1hdGljRmlsZXMgPSB2YWxpZGF0aW9uLmlzc3Vlcy5tYXAoaXNzdWUgPT4gXG4gICAgICBmaWxlcy5maW5kKGYgPT4gZi5wYXRoID09PSBpc3N1ZS5maWxlUGF0aCkhXG4gICAgKS5maWx0ZXIoQm9vbGVhbik7XG5cbiAgICBjb25zdCBwcm9ibGVtYXRpY0NsYXNzaWZpY2F0aW9ucyA9IHZhbGlkYXRpb24uaXNzdWVzLm1hcChpc3N1ZSA9PiBcbiAgICAgIGNsYXNzaWZpY2F0aW9uc1tmaWxlcy5maW5kSW5kZXgoZiA9PiBmLnBhdGggPT09IGlzc3VlLmZpbGVQYXRoKV1cbiAgICApLmZpbHRlcihCb29sZWFuKTtcblxuICAgIHJldHVybiBhd2FpdCB0aGlzLnNldFBlcm1pc3Npb25zKHByb2JsZW1hdGljRmlsZXMsIHByb2JsZW1hdGljQ2xhc3NpZmljYXRpb25zLCBlbnZpcm9ubWVudCk7XG4gIH1cblxuICAvKipcbiAgICog5qip6ZmQ6Kit5a6a44Os44Od44O844OI44KS55Sf5oiQXG4gICAqL1xuICBwdWJsaWMgZ2VuZXJhdGVQZXJtaXNzaW9uUmVwb3J0KHN1bW1hcnk6IFBlcm1pc3Npb25TdW1tYXJ5KTogc3RyaW5nIHtcbiAgICBjb25zdCBzdWNjZXNzUmF0ZSA9IE1hdGgucm91bmQoKHN1bW1hcnkuc3VjY2Vzc2Z1bFVwZGF0ZXMgLyBzdW1tYXJ5LnRvdGFsRmlsZXMpICogMTAwKTtcbiAgICBcbiAgICAvLyDjgqjjg6njg7zntbHoqIjjga7mlbTnkIZcbiAgICBjb25zdCBlcnJvckRldGFpbHMgPSBPYmplY3QuZW50cmllcyhzdW1tYXJ5LmVycm9yU3VtbWFyeSlcbiAgICAgIC5tYXAoKFtlcnJvciwgY291bnRdKSA9PiBgLSAke2Vycm9yfTogJHtjb3VudH3ku7ZgKVxuICAgICAgLmpvaW4oJ1xcbicpO1xuXG4gICAgLy8g5qip6ZmQ5aSJ5pu044Gu57Wx6KiIXG4gICAgY29uc3QgcGVybWlzc2lvbkNoYW5nZXM6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7fTtcbiAgICBzdW1tYXJ5LnJlc3VsdHNcbiAgICAgIC5maWx0ZXIociA9PiByLnN1Y2Nlc3MgJiYgci5wcmV2aW91c1Blcm1pc3Npb25zICE9PSByLm5ld1Blcm1pc3Npb25zKVxuICAgICAgLmZvckVhY2gociA9PiB7XG4gICAgICAgIGNvbnN0IGNoYW5nZSA9IGAke3IucHJldmlvdXNQZXJtaXNzaW9uc30g4oaSICR7ci5uZXdQZXJtaXNzaW9uc31gO1xuICAgICAgICBwZXJtaXNzaW9uQ2hhbmdlc1tjaGFuZ2VdID0gKHBlcm1pc3Npb25DaGFuZ2VzW2NoYW5nZV0gfHwgMCkgKyAxO1xuICAgICAgfSk7XG5cbiAgICBjb25zdCBjaGFuZ2VEZXRhaWxzID0gT2JqZWN0LmVudHJpZXMocGVybWlzc2lvbkNoYW5nZXMpXG4gICAgICAubWFwKChbY2hhbmdlLCBjb3VudF0pID0+IGAtICR7Y2hhbmdlfTogJHtjb3VudH3ku7ZgKVxuICAgICAgLmpvaW4oJ1xcbicpO1xuXG4gICAgcmV0dXJuIGBcbiMgJHtzdW1tYXJ5LmVudmlyb25tZW50LnRvVXBwZXJDYXNlKCl955Kw5aKDIOaoqemZkOioreWumuODrOODneODvOODiFxuXG4jIyDlrp/ooYzjgrXjg57jg6rjg7xcbi0gKirlrp/ooYzml6XmmYIqKjogJHtuZXcgRGF0ZSgpLnRvTG9jYWxlU3RyaW5nKCdqYS1KUCcpfVxuLSAqKueSsOWigyoqOiAke3N1bW1hcnkuZW52aXJvbm1lbnR9XG4tICoq5Yem55CG44OV44Kh44Kk44Or5pWwKio6ICR7c3VtbWFyeS50b3RhbEZpbGVzfeWAi1xuLSAqKuaIkOWKnyoqOiAke3N1bW1hcnkuc3VjY2Vzc2Z1bFVwZGF0ZXN95YCLXG4tICoq5aSx5pWXKio6ICR7c3VtbWFyeS5mYWlsZWRVcGRhdGVzfeWAi1xuLSAqKuOCueOCreODg+ODlyoqOiAke3N1bW1hcnkuc2tpcHBlZEZpbGVzfeWAi1xuLSAqKuaIkOWKn+eOhyoqOiAke3N1Y2Nlc3NSYXRlfSVcbi0gKirlh6bnkIbmmYLplpMqKjogJHtNYXRoLnJvdW5kKHN1bW1hcnkudG90YWxQcm9jZXNzaW5nVGltZSAvIDEwMDApfeenklxuXG4jIyDmqKnpmZDlpInmm7TntbHoqIhcbiR7Y2hhbmdlRGV0YWlscyB8fCAnLSDmqKnpmZDlpInmm7TjgarjgZcnfVxuXG4jIyDjgqjjg6njg7zntbHoqIhcbiR7ZXJyb3JEZXRhaWxzIHx8ICctIOOCqOODqeODvOOBquOBlyd9XG5cbiMjIOODkeODleOCqeODvOODnuODs+OCuVxuLSAqKuW5s+Wdh+WHpueQhuaZgumWkyoqOiAke01hdGgucm91bmQoc3VtbWFyeS50b3RhbFByb2Nlc3NpbmdUaW1lIC8gc3VtbWFyeS50b3RhbEZpbGVzKX1tcy/jg5XjgqHjgqTjg6tcbi0gKirlh6bnkIbjgrnjg6vjg7zjg5fjg4Pjg4gqKjogJHtNYXRoLnJvdW5kKHN1bW1hcnkudG90YWxGaWxlcyAvIChzdW1tYXJ5LnRvdGFsUHJvY2Vzc2luZ1RpbWUgLyAxMDAwKSl944OV44Kh44Kk44OrL+enklxuXG4jIyDmqKnpmZDoqK3lrprjg6vjg7zjg6vpgannlKjnirbms4FcbiR7dGhpcy5wZXJtaXNzaW9uUnVsZXMubWFwKHJ1bGUgPT4gXG4gIGAtICoqJHtydWxlLmZpbGVUeXBlfSoqOiAke3J1bGUucGVybWlzc2lvbnN9ICgke3J1bGUuZGVzY3JpcHRpb259KWBcbikuam9pbignXFxuJyl9XG5cbiMjIOips+e0sOe1kOaenO+8iOWkseaVl+OBruOBv++8iVxuJHtzdW1tYXJ5LnJlc3VsdHNcbiAgLmZpbHRlcihyID0+ICFyLnN1Y2Nlc3MpXG4gIC5zbGljZSgwLCAyMClcbiAgLm1hcChyID0+IGAtICR7ci5maWxlUGF0aH06ICR7ci5lcnJvcn1gKVxuICAuam9pbignXFxuJykgfHwgJy0g5aSx5pWX44Gq44GXJ31cbiR7c3VtbWFyeS5yZXN1bHRzLmZpbHRlcihyID0+ICFyLnN1Y2Nlc3MpLmxlbmd0aCA+IDIwID8gXG4gIGBcXG4uLi4g5LuWJHtzdW1tYXJ5LnJlc3VsdHMuZmlsdGVyKHIgPT4gIXIuc3VjY2VzcykubGVuZ3RoIC0gMjB95Lu2YCA6ICcnfVxuYDtcbiAgfVxuXG4gIC8qKlxuICAgKiBTU0gg44Kz44Oe44Oz44OJ44KS5a6f6KGMXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGV4ZWN1dGVTU0hDb21tYW5kKGNvbW1hbmQ6IHN0cmluZyk6IFByb21pc2U8eyBzdGRvdXQ6IHN0cmluZzsgc3RkZXJyOiBzdHJpbmcgfT4ge1xuICAgIGlmICghdGhpcy5zc2hDb25maWcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignU1NI6Kit5a6a44GM5b+F6KaB44Gn44GZJyk7XG4gICAgfVxuXG4gICAgY29uc3Qgc3NoQ29tbWFuZCA9IGBzc2ggLWkgXCIke3RoaXMuc3NoQ29uZmlnLmtleVBhdGh9XCIgLW8gQ29ubmVjdFRpbWVvdXQ9JHt0aGlzLnNzaENvbmZpZy50aW1lb3V0ISAvIDEwMDB9IC1vIFN0cmljdEhvc3RLZXlDaGVja2luZz1ubyAtcCAke3RoaXMuc3NoQ29uZmlnLnBvcnR9ICR7dGhpcy5zc2hDb25maWcudXNlcn1AJHt0aGlzLnNzaENvbmZpZy5ob3N0fSBcIiR7Y29tbWFuZH1cImA7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGV4ZWNBc3luYyhzc2hDb21tYW5kLCB7IFxuICAgICAgICB0aW1lb3V0OiB0aGlzLnNzaENvbmZpZy50aW1lb3V0LFxuICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMTAgLy8gMTBNQlxuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgIGlmIChlcnJvci5jb2RlID09PSAnRVRJTUVET1VUJykge1xuICAgICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgICAgT3JnYW5pemF0aW9uRXJyb3JUeXBlLlNTSF9DT05ORUNUSU9OX0ZBSUxFRCxcbiAgICAgICAgICBgU1NI5o6l57aa44GM44K/44Kk44Og44Ki44Km44OI44GX44G+44GX44GfOiAke3RoaXMuc3NoQ29uZmlnLmhvc3R9YCxcbiAgICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICAgJ2VjMicsXG4gICAgICAgICAgZXJyb3JcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDmqKnpmZDoqK3lrprjga7ntbHoqIjmg4XloLHjgpLlj5blvpdcbiAgICovXG4gIHB1YmxpYyBnZXRQZXJtaXNzaW9uU3RhdGlzdGljcyhzdW1tYXJ5OiBQZXJtaXNzaW9uU3VtbWFyeSk6IHtcbiAgICBieUZpbGVUeXBlOiBSZWNvcmQ8RmlsZVR5cGUsIHsgdG90YWw6IG51bWJlcjsgc3VjY2VzczogbnVtYmVyOyBmYWlsZWQ6IG51bWJlciB9PjtcbiAgICBieVBlcm1pc3Npb246IFJlY29yZDxzdHJpbmcsIG51bWJlcj47XG4gICAgcHJvY2Vzc2luZ1RpbWVTdGF0czoge1xuICAgICAgbWluOiBudW1iZXI7XG4gICAgICBtYXg6IG51bWJlcjtcbiAgICAgIGF2ZXJhZ2U6IG51bWJlcjtcbiAgICAgIG1lZGlhbjogbnVtYmVyO1xuICAgIH07XG4gIH0ge1xuICAgIC8vIOODleOCoeOCpOODq+OCv+OCpOODl+WIpee1seioiO+8iOewoeeVpeWMlu+8iVxuICAgIGNvbnN0IGJ5RmlsZVR5cGU6IFJlY29yZDxGaWxlVHlwZSwgeyB0b3RhbDogbnVtYmVyOyBzdWNjZXNzOiBudW1iZXI7IGZhaWxlZDogbnVtYmVyIH0+ID0ge1xuICAgICAgc2NyaXB0OiB7IHRvdGFsOiAwLCBzdWNjZXNzOiAwLCBmYWlsZWQ6IDAgfSxcbiAgICAgIGRvY3VtZW50OiB7IHRvdGFsOiAwLCBzdWNjZXNzOiAwLCBmYWlsZWQ6IDAgfSxcbiAgICAgIGNvbmZpZzogeyB0b3RhbDogMCwgc3VjY2VzczogMCwgZmFpbGVkOiAwIH0sXG4gICAgICB0ZXN0OiB7IHRvdGFsOiAwLCBzdWNjZXNzOiAwLCBmYWlsZWQ6IDAgfSxcbiAgICAgIGxvZzogeyB0b3RhbDogMCwgc3VjY2VzczogMCwgZmFpbGVkOiAwIH0sXG4gICAgICBvdGhlcjogeyB0b3RhbDogMCwgc3VjY2VzczogMCwgZmFpbGVkOiAwIH1cbiAgICB9O1xuXG4gICAgLy8g5qip6ZmQ5Yil57Wx6KiIXG4gICAgY29uc3QgYnlQZXJtaXNzaW9uOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge307XG4gICAgXG4gICAgLy8g5Yem55CG5pmC6ZaT57Wx6KiIXG4gICAgY29uc3QgcHJvY2Vzc2luZ1RpbWVzID0gc3VtbWFyeS5yZXN1bHRzLm1hcChyID0+IHIucHJvY2Vzc2luZ1RpbWUpLnNvcnQoKGEsIGIpID0+IGEgLSBiKTtcbiAgICBjb25zdCBwcm9jZXNzaW5nVGltZVN0YXRzID0ge1xuICAgICAgbWluOiBwcm9jZXNzaW5nVGltZXNbMF0gfHwgMCxcbiAgICAgIG1heDogcHJvY2Vzc2luZ1RpbWVzW3Byb2Nlc3NpbmdUaW1lcy5sZW5ndGggLSAxXSB8fCAwLFxuICAgICAgYXZlcmFnZTogcHJvY2Vzc2luZ1RpbWVzLnJlZHVjZSgoc3VtLCB0aW1lKSA9PiBzdW0gKyB0aW1lLCAwKSAvIHByb2Nlc3NpbmdUaW1lcy5sZW5ndGggfHwgMCxcbiAgICAgIG1lZGlhbjogcHJvY2Vzc2luZ1RpbWVzW01hdGguZmxvb3IocHJvY2Vzc2luZ1RpbWVzLmxlbmd0aCAvIDIpXSB8fCAwXG4gICAgfTtcblxuICAgIC8vIOaoqemZkOWIpeOCq+OCpuODs+ODiFxuICAgIHN1bW1hcnkucmVzdWx0cy5mb3JFYWNoKHJlc3VsdCA9PiB7XG4gICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MgJiYgcmVzdWx0Lm5ld1Blcm1pc3Npb25zKSB7XG4gICAgICAgIGJ5UGVybWlzc2lvbltyZXN1bHQubmV3UGVybWlzc2lvbnNdID0gKGJ5UGVybWlzc2lvbltyZXN1bHQubmV3UGVybWlzc2lvbnNdIHx8IDApICsgMTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICBieUZpbGVUeXBlLFxuICAgICAgYnlQZXJtaXNzaW9uLFxuICAgICAgcHJvY2Vzc2luZ1RpbWVTdGF0c1xuICAgIH07XG4gIH1cbn0iXX0=