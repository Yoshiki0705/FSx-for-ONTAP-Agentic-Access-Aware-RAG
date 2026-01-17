/**
 * 統合ファイル整理システム - パターンマッチングエンジン
 * 
 * ファイル名パターンとファイル内容の解析により、
 * 適切な分類を行うためのマッチングエンジンを提供します。
 */

import * as path from 'path';
import { 
  FileInfo, 
  FileType, 
  ClassificationRule,
  OrganizationError,
  OrganizationErrorType
} from '../types/index.js';

/**
 * パターンマッチング結果
 */
export interface MatchResult {
  /** マッチしたかどうか */
  matched: boolean;
  /** マッチした信頼度（0-1） */
  confidence: number;
  /** マッチしたパターン */
  matchedPattern: string;
  /** マッチした理由 */
  reason: string;
  /** 適用されたルール */
  rule: ClassificationRule;
}

/**
 * パターンマッチングエンジン
 * 
 * ファイル名、拡張子、内容に基づいてファイルを分類するための
 * 高度なパターンマッチング機能を提供します。
 */
export class PatternMatcher {
  private readonly rules: Map<string, ClassificationRule[]>;
  private readonly contentAnalysisEnabled: boolean;

  constructor(
    rules: Record<string, Record<string, ClassificationRule>>,
    contentAnalysisEnabled: boolean = true
  ) {
    this.rules = new Map();
    this.contentAnalysisEnabled = contentAnalysisEnabled;
    this.loadRules(rules);
  }

  /**
   * ファイルに最適なルールを見つける
   */
  public findBestMatch(file: FileInfo): MatchResult | null {
    const allMatches: MatchResult[] = [];

    // 全ルールカテゴリを検査
    for (const [category, categoryRules] of this.rules) {
      for (const rule of categoryRules) {
        if (!rule.enabled) continue;

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
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });

    return allMatches[0];
  }

  /**
   * 複数のマッチ候補を取得
   */
  public findAllMatches(file: FileInfo, minConfidence: number = 0.3): MatchResult[] {
    const matches: MatchResult[] = [];

    for (const [category, categoryRules] of this.rules) {
      for (const rule of categoryRules) {
        if (!rule.enabled) continue;

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
  public matchCategory(file: FileInfo, category: string): MatchResult | null {
    const categoryRules = this.rules.get(category);
    if (!categoryRules) {
      return null;
    }

    let bestMatch: MatchResult | null = null;

    for (const rule of categoryRules) {
      if (!rule.enabled) continue;

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
  private evaluateRule(file: FileInfo, rule: ClassificationRule, category: string): MatchResult {
    const reasons: string[] = [];
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
  private matchPatterns(text: string, patterns: string[]): { matched: boolean; confidence: number; pattern: string } {
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
  private matchSinglePattern(text: string, pattern: string): { matched: boolean; confidence: number } {
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
    } catch (error) {
      console.warn(`パターンマッチングエラー: ${pattern}`, error);
      return { matched: false, confidence: 0 };
    }
  }

  /**
   * 拡張子マッチング
   */
  private matchExtension(extension: string, patterns: string[]): { matched: boolean; confidence: number; pattern: string } {
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
  private matchContent(content: string, patterns: string[], category: string): { matched: boolean; confidence: number; pattern: string } {
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
      } catch (error) {
        console.warn(`内容パターンマッチングエラー: ${pattern}`, error);
      }
    }
    
    return { matched: false, confidence: 0, pattern: '' };
  }

  /**
   * パスマッチング
   */
  private matchPath(filePath: string, patterns: string[]): { matched: boolean; confidence: number; pattern: string } {
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
  private matchSize(size: number, category: string): { matched: boolean; confidence: number; pattern: string } {
    const sizeRules = {
      'temp': { min: 0, max: 1024 * 1024 }, // 1MB以下
      'scripts': { min: 100, max: 100 * 1024 }, // 100B-100KB
      'configs': { min: 10, max: 10 * 1024 }, // 10B-10KB
      'documents': { min: 100, max: 10 * 1024 * 1024 } // 100B-10MB
    };

    const rule = sizeRules[category as keyof typeof sizeRules];
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
  private getContentPatterns(category: string): string[] {
    const patterns: Record<string, string[]> = {
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
  private globToRegex(pattern: string): string {
    return pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 特殊文字をエスケープ
      .replace(/\*/g, '.*') // * を .* に変換
      .replace(/\?/g, '.'); // ? を . に変換
  }

  /**
   * ルールを読み込み
   */
  private loadRules(rules: Record<string, Record<string, ClassificationRule>>): void {
    for (const [category, categoryRules] of Object.entries(rules)) {
      const ruleArray: ClassificationRule[] = [];
      
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
  public addRule(category: string, rule: ClassificationRule): void {
    if (!this.rules.has(category)) {
      this.rules.set(category, []);
    }
    
    const categoryRules = this.rules.get(category)!;
    categoryRules.push(rule);
    categoryRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * ルールを削除
   */
  public removeRule(category: string, ruleName: string): boolean {
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
  public toggleRule(category: string, ruleName: string, enabled: boolean): boolean {
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
  public getStatistics(): {
    totalRules: number;
    enabledRules: number;
    categoryCounts: Record<string, number>;
  } {
    let totalRules = 0;
    let enabledRules = 0;
    const categoryCounts: Record<string, number> = {};

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
  public testPattern(fileName: string, pattern: string): boolean {
    try {
      const regexPattern = this.globToRegex(pattern);
      const regex = new RegExp(regexPattern, 'i');
      return regex.test(fileName);
    } catch (error) {
      console.warn(`パターンテストエラー: ${pattern}`, error);
      return false;
    }
  }
}