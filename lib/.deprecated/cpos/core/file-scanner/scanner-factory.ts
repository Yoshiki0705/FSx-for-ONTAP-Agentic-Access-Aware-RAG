/**
 * File Scanner Factory
 * ファイルスキャナーのファクトリークラス
 */

import { FileScanner, FileScannerConfig } from './index';
import { CPOSConfig } from '../configuration';

export class FileScannerFactory {
  /**
   * デフォルト設定でファイルスキャナーを作成
   */
  static createDefault(): FileScanner {
    const defaultConfig: FileScannerConfig = {
      watchPaths: [
        './lib',
        './src',
        './config',
        './docs',
        './scripts',
        './lambda',
        './types'
      ],
      excludePatterns: [
        'node_modules',
        '.git',
        'cdk.out',
        '*.log',
        'temp',
        'backups',
        '.DS_Store',
        'Thumbs.db',
        '*.tmp',
        '*.swp',
        '*.bak'
      ],
      scanInterval: 30000, // 30秒
      enableRealTimeWatch: true,
      maxFileSize: 10 * 1024 * 1024 // 10MB
    };

    return new FileScanner(defaultConfig);
  }

  /**
   * CPOS設定からファイルスキャナーを作成
   */
  static createFromConfig(cposConfig: CPOSConfig): FileScanner {
    const config: FileScannerConfig = {
      watchPaths: [
        cposConfig.environments.local.basePath,
        './lib',
        './src',
        './config',
        './docs',
        './scripts',
        './lambda',
        './types'
      ],
      excludePatterns: [
        ...cposConfig.sync.excludePatterns,
        '.DS_Store',
        'Thumbs.db',
        '*.tmp',
        '*.swp',
        '*.bak'
      ],
      scanInterval: 30000, // 30秒
      enableRealTimeWatch: true,
      maxFileSize: 10 * 1024 * 1024 // 10MB
    };

    return new FileScanner(config);
  }

  /**
   * カスタム設定でファイルスキャナーを作成
   */
  static createCustom(config: Partial<FileScannerConfig>): FileScanner {
    const defaultScanner = this.createDefault();
    const defaultConfig = (defaultScanner as any).config;
    const mergedConfig: FileScannerConfig = {
      ...defaultConfig,
      ...config
    };

    return new FileScanner(mergedConfig);
  }

  /**
   * 環境別ファイルスキャナーを作成
   */
  static createForEnvironment(environment: 'local' | 'ec2', cposConfig: CPOSConfig): FileScanner {
    const envConfig = cposConfig.environments[environment];
    
    const config: FileScannerConfig = {
      watchPaths: [
        envConfig.basePath,
        `${envConfig.basePath}/lib`,
        `${envConfig.basePath}/src`,
        `${envConfig.basePath}/config`,
        `${envConfig.basePath}/docs`,
        `${envConfig.basePath}/scripts`,
        `${envConfig.basePath}/lambda`,
        `${envConfig.basePath}/types`
      ],
      excludePatterns: [
        ...cposConfig.sync.excludePatterns,
        '.DS_Store',
        'Thumbs.db',
        '*.tmp',
        '*.swp',
        '*.bak'
      ],
      scanInterval: environment === 'local' ? 30000 : 60000, // EC2は1分間隔
      enableRealTimeWatch: environment === 'local', // ローカルのみリアルタイム監視
      maxFileSize: 10 * 1024 * 1024 // 10MB
    };

    return new FileScanner(config);
  }
}