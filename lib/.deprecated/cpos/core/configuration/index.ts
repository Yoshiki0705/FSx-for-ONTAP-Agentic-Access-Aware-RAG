/**
 * Configuration Manager
 * システム全体の設定管理と環境固有設定の処理を担当
 */

export interface CPOSConfig {
  version: string;
  environments: {
    local: EnvironmentConfig;
    ec2: EnvironmentConfig;
  };
  classification: ClassificationConfig;
  sync: SyncConfig;
  backup: BackupConfig;
}

export interface EnvironmentConfig {
  basePath: string;
  tempPath: string;
  backupPath: string;
  host?: string;
  user?: string;
  keyPath?: string;
}

export interface ClassificationConfig {
  rules: string;
  confidence: number;
  autoApply: boolean;
}

export interface SyncConfig {
  interval: string;
  conflictResolution: 'prompt' | 'auto' | 'manual';
  excludePatterns: string[];
}

export interface BackupConfig {
  schedule: {
    incremental: string;
    full: string;
    archive: string;
  };
  retention: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

export class ConfigurationManager {
  private config: CPOSConfig | null = null;
  private configPath: string;

  constructor(configPath: string = './config/cpos.config.json') {
    this.configPath = configPath;
  }

  /**
   * 設定ファイルを読み込む
   */
  async loadConfig(): Promise<CPOSConfig> {
    try {
      const fs = await import('fs/promises');
      const configData = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(configData);
      return this.config!;
    } catch (error) {
      console.warn(`設定ファイルが見つかりません: ${this.configPath}. デフォルト設定を使用します。`);
      return this.getDefaultConfig();
    }
  }

  /**
   * デフォルト設定を取得
   */
  getDefaultConfig(): CPOSConfig {
    return {
      version: "1.0.0",
      environments: {
        local: {
          basePath: "./",
          tempPath: "./temp",
          backupPath: "./backups"
        },
        ec2: {
          basePath: "/home/ubuntu/project",
          tempPath: "/home/ubuntu/project/temp",
          backupPath: "/home/ubuntu/project/backups",
          host: process.env.EC2_HOST || "",
          user: process.env.EC2_USER || "ubuntu",
          keyPath: process.env.SSH_KEY_PATH || ""
        }
      },
      classification: {
        rules: "./config/classification-rules.json",
        confidence: 0.8,
        autoApply: true
      },
      sync: {
        interval: "0 */6 * * *", // 6時間毎
        conflictResolution: "prompt",
        excludePatterns: ["node_modules", "*.log", "cdk.out"]
      },
      backup: {
        schedule: {
          incremental: "0 2 * * *",    // 毎日2時
          full: "0 2 * * 0",           // 毎週日曜2時
          archive: "0 2 1 * *"         // 毎月1日2時
        },
        retention: {
          daily: 30,
          weekly: 12,
          monthly: 12
        }
      }
    };
  }

  /**
   * 設定を保存
   */
  async saveConfig(config: CPOSConfig): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // 設定ディレクトリを作成
    const configDir = path.dirname(this.configPath);
    await fs.mkdir(configDir, { recursive: true });
    
    // 設定を保存
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
    this.config = config;
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): CPOSConfig {
    if (!this.config) {
      throw new Error('設定が読み込まれていません。loadConfig()を先に実行してください。');
    }
    return this.config;
  }

  /**
   * 環境固有の設定を取得
   */
  getEnvironmentConfig(environment: 'local' | 'ec2'): EnvironmentConfig {
    const config = this.getConfig();
    return config.environments[environment];
  }

  /**
   * 設定の検証
   */
  validateConfig(config: CPOSConfig): boolean {
    // 必須フィールドの検証
    if (!config.version || !config.environments) {
      return false;
    }

    // 環境設定の検証
    const { local, ec2 } = config.environments;
    if (!local?.basePath || !ec2?.basePath) {
      return false;
    }

    return true;
  }
}