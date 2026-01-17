/**
 * Directory Structure Validator
 * ディレクトリ構造検証機能 - プロジェクト構造の検証と自動修正
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ProjectStructure, DirectoryRule, FileTypeRule, CustomRule } from '../../interfaces';

export interface ValidationResult {
  valid: boolean;
  violations: StructureViolation[];
  suggestions: StructureSuggestion[];
  summary: ValidationSummary;
}

export interface StructureViolation {
  type: 'missing_directory' | 'invalid_permission' | 'size_exceeded' | 'custom_rule_violation';
  path: string;
  rule: DirectoryRule | CustomRule;
  severity: 'error' | 'warning' | 'info';
  description: string;
  autoFixable: boolean;
}

export interface StructureSuggestion {
  type: 'create_directory' | 'fix_permission' | 'move_file' | 'cleanup';
  path: string;
  action: string;
  description: string;
  priority: number;
}

export interface ValidationSummary {
  totalDirectories: number;
  validDirectories: number;
  missingDirectories: number;
  violationCount: number;
  autoFixableCount: number;
}

export interface StructureValidatorConfig {
  structureDefinitionPath: string;
  autoCreateDirectories: boolean;
  autoFixPermissions: boolean;
  enableCustomRules: boolean;
  maxDirectorySize: number;
  excludePatterns: string[];
}

export class DirectoryStructureValidator {
  private config: StructureValidatorConfig;
  private projectStructure: ProjectStructure | null = null;
  private basePath: string;

  constructor(config: StructureValidatorConfig, basePath: string = './') {
    this.config = config;
    this.basePath = path.resolve(basePath);
  }

  /**
   * 構造検証機能を初期化
   */
  async initialize(): Promise<void> {
    try {
      // プロジェクト構造定義を読み込み
      await this.loadProjectStructure();
      
      console.log('ディレクトリ構造検証機能を初期化しました');
    } catch (error) {
      console.error('構造検証機能の初期化に失敗しました:', error);
      throw error;
    }
  }

  /**
   * プロジェクト構造を検証
   */
  async validateStructure(): Promise<ValidationResult> {
    if (!this.projectStructure) {
      throw new Error('プロジェクト構造定義が読み込まれていません');
    }

    const violations: StructureViolation[] = [];
    const suggestions: StructureSuggestion[] = [];

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

    const result: ValidationResult = {
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
  private async validateDirectoryRule(rule: DirectoryRule): Promise<StructureViolation[]> {
    const violations: StructureViolation[] = [];
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

    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // ディレクトリが存在しない
        violations.push({
          type: 'missing_directory',
          path: rule.path,
          rule,
          severity: rule.required ? 'error' : 'warning',
          description: `必須ディレクトリが存在しません: ${rule.path} (${rule.purpose})`,
          autoFixable: this.config.autoCreateDirectories
        });
      } else {
        violations.push({
          type: 'missing_directory',
          path: rule.path,
          rule,
          severity: 'error',
          description: `ディレクトリアクセスエラー: ${rule.path} - ${(error as Error).message}`,
          autoFixable: false
        });
      }
    }

    return violations;
  }

  /**
   * パーミッションを検証
   */
  private async validatePermissions(dirPath: string, rule: DirectoryRule): Promise<StructureViolation | null> {
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
    } catch (error) {
      return {
        type: 'invalid_permission',
        path: rule.path,
        rule,
        severity: 'error',
        description: `パーミッション確認エラー: ${rule.path} - ${(error as Error).message}`,
        autoFixable: false
      };
    }

    return null;
  }

  /**
   * ディレクトリサイズを検証
   */
  private async validateDirectorySize(dirPath: string, rule: DirectoryRule): Promise<StructureViolation | null> {
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
    } catch (error) {
      return {
        type: 'size_exceeded',
        path: rule.path,
        rule,
        severity: 'error',
        description: `サイズ計算エラー: ${rule.path} - ${(error as Error).message}`,
        autoFixable: false
      };
    }

    return null;
  }

  /**
   * カスタムルールを検証
   */
  private async validateCustomRule(rule: CustomRule): Promise<StructureViolation[]> {
    const violations: StructureViolation[] = [];

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
    } catch (error) {
      violations.push({
        type: 'custom_rule_violation',
        path: '',
        rule,
        severity: 'error',
        description: `カスタムルール評価エラー: ${rule.name} - ${(error as Error).message}`,
        autoFixable: false
      });
    }

    return violations;
  }

  /**
   * ファイルタイプルールを検証
   */
  private async validateFileTypeRules(): Promise<StructureViolation[]> {
    const violations: StructureViolation[] = [];

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
      const fileTypeRule = this.projectStructure.fileTypes.find(rule => 
        rule.extension === extension
      );

      if (fileTypeRule) {
        // ファイルが正しいディレクトリにあるかチェック
        const expectedDir = fileTypeRule.defaultPath;
        const currentDir = path.dirname(relativePath);

        if (!this.isPathInExpectedLocation(currentDir, expectedDir)) {
          violations.push({
            type: 'custom_rule_violation',
            path: relativePath,
            rule: fileTypeRule as any,
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
  private generateSuggestion(violation: StructureViolation): StructureSuggestion | null {
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
        const rule = violation.rule as DirectoryRule;
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
  async autoFix(suggestions: StructureSuggestion[]): Promise<{ success: boolean; results: string[] }> {
    const results: string[] = [];
    let allSuccess = true;

    // 優先度順にソート
    const sortedSuggestions = suggestions.sort((a, b) => a.priority - b.priority);

    for (const suggestion of sortedSuggestions) {
      try {
        const success = await this.executeSuggestion(suggestion);
        if (success) {
          results.push(`✅ ${suggestion.description}`);
        } else {
          results.push(`❌ ${suggestion.description} - 実行失敗`);
          allSuccess = false;
        }
      } catch (error) {
        results.push(`❌ ${suggestion.description} - エラー: ${(error as Error).message}`);
        allSuccess = false;
      }
    }

    return { success: allSuccess, results };
  }

  /**
   * 修正提案を実行
   */
  private async executeSuggestion(suggestion: StructureSuggestion): Promise<boolean> {
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
  private async loadProjectStructure(): Promise<void> {
    try {
      const structureData = await fs.readFile(this.config.structureDefinitionPath, 'utf-8');
      this.projectStructure = JSON.parse(structureData);
      console.log('プロジェクト構造定義を読み込みました');
    } catch (error) {
      console.warn(`構造定義ファイルの読み込みに失敗: ${this.config.structureDefinitionPath}`);
      this.projectStructure = this.getDefaultProjectStructure();
    }
  }

  /**
   * デフォルトプロジェクト構造を取得
   */
  private getDefaultProjectStructure(): ProjectStructure {
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
  private generateValidationSummary(violations: StructureViolation[]): ValidationSummary {
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
  private async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    const calculateSize = async (currentPath: string): Promise<void> => {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);

          if (entry.isFile()) {
            const stats = await fs.stat(fullPath);
            totalSize += stats.size;
          } else if (entry.isDirectory()) {
            await calculateSize(fullPath);
          }
        }
      } catch (error) {
        // アクセスできないディレクトリは無視
      }
    };

    await calculateSize(dirPath);
    return totalSize;
  }

  /**
   * 全ファイルをスキャン
   */
  private async scanAllFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    const scanDirectory = async (currentPath: string): Promise<void> => {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);

          if (entry.isFile()) {
            files.push(fullPath);
          } else if (entry.isDirectory() && !this.isExcluded(path.relative(this.basePath, fullPath))) {
            await scanDirectory(fullPath);
          }
        }
      } catch (error) {
        // アクセスできないディレクトリは無視
      }
    };

    await scanDirectory(dirPath);
    return files;
  }

  /**
   * 除外パターンをチェック
   */
  private isExcluded(relativePath: string): boolean {
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
  private isPathInExpectedLocation(currentDir: string, expectedDir: string): boolean {
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
  private async evaluateCustomRuleCondition(condition: string): Promise<boolean> {
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
          } catch {
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
          } catch {
            return false;
          }
        }
      }

      return false;
    } catch (error) {
      console.warn(`カスタムルール条件の評価に失敗: ${condition}`, error);
      return false;
    }
  }

  /**
   * カスタムルールアクションを評価
   */
  private async evaluateCustomRuleAction(action: string): Promise<{ success: boolean; message: string; path?: string; autoFixable?: boolean }> {
    try {
      if (action.includes('require_directory')) {
        const match = action.match(/require_directory\(['"]([^'"]+)['"]\)/);
        if (match) {
          const dirPath = path.join(this.basePath, match[1]);
          try {
            const stats = await fs.stat(dirPath);
            if (stats.isDirectory()) {
              return { success: true, message: 'ディレクトリが存在します' };
            } else {
              return { 
                success: false, 
                message: 'パスがディレクトリではありません', 
                path: match[1],
                autoFixable: false 
              };
            }
          } catch {
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
    } catch (error) {
      return { 
        success: false, 
        message: `アクション評価エラー: ${(error as Error).message}` 
      };
    }
  }

  /**
   * 構造定義を更新
   */
  async updateStructureDefinition(structure: ProjectStructure): Promise<void> {
    this.projectStructure = structure;
    
    try {
      await fs.writeFile(
        this.config.structureDefinitionPath, 
        JSON.stringify(structure, null, 2)
      );
      console.log('プロジェクト構造定義を更新しました');
    } catch (error) {
      console.error('構造定義の保存に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 構造定義を取得
   */
  getStructureDefinition(): ProjectStructure | null {
    return this.projectStructure;
  }

  /**
   * 設定を取得
   */
  getConfig(): StructureValidatorConfig {
    return { ...this.config };
  }
}