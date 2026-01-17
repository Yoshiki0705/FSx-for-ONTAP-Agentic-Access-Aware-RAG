/**
 * Classification Rule Manager
 * 分類ルールの管理機能
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ClassificationRule } from '../../interfaces';

export interface RuleValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class ClassificationRuleManager {
  private rulesFile: string;
  private rules: ClassificationRule[] = [];

  constructor(rulesFile: string) {
    this.rulesFile = rulesFile;
  }

  /**
   * ルールを読み込み
   */
  async loadRules(): Promise<ClassificationRule[]> {
    try {
      const content = await fs.readFile(this.rulesFile, 'utf-8');
      const data = JSON.parse(content);
      this.rules = data.rules || [];
      return this.rules;
    } catch (error) {
      console.warn(`ルールファイルの読み込みに失敗: ${this.rulesFile}`);
      this.rules = this.getBuiltinRules();
      return this.rules;
    }
  }

  /**
   * ルールを保存
   */
  async saveRules(rules: ClassificationRule[]): Promise<void> {
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
    } catch (error) {
      console.error('ルールの保存に失敗しました:', error);
      throw error;
    }
  }

  /**
   * ルールを追加
   */
  async addRule(rule: ClassificationRule): Promise<void> {
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
  async updateRule(name: string, updatedRule: ClassificationRule): Promise<void> {
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
  async deleteRule(name: string): Promise<void> {
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
  findRules(query: string): ClassificationRule[] {
    const lowerQuery = query.toLowerCase();
    return this.rules.filter(rule => 
      rule.name.toLowerCase().includes(lowerQuery) ||
      rule.pattern.toLowerCase().includes(lowerQuery) ||
      rule.targetPath.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * カテゴリ別ルールを取得
   */
  getRulesByCategory(category: string): ClassificationRule[] {
    return this.rules.filter(rule => {
      const ruleCategory = this.extractCategory(rule.targetPath);
      return ruleCategory === category;
    });
  }

  /**
   * ルールを検証
   */
  validateRule(rule: ClassificationRule): RuleValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

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
    } catch {
      errors.push('無効なパターン形式です');
    }

    // 内容パターン検証
    if (rule.contentPatterns) {
      for (const pattern of rule.contentPatterns) {
        try {
          new RegExp(pattern);
        } catch {
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
  validateRules(rules: ClassificationRule[]): RuleValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

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
  private detectRuleConflicts(rules: ClassificationRule[]): string[] {
    const conflicts: string[] = [];
    
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
  private patternsOverlap(pattern1: string, pattern2: string): boolean {
    // 簡単な重複チェック（完全一致または包含関係）
    return pattern1 === pattern2 || 
           pattern1.includes(pattern2) || 
           pattern2.includes(pattern1);
  }

  /**
   * カテゴリを抽出
   */
  private extractCategory(targetPath: string): string {
    const segments = targetPath.split('/').filter(s => s);
    return segments[0] || 'misc';
  }

  /**
   * 組み込みルールを取得
   */
  private getBuiltinRules(): ClassificationRule[] {
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
  getStatistics(): any {
    const categories = new Map<string, number>();
    const confidenceDistribution = { low: 0, medium: 0, high: 0 };

    for (const rule of this.rules) {
      const category = this.extractCategory(rule.targetPath);
      categories.set(category, (categories.get(category) || 0) + 1);

      if (rule.confidence < 0.5) {
        confidenceDistribution.low++;
      } else if (rule.confidence < 0.8) {
        confidenceDistribution.medium++;
      } else {
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
  getRules(): ClassificationRule[] {
    return [...this.rules];
  }
}