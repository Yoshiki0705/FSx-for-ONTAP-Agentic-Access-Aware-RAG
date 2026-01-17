"use strict";
/**
 * Classification Engine
 * ファイルの自動分類と配置決定を担当
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
exports.ClassificationEngine = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class ClassificationEngine {
    config;
    rules = [];
    learningData = new Map();
    constructor(config) {
        this.config = config;
    }
    /**
     * 分類エンジンを初期化
     */
    async initialize() {
        try {
            await this.loadRules();
            console.log(`分類ルールを読み込みました: ${this.rules.length} 件`);
        }
        catch (error) {
            console.error('分類エンジンの初期化に失敗しました:', error);
            throw error;
        }
    }
    /**
     * ファイルを分類
     */
    async classifyFile(filePath, content) {
        try {
            // ファイル情報を取得
            const fileInfo = {
                path: filePath,
                extension: path.extname(filePath).toLowerCase(),
                basename: path.basename(filePath),
                dirname: path.dirname(filePath)
            };
            // 学習データから既知の分類を確認
            const learnedResult = this.learningData.get(filePath);
            if (learnedResult && learnedResult.confidence > 0.9) {
                return learnedResult;
            }
            // 拡張子ベース分類
            const extensionResults = await this.classifyByExtension(fileInfo);
            // 内容ベース分類（有効な場合）
            let contentResults = [];
            if (this.config.enableContentAnalysis) {
                contentResults = await this.classifyByContent(filePath, content);
            }
            // パスベース分類
            const pathResults = await this.classifyByPath(fileInfo);
            // 結果を統合
            const combinedResult = this.combineResults([
                ...extensionResults,
                ...contentResults,
                ...pathResults
            ]);
            // 学習データに追加
            if (this.config.enableLearning && combinedResult.confidence > 0.7) {
                this.learningData.set(filePath, combinedResult);
            }
            return combinedResult;
        }
        catch (error) {
            console.error(`ファイル分類エラー (${filePath}):`, error);
            return this.getDefaultClassification(filePath);
        }
    }
    /**
     * 拡張子ベース分類
     */
    async classifyByExtension(fileInfo) {
        const results = [];
        for (const rule of this.rules) {
            if (this.matchesPattern(fileInfo.basename, rule.pattern)) {
                const result = {
                    category: this.extractCategory(rule.targetPath),
                    subcategory: this.extractSubcategory(rule.targetPath),
                    confidence: rule.confidence,
                    suggestedPath: this.resolvePath(rule.targetPath, fileInfo),
                    reasoning: [`拡張子パターンマッチ: ${rule.pattern}`, `ルール: ${rule.name}`]
                };
                results.push(result);
            }
        }
        return results;
    }
    /**
     * ファイル内容ベース分類
     */
    async classifyByContent(filePath, providedContent) {
        const results = [];
        try {
            // ファイルサイズチェック
            const stats = await fs.stat(filePath);
            if (stats.size > this.config.maxContentAnalysisSize) {
                return results;
            }
            // ファイル内容を取得
            let content = providedContent;
            if (!content) {
                const buffer = await fs.readFile(filePath);
                content = buffer.toString('utf-8');
            }
            // 内容パターンマッチング
            for (const rule of this.rules) {
                if (rule.contentPatterns) {
                    const matchCount = this.countContentMatches(content, rule.contentPatterns);
                    if (matchCount > 0) {
                        const confidence = Math.min(rule.confidence + (matchCount * 0.1), 1.0);
                        const result = {
                            category: this.extractCategory(rule.targetPath),
                            subcategory: this.extractSubcategory(rule.targetPath),
                            confidence,
                            suggestedPath: this.resolvePath(rule.targetPath, { path: filePath }),
                            reasoning: [
                                `内容パターンマッチ: ${matchCount} 件`,
                                `ルール: ${rule.name}`,
                                ...rule.contentPatterns.slice(0, 3).map(p => `パターン: ${p}`)
                            ]
                        };
                        results.push(result);
                    }
                }
                // サブルールの処理
                if (rule.rules) {
                    for (const subRule of rule.rules) {
                        if (this.matchesContentPattern(content, subRule.contentPattern)) {
                            const result = {
                                category: this.extractCategory(subRule.targetPath),
                                subcategory: this.extractSubcategory(subRule.targetPath),
                                confidence: rule.confidence * 0.9, // サブルールは少し信頼度を下げる
                                suggestedPath: this.resolvePath(subRule.targetPath, { path: filePath }),
                                reasoning: [
                                    `サブルールマッチ: ${subRule.contentPattern}`,
                                    `親ルール: ${rule.name}`
                                ]
                            };
                            results.push(result);
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error(`内容分析エラー (${filePath}):`, error);
        }
        return results;
    }
    /**
     * パスベース分類
     */
    async classifyByPath(fileInfo) {
        const results = [];
        const normalizedPath = path.normalize(fileInfo.path);
        // 既存のディレクトリ構造から推測
        const pathSegments = normalizedPath.split(path.sep);
        for (const segment of pathSegments) {
            switch (segment.toLowerCase()) {
                case 'lib':
                case 'src':
                    if (fileInfo.extension === '.ts') {
                        results.push({
                            category: 'library',
                            confidence: 0.6,
                            suggestedPath: 'lib/',
                            reasoning: ['パス構造による推測: ライブラリファイル']
                        });
                    }
                    break;
                case 'docs':
                case 'documentation':
                    results.push({
                        category: 'documentation',
                        confidence: 0.7,
                        suggestedPath: 'docs/',
                        reasoning: ['パス構造による推測: ドキュメント']
                    });
                    break;
                case 'config':
                case 'configuration':
                    results.push({
                        category: 'configuration',
                        confidence: 0.8,
                        suggestedPath: 'config/',
                        reasoning: ['パス構造による推測: 設定ファイル']
                    });
                    break;
                case 'test':
                case 'tests':
                case '__tests__':
                    results.push({
                        category: 'test',
                        confidence: 0.9,
                        suggestedPath: 'tests/',
                        reasoning: ['パス構造による推測: テストファイル']
                    });
                    break;
            }
        }
        return results;
    }
    /**
     * 分類結果を統合
     */
    combineResults(results) {
        if (results.length === 0) {
            return this.getDefaultClassification('');
        }
        // 信頼度でソート
        results.sort((a, b) => b.confidence - a.confidence);
        // 最も信頼度の高い結果をベースに
        const bestResult = results[0];
        // 同じカテゴリの結果があれば信頼度を向上
        const sameCategory = results.filter(r => r.category === bestResult.category);
        if (sameCategory.length > 1) {
            const avgConfidence = sameCategory.reduce((sum, r) => sum + r.confidence, 0) / sameCategory.length;
            bestResult.confidence = Math.min(avgConfidence * 1.2, 1.0);
        }
        // 推論を統合
        const allReasons = results.flatMap(r => r.reasoning || []);
        bestResult.reasoning = [...new Set(allReasons)].slice(0, 5);
        return bestResult;
    }
    /**
     * パターンマッチング
     */
    matchesPattern(filename, pattern) {
        // 簡単なグロブパターンマッチング
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        const regex = new RegExp(`^${regexPattern}$`, 'i');
        return regex.test(filename);
    }
    /**
     * 内容パターンマッチング
     */
    matchesContentPattern(content, pattern) {
        try {
            const regex = new RegExp(pattern, 'i');
            return regex.test(content);
        }
        catch {
            // 正規表現が無効な場合は文字列検索
            return content.toLowerCase().includes(pattern.toLowerCase());
        }
    }
    /**
     * 内容パターンのマッチ数をカウント
     */
    countContentMatches(content, patterns) {
        let count = 0;
        for (const pattern of patterns) {
            if (this.matchesContentPattern(content, pattern)) {
                count++;
            }
        }
        return count;
    }
    /**
     * カテゴリを抽出
     */
    extractCategory(targetPath) {
        const segments = targetPath.split('/').filter(s => s);
        return segments[0] || 'misc';
    }
    /**
     * サブカテゴリを抽出
     */
    extractSubcategory(targetPath) {
        const segments = targetPath.split('/').filter(s => s);
        return segments[1];
    }
    /**
     * パスを解決
     */
    resolvePath(targetPath, fileInfo) {
        // 変数置換
        let resolvedPath = targetPath;
        if (fileInfo.basename) {
            resolvedPath = resolvedPath.replace('${filename}', fileInfo.basename);
        }
        if (fileInfo.extension) {
            resolvedPath = resolvedPath.replace('${ext}', fileInfo.extension);
        }
        return resolvedPath;
    }
    /**
     * デフォルト分類を取得
     */
    getDefaultClassification(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        // 拡張子による基本分類
        let category = 'misc';
        let suggestedPath = 'misc/';
        if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
            category = 'code';
            suggestedPath = 'lib/';
        }
        else if (['.md', '.txt', '.rst'].includes(ext)) {
            category = 'documentation';
            suggestedPath = 'docs/';
        }
        else if (['.json', '.yml', '.yaml', '.toml'].includes(ext)) {
            category = 'configuration';
            suggestedPath = 'config/';
        }
        return {
            category,
            confidence: 0.3,
            suggestedPath,
            reasoning: ['デフォルト分類: 拡張子ベース']
        };
    }
    /**
     * 分類ルールを読み込み
     */
    async loadRules() {
        try {
            const rulesContent = await fs.readFile(this.config.rulesFile, 'utf-8');
            const rulesData = JSON.parse(rulesContent);
            this.rules = rulesData.rules || [];
        }
        catch (error) {
            console.warn(`分類ルールファイルの読み込みに失敗しました: ${this.config.rulesFile}`);
            this.rules = this.getDefaultRules();
        }
    }
    /**
     * デフォルト分類ルールを取得
     */
    getDefaultRules() {
        return [
            {
                name: 'TypeScript Files',
                pattern: '**/*.ts',
                contentPatterns: ['import', 'export', 'interface', 'class'],
                targetPath: 'lib/',
                confidence: 0.8
            },
            {
                name: 'JavaScript Files',
                pattern: '**/*.js',
                contentPatterns: ['require', 'module.exports', 'function'],
                targetPath: 'lib/',
                confidence: 0.8
            },
            {
                name: 'Test Files',
                pattern: '**/*.test.*',
                contentPatterns: ['describe', 'it(', 'test(', 'expect'],
                targetPath: 'tests/',
                confidence: 0.95
            },
            {
                name: 'Documentation',
                pattern: '**/*.md',
                contentPatterns: ['#', '##', '###'],
                targetPath: 'docs/',
                confidence: 0.7
            },
            {
                name: 'Configuration Files',
                pattern: '**/*.json',
                contentPatterns: ['config', 'settings'],
                targetPath: 'config/',
                confidence: 0.6
            }
        ];
    }
    /**
     * 分類ルールを更新
     */
    async updateRules(rules) {
        this.rules = rules;
        // ルールファイルに保存
        try {
            const rulesData = { rules: this.rules };
            await fs.writeFile(this.config.rulesFile, JSON.stringify(rulesData, null, 2));
            console.log('分類ルールを更新しました');
        }
        catch (error) {
            console.error('分類ルールの保存に失敗しました:', error);
        }
    }
    /**
     * 信頼度を取得
     */
    async getConfidence(filePath) {
        const result = await this.classifyFile(filePath);
        return result.confidence;
    }
    /**
     * 学習データを追加
     */
    addLearningData(filePath, result) {
        if (this.config.enableLearning) {
            this.learningData.set(filePath, result);
        }
    }
    /**
     * 学習データをクリア
     */
    clearLearningData() {
        this.learningData.clear();
        console.log('学習データをクリアしました');
    }
    /**
     * 統計情報を取得
     */
    getStatistics() {
        return {
            rulesCount: this.rules.length,
            learningDataCount: this.learningData.size,
            enableContentAnalysis: this.config.enableContentAnalysis,
            enableLearning: this.config.enableLearning,
            confidenceThreshold: this.config.defaultConfidenceThreshold
        };
    }
}
exports.ClassificationEngine = ClassificationEngine;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGdEQUFrQztBQUNsQywyQ0FBNkI7QUFXN0IsTUFBYSxvQkFBb0I7SUFDdkIsTUFBTSxDQUF1QjtJQUM3QixLQUFLLEdBQXlCLEVBQUUsQ0FBQztJQUNqQyxZQUFZLEdBQXNDLElBQUksR0FBRyxFQUFFLENBQUM7SUFFcEUsWUFBWSxNQUE0QjtRQUN0QyxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztJQUN2QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsVUFBVTtRQUNkLElBQUksQ0FBQztZQUNILE1BQU0sSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3ZCLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztRQUN2RCxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLE9BQU8sQ0FBQyxLQUFLLENBQUMsb0JBQW9CLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDM0MsTUFBTSxLQUFLLENBQUM7UUFDZCxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFlBQVksQ0FBQyxRQUFnQixFQUFFLE9BQWdCO1FBQ25ELElBQUksQ0FBQztZQUNILFlBQVk7WUFDWixNQUFNLFFBQVEsR0FBRztnQkFDZixJQUFJLEVBQUUsUUFBUTtnQkFDZCxTQUFTLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxXQUFXLEVBQUU7Z0JBQy9DLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQztnQkFDakMsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDO2FBQ2hDLENBQUM7WUFFRixrQkFBa0I7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Q0FBQyxVQUFVLENBQUM7SUFDM0IsQ0FBQztJQUVEOztPQUVHO0lBQ0gsZUFBZSxDQUFDLFFBQWdCLEVBQUUsTUFBNEI7UUFDNUQsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQy9CLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUMxQyxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsaUJBQWlCO1FBQ2YsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUMxQixPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFFRDs7T0FFRztJQUNILGFBQWE7UUFDWCxPQUFPO1lBQ0wsVUFBVSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTTtZQUM3QixpQkFBaUIsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUk7WUFDekMscUJBQXFCLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxxQkFBcUI7WUFDeEQsY0FBYyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsY0FBYztZQUMxQyxtQkFBbUIsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLDBCQUEwQjtTQUM1RCxDQUFDO0lBQ0osQ0FBQztDQUNGO0FBOWNELG9EQThjQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2xhc3NpZmljYXRpb24gRW5naW5lXG4gKiDjg5XjgqHjgqTjg6vjga7oh6rli5XliIbpoZ7jgajphY3nva7msbrlrprjgpLmi4XlvZNcbiAqL1xuXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgQ2xhc3NpZmljYXRpb25SZXN1bHQsIENsYXNzaWZpY2F0aW9uUnVsZSwgRmlsZU1ldGFkYXRhIH0gZnJvbSAnLi4vLi4vaW50ZXJmYWNlcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2xhc3NpZmljYXRpb25Db25maWcge1xuICBydWxlc0ZpbGU6IHN0cmluZztcbiAgZGVmYXVsdENvbmZpZGVuY2VUaHJlc2hvbGQ6IG51bWJlcjtcbiAgbWF4Q29udGVudEFuYWx5c2lzU2l6ZTogbnVtYmVyOyAvLyBieXRlc1xuICBlbmFibGVDb250ZW50QW5hbHlzaXM6IGJvb2xlYW47XG4gIGVuYWJsZUxlYXJuaW5nOiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgQ2xhc3NpZmljYXRpb25FbmdpbmUge1xuICBwcml2YXRlIGNvbmZpZzogQ2xhc3NpZmljYXRpb25Db25maWc7XG4gIHByaXZhdGUgcnVsZXM6IENsYXNzaWZpY2F0aW9uUnVsZVtdID0gW107XG4gIHByaXZhdGUgbGVhcm5pbmdEYXRhOiBNYXA8c3RyaW5nLCBDbGFzc2lmaWNhdGlvblJlc3VsdD4gPSBuZXcgTWFwKCk7XG5cbiAgY29uc3RydWN0b3IoY29uZmlnOiBDbGFzc2lmaWNhdGlvbkNvbmZpZykge1xuICAgIHRoaXMuY29uZmlnID0gY29uZmlnO1xuICB9XG5cbiAgLyoqXG4gICAqIOWIhumhnuOCqOODs+OCuOODs+OCkuWIneacn+WMllxuICAgKi9cbiAgYXN5bmMgaW5pdGlhbGl6ZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5sb2FkUnVsZXMoKTtcbiAgICAgIGNvbnNvbGUubG9nKGDliIbpoZ7jg6vjg7zjg6vjgpLoqq3jgb/ovrzjgb/jgb7jgZfjgZ86ICR7dGhpcy5ydWxlcy5sZW5ndGh9IOS7tmApO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCfliIbpoZ7jgqjjg7Pjgrjjg7Pjga7liJ3mnJ/ljJbjgavlpLHmlZfjgZfjgb7jgZfjgZ86JywgZXJyb3IpO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODleOCoeOCpOODq+OCkuWIhumhnlxuICAgKi9cbiAgYXN5bmMgY2xhc3NpZnlGaWxlKGZpbGVQYXRoOiBzdHJpbmcsIGNvbnRlbnQ/OiBzdHJpbmcpOiBQcm9taXNlPENsYXNzaWZpY2F0aW9uUmVzdWx0PiB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIOODleOCoeOCpOODq+aDheWgseOCkuWPluW+l1xuICAgICAgY29uc3QgZmlsZUluZm8gPSB7XG4gICAgICAgIHBhdGg6IGZpbGVQYXRoLFxuICAgICAgICBleHRlbnNpb246IHBhdGguZXh0bmFtZShmaWxlUGF0aCkudG9Mb3dlckNhc2UoKSxcbiAgICAgICAgYmFzZW5hbWU6IHBhdGguYmFzZW5hbWUoZmlsZVBhdGgpLFxuICAgICAgICBkaXJuYW1lOiBwYXRoLmRpcm5hbWUoZmlsZVBhdGgpXG4gICAgICB9O1xuXG4gICAgICAvLyDlrabnv5Ljg4fjg7zjgr/jgYvjgonml6Lnn6Xjga7liIbpoZ7jgpLnorroqo1cbiAgICAgIGNvbnN0IGxlYXJuZWRSZXN1bHQgPSB0aGlzLmxlYXJuaW5nRGF0YS5nZXQoZmlsZVBhdGgpO1xuICAgICAgaWYgKGxlYXJuZWRSZXN1bHQgJiYgbGVhcm5lZFJlc3VsdC5jb25maWRlbmNlID4gMC45KSB7XG4gICAgICAgIHJldHVybiBsZWFybmVkUmVzdWx0O1xuICAgICAgfVxuXG4gICAgICAvLyDmi6HlvLXlrZDjg5njg7zjgrnliIbpoZ5cbiAgICAgIGNvbnN0IGV4dGVuc2lvblJlc3VsdHMgPSBhd2FpdCB0aGlzLmNsYXNzaWZ5QnlFeHRlbnNpb24oZmlsZUluZm8pO1xuXG4gICAgICAvLyDlhoXlrrnjg5njg7zjgrnliIbpoZ7vvIjmnInlirnjgarloLTlkIjvvIlcbiAgICAgIGxldCBjb250ZW50UmVzdWx0czogQ2xhc3NpZmljYXRpb25SZXN1bHRbXSA9IFtdO1xuICAgICAgaWYgKHRoaXMuY29uZmlnLmVuYWJsZUNvbnRlbnRBbmFseXNpcykge1xuICAgICAgICBjb250ZW50UmVzdWx0cyA9IGF3YWl0IHRoaXMuY2xhc3NpZnlCeUNvbnRlbnQoZmlsZVBhdGgsIGNvbnRlbnQpO1xuICAgICAgfVxuXG4gICAgICAvLyDjg5Hjgrnjg5njg7zjgrnliIbpoZ5cbiAgICAgIGNvbnN0IHBhdGhSZXN1bHRzID0gYXdhaXQgdGhpcy5jbGFzc2lmeUJ5UGF0aChmaWxlSW5mbyk7XG5cbiAgICAgIC8vIOe1kOaenOOCkue1seWQiFxuICAgICAgY29uc3QgY29tYmluZWRSZXN1bHQgPSB0aGlzLmNvbWJpbmVSZXN1bHRzKFtcbiAgICAgICAgLi4uZXh0ZW5zaW9uUmVzdWx0cyxcbiAgICAgICAgLi4uY29udGVudFJlc3VsdHMsXG4gICAgICAgIC4uLnBhdGhSZXN1bHRzXG4gICAgICBdKTtcblxuICAgICAgLy8g5a2m57+S44OH44O844K/44Gr6L+95YqgXG4gICAgICBpZiAodGhpcy5jb25maWcuZW5hYmxlTGVhcm5pbmcgJiYgY29tYmluZWRSZXN1bHQuY29uZmlkZW5jZSA+IDAuNykge1xuICAgICAgICB0aGlzLmxlYXJuaW5nRGF0YS5zZXQoZmlsZVBhdGgsIGNvbWJpbmVkUmVzdWx0KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGNvbWJpbmVkUmVzdWx0O1xuXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYOODleOCoeOCpOODq+WIhumhnuOCqOODqeODvCAoJHtmaWxlUGF0aH0pOmAsIGVycm9yKTtcbiAgICAgIHJldHVybiB0aGlzLmdldERlZmF1bHRDbGFzc2lmaWNhdGlvbihmaWxlUGF0aCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOaLoeW8teWtkOODmeODvOOCueWIhumhnlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBjbGFzc2lmeUJ5RXh0ZW5zaW9uKGZpbGVJbmZvOiBhbnkpOiBQcm9taXNlPENsYXNzaWZpY2F0aW9uUmVzdWx0W10+IHtcbiAgICBjb25zdCByZXN1bHRzOiBDbGFzc2lmaWNhdGlvblJlc3VsdFtdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IHJ1bGUgb2YgdGhpcy5ydWxlcykge1xuICAgICAgaWYgKHRoaXMubWF0Y2hlc1BhdHRlcm4oZmlsZUluZm8uYmFzZW5hbWUsIHJ1bGUucGF0dGVybikpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0OiBDbGFzc2lmaWNhdGlvblJlc3VsdCA9IHtcbiAgICAgICAgICBjYXRlZ29yeTogdGhpcy5leHRyYWN0Q2F0ZWdvcnkocnVsZS50YXJnZXRQYXRoKSxcbiAgICAgICAgICBzdWJjYXRlZ29yeTogdGhpcy5leHRyYWN0U3ViY2F0ZWdvcnkocnVsZS50YXJnZXRQYXRoKSxcbiAgICAgICAgICBjb25maWRlbmNlOiBydWxlLmNvbmZpZGVuY2UsXG4gICAgICAgICAgc3VnZ2VzdGVkUGF0aDogdGhpcy5yZXNvbHZlUGF0aChydWxlLnRhcmdldFBhdGgsIGZpbGVJbmZvKSxcbiAgICAgICAgICByZWFzb25pbmc6IFtg5ouh5by15a2Q44OR44K/44O844Oz44Oe44OD44OBOiAke3J1bGUucGF0dGVybn1gLCBg44Or44O844OrOiAke3J1bGUubmFtZX1gXVxuICAgICAgICB9O1xuICAgICAgICByZXN1bHRzLnB1c2gocmVzdWx0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfVxuXG4gIC8qKlxuICAgKiDjg5XjgqHjgqTjg6vlhoXlrrnjg5njg7zjgrnliIbpoZ5cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgY2xhc3NpZnlCeUNvbnRlbnQoZmlsZVBhdGg6IHN0cmluZywgcHJvdmlkZWRDb250ZW50Pzogc3RyaW5nKTogUHJvbWlzZTxDbGFzc2lmaWNhdGlvblJlc3VsdFtdPiB7XG4gICAgY29uc3QgcmVzdWx0czogQ2xhc3NpZmljYXRpb25SZXN1bHRbXSA9IFtdO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIOODleOCoeOCpOODq+OCteOCpOOCuuODgeOCp+ODg+OCr1xuICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBmcy5zdGF0KGZpbGVQYXRoKTtcbiAgICAgIGlmIChzdGF0cy5zaXplID4gdGhpcy5jb25maWcubWF4Q29udGVudEFuYWx5c2lzU2l6ZSkge1xuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICAgIH1cblxuICAgICAgLy8g44OV44Kh44Kk44Or5YaF5a6544KS5Y+W5b6XXG4gICAgICBsZXQgY29udGVudCA9IHByb3ZpZGVkQ29udGVudDtcbiAgICAgIGlmICghY29udGVudCkge1xuICAgICAgICBjb25zdCBidWZmZXIgPSBhd2FpdCBmcy5yZWFkRmlsZShmaWxlUGF0aCk7XG4gICAgICAgIGNvbnRlbnQgPSBidWZmZXIudG9TdHJpbmcoJ3V0Zi04Jyk7XG4gICAgICB9XG5cbiAgICAgIC8vIOWGheWuueODkeOCv+ODvOODs+ODnuODg+ODgeODs+OCsFxuICAgICAgZm9yIChjb25zdCBydWxlIG9mIHRoaXMucnVsZXMpIHtcbiAgICAgICAgaWYgKHJ1bGUuY29udGVudFBhdHRlcm5zKSB7XG4gICAgICAgICAgY29uc3QgbWF0Y2hDb3VudCA9IHRoaXMuY291bnRDb250ZW50TWF0Y2hlcyhjb250ZW50LCBydWxlLmNvbnRlbnRQYXR0ZXJucyk7XG4gICAgICAgICAgaWYgKG1hdGNoQ291bnQgPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBjb25maWRlbmNlID0gTWF0aC5taW4ocnVsZS5jb25maWRlbmNlICsgKG1hdGNoQ291bnQgKiAwLjEpLCAxLjApO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IENsYXNzaWZpY2F0aW9uUmVzdWx0ID0ge1xuICAgICAgICAgICAgICBjYXRlZ29yeTogdGhpcy5leHRyYWN0Q2F0ZWdvcnkocnVsZS50YXJnZXRQYXRoKSxcbiAgICAgICAgICAgICAgc3ViY2F0ZWdvcnk6IHRoaXMuZXh0cmFjdFN1YmNhdGVnb3J5KHJ1bGUudGFyZ2V0UGF0aCksXG4gICAgICAgICAgICAgIGNvbmZpZGVuY2UsXG4gICAgICAgICAgICAgIHN1Z2dlc3RlZFBhdGg6IHRoaXMucmVzb2x2ZVBhdGgocnVsZS50YXJnZXRQYXRoLCB7IHBhdGg6IGZpbGVQYXRoIH0pLFxuICAgICAgICAgICAgICByZWFzb25pbmc6IFtcbiAgICAgICAgICAgICAgICBg5YaF5a6544OR44K/44O844Oz44Oe44OD44OBOiAke21hdGNoQ291bnR9IOS7tmAsXG4gICAgICAgICAgICAgICAgYOODq+ODvOODqzogJHtydWxlLm5hbWV9YCxcbiAgICAgICAgICAgICAgICAuLi5ydWxlLmNvbnRlbnRQYXR0ZXJucy5zbGljZSgwLCAzKS5tYXAocCA9PiBg44OR44K/44O844OzOiAke3B9YClcbiAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJlc3VsdHMucHVzaChyZXN1bHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOOCteODluODq+ODvOODq+OBruWHpueQhlxuICAgICAgICBpZiAocnVsZS5ydWxlcykge1xuICAgICAgICAgIGZvciAoY29uc3Qgc3ViUnVsZSBvZiBydWxlLnJ1bGVzKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5tYXRjaGVzQ29udGVudFBhdHRlcm4oY29udGVudCwgc3ViUnVsZS5jb250ZW50UGF0dGVybikpIHtcbiAgICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBDbGFzc2lmaWNhdGlvblJlc3VsdCA9IHtcbiAgICAgICAgICAgICAgICBjYXRlZ29yeTogdGhpcy5leHRyYWN0Q2F0ZWdvcnkoc3ViUnVsZS50YXJnZXRQYXRoKSxcbiAgICAgICAgICAgICAgICBzdWJjYXRlZ29yeTogdGhpcy5leHRyYWN0U3ViY2F0ZWdvcnkoc3ViUnVsZS50YXJnZXRQYXRoKSxcbiAgICAgICAgICAgICAgICBjb25maWRlbmNlOiBydWxlLmNvbmZpZGVuY2UgKiAwLjksIC8vIOOCteODluODq+ODvOODq+OBr+WwkeOBl+S/oemgvOW6puOCkuS4i+OBkuOCi1xuICAgICAgICAgICAgICAgIHN1Z2dlc3RlZFBhdGg6IHRoaXMucmVzb2x2ZVBhdGgoc3ViUnVsZS50YXJnZXRQYXRoLCB7IHBhdGg6IGZpbGVQYXRoIH0pLFxuICAgICAgICAgICAgICAgIHJlYXNvbmluZzogW1xuICAgICAgICAgICAgICAgICAgYOOCteODluODq+ODvOODq+ODnuODg+ODgTogJHtzdWJSdWxlLmNvbnRlbnRQYXR0ZXJufWAsXG4gICAgICAgICAgICAgICAgICBg6Kaq44Or44O844OrOiAke3J1bGUubmFtZX1gXG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICByZXN1bHRzLnB1c2gocmVzdWx0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGDlhoXlrrnliIbmnpDjgqjjg6njg7wgKCR7ZmlsZVBhdGh9KTpgLCBlcnJvcik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH1cblxuICAvKipcbiAgICog44OR44K544OZ44O844K55YiG6aGeXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGNsYXNzaWZ5QnlQYXRoKGZpbGVJbmZvOiBhbnkpOiBQcm9taXNlPENsYXNzaWZpY2F0aW9uUmVzdWx0W10+IHtcbiAgICBjb25zdCByZXN1bHRzOiBDbGFzc2lmaWNhdGlvblJlc3VsdFtdID0gW107XG4gICAgY29uc3Qgbm9ybWFsaXplZFBhdGggPSBwYXRoLm5vcm1hbGl6ZShmaWxlSW5mby5wYXRoKTtcblxuICAgIC8vIOaXouWtmOOBruODh+OCo+ODrOOCr+ODiOODquani+mAoOOBi+OCieaOqOa4rFxuICAgIGNvbnN0IHBhdGhTZWdtZW50cyA9IG5vcm1hbGl6ZWRQYXRoLnNwbGl0KHBhdGguc2VwKTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHNlZ21lbnQgb2YgcGF0aFNlZ21lbnRzKSB7XG4gICAgICBzd2l0Y2ggKHNlZ21lbnQudG9Mb3dlckNhc2UoKSkge1xuICAgICAgICBjYXNlICdsaWInOlxuICAgICAgICBjYXNlICdzcmMnOlxuICAgICAgICAgIGlmIChmaWxlSW5mby5leHRlbnNpb24gPT09ICcudHMnKSB7XG4gICAgICAgICAgICByZXN1bHRzLnB1c2goe1xuICAgICAgICAgICAgICBjYXRlZ29yeTogJ2xpYnJhcnknLFxuICAgICAgICAgICAgICBjb25maWRlbmNlOiAwLjYsXG4gICAgICAgICAgICAgIHN1Z2dlc3RlZFBhdGg6ICdsaWIvJyxcbiAgICAgICAgICAgICAgcmVhc29uaW5nOiBbJ+ODkeOCueani+mAoOOBq+OCiOOCi+aOqOa4rDog44Op44Kk44OW44Op44Oq44OV44Kh44Kk44OrJ11cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnZG9jcyc6XG4gICAgICAgIGNhc2UgJ2RvY3VtZW50YXRpb24nOlxuICAgICAgICAgIHJlc3VsdHMucHVzaCh7XG4gICAgICAgICAgICBjYXRlZ29yeTogJ2RvY3VtZW50YXRpb24nLFxuICAgICAgICAgICAgY29uZmlkZW5jZTogMC43LFxuICAgICAgICAgICAgc3VnZ2VzdGVkUGF0aDogJ2RvY3MvJyxcbiAgICAgICAgICAgIHJlYXNvbmluZzogWyfjg5Hjgrnmp4vpgKDjgavjgojjgovmjqjmuKw6IOODieOCreODpeODoeODs+ODiCddXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2NvbmZpZyc6XG4gICAgICAgIGNhc2UgJ2NvbmZpZ3VyYXRpb24nOlxuICAgICAgICAgIHJlc3VsdHMucHVzaCh7XG4gICAgICAgICAgICBjYXRlZ29yeTogJ2NvbmZpZ3VyYXRpb24nLFxuICAgICAgICAgICAgY29uZmlkZW5jZTogMC44LFxuICAgICAgICAgICAgc3VnZ2VzdGVkUGF0aDogJ2NvbmZpZy8nLFxuICAgICAgICAgICAgcmVhc29uaW5nOiBbJ+ODkeOCueani+mAoOOBq+OCiOOCi+aOqOa4rDog6Kit5a6a44OV44Kh44Kk44OrJ11cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAndGVzdCc6XG4gICAgICAgIGNhc2UgJ3Rlc3RzJzpcbiAgICAgICAgY2FzZSAnX190ZXN0c19fJzpcbiAgICAgICAgICByZXN1bHRzLnB1c2goe1xuICAgICAgICAgICAgY2F0ZWdvcnk6ICd0ZXN0JyxcbiAgICAgICAgICAgIGNvbmZpZGVuY2U6IDAuOSxcbiAgICAgICAgICAgIHN1Z2dlc3RlZFBhdGg6ICd0ZXN0cy8nLFxuICAgICAgICAgICAgcmVhc29uaW5nOiBbJ+ODkeOCueani+mAoOOBq+OCiOOCi+aOqOa4rDog44OG44K544OI44OV44Kh44Kk44OrJ11cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfVxuXG4gIC8qKlxuICAgKiDliIbpoZ7ntZDmnpzjgpLntbHlkIhcbiAgICovXG4gIHByaXZhdGUgY29tYmluZVJlc3VsdHMocmVzdWx0czogQ2xhc3NpZmljYXRpb25SZXN1bHRbXSk6IENsYXNzaWZpY2F0aW9uUmVzdWx0IHtcbiAgICBpZiAocmVzdWx0cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB0aGlzLmdldERlZmF1bHRDbGFzc2lmaWNhdGlvbignJyk7XG4gICAgfVxuXG4gICAgLy8g5L+h6aC85bqm44Gn44K944O844OIXG4gICAgcmVzdWx0cy5zb3J0KChhLCBiKSA9PiBiLmNvbmZpZGVuY2UgLSBhLmNvbmZpZGVuY2UpO1xuXG4gICAgLy8g5pyA44KC5L+h6aC85bqm44Gu6auY44GE57WQ5p6c44KS44OZ44O844K544GrXG4gICAgY29uc3QgYmVzdFJlc3VsdCA9IHJlc3VsdHNbMF07XG5cbiAgICAvLyDlkIzjgZjjgqvjg4bjgrTjg6rjga7ntZDmnpzjgYzjgYLjgozjgbDkv6HpoLzluqbjgpLlkJHkuIpcbiAgICBjb25zdCBzYW1lQ2F0ZWdvcnkgPSByZXN1bHRzLmZpbHRlcihyID0+IHIuY2F0ZWdvcnkgPT09IGJlc3RSZXN1bHQuY2F0ZWdvcnkpO1xuICAgIGlmIChzYW1lQ2F0ZWdvcnkubGVuZ3RoID4gMSkge1xuICAgICAgY29uc3QgYXZnQ29uZmlkZW5jZSA9IHNhbWVDYXRlZ29yeS5yZWR1Y2UoKHN1bSwgcikgPT4gc3VtICsgci5jb25maWRlbmNlLCAwKSAvIHNhbWVDYXRlZ29yeS5sZW5ndGg7XG4gICAgICBiZXN0UmVzdWx0LmNvbmZpZGVuY2UgPSBNYXRoLm1pbihhdmdDb25maWRlbmNlICogMS4yLCAxLjApO1xuICAgIH1cblxuICAgIC8vIOaOqOirluOCkue1seWQiFxuICAgIGNvbnN0IGFsbFJlYXNvbnMgPSByZXN1bHRzLmZsYXRNYXAociA9PiByLnJlYXNvbmluZyB8fCBbXSk7XG4gICAgYmVzdFJlc3VsdC5yZWFzb25pbmcgPSBbLi4ubmV3IFNldChhbGxSZWFzb25zKV0uc2xpY2UoMCwgNSk7XG5cbiAgICByZXR1cm4gYmVzdFJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg5Hjgr/jg7zjg7Pjg57jg4Pjg4Hjg7PjgrBcbiAgICovXG4gIHByaXZhdGUgbWF0Y2hlc1BhdHRlcm4oZmlsZW5hbWU6IHN0cmluZywgcGF0dGVybjogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgLy8g57Ch5Y2Y44Gq44Kw44Ot44OW44OR44K/44O844Oz44Oe44OD44OB44Oz44KwXG4gICAgY29uc3QgcmVnZXhQYXR0ZXJuID0gcGF0dGVyblxuICAgICAgLnJlcGxhY2UoL1xcLi9nLCAnXFxcXC4nKVxuICAgICAgLnJlcGxhY2UoL1xcKi9nLCAnLionKVxuICAgICAgLnJlcGxhY2UoL1xcPy9nLCAnLicpO1xuICAgIFxuICAgIGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cChgXiR7cmVnZXhQYXR0ZXJufSRgLCAnaScpO1xuICAgIHJldHVybiByZWdleC50ZXN0KGZpbGVuYW1lKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlhoXlrrnjg5Hjgr/jg7zjg7Pjg57jg4Pjg4Hjg7PjgrBcbiAgICovXG4gIHByaXZhdGUgbWF0Y2hlc0NvbnRlbnRQYXR0ZXJuKGNvbnRlbnQ6IHN0cmluZywgcGF0dGVybjogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cChwYXR0ZXJuLCAnaScpO1xuICAgICAgcmV0dXJuIHJlZ2V4LnRlc3QoY29udGVudCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyDmraPopo/ooajnj77jgYznhKHlirnjgarloLTlkIjjga/mloflrZfliJfmpJzntKJcbiAgICAgIHJldHVybiBjb250ZW50LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocGF0dGVybi50b0xvd2VyQ2FzZSgpKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog5YaF5a6544OR44K/44O844Oz44Gu44Oe44OD44OB5pWw44KS44Kr44Km44Oz44OIXG4gICAqL1xuICBwcml2YXRlIGNvdW50Q29udGVudE1hdGNoZXMoY29udGVudDogc3RyaW5nLCBwYXR0ZXJuczogc3RyaW5nW10pOiBudW1iZXIge1xuICAgIGxldCBjb3VudCA9IDA7XG4gICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIHBhdHRlcm5zKSB7XG4gICAgICBpZiAodGhpcy5tYXRjaGVzQ29udGVudFBhdHRlcm4oY29udGVudCwgcGF0dGVybikpIHtcbiAgICAgICAgY291bnQrKztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGNvdW50O1xuICB9XG5cbiAgLyoqXG4gICAqIOOCq+ODhuOCtOODquOCkuaKveWHulxuICAgKi9cbiAgcHJpdmF0ZSBleHRyYWN0Q2F0ZWdvcnkodGFyZ2V0UGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBzZWdtZW50cyA9IHRhcmdldFBhdGguc3BsaXQoJy8nKS5maWx0ZXIocyA9PiBzKTtcbiAgICByZXR1cm4gc2VnbWVudHNbMF0gfHwgJ21pc2MnO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCteODluOCq+ODhuOCtOODquOCkuaKveWHulxuICAgKi9cbiAgcHJpdmF0ZSBleHRyYWN0U3ViY2F0ZWdvcnkodGFyZ2V0UGF0aDogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICBjb25zdCBzZWdtZW50cyA9IHRhcmdldFBhdGguc3BsaXQoJy8nKS5maWx0ZXIocyA9PiBzKTtcbiAgICByZXR1cm4gc2VnbWVudHNbMV07XG4gIH1cblxuICAvKipcbiAgICog44OR44K544KS6Kej5rG6XG4gICAqL1xuICBwcml2YXRlIHJlc29sdmVQYXRoKHRhcmdldFBhdGg6IHN0cmluZywgZmlsZUluZm86IGFueSk6IHN0cmluZyB7XG4gICAgLy8g5aSJ5pWw572u5o+bXG4gICAgbGV0IHJlc29sdmVkUGF0aCA9IHRhcmdldFBhdGg7XG4gICAgXG4gICAgaWYgKGZpbGVJbmZvLmJhc2VuYW1lKSB7XG4gICAgICByZXNvbHZlZFBhdGggPSByZXNvbHZlZFBhdGgucmVwbGFjZSgnJHtmaWxlbmFtZX0nLCBmaWxlSW5mby5iYXNlbmFtZSk7XG4gICAgfVxuICAgIFxuICAgIGlmIChmaWxlSW5mby5leHRlbnNpb24pIHtcbiAgICAgIHJlc29sdmVkUGF0aCA9IHJlc29sdmVkUGF0aC5yZXBsYWNlKCcke2V4dH0nLCBmaWxlSW5mby5leHRlbnNpb24pO1xuICAgIH1cblxuICAgIHJldHVybiByZXNvbHZlZFBhdGg7XG4gIH1cblxuICAvKipcbiAgICog44OH44OV44Kp44Or44OI5YiG6aGe44KS5Y+W5b6XXG4gICAqL1xuICBwcml2YXRlIGdldERlZmF1bHRDbGFzc2lmaWNhdGlvbihmaWxlUGF0aDogc3RyaW5nKTogQ2xhc3NpZmljYXRpb25SZXN1bHQge1xuICAgIGNvbnN0IGV4dCA9IHBhdGguZXh0bmFtZShmaWxlUGF0aCkudG9Mb3dlckNhc2UoKTtcbiAgICBcbiAgICAvLyDmi6HlvLXlrZDjgavjgojjgovln7rmnKzliIbpoZ5cbiAgICBsZXQgY2F0ZWdvcnkgPSAnbWlzYyc7XG4gICAgbGV0IHN1Z2dlc3RlZFBhdGggPSAnbWlzYy8nO1xuICAgIFxuICAgIGlmIChbJy50cycsICcuanMnLCAnLnRzeCcsICcuanN4J10uaW5jbHVkZXMoZXh0KSkge1xuICAgICAgY2F0ZWdvcnkgPSAnY29kZSc7XG4gICAgICBzdWdnZXN0ZWRQYXRoID0gJ2xpYi8nO1xuICAgIH0gZWxzZSBpZiAoWycubWQnLCAnLnR4dCcsICcucnN0J10uaW5jbHVkZXMoZXh0KSkge1xuICAgICAgY2F0ZWdvcnkgPSAnZG9jdW1lbnRhdGlvbic7XG4gICAgICBzdWdnZXN0ZWRQYXRoID0gJ2RvY3MvJztcbiAgICB9IGVsc2UgaWYgKFsnLmpzb24nLCAnLnltbCcsICcueWFtbCcsICcudG9tbCddLmluY2x1ZGVzKGV4dCkpIHtcbiAgICAgIGNhdGVnb3J5ID0gJ2NvbmZpZ3VyYXRpb24nO1xuICAgICAgc3VnZ2VzdGVkUGF0aCA9ICdjb25maWcvJztcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgY2F0ZWdvcnksXG4gICAgICBjb25maWRlbmNlOiAwLjMsXG4gICAgICBzdWdnZXN0ZWRQYXRoLFxuICAgICAgcmVhc29uaW5nOiBbJ+ODh+ODleOCqeODq+ODiOWIhumhnjog5ouh5by15a2Q44OZ44O844K5J11cbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOWIhumhnuODq+ODvOODq+OCkuiqreOBv+i+vOOBv1xuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBsb2FkUnVsZXMoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJ1bGVzQ29udGVudCA9IGF3YWl0IGZzLnJlYWRGaWxlKHRoaXMuY29uZmlnLnJ1bGVzRmlsZSwgJ3V0Zi04Jyk7XG4gICAgICBjb25zdCBydWxlc0RhdGEgPSBKU09OLnBhcnNlKHJ1bGVzQ29udGVudCk7XG4gICAgICB0aGlzLnJ1bGVzID0gcnVsZXNEYXRhLnJ1bGVzIHx8IFtdO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLndhcm4oYOWIhumhnuODq+ODvOODq+ODleOCoeOCpOODq+OBruiqreOBv+i+vOOBv+OBq+WkseaVl+OBl+OBvuOBl+OBnzogJHt0aGlzLmNvbmZpZy5ydWxlc0ZpbGV9YCk7XG4gICAgICB0aGlzLnJ1bGVzID0gdGhpcy5nZXREZWZhdWx0UnVsZXMoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44OH44OV44Kp44Or44OI5YiG6aGe44Or44O844Or44KS5Y+W5b6XXG4gICAqL1xuICBwcml2YXRlIGdldERlZmF1bHRSdWxlcygpOiBDbGFzc2lmaWNhdGlvblJ1bGVbXSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ1R5cGVTY3JpcHQgRmlsZXMnLFxuICAgICAgICBwYXR0ZXJuOiAnKiovKi50cycsXG4gICAgICAgIGNvbnRlbnRQYXR0ZXJuczogWydpbXBvcnQnLCAnZXhwb3J0JywgJ2ludGVyZmFjZScsICdjbGFzcyddLFxuICAgICAgICB0YXJnZXRQYXRoOiAnbGliLycsXG4gICAgICAgIGNvbmZpZGVuY2U6IDAuOFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ0phdmFTY3JpcHQgRmlsZXMnLFxuICAgICAgICBwYXR0ZXJuOiAnKiovKi5qcycsXG4gICAgICAgIGNvbnRlbnRQYXR0ZXJuczogWydyZXF1aXJlJywgJ21vZHVsZS5leHBvcnRzJywgJ2Z1bmN0aW9uJ10sXG4gICAgICAgIHRhcmdldFBhdGg6ICdsaWIvJyxcbiAgICAgICAgY29uZmlkZW5jZTogMC44XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAnVGVzdCBGaWxlcycsXG4gICAgICAgIHBhdHRlcm46ICcqKi8qLnRlc3QuKicsXG4gICAgICAgIGNvbnRlbnRQYXR0ZXJuczogWydkZXNjcmliZScsICdpdCgnLCAndGVzdCgnLCAnZXhwZWN0J10sXG4gICAgICAgIHRhcmdldFBhdGg6ICd0ZXN0cy8nLFxuICAgICAgICBjb25maWRlbmNlOiAwLjk1XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAnRG9jdW1lbnRhdGlvbicsXG4gICAgICAgIHBhdHRlcm46ICcqKi8qLm1kJyxcbiAgICAgICAgY29udGVudFBhdHRlcm5zOiBbJyMnLCAnIyMnLCAnIyMjJ10sXG4gICAgICAgIHRhcmdldFBhdGg6ICdkb2NzLycsXG4gICAgICAgIGNvbmZpZGVuY2U6IDAuN1xuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ0NvbmZpZ3VyYXRpb24gRmlsZXMnLFxuICAgICAgICBwYXR0ZXJuOiAnKiovKi5qc29uJyxcbiAgICAgICAgY29udGVudFBhdHRlcm5zOiBbJ2NvbmZpZycsICdzZXR0aW5ncyddLFxuICAgICAgICB0YXJnZXRQYXRoOiAnY29uZmlnLycsXG4gICAgICAgIGNvbmZpZGVuY2U6IDAuNlxuICAgICAgfVxuICAgIF07XG4gIH1cblxuICAvKipcbiAgICog5YiG6aGe44Or44O844Or44KS5pu05pawXG4gICAqL1xuICBhc3luYyB1cGRhdGVSdWxlcyhydWxlczogQ2xhc3NpZmljYXRpb25SdWxlW10pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnJ1bGVzID0gcnVsZXM7XG4gICAgXG4gICAgLy8g44Or44O844Or44OV44Kh44Kk44Or44Gr5L+d5a2YXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJ1bGVzRGF0YSA9IHsgcnVsZXM6IHRoaXMucnVsZXMgfTtcbiAgICAgIGF3YWl0IGZzLndyaXRlRmlsZSh0aGlzLmNvbmZpZy5ydWxlc0ZpbGUsIEpTT04uc3RyaW5naWZ5KHJ1bGVzRGF0YSwgbnVsbCwgMikpO1xuICAgICAgY29uc29sZS5sb2coJ+WIhumhnuODq+ODvOODq+OCkuabtOaWsOOBl+OBvuOBl+OBnycpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCfliIbpoZ7jg6vjg7zjg6vjga7kv53lrZjjgavlpLHmlZfjgZfjgb7jgZfjgZ86JywgZXJyb3IpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDkv6HpoLzluqbjgpLlj5blvpdcbiAgICovXG4gIGFzeW5jIGdldENvbmZpZGVuY2UoZmlsZVBhdGg6IHN0cmluZyk6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jbGFzc2lmeUZpbGUoZmlsZVBhdGgpO1xuICAgIHJldHVybiByZXN1bHQuY29uZmlkZW5jZTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlrabnv5Ljg4fjg7zjgr/jgpLov73liqBcbiAgICovXG4gIGFkZExlYXJuaW5nRGF0YShmaWxlUGF0aDogc3RyaW5nLCByZXN1bHQ6IENsYXNzaWZpY2F0aW9uUmVzdWx0KTogdm9pZCB7XG4gICAgaWYgKHRoaXMuY29uZmlnLmVuYWJsZUxlYXJuaW5nKSB7XG4gICAgICB0aGlzLmxlYXJuaW5nRGF0YS5zZXQoZmlsZVBhdGgsIHJlc3VsdCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOWtpue/kuODh+ODvOOCv+OCkuOCr+ODquOColxuICAgKi9cbiAgY2xlYXJMZWFybmluZ0RhdGEoKTogdm9pZCB7XG4gICAgdGhpcy5sZWFybmluZ0RhdGEuY2xlYXIoKTtcbiAgICBjb25zb2xlLmxvZygn5a2m57+S44OH44O844K/44KS44Kv44Oq44Ki44GX44G+44GX44GfJyk7XG4gIH1cblxuICAvKipcbiAgICog57Wx6KiI5oOF5aCx44KS5Y+W5b6XXG4gICAqL1xuICBnZXRTdGF0aXN0aWNzKCk6IGFueSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHJ1bGVzQ291bnQ6IHRoaXMucnVsZXMubGVuZ3RoLFxuICAgICAgbGVhcm5pbmdEYXRhQ291bnQ6IHRoaXMubGVhcm5pbmdEYXRhLnNpemUsXG4gICAgICBlbmFibGVDb250ZW50QW5hbHlzaXM6IHRoaXMuY29uZmlnLmVuYWJsZUNvbnRlbnRBbmFseXNpcyxcbiAgICAgIGVuYWJsZUxlYXJuaW5nOiB0aGlzLmNvbmZpZy5lbmFibGVMZWFybmluZyxcbiAgICAgIGNvbmZpZGVuY2VUaHJlc2hvbGQ6IHRoaXMuY29uZmlnLmRlZmF1bHRDb25maWRlbmNlVGhyZXNob2xkXG4gICAgfTtcbiAgfVxufSJdfQ==