/**
 * Structure Validator Factory
 * 構造検証機能のファクトリークラス
 */

import { DirectoryStructureValidator, StructureValidatorConfig } from './index';
import { CPOSConfig } from '../configuration';
import * as path from 'path';

export class StructureValidatorFactory {
  /**
   * デフォルト設定で構造検証機能を作成
   */
  static createDefault(basePath: string = './'): DirectoryStructureValidator {
    const defaultConfig: StructureValidatorConfig = {
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

    return new DirectoryStructureValidator(defaultConfig, basePath);
  }

  /**
   * CPOS設定から構造検証機能を作成
   */
  static createFromConfig(cposConfig: CPOSConfig, basePath: string = './'): DirectoryStructureValidator {
    const config: StructureValidatorConfig = {
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

    return new DirectoryStructureValidator(config, basePath);
  }

  /**
   * カスタム設定で構造検証機能を作成
   */
  static createCustom(config: Partial<StructureValidatorConfig>, basePath: string = './'): DirectoryStructureValidator {
    const defaultConfig: StructureValidatorConfig = {
      structureDefinitionPath: './config/project-structure.json',
      autoCreateDirectories: true,
      autoFixPermissions: true,
      enableCustomRules: true,
      maxDirectorySize: 1024,
      excludePatterns: []
    };

    const mergedConfig: StructureValidatorConfig = {
      ...defaultConfig,
      ...config
    };

    return new DirectoryStructureValidator(mergedConfig, basePath);
  }

  /**
   * 厳格モードで構造検証機能を作成
   */
  static createStrictMode(basePath: string = './'): DirectoryStructureValidator {
    const config: StructureValidatorConfig = {
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

    return new DirectoryStructureValidator(config, basePath);
  }

  /**
   * 開発環境用設定で構造検証機能を作成
   */
  static createForDevelopment(basePath: string = './'): DirectoryStructureValidator {
    const config: StructureValidatorConfig = {
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

    return new DirectoryStructureValidator(config, basePath);
  }

  /**
   * 本番環境用設定で構造検証機能を作成
   */
  static createForProduction(basePath: string = './'): DirectoryStructureValidator {
    const config: StructureValidatorConfig = {
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

    return new DirectoryStructureValidator(config, basePath);
  }

  /**
   * プロジェクトタイプ別設定で構造検証機能を作成
   */
  static createForProjectType(projectType: 'cdk' | 'nextjs' | 'lambda' | 'library', basePath: string = './'): DirectoryStructureValidator {
    const baseConfig: StructureValidatorConfig = {
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
        return new DirectoryStructureValidator({
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
        return new DirectoryStructureValidator({
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
        return new DirectoryStructureValidator({
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
        return new DirectoryStructureValidator({
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
        return new DirectoryStructureValidator(baseConfig, basePath);
    }
  }

  /**
   * 設定の妥当性をチェック
   */
  static validateConfig(config: StructureValidatorConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

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
  static getConfigRecommendations(config: StructureValidatorConfig): string[] {
    const recommendations: string[] = [];

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
  static async detectProjectType(basePath: string = './'): Promise<'cdk' | 'nextjs' | 'lambda' | 'library' | 'unknown'> {
    try {
      const fs = await import('fs/promises');
      
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
      } catch {
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
      } catch {
        // ディレクトリが読めない場合
      }
      
      return 'unknown';
    } catch (error) {
      console.warn('プロジェクトタイプの自動検出に失敗しました:', error);
      return 'unknown';
    }
  }
}