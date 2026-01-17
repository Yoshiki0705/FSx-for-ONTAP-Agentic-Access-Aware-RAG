/**
 * 統合ファイル整理システム - ファイル分類器
 * 
 * パターンマッチングエンジンを使用してファイルを分類し、
 * 適切なターゲットパスを決定する機能を提供します。
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { PatternMatcher, MatchResult } from './pattern-matcher.js';
import { 
  FileClassifier as IFileClassifier,
  FileInfo, 
  ClassificationResult, 
  FileType,
  ClassificationConfig,
  Environment,
  OrganizationError,
  OrganizationErrorType
} from '../types/index.js';

/**
 * ファイル分類器
 * 
 * ファイルの性質を分析し、適切なカテゴリとターゲットパスを決定します。
 * 分類信頼度の計算と結果の検証機能も提供します。
 */
export class FileClassifier implements IFileClassifier {
  private readonly patternMatcher: PatternMatcher;
  private readonly config: ClassificationConfig;
  private readonly environment: Environment;

  constructor(config: ClassificationConfig, environment: Environment) {
    this.config = config;
    this.environment = environment;
    this.patternMatcher = new PatternMatcher(config.classificationRules, true);
  }

  /**
   * ファイルを分類
   */
  public async classifyFile(file: FileInfo): Promise<ClassificationResult> {
    try {
      // 特別ルールのチェック
      if (this.shouldIgnore(file)) {
        return this.createIgnoreResult(file);
      }

      if (this.shouldPreserve(file)) {
        return this.createPreserveResult(file);
      }

      // パターンマッチングによる分類
      const matchResult = this.patternMatcher.findBestMatch(file);
      
      if (!matchResult) {
        return this.createUnknownResult(file);
      }

      // ファイルタイプの決定
      const fileType = this.determineFileType(matchResult, file);
      
      // ターゲットパスの生成
      const targetPath = this.determineTargetPath(file, fileType);
      
      // 分類信頼度の調整
      const adjustedConfidence = this.adjustConfidence(matchResult.confidence, file, fileType);
      
      // レビュー必要性の判定
      const requiresReview = this.shouldRequireReview(file, matchResult, adjustedConfidence);

      return {
        file,
        fileType,
        targetPath,
        confidence: adjustedConfidence,
        reasoning: this.buildReasoning(matchResult, file, fileType),
        requiresReview,
        classificationTime: new Date(),
        appliedRule: matchResult.rule.name
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.CLASSIFICATION_FAILED,
        `ファイル分類に失敗しました: ${file.path}`,
        file.path,
        this.environment,
        error as Error
      );
    }
  }

  /**
   * ターゲットパスを決定
   */
  public determineTargetPath(file: FileInfo, classification: FileType): string {
    const baseTargetPath = this.getBaseTargetPath(classification);
    
    // 環境固有の調整
    const adjustedPath = this.adjustPathForEnvironment(baseTargetPath, file);
    
    // ファイル名の重複チェックと調整
    const finalPath = this.resolveDuplicatePath(adjustedPath, file.name);
    
    return finalPath;
  }

  /**
   * 分類結果を検証
   */
  public validateClassification(file: FileInfo, classification: ClassificationResult): boolean {
    try {
      // 基本的な検証
      if (!classification.targetPath || classification.confidence < 0 || classification.confidence > 1) {
        return false;
      }

      // ファイルタイプと拡張子の整合性チェック
      if (!this.isFileTypeConsistent(file, classification.fileType)) {
        return false;
      }

      // ターゲットパスの妥当性チェック
      if (!this.isTargetPathValid(classification.targetPath)) {
        return false;
      }

      // 権限設定の妥当性チェック
      if (!this.arePermissionsValid(file, classification.fileType)) {
        return false;
      }

      return true;
    } catch (error) {
      console.warn(`分類結果検証エラー: ${file.path}`, error);
      return false;
    }
  }

  /**
   * 複数ファイルの一括分類
   */
  public async classifyFiles(files: FileInfo[]): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
    const errors: Error[] = [];

    for (const file of files) {
      try {
        const result = await this.classifyFile(file);
        results.push(result);
      } catch (error) {
        errors.push(error as Error);
        console.warn(`ファイル分類エラー: ${file.path}`, error);
      }
    }

