"use strict";
/**
 * 統合ファイル整理システム - パターンマッチングエンジン
 *
 * ファイル名パターンとファイル内容の解析により、
 * 適切な分類を行うためのマッチングエンジンを提供します。
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
exports.PatternMatcher = void 0;
const path = __importStar(require("path"));
/**
 * パターンマッチングエンジン
 *
 * ファイル名、拡張子、内容に基づいてファイルを分類するための
 * 高度なパターンマッチング機能を提供します。
 */
class PatternMatcher {
    rules;
    contentAnalysisEnabled;
    constructor(rules, contentAnalysisEnabled = true) {
        this.rules = new Map();
        this.contentAnalysisEnabled = contentAnalysisEnabled;
        this.loadRules(rules);
    }
    /**
     * ファイルに最適なルールを見つける
     */
    findBestMatch(file) {
        const allMatches = [];
        // 全ルールカテゴリを検査
        for (const [category, categoryRules] of this.rules) {
            for (const rule of categoryRules) {
                if (!rule.enabled)
                    continue;
                const match = this.evaluateRule(file, rule, category);
                if (match.matched) {
                    allMatches.push(match);
                }
            }
        }
        if (allMatches.length === 0) {
            return null;
        }
        // 信頼度と優先度でソート
        allMatches.sort((a, b) => {
            const priorityDiff = b.rule.priority - a.rule.priority;
            if (priorityDiff !== 0)
                return priorityDiff;
            return b.confidence - a.confidence;
        });
        return allMatches[0];
    }
    /**
     * 複数のマッチ候補を取得
     */
    findAllMatches(file, minConfidence = 0.3) {
        const matches = [];
        for (const [category, categoryRules] of this.rules) {
            for (const rule of categoryRules) {
                if (!rule.enabled)
                    continue;
                const match = this.evaluateRule(file, rule, category);
                if (match.matched && match.confidence >= minConfidence) {
                    matches.push(match);
                }
            }
        }
        return matches.sort((a, b) => b.confidence - a.confidence);
    }
    /**
     * 特定のカテゴリでマッチングを実行
     */
    matchCategory(file, category) {
        const categoryRules = this.rules.get(category);
        if (!categoryRules) {
            return null;
        }
        let bestMatch = null;
        for (const rule of categoryRules) {
            if (!rule.enabled)
                continue;
            const match = this.evaluateRule(file, rule, category);
            if (match.matched && (!bestMatch || match.confidence > bestMatch.confidence)) {
                bestMatch = match;
            }
        }
        return bestMatch;
    }
    /**
     * ルールを評価
     */
    evaluateRule(file, rule, category) {
        const reasons = [];
        let totalConfidence = 0;
        let matchCount = 0;
        // ファイル名パターンマッチング
        const nameMatch = this.matchPatterns(file.name, rule.patterns);
        if (nameMatch.matched) {
            totalConfidence += nameMatch.confidence * 0.6; // 60%の重み
            matchCount++;
            reasons.push(`ファイル名パターン: ${nameMatch.pattern}`);
        }
        // 拡張子マッチング
        const extensionMatch = this.matchExtension(file.extension, rule.patterns);
        if (extensionMatch.matched) {
            totalConfidence += extensionMatch.confidence * 0.3; // 30%の重み
            matchCount++;
            reasons.push(`拡張子パターン: ${extensionMatch.pattern}`);
        }
        // ファイル内容マッチング（有効な場合）
        if (this.contentAnalysisEnabled && file.content) {
            const contentMatch = this.matchContent(file.content, rule.patterns, category);
            if (contentMatch.matched) {
                totalConfidence += contentMatch.confidence * 0.4; // 40%の重み
                matchCount++;
                reasons.push(`内容パターン: ${contentMatch.pattern}`);
            }
        }
        // パスベースマッチング
        const pathMatch = this.matchPath(file.path, rule.patterns);
        if (pathMatch.matched) {
            totalConfidence += pathMatch.confidence * 0.2; // 20%の重み
            matchCount++;
            reasons.push(`パスパターン: ${pathMatch.pattern}`);
        }
        // サイズベースマッチング
        const sizeMatch = this.matchSize(file.size, category);
        if (sizeMatch.matched) {
            totalConfidence += sizeMatch.confidence * 0.1; // 10%の重み
            matchCount++;
            reasons.push(`サイズパターン: ${sizeMatch.pattern}`);
        }
        const matched = matchCount > 0;
        const confidence = matched ? Math.min(totalConfidence / matchCount, 1.0) : 0;
        return {
            matched,
            confidence,
            matchedPattern: reasons.join(', '),
            reason: reasons.join('; '),
            rule
        };
    }
    /**
     * パターンマッチング
     */
    matchPatterns(text, patterns) {
        for (const pattern of patterns) {
            const match = this.matchSinglePattern(text, pattern);
            if (match.matched) {
                return { matched: true, confidence: match.confidence, pattern };
            }
        }
        return { matched: false, confidence: 0, pattern: '' };
    }
    /**
     * 単一パターンマッチング
     */
    matchSinglePattern(text, pattern) {
        try {
            // グロブパターンを正規表現に変換
            const regexPattern = this.globToRegex(pattern);
            const regex = new RegExp(regexPattern, 'i');
            const matched = regex.test(text);
            if (!matched) {
                return { matched: false, confidence: 0 };
            }
            // マッチの品質を評価
            let confidence = 0.5; // ベース信頼度
            // 完全一致の場合は高い信頼度
            if (text.toLowerCase() === pattern.toLowerCase().replace(/\*/g, '')) {
                confidence = 1.0;
            }
            // 前方一致の場合
            else if (text.toLowerCase().startsWith(pattern.toLowerCase().replace(/\*/g, ''))) {
                confidence = 0.8;
            }
            // 後方一致の場合
            else if (text.toLowerCase().endsWith(pattern.toLowerCase().replace(/\*/g, ''))) {
                confidence = 0.7;
            }
            // 部分一致の場合
            else {
                confidence = 0.6;
            }
            return { matched: true, confidence };
        }
        catch (error) {
            console.warn(`パターンマッチングエラー: ${pattern}`, error);
            return { matched: false, confidence: 0 };
        }
    }
    /**
     * 拡張子マッチング
     */
    matchExtension(extension, patterns) {
        for (const pattern of patterns) {
            if (pattern.startsWith('*.') || pattern.startsWith('.')) {
                const patternExt = pattern.startsWith('*.') ? pattern.substring(1) : pattern;
                if (extension.toLowerCase() === patternExt.toLowerCase()) {
                    return { matched: true, confidence: 0.9, pattern };
                }
            }
        }
        return { matched: false, confidence: 0, pattern: '' };
    }
    /**
     * ファイル内容マッチング
     */
    matchContent(content, patterns, category) {
        const contentPatterns = this.getContentPatterns(category);
        for (const pattern of contentPatterns) {
            try {
                const regex = new RegExp(pattern, 'i');
                if (regex.test(content)) {
                    // マッチした内容の密度を計算
                    const matches = content.match(new RegExp(pattern, 'gi'));
                    const density = matches ? matches.length / content.length * 1000 : 0;
                    const confidence = Math.min(0.5 + density, 1.0);
                    return { matched: true, confidence, pattern };
                }
            }
            catch (error) {
                console.warn(`内容パターンマッチングエラー: ${pattern}`, error);
            }
        }
        return { matched: false, confidence: 0, pattern: '' };
    }
    /**
     * パスマッチング
     */
    matchPath(filePath, patterns) {
        const fileName = path.basename(filePath);
        const dirName = path.dirname(filePath);
        for (const pattern of patterns) {
            // ディレクトリ名でのマッチング
            if (dirName.toLowerCase().includes(pattern.toLowerCase().replace(/\*/g, ''))) {
                return { matched: true, confidence: 0.4, pattern };
            }
            // フルパスでのマッチング
            if (this.matchSinglePattern(filePath, pattern).matched) {
                return { matched: true, confidence: 0.3, pattern };
            }
        }
        return { matched: false, confidence: 0, pattern: '' };
    }
    /**
     * サイズベースマッチング
     */
    matchSize(size, category) {
        const sizeRules = {
            'temp': { min: 0, max: 1024 * 1024 }, // 1MB以下
            'scripts': { min: 100, max: 100 * 1024 }, // 100B-100KB
            'configs': { min: 10, max: 10 * 1024 }, // 10B-10KB
            'documents': { min: 100, max: 10 * 1024 * 1024 } // 100B-10MB
        };
        const rule = sizeRules[category];
        if (!rule) {
            return { matched: false, confidence: 0, pattern: '' };
        }
        if (size >= rule.min && size <= rule.max) {
            const confidence = 0.2; // サイズマッチングは低い重み
            return { matched: true, confidence, pattern: `size:${rule.min}-${rule.max}` };
        }
        return { matched: false, confidence: 0, pattern: '' };
    }
    /**
     * カテゴリ別内容パターンを取得
     */
    getContentPatterns(category) {
        const patterns = {
            'scripts': [
                '#!/bin/bash',
                '#!/bin/sh',
                'npm run',
                'yarn',
                'docker',
                'aws ',
                'cdk ',
                'function ',
                'export ',
                'chmod ',
                'mkdir '
            ],
            'configs': [
                '"name"\\s*:',
                '"version"\\s*:',
                '"scripts"\\s*:',
                '"dependencies"\\s*:',
                'module\\.exports',
                'export default',
                'compilerOptions',
                'extends'
            ],
            'documents': [
                '^#\\s+',
                '##\\s+',
                '###\\s+',
                '\\*\\*.*\\*\\*',
                '\\[.*\\]\\(.*\\)',
                'TODO',
                'FIXME',
                'NOTE'
            ],
            'tests': [
                'describe\\(',
                'it\\(',
                'test\\(',
                'expect\\(',
                'assert',
                'mock',
                'spy',
                'beforeEach',
                'afterEach'
            ]
        };
        return patterns[category] || [];
    }
    /**
     * グロブパターンを正規表現に変換
     */
    globToRegex(pattern) {
        return pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 特殊文字をエスケープ
            .replace(/\*/g, '.*') // * を .* に変換
            .replace(/\?/g, '.'); // ? を . に変換
    }
    /**
     * ルールを読み込み
     */
    loadRules(rules) {
        for (const [category, categoryRules] of Object.entries(rules)) {
            const ruleArray = [];
            for (const [name, rule] of Object.entries(categoryRules)) {
                ruleArray.push({
                    name,
                    enabled: true,
                    ...rule
                });
            }
            // 優先度でソート
            ruleArray.sort((a, b) => b.priority - a.priority);
            this.rules.set(category, ruleArray);
        }
    }
    /**
     * ルールを追加
     */
    addRule(category, rule) {
        if (!this.rules.has(category)) {
            this.rules.set(category, []);
        }
        const categoryRules = this.rules.get(category);
        categoryRules.push(rule);
        categoryRules.sort((a, b) => b.priority - a.priority);
    }
    /**
     * ルールを削除
     */
    removeRule(category, ruleName) {
        const categoryRules = this.rules.get(category);
        if (!categoryRules) {
            return false;
        }
        const index = categoryRules.findIndex(rule => rule.name === ruleName);
        if (index === -1) {
            return false;
        }
        categoryRules.splice(index, 1);
        return true;
    }
    /**
     * ルールを有効/無効化
     */
    toggleRule(category, ruleName, enabled) {
        const categoryRules = this.rules.get(category);
        if (!categoryRules) {
            return false;
        }
        const rule = categoryRules.find(r => r.name === ruleName);
        if (!rule) {
            return false;
        }
        rule.enabled = enabled;
        return true;
    }
    /**
     * 統計情報を取得
     */
    getStatistics() {
        let totalRules = 0;
        let enabledRules = 0;
        const categoryCounts = {};
        for (const [category, rules] of this.rules) {
            categoryCounts[category] = rules.length;
            totalRules += rules.length;
            enabledRules += rules.filter(rule => rule.enabled).length;
        }
        return {
            totalRules,
            enabledRules,
            categoryCounts
        };
    }
    /**
     * マッチング結果をテスト
     */
    testPattern(fileName, pattern) {
        try {
            const regexPattern = this.globToRegex(pattern);
            const regex = new RegExp(regexPattern, 'i');
            return regex.test(fileName);
        }
        catch (error) {
            console.warn(`パターンテストエラー: ${pattern}`, error);
            return false;
        }
    }
}
exports.PatternMatcher = PatternMatcher;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF0dGVybi1tYXRjaGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicGF0dGVybi1tYXRjaGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7R0FLRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCwyQ0FBNkI7QUF5QjdCOzs7OztHQUtHO0FBQ0gsTUFBYSxjQUFjO0lBQ1IsS0FBSyxDQUFvQztJQUN6QyxzQkFBc0IsQ0FBVTtJQUVqRCxZQUNFLEtBQXlELEVBQ3pELHlCQUFrQyxJQUFJO1FBRXRDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUN2QixJQUFJLENBQUMsc0JBQXNCLEdBQUcsc0JBQXNCLENBQUM7UUFDckQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN4QixDQUFDO0lBRUQ7O09BRUc7SUFDSSxhQUFhLENBQUMsSUFBYztRQUNqQyxNQUFNLFVBQVUsR0FBa0IsRUFBRSxDQUFDO1FBRXJDLGNBQWM7UUFDZCxLQUFLLE1BQU0sQ0FBQyxRQUFRLEVBQUUsYUFBYSxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ25ELEtBQUssTUFBTSxJQUFJLElBQUksYUFBYSxFQUFFLENBQUM7Z0JBQ2pDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTztvQkFBRSxTQUFTO2dCQUU1QixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7Z0JBQ3RELElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO29CQUNsQixVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUN6QixDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUM7UUFFRCxJQUFJLFVBQVUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDNUIsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBRUQs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QUFJLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDO1FBQzVELENBQUM7UUFFRCxPQUFPO1lBQ0wsVUFBVTtZQUNWLFlBQVk7WUFDWixjQUFjO1NBQ2YsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNJLFdBQVcsQ0FBQyxRQUFnQixFQUFFLE9BQWU7UUFDbEQsSUFBSSxDQUFDO1lBQ0gsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUMvQyxNQUFNLEtBQUssR0FBRyxJQUFJLE1BQU0sQ0FBQyxZQUFZLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDNUMsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzlCLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsT0FBTyxDQUFDLElBQUksQ0FBQyxlQUFlLE9BQU8sRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzlDLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztJQUNILENBQUM7Q0FDRjtBQS9jRCx3Q0ErY0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOe1seWQiOODleOCoeOCpOODq+aVtOeQhuOCt+OCueODhuODoCAtIOODkeOCv+ODvOODs+ODnuODg+ODgeODs+OCsOOCqOODs+OCuOODs1xuICogXG4gKiDjg5XjgqHjgqTjg6vlkI3jg5Hjgr/jg7zjg7Pjgajjg5XjgqHjgqTjg6vlhoXlrrnjga7op6PmnpDjgavjgojjgorjgIFcbiAqIOmBqeWIh+OBquWIhumhnuOCkuihjOOBhuOBn+OCgeOBruODnuODg+ODgeODs+OCsOOCqOODs+OCuOODs+OCkuaPkOS+m+OBl+OBvuOBmeOAglxuICovXG5cbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBcbiAgRmlsZUluZm8sIFxuICBGaWxlVHlwZSwgXG4gIENsYXNzaWZpY2F0aW9uUnVsZSxcbiAgT3JnYW5pemF0aW9uRXJyb3IsXG4gIE9yZ2FuaXphdGlvbkVycm9yVHlwZVxufSBmcm9tICcuLi90eXBlcy9pbmRleC5qcyc7XG5cbi8qKlxuICog44OR44K/44O844Oz44Oe44OD44OB44Oz44Kw57WQ5p6cXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgTWF0Y2hSZXN1bHQge1xuICAvKiog44Oe44OD44OB44GX44Gf44GL44Gp44GG44GLICovXG4gIG1hdGNoZWQ6IGJvb2xlYW47XG4gIC8qKiDjg57jg4Pjg4HjgZfjgZ/kv6HpoLzluqbvvIgwLTHvvIkgKi9cbiAgY29uZmlkZW5jZTogbnVtYmVyO1xuICAvKiog44Oe44OD44OB44GX44Gf44OR44K/44O844OzICovXG4gIG1hdGNoZWRQYXR0ZXJuOiBzdHJpbmc7XG4gIC8qKiDjg57jg4Pjg4HjgZfjgZ/nkIbnlLEgKi9cbiAgcmVhc29uOiBzdHJpbmc7XG4gIC8qKiDpgannlKjjgZXjgozjgZ/jg6vjg7zjg6sgKi9cbiAgcnVsZTogQ2xhc3NpZmljYXRpb25SdWxlO1xufVxuXG4vKipcbiAqIOODkeOCv+ODvOODs+ODnuODg+ODgeODs+OCsOOCqOODs+OCuOODs1xuICogXG4gKiDjg5XjgqHjgqTjg6vlkI3jgIHmi6HlvLXlrZDjgIHlhoXlrrnjgavln7rjgaXjgYTjgabjg5XjgqHjgqTjg6vjgpLliIbpoZ7jgZnjgovjgZ/jgoHjga5cbiAqIOmrmOW6puOBquODkeOCv+ODvOODs+ODnuODg+ODgeODs+OCsOapn+iDveOCkuaPkOS+m+OBl+OBvuOBmeOAglxuICovXG5leHBvcnQgY2xhc3MgUGF0dGVybk1hdGNoZXIge1xuICBwcml2YXRlIHJlYWRvbmx5IHJ1bGVzOiBNYXA8c3RyaW5nLCBDbGFzc2lmaWNhdGlvblJ1bGVbXT47XG4gIHByaXZhdGUgcmVhZG9ubHkgY29udGVudEFuYWx5c2lzRW5hYmxlZDogYm9vbGVhbjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBydWxlczogUmVjb3JkPHN0cmluZywgUmVjb3JkPHN0cmluZywgQ2xhc3NpZmljYXRpb25SdWxlPj4sXG4gICAgY29udGVudEFuYWx5c2lzRW5hYmxlZDogYm9vbGVhbiA9IHRydWVcbiAgKSB7XG4gICAgdGhpcy5ydWxlcyA9IG5ldyBNYXAoKTtcbiAgICB0aGlzLmNvbnRlbnRBbmFseXNpc0VuYWJsZWQgPSBjb250ZW50QW5hbHlzaXNFbmFibGVkO1xuICAgIHRoaXMubG9hZFJ1bGVzKHJ1bGVzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg5XjgqHjgqTjg6vjgavmnIDpganjgarjg6vjg7zjg6vjgpLopovjgaTjgZHjgotcbiAgICovXG4gIHB1YmxpYyBmaW5kQmVzdE1hdGNoKGZpbGU6IEZpbGVJbmZvKTogTWF0Y2hSZXN1bHQgfCBudWxsIHtcbiAgICBjb25zdCBhbGxNYXRjaGVzOiBNYXRjaFJlc3VsdFtdID0gW107XG5cbiAgICAvLyDlhajjg6vjg7zjg6vjgqvjg4bjgrTjg6rjgpLmpJzmn7tcbiAgICBmb3IgKGNvbnN0IFtjYXRlZ29yeSwgY2F0ZWdvcnlSdWxlc10gb2YgdGhpcy5ydWxlcykge1xuICAgICAgZm9yIChjb25zdCBydWxlIG9mIGNhdGVnb3J5UnVsZXMpIHtcbiAgICAgICAgaWYgKCFydWxlLmVuYWJsZWQpIGNvbnRpbnVlO1xuXG4gICAgICAgIGNvbnN0IG1hdGNoID0gdGhpcy5ldmFsdWF0ZVJ1bGUoZmlsZSwgcnVsZSwgY2F0ZWdvcnkpO1xuICAgICAgICBpZiAobWF0Y2gubWF0Y2hlZCkge1xuICAgICAgICAgIGFsbE1hdGNoZXMucHVzaChtYXRjaCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoYWxsTWF0Y2hlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIOS/oemgvOW6puOBqOWEquWFiOW6puOBp+OCveODvOODiFxuICAgIGFsbE1hdGNoZXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgY29uc3QgcHJpb3JpdHlEaWZmID0gYi5ydWxlLnByaW9yaXR5IC0gYS5ydWxlLnByaW9yaXR5O1xuICAgICAgaWYgKHByaW9yaXR5RGlmZiAhPT0gMCkgcmV0dXJuIHByaW9yaXR5RGlmZjtcbiAgICAgIHJldHVybiBiLmNvbmZpZGVuY2UgLSBhLmNvbmZpZGVuY2U7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gYWxsTWF0Y2hlc1swXTtcbiAgfVxuXG4gIC8qKlxuICAgKiDopIfmlbDjga7jg57jg4Pjg4HlgJnoo5zjgpLlj5blvpdcbiAgICovXG4gIHB1YmxpYyBmaW5kQWxsTWF0Y2hlcyhmaWxlOiBGaWxlSW5mbywgbWluQ29uZmlkZW5jZTogbnVtYmVyID0gMC4zKTogTWF0Y2hSZXN1bHRbXSB7XG4gICAgY29uc3QgbWF0Y2hlczogTWF0Y2hSZXN1bHRbXSA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBbY2F0ZWdvcnksIGNhdGVnb3J5UnVsZXNdIG9mIHRoaXMucnVsZXMpIHtcbiAgICAgIGZvciAoY29uc3QgcnVsZSBvZiBjYXRlZ29yeVJ1bGVzKSB7XG4gICAgICAgIGlmICghcnVsZS5lbmFibGVkKSBjb250aW51ZTtcblxuICAgICAgICBjb25zdCBtYXRjaCA9IHRoaXMuZXZhbHVhdGVSdWxlKGZpbGUsIHJ1bGUsIGNhdGVnb3J5KTtcbiAgICAgICAgaWYgKG1hdGNoLm1hdGNoZWQgJiYgbWF0Y2guY29uZmlkZW5jZSA+PSBtaW5Db25maWRlbmNlKSB7XG4gICAgICAgICAgbWF0Y2hlcy5wdXNoKG1hdGNoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBtYXRjaGVzLnNvcnQoKGEsIGIpID0+IGIuY29uZmlkZW5jZSAtIGEuY29uZmlkZW5jZSk7XG4gIH1cblxuICAvKipcbiAgICog54m55a6a44Gu44Kr44OG44K044Oq44Gn44Oe44OD44OB44Oz44Kw44KS5a6f6KGMXG4gICAqL1xuICBwdWJsaWMgbWF0Y2hDYXRlZ29yeShmaWxlOiBGaWxlSW5mbywgY2F0ZWdvcnk6IHN0cmluZyk6IE1hdGNoUmVzdWx0IHwgbnVsbCB7XG4gICAgY29uc3QgY2F0ZWdvcnlSdWxlcyA9IHRoaXMucnVsZXMuZ2V0KGNhdGVnb3J5KTtcbiAgICBpZiAoIWNhdGVnb3J5UnVsZXMpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGxldCBiZXN0TWF0Y2g6IE1hdGNoUmVzdWx0IHwgbnVsbCA9IG51bGw7XG5cbiAgICBmb3IgKGNvbnN0IHJ1bGUgb2YgY2F0ZWdvcnlSdWxlcykge1xuICAgICAgaWYgKCFydWxlLmVuYWJsZWQpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBtYXRjaCA9IHRoaXMuZXZhbHVhdGVSdWxlKGZpbGUsIHJ1bGUsIGNhdGVnb3J5KTtcbiAgICAgIGlmIChtYXRjaC5tYXRjaGVkICYmICghYmVzdE1hdGNoIHx8IG1hdGNoLmNvbmZpZGVuY2UgPiBiZXN0TWF0Y2guY29uZmlkZW5jZSkpIHtcbiAgICAgICAgYmVzdE1hdGNoID0gbWF0Y2g7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGJlc3RNYXRjaDtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg6vjg7zjg6vjgpLoqZXkvqFcbiAgICovXG4gIHByaXZhdGUgZXZhbHVhdGVSdWxlKGZpbGU6IEZpbGVJbmZvLCBydWxlOiBDbGFzc2lmaWNhdGlvblJ1bGUsIGNhdGVnb3J5OiBzdHJpbmcpOiBNYXRjaFJlc3VsdCB7XG4gICAgY29uc3QgcmVhc29uczogc3RyaW5nW10gPSBbXTtcbiAgICBsZXQgdG90YWxDb25maWRlbmNlID0gMDtcbiAgICBsZXQgbWF0Y2hDb3VudCA9IDA7XG5cbiAgICAvLyDjg5XjgqHjgqTjg6vlkI3jg5Hjgr/jg7zjg7Pjg57jg4Pjg4Hjg7PjgrBcbiAgICBjb25zdCBuYW1lTWF0Y2ggPSB0aGlzLm1hdGNoUGF0dGVybnMoZmlsZS5uYW1lLCBydWxlLnBhdHRlcm5zKTtcbiAgICBpZiAobmFtZU1hdGNoLm1hdGNoZWQpIHtcbiAgICAgIHRvdGFsQ29uZmlkZW5jZSArPSBuYW1lTWF0Y2guY29uZmlkZW5jZSAqIDAuNjsgLy8gNjAl44Gu6YeN44G/XG4gICAgICBtYXRjaENvdW50Kys7XG4gICAgICByZWFzb25zLnB1c2goYOODleOCoeOCpOODq+WQjeODkeOCv+ODvOODszogJHtuYW1lTWF0Y2gucGF0dGVybn1gKTtcbiAgICB9XG5cbiAgICAvLyDmi6HlvLXlrZDjg57jg4Pjg4Hjg7PjgrBcbiAgICBjb25zdCBleHRlbnNpb25NYXRjaCA9IHRoaXMubWF0Y2hFeHRlbnNpb24oZmlsZS5leHRlbnNpb24sIHJ1bGUucGF0dGVybnMpO1xuICAgIGlmIChleHRlbnNpb25NYXRjaC5tYXRjaGVkKSB7XG4gICAgICB0b3RhbENvbmZpZGVuY2UgKz0gZXh0ZW5zaW9uTWF0Y2guY29uZmlkZW5jZSAqIDAuMzsgLy8gMzAl44Gu6YeN44G/XG4gICAgICBtYXRjaENvdW50Kys7XG4gICAgICByZWFzb25zLnB1c2goYOaLoeW8teWtkOODkeOCv+ODvOODszogJHtleHRlbnNpb25NYXRjaC5wYXR0ZXJufWApO1xuICAgIH1cblxuICAgIC8vIOODleOCoeOCpOODq+WGheWuueODnuODg+ODgeODs+OCsO+8iOacieWKueOBquWgtOWQiO+8iVxuICAgIGlmICh0aGlzLmNvbnRlbnRBbmFseXNpc0VuYWJsZWQgJiYgZmlsZS5jb250ZW50KSB7XG4gICAgICBjb25zdCBjb250ZW50TWF0Y2ggPSB0aGlzLm1hdGNoQ29udGVudChmaWxlLmNvbnRlbnQsIHJ1bGUucGF0dGVybnMsIGNhdGVnb3J5KTtcbiAgICAgIGlmIChjb250ZW50TWF0Y2gubWF0Y2hlZCkge1xuICAgICAgICB0b3RhbENvbmZpZGVuY2UgKz0gY29udGVudE1hdGNoLmNvbmZpZGVuY2UgKiAwLjQ7IC8vIDQwJeOBrumHjeOBv1xuICAgICAgICBtYXRjaENvdW50Kys7XG4gICAgICAgIHJlYXNvbnMucHVzaChg5YaF5a6544OR44K/44O844OzOiAke2NvbnRlbnRNYXRjaC5wYXR0ZXJufWApO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIOODkeOCueODmeODvOOCueODnuODg+ODgeODs+OCsFxuICAgIGNvbnN0IHBhdGhNYXRjaCA9IHRoaXMubWF0Y2hQYXRoKGZpbGUucGF0aCwgcnVsZS5wYXR0ZXJucyk7XG4gICAgaWYgKHBhdGhNYXRjaC5tYXRjaGVkKSB7XG4gICAgICB0b3RhbENvbmZpZGVuY2UgKz0gcGF0aE1hdGNoLmNvbmZpZGVuY2UgKiAwLjI7IC8vIDIwJeOBrumHjeOBv1xuICAgICAgbWF0Y2hDb3VudCsrO1xuICAgICAgcmVhc29ucy5wdXNoKGDjg5Hjgrnjg5Hjgr/jg7zjg7M6ICR7cGF0aE1hdGNoLnBhdHRlcm59YCk7XG4gICAgfVxuXG4gICAgLy8g44K144Kk44K644OZ44O844K544Oe44OD44OB44Oz44KwXG4gICAgY29uc3Qgc2l6ZU1hdGNoID0gdGhpcy5tYXRjaFNpemUoZmlsZS5zaXplLCBjYXRlZ29yeSk7XG4gICAgaWYgKHNpemVNYXRjaC5tYXRjaGVkKSB7XG4gICAgICB0b3RhbENvbmZpZGVuY2UgKz0gc2l6ZU1hdGNoLmNvbmZpZGVuY2UgKiAwLjE7IC8vIDEwJeOBrumHjeOBv1xuICAgICAgbWF0Y2hDb3VudCsrO1xuICAgICAgcmVhc29ucy5wdXNoKGDjgrXjgqTjgrrjg5Hjgr/jg7zjg7M6ICR7c2l6ZU1hdGNoLnBhdHRlcm59YCk7XG4gICAgfVxuXG4gICAgY29uc3QgbWF0Y2hlZCA9IG1hdGNoQ291bnQgPiAwO1xuICAgIGNvbnN0IGNvbmZpZGVuY2UgPSBtYXRjaGVkID8gTWF0aC5taW4odG90YWxDb25maWRlbmNlIC8gbWF0Y2hDb3VudCwgMS4wKSA6IDA7XG5cbiAgICByZXR1cm4ge1xuICAgICAgbWF0Y2hlZCxcbiAgICAgIGNvbmZpZGVuY2UsXG4gICAgICBtYXRjaGVkUGF0dGVybjogcmVhc29ucy5qb2luKCcsICcpLFxuICAgICAgcmVhc29uOiByZWFzb25zLmpvaW4oJzsgJyksXG4gICAgICBydWxlXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg5Hjgr/jg7zjg7Pjg57jg4Pjg4Hjg7PjgrBcbiAgICovXG4gIHByaXZhdGUgbWF0Y2hQYXR0ZXJucyh0ZXh0OiBzdHJpbmcsIHBhdHRlcm5zOiBzdHJpbmdbXSk6IHsgbWF0Y2hlZDogYm9vbGVhbjsgY29uZmlkZW5jZTogbnVtYmVyOyBwYXR0ZXJuOiBzdHJpbmcgfSB7XG4gICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIHBhdHRlcm5zKSB7XG4gICAgICBjb25zdCBtYXRjaCA9IHRoaXMubWF0Y2hTaW5nbGVQYXR0ZXJuKHRleHQsIHBhdHRlcm4pO1xuICAgICAgaWYgKG1hdGNoLm1hdGNoZWQpIHtcbiAgICAgICAgcmV0dXJuIHsgbWF0Y2hlZDogdHJ1ZSwgY29uZmlkZW5jZTogbWF0Y2guY29uZmlkZW5jZSwgcGF0dGVybiB9O1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4geyBtYXRjaGVkOiBmYWxzZSwgY29uZmlkZW5jZTogMCwgcGF0dGVybjogJycgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDljZjkuIDjg5Hjgr/jg7zjg7Pjg57jg4Pjg4Hjg7PjgrBcbiAgICovXG4gIHByaXZhdGUgbWF0Y2hTaW5nbGVQYXR0ZXJuKHRleHQ6IHN0cmluZywgcGF0dGVybjogc3RyaW5nKTogeyBtYXRjaGVkOiBib29sZWFuOyBjb25maWRlbmNlOiBudW1iZXIgfSB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIOOCsOODreODluODkeOCv+ODvOODs+OCkuato+imj+ihqOePvuOBq+WkieaPm1xuICAgICAgY29uc3QgcmVnZXhQYXR0ZXJuID0gdGhpcy5nbG9iVG9SZWdleChwYXR0ZXJuKTtcbiAgICAgIGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cChyZWdleFBhdHRlcm4sICdpJyk7XG4gICAgICBcbiAgICAgIGNvbnN0IG1hdGNoZWQgPSByZWdleC50ZXN0KHRleHQpO1xuICAgICAgXG4gICAgICBpZiAoIW1hdGNoZWQpIHtcbiAgICAgICAgcmV0dXJuIHsgbWF0Y2hlZDogZmFsc2UsIGNvbmZpZGVuY2U6IDAgfTtcbiAgICAgIH1cblxuICAgICAgLy8g44Oe44OD44OB44Gu5ZOB6LOq44KS6KmV5L6hXG4gICAgICBsZXQgY29uZmlkZW5jZSA9IDAuNTsgLy8g44OZ44O844K55L+h6aC85bqmXG5cbiAgICAgIC8vIOWujOWFqOS4gOiHtOOBruWgtOWQiOOBr+mrmOOBhOS/oemgvOW6plxuICAgICAgaWYgKHRleHQudG9Mb3dlckNhc2UoKSA9PT0gcGF0dGVybi50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1xcKi9nLCAnJykpIHtcbiAgICAgICAgY29uZmlkZW5jZSA9IDEuMDtcbiAgICAgIH1cbiAgICAgIC8vIOWJjeaWueS4gOiHtOOBruWgtOWQiFxuICAgICAgZWxzZSBpZiAodGV4dC50b0xvd2VyQ2FzZSgpLnN0YXJ0c1dpdGgocGF0dGVybi50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1xcKi9nLCAnJykpKSB7XG4gICAgICAgIGNvbmZpZGVuY2UgPSAwLjg7XG4gICAgICB9XG4gICAgICAvLyDlvozmlrnkuIDoh7Tjga7loLTlkIhcbiAgICAgIGVsc2UgaWYgKHRleHQudG9Mb3dlckNhc2UoKS5lbmRzV2l0aChwYXR0ZXJuLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvXFwqL2csICcnKSkpIHtcbiAgICAgICAgY29uZmlkZW5jZSA9IDAuNztcbiAgICAgIH1cbiAgICAgIC8vIOmDqOWIhuS4gOiHtOOBruWgtOWQiFxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbmZpZGVuY2UgPSAwLjY7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7IG1hdGNoZWQ6IHRydWUsIGNvbmZpZGVuY2UgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS53YXJuKGDjg5Hjgr/jg7zjg7Pjg57jg4Pjg4Hjg7PjgrDjgqjjg6njg7w6ICR7cGF0dGVybn1gLCBlcnJvcik7XG4gICAgICByZXR1cm4geyBtYXRjaGVkOiBmYWxzZSwgY29uZmlkZW5jZTogMCB9O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDmi6HlvLXlrZDjg57jg4Pjg4Hjg7PjgrBcbiAgICovXG4gIHByaXZhdGUgbWF0Y2hFeHRlbnNpb24oZXh0ZW5zaW9uOiBzdHJpbmcsIHBhdHRlcm5zOiBzdHJpbmdbXSk6IHsgbWF0Y2hlZDogYm9vbGVhbjsgY29uZmlkZW5jZTogbnVtYmVyOyBwYXR0ZXJuOiBzdHJpbmcgfSB7XG4gICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIHBhdHRlcm5zKSB7XG4gICAgICBpZiAocGF0dGVybi5zdGFydHNXaXRoKCcqLicpIHx8IHBhdHRlcm4uc3RhcnRzV2l0aCgnLicpKSB7XG4gICAgICAgIGNvbnN0IHBhdHRlcm5FeHQgPSBwYXR0ZXJuLnN0YXJ0c1dpdGgoJyouJykgPyBwYXR0ZXJuLnN1YnN0cmluZygxKSA6IHBhdHRlcm47XG4gICAgICAgIGlmIChleHRlbnNpb24udG9Mb3dlckNhc2UoKSA9PT0gcGF0dGVybkV4dC50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICAgICAgcmV0dXJuIHsgbWF0Y2hlZDogdHJ1ZSwgY29uZmlkZW5jZTogMC45LCBwYXR0ZXJuIH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHsgbWF0Y2hlZDogZmFsc2UsIGNvbmZpZGVuY2U6IDAsIHBhdHRlcm46ICcnIH07XG4gIH1cblxuICAvKipcbiAgICog44OV44Kh44Kk44Or5YaF5a6544Oe44OD44OB44Oz44KwXG4gICAqL1xuICBwcml2YXRlIG1hdGNoQ29udGVudChjb250ZW50OiBzdHJpbmcsIHBhdHRlcm5zOiBzdHJpbmdbXSwgY2F0ZWdvcnk6IHN0cmluZyk6IHsgbWF0Y2hlZDogYm9vbGVhbjsgY29uZmlkZW5jZTogbnVtYmVyOyBwYXR0ZXJuOiBzdHJpbmcgfSB7XG4gICAgY29uc3QgY29udGVudFBhdHRlcm5zID0gdGhpcy5nZXRDb250ZW50UGF0dGVybnMoY2F0ZWdvcnkpO1xuICAgIFxuICAgIGZvciAoY29uc3QgcGF0dGVybiBvZiBjb250ZW50UGF0dGVybnMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cChwYXR0ZXJuLCAnaScpO1xuICAgICAgICBpZiAocmVnZXgudGVzdChjb250ZW50KSkge1xuICAgICAgICAgIC8vIOODnuODg+ODgeOBl+OBn+WGheWuueOBruWvhuW6puOCkuioiOeul1xuICAgICAgICAgIGNvbnN0IG1hdGNoZXMgPSBjb250ZW50Lm1hdGNoKG5ldyBSZWdFeHAocGF0dGVybiwgJ2dpJykpO1xuICAgICAgICAgIGNvbnN0IGRlbnNpdHkgPSBtYXRjaGVzID8gbWF0Y2hlcy5sZW5ndGggLyBjb250ZW50Lmxlbmd0aCAqIDEwMDAgOiAwO1xuICAgICAgICAgIGNvbnN0IGNvbmZpZGVuY2UgPSBNYXRoLm1pbigwLjUgKyBkZW5zaXR5LCAxLjApO1xuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiB7IG1hdGNoZWQ6IHRydWUsIGNvbmZpZGVuY2UsIHBhdHRlcm4gfTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS53YXJuKGDlhoXlrrnjg5Hjgr/jg7zjg7Pjg57jg4Pjg4Hjg7PjgrDjgqjjg6njg7w6ICR7cGF0dGVybn1gLCBlcnJvcik7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7IG1hdGNoZWQ6IGZhbHNlLCBjb25maWRlbmNlOiAwLCBwYXR0ZXJuOiAnJyB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOODkeOCueODnuODg+ODgeODs+OCsFxuICAgKi9cbiAgcHJpdmF0ZSBtYXRjaFBhdGgoZmlsZVBhdGg6IHN0cmluZywgcGF0dGVybnM6IHN0cmluZ1tdKTogeyBtYXRjaGVkOiBib29sZWFuOyBjb25maWRlbmNlOiBudW1iZXI7IHBhdHRlcm46IHN0cmluZyB9IHtcbiAgICBjb25zdCBmaWxlTmFtZSA9IHBhdGguYmFzZW5hbWUoZmlsZVBhdGgpO1xuICAgIGNvbnN0IGRpck5hbWUgPSBwYXRoLmRpcm5hbWUoZmlsZVBhdGgpO1xuICAgIFxuICAgIGZvciAoY29uc3QgcGF0dGVybiBvZiBwYXR0ZXJucykge1xuICAgICAgLy8g44OH44Kj44Os44Kv44OI44Oq5ZCN44Gn44Gu44Oe44OD44OB44Oz44KwXG4gICAgICBpZiAoZGlyTmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHBhdHRlcm4udG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9cXCovZywgJycpKSkge1xuICAgICAgICByZXR1cm4geyBtYXRjaGVkOiB0cnVlLCBjb25maWRlbmNlOiAwLjQsIHBhdHRlcm4gfTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g44OV44Or44OR44K544Gn44Gu44Oe44OD44OB44Oz44KwXG4gICAgICBpZiAodGhpcy5tYXRjaFNpbmdsZVBhdHRlcm4oZmlsZVBhdGgsIHBhdHRlcm4pLm1hdGNoZWQpIHtcbiAgICAgICAgcmV0dXJuIHsgbWF0Y2hlZDogdHJ1ZSwgY29uZmlkZW5jZTogMC4zLCBwYXR0ZXJuIH07XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7IG1hdGNoZWQ6IGZhbHNlLCBjb25maWRlbmNlOiAwLCBwYXR0ZXJuOiAnJyB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOOCteOCpOOCuuODmeODvOOCueODnuODg+ODgeODs+OCsFxuICAgKi9cbiAgcHJpdmF0ZSBtYXRjaFNpemUoc2l6ZTogbnVtYmVyLCBjYXRlZ29yeTogc3RyaW5nKTogeyBtYXRjaGVkOiBib29sZWFuOyBjb25maWRlbmNlOiBudW1iZXI7IHBhdHRlcm46IHN0cmluZyB9IHtcbiAgICBjb25zdCBzaXplUnVsZXMgPSB7XG4gICAgICAndGVtcCc6IHsgbWluOiAwLCBtYXg6IDEwMjQgKiAxMDI0IH0sIC8vIDFNQuS7peS4i1xuICAgICAgJ3NjcmlwdHMnOiB7IG1pbjogMTAwLCBtYXg6IDEwMCAqIDEwMjQgfSwgLy8gMTAwQi0xMDBLQlxuICAgICAgJ2NvbmZpZ3MnOiB7IG1pbjogMTAsIG1heDogMTAgKiAxMDI0IH0sIC8vIDEwQi0xMEtCXG4gICAgICAnZG9jdW1lbnRzJzogeyBtaW46IDEwMCwgbWF4OiAxMCAqIDEwMjQgKiAxMDI0IH0gLy8gMTAwQi0xME1CXG4gICAgfTtcblxuICAgIGNvbnN0IHJ1bGUgPSBzaXplUnVsZXNbY2F0ZWdvcnkgYXMga2V5b2YgdHlwZW9mIHNpemVSdWxlc107XG4gICAgaWYgKCFydWxlKSB7XG4gICAgICByZXR1cm4geyBtYXRjaGVkOiBmYWxzZSwgY29uZmlkZW5jZTogMCwgcGF0dGVybjogJycgfTtcbiAgICB9XG5cbiAgICBpZiAoc2l6ZSA+PSBydWxlLm1pbiAmJiBzaXplIDw9IHJ1bGUubWF4KSB7XG4gICAgICBjb25zdCBjb25maWRlbmNlID0gMC4yOyAvLyDjgrXjgqTjgrrjg57jg4Pjg4Hjg7PjgrDjga/kvY7jgYTph43jgb9cbiAgICAgIHJldHVybiB7IG1hdGNoZWQ6IHRydWUsIGNvbmZpZGVuY2UsIHBhdHRlcm46IGBzaXplOiR7cnVsZS5taW59LSR7cnVsZS5tYXh9YCB9O1xuICAgIH1cblxuICAgIHJldHVybiB7IG1hdGNoZWQ6IGZhbHNlLCBjb25maWRlbmNlOiAwLCBwYXR0ZXJuOiAnJyB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOOCq+ODhuOCtOODquWIpeWGheWuueODkeOCv+ODvOODs+OCkuWPluW+l1xuICAgKi9cbiAgcHJpdmF0ZSBnZXRDb250ZW50UGF0dGVybnMoY2F0ZWdvcnk6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCBwYXR0ZXJuczogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge1xuICAgICAgJ3NjcmlwdHMnOiBbXG4gICAgICAgICcjIS9iaW4vYmFzaCcsXG4gICAgICAgICcjIS9iaW4vc2gnLFxuICAgICAgICAnbnBtIHJ1bicsXG4gICAgICAgICd5YXJuJyxcbiAgICAgICAgJ2RvY2tlcicsXG4gICAgICAgICdhd3MgJyxcbiAgICAgICAgJ2NkayAnLFxuICAgICAgICAnZnVuY3Rpb24gJyxcbiAgICAgICAgJ2V4cG9ydCAnLFxuICAgICAgICAnY2htb2QgJyxcbiAgICAgICAgJ21rZGlyICdcbiAgICAgIF0sXG4gICAgICAnY29uZmlncyc6IFtcbiAgICAgICAgJ1wibmFtZVwiXFxcXHMqOicsXG4gICAgICAgICdcInZlcnNpb25cIlxcXFxzKjonLFxuICAgICAgICAnXCJzY3JpcHRzXCJcXFxccyo6JyxcbiAgICAgICAgJ1wiZGVwZW5kZW5jaWVzXCJcXFxccyo6JyxcbiAgICAgICAgJ21vZHVsZVxcXFwuZXhwb3J0cycsXG4gICAgICAgICdleHBvcnQgZGVmYXVsdCcsXG4gICAgICAgICdjb21waWxlck9wdGlvbnMnLFxuICAgICAgICAnZXh0ZW5kcydcbiAgICAgIF0sXG4gICAgICAnZG9jdW1lbnRzJzogW1xuICAgICAgICAnXiNcXFxccysnLFxuICAgICAgICAnIyNcXFxccysnLFxuICAgICAgICAnIyMjXFxcXHMrJyxcbiAgICAgICAgJ1xcXFwqXFxcXCouKlxcXFwqXFxcXConLFxuICAgICAgICAnXFxcXFsuKlxcXFxdXFxcXCguKlxcXFwpJyxcbiAgICAgICAgJ1RPRE8nLFxuICAgICAgICAnRklYTUUnLFxuICAgICAgICAnTk9URSdcbiAgICAgIF0sXG4gICAgICAndGVzdHMnOiBbXG4gICAgICAgICdkZXNjcmliZVxcXFwoJyxcbiAgICAgICAgJ2l0XFxcXCgnLFxuICAgICAgICAndGVzdFxcXFwoJyxcbiAgICAgICAgJ2V4cGVjdFxcXFwoJyxcbiAgICAgICAgJ2Fzc2VydCcsXG4gICAgICAgICdtb2NrJyxcbiAgICAgICAgJ3NweScsXG4gICAgICAgICdiZWZvcmVFYWNoJyxcbiAgICAgICAgJ2FmdGVyRWFjaCdcbiAgICAgIF1cbiAgICB9O1xuXG4gICAgcmV0dXJuIHBhdHRlcm5zW2NhdGVnb3J5XSB8fCBbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrDjg63jg5bjg5Hjgr/jg7zjg7PjgpLmraPopo/ooajnj77jgavlpInmj5tcbiAgICovXG4gIHByaXZhdGUgZ2xvYlRvUmVnZXgocGF0dGVybjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gcGF0dGVyblxuICAgICAgLnJlcGxhY2UoL1suK14ke30oKXxbXFxdXFxcXF0vZywgJ1xcXFwkJicpIC8vIOeJueauiuaWh+Wtl+OCkuOCqOOCueOCseODvOODl1xuICAgICAgLnJlcGxhY2UoL1xcKi9nLCAnLionKSAvLyAqIOOCkiAuKiDjgavlpInmj5tcbiAgICAgIC5yZXBsYWNlKC9cXD8vZywgJy4nKTsgLy8gPyDjgpIgLiDjgavlpInmj5tcbiAgfVxuXG4gIC8qKlxuICAgKiDjg6vjg7zjg6vjgpLoqq3jgb/ovrzjgb9cbiAgICovXG4gIHByaXZhdGUgbG9hZFJ1bGVzKHJ1bGVzOiBSZWNvcmQ8c3RyaW5nLCBSZWNvcmQ8c3RyaW5nLCBDbGFzc2lmaWNhdGlvblJ1bGU+Pik6IHZvaWQge1xuICAgIGZvciAoY29uc3QgW2NhdGVnb3J5LCBjYXRlZ29yeVJ1bGVzXSBvZiBPYmplY3QuZW50cmllcyhydWxlcykpIHtcbiAgICAgIGNvbnN0IHJ1bGVBcnJheTogQ2xhc3NpZmljYXRpb25SdWxlW10gPSBbXTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBbbmFtZSwgcnVsZV0gb2YgT2JqZWN0LmVudHJpZXMoY2F0ZWdvcnlSdWxlcykpIHtcbiAgICAgICAgcnVsZUFycmF5LnB1c2goe1xuICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAuLi5ydWxlXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDlhKrlhYjluqbjgafjgr3jg7zjg4hcbiAgICAgIHJ1bGVBcnJheS5zb3J0KChhLCBiKSA9PiBiLnByaW9yaXR5IC0gYS5wcmlvcml0eSk7XG4gICAgICB0aGlzLnJ1bGVzLnNldChjYXRlZ29yeSwgcnVsZUFycmF5KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44Or44O844Or44KS6L+95YqgXG4gICAqL1xuICBwdWJsaWMgYWRkUnVsZShjYXRlZ29yeTogc3RyaW5nLCBydWxlOiBDbGFzc2lmaWNhdGlvblJ1bGUpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMucnVsZXMuaGFzKGNhdGVnb3J5KSkge1xuICAgICAgdGhpcy5ydWxlcy5zZXQoY2F0ZWdvcnksIFtdKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgY2F0ZWdvcnlSdWxlcyA9IHRoaXMucnVsZXMuZ2V0KGNhdGVnb3J5KSE7XG4gICAgY2F0ZWdvcnlSdWxlcy5wdXNoKHJ1bGUpO1xuICAgIGNhdGVnb3J5UnVsZXMuc29ydCgoYSwgYikgPT4gYi5wcmlvcml0eSAtIGEucHJpb3JpdHkpO1xuICB9XG5cbiAgLyoqXG4gICAqIOODq+ODvOODq+OCkuWJiumZpFxuICAgKi9cbiAgcHVibGljIHJlbW92ZVJ1bGUoY2F0ZWdvcnk6IHN0cmluZywgcnVsZU5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGNhdGVnb3J5UnVsZXMgPSB0aGlzLnJ1bGVzLmdldChjYXRlZ29yeSk7XG4gICAgaWYgKCFjYXRlZ29yeVJ1bGVzKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGluZGV4ID0gY2F0ZWdvcnlSdWxlcy5maW5kSW5kZXgocnVsZSA9PiBydWxlLm5hbWUgPT09IHJ1bGVOYW1lKTtcbiAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIFxuICAgIGNhdGVnb3J5UnVsZXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg6vjg7zjg6vjgpLmnInlirkv54Sh5Yq55YyWXG4gICAqL1xuICBwdWJsaWMgdG9nZ2xlUnVsZShjYXRlZ29yeTogc3RyaW5nLCBydWxlTmFtZTogc3RyaW5nLCBlbmFibGVkOiBib29sZWFuKTogYm9vbGVhbiB7XG4gICAgY29uc3QgY2F0ZWdvcnlSdWxlcyA9IHRoaXMucnVsZXMuZ2V0KGNhdGVnb3J5KTtcbiAgICBpZiAoIWNhdGVnb3J5UnVsZXMpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgcnVsZSA9IGNhdGVnb3J5UnVsZXMuZmluZChyID0+IHIubmFtZSA9PT0gcnVsZU5hbWUpO1xuICAgIGlmICghcnVsZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBcbiAgICBydWxlLmVuYWJsZWQgPSBlbmFibGVkO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIOe1seioiOaDheWgseOCkuWPluW+l1xuICAgKi9cbiAgcHVibGljIGdldFN0YXRpc3RpY3MoKToge1xuICAgIHRvdGFsUnVsZXM6IG51bWJlcjtcbiAgICBlbmFibGVkUnVsZXM6IG51bWJlcjtcbiAgICBjYXRlZ29yeUNvdW50czogUmVjb3JkPHN0cmluZywgbnVtYmVyPjtcbiAgfSB7XG4gICAgbGV0IHRvdGFsUnVsZXMgPSAwO1xuICAgIGxldCBlbmFibGVkUnVsZXMgPSAwO1xuICAgIGNvbnN0IGNhdGVnb3J5Q291bnRzOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge307XG5cbiAgICBmb3IgKGNvbnN0IFtjYXRlZ29yeSwgcnVsZXNdIG9mIHRoaXMucnVsZXMpIHtcbiAgICAgIGNhdGVnb3J5Q291bnRzW2NhdGVnb3J5XSA9IHJ1bGVzLmxlbmd0aDtcbiAgICAgIHRvdGFsUnVsZXMgKz0gcnVsZXMubGVuZ3RoO1xuICAgICAgZW5hYmxlZFJ1bGVzICs9IHJ1bGVzLmZpbHRlcihydWxlID0+IHJ1bGUuZW5hYmxlZCkubGVuZ3RoO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICB0b3RhbFJ1bGVzLFxuICAgICAgZW5hYmxlZFJ1bGVzLFxuICAgICAgY2F0ZWdvcnlDb3VudHNcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOODnuODg+ODgeODs+OCsOe1kOaenOOCkuODhuOCueODiFxuICAgKi9cbiAgcHVibGljIHRlc3RQYXR0ZXJuKGZpbGVOYW1lOiBzdHJpbmcsIHBhdHRlcm46IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZWdleFBhdHRlcm4gPSB0aGlzLmdsb2JUb1JlZ2V4KHBhdHRlcm4pO1xuICAgICAgY29uc3QgcmVnZXggPSBuZXcgUmVnRXhwKHJlZ2V4UGF0dGVybiwgJ2knKTtcbiAgICAgIHJldHVybiByZWdleC50ZXN0KGZpbGVOYW1lKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS53YXJuKGDjg5Hjgr/jg7zjg7Pjg4bjgrnjg4jjgqjjg6njg7w6ICR7cGF0dGVybn1gLCBlcnJvcik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG59Il19