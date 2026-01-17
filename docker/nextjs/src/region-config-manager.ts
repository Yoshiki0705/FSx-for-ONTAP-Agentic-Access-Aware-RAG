/**
 * リージョン設定管理
 * 14リージョン対応の統一的な設定管理
 */

export type SupportedRegion = 
  | 'ap-northeast-1'  // 東京
  | 'ap-northeast-3'  // 大阪
  | 'ap-southeast-1'  // シンガポール
  | 'ap-southeast-2'  // シドニー
  | 'ap-south-1'      // ムンバイ
  | 'ap-northeast-2'  // ソウル
  | 'eu-west-1'       // アイルランド
  | 'eu-central-1'    // フランクフルト
  | 'eu-west-2'       // ロンドン
  | 'eu-west-3'       // パリ
  | 'us-east-1'       // バージニア
  | 'us-west-2'       // オレゴン
  | 'us-east-2'       // オハイオ
  | 'sa-east-1';      // サンパウロ

export interface RegionConfig {
  id: SupportedRegion;
  name: string;
  displayName: string;
  displayNameJa: string;
  flag: string;
  group: 'japan' | 'apac' | 'europe' | 'us' | 'south-america';
  bedrockSupported: boolean;
  isPrimary?: boolean;
  isNew?: boolean;
  description?: string;
  warningMessage?: string;
}

export interface RegionSelectOption {
  value: SupportedRegion;
  label: string;
  labelJa: string;
  supported: boolean;
  modelCount?: number;
  description?: string;
  warningMessage?: string;
  isPrimary?: boolean;
  isNew?: boolean;
}

/**
 * 全14リージョンの設定
 */
const REGION_CONFIGS: RegionConfig[] = [
  // 日本地域
  {
    id: 'ap-northeast-1',
    name: 'Tokyo',
    displayName: 'Asia Pacific (Tokyo)',
    displayNameJa: '東京',
    flag: '🇯🇵',
    group: 'japan',
    bedrockSupported: true,
    isPrimary: true,
    description: 'プライマリリージョン（推奨）'
  },
  {
    id: 'ap-northeast-3',
    name: 'Osaka',
    displayName: 'Asia Pacific (Osaka)',
    displayNameJa: '大阪',
    flag: '🇯🇵',
    group: 'japan',
    bedrockSupported: true,
    isNew: true,
    description: '災害復旧・負荷分散用（Bedrock: 東京経由）',
    warningMessage: 'Bedrockは東京リージョンにフォールバックします'
  },
  // APAC地域
  {
    id: 'ap-southeast-1',
    name: 'Singapore',
    displayName: 'Asia Pacific (Singapore)',
    displayNameJa: 'シンガポール',
    flag: '🇸🇬',
    group: 'apac',
    bedrockSupported: true,
    description: 'APAC地域の主要リージョン'
  },
  {
    id: 'ap-southeast-2',
    name: 'Sydney',
    displayName: 'Asia Pacific (Sydney)',
    displayNameJa: 'シドニー',
    flag: '🇦🇺',
    group: 'apac',
    bedrockSupported: true,
    description: 'オーストラリア地域'
  },
  {
    id: 'ap-south-1',
    name: 'Mumbai',
    displayName: 'Asia Pacific (Mumbai)',
    displayNameJa: 'ムンバイ',
    flag: '🇮🇳',
    group: 'apac',
    bedrockSupported: true,
    description: 'インド地域（Bedrock: シンガポール経由）',
    warningMessage: 'Bedrockはシンガポールリージョンにフォールバックします'
  },
  {
    id: 'ap-northeast-2',
    name: 'Seoul',
    displayName: 'Asia Pacific (Seoul)',
    displayNameJa: 'ソウル',
    flag: '🇰🇷',
    group: 'apac',
    bedrockSupported: true,
    description: '韓国地域（Bedrock: 東京経由）',
    warningMessage: 'Bedrockは東京リージョンにフォールバックします'
  },
  // EU地域
  {
    id: 'eu-west-1',
    name: 'Ireland',
    displayName: 'Europe (Ireland)',
    displayNameJa: 'アイルランド',
    flag: '🇮🇪',
    group: 'europe',
    bedrockSupported: true,
    description: 'EU地域の主要リージョン'
  },
  {
    id: 'eu-central-1',
    name: 'Frankfurt',
    displayName: 'Europe (Frankfurt)',
    displayNameJa: 'フランクフルト',
    flag: '🇩🇪',
    group: 'europe',
    bedrockSupported: true,
    description: 'ドイツ地域'
  },
  {
    id: 'eu-west-2',
    name: 'London',
    displayName: 'Europe (London)',
    displayNameJa: 'ロンドン',
    flag: '🇬🇧',
    group: 'europe',
    bedrockSupported: true,
    description: 'イギリス地域（Bedrock: アイルランド経由）',
    warningMessage: 'Bedrockはアイルランドリージョンにフォールバックします'
  },
  {
    id: 'eu-west-3',
    name: 'Paris',
    displayName: 'Europe (Paris)',
    displayNameJa: 'パリ',
    flag: '🇫🇷',
    group: 'europe',
    bedrockSupported: true,
    description: 'フランス地域'
  },
  // US地域
  {
    id: 'us-east-1',
    name: 'N. Virginia',
    displayName: 'US East (N. Virginia)',
    displayNameJa: 'バージニア',
    flag: '🇺🇸',
    group: 'us',
    bedrockSupported: true,
    description: '最も多くのモデルが利用可能'
  },
  {
    id: 'us-west-2',
    name: 'Oregon',
    displayName: 'US West (Oregon)',
    displayNameJa: 'オレゴン',
    flag: '🇺🇸',
    group: 'us',
    bedrockSupported: true,
    description: '米国西海岸'
  },
  {
    id: 'us-east-2',
    name: 'Ohio',
    displayName: 'US East (Ohio)',
    displayNameJa: 'オハイオ',
    flag: '🇺🇸',
    group: 'us',
    bedrockSupported: true,
    description: '米国中部（Bedrock: バージニア経由）',
    warningMessage: 'Bedrockはバージニアリージョンにフォールバックします'
  },
  // 南米地域
  {
    id: 'sa-east-1',
    name: 'São Paulo',
    displayName: 'South America (São Paulo)',
    displayNameJa: 'サンパウロ',
    flag: '🇧🇷',
    group: 'south-america',
    bedrockSupported: true,
    description: '南米地域（Bedrock: バージニア経由）',
    warningMessage: 'Bedrockはバージニアリージョンにフォールバックします'
  }
];