    if (errors.length > 0) {
      console.warn(`${errors.length} 個のファイル分類でエラーが発生しました`);
    }

    return results;
  }

  /**
   * 分類統計を生成
   */
  public generateClassificationStatistics(results: ClassificationResult[]): {
    totalFiles: number;
    byFileType: Record<FileType, number>;
    byConfidence: Record<string, number>;
    requiresReview: number;
    averageConfidence: number;
  } {
    const stats = {
      totalFiles: results.length,
      byFileType: {} as Record<FileType, number>,
      byConfidence: {
        'high (0.8+)': 0,
        'medium (0.5-0.8)': 0,
        'low (0.0-0.5)': 0
      },
      requiresReview: 0,
      averageConfidence: 0
    };

    let totalConfidence = 0;

    for (const result of results) {
      // ファイルタイプ別統計
      stats.byFileType[result.fileType] = (stats.byFileType[result.fileType] || 0) + 1;

      // 信頼度別統計
      if (result.confidence >= 0.8) {
        stats.byConfidence['high (0.8+)']++;
      } else if (result.confidence >= 0.5) {
        stats.byConfidence['medium (0.5-0.8)']++;
      } else {
        stats.byConfidence['low (0.0-0.5)']++;
      }

      // レビュー必要統計
      if (result.requiresReview) {
        stats.requiresReview++;
      }

      totalConfidence += result.confidence;
    }

    // 平均信頼度
    stats.averageConfidence = results.length > 0 ? totalConfidence / results.length : 0;

    return stats;
  }

  /**
   * 無視すべきファイルかどうかを判定
   */
  private shouldIgnore(file: FileInfo): boolean {
    const ignorePatterns = this.config.specialRules.ignoreFiles;
    return ignorePatterns.some(pattern => this.matchesPattern(file.name, pattern));
  }

  /**
   * 保持すべきファイルかどうかを判定
   */
  private shouldPreserve(file: FileInfo): boolean {
    const preservePatterns = this.config.specialRules.preserveFiles;
    return preservePatterns.some(pattern => this.matchesPattern(file.name, pattern));
  }

  /**
   * レビューが必要かどうかを判定
   */
  private shouldRequireReview(file: FileInfo, matchResult: MatchResult, confidence: number): boolean {
    // 低い信頼度の場合
    if (confidence < 0.5) {
      return true;
    }

    // 特別ルールで指定されたファイル
    const reviewPatterns = this.config.specialRules.requireReview;
    if (reviewPatterns.some(pattern => this.matchesPattern(file.name, pattern))) {
      return true;
    }

    // 大きなファイル
    if (file.size > this.config.validation.maxFileSize / 10) {
      return true;
    }

    // 機密性の高いファイル
    if (this.isSensitiveFile(file)) {
      return true;
    }

    return false;
  }

  /**
   * ファイルタイプを決定
   */
  private determineFileType(matchResult: MatchResult, file: FileInfo): FileType {
    const ruleName = matchResult.rule.name;
    const category = this.findRuleCategory(matchResult.rule);

    // カテゴリとルール名からFileTypeを決定
    const fileTypeMap: Record<string, Record<string, FileType>> = {
      'scripts': {
        'deployment': FileType.SCRIPT_DEPLOYMENT,
        'analysis': FileType.SCRIPT_ANALYSIS,
        'maintenance': FileType.SCRIPT_MAINTENANCE,
        'utilities': FileType.SCRIPT_UTILITIES,
        'legacy': FileType.SCRIPT_LEGACY
      },
      'documents': {
        'troubleshooting': FileType.DOC_TROUBLESHOOTING,
        'deployment': FileType.DOC_DEPLOYMENT,
        'guides': FileType.DOC_GUIDES,
        'reports': FileType.DOC_REPORTS,
        'legacy': FileType.DOC_LEGACY
      },
      'configs': {
        'main': FileType.CONFIG_MAIN,
        'environment': FileType.CONFIG_ENVIRONMENT,
        'samples': FileType.CONFIG_SAMPLES,
        'legacy': FileType.CONFIG_LEGACY
      },
      'tests': {
        'payloads': FileType.TEST_PAYLOADS,
        'unit': FileType.TEST_UNIT,
        'integration': FileType.TEST_INTEGRATION,
        'legacy': FileType.TEST_LEGACY
      },
      'temp': {
        'working': FileType.TEMP_WORKING,
        'cache': FileType.TEMP_CACHE
      },
      'archive': {
        'legacy': FileType.ARCHIVE_LEGACY,
        'projects': FileType.ARCHIVE_PROJECTS
      },
      'security': {
        'keys': FileType.SECURITY_KEYS,
        'secrets': FileType.SECURITY_SECRETS
      }
    };

    return fileTypeMap[category]?.[ruleName] || FileType.UNKNOWN;
  }

  /**
   * ルールのカテゴリを見つける
   */
  private findRuleCategory(rule: any): string {
    for (const [category, rules] of Object.entries(this.config.classificationRules)) {
      if (Object.values(rules).some((r: any) => r.name === rule.name)) {
        return category;
      }
    }
    return 'unknown';
  }

  /**
   * ベースターゲットパスを取得
   */
  private getBaseTargetPath(fileType: FileType): string {
    const pathMap: Record<FileType, string> = {
      [FileType.SCRIPT_DEPLOYMENT]: 'development/scripts/deployment/',
      [FileType.SCRIPT_ANALYSIS]: 'development/scripts/analysis/',
      [FileType.SCRIPT_MAINTENANCE]: 'development/scripts/maintenance/',
      [FileType.SCRIPT_UTILITIES]: 'development/scripts/utilities/',
      [FileType.SCRIPT_LEGACY]: 'development/scripts/legacy/',
      
      [FileType.DOC_TROUBLESHOOTING]: 'docs/troubleshooting/',
      [FileType.DOC_DEPLOYMENT]: 'docs/deployment/',
      [FileType.DOC_GUIDES]: 'docs/guides/',
      [FileType.DOC_REPORTS]: 'development/docs/reports/',
      [FileType.DOC_LEGACY]: 'docs/legacy/',
      
      [FileType.CONFIG_MAIN]: 'config/',
      [FileType.CONFIG_ENVIRONMENT]: 'development/configs/',
      [FileType.CONFIG_SAMPLES]: 'config/samples/',
      [FileType.CONFIG_LEGACY]: 'config/legacy/',
      
      [FileType.TEST_PAYLOADS]: 'tests/payloads/',
      [FileType.TEST_UNIT]: 'tests/unit/',
      [FileType.TEST_INTEGRATION]: 'tests/integration/',
      [FileType.TEST_LEGACY]: 'tests/legacy/',
      
      [FileType.TEMP_WORKING]: 'development/temp/working/',
      [FileType.TEMP_CACHE]: 'development/temp/cache/',
      
      [FileType.ARCHIVE_LEGACY]: 'archive/legacy-files/',
      [FileType.ARCHIVE_PROJECTS]: 'archive/old-projects/',
      
      [FileType.SECURITY_KEYS]: 'development/configs/security/',
      [FileType.SECURITY_SECRETS]: 'development/configs/secrets/',
      
      [FileType.UNKNOWN]: 'archive/unknown/'
    };

    return pathMap[fileType] || 'archive/unknown/';
  }

  /**
   * 環境に応じたパス調整
   */
  private adjustPathForEnvironment(basePath: string, file: FileInfo): string {
    // 環境固有の調整ロジック
    if (this.environment === 'ec2' && basePath.startsWith('development/')) {
      // EC2環境では一部のパスを調整する場合がある
      return basePath;
    }
    
    return basePath;
  }

  /**
   * 重複パスの解決
   */
  private resolveDuplicatePath(basePath: string, fileName: string): string {
    return path.join(basePath, fileName);
  }

  /**
   * ファイルタイプの整合性チェック
   */
  private isFileTypeConsistent(file: FileInfo, fileType: FileType): boolean {
    const extension = file.extension.toLowerCase();
    
    // スクリプトファイルの整合性
    if (fileType.toString().startsWith('script_') && extension !== '.sh') {
      return false;
    }
    
    // ドキュメントファイルの整合性
    if (fileType.toString().startsWith('doc_') && !['.md', '.txt', '.doc', '.docx'].includes(extension)) {
      return false;
    }
    
    // 設定ファイルの整合性
    if (fileType.toString().startsWith('config_') && !['.json', '.js', '.ts', '.yml', '.yaml', '.env'].includes(extension)) {
      return false;
    }
    
    return true;
  }

  /**
   * ターゲットパスの妥当性チェック
   */
  private isTargetPathValid(targetPath: string): boolean {
    // 不正なパス文字のチェック
    if (targetPath.includes('..') || targetPath.includes('//')) {
      return false;
    }
    
    // 必須ディレクトリの存在チェック
    const requiredDirs = this.config.validation.requiredDirectories;
    const baseDir = targetPath.split('/')[0];
    
    return requiredDirs.some(dir => targetPath.startsWith(dir));
  }

  /**
   * 権限設定の妥当性チェック
   */
  private arePermissionsValid(file: FileInfo, fileType: FileType): boolean {
    // セキュリティファイルは制限された権限が必要
    if (fileType === FileType.SECURITY_KEYS || fileType === FileType.SECURITY_SECRETS) {
      return file.permissions === '600';
    }
    
    // スクリプトファイルは実行権限が必要
    if (fileType.toString().startsWith('script_')) {
      return file.permissions.includes('x') || file.permissions === '755';
    }
    
    return true;
  }

  /**
   * 機密ファイルかどうかを判定
   */
  private isSensitiveFile(file: FileInfo): boolean {
    const sensitivePatterns = [
      /\.pem$/i,
      /\.key$/i,
      /\.env$/i,
      /password/i,
      /secret/i,
      /credential/i
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(file.name));
  }

  /**
   * 信頼度を調整
   */
  private adjustConfidence(baseConfidence: number, file: FileInfo, fileType: FileType): number {
    let adjustedConfidence = baseConfidence;
    
    // ファイルサイズによる調整
    if (file.size === 0) {
      adjustedConfidence *= 0.8; // 空ファイルは信頼度を下げる
    }
    
    // 拡張子の整合性による調整
    if (!this.isFileTypeConsistent(file, fileType)) {
      adjustedConfidence *= 0.6;
    }
    
    // 最終更新日による調整
    const daysSinceModified = (Date.now() - file.lastModified.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceModified > 365) {
      adjustedConfidence *= 0.9; // 古いファイルは信頼度を少し下げる
    }
    
    return Math.max(0, Math.min(1, adjustedConfidence));
  }

  /**
   * 分類理由を構築
   */
  private buildReasoning(matchResult: MatchResult, file: FileInfo, fileType: FileType): string[] {
    const reasoning = [matchResult.reason];
    
    // 追加の理由
    if (file.size > 1024 * 1024) {
      reasoning.push('大きなファイル');
    }
    
    if (this.isSensitiveFile(file)) {
      reasoning.push('機密ファイル');
    }
    
    if (file.isHidden) {
      reasoning.push('隠しファイル');
    }
    
    reasoning.push(`分類: ${fileType}`);
    
    return reasoning;
  }

  /**
   * パターンマッチング
   */
  private matchesPattern(text: string, pattern: string): boolean {
    try {
      const regex = new RegExp(
        pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.'),
        'i'
      );
      return regex.test(text);
    } catch {
      return false;
    }
  }

  /**
   * 無視結果を作成
   */
  private createIgnoreResult(file: FileInfo): ClassificationResult {
    return {
      file,
      fileType: FileType.UNKNOWN,
      targetPath: '', // 移動しない
      confidence: 1.0,
      reasoning: ['無視対象ファイル'],
      requiresReview: false,
      classificationTime: new Date(),
      appliedRule: 'ignore'
    };
  }

  /**
   * 保持結果を作成
   */
  private createPreserveResult(file: FileInfo): ClassificationResult {
    return {
      file,
      fileType: FileType.UNKNOWN,
      targetPath: file.path, // 現在の場所に保持
      confidence: 1.0,
      reasoning: ['保持対象ファイル'],
      requiresReview: false,
      classificationTime: new Date(),
      appliedRule: 'preserve'
    };
  }

  /**
   * 不明結果を作成
   */
  private createUnknownResult(file: FileInfo): ClassificationResult {
    return {
      file,
      fileType: FileType.UNKNOWN,
      targetPath: this.getBaseTargetPath(FileType.UNKNOWN) + file.name,
      confidence: 0.1,
      reasoning: ['分類パターンが見つかりません'],
      requiresReview: true,
      classificationTime: new Date(),
      appliedRule: 'unknown'
    };
  }
}