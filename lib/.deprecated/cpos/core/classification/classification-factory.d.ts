/**
 * Classification Engine Factory
 * 分類エンジンのファクトリークラス
 */
import { ClassificationEngine, ClassificationConfig } from './index';
import { CPOSConfig } from '../configuration';
export declare class ClassificationEngineFactory {
    /**
     * デフォルト設定で分類エンジンを作成
     */
    static createDefault(): ClassificationEngine;
    /**
     * CPOS設定から分類エンジンを作成
     */
    static createFromConfig(cposConfig: CPOSConfig): ClassificationEngine;
    /**
     * カスタム設定で分類エンジンを作成
     */
    static createCustom(config: Partial<ClassificationConfig>): ClassificationEngine;
    /**
     * 高速分類エンジンを作成（内容解析無効）
     */
    static createFast(): ClassificationEngine;
    /**
     * 学習機能付き分類エンジンを作成
     */
    static createWithLearning(): ClassificationEngine;
    /**
     * 特定のファイルタイプ用分類エンジンを作成
     */
    static createForFileType(fileType: 'code' | 'docs' | 'config' | 'test'): ClassificationEngine;
}
