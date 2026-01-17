/**
 * Classification Engine
 * ファイルの自動分類と配置決定を担当
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ClassificationResult, ClassificationRule, FileMetadata } from '../../interfaces';

export interface ClassificationConfig {
  rulesFile: string;
  defaultConfidenceThreshold: number;
  maxContentAnalysisSize: number; // bytes
  enableContentAnalysis: boolean;
  enableLearning: boolean;
}

export class ClassificationEngine {
  private config: ClassificationConfig;
  private rules: ClassificationRule[] = [];
  private learningData: Map<string, ClassificationResult> = new Map();

  constructor(config: ClassificationConfig) {
    this.config = config;
  }

  /**
   * 分類エンジンを初期化
   */
  async initialize(): Promise<void> {
    try {
      await this.loadRules();
      console.log(`分類ルールを読み込みました: ${this.rules.length} 件`);
    } catch (error) {
      console.error('分類エンジンの初期化に失敗しました:', error);
      throw error;
    }
  }

  /**
   * ファイルを分類
   */
  async classifyFile(filePath: string, content?: string): Promise<ClassificationResult> {
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
      let contentResults: ClassificationResult[] = [];
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

    } catch (error) {
      console.error(`ファイル分類エラー (${filePath}):`, error);
      return this.getDefaultClassification(filePath);
    }
  }

  /**
   * 拡張子ベース分類
   */
  private async classifyByExtension(fileInfo: any): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];

    for (const rule of this.rules) {
      if (this.matchesPattern(fileInfo.basename, rule.pattern)) {
        const result: ClassificationResult = {
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
  private async classifyByContent(filePath: string, providedContent?: string): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];

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
            
            const result: ClassificationResult = {
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
              const result: ClassificationResult = {
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

    } catch (error) {
      console.error(`内容分析エラー (${filePath}):`, error);
    }

    return results;
  }

  /**
   * パスベース分類
   */
  private async classifyByPath(fileInfo: any): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
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
  private combineResults(results: ClassificationResult[]): ClassificationResult {
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
  private matchesPattern(filename: string, pattern: string): boolean {
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
  private matchesContentPattern(content: string, pattern: string): boolean {
    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(content);
    } catch {
      // 正規表現が無効な場合は文字列検索
      return content.toLowerCase().includes(pattern.toLowerCase());
    }
  }

  /**
   * 内容パターンのマッチ数をカウント
   */
  private countContentMatches(content: string, patterns: string[]): number {
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
  private extractCategory(targetPath: string): string {
    const segments = targetPath.split('/').filter(s => s);
    return segments[0] || 'misc';
  }

  /**
   * サブカテゴリを抽出
   */
  private extractSubcategory(targetPath: string): string | undefined {
    const segments = targetPath.split('/').filter(s => s);
    return segments[1];
  }

  /**
   * パスを解決
   */
  private resolvePath(targetPath: string, fileInfo: any): string {
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
  private getDefaultClassification(filePath: string): ClassificationResult {
    const ext = path.extname(filePath).toLowerCase();
    
    // 拡張子による基本分類
    let category = 'misc';
    let suggestedPath = 'misc/';
    
    if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
      category = 'code';
      suggestedPath = 'lib/';
    } else if (['.md', '.txt', '.rst'].includes(ext)) {
      category = 'documentation';
      suggestedPath = 'docs/';
    } else if (['.json', '.yml', '.yaml', '.toml'].includes(ext)) {
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
  private async loadRules(): Promise<void> {
    try {
      const rulesContent = await fs.readFile(this.config.rulesFile, 'utf-8');
      const rulesData = JSON.parse(rulesContent);
      this.rules = rulesData.rules || [];
    } catch (error) {
      console.warn(`分類ルールファイルの読み込みに失敗しました: ${this.config.rulesFile}`);
      this.rules = this.getDefaultRules();
    }
  }

  /**
   * デフォルト分類ルールを取得
   */
  private getDefaultRules(): ClassificationRule[] {
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
  async updateRules(rules: ClassificationRule[]): Promise<void> {
    this.rules = rules;
    
    // ルールファイルに保存
    try {
      const rulesData = { rules: this.rules };
      await fs.writeFile(this.config.rulesFile, JSON.stringify(rulesData, null, 2));
      console.log('分類ルールを更新しました');
    } catch (error) {
      console.error('分類ルールの保存に失敗しました:', error);
    }
  }

  /**
   * 信頼度を取得
   */
  async getConfidence(filePath: string): Promise<number> {
    const result = await this.classifyFile(filePath);
    return result.confidence;
  }

  /**
   * 学習データを追加
   */
  addLearningData(filePath: string, result: ClassificationResult): void {
    if (this.config.enableLearning) {
      this.learningData.set(filePath, result);
    }
  }

  /**
   * 学習データをクリア
   */
  clearLearningData(): void {
    this.learningData.clear();
    console.log('学習データをクリアしました');
  }

  /**
   * 統計情報を取得
   */
  getStatistics(): any {
    return {
      rulesCount: this.rules.length,
      learningDataCount: this.learningData.size,
      enableContentAnalysis: this.config.enableContentAnalysis,
      enableLearning: this.config.enableLearning,
      confidenceThreshold: this.config.defaultConfidenceThreshold
    };
  }
}