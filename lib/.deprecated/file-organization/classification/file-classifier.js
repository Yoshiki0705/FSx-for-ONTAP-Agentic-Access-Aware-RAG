"use strict";
/**
 * 統合ファイル整理システム - ファイル分類器
 *
 * パターンマッチングエンジンを使用してファイルを分類し、
 * 適切なターゲットパスを決定する機能を提供します。
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
exports.FileClassifier = void 0;
const path = __importStar(require("path"));
const pattern_matcher_js_1 = require("./pattern-matcher.js");
const index_js_1 = require("../types/index.js");
/**
 * ファイル分類器
 *
 * ファイルの性質を分析し、適切なカテゴリとターゲットパスを決定します。
 * 分類信頼度の計算と結果の検証機能も提供します。
 */
class FileClassifier {
    patternMatcher;
    config;
    environment;
    constructor(config, environment) {
        this.config = config;
        this.environment = environment;
        this.patternMatcher = new pattern_matcher_js_1.PatternMatcher(config.classificationRules, true);
    }
    /**
     * ファイルを分類
     */
    async classifyFile(file) {
        try {
            // 特別ルールのチェック
            if (this.shouldIgnore(file)) {
                return this.createIgnoreResult(file);
            }
            if (this.shouldPreserve(file)) {
                return this.createPreserveResult(file);
            }
            // パターンマッチングによる分類
            const matchResult = this.patternMatcher.findBestMatch(file);
            if (!matchResult) {
                return this.createUnknownResult(file);
            }
            // ファイルタイプの決定
            const fileType = this.determineFileType(matchResult, file);
            // ターゲットパスの生成
            const targetPath = this.determineTargetPath(file, fileType);
            // 分類信頼度の調整
            const adjustedConfidence = this.adjustConfidence(matchResult.confidence, file, fileType);
            // レビュー必要性の判定
            const requiresReview = this.shouldRequireReview(file, matchResult, adjustedConfidence);
            return {
                file,
                fileType,
                targetPath,
                confidence: adjustedConfidence,
                reasoning: this.buildReasoning(matchResult, file, fileType),
                requiresReview,
                classificationTime: new Date(),
                appliedRule: matchResult.rule.name
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.CLASSIFICATION_FAILED, `ファイル分類に失敗しました: ${file.path}`, file.path, this.environment, error);
        }
    }
    /**
     * ターゲットパスを決定
     */
    determineTargetPath(file, classification) {
        const baseTargetPath = this.getBaseTargetPath(classification);
        // 環境固有の調整
        const adjustedPath = this.adjustPathForEnvironment(baseTargetPath, file);
        // ファイル名の重複チェックと調整
        const finalPath = this.resolveDuplicatePath(adjustedPath, file.name);
        return finalPath;
    }
    /**
     * 分類結果を検証
     */
    validateClassification(file, classification) {
        try {
            // 基本的な検証
            if (!classification.targetPath || classification.confidence < 0 || classification.confidence > 1) {
                return false;
            }
            // ファイルタイプと拡張子の整合性チェック
            if (!this.isFileTypeConsistent(file, classification.fileType)) {
                return false;
            }
            // ターゲットパスの妥当性チェック
            if (!this.isTargetPathValid(classification.targetPath)) {
                return false;
            }
            // 権限設定の妥当性チェック
            if (!this.arePermissionsValid(file, classification.fileType)) {
                return false;
            }
            return true;
        }
        catch (error) {
            console.warn(`分類結果検証エラー: ${file.path}`, error);
            return false;
        }
    }
    /**
     * 複数ファイルの一括分類
     */
    async classifyFiles(files) {
        const results = [];
        const errors = [];
        for (const file of files) {
            try {
                const result = await this.classifyFile(file);
                results.push(result);
            }
            catch (error) {
                errors.push(error);
                console.warn(`ファイル分類エラー: ${file.path}`, error);
            }
        }
        if (errors.length > 0) {
            console.warn(`${errors.length} 個のファイル分類でエラーが発生しました`);
        }
        return results;
    }
    /**
     * 分類統計を生成
     */
    generateClassificationStatistics(results) {
        const stats = {
            totalFiles: results.length,
            byFileType: {},
            byConfidence: {
                'high (0.8+)': 0,
                'medium (0.5-0.8)': 0,
                'low (0.0-0.5)': 0
            },
            requiresReview: 0,
            averageConfidence: 0
        };
        let totalConfidence = 0;
        for (const result of results) {
            // ファイルタイプ別統計
            stats.byFileType[result.fileType] = (stats.byFileType[result.fileType] || 0) + 1;
            // 信頼度別統計
            if (result.confidence >= 0.8) {
                stats.byConfidence['high (0.8+)']++;
            }
            else if (result.confidence >= 0.5) {
                stats.byConfidence['medium (0.5-0.8)']++;
            }
            else {
                stats.byConfidence['low (0.0-0.5)']++;
            }
            // レビュー必要統計
            if (result.requiresReview) {
                stats.requiresReview++;
            }
            totalConfidence += result.confidence;
        }
        // 平均信頼度
        stats.averageConfidence = results.length > 0 ? totalConfidence / results.length : 0;
        return stats;
    }
    /**
     * 無視すべきファイルかどうかを判定
     */
    shouldIgnore(file) {
        const ignorePatterns = this.config.specialRules.ignoreFiles;
        return ignorePatterns.some(pattern => this.matchesPattern(file.name, pattern));
    }
    /**
     * 保持すべきファイルかどうかを判定
     */
    shouldPreserve(file) {
        const preservePatterns = this.config.specialRules.preserveFiles;
        return preservePatterns.some(pattern => this.matchesPattern(file.name, pattern));
    }
    /**
     * レビューが必要かどうかを判定
     */
    shouldRequireReview(file, matchResult, confidence) {
        // 低い信頼度の場合
        if (confidence < 0.5) {
            return true;
        }
        // 特別ルールで指定されたファイル
        const reviewPatterns = this.config.specialRules.requireReview;
        if (reviewPatterns.some(pattern => this.matchesPattern(file.name, pattern))) {
            return true;
        }
        // 大きなファイル
        if (file.size > this.config.validation.maxFileSize / 10) {
            return true;
        }
        // 機密性の高いファイル
        if (this.isSensitiveFile(file)) {
            return true;
        }
        return false;
    }
    /**
     * ファイルタイプを決定
     */
    determineFileType(matchResult, file) {
        const ruleName = matchResult.rule.name;
        const category = this.findRuleCategory(matchResult.rule);
        // カテゴリとルール名からFileTypeを決定
        const fileTypeMap = {
            'scripts': {
                'deployment': index_js_1.FileType.SCRIPT_DEPLOYMENT,
                'analysis': index_js_1.FileType.SCRIPT_ANALYSIS,
                'maintenance': index_js_1.FileType.SCRIPT_MAINTENANCE,
                'utilities': index_js_1.FileType.SCRIPT_UTILITIES,
                'legacy': index_js_1.FileType.SCRIPT_LEGACY
            },
            'documents': {
                'troubleshooting': index_js_1.FileType.DOC_TROUBLESHOOTING,
                'deployment': index_js_1.FileType.DOC_DEPLOYMENT,
                'guides': index_js_1.FileType.DOC_GUIDES,
                'reports': index_js_1.FileType.DOC_REPORTS,
                'legacy': index_js_1.FileType.DOC_LEGACY
            },
            'configs': {
                'main': index_js_1.FileType.CONFIG_MAIN,
                'environment': index_js_1.FileType.CONFIG_ENVIRONMENT,
                'samples': index_js_1.FileType.CONFIG_SAMPLES,
                'legacy': index_js_1.FileType.CONFIG_LEGACY
            },
            'tests': {
                'payloads': index_js_1.FileType.TEST_PAYLOADS,
                'unit': index_js_1.FileType.TEST_UNIT,
                'integration': index_js_1.FileType.TEST_INTEGRATION,
                'legacy': index_js_1.FileType.TEST_LEGACY
            },
            'temp': {
                'working': index_js_1.FileType.TEMP_WORKING,
                'cache': index_js_1.FileType.TEMP_CACHE
            },
            'archive': {
                'legacy': index_js_1.FileType.ARCHIVE_LEGACY,
                'projects': index_js_1.FileType.ARCHIVE_PROJECTS
            },
            'security': {
                'keys': index_js_1.FileType.SECURITY_KEYS,
                'secrets': index_js_1.FileType.SECURITY_SECRETS
            }
        };
        return fileTypeMap[category]?.[ruleName] || index_js_1.FileType.UNKNOWN;
    }
    /**
     * ルールのカテゴリを見つける
     */
    findRuleCategory(rule) {
        for (const [category, rules] of Object.entries(this.config.classificationRules)) {
            if (Object.values(rules).some((r) => r.name === rule.name)) {
                return category;
            }
        }
        return 'unknown';
    }
    /**
     * ベースターゲットパスを取得
     */
    getBaseTargetPath(fileType) {
        const pathMap = {
            [index_js_1.FileType.SCRIPT_DEPLOYMENT]: 'development/scripts/deployment/',
            [index_js_1.FileType.SCRIPT_ANALYSIS]: 'development/scripts/analysis/',
            [index_js_1.FileType.SCRIPT_MAINTENANCE]: 'development/scripts/maintenance/',
            [index_js_1.FileType.SCRIPT_UTILITIES]: 'development/scripts/utilities/',
            [index_js_1.FileType.SCRIPT_LEGACY]: 'development/scripts/legacy/',
            [index_js_1.FileType.DOC_TROUBLESHOOTING]: 'docs/troubleshooting/',
            [index_js_1.FileType.DOC_DEPLOYMENT]: 'docs/deployment/',
            [index_js_1.FileType.DOC_GUIDES]: 'docs/guides/',
            [index_js_1.FileType.DOC_REPORTS]: 'development/docs/reports/',
            [index_js_1.FileType.DOC_LEGACY]: 'docs/legacy/',
            [index_js_1.FileType.CONFIG_MAIN]: 'config/',
            [index_js_1.FileType.CONFIG_ENVIRONMENT]: 'development/configs/',
            [index_js_1.FileType.CONFIG_SAMPLES]: 'config/samples/',
            [index_js_1.FileType.CONFIG_LEGACY]: 'config/legacy/',
            [index_js_1.FileType.TEST_PAYLOADS]: 'tests/payloads/',
            [index_js_1.FileType.TEST_UNIT]: 'tests/unit/',
            [index_js_1.FileType.TEST_INTEGRATION]: 'tests/integration/',
            [index_js_1.FileType.TEST_LEGACY]: 'tests/legacy/',
            [index_js_1.FileType.TEMP_WORKING]: 'development/temp/working/',
            [index_js_1.FileType.TEMP_CACHE]: 'development/temp/cache/',
            [index_js_1.FileType.ARCHIVE_LEGACY]: 'archive/legacy-files/',
            [index_js_1.FileType.ARCHIVE_PROJECTS]: 'archive/old-projects/',
            [index_js_1.FileType.SECURITY_KEYS]: 'development/configs/security/',
            [index_js_1.FileType.SECURITY_SECRETS]: 'development/configs/secrets/',
            [index_js_1.FileType.UNKNOWN]: 'archive/unknown/'
        };
        return pathMap[fileType] || 'archive/unknown/';
    }
    /**
     * 環境に応じたパス調整
     */
    adjustPathForEnvironment(basePath, file) {
        // 環境固有の調整ロジック
        if (this.environment === 'ec2' && basePath.startsWith('development/')) {
            // EC2環境では一部のパスを調整する場合がある
            return basePath;
        }
        return basePath;
    }
    /**
     * 重複パスの解決
     */
    resolveDuplicatePath(basePath, fileName) {
        return path.join(basePath, fileName);
    }
    /**
     * ファイルタイプの整合性チェック
     */
    isFileTypeConsistent(file, fileType) {
        const extension = file.extension.toLowerCase();
        // スクリプトファイルの整合性
        if (fileType.toString().startsWith('script_') && extension !== '.sh') {
            return false;
        }
        // ドキュメントファイルの整合性
        if (fileType.toString().startsWith('doc_') && !['.md', '.txt', '.doc', '.docx'].includes(extension)) {
            return false;
        }
        // 設定ファイルの整合性
        if (fileType.toString().startsWith('config_') && !['.json', '.js', '.ts', '.yml', '.yaml', '.env'].includes(extension)) {
            return false;
        }
        return true;
    }
    /**
     * ターゲットパスの妥当性チェック
     */
    isTargetPathValid(targetPath) {
        // 不正なパス文字のチェック
        if (targetPath.includes('..') || targetPath.includes('//')) {
            return false;
        }
        // 必須ディレクトリの存在チェック
        const requiredDirs = this.config.validation.requiredDirectories;
        const baseDir = targetPath.split('/')[0];
        return requiredDirs.some(dir => targetPath.startsWith(dir));
    }
    /**
     * 権限設定の妥当性チェック
     */
    arePermissionsValid(file, fileType) {
        // セキュリティファイルは制限された権限が必要
        if (fileType === index_js_1.FileType.SECURITY_KEYS || fileType === index_js_1.FileType.SECURITY_SECRETS) {
            return file.permissions === '600';
        }
        // スクリプトファイルは実行権限が必要
        if (fileType.toString().startsWith('script_')) {
            return file.permissions.includes('x') || file.permissions === '755';
        }
        return true;
    }
    /**
     * 機密ファイルかどうかを判定
     */
    isSensitiveFile(file) {
        const sensitivePatterns = [
            /\.pem$/i,
            /\.key$/i,
            /\.env$/i,
            /password/i,
            /secret/i,
            /credential/i
        ];
        return sensitivePatterns.some(pattern => pattern.test(file.name));
    }
    /**
     * 信頼度を調整
     */
    adjustConfidence(baseConfidence, file, fileType) {
        let adjustedConfidence = baseConfidence;
        // ファイルサイズによる調整
        if (file.size === 0) {
            adjustedConfidence *= 0.8; // 空ファイルは信頼度を下げる
        }
        // 拡張子の整合性による調整
        if (!this.isFileTypeConsistent(file, fileType)) {
            adjustedConfidence *= 0.6;
        }
        // 最終更新日による調整
        const daysSinceModified = (Date.now() - file.lastModified.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceModified > 365) {
            adjustedConfidence *= 0.9; // 古いファイルは信頼度を少し下げる
        }
        return Math.max(0, Math.min(1, adjustedConfidence));
    }
    /**
     * 分類理由を構築
     */
    buildReasoning(matchResult, file, fileType) {
        const reasoning = [matchResult.reason];
        // 追加の理由
        if (file.size > 1024 * 1024) {
            reasoning.push('大きなファイル');
        }
        if (this.isSensitiveFile(file)) {
            reasoning.push('機密ファイル');
        }
        if (file.isHidden) {
            reasoning.push('隠しファイル');
        }
        reasoning.push(`分類: ${fileType}`);
        return reasoning;
    }
    /**
     * パターンマッチング
     */
    matchesPattern(text, pattern) {
        try {
            const regex = new RegExp(pattern
                .replace(/[.+^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '.*')
                .replace(/\?/g, '.'), 'i');
            return regex.test(text);
        }
        catch {
            return false;
        }
    }
    /**
     * 無視結果を作成
     */
    createIgnoreResult(file) {
        return {
            file,
            fileType: index_js_1.FileType.UNKNOWN,
            targetPath: '', // 移動しない
            confidence: 1.0,
            reasoning: ['無視対象ファイル'],
            requiresReview: false,
            classificationTime: new Date(),
            appliedRule: 'ignore'
        };
    }
    /**
     * 保持結果を作成
     */
    createPreserveResult(file) {
        return {
            file,
            fileType: index_js_1.FileType.UNKNOWN,
            targetPath: file.path, // 現在の場所に保持
            confidence: 1.0,
            reasoning: ['保持対象ファイル'],
            requiresReview: false,
            classificationTime: new Date(),
            appliedRule: 'preserve'
        };
    }
    /**
     * 不明結果を作成
     */
    createUnknownResult(file) {
        return {
            file,
            fileType: index_js_1.FileType.UNKNOWN,
            targetPath: this.getBaseTargetPath(index_js_1.FileType.UNKNOWN) + file.name,
            confidence: 0.1,
            reasoning: ['分類パターンが見つかりません'],
            requiresReview: true,
            classificationTime: new Date(),
            appliedRule: 'unknown'
        };
    }
}
exports.FileClassifier = FileClassifier;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmlsZS1jbGFzc2lmaWVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZmlsZS1jbGFzc2lmaWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7R0FLRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCwyQ0FBNkI7QUFFN0IsNkRBQW1FO0FBQ25FLGdEQVMyQjtBQUUzQjs7Ozs7R0FLRztBQUNILE1BQWEsY0FBYztJQUNSLGNBQWMsQ0FBaUI7SUFDL0IsTUFBTSxDQUF1QjtJQUM3QixXQUFXLENBQWM7SUFFMUMsWUFBWSxNQUE0QixFQUFFLFdBQXdCO1FBQ2hFLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO1FBQy9CLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxtQ0FBYyxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUM3RSxDQUFDO0lBRUQ7O09BRUc7SUFDSSxLQUFLLENBQUMsWUFBWSxDQUFDLElBQWM7UUFDdEMsSUFBSSxDQUFDO1lBQ0gsYUFBYTtZQUNiLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUM1QixPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN2QyxDQUFDO1lBRUQsSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQzlCLE9BQU8sSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3pDLENBQUM7WUFFRCxpQkFBaUI7WUFDakIsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFNUQsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO2dCQUNqQixPQUFPLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMs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kIjjg5XjgqHjgqTjg6vmlbTnkIbjgrfjgrnjg4bjg6AgLSDjg5XjgqHjgqTjg6vliIbpoZ7lmahcbiAqIFxuICog44OR44K/44O844Oz44Oe44OD44OB44Oz44Kw44Ko44Oz44K444Oz44KS5L2/55So44GX44Gm44OV44Kh44Kk44Or44KS5YiG6aGe44GX44CBXG4gKiDpganliIfjgarjgr/jg7zjgrLjg4Pjg4jjg5HjgrnjgpLmsbrlrprjgZnjgovmqZ/og73jgpLmj5DkvpvjgZfjgb7jgZnjgIJcbiAqL1xuXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgUGF0dGVybk1hdGNoZXIsIE1hdGNoUmVzdWx0IH0gZnJvbSAnLi9wYXR0ZXJuLW1hdGNoZXIuanMnO1xuaW1wb3J0IHsgXG4gIEZpbGVDbGFzc2lmaWVyIGFzIElGaWxlQ2xhc3NpZmllcixcbiAgRmlsZUluZm8sIFxuICBDbGFzc2lmaWNhdGlvblJlc3VsdCwgXG4gIEZpbGVUeXBlLFxuICBDbGFzc2lmaWNhdGlvbkNvbmZpZyxcbiAgRW52aXJvbm1lbnQsXG4gIE9yZ2FuaXphdGlvbkVycm9yLFxuICBPcmdhbml6YXRpb25FcnJvclR5cGVcbn0gZnJvbSAnLi4vdHlwZXMvaW5kZXguanMnO1xuXG4vKipcbiAqIOODleOCoeOCpOODq+WIhumhnuWZqFxuICogXG4gKiDjg5XjgqHjgqTjg6vjga7mgKfos6rjgpLliIbmnpDjgZfjgIHpganliIfjgarjgqvjg4bjgrTjg6rjgajjgr/jg7zjgrLjg4Pjg4jjg5HjgrnjgpLmsbrlrprjgZfjgb7jgZnjgIJcbiAqIOWIhumhnuS/oemgvOW6puOBruioiOeul+OBqOe1kOaenOOBruaknOiovOapn+iDveOCguaPkOS+m+OBl+OBvuOBmeOAglxuICovXG5leHBvcnQgY2xhc3MgRmlsZUNsYXNzaWZpZXIgaW1wbGVtZW50cyBJRmlsZUNsYXNzaWZpZXIge1xuICBwcml2YXRlIHJlYWRvbmx5IHBhdHRlcm5NYXRjaGVyOiBQYXR0ZXJuTWF0Y2hlcjtcbiAgcHJpdmF0ZSByZWFkb25seSBjb25maWc6IENsYXNzaWZpY2F0aW9uQ29uZmlnO1xuICBwcml2YXRlIHJlYWRvbmx5IGVudmlyb25tZW50OiBFbnZpcm9ubWVudDtcblxuICBjb25zdHJ1Y3Rvcihjb25maWc6IENsYXNzaWZpY2F0aW9uQ29uZmlnLCBlbnZpcm9ubWVudDogRW52aXJvbm1lbnQpIHtcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgICB0aGlzLmVudmlyb25tZW50ID0gZW52aXJvbm1lbnQ7XG4gICAgdGhpcy5wYXR0ZXJuTWF0Y2hlciA9IG5ldyBQYXR0ZXJuTWF0Y2hlcihjb25maWcuY2xhc3NpZmljYXRpb25SdWxlcywgdHJ1ZSk7XG4gIH1cblxuICAvKipcbiAgICog44OV44Kh44Kk44Or44KS5YiG6aGeXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgY2xhc3NpZnlGaWxlKGZpbGU6IEZpbGVJbmZvKTogUHJvbWlzZTxDbGFzc2lmaWNhdGlvblJlc3VsdD4ge1xuICAgIHRyeSB7XG4gICAgICAvLyDnibnliKXjg6vjg7zjg6vjga7jg4Hjgqfjg4Pjgq9cbiAgICAgIGlmICh0aGlzLnNob3VsZElnbm9yZShmaWxlKSkge1xuICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGVJZ25vcmVSZXN1bHQoZmlsZSk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLnNob3VsZFByZXNlcnZlKGZpbGUpKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNyZWF0ZVByZXNlcnZlUmVzdWx0KGZpbGUpO1xuICAgICAgfVxuXG4gICAgICAvLyDjg5Hjgr/jg7zjg7Pjg57jg4Pjg4Hjg7PjgrDjgavjgojjgovliIbpoZ5cbiAgICAgIGNvbnN0IG1hdGNoUmVzdWx0ID0gdGhpcy5wYXR0ZXJuTWF0Y2hlci5maW5kQmVzdE1hdGNoKGZpbGUpO1xuICAgICAgXG4gICAgICBpZiAoIW1hdGNoUmVzdWx0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNyZWF0ZVVua25vd25SZXN1bHQoZmlsZSk7XG4gICAgICB9XG5cbiAgICAgIC8vIOODleOCoeOCpOODq+OCv+OCpOODl+OBruaxuuWumlxuICAgICAgY29uc3QgZmlsZVR5cGUgPSB0aGlzLmRldGVybWluZUZpbGVUeXBlKG1hdGNoUmVzdWx0LCBmaWxlKTtcbiAgICAgIFxuICAgICAgLy8g44K/44O844Ky44OD44OI44OR44K544Gu55Sf5oiQXG4gICAgICBjb25zdCB0YXJnZXRQYXRoID0gdGhpcy5kZXRlcm1pbmVUYXJnZXRQYXRoKGZpbGUsIGZpbGVUeXBlKTtcbiAgICAgIFxuICAgICAgLy8g5YiG6aGe5L+h6aC85bqm44Gu6Kq/5pW0XG4gICAgICBjb25zdCBhZGp1c3RlZENvbmZpZGVuY2UgPSB0aGlzLmFkanVzdENvbmZpZGVuY2UobWF0Y2hSZXN1bHQuY29uZmlkZW5jZSwgZmlsZSwgZmlsZVR5cGUpO1xuICAgICAgXG4gICAgICAvLyDjg6zjg5Pjg6Xjg7zlv4XopoHmgKfjga7liKTlrppcbiAgICAgIGNvbnN0IHJlcXVpcmVzUmV2aWV3ID0gdGhpcy5zaG91bGRSZXF1aXJlUmV2aWV3KGZpbGUsIG1hdGNoUmVzdWx0LCBhZGp1c3RlZENvbmZpZGVuY2UpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBmaWxlLFxuICAgICAgICBmaWxlVHlwZSxcbiAgICAgICAgdGFyZ2V0UGF0aCxcbiAgICAgICAgY29uZmlkZW5jZTogYWRqdXN0ZWRDb25maWRlbmNlLFxuICAgICAgICByZWFzb25pbmc6IHRoaXMuYnVpbGRSZWFzb25pbmcobWF0Y2hSZXN1bHQsIGZpbGUsIGZpbGVUeXBlKSxcbiAgICAgICAgcmVxdWlyZXNSZXZpZXcsXG4gICAgICAgIGNsYXNzaWZpY2F0aW9uVGltZTogbmV3IERhdGUoKSxcbiAgICAgICAgYXBwbGllZFJ1bGU6IG1hdGNoUmVzdWx0LnJ1bGUubmFtZVxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuQ0xBU1NJRklDQVRJT05fRkFJTEVELFxuICAgICAgICBg44OV44Kh44Kk44Or5YiG6aGe44Gr5aSx5pWX44GX44G+44GX44GfOiAke2ZpbGUucGF0aH1gLFxuICAgICAgICBmaWxlLnBhdGgsXG4gICAgICAgIHRoaXMuZW52aXJvbm1lbnQsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjgr/jg7zjgrLjg4Pjg4jjg5HjgrnjgpLmsbrlrppcbiAgICovXG4gIHB1YmxpYyBkZXRlcm1pbmVUYXJnZXRQYXRoKGZpbGU6IEZpbGVJbmZvLCBjbGFzc2lmaWNhdGlvbjogRmlsZVR5cGUpOiBzdHJpbmcge1xuICAgIGNvbnN0IGJhc2VUYXJnZXRQYXRoID0gdGhpcy5nZXRCYXNlVGFyZ2V0UGF0aChjbGFzc2lmaWNhdGlvbik7XG4gICAgXG4gICAgLy8g55Kw5aKD5Zu65pyJ44Gu6Kq/5pW0XG4gICAgY29uc3QgYWRqdXN0ZWRQYXRoID0gdGhpcy5hZGp1c3RQYXRoRm9yRW52aXJvbm1lbnQoYmFzZVRhcmdldFBhdGgsIGZpbGUpO1xuICAgIFxuICAgIC8vIOODleOCoeOCpOODq+WQjeOBrumHjeikh+ODgeOCp+ODg+OCr+OBqOiqv+aVtFxuICAgIGNvbnN0IGZpbmFsUGF0aCA9IHRoaXMucmVzb2x2ZUR1cGxpY2F0ZVBhdGgoYWRqdXN0ZWRQYXRoLCBmaWxlLm5hbWUpO1xuICAgIFxuICAgIHJldHVybiBmaW5hbFBhdGg7XG4gIH1cblxuICAvKipcbiAgICog5YiG6aGe57WQ5p6c44KS5qSc6Ki8XG4gICAqL1xuICBwdWJsaWMgdmFsaWRhdGVDbGFzc2lmaWNhdGlvbihmaWxlOiBGaWxlSW5mbywgY2xhc3NpZmljYXRpb246IENsYXNzaWZpY2F0aW9uUmVzdWx0KTogYm9vbGVhbiB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIOWfuuacrOeahOOBquaknOiovFxuICAgICAgaWYgKCFjbGFzc2lmaWNhdGlvbi50YXJnZXRQYXRoIHx8IGNsYXNzaWZpY2F0aW9uLmNvbmZpZGVuY2UgPCAwIHx8IGNsYXNzaWZpY2F0aW9uLmNvbmZpZGVuY2UgPiAxKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgLy8g44OV44Kh44Kk44Or44K/44Kk44OX44Go5ouh5by15a2Q44Gu5pW05ZCI5oCn44OB44Kn44OD44KvXG4gICAgICBpZiAoIXRoaXMuaXNGaWxlVHlwZUNvbnNpc3RlbnQoZmlsZSwgY2xhc3NpZmljYXRpb24uZmlsZVR5cGUpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgLy8g44K/44O844Ky44OD44OI44OR44K544Gu5aal5b2T5oCn44OB44Kn44OD44KvXG4gICAgICBpZiAoIXRoaXMuaXNUYXJnZXRQYXRoVmFsaWQoY2xhc3NpZmljYXRpb24udGFyZ2V0UGF0aCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICAvLyDmqKnpmZDoqK3lrprjga7lpqXlvZPmgKfjg4Hjgqfjg4Pjgq9cbiAgICAgIGlmICghdGhpcy5hcmVQZXJtaXNzaW9uc1ZhbGlkKGZpbGUsIGNsYXNzaWZpY2F0aW9uLmZpbGVUeXBlKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLndhcm4oYOWIhumhnue1kOaenOaknOiovOOCqOODqeODvDogJHtmaWxlLnBhdGh9YCwgZXJyb3IpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDopIfmlbDjg5XjgqHjgqTjg6vjga7kuIDmi6zliIbpoZ5cbiAgICovXG4gIHB1YmxpYyBhc3luYyBjbGFzc2lmeUZpbGVzKGZpbGVzOiBGaWxlSW5mb1tdKTogUHJvbWlzZTxDbGFzc2lmaWNhdGlvblJlc3VsdFtdPiB7XG4gICAgY29uc3QgcmVzdWx0czogQ2xhc3NpZmljYXRpb25SZXN1bHRbXSA9IFtdO1xuICAgIGNvbnN0IGVycm9yczogRXJyb3JbXSA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNsYXNzaWZ5RmlsZShmaWxlKTtcbiAgICAgICAgcmVzdWx0cy5wdXNoKHJlc3VsdCk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBlcnJvcnMucHVzaChlcnJvciBhcyBFcnJvcik7XG4gICAgICAgIGNvbnNvbGUud2Fybihg44OV44Kh44Kk44Or5YiG6aGe44Ko44Op44O8OiAke2ZpbGUucGF0aH1gLCBlcnJvcik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zb2xlLndhcm4oYCR7ZXJyb3JzLmxlbmd0aH0g5YCL44Gu44OV44Kh44Kk44Or5YiG6aGe44Gn44Ko44Op44O844GM55m655Sf44GX44G+44GX44GfYCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH1cblxuICAvKipcbiAgICog5YiG6aGe57Wx6KiI44KS55Sf5oiQXG4gICAqL1xuICBwdWJsaWMgZ2VuZXJhdGVDbGFzc2lmaWNhdGlvblN0YXRpc3RpY3MocmVzdWx0czogQ2xhc3NpZmljYXRpb25SZXN1bHRbXSk6IHtcbiAgICB0b3RhbEZpbGVzOiBudW1iZXI7XG4gICAgYnlGaWxlVHlwZTogUmVjb3JkPEZpbGVUeXBlLCBudW1iZXI+O1xuICAgIGJ5Q29uZmlkZW5jZTogUmVjb3JkPHN0cmluZywgbnVtYmVyPjtcbiAgICByZXF1aXJlc1JldmlldzogbnVtYmVyO1xuICAgIGF2ZXJhZ2VDb25maWRlbmNlOiBudW1iZXI7XG4gIH0ge1xuICAgIGNvbnN0IHN0YXRzID0ge1xuICAgICAgdG90YWxGaWxlczogcmVzdWx0cy5sZW5ndGgsXG4gICAgICBieUZpbGVUeXBlOiB7fSBhcyBSZWNvcmQ8RmlsZVR5cGUsIG51bWJlcj4sXG4gICAgICBieUNvbmZpZGVuY2U6IHtcbiAgICAgICAgJ2hpZ2ggKDAuOCspJzogMCxcbiAgICAgICAgJ21lZGl1bSAoMC41LTAuOCknOiAwLFxuICAgICAgICAnbG93ICgwLjAtMC41KSc6IDBcbiAgICAgIH0sXG4gICAgICByZXF1aXJlc1JldmlldzogMCxcbiAgICAgIGF2ZXJhZ2VDb25maWRlbmNlOiAwXG4gICAgfTtcblxuICAgIGxldCB0b3RhbENvbmZpZGVuY2UgPSAwO1xuXG4gICAgZm9yIChjb25zdCByZXN1bHQgb2YgcmVzdWx0cykge1xuICAgICAgLy8g44OV44Kh44Kk44Or44K/44Kk44OX5Yil57Wx6KiIXG4gICAgICBzdGF0cy5ieUZpbGVUeXBlW3Jlc3VsdC5maWxlVHlwZV0gPSAoc3RhdHMuYnlGaWxlVHlwZVtyZXN1bHQuZmlsZVR5cGVdIHx8IDApICsgMTtcblxuICAgICAgLy8g5L+h6aC85bqm5Yil57Wx6KiIXG4gICAgICBpZiAocmVzdWx0LmNvbmZpZGVuY2UgPj0gMC44KSB7XG4gICAgICAgIHN0YXRzLmJ5Q29uZmlkZW5jZVsnaGlnaCAoMC44KyknXSsrO1xuICAgICAgfSBlbHNlIGlmIChyZXN1bHQuY29uZmlkZW5jZSA+PSAwLjUpIHtcbiAgICAgICAgc3RhdHMuYnlDb25maWRlbmNlWydtZWRpdW0gKDAuNS0wLjgpJ10rKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0YXRzLmJ5Q29uZmlkZW5jZVsnbG93ICgwLjAtMC41KSddKys7XG4gICAgICB9XG5cbiAgICAgIC8vIOODrOODk+ODpeODvOW/heimgee1seioiFxuICAgICAgaWYgKHJlc3VsdC5yZXF1aXJlc1Jldmlldykge1xuICAgICAgICBzdGF0cy5yZXF1aXJlc1JldmlldysrO1xuICAgICAgfVxuXG4gICAgICB0b3RhbENvbmZpZGVuY2UgKz0gcmVzdWx0LmNvbmZpZGVuY2U7XG4gICAgfVxuXG4gICAgLy8g5bmz5Z2H5L+h6aC85bqmXG4gICAgc3RhdHMuYXZlcmFnZUNvbmZpZGVuY2UgPSByZXN1bHRzLmxlbmd0aCA+IDAgPyB0b3RhbENvbmZpZGVuY2UgLyByZXN1bHRzLmxlbmd0aCA6IDA7XG5cbiAgICByZXR1cm4gc3RhdHM7XG4gIH1cblxuICAvKipcbiAgICog54Sh6KaW44GZ44G544GN44OV44Kh44Kk44Or44GL44Gp44GG44GL44KS5Yik5a6aXG4gICAqL1xuICBwcml2YXRlIHNob3VsZElnbm9yZShmaWxlOiBGaWxlSW5mbyk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGlnbm9yZVBhdHRlcm5zID0gdGhpcy5jb25maWcuc3BlY2lhbFJ1bGVzLmlnbm9yZUZpbGVzO1xuICAgIHJldHVybiBpZ25vcmVQYXR0ZXJucy5zb21lKHBhdHRlcm4gPT4gdGhpcy5tYXRjaGVzUGF0dGVybihmaWxlLm5hbWUsIHBhdHRlcm4pKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDkv53mjIHjgZnjgbnjgY3jg5XjgqHjgqTjg6vjgYvjganjgYbjgYvjgpLliKTlrppcbiAgICovXG4gIHByaXZhdGUgc2hvdWxkUHJlc2VydmUoZmlsZTogRmlsZUluZm8pOiBib29sZWFuIHtcbiAgICBjb25zdCBwcmVzZXJ2ZVBhdHRlcm5zID0gdGhpcy5jb25maWcuc3BlY2lhbFJ1bGVzLnByZXNlcnZlRmlsZXM7XG4gICAgcmV0dXJuIHByZXNlcnZlUGF0dGVybnMuc29tZShwYXR0ZXJuID0+IHRoaXMubWF0Y2hlc1BhdHRlcm4oZmlsZS5uYW1lLCBwYXR0ZXJuKSk7XG4gIH1cblxuICAvKipcbiAgICog44Os44OT44Ol44O844GM5b+F6KaB44GL44Gp44GG44GL44KS5Yik5a6aXG4gICAqL1xuICBwcml2YXRlIHNob3VsZFJlcXVpcmVSZXZpZXcoZmlsZTogRmlsZUluZm8sIG1hdGNoUmVzdWx0OiBNYXRjaFJlc3VsdCwgY29uZmlkZW5jZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgLy8g5L2O44GE5L+h6aC85bqm44Gu5aC05ZCIXG4gICAgaWYgKGNvbmZpZGVuY2UgPCAwLjUpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vIOeJueWIpeODq+ODvOODq+OBp+aMh+WumuOBleOCjOOBn+ODleOCoeOCpOODq1xuICAgIGNvbnN0IHJldmlld1BhdHRlcm5zID0gdGhpcy5jb25maWcuc3BlY2lhbFJ1bGVzLnJlcXVpcmVSZXZpZXc7XG4gICAgaWYgKHJldmlld1BhdHRlcm5zLnNvbWUocGF0dGVybiA9PiB0aGlzLm1hdGNoZXNQYXR0ZXJuKGZpbGUubmFtZSwgcGF0dGVybikpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyDlpKfjgY3jgarjg5XjgqHjgqTjg6tcbiAgICBpZiAoZmlsZS5zaXplID4gdGhpcy5jb25maWcudmFsaWRhdGlvbi5tYXhGaWxlU2l6ZSAvIDEwKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyDmqZ/lr4bmgKfjga7pq5jjgYTjg5XjgqHjgqTjg6tcbiAgICBpZiAodGhpcy5pc1NlbnNpdGl2ZUZpbGUoZmlsZSkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg5XjgqHjgqTjg6vjgr/jgqTjg5fjgpLmsbrlrppcbiAgICovXG4gIHByaXZhdGUgZGV0ZXJtaW5lRmlsZVR5cGUobWF0Y2hSZXN1bHQ6IE1hdGNoUmVzdWx0LCBmaWxlOiBGaWxlSW5mbyk6IEZpbGVUeXBlIHtcbiAgICBjb25zdCBydWxlTmFtZSA9IG1hdGNoUmVzdWx0LnJ1bGUubmFtZTtcbiAgICBjb25zdCBjYXRlZ29yeSA9IHRoaXMuZmluZFJ1bGVDYXRlZ29yeShtYXRjaFJlc3VsdC5ydWxlKTtcblxuICAgIC8vIOOCq+ODhuOCtOODquOBqOODq+ODvOODq+WQjeOBi+OCiUZpbGVUeXBl44KS5rG65a6aXG4gICAgY29uc3QgZmlsZVR5cGVNYXA6IFJlY29yZDxzdHJpbmcsIFJlY29yZDxzdHJpbmcsIEZpbGVUeXBlPj4gPSB7XG4gICAgICAnc2NyaXB0cyc6IHtcbiAgICAgICAgJ2RlcGxveW1lbnQnOiBGaWxlVHlwZS5TQ1JJUFRfREVQTE9ZTUVOVCxcbiAgICAgICAgJ2FuYWx5c2lzJzogRmlsZVR5cGUuU0NSSVBUX0FOQUxZU0lTLFxuICAgICAgICAnbWFpbnRlbmFuY2UnOiBGaWxlVHlwZS5TQ1JJUFRfTUFJTlRFTkFOQ0UsXG4gICAgICAgICd1dGlsaXRpZXMnOiBGaWxlVHlwZS5TQ1JJUFRfVVRJTElUSUVTLFxuICAgICAgICAnbGVnYWN5JzogRmlsZVR5cGUuU0NSSVBUX0xFR0FDWVxuICAgICAgfSxcbiAgICAgICdkb2N1bWVudHMnOiB7XG4gICAgICAgICd0cm91Ymxlc2hvb3RpbmcnOiBGaWxlVHlwZS5ET0NfVFJPVUJMRVNIT09USU5HLFxuICAgICAgICAnZGVwbG95bWVudCc6IEZpbGVUeXBlLkRPQ19ERVBMT1lNRU5ULFxuICAgICAgICAnZ3VpZGVzJzogRmlsZVR5cGUuRE9DX0dVSURFUyxcbiAgICAgICAgJ3JlcG9ydHMnOiBGaWxlVHlwZS5ET0NfUkVQT1JUUyxcbiAgICAgICAgJ2xlZ2FjeSc6IEZpbGVUeXBlLkRPQ19MRUdBQ1lcbiAgICAgIH0sXG4gICAgICAnY29uZmlncyc6IHtcbiAgICAgICAgJ21haW4nOiBGaWxlVHlwZS5DT05GSUdfTUFJTixcbiAgICAgICAgJ2Vudmlyb25tZW50JzogRmlsZVR5cGUuQ09ORklHX0VOVklST05NRU5ULFxuICAgICAgICAnc2FtcGxlcyc6IEZpbGVUeXBlLkNPTkZJR19TQU1QTEVTLFxuICAgICAgICAnbGVnYWN5JzogRmlsZVR5cGUuQ09ORklHX0xFR0FDWVxuICAgICAgfSxcbiAgICAgICd0ZXN0cyc6IHtcbiAgICAgICAgJ3BheWxvYWRzJzogRmlsZVR5cGUuVEVTVF9QQVlMT0FEUyxcbiAgICAgICAgJ3VuaXQnOiBGaWxlVHlwZS5URVNUX1VOSVQsXG4gICAgICAgICdpbnRlZ3JhdGlvbic6IEZpbGVUeXBlLlRFU1RfSU5URUdSQVRJT04sXG4gICAgICAgICdsZWdhY3knOiBGaWxlVHlwZS5URVNUX0xFR0FDWVxuICAgICAgfSxcbiAgICAgICd0ZW1wJzoge1xuICAgICAgICAnd29ya2luZyc6IEZpbGVUeXBlLlRFTVBfV09SS0lORyxcbiAgICAgICAgJ2NhY2hlJzogRmlsZVR5cGUuVEVNUF9DQUNIRVxuICAgICAgfSxcbiAgICAgICdhcmNoaXZlJzoge1xuICAgICAgICAnbGVnYWN5JzogRmlsZVR5cGUuQVJDSElWRV9MRUdBQ1ksXG4gICAgICAgICdwcm9qZWN0cyc6IEZpbGVUeXBlLkFSQ0hJVkVfUFJPSkVDVFNcbiAgICAgIH0sXG4gICAgICAnc2VjdXJpdHknOiB7XG4gICAgICAgICdrZXlzJzogRmlsZVR5cGUuU0VDVVJJVFlfS0VZUyxcbiAgICAgICAgJ3NlY3JldHMnOiBGaWxlVHlwZS5TRUNVUklUWV9TRUNSRVRTXG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBmaWxlVHlwZU1hcFtjYXRlZ29yeV0/LltydWxlTmFtZV0gfHwgRmlsZVR5cGUuVU5LTk9XTjtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg6vjg7zjg6vjga7jgqvjg4bjgrTjg6rjgpLopovjgaTjgZHjgotcbiAgICovXG4gIHByaXZhdGUgZmluZFJ1bGVDYXRlZ29yeShydWxlOiBhbnkpOiBzdHJpbmcge1xuICAgIGZvciAoY29uc3QgW2NhdGVnb3J5LCBydWxlc10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5jb25maWcuY2xhc3NpZmljYXRpb25SdWxlcykpIHtcbiAgICAgIGlmIChPYmplY3QudmFsdWVzKHJ1bGVzKS5zb21lKChyOiBhbnkpID0+IHIubmFtZSA9PT0gcnVsZS5uYW1lKSkge1xuICAgICAgICByZXR1cm4gY2F0ZWdvcnk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAndW5rbm93bic7XG4gIH1cblxuICAvKipcbiAgICog44OZ44O844K544K/44O844Ky44OD44OI44OR44K544KS5Y+W5b6XXG4gICAqL1xuICBwcml2YXRlIGdldEJhc2VUYXJnZXRQYXRoKGZpbGVUeXBlOiBGaWxlVHlwZSk6IHN0cmluZyB7XG4gICAgY29uc3QgcGF0aE1hcDogUmVjb3JkPEZpbGVUeXBlLCBzdHJpbmc+ID0ge1xuICAgICAgW0ZpbGVUeXBlLlNDUklQVF9ERVBMT1lNRU5UXTogJ2RldmVsb3BtZW50L3NjcmlwdHMvZGVwbG95bWVudC8nLFxuICAgICAgW0ZpbGVUeXBlLlNDUklQVF9BTkFMWVNJU106ICdkZXZlbG9wbWVudC9zY3JpcHRzL2FuYWx5c2lzLycsXG4gICAgICBbRmlsZVR5cGUuU0NSSVBUX01BSU5URU5BTkNFXTogJ2RldmVsb3BtZW50L3NjcmlwdHMvbWFpbnRlbmFuY2UvJyxcbiAgICAgIFtGaWxlVHlwZS5TQ1JJUFRfVVRJTElUSUVTXTogJ2RldmVsb3BtZW50L3NjcmlwdHMvdXRpbGl0aWVzLycsXG4gICAgICBbRmlsZVR5cGUuU0NSSVBUX0xFR0FDWV06ICdkZXZlbG9wbWVudC9zY3JpcHRzL2xlZ2FjeS8nLFxuICAgICAgXG4gICAgICBbRmlsZVR5cGUuRE9DX1RST1VCTEVTSE9PVElOR106ICdkb2NzL3Ryb3VibGVzaG9vdGluZy8nLFxuICAgICAgW0ZpbGVUeXBlLkRPQ19ERVBMT1lNRU5UXTogJ2RvY3MvZGVwbG95bWVudC8nLFxuICAgICAgW0ZpbGVUeXBlLkRPQ19HVUlERVNdOiAnZG9jcy9ndWlkZXMvJyxcbiAgICAgIFtGaWxlVHlwZS5ET0NfUkVQT1JUU106ICdkZXZlbG9wbWVudC9kb2NzL3JlcG9ydHMvJyxcbiAgICAgIFtGaWxlVHlwZS5ET0NfTEVHQUNZXTogJ2RvY3MvbGVnYWN5LycsXG4gICAgICBcbiAgICAgIFtGaWxlVHlwZS5DT05GSUdfTUFJTl06ICdjb25maWcvJyxcbiAgICAgIFtGaWxlVHlwZS5DT05GSUdfRU5WSVJPTk1FTlRdOiAnZGV2ZWxvcG1lbnQvY29uZmlncy8nLFxuICAgICAgW0ZpbGVUeXBlLkNPTkZJR19TQU1QTEVTXTogJ2NvbmZpZy9zYW1wbGVzLycsXG4gICAgICBbRmlsZVR5cGUuQ09ORklHX0xFR0FDWV06ICdjb25maWcvbGVnYWN5LycsXG4gICAgICBcbiAgICAgIFtGaWxlVHlwZS5URVNUX1BBWUxPQURTXTogJ3Rlc3RzL3BheWxvYWRzLycsXG4gICAgICBbRmlsZVR5cGUuVEVTVF9VTklUXTogJ3Rlc3RzL3VuaXQvJyxcbiAgICAgIFtGaWxlVHlwZS5URVNUX0lOVEVHUkFUSU9OXTogJ3Rlc3RzL2ludGVncmF0aW9uLycsXG4gICAgICBbRmlsZVR5cGUuVEVTVF9MRUdBQ1ldOiAndGVzdHMvbGVnYWN5LycsXG4gICAgICBcbiAgICAgIFtGaWxlVHlwZS5URU1QX1dPUktJTkddOiAnZGV2ZWxvcG1lbnQvdGVtcC93b3JraW5nLycsXG4gICAgICBbRmlsZVR5cGUuVEVNUF9DQUNIRV06ICdkZXZlbG9wbWVudC90ZW1wL2NhY2hlLycsXG4gICAgICBcbiAgICAgIFtGaWxlVHlwZS5BUkNISVZFX0xFR0FDWV06ICdhcmNoaXZlL2xlZ2FjeS1maWxlcy8nLFxuICAgICAgW0ZpbGVUeXBlLkFSQ0hJVkVfUFJPSkVDVFNdOiAnYXJjaGl2ZS9vbGQtcHJvamVjdHMvJyxcbiAgICAgIFxuICAgICAgW0ZpbGVUeXBlLlNFQ1VSSVRZX0tFWVNdOiAnZGV2ZWxvcG1lbnQvY29uZmlncy9zZWN1cml0eS8nLFxuICAgICAgW0ZpbGVUeXBlLlNFQ1VSSVRZX1NFQ1JFVFNdOiAnZGV2ZWxvcG1lbnQvY29uZmlncy9zZWNyZXRzLycsXG4gICAgICBcbiAgICAgIFtGaWxlVHlwZS5VTktOT1dOXTogJ2FyY2hpdmUvdW5rbm93bi8nXG4gICAgfTtcblxuICAgIHJldHVybiBwYXRoTWFwW2ZpbGVUeXBlXSB8fCAnYXJjaGl2ZS91bmtub3duLyc7XG4gIH1cblxuICAvKipcbiAgICog55Kw5aKD44Gr5b+c44GY44Gf44OR44K56Kq/5pW0XG4gICAqL1xuICBwcml2YXRlIGFkanVzdFBhdGhGb3JFbnZpcm9ubWVudChiYXNlUGF0aDogc3RyaW5nLCBmaWxlOiBGaWxlSW5mbyk6IHN0cmluZyB7XG4gICAgLy8g55Kw5aKD5Zu65pyJ44Gu6Kq/5pW044Ot44K444OD44KvXG4gICAgaWYgKHRoaXMuZW52aXJvbm1lbnQgPT09ICdlYzInICYmIGJhc2VQYXRoLnN0YXJ0c1dpdGgoJ2RldmVsb3BtZW50LycpKSB7XG4gICAgICAvLyBFQzLnkrDlooPjgafjga/kuIDpg6jjga7jg5HjgrnjgpLoqr/mlbTjgZnjgovloLTlkIjjgYzjgYLjgotcbiAgICAgIHJldHVybiBiYXNlUGF0aDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGJhc2VQYXRoO1xuICB9XG5cbiAgLyoqXG4gICAqIOmHjeikh+ODkeOCueOBruino+axulxuICAgKi9cbiAgcHJpdmF0ZSByZXNvbHZlRHVwbGljYXRlUGF0aChiYXNlUGF0aDogc3RyaW5nLCBmaWxlTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gcGF0aC5qb2luKGJhc2VQYXRoLCBmaWxlTmFtZSk7XG4gIH1cblxuICAvKipcbiAgICog44OV44Kh44Kk44Or44K/44Kk44OX44Gu5pW05ZCI5oCn44OB44Kn44OD44KvXG4gICAqL1xuICBwcml2YXRlIGlzRmlsZVR5cGVDb25zaXN0ZW50KGZpbGU6IEZpbGVJbmZvLCBmaWxlVHlwZTogRmlsZVR5cGUpOiBib29sZWFuIHtcbiAgICBjb25zdCBleHRlbnNpb24gPSBmaWxlLmV4dGVuc2lvbi50b0xvd2VyQ2FzZSgpO1xuICAgIFxuICAgIC8vIOOCueOCr+ODquODl+ODiOODleOCoeOCpOODq+OBruaVtOWQiOaAp1xuICAgIGlmIChmaWxlVHlwZS50b1N0cmluZygpLnN0YXJ0c1dpdGgoJ3NjcmlwdF8nKSAmJiBleHRlbnNpb24gIT09ICcuc2gnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIFxuICAgIC8vIOODieOCreODpeODoeODs+ODiOODleOCoeOCpOODq+OBruaVtOWQiOaAp1xuICAgIGlmIChmaWxlVHlwZS50b1N0cmluZygpLnN0YXJ0c1dpdGgoJ2RvY18nKSAmJiAhWycubWQnLCAnLnR4dCcsICcuZG9jJywgJy5kb2N4J10uaW5jbHVkZXMoZXh0ZW5zaW9uKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBcbiAgICAvLyDoqK3lrprjg5XjgqHjgqTjg6vjga7mlbTlkIjmgKdcbiAgICBpZiAoZmlsZVR5cGUudG9TdHJpbmcoKS5zdGFydHNXaXRoKCdjb25maWdfJykgJiYgIVsnLmpzb24nLCAnLmpzJywgJy50cycsICcueW1sJywgJy55YW1sJywgJy5lbnYnXS5pbmNsdWRlcyhleHRlbnNpb24pKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCv+ODvOOCsuODg+ODiOODkeOCueOBruWmpeW9k+aAp+ODgeOCp+ODg+OCr1xuICAgKi9cbiAgcHJpdmF0ZSBpc1RhcmdldFBhdGhWYWxpZCh0YXJnZXRQYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAvLyDkuI3mraPjgarjg5HjgrnmloflrZfjga7jg4Hjgqfjg4Pjgq9cbiAgICBpZiAodGFyZ2V0UGF0aC5pbmNsdWRlcygnLi4nKSB8fCB0YXJnZXRQYXRoLmluY2x1ZGVzKCcvLycpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIFxuICAgIC8vIOW/hemgiOODh+OCo+ODrOOCr+ODiOODquOBruWtmOWcqOODgeOCp+ODg+OCr1xuICAgIGNvbnN0IHJlcXVpcmVkRGlycyA9IHRoaXMuY29uZmlnLnZhbGlkYXRpb24ucmVxdWlyZWREaXJlY3RvcmllcztcbiAgICBjb25zdCBiYXNlRGlyID0gdGFyZ2V0UGF0aC5zcGxpdCgnLycpWzBdO1xuICAgIFxuICAgIHJldHVybiByZXF1aXJlZERpcnMuc29tZShkaXIgPT4gdGFyZ2V0UGF0aC5zdGFydHNXaXRoKGRpcikpO1xuICB9XG5cbiAgLyoqXG4gICAqIOaoqemZkOioreWumuOBruWmpeW9k+aAp+ODgeOCp+ODg+OCr1xuICAgKi9cbiAgcHJpdmF0ZSBhcmVQZXJtaXNzaW9uc1ZhbGlkKGZpbGU6IEZpbGVJbmZvLCBmaWxlVHlwZTogRmlsZVR5cGUpOiBib29sZWFuIHtcbiAgICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPjg5XjgqHjgqTjg6vjga/liLbpmZDjgZXjgozjgZ/mqKnpmZDjgYzlv4XopoFcbiAgICBpZiAoZmlsZVR5cGUgPT09IEZpbGVUeXBlLlNFQ1VSSVRZX0tFWVMgfHwgZmlsZVR5cGUgPT09IEZpbGVUeXBlLlNFQ1VSSVRZX1NFQ1JFVFMpIHtcbiAgICAgIHJldHVybiBmaWxlLnBlcm1pc3Npb25zID09PSAnNjAwJztcbiAgICB9XG4gICAgXG4gICAgLy8g44K544Kv44Oq44OX44OI44OV44Kh44Kk44Or44Gv5a6f6KGM5qip6ZmQ44GM5b+F6KaBXG4gICAgaWYgKGZpbGVUeXBlLnRvU3RyaW5nKCkuc3RhcnRzV2l0aCgnc2NyaXB0XycpKSB7XG4gICAgICByZXR1cm4gZmlsZS5wZXJtaXNzaW9ucy5pbmNsdWRlcygneCcpIHx8IGZpbGUucGVybWlzc2lvbnMgPT09ICc3NTUnO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmqZ/lr4bjg5XjgqHjgqTjg6vjgYvjganjgYbjgYvjgpLliKTlrppcbiAgICovXG4gIHByaXZhdGUgaXNTZW5zaXRpdmVGaWxlKGZpbGU6IEZpbGVJbmZvKTogYm9vbGVhbiB7XG4gICAgY29uc3Qgc2Vuc2l0aXZlUGF0dGVybnMgPSBbXG4gICAgICAvXFwucGVtJC9pLFxuICAgICAgL1xcLmtleSQvaSxcbiAgICAgIC9cXC5lbnYkL2ksXG4gICAgICAvcGFzc3dvcmQvaSxcbiAgICAgIC9zZWNyZXQvaSxcbiAgICAgIC9jcmVkZW50aWFsL2lcbiAgICBdO1xuICAgIFxuICAgIHJldHVybiBzZW5zaXRpdmVQYXR0ZXJucy5zb21lKHBhdHRlcm4gPT4gcGF0dGVybi50ZXN0KGZpbGUubmFtZSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIOS/oemgvOW6puOCkuiqv+aVtFxuICAgKi9cbiAgcHJpdmF0ZSBhZGp1c3RDb25maWRlbmNlKGJhc2VDb25maWRlbmNlOiBudW1iZXIsIGZpbGU6IEZpbGVJbmZvLCBmaWxlVHlwZTogRmlsZVR5cGUpOiBudW1iZXIge1xuICAgIGxldCBhZGp1c3RlZENvbmZpZGVuY2UgPSBiYXNlQ29uZmlkZW5jZTtcbiAgICBcbiAgICAvLyDjg5XjgqHjgqTjg6vjgrXjgqTjgrrjgavjgojjgovoqr/mlbRcbiAgICBpZiAoZmlsZS5zaXplID09PSAwKSB7XG4gICAgICBhZGp1c3RlZENvbmZpZGVuY2UgKj0gMC44OyAvLyDnqbrjg5XjgqHjgqTjg6vjga/kv6HpoLzluqbjgpLkuIvjgZLjgotcbiAgICB9XG4gICAgXG4gICAgLy8g5ouh5by15a2Q44Gu5pW05ZCI5oCn44Gr44KI44KL6Kq/5pW0XG4gICAgaWYgKCF0aGlzLmlzRmlsZVR5cGVDb25zaXN0ZW50KGZpbGUsIGZpbGVUeXBlKSkge1xuICAgICAgYWRqdXN0ZWRDb25maWRlbmNlICo9IDAuNjtcbiAgICB9XG4gICAgXG4gICAgLy8g5pyA57WC5pu05paw5pel44Gr44KI44KL6Kq/5pW0XG4gICAgY29uc3QgZGF5c1NpbmNlTW9kaWZpZWQgPSAoRGF0ZS5ub3coKSAtIGZpbGUubGFzdE1vZGlmaWVkLmdldFRpbWUoKSkgLyAoMTAwMCAqIDYwICogNjAgKiAyNCk7XG4gICAgaWYgKGRheXNTaW5jZU1vZGlmaWVkID4gMzY1KSB7XG4gICAgICBhZGp1c3RlZENvbmZpZGVuY2UgKj0gMC45OyAvLyDlj6TjgYTjg5XjgqHjgqTjg6vjga/kv6HpoLzluqbjgpLlsJHjgZfkuIvjgZLjgotcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIE1hdGgubWF4KDAsIE1hdGgubWluKDEsIGFkanVzdGVkQ29uZmlkZW5jZSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIOWIhumhnueQhueUseOCkuani+eviVxuICAgKi9cbiAgcHJpdmF0ZSBidWlsZFJlYXNvbmluZyhtYXRjaFJlc3VsdDogTWF0Y2hSZXN1bHQsIGZpbGU6IEZpbGVJbmZvLCBmaWxlVHlwZTogRmlsZVR5cGUpOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgcmVhc29uaW5nID0gW21hdGNoUmVzdWx0LnJlYXNvbl07XG4gICAgXG4gICAgLy8g6L+95Yqg44Gu55CG55SxXG4gICAgaWYgKGZpbGUuc2l6ZSA+IDEwMjQgKiAxMDI0KSB7XG4gICAgICByZWFzb25pbmcucHVzaCgn5aSn44GN44Gq44OV44Kh44Kk44OrJyk7XG4gICAgfVxuICAgIFxuICAgIGlmICh0aGlzLmlzU2Vuc2l0aXZlRmlsZShmaWxlKSkge1xuICAgICAgcmVhc29uaW5nLnB1c2goJ+apn+WvhuODleOCoeOCpOODqycpO1xuICAgIH1cbiAgICBcbiAgICBpZiAoZmlsZS5pc0hpZGRlbikge1xuICAgICAgcmVhc29uaW5nLnB1c2goJ+maoOOBl+ODleOCoeOCpOODqycpO1xuICAgIH1cbiAgICBcbiAgICByZWFzb25pbmcucHVzaChg5YiG6aGeOiAke2ZpbGVUeXBlfWApO1xuICAgIFxuICAgIHJldHVybiByZWFzb25pbmc7XG4gIH1cblxuICAvKipcbiAgICog44OR44K/44O844Oz44Oe44OD44OB44Oz44KwXG4gICAqL1xuICBwcml2YXRlIG1hdGNoZXNQYXR0ZXJuKHRleHQ6IHN0cmluZywgcGF0dGVybjogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cChcbiAgICAgICAgcGF0dGVyblxuICAgICAgICAgIC5yZXBsYWNlKC9bLiteJHt9KCl8W1xcXVxcXFxdL2csICdcXFxcJCYnKVxuICAgICAgICAgIC5yZXBsYWNlKC9cXCovZywgJy4qJylcbiAgICAgICAgICAucmVwbGFjZSgvXFw/L2csICcuJyksXG4gICAgICAgICdpJ1xuICAgICAgKTtcbiAgICAgIHJldHVybiByZWdleC50ZXN0KHRleHQpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDnhKHoppbntZDmnpzjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlSWdub3JlUmVzdWx0KGZpbGU6IEZpbGVJbmZvKTogQ2xhc3NpZmljYXRpb25SZXN1bHQge1xuICAgIHJldHVybiB7XG4gICAgICBmaWxlLFxuICAgICAgZmlsZVR5cGU6IEZpbGVUeXBlLlVOS05PV04sXG4gICAgICB0YXJnZXRQYXRoOiAnJywgLy8g56e75YuV44GX44Gq44GEXG4gICAgICBjb25maWRlbmNlOiAxLjAsXG4gICAgICByZWFzb25pbmc6IFsn54Sh6KaW5a++6LGh44OV44Kh44Kk44OrJ10sXG4gICAgICByZXF1aXJlc1JldmlldzogZmFsc2UsXG4gICAgICBjbGFzc2lmaWNhdGlvblRpbWU6IG5ldyBEYXRlKCksXG4gICAgICBhcHBsaWVkUnVsZTogJ2lnbm9yZSdcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOS/neaMgee1kOaenOOCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVQcmVzZXJ2ZVJlc3VsdChmaWxlOiBGaWxlSW5mbyk6IENsYXNzaWZpY2F0aW9uUmVzdWx0IHtcbiAgICByZXR1cm4ge1xuICAgICAgZmlsZSxcbiAgICAgIGZpbGVUeXBlOiBGaWxlVHlwZS5VTktOT1dOLFxuICAgICAgdGFyZ2V0UGF0aDogZmlsZS5wYXRoLCAvLyDnj77lnKjjga7loLTmiYDjgavkv53mjIFcbiAgICAgIGNvbmZpZGVuY2U6IDEuMCxcbiAgICAgIHJlYXNvbmluZzogWyfkv53mjIHlr77osaHjg5XjgqHjgqTjg6snXSxcbiAgICAgIHJlcXVpcmVzUmV2aWV3OiBmYWxzZSxcbiAgICAgIGNsYXNzaWZpY2F0aW9uVGltZTogbmV3IERhdGUoKSxcbiAgICAgIGFwcGxpZWRSdWxlOiAncHJlc2VydmUnXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDkuI3mmI7ntZDmnpzjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlVW5rbm93blJlc3VsdChmaWxlOiBGaWxlSW5mbyk6IENsYXNzaWZpY2F0aW9uUmVzdWx0IHtcbiAgICByZXR1cm4ge1xuICAgICAgZmlsZSxcbiAgICAgIGZpbGVUeXBlOiBGaWxlVHlwZS5VTktOT1dOLFxuICAgICAgdGFyZ2V0UGF0aDogdGhpcy5nZXRCYXNlVGFyZ2V0UGF0aChGaWxlVHlwZS5VTktOT1dOKSArIGZpbGUubmFtZSxcbiAgICAgIGNvbmZpZGVuY2U6IDAuMSxcbiAgICAgIHJlYXNvbmluZzogWyfliIbpoZ7jg5Hjgr/jg7zjg7PjgYzopovjgaTjgYvjgorjgb7jgZvjgpMnXSxcbiAgICAgIHJlcXVpcmVzUmV2aWV3OiB0cnVlLFxuICAgICAgY2xhc3NpZmljYXRpb25UaW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgYXBwbGllZFJ1bGU6ICd1bmtub3duJ1xuICAgIH07XG4gIH1cbn0iXX0=