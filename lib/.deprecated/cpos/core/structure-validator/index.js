"use strict";
/**
 * Directory Structure Validator
 * ディレクトリ構造検証機能 - プロジェクト構造の検証と自動修正
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
exports.DirectoryStructureValidator = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class DirectoryStructureValidator {
    config;
    projectStructure = null;
    basePath;
    constructor(config, basePath = './') {
        this.config = config;
        this.basePath = path.resolve(basePath);
    }
    /**
     * 構造検証機能を初期化
     */
    async initialize() {
        try {
            // プロジェクト構造定義を読み込み
            await this.loadProjectStructure();
            console.log('ディレクトリ構造検証機能を初期化しました');
        }
        catch (error) {
            console.error('構造検証機能の初期化に失敗しました:', error);
            throw error;
        }
    }
    /**
     * プロジェクト構造を検証
     */
    async validateStructure() {
        if (!this.projectStructure) {
            throw new Error('プロジェクト構造定義が読み込まれていません');
        }
        const violations = [];
        const suggestions = [];
        console.log('プロジェクト構造の検証を開始します...');
        // ディレクトリルールの検証
        for (const dirRule of this.projectStructure.directories) {
            const dirViolations = await this.validateDirectoryRule(dirRule);
            violations.push(...dirViolations);
            // 自動修正可能な違反に対する提案を生成
            for (const violation of dirViolations) {
                if (violation.autoFixable) {
                    const suggestion = this.generateSuggestion(violation);
                    if (suggestion) {
                        suggestions.push(suggestion);
                    }
                }
            }
        }
        // カスタムルールの検証
        if (this.config.enableCustomRules) {
            for (const customRule of this.projectStructure.customRules) {
                const customViolations = await this.validateCustomRule(customRule);
                violations.push(...customViolations);
            }
        }
        // ファイルタイプルールの検証
        const fileTypeViolations = await this.validateFileTypeRules();
        violations.push(...fileTypeViolations);
        // 検証結果のサマリーを生成
        const summary = this.generateValidationSummary(violations);
        const result = {
            valid: violations.filter(v => v.severity === 'error').length === 0,
            violations,
            suggestions,
            summary
        };
        console.log(`構造検証完了: ${violations.length} 件の違反を検出`);
        return result;
    }
    /**
     * ディレクトリルールを検証
     */
    async validateDirectoryRule(rule) {
        const violations = [];
        const fullPath = path.join(this.basePath, rule.path);
        try {
            const stats = await fs.stat(fullPath);
            if (!stats.isDirectory()) {
                violations.push({
                    type: 'missing_directory',
                    path: rule.path,
                    rule,
                    severity: rule.required ? 'error' : 'warning',
                    description: `パスがディレクトリではありません: ${rule.path}`,
                    autoFixable: false
                });
                return violations;
            }
            // パーミッションの検証
            if (rule.permissions) {
                const permissionViolation = await this.validatePermissions(fullPath, rule);
                if (permissionViolation) {
                    violations.push(permissionViolation);
                }
            }
            // サイズ制限の検証
            if (rule.maxSize) {
                const sizeViolation = await this.validateDirectorySize(fullPath, rule);
                if (sizeViolation) {
                    violations.push(sizeViolation);
                }
            }
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                // ディレクトリが存在しない
                violations.push({
                    type: 'missing_directory',
                    path: rule.path,
                    rule,
                    severity: rule.required ? 'error' : 'warning',
                    description: `必須ディレクトリが存在しません: ${rule.path} (${rule.purpose})`,
                    autoFixable: this.config.autoCreateDirectories
                });
            }
            else {
                violations.push({
                    type: 'missing_directory',
                    path: rule.path,
                    rule,
                    severity: 'error',
                    description: `ディレクトリアクセスエラー: ${rule.path} - ${error.message}`,
                    autoFixable: false
                });
            }
        }
        return violations;
    }
    /**
     * パーミッションを検証
     */
    async validatePermissions(dirPath, rule) {
        try {
            const stats = await fs.stat(dirPath);
            const currentMode = (stats.mode & parseInt('777', 8)).toString(8);
            const expectedMode = rule.permissions;
            if (currentMode !== expectedMode) {
                return {
                    type: 'invalid_permission',
                    path: rule.path,
                    rule,
                    severity: 'warning',
                    description: `パーミッションが正しくありません: ${rule.path} (現在: ${currentMode}, 期待値: ${expectedMode})`,
                    autoFixable: this.config.autoFixPermissions
                };
            }
        }
        catch (error) {
            return {
                type: 'invalid_permission',
                path: rule.path,
                rule,
                severity: 'error',
                description: `パーミッション確認エラー: ${rule.path} - ${error.message}`,
                autoFixable: false
            };
        }
        return null;
    }
    /**
     * ディレクトリサイズを検証
     */
    async validateDirectorySize(dirPath, rule) {
        try {
            const size = await this.calculateDirectorySize(dirPath);
            const maxSizeBytes = (rule.maxSize || 0) * 1024 * 1024; // MB to bytes
            if (size > maxSizeBytes) {
                return {
                    type: 'size_exceeded',
                    path: rule.path,
                    rule,
                    severity: 'warning',
                    description: `ディレクトリサイズが制限を超過: ${rule.path} (${Math.round(size / 1024 / 1024)}MB > ${rule.maxSize}MB)`,
                    autoFixable: false
                };
            }
        }
        catch (error) {
            return {
                type: 'size_exceeded',
                path: rule.path,
                rule,
                severity: 'error',
                description: `サイズ計算エラー: ${rule.path} - ${error.message}`,
                autoFixable: false
            };
        }
        return null;
    }
    /**
     * カスタムルールを検証
     */
    async validateCustomRule(rule) {
        const violations = [];
        try {
            // カスタムルールの条件を評価
            const conditionMet = await this.evaluateCustomRuleCondition(rule.condition);
            if (conditionMet) {
                // アクションが必要な場合の処理
                const actionResult = await this.evaluateCustomRuleAction(rule.action);
                if (!actionResult.success) {
                    violations.push({
                        type: 'custom_rule_violation',
                        path: actionResult.path || '',
                        rule,
                        severity: rule.priority > 5 ? 'error' : 'warning',
                        description: `カスタムルール違反: ${rule.name} - ${actionResult.message}`,
                        autoFixable: actionResult.autoFixable || false
                    });
                }
            }
        }
        catch (error) {
            violations.push({
                type: 'custom_rule_violation',
                path: '',
                rule,
                severity: 'error',
                description: `カスタムルール評価エラー: ${rule.name} - ${error.message}`,
                autoFixable: false
            });
        }
        return violations;
    }
    /**
     * ファイルタイプルールを検証
     */
    async validateFileTypeRules() {
        const violations = [];
        if (!this.projectStructure) {
            return violations;
        }
        // プロジェクト内の全ファイルをスキャン
        const allFiles = await this.scanAllFiles(this.basePath);
        for (const filePath of allFiles) {
            const relativePath = path.relative(this.basePath, filePath);
            const extension = path.extname(filePath).toLowerCase();
            // 除外パターンのチェック
            if (this.isExcluded(relativePath)) {
                continue;
            }
            // 対応するファイルタイプルールを検索
            const fileTypeRule = this.projectStructure.fileTypes.find(rule => rule.extension === extension);
            if (fileTypeRule) {
                // ファイルが正しいディレクトリにあるかチェック
                const expectedDir = fileTypeRule.defaultPath;
                const currentDir = path.dirname(relativePath);
                if (!this.isPathInExpectedLocation(currentDir, expectedDir)) {
                    violations.push({
                        type: 'custom_rule_violation',
                        path: relativePath,
                        rule: fileTypeRule,
                        severity: 'info',
                        description: `ファイルが推奨ディレクトリにありません: ${relativePath} (推奨: ${expectedDir})`,
                        autoFixable: true
                    });
                }
            }
        }
        return violations;
    }
    /**
     * 違反に対する修正提案を生成
     */
    generateSuggestion(violation) {
        switch (violation.type) {
            case 'missing_directory':
                return {
                    type: 'create_directory',
                    path: violation.path,
                    action: `mkdir -p ${violation.path}`,
                    description: `必須ディレクトリを作成: ${violation.path}`,
                    priority: violation.severity === 'error' ? 1 : 2
                };
            case 'invalid_permission':
                const rule = violation.rule;
                return {
                    type: 'fix_permission',
                    path: violation.path,
                    action: `chmod ${rule.permissions} ${violation.path}`,
                    description: `パーミッションを修正: ${violation.path} → ${rule.permissions}`,
                    priority: 2
                };
            default:
                return null;
        }
    }
    /**
     * 自動修正を実行
     */
    async autoFix(suggestions) {
        const results = [];
        let allSuccess = true;
        // 優先度順にソート
        const sortedSuggestions = suggestions.sort((a, b) => a.priority - b.priority);
        for (const suggestion of sortedSuggestions) {
            try {
                const success = await this.executeSuggestion(suggestion);
                if (success) {
                    results.push(`✅ ${suggestion.description}`);
                }
                else {
                    results.push(`❌ ${suggestion.description} - 実行失敗`);
                    allSuccess = false;
                }
            }
            catch (error) {
                results.push(`❌ ${suggestion.description} - エラー: ${error.message}`);
                allSuccess = false;
            }
        }
        return { success: allSuccess, results };
    }
    /**
     * 修正提案を実行
     */
    async executeSuggestion(suggestion) {
        const fullPath = path.join(this.basePath, suggestion.path);
        switch (suggestion.type) {
            case 'create_directory':
                await fs.mkdir(fullPath, { recursive: true });
                console.log(`ディレクトリを作成しました: ${suggestion.path}`);
                return true;
            case 'fix_permission':
                // パーミッション修正の実装
                const match = suggestion.action.match(/chmod (\d+)/);
                if (match) {
                    const mode = parseInt(match[1], 8);
                    await fs.chmod(fullPath, mode);
                    console.log(`パーミッションを修正しました: ${suggestion.path} → ${match[1]}`);
                    return true;
                }
                return false;
            case 'move_file':
                // ファイル移動の実装（必要に応じて）
                return true;
            default:
                return false;
        }
    }
    /**
     * プロジェクト構造定義を読み込み
     */
    async loadProjectStructure() {
        try {
            const structureData = await fs.readFile(this.config.structureDefinitionPath, 'utf-8');
            this.projectStructure = JSON.parse(structureData);
            console.log('プロジェクト構造定義を読み込みました');
        }
        catch (error) {
            console.warn(`構造定義ファイルの読み込みに失敗: ${this.config.structureDefinitionPath}`);
            this.projectStructure = this.getDefaultProjectStructure();
        }
    }
    /**
     * デフォルトプロジェクト構造を取得
     */
    getDefaultProjectStructure() {
        return {
            version: '1.0.0',
            directories: [
                {
                    path: 'lib',
                    purpose: 'TypeScript source code',
                    required: true,
                    permissions: '755'
                },
                {
                    path: 'tests',
                    purpose: 'Test files',
                    required: true,
                    permissions: '755'
                },
                {
                    path: 'config',
                    purpose: 'Configuration files',
                    required: true,
                    permissions: '755'
                },
                {
                    path: 'docs',
                    purpose: 'Documentation',
                    required: false,
                    permissions: '755'
                },
                {
                    path: 'scripts',
                    purpose: 'Build and utility scripts',
                    required: false,
                    permissions: '755'
                },
                {
                    path: 'development',
                    purpose: 'Development tools and scripts',
                    required: false,
                    permissions: '755'
                }
            ],
            fileTypes: [
                {
                    extension: '.ts',
                    category: 'typescript',
                    defaultPath: 'lib',
                    rules: ['Must be in lib/ directory']
                },
                {
                    extension: '.test.ts',
                    category: 'test',
                    defaultPath: 'tests',
                    rules: ['Must be in tests/ directory']
                },
                {
                    extension: '.json',
                    category: 'config',
                    defaultPath: 'config',
                    rules: ['Configuration files should be in config/']
                },
                {
                    extension: '.md',
                    category: 'documentation',
                    defaultPath: 'docs',
                    rules: ['Documentation should be in docs/']
                }
            ],
            exclusions: [
                'node_modules',
                '.git',
                'cdk.out',
                '*.log',
                '.DS_Store'
            ],
            customRules: []
        };
    }
    /**
     * 検証サマリーを生成
     */
    generateValidationSummary(violations) {
        const errorCount = violations.filter(v => v.severity === 'error').length;
        const warningCount = violations.filter(v => v.severity === 'warning').length;
        const autoFixableCount = violations.filter(v => v.autoFixable).length;
        return {
            totalDirectories: this.projectStructure?.directories.length || 0,
            validDirectories: (this.projectStructure?.directories.length || 0) - violations.filter(v => v.type === 'missing_directory').length,
            missingDirectories: violations.filter(v => v.type === 'missing_directory').length,
            violationCount: violations.length,
            autoFixableCount
        };
    }
    /**
     * ディレクトリサイズを計算
     */
    async calculateDirectorySize(dirPath) {
        let totalSize = 0;
        const calculateSize = async (currentPath) => {
            try {
                const entries = await fs.readdir(currentPath, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(currentPath, entry.name);
                    if (entry.isFile()) {
                        const stats = await fs.stat(fullPath);
                        totalSize += stats.size;
                    }
                    else if (entry.isDirectory()) {
                        await calculateSize(fullPath);
                    }
                }
            }
            catch (error) {
                // アクセスできないディレクトリは無視
            }
        };
        await calculateSize(dirPath);
        return totalSize;
    }
    /**
     * 全ファイルをスキャン
     */
    async scanAllFiles(dirPath) {
        const files = [];
        const scanDirectory = async (currentPath) => {
            try {
                const entries = await fs.readdir(currentPath, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(currentPath, entry.name);
                    if (entry.isFile()) {
                        files.push(fullPath);
                    }
                    else if (entry.isDirectory() && !this.isExcluded(path.relative(this.basePath, fullPath))) {
                        await scanDirectory(fullPath);
                    }
                }
            }
            catch (error) {
                // アクセスできないディレクトリは無視
            }
        };
        await scanDirectory(dirPath);
        return files;
    }
    /**
     * 除外パターンをチェック
     */
    isExcluded(relativePath) {
        if (!this.projectStructure) {
            return false;
        }
        const allExclusions = [...this.projectStructure.exclusions, ...this.config.excludePatterns];
        return allExclusions.some(pattern => {
            // グロブパターンを正規表現に変換
            const regexPattern = pattern
                .replace(/\*\*/g, '.*')
                .replace(/\*/g, '[^/]*')
                .replace(/\?/g, '[^/]');
            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(relativePath) || relativePath.includes(pattern);
        });
    }
    /**
     * パスが期待される場所にあるかチェック
     */
    isPathInExpectedLocation(currentDir, expectedDir) {
        // 正規化されたパスで比較
        const normalizedCurrent = path.normalize(currentDir);
        const normalizedExpected = path.normalize(expectedDir);
        return normalizedCurrent.startsWith(normalizedExpected) ||
            normalizedCurrent === normalizedExpected ||
            normalizedCurrent === '.'; // ルートディレクトリの場合
    }
    /**
     * カスタムルール条件を評価
     */
    async evaluateCustomRuleCondition(condition) {
        // 簡単な条件評価の実装
        // 実際の実装では、より複雑な条件評価が必要
        try {
            // 安全な条件評価のための基本的な実装
            if (condition.includes('file_exists')) {
                const match = condition.match(/file_exists\(['"]([^'"]+)['"]\)/);
                if (match) {
                    const filePath = path.join(this.basePath, match[1]);
                    try {
                        await fs.access(filePath);
                        return true;
                    }
                    catch {
                        return false;
                    }
                }
            }
            if (condition.includes('directory_exists')) {
                const match = condition.match(/directory_exists\(['"]([^'"]+)['"]\)/);
                if (match) {
                    const dirPath = path.join(this.basePath, match[1]);
                    try {
                        const stats = await fs.stat(dirPath);
                        return stats.isDirectory();
                    }
                    catch {
                        return false;
                    }
                }
            }
            return false;
        }
        catch (error) {
            console.warn(`カスタムルール条件の評価に失敗: ${condition}`, error);
            return false;
        }
    }
    /**
     * カスタムルールアクションを評価
     */
    async evaluateCustomRuleAction(action) {
        try {
            if (action.includes('require_directory')) {
                const match = action.match(/require_directory\(['"]([^'"]+)['"]\)/);
                if (match) {
                    const dirPath = path.join(this.basePath, match[1]);
                    try {
                        const stats = await fs.stat(dirPath);
                        if (stats.isDirectory()) {
                            return { success: true, message: 'ディレクトリが存在します' };
                        }
                        else {
                            return {
                                success: false,
                                message: 'パスがディレクトリではありません',
                                path: match[1],
                                autoFixable: false
                            };
                        }
                    }
                    catch {
                        return {
                            success: false,
                            message: 'ディレクトリが存在しません',
                            path: match[1],
                            autoFixable: true
                        };
                    }
                }
            }
            return { success: true, message: 'アクション評価完了' };
        }
        catch (error) {
            return {
                success: false,
                message: `アクション評価エラー: ${error.message}`
            };
        }
    }
    /**
     * 構造定義を更新
     */
    async updateStructureDefinition(structure) {
        this.projectStructure = structure;
        try {
            await fs.writeFile(this.config.structureDefinitionPath, JSON.stringify(structure, null, 2));
            console.log('プロジェクト構造定義を更新しました');
        }
        catch (error) {
            console.error('構造定義の保存に失敗しました:', error);
            throw error;
        }
    }
    /**
     * 構造定義を取得
     */
    getStructureDefinition() {
        return this.projectStructure;
    }
    /**
     * 設定を取得
     */
    getConfig() {
        return { ...this.config };
    }
}
exports.DirectoryStructureValidator = DirectoryStructureValidator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGdEQUFrQztBQUNsQywyQ0FBNkI7QUE0QzdCLE1BQWEsMkJBQTJCO0lBQzlCLE1BQU0sQ0FBMkI7SUFDakMsZ0JBQWdCLEdBQTRCLElBQUksQ0FBQztJQUNqRCxRQUFRLENBQVM7SUFFekIsWUFBWSxNQUFnQyxFQUFFLFdBQW1CLElBQUk7UUFDbkUsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDckIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3pDLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxVQUFVO1FBQ2QsSUFBSSxDQUFDO1lBQ0gsa0JBQWtCO1lBQ2xCLE1BQU0sSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7WUFFbEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBQ3RDLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUMzQyxNQUFNLEtBQUssQ0FBQztRQUNkLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsaUJBQWlCO1FBQ3JCLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUMzQixNQUFNLElBQUksS0FBSyxDQUFDLHVCQUF1QixDQUFDLENBQUM7UUFDM0MsQ0FBQztRQUVELE1BQU0sVUFBVSxHQUF5QixFQUFFLENBQUM7UUFDNUMsTUFBTSxXQUFXLEdBQTBCLEVBQUUsQ0FBQztRQUU5QyxPQUFPLENBQUMsR0FBRyxDQUFDLHNCQUFzQixDQUFDLENBQUM7UUFFcEMsZUFBZTtRQUNmLEtB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KiBEaXJlY3RvcnkgU3RydWN0dXJlIFZhbGlkYXRvclxuICog44OH44Kj44Os44Kv44OI44Oq5qeL6YCg5qSc6Ki85qmf6IO9IC0g44OX44Ot44K444Kn44Kv44OI5qeL6YCg44Gu5qSc6Ki844Go6Ieq5YuV5L+u5q2jXG4gKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMvcHJvbWlzZXMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IFByb2plY3RTdHJ1Y3R1cmUsIERpcmVjdG9yeVJ1bGUsIEZpbGVUeXBlUnVsZSwgQ3VzdG9tUnVsZSB9IGZyb20gJy4uLy4uL2ludGVyZmFjZXMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFZhbGlkYXRpb25SZXN1bHQge1xuICB2YWxpZDogYm9vbGVhbjtcbiAgdmlvbGF0aW9uczogU3RydWN0dXJlVmlvbGF0aW9uW107XG4gIHN1Z2dlc3Rpb25zOiBTdHJ1Y3R1cmVTdWdnZXN0aW9uW107XG4gIHN1bW1hcnk6IFZhbGlkYXRpb25TdW1tYXJ5O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN0cnVjdHVyZVZpb2xhdGlvbiB7XG4gIHR5cGU6ICdtaXNzaW5nX2RpcmVjdG9yeScgfCAnaW52YWxpZF9wZXJtaXNzaW9uJyB8ICdzaXplX2V4Y2VlZGVkJyB8ICdjdXN0b21fcnVsZV92aW9sYXRpb24nO1xuICBwYXRoOiBzdHJpbmc7XG4gIHJ1bGU6IERpcmVjdG9yeVJ1bGUgfCBDdXN0b21SdWxlO1xuICBzZXZlcml0eTogJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdpbmZvJztcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgYXV0b0ZpeGFibGU6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3RydWN0dXJlU3VnZ2VzdGlvbiB7XG4gIHR5cGU6ICdjcmVhdGVfZGlyZWN0b3J5JyB8ICdmaXhfcGVybWlzc2lvbicgfCAnbW92ZV9maWxlJyB8ICdjbGVhbnVwJztcbiAgcGF0aDogc3RyaW5nO1xuICBhY3Rpb246IHN0cmluZztcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgcHJpb3JpdHk6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBWYWxpZGF0aW9uU3VtbWFyeSB7XG4gIHRvdGFsRGlyZWN0b3JpZXM6IG51bWJlcjtcbiAgdmFsaWREaXJlY3RvcmllczogbnVtYmVyO1xuICBtaXNzaW5nRGlyZWN0b3JpZXM6IG51bWJlcjtcbiAgdmlvbGF0aW9uQ291bnQ6IG51bWJlcjtcbiAgYXV0b0ZpeGFibGVDb3VudDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN0cnVjdHVyZVZhbGlkYXRvckNvbmZpZyB7XG4gIHN0cnVjdHVyZURlZmluaXRpb25QYXRoOiBzdHJpbmc7XG4gIGF1dG9DcmVhdGVEaXJlY3RvcmllczogYm9vbGVhbjtcbiAgYXV0b0ZpeFBlcm1pc3Npb25zOiBib29sZWFuO1xuICBlbmFibGVDdXN0b21SdWxlczogYm9vbGVhbjtcbiAgbWF4RGlyZWN0b3J5U2l6ZTogbnVtYmVyO1xuICBleGNsdWRlUGF0dGVybnM6IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgY2xhc3MgRGlyZWN0b3J5U3RydWN0dXJlVmFsaWRhdG9yIHtcbiAgcHJpdmF0ZSBjb25maWc6IFN0cnVjdHVyZVZhbGlkYXRvckNvbmZpZztcbiAgcHJpdmF0ZSBwcm9qZWN0U3RydWN0dXJlOiBQcm9qZWN0U3RydWN0dXJlIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgYmFzZVBhdGg6IHN0cmluZztcblxuICBjb25zdHJ1Y3Rvcihjb25maWc6IFN0cnVjdHVyZVZhbGlkYXRvckNvbmZpZywgYmFzZVBhdGg6IHN0cmluZyA9ICcuLycpIHtcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgICB0aGlzLmJhc2VQYXRoID0gcGF0aC5yZXNvbHZlKGJhc2VQYXRoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmp4vpgKDmpJzoqLzmqZ/og73jgpLliJ3mnJ/ljJZcbiAgICovXG4gIGFzeW5jIGluaXRpYWxpemUoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIOODl+ODreOCuOOCp+OCr+ODiOani+mAoOWumue+qeOCkuiqreOBv+i+vOOBv1xuICAgICAgYXdhaXQgdGhpcy5sb2FkUHJvamVjdFN0cnVjdHVyZSgpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZygn44OH44Kj44Os44Kv44OI44Oq5qeL6YCg5qSc6Ki85qmf6IO944KS5Yid5pyf5YyW44GX44G+44GX44GfJyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ+ani+mAoOaknOiovOapn+iDveOBruWIneacn+WMluOBq+WkseaVl+OBl+OBvuOBl+OBnzonLCBlcnJvcik7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44OX44Ot44K444Kn44Kv44OI5qeL6YCg44KS5qSc6Ki8XG4gICAqL1xuICBhc3luYyB2YWxpZGF0ZVN0cnVjdHVyZSgpOiBQcm9taXNlPFZhbGlkYXRpb25SZXN1bHQ+IHtcbiAgICBpZiAoIXRoaXMucHJvamVjdFN0cnVjdHVyZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCfjg5fjg63jgrjjgqfjgq/jg4jmp4vpgKDlrprnvqnjgYzoqq3jgb/ovrzjgb7jgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICB9XG5cbiAgICBjb25zdCB2aW9sYXRpb25zOiBTdHJ1Y3R1cmVWaW9sYXRpb25bXSA9IFtdO1xuICAgIGNvbnN0IHN1Z2dlc3Rpb25zOiBTdHJ1Y3R1cmVTdWdnZXN0aW9uW10gPSBbXTtcblxuICAgIGNvbnNvbGUubG9nKCfjg5fjg63jgrjjgqfjgq/jg4jmp4vpgKDjga7mpJzoqLzjgpLplovlp4vjgZfjgb7jgZkuLi4nKTtcblxuICAgIC8vIOODh+OCo+ODrOOCr+ODiOODquODq+ODvOODq+OBruaknOiovFxuICAgIGZvciAoY29uc3QgZGlyUnVsZSBvZiB0aGlzLnByb2plY3RTdHJ1Y3R1cmUuZGlyZWN0b3JpZXMpIHtcbiAgICAgIGNvbnN0IGRpclZpb2xhdGlvbnMgPSBhd2FpdCB0aGlzLnZhbGlkYXRlRGlyZWN0b3J5UnVsZShkaXJSdWxlKTtcbiAgICAgIHZpb2xhdGlvbnMucHVzaCguLi5kaXJWaW9sYXRpb25zKTtcblxuICAgICAgLy8g6Ieq5YuV5L+u5q2j5Y+v6IO944Gq6YGV5Y+N44Gr5a++44GZ44KL5o+Q5qGI44KS55Sf5oiQXG4gICAgICBmb3IgKGNvbnN0IHZpb2xhdGlvbiBvZiBkaXJWaW9sYXRpb25zKSB7XG4gICAgICAgIGlmICh2aW9sYXRpb24uYXV0b0ZpeGFibGUpIHtcbiAgICAgICAgICBjb25zdCBzdWdnZXN0aW9uID0gdGhpcy5nZW5lcmF0ZVN1Z2dlc3Rpb24odmlvbGF0aW9uKTtcbiAgICAgICAgICBpZiAoc3VnZ2VzdGlvbikge1xuICAgICAgICAgICAgc3VnZ2VzdGlvbnMucHVzaChzdWdnZXN0aW9uKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyDjgqvjgrnjgr/jg6Djg6vjg7zjg6vjga7mpJzoqLxcbiAgICBpZiAodGhpcy5jb25maWcuZW5hYmxlQ3VzdG9tUnVsZXMpIHtcbiAgICAgIGZvciAoY29uc3QgY3VzdG9tUnVsZSBvZiB0aGlzLnByb2plY3RTdHJ1Y3R1cmUuY3VzdG9tUnVsZXMpIHtcbiAgICAgICAgY29uc3QgY3VzdG9tVmlvbGF0aW9ucyA9IGF3YWl0IHRoaXMudmFsaWRhdGVDdXN0b21SdWxlKGN1c3RvbVJ1bGUpO1xuICAgICAgICB2aW9sYXRpb25zLnB1c2goLi4uY3VzdG9tVmlvbGF0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8g44OV44Kh44Kk44Or44K/44Kk44OX44Or44O844Or44Gu5qSc6Ki8XG4gICAgY29uc3QgZmlsZVR5cGVWaW9sYXRpb25zID0gYXdhaXQgdGhpcy52YWxpZGF0ZUZpbGVUeXBlUnVsZXMoKTtcbiAgICB2aW9sYXRpb25zLnB1c2goLi4uZmlsZVR5cGVWaW9sYXRpb25zKTtcblxuICAgIC8vIOaknOiovOe1kOaenOOBruOCteODnuODquODvOOCkueUn+aIkFxuICAgIGNvbnN0IHN1bW1hcnkgPSB0aGlzLmdlbmVyYXRlVmFsaWRhdGlvblN1bW1hcnkodmlvbGF0aW9ucyk7XG5cbiAgICBjb25zdCByZXN1bHQ6IFZhbGlkYXRpb25SZXN1bHQgPSB7XG4gICAgICB2YWxpZDogdmlvbGF0aW9ucy5maWx0ZXIodiA9PiB2LnNldmVyaXR5ID09PSAnZXJyb3InKS5sZW5ndGggPT09IDAsXG4gICAgICB2aW9sYXRpb25zLFxuICAgICAgc3VnZ2VzdGlvbnMsXG4gICAgICBzdW1tYXJ5XG4gICAgfTtcblxuICAgIGNvbnNvbGUubG9nKGDmp4vpgKDmpJzoqLzlrozkuoY6ICR7dmlvbGF0aW9ucy5sZW5ndGh9IOS7tuOBrumBleWPjeOCkuaknOWHumApO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICog44OH44Kj44Os44Kv44OI44Oq44Or44O844Or44KS5qSc6Ki8XG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHZhbGlkYXRlRGlyZWN0b3J5UnVsZShydWxlOiBEaXJlY3RvcnlSdWxlKTogUHJvbWlzZTxTdHJ1Y3R1cmVWaW9sYXRpb25bXT4ge1xuICAgIGNvbnN0IHZpb2xhdGlvbnM6IFN0cnVjdHVyZVZpb2xhdGlvbltdID0gW107XG4gICAgY29uc3QgZnVsbFBhdGggPSBwYXRoLmpvaW4odGhpcy5iYXNlUGF0aCwgcnVsZS5wYXRoKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBzdGF0cyA9IGF3YWl0IGZzLnN0YXQoZnVsbFBhdGgpO1xuXG4gICAgICBpZiAoIXN0YXRzLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgdmlvbGF0aW9ucy5wdXNoKHtcbiAgICAgICAgICB0eXBlOiAnbWlzc2luZ19kaXJlY3RvcnknLFxuICAgICAgICAgIHBhdGg6IHJ1bGUucGF0aCxcbiAgICAgICAgICBydWxlLFxuICAgICAgICAgIHNldmVyaXR5OiBydWxlLnJlcXVpcmVkID8gJ2Vycm9yJyA6ICd3YXJuaW5nJyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogYOODkeOCueOBjOODh+OCo+ODrOOCr+ODiOODquOBp+OBr+OBguOCiuOBvuOBm+OCkzogJHtydWxlLnBhdGh9YCxcbiAgICAgICAgICBhdXRvRml4YWJsZTogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB2aW9sYXRpb25zO1xuICAgICAgfVxuXG4gICAgICAvLyDjg5Hjg7zjg5/jg4Pjgrfjg6fjg7Pjga7mpJzoqLxcbiAgICAgIGlmIChydWxlLnBlcm1pc3Npb25zKSB7XG4gICAgICAgIGNvbnN0IHBlcm1pc3Npb25WaW9sYXRpb24gPSBhd2FpdCB0aGlzLnZhbGlkYXRlUGVybWlzc2lvbnMoZnVsbFBhdGgsIHJ1bGUpO1xuICAgICAgICBpZiAocGVybWlzc2lvblZpb2xhdGlvbikge1xuICAgICAgICAgIHZpb2xhdGlvbnMucHVzaChwZXJtaXNzaW9uVmlvbGF0aW9uKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyDjgrXjgqTjgrrliLbpmZDjga7mpJzoqLxcbiAgICAgIGlmIChydWxlLm1heFNpemUpIHtcbiAgICAgICAgY29uc3Qgc2l6ZVZpb2xhdGlvbiA9IGF3YWl0IHRoaXMudmFsaWRhdGVEaXJlY3RvcnlTaXplKGZ1bGxQYXRoLCBydWxlKTtcbiAgICAgICAgaWYgKHNpemVWaW9sYXRpb24pIHtcbiAgICAgICAgICB2aW9sYXRpb25zLnB1c2goc2l6ZVZpb2xhdGlvbik7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBpZiAoKGVycm9yIGFzIE5vZGVKUy5FcnJub0V4Y2VwdGlvbikuY29kZSA9PT0gJ0VOT0VOVCcpIHtcbiAgICAgICAgLy8g44OH44Kj44Os44Kv44OI44Oq44GM5a2Y5Zyo44GX44Gq44GEXG4gICAgICAgIHZpb2xhdGlvbnMucHVzaCh7XG4gICAgICAgICAgdHlwZTogJ21pc3NpbmdfZGlyZWN0b3J5JyxcbiAgICAgICAgICBwYXRoOiBydWxlLnBhdGgsXG4gICAgICAgICAgcnVsZSxcbiAgICAgICAgICBzZXZlcml0eTogcnVsZS5yZXF1aXJlZCA/ICdlcnJvcicgOiAnd2FybmluZycsXG4gICAgICAgICAgZGVzY3JpcHRpb246IGDlv4XpoIjjg4fjgqPjg6zjgq/jg4jjg6rjgYzlrZjlnKjjgZfjgb7jgZvjgpM6ICR7cnVsZS5wYXRofSAoJHtydWxlLnB1cnBvc2V9KWAsXG4gICAgICAgICAgYXV0b0ZpeGFibGU6IHRoaXMuY29uZmlnLmF1dG9DcmVhdGVEaXJlY3Rvcmllc1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZpb2xhdGlvbnMucHVzaCh7XG4gICAgICAgICAgdHlwZTogJ21pc3NpbmdfZGlyZWN0b3J5JyxcbiAgICAgICAgICBwYXRoOiBydWxlLnBhdGgsXG4gICAgICAgICAgcnVsZSxcbiAgICAgICAgICBzZXZlcml0eTogJ2Vycm9yJyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogYOODh+OCo+ODrOOCr+ODiOODquOCouOCr+OCu+OCueOCqOODqeODvDogJHtydWxlLnBhdGh9IC0gJHsoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2V9YCxcbiAgICAgICAgICBhdXRvRml4YWJsZTogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHZpb2xhdGlvbnM7XG4gIH1cblxuICAvKipcbiAgICog44OR44O844Of44OD44K344On44Oz44KS5qSc6Ki8XG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHZhbGlkYXRlUGVybWlzc2lvbnMoZGlyUGF0aDogc3RyaW5nLCBydWxlOiBEaXJlY3RvcnlSdWxlKTogUHJvbWlzZTxTdHJ1Y3R1cmVWaW9sYXRpb24gfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHN0YXRzID0gYXdhaXQgZnMuc3RhdChkaXJQYXRoKTtcbiAgICAgIGNvbnN0IGN1cnJlbnRNb2RlID0gKHN0YXRzLm1vZGUgJiBwYXJzZUludCgnNzc3JywgOCkpLnRvU3RyaW5nKDgpO1xuICAgICAgY29uc3QgZXhwZWN0ZWRNb2RlID0gcnVsZS5wZXJtaXNzaW9ucztcblxuICAgICAgaWYgKGN1cnJlbnRNb2RlICE9PSBleHBlY3RlZE1vZGUpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB0eXBlOiAnaW52YWxpZF9wZXJtaXNzaW9uJyxcbiAgICAgICAgICBwYXRoOiBydWxlLnBhdGgsXG4gICAgICAgICAgcnVsZSxcbiAgICAgICAgICBzZXZlcml0eTogJ3dhcm5pbmcnLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBg44OR44O844Of44OD44K344On44Oz44GM5q2j44GX44GP44GC44KK44G+44Gb44KTOiAke3J1bGUucGF0aH0gKOePvuWcqDogJHtjdXJyZW50TW9kZX0sIOacn+W+heWApDogJHtleHBlY3RlZE1vZGV9KWAsXG4gICAgICAgICAgYXV0b0ZpeGFibGU6IHRoaXMuY29uZmlnLmF1dG9GaXhQZXJtaXNzaW9uc1xuICAgICAgICB9O1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlOiAnaW52YWxpZF9wZXJtaXNzaW9uJyxcbiAgICAgICAgcGF0aDogcnVsZS5wYXRoLFxuICAgICAgICBydWxlLFxuICAgICAgICBzZXZlcml0eTogJ2Vycm9yJyxcbiAgICAgICAgZGVzY3JpcHRpb246IGDjg5Hjg7zjg5/jg4Pjgrfjg6fjg7Pnorroqo3jgqjjg6njg7w6ICR7cnVsZS5wYXRofSAtICR7KGVycm9yIGFzIEVycm9yKS5tZXNzYWdlfWAsXG4gICAgICAgIGF1dG9GaXhhYmxlOiBmYWxzZVxuICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg4fjgqPjg6zjgq/jg4jjg6rjgrXjgqTjgrrjgpLmpJzoqLxcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgdmFsaWRhdGVEaXJlY3RvcnlTaXplKGRpclBhdGg6IHN0cmluZywgcnVsZTogRGlyZWN0b3J5UnVsZSk6IFByb21pc2U8U3RydWN0dXJlVmlvbGF0aW9uIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzaXplID0gYXdhaXQgdGhpcy5jYWxjdWxhdGVEaXJlY3RvcnlTaXplKGRpclBhdGgpO1xuICAgICAgY29uc3QgbWF4U2l6ZUJ5dGVzID0gKHJ1bGUubWF4U2l6ZSB8fCAwKSAqIDEwMjQgKiAxMDI0OyAvLyBNQiB0byBieXRlc1xuXG4gICAgICBpZiAoc2l6ZSA+IG1heFNpemVCeXRlcykge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHR5cGU6ICdzaXplX2V4Y2VlZGVkJyxcbiAgICAgICAgICBwYXRoOiBydWxlLnBhdGgsXG4gICAgICAgICAgcnVsZSxcbiAgICAgICAgICBzZXZlcml0eTogJ3dhcm5pbmcnLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBg44OH44Kj44Os44Kv44OI44Oq44K144Kk44K644GM5Yi26ZmQ44KS6LaF6YGOOiAke3J1bGUucGF0aH0gKCR7TWF0aC5yb3VuZChzaXplIC8gMTAyNCAvIDEwMjQpfU1CID4gJHtydWxlLm1heFNpemV9TUIpYCxcbiAgICAgICAgICBhdXRvRml4YWJsZTogZmFsc2VcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZTogJ3NpemVfZXhjZWVkZWQnLFxuICAgICAgICBwYXRoOiBydWxlLnBhdGgsXG4gICAgICAgIHJ1bGUsXG4gICAgICAgIHNldmVyaXR5OiAnZXJyb3InLFxuICAgICAgICBkZXNjcmlwdGlvbjogYOOCteOCpOOCuuioiOeul+OCqOODqeODvDogJHtydWxlLnBhdGh9IC0gJHsoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2V9YCxcbiAgICAgICAgYXV0b0ZpeGFibGU6IGZhbHNlXG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCq+OCueOCv+ODoOODq+ODvOODq+OCkuaknOiovFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyB2YWxpZGF0ZUN1c3RvbVJ1bGUocnVsZTogQ3VzdG9tUnVsZSk6IFByb21pc2U8U3RydWN0dXJlVmlvbGF0aW9uW10+IHtcbiAgICBjb25zdCB2aW9sYXRpb25zOiBTdHJ1Y3R1cmVWaW9sYXRpb25bXSA9IFtdO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIOOCq+OCueOCv+ODoOODq+ODvOODq+OBruadoeS7tuOCkuipleS+oVxuICAgICAgY29uc3QgY29uZGl0aW9uTWV0ID0gYXdhaXQgdGhpcy5ldmFsdWF0ZUN1c3RvbVJ1bGVDb25kaXRpb24ocnVsZS5jb25kaXRpb24pO1xuXG4gICAgICBpZiAoY29uZGl0aW9uTWV0KSB7XG4gICAgICAgIC8vIOOCouOCr+OCt+ODp+ODs+OBjOW/heimgeOBquWgtOWQiOOBruWHpueQhlxuICAgICAgICBjb25zdCBhY3Rpb25SZXN1bHQgPSBhd2FpdCB0aGlzLmV2YWx1YXRlQ3VzdG9tUnVsZUFjdGlvbihydWxlLmFjdGlvbik7XG5cbiAgICAgICAgaWYgKCFhY3Rpb25SZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgIHZpb2xhdGlvbnMucHVzaCh7XG4gICAgICAgICAgICB0eXBlOiAnY3VzdG9tX3J1bGVfdmlvbGF0aW9uJyxcbiAgICAgICAgICAgIHBhdGg6IGFjdGlvblJlc3VsdC5wYXRoIHx8ICcnLFxuICAgICAgICAgICAgcnVsZSxcbiAgICAgICAgICAgIHNldmVyaXR5OiBydWxlLnByaW9yaXR5ID4gNSA/ICdlcnJvcicgOiAnd2FybmluZycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYOOCq+OCueOCv+ODoOODq+ODvOODq+mBleWPjTogJHtydWxlLm5hbWV9IC0gJHthY3Rpb25SZXN1bHQubWVzc2FnZX1gLFxuICAgICAgICAgICAgYXV0b0ZpeGFibGU6IGFjdGlvblJlc3VsdC5hdXRvRml4YWJsZSB8fCBmYWxzZVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHZpb2xhdGlvbnMucHVzaCh7XG4gICAgICAgIHR5cGU6ICdjdXN0b21fcnVsZV92aW9sYXRpb24nLFxuICAgICAgICBwYXRoOiAnJyxcbiAgICAgICAgcnVsZSxcbiAgICAgICAgc2V2ZXJpdHk6ICdlcnJvcicsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBg44Kr44K544K/44Og44Or44O844Or6KmV5L6h44Ko44Op44O8OiAke3J1bGUubmFtZX0gLSAkeyhlcnJvciBhcyBFcnJvcikubWVzc2FnZX1gLFxuICAgICAgICBhdXRvRml4YWJsZTogZmFsc2VcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiB2aW9sYXRpb25zO1xuICB9XG5cbiAgLyoqXG4gICAqIOODleOCoeOCpOODq+OCv+OCpOODl+ODq+ODvOODq+OCkuaknOiovFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyB2YWxpZGF0ZUZpbGVUeXBlUnVsZXMoKTogUHJvbWlzZTxTdHJ1Y3R1cmVWaW9sYXRpb25bXT4ge1xuICAgIGNvbnN0IHZpb2xhdGlvbnM6IFN0cnVjdHVyZVZpb2xhdGlvbltdID0gW107XG5cbiAgICBpZiAoIXRoaXMucHJvamVjdFN0cnVjdHVyZSkge1xuICAgICAgcmV0dXJuIHZpb2xhdGlvbnM7XG4gICAgfVxuXG4gICAgLy8g44OX44Ot44K444Kn44Kv44OI5YaF44Gu5YWo44OV44Kh44Kk44Or44KS44K544Kt44Oj44OzXG4gICAgY29uc3QgYWxsRmlsZXMgPSBhd2FpdCB0aGlzLnNjYW5BbGxGaWxlcyh0aGlzLmJhc2VQYXRoKTtcblxuICAgIGZvciAoY29uc3QgZmlsZVBhdGggb2YgYWxsRmlsZXMpIHtcbiAgICAgIGNvbnN0IHJlbGF0aXZlUGF0aCA9IHBhdGgucmVsYXRpdmUodGhpcy5iYXNlUGF0aCwgZmlsZVBhdGgpO1xuICAgICAgY29uc3QgZXh0ZW5zaW9uID0gcGF0aC5leHRuYW1lKGZpbGVQYXRoKS50b0xvd2VyQ2FzZSgpO1xuXG4gICAgICAvLyDpmaTlpJbjg5Hjgr/jg7zjg7Pjga7jg4Hjgqfjg4Pjgq9cbiAgICAgIGlmICh0aGlzLmlzRXhjbHVkZWQocmVsYXRpdmVQYXRoKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8g5a++5b+c44GZ44KL44OV44Kh44Kk44Or44K/44Kk44OX44Or44O844Or44KS5qSc57SiXG4gICAgICBjb25zdCBmaWxlVHlwZVJ1bGUgPSB0aGlzLnByb2plY3RTdHJ1Y3R1cmUuZmlsZVR5cGVzLmZpbmQocnVsZSA9PiBcbiAgICAgICAgcnVsZS5leHRlbnNpb24gPT09IGV4dGVuc2lvblxuICAgICAgKTtcblxuICAgICAgaWYgKGZpbGVUeXBlUnVsZSkge1xuICAgICAgICAvLyDjg5XjgqHjgqTjg6vjgYzmraPjgZfjgYTjg4fjgqPjg6zjgq/jg4jjg6rjgavjgYLjgovjgYvjg4Hjgqfjg4Pjgq9cbiAgICAgICAgY29uc3QgZXhwZWN0ZWREaXIgPSBmaWxlVHlwZVJ1bGUuZGVmYXVsdFBhdGg7XG4gICAgICAgIGNvbnN0IGN1cnJlbnREaXIgPSBwYXRoLmRpcm5hbWUocmVsYXRpdmVQYXRoKTtcblxuICAgICAgICBpZiAoIXRoaXMuaXNQYXRoSW5FeHBlY3RlZExvY2F0aW9uKGN1cnJlbnREaXIsIGV4cGVjdGVkRGlyKSkge1xuICAgICAgICAgIHZpb2xhdGlvbnMucHVzaCh7XG4gICAgICAgICAgICB0eXBlOiAnY3VzdG9tX3J1bGVfdmlvbGF0aW9uJyxcbiAgICAgICAgICAgIHBhdGg6IHJlbGF0aXZlUGF0aCxcbiAgICAgICAgICAgIHJ1bGU6IGZpbGVUeXBlUnVsZSBhcyBhbnksXG4gICAgICAgICAgICBzZXZlcml0eTogJ2luZm8nLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGDjg5XjgqHjgqTjg6vjgYzmjqjlpajjg4fjgqPjg6zjgq/jg4jjg6rjgavjgYLjgorjgb7jgZvjgpM6ICR7cmVsYXRpdmVQYXRofSAo5o6o5aWoOiAke2V4cGVjdGVkRGlyfSlgLFxuICAgICAgICAgICAgYXV0b0ZpeGFibGU6IHRydWVcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB2aW9sYXRpb25zO1xuICB9XG5cbiAgLyoqXG4gICAqIOmBleWPjeOBq+WvvuOBmeOCi+S/ruato+aPkOahiOOCkueUn+aIkFxuICAgKi9cbiAgcHJpdmF0ZSBnZW5lcmF0ZVN1Z2dlc3Rpb24odmlvbGF0aW9uOiBTdHJ1Y3R1cmVWaW9sYXRpb24pOiBTdHJ1Y3R1cmVTdWdnZXN0aW9uIHwgbnVsbCB7XG4gICAgc3dpdGNoICh2aW9sYXRpb24udHlwZSkge1xuICAgICAgY2FzZSAnbWlzc2luZ19kaXJlY3RvcnknOlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHR5cGU6ICdjcmVhdGVfZGlyZWN0b3J5JyxcbiAgICAgICAgICBwYXRoOiB2aW9sYXRpb24ucGF0aCxcbiAgICAgICAgICBhY3Rpb246IGBta2RpciAtcCAke3Zpb2xhdGlvbi5wYXRofWAsXG4gICAgICAgICAgZGVzY3JpcHRpb246IGDlv4XpoIjjg4fjgqPjg6zjgq/jg4jjg6rjgpLkvZzmiJA6ICR7dmlvbGF0aW9uLnBhdGh9YCxcbiAgICAgICAgICBwcmlvcml0eTogdmlvbGF0aW9uLnNldmVyaXR5ID09PSAnZXJyb3InID8gMSA6IDJcbiAgICAgICAgfTtcblxuICAgICAgY2FzZSAnaW52YWxpZF9wZXJtaXNzaW9uJzpcbiAgICAgICAgY29uc3QgcnVsZSA9IHZpb2xhdGlvbi5ydWxlIGFzIERpcmVjdG9yeVJ1bGU7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdHlwZTogJ2ZpeF9wZXJtaXNzaW9uJyxcbiAgICAgICAgICBwYXRoOiB2aW9sYXRpb24ucGF0aCxcbiAgICAgICAgICBhY3Rpb246IGBjaG1vZCAke3J1bGUucGVybWlzc2lvbnN9ICR7dmlvbGF0aW9uLnBhdGh9YCxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogYOODkeODvOODn+ODg+OCt+ODp+ODs+OCkuS/ruatozogJHt2aW9sYXRpb24ucGF0aH0g4oaSICR7cnVsZS5wZXJtaXNzaW9uc31gLFxuICAgICAgICAgIHByaW9yaXR5OiAyXG4gICAgICAgIH07XG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDoh6rli5Xkv67mraPjgpLlrp/ooYxcbiAgICovXG4gIGFzeW5jIGF1dG9GaXgoc3VnZ2VzdGlvbnM6IFN0cnVjdHVyZVN1Z2dlc3Rpb25bXSk6IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuOyByZXN1bHRzOiBzdHJpbmdbXSB9PiB7XG4gICAgY29uc3QgcmVzdWx0czogc3RyaW5nW10gPSBbXTtcbiAgICBsZXQgYWxsU3VjY2VzcyA9IHRydWU7XG5cbiAgICAvLyDlhKrlhYjluqbpoIbjgavjgr3jg7zjg4hcbiAgICBjb25zdCBzb3J0ZWRTdWdnZXN0aW9ucyA9IHN1Z2dlc3Rpb25zLnNvcnQoKGEsIGIpID0+IGEucHJpb3JpdHkgLSBiLnByaW9yaXR5KTtcblxuICAgIGZvciAoY29uc3Qgc3VnZ2VzdGlvbiBvZiBzb3J0ZWRTdWdnZXN0aW9ucykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc3VjY2VzcyA9IGF3YWl0IHRoaXMuZXhlY3V0ZVN1Z2dlc3Rpb24oc3VnZ2VzdGlvbik7XG4gICAgICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICAgICAgcmVzdWx0cy5wdXNoKGDinIUgJHtzdWdnZXN0aW9uLmRlc2NyaXB0aW9ufWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc3VsdHMucHVzaChg4p2MICR7c3VnZ2VzdGlvbi5kZXNjcmlwdGlvbn0gLSDlrp/ooYzlpLHmlZdgKTtcbiAgICAgICAgICBhbGxTdWNjZXNzID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHJlc3VsdHMucHVzaChg4p2MICR7c3VnZ2VzdGlvbi5kZXNjcmlwdGlvbn0gLSDjgqjjg6njg7w6ICR7KGVycm9yIGFzIEVycm9yKS5tZXNzYWdlfWApO1xuICAgICAgICBhbGxTdWNjZXNzID0gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgc3VjY2VzczogYWxsU3VjY2VzcywgcmVzdWx0cyB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOS/ruato+aPkOahiOOCkuWun+ihjFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBleGVjdXRlU3VnZ2VzdGlvbihzdWdnZXN0aW9uOiBTdHJ1Y3R1cmVTdWdnZXN0aW9uKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgY29uc3QgZnVsbFBhdGggPSBwYXRoLmpvaW4odGhpcy5iYXNlUGF0aCwgc3VnZ2VzdGlvbi5wYXRoKTtcblxuICAgIHN3aXRjaCAoc3VnZ2VzdGlvbi50eXBlKSB7XG4gICAgICBjYXNlICdjcmVhdGVfZGlyZWN0b3J5JzpcbiAgICAgICAgYXdhaXQgZnMubWtkaXIoZnVsbFBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICBjb25zb2xlLmxvZyhg44OH44Kj44Os44Kv44OI44Oq44KS5L2c5oiQ44GX44G+44GX44GfOiAke3N1Z2dlc3Rpb24ucGF0aH1gKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICAgIGNhc2UgJ2ZpeF9wZXJtaXNzaW9uJzpcbiAgICAgICAgLy8g44OR44O844Of44OD44K344On44Oz5L+u5q2j44Gu5a6f6KOFXG4gICAgICAgIGNvbnN0IG1hdGNoID0gc3VnZ2VzdGlvbi5hY3Rpb24ubWF0Y2goL2NobW9kIChcXGQrKS8pO1xuICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICBjb25zdCBtb2RlID0gcGFyc2VJbnQobWF0Y2hbMV0sIDgpO1xuICAgICAgICAgIGF3YWl0IGZzLmNobW9kKGZ1bGxQYXRoLCBtb2RlKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhg44OR44O844Of44OD44K344On44Oz44KS5L+u5q2j44GX44G+44GX44GfOiAke3N1Z2dlc3Rpb24ucGF0aH0g4oaSICR7bWF0Y2hbMV19YCk7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICBjYXNlICdtb3ZlX2ZpbGUnOlxuICAgICAgICAvLyDjg5XjgqHjgqTjg6vnp7vli5Xjga7lrp/oo4XvvIjlv4XopoHjgavlv5zjgZjjgabvvIlcbiAgICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44OX44Ot44K444Kn44Kv44OI5qeL6YCg5a6a576p44KS6Kqt44G/6L6844G/XG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGxvYWRQcm9qZWN0U3RydWN0dXJlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzdHJ1Y3R1cmVEYXRhID0gYXdhaXQgZnMucmVhZEZpbGUodGhpcy5jb25maWcuc3RydWN0dXJlRGVmaW5pdGlvblBhdGgsICd1dGYtOCcpO1xuICAgICAgdGhpcy5wcm9qZWN0U3RydWN0dXJlID0gSlNPTi5wYXJzZShzdHJ1Y3R1cmVEYXRhKTtcbiAgICAgIGNvbnNvbGUubG9nKCfjg5fjg63jgrjjgqfjgq/jg4jmp4vpgKDlrprnvqnjgpLoqq3jgb/ovrzjgb/jgb7jgZfjgZ8nKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS53YXJuKGDmp4vpgKDlrprnvqnjg5XjgqHjgqTjg6vjga7oqq3jgb/ovrzjgb/jgavlpLHmlZc6ICR7dGhpcy5jb25maWcuc3RydWN0dXJlRGVmaW5pdGlvblBhdGh9YCk7XG4gICAgICB0aGlzLnByb2plY3RTdHJ1Y3R1cmUgPSB0aGlzLmdldERlZmF1bHRQcm9qZWN0U3RydWN0dXJlKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODh+ODleOCqeODq+ODiOODl+ODreOCuOOCp+OCr+ODiOani+mAoOOCkuWPluW+l1xuICAgKi9cbiAgcHJpdmF0ZSBnZXREZWZhdWx0UHJvamVjdFN0cnVjdHVyZSgpOiBQcm9qZWN0U3RydWN0dXJlIHtcbiAgICByZXR1cm4ge1xuICAgICAgdmVyc2lvbjogJzEuMC4wJyxcbiAgICAgIGRpcmVjdG9yaWVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBwYXRoOiAnbGliJyxcbiAgICAgICAgICBwdXJwb3NlOiAnVHlwZVNjcmlwdCBzb3VyY2UgY29kZScsXG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgcGVybWlzc2lvbnM6ICc3NTUnXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBwYXRoOiAndGVzdHMnLFxuICAgICAgICAgIHB1cnBvc2U6ICdUZXN0IGZpbGVzJyxcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICBwZXJtaXNzaW9uczogJzc1NSdcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHBhdGg6ICdjb25maWcnLFxuICAgICAgICAgIHB1cnBvc2U6ICdDb25maWd1cmF0aW9uIGZpbGVzJyxcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICBwZXJtaXNzaW9uczogJzc1NSdcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHBhdGg6ICdkb2NzJyxcbiAgICAgICAgICBwdXJwb3NlOiAnRG9jdW1lbnRhdGlvbicsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHBlcm1pc3Npb25zOiAnNzU1J1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgcGF0aDogJ3NjcmlwdHMnLFxuICAgICAgICAgIHB1cnBvc2U6ICdCdWlsZCBhbmQgdXRpbGl0eSBzY3JpcHRzJyxcbiAgICAgICAgICByZXF1aXJlZDogZmFsc2UsXG4gICAgICAgICAgcGVybWlzc2lvbnM6ICc3NTUnXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBwYXRoOiAnZGV2ZWxvcG1lbnQnLFxuICAgICAgICAgIHB1cnBvc2U6ICdEZXZlbG9wbWVudCB0b29scyBhbmQgc2NyaXB0cycsXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICAgIHBlcm1pc3Npb25zOiAnNzU1J1xuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgZmlsZVR5cGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBleHRlbnNpb246ICcudHMnLFxuICAgICAgICAgIGNhdGVnb3J5OiAndHlwZXNjcmlwdCcsXG4gICAgICAgICAgZGVmYXVsdFBhdGg6ICdsaWInLFxuICAgICAgICAgIHJ1bGVzOiBbJ011c3QgYmUgaW4gbGliLyBkaXJlY3RvcnknXVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgZXh0ZW5zaW9uOiAnLnRlc3QudHMnLFxuICAgICAgICAgIGNhdGVnb3J5OiAndGVzdCcsXG4gICAgICAgICAgZGVmYXVsdFBhdGg6ICd0ZXN0cycsXG4gICAgICAgICAgcnVsZXM6IFsnTXVzdCBiZSBpbiB0ZXN0cy8gZGlyZWN0b3J5J11cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGV4dGVuc2lvbjogJy5qc29uJyxcbiAgICAgICAgICBjYXRlZ29yeTogJ2NvbmZpZycsXG4gICAgICAgICAgZGVmYXVsdFBhdGg6ICdjb25maWcnLFxuICAgICAgICAgIHJ1bGVzOiBbJ0NvbmZpZ3VyYXRpb24gZmlsZXMgc2hvdWxkIGJlIGluIGNvbmZpZy8nXVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgZXh0ZW5zaW9uOiAnLm1kJyxcbiAgICAgICAgICBjYXRlZ29yeTogJ2RvY3VtZW50YXRpb24nLFxuICAgICAgICAgIGRlZmF1bHRQYXRoOiAnZG9jcycsXG4gICAgICAgICAgcnVsZXM6IFsnRG9jdW1lbnRhdGlvbiBzaG91bGQgYmUgaW4gZG9jcy8nXVxuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgZXhjbHVzaW9uczogW1xuICAgICAgICAnbm9kZV9tb2R1bGVzJyxcbiAgICAgICAgJy5naXQnLFxuICAgICAgICAnY2RrLm91dCcsXG4gICAgICAgICcqLmxvZycsXG4gICAgICAgICcuRFNfU3RvcmUnXG4gICAgICBdLFxuICAgICAgY3VzdG9tUnVsZXM6IFtdXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmpJzoqLzjgrXjg57jg6rjg7zjgpLnlJ/miJBcbiAgICovXG4gIHByaXZhdGUgZ2VuZXJhdGVWYWxpZGF0aW9uU3VtbWFyeSh2aW9sYXRpb25zOiBTdHJ1Y3R1cmVWaW9sYXRpb25bXSk6IFZhbGlkYXRpb25TdW1tYXJ5IHtcbiAgICBjb25zdCBlcnJvckNvdW50ID0gdmlvbGF0aW9ucy5maWx0ZXIodiA9PiB2LnNldmVyaXR5ID09PSAnZXJyb3InKS5sZW5ndGg7XG4gICAgY29uc3Qgd2FybmluZ0NvdW50ID0gdmlvbGF0aW9ucy5maWx0ZXIodiA9PiB2LnNldmVyaXR5ID09PSAnd2FybmluZycpLmxlbmd0aDtcbiAgICBjb25zdCBhdXRvRml4YWJsZUNvdW50ID0gdmlvbGF0aW9ucy5maWx0ZXIodiA9PiB2LmF1dG9GaXhhYmxlKS5sZW5ndGg7XG5cbiAgICByZXR1cm4ge1xuICAgICAgdG90YWxEaXJlY3RvcmllczogdGhpcy5wcm9qZWN0U3RydWN0dXJlPy5kaXJlY3Rvcmllcy5sZW5ndGggfHwgMCxcbiAgICAgIHZhbGlkRGlyZWN0b3JpZXM6ICh0aGlzLnByb2plY3RTdHJ1Y3R1cmU/LmRpcmVjdG9yaWVzLmxlbmd0aCB8fCAwKSAtIHZpb2xhdGlvbnMuZmlsdGVyKHYgPT4gdi50eXBlID09PSAnbWlzc2luZ19kaXJlY3RvcnknKS5sZW5ndGgsXG4gICAgICBtaXNzaW5nRGlyZWN0b3JpZXM6IHZpb2xhdGlvbnMuZmlsdGVyKHYgPT4gdi50eXBlID09PSAnbWlzc2luZ19kaXJlY3RvcnknKS5sZW5ndGgsXG4gICAgICB2aW9sYXRpb25Db3VudDogdmlvbGF0aW9ucy5sZW5ndGgsXG4gICAgICBhdXRvRml4YWJsZUNvdW50XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg4fjgqPjg6zjgq/jg4jjg6rjgrXjgqTjgrrjgpLoqIjnrpdcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgY2FsY3VsYXRlRGlyZWN0b3J5U2l6ZShkaXJQYXRoOiBzdHJpbmcpOiBQcm9taXNlPG51bWJlcj4ge1xuICAgIGxldCB0b3RhbFNpemUgPSAwO1xuXG4gICAgY29uc3QgY2FsY3VsYXRlU2l6ZSA9IGFzeW5jIChjdXJyZW50UGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBlbnRyaWVzID0gYXdhaXQgZnMucmVhZGRpcihjdXJyZW50UGF0aCwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pO1xuXG4gICAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgZW50cmllcykge1xuICAgICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKGN1cnJlbnRQYXRoLCBlbnRyeS5uYW1lKTtcblxuICAgICAgICAgIGlmIChlbnRyeS5pc0ZpbGUoKSkge1xuICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBmcy5zdGF0KGZ1bGxQYXRoKTtcbiAgICAgICAgICAgIHRvdGFsU2l6ZSArPSBzdGF0cy5zaXplO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZW50cnkuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgICAgYXdhaXQgY2FsY3VsYXRlU2l6ZShmdWxsUGF0aCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyDjgqLjgq/jgrvjgrnjgafjgY3jgarjgYTjg4fjgqPjg6zjgq/jg4jjg6rjga/nhKHoppZcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgYXdhaXQgY2FsY3VsYXRlU2l6ZShkaXJQYXRoKTtcbiAgICByZXR1cm4gdG90YWxTaXplO1xuICB9XG5cbiAgLyoqXG4gICAqIOWFqOODleOCoeOCpOODq+OCkuOCueOCreODo+ODs1xuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBzY2FuQWxsRmlsZXMoZGlyUGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgIGNvbnN0IGZpbGVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgY29uc3Qgc2NhbkRpcmVjdG9yeSA9IGFzeW5jIChjdXJyZW50UGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBlbnRyaWVzID0gYXdhaXQgZnMucmVhZGRpcihjdXJyZW50UGF0aCwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pO1xuXG4gICAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgZW50cmllcykge1xuICAgICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKGN1cnJlbnRQYXRoLCBlbnRyeS5uYW1lKTtcblxuICAgICAgICAgIGlmIChlbnRyeS5pc0ZpbGUoKSkge1xuICAgICAgICAgICAgZmlsZXMucHVzaChmdWxsUGF0aCk7XG4gICAgICAgICAgfSBlbHNlIGlmIChlbnRyeS5pc0RpcmVjdG9yeSgpICYmICF0aGlzLmlzRXhjbHVkZWQocGF0aC5yZWxhdGl2ZSh0aGlzLmJhc2VQYXRoLCBmdWxsUGF0aCkpKSB7XG4gICAgICAgICAgICBhd2FpdCBzY2FuRGlyZWN0b3J5KGZ1bGxQYXRoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIOOCouOCr+OCu+OCueOBp+OBjeOBquOBhOODh+OCo+ODrOOCr+ODiOODquOBr+eEoeimllxuICAgICAgfVxuICAgIH07XG5cbiAgICBhd2FpdCBzY2FuRGlyZWN0b3J5KGRpclBhdGgpO1xuICAgIHJldHVybiBmaWxlcztcbiAgfVxuXG4gIC8qKlxuICAgKiDpmaTlpJbjg5Hjgr/jg7zjg7PjgpLjg4Hjgqfjg4Pjgq9cbiAgICovXG4gIHByaXZhdGUgaXNFeGNsdWRlZChyZWxhdGl2ZVBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGlmICghdGhpcy5wcm9qZWN0U3RydWN0dXJlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3QgYWxsRXhjbHVzaW9ucyA9IFsuLi50aGlzLnByb2plY3RTdHJ1Y3R1cmUuZXhjbHVzaW9ucywgLi4udGhpcy5jb25maWcuZXhjbHVkZVBhdHRlcm5zXTtcblxuICAgIHJldHVybiBhbGxFeGNsdXNpb25zLnNvbWUocGF0dGVybiA9PiB7XG4gICAgICAvLyDjgrDjg63jg5bjg5Hjgr/jg7zjg7PjgpLmraPopo/ooajnj77jgavlpInmj5tcbiAgICAgIGNvbnN0IHJlZ2V4UGF0dGVybiA9IHBhdHRlcm5cbiAgICAgICAgLnJlcGxhY2UoL1xcKlxcKi9nLCAnLionKVxuICAgICAgICAucmVwbGFjZSgvXFwqL2csICdbXi9dKicpXG4gICAgICAgIC5yZXBsYWNlKC9cXD8vZywgJ1teL10nKTtcblxuICAgICAgY29uc3QgcmVnZXggPSBuZXcgUmVnRXhwKGBeJHtyZWdleFBhdHRlcm59JGApO1xuICAgICAgcmV0dXJuIHJlZ2V4LnRlc3QocmVsYXRpdmVQYXRoKSB8fCByZWxhdGl2ZVBhdGguaW5jbHVkZXMocGF0dGVybik7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog44OR44K544GM5pyf5b6F44GV44KM44KL5aC05omA44Gr44GC44KL44GL44OB44Kn44OD44KvXG4gICAqL1xuICBwcml2YXRlIGlzUGF0aEluRXhwZWN0ZWRMb2NhdGlvbihjdXJyZW50RGlyOiBzdHJpbmcsIGV4cGVjdGVkRGlyOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAvLyDmraPopo/ljJbjgZXjgozjgZ/jg5Hjgrnjgafmr5TovINcbiAgICBjb25zdCBub3JtYWxpemVkQ3VycmVudCA9IHBhdGgubm9ybWFsaXplKGN1cnJlbnREaXIpO1xuICAgIGNvbnN0IG5vcm1hbGl6ZWRFeHBlY3RlZCA9IHBhdGgubm9ybWFsaXplKGV4cGVjdGVkRGlyKTtcblxuICAgIHJldHVybiBub3JtYWxpemVkQ3VycmVudC5zdGFydHNXaXRoKG5vcm1hbGl6ZWRFeHBlY3RlZCkgfHwgXG4gICAgICAgICAgIG5vcm1hbGl6ZWRDdXJyZW50ID09PSBub3JtYWxpemVkRXhwZWN0ZWQgfHxcbiAgICAgICAgICAgbm9ybWFsaXplZEN1cnJlbnQgPT09ICcuJzsgLy8g44Or44O844OI44OH44Kj44Os44Kv44OI44Oq44Gu5aC05ZCIXG4gIH1cblxuICAvKipcbiAgICog44Kr44K544K/44Og44Or44O844Or5p2h5Lu244KS6KmV5L6hXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGV2YWx1YXRlQ3VzdG9tUnVsZUNvbmRpdGlvbihjb25kaXRpb246IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIC8vIOewoeWNmOOBquadoeS7tuipleS+oeOBruWun+ijhVxuICAgIC8vIOWun+mam+OBruWun+ijheOBp+OBr+OAgeOCiOOCiuikh+mbkeOBquadoeS7tuipleS+oeOBjOW/heimgVxuICAgIHRyeSB7XG4gICAgICAvLyDlronlhajjgarmnaHku7boqZXkvqHjga7jgZ/jgoHjga7ln7rmnKznmoTjgarlrp/oo4VcbiAgICAgIGlmIChjb25kaXRpb24uaW5jbHVkZXMoJ2ZpbGVfZXhpc3RzJykpIHtcbiAgICAgICAgY29uc3QgbWF0Y2ggPSBjb25kaXRpb24ubWF0Y2goL2ZpbGVfZXhpc3RzXFwoWydcIl0oW14nXCJdKylbJ1wiXVxcKS8pO1xuICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IHBhdGguam9pbih0aGlzLmJhc2VQYXRoLCBtYXRjaFsxXSk7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IGZzLmFjY2VzcyhmaWxlUGF0aCk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGNvbmRpdGlvbi5pbmNsdWRlcygnZGlyZWN0b3J5X2V4aXN0cycpKSB7XG4gICAgICAgIGNvbnN0IG1hdGNoID0gY29uZGl0aW9uLm1hdGNoKC9kaXJlY3RvcnlfZXhpc3RzXFwoWydcIl0oW14nXCJdKylbJ1wiXVxcKS8pO1xuICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICBjb25zdCBkaXJQYXRoID0gcGF0aC5qb2luKHRoaXMuYmFzZVBhdGgsIG1hdGNoWzFdKTtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBmcy5zdGF0KGRpclBhdGgpO1xuICAgICAgICAgICAgcmV0dXJuIHN0YXRzLmlzRGlyZWN0b3J5KCk7XG4gICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS53YXJuKGDjgqvjgrnjgr/jg6Djg6vjg7zjg6vmnaHku7bjga7oqZXkvqHjgavlpLHmlZc6ICR7Y29uZGl0aW9ufWAsIGVycm9yKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44Kr44K544K/44Og44Or44O844Or44Ki44Kv44K344On44Oz44KS6KmV5L6hXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGV2YWx1YXRlQ3VzdG9tUnVsZUFjdGlvbihhY3Rpb246IHN0cmluZyk6IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuOyBtZXNzYWdlOiBzdHJpbmc7IHBhdGg/OiBzdHJpbmc7IGF1dG9GaXhhYmxlPzogYm9vbGVhbiB9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGlmIChhY3Rpb24uaW5jbHVkZXMoJ3JlcXVpcmVfZGlyZWN0b3J5JykpIHtcbiAgICAgICAgY29uc3QgbWF0Y2ggPSBhY3Rpb24ubWF0Y2goL3JlcXVpcmVfZGlyZWN0b3J5XFwoWydcIl0oW14nXCJdKylbJ1wiXVxcKS8pO1xuICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICBjb25zdCBkaXJQYXRoID0gcGF0aC5qb2luKHRoaXMuYmFzZVBhdGgsIG1hdGNoWzFdKTtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBmcy5zdGF0KGRpclBhdGgpO1xuICAgICAgICAgICAgaWYgKHN0YXRzLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZTogJ+ODh+OCo+ODrOOCr+ODiOODquOBjOWtmOWcqOOBl+OBvuOBmScgfTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJldHVybiB7IFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLCBcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAn44OR44K544GM44OH44Kj44Os44Kv44OI44Oq44Gn44Gv44GC44KK44G+44Gb44KTJywgXG4gICAgICAgICAgICAgICAgcGF0aDogbWF0Y2hbMV0sXG4gICAgICAgICAgICAgICAgYXV0b0ZpeGFibGU6IGZhbHNlIFxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgcmV0dXJuIHsgXG4gICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLCBcbiAgICAgICAgICAgICAgbWVzc2FnZTogJ+ODh+OCo+ODrOOCr+ODiOODquOBjOWtmOWcqOOBl+OBvuOBm+OCkycsIFxuICAgICAgICAgICAgICBwYXRoOiBtYXRjaFsxXSxcbiAgICAgICAgICAgICAgYXV0b0ZpeGFibGU6IHRydWUgXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiAn44Ki44Kv44K344On44Oz6KmV5L6h5a6M5LqGJyB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4geyBcbiAgICAgICAgc3VjY2VzczogZmFsc2UsIFxuICAgICAgICBtZXNzYWdlOiBg44Ki44Kv44K344On44Oz6KmV5L6h44Ko44Op44O8OiAkeyhlcnJvciBhcyBFcnJvcikubWVzc2FnZX1gIFxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog5qeL6YCg5a6a576p44KS5pu05pawXG4gICAqL1xuICBhc3luYyB1cGRhdGVTdHJ1Y3R1cmVEZWZpbml0aW9uKHN0cnVjdHVyZTogUHJvamVjdFN0cnVjdHVyZSk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMucHJvamVjdFN0cnVjdHVyZSA9IHN0cnVjdHVyZTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgYXdhaXQgZnMud3JpdGVGaWxlKFxuICAgICAgICB0aGlzLmNvbmZpZy5zdHJ1Y3R1cmVEZWZpbml0aW9uUGF0aCwgXG4gICAgICAgIEpTT04uc3RyaW5naWZ5KHN0cnVjdHVyZSwgbnVsbCwgMilcbiAgICAgICk7XG4gICAgICBjb25zb2xlLmxvZygn44OX44Ot44K444Kn44Kv44OI5qeL6YCg5a6a576p44KS5pu05paw44GX44G+44GX44GfJyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ+ani+mAoOWumue+qeOBruS/neWtmOOBq+WkseaVl+OBl+OBvuOBl+OBnzonLCBlcnJvcik7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog5qeL6YCg5a6a576p44KS5Y+W5b6XXG4gICAqL1xuICBnZXRTdHJ1Y3R1cmVEZWZpbml0aW9uKCk6IFByb2plY3RTdHJ1Y3R1cmUgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5wcm9qZWN0U3RydWN0dXJlO1xuICB9XG5cbiAgLyoqXG4gICAqIOioreWumuOCkuWPluW+l1xuICAgKi9cbiAgZ2V0Q29uZmlnKCk6IFN0cnVjdHVyZVZhbGlkYXRvckNvbmZpZyB7XG4gICAgcmV0dXJuIHsgLi4udGhpcy5jb25maWcgfTtcbiAgfVxufSJdfQ==