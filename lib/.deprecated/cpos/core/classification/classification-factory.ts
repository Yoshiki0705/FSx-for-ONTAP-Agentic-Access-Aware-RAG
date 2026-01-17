/**
 * Classification Engine Factory
 * 分類エンジンのファクトリークラス
 */

import { ClassificationEngine, ClassificationConfig } from './index';
import { CPOSConfig } from '../configuration';

export class ClassificationEngineFactory {
  /**
   * デフォルト設定で分類エンジンを作成
   */
  static createDefault(): ClassificationEngine {
    const defaultConfig: ClassificationConfig = {
      rulesFile: './config/classification-rules.json',
      defaultConfidenceThreshold: 0.7,
      maxContentAnalysisSize: 1024 * 1024, // 1MB
      enableContentAnalysis: true,
      enableLearning: true
    };

    return new ClassificationEngine(defaultConfig);
  }

  /**
   * CPOS設定から分類エンジンを作成
   */
  static createFromConfig(cposConfig: CPOSConfig): ClassificationEngine {
    const config: ClassificationConfig = {
      rulesFile: cposConfig.classification.rules,
      defaultConfidenceThreshold: cposConfig.classification.confidence,
      maxContentAnalysisSize: 1024 * 1024, // 1MB
      enableContentAnalysis: true,
      enableLearning: true
    };

    return new ClassificationEngine(config);
  }

  /**
   * カスタム設定で分類エンジンを作成
   */
  static createCustom(config: Partial<ClassificationConfig>): ClassificationEngine {
    const defaultConfig: ClassificationConfig = {
      rulesFile: './config/classification-rules.json',
      defaultConfidenceThreshold: 0.7,
      maxContentAnalysisSize: 1024 * 1024,
      enableContentAnalysis: true,
      enableLearning: true
    };

    const mergedConfig: ClassificationConfig = {
      ...defaultConfig,
      ...config
    };

    return new ClassificationEngine(mergedConfig);
  }

  /**
   * 高速分類エンジンを作成（内容解析無効）
   */
  static createFast(): ClassificationEngine {
    const config: ClassificationConfig = {
      rulesFile: './config/classification-rules.json',
      defaultConfidenceThreshold: 0.6,
      maxContentAnalysisSize: 0,
      enableContentAnalysis: false,
      enableLearning: false
    };

    return new ClassificationEngine(config);
  }

  /**
   * 学習機能付き分類エンジンを作成
   */
  static createWithLearning(): ClassificationEngine {
    const config: ClassificationConfig = {
      rulesFile: './config/classification-rules.json',
      defaultConfidenceThreshold: 0.8,
      maxContentAnalysisSize: 2 * 1024 * 1024, // 2MB
      enableContentAnalysis: true,
      enableLearning: true
    };

    return new ClassificationEngine(config);
  }

  /**
   * 特定のファイルタイプ用分類エンジンを作成
   */
  static createForFileType(fileType: 'code' | 'docs' | 'config' | 'test'): ClassificationEngine {
    const baseConfig: ClassificationConfig = {
      rulesFile: `./config/classification-rules-${fileType}.json`,
      defaultConfidenceThreshold: 0.8,
      maxContentAnalysisSize: 1024 * 1024,
      enableContentAnalysis: true,
      enableLearning: true
    };

    return new ClassificationEngine(baseConfig);
  }
}