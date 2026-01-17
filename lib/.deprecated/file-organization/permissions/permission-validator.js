"use strict";
/**
 * 統合ファイル整理システム - 権限検証・修復機能
 *
 * ファイル権限の検証、修復、レポート生成機能を提供し、
 * セキュリティ要件の継続的な遵守を保証します。
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
exports.PermissionValidator = void 0;
const fs = __importStar(require("fs/promises"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const index_js_1 = require("../types/index.js");
const permission_manager_js_1 = require("./permission-manager.js");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * 権限検証・修復機能
 *
 * 包括的な権限検証と自動修復機能を提供します。
 */
class PermissionValidator {
    permissionManager;
    sshConfig;
    constructor(sshConfig) {
        this.sshConfig = sshConfig;
        this.permissionManager = new permission_manager_js_1.PermissionManager(sshConfig);
    }
    /**
     * 包括的権限検証を実行
     */
    async validatePermissions(files, classifications, environment) {
        const startTime = Date.now();
        console.log(`🔍 ${environment}環境で${files.length}個のファイル権限を検証中...`);
        try {
            const results = [];
            const riskLevelStats = { low: 0, medium: 0, high: 0, critical: 0 };
            const issueTypeStats = {};
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const classification = classifications[i];
                try {
                    const result = await this.validateSingleFile(file, classification, environment);
                    results.push(result);
                    // 統計更新
                    riskLevelStats[result.riskLevel]++;
                    if (result.issueType) {
                        issueTypeStats[result.issueType] = (issueTypeStats[result.issueType] || 0) + 1;
                    }
                }
                catch (error) {
                    const errorResult = {
                        filePath: file.path,
                        expectedPermissions: 'unknown',
                        actualPermissions: 'unknown',
                        isValid: false,
                        issueType: 'unknown_error',
                        issueDescription: error instanceof Error ? error.message : String(error),
                        riskLevel: 'medium',
                        recommendedAction: '手動で権限を確認してください'
                    };
                    results.push(errorResult);
                    riskLevelStats.medium++;
                    issueTypeStats.unknown_error = (issueTypeStats.unknown_error || 0) + 1;
                }
            }
            const validationTime = Date.now() - startTime;
            const validFiles = results.filter(r => r.isValid).length;
            const invalidFiles = results.filter(r => !r.isValid).length;
            console.log(`${invalidFiles === 0 ? '✅' : '⚠️'} ${environment}権限検証完了: ${validFiles}/${files.length}個有効 (${validationTime}ms)`);
            return {
                totalFiles: files.length,
                validFiles,
                invalidFiles,
                riskLevelStats,
                issueTypeStats,
                validationTime,
                environment,
                results
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.VALIDATION_FAILED, `${environment}環境の権限検証に失敗しました: ${error}`, undefined, environment, error);
        }
    }
    /**
     * 単一ファイルの権限を検証
     */
    async validateSingleFile(file, classification, environment) {
        try {
            // 期待される権限を取得
            const expectedPermissions = this.determineExpectedPermissions(file, classification);
            // 実際の権限を取得
            const actualPermissions = await this.getCurrentPermissions(file.path, environment);
            // 権限の比較
            const isValid = actualPermissions === expectedPermissions;
            if (isValid) {
                return {
                    filePath: file.path,
                    expectedPermissions,
                    actualPermissions,
                    isValid: true,
                    riskLevel: 'low',
                    recommendedAction: 'アクション不要'
                };
            }
            // 問題の分析
            const analysis = this.analyzePermissionIssue(file, expectedPermissions, actualPermissions);
            return {
                filePath: file.path,
                expectedPermissions,
                actualPermissions,
                isValid: false,
                issueType: analysis.issueType,
                issueDescription: analysis.description,
                riskLevel: analysis.riskLevel,
                recommendedAction: analysis.recommendedAction
            };
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('ENOENT')) {
                return {
                    filePath: file.path,
                    expectedPermissions: 'unknown',
                    actualPermissions: 'missing',
                    isValid: false,
                    issueType: 'missing_file',
                    issueDescription: 'ファイルが存在しません',
                    riskLevel: 'high',
                    recommendedAction: 'ファイルの存在を確認し、必要に応じて復元してください'
                };
            }
            throw error;
        }
    }
    /**
     * 権限問題を分析
     */
    analyzePermissionIssue(file, expected, actual) {
        const expectedOctal = parseInt(expected, 8);
        const actualOctal = parseInt(actual, 8);
        // セキュリティリスクの評価
        let riskLevel = 'low';
        let description = `権限が期待値と異なります (期待: ${expected}, 実際: ${actual})`;
        let recommendedAction = `権限を${expected}に変更してください`;
        // 実行権限の不適切な付与
        if ((actualOctal & 0o111) > (expectedOctal & 0o111)) {
            riskLevel = 'high';
            description += ' - 不要な実行権限が付与されています';
            recommendedAction = `セキュリティリスクのため、即座に権限を${expected}に修正してください`;
        }
        // 書き込み権限の不適切な付与
        if ((actualOctal & 0o222) > (expectedOctal & 0o222)) {
            riskLevel = riskLevel === 'high' ? 'critical' : 'high';
            description += ' - 不要な書き込み権限が付与されています';
        }
        // 他者読み取り権限の問題（機密ファイル）
        if (file.path.includes('secret') || file.path.includes('key') || file.path.includes('password')) {
            if ((actualOctal & 0o044) > 0) {
                riskLevel = 'critical';
                description += ' - 機密ファイルに他者読み取り権限があります';
                recommendedAction = `緊急: 機密ファイルの権限を600に変更してください`;
            }
        }
        // 権限が緩すぎる場合
        if (actualOctal > expectedOctal) {
            if (riskLevel === 'low')
                riskLevel = 'medium';
            description += ' - 権限が緩すぎます';
        }
        // 権限が厳しすぎる場合
        if (actualOctal < expectedOctal) {
            description += ' - 権限が厳しすぎる可能性があります';
            recommendedAction += ' (機能に影響する可能性があります)';
        }
        return {
            issueType: 'incorrect_permissions',
            description,
            riskLevel,
            recommendedAction
        };
    }
    /**
     * 修復計画を作成
     */
    createRepairPlan(validationSummary) {
        console.log('📋 権限修復計画を作成中...');
        const invalidResults = validationSummary.results.filter(r => !r.isValid);
        // 優先度別にファイルを分類
        const targetFiles = invalidResults.map(result => ({
            filePath: result.filePath,
            currentPermissions: result.actualPermissions,
            targetPermissions: result.expectedPermissions,
            priority: result.riskLevel
        }));
        // 修復順序を決定（リスクレベル順）
        const priorityOrder = ['critical', 'high', 'medium', 'low'];
        const repairOrder = targetFiles
            .sort((a, b) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority))
            .map(f => f.filePath);
        // 推定修復時間を計算
        const estimatedRepairTime = targetFiles.length * 100; // 100ms per file
        // 注意事項を生成
        const warnings = [];
        const criticalFiles = targetFiles.filter(f => f.priority === 'critical');
        if (criticalFiles.length > 0) {
            warnings.push(`${criticalFiles.length}個の重要なセキュリティ問題があります。即座に修復してください。`);
        }
        const scriptFiles = targetFiles.filter(f => f.filePath.endsWith('.sh') || f.filePath.endsWith('.py'));
        if (scriptFiles.length > 0) {
            warnings.push(`${scriptFiles.length}個のスクリプトファイルの権限を変更します。実行に影響する可能性があります。`);
        }
        if (targetFiles.length > 50) {
            warnings.push('大量のファイルを修復します。処理に時間がかかる可能性があります。');
        }
        console.log(`📋 修復計画作成完了: ${targetFiles.length}個のファイルが対象`);
        return {
            targetFiles,
            estimatedRepairTime,
            repairOrder,
            warnings
        };
    }
    /**
     * 自動修復を実行
     */
    async executeAutoRepair(validationSummary, files, classifications) {
        console.log(`🔧 ${validationSummary.environment}環境で自動修復を実行中...`);
        // 修復計画を作成
        const repairPlan = this.createRepairPlan(validationSummary);
        if (repairPlan.targetFiles.length === 0) {
            console.log('✅ 修復対象なし: 全ての権限が正常です');
            return {
                totalFiles: 0,
                successfulUpdates: 0,
                failedUpdates: 0,
                skippedFiles: 0,
                totalProcessingTime: 0,
                environment: validationSummary.environment,
                results: [],
                errorSummary: {}
            };
        }
        // 警告の表示
        if (repairPlan.warnings.length > 0) {
            console.warn('⚠️ 修復実行前の注意事項:');
            repairPlan.warnings.forEach(warning => console.warn(`   - ${warning}`));
        }
        // 修復対象のファイル情報を取得
        const repairFiles = repairPlan.targetFiles.map(target => files.find(f => f.path === target.filePath)).filter(Boolean);
        const repairClassifications = repairPlan.targetFiles.map(target => classifications[files.findIndex(f => f.path === target.filePath)]).filter(Boolean);
        // 権限修復を実行
        return await this.permissionManager.setPermissions(repairFiles, repairClassifications, validationSummary.environment);
    }
    /**
     * 継続的監視を実行
     */
    async performContinuousMonitoring(files, classifications, environment, intervalMinutes = 60) {
        console.log(`🔄 ${environment}環境で継続的権限監視を開始 (間隔: ${intervalMinutes}分)`);
        const monitoringLoop = async () => {
            try {
                const validationResult = await this.validatePermissions(files, classifications, environment);
                if (validationResult.invalidFiles > 0) {
                    console.warn(`⚠️ 権限問題を検出: ${validationResult.invalidFiles}個のファイル`);
                    // 重要な問題がある場合は自動修復
                    const criticalIssues = validationResult.results.filter(r => r.riskLevel === 'critical');
                    if (criticalIssues.length > 0) {
                        console.warn(`🚨 重要な権限問題を自動修復中: ${criticalIssues.length}個`);
                        await this.executeAutoRepair(validationResult, files, classifications);
                    }
                }
            }
            catch (error) {
                console.error(`❌ 継続的監視エラー: ${error}`);
            }
        };
        // 初回実行
        await monitoringLoop();
        // 定期実行の設定
        setInterval(monitoringLoop, intervalMinutes * 60 * 1000);
    }
    /**
     * 権限検証レポートを生成
     */
    generateValidationReport(validationSummary) {
        const validationRate = Math.round((validationSummary.validFiles / validationSummary.totalFiles) * 100);
        // リスクレベル別統計
        const riskStats = Object.entries(validationSummary.riskLevelStats)
            .map(([level, count]) => `- **${level.toUpperCase()}**: ${count}件`)
            .join('\n');
        // 問題タイプ別統計
        const issueStats = Object.entries(validationSummary.issueTypeStats)
            .map(([type, count]) => `- **${type}**: ${count}件`)
            .join('\n');
        // 重要な問題のリスト
        const criticalIssues = validationSummary.results
            .filter(r => r.riskLevel === 'critical')
            .slice(0, 10)
            .map(r => `- **${r.filePath}**: ${r.issueDescription}`)
            .join('\n');
        return `
# ${validationSummary.environment.toUpperCase()}環境 権限検証レポート

## 検証サマリー
- **検証日時**: ${new Date().toLocaleString('ja-JP')}
- **環境**: ${validationSummary.environment}
- **検証ファイル数**: ${validationSummary.totalFiles}個
- **有効**: ${validationSummary.validFiles}個
- **無効**: ${validationSummary.invalidFiles}個
- **検証率**: ${validationRate}%
- **検証時間**: ${Math.round(validationSummary.validationTime / 1000)}秒

## リスクレベル別統計
${riskStats}

## 問題タイプ別統計
${issueStats || '- 問題なし'}

## 重要な権限問題（上位10件）
${criticalIssues || '- 重要な問題なし'}

## 推奨アクション
${validationSummary.invalidFiles === 0 ?
            '- 全ての権限が適切に設定されています。継続的な監視を推奨します。' :
            `- ${validationSummary.invalidFiles}個のファイルで権限問題が検出されました。自動修復の実行を検討してください。`}

${validationSummary.riskLevelStats.critical > 0 ?
            `\n⚠️ **緊急**: ${validationSummary.riskLevelStats.critical}個の重要なセキュリティ問題があります。即座に対応してください。` : ''}

## パフォーマンス統計
- **平均検証時間**: ${Math.round(validationSummary.validationTime / validationSummary.totalFiles)}ms/ファイル
- **検証スループット**: ${Math.round(validationSummary.totalFiles / (validationSummary.validationTime / 1000))}ファイル/秒
`;
    }
    /**
     * 期待される権限を決定
     */
    determineExpectedPermissions(file, classification) {
        // PermissionManagerと同じロジックを使用
        if (classification.fileType === 'script') {
            return '755';
        }
        if (classification.fileType === 'config') {
            if (file.path.includes('secret') || file.path.includes('env') ||
                file.path.includes('key') || file.path.includes('password')) {
                return '600';
            }
            return '644';
        }
        return '644'; // デフォルト
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
exports.PermissionValidator = PermissionValidator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVybWlzc2lvbi12YWxpZGF0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJwZXJtaXNzaW9uLXZhbGlkYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7O0dBS0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsZ0RBQWtDO0FBQ2xDLGlEQUFxQztBQUNyQywrQkFBaUM7QUFFakMsZ0RBTzJCO0FBRTNCLG1FQUFpRztBQUVqRyxNQUFNLFNBQVMsR0FBRyxJQUFBLGdCQUFTLEVBQUMsb0JBQUksQ0FBQyxDQUFDO0FBaUVsQzs7OztHQUlHO0FBQ0gsTUFBYSxtQkFBbUI7SUFDYixpQkFBaUIsQ0FBb0I7SUFDckMsU0FBUyxDQUFhO0lBRXZDLFlBQVksU0FBcUI7UUFDL0IsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7UUFDM0IsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUkseUNBQWlCLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDNUQsQ0FBQztJQUVEOztPQUVHO0lBQ0ksS0FBSyxDQUFDLG1CQUFtQixDQUM5QixLQUFpQixFQUNqQixlQUF1QyxFQUN2QyxXQUF3QjtRQUV4QixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDN0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLFdBQVcsTUFBTSxLQUFLLENBQUMsTUFBTSxpQkFBaUIsQ0FBQyxDQUFDO1FBRWxFLElBQUksQ0FBQztZQUNILE1BQU0sT0FBTyxHQUF1QixFQUFFLENBQUM7WUFDdkMsTUFBTSxjQUFjLEdBQTJCLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxDQUFDO1lBQzNGLE1BQU0sY0FBYyxHQUEyQixFQUFFLENBQUM7WUFFbEQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDdEMsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN0QixNQUFNLGNBQWMsR0FBRyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRTFDLElBQUksQ0FBQztvQkFDSCxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFLFdBQVcsQ0FBQyxDQUFDO29CQUNoRixPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUVyQixPQUFPO29CQUNQLGNBQWMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztvQkFDbkMsSUFBSSxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUM7d0JBQ3JCLGNBQWMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDakYsQ0FBQztnQkFDSCxDQUFDO2dCQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7b0JBQ2YsTUFBTSxXQUFXLEdBQXFCO3dCQUNwQyxRQUFRLEVBQUUsSUFBSSxDQUFDLElBQUk7d0JBQ25CLG1CQUFtQixFQUFFLFNBQVM7d0JBQzlCLGlCQUFpQixFQUFFLFNBQVM7d0JBQzVCLE9BQU8sRUFBRSxLQUFLO3dCQUNkLFNBQVMsRUFBRSxlQUFlO3dCQUMxQixnQkFBZ0IsRUFBRSxLQUFLLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDO3dCQUN4RSxTQUFTLEVBQUUsUUFBUTt3QkFDbkIsaUJBQWlCLEVBQUUsZ0JBQWdCO3FCQUNwQyxDQUFDO29CQUNGLE9BQU8sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7b0JBQzFCLGNBQWMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztvQkFDeEIsY0FBYyxDQUFDLGFBQWEsR0FBRyxDQUFDLGNBQWMsQ0FBQyxhQUFhLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUN6RSxDQUFDO1lBQ0gsQ0FBQztZQUVELE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxTQUFTLENBQUM7WUFDOUMsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUM7WUFDekQsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQztZQUU1RCxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksV0FBVyxXQUFXLFVBQVUsSUFBSSxLQUFLLENBQUMsTUFBTSxRQUFRLGNBQWMsS0FBSyxDQUFDLENBQUM7WUFFL0gsT0FBTztnQkFDTCxVQUFVLEVBQUUsS0FBSyxDQUFDLE1BQU07Z0JBQ3hCLFVBQVU7Z0JBQ1YsWUFBWTtnQkFDWixjQUFjO2dCQUNkLGNBQWM7Z0JBQ2QsY0FBYztnQkFDZCxXQUFXO2dCQUNYLE9BQU87YUFDUixDQUFDO1FBQ0osQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixNQUFNLElBQUksNEJBQWlCLENBQ3pCLGdDQUFxQixDQUFDLGlCQUFpQixFQUN2QyxHQUFHLFdBQVcsbUJBQW1CLEtBQUssRUFBRSxFQUN4QyxTQUFTLEVBQ1QsV0FBVyxFQUNYLEtBQWMsQ0FDZixDQUFDO1FBQ0osQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNLLEtBQUssQ0FBQyxrQkFBa0IsQ0FDOUIsSUFBYyxFQUNkLGNBQW9DLEVBQ3BDLFdBQXdCO1FBRXhCLElBQUksQ0FBQztZQUNILGFBQWE7WUFDYixNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFFcEYsV0FBVztZQUNYLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztZQUVuRixRQUFRO1lBQ1IsTUFBTSxPQUFPLEdBQUcsaUJBQWlCLEtBQUssbUJBQW1CLENBQUM7WUFFMUQsSUFBSSxPQUFPLEVBQUUsQ0FBQztnQkFDWixPQUFPO29CQUNMLFFBQVEsRUFBRSxJQUFJLENBQUMsSUFBSTtvQkFDbkIsbUJBQW1CO29CQUNuQixpQkFBaUI7b0JBQ2pCLE9BQU8sRUFBRSxJQUFJO29CQUNiLFNBQVMsRUFBRSxLQUFLO29CQUNoQixpQkFBaUIsRUFBRSxTQUFTO2lCQUM3QixDQUFDO1lBQ0osQ0FBQztZQUVELFFBQVE7WUFDUixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFLGlCQUFpQixDQUFDLENBQUM7WUFFM0YsT0FBTztnQkFDTCxRQUFRLEVBQUUsSUFBSSxDQUFDLElBQUk7Z0JBQ25CLG1CQUFtQjtnQkFDbkIsaUJBQWlCO2dCQUNqQixPQUFPLEVBQUUsS0FBSztnQkFDZCxTQUFTLEVBQUUsUUFBUSxDQUFDLFNBQVM7Z0JBQzdCLGdCQUFnQixFQUFFLFFBQVEsQ0FBQyxXQUFXO2dCQUN0QyxTQUFTLEVBQUUsUUFBUSxDQUFDLFNBQVM7Z0JBQzdCLGlCQUFpQixFQUFFLFFBQVEsQ0FBQyxpQkFBaUI7YUFDOUMsQ0FBQztRQUNKLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsSUFBSSxLQUFLLFlBQVksS0FBSyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7Z0JBQy9ELE9BQU87b0JBQ0wsUUFBUSxFQUFFLElBQUksQ0FBQyxJQUFJO29CQUNuQixtQkFBbUIsRUFBRSxTQUFTO29CQUM5QixpQkFBaUIsRUFBRSxTQUFTO29CQUM1QixPQUFPLEVBQUUsS0FBSztvQkFDZCxTQUFTLEVBQUUsY0FBYztvQkFDekIsZ0JBQWdCLEVBQUUsYUFBYTtvQkFDL0IsU0FBUyxFQUFFLE1BQU07b0JBQ2pCLGlCQUFpQixFQUFFLDRCQUE0QjtpQkFDaEQsQ0FBQztZQUNKLENBQUM7WUFFRCxNQUFNLEtBQUssQ0FBQztRQUNkLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSyxzQkFBc0IsQ0FDNUIsSUFBYyxFQUNkLFFBQWdCLEVBQ2hCLE1BQWM7UUFPZCxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzVDLE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFeEMsZUFBZTtRQUNmLElBQUksU0FBUyxHQUEyQyxLQUFLLENBQUM7UUFDOUQsSUFBSSxXQUFXLEdBQUcscUJBQXFCLFFBQVEsU0FBUyxNQUFNLEdBQUcsQ0FBQztRQUNsRSxJQUFJLGlCQUFpQixHQUFHLE1BQU0sUUFBUSxXQUFXLENBQUM7UUFFbEQsY0FBYztRQUNkLElBQUksQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEdBQUcsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNwRCxTQUFTLEdBQUcsTUFBTSxDQUFDO1lBQ25CLFdBQVcsSUFBSSxxQkFBcUIsQ0FBQztZQUNyQyxpQkFBaUIsR0FBRyxzQkFBc0IsUUFBUSxXQUFXLENBQUM7UUFDaEUsQ0FBQztRQUVELGdCQUFnQjtRQUNoQixJQUFJLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsYUFBYSxHQUFHLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDcEQsU0FBUyxHQUFHLFNBQVMsS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO1lBQ3ZELFdBQVcsSUFBSSx1QkFBdUIsQ0FBQztRQUN6QyxDQUFDO1FBRUQsc0JBQXNCO1FBQ3RCLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztZQUNoRyxJQUFJLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUM5QixTQUFTLEdBQUcsVUFBVSxDQUFDO2dCQUN2QixXQUFXLElBQUkseUJBQXlCLENBQUM7Z0JBQ3pDLGlCQUFpQixHQUFHLDRCQUE0QixDQUFDO1lBQ25ELENBQUM7UUFDSCxDQUFDO1FBRUQsWUFBWTtRQUNaLElBQUksV0FBVyxHQUFHLGFBQWEsRUFBRSxDQUFDO1lBQ2hDLElBQUksU0FBUyxLQUFLLEtBQUs7Z0JBQUUsU0FBUyxHQUFHLFFBQVEsQ0FBQztZQUM5QyxXQUFXLElBQUksYUFBYSxDQUFDO1FBQy9CLENBQUM7UUFFRCxhQUFhO1FBQ2IsSUFBSSxXQUFXLEdBQUcsYUFBYSxFQUFFLENBQUM7WUFDaEMsV0FBVyxJQUFJLHFCQUFxQixDQUFDO1lBQ3JDLGlCQUFpQixJQUFJLG9CQUFvQixDQUFDO1FBQzVDLENBQUM7UUFFRCxPQUFPO1lBQ0wsU0FBUyxFQUFFLHVCQUF1QjtZQUNsQyxXQUFXO1lBQ1gsU0FBUztZQUNULGlCQUFpQjtTQUNsQixDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0ksZ0JBQWdCLENBQUMsaUJBQW9DO1FBQzFELE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUVoQyxNQUFNLGNBQWMsR0FBRyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFekUsZUFBZTtRQUNmLE1BQU0sV0FBVyxHQUFHLGNBQWMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ2hELFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUTtZQUN6QixrQkFBa0IsRUFBRSxNQUFNLENBQUMsaUJBQWlCO1lBQzVDLGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxtQkFBbUI7WUFDN0MsUUFBUSxFQUFFLE1BQU0sQ0FBQyxTQUFtRDtTQUNyRSxDQUFDLENBQUMsQ0FBQztRQUVKLG1CQUFtQjtRQUNuQixNQUFNLGFBQWEsR0FBRyxDQUFDLFVBQVUsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzVELE1BQU0sV0FBVyxHQUFHLFdBQVc7YUFDNUIsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDckYsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRXhCLFlBQVk7UUFDWixNQUFNLG1CQUFtQixHQUFHLFdBQVcsQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsaUJBQWlCO1FBRXZFLFVBQVU7UUFDVixNQUFNLFFBQVEsR0FBYSxFQUFFLENBQUM7UUFFOUIsTUFBTSxhQUFhLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLEtBQUssVUFBVSxDQUFDLENBQUM7UUFDekUsSUFBSSxhQUFhLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQzdCLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxhQUFhLENBQUMsTUFBTSxpQ0FBaUMsQ0FBQyxDQUFDO1FBQzFFLENBQUM7UUFFRCxNQUFNLFdBQVcsR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUN0RyxJQUFJLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDM0IsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLHVDQUF1QyxDQUFDLENBQUM7UUFDOUUsQ0FBQztRQUVELElBQUksV0FBVyxDQUFDLE1BQU0sR0FBRyxFQUFFLEVBQUUsQ0FBQztZQUM1QixRQUFRLENBQUMsSUFBSSxDQUFDLGtDQUFrQyxDQUFDLENBQUM7UUFDcEQsQ0FBQztRQUVELE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLFdBQVcsQ0FBQyxNQUFNLFdBQVcsQ0FBQyxDQUFDO1FBRTNELE9BQU87WUFDTCxXQUFXO1lBQ1gsbUJBQW1CO1lBQ25CLFdBQVc7WUFDWCxRQUFRO1NBQ1QsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNJLEtBQUssQ0FBQyxpQkFBaUIsQ0FDNUIsaUJBQW9DLEVBQ3BDLEtBQWlCLEVBQ2pCLGVBQXVDO1FBRXZDLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxpQkFBaUIsQ0FBQyxXQUFXLGdCQUFnQixDQUFDLENBQUM7UUFFakUsVUFBVTtRQUNWLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBRTVELElBQUksVUFBVSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDeEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1lBQ3BDLE9BQU87Z0JBQ0wsVUFBVSxFQUFFLENBQUM7Z0JBQ2IsaUJBQWlCLEVBQUUsQ0FBQztnQkFDcEIsYUFBYSxFQUFFLENBQUM7Z0JBQ2hCLFlBQVksRUFBRSxDQUFDO2dCQUNmLG1CQUFtQixFQUFFLENBQUM7Z0JBQ3RCLFdBQVcsRUFBRSxpQkFBaUIsQ0FBQyxXQUFXO2dCQUMxQyxPQUFPLEVBQUUsRUFBRTtnQkFDWCxZQUFZLEVBQUUsRUFBRTthQUNqQixDQUFDO1FBQ0osQ0FBQztRQUVELFFBQVE7UUFDUixJQUFJLFVBQVUsQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ25DLE9BQU8sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztZQUMvQixVQUFVLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUUsQ0FBQztRQUVELGlCQUFpQjtRQUNqQixNQUFNLFdBQVcsR0FBRyxVQUFVLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUN0RCxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxNQUFNLENBQUMsUUFBUSxDQUFFLENBQzdDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRWxCLE1BQU0scUJBQXFCLEdBQUcsVUFBVSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FDaEUsZUFBZSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUNsRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUVsQixVQUFVO1FBQ1YsT0FBTyxNQUFNLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxjQUFjLENBQ2hELFdBQVcsRUFDWCxxQkFBcUIsRUFDckIsaUJBQWlCLENBQUMsV0FBVyxDQUM5QixDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0ksS0FBSyxDQUFDLDJCQUEyQixDQUN0QyxLQUFpQixFQUNqQixlQUF1QyxFQUN2QyxXQUF3QixFQUN4QixrQkFBMEIsRUFBRTtRQUU1QixPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sV0FBVyxzQkFBc0IsZUFBZSxJQUFJLENBQUMsQ0FBQztRQUV4RSxNQUFNLGNBQWMsR0FBRyxLQUFLLElBQUksRUFBRTtZQUNoQyxJQUFJLENBQUM7Z0JBQ0gsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLEVBQUUsZUFBZSxFQUFFLFdBQVcsQ0FBQyxDQUFDO2dCQUU3RixJQUFJLGdCQUFnQixDQUFDLFlBQVksR0FBRyxDQUFDLEVBQUUsQ0FBQztvQkFDdEMsT0FBTyxDQUFDLElBQUksQ0FBQyxlQUFlLGdCQUFnQixDQUFDLFlBQVksUUFBUSxDQUFDLENBQUM7b0JBRW5FLGtCQUFrQjtvQkFDbEIsTUFBTSxjQUFjLEdBQUcsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLEtBQUssVUFBVSxDQUFDLENBQUM7b0JBQ3hGLElBQUksY0FBYyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQzt3QkFDOUIsT0FBTyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsY0FBYyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7d0JBQzVELE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLGdCQUFnQixFQUFFLEtBQUssRUFBRSxlQUFlLENBQUMsQ0FBQztvQkFDekUsQ0FBQztnQkFDSCxDQUFDO1lBQ0gsQ0FBQztZQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7Z0JBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxlQUFlLEtBQUssRUFBRSxDQUFDLENBQUM7WUFDeEMsQ0FBQztRQUNILENBQUMsQ0FBQztRQUVGLE9BQU87UUFDUCxNQUFNLGNBQWMsRUFBRSxDQUFDO1FBRXZCLFVBQVU7UUFDVixXQUFXLENBQUMsY0FBYyxFQUFFLGVBQWUsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUM7SUFDM0QsQ0FBQztJQUVEOztPQUVHO0lBQ0ksd0JBQXdCLENBQUMsaUJBQW9DO1FBQ2xFLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLEdBQUcsaUJBQWlCLENBQUMsVUFBVSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUM7UUFFdkcsWUFBWTtRQUNaLE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsY0FBYyxDQUFDO2FBQy9ELEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUUsQ0FBQyxPQUFPLEtBQUssQ0FBQyxXQUFXLEVBQUUsT0FBTyxLQUFLLEdBQUcsQ0FBQzthQUNsRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFZCxXQUFXO1FBQ1gsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxjQUFjLENBQUM7YUFDaEUsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRSxDQUFDLE9BQU8sSUFBSSxPQUFPLEtBQUssR0FBRyxDQUFDO2FBQ2xELElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVkLFlBQVk7UUFDWixNQUFNLGNBQWMsR0FBRyxpQkFBaUIsQ0FBQyxPQUFPO2FBQzdDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLEtBQUssVUFBVSxDQUFDO2FBQ3ZDLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDO2FBQ1osR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxPQUFPLENBQUMsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO2FBQ3RELElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVkLE9BQU87SUFDUCxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsV0FBVyxFQUFFOzs7Y0FHakMsSUFBSSxJQUFJLEVBQUUsQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDO1lBQ3BDLGlCQUFpQixDQUFDLFdBQVc7aUJBQ3hCLGlCQUFpQixDQUFDLFVBQVU7WUFDakMsaUJBQWlCLENBQUMsVUFBVTtZQUM1QixpQkFBaUIsQ0FBQyxZQUFZO2FBQzdCLGNBQWM7Y0FDYixJQUFJLENBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7OztFQUcvRCxTQUFTOzs7RUFHVCxVQUFVLElBQUksUUFBUTs7O0VBR3RCLGNBQWMsSUFBSSxXQUFXOzs7RUFHN0IsaUJBQWlCLENBQUMsWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ3RDLG1DQUFtQyxDQUFDLENBQUM7WUFDckMsS0FBSyxpQkFBaUIsQ0FBQyxZQUFZLHVDQUNyQzs7RUFFRSxpQkFBaUIsQ0FBQyxjQUFjLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQy9DLGdCQUFnQixpQkFBaUIsQ0FBQyxjQUFjLENBQUMsUUFBUSxpQ0FBaUMsQ0FBQyxDQUFDLENBQUMsRUFDL0Y7OztnQkFHZ0IsSUFBSSxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxjQUFjLEdBQUcsaUJBQWlCLENBQUMsVUFBVSxDQUFDO2tCQUN6RSxJQUFJLENBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLFVBQVUsR0FBRyxDQUFDLGlCQUFpQixDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsQ0FBQztDQUNyRyxDQUFDO0lBQ0EsQ0FBQztJQUVEOztPQUVHO0lBQ0ssNEJBQTRCLENBQUMsSUFBYyxFQUFFLGNBQW9DO1FBQ3ZGLDhCQUE4QjtRQUM5QixJQUFJLGNBQWMsQ0FBQyxRQUFRLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDekMsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO1FBRUQsSUFBSSxjQUFjLENBQUMsUUFBUSxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQ3pDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDO2dCQUN6RCxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO2dCQUNoRSxPQUFPLEtBQUssQ0FBQztZQUNmLENBQUM7WUFDRCxPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFFRCxPQUFPLEtBQUssQ0FBQyxDQUFDLFFBQVE7SUFDeEIsQ0FBQztJQUVEOztPQUVHO0lBQ0ssS0FBSyxDQUFDLHFCQUFxQixDQUFDLFFBQWdCLEVBQUUsV0FBd0I7UUFDNUUsSUFBSSxDQUFDO1lBQ0gsSUFBSSxXQUFXLEtBQUssT0FBTyxFQUFFLENBQUM7Z0JBQzVCLE1BQU0sS0FBSyxHQUFHLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDdEMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN2RCxDQUFDO2lCQUFNLENBQUM7Z0JBQ04sTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsaUJBQWlCLENBQUMsaUJBQWlCLFFBQVEsR0FBRyxDQUFDLENBQUM7Z0JBQzFFLE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUM5QixDQUFDO1FBQ0gsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixNQUFNLElBQUksS0FBSyxDQUFDLFlBQVksS0FBSyxFQUFFLENBQUMsQ0FBQztRQUN2QyxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0ssS0FBSyxDQUFDLGlCQUFpQixDQUFDLE9BQWU7UUFDN0MsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNwQixNQUFNLElBQUksS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ2hDLENBQUM7UUFFRCxNQUFNLFVBQVUsR0FBRyxXQUFXLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyx1QkFBdUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFRLEdBQUcsSUFBSSxtQ0FBbUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEtBQUssT0FBTyxHQUFHLENBQUM7UUFFN04sSUFBSSxDQUFDO1lBQ0gsTUFBTSxNQUFNLEdBQUcsTUFBTSxTQUFTLENBQUMsVUFBVSxFQUFFO2dCQUN6QyxPQUFPLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPO2dCQUMvQixTQUFTLEVBQUUsSUFBSSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUMsT0FBTzthQUNwQyxDQUFDLENBQUM7WUFDSCxPQUFPLE1BQU0sQ0FBQztRQUNoQixDQUFDO1FBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztZQUNwQixJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssV0FBVyxFQUFFLENBQUM7Z0JBQy9CLE1BQU0sSUFBSSw0QkFBaUIsQ0FDekIsZ0NBQXFCLENBQUMscUJBQXFCLEVBQzNDLHFCQUFxQixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxFQUMxQyxTQUFTLEVBQ1QsS0FBSyxFQUNMLEtBQUssQ0FDTixDQUFDO1lBQ0osQ0FBQztZQUNELE1BQU0sS0FBSyxDQUFDO1FBQ2QsQ0FBQztJQUNILENBQUM7Q0FDRjtBQXRkRCxrREFzZEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOe1seWQiOODleOCoeOCpOODq+aVtOeQhuOCt+OCueODhuODoCAtIOaoqemZkOaknOiovOODu+S/ruW+qeapn+iDvVxuICogXG4gKiDjg5XjgqHjgqTjg6vmqKnpmZDjga7mpJzoqLzjgIHkv67lvqnjgIHjg6zjg53jg7zjg4jnlJ/miJDmqZ/og73jgpLmj5DkvpvjgZfjgIFcbiAqIOOCu+OCreODpeODquODhuOCo+imgeS7tuOBrue2mee2mueahOOBqumBteWuiOOCkuS/neiovOOBl+OBvuOBmeOAglxuICovXG5cbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzL3Byb21pc2VzJztcbmltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IFxuICBGaWxlSW5mbyxcbiAgQ2xhc3NpZmljYXRpb25SZXN1bHQsXG4gIEVudmlyb25tZW50LFxuICBGaWxlVHlwZSxcbiAgT3JnYW5pemF0aW9uRXJyb3IsXG4gIE9yZ2FuaXphdGlvbkVycm9yVHlwZVxufSBmcm9tICcuLi90eXBlcy9pbmRleC5qcyc7XG5pbXBvcnQgeyBTU0hDb25maWcgfSBmcm9tICcuLi9zY2FubmVycy9lYzItc2Nhbm5lci5qcyc7XG5pbXBvcnQgeyBQZXJtaXNzaW9uTWFuYWdlciwgUGVybWlzc2lvblJlc3VsdCwgUGVybWlzc2lvblN1bW1hcnkgfSBmcm9tICcuL3Blcm1pc3Npb24tbWFuYWdlci5qcyc7XG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKTtcblxuLyoqXG4gKiDmqKnpmZDmpJzoqLzntZDmnpxcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBWYWxpZGF0aW9uUmVzdWx0IHtcbiAgLyoqIOODleOCoeOCpOODq+ODkeOCuSAqL1xuICBmaWxlUGF0aDogc3RyaW5nO1xuICAvKiog5pyf5b6F44GV44KM44KL5qip6ZmQICovXG4gIGV4cGVjdGVkUGVybWlzc2lvbnM6IHN0cmluZztcbiAgLyoqIOWun+mam+OBruaoqemZkCAqL1xuICBhY3R1YWxQZXJtaXNzaW9uczogc3RyaW5nO1xuICAvKiog5qSc6Ki857WQ5p6cICovXG4gIGlzVmFsaWQ6IGJvb2xlYW47XG4gIC8qKiDllY/poYzjga7nqK7poZ4gKi9cbiAgaXNzdWVUeXBlPzogJ2luY29ycmVjdF9wZXJtaXNzaW9ucycgfCAnbWlzc2luZ19maWxlJyB8ICdhY2Nlc3NfZGVuaWVkJyB8ICd1bmtub3duX2Vycm9yJztcbiAgLyoqIOWVj+mhjOOBruips+e0sCAqL1xuICBpc3N1ZURlc2NyaXB0aW9uPzogc3RyaW5nO1xuICAvKiog44K744Kt44Ol44Oq44OG44Kj44Oq44K544Kv44Os44OZ44OrICovXG4gIHJpc2tMZXZlbDogJ2xvdycgfCAnbWVkaXVtJyB8ICdoaWdoJyB8ICdjcml0aWNhbCc7XG4gIC8qKiDmjqjlpajjgqLjgq/jgrfjg6fjg7MgKi9cbiAgcmVjb21tZW5kZWRBY3Rpb246IHN0cmluZztcbn1cblxuLyoqXG4gKiDmpJzoqLzjgrXjg57jg6rjg7xcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBWYWxpZGF0aW9uU3VtbWFyeSB7XG4gIC8qKiDmpJzoqLzjgZfjgZ/jg5XjgqHjgqTjg6vmlbAgKi9cbiAgdG90YWxGaWxlczogbnVtYmVyO1xuICAvKiog5pyJ5Yq544Gq44OV44Kh44Kk44Or5pWwICovXG4gIHZhbGlkRmlsZXM6IG51bWJlcjtcbiAgLyoqIOeEoeWKueOBquODleOCoeOCpOODq+aVsCAqL1xuICBpbnZhbGlkRmlsZXM6IG51bWJlcjtcbiAgLyoqIOODquOCueOCr+ODrOODmeODq+WIpee1seioiCAqL1xuICByaXNrTGV2ZWxTdGF0czogUmVjb3JkPHN0cmluZywgbnVtYmVyPjtcbiAgLyoqIOWVj+mhjOOCv+OCpOODl+WIpee1seioiCAqL1xuICBpc3N1ZVR5cGVTdGF0czogUmVjb3JkPHN0cmluZywgbnVtYmVyPjtcbiAgLyoqIOaknOiovOaZgumWkyAqL1xuICB2YWxpZGF0aW9uVGltZTogbnVtYmVyO1xuICAvKiog55Kw5aKDICovXG4gIGVudmlyb25tZW50OiBFbnZpcm9ubWVudDtcbiAgLyoqIOips+e0sOe1kOaenCAqL1xuICByZXN1bHRzOiBWYWxpZGF0aW9uUmVzdWx0W107XG59XG5cbi8qKlxuICog5L+u5b6p6KiI55S7XG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUmVwYWlyUGxhbiB7XG4gIC8qKiDkv67lvqnlr77osaHjg5XjgqHjgqTjg6sgKi9cbiAgdGFyZ2V0RmlsZXM6IEFycmF5PHtcbiAgICBmaWxlUGF0aDogc3RyaW5nO1xuICAgIGN1cnJlbnRQZXJtaXNzaW9uczogc3RyaW5nO1xuICAgIHRhcmdldFBlcm1pc3Npb25zOiBzdHJpbmc7XG4gICAgcHJpb3JpdHk6ICdsb3cnIHwgJ21lZGl1bScgfCAnaGlnaCcgfCAnY3JpdGljYWwnO1xuICB9PjtcbiAgLyoqIOaOqOWumuS/ruW+qeaZgumWkyAqL1xuICBlc3RpbWF0ZWRSZXBhaXJUaW1lOiBudW1iZXI7XG4gIC8qKiDkv67lvqnpoIbluo8gKi9cbiAgcmVwYWlyT3JkZXI6IHN0cmluZ1tdO1xuICAvKiog5rOo5oSP5LqL6aCFICovXG4gIHdhcm5pbmdzOiBzdHJpbmdbXTtcbn1cblxuLyoqXG4gKiDmqKnpmZDmpJzoqLzjg7vkv67lvqnmqZ/og71cbiAqIFxuICog5YyF5ous55qE44Gq5qip6ZmQ5qSc6Ki844Go6Ieq5YuV5L+u5b6p5qmf6IO944KS5o+Q5L6b44GX44G+44GZ44CCXG4gKi9cbmV4cG9ydCBjbGFzcyBQZXJtaXNzaW9uVmFsaWRhdG9yIHtcbiAgcHJpdmF0ZSByZWFkb25seSBwZXJtaXNzaW9uTWFuYWdlcjogUGVybWlzc2lvbk1hbmFnZXI7XG4gIHByaXZhdGUgcmVhZG9ubHkgc3NoQ29uZmlnPzogU1NIQ29uZmlnO1xuXG4gIGNvbnN0cnVjdG9yKHNzaENvbmZpZz86IFNTSENvbmZpZykge1xuICAgIHRoaXMuc3NoQ29uZmlnID0gc3NoQ29uZmlnO1xuICAgIHRoaXMucGVybWlzc2lvbk1hbmFnZXIgPSBuZXcgUGVybWlzc2lvbk1hbmFnZXIoc3NoQ29uZmlnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDljIXmi6znmoTmqKnpmZDmpJzoqLzjgpLlrp/ooYxcbiAgICovXG4gIHB1YmxpYyBhc3luYyB2YWxpZGF0ZVBlcm1pc3Npb25zKFxuICAgIGZpbGVzOiBGaWxlSW5mb1tdLCBcbiAgICBjbGFzc2lmaWNhdGlvbnM6IENsYXNzaWZpY2F0aW9uUmVzdWx0W10sIFxuICAgIGVudmlyb25tZW50OiBFbnZpcm9ubWVudFxuICApOiBQcm9taXNlPFZhbGlkYXRpb25TdW1tYXJ5PiB7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICBjb25zb2xlLmxvZyhg8J+UjSAke2Vudmlyb25tZW50feeSsOWig+OBpyR7ZmlsZXMubGVuZ3RofeWAi+OBruODleOCoeOCpOODq+aoqemZkOOCkuaknOiovOS4rS4uLmApO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdHM6IFZhbGlkYXRpb25SZXN1bHRbXSA9IFtdO1xuICAgICAgY29uc3Qgcmlza0xldmVsU3RhdHM6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7IGxvdzogMCwgbWVkaXVtOiAwLCBoaWdoOiAwLCBjcml0aWNhbDogMCB9O1xuICAgICAgY29uc3QgaXNzdWVUeXBlU3RhdHM6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7fTtcblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmaWxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBmaWxlID0gZmlsZXNbaV07XG4gICAgICAgIGNvbnN0IGNsYXNzaWZpY2F0aW9uID0gY2xhc3NpZmljYXRpb25zW2ldO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy52YWxpZGF0ZVNpbmdsZUZpbGUoZmlsZSwgY2xhc3NpZmljYXRpb24sIGVudmlyb25tZW50KTtcbiAgICAgICAgICByZXN1bHRzLnB1c2gocmVzdWx0KTtcblxuICAgICAgICAgIC8vIOe1seioiOabtOaWsFxuICAgICAgICAgIHJpc2tMZXZlbFN0YXRzW3Jlc3VsdC5yaXNrTGV2ZWxdKys7XG4gICAgICAgICAgaWYgKHJlc3VsdC5pc3N1ZVR5cGUpIHtcbiAgICAgICAgICAgIGlzc3VlVHlwZVN0YXRzW3Jlc3VsdC5pc3N1ZVR5cGVdID0gKGlzc3VlVHlwZVN0YXRzW3Jlc3VsdC5pc3N1ZVR5cGVdIHx8IDApICsgMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgY29uc3QgZXJyb3JSZXN1bHQ6IFZhbGlkYXRpb25SZXN1bHQgPSB7XG4gICAgICAgICAgICBmaWxlUGF0aDogZmlsZS5wYXRoLFxuICAgICAgICAgICAgZXhwZWN0ZWRQZXJtaXNzaW9uczogJ3Vua25vd24nLFxuICAgICAgICAgICAgYWN0dWFsUGVybWlzc2lvbnM6ICd1bmtub3duJyxcbiAgICAgICAgICAgIGlzVmFsaWQ6IGZhbHNlLFxuICAgICAgICAgICAgaXNzdWVUeXBlOiAndW5rbm93bl9lcnJvcicsXG4gICAgICAgICAgICBpc3N1ZURlc2NyaXB0aW9uOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICAgICAgICByaXNrTGV2ZWw6ICdtZWRpdW0nLFxuICAgICAgICAgICAgcmVjb21tZW5kZWRBY3Rpb246ICfmiYvli5XjgafmqKnpmZDjgpLnorroqo3jgZfjgabjgY/jgaDjgZXjgYQnXG4gICAgICAgICAgfTtcbiAgICAgICAgICByZXN1bHRzLnB1c2goZXJyb3JSZXN1bHQpO1xuICAgICAgICAgIHJpc2tMZXZlbFN0YXRzLm1lZGl1bSsrO1xuICAgICAgICAgIGlzc3VlVHlwZVN0YXRzLnVua25vd25fZXJyb3IgPSAoaXNzdWVUeXBlU3RhdHMudW5rbm93bl9lcnJvciB8fCAwKSArIDE7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgdmFsaWRhdGlvblRpbWUgPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgY29uc3QgdmFsaWRGaWxlcyA9IHJlc3VsdHMuZmlsdGVyKHIgPT4gci5pc1ZhbGlkKS5sZW5ndGg7XG4gICAgICBjb25zdCBpbnZhbGlkRmlsZXMgPSByZXN1bHRzLmZpbHRlcihyID0+ICFyLmlzVmFsaWQpLmxlbmd0aDtcblxuICAgICAgY29uc29sZS5sb2coYCR7aW52YWxpZEZpbGVzID09PSAwID8gJ+KchScgOiAn4pqg77iPJ30gJHtlbnZpcm9ubWVudH3mqKnpmZDmpJzoqLzlrozkuoY6ICR7dmFsaWRGaWxlc30vJHtmaWxlcy5sZW5ndGh95YCL5pyJ5Yq5ICgke3ZhbGlkYXRpb25UaW1lfW1zKWApO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3RhbEZpbGVzOiBmaWxlcy5sZW5ndGgsXG4gICAgICAgIHZhbGlkRmlsZXMsXG4gICAgICAgIGludmFsaWRGaWxlcyxcbiAgICAgICAgcmlza0xldmVsU3RhdHMsXG4gICAgICAgIGlzc3VlVHlwZVN0YXRzLFxuICAgICAgICB2YWxpZGF0aW9uVGltZSxcbiAgICAgICAgZW52aXJvbm1lbnQsXG4gICAgICAgIHJlc3VsdHNcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgT3JnYW5pemF0aW9uRXJyb3JUeXBlLlZBTElEQVRJT05fRkFJTEVELFxuICAgICAgICBgJHtlbnZpcm9ubWVudH3nkrDlooPjga7mqKnpmZDmpJzoqLzjgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3J9YCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICBlbnZpcm9ubWVudCxcbiAgICAgICAgZXJyb3IgYXMgRXJyb3JcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOWNmOS4gOODleOCoeOCpOODq+OBruaoqemZkOOCkuaknOiovFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyB2YWxpZGF0ZVNpbmdsZUZpbGUoXG4gICAgZmlsZTogRmlsZUluZm8sIFxuICAgIGNsYXNzaWZpY2F0aW9uOiBDbGFzc2lmaWNhdGlvblJlc3VsdCwgXG4gICAgZW52aXJvbm1lbnQ6IEVudmlyb25tZW50XG4gICk6IFByb21pc2U8VmFsaWRhdGlvblJlc3VsdD4ge1xuICAgIHRyeSB7XG4gICAgICAvLyDmnJ/lvoXjgZXjgozjgovmqKnpmZDjgpLlj5blvpdcbiAgICAgIGNvbnN0IGV4cGVjdGVkUGVybWlzc2lvbnMgPSB0aGlzLmRldGVybWluZUV4cGVjdGVkUGVybWlzc2lvbnMoZmlsZSwgY2xhc3NpZmljYXRpb24pO1xuICAgICAgXG4gICAgICAvLyDlrp/pmpvjga7mqKnpmZDjgpLlj5blvpdcbiAgICAgIGNvbnN0IGFjdHVhbFBlcm1pc3Npb25zID0gYXdhaXQgdGhpcy5nZXRDdXJyZW50UGVybWlzc2lvbnMoZmlsZS5wYXRoLCBlbnZpcm9ubWVudCk7XG4gICAgICBcbiAgICAgIC8vIOaoqemZkOOBruavlOi8g1xuICAgICAgY29uc3QgaXNWYWxpZCA9IGFjdHVhbFBlcm1pc3Npb25zID09PSBleHBlY3RlZFBlcm1pc3Npb25zO1xuICAgICAgXG4gICAgICBpZiAoaXNWYWxpZCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGZpbGVQYXRoOiBmaWxlLnBhdGgsXG4gICAgICAgICAgZXhwZWN0ZWRQZXJtaXNzaW9ucyxcbiAgICAgICAgICBhY3R1YWxQZXJtaXNzaW9ucyxcbiAgICAgICAgICBpc1ZhbGlkOiB0cnVlLFxuICAgICAgICAgIHJpc2tMZXZlbDogJ2xvdycsXG4gICAgICAgICAgcmVjb21tZW5kZWRBY3Rpb246ICfjgqLjgq/jgrfjg6fjg7PkuI3opoEnXG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIC8vIOWVj+mhjOOBruWIhuaekFxuICAgICAgY29uc3QgYW5hbHlzaXMgPSB0aGlzLmFuYWx5emVQZXJtaXNzaW9uSXNzdWUoZmlsZSwgZXhwZWN0ZWRQZXJtaXNzaW9ucywgYWN0dWFsUGVybWlzc2lvbnMpO1xuICAgICAgXG4gICAgICByZXR1cm4ge1xuICAgICAgICBmaWxlUGF0aDogZmlsZS5wYXRoLFxuICAgICAgICBleHBlY3RlZFBlcm1pc3Npb25zLFxuICAgICAgICBhY3R1YWxQZXJtaXNzaW9ucyxcbiAgICAgICAgaXNWYWxpZDogZmFsc2UsXG4gICAgICAgIGlzc3VlVHlwZTogYW5hbHlzaXMuaXNzdWVUeXBlLFxuICAgICAgICBpc3N1ZURlc2NyaXB0aW9uOiBhbmFseXNpcy5kZXNjcmlwdGlvbixcbiAgICAgICAgcmlza0xldmVsOiBhbmFseXNpcy5yaXNrTGV2ZWwsXG4gICAgICAgIHJlY29tbWVuZGVkQWN0aW9uOiBhbmFseXNpcy5yZWNvbW1lbmRlZEFjdGlvblxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgJiYgZXJyb3IubWVzc2FnZS5pbmNsdWRlcygnRU5PRU5UJykpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBmaWxlUGF0aDogZmlsZS5wYXRoLFxuICAgICAgICAgIGV4cGVjdGVkUGVybWlzc2lvbnM6ICd1bmtub3duJyxcbiAgICAgICAgICBhY3R1YWxQZXJtaXNzaW9uczogJ21pc3NpbmcnLFxuICAgICAgICAgIGlzVmFsaWQ6IGZhbHNlLFxuICAgICAgICAgIGlzc3VlVHlwZTogJ21pc3NpbmdfZmlsZScsXG4gICAgICAgICAgaXNzdWVEZXNjcmlwdGlvbjogJ+ODleOCoeOCpOODq+OBjOWtmOWcqOOBl+OBvuOBm+OCkycsXG4gICAgICAgICAgcmlza0xldmVsOiAnaGlnaCcsXG4gICAgICAgICAgcmVjb21tZW5kZWRBY3Rpb246ICfjg5XjgqHjgqTjg6vjga7lrZjlnKjjgpLnorroqo3jgZfjgIHlv4XopoHjgavlv5zjgZjjgablvqnlhYPjgZfjgabjgY/jgaDjgZXjgYQnXG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDmqKnpmZDllY/poYzjgpLliIbmnpBcbiAgICovXG4gIHByaXZhdGUgYW5hbHl6ZVBlcm1pc3Npb25Jc3N1ZShcbiAgICBmaWxlOiBGaWxlSW5mbywgXG4gICAgZXhwZWN0ZWQ6IHN0cmluZywgXG4gICAgYWN0dWFsOiBzdHJpbmdcbiAgKToge1xuICAgIGlzc3VlVHlwZTogJ2luY29ycmVjdF9wZXJtaXNzaW9ucyc7XG4gICAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgICByaXNrTGV2ZWw6ICdsb3cnIHwgJ21lZGl1bScgfCAnaGlnaCcgfCAnY3JpdGljYWwnO1xuICAgIHJlY29tbWVuZGVkQWN0aW9uOiBzdHJpbmc7XG4gIH0ge1xuICAgIGNvbnN0IGV4cGVjdGVkT2N0YWwgPSBwYXJzZUludChleHBlY3RlZCwgOCk7XG4gICAgY29uc3QgYWN0dWFsT2N0YWwgPSBwYXJzZUludChhY3R1YWwsIDgpO1xuXG4gICAgLy8g44K744Kt44Ol44Oq44OG44Kj44Oq44K544Kv44Gu6KmV5L6hXG4gICAgbGV0IHJpc2tMZXZlbDogJ2xvdycgfCAnbWVkaXVtJyB8ICdoaWdoJyB8ICdjcml0aWNhbCcgPSAnbG93JztcbiAgICBsZXQgZGVzY3JpcHRpb24gPSBg5qip6ZmQ44GM5pyf5b6F5YCk44Go55Ww44Gq44KK44G+44GZICjmnJ/lvoU6ICR7ZXhwZWN0ZWR9LCDlrp/pmps6ICR7YWN0dWFsfSlgO1xuICAgIGxldCByZWNvbW1lbmRlZEFjdGlvbiA9IGDmqKnpmZDjgpIke2V4cGVjdGVkfeOBq+WkieabtOOBl+OBpuOBj+OBoOOBleOBhGA7XG5cbiAgICAvLyDlrp/ooYzmqKnpmZDjga7kuI3pganliIfjgarku5jkuI5cbiAgICBpZiAoKGFjdHVhbE9jdGFsICYgMG8xMTEpID4gKGV4cGVjdGVkT2N0YWwgJiAwbzExMSkpIHtcbiAgICAgIHJpc2tMZXZlbCA9ICdoaWdoJztcbiAgICAgIGRlc2NyaXB0aW9uICs9ICcgLSDkuI3opoHjgarlrp/ooYzmqKnpmZDjgYzku5jkuI7jgZXjgozjgabjgYTjgb7jgZknO1xuICAgICAgcmVjb21tZW5kZWRBY3Rpb24gPSBg44K744Kt44Ol44Oq44OG44Kj44Oq44K544Kv44Gu44Gf44KB44CB5Y2z5bqn44Gr5qip6ZmQ44KSJHtleHBlY3RlZH3jgavkv67mraPjgZfjgabjgY/jgaDjgZXjgYRgO1xuICAgIH1cblxuICAgIC8vIOabuOOBjei+vOOBv+aoqemZkOOBruS4jemBqeWIh+OBquS7mOS4jlxuICAgIGlmICgoYWN0dWFsT2N0YWwgJiAwbzIyMikgPiAoZXhwZWN0ZWRPY3RhbCAmIDBvMjIyKSkge1xuICAgICAgcmlza0xldmVsID0gcmlza0xldmVsID09PSAnaGlnaCcgPyAnY3JpdGljYWwnIDogJ2hpZ2gnO1xuICAgICAgZGVzY3JpcHRpb24gKz0gJyAtIOS4jeimgeOBquabuOOBjei+vOOBv+aoqemZkOOBjOS7mOS4juOBleOCjOOBpuOBhOOBvuOBmSc7XG4gICAgfVxuXG4gICAgLy8g5LuW6ICF6Kqt44G/5Y+W44KK5qip6ZmQ44Gu5ZWP6aGM77yI5qmf5a+G44OV44Kh44Kk44Or77yJXG4gICAgaWYgKGZpbGUucGF0aC5pbmNsdWRlcygnc2VjcmV0JykgfHwgZmlsZS5wYXRoLmluY2x1ZGVzKCdrZXknKSB8fCBmaWxlLnBhdGguaW5jbHVkZXMoJ3Bhc3N3b3JkJykpIHtcbiAgICAgIGlmICgoYWN0dWFsT2N0YWwgJiAwbzA0NCkgPiAwKSB7XG4gICAgICAgIHJpc2tMZXZlbCA9ICdjcml0aWNhbCc7XG4gICAgICAgIGRlc2NyaXB0aW9uICs9ICcgLSDmqZ/lr4bjg5XjgqHjgqTjg6vjgavku5bogIXoqq3jgb/lj5bjgormqKnpmZDjgYzjgYLjgorjgb7jgZknO1xuICAgICAgICByZWNvbW1lbmRlZEFjdGlvbiA9IGDnt4rmgKU6IOapn+WvhuODleOCoeOCpOODq+OBruaoqemZkOOCkjYwMOOBq+WkieabtOOBl+OBpuOBj+OBoOOBleOBhGA7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8g5qip6ZmQ44GM57ep44GZ44GO44KL5aC05ZCIXG4gICAgaWYgKGFjdHVhbE9jdGFsID4gZXhwZWN0ZWRPY3RhbCkge1xuICAgICAgaWYgKHJpc2tMZXZlbCA9PT0gJ2xvdycpIHJpc2tMZXZlbCA9ICdtZWRpdW0nO1xuICAgICAgZGVzY3JpcHRpb24gKz0gJyAtIOaoqemZkOOBjOe3qeOBmeOBjuOBvuOBmSc7XG4gICAgfVxuXG4gICAgLy8g5qip6ZmQ44GM5Y6z44GX44GZ44GO44KL5aC05ZCIXG4gICAgaWYgKGFjdHVhbE9jdGFsIDwgZXhwZWN0ZWRPY3RhbCkge1xuICAgICAgZGVzY3JpcHRpb24gKz0gJyAtIOaoqemZkOOBjOWOs+OBl+OBmeOBjuOCi+WPr+iDveaAp+OBjOOBguOCiuOBvuOBmSc7XG4gICAgICByZWNvbW1lbmRlZEFjdGlvbiArPSAnICjmqZ/og73jgavlvbHpn7/jgZnjgovlj6/og73mgKfjgYzjgYLjgorjgb7jgZkpJztcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgaXNzdWVUeXBlOiAnaW5jb3JyZWN0X3Blcm1pc3Npb25zJyxcbiAgICAgIGRlc2NyaXB0aW9uLFxuICAgICAgcmlza0xldmVsLFxuICAgICAgcmVjb21tZW5kZWRBY3Rpb25cbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOS/ruW+qeioiOeUu+OCkuS9nOaIkFxuICAgKi9cbiAgcHVibGljIGNyZWF0ZVJlcGFpclBsYW4odmFsaWRhdGlvblN1bW1hcnk6IFZhbGlkYXRpb25TdW1tYXJ5KTogUmVwYWlyUGxhbiB7XG4gICAgY29uc29sZS5sb2coJ/Cfk4sg5qip6ZmQ5L+u5b6p6KiI55S744KS5L2c5oiQ5LitLi4uJyk7XG5cbiAgICBjb25zdCBpbnZhbGlkUmVzdWx0cyA9IHZhbGlkYXRpb25TdW1tYXJ5LnJlc3VsdHMuZmlsdGVyKHIgPT4gIXIuaXNWYWxpZCk7XG4gICAgXG4gICAgLy8g5YSq5YWI5bqm5Yil44Gr44OV44Kh44Kk44Or44KS5YiG6aGeXG4gICAgY29uc3QgdGFyZ2V0RmlsZXMgPSBpbnZhbGlkUmVzdWx0cy5tYXAocmVzdWx0ID0+ICh7XG4gICAgICBmaWxlUGF0aDogcmVzdWx0LmZpbGVQYXRoLFxuICAgICAgY3VycmVudFBlcm1pc3Npb25zOiByZXN1bHQuYWN0dWFsUGVybWlzc2lvbnMsXG4gICAgICB0YXJnZXRQZXJtaXNzaW9uczogcmVzdWx0LmV4cGVjdGVkUGVybWlzc2lvbnMsXG4gICAgICBwcmlvcml0eTogcmVzdWx0LnJpc2tMZXZlbCBhcyAnbG93JyB8ICdtZWRpdW0nIHwgJ2hpZ2gnIHwgJ2NyaXRpY2FsJ1xuICAgIH0pKTtcblxuICAgIC8vIOS/ruW+qemghuW6j+OCkuaxuuWumu+8iOODquOCueOCr+ODrOODmeODq+mghu+8iVxuICAgIGNvbnN0IHByaW9yaXR5T3JkZXIgPSBbJ2NyaXRpY2FsJywgJ2hpZ2gnLCAnbWVkaXVtJywgJ2xvdyddO1xuICAgIGNvbnN0IHJlcGFpck9yZGVyID0gdGFyZ2V0RmlsZXNcbiAgICAgIC5zb3J0KChhLCBiKSA9PiBwcmlvcml0eU9yZGVyLmluZGV4T2YoYS5wcmlvcml0eSkgLSBwcmlvcml0eU9yZGVyLmluZGV4T2YoYi5wcmlvcml0eSkpXG4gICAgICAubWFwKGYgPT4gZi5maWxlUGF0aCk7XG5cbiAgICAvLyDmjqjlrprkv67lvqnmmYLplpPjgpLoqIjnrpdcbiAgICBjb25zdCBlc3RpbWF0ZWRSZXBhaXJUaW1lID0gdGFyZ2V0RmlsZXMubGVuZ3RoICogMTAwOyAvLyAxMDBtcyBwZXIgZmlsZVxuXG4gICAgLy8g5rOo5oSP5LqL6aCF44KS55Sf5oiQXG4gICAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG4gICAgXG4gICAgY29uc3QgY3JpdGljYWxGaWxlcyA9IHRhcmdldEZpbGVzLmZpbHRlcihmID0+IGYucHJpb3JpdHkgPT09ICdjcml0aWNhbCcpO1xuICAgIGlmIChjcml0aWNhbEZpbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHdhcm5pbmdzLnB1c2goYCR7Y3JpdGljYWxGaWxlcy5sZW5ndGh95YCL44Gu6YeN6KaB44Gq44K744Kt44Ol44Oq44OG44Kj5ZWP6aGM44GM44GC44KK44G+44GZ44CC5Y2z5bqn44Gr5L+u5b6p44GX44Gm44GP44Gg44GV44GE44CCYCk7XG4gICAgfVxuXG4gICAgY29uc3Qgc2NyaXB0RmlsZXMgPSB0YXJnZXRGaWxlcy5maWx0ZXIoZiA9PiBmLmZpbGVQYXRoLmVuZHNXaXRoKCcuc2gnKSB8fCBmLmZpbGVQYXRoLmVuZHNXaXRoKCcucHknKSk7XG4gICAgaWYgKHNjcmlwdEZpbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHdhcm5pbmdzLnB1c2goYCR7c2NyaXB0RmlsZXMubGVuZ3RofeWAi+OBruOCueOCr+ODquODl+ODiOODleOCoeOCpOODq+OBruaoqemZkOOCkuWkieabtOOBl+OBvuOBmeOAguWun+ihjOOBq+W9semfv+OBmeOCi+WPr+iDveaAp+OBjOOBguOCiuOBvuOBmeOAgmApO1xuICAgIH1cblxuICAgIGlmICh0YXJnZXRGaWxlcy5sZW5ndGggPiA1MCkge1xuICAgICAgd2FybmluZ3MucHVzaCgn5aSn6YeP44Gu44OV44Kh44Kk44Or44KS5L+u5b6p44GX44G+44GZ44CC5Yem55CG44Gr5pmC6ZaT44GM44GL44GL44KL5Y+v6IO95oCn44GM44GC44KK44G+44GZ44CCJyk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coYPCfk4sg5L+u5b6p6KiI55S75L2c5oiQ5a6M5LqGOiAke3RhcmdldEZpbGVzLmxlbmd0aH3lgIvjga7jg5XjgqHjgqTjg6vjgYzlr77osaFgKTtcblxuICAgIHJldHVybiB7XG4gICAgICB0YXJnZXRGaWxlcyxcbiAgICAgIGVzdGltYXRlZFJlcGFpclRpbWUsXG4gICAgICByZXBhaXJPcmRlcixcbiAgICAgIHdhcm5pbmdzXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDoh6rli5Xkv67lvqnjgpLlrp/ooYxcbiAgICovXG4gIHB1YmxpYyBhc3luYyBleGVjdXRlQXV0b1JlcGFpcihcbiAgICB2YWxpZGF0aW9uU3VtbWFyeTogVmFsaWRhdGlvblN1bW1hcnksXG4gICAgZmlsZXM6IEZpbGVJbmZvW10sXG4gICAgY2xhc3NpZmljYXRpb25zOiBDbGFzc2lmaWNhdGlvblJlc3VsdFtdXG4gICk6IFByb21pc2U8UGVybWlzc2lvblN1bW1hcnk+IHtcbiAgICBjb25zb2xlLmxvZyhg8J+UpyAke3ZhbGlkYXRpb25TdW1tYXJ5LmVudmlyb25tZW50feeSsOWig+OBp+iHquWLleS/ruW+qeOCkuWun+ihjOS4rS4uLmApO1xuXG4gICAgLy8g5L+u5b6p6KiI55S744KS5L2c5oiQXG4gICAgY29uc3QgcmVwYWlyUGxhbiA9IHRoaXMuY3JlYXRlUmVwYWlyUGxhbih2YWxpZGF0aW9uU3VtbWFyeSk7XG5cbiAgICBpZiAocmVwYWlyUGxhbi50YXJnZXRGaWxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnNvbGUubG9nKCfinIUg5L+u5b6p5a++6LGh44Gq44GXOiDlhajjgabjga7mqKnpmZDjgYzmraPluLjjgafjgZknKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvdGFsRmlsZXM6IDAsXG4gICAgICAgIHN1Y2Nlc3NmdWxVcGRhdGVzOiAwLFxuICAgICAgICBmYWlsZWRVcGRhdGVzOiAwLFxuICAgICAgICBza2lwcGVkRmlsZXM6IDAsXG4gICAgICAgIHRvdGFsUHJvY2Vzc2luZ1RpbWU6IDAsXG4gICAgICAgIGVudmlyb25tZW50OiB2YWxpZGF0aW9uU3VtbWFyeS5lbnZpcm9ubWVudCxcbiAgICAgICAgcmVzdWx0czogW10sXG4gICAgICAgIGVycm9yU3VtbWFyeToge31cbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8g6K2m5ZGK44Gu6KGo56S6XG4gICAgaWYgKHJlcGFpclBsYW4ud2FybmluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgY29uc29sZS53YXJuKCfimqDvuI8g5L+u5b6p5a6f6KGM5YmN44Gu5rOo5oSP5LqL6aCFOicpO1xuICAgICAgcmVwYWlyUGxhbi53YXJuaW5ncy5mb3JFYWNoKHdhcm5pbmcgPT4gY29uc29sZS53YXJuKGAgICAtICR7d2FybmluZ31gKSk7XG4gICAgfVxuXG4gICAgLy8g5L+u5b6p5a++6LGh44Gu44OV44Kh44Kk44Or5oOF5aCx44KS5Y+W5b6XXG4gICAgY29uc3QgcmVwYWlyRmlsZXMgPSByZXBhaXJQbGFuLnRhcmdldEZpbGVzLm1hcCh0YXJnZXQgPT4gXG4gICAgICBmaWxlcy5maW5kKGYgPT4gZi5wYXRoID09PSB0YXJnZXQuZmlsZVBhdGgpIVxuICAgICkuZmlsdGVyKEJvb2xlYW4pO1xuXG4gICAgY29uc3QgcmVwYWlyQ2xhc3NpZmljYXRpb25zID0gcmVwYWlyUGxhbi50YXJnZXRGaWxlcy5tYXAodGFyZ2V0ID0+IFxuICAgICAgY2xhc3NpZmljYXRpb25zW2ZpbGVzLmZpbmRJbmRleChmID0+IGYucGF0aCA9PT0gdGFyZ2V0LmZpbGVQYXRoKV1cbiAgICApLmZpbHRlcihCb29sZWFuKTtcblxuICAgIC8vIOaoqemZkOS/ruW+qeOCkuWun+ihjFxuICAgIHJldHVybiBhd2FpdCB0aGlzLnBlcm1pc3Npb25NYW5hZ2VyLnNldFBlcm1pc3Npb25zKFxuICAgICAgcmVwYWlyRmlsZXMsIFxuICAgICAgcmVwYWlyQ2xhc3NpZmljYXRpb25zLCBcbiAgICAgIHZhbGlkYXRpb25TdW1tYXJ5LmVudmlyb25tZW50XG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDntpnntprnmoTnm6PoppbjgpLlrp/ooYxcbiAgICovXG4gIHB1YmxpYyBhc3luYyBwZXJmb3JtQ29udGludW91c01vbml0b3JpbmcoXG4gICAgZmlsZXM6IEZpbGVJbmZvW10sXG4gICAgY2xhc3NpZmljYXRpb25zOiBDbGFzc2lmaWNhdGlvblJlc3VsdFtdLFxuICAgIGVudmlyb25tZW50OiBFbnZpcm9ubWVudCxcbiAgICBpbnRlcnZhbE1pbnV0ZXM6IG51bWJlciA9IDYwXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnNvbGUubG9nKGDwn5SEICR7ZW52aXJvbm1lbnR955Kw5aKD44Gn57aZ57aa55qE5qip6ZmQ55uj6KaW44KS6ZaL5aeLICjplpPpmpQ6ICR7aW50ZXJ2YWxNaW51dGVzfeWIhilgKTtcblxuICAgIGNvbnN0IG1vbml0b3JpbmdMb29wID0gYXN5bmMgKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgdmFsaWRhdGlvblJlc3VsdCA9IGF3YWl0IHRoaXMudmFsaWRhdGVQZXJtaXNzaW9ucyhmaWxlcywgY2xhc3NpZmljYXRpb25zLCBlbnZpcm9ubWVudCk7XG4gICAgICAgIFxuICAgICAgICBpZiAodmFsaWRhdGlvblJlc3VsdC5pbnZhbGlkRmlsZXMgPiAwKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKGDimqDvuI8g5qip6ZmQ5ZWP6aGM44KS5qSc5Ye6OiAke3ZhbGlkYXRpb25SZXN1bHQuaW52YWxpZEZpbGVzfeWAi+OBruODleOCoeOCpOODq2ApO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIOmHjeimgeOBquWVj+mhjOOBjOOBguOCi+WgtOWQiOOBr+iHquWLleS/ruW+qVxuICAgICAgICAgIGNvbnN0IGNyaXRpY2FsSXNzdWVzID0gdmFsaWRhdGlvblJlc3VsdC5yZXN1bHRzLmZpbHRlcihyID0+IHIucmlza0xldmVsID09PSAnY3JpdGljYWwnKTtcbiAgICAgICAgICBpZiAoY3JpdGljYWxJc3N1ZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGDwn5qoIOmHjeimgeOBquaoqemZkOWVj+mhjOOCkuiHquWLleS/ruW+qeS4rTogJHtjcml0aWNhbElzc3Vlcy5sZW5ndGh95YCLYCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmV4ZWN1dGVBdXRvUmVwYWlyKHZhbGlkYXRpb25SZXN1bHQsIGZpbGVzLCBjbGFzc2lmaWNhdGlvbnMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihg4p2MIOe2mee2mueahOebo+imluOCqOODqeODvDogJHtlcnJvcn1gKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8g5Yid5Zue5a6f6KGMXG4gICAgYXdhaXQgbW9uaXRvcmluZ0xvb3AoKTtcblxuICAgIC8vIOWumuacn+Wun+ihjOOBruioreWumlxuICAgIHNldEludGVydmFsKG1vbml0b3JpbmdMb29wLCBpbnRlcnZhbE1pbnV0ZXMgKiA2MCAqIDEwMDApO1xuICB9XG5cbiAgLyoqXG4gICAqIOaoqemZkOaknOiovOODrOODneODvOODiOOCkueUn+aIkFxuICAgKi9cbiAgcHVibGljIGdlbmVyYXRlVmFsaWRhdGlvblJlcG9ydCh2YWxpZGF0aW9uU3VtbWFyeTogVmFsaWRhdGlvblN1bW1hcnkpOiBzdHJpbmcge1xuICAgIGNvbnN0IHZhbGlkYXRpb25SYXRlID0gTWF0aC5yb3VuZCgodmFsaWRhdGlvblN1bW1hcnkudmFsaWRGaWxlcyAvIHZhbGlkYXRpb25TdW1tYXJ5LnRvdGFsRmlsZXMpICogMTAwKTtcbiAgICBcbiAgICAvLyDjg6rjgrnjgq/jg6zjg5njg6vliKXntbHoqIhcbiAgICBjb25zdCByaXNrU3RhdHMgPSBPYmplY3QuZW50cmllcyh2YWxpZGF0aW9uU3VtbWFyeS5yaXNrTGV2ZWxTdGF0cylcbiAgICAgIC5tYXAoKFtsZXZlbCwgY291bnRdKSA9PiBgLSAqKiR7bGV2ZWwudG9VcHBlckNhc2UoKX0qKjogJHtjb3VudH3ku7ZgKVxuICAgICAgLmpvaW4oJ1xcbicpO1xuXG4gICAgLy8g5ZWP6aGM44K/44Kk44OX5Yil57Wx6KiIXG4gICAgY29uc3QgaXNzdWVTdGF0cyA9IE9iamVjdC5lbnRyaWVzKHZhbGlkYXRpb25TdW1tYXJ5Lmlzc3VlVHlwZVN0YXRzKVxuICAgICAgLm1hcCgoW3R5cGUsIGNvdW50XSkgPT4gYC0gKioke3R5cGV9Kio6ICR7Y291bnR95Lu2YClcbiAgICAgIC5qb2luKCdcXG4nKTtcblxuICAgIC8vIOmHjeimgeOBquWVj+mhjOOBruODquOCueODiFxuICAgIGNvbnN0IGNyaXRpY2FsSXNzdWVzID0gdmFsaWRhdGlvblN1bW1hcnkucmVzdWx0c1xuICAgICAgLmZpbHRlcihyID0+IHIucmlza0xldmVsID09PSAnY3JpdGljYWwnKVxuICAgICAgLnNsaWNlKDAsIDEwKVxuICAgICAgLm1hcChyID0+IGAtICoqJHtyLmZpbGVQYXRofSoqOiAke3IuaXNzdWVEZXNjcmlwdGlvbn1gKVxuICAgICAgLmpvaW4oJ1xcbicpO1xuXG4gICAgcmV0dXJuIGBcbiMgJHt2YWxpZGF0aW9uU3VtbWFyeS5lbnZpcm9ubWVudC50b1VwcGVyQ2FzZSgpfeeSsOWigyDmqKnpmZDmpJzoqLzjg6zjg53jg7zjg4hcblxuIyMg5qSc6Ki844K144Oe44Oq44O8XG4tICoq5qSc6Ki85pel5pmCKio6ICR7bmV3IERhdGUoKS50b0xvY2FsZVN0cmluZygnamEtSlAnKX1cbi0gKirnkrDlooMqKjogJHt2YWxpZGF0aW9uU3VtbWFyeS5lbnZpcm9ubWVudH1cbi0gKirmpJzoqLzjg5XjgqHjgqTjg6vmlbAqKjogJHt2YWxpZGF0aW9uU3VtbWFyeS50b3RhbEZpbGVzfeWAi1xuLSAqKuacieWKuSoqOiAke3ZhbGlkYXRpb25TdW1tYXJ5LnZhbGlkRmlsZXN95YCLXG4tICoq54Sh5Yq5Kio6ICR7dmFsaWRhdGlvblN1bW1hcnkuaW52YWxpZEZpbGVzfeWAi1xuLSAqKuaknOiovOeOhyoqOiAke3ZhbGlkYXRpb25SYXRlfSVcbi0gKirmpJzoqLzmmYLplpMqKjogJHtNYXRoLnJvdW5kKHZhbGlkYXRpb25TdW1tYXJ5LnZhbGlkYXRpb25UaW1lIC8gMTAwMCl956eSXG5cbiMjIOODquOCueOCr+ODrOODmeODq+WIpee1seioiFxuJHtyaXNrU3RhdHN9XG5cbiMjIOWVj+mhjOOCv+OCpOODl+WIpee1seioiFxuJHtpc3N1ZVN0YXRzIHx8ICctIOWVj+mhjOOBquOBlyd9XG5cbiMjIOmHjeimgeOBquaoqemZkOWVj+mhjO+8iOS4iuS9jTEw5Lu277yJXG4ke2NyaXRpY2FsSXNzdWVzIHx8ICctIOmHjeimgeOBquWVj+mhjOOBquOBlyd9XG5cbiMjIOaOqOWlqOOCouOCr+OCt+ODp+ODs1xuJHt2YWxpZGF0aW9uU3VtbWFyeS5pbnZhbGlkRmlsZXMgPT09IDAgPyBcbiAgJy0g5YWo44Gm44Gu5qip6ZmQ44GM6YGp5YiH44Gr6Kit5a6a44GV44KM44Gm44GE44G+44GZ44CC57aZ57aa55qE44Gq55uj6KaW44KS5o6o5aWo44GX44G+44GZ44CCJyA6XG4gIGAtICR7dmFsaWRhdGlvblN1bW1hcnkuaW52YWxpZEZpbGVzfeWAi+OBruODleOCoeOCpOODq+OBp+aoqemZkOWVj+mhjOOBjOaknOWHuuOBleOCjOOBvuOBl+OBn+OAguiHquWLleS/ruW+qeOBruWun+ihjOOCkuaknOiojuOBl+OBpuOBj+OBoOOBleOBhOOAgmBcbn1cblxuJHt2YWxpZGF0aW9uU3VtbWFyeS5yaXNrTGV2ZWxTdGF0cy5jcml0aWNhbCA+IDAgPyBcbiAgYFxcbuKaoO+4jyAqKue3iuaApSoqOiAke3ZhbGlkYXRpb25TdW1tYXJ5LnJpc2tMZXZlbFN0YXRzLmNyaXRpY2FsfeWAi+OBrumHjeimgeOBquOCu+OCreODpeODquODhuOCo+WVj+mhjOOBjOOBguOCiuOBvuOBmeOAguWNs+W6p+OBq+WvvuW/nOOBl+OBpuOBj+OBoOOBleOBhOOAgmAgOiAnJ1xufVxuXG4jIyDjg5Hjg5Xjgqnjg7zjg57jg7PjgrnntbHoqIhcbi0gKirlubPlnYfmpJzoqLzmmYLplpMqKjogJHtNYXRoLnJvdW5kKHZhbGlkYXRpb25TdW1tYXJ5LnZhbGlkYXRpb25UaW1lIC8gdmFsaWRhdGlvblN1bW1hcnkudG90YWxGaWxlcyl9bXMv44OV44Kh44Kk44OrXG4tICoq5qSc6Ki844K544Or44O844OX44OD44OIKio6ICR7TWF0aC5yb3VuZCh2YWxpZGF0aW9uU3VtbWFyeS50b3RhbEZpbGVzIC8gKHZhbGlkYXRpb25TdW1tYXJ5LnZhbGlkYXRpb25UaW1lIC8gMTAwMCkpfeODleOCoeOCpOODqy/np5JcbmA7XG4gIH1cblxuICAvKipcbiAgICog5pyf5b6F44GV44KM44KL5qip6ZmQ44KS5rG65a6aXG4gICAqL1xuICBwcml2YXRlIGRldGVybWluZUV4cGVjdGVkUGVybWlzc2lvbnMoZmlsZTogRmlsZUluZm8sIGNsYXNzaWZpY2F0aW9uOiBDbGFzc2lmaWNhdGlvblJlc3VsdCk6IHN0cmluZyB7XG4gICAgLy8gUGVybWlzc2lvbk1hbmFnZXLjgajlkIzjgZjjg63jgrjjg4Pjgq/jgpLkvb/nlKhcbiAgICBpZiAoY2xhc3NpZmljYXRpb24uZmlsZVR5cGUgPT09ICdzY3JpcHQnKSB7XG4gICAgICByZXR1cm4gJzc1NSc7XG4gICAgfVxuICAgIFxuICAgIGlmIChjbGFzc2lmaWNhdGlvbi5maWxlVHlwZSA9PT0gJ2NvbmZpZycpIHtcbiAgICAgIGlmIChmaWxlLnBhdGguaW5jbHVkZXMoJ3NlY3JldCcpIHx8IGZpbGUucGF0aC5pbmNsdWRlcygnZW52JykgfHwgXG4gICAgICAgICAgZmlsZS5wYXRoLmluY2x1ZGVzKCdrZXknKSB8fCBmaWxlLnBhdGguaW5jbHVkZXMoJ3Bhc3N3b3JkJykpIHtcbiAgICAgICAgcmV0dXJuICc2MDAnO1xuICAgICAgfVxuICAgICAgcmV0dXJuICc2NDQnO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gJzY0NCc7IC8vIOODh+ODleOCqeODq+ODiFxuICB9XG5cbiAgLyoqXG4gICAqIOePvuWcqOOBruaoqemZkOOCkuWPluW+l1xuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBnZXRDdXJyZW50UGVybWlzc2lvbnMoZmlsZVBhdGg6IHN0cmluZywgZW52aXJvbm1lbnQ6IEVudmlyb25tZW50KTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICB0cnkge1xuICAgICAgaWYgKGVudmlyb25tZW50ID09PSAnbG9jYWwnKSB7XG4gICAgICAgIGNvbnN0IHN0YXRzID0gYXdhaXQgZnMuc3RhdChmaWxlUGF0aCk7XG4gICAgICAgIHJldHVybiAoc3RhdHMubW9kZSAmIHBhcnNlSW50KCc3NzcnLCA4KSkudG9TdHJpbmcoOCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmV4ZWN1dGVTU0hDb21tYW5kKGBzdGF0IC1jIFwiJWFcIiBcIiR7ZmlsZVBhdGh9XCJgKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdC5zdGRvdXQudHJpbSgpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYOaoqemZkOWPluW+l+OBq+WkseaVlzogJHtlcnJvcn1gKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU1NIIOOCs+ODnuODs+ODieOCkuWun+ihjFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBleGVjdXRlU1NIQ29tbWFuZChjb21tYW5kOiBzdHJpbmcpOiBQcm9taXNlPHsgc3Rkb3V0OiBzdHJpbmc7IHN0ZGVycjogc3RyaW5nIH0+IHtcbiAgICBpZiAoIXRoaXMuc3NoQ29uZmlnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NTSOioreWumuOBjOW/heimgeOBp+OBmScpO1xuICAgIH1cblxuICAgIGNvbnN0IHNzaENvbW1hbmQgPSBgc3NoIC1pIFwiJHt0aGlzLnNzaENvbmZpZy5rZXlQYXRofVwiIC1vIENvbm5lY3RUaW1lb3V0PSR7dGhpcy5zc2hDb25maWcudGltZW91dCEgLyAxMDAwfSAtbyBTdHJpY3RIb3N0S2V5Q2hlY2tpbmc9bm8gLXAgJHt0aGlzLnNzaENvbmZpZy5wb3J0fSAke3RoaXMuc3NoQ29uZmlnLnVzZXJ9QCR7dGhpcy5zc2hDb25maWcuaG9zdH0gXCIke2NvbW1hbmR9XCJgO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBleGVjQXN5bmMoc3NoQ29tbWFuZCwgeyBcbiAgICAgICAgdGltZW91dDogdGhpcy5zc2hDb25maWcudGltZW91dCxcbiAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDEwIC8vIDEwTUJcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICBpZiAoZXJyb3IuY29kZSA9PT0gJ0VUSU1FRE9VVCcpIHtcbiAgICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5TU0hfQ09OTkVDVElPTl9GQUlMRUQsXG4gICAgICAgICAgYFNTSOaOpee2muOBjOOCv+OCpOODoOOCouOCpuODiOOBl+OBvuOBl+OBnzogJHt0aGlzLnNzaENvbmZpZy5ob3N0fWAsXG4gICAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAgICdlYzInLFxuICAgICAgICAgIGVycm9yXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cbn0iXX0=