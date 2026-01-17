"use strict";
/**
 * 統合ファイル整理システム - 進捗管理・レポート機能
 *
 * リアルタイム進捗表示、実行結果レポート、統合レポート生成機能を提供します。
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
exports.ProgressReporter = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const events_1 = require("events");
const index_js_1 = require("../types/index.js");
/**
 * 進捗管理・レポート機能
 *
 * リアルタイム進捗表示と包括的なレポート生成を提供します。
 */
class ProgressReporter extends events_1.EventEmitter {
    reportConfig;
    progressConfig;
    currentProgress;
    progressHistory = [];
    progressInterval;
    constructor(reportConfig = {
        outputDirectory: 'development/logs/organization',
        formats: ['markdown', 'json'],
        detailLevel: 'detailed',
        includeCharts: false,
        autoSave: true
    }, progressConfig = {
        mode: 'console',
        updateInterval: 1000,
        showDetails: true,
        useColors: true
    }) {
        super();
        this.reportConfig = reportConfig;
        this.progressConfig = progressConfig;
    }
    /**
     * 進捗追跡を開始
     */
    startProgressTracking(initialProgress) {
        console.log('📊 進捗追跡を開始...');
        this.currentProgress = initialProgress;
        this.progressHistory = [initialProgress];
        // 進捗表示の開始
        if (this.progressConfig.mode === 'console' || this.progressConfig.mode === 'both') {
            this.startConsoleProgress();
        }
        if (this.progressConfig.mode === 'file' || this.progressConfig.mode === 'both') {
            this.startFileProgress();
        }
        this.emit('progress:started', initialProgress);
    }
    /**
     * 進捗を更新
     */
    updateProgress(progress) {
        this.currentProgress = progress;
        this.progressHistory.push(progress);
        // 進捗表示を更新
        this.displayProgress(progress);
        this.emit('progress:updated', progress);
    }
    /**
     * 進捗追跡を停止
     */
    stopProgressTracking() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = undefined;
        }
        console.log('\n✅ 進捗追跡を停止');
        this.emit('progress:stopped');
    }
    /**
     * 統合レポートを生成
     */
    async generateIntegratedReport(executionResult) {
        console.log('📋 統合レポートを生成中...');
        try {
            // 出力ディレクトリを作成
            await fs.mkdir(this.reportConfig.outputDirectory, { recursive: true });
            // レポートデータを準備
            const reportData = await this.prepareReportData(executionResult);
            // 形式別にレポートを生成
            const generatedFiles = [];
            for (const format of this.reportConfig.formats) {
                const filePath = await this.generateReportByFormat(reportData, format);
                generatedFiles.push(filePath);
            }
            console.log(`✅ 統合レポート生成完了: ${generatedFiles.length}個のファイル`);
            return generatedFiles;
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.REPORT_GENERATION_FAILED, `統合レポート生成に失敗しました: ${error}`, undefined, undefined, error);
        }
    }
    /**
     * リアルタイム進捗表示
     */
    displayProgress(progress) {
        if (this.progressConfig.mode === 'console' || this.progressConfig.mode === 'both') {
            this.displayConsoleProgress(progress);
        }
    }
    /**
     * コンソール進捗表示
     */
    displayConsoleProgress(progress) {
        const colors = this.progressConfig.useColors;
        // 進捗バーを生成
        const progressBar = this.generateProgressBar(progress.overallProgress, 40);
        // 時間情報を計算
        const elapsed = Date.now() - progress.startTime.getTime();
        const elapsedStr = this.formatDuration(elapsed);
        const remainingStr = progress.estimatedTimeRemaining ?
            this.formatDuration(progress.estimatedTimeRemaining) : '不明';
        // 進捗情報を表示
        const phaseColor = colors ? this.getPhaseColor(progress.currentPhase) : '';
        const resetColor = colors ? '\x1b[0m' : '';
        process.stdout.write('\r\x1b[K'); // 行をクリア
        process.stdout.write(`${phaseColor}${progress.currentPhase}${resetColor} ` +
            `${progressBar} ${progress.overallProgress.toFixed(1)}% ` +
            `(${progress.processedFiles}/${progress.totalFiles}) ` +
            `経過: ${elapsedStr} 残り: ${remainingStr}`);
        // 詳細情報を表示
        if (this.progressConfig.showDetails && progress.currentFile) {
            process.stdout.write(`\n  📄 ${progress.currentFile}`);
        }
        // エラー・警告情報を表示
        if (progress.errorCount > 0 || progress.warningCount > 0) {
            const errorColor = colors ? '\x1b[31m' : '';
            const warnColor = colors ? '\x1b[33m' : '';
            process.stdout.write(`\n  ${errorColor}エラー: ${progress.errorCount}${resetColor} ` +
                `${warnColor}警告: ${progress.warningCount}${resetColor}`);
        }
    }
    /**
     * 進捗バーを生成
     */
    generateProgressBar(percentage, width) {
        const filled = Math.round((percentage / 100) * width);
        const empty = width - filled;
        return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
    }
    /**
     * フェーズの色を取得
     */
    getPhaseColor(phase) {
        const colors = {
            'initializing': '\x1b[36m', // シアン
            'scanning': '\x1b[34m', // 青
            'classifying': '\x1b[35m', // マゼンタ
            'creating_directories': '\x1b[33m', // 黄
            'creating_backup': '\x1b[32m', // 緑
            'moving_files': '\x1b[36m', // シアン
            'setting_permissions': '\x1b[35m', // マゼンタ
            'syncing': '\x1b[34m', // 青
            'validating': '\x1b[33m', // 黄
            'generating_report': '\x1b[32m', // 緑
            'completed': '\x1b[32m', // 緑
            'failed': '\x1b[31m' // 赤
        };
        return colors[phase] || '\x1b[37m'; // デフォルトは白
    }
    /**
     * 時間をフォーマット
     */
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        else {
            return `${seconds}s`;
        }
    }
    /**
     * コンソール進捗を開始
     */
    startConsoleProgress() {
        this.progressInterval = setInterval(() => {
            if (this.currentProgress) {
                this.displayConsoleProgress(this.currentProgress);
            }
        }, this.progressConfig.updateInterval);
    }
    /**
     * ファイル進捗を開始
     */
    startFileProgress() {
        // 実装簡略化
    }
    /**
     * レポートデータを準備
     */
    async prepareReportData(executionResult) {
        const systemInfo = {
            platform: process.platform,
            nodeVersion: process.version,
            memoryUsage: process.memoryUsage(),
            executionTime: executionResult.startTime,
            workingDirectory: process.cwd()
        };
        const performanceAnalysis = this.analyzePerformance(executionResult);
        const recommendations = this.generateRecommendations(executionResult);
        return {
            executionResult,
            systemInfo,
            performanceAnalysis,
            recommendations
        };
    }
    /**
     * パフォーマンス分析を実行
     */
    analyzePerformance(executionResult) {
        // フェーズ別処理時間（簡略化）
        const phaseTimings = {};
        // 環境別処理時間
        const environmentTimings = {};
        for (const [env, result] of Object.entries(executionResult.environmentResults)) {
            environmentTimings[env] = result.processingTime;
        }
        // ボトルネック分析
        const bottlenecks = [];
        const maxTime = Math.max(...Object.values(environmentTimings));
        for (const [env, time] of Object.entries(environmentTimings)) {
            if (time === maxTime) {
                bottlenecks.push({
                    phase: 'moving_files', // 簡略化
                    duration: time,
                    percentage: (time / executionResult.totalProcessingTime) * 100,
                    improvementSuggestion: `${env}環境の処理を最適化することで全体の処理時間を短縮できます`
                });
            }
        }
        // スループット統計
        const totalFiles = executionResult.overallStatistics.totalScannedFiles;
        const totalTime = executionResult.totalProcessingTime / 1000; // 秒に変換
        const throughputStats = {
            filesPerSecond: totalFiles / totalTime,
            mbPerSecond: 0, // 実装簡略化
            averageFileSize: 0, // 実装簡略化
            maxProcessingTime: maxTime,
            minProcessingTime: Math.min(...Object.values(environmentTimings))
        };
        return {
            phaseTimings,
            environmentTimings,
            bottlenecks,
            throughputStats
        };
    }
    /**
     * 推奨事項を生成
     */
    generateRecommendations(executionResult) {
        const recommendations = [];
        // エラーが多い場合の推奨事項
        if (executionResult.errors.length > 0) {
            recommendations.push({
                category: 'maintenance',
                priority: 'high',
                title: 'エラーの解決',
                description: `${executionResult.errors.length}個のエラーが発生しました`,
                implementation: 'エラーログを確認し、根本原因を特定して修正してください',
                expectedBenefit: '実行成功率の向上と安定性の確保'
            });
        }
        // 構造準拠率が低い場合
        if (executionResult.overallStatistics.structureComplianceRate < 90) {
            recommendations.push({
                category: 'structure',
                priority: 'medium',
                title: 'ディレクトリ構造の改善',
                description: `構造準拠率が${executionResult.overallStatistics.structureComplianceRate}%です`,
                implementation: 'Agent Steering guidelinesに従ってディレクトリ構造を見直してください',
                expectedBenefit: 'ファイル管理の効率化と保守性の向上'
            });
        }
        // 環境間一致率が低い場合
        if (executionResult.overallStatistics.environmentMatchRate < 95) {
            recommendations.push({
                category: 'maintenance',
                priority: 'medium',
                title: '環境間同期の改善',
                description: `環境間一致率が${executionResult.overallStatistics.environmentMatchRate}%です`,
                implementation: '定期的な同期実行と整合性チェックを実施してください',
                expectedBenefit: '環境間の一貫性確保と運用効率の向上'
            });
        }
        // パフォーマンス改善の推奨事項
        if (executionResult.totalProcessingTime > 60000) { // 1分以上
            recommendations.push({
                category: 'performance',
                priority: 'low',
                title: 'パフォーマンスの最適化',
                description: '処理時間が長くなっています',
                implementation: '並列処理の活用やファイルフィルタリングの最適化を検討してください',
                expectedBenefit: '処理時間の短縮と効率の向上'
            });
        }
        return recommendations;
    }
    /**
     * 形式別レポート生成
     */
    async generateReportByFormat(reportData, format) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `file-organization-report-${timestamp}.${format}`;
        const filePath = path.join(this.reportConfig.outputDirectory, filename);
        let content;
        switch (format) {
            case 'markdown':
                content = this.generateMarkdownReport(reportData);
                break;
            case 'html':
                content = this.generateHtmlReport(reportData);
                break;
            case 'json':
                content = JSON.stringify(reportData, null, 2);
                break;
            case 'csv':
                content = this.generateCsvReport(reportData);
                break;
            default:
                throw new Error(`未対応のレポート形式: ${format}`);
        }
        await fs.writeFile(filePath, content, 'utf-8');
        console.log(`📄 ${format.toUpperCase()}レポート生成: ${filePath}`);
        return filePath;
    }
    /**
     * Markdownレポートを生成
     */
    generateMarkdownReport(reportData) {
        const { executionResult, systemInfo, performanceAnalysis, recommendations } = reportData;
        return `# 統合ファイル整理システム 実行レポート

## 実行サマリー
- **実行ID**: ${executionResult.executionId}
- **実行日時**: ${executionResult.startTime.toLocaleString('ja-JP')}
- **成功**: ${executionResult.success ? 'はい' : 'いいえ'}
- **総処理時間**: ${Math.round(executionResult.totalProcessingTime / 1000)}秒
- **エラー数**: ${executionResult.errors.length}個
- **警告数**: ${executionResult.warnings.length}個

## 統合統計
- **総スキャンファイル数**: ${executionResult.overallStatistics.totalScannedFiles}個
- **総移動ファイル数**: ${executionResult.overallStatistics.totalMovedFiles}個
- **平置きファイル削減数**: ${executionResult.overallStatistics.flatFileReduction}個
- **構造準拠率**: ${executionResult.overallStatistics.structureComplianceRate}%
- **環境間一致率**: ${executionResult.overallStatistics.environmentMatchRate}%

## 環境別結果
${Object.entries(executionResult.environmentResults).map(([env, result]) => `
### ${env.toUpperCase()}環境
- **成功**: ${result.success ? 'はい' : 'いいえ'}
- **スキャンファイル数**: ${result.scannedFiles}個
- **移動ファイル数**: ${result.movedFiles}個
- **権限更新数**: ${result.permissionUpdates}個
- **処理時間**: ${Math.round(result.processingTime / 1000)}秒
- **エラー数**: ${result.errorCount}個
`).join('')}

## パフォーマンス分析
### スループット統計
- **ファイル処理速度**: ${performanceAnalysis.throughputStats.filesPerSecond.toFixed(2)}ファイル/秒
- **最大処理時間**: ${Math.round(performanceAnalysis.throughputStats.maxProcessingTime / 1000)}秒
- **最小処理時間**: ${Math.round(performanceAnalysis.throughputStats.minProcessingTime / 1000)}秒

### ボトルネック分析
${performanceAnalysis.bottlenecks.map(bottleneck => `
- **フェーズ**: ${bottleneck.phase}
- **処理時間**: ${Math.round(bottleneck.duration / 1000)}秒 (${bottleneck.percentage.toFixed(1)}%)
- **改善提案**: ${bottleneck.improvementSuggestion}
`).join('')}

## 推奨事項
${recommendations.map(rec => `
### ${rec.title} (${rec.priority.toUpperCase()})
- **カテゴリ**: ${rec.category}
- **説明**: ${rec.description}
- **実装方法**: ${rec.implementation}
- **期待効果**: ${rec.expectedBenefit}
`).join('')}

## エラー詳細
${executionResult.errors.length > 0 ?
            executionResult.errors.map(error => `
- **フェーズ**: ${error.phase}
- **環境**: ${error.environment || '全体'}
- **メッセージ**: ${error.message}
- **発生時刻**: ${error.timestamp.toLocaleString('ja-JP')}
`).join('') : '- エラーなし'}

## システム情報
- **プラットフォーム**: ${systemInfo.platform}
- **Node.jsバージョン**: ${systemInfo.nodeVersion}
- **作業ディレクトリ**: ${systemInfo.workingDirectory}
- **メモリ使用量**: ${Math.round(systemInfo.memoryUsage.heapUsed / 1024 / 1024)}MB

---
*このレポートは統合ファイル整理システムにより自動生成されました*
`;
    }
    /**
     * HTMLレポートを生成
     */
    generateHtmlReport(reportData) {
        // 実装簡略化
        return `<!DOCTYPE html>
<html>
<head>
    <title>統合ファイル整理システム レポート</title>
    <meta charset="utf-8">
</head>
<body>
    <h1>統合ファイル整理システム 実行レポート</h1>
    <p>実装簡略化</p>
</body>
</html>`;
    }
    /**
     * CSVレポートを生成
     */
    generateCsvReport(reportData) {
        // 実装簡略化
        return 'Environment,ScannedFiles,MovedFiles,ProcessingTime\n' +
            Object.entries(reportData.executionResult.environmentResults)
                .map(([env, result]) => `${env},${result.scannedFiles},${result.movedFiles},${result.processingTime}`)
                .join('\n');
    }
}
exports.ProgressReporter = ProgressReporter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZ3Jlc3MtcmVwb3J0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJwcm9ncmVzcy1yZXBvcnRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7R0FJRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxnREFBa0M7QUFDbEMsMkNBQTZCO0FBQzdCLG1DQUFzQztBQUN0QyxnREFJMkI7QUFrSTNCOzs7O0dBSUc7QUFDSCxNQUFhLGdCQUFpQixTQUFRLHFCQUFZO0lBQy9CLFlBQVksQ0FBZTtJQUMzQixjQUFjLENBQXdCO0lBQy9DLGVBQWUsQ0FBcUI7SUFDcEMsZUFBZSxHQUF3QixFQUFFLENBQUM7SUFDMUMsZ0JBQWdCLENBQWtCO0lBRTFDLFlBQ0UsZUFBNkI7UUFDM0IsZUFBZSxFQUFFLCtCQUErQjtRQUNoRCxPQUFPLEVBQUUsQ0FBQyxVQUFVLEVBQUUsTUFBTSxDQUFDO1FBQzdCLFdBQVcsRUFBRSxVQUFVO1FBQ3ZCLGFBQWEsRUFBRSxLQUFLO1FBQ3BCLFFBQVEsRUFBRSxJQUFJO0tBQ2YsRUFDRCxpQkFBd0M7UUFDdEMsSUFBSSxFQUFFLFNBQVM7UUFDZixjQUFjLEVBQUUsSUFBSTtRQUNwQixXQUFXLEVBQUUsSUFBSTtRQUNqQixTQUFTLEVBQUUsSUFBSTtLQUNoQjtRQUVELEtBQUssRUFBRSxDQUFDO1FBQ1IsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUM7UUFDakMsSUFBSSxDQUFDLGNBQWMsR0FBRyxjQUFjLENBQUM7SUFDdkMsQ0FBQztJQUVEOztPQUVHO0lBQ0kscUJBQXFCLENBQUMsZUFBa0M7UUFDN0QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUU3QixJQUFJLENBQUMsZUFBZSxHQUFHLGVBQWUsQ0FBQztRQUN2QyxJQUFJLENBQUMsZUFBZSxHQUFHLENBQUMsZUFBZSxDQUFDLENBQUM7UUFFekMsVUFBVTtRQUNWLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJ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QUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFHLEdBQUcsSUFBSSxNQUFNLENBQUMsWUFBWSxJQUFJLE1BQU0sQ0FBQyxVQUFVLElBQUksTUFBTSxDQUFDLGNBQWMsRUFBRSxDQUFDO2lCQUNyRyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDdkIsQ0FBQztDQUNGO0FBaGZELDRDQWdmQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog57Wx5ZCI44OV44Kh44Kk44Or5pW055CG44K344K544OG44OgIC0g6YCy5o2X566h55CG44O744Os44Od44O844OI5qmf6IO9XG4gKiBcbiAqIOODquOCouODq+OCv+OCpOODoOmAsuaNl+ihqOekuuOAgeWun+ihjOe1kOaenOODrOODneODvOODiOOAgee1seWQiOODrOODneODvOODiOeUn+aIkOapn+iDveOCkuaPkOS+m+OBl+OBvuOBmeOAglxuICovXG5cbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzL3Byb21pc2VzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xuaW1wb3J0IHsgXG4gIEVudmlyb25tZW50LFxuICBPcmdhbml6YXRpb25FcnJvcixcbiAgT3JnYW5pemF0aW9uRXJyb3JUeXBlXG59IGZyb20gJy4uL3R5cGVzL2luZGV4LmpzJztcbmltcG9ydCB7IEV4ZWN1dGlvblJlc3VsdCwgRXhlY3V0aW9uUHJvZ3Jlc3MsIEV4ZWN1dGlvblBoYXNlLCBFeGVjdXRpb25FcnJvciB9IGZyb20gJy4vaW50ZWdyYXRlZC1leGVjdXRpb24tZW5naW5lLmpzJztcblxuLyoqXG4gKiDjg6zjg53jg7zjg4joqK3lrppcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSZXBvcnRDb25maWcge1xuICAvKiog5Ye65Yqb44OH44Kj44Os44Kv44OI44OqICovXG4gIG91dHB1dERpcmVjdG9yeTogc3RyaW5nO1xuICAvKiog44Os44Od44O844OI5b2i5byPICovXG4gIGZvcm1hdHM6IFJlcG9ydEZvcm1hdFtdO1xuICAvKiog6Kmz57Sw44Os44OZ44OrICovXG4gIGRldGFpbExldmVsOiAnc3VtbWFyeScgfCAnZGV0YWlsZWQnIHwgJ3ZlcmJvc2UnO1xuICAvKiog55S75YOP44KS5ZCr44KB44KL44GLICovXG4gIGluY2x1ZGVDaGFydHM6IGJvb2xlYW47XG4gIC8qKiDoh6rli5Xkv53lrZjjgZnjgovjgYsgKi9cbiAgYXV0b1NhdmU6IGJvb2xlYW47XG59XG5cbi8qKlxuICog44Os44Od44O844OI5b2i5byPXG4gKi9cbmV4cG9ydCB0eXBlIFJlcG9ydEZvcm1hdCA9ICdtYXJrZG93bicgfCAnaHRtbCcgfCAnanNvbicgfCAnY3N2JztcblxuLyoqXG4gKiDpgLLmjZfooajnpLroqK3lrppcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQcm9ncmVzc0Rpc3BsYXlDb25maWcge1xuICAvKiog6KGo56S644Oi44O844OJICovXG4gIG1vZGU6ICdjb25zb2xlJyB8ICdmaWxlJyB8ICdib3RoJztcbiAgLyoqIOabtOaWsOmWk+malO+8iOODn+ODquenku+8iSAqL1xuICB1cGRhdGVJbnRlcnZhbDogbnVtYmVyO1xuICAvKiog6Kmz57Sw6KGo56S644GZ44KL44GLICovXG4gIHNob3dEZXRhaWxzOiBib29sZWFuO1xuICAvKiog44Kr44Op44O86KGo56S644GZ44KL44GLICovXG4gIHVzZUNvbG9yczogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiDjg6zjg53jg7zjg4jjg4fjg7zjgr9cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSZXBvcnREYXRhIHtcbiAgLyoqIOWun+ihjOe1kOaenCAqL1xuICBleGVjdXRpb25SZXN1bHQ6IEV4ZWN1dGlvblJlc3VsdDtcbiAgLyoqIOOCt+OCueODhuODoOaDheWgsSAqL1xuICBzeXN0ZW1JbmZvOiBTeXN0ZW1JbmZvO1xuICAvKiog44OR44OV44Kp44O844Oe44Oz44K55YiG5p6QICovXG4gIHBlcmZvcm1hbmNlQW5hbHlzaXM6IFBlcmZvcm1hbmNlQW5hbHlzaXM7XG4gIC8qKiDmjqjlpajkuovpoIUgKi9cbiAgcmVjb21tZW5kYXRpb25zOiBSZWNvbW1lbmRhdGlvbltdO1xufVxuXG4vKipcbiAqIOOCt+OCueODhuODoOaDheWgsVxuICovXG5leHBvcnQgaW50ZXJmYWNlIFN5c3RlbUluZm8ge1xuICAvKiogT1Pmg4XloLEgKi9cbiAgcGxhdGZvcm06IHN0cmluZztcbiAgLyoqIE5vZGUuanPjg5Djg7zjgrjjg6fjg7MgKi9cbiAgbm9kZVZlcnNpb246IHN0cmluZztcbiAgLyoqIOODoeODouODquS9v+eUqOmHjyAqL1xuICBtZW1vcnlVc2FnZTogTm9kZUpTLk1lbW9yeVVzYWdlO1xuICAvKiog5a6f6KGM5pmC5Yi7ICovXG4gIGV4ZWN1dGlvblRpbWU6IERhdGU7XG4gIC8qKiDkvZzmpa3jg4fjgqPjg6zjgq/jg4jjg6ogKi9cbiAgd29ya2luZ0RpcmVjdG9yeTogc3RyaW5nO1xufVxuXG4vKipcbiAqIOODkeODleOCqeODvOODnuODs+OCueWIhuaekFxuICovXG5leHBvcnQgaW50ZXJmYWNlIFBlcmZvcm1hbmNlQW5hbHlzaXMge1xuICAvKiog44OV44Kn44O844K65Yil5Yem55CG5pmC6ZaTICovXG4gIHBoYXNlVGltaW5nczogUmVjb3JkPEV4ZWN1dGlvblBoYXNlLCBudW1iZXI+O1xuICAvKiog55Kw5aKD5Yil5Yem55CG5pmC6ZaTICovXG4gIGVudmlyb25tZW50VGltaW5nczogUmVjb3JkPEVudmlyb25tZW50LCBudW1iZXI+O1xuICAvKiog44Oc44OI44Or44ON44OD44Kv5YiG5p6QICovXG4gIGJvdHRsZW5lY2tzOiBCb3R0bGVuZWNrQW5hbHlzaXNbXTtcbiAgLyoqIOOCueODq+ODvOODl+ODg+ODiOe1seioiCAqL1xuICB0aHJvdWdocHV0U3RhdHM6IFRocm91Z2hwdXRTdGF0cztcbn1cblxuLyoqXG4gKiDjg5zjg4jjg6vjg43jg4Pjgq/liIbmnpBcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBCb3R0bGVuZWNrQW5hbHlzaXMge1xuICAvKiog44OV44Kn44O844K6ICovXG4gIHBoYXNlOiBFeGVjdXRpb25QaGFzZTtcbiAgLyoqIOWHpueQhuaZgumWkyAqL1xuICBkdXJhdGlvbjogbnVtYmVyO1xuICAvKiog5YWo5L2T44Gr5Y2g44KB44KL5Ymy5ZCIICovXG4gIHBlcmNlbnRhZ2U6IG51bWJlcjtcbiAgLyoqIOaUueWWhOaPkOahiCAqL1xuICBpbXByb3ZlbWVudFN1Z2dlc3Rpb246IHN0cmluZztcbn1cblxuLyoqXG4gKiDjgrnjg6vjg7zjg5fjg4Pjg4jntbHoqIhcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBUaHJvdWdocHV0U3RhdHMge1xuICAvKiog44OV44Kh44Kk44Or5Yem55CG6YCf5bqm77yI44OV44Kh44Kk44OrL+enku+8iSAqL1xuICBmaWxlc1BlclNlY29uZDogbnVtYmVyO1xuICAvKiog44OH44O844K/5Yem55CG6YCf5bqm77yITUIv56eS77yJICovXG4gIG1iUGVyU2Vjb25kOiBudW1iZXI7XG4gIC8qKiDlubPlnYfjg5XjgqHjgqTjg6vjgrXjgqTjgrogKi9cbiAgYXZlcmFnZUZpbGVTaXplOiBudW1iZXI7XG4gIC8qKiDmnIDlpKflh6bnkIbmmYLplpMgKi9cbiAgbWF4UHJvY2Vzc2luZ1RpbWU6IG51bWJlcjtcbiAgLyoqIOacgOWwj+WHpueQhuaZgumWkyAqL1xuICBtaW5Qcm9jZXNzaW5nVGltZTogbnVtYmVyO1xufVxuXG4vKipcbiAqIOaOqOWlqOS6i+mghVxuICovXG5leHBvcnQgaW50ZXJmYWNlIFJlY29tbWVuZGF0aW9uIHtcbiAgLyoqIOOCq+ODhuOCtOODqiAqL1xuICBjYXRlZ29yeTogJ3BlcmZvcm1hbmNlJyB8ICdzZWN1cml0eScgfCAnbWFpbnRlbmFuY2UnIHwgJ3N0cnVjdHVyZSc7XG4gIC8qKiDlhKrlhYjluqYgKi9cbiAgcHJpb3JpdHk6ICdsb3cnIHwgJ21lZGl1bScgfCAnaGlnaCcgfCAnY3JpdGljYWwnO1xuICAvKiog44K/44Kk44OI44OrICovXG4gIHRpdGxlOiBzdHJpbmc7XG4gIC8qKiDoqqzmmI4gKi9cbiAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgLyoqIOWun+ijheaWueazlSAqL1xuICBpbXBsZW1lbnRhdGlvbjogc3RyaW5nO1xuICAvKiog5pyf5b6F5Yq55p6cICovXG4gIGV4cGVjdGVkQmVuZWZpdDogc3RyaW5nO1xufVxuXG4vKipcbiAqIOmAsuaNl+euoeeQhuODu+ODrOODneODvOODiOapn+iDvVxuICogXG4gKiDjg6rjgqLjg6vjgr/jgqTjg6DpgLLmjZfooajnpLrjgajljIXmi6znmoTjgarjg6zjg53jg7zjg4jnlJ/miJDjgpLmj5DkvpvjgZfjgb7jgZnjgIJcbiAqL1xuZXhwb3J0IGNsYXNzIFByb2dyZXNzUmVwb3J0ZXIgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICBwcml2YXRlIHJlYWRvbmx5IHJlcG9ydENvbmZpZzogUmVwb3J0Q29uZmlnO1xuICBwcml2YXRlIHJlYWRvbmx5IHByb2dyZXNzQ29uZmlnOiBQcm9ncmVzc0Rpc3BsYXlDb25maWc7XG4gIHByaXZhdGUgY3VycmVudFByb2dyZXNzPzogRXhlY3V0aW9uUHJvZ3Jlc3M7XG4gIHByaXZhdGUgcHJvZ3Jlc3NIaXN0b3J5OiBFeGVjdXRpb25Qcm9ncmVzc1tdID0gW107XG4gIHByaXZhdGUgcHJvZ3Jlc3NJbnRlcnZhbD86IE5vZGVKUy5UaW1lb3V0O1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHJlcG9ydENvbmZpZzogUmVwb3J0Q29uZmlnID0ge1xuICAgICAgb3V0cHV0RGlyZWN0b3J5OiAnZGV2ZWxvcG1lbnQvbG9ncy9vcmdhbml6YXRpb24nLFxuICAgICAgZm9ybWF0czogWydtYXJrZG93bicsICdqc29uJ10sXG4gICAgICBkZXRhaWxMZXZlbDogJ2RldGFpbGVkJyxcbiAgICAgIGluY2x1ZGVDaGFydHM6IGZhbHNlLFxuICAgICAgYXV0b1NhdmU6IHRydWVcbiAgICB9LFxuICAgIHByb2dyZXNzQ29uZmlnOiBQcm9ncmVzc0Rpc3BsYXlDb25maWcgPSB7XG4gICAgICBtb2RlOiAnY29uc29sZScsXG4gICAgICB1cGRhdGVJbnRlcnZhbDogMTAwMCxcbiAgICAgIHNob3dEZXRhaWxzOiB0cnVlLFxuICAgICAgdXNlQ29sb3JzOiB0cnVlXG4gICAgfVxuICApIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMucmVwb3J0Q29uZmlnID0gcmVwb3J0Q29uZmlnO1xuICAgIHRoaXMucHJvZ3Jlc3NDb25maWcgPSBwcm9ncmVzc0NvbmZpZztcbiAgfVxuXG4gIC8qKlxuICAgKiDpgLLmjZfov73ot6HjgpLplovlp4tcbiAgICovXG4gIHB1YmxpYyBzdGFydFByb2dyZXNzVHJhY2tpbmcoaW5pdGlhbFByb2dyZXNzOiBFeGVjdXRpb25Qcm9ncmVzcyk6IHZvaWQge1xuICAgIGNvbnNvbGUubG9nKCfwn5OKIOmAsuaNl+i/vei3oeOCkumWi+Wniy4uLicpO1xuICAgIFxuICAgIHRoaXMuY3VycmVudFByb2dyZXNzID0gaW5pdGlhbFByb2dyZXNzO1xuICAgIHRoaXMucHJvZ3Jlc3NIaXN0b3J5ID0gW2luaXRpYWxQcm9ncmVzc107XG5cbiAgICAvLyDpgLLmjZfooajnpLrjga7plovlp4tcbiAgICBpZiAodGhpcy5wcm9ncmVzc0NvbmZpZy5tb2RlID09PSAnY29uc29sZScgfHwgdGhpcy5wcm9ncmVzc0NvbmZpZy5tb2RlID09PSAnYm90aCcpIHtcbiAgICAgIHRoaXMuc3RhcnRDb25zb2xlUHJvZ3Jlc3MoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5wcm9ncmVzc0NvbmZpZy5tb2RlID09PSAnZmlsZScgfHwgdGhpcy5wcm9ncmVzc0NvbmZpZy5tb2RlID09PSAnYm90aCcpIHtcbiAgICAgIHRoaXMuc3RhcnRGaWxlUHJvZ3Jlc3MoKTtcbiAgICB9XG5cbiAgICB0aGlzLmVtaXQoJ3Byb2dyZXNzOnN0YXJ0ZWQnLCBpbml0aWFsUHJvZ3Jlc3MpO1xuICB9XG5cbiAgLyoqXG4gICAqIOmAsuaNl+OCkuabtOaWsFxuICAgKi9cbiAgcHVibGljIHVwZGF0ZVByb2dyZXNzKHByb2dyZXNzOiBFeGVjdXRpb25Qcm9ncmVzcyk6IHZvaWQge1xuICAgIHRoaXMuY3VycmVudFByb2dyZXNzID0gcHJvZ3Jlc3M7XG4gICAgdGhpcy5wcm9ncmVzc0hpc3RvcnkucHVzaChwcm9ncmVzcyk7XG5cbiAgICAvLyDpgLLmjZfooajnpLrjgpLmm7TmlrBcbiAgICB0aGlzLmRpc3BsYXlQcm9ncmVzcyhwcm9ncmVzcyk7XG5cbiAgICB0aGlzLmVtaXQoJ3Byb2dyZXNzOnVwZGF0ZWQnLCBwcm9ncmVzcyk7XG4gIH1cblxuICAvKipcbiAgICog6YCy5o2X6L+96Leh44KS5YGc5q2iXG4gICAqL1xuICBwdWJsaWMgc3RvcFByb2dyZXNzVHJhY2tpbmcoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMucHJvZ3Jlc3NJbnRlcnZhbCkge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnByb2dyZXNzSW50ZXJ2YWwpO1xuICAgICAgdGhpcy5wcm9ncmVzc0ludGVydmFsID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCdcXG7inIUg6YCy5o2X6L+96Leh44KS5YGc5q2iJyk7XG4gICAgdGhpcy5lbWl0KCdwcm9ncmVzczpzdG9wcGVkJyk7XG4gIH1cblxuICAvKipcbiAgICog57Wx5ZCI44Os44Od44O844OI44KS55Sf5oiQXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgZ2VuZXJhdGVJbnRlZ3JhdGVkUmVwb3J0KGV4ZWN1dGlvblJlc3VsdDogRXhlY3V0aW9uUmVzdWx0KTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgIGNvbnNvbGUubG9nKCfwn5OLIOe1seWQiOODrOODneODvOODiOOCkueUn+aIkOS4rS4uLicpO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIOWHuuWKm+ODh+OCo+ODrOOCr+ODiOODquOCkuS9nOaIkFxuICAgICAgYXdhaXQgZnMubWtkaXIodGhpcy5yZXBvcnRDb25maWcub3V0cHV0RGlyZWN0b3J5LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblxuICAgICAgLy8g44Os44Od44O844OI44OH44O844K/44KS5rqW5YKZXG4gICAgICBjb25zdCByZXBvcnREYXRhID0gYXdhaXQgdGhpcy5wcmVwYXJlUmVwb3J0RGF0YShleGVjdXRpb25SZXN1bHQpO1xuXG4gICAgICAvLyDlvaLlvI/liKXjgavjg6zjg53jg7zjg4jjgpLnlJ/miJBcbiAgICAgIGNvbnN0IGdlbmVyYXRlZEZpbGVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgICBmb3IgKGNvbnN0IGZvcm1hdCBvZiB0aGlzLnJlcG9ydENvbmZpZy5mb3JtYXRzKSB7XG4gICAgICAgIGNvbnN0IGZpbGVQYXRoID0gYXdhaXQgdGhpcy5nZW5lcmF0ZVJlcG9ydEJ5Rm9ybWF0KHJlcG9ydERhdGEsIGZvcm1hdCk7XG4gICAgICAgIGdlbmVyYXRlZEZpbGVzLnB1c2goZmlsZVBhdGgpO1xuICAgICAgfVxuXG4gICAgICBjb25zb2xlLmxvZyhg4pyFIOe1seWQiOODrOODneODvOODiOeUn+aIkOWujOS6hjogJHtnZW5lcmF0ZWRGaWxlcy5sZW5ndGh95YCL44Gu44OV44Kh44Kk44OrYCk7XG4gICAgICByZXR1cm4gZ2VuZXJhdGVkRmlsZXM7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgT3JnYW5pemF0aW9uRXJyb3JUeXBlLlJFUE9SVF9HRU5FUkFUSU9OX0ZBSUxFRCxcbiAgICAgICAgYOe1seWQiOODrOODneODvOODiOeUn+aIkOOBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtlcnJvcn1gLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgZXJyb3IgYXMgRXJyb3JcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODquOCouODq+OCv+OCpOODoOmAsuaNl+ihqOekulxuICAgKi9cbiAgcHJpdmF0ZSBkaXNwbGF5UHJvZ3Jlc3MocHJvZ3Jlc3M6IEV4ZWN1dGlvblByb2dyZXNzKTogdm9pZCB7XG4gICAgaWYgKHRoaXMucHJvZ3Jlc3NDb25maWcubW9kZSA9PT0gJ2NvbnNvbGUnIHx8IHRoaXMucHJvZ3Jlc3NDb25maWcubW9kZSA9PT0gJ2JvdGgnKSB7XG4gICAgICB0aGlzLmRpc3BsYXlDb25zb2xlUHJvZ3Jlc3MocHJvZ3Jlc3MpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjgrPjg7Pjgr3jg7zjg6vpgLLmjZfooajnpLpcbiAgICovXG4gIHByaXZhdGUgZGlzcGxheUNvbnNvbGVQcm9ncmVzcyhwcm9ncmVzczogRXhlY3V0aW9uUHJvZ3Jlc3MpOiB2b2lkIHtcbiAgICBjb25zdCBjb2xvcnMgPSB0aGlzLnByb2dyZXNzQ29uZmlnLnVzZUNvbG9ycztcbiAgICBcbiAgICAvLyDpgLLmjZfjg5Djg7zjgpLnlJ/miJBcbiAgICBjb25zdCBwcm9ncmVzc0JhciA9IHRoaXMuZ2VuZXJhdGVQcm9ncmVzc0Jhcihwcm9ncmVzcy5vdmVyYWxsUHJvZ3Jlc3MsIDQwKTtcbiAgICBcbiAgICAvLyDmmYLplpPmg4XloLHjgpLoqIjnrpdcbiAgICBjb25zdCBlbGFwc2VkID0gRGF0ZS5ub3coKSAtIHByb2dyZXNzLnN0YXJ0VGltZS5nZXRUaW1lKCk7XG4gICAgY29uc3QgZWxhcHNlZFN0ciA9IHRoaXMuZm9ybWF0RHVyYXRpb24oZWxhcHNlZCk7XG4gICAgY29uc3QgcmVtYWluaW5nU3RyID0gcHJvZ3Jlc3MuZXN0aW1hdGVkVGltZVJlbWFpbmluZyA/IFxuICAgICAgdGhpcy5mb3JtYXREdXJhdGlvbihwcm9ncmVzcy5lc3RpbWF0ZWRUaW1lUmVtYWluaW5nKSA6ICfkuI3mmI4nO1xuXG4gICAgLy8g6YCy5o2X5oOF5aCx44KS6KGo56S6XG4gICAgY29uc3QgcGhhc2VDb2xvciA9IGNvbG9ycyA/IHRoaXMuZ2V0UGhhc2VDb2xvcihwcm9ncmVzcy5jdXJyZW50UGhhc2UpIDogJyc7XG4gICAgY29uc3QgcmVzZXRDb2xvciA9IGNvbG9ycyA/ICdcXHgxYlswbScgOiAnJztcbiAgICBcbiAgICBwcm9jZXNzLnN0ZG91dC53cml0ZSgnXFxyXFx4MWJbSycpOyAvLyDooYzjgpLjgq/jg6rjgqJcbiAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShcbiAgICAgIGAke3BoYXNlQ29sb3J9JHtwcm9ncmVzcy5jdXJyZW50UGhhc2V9JHtyZXNldENvbG9yfSBgICtcbiAgICAgIGAke3Byb2dyZXNzQmFyfSAke3Byb2dyZXNzLm92ZXJhbGxQcm9ncmVzcy50b0ZpeGVkKDEpfSUgYCArXG4gICAgICBgKCR7cHJvZ3Jlc3MucHJvY2Vzc2VkRmlsZXN9LyR7cHJvZ3Jlc3MudG90YWxGaWxlc30pIGAgK1xuICAgICAgYOe1jOmBjjogJHtlbGFwc2VkU3RyfSDmrovjgoo6ICR7cmVtYWluaW5nU3RyfWBcbiAgICApO1xuXG4gICAgLy8g6Kmz57Sw5oOF5aCx44KS6KGo56S6XG4gICAgaWYgKHRoaXMucHJvZ3Jlc3NDb25maWcuc2hvd0RldGFpbHMgJiYgcHJvZ3Jlc3MuY3VycmVudEZpbGUpIHtcbiAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKGBcXG4gIPCfk4QgJHtwcm9ncmVzcy5jdXJyZW50RmlsZX1gKTtcbiAgICB9XG5cbiAgICAvLyDjgqjjg6njg7zjg7vorablkYrmg4XloLHjgpLooajnpLpcbiAgICBpZiAocHJvZ3Jlc3MuZXJyb3JDb3VudCA+IDAgfHwgcHJvZ3Jlc3Mud2FybmluZ0NvdW50ID4gMCkge1xuICAgICAgY29uc3QgZXJyb3JDb2xvciA9IGNvbG9ycyA/ICdcXHgxYlszMW0nIDogJyc7XG4gICAgICBjb25zdCB3YXJuQ29sb3IgPSBjb2xvcnMgPyAnXFx4MWJbMzNtJyA6ICcnO1xuICAgICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoXG4gICAgICAgIGBcXG4gICR7ZXJyb3JDb2xvcn3jgqjjg6njg7w6ICR7cHJvZ3Jlc3MuZXJyb3JDb3VudH0ke3Jlc2V0Q29sb3J9IGAgK1xuICAgICAgICBgJHt3YXJuQ29sb3J96K2m5ZGKOiAke3Byb2dyZXNzLndhcm5pbmdDb3VudH0ke3Jlc2V0Q29sb3J9YFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog6YCy5o2X44OQ44O844KS55Sf5oiQXG4gICAqL1xuICBwcml2YXRlIGdlbmVyYXRlUHJvZ3Jlc3NCYXIocGVyY2VudGFnZTogbnVtYmVyLCB3aWR0aDogbnVtYmVyKTogc3RyaW5nIHtcbiAgICBjb25zdCBmaWxsZWQgPSBNYXRoLnJvdW5kKChwZXJjZW50YWdlIC8gMTAwKSAqIHdpZHRoKTtcbiAgICBjb25zdCBlbXB0eSA9IHdpZHRoIC0gZmlsbGVkO1xuICAgIFxuICAgIHJldHVybiBgWyR7J+KWiCcucmVwZWF0KGZpbGxlZCl9JHsnICcucmVwZWF0KGVtcHR5KX1dYDtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg5Xjgqfjg7zjgrrjga7oibLjgpLlj5blvpdcbiAgICovXG4gIHByaXZhdGUgZ2V0UGhhc2VDb2xvcihwaGFzZTogRXhlY3V0aW9uUGhhc2UpOiBzdHJpbmcge1xuICAgIGNvbnN0IGNvbG9yczogUmVjb3JkPEV4ZWN1dGlvblBoYXNlLCBzdHJpbmc+ID0ge1xuICAgICAgJ2luaXRpYWxpemluZyc6ICdcXHgxYlszNm0nLCAgICAvLyDjgrfjgqLjg7NcbiAgICAgICdzY2FubmluZyc6ICdcXHgxYlszNG0nLCAgICAgICAgLy8g6Z2SXG4gICAgICAnY2xhc3NpZnlpbmcnOiAnXFx4MWJbMzVtJywgICAgIC8vIOODnuOCvOODs+OCv1xuICAgICAgJ2NyZWF0aW5nX2RpcmVjdG9yaWVzJzogJ1xceDFiWzMzbScsIC8vIOm7hFxuICAgICAgJ2NyZWF0aW5nX2JhY2t1cCc6ICdcXHgxYlszMm0nLCAvLyDnt5FcbiAgICAgICdtb3ZpbmdfZmlsZXMnOiAnXFx4MWJbMzZtJywgICAgLy8g44K344Ki44OzXG4gICAgICAnc2V0dGluZ19wZXJtaXNzaW9ucyc6ICdcXHgxYlszNW0nLCAvLyDjg57jgrzjg7Pjgr9cbiAgICAgICdzeW5jaW5nJzogJ1xceDFiWzM0bScsICAgICAgICAgLy8g6Z2SXG4gICAgICAndmFsaWRhdGluZyc6ICdcXHgxYlszM20nLCAgICAgIC8vIOm7hFxuICAgICAgJ2dlbmVyYXRpbmdfcmVwb3J0JzogJ1xceDFiWzMybScsIC8vIOe3kVxuICAgICAgJ2NvbXBsZXRlZCc6ICdcXHgxYlszMm0nLCAgICAgICAvLyDnt5FcbiAgICAgICdmYWlsZWQnOiAnXFx4MWJbMzFtJyAgICAgICAgICAgLy8g6LWkXG4gICAgfTtcbiAgICBcbiAgICByZXR1cm4gY29sb3JzW3BoYXNlXSB8fCAnXFx4MWJbMzdtJzsgLy8g44OH44OV44Kp44Or44OI44Gv55m9XG4gIH1cblxuICAvKipcbiAgICog5pmC6ZaT44KS44OV44Kp44O844Oe44OD44OIXG4gICAqL1xuICBwcml2YXRlIGZvcm1hdER1cmF0aW9uKG1pbGxpc2Vjb25kczogbnVtYmVyKTogc3RyaW5nIHtcbiAgICBjb25zdCBzZWNvbmRzID0gTWF0aC5mbG9vcihtaWxsaXNlY29uZHMgLyAxMDAwKTtcbiAgICBjb25zdCBtaW51dGVzID0gTWF0aC5mbG9vcihzZWNvbmRzIC8gNjApO1xuICAgIGNvbnN0IGhvdXJzID0gTWF0aC5mbG9vcihtaW51dGVzIC8gNjApO1xuXG4gICAgaWYgKGhvdXJzID4gMCkge1xuICAgICAgcmV0dXJuIGAke2hvdXJzfWggJHttaW51dGVzICUgNjB9bSAke3NlY29uZHMgJSA2MH1zYDtcbiAgICB9IGVsc2UgaWYgKG1pbnV0ZXMgPiAwKSB7XG4gICAgICByZXR1cm4gYCR7bWludXRlc31tICR7c2Vjb25kcyAlIDYwfXNgO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gYCR7c2Vjb25kc31zYDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44Kz44Oz44K944O844Or6YCy5o2X44KS6ZaL5aeLXG4gICAqL1xuICBwcml2YXRlIHN0YXJ0Q29uc29sZVByb2dyZXNzKCk6IHZvaWQge1xuICAgIHRoaXMucHJvZ3Jlc3NJbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmN1cnJlbnRQcm9ncmVzcykge1xuICAgICAgICB0aGlzLmRpc3BsYXlDb25zb2xlUHJvZ3Jlc3ModGhpcy5jdXJyZW50UHJvZ3Jlc3MpO1xuICAgICAgfVxuICAgIH0sIHRoaXMucHJvZ3Jlc3NDb25maWcudXBkYXRlSW50ZXJ2YWwpO1xuICB9XG5cbiAgLyoqXG4gICAqIOODleOCoeOCpOODq+mAsuaNl+OCkumWi+Wni1xuICAgKi9cbiAgcHJpdmF0ZSBzdGFydEZpbGVQcm9ncmVzcygpOiB2b2lkIHtcbiAgICAvLyDlrp/oo4XnsKHnlaXljJZcbiAgfVxuXG4gIC8qKlxuICAgKiDjg6zjg53jg7zjg4jjg4fjg7zjgr/jgpLmupblgplcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgcHJlcGFyZVJlcG9ydERhdGEoZXhlY3V0aW9uUmVzdWx0OiBFeGVjdXRpb25SZXN1bHQpOiBQcm9taXNlPFJlcG9ydERhdGE+IHtcbiAgICBjb25zdCBzeXN0ZW1JbmZvOiBTeXN0ZW1JbmZvID0ge1xuICAgICAgcGxhdGZvcm06IHByb2Nlc3MucGxhdGZvcm0sXG4gICAgICBub2RlVmVyc2lvbjogcHJvY2Vzcy52ZXJzaW9uLFxuICAgICAgbWVtb3J5VXNhZ2U6IHByb2Nlc3MubWVtb3J5VXNhZ2UoKSxcbiAgICAgIGV4ZWN1dGlvblRpbWU6IGV4ZWN1dGlvblJlc3VsdC5zdGFydFRpbWUsXG4gICAgICB3b3JraW5nRGlyZWN0b3J5OiBwcm9jZXNzLmN3ZCgpXG4gICAgfTtcblxuICAgIGNvbnN0IHBlcmZvcm1hbmNlQW5hbHlzaXMgPSB0aGlzLmFuYWx5emVQZXJmb3JtYW5jZShleGVjdXRpb25SZXN1bHQpO1xuICAgIGNvbnN0IHJlY29tbWVuZGF0aW9ucyA9IHRoaXMuZ2VuZXJhdGVSZWNvbW1lbmRhdGlvbnMoZXhlY3V0aW9uUmVzdWx0KTtcblxuICAgIHJldHVybiB7XG4gICAgICBleGVjdXRpb25SZXN1bHQsXG4gICAgICBzeXN0ZW1JbmZvLFxuICAgICAgcGVyZm9ybWFuY2VBbmFseXNpcyxcbiAgICAgIHJlY29tbWVuZGF0aW9uc1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog44OR44OV44Kp44O844Oe44Oz44K55YiG5p6Q44KS5a6f6KGMXG4gICAqL1xuICBwcml2YXRlIGFuYWx5emVQZXJmb3JtYW5jZShleGVjdXRpb25SZXN1bHQ6IEV4ZWN1dGlvblJlc3VsdCk6IFBlcmZvcm1hbmNlQW5hbHlzaXMge1xuICAgIC8vIOODleOCp+ODvOOCuuWIpeWHpueQhuaZgumWk++8iOewoeeVpeWMlu+8iVxuICAgIGNvbnN0IHBoYXNlVGltaW5nczogUmVjb3JkPEV4ZWN1dGlvblBoYXNlLCBudW1iZXI+ID0ge30gYXMgYW55O1xuICAgIFxuICAgIC8vIOeSsOWig+WIpeWHpueQhuaZgumWk1xuICAgIGNvbnN0IGVudmlyb25tZW50VGltaW5nczogUmVjb3JkPEVudmlyb25tZW50LCBudW1iZXI+ID0ge30gYXMgYW55O1xuICAgIGZvciAoY29uc3QgW2VudiwgcmVzdWx0XSBvZiBPYmplY3QuZW50cmllcyhleGVjdXRpb25SZXN1bHQuZW52aXJvbm1lbnRSZXN1bHRzKSkge1xuICAgICAgZW52aXJvbm1lbnRUaW1pbmdzW2VudiBhcyBFbnZpcm9ubWVudF0gPSByZXN1bHQucHJvY2Vzc2luZ1RpbWU7XG4gICAgfVxuXG4gICAgLy8g44Oc44OI44Or44ON44OD44Kv5YiG5p6QXG4gICAgY29uc3QgYm90dGxlbmVja3M6IEJvdHRsZW5lY2tBbmFseXNpc1tdID0gW107XG4gICAgY29uc3QgbWF4VGltZSA9IE1hdGgubWF4KC4uLk9iamVjdC52YWx1ZXMoZW52aXJvbm1lbnRUaW1pbmdzKSk7XG4gICAgXG4gICAgZm9yIChjb25zdCBbZW52LCB0aW1lXSBvZiBPYmplY3QuZW50cmllcyhlbnZpcm9ubWVudFRpbWluZ3MpKSB7XG4gICAgICBpZiAodGltZSA9PT0gbWF4VGltZSkge1xuICAgICAgICBib3R0bGVuZWNrcy5wdXNoKHtcbiAgICAgICAgICBwaGFzZTogJ21vdmluZ19maWxlcycsIC8vIOewoeeVpeWMllxuICAgICAgICAgIGR1cmF0aW9uOiB0aW1lLFxuICAgICAgICAgIHBlcmNlbnRhZ2U6ICh0aW1lIC8gZXhlY3V0aW9uUmVzdWx0LnRvdGFsUHJvY2Vzc2luZ1RpbWUpICogMTAwLFxuICAgICAgICAgIGltcHJvdmVtZW50U3VnZ2VzdGlvbjogYCR7ZW52feeSsOWig+OBruWHpueQhuOCkuacgOmBqeWMluOBmeOCi+OBk+OBqOOBp+WFqOS9k+OBruWHpueQhuaZgumWk+OCkuefree4ruOBp+OBjeOBvuOBmWBcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8g44K544Or44O844OX44OD44OI57Wx6KiIXG4gICAgY29uc3QgdG90YWxGaWxlcyA9IGV4ZWN1dGlvblJlc3VsdC5vdmVyYWxsU3RhdGlzdGljcy50b3RhbFNjYW5uZWRGaWxlcztcbiAgICBjb25zdCB0b3RhbFRpbWUgPSBleGVjdXRpb25SZXN1bHQudG90YWxQcm9jZXNzaW5nVGltZSAvIDEwMDA7IC8vIOenkuOBq+WkieaPm1xuICAgIFxuICAgIGNvbnN0IHRocm91Z2hwdXRTdGF0czogVGhyb3VnaHB1dFN0YXRzID0ge1xuICAgICAgZmlsZXNQZXJTZWNvbmQ6IHRvdGFsRmlsZXMgLyB0b3RhbFRpbWUsXG4gICAgICBtYlBlclNlY29uZDogMCwgLy8g5a6f6KOF57Ch55Wl5YyWXG4gICAgICBhdmVyYWdlRmlsZVNpemU6IDAsIC8vIOWun+ijheewoeeVpeWMllxuICAgICAgbWF4UHJvY2Vzc2luZ1RpbWU6IG1heFRpbWUsXG4gICAgICBtaW5Qcm9jZXNzaW5nVGltZTogTWF0aC5taW4oLi4uT2JqZWN0LnZhbHVlcyhlbnZpcm9ubWVudFRpbWluZ3MpKVxuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgcGhhc2VUaW1pbmdzLFxuICAgICAgZW52aXJvbm1lbnRUaW1pbmdzLFxuICAgICAgYm90dGxlbmVja3MsXG4gICAgICB0aHJvdWdocHV0U3RhdHNcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOaOqOWlqOS6i+mgheOCkueUn+aIkFxuICAgKi9cbiAgcHJpdmF0ZSBnZW5lcmF0ZVJlY29tbWVuZGF0aW9ucyhleGVjdXRpb25SZXN1bHQ6IEV4ZWN1dGlvblJlc3VsdCk6IFJlY29tbWVuZGF0aW9uW10ge1xuICAgIGNvbnN0IHJlY29tbWVuZGF0aW9uczogUmVjb21tZW5kYXRpb25bXSA9IFtdO1xuXG4gICAgLy8g44Ko44Op44O844GM5aSa44GE5aC05ZCI44Gu5o6o5aWo5LqL6aCFXG4gICAgaWYgKGV4ZWN1dGlvblJlc3VsdC5lcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgcmVjb21tZW5kYXRpb25zLnB1c2goe1xuICAgICAgICBjYXRlZ29yeTogJ21haW50ZW5hbmNlJyxcbiAgICAgICAgcHJpb3JpdHk6ICdoaWdoJyxcbiAgICAgICAgdGl0bGU6ICfjgqjjg6njg7zjga7op6PmsbonLFxuICAgICAgICBkZXNjcmlwdGlvbjogYCR7ZXhlY3V0aW9uUmVzdWx0LmVycm9ycy5sZW5ndGh95YCL44Gu44Ko44Op44O844GM55m655Sf44GX44G+44GX44GfYCxcbiAgICAgICAgaW1wbGVtZW50YXRpb246ICfjgqjjg6njg7zjg63jgrDjgpLnorroqo3jgZfjgIHmoLnmnKzljp/lm6DjgpLnibnlrprjgZfjgabkv67mraPjgZfjgabjgY/jgaDjgZXjgYQnLFxuICAgICAgICBleHBlY3RlZEJlbmVmaXQ6ICflrp/ooYzmiJDlip/njofjga7lkJHkuIrjgajlronlrprmgKfjga7norrkv50nXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyDmp4vpgKDmupbmi6DnjofjgYzkvY7jgYTloLTlkIhcbiAgICBpZiAoZXhlY3V0aW9uUmVzdWx0Lm92ZXJhbGxTdGF0aXN0aWNzLnN0cnVjdHVyZUNvbXBsaWFuY2VSYXRlIDwgOTApIHtcbiAgICAgIHJlY29tbWVuZGF0aW9ucy5wdXNoKHtcbiAgICAgICAgY2F0ZWdvcnk6ICdzdHJ1Y3R1cmUnLFxuICAgICAgICBwcmlvcml0eTogJ21lZGl1bScsXG4gICAgICAgIHRpdGxlOiAn44OH44Kj44Os44Kv44OI44Oq5qeL6YCg44Gu5pS55ZaEJyxcbiAgICAgICAgZGVzY3JpcHRpb246IGDmp4vpgKDmupbmi6DnjofjgYwke2V4ZWN1dGlvblJlc3VsdC5vdmVyYWxsU3RhdGlzdGljcy5zdHJ1Y3R1cmVDb21wbGlhbmNlUmF0ZX0l44Gn44GZYCxcbiAgICAgICAgaW1wbGVtZW50YXRpb246ICdBZ2VudCBTdGVlcmluZyBndWlkZWxpbmVz44Gr5b6T44Gj44Gm44OH44Kj44Os44Kv44OI44Oq5qeL6YCg44KS6KaL55u044GX44Gm44GP44Gg44GV44GEJyxcbiAgICAgICAgZXhwZWN0ZWRCZW5lZml0OiAn44OV44Kh44Kk44Or566h55CG44Gu5Yq5546H5YyW44Go5L+d5a6I5oCn44Gu5ZCR5LiKJ1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8g55Kw5aKD6ZaT5LiA6Ie0546H44GM5L2O44GE5aC05ZCIXG4gICAgaWYgKGV4ZWN1dGlvblJlc3VsdC5vdmVyYWxsU3RhdGlzdGljcy5lbnZpcm9ubWVudE1hdGNoUmF0ZSA8IDk1KSB7XG4gICAgICByZWNvbW1lbmRhdGlvbnMucHVzaCh7XG4gICAgICAgIGNhdGVnb3J5OiAnbWFpbnRlbmFuY2UnLFxuICAgICAgICBwcmlvcml0eTogJ21lZGl1bScsXG4gICAgICAgIHRpdGxlOiAn55Kw5aKD6ZaT5ZCM5pyf44Gu5pS55ZaEJyxcbiAgICAgICAgZGVzY3JpcHRpb246IGDnkrDlooPplpPkuIDoh7TnjofjgYwke2V4ZWN1dGlvblJlc3VsdC5vdmVyYWxsU3RhdGlzdGljcy5lbnZpcm9ubWVudE1hdGNoUmF0ZX0l44Gn44GZYCxcbiAgICAgICAgaW1wbGVtZW50YXRpb246ICflrprmnJ/nmoTjgarlkIzmnJ/lrp/ooYzjgajmlbTlkIjmgKfjg4Hjgqfjg4Pjgq/jgpLlrp/mlr3jgZfjgabjgY/jgaDjgZXjgYQnLFxuICAgICAgICBleHBlY3RlZEJlbmVmaXQ6ICfnkrDlooPplpPjga7kuIDosqvmgKfnorrkv53jgajpgYvnlKjlirnnjofjga7lkJHkuIonXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyDjg5Hjg5Xjgqnjg7zjg57jg7PjgrnmlLnlloTjga7mjqjlpajkuovpoIVcbiAgICBpZiAoZXhlY3V0aW9uUmVzdWx0LnRvdGFsUHJvY2Vzc2luZ1RpbWUgPiA2MDAwMCkgeyAvLyAx5YiG5Lul5LiKXG4gICAgICByZWNvbW1lbmRhdGlvbnMucHVzaCh7XG4gICAgICAgIGNhdGVnb3J5OiAncGVyZm9ybWFuY2UnLFxuICAgICAgICBwcmlvcml0eTogJ2xvdycsXG4gICAgICAgIHRpdGxlOiAn44OR44OV44Kp44O844Oe44Oz44K544Gu5pyA6YGp5YyWJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICflh6bnkIbmmYLplpPjgYzplbfjgY/jgarjgaPjgabjgYTjgb7jgZknLFxuICAgICAgICBpbXBsZW1lbnRhdGlvbjogJ+S4puWIl+WHpueQhuOBrua0u+eUqOOChOODleOCoeOCpOODq+ODleOCo+ODq+OCv+ODquODs+OCsOOBruacgOmBqeWMluOCkuaknOiojuOBl+OBpuOBj+OBoOOBleOBhCcsXG4gICAgICAgIGV4cGVjdGVkQmVuZWZpdDogJ+WHpueQhuaZgumWk+OBruefree4ruOBqOWKueeOh+OBruWQkeS4iidcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiByZWNvbW1lbmRhdGlvbnM7XG4gIH1cblxuICAvKipcbiAgICog5b2i5byP5Yil44Os44Od44O844OI55Sf5oiQXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGdlbmVyYXRlUmVwb3J0QnlGb3JtYXQocmVwb3J0RGF0YTogUmVwb3J0RGF0YSwgZm9ybWF0OiBSZXBvcnRGb3JtYXQpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IHRpbWVzdGFtcCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5yZXBsYWNlKC9bOi5dL2csICctJyk7XG4gICAgY29uc3QgZmlsZW5hbWUgPSBgZmlsZS1vcmdhbml6YXRpb24tcmVwb3J0LSR7dGltZXN0YW1wfS4ke2Zvcm1hdH1gO1xuICAgIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5qb2luKHRoaXMucmVwb3J0Q29uZmlnLm91dHB1dERpcmVjdG9yeSwgZmlsZW5hbWUpO1xuXG4gICAgbGV0IGNvbnRlbnQ6IHN0cmluZztcblxuICAgIHN3aXRjaCAoZm9ybWF0KSB7XG4gICAgICBjYXNlICdtYXJrZG93bic6XG4gICAgICAgIGNvbnRlbnQgPSB0aGlzLmdlbmVyYXRlTWFya2Rvd25SZXBvcnQocmVwb3J0RGF0YSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgXG4gICAgICBjYXNlICdodG1sJzpcbiAgICAgICAgY29udGVudCA9IHRoaXMuZ2VuZXJhdGVIdG1sUmVwb3J0KHJlcG9ydERhdGEpO1xuICAgICAgICBicmVhaztcbiAgICAgIFxuICAgICAgY2FzZSAnanNvbic6XG4gICAgICAgIGNvbnRlbnQgPSBKU09OLnN0cmluZ2lmeShyZXBvcnREYXRhLCBudWxsLCAyKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBcbiAgICAgIGNhc2UgJ2Nzdic6XG4gICAgICAgIGNvbnRlbnQgPSB0aGlzLmdlbmVyYXRlQ3N2UmVwb3J0KHJlcG9ydERhdGEpO1xuICAgICAgICBicmVhaztcbiAgICAgIFxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGDmnKrlr77lv5zjga7jg6zjg53jg7zjg4jlvaLlvI86ICR7Zm9ybWF0fWApO1xuICAgIH1cblxuICAgIGF3YWl0IGZzLndyaXRlRmlsZShmaWxlUGF0aCwgY29udGVudCwgJ3V0Zi04Jyk7XG4gICAgY29uc29sZS5sb2coYPCfk4QgJHtmb3JtYXQudG9VcHBlckNhc2UoKX3jg6zjg53jg7zjg4jnlJ/miJA6ICR7ZmlsZVBhdGh9YCk7XG5cbiAgICByZXR1cm4gZmlsZVBhdGg7XG4gIH1cblxuICAvKipcbiAgICogTWFya2Rvd27jg6zjg53jg7zjg4jjgpLnlJ/miJBcbiAgICovXG4gIHByaXZhdGUgZ2VuZXJhdGVNYXJrZG93blJlcG9ydChyZXBvcnREYXRhOiBSZXBvcnREYXRhKTogc3RyaW5nIHtcbiAgICBjb25zdCB7IGV4ZWN1dGlvblJlc3VsdCwgc3lzdGVtSW5mbywgcGVyZm9ybWFuY2VBbmFseXNpcywgcmVjb21tZW5kYXRpb25zIH0gPSByZXBvcnREYXRhO1xuICAgIFxuICAgIHJldHVybiBgIyDntbHlkIjjg5XjgqHjgqTjg6vmlbTnkIbjgrfjgrnjg4bjg6Ag5a6f6KGM44Os44Od44O844OIXG5cbiMjIOWun+ihjOOCteODnuODquODvFxuLSAqKuWun+ihjElEKio6ICR7ZXhlY3V0aW9uUmVzdWx0LmV4ZWN1dGlvbklkfVxuLSAqKuWun+ihjOaXpeaZgioqOiAke2V4ZWN1dGlvblJlc3VsdC5zdGFydFRpbWUudG9Mb2NhbGVTdHJpbmcoJ2phLUpQJyl9XG4tICoq5oiQ5YqfKio6ICR7ZXhlY3V0aW9uUmVzdWx0LnN1Y2Nlc3MgPyAn44Gv44GEJyA6ICfjgYTjgYTjgYgnfVxuLSAqKue3j+WHpueQhuaZgumWkyoqOiAke01hdGgucm91bmQoZXhlY3V0aW9uUmVzdWx0LnRvdGFsUHJvY2Vzc2luZ1RpbWUgLyAxMDAwKX3np5Jcbi0gKirjgqjjg6njg7zmlbAqKjogJHtleGVjdXRpb25SZXN1bHQuZXJyb3JzLmxlbmd0aH3lgItcbi0gKirorablkYrmlbAqKjogJHtleGVjdXRpb25SZXN1bHQud2FybmluZ3MubGVuZ3RofeWAi1xuXG4jIyDntbHlkIjntbHoqIhcbi0gKirnt4/jgrnjgq3jg6Pjg7Pjg5XjgqHjgqTjg6vmlbAqKjogJHtleGVjdXRpb25SZXN1bHQub3ZlcmFsbFN0YXRpc3RpY3MudG90YWxTY2FubmVkRmlsZXN95YCLXG4tICoq57eP56e75YuV44OV44Kh44Kk44Or5pWwKio6ICR7ZXhlY3V0aW9uUmVzdWx0Lm92ZXJhbGxTdGF0aXN0aWNzLnRvdGFsTW92ZWRGaWxlc33lgItcbi0gKirlubPnva7jgY3jg5XjgqHjgqTjg6vliYrmuJvmlbAqKjogJHtleGVjdXRpb25SZXN1bHQub3ZlcmFsbFN0YXRpc3RpY3MuZmxhdEZpbGVSZWR1Y3Rpb2595YCLXG4tICoq5qeL6YCg5rqW5oug546HKio6ICR7ZXhlY3V0aW9uUmVzdWx0Lm92ZXJhbGxTdGF0aXN0aWNzLnN0cnVjdHVyZUNvbXBsaWFuY2VSYXRlfSVcbi0gKirnkrDlooPplpPkuIDoh7TnjocqKjogJHtleGVjdXRpb25SZXN1bHQub3ZlcmFsbFN0YXRpc3RpY3MuZW52aXJvbm1lbnRNYXRjaFJhdGV9JVxuXG4jIyDnkrDlooPliKXntZDmnpxcbiR7T2JqZWN0LmVudHJpZXMoZXhlY3V0aW9uUmVzdWx0LmVudmlyb25tZW50UmVzdWx0cykubWFwKChbZW52LCByZXN1bHRdKSA9PiBgXG4jIyMgJHtlbnYudG9VcHBlckNhc2UoKX3nkrDlooNcbi0gKirmiJDlip8qKjogJHtyZXN1bHQuc3VjY2VzcyA/ICfjga/jgYQnIDogJ+OBhOOBhOOBiCd9XG4tICoq44K544Kt44Oj44Oz44OV44Kh44Kk44Or5pWwKio6ICR7cmVzdWx0LnNjYW5uZWRGaWxlc33lgItcbi0gKirnp7vli5Xjg5XjgqHjgqTjg6vmlbAqKjogJHtyZXN1bHQubW92ZWRGaWxlc33lgItcbi0gKirmqKnpmZDmm7TmlrDmlbAqKjogJHtyZXN1bHQucGVybWlzc2lvblVwZGF0ZXN95YCLXG4tICoq5Yem55CG5pmC6ZaTKio6ICR7TWF0aC5yb3VuZChyZXN1bHQucHJvY2Vzc2luZ1RpbWUgLyAxMDAwKX3np5Jcbi0gKirjgqjjg6njg7zmlbAqKjogJHtyZXN1bHQuZXJyb3JDb3VudH3lgItcbmApLmpvaW4oJycpfVxuXG4jIyDjg5Hjg5Xjgqnjg7zjg57jg7PjgrnliIbmnpBcbiMjIyDjgrnjg6vjg7zjg5fjg4Pjg4jntbHoqIhcbi0gKirjg5XjgqHjgqTjg6vlh6bnkIbpgJ/luqYqKjogJHtwZXJmb3JtYW5jZUFuYWx5c2lzLnRocm91Z2hwdXRTdGF0cy5maWxlc1BlclNlY29uZC50b0ZpeGVkKDIpfeODleOCoeOCpOODqy/np5Jcbi0gKirmnIDlpKflh6bnkIbmmYLplpMqKjogJHtNYXRoLnJvdW5kKHBlcmZvcm1hbmNlQW5hbHlzaXMudGhyb3VnaHB1dFN0YXRzLm1heFByb2Nlc3NpbmdUaW1lIC8gMTAwMCl956eSXG4tICoq5pyA5bCP5Yem55CG5pmC6ZaTKio6ICR7TWF0aC5yb3VuZChwZXJmb3JtYW5jZUFuYWx5c2lzLnRocm91Z2hwdXRTdGF0cy5taW5Qcm9jZXNzaW5nVGltZSAvIDEwMDApfeenklxuXG4jIyMg44Oc44OI44Or44ON44OD44Kv5YiG5p6QXG4ke3BlcmZvcm1hbmNlQW5hbHlzaXMuYm90dGxlbmVja3MubWFwKGJvdHRsZW5lY2sgPT4gYFxuLSAqKuODleOCp+ODvOOCuioqOiAke2JvdHRsZW5lY2sucGhhc2V9XG4tICoq5Yem55CG5pmC6ZaTKio6ICR7TWF0aC5yb3VuZChib3R0bGVuZWNrLmR1cmF0aW9uIC8gMTAwMCl956eSICgke2JvdHRsZW5lY2sucGVyY2VudGFnZS50b0ZpeGVkKDEpfSUpXG4tICoq5pS55ZaE5o+Q5qGIKio6ICR7Ym90dGxlbmVjay5pbXByb3ZlbWVudFN1Z2dlc3Rpb259XG5gKS5qb2luKCcnKX1cblxuIyMg5o6o5aWo5LqL6aCFXG4ke3JlY29tbWVuZGF0aW9ucy5tYXAocmVjID0+IGBcbiMjIyAke3JlYy50aXRsZX0gKCR7cmVjLnByaW9yaXR5LnRvVXBwZXJDYXNlKCl9KVxuLSAqKuOCq+ODhuOCtOODqioqOiAke3JlYy5jYXRlZ29yeX1cbi0gKiroqqzmmI4qKjogJHtyZWMuZGVzY3JpcHRpb259XG4tICoq5a6f6KOF5pa55rOVKio6ICR7cmVjLmltcGxlbWVudGF0aW9ufVxuLSAqKuacn+W+heWKueaenCoqOiAke3JlYy5leHBlY3RlZEJlbmVmaXR9XG5gKS5qb2luKCcnKX1cblxuIyMg44Ko44Op44O86Kmz57SwXG4ke2V4ZWN1dGlvblJlc3VsdC5lcnJvcnMubGVuZ3RoID4gMCA/IFxuICBleGVjdXRpb25SZXN1bHQuZXJyb3JzLm1hcChlcnJvciA9PiBgXG4tICoq44OV44Kn44O844K6Kio6ICR7ZXJyb3IucGhhc2V9XG4tICoq55Kw5aKDKio6ICR7ZXJyb3IuZW52aXJvbm1lbnQgfHwgJ+WFqOS9kyd9XG4tICoq44Oh44OD44K744O844K4Kio6ICR7ZXJyb3IubWVzc2FnZX1cbi0gKirnmbrnlJ/mmYLliLsqKjogJHtlcnJvci50aW1lc3RhbXAudG9Mb2NhbGVTdHJpbmcoJ2phLUpQJyl9XG5gKS5qb2luKCcnKSA6ICctIOOCqOODqeODvOOBquOBlyd9XG5cbiMjIOOCt+OCueODhuODoOaDheWgsVxuLSAqKuODl+ODqeODg+ODiOODleOCqeODvOODoCoqOiAke3N5c3RlbUluZm8ucGxhdGZvcm19XG4tICoqTm9kZS5qc+ODkOODvOOCuOODp+ODsyoqOiAke3N5c3RlbUluZm8ubm9kZVZlcnNpb259XG4tICoq5L2c5qWt44OH44Kj44Os44Kv44OI44OqKio6ICR7c3lzdGVtSW5mby53b3JraW5nRGlyZWN0b3J5fVxuLSAqKuODoeODouODquS9v+eUqOmHjyoqOiAke01hdGgucm91bmQoc3lzdGVtSW5mby5tZW1vcnlVc2FnZS5oZWFwVXNlZCAvIDEwMjQgLyAxMDI0KX1NQlxuXG4tLS1cbirjgZPjga7jg6zjg53jg7zjg4jjga/ntbHlkIjjg5XjgqHjgqTjg6vmlbTnkIbjgrfjgrnjg4bjg6Djgavjgojjgoroh6rli5XnlJ/miJDjgZXjgozjgb7jgZfjgZ8qXG5gO1xuICB9XG5cbiAgLyoqXG4gICAqIEhUTUzjg6zjg53jg7zjg4jjgpLnlJ/miJBcbiAgICovXG4gIHByaXZhdGUgZ2VuZXJhdGVIdG1sUmVwb3J0KHJlcG9ydERhdGE6IFJlcG9ydERhdGEpOiBzdHJpbmcge1xuICAgIC8vIOWun+ijheewoeeVpeWMllxuICAgIHJldHVybiBgPCFET0NUWVBFIGh0bWw+XG48aHRtbD5cbjxoZWFkPlxuICAgIDx0aXRsZT7ntbHlkIjjg5XjgqHjgqTjg6vmlbTnkIbjgrfjgrnjg4bjg6Ag44Os44Od44O844OIPC90aXRsZT5cbiAgICA8bWV0YSBjaGFyc2V0PVwidXRmLThcIj5cbjwvaGVhZD5cbjxib2R5PlxuICAgIDxoMT7ntbHlkIjjg5XjgqHjgqTjg6vmlbTnkIbjgrfjgrnjg4bjg6Ag5a6f6KGM44Os44Od44O844OIPC9oMT5cbiAgICA8cD7lrp/oo4XnsKHnlaXljJY8L3A+XG48L2JvZHk+XG48L2h0bWw+YDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDU1bjg6zjg53jg7zjg4jjgpLnlJ/miJBcbiAgICovXG4gIHByaXZhdGUgZ2VuZXJhdGVDc3ZSZXBvcnQocmVwb3J0RGF0YTogUmVwb3J0RGF0YSk6IHN0cmluZyB7XG4gICAgLy8g5a6f6KOF57Ch55Wl5YyWXG4gICAgcmV0dXJuICdFbnZpcm9ubWVudCxTY2FubmVkRmlsZXMsTW92ZWRGaWxlcyxQcm9jZXNzaW5nVGltZVxcbicgK1xuICAgICAgICAgICBPYmplY3QuZW50cmllcyhyZXBvcnREYXRhLmV4ZWN1dGlvblJlc3VsdC5lbnZpcm9ubWVudFJlc3VsdHMpXG4gICAgICAgICAgICAgLm1hcCgoW2VudiwgcmVzdWx0XSkgPT4gYCR7ZW52fSwke3Jlc3VsdC5zY2FubmVkRmlsZXN9LCR7cmVzdWx0Lm1vdmVkRmlsZXN9LCR7cmVzdWx0LnByb2Nlc3NpbmdUaW1lfWApXG4gICAgICAgICAgICAgLmpvaW4oJ1xcbicpO1xuICB9XG59Il19