/**
 * RegionConfigManager
 * リージョン設定の統一的な管理
 */
export class RegionConfigManager {
  /**
   * デフォルトリージョンを取得
   */
  static getDefaultRegion(): SupportedRegion {
    // 環境変数から取得
    const envRegion = process.env.NEXT_PUBLIC_BEDROCK_REGION || process.env.BEDROCK_REGION;
    if (envRegion && this.isRegionSupported(envRegion)) {
      return envRegion as SupportedRegion;
    }
    
    // デフォルトは東京
    return 'ap-northeast-1';
  }

  /**
   * リージョンがサポートされているか確認
   */
  static isRegionSupported(region: string): boolean {
    return REGION_CONFIGS.some(config => config.id === region);
  }

  /**
   * リージョン設定を取得
   */
  static getRegionConfig(regionId: string): RegionConfig | undefined {
    return REGION_CONFIGS.find(config => config.id === regionId);
  }

  /**
   * 全リージョン設定を取得
   */
  static getAllRegions(): RegionConfig[] {
    return REGION_CONFIGS;
  }

  /**
   * Bedrockサポートリージョンのみ取得
   */
  static getBedrockSupportedRegions(): RegionConfig[] {
    return REGION_CONFIGS.filter(config => config.bedrockSupported);
  }

  /**
   * リージョン選択オプションを取得
   */
  static getRegionSelectOptions(): RegionSelectOption[] {
    // モデル数計算用のインポート
    const { PROVIDER_REGION_AVAILABILITY } = require('./config/region-model-availability');
    
    return REGION_CONFIGS.map(config => {
      // リージョンごとの利用可能モデル数を計算
      let modelCount = 0;
      const providerModelCounts: Record<string, number> = {
        'amazon': 8,      // Nova, Titan系
        'anthropic': 6,   // Claude系
        'meta': 4,        // Llama系
        'mistral': 3,     // Mistral系
        'cohere': 2,      // Command系
        'ai21': 2,        // Jurassic系
        'openai': 1,      // OpenAI互換
        'deepseek': 1,    // DeepSeek
        'qwen': 1         // Qwen
      };
      
      Object.entries(PROVIDER_REGION_AVAILABILITY).forEach(([provider, availability]: [string, any]) => {
        if (availability.availableRegions.includes(config.id)) {
          modelCount += providerModelCounts[provider] || 1;
        }
      });
      
      return {
        value: config.id,
        label: config.displayName,
        labelJa: config.displayNameJa,
        supported: config.bedrockSupported,
        modelCount: modelCount,
        description: config.description,
        warningMessage: config.warningMessage,
        isPrimary: config.isPrimary,
        isNew: config.isNew
      };
    });
  }

  /**
   * リージョン表示名を取得
   */
  static getRegionDisplayName(regionId: string, locale: 'en' | 'ja' = 'ja'): string {
    const config = this.getRegionConfig(regionId);
    if (!config) return regionId;
    return locale === 'ja' ? config.displayNameJa : config.displayName;
  }

  /**
   * リージョンの妥当性を検証
   */
  static validateRegion(region: string): {
    isValid: boolean;
    message?: string;
    fallbackRegion: SupportedRegion;
  } {
    const config = this.getRegionConfig(region);
    
    if (!config) {
      return {
        isValid: false,
        message: `リージョン ${region} はサポートされていません`,
        fallbackRegion: this.getDefaultRegion()
      };
    }

    if (!config.bedrockSupported) {
      return {
        isValid: true,
        message: `${config.displayNameJa}はBedrockをサポートしていません。自動的にフォールバックします。`,
        fallbackRegion: this.getDefaultRegion()
      };
    }

    return {
      isValid: true,
      fallbackRegion: config.id
    };
  }
}

