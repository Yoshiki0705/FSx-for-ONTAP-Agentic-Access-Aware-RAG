"use strict";
/**
 * 統合ファイル整理システム - 分類マネージャー
 *
 * ローカル環境とEC2環境の両方でファイル分類処理を統合管理し、
 * 分類結果の検証とレポート生成を行います。
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
exports.ClassificationManager = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const file_classifier_js_1 = require("../classification/file-classifier.js");
const local_scanner_js_1 = require("../scanners/local-scanner.js");
const ec2_scanner_js_1 = require("../scanners/ec2-scanner.js");
const index_js_1 = require("../types/index.js");
/**
 * 分類マネージャー
 *
 * 両環境の分類処理を統合管理し、結果の検証とレポート生成を行います。
 */
class ClassificationManager {
    config;
    localClassifier;
    ec2Classifier;
    localScanner;
    ec2Scanner;
    constructor(config, localRootPath = process.cwd(), sshConfig) {
        this.config = config;
        this.localClassifier = new file_classifier_js_1.FileClassifier(config, 'local');
        this.ec2Classifier = new file_classifier_js_1.FileClassifier(config, 'ec2');
        this.localScanner = new local_scanner_js_1.LocalFileScanner(localRootPath);
        this.ec2Scanner = new ec2_scanner_js_1.EC2FileScanner(sshConfig);
    }
    /**
     * 統合分類処理を実行
     */
    async executeIntegratedClassification() {
        const reportId = `classification-${Date.now()}`;
        const startTime = Date.now();
        console.log('🔍 統合ファイル分類を開始します...');
        try {
            // 並列で両環境の分類を実行
            const [localResult, ec2Result] = await Promise.allSettled([
                this.classifyEnvironment('local'),
                this.classifyEnvironment('ec2')
            ]);
            // 結果の処理
            const environmentResults = {
                local: this.processSettledResult(localResult, 'local'),
                ec2: this.processSettledResult(ec2Result, 'ec2')
            };
            // 全体統計の生成
            const overallStatistics = this.generateOverallStatistics(environmentResults);
            // 推奨事項と警告の生成
            const recommendations = this.generateRecommendations(environmentResults);
            const warnings = this.generateWarnings(environmentResults);
            const report = {
                reportId,
                generatedAt: new Date(),
                environmentResults,
                overallStatistics,
                recommendations,
                warnings
            };
            const totalTime = Date.now() - startTime;
            console.log(`✅ 統合ファイル分類が完了しました (${totalTime}ms)`);
            // レポートを保存
            await this.saveReport(report);
            return report;
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.CLASSIFICATION_FAILED, `統合分類処理に失敗しました: ${error}`, undefined, undefined, error);
        }
    }
    /**
     * 環境別分類処理
     */
    async classifyEnvironment(environment) {
        const startTime = Date.now();
        console.log(`📂 ${environment}環境のファイル分類を開始...`);
        try {
            // ファイルスキャン
            const files = await this.scanEnvironmentFiles(environment);
            console.log(`${environment}環境で ${files.length} 個のファイルを検出`);
            // 分類実行
            const classifier = environment === 'local' ? this.localClassifier : this.ec2Classifier;
            const classifications = [];
            for (const file of files) {
                try {
                    const classification = await classifier.classifyFile(file);
                    classifications.push(classification);
                }
                catch (error) {
                    console.warn(`ファイル分類エラー: ${file.path}`, error);
                    // エラーが発生したファイルは不明タイプとして分類
                    classifications.push({
                        file,
                        targetPath: `archive/${file.name}`,
                        fileType: index_js_1.FileType.UNKNOWN,
                        confidence: 0.1,
                        reasoning: ['分類エラーが発生'],
                        requiresReview: true
                    });
                }
            }
            // 統計生成
            const statistics = this.generateStatisticsForClassifications(classifications);
            const processingTime = Date.now() - startTime;
            console.log(`✅ ${environment}環境の分類完了 (${processingTime}ms)`);
            return {
                environment,
                totalFiles: files.length,
                classifications,
                statistics,
                errors: [],
                processingTime
            };
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            console.error(`❌ ${environment}環境の分類でエラー:`, error);
            return {
                environment,
                totalFiles: 0,
                classifications: [],
                statistics: this.createEmptyStatistics(),
                errors: [error instanceof Error ? error.message : String(error)],
                processingTime
            };
        }
    }
    /**
     * 分類結果の検証
     */
    async validateClassifications(results) {
        const valid = [];
        const invalid = [];
        const validationErrors = [];
        for (const result of results) {
            try {
                // 基本的な検証ロジック
                if (this.isValidClassification(result)) {
                    valid.push(result);
                }
                else {
                    invalid.push(result);
                    validationErrors.push(`検証失敗: ${result.file.path}`);
                }
            }
            catch (error) {
                invalid.push(result);
                validationErrors.push(`検証エラー: ${result.file.path} - ${error}`);
            }
        }
        return { valid, invalid, validationErrors };
    }
    /**
     * 分類結果のフィルタリング
     */
    filterClassifications(results, filters) {
        return results.filter(result => {
            if (filters.fileType && !filters.fileType.includes(result.fileType)) {
                return false;
            }
            if (filters.minConfidence !== undefined && result.confidence < filters.minConfidence) {
                return false;
            }
            if (filters.maxConfidence !== undefined && result.confidence > filters.maxConfidence) {
                return false;
            }
            if (filters.requiresReview !== undefined && result.requiresReview !== filters.requiresReview) {
                return false;
            }
            if (filters.environment && result.file.environment !== filters.environment) {
                return false;
            }
            return true;
        });
    }
    /**
     * 分類結果のソート
     */
    sortClassifications(results, sortBy = 'confidence', order = 'desc') {
        return [...results].sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'confidence':
                    comparison = a.confidence - b.confidence;
                    break;
                case 'fileType':
                    comparison = a.fileType.localeCompare(b.fileType);
                    break;
                case 'path':
                    comparison = a.file.path.localeCompare(b.file.path);
                    break;
                case 'size':
                    comparison = a.file.size - b.file.size;
                    break;
            }
            return order === 'asc' ? comparison : -comparison;
        });
    }
    /**
     * 環境ファイルをスキャン
     */
    async scanEnvironmentFiles(environment) {
        if (environment === 'local') {
            return await this.localScanner.detectLocalFlatFiles();
        }
        else {
            const projectFiles = await this.ec2Scanner.detectEC2FlatFiles();
            const homeFiles = await this.ec2Scanner.detectHomeFlatFiles();
            return [...projectFiles, ...homeFiles];
        }
    }
    /**
     * SettledResult を処理
     */
    processSettledResult(result, environment) {
        if (result.status === 'fulfilled') {
            return result.value;
        }
        else {
            console.error(`${environment}環境の分類処理が失敗:`, result.reason);
            return {
                environment,
                totalFiles: 0,
                classifications: [],
                statistics: this.createEmptyStatistics(),
                errors: [result.reason instanceof Error ? result.reason.message : String(result.reason)],
                processingTime: 0
            };
        }
    }
    /**
     * 全体統計を生成
     */
    generateOverallStatistics(environmentResults) {
        const allClassifications = Object.values(environmentResults)
            .flatMap(result => result.classifications);
        if (allClassifications.length === 0) {
            return this.createEmptyStatistics();
        }
        // ファイルタイプ別統計
        const byFileType = {};
        for (const classification of allClassifications) {
            byFileType[classification.fileType] = (byFileType[classification.fileType] || 0) + 1;
        }
        // 信頼度別統計
        const byConfidence = {
            'high (0.8+)': 0,
            'medium (0.5-0.8)': 0,
            'low (0.0-0.5)': 0
        };
        let totalConfidence = 0;
        let requiresReview = 0;
        for (const classification of allClassifications) {
            totalConfidence += classification.confidence;
            if (classification.confidence >= 0.8) {
                byConfidence['high (0.8+)']++;
            }
            else if (classification.confidence >= 0.5) {
                byConfidence['medium (0.5-0.8)']++;
            }
            else {
                byConfidence['low (0.0-0.5)']++;
            }
            if (classification.requiresReview) {
                requiresReview++;
            }
        }
        const averageConfidence = totalConfidence / allClassifications.length;
        const successRate = allClassifications.filter(c => c.confidence >= 0.5).length / allClassifications.length;
        return {
            byFileType,
            byConfidence,
            requiresReview,
            averageConfidence,
            successRate
        };
    }
    /**
     * 推奨事項を生成
     */
    generateRecommendations(environmentResults) {
        const recommendations = [];
        const stats = this.generateOverallStatistics(environmentResults);
        // 信頼度に基づく推奨事項
        if (stats.averageConfidence < 0.6) {
            recommendations.push('分類ルールの見直しを推奨します（平均信頼度が低い）');
        }
        // レビュー必要ファイルに基づく推奨事項
        if (stats.requiresReview > 10) {
            recommendations.push(`${stats.requiresReview}個のファイルがレビューを必要としています`);
        }
        // 環境別推奨事項
        for (const [env, result] of Object.entries(environmentResults)) {
            if (result.errors.length > 0) {
                recommendations.push(`${env}環境でエラーが発生しています。接続設定を確認してください`);
            }
            if (result.totalFiles > 100) {
                recommendations.push(`${env}環境に多数のファイルがあります。段階的な整理を推奨します`);
            }
        }
        // ファイルタイプ別推奨事項
        const unknownCount = stats.byFileType[index_js_1.FileType.UNKNOWN] || 0;
        if (unknownCount > 5) {
            recommendations.push(`${unknownCount}個の不明ファイルがあります。分類ルールの追加を検討してください`);
        }
        return recommendations;
    }
    /**
     * 警告を生成
     */
    generateWarnings(environmentResults) {
        const warnings = [];
        for (const [env, result] of Object.entries(environmentResults)) {
            // エラーがある場合
            if (result.errors.length > 0) {
                warnings.push(`${env}環境で${result.errors.length}個のエラーが発生しました`);
            }
            // 処理時間が長い場合
            if (result.processingTime > 30000) { // 30秒
                warnings.push(`${env}環境の処理時間が長すぎます (${result.processingTime}ms)`);
            }
            // 機密ファイルの警告
            const sensitiveFiles = result.classifications.filter(c => c.fileType === index_js_1.FileType.SECURITY_KEYS || c.fileType === index_js_1.FileType.SECURITY_SECRETS);
            if (sensitiveFiles.length > 0) {
                warnings.push(`${env}環境で${sensitiveFiles.length}個の機密ファイルが検出されました`);
            }
        }
        return warnings;
    }
    /**
     * 空の統計を作成
     */
    createEmptyStatistics() {
        return {
            byFileType: {},
            byConfidence: {
                'high (0.8+)': 0,
                'medium (0.5-0.8)': 0,
                'low (0.0-0.5)': 0
            },
            requiresReview: 0,
            averageConfidence: 0,
            successRate: 0
        };
    }
    /**
     * レポートを保存
     */
    async saveReport(report) {
        try {
            const reportDir = 'development/logs/organization';
            await fs.mkdir(reportDir, { recursive: true });
            const reportPath = path.join(reportDir, `classification-report-${report.reportId}.json`);
            await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
            console.log(`📋 分類レポートを保存しました: ${reportPath}`);
        }
        catch (error) {
            console.warn('レポート保存に失敗しました:', error);
        }
    }
    /**
     * 分類結果の妥当性を検証
     */
    isValidClassification(result) {
        // 基本的な検証
        if (!result.file || !result.targetPath || !result.fileType) {
            return false;
        }
        // 信頼度の範囲チェック
        if (result.confidence < 0 || result.confidence > 1) {
            return false;
        }
        // ターゲットパスの妥当性チェック
        if (result.targetPath.includes('..') || result.targetPath.startsWith('/')) {
            return false;
        }
        // ファイルタイプの妥当性チェック
        if (!Object.values(index_js_1.FileType).includes(result.fileType)) {
            return false;
        }
        return true;
    }
    /**
     * 分類結果から統計を生成
     */
    generateStatisticsForClassifications(classifications) {
        if (classifications.length === 0) {
            return this.createEmptyStatistics();
        }
        // ファイルタイプ別統計
        const byFileType = {};
        for (const classification of classifications) {
            byFileType[classification.fileType] = (byFileType[classification.fileType] || 0) + 1;
        }
        // 信頼度別統計
        const byConfidence = {
            'high (0.8+)': 0,
            'medium (0.5-0.8)': 0,
            'low (0.0-0.5)': 0
        };
        let totalConfidence = 0;
        let requiresReview = 0;
        for (const classification of classifications) {
            totalConfidence += classification.confidence;
            if (classification.confidence >= 0.8) {
                byConfidence['high (0.8+)']++;
            }
            else if (classification.confidence >= 0.5) {
                byConfidence['medium (0.5-0.8)']++;
            }
            else {
                byConfidence['low (0.0-0.5)']++;
            }
            if (classification.requiresReview) {
                requiresReview++;
            }
        }
        const averageConfidence = totalConfidence / classifications.length;
        const successRate = classifications.filter(c => c.confidence >= 0.5).length / classifications.length;
        return {
            byFileType,
            byConfidence,
            requiresReview,
            averageConfidence,
            successRate
        };
    }
    /**
     * レポートをCSV形式でエクスポート
     */
    async exportReportToCSV(report, outputPath) {
        try {
            const csvLines = [];
            // ヘッダー
            csvLines.push([
                'Environment', 'FilePath', 'FileName', 'FileType', 'TargetPath',
                'Confidence', 'RequiresReview', 'FileSize', 'LastModified', 'Reasoning'
            ].join(','));
            // データ行
            for (const [env, result] of Object.entries(report.environmentResults)) {
                for (const classification of result.classifications) {
                    const row = [
                        env,
                        `"${classification.file.path}"`,
                        `"${classification.file.name}"`,
                        classification.fileType,
                        `"${classification.targetPath}"`,
                        classification.confidence.toFixed(3),
                        classification.requiresReview.toString(),
                        classification.file.size.toString(),
                        classification.file.lastModified.toISOString(),
                        `"${classification.reasoning.join('; ')}"`
                    ];
                    csvLines.push(row.join(','));
                }
            }
            await fs.writeFile(outputPath, csvLines.join('\n'));
            console.log(`📊 CSVレポートを保存しました: ${outputPath}`);
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.CLASSIFICATION_FAILED, `CSVエクスポートに失敗しました: ${error}`, outputPath, undefined, error);
        }
    }
}
exports.ClassificationManager = ClassificationManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xhc3NpZmljYXRpb24tbWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNsYXNzaWZpY2F0aW9uLW1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7OztHQUtHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGdEQUFrQztBQUNsQywyQ0FBNkI7QUFDN0IsNkVBQXNFO0FBQ3RFLG1FQUFnRTtBQUNoRSwrREFBdUU7QUFDdkUsZ0RBUTJCO0FBc0QzQjs7OztHQUlHO0FBQ0gsTUFBYSxxQkFBcUI7SUFDZixNQUFNLENBQXVCO0lBQzdCLGVBQWUsQ0FBaUI7SUFDaEMsYUFBYSxDQUFpQjtJQUM5QixZQUFZLENBQW1CO0lBQy9CLFVBQVUsQ0FBaUI7SUFFNUMsWUFDRSxNQUE0QixFQUM1QixnQkFBd0IsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUNyQyxTQUFvQjtRQUVwQixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNyQixJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksbUNBQWMsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDM0QsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLG1DQUFjLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3ZELElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxtQ0FBZ0IsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUN4RCxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksK0JBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNsRCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxLQUFLLENBQUMsK0JBQStCO1FBQzFDLE1BQU0sUUFBUSxHQUFHLGtCQUFrQixJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQztRQUNoRCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7UUFFN0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FB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Rzt3QkFDSCxJQUFJLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHO3dCQUMvQixJQUFJLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHO3dCQUMvQixjQUFjLENBQUMsUUFBUTt3QkFDdkIsSUFBSSxjQUFjLENBQUMsVUFBVSxHQUFHO3dCQUNoQyxjQUFjLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7d0JBQ3BDLGNBQWMsQ0FBQyxjQUFjLENBQUMsUUFBUSxFQUFFO3dCQUN4QyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUU7d0JBQ25DLGNBQWMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsRUFBRTt3QkFDOUMsSUFBSSxjQUFjLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRztxQkFDM0MsQ0FBQztvQkFDRixRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDL0IsQ0FBQztZQUNILENBQUM7WUFFRCxNQUFNLEVBQUUsQ0FBQyxTQUFTLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUNwRCxPQUFPLENBQUMsR0FBRyxDQUFDLHNCQUFzQixVQUFVLEVBQUUsQ0FBQyxDQUFDO1FBQ2xELENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsTUFBTSxJQUFJLDRCQUFpQixDQUN6QixnQ0FBcUIsQ0FBQyxxQkFBcUIsRUFDM0MscUJBQXFCLEtBQUssRUFBRSxFQUM1QixVQUFVLEVBQ1YsU0FBUyxFQUNULEtBQWMsQ0FDZixDQUFDO1FBQ0osQ0FBQztJQUNILENBQUM7Q0FDRjtBQTNpQkQsc0RBMmlCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog57Wx5ZCI44OV44Kh44Kk44Or5pW055CG44K344K544OG44OgIC0g5YiG6aGe44Oe44ON44O844K444Oj44O8XG4gKiBcbiAqIOODreODvOOCq+ODq+eSsOWig+OBqEVDMueSsOWig+OBruS4oeaWueOBp+ODleOCoeOCpOODq+WIhumhnuWHpueQhuOCkue1seWQiOeuoeeQhuOBl+OAgVxuICog5YiG6aGe57WQ5p6c44Gu5qSc6Ki844Go44Os44Od44O844OI55Sf5oiQ44KS6KGM44GE44G+44GZ44CCXG4gKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMvcHJvbWlzZXMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IEZpbGVDbGFzc2lmaWVyIH0gZnJvbSAnLi4vY2xhc3NpZmljYXRpb24vZmlsZS1jbGFzc2lmaWVyLmpzJztcbmltcG9ydCB7IExvY2FsRmlsZVNjYW5uZXIgfSBmcm9tICcuLi9zY2FubmVycy9sb2NhbC1zY2FubmVyLmpzJztcbmltcG9ydCB7IEVDMkZpbGVTY2FubmVyLCBTU0hDb25maWcgfSBmcm9tICcuLi9zY2FubmVycy9lYzItc2Nhbm5lci5qcyc7XG5pbXBvcnQgeyBcbiAgRmlsZUluZm8sIFxuICBDbGFzc2lmaWNhdGlvblJlc3VsdCwgXG4gIENsYXNzaWZpY2F0aW9uQ29uZmlnLFxuICBFbnZpcm9ubWVudCxcbiAgRmlsZVR5cGUsXG4gIE9yZ2FuaXphdGlvbkVycm9yLFxuICBPcmdhbml6YXRpb25FcnJvclR5cGVcbn0gZnJvbSAnLi4vdHlwZXMvaW5kZXguanMnO1xuXG4vKipcbiAqIOWIhumhnuODrOODneODvOODiFxuICovXG5leHBvcnQgaW50ZXJmYWNlIENsYXNzaWZpY2F0aW9uUmVwb3J0IHtcbiAgLyoqIOODrOODneODvOODiElEICovXG4gIHJlcG9ydElkOiBzdHJpbmc7XG4gIC8qKiDnlJ/miJDmmYLliLsgKi9cbiAgZ2VuZXJhdGVkQXQ6IERhdGU7XG4gIC8qKiDnkrDlooPliKXntZDmnpwgKi9cbiAgZW52aXJvbm1lbnRSZXN1bHRzOiBSZWNvcmQ8RW52aXJvbm1lbnQsIEVudmlyb25tZW50Q2xhc3NpZmljYXRpb25SZXN1bHQ+O1xuICAvKiog5YWo5L2T57Wx6KiIICovXG4gIG92ZXJhbGxTdGF0aXN0aWNzOiBDbGFzc2lmaWNhdGlvblN0YXRpc3RpY3M7XG4gIC8qKiDmjqjlpajkuovpoIUgKi9cbiAgcmVjb21tZW5kYXRpb25zOiBzdHJpbmdbXTtcbiAgLyoqIOitpuWRiiAqL1xuICB3YXJuaW5nczogc3RyaW5nW107XG59XG5cbi8qKlxuICog55Kw5aKD5Yil5YiG6aGe57WQ5p6cXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRW52aXJvbm1lbnRDbGFzc2lmaWNhdGlvblJlc3VsdCB7XG4gIC8qKiDlrp/ooYznkrDlooMgKi9cbiAgZW52aXJvbm1lbnQ6IEVudmlyb25tZW50O1xuICAvKiog5Yem55CG44GV44KM44Gf44OV44Kh44Kk44Or5pWwICovXG4gIHRvdGFsRmlsZXM6IG51bWJlcjtcbiAgLyoqIOWIhumhnue1kOaenCAqL1xuICBjbGFzc2lmaWNhdGlvbnM6IENsYXNzaWZpY2F0aW9uUmVzdWx0W107XG4gIC8qKiDntbHoqIjmg4XloLEgKi9cbiAgc3RhdGlzdGljczogQ2xhc3NpZmljYXRpb25TdGF0aXN0aWNzO1xuICAvKiog44Ko44Op44O8ICovXG4gIGVycm9yczogc3RyaW5nW107XG4gIC8qKiDlh6bnkIbmmYLplpMgKi9cbiAgcHJvY2Vzc2luZ1RpbWU6IG51bWJlcjtcbn1cblxuLyoqXG4gKiDliIbpoZ7ntbHoqIhcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDbGFzc2lmaWNhdGlvblN0YXRpc3RpY3Mge1xuICAvKiog44OV44Kh44Kk44Or44K/44Kk44OX5Yil57Wx6KiIICovXG4gIGJ5RmlsZVR5cGU6IFJlY29yZDxGaWxlVHlwZSwgbnVtYmVyPjtcbiAgLyoqIOS/oemgvOW6puWIpee1seioiCAqL1xuICBieUNvbmZpZGVuY2U6IFJlY29yZDxzdHJpbmcsIG51bWJlcj47XG4gIC8qKiDjg6zjg5Pjg6Xjg7zlv4XopoHmlbAgKi9cbiAgcmVxdWlyZXNSZXZpZXc6IG51bWJlcjtcbiAgLyoqIOW5s+Wdh+S/oemgvOW6piAqL1xuICBhdmVyYWdlQ29uZmlkZW5jZTogbnVtYmVyO1xuICAvKiog5oiQ5Yqf546HICovXG4gIHN1Y2Nlc3NSYXRlOiBudW1iZXI7XG59XG5cbi8qKlxuICog5YiG6aGe44Oe44ON44O844K444Oj44O8XG4gKiBcbiAqIOS4oeeSsOWig+OBruWIhumhnuWHpueQhuOCkue1seWQiOeuoeeQhuOBl+OAgee1kOaenOOBruaknOiovOOBqOODrOODneODvOODiOeUn+aIkOOCkuihjOOBhOOBvuOBmeOAglxuICovXG5leHBvcnQgY2xhc3MgQ2xhc3NpZmljYXRpb25NYW5hZ2VyIHtcbiAgcHJpdmF0ZSByZWFkb25seSBjb25maWc6IENsYXNzaWZpY2F0aW9uQ29uZmlnO1xuICBwcml2YXRlIHJlYWRvbmx5IGxvY2FsQ2xhc3NpZmllcjogRmlsZUNsYXNzaWZpZXI7XG4gIHByaXZhdGUgcmVhZG9ubHkgZWMyQ2xhc3NpZmllcjogRmlsZUNsYXNzaWZpZXI7XG4gIHByaXZhdGUgcmVhZG9ubHkgbG9jYWxTY2FubmVyOiBMb2NhbEZpbGVTY2FubmVyO1xuICBwcml2YXRlIHJlYWRvbmx5IGVjMlNjYW5uZXI6IEVDMkZpbGVTY2FubmVyO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGNvbmZpZzogQ2xhc3NpZmljYXRpb25Db25maWcsXG4gICAgbG9jYWxSb290UGF0aDogc3RyaW5nID0gcHJvY2Vzcy5jd2QoKSxcbiAgICBzc2hDb25maWc6IFNTSENvbmZpZ1xuICApIHtcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgICB0aGlzLmxvY2FsQ2xhc3NpZmllciA9IG5ldyBGaWxlQ2xhc3NpZmllcihjb25maWcsICdsb2NhbCcpO1xuICAgIHRoaXMuZWMyQ2xhc3NpZmllciA9IG5ldyBGaWxlQ2xhc3NpZmllcihjb25maWcsICdlYzInKTtcbiAgICB0aGlzLmxvY2FsU2Nhbm5lciA9IG5ldyBMb2NhbEZpbGVTY2FubmVyKGxvY2FsUm9vdFBhdGgpO1xuICAgIHRoaXMuZWMyU2Nhbm5lciA9IG5ldyBFQzJGaWxlU2Nhbm5lcihzc2hDb25maWcpO1xuICB9XG5cbiAgLyoqXG4gICAqIOe1seWQiOWIhumhnuWHpueQhuOCkuWun+ihjFxuICAgKi9cbiAgcHVibGljIGFzeW5jIGV4ZWN1dGVJbnRlZ3JhdGVkQ2xhc3NpZmljYXRpb24oKTogUHJvbWlzZTxDbGFzc2lmaWNhdGlvblJlcG9ydD4ge1xuICAgIGNvbnN0IHJlcG9ydElkID0gYGNsYXNzaWZpY2F0aW9uLSR7RGF0ZS5ub3coKX1gO1xuICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG5cbiAgICBjb25zb2xlLmxvZygn8J+UjSDntbHlkIjjg5XjgqHjgqTjg6vliIbpoZ7jgpLplovlp4vjgZfjgb7jgZkuLi4nKTtcblxuICAgIHRyeSB7XG4gICAgICAvLyDkuKbliJfjgafkuKHnkrDlooPjga7liIbpoZ7jgpLlrp/ooYxcbiAgICAgIGNvbnN0IFtsb2NhbFJlc3VsdCwgZWMyUmVzdWx0XSA9IGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgICAgIHRoaXMuY2xhc3NpZnlFbnZpcm9ubWVudCgnbG9jYWwnKSxcbiAgICAgICAgdGhpcy5jbGFzc2lmeUVudmlyb25tZW50KCdlYzInKVxuICAgICAgXSk7XG5cbiAgICAgIC8vIOe1kOaenOOBruWHpueQhlxuICAgICAgY29uc3QgZW52aXJvbm1lbnRSZXN1bHRzOiBSZWNvcmQ8RW52aXJvbm1lbnQsIEVudmlyb25tZW50Q2xhc3NpZmljYXRpb25SZXN1bHQ+ID0ge1xuICAgICAgICBsb2NhbDogdGhpcy5wcm9jZXNzU2V0dGxlZFJlc3VsdChsb2NhbFJlc3VsdCwgJ2xvY2FsJyksXG4gICAgICAgIGVjMjogdGhpcy5wcm9jZXNzU2V0dGxlZFJlc3VsdChlYzJSZXN1bHQsICdlYzInKVxuICAgICAgfTtcblxuICAgICAgLy8g5YWo5L2T57Wx6KiI44Gu55Sf5oiQXG4gICAgICBjb25zdCBvdmVyYWxsU3RhdGlzdGljcyA9IHRoaXMuZ2VuZXJhdGVPdmVyYWxsU3RhdGlzdGljcyhlbnZpcm9ubWVudFJlc3VsdHMpO1xuXG4gICAgICAvLyDmjqjlpajkuovpoIXjgajorablkYrjga7nlJ/miJBcbiAgICAgIGNvbnN0IHJlY29tbWVuZGF0aW9ucyA9IHRoaXMuZ2VuZXJhdGVSZWNvbW1lbmRhdGlvbnMoZW52aXJvbm1lbnRSZXN1bHRzKTtcbiAgICAgIGNvbnN0IHdhcm5pbmdzID0gdGhpcy5nZW5lcmF0ZVdhcm5pbmdzKGVudmlyb25tZW50UmVzdWx0cyk7XG5cbiAgICAgIGNvbnN0IHJlcG9ydDogQ2xhc3NpZmljYXRpb25SZXBvcnQgPSB7XG4gICAgICAgIHJlcG9ydElkLFxuICAgICAgICBnZW5lcmF0ZWRBdDogbmV3IERhdGUoKSxcbiAgICAgICAgZW52aXJvbm1lbnRSZXN1bHRzLFxuICAgICAgICBvdmVyYWxsU3RhdGlzdGljcyxcbiAgICAgICAgcmVjb21tZW5kYXRpb25zLFxuICAgICAgICB3YXJuaW5nc1xuICAgICAgfTtcblxuICAgICAgY29uc3QgdG90YWxUaW1lID0gRGF0ZS5ub3coKSAtIHN0YXJ0VGltZTtcbiAgICAgIGNvbnNvbGUubG9nKGDinIUg57Wx5ZCI44OV44Kh44Kk44Or5YiG6aGe44GM5a6M5LqG44GX44G+44GX44GfICgke3RvdGFsVGltZX1tcylgKTtcblxuICAgICAgLy8g44Os44Od44O844OI44KS5L+d5a2YXG4gICAgICBhd2FpdCB0aGlzLnNhdmVSZXBvcnQocmVwb3J0KTtcblxuICAgICAgcmV0dXJuIHJlcG9ydDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuQ0xBU1NJRklDQVRJT05fRkFJTEVELFxuICAgICAgICBg57Wx5ZCI5YiG6aGe5Yem55CG44Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yfWAsXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog55Kw5aKD5Yil5YiG6aGe5Yem55CGXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgY2xhc3NpZnlFbnZpcm9ubWVudChlbnZpcm9ubWVudDogRW52aXJvbm1lbnQpOiBQcm9taXNlPEVudmlyb25tZW50Q2xhc3NpZmljYXRpb25SZXN1bHQ+IHtcbiAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIGNvbnNvbGUubG9nKGDwn5OCICR7ZW52aXJvbm1lbnR955Kw5aKD44Gu44OV44Kh44Kk44Or5YiG6aGe44KS6ZaL5aeLLi4uYCk7XG5cbiAgICB0cnkge1xuICAgICAgLy8g44OV44Kh44Kk44Or44K544Kt44Oj44OzXG4gICAgICBjb25zdCBmaWxlcyA9IGF3YWl0IHRoaXMuc2NhbkVudmlyb25tZW50RmlsZXMoZW52aXJvbm1lbnQpO1xuICAgICAgY29uc29sZS5sb2coYCR7ZW52aXJvbm1lbnR955Kw5aKD44GnICR7ZmlsZXMubGVuZ3RofSDlgIvjga7jg5XjgqHjgqTjg6vjgpLmpJzlh7pgKTtcblxuICAgICAgLy8g5YiG6aGe5a6f6KGMXG4gICAgICBjb25zdCBjbGFzc2lmaWVyID0gZW52aXJvbm1lbnQgPT09ICdsb2NhbCcgPyB0aGlzLmxvY2FsQ2xhc3NpZmllciA6IHRoaXMuZWMyQ2xhc3NpZmllcjtcbiAgICAgIGNvbnN0IGNsYXNzaWZpY2F0aW9uczogQ2xhc3NpZmljYXRpb25SZXN1bHRbXSA9IFtdO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBjbGFzc2lmaWNhdGlvbiA9IGF3YWl0IGNsYXNzaWZpZXIuY2xhc3NpZnlGaWxlKGZpbGUpO1xuICAgICAgICAgIGNsYXNzaWZpY2F0aW9ucy5wdXNoKGNsYXNzaWZpY2F0aW9uKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYOODleOCoeOCpOODq+WIhumhnuOCqOODqeODvDogJHtmaWxlLnBhdGh9YCwgZXJyb3IpO1xuICAgICAgICAgIC8vIOOCqOODqeODvOOBjOeZuueUn+OBl+OBn+ODleOCoeOCpOODq+OBr+S4jeaYjuOCv+OCpOODl+OBqOOBl+OBpuWIhumhnlxuICAgICAgICAgIGNsYXNzaWZpY2F0aW9ucy5wdXNoKHtcbiAgICAgICAgICAgIGZpbGUsXG4gICAgICAgICAgICB0YXJnZXRQYXRoOiBgYXJjaGl2ZS8ke2ZpbGUubmFtZX1gLFxuICAgICAgICAgICAgZmlsZVR5cGU6IEZpbGVUeXBlLlVOS05PV04sXG4gICAgICAgICAgICBjb25maWRlbmNlOiAwLjEsXG4gICAgICAgICAgICByZWFzb25pbmc6IFsn5YiG6aGe44Ko44Op44O844GM55m655SfJ10sXG4gICAgICAgICAgICByZXF1aXJlc1JldmlldzogdHJ1ZVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIOe1seioiOeUn+aIkFxuICAgICAgY29uc3Qgc3RhdGlzdGljcyA9IHRoaXMuZ2VuZXJhdGVTdGF0aXN0aWNzRm9yQ2xhc3NpZmljYXRpb25zKGNsYXNzaWZpY2F0aW9ucyk7XG5cbiAgICAgIGNvbnN0IHByb2Nlc3NpbmdUaW1lID0gRGF0ZS5ub3coKSAtIHN0YXJ0VGltZTtcbiAgICAgIGNvbnNvbGUubG9nKGDinIUgJHtlbnZpcm9ubWVudH3nkrDlooPjga7liIbpoZ7lrozkuoYgKCR7cHJvY2Vzc2luZ1RpbWV9bXMpYCk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGVudmlyb25tZW50LFxuICAgICAgICB0b3RhbEZpbGVzOiBmaWxlcy5sZW5ndGgsXG4gICAgICAgIGNsYXNzaWZpY2F0aW9ucyxcbiAgICAgICAgc3RhdGlzdGljcyxcbiAgICAgICAgZXJyb3JzOiBbXSxcbiAgICAgICAgcHJvY2Vzc2luZ1RpbWVcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnN0IHByb2Nlc3NpbmdUaW1lID0gRGF0ZS5ub3coKSAtIHN0YXJ0VGltZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYOKdjCAke2Vudmlyb25tZW50feeSsOWig+OBruWIhumhnuOBp+OCqOODqeODvDpgLCBlcnJvcik7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGVudmlyb25tZW50LFxuICAgICAgICB0b3RhbEZpbGVzOiAwLFxuICAgICAgICBjbGFzc2lmaWNhdGlvbnM6IFtdLFxuICAgICAgICBzdGF0aXN0aWNzOiB0aGlzLmNyZWF0ZUVtcHR5U3RhdGlzdGljcygpLFxuICAgICAgICBlcnJvcnM6IFtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcildLFxuICAgICAgICBwcm9jZXNzaW5nVGltZVxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog5YiG6aGe57WQ5p6c44Gu5qSc6Ki8XG4gICAqL1xuICBwdWJsaWMgYXN5bmMgdmFsaWRhdGVDbGFzc2lmaWNhdGlvbnMocmVzdWx0czogQ2xhc3NpZmljYXRpb25SZXN1bHRbXSk6IFByb21pc2U8e1xuICAgIHZhbGlkOiBDbGFzc2lmaWNhdGlvblJlc3VsdFtdO1xuICAgIGludmFsaWQ6IENsYXNzaWZpY2F0aW9uUmVzdWx0W107XG4gICAgdmFsaWRhdGlvbkVycm9yczogc3RyaW5nW107XG4gIH0+IHtcbiAgICBjb25zdCB2YWxpZDogQ2xhc3NpZmljYXRpb25SZXN1bHRbXSA9IFtdO1xuICAgIGNvbnN0IGludmFsaWQ6IENsYXNzaWZpY2F0aW9uUmVzdWx0W10gPSBbXTtcbiAgICBjb25zdCB2YWxpZGF0aW9uRXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgZm9yIChjb25zdCByZXN1bHQgb2YgcmVzdWx0cykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgLy8g5Z+65pys55qE44Gq5qSc6Ki844Ot44K444OD44KvXG4gICAgICAgIGlmICh0aGlzLmlzVmFsaWRDbGFzc2lmaWNhdGlvbihyZXN1bHQpKSB7XG4gICAgICAgICAgdmFsaWQucHVzaChyZXN1bHQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGludmFsaWQucHVzaChyZXN1bHQpO1xuICAgICAgICAgIHZhbGlkYXRpb25FcnJvcnMucHVzaChg5qSc6Ki85aSx5pWXOiAke3Jlc3VsdC5maWxlLnBhdGh9YCk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGludmFsaWQucHVzaChyZXN1bHQpO1xuICAgICAgICB2YWxpZGF0aW9uRXJyb3JzLnB1c2goYOaknOiovOOCqOODqeODvDogJHtyZXN1bHQuZmlsZS5wYXRofSAtICR7ZXJyb3J9YCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgdmFsaWQsIGludmFsaWQsIHZhbGlkYXRpb25FcnJvcnMgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDliIbpoZ7ntZDmnpzjga7jg5XjgqPjg6vjgr/jg6rjg7PjgrBcbiAgICovXG4gIHB1YmxpYyBmaWx0ZXJDbGFzc2lmaWNhdGlvbnMoXG4gICAgcmVzdWx0czogQ2xhc3NpZmljYXRpb25SZXN1bHRbXSxcbiAgICBmaWx0ZXJzOiB7XG4gICAgICBmaWxlVHlwZT86IEZpbGVUeXBlW107XG4gICAgICBtaW5Db25maWRlbmNlPzogbnVtYmVyO1xuICAgICAgbWF4Q29uZmlkZW5jZT86IG51bWJlcjtcbiAgICAgIHJlcXVpcmVzUmV2aWV3PzogYm9vbGVhbjtcbiAgICAgIGVudmlyb25tZW50PzogRW52aXJvbm1lbnQ7XG4gICAgfVxuICApOiBDbGFzc2lmaWNhdGlvblJlc3VsdFtdIHtcbiAgICByZXR1cm4gcmVzdWx0cy5maWx0ZXIocmVzdWx0ID0+IHtcbiAgICAgIGlmIChmaWx0ZXJzLmZpbGVUeXBlICYmICFmaWx0ZXJzLmZpbGVUeXBlLmluY2x1ZGVzKHJlc3VsdC5maWxlVHlwZSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBpZiAoZmlsdGVycy5taW5Db25maWRlbmNlICE9PSB1bmRlZmluZWQgJiYgcmVzdWx0LmNvbmZpZGVuY2UgPCBmaWx0ZXJzLm1pbkNvbmZpZGVuY2UpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBpZiAoZmlsdGVycy5tYXhDb25maWRlbmNlICE9PSB1bmRlZmluZWQgJiYgcmVzdWx0LmNvbmZpZGVuY2UgPiBmaWx0ZXJzLm1heENvbmZpZGVuY2UpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBpZiAoZmlsdGVycy5yZXF1aXJlc1JldmlldyAhPT0gdW5kZWZpbmVkICYmIHJlc3VsdC5yZXF1aXJlc1JldmlldyAhPT0gZmlsdGVycy5yZXF1aXJlc1Jldmlldykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGlmIChmaWx0ZXJzLmVudmlyb25tZW50ICYmIHJlc3VsdC5maWxlLmVudmlyb25tZW50ICE9PSBmaWx0ZXJzLmVudmlyb25tZW50KSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog5YiG6aGe57WQ5p6c44Gu44K944O844OIXG4gICAqL1xuICBwdWJsaWMgc29ydENsYXNzaWZpY2F0aW9ucyhcbiAgICByZXN1bHRzOiBDbGFzc2lmaWNhdGlvblJlc3VsdFtdLFxuICAgIHNvcnRCeTogJ2NvbmZpZGVuY2UnIHwgJ2ZpbGVUeXBlJyB8ICdwYXRoJyB8ICdzaXplJyA9ICdjb25maWRlbmNlJyxcbiAgICBvcmRlcjogJ2FzYycgfCAnZGVzYycgPSAnZGVzYydcbiAgKTogQ2xhc3NpZmljYXRpb25SZXN1bHRbXSB7XG4gICAgcmV0dXJuIFsuLi5yZXN1bHRzXS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICBsZXQgY29tcGFyaXNvbiA9IDA7XG5cbiAgICAgIHN3aXRjaCAoc29ydEJ5KSB7XG4gICAgICAgIGNhc2UgJ2NvbmZpZGVuY2UnOlxuICAgICAgICAgIGNvbXBhcmlzb24gPSBhLmNvbmZpZGVuY2UgLSBiLmNvbmZpZGVuY2U7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2ZpbGVUeXBlJzpcbiAgICAgICAgICBjb21wYXJpc29uID0gYS5maWxlVHlwZS5sb2NhbGVDb21wYXJlKGIuZmlsZVR5cGUpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdwYXRoJzpcbiAgICAgICAgICBjb21wYXJpc29uID0gYS5maWxlLnBhdGgubG9jYWxlQ29tcGFyZShiLmZpbGUucGF0aCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3NpemUnOlxuICAgICAgICAgIGNvbXBhcmlzb24gPSBhLmZpbGUuc2l6ZSAtIGIuZmlsZS5zaXplO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gb3JkZXIgPT09ICdhc2MnID8gY29tcGFyaXNvbiA6IC1jb21wYXJpc29uO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOeSsOWig+ODleOCoeOCpOODq+OCkuOCueOCreODo+ODs1xuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBzY2FuRW52aXJvbm1lbnRGaWxlcyhlbnZpcm9ubWVudDogRW52aXJvbm1lbnQpOiBQcm9taXNlPEZpbGVJbmZvW10+IHtcbiAgICBpZiAoZW52aXJvbm1lbnQgPT09ICdsb2NhbCcpIHtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmxvY2FsU2Nhbm5lci5kZXRlY3RMb2NhbEZsYXRGaWxlcygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBwcm9qZWN0RmlsZXMgPSBhd2FpdCB0aGlzLmVjMlNjYW5uZXIuZGV0ZWN0RUMyRmxhdEZpbGVzKCk7XG4gICAgICBjb25zdCBob21lRmlsZXMgPSBhd2FpdCB0aGlzLmVjMlNjYW5uZXIuZGV0ZWN0SG9tZUZsYXRGaWxlcygpO1xuICAgICAgcmV0dXJuIFsuLi5wcm9qZWN0RmlsZXMsIC4uLmhvbWVGaWxlc107XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNldHRsZWRSZXN1bHQg44KS5Yem55CGXG4gICAqL1xuICBwcml2YXRlIHByb2Nlc3NTZXR0bGVkUmVzdWx0KFxuICAgIHJlc3VsdDogUHJvbWlzZVNldHRsZWRSZXN1bHQ8RW52aXJvbm1lbnRDbGFzc2lmaWNhdGlvblJlc3VsdD4sXG4gICAgZW52aXJvbm1lbnQ6IEVudmlyb25tZW50XG4gICk6IEVudmlyb25tZW50Q2xhc3NpZmljYXRpb25SZXN1bHQge1xuICAgIGlmIChyZXN1bHQuc3RhdHVzID09PSAnZnVsZmlsbGVkJykge1xuICAgICAgcmV0dXJuIHJlc3VsdC52YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcihgJHtlbnZpcm9ubWVudH3nkrDlooPjga7liIbpoZ7lh6bnkIbjgYzlpLHmlZc6YCwgcmVzdWx0LnJlYXNvbik7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBlbnZpcm9ubWVudCxcbiAgICAgICAgdG90YWxGaWxlczogMCxcbiAgICAgICAgY2xhc3NpZmljYXRpb25zOiBbXSxcbiAgICAgICAgc3RhdGlzdGljczogdGhpcy5jcmVhdGVFbXB0eVN0YXRpc3RpY3MoKSxcbiAgICAgICAgZXJyb3JzOiBbcmVzdWx0LnJlYXNvbiBpbnN0YW5jZW9mIEVycm9yID8gcmVzdWx0LnJlYXNvbi5tZXNzYWdlIDogU3RyaW5nKHJlc3VsdC5yZWFzb24pXSxcbiAgICAgICAgcHJvY2Vzc2luZ1RpbWU6IDBcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOWFqOS9k+e1seioiOOCkueUn+aIkFxuICAgKi9cbiAgcHJpdmF0ZSBnZW5lcmF0ZU92ZXJhbGxTdGF0aXN0aWNzKFxuICAgIGVudmlyb25tZW50UmVzdWx0czogUmVjb3JkPEVudmlyb25tZW50LCBFbnZpcm9ubWVudENsYXNzaWZpY2F0aW9uUmVzdWx0PlxuICApOiBDbGFzc2lmaWNhdGlvblN0YXRpc3RpY3Mge1xuICAgIGNvbnN0IGFsbENsYXNzaWZpY2F0aW9ucyA9IE9iamVjdC52YWx1ZXMoZW52aXJvbm1lbnRSZXN1bHRzKVxuICAgICAgLmZsYXRNYXAocmVzdWx0ID0+IHJlc3VsdC5jbGFzc2lmaWNhdGlvbnMpO1xuXG4gICAgaWYgKGFsbENsYXNzaWZpY2F0aW9ucy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB0aGlzLmNyZWF0ZUVtcHR5U3RhdGlzdGljcygpO1xuICAgIH1cblxuICAgIC8vIOODleOCoeOCpOODq+OCv+OCpOODl+WIpee1seioiFxuICAgIGNvbnN0IGJ5RmlsZVR5cGU6IFJlY29yZDxGaWxlVHlwZSwgbnVtYmVyPiA9IHt9IGFzIFJlY29yZDxGaWxlVHlwZSwgbnVtYmVyPjtcbiAgICBmb3IgKGNvbnN0IGNsYXNzaWZpY2F0aW9uIG9mIGFsbENsYXNzaWZpY2F0aW9ucykge1xuICAgICAgYnlGaWxlVHlwZVtjbGFzc2lmaWNhdGlvbi5maWxlVHlwZV0gPSAoYnlGaWxlVHlwZVtjbGFzc2lmaWNhdGlvbi5maWxlVHlwZV0gfHwgMCkgKyAxO1xuICAgIH1cblxuICAgIC8vIOS/oemgvOW6puWIpee1seioiFxuICAgIGNvbnN0IGJ5Q29uZmlkZW5jZSA9IHtcbiAgICAgICdoaWdoICgwLjgrKSc6IDAsXG4gICAgICAnbWVkaXVtICgwLjUtMC44KSc6IDAsXG4gICAgICAnbG93ICgwLjAtMC41KSc6IDBcbiAgICB9O1xuXG4gICAgbGV0IHRvdGFsQ29uZmlkZW5jZSA9IDA7XG4gICAgbGV0IHJlcXVpcmVzUmV2aWV3ID0gMDtcblxuICAgIGZvciAoY29uc3QgY2xhc3NpZmljYXRpb24gb2YgYWxsQ2xhc3NpZmljYXRpb25zKSB7XG4gICAgICB0b3RhbENvbmZpZGVuY2UgKz0gY2xhc3NpZmljYXRpb24uY29uZmlkZW5jZTtcblxuICAgICAgaWYgKGNsYXNzaWZpY2F0aW9uLmNvbmZpZGVuY2UgPj0gMC44KSB7XG4gICAgICAgIGJ5Q29uZmlkZW5jZVsnaGlnaCAoMC44KyknXSsrO1xuICAgICAgfSBlbHNlIGlmIChjbGFzc2lmaWNhdGlvbi5jb25maWRlbmNlID49IDAuNSkge1xuICAgICAgICBieUNvbmZpZGVuY2VbJ21lZGl1bSAoMC41LTAuOCknXSsrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnlDb25maWRlbmNlWydsb3cgKDAuMC0wLjUpJ10rKztcbiAgICAgIH1cblxuICAgICAgaWYgKGNsYXNzaWZpY2F0aW9uLnJlcXVpcmVzUmV2aWV3KSB7XG4gICAgICAgIHJlcXVpcmVzUmV2aWV3Kys7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgYXZlcmFnZUNvbmZpZGVuY2UgPSB0b3RhbENvbmZpZGVuY2UgLyBhbGxDbGFzc2lmaWNhdGlvbnMubGVuZ3RoO1xuICAgIGNvbnN0IHN1Y2Nlc3NSYXRlID0gYWxsQ2xhc3NpZmljYXRpb25zLmZpbHRlcihjID0+IGMuY29uZmlkZW5jZSA+PSAwLjUpLmxlbmd0aCAvIGFsbENsYXNzaWZpY2F0aW9ucy5sZW5ndGg7XG5cbiAgICByZXR1cm4ge1xuICAgICAgYnlGaWxlVHlwZSxcbiAgICAgIGJ5Q29uZmlkZW5jZSxcbiAgICAgIHJlcXVpcmVzUmV2aWV3LFxuICAgICAgYXZlcmFnZUNvbmZpZGVuY2UsXG4gICAgICBzdWNjZXNzUmF0ZVxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog5o6o5aWo5LqL6aCF44KS55Sf5oiQXG4gICAqL1xuICBwcml2YXRlIGdlbmVyYXRlUmVjb21tZW5kYXRpb25zKFxuICAgIGVudmlyb25tZW50UmVzdWx0czogUmVjb3JkPEVudmlyb25tZW50LCBFbnZpcm9ubWVudENsYXNzaWZpY2F0aW9uUmVzdWx0PlxuICApOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgcmVjb21tZW5kYXRpb25zOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHN0YXRzID0gdGhpcy5nZW5lcmF0ZU92ZXJhbGxTdGF0aXN0aWNzKGVudmlyb25tZW50UmVzdWx0cyk7XG5cbiAgICAvLyDkv6HpoLzluqbjgavln7rjgaXjgY/mjqjlpajkuovpoIVcbiAgICBpZiAoc3RhdHMuYXZlcmFnZUNvbmZpZGVuY2UgPCAwLjYpIHtcbiAgICAgIHJlY29tbWVuZGF0aW9ucy5wdXNoKCfliIbpoZ7jg6vjg7zjg6vjga7opovnm7TjgZfjgpLmjqjlpajjgZfjgb7jgZnvvIjlubPlnYfkv6HpoLzluqbjgYzkvY7jgYTvvIknKTtcbiAgICB9XG5cbiAgICAvLyDjg6zjg5Pjg6Xjg7zlv4XopoHjg5XjgqHjgqTjg6vjgavln7rjgaXjgY/mjqjlpajkuovpoIVcbiAgICBpZiAoc3RhdHMucmVxdWlyZXNSZXZpZXcgPiAxMCkge1xuICAgICAgcmVjb21tZW5kYXRpb25zLnB1c2goYCR7c3RhdHMucmVxdWlyZXNSZXZpZXd95YCL44Gu44OV44Kh44Kk44Or44GM44Os44OT44Ol44O844KS5b+F6KaB44Go44GX44Gm44GE44G+44GZYCk7XG4gICAgfVxuXG4gICAgLy8g55Kw5aKD5Yil5o6o5aWo5LqL6aCFXG4gICAgZm9yIChjb25zdCBbZW52LCByZXN1bHRdIG9mIE9iamVjdC5lbnRyaWVzKGVudmlyb25tZW50UmVzdWx0cykpIHtcbiAgICAgIGlmIChyZXN1bHQuZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgcmVjb21tZW5kYXRpb25zLnB1c2goYCR7ZW52feeSsOWig+OBp+OCqOODqeODvOOBjOeZuueUn+OBl+OBpuOBhOOBvuOBmeOAguaOpee2muioreWumuOCkueiuuiqjeOBl+OBpuOBj+OBoOOBleOBhGApO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVzdWx0LnRvdGFsRmlsZXMgPiAxMDApIHtcbiAgICAgICAgcmVjb21tZW5kYXRpb25zLnB1c2goYCR7ZW52feeSsOWig+OBq+WkmuaVsOOBruODleOCoeOCpOODq+OBjOOBguOCiuOBvuOBmeOAguautemajueahOOBquaVtOeQhuOCkuaOqOWlqOOBl+OBvuOBmWApO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIOODleOCoeOCpOODq+OCv+OCpOODl+WIpeaOqOWlqOS6i+mghVxuICAgIGNvbnN0IHVua25vd25Db3VudCA9IHN0YXRzLmJ5RmlsZVR5cGVbRmlsZVR5cGUuVU5LTk9XTl0gfHwgMDtcbiAgICBpZiAodW5rbm93bkNvdW50ID4gNSkge1xuICAgICAgcmVjb21tZW5kYXRpb25zLnB1c2goYCR7dW5rbm93bkNvdW50feWAi+OBruS4jeaYjuODleOCoeOCpOODq+OBjOOBguOCiuOBvuOBmeOAguWIhumhnuODq+ODvOODq+OBrui/veWKoOOCkuaknOiojuOBl+OBpuOBj+OBoOOBleOBhGApO1xuICAgIH1cblxuICAgIHJldHVybiByZWNvbW1lbmRhdGlvbnM7XG4gIH1cblxuICAvKipcbiAgICog6K2m5ZGK44KS55Sf5oiQXG4gICAqL1xuICBwcml2YXRlIGdlbmVyYXRlV2FybmluZ3MoXG4gICAgZW52aXJvbm1lbnRSZXN1bHRzOiBSZWNvcmQ8RW52aXJvbm1lbnQsIEVudmlyb25tZW50Q2xhc3NpZmljYXRpb25SZXN1bHQ+XG4gICk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcblxuICAgIGZvciAoY29uc3QgW2VudiwgcmVzdWx0XSBvZiBPYmplY3QuZW50cmllcyhlbnZpcm9ubWVudFJlc3VsdHMpKSB7XG4gICAgICAvLyDjgqjjg6njg7zjgYzjgYLjgovloLTlkIhcbiAgICAgIGlmIChyZXN1bHQuZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgd2FybmluZ3MucHVzaChgJHtlbnZ955Kw5aKD44GnJHtyZXN1bHQuZXJyb3JzLmxlbmd0aH3lgIvjga7jgqjjg6njg7zjgYznmbrnlJ/jgZfjgb7jgZfjgZ9gKTtcbiAgICAgIH1cblxuICAgICAgLy8g5Yem55CG5pmC6ZaT44GM6ZW344GE5aC05ZCIXG4gICAgICBpZiAocmVzdWx0LnByb2Nlc3NpbmdUaW1lID4gMzAwMDApIHsgLy8gMzDnp5JcbiAgICAgICAgd2FybmluZ3MucHVzaChgJHtlbnZ955Kw5aKD44Gu5Yem55CG5pmC6ZaT44GM6ZW344GZ44GO44G+44GZICgke3Jlc3VsdC5wcm9jZXNzaW5nVGltZX1tcylgKTtcbiAgICAgIH1cblxuICAgICAgLy8g5qmf5a+G44OV44Kh44Kk44Or44Gu6K2m5ZGKXG4gICAgICBjb25zdCBzZW5zaXRpdmVGaWxlcyA9IHJlc3VsdC5jbGFzc2lmaWNhdGlvbnMuZmlsdGVyKGMgPT4gXG4gICAgICAgIGMuZmlsZVR5cGUgPT09IEZpbGVUeXBlLlNFQ1VSSVRZX0tFWVMgfHwgYy5maWxlVHlwZSA9PT0gRmlsZVR5cGUuU0VDVVJJVFlfU0VDUkVUU1xuICAgICAgKTtcbiAgICAgIGlmIChzZW5zaXRpdmVGaWxlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHdhcm5pbmdzLnB1c2goYCR7ZW52feeSsOWig+OBpyR7c2Vuc2l0aXZlRmlsZXMubGVuZ3RofeWAi+OBruapn+WvhuODleOCoeOCpOODq+OBjOaknOWHuuOBleOCjOOBvuOBl+OBn2ApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB3YXJuaW5ncztcbiAgfVxuXG4gIC8qKlxuICAgKiDnqbrjga7ntbHoqIjjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlRW1wdHlTdGF0aXN0aWNzKCk6IENsYXNzaWZpY2F0aW9uU3RhdGlzdGljcyB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGJ5RmlsZVR5cGU6IHt9IGFzIFJlY29yZDxGaWxlVHlwZSwgbnVtYmVyPixcbiAgICAgIGJ5Q29uZmlkZW5jZToge1xuICAgICAgICAnaGlnaCAoMC44KyknOiAwLFxuICAgICAgICAnbWVkaXVtICgwLjUtMC44KSc6IDAsXG4gICAgICAgICdsb3cgKDAuMC0wLjUpJzogMFxuICAgICAgfSxcbiAgICAgIHJlcXVpcmVzUmV2aWV3OiAwLFxuICAgICAgYXZlcmFnZUNvbmZpZGVuY2U6IDAsXG4gICAgICBzdWNjZXNzUmF0ZTogMFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog44Os44Od44O844OI44KS5L+d5a2YXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHNhdmVSZXBvcnQocmVwb3J0OiBDbGFzc2lmaWNhdGlvblJlcG9ydCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXBvcnREaXIgPSAnZGV2ZWxvcG1lbnQvbG9ncy9vcmdhbml6YXRpb24nO1xuICAgICAgYXdhaXQgZnMubWtkaXIocmVwb3J0RGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblxuICAgICAgY29uc3QgcmVwb3J0UGF0aCA9IHBhdGguam9pbihyZXBvcnREaXIsIGBjbGFzc2lmaWNhdGlvbi1yZXBvcnQtJHtyZXBvcnQucmVwb3J0SWR9Lmpzb25gKTtcbiAgICAgIGF3YWl0IGZzLndyaXRlRmlsZShyZXBvcnRQYXRoLCBKU09OLnN0cmluZ2lmeShyZXBvcnQsIG51bGwsIDIpKTtcblxuICAgICAgY29uc29sZS5sb2coYPCfk4sg5YiG6aGe44Os44Od44O844OI44KS5L+d5a2Y44GX44G+44GX44GfOiAke3JlcG9ydFBhdGh9YCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUud2Fybign44Os44Od44O844OI5L+d5a2Y44Gr5aSx5pWX44GX44G+44GX44GfOicsIGVycm9yKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog5YiG6aGe57WQ5p6c44Gu5aal5b2T5oCn44KS5qSc6Ki8XG4gICAqL1xuICBwcml2YXRlIGlzVmFsaWRDbGFzc2lmaWNhdGlvbihyZXN1bHQ6IENsYXNzaWZpY2F0aW9uUmVzdWx0KTogYm9vbGVhbiB7XG4gICAgLy8g5Z+65pys55qE44Gq5qSc6Ki8XG4gICAgaWYgKCFyZXN1bHQuZmlsZSB8fCAhcmVzdWx0LnRhcmdldFBhdGggfHwgIXJlc3VsdC5maWxlVHlwZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIOS/oemgvOW6puOBruevhOWbsuODgeOCp+ODg+OCr1xuICAgIGlmIChyZXN1bHQuY29uZmlkZW5jZSA8IDAgfHwgcmVzdWx0LmNvbmZpZGVuY2UgPiAxKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8g44K/44O844Ky44OD44OI44OR44K544Gu5aal5b2T5oCn44OB44Kn44OD44KvXG4gICAgaWYgKHJlc3VsdC50YXJnZXRQYXRoLmluY2x1ZGVzKCcuLicpIHx8IHJlc3VsdC50YXJnZXRQYXRoLnN0YXJ0c1dpdGgoJy8nKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIOODleOCoeOCpOODq+OCv+OCpOODl+OBruWmpeW9k+aAp+ODgeOCp+ODg+OCr1xuICAgIGlmICghT2JqZWN0LnZhbHVlcyhGaWxlVHlwZSkuaW5jbHVkZXMocmVzdWx0LmZpbGVUeXBlKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIOWIhumhnue1kOaenOOBi+OCiee1seioiOOCkueUn+aIkFxuICAgKi9cbiAgcHJpdmF0ZSBnZW5lcmF0ZVN0YXRpc3RpY3NGb3JDbGFzc2lmaWNhdGlvbnMoY2xhc3NpZmljYXRpb25zOiBDbGFzc2lmaWNhdGlvblJlc3VsdFtdKTogQ2xhc3NpZmljYXRpb25TdGF0aXN0aWNzIHtcbiAgICBpZiAoY2xhc3NpZmljYXRpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlRW1wdHlTdGF0aXN0aWNzKCk7XG4gICAgfVxuXG4gICAgLy8g44OV44Kh44Kk44Or44K/44Kk44OX5Yil57Wx6KiIXG4gICAgY29uc3QgYnlGaWxlVHlwZTogUmVjb3JkPEZpbGVUeXBlLCBudW1iZXI+ID0ge30gYXMgUmVjb3JkPEZpbGVUeXBlLCBudW1iZXI+O1xuICAgIGZvciAoY29uc3QgY2xhc3NpZmljYXRpb24gb2YgY2xhc3NpZmljYXRpb25zKSB7XG4gICAgICBieUZpbGVUeXBlW2NsYXNzaWZpY2F0aW9uLmZpbGVUeXBlXSA9IChieUZpbGVUeXBlW2NsYXNzaWZpY2F0aW9uLmZpbGVUeXBlXSB8fCAwKSArIDE7XG4gICAgfVxuXG4gICAgLy8g5L+h6aC85bqm5Yil57Wx6KiIXG4gICAgY29uc3QgYnlDb25maWRlbmNlID0ge1xuICAgICAgJ2hpZ2ggKDAuOCspJzogMCxcbiAgICAgICdtZWRpdW0gKDAuNS0wLjgpJzogMCxcbiAgICAgICdsb3cgKDAuMC0wLjUpJzogMFxuICAgIH07XG5cbiAgICBsZXQgdG90YWxDb25maWRlbmNlID0gMDtcbiAgICBsZXQgcmVxdWlyZXNSZXZpZXcgPSAwO1xuXG4gICAgZm9yIChjb25zdCBjbGFzc2lmaWNhdGlvbiBvZiBjbGFzc2lmaWNhdGlvbnMpIHtcbiAgICAgIHRvdGFsQ29uZmlkZW5jZSArPSBjbGFzc2lmaWNhdGlvbi5jb25maWRlbmNlO1xuXG4gICAgICBpZiAoY2xhc3NpZmljYXRpb24uY29uZmlkZW5jZSA+PSAwLjgpIHtcbiAgICAgICAgYnlDb25maWRlbmNlWydoaWdoICgwLjgrKSddKys7XG4gICAgICB9IGVsc2UgaWYgKGNsYXNzaWZpY2F0aW9uLmNvbmZpZGVuY2UgPj0gMC41KSB7XG4gICAgICAgIGJ5Q29uZmlkZW5jZVsnbWVkaXVtICgwLjUtMC44KSddKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBieUNvbmZpZGVuY2VbJ2xvdyAoMC4wLTAuNSknXSsrO1xuICAgICAgfVxuXG4gICAgICBpZiAoY2xhc3NpZmljYXRpb24ucmVxdWlyZXNSZXZpZXcpIHtcbiAgICAgICAgcmVxdWlyZXNSZXZpZXcrKztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBhdmVyYWdlQ29uZmlkZW5jZSA9IHRvdGFsQ29uZmlkZW5jZSAvIGNsYXNzaWZpY2F0aW9ucy5sZW5ndGg7XG4gICAgY29uc3Qgc3VjY2Vzc1JhdGUgPSBjbGFzc2lmaWNhdGlvbnMuZmlsdGVyKGMgPT4gYy5jb25maWRlbmNlID49IDAuNSkubGVuZ3RoIC8gY2xhc3NpZmljYXRpb25zLmxlbmd0aDtcblxuICAgIHJldHVybiB7XG4gICAgICBieUZpbGVUeXBlLFxuICAgICAgYnlDb25maWRlbmNlLFxuICAgICAgcmVxdWlyZXNSZXZpZXcsXG4gICAgICBhdmVyYWdlQ29uZmlkZW5jZSxcbiAgICAgIHN1Y2Nlc3NSYXRlXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg6zjg53jg7zjg4jjgpJDU1blvaLlvI/jgafjgqjjgq/jgrnjg53jg7zjg4hcbiAgICovXG4gIHB1YmxpYyBhc3luYyBleHBvcnRSZXBvcnRUb0NTVihyZXBvcnQ6IENsYXNzaWZpY2F0aW9uUmVwb3J0LCBvdXRwdXRQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgY3N2TGluZXM6IHN0cmluZ1tdID0gW107XG4gICAgICBcbiAgICAgIC8vIOODmOODg+ODgOODvFxuICAgICAgY3N2TGluZXMucHVzaChbXG4gICAgICAgICdFbnZpcm9ubWVudCcsICdGaWxlUGF0aCcsICdGaWxlTmFtZScsICdGaWxlVHlwZScsICdUYXJnZXRQYXRoJywgXG4gICAgICAgICdDb25maWRlbmNlJywgJ1JlcXVpcmVzUmV2aWV3JywgJ0ZpbGVTaXplJywgJ0xhc3RNb2RpZmllZCcsICdSZWFzb25pbmcnXG4gICAgICBdLmpvaW4oJywnKSk7XG5cbiAgICAgIC8vIOODh+ODvOOCv+ihjFxuICAgICAgZm9yIChjb25zdCBbZW52LCByZXN1bHRdIG9mIE9iamVjdC5lbnRyaWVzKHJlcG9ydC5lbnZpcm9ubWVudFJlc3VsdHMpKSB7XG4gICAgICAgIGZvciAoY29uc3QgY2xhc3NpZmljYXRpb24gb2YgcmVzdWx0LmNsYXNzaWZpY2F0aW9ucykge1xuICAgICAgICAgIGNvbnN0IHJvdyA9IFtcbiAgICAgICAgICAgIGVudixcbiAgICAgICAgICAgIGBcIiR7Y2xhc3NpZmljYXRpb24uZmlsZS5wYXRofVwiYCxcbiAgICAgICAgICAgIGBcIiR7Y2xhc3NpZmljYXRpb24uZmlsZS5uYW1lfVwiYCxcbiAgICAgICAgICAgIGNsYXNzaWZpY2F0aW9uLmZpbGVUeXBlLFxuICAgICAgICAgICAgYFwiJHtjbGFzc2lmaWNhdGlvbi50YXJnZXRQYXRofVwiYCxcbiAgICAgICAgICAgIGNsYXNzaWZpY2F0aW9uLmNvbmZpZGVuY2UudG9GaXhlZCgzKSxcbiAgICAgICAgICAgIGNsYXNzaWZpY2F0aW9uLnJlcXVpcmVzUmV2aWV3LnRvU3RyaW5nKCksXG4gICAgICAgICAgICBjbGFzc2lmaWNhdGlvbi5maWxlLnNpemUudG9TdHJpbmcoKSxcbiAgICAgICAgICAgIGNsYXNzaWZpY2F0aW9uLmZpbGUubGFzdE1vZGlmaWVkLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICBgXCIke2NsYXNzaWZpY2F0aW9uLnJlYXNvbmluZy5qb2luKCc7ICcpfVwiYFxuICAgICAgICAgIF07XG4gICAgICAgICAgY3N2TGluZXMucHVzaChyb3cuam9pbignLCcpKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBhd2FpdCBmcy53cml0ZUZpbGUob3V0cHV0UGF0aCwgY3N2TGluZXMuam9pbignXFxuJykpO1xuICAgICAgY29uc29sZS5sb2coYPCfk4ogQ1NW44Os44Od44O844OI44KS5L+d5a2Y44GX44G+44GX44GfOiAke291dHB1dFBhdGh9YCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgT3JnYW5pemF0aW9uRXJyb3JUeXBlLkNMQVNTSUZJQ0FUSU9OX0ZBSUxFRCxcbiAgICAgICAgYENTVuOCqOOCr+OCueODneODvOODiOOBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtlcnJvcn1gLFxuICAgICAgICBvdXRwdXRQYXRoLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxufSJdfQ==