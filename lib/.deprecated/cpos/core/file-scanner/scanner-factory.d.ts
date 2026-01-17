/**
 * File Scanner Factory
 * ファイルスキャナーのファクトリークラス
 */
import { FileScanner, FileScannerConfig } from './index';
import { CPOSConfig } from '../configuration';
export declare class FileScannerFactory {
    /**
     * デフォルト設定でファイルスキャナーを作成
     */
    static createDefault(): FileScanner;
    /**
     * CPOS設定からファイルスキャナーを作成
     */
    static createFromConfig(cposConfig: CPOSConfig): FileScanner;
    /**
     * カスタム設定でファイルスキャナーを作成
     */
    static createCustom(config: Partial<FileScannerConfig>): FileScanner;
    /**
     * 環境別ファイルスキャナーを作成
     */
    static createForEnvironment(environment: 'local' | 'ec2', cposConfig: CPOSConfig): FileScanner;
}
