"use strict";
/**
 * Structure Validator Factory
 * 構造検証機能のファクトリークラス
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
exports.StructureValidatorFactory = void 0;
const index_1 = require("./index");
const path = __importStar(require("path"));
class StructureValidatorFactory {
    /**
     * デフォルト設定で構造検証機能を作成
     */
    static createDefault(basePath = './') {
        const defaultConfig = {
            structureDefinitionPath: './config/project-structure.json',
            autoCreateDirectories: true,
            autoFixPermissions: true,
            enableCustomRules: true,
            maxDirectorySize: 1024, // 1GB
            excludePatterns: [
                'node_modules/**',
                '.git/**',
                'cdk.out/**',
                '*.log',
                '.DS_Store',
                'Thumbs.db'
            ]
        };
        return new index_1.DirectoryStructureValidator(defaultConfig, basePath);
    }
    /**
     * CPOS設定から構造検証機能を作成
     */
    static createFromConfig(cposConfig, basePath = './') {
        const config = {
            structureDefinitionPath: './config/project-structure.json',
            autoCreateDirectories: true,
            autoFixPermissions: true,
            enableCustomRules: true,
            maxDirectorySize: 1024,
            excludePatterns: [
                'node_modules/**',
                '.git/**',
                'cdk.out/**',
                '*.log',
                '.DS_Store'
            ]
        };
        return new index_1.DirectoryStructureValidator(config, basePath);
    }
    /**
     * カスタム設定で構造検証機能を作成
     */
    static createCustom(config, basePath = './') {
        const defaultConfig = {
            structureDefinitionPath: './config/project-structure.json',
            autoCreateDirectories: true,
            autoFixPermissions: true,
            enableCustomRules: true,
            maxDirectorySize: 1024,
            excludePatterns: []
        };
        const mergedConfig = {
            ...defaultConfig,
            ...config
        };
        return new index_1.DirectoryStructureValidator(mergedConfig, basePath);
    }
    /**
     * 厳格モードで構造検証機能を作成
     */
    static createStrictMode(basePath = './') {
        const config = {
            structureDefinitionPath: './config/project-structure.json',
            autoCreateDirectories: false, // 厳格モードでは自動作成しない
            autoFixPermissions: false, // 厳格モードでは自動修正しない
            enableCustomRules: true,
            maxDirectorySize: 512, // より厳しいサイズ制限
            excludePatterns: [
                'node_modules/**',
                '.git/**',
                'cdk.out/**',
                '*.log',
                '.DS_Store',
                'Thumbs.db',
                '*.tmp',
                '*.temp'
            ]
        };
        return new index_1.DirectoryStructureValidator(config, basePath);
    }
    /**
     * 開発環境用設定で構造検証機能を作成
     */
    static createForDevelopment(basePath = './') {
        const config = {
            structureDefinitionPath: './config/project-structure.json',
            autoCreateDirectories: true,
            autoFixPermissions: true,
            enableCustomRules: true,
            maxDirectorySize: 2048, // 開発時は大きなサイズを許可
            excludePatterns: [
                'node_modules/**',
                '.git/**',
                'cdk.out/**',
                '*.log',
                '.DS_Store',
                'coverage/**',
                '.nyc_output/**',
                'dist/**',
                'build/**'
            ]
        };
        return new index_1.DirectoryStructureValidator(config, basePath);
    }
    /**
     * 本番環境用設定で構造検証機能を作成
     */
    static createForProduction(basePath = './') {
        const config = {
            structureDefinitionPath: './config/project-structure.json',
            autoCreateDirectories: false, // 本番では手動確認
            autoFixPermissions: false, // 本番では手動修正
            enableCustomRules: true,
            maxDirectorySize: 512, // 本番では厳しいサイズ制限
            excludePatterns: [
                'node_modules/**',
                '.git/**',
                'cdk.out/**',
                '*.log',
                '.DS_Store',
                'Thumbs.db',
                '*.tmp',
                '*.temp',
                'test/**',
                'tests/**',
                'spec/**',
                'coverage/**'
            ]
        };
        return new index_1.DirectoryStructureValidator(config, basePath);
    }
    /**
     * プロジェクトタイプ別設定で構造検証機能を作成
     */
    static createForProjectType(projectType, basePath = './') {
        const baseConfig = {
            structureDefinitionPath: './config/project-structure.json',
            autoCreateDirectories: true,
            autoFixPermissions: true,
            enableCustomRules: true,
            maxDirectorySize: 1024,
            excludePatterns: [
                'node_modules/**',
                '.git/**',
                '*.log',
                '.DS_Store'
            ]
        };
        switch (projectType) {
            case 'cdk':
                return new index_1.DirectoryStructureValidator({
                    ...baseConfig,
                    structureDefinitionPath: './config/cdk-project-structure.json',
                    excludePatterns: [
                        ...baseConfig.excludePatterns,
                        'cdk.out/**',
                        '*.d.ts',
                        'lib/**/*.js'
                    ]
                }, basePath);
            case 'nextjs':
                return new index_1.DirectoryStructureValidator({
                    ...baseConfig,
                    structureDefinitionPath: './config/nextjs-project-structure.json',
                    maxDirectorySize: 2048, // Next.jsは大きなファイルが多い
                    excludePatterns: [
                        ...baseConfig.excludePatterns,
                        '.next/**',
                        'out/**',
                        'dist/**',
                        'public/**/*.map'
                    ]
                }, basePath);
            case 'lambda':
                return new index_1.DirectoryStructureValidator({
                    ...baseConfig,
                    structureDefinitionPath: './config/lambda-project-structure.json',
                    maxDirectorySize: 256, // Lambdaは小さく保つ
                    excludePatterns: [
                        ...baseConfig.excludePatterns,
                        'dist/**',
                        'build/**',
                        '*.zip'
                    ]
                }, basePath);
            case 'library':
                return new index_1.DirectoryStructureValidator({
                    ...baseConfig,
                    structureDefinitionPath: './config/library-project-structure.json',
                    excludePatterns: [
                        ...baseConfig.excludePatterns,
                        'lib/**/*.js',
                        'lib/**/*.d.ts',
                        'dist/**',
                        'coverage/**'
                    ]
                }, basePath);
            default:
                return new index_1.DirectoryStructureValidator(baseConfig, basePath);
        }
    }
    /**
     * 設定の妥当性をチェック
     */
    static validateConfig(config) {
        const errors = [];
        if (!config.structureDefinitionPath) {
            errors.push('structureDefinitionPath is required');
        }
        if (config.maxDirectorySize <= 0) {
            errors.push('maxDirectorySize must be greater than 0');
        }
        if (!Array.isArray(config.excludePatterns)) {
            errors.push('excludePatterns must be an array');
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
    /**
     * 設定の推奨値をチェック
     */
    static getConfigRecommendations(config) {
        const recommendations = [];
        if (config.maxDirectorySize > 5120) {
            recommendations.push('maxDirectorySize が大きすぎます。5GB以下を推奨します。');
        }
        if (config.excludePatterns.length === 0) {
            recommendations.push('excludePatterns を設定することを推奨します。');
        }
        if (!config.excludePatterns.includes('node_modules/**')) {
            recommendations.push('node_modules/** を excludePatterns に追加することを推奨します。');
        }
        if (!config.excludePatterns.includes('.git/**')) {
            recommendations.push('.git/** を excludePatterns に追加することを推奨します。');
        }
        if (config.autoCreateDirectories && config.autoFixPermissions) {
            recommendations.push('本番環境では autoCreateDirectories と autoFixPermissions を false にすることを推奨します。');
        }
        return recommendations;
    }
    /**
     * プロジェクトタイプを自動検出
     */
    static async detectProjectType(basePath = './') {
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            // package.json を確認
            try {
                const packageJsonPath = path.join(basePath, 'package.json');
                const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
                // 依存関係からプロジェクトタイプを推測
                const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
                if (dependencies['aws-cdk-lib'] || dependencies['@aws-cdk/core']) {
                    return 'cdk';
                }
                if (dependencies['next'] || dependencies['react']) {
                    return 'nextjs';
                }
                if (dependencies['@aws-lambda-powertools/logger'] || packageJson.name?.includes('lambda')) {
                    return 'lambda';
                }
                // ライブラリプロジェクトの特徴
                if (packageJson.main || packageJson.module || packageJson.types) {
                    return 'library';
                }
            }
            catch {
                // package.json が読めない場合は他の方法で判定
            }
            // ファイル構造からプロジェクトタイプを推測
            try {
                const entries = await fs.readdir(basePath);
                if (entries.includes('cdk.json')) {
                    return 'cdk';
                }
                if (entries.includes('next.config.js') || entries.includes('next.config.ts')) {
                    return 'nextjs';
                }
                if (entries.includes('serverless.yml') || entries.includes('template.yaml')) {
                    return 'lambda';
                }
            }
            catch {
                // ディレクトリが読めない場合
            }
            return 'unknown';
        }
        catch (error) {
            console.warn('プロジェクトタイプの自動検出に失敗しました:', error);
            return 'unknown';
        }
    }
}
exports.StructureValidatorFactory = StructureValidatorFactory;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdG9yLWZhY3RvcnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ2YWxpZGF0b3ItZmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILG1DQUFnRjtBQUVoRiwyQ0FBNkI7QUFFN0IsTUFBYSx5QkFBeUI7SUFDcEM7O09BRUc7SUFDSCxNQUFNLENBQUMsYUFBYSxDQUFDLFdBQW1CLElBQUk7UUFDMUMsTUFBTSxhQUFhLEdBQTZCO1lBQzlDLHVCQUF1QixFQUFFLGlDQUFpQztZQUMxRCxxQkFBcUIsRUFBRSxJQUFJO1lBQzNCLGtCQUFrQixFQUFFLElBQUk7WUFDeEIsaUJBQWlCLEVBQUUsSUFBSTtZQUN2QixnQkFBZ0IsRUFBRSxJQUFJLEVBQUUsTUFBTTtZQUM5QixlQUFlLEVBQUU7Z0JBQ2YsaUJBQWlCO2dCQUNqQixTQUFTO2dCQUNULFlBQVk7Z0JBQ1osT0FBTztnQkFDUCxXQUFXO2dCQUNYLFdBQVc7YUFDWjtTQUNGLENBQUM7UUFFRixPQUFPLElBQUksbUNBQTJCLENBQUMsYUFBYSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ2xFLENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFzQixFQUFFLFdBQW1CLElBQUk7UUFDckUsTUFBTSxNQUFNLEdBQTZCO1lBQ3ZDLHVCQUF1QixFQUFFLGlDQUFpQztZQUMxRCxxQkFBcUIsRUFBRSxJQUFJO1lBQzNCLGtCQUFrQixFQUFFLElBQUk7WUFDeEIsaUJBQWlCLEVBQUUsSUFBSTtZQUN2QixnQkFBZ0IsRUFBRSxJQUFJO1lBQ3RCLGVBQWUsRUFBRTtnQkFDZixpQkFBaUI7Z0JBQ2pCLFNBQVM7Z0JBQ1QsWUFBWTtnQkFDWixPQUFPO2dCQUNQLFdBQVc7YUFDWjtTQUNGLENBQUM7UUFFRixPQUFPLElBQUksbUNBQTJCLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lB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QUNuQixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLE9BQU8sQ0FBQyxJQUFJLENBQUMsd0JBQXdCLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDOUMsT0FBTyxTQUFTLENBQUM7UUFDbkIsQ0FBQztJQUNILENBQUM7Q0FDRjtBQWhWRCw4REFnVkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFN0cnVjdHVyZSBWYWxpZGF0b3IgRmFjdG9yeVxuICog5qeL6YCg5qSc6Ki85qmf6IO944Gu44OV44Kh44Kv44OI44Oq44O844Kv44Op44K5XG4gKi9cblxuaW1wb3J0IHsgRGlyZWN0b3J5U3RydWN0dXJlVmFsaWRhdG9yLCBTdHJ1Y3R1cmVWYWxpZGF0b3JDb25maWcgfSBmcm9tICcuL2luZGV4JztcbmltcG9ydCB7IENQT1NDb25maWcgfSBmcm9tICcuLi9jb25maWd1cmF0aW9uJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbmV4cG9ydCBjbGFzcyBTdHJ1Y3R1cmVWYWxpZGF0b3JGYWN0b3J5IHtcbiAgLyoqXG4gICAqIOODh+ODleOCqeODq+ODiOioreWumuOBp+ani+mAoOaknOiovOapn+iDveOCkuS9nOaIkFxuICAgKi9cbiAgc3RhdGljIGNyZWF0ZURlZmF1bHQoYmFzZVBhdGg6IHN0cmluZyA9ICcuLycpOiBEaXJlY3RvcnlTdHJ1Y3R1cmVWYWxpZGF0b3Ige1xuICAgIGNvbnN0IGRlZmF1bHRDb25maWc6IFN0cnVjdHVyZVZhbGlkYXRvckNvbmZpZyA9IHtcbiAgICAgIHN0cnVjdHVyZURlZmluaXRpb25QYXRoOiAnLi9jb25maWcvcHJvamVjdC1zdHJ1Y3R1cmUuanNvbicsXG4gICAgICBhdXRvQ3JlYXRlRGlyZWN0b3JpZXM6IHRydWUsXG4gICAgICBhdXRvRml4UGVybWlzc2lvbnM6IHRydWUsXG4gICAgICBlbmFibGVDdXN0b21SdWxlczogdHJ1ZSxcbiAgICAgIG1heERpcmVjdG9yeVNpemU6IDEwMjQsIC8vIDFHQlxuICAgICAgZXhjbHVkZVBhdHRlcm5zOiBbXG4gICAgICAgICdub2RlX21vZHVsZXMvKionLFxuICAgICAgICAnLmdpdC8qKicsXG4gICAgICAgICdjZGsub3V0LyoqJyxcbiAgICAgICAgJyoubG9nJyxcbiAgICAgICAgJy5EU19TdG9yZScsXG4gICAgICAgICdUaHVtYnMuZGInXG4gICAgICBdXG4gICAgfTtcblxuICAgIHJldHVybiBuZXcgRGlyZWN0b3J5U3RydWN0dXJlVmFsaWRhdG9yKGRlZmF1bHRDb25maWcsIGJhc2VQYXRoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDUE9T6Kit5a6a44GL44KJ5qeL6YCg5qSc6Ki85qmf6IO944KS5L2c5oiQXG4gICAqL1xuICBzdGF0aWMgY3JlYXRlRnJvbUNvbmZpZyhjcG9zQ29uZmlnOiBDUE9TQ29uZmlnLCBiYXNlUGF0aDogc3RyaW5nID0gJy4vJyk6IERpcmVjdG9yeVN0cnVjdHVyZVZhbGlkYXRvciB7XG4gICAgY29uc3QgY29uZmlnOiBTdHJ1Y3R1cmVWYWxpZGF0b3JDb25maWcgPSB7XG4gICAgICBzdHJ1Y3R1cmVEZWZpbml0aW9uUGF0aDogJy4vY29uZmlnL3Byb2plY3Qtc3RydWN0dXJlLmpzb24nLFxuICAgICAgYXV0b0NyZWF0ZURpcmVjdG9yaWVzOiB0cnVlLFxuICAgICAgYXV0b0ZpeFBlcm1pc3Npb25zOiB0cnVlLFxuICAgICAgZW5hYmxlQ3VzdG9tUnVsZXM6IHRydWUsXG4gICAgICBtYXhEaXJlY3RvcnlTaXplOiAxMDI0LFxuICAgICAgZXhjbHVkZVBhdHRlcm5zOiBbXG4gICAgICAgICdub2RlX21vZHVsZXMvKionLFxuICAgICAgICAnLmdpdC8qKicsXG4gICAgICAgICdjZGsub3V0LyoqJyxcbiAgICAgICAgJyoubG9nJyxcbiAgICAgICAgJy5EU19TdG9yZSdcbiAgICAgIF1cbiAgICB9O1xuXG4gICAgcmV0dXJuIG5ldyBEaXJlY3RvcnlTdHJ1Y3R1cmVWYWxpZGF0b3IoY29uZmlnLCBiYXNlUGF0aCk7XG4gIH1cblxuICAvKipcbiAgICog44Kr44K544K/44Og6Kit5a6a44Gn5qeL6YCg5qSc6Ki85qmf6IO944KS5L2c5oiQXG4gICAqL1xuICBzdGF0aWMgY3JlYXRlQ3VzdG9tKGNvbmZpZzogUGFydGlhbDxTdHJ1Y3R1cmVWYWxpZGF0b3JDb25maWc+LCBiYXNlUGF0aDogc3RyaW5nID0gJy4vJyk6IERpcmVjdG9yeVN0cnVjdHVyZVZhbGlkYXRvciB7XG4gICAgY29uc3QgZGVmYXVsdENvbmZpZzogU3RydWN0dXJlVmFsaWRhdG9yQ29uZmlnID0ge1xuICAgICAgc3RydWN0dXJlRGVmaW5pdGlvblBhdGg6ICcuL2NvbmZpZy9wcm9qZWN0LXN0cnVjdHVyZS5qc29uJyxcbiAgICAgIGF1dG9DcmVhdGVEaXJlY3RvcmllczogdHJ1ZSxcbiAgICAgIGF1dG9GaXhQZXJtaXNzaW9uczogdHJ1ZSxcbiAgICAgIGVuYWJsZUN1c3RvbVJ1bGVzOiB0cnVlLFxuICAgICAgbWF4RGlyZWN0b3J5U2l6ZTogMTAyNCxcbiAgICAgIGV4Y2x1ZGVQYXR0ZXJuczogW11cbiAgICB9O1xuXG4gICAgY29uc3QgbWVyZ2VkQ29uZmlnOiBTdHJ1Y3R1cmVWYWxpZGF0b3JDb25maWcgPSB7XG4gICAgICAuLi5kZWZhdWx0Q29uZmlnLFxuICAgICAgLi4uY29uZmlnXG4gICAgfTtcblxuICAgIHJldHVybiBuZXcgRGlyZWN0b3J5U3RydWN0dXJlVmFsaWRhdG9yKG1lcmdlZENvbmZpZywgYmFzZVBhdGgpO1xuICB9XG5cbiAgLyoqXG4gICAqIOWOs+agvOODouODvOODieOBp+ani+mAoOaknOiovOapn+iDveOCkuS9nOaIkFxuICAgKi9cbiAgc3RhdGljIGNyZWF0ZVN0cmljdE1vZGUoYmFzZVBhdGg6IHN0cmluZyA9ICcuLycpOiBEaXJlY3RvcnlTdHJ1Y3R1cmVWYWxpZGF0b3Ige1xuICAgIGNvbnN0IGNvbmZpZzogU3RydWN0dXJlVmFsaWRhdG9yQ29uZmlnID0ge1xuICAgICAgc3RydWN0dXJlRGVmaW5pdGlvblBhdGg6ICcuL2NvbmZpZy9wcm9qZWN0LXN0cnVjdHVyZS5qc29uJyxcbiAgICAgIGF1dG9DcmVhdGVEaXJlY3RvcmllczogZmFsc2UsIC8vIOWOs+agvOODouODvOODieOBp+OBr+iHquWLleS9nOaIkOOBl+OBquOBhFxuICAgICAgYXV0b0ZpeFBlcm1pc3Npb25zOiBmYWxzZSwgLy8g5Y6z5qC844Oi44O844OJ44Gn44Gv6Ieq5YuV5L+u5q2j44GX44Gq44GEXG4gICAgICBlbmFibGVDdXN0b21SdWxlczogdHJ1ZSxcbiAgICAgIG1heERpcmVjdG9yeVNpemU6IDUxMiwgLy8g44KI44KK5Y6z44GX44GE44K144Kk44K65Yi26ZmQXG4gICAgICBleGNsdWRlUGF0dGVybnM6IFtcbiAgICAgICAgJ25vZGVfbW9kdWxlcy8qKicsXG4gICAgICAgICcuZ2l0LyoqJyxcbiAgICAgICAgJ2Nkay5vdXQvKionLFxuICAgICAgICAnKi5sb2cnLFxuICAgICAgICAnLkRTX1N0b3JlJyxcbiAgICAgICAgJ1RodW1icy5kYicsXG4gICAgICAgICcqLnRtcCcsXG4gICAgICAgICcqLnRlbXAnXG4gICAgICBdXG4gICAgfTtcblxuICAgIHJldHVybiBuZXcgRGlyZWN0b3J5U3RydWN0dXJlVmFsaWRhdG9yKGNvbmZpZywgYmFzZVBhdGgpO1xuICB9XG5cbiAgLyoqXG4gICAqIOmWi+eZuueSsOWig+eUqOioreWumuOBp+ani+mAoOaknOiovOapn+iDveOCkuS9nOaIkFxuICAgKi9cbiAgc3RhdGljIGNyZWF0ZUZvckRldmVsb3BtZW50KGJhc2VQYXRoOiBzdHJpbmcgPSAnLi8nKTogRGlyZWN0b3J5U3RydWN0dXJlVmFsaWRhdG9yIHtcbiAgICBjb25zdCBjb25maWc6IFN0cnVjdHVyZVZhbGlkYXRvckNvbmZpZyA9IHtcbiAgICAgIHN0cnVjdHVyZURlZmluaXRpb25QYXRoOiAnLi9jb25maWcvcHJvamVjdC1zdHJ1Y3R1cmUuanNvbicsXG4gICAgICBhdXRvQ3JlYXRlRGlyZWN0b3JpZXM6IHRydWUsXG4gICAgICBhdXRvRml4UGVybWlzc2lvbnM6IHRydWUsXG4gICAgICBlbmFibGVDdXN0b21SdWxlczogdHJ1ZSxcbiAgICAgIG1heERpcmVjdG9yeVNpemU6IDIwNDgsIC8vIOmWi+eZuuaZguOBr+Wkp+OBjeOBquOCteOCpOOCuuOCkuioseWPr1xuICAgICAgZXhjbHVkZVBhdHRlcm5zOiBbXG4gICAgICAgICdub2RlX21vZHVsZXMvKionLFxuICAgICAgICAnLmdpdC8qKicsXG4gICAgICAgICdjZGsub3V0LyoqJyxcbiAgICAgICAgJyoubG9nJyxcbiAgICAgICAgJy5EU19TdG9yZScsXG4gICAgICAgICdjb3ZlcmFnZS8qKicsXG4gICAgICAgICcubnljX291dHB1dC8qKicsXG4gICAgICAgICdkaXN0LyoqJyxcbiAgICAgICAgJ2J1aWxkLyoqJ1xuICAgICAgXVxuICAgIH07XG5cbiAgICByZXR1cm4gbmV3IERpcmVjdG9yeVN0cnVjdHVyZVZhbGlkYXRvcihjb25maWcsIGJhc2VQYXRoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmnKznlarnkrDlooPnlKjoqK3lrprjgafmp4vpgKDmpJzoqLzmqZ/og73jgpLkvZzmiJBcbiAgICovXG4gIHN0YXRpYyBjcmVhdGVGb3JQcm9kdWN0aW9uKGJhc2VQYXRoOiBzdHJpbmcgPSAnLi8nKTogRGlyZWN0b3J5U3RydWN0dXJlVmFsaWRhdG9yIHtcbiAgICBjb25zdCBjb25maWc6IFN0cnVjdHVyZVZhbGlkYXRvckNvbmZpZyA9IHtcbiAgICAgIHN0cnVjdHVyZURlZmluaXRpb25QYXRoOiAnLi9jb25maWcvcHJvamVjdC1zdHJ1Y3R1cmUuanNvbicsXG4gICAgICBhdXRvQ3JlYXRlRGlyZWN0b3JpZXM6IGZhbHNlLCAvLyDmnKznlarjgafjga/miYvli5Xnorroqo1cbiAgICAgIGF1dG9GaXhQZXJtaXNzaW9uczogZmFsc2UsIC8vIOacrOeVquOBp+OBr+aJi+WLleS/ruato1xuICAgICAgZW5hYmxlQ3VzdG9tUnVsZXM6IHRydWUsXG4gICAgICBtYXhEaXJlY3RvcnlTaXplOiA1MTIsIC8vIOacrOeVquOBp+OBr+WOs+OBl+OBhOOCteOCpOOCuuWItumZkFxuICAgICAgZXhjbHVkZVBhdHRlcm5zOiBbXG4gICAgICAgICdub2RlX21vZHVsZXMvKionLFxuICAgICAgICAnLmdpdC8qKicsXG4gICAgICAgICdjZGsub3V0LyoqJyxcbiAgICAgICAgJyoubG9nJyxcbiAgICAgICAgJy5EU19TdG9yZScsXG4gICAgICAgICdUaHVtYnMuZGInLFxuICAgICAgICAnKi50bXAnLFxuICAgICAgICAnKi50ZW1wJyxcbiAgICAgICAgJ3Rlc3QvKionLFxuICAgICAgICAndGVzdHMvKionLFxuICAgICAgICAnc3BlYy8qKicsXG4gICAgICAgICdjb3ZlcmFnZS8qKidcbiAgICAgIF1cbiAgICB9O1xuXG4gICAgcmV0dXJuIG5ldyBEaXJlY3RvcnlTdHJ1Y3R1cmVWYWxpZGF0b3IoY29uZmlnLCBiYXNlUGF0aCk7XG4gIH1cblxuICAvKipcbiAgICog44OX44Ot44K444Kn44Kv44OI44K/44Kk44OX5Yil6Kit5a6a44Gn5qeL6YCg5qSc6Ki85qmf6IO944KS5L2c5oiQXG4gICAqL1xuICBzdGF0aWMgY3JlYXRlRm9yUHJvamVjdFR5cGUocHJvamVjdFR5cGU6ICdjZGsnIHwgJ25leHRqcycgfCAnbGFtYmRhJyB8ICdsaWJyYXJ5JywgYmFzZVBhdGg6IHN0cmluZyA9ICcuLycpOiBEaXJlY3RvcnlTdHJ1Y3R1cmVWYWxpZGF0b3Ige1xuICAgIGNvbnN0IGJhc2VDb25maWc6IFN0cnVjdHVyZVZhbGlkYXRvckNvbmZpZyA9IHtcbiAgICAgIHN0cnVjdHVyZURlZmluaXRpb25QYXRoOiAnLi9jb25maWcvcHJvamVjdC1zdHJ1Y3R1cmUuanNvbicsXG4gICAgICBhdXRvQ3JlYXRlRGlyZWN0b3JpZXM6IHRydWUsXG4gICAgICBhdXRvRml4UGVybWlzc2lvbnM6IHRydWUsXG4gICAgICBlbmFibGVDdXN0b21SdWxlczogdHJ1ZSxcbiAgICAgIG1heERpcmVjdG9yeVNpemU6IDEwMjQsXG4gICAgICBleGNsdWRlUGF0dGVybnM6IFtcbiAgICAgICAgJ25vZGVfbW9kdWxlcy8qKicsXG4gICAgICAgICcuZ2l0LyoqJyxcbiAgICAgICAgJyoubG9nJyxcbiAgICAgICAgJy5EU19TdG9yZSdcbiAgICAgIF1cbiAgICB9O1xuXG4gICAgc3dpdGNoIChwcm9qZWN0VHlwZSkge1xuICAgICAgY2FzZSAnY2RrJzpcbiAgICAgICAgcmV0dXJuIG5ldyBEaXJlY3RvcnlTdHJ1Y3R1cmVWYWxpZGF0b3Ioe1xuICAgICAgICAgIC4uLmJhc2VDb25maWcsXG4gICAgICAgICAgc3RydWN0dXJlRGVmaW5pdGlvblBhdGg6ICcuL2NvbmZpZy9jZGstcHJvamVjdC1zdHJ1Y3R1cmUuanNvbicsXG4gICAgICAgICAgZXhjbHVkZVBhdHRlcm5zOiBbXG4gICAgICAgICAgICAuLi5iYXNlQ29uZmlnLmV4Y2x1ZGVQYXR0ZXJucyxcbiAgICAgICAgICAgICdjZGsub3V0LyoqJyxcbiAgICAgICAgICAgICcqLmQudHMnLFxuICAgICAgICAgICAgJ2xpYi8qKi8qLmpzJ1xuICAgICAgICAgIF1cbiAgICAgICAgfSwgYmFzZVBhdGgpO1xuXG4gICAgICBjYXNlICduZXh0anMnOlxuICAgICAgICByZXR1cm4gbmV3IERpcmVjdG9yeVN0cnVjdHVyZVZhbGlkYXRvcih7XG4gICAgICAgICAgLi4uYmFzZUNvbmZpZyxcbiAgICAgICAgICBzdHJ1Y3R1cmVEZWZpbml0aW9uUGF0aDogJy4vY29uZmlnL25leHRqcy1wcm9qZWN0LXN0cnVjdHVyZS5qc29uJyxcbiAgICAgICAgICBtYXhEaXJlY3RvcnlTaXplOiAyMDQ4LCAvLyBOZXh0Lmpz44Gv5aSn44GN44Gq44OV44Kh44Kk44Or44GM5aSa44GEXG4gICAgICAgICAgZXhjbHVkZVBhdHRlcm5zOiBbXG4gICAgICAgICAgICAuLi5iYXNlQ29uZmlnLmV4Y2x1ZGVQYXR0ZXJucyxcbiAgICAgICAgICAgICcubmV4dC8qKicsXG4gICAgICAgICAgICAnb3V0LyoqJyxcbiAgICAgICAgICAgICdkaXN0LyoqJyxcbiAgICAgICAgICAgICdwdWJsaWMvKiovKi5tYXAnXG4gICAgICAgICAgXVxuICAgICAgICB9LCBiYXNlUGF0aCk7XG5cbiAgICAgIGNhc2UgJ2xhbWJkYSc6XG4gICAgICAgIHJldHVybiBuZXcgRGlyZWN0b3J5U3RydWN0dXJlVmFsaWRhdG9yKHtcbiAgICAgICAgICAuLi5iYXNlQ29uZmlnLFxuICAgICAgICAgIHN0cnVjdHVyZURlZmluaXRpb25QYXRoOiAnLi9jb25maWcvbGFtYmRhLXByb2plY3Qtc3RydWN0dXJlLmpzb24nLFxuICAgICAgICAgIG1heERpcmVjdG9yeVNpemU6IDI1NiwgLy8gTGFtYmRh44Gv5bCP44GV44GP5L+d44GkXG4gICAgICAgICAgZXhjbHVkZVBhdHRlcm5zOiBbXG4gICAgICAgICAgICAuLi5iYXNlQ29uZmlnLmV4Y2x1ZGVQYXR0ZXJucyxcbiAgICAgICAgICAgICdkaXN0LyoqJyxcbiAgICAgICAgICAgICdidWlsZC8qKicsXG4gICAgICAgICAgICAnKi56aXAnXG4gICAgICAgICAgXVxuICAgICAgICB9LCBiYXNlUGF0aCk7XG5cbiAgICAgIGNhc2UgJ2xpYnJhcnknOlxuICAgICAgICByZXR1cm4gbmV3IERpcmVjdG9yeVN0cnVjdHVyZVZhbGlkYXRvcih7XG4gICAgICAgICAgLi4uYmFzZUNvbmZpZyxcbiAgICAgICAgICBzdHJ1Y3R1cmVEZWZpbml0aW9uUGF0aDogJy4vY29uZmlnL2xpYnJhcnktcHJvamVjdC1zdHJ1Y3R1cmUuanNvbicsXG4gICAgICAgICAgZXhjbHVkZVBhdHRlcm5zOiBbXG4gICAgICAgICAgICAuLi5iYXNlQ29uZmlnLmV4Y2x1ZGVQYXR0ZXJucyxcbiAgICAgICAgICAgICdsaWIvKiovKi5qcycsXG4gICAgICAgICAgICAnbGliLyoqLyouZC50cycsXG4gICAgICAgICAgICAnZGlzdC8qKicsXG4gICAgICAgICAgICAnY292ZXJhZ2UvKionXG4gICAgICAgICAgXVxuICAgICAgICB9LCBiYXNlUGF0aCk7XG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBuZXcgRGlyZWN0b3J5U3RydWN0dXJlVmFsaWRhdG9yKGJhc2VDb25maWcsIGJhc2VQYXRoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog6Kit5a6a44Gu5aal5b2T5oCn44KS44OB44Kn44OD44KvXG4gICAqL1xuICBzdGF0aWMgdmFsaWRhdGVDb25maWcoY29uZmlnOiBTdHJ1Y3R1cmVWYWxpZGF0b3JDb25maWcpOiB7IHZhbGlkOiBib29sZWFuOyBlcnJvcnM6IHN0cmluZ1tdIH0ge1xuICAgIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcblxuICAgIGlmICghY29uZmlnLnN0cnVjdHVyZURlZmluaXRpb25QYXRoKSB7XG4gICAgICBlcnJvcnMucHVzaCgnc3RydWN0dXJlRGVmaW5pdGlvblBhdGggaXMgcmVxdWlyZWQnKTtcbiAgICB9XG5cbiAgICBpZiAoY29uZmlnLm1heERpcmVjdG9yeVNpemUgPD0gMCkge1xuICAgICAgZXJyb3JzLnB1c2goJ21heERpcmVjdG9yeVNpemUgbXVzdCBiZSBncmVhdGVyIHRoYW4gMCcpO1xuICAgIH1cblxuICAgIGlmICghQXJyYXkuaXNBcnJheShjb25maWcuZXhjbHVkZVBhdHRlcm5zKSkge1xuICAgICAgZXJyb3JzLnB1c2goJ2V4Y2x1ZGVQYXR0ZXJucyBtdXN0IGJlIGFuIGFycmF5Jyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHZhbGlkOiBlcnJvcnMubGVuZ3RoID09PSAwLFxuICAgICAgZXJyb3JzXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDoqK3lrprjga7mjqjlpajlgKTjgpLjg4Hjgqfjg4Pjgq9cbiAgICovXG4gIHN0YXRpYyBnZXRDb25maWdSZWNvbW1lbmRhdGlvbnMoY29uZmlnOiBTdHJ1Y3R1cmVWYWxpZGF0b3JDb25maWcpOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgcmVjb21tZW5kYXRpb25zOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgaWYgKGNvbmZpZy5tYXhEaXJlY3RvcnlTaXplID4gNTEyMCkge1xuICAgICAgcmVjb21tZW5kYXRpb25zLnB1c2goJ21heERpcmVjdG9yeVNpemUg44GM5aSn44GN44GZ44GO44G+44GZ44CCNUdC5Lul5LiL44KS5o6o5aWo44GX44G+44GZ44CCJyk7XG4gICAgfVxuXG4gICAgaWYgKGNvbmZpZy5leGNsdWRlUGF0dGVybnMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZWNvbW1lbmRhdGlvbnMucHVzaCgnZXhjbHVkZVBhdHRlcm5zIOOCkuioreWumuOBmeOCi+OBk+OBqOOCkuaOqOWlqOOBl+OBvuOBmeOAgicpO1xuICAgIH1cblxuICAgIGlmICghY29uZmlnLmV4Y2x1ZGVQYXR0ZXJucy5pbmNsdWRlcygnbm9kZV9tb2R1bGVzLyoqJykpIHtcbiAgICAgIHJlY29tbWVuZGF0aW9ucy5wdXNoKCdub2RlX21vZHVsZXMvKiog44KSIGV4Y2x1ZGVQYXR0ZXJucyDjgavov73liqDjgZnjgovjgZPjgajjgpLmjqjlpajjgZfjgb7jgZnjgIInKTtcbiAgICB9XG5cbiAgICBpZiAoIWNvbmZpZy5leGNsdWRlUGF0dGVybnMuaW5jbHVkZXMoJy5naXQvKionKSkge1xuICAgICAgcmVjb21tZW5kYXRpb25zLnB1c2goJy5naXQvKiog44KSIGV4Y2x1ZGVQYXR0ZXJucyDjgavov73liqDjgZnjgovjgZPjgajjgpLmjqjlpajjgZfjgb7jgZnjgIInKTtcbiAgICB9XG5cbiAgICBpZiAoY29uZmlnLmF1dG9DcmVhdGVEaXJlY3RvcmllcyAmJiBjb25maWcuYXV0b0ZpeFBlcm1pc3Npb25zKSB7XG4gICAgICByZWNvbW1lbmRhdGlvbnMucHVzaCgn5pys55Wq55Kw5aKD44Gn44GvIGF1dG9DcmVhdGVEaXJlY3RvcmllcyDjgaggYXV0b0ZpeFBlcm1pc3Npb25zIOOCkiBmYWxzZSDjgavjgZnjgovjgZPjgajjgpLmjqjlpajjgZfjgb7jgZnjgIInKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVjb21tZW5kYXRpb25zO1xuICB9XG5cbiAgLyoqXG4gICAqIOODl+ODreOCuOOCp+OCr+ODiOOCv+OCpOODl+OCkuiHquWLleaknOWHulxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGRldGVjdFByb2plY3RUeXBlKGJhc2VQYXRoOiBzdHJpbmcgPSAnLi8nKTogUHJvbWlzZTwnY2RrJyB8ICduZXh0anMnIHwgJ2xhbWJkYScgfCAnbGlicmFyeScgfCAndW5rbm93bic+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZnMgPSBhd2FpdCBpbXBvcnQoJ2ZzL3Byb21pc2VzJyk7XG4gICAgICBcbiAgICAgIC8vIHBhY2thZ2UuanNvbiDjgpLnorroqo1cbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHBhY2thZ2VKc29uUGF0aCA9IHBhdGguam9pbihiYXNlUGF0aCwgJ3BhY2thZ2UuanNvbicpO1xuICAgICAgICBjb25zdCBwYWNrYWdlSnNvbiA9IEpTT04ucGFyc2UoYXdhaXQgZnMucmVhZEZpbGUocGFja2FnZUpzb25QYXRoLCAndXRmLTgnKSk7XG4gICAgICAgIFxuICAgICAgICAvLyDkvp3lrZjplqLkv4LjgYvjgonjg5fjg63jgrjjgqfjgq/jg4jjgr/jgqTjg5fjgpLmjqjmuKxcbiAgICAgICAgY29uc3QgZGVwZW5kZW5jaWVzID0geyAuLi5wYWNrYWdlSnNvbi5kZXBlbmRlbmNpZXMsIC4uLnBhY2thZ2VKc29uLmRldkRlcGVuZGVuY2llcyB9O1xuICAgICAgICBcbiAgICAgICAgaWYgKGRlcGVuZGVuY2llc1snYXdzLWNkay1saWInXSB8fCBkZXBlbmRlbmNpZXNbJ0Bhd3MtY2RrL2NvcmUnXSkge1xuICAgICAgICAgIHJldHVybiAnY2RrJztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKGRlcGVuZGVuY2llc1snbmV4dCddIHx8IGRlcGVuZGVuY2llc1sncmVhY3QnXSkge1xuICAgICAgICAgIHJldHVybiAnbmV4dGpzJztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKGRlcGVuZGVuY2llc1snQGF3cy1sYW1iZGEtcG93ZXJ0b29scy9sb2dnZXInXSB8fCBwYWNrYWdlSnNvbi5uYW1lPy5pbmNsdWRlcygnbGFtYmRhJykpIHtcbiAgICAgICAgICByZXR1cm4gJ2xhbWJkYSc7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIOODqeOCpOODluODqeODquODl+ODreOCuOOCp+OCr+ODiOOBrueJueW+tFxuICAgICAgICBpZiAocGFja2FnZUpzb24ubWFpbiB8fCBwYWNrYWdlSnNvbi5tb2R1bGUgfHwgcGFja2FnZUpzb24udHlwZXMpIHtcbiAgICAgICAgICByZXR1cm4gJ2xpYnJhcnknO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLy8gcGFja2FnZS5qc29uIOOBjOiqreOCgeOBquOBhOWgtOWQiOOBr+S7luOBruaWueazleOBp+WIpOWumlxuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDjg5XjgqHjgqTjg6vmp4vpgKDjgYvjgonjg5fjg63jgrjjgqfjgq/jg4jjgr/jgqTjg5fjgpLmjqjmuKxcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGVudHJpZXMgPSBhd2FpdCBmcy5yZWFkZGlyKGJhc2VQYXRoKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChlbnRyaWVzLmluY2x1ZGVzKCdjZGsuanNvbicpKSB7XG4gICAgICAgICAgcmV0dXJuICdjZGsnO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoZW50cmllcy5pbmNsdWRlcygnbmV4dC5jb25maWcuanMnKSB8fCBlbnRyaWVzLmluY2x1ZGVzKCduZXh0LmNvbmZpZy50cycpKSB7XG4gICAgICAgICAgcmV0dXJuICduZXh0anMnO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoZW50cmllcy5pbmNsdWRlcygnc2VydmVybGVzcy55bWwnKSB8fCBlbnRyaWVzLmluY2x1ZGVzKCd0ZW1wbGF0ZS55YW1sJykpIHtcbiAgICAgICAgICByZXR1cm4gJ2xhbWJkYSc7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyDjg4fjgqPjg6zjgq/jg4jjg6rjgYzoqq3jgoHjgarjgYTloLTlkIhcbiAgICAgIH1cbiAgICAgIFxuICAgICAgcmV0dXJuICd1bmtub3duJztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS53YXJuKCfjg5fjg63jgrjjgqfjgq/jg4jjgr/jgqTjg5fjga7oh6rli5XmpJzlh7rjgavlpLHmlZfjgZfjgb7jgZfjgZ86JywgZXJyb3IpO1xuICAgICAgcmV0dXJuICd1bmtub3duJztcbiAgICB9XG4gIH1cbn0iXX0=