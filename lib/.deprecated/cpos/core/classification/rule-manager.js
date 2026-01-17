"use strict";
/**
 * Classification Rule Manager
 * 分類ルールの管理機能
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
exports.ClassificationRuleManager = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class ClassificationRuleManager {
    rulesFile;
    rules = [];
    constructor(rulesFile) {
        this.rulesFile = rulesFile;
    }
    /**
     * ルールを読み込み
     */
    async loadRules() {
        try {
            const content = await fs.readFile(this.rulesFile, 'utf-8');
            const data = JSON.parse(content);
            this.rules = data.rules || [];
            return this.rules;
        }
        catch (error) {
            console.warn(`ルールファイルの読み込みに失敗: ${this.rulesFile}`);
            this.rules = this.getBuiltinRules();
            return this.rules;
        }
    }
    /**
     * ルールを保存
     */
    async saveRules(rules) {
        try {
            // ディレクトリを作成
            const dir = path.dirname(this.rulesFile);
            await fs.mkdir(dir, { recursive: true });
            // ルールを検証
            const validation = this.validateRules(rules);
            if (!validation.valid) {
                throw new Error(`ルール検証エラー: ${validation.errors.join(', ')}`);
            }
            // ファイルに保存
            const data = {
                version: '1.0.0',
                lastUpdated: new Date().toISOString(),
                rules: rules
            };
            await fs.writeFile(this.rulesFile, JSON.stringify(data, null, 2));
            this.rules = rules;
            console.log(`分類ルールを保存しました: ${rules.length} 件`);
        }
        catch (error) {
            console.error('ルールの保存に失敗しました:', error);
            throw error;
        }
    }
    /**
     * ルールを追加
     */
    async addRule(rule) {
        // 重複チェック
        const existing = this.rules.find(r => r.name === rule.name);
        if (existing) {
            throw new Error(`同名のルールが既に存在します: ${rule.name}`);
        }
        // ルールを検証
        const validation = this.validateRule(rule);
        if (!validation.valid) {
            throw new Error(`ルール検証エラー: ${validation.errors.join(', ')}`);
        }
        this.rules.push(rule);
        await this.saveRules(this.rules);
    }
    /**
     * ルールを更新
     */
    async updateRule(name, updatedRule) {
        const index = this.rules.findIndex(r => r.name === name);
        if (index === -1) {
            throw new Error(`ルールが見つかりません: ${name}`);
        }
        // ルールを検証
        const validation = this.validateRule(updatedRule);
        if (!validation.valid) {
            throw new Error(`ルール検証エラー: ${validation.errors.join(', ')}`);
        }
        this.rules[index] = updatedRule;
        await this.saveRules(this.rules);
    }
    /**
     * ルールを削除
     */
    async deleteRule(name) {
        const index = this.rules.findIndex(r => r.name === name);
        if (index === -1) {
            throw new Error(`ルールが見つかりません: ${name}`);
        }
        this.rules.splice(index, 1);
        await this.saveRules(this.rules);
    }
    /**
     * ルールを検索
     */
    findRules(query) {
        const lowerQuery = query.toLowerCase();
        return this.rules.filter(rule => rule.name.toLowerCase().includes(lowerQuery) ||
            rule.pattern.toLowerCase().includes(lowerQuery) ||
            rule.targetPath.toLowerCase().includes(lowerQuery));
    }
    /**
     * カテゴリ別ルールを取得
     */
    getRulesByCategory(category) {
        return this.rules.filter(rule => {
            const ruleCategory = this.extractCategory(rule.targetPath);
            return ruleCategory === category;
        });
    }
    /**
     * ルールを検証
     */
    validateRule(rule) {
        const errors = [];
        const warnings = [];
        // 必須フィールドチェック
        if (!rule.name || rule.name.trim() === '') {
            errors.push('ルール名は必須です');
        }
        if (!rule.pattern || rule.pattern.trim() === '') {
            errors.push('パターンは必須です');
        }
        if (!rule.targetPath || rule.targetPath.trim() === '') {
            errors.push('ターゲットパスは必須です');
        }
        if (typeof rule.confidence !== 'number' || rule.confidence < 0 || rule.confidence > 1) {
            errors.push('信頼度は0から1の間の数値である必要があります');
        }
        // パターン検証
        try {
            const regexPattern = rule.pattern
                .replace(/\./g, '\\.')
                .replace(/\*/g, '.*')
                .replace(/\?/g, '.');
            new RegExp(regexPattern);
        }
        catch {
            errors.push('無効なパターン形式です');
        }
        // 内容パターン検証
        if (rule.contentPatterns) {
            for (const pattern of rule.contentPatterns) {
                try {
                    new RegExp(pattern);
                }
                catch {
                    warnings.push(`無効な内容パターン: ${pattern}`);
                }
            }
        }
        // サブルール検証
        if (rule.rules) {
            for (const subRule of rule.rules) {
                if (!subRule.contentPattern || !subRule.targetPath) {
                    errors.push('サブルールには内容パターンとターゲットパスが必要です');
                }
            }
        }
        // 信頼度の妥当性チェック
        if (rule.confidence < 0.1) {
            warnings.push('信頼度が低すぎます（0.1未満）');
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    /**
     * 複数ルールを検証
     */
    validateRules(rules) {
        const allErrors = [];
        const allWarnings = [];
        // 個別ルール検証
        for (let i = 0; i < rules.length; i++) {
            const validation = this.validateRule(rules[i]);
            if (!validation.valid) {
                allErrors.push(`ルール ${i + 1} (${rules[i].name}): ${validation.errors.join(', ')}`);
            }
            allWarnings.push(...validation.warnings.map(w => `ルール ${i + 1} (${rules[i].name}): ${w}`));
        }
        // 重複名チェック
        const names = rules.map(r => r.name);
        const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
        if (duplicates.length > 0) {
            allErrors.push(`重複するルール名: ${[...new Set(duplicates)].join(', ')}`);
        }
        // 競合チェック
        const conflicts = this.detectRuleConflicts(rules);
        allWarnings.push(...conflicts);
        return {
            valid: allErrors.length === 0,
            errors: allErrors,
            warnings: allWarnings
        };
    }
    /**
     * ルール競合を検出
     */
    detectRuleConflicts(rules) {
        const conflicts = [];
        for (let i = 0; i < rules.length; i++) {
            for (let j = i + 1; j < rules.length; j++) {
                const rule1 = rules[i];
                const rule2 = rules[j];
                // 同じパターンで異なるターゲットパス
                if (rule1.pattern === rule2.pattern && rule1.targetPath !== rule2.targetPath) {
                    conflicts.push(`パターン競合: "${rule1.pattern}" が "${rule1.name}" と "${rule2.name}" で異なるパスを指定`);
                }
                // 高い信頼度で重複するパターン
                if (rule1.confidence > 0.8 && rule2.confidence > 0.8 &&
                    this.patternsOverlap(rule1.pattern, rule2.pattern)) {
                    conflicts.push(`高信頼度パターン重複: "${rule1.name}" と "${rule2.name}"`);
                }
            }
        }
        return conflicts;
    }
    /**
     * パターンの重複をチェック
     */
    patternsOverlap(pattern1, pattern2) {
        // 簡単な重複チェック（完全一致または包含関係）
        return pattern1 === pattern2 ||
            pattern1.includes(pattern2) ||
            pattern2.includes(pattern1);
    }
    /**
     * カテゴリを抽出
     */
    extractCategory(targetPath) {
        const segments = targetPath.split('/').filter(s => s);
        return segments[0] || 'misc';
    }
    /**
     * 組み込みルールを取得
     */
    getBuiltinRules() {
        return [
            {
                name: 'TypeScript CDK Files',
                pattern: '**/*.ts',
                contentPatterns: ['import.*@aws-cdk', 'new.*Construct', 'Stack', 'App'],
                targetPath: 'lib/constructs/',
                confidence: 0.9
            },
            {
                name: 'Lambda Functions',
                pattern: '**/*.ts',
                contentPatterns: ['export.*handler', 'APIGatewayProxyEvent', 'Context', 'lambda'],
                targetPath: 'lambda/',
                confidence: 0.85
            },
            {
                name: 'Test Files',
                pattern: '**/*.test.*',
                contentPatterns: ['describe', 'it\\(', 'test\\(', 'expect', 'jest'],
                targetPath: 'tests/',
                confidence: 0.95
            },
            {
                name: 'Documentation',
                pattern: '**/*.md',
                contentPatterns: ['# ', '## ', '### '],
                targetPath: 'docs/',
                confidence: 0.8,
                rules: [
                    {
                        contentPattern: 'architecture|design|アーキテクチャ|設計',
                        targetPath: 'docs/architecture/'
                    },
                    {
                        contentPattern: 'deployment|deploy|デプロイ',
                        targetPath: 'docs/deployment/'
                    },
                    {
                        contentPattern: 'api|specification|仕様',
                        targetPath: 'docs/integration/'
                    }
                ]
            },
            {
                name: 'Configuration Files',
                pattern: '**/*.json',
                contentPatterns: ['config', 'settings', 'configuration'],
                targetPath: 'config/',
                confidence: 0.7
            },
            {
                name: 'CPOS Core Files',
                pattern: '**/cpos/**/*.ts',
                contentPatterns: ['CPOS', 'Classification', 'FileScanner', 'DatabaseManager'],
                targetPath: 'lib/cpos/',
                confidence: 0.9
            },
            {
                name: 'Shell Scripts',
                pattern: '**/*.sh',
                contentPatterns: ['#!/bin/bash', '#!/bin/sh', 'set -e'],
                targetPath: 'scripts/',
                confidence: 0.85
            },
            {
                name: 'Docker Files',
                pattern: '**/Dockerfile*',
                contentPatterns: ['FROM', 'RUN', 'COPY', 'WORKDIR'],
                targetPath: 'docker/',
                confidence: 0.9
            }
        ];
    }
    /**
     * 統計情報を取得
     */
    getStatistics() {
        const categories = new Map();
        const confidenceDistribution = { low: 0, medium: 0, high: 0 };
        for (const rule of this.rules) {
            const category = this.extractCategory(rule.targetPath);
            categories.set(category, (categories.get(category) || 0) + 1);
            if (rule.confidence < 0.5) {
                confidenceDistribution.low++;
            }
            else if (rule.confidence < 0.8) {
                confidenceDistribution.medium++;
            }
            else {
                confidenceDistribution.high++;
            }
        }
        return {
            totalRules: this.rules.length,
            categories: Object.fromEntries(categories),
            confidenceDistribution,
            rulesFile: this.rulesFile
        };
    }
    /**
     * 現在のルールを取得
     */
    getRules() {
        return [...this.rules];
    }
}
exports.ClassificationRuleManager = ClassificationRuleManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVsZS1tYW5hZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicnVsZS1tYW5hZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsZ0RBQWtDO0FBQ2xDLDJDQUE2QjtBQVM3QixNQUFhLHlCQUF5QjtJQUM1QixTQUFTLENBQVM7SUFDbEIsS0FBSyxHQUF5QixFQUFFLENBQUM7SUFFekMsWUFBWSxTQUFpQjtRQUMzQixJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztJQUM3QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsU0FBUztRQUNiLElBQUksQ0FBQztZQUNILE1BQU0sT0FBTyxHQUFHLE1BQU0sRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQzNELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDakMsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUM5QixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDcEIsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixPQUFPLENBQUMsSUFBSSxDQUFDLG9CQUFvQixJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQztZQUNuRCxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUNwQyxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDcEIsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBMkI7UUFDekMsSUFBSSxDQUFDO1lBQ0gsWUFBWTtZQUNaLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lB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QUM7aUJBQU0sSUFBSSxJQUFJLENBQUMsVUFBVSxHQUFHLEdBQUcsRUFBRSxDQUFDO2dCQUNqQyxzQkFBc0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNsQyxDQUFDO2lCQUFNLENBQUM7Z0JBQ04sc0JBQXNCLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDaEMsQ0FBQztRQUNILENBQUM7UUFFRCxPQUFPO1lBQ0wsVUFBVSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTTtZQUM3QixVQUFVLEVBQUUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUM7WUFDMUMsc0JBQXNCO1lBQ3RCLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUztTQUMxQixDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsUUFBUTtRQUNOLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN6QixDQUFDO0NBQ0Y7QUFuWUQsOERBbVlDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDbGFzc2lmaWNhdGlvbiBSdWxlIE1hbmFnZXJcbiAqIOWIhumhnuODq+ODvOODq+OBrueuoeeQhuapn+iDvVxuICovXG5cbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzL3Byb21pc2VzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBDbGFzc2lmaWNhdGlvblJ1bGUgfSBmcm9tICcuLi8uLi9pbnRlcmZhY2VzJztcblxuZXhwb3J0IGludGVyZmFjZSBSdWxlVmFsaWRhdGlvblJlc3VsdCB7XG4gIHZhbGlkOiBib29sZWFuO1xuICBlcnJvcnM6IHN0cmluZ1tdO1xuICB3YXJuaW5nczogc3RyaW5nW107XG59XG5cbmV4cG9ydCBjbGFzcyBDbGFzc2lmaWNhdGlvblJ1bGVNYW5hZ2VyIHtcbiAgcHJpdmF0ZSBydWxlc0ZpbGU6IHN0cmluZztcbiAgcHJpdmF0ZSBydWxlczogQ2xhc3NpZmljYXRpb25SdWxlW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihydWxlc0ZpbGU6IHN0cmluZykge1xuICAgIHRoaXMucnVsZXNGaWxlID0gcnVsZXNGaWxlO1xuICB9XG5cbiAgLyoqXG4gICAqIOODq+ODvOODq+OCkuiqreOBv+i+vOOBv1xuICAgKi9cbiAgYXN5bmMgbG9hZFJ1bGVzKCk6IFByb21pc2U8Q2xhc3NpZmljYXRpb25SdWxlW10+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IGZzLnJlYWRGaWxlKHRoaXMucnVsZXNGaWxlLCAndXRmLTgnKTtcbiAgICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKGNvbnRlbnQpO1xuICAgICAgdGhpcy5ydWxlcyA9IGRhdGEucnVsZXMgfHwgW107XG4gICAgICByZXR1cm4gdGhpcy5ydWxlcztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS53YXJuKGDjg6vjg7zjg6vjg5XjgqHjgqTjg6vjga7oqq3jgb/ovrzjgb/jgavlpLHmlZc6ICR7dGhpcy5ydWxlc0ZpbGV9YCk7XG4gICAgICB0aGlzLnJ1bGVzID0gdGhpcy5nZXRCdWlsdGluUnVsZXMoKTtcbiAgICAgIHJldHVybiB0aGlzLnJ1bGVzO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg6vjg7zjg6vjgpLkv53lrZhcbiAgICovXG4gIGFzeW5jIHNhdmVSdWxlcyhydWxlczogQ2xhc3NpZmljYXRpb25SdWxlW10pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgLy8g44OH44Kj44Os44Kv44OI44Oq44KS5L2c5oiQXG4gICAgICBjb25zdCBkaXIgPSBwYXRoLmRpcm5hbWUodGhpcy5ydWxlc0ZpbGUpO1xuICAgICAgYXdhaXQgZnMubWtkaXIoZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblxuICAgICAgLy8g44Or44O844Or44KS5qSc6Ki8XG4gICAgICBjb25zdCB2YWxpZGF0aW9uID0gdGhpcy52YWxpZGF0ZVJ1bGVzKHJ1bGVzKTtcbiAgICAgIGlmICghdmFsaWRhdGlvbi52YWxpZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYOODq+ODvOODq+aknOiovOOCqOODqeODvDogJHt2YWxpZGF0aW9uLmVycm9ycy5qb2luKCcsICcpfWApO1xuICAgICAgfVxuXG4gICAgICAvLyDjg5XjgqHjgqTjg6vjgavkv53lrZhcbiAgICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICAgIHZlcnNpb246ICcxLjAuMCcsXG4gICAgICAgIGxhc3RVcGRhdGVkOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIHJ1bGVzOiBydWxlc1xuICAgICAgfTtcblxuICAgICAgYXdhaXQgZnMud3JpdGVGaWxlKHRoaXMucnVsZXNGaWxlLCBKU09OLnN0cmluZ2lmeShkYXRhLCBudWxsLCAyKSk7XG4gICAgICB0aGlzLnJ1bGVzID0gcnVsZXM7XG4gICAgICBjb25zb2xlLmxvZyhg5YiG6aGe44Or44O844Or44KS5L+d5a2Y44GX44G+44GX44GfOiAke3J1bGVzLmxlbmd0aH0g5Lu2YCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ+ODq+ODvOODq+OBruS/neWtmOOBq+WkseaVl+OBl+OBvuOBl+OBnzonLCBlcnJvcik7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44Or44O844Or44KS6L+95YqgXG4gICAqL1xuICBhc3luYyBhZGRSdWxlKHJ1bGU6IENsYXNzaWZpY2F0aW9uUnVsZSk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIOmHjeikh+ODgeOCp+ODg+OCr1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5ydWxlcy5maW5kKHIgPT4gci5uYW1lID09PSBydWxlLm5hbWUpO1xuICAgIGlmIChleGlzdGluZykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGDlkIzlkI3jga7jg6vjg7zjg6vjgYzml6LjgavlrZjlnKjjgZfjgb7jgZk6ICR7cnVsZS5uYW1lfWApO1xuICAgIH1cblxuICAgIC8vIOODq+ODvOODq+OCkuaknOiovFxuICAgIGNvbnN0IHZhbGlkYXRpb24gPSB0aGlzLnZhbGlkYXRlUnVsZShydWxlKTtcbiAgICBpZiAoIXZhbGlkYXRpb24udmFsaWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihg44Or44O844Or5qSc6Ki844Ko44Op44O8OiAke3ZhbGlkYXRpb24uZXJyb3JzLmpvaW4oJywgJyl9YCk7XG4gICAgfVxuXG4gICAgdGhpcy5ydWxlcy5wdXNoKHJ1bGUpO1xuICAgIGF3YWl0IHRoaXMuc2F2ZVJ1bGVzKHRoaXMucnVsZXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIOODq+ODvOODq+OCkuabtOaWsFxuICAgKi9cbiAgYXN5bmMgdXBkYXRlUnVsZShuYW1lOiBzdHJpbmcsIHVwZGF0ZWRSdWxlOiBDbGFzc2lmaWNhdGlvblJ1bGUpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBpbmRleCA9IHRoaXMucnVsZXMuZmluZEluZGV4KHIgPT4gci5uYW1lID09PSBuYW1lKTtcbiAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYOODq+ODvOODq+OBjOimi+OBpOOBi+OCiuOBvuOBm+OCkzogJHtuYW1lfWApO1xuICAgIH1cblxuICAgIC8vIOODq+ODvOODq+OCkuaknOiovFxuICAgIGNvbnN0IHZhbGlkYXRpb24gPSB0aGlzLnZhbGlkYXRlUnVsZSh1cGRhdGVkUnVsZSk7XG4gICAgaWYgKCF2YWxpZGF0aW9uLnZhbGlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYOODq+ODvOODq+aknOiovOOCqOODqeODvDogJHt2YWxpZGF0aW9uLmVycm9ycy5qb2luKCcsICcpfWApO1xuICAgIH1cblxuICAgIHRoaXMucnVsZXNbaW5kZXhdID0gdXBkYXRlZFJ1bGU7XG4gICAgYXdhaXQgdGhpcy5zYXZlUnVsZXModGhpcy5ydWxlcyk7XG4gIH1cblxuICAvKipcbiAgICog44Or44O844Or44KS5YmK6ZmkXG4gICAqL1xuICBhc3luYyBkZWxldGVSdWxlKG5hbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5ydWxlcy5maW5kSW5kZXgociA9PiByLm5hbWUgPT09IG5hbWUpO1xuICAgIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihg44Or44O844Or44GM6KaL44Gk44GL44KK44G+44Gb44KTOiAke25hbWV9YCk7XG4gICAgfVxuXG4gICAgdGhpcy5ydWxlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIGF3YWl0IHRoaXMuc2F2ZVJ1bGVzKHRoaXMucnVsZXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIOODq+ODvOODq+OCkuaknOe0olxuICAgKi9cbiAgZmluZFJ1bGVzKHF1ZXJ5OiBzdHJpbmcpOiBDbGFzc2lmaWNhdGlvblJ1bGVbXSB7XG4gICAgY29uc3QgbG93ZXJRdWVyeSA9IHF1ZXJ5LnRvTG93ZXJDYXNlKCk7XG4gICAgcmV0dXJuIHRoaXMucnVsZXMuZmlsdGVyKHJ1bGUgPT4gXG4gICAgICBydWxlLm5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhsb3dlclF1ZXJ5KSB8fFxuICAgICAgcnVsZS5wYXR0ZXJuLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMobG93ZXJRdWVyeSkgfHxcbiAgICAgIHJ1bGUudGFyZ2V0UGF0aC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKGxvd2VyUXVlcnkpXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgqvjg4bjgrTjg6rliKXjg6vjg7zjg6vjgpLlj5blvpdcbiAgICovXG4gIGdldFJ1bGVzQnlDYXRlZ29yeShjYXRlZ29yeTogc3RyaW5nKTogQ2xhc3NpZmljYXRpb25SdWxlW10ge1xuICAgIHJldHVybiB0aGlzLnJ1bGVzLmZpbHRlcihydWxlID0+IHtcbiAgICAgIGNvbnN0IHJ1bGVDYXRlZ29yeSA9IHRoaXMuZXh0cmFjdENhdGVnb3J5KHJ1bGUudGFyZ2V0UGF0aCk7XG4gICAgICByZXR1cm4gcnVsZUNhdGVnb3J5ID09PSBjYXRlZ29yeTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg6vjg7zjg6vjgpLmpJzoqLxcbiAgICovXG4gIHZhbGlkYXRlUnVsZShydWxlOiBDbGFzc2lmaWNhdGlvblJ1bGUpOiBSdWxlVmFsaWRhdGlvblJlc3VsdCB7XG4gICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgLy8g5b+F6aCI44OV44Kj44O844Or44OJ44OB44Kn44OD44KvXG4gICAgaWYgKCFydWxlLm5hbWUgfHwgcnVsZS5uYW1lLnRyaW0oKSA9PT0gJycpIHtcbiAgICAgIGVycm9ycy5wdXNoKCfjg6vjg7zjg6vlkI3jga/lv4XpoIjjgafjgZknKTtcbiAgICB9XG5cbiAgICBpZiAoIXJ1bGUucGF0dGVybiB8fCBydWxlLnBhdHRlcm4udHJpbSgpID09PSAnJykge1xuICAgICAgZXJyb3JzLnB1c2goJ+ODkeOCv+ODvOODs+OBr+W/hemgiOOBp+OBmScpO1xuICAgIH1cblxuICAgIGlmICghcnVsZS50YXJnZXRQYXRoIHx8IHJ1bGUudGFyZ2V0UGF0aC50cmltKCkgPT09ICcnKSB7XG4gICAgICBlcnJvcnMucHVzaCgn44K/44O844Ky44OD44OI44OR44K544Gv5b+F6aCI44Gn44GZJyk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBydWxlLmNvbmZpZGVuY2UgIT09ICdudW1iZXInIHx8IHJ1bGUuY29uZmlkZW5jZSA8IDAgfHwgcnVsZS5jb25maWRlbmNlID4gMSkge1xuICAgICAgZXJyb3JzLnB1c2goJ+S/oemgvOW6puOBrzDjgYvjgokx44Gu6ZaT44Gu5pWw5YCk44Gn44GC44KL5b+F6KaB44GM44GC44KK44G+44GZJyk7XG4gICAgfVxuXG4gICAgLy8g44OR44K/44O844Oz5qSc6Ki8XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlZ2V4UGF0dGVybiA9IHJ1bGUucGF0dGVyblxuICAgICAgICAucmVwbGFjZSgvXFwuL2csICdcXFxcLicpXG4gICAgICAgIC5yZXBsYWNlKC9cXCovZywgJy4qJylcbiAgICAgICAgLnJlcGxhY2UoL1xcPy9nLCAnLicpO1xuICAgICAgbmV3IFJlZ0V4cChyZWdleFBhdHRlcm4pO1xuICAgIH0gY2F0Y2gge1xuICAgICAgZXJyb3JzLnB1c2goJ+eEoeWKueOBquODkeOCv+ODvOODs+W9ouW8j+OBp+OBmScpO1xuICAgIH1cblxuICAgIC8vIOWGheWuueODkeOCv+ODvOODs+aknOiovFxuICAgIGlmIChydWxlLmNvbnRlbnRQYXR0ZXJucykge1xuICAgICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIHJ1bGUuY29udGVudFBhdHRlcm5zKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgbmV3IFJlZ0V4cChwYXR0ZXJuKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgd2FybmluZ3MucHVzaChg54Sh5Yq544Gq5YaF5a6544OR44K/44O844OzOiAke3BhdHRlcm59YCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyDjgrXjg5bjg6vjg7zjg6vmpJzoqLxcbiAgICBpZiAocnVsZS5ydWxlcykge1xuICAgICAgZm9yIChjb25zdCBzdWJSdWxlIG9mIHJ1bGUucnVsZXMpIHtcbiAgICAgICAgaWYgKCFzdWJSdWxlLmNvbnRlbnRQYXR0ZXJuIHx8ICFzdWJSdWxlLnRhcmdldFBhdGgpIHtcbiAgICAgICAgICBlcnJvcnMucHVzaCgn44K144OW44Or44O844Or44Gr44Gv5YaF5a6544OR44K/44O844Oz44Go44K/44O844Ky44OD44OI44OR44K544GM5b+F6KaB44Gn44GZJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyDkv6HpoLzluqbjga7lpqXlvZPmgKfjg4Hjgqfjg4Pjgq9cbiAgICBpZiAocnVsZS5jb25maWRlbmNlIDwgMC4xKSB7XG4gICAgICB3YXJuaW5ncy5wdXNoKCfkv6HpoLzluqbjgYzkvY7jgZnjgY7jgb7jgZnvvIgwLjHmnKrmuoDvvIknKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgdmFsaWQ6IGVycm9ycy5sZW5ndGggPT09IDAsXG4gICAgICBlcnJvcnMsXG4gICAgICB3YXJuaW5nc1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog6KSH5pWw44Or44O844Or44KS5qSc6Ki8XG4gICAqL1xuICB2YWxpZGF0ZVJ1bGVzKHJ1bGVzOiBDbGFzc2lmaWNhdGlvblJ1bGVbXSk6IFJ1bGVWYWxpZGF0aW9uUmVzdWx0IHtcbiAgICBjb25zdCBhbGxFcnJvcnM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgYWxsV2FybmluZ3M6IHN0cmluZ1tdID0gW107XG5cbiAgICAvLyDlgIvliKXjg6vjg7zjg6vmpJzoqLxcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJ1bGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCB2YWxpZGF0aW9uID0gdGhpcy52YWxpZGF0ZVJ1bGUocnVsZXNbaV0pO1xuICAgICAgaWYgKCF2YWxpZGF0aW9uLnZhbGlkKSB7XG4gICAgICAgIGFsbEVycm9ycy5wdXNoKGDjg6vjg7zjg6sgJHtpICsgMX0gKCR7cnVsZXNbaV0ubmFtZX0pOiAke3ZhbGlkYXRpb24uZXJyb3JzLmpvaW4oJywgJyl9YCk7XG4gICAgICB9XG4gICAgICBhbGxXYXJuaW5ncy5wdXNoKC4uLnZhbGlkYXRpb24ud2FybmluZ3MubWFwKHcgPT4gYOODq+ODvOODqyAke2kgKyAxfSAoJHtydWxlc1tpXS5uYW1lfSk6ICR7d31gKSk7XG4gICAgfVxuXG4gICAgLy8g6YeN6KSH5ZCN44OB44Kn44OD44KvXG4gICAgY29uc3QgbmFtZXMgPSBydWxlcy5tYXAociA9PiByLm5hbWUpO1xuICAgIGNvbnN0IGR1cGxpY2F0ZXMgPSBuYW1lcy5maWx0ZXIoKG5hbWUsIGluZGV4KSA9PiBuYW1lcy5pbmRleE9mKG5hbWUpICE9PSBpbmRleCk7XG4gICAgaWYgKGR1cGxpY2F0ZXMubGVuZ3RoID4gMCkge1xuICAgICAgYWxsRXJyb3JzLnB1c2goYOmHjeikh+OBmeOCi+ODq+ODvOODq+WQjTogJHtbLi4ubmV3IFNldChkdXBsaWNhdGVzKV0uam9pbignLCAnKX1gKTtcbiAgICB9XG5cbiAgICAvLyDnq7blkIjjg4Hjgqfjg4Pjgq9cbiAgICBjb25zdCBjb25mbGljdHMgPSB0aGlzLmRldGVjdFJ1bGVDb25mbGljdHMocnVsZXMpO1xuICAgIGFsbFdhcm5pbmdzLnB1c2goLi4uY29uZmxpY3RzKTtcblxuICAgIHJldHVybiB7XG4gICAgICB2YWxpZDogYWxsRXJyb3JzLmxlbmd0aCA9PT0gMCxcbiAgICAgIGVycm9yczogYWxsRXJyb3JzLFxuICAgICAgd2FybmluZ3M6IGFsbFdhcm5pbmdzXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg6vjg7zjg6vnq7blkIjjgpLmpJzlh7pcbiAgICovXG4gIHByaXZhdGUgZGV0ZWN0UnVsZUNvbmZsaWN0cyhydWxlczogQ2xhc3NpZmljYXRpb25SdWxlW10pOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgY29uZmxpY3RzOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcnVsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZvciAobGV0IGogPSBpICsgMTsgaiA8IHJ1bGVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGNvbnN0IHJ1bGUxID0gcnVsZXNbaV07XG4gICAgICAgIGNvbnN0IHJ1bGUyID0gcnVsZXNbal07XG5cbiAgICAgICAgLy8g5ZCM44GY44OR44K/44O844Oz44Gn55Ww44Gq44KL44K/44O844Ky44OD44OI44OR44K5XG4gICAgICAgIGlmIChydWxlMS5wYXR0ZXJuID09PSBydWxlMi5wYXR0ZXJuICYmIHJ1bGUxLnRhcmdldFBhdGggIT09IHJ1bGUyLnRhcmdldFBhdGgpIHtcbiAgICAgICAgICBjb25mbGljdHMucHVzaChg44OR44K/44O844Oz56u25ZCIOiBcIiR7cnVsZTEucGF0dGVybn1cIiDjgYwgXCIke3J1bGUxLm5hbWV9XCIg44GoIFwiJHtydWxlMi5uYW1lfVwiIOOBp+eVsOOBquOCi+ODkeOCueOCkuaMh+WummApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g6auY44GE5L+h6aC85bqm44Gn6YeN6KSH44GZ44KL44OR44K/44O844OzXG4gICAgICAgIGlmIChydWxlMS5jb25maWRlbmNlID4gMC44ICYmIHJ1bGUyLmNvbmZpZGVuY2UgPiAwLjggJiYgXG4gICAgICAgICAgICB0aGlzLnBhdHRlcm5zT3ZlcmxhcChydWxlMS5wYXR0ZXJuLCBydWxlMi5wYXR0ZXJuKSkge1xuICAgICAgICAgIGNvbmZsaWN0cy5wdXNoKGDpq5jkv6HpoLzluqbjg5Hjgr/jg7zjg7Pph43opIc6IFwiJHtydWxlMS5uYW1lfVwiIOOBqCBcIiR7cnVsZTIubmFtZX1cImApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbmZsaWN0cztcbiAgfVxuXG4gIC8qKlxuICAgKiDjg5Hjgr/jg7zjg7Pjga7ph43opIfjgpLjg4Hjgqfjg4Pjgq9cbiAgICovXG4gIHByaXZhdGUgcGF0dGVybnNPdmVybGFwKHBhdHRlcm4xOiBzdHJpbmcsIHBhdHRlcm4yOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAvLyDnsKHljZjjgarph43opIfjg4Hjgqfjg4Pjgq/vvIjlrozlhajkuIDoh7Tjgb7jgZ/jga/ljIXlkKvplqLkv4LvvIlcbiAgICByZXR1cm4gcGF0dGVybjEgPT09IHBhdHRlcm4yIHx8IFxuICAgICAgICAgICBwYXR0ZXJuMS5pbmNsdWRlcyhwYXR0ZXJuMikgfHwgXG4gICAgICAgICAgIHBhdHRlcm4yLmluY2x1ZGVzKHBhdHRlcm4xKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgqvjg4bjgrTjg6rjgpLmir3lh7pcbiAgICovXG4gIHByaXZhdGUgZXh0cmFjdENhdGVnb3J5KHRhcmdldFBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3Qgc2VnbWVudHMgPSB0YXJnZXRQYXRoLnNwbGl0KCcvJykuZmlsdGVyKHMgPT4gcyk7XG4gICAgcmV0dXJuIHNlZ21lbnRzWzBdIHx8ICdtaXNjJztcbiAgfVxuXG4gIC8qKlxuICAgKiDntYTjgb/ovrzjgb/jg6vjg7zjg6vjgpLlj5blvpdcbiAgICovXG4gIHByaXZhdGUgZ2V0QnVpbHRpblJ1bGVzKCk6IENsYXNzaWZpY2F0aW9uUnVsZVtdIHtcbiAgICByZXR1cm4gW1xuICAgICAge1xuICAgICAgICBuYW1lOiAnVHlwZVNjcmlwdCBDREsgRmlsZXMnLFxuICAgICAgICBwYXR0ZXJuOiAnKiovKi50cycsXG4gICAgICAgIGNvbnRlbnRQYXR0ZXJuczogWydpbXBvcnQuKkBhd3MtY2RrJywgJ25ldy4qQ29uc3RydWN0JywgJ1N0YWNrJywgJ0FwcCddLFxuICAgICAgICB0YXJnZXRQYXRoOiAnbGliL2NvbnN0cnVjdHMvJyxcbiAgICAgICAgY29uZmlkZW5jZTogMC45XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAnTGFtYmRhIEZ1bmN0aW9ucycsXG4gICAgICAgIHBhdHRlcm46ICcqKi8qLnRzJyxcbiAgICAgICAgY29udGVudFBhdHRlcm5zOiBbJ2V4cG9ydC4qaGFuZGxlcicsICdBUElHYXRld2F5UHJveHlFdmVudCcsICdDb250ZXh0JywgJ2xhbWJkYSddLFxuICAgICAgICB0YXJnZXRQYXRoOiAnbGFtYmRhLycsXG4gICAgICAgIGNvbmZpZGVuY2U6IDAuODVcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdUZXN0IEZpbGVzJyxcbiAgICAgICAgcGF0dGVybjogJyoqLyoudGVzdC4qJyxcbiAgICAgICAgY29udGVudFBhdHRlcm5zOiBbJ2Rlc2NyaWJlJywgJ2l0XFxcXCgnLCAndGVzdFxcXFwoJywgJ2V4cGVjdCcsICdqZXN0J10sXG4gICAgICAgIHRhcmdldFBhdGg6ICd0ZXN0cy8nLFxuICAgICAgICBjb25maWRlbmNlOiAwLjk1XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAnRG9jdW1lbnRhdGlvbicsXG4gICAgICAgIHBhdHRlcm46ICcqKi8qLm1kJyxcbiAgICAgICAgY29udGVudFBhdHRlcm5zOiBbJyMgJywgJyMjICcsICcjIyMgJ10sXG4gICAgICAgIHRhcmdldFBhdGg6ICdkb2NzLycsXG4gICAgICAgIGNvbmZpZGVuY2U6IDAuOCxcbiAgICAgICAgcnVsZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBjb250ZW50UGF0dGVybjogJ2FyY2hpdGVjdHVyZXxkZXNpZ25844Ki44O844Kt44OG44Kv44OB44OjfOioreioiCcsXG4gICAgICAgICAgICB0YXJnZXRQYXRoOiAnZG9jcy9hcmNoaXRlY3R1cmUvJ1xuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgY29udGVudFBhdHRlcm46ICdkZXBsb3ltZW50fGRlcGxveXzjg4fjg5fjg63jgqQnLFxuICAgICAgICAgICAgdGFyZ2V0UGF0aDogJ2RvY3MvZGVwbG95bWVudC8nXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBjb250ZW50UGF0dGVybjogJ2FwaXxzcGVjaWZpY2F0aW9ufOS7leanmCcsXG4gICAgICAgICAgICB0YXJnZXRQYXRoOiAnZG9jcy9pbnRlZ3JhdGlvbi8nXG4gICAgICAgICAgfVxuICAgICAgICBdXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAnQ29uZmlndXJhdGlvbiBGaWxlcycsXG4gICAgICAgIHBhdHRlcm46ICcqKi8qLmpzb24nLFxuICAgICAgICBjb250ZW50UGF0dGVybnM6IFsnY29uZmlnJywgJ3NldHRpbmdzJywgJ2NvbmZpZ3VyYXRpb24nXSxcbiAgICAgICAgdGFyZ2V0UGF0aDogJ2NvbmZpZy8nLFxuICAgICAgICBjb25maWRlbmNlOiAwLjdcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdDUE9TIENvcmUgRmlsZXMnLFxuICAgICAgICBwYXR0ZXJuOiAnKiovY3Bvcy8qKi8qLnRzJyxcbiAgICAgICAgY29udGVudFBhdHRlcm5zOiBbJ0NQT1MnLCAnQ2xhc3NpZmljYXRpb24nLCAnRmlsZVNjYW5uZXInLCAnRGF0YWJhc2VNYW5hZ2VyJ10sXG4gICAgICAgIHRhcmdldFBhdGg6ICdsaWIvY3Bvcy8nLFxuICAgICAgICBjb25maWRlbmNlOiAwLjlcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdTaGVsbCBTY3JpcHRzJyxcbiAgICAgICAgcGF0dGVybjogJyoqLyouc2gnLFxuICAgICAgICBjb250ZW50UGF0dGVybnM6IFsnIyEvYmluL2Jhc2gnLCAnIyEvYmluL3NoJywgJ3NldCAtZSddLFxuICAgICAgICB0YXJnZXRQYXRoOiAnc2NyaXB0cy8nLFxuICAgICAgICBjb25maWRlbmNlOiAwLjg1XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAnRG9ja2VyIEZpbGVzJyxcbiAgICAgICAgcGF0dGVybjogJyoqL0RvY2tlcmZpbGUqJyxcbiAgICAgICAgY29udGVudFBhdHRlcm5zOiBbJ0ZST00nLCAnUlVOJywgJ0NPUFknLCAnV09SS0RJUiddLFxuICAgICAgICB0YXJnZXRQYXRoOiAnZG9ja2VyLycsXG4gICAgICAgIGNvbmZpZGVuY2U6IDAuOVxuICAgICAgfVxuICAgIF07XG4gIH1cblxuICAvKipcbiAgICog57Wx6KiI5oOF5aCx44KS5Y+W5b6XXG4gICAqL1xuICBnZXRTdGF0aXN0aWNzKCk6IGFueSB7XG4gICAgY29uc3QgY2F0ZWdvcmllcyA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gICAgY29uc3QgY29uZmlkZW5jZURpc3RyaWJ1dGlvbiA9IHsgbG93OiAwLCBtZWRpdW06IDAsIGhpZ2g6IDAgfTtcblxuICAgIGZvciAoY29uc3QgcnVsZSBvZiB0aGlzLnJ1bGVzKSB7XG4gICAgICBjb25zdCBjYXRlZ29yeSA9IHRoaXMuZXh0cmFjdENhdGVnb3J5KHJ1bGUudGFyZ2V0UGF0aCk7XG4gICAgICBjYXRlZ29yaWVzLnNldChjYXRlZ29yeSwgKGNhdGVnb3JpZXMuZ2V0KGNhdGVnb3J5KSB8fCAwKSArIDEpO1xuXG4gICAgICBpZiAocnVsZS5jb25maWRlbmNlIDwgMC41KSB7XG4gICAgICAgIGNvbmZpZGVuY2VEaXN0cmlidXRpb24ubG93Kys7XG4gICAgICB9IGVsc2UgaWYgKHJ1bGUuY29uZmlkZW5jZSA8IDAuOCkge1xuICAgICAgICBjb25maWRlbmNlRGlzdHJpYnV0aW9uLm1lZGl1bSsrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uZmlkZW5jZURpc3RyaWJ1dGlvbi5oaWdoKys7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHRvdGFsUnVsZXM6IHRoaXMucnVsZXMubGVuZ3RoLFxuICAgICAgY2F0ZWdvcmllczogT2JqZWN0LmZyb21FbnRyaWVzKGNhdGVnb3JpZXMpLFxuICAgICAgY29uZmlkZW5jZURpc3RyaWJ1dGlvbixcbiAgICAgIHJ1bGVzRmlsZTogdGhpcy5ydWxlc0ZpbGVcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOePvuWcqOOBruODq+ODvOODq+OCkuWPluW+l1xuICAgKi9cbiAgZ2V0UnVsZXMoKTogQ2xhc3NpZmljYXRpb25SdWxlW10ge1xuICAgIHJldHVybiBbLi4udGhpcy5ydWxlc107XG4gIH1cbn0iXX0=