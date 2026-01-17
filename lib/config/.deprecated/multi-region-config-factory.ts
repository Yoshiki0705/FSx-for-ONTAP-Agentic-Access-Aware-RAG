/**
 * マルチリージョン設定ファクトリー
 * 
 * 機能:
 * - リージョン別設定の一元管理
 * - 設定バリデーション
 * - 自動CIDR計算
 * - コンプライアンス要件チェック
 */

import { MultiRegionConfig, Region } from './interfaces/multi-region-config';
import { VpcCidrCalculator } from './utilities/vpc-cidr-calculator';

// リージョン別設定インポート
import { TOKYO_MULTI_REGION_CONFIG } from './environments/tokyo-config';
import { OSAKA_MULTI_REGION_CONFIG } from './environments/osaka-config';
import { APAC_MULTI_REGION_CONFIG } from './environments/apac-config';
import { EU_MULTI_REGION_CONFIG } from './environments/eu-config';
import { US_MULTI_REGION_CONFIG } from './environments/us-config';
import { SA_MULTI_REGION_CONFIG } from './environments/sa-config';

/**
 * 設定バリデーション結果
 */
export interface ConfigValidationResult {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
}

/**
 * マルチリージョン設定ファクトリー
 */
export class MultiRegionConfigFactory {
  private static readonly REGION_CONFIGS: Record<Region, MultiRegionConfig> = {
    // 日本
    [Region.TOKYO]: TOKYO_MULTI_REGION_CONFIG,
    [Region.OSAKA]: OSAKA_MULTI_REGION_CONFIG,
    
    // APAC
    [Region.SINGAPORE]: APAC_MULTI_REGION_CONFIG,
    [Region.SYDNEY]: { ...APAC_MULTI_REGION_CONFIG, primaryRegion: Region.SYDNEY },
    [Region.MUMBAI]: { ...APAC_MULTI_REGION_CONFIG, primaryRegion: Region.MUMBAI },
    [Region.SEOUL]: { ...APAC_MULTI_REGION_CONFIG, primaryRegion: Region.SEOUL },
    
    // EU
    [Region.IRELAND]: EU_MULTI_REGION_CONFIG,
    [Region.FRANKFURT]: { ...EU_MULTI_REGION_CONFIG, primaryRegion: Region.FRANKFURT },
    [Region.LONDON]: { ...EU_MULTI_REGION_CONFIG, primaryRegion: Region.LONDON },
    [Region.PARIS]: { ...EU_MULTI_REGION_CONFIG, primaryRegion: Region.PARIS },
    
    // US
    [Region.VIRGINIA]: US_MULTI_REGION_CONFIG,
    [Region.OREGON]: { ...US_MULTI_REGION_CONFIG, primaryRegion: Region.OREGON },
    [Region.OHIO]: { ...US_MULTI_REGION_CONFIG, primaryRegion: Region.OHIO },
    
    // 南米
    [Region.SAO_PAULO]: SA_MULTI_REGION_CONFIG,
  };

  /**
   * リージョン設定取得（文字列リージョンから）
   */
  static getRegionConfig(regionString: string): { regionName: string; regionPrefix: string } {
    const region = this.parseRegion(regionString);
    const config = this.getConfig(region);
    
    return {
      regionName: config.regionConfig.regionName,
      regionPrefix: config.regionConfig.regionPrefix,
    };
  }

  /**
   * 文字列からRegion enumに変換
   */
  static parseRegion(regionString: string): Region {
    const regionMap: Record<string, Region> = {
      'ap-northeast-1': Region.TOKYO,
      'ap-northeast-3': Region.OSAKA,
      'ap-southeast-1': Region.SINGAPORE,
      'ap-southeast-2': Region.SYDNEY,
      'ap-south-1': Region.MUMBAI,
      'ap-northeast-2': Region.SEOUL,
      'eu-west-1': Region.IRELAND,
      'eu-central-1': Region.FRANKFURT,
      'eu-west-2': Region.LONDON,
      'eu-west-3': Region.PARIS,
      'us-east-1': Region.VIRGINIA,
      'us-west-2': Region.OREGON,
      'us-east-2': Region.OHIO,
      'sa-east-1': Region.SAO_PAULO,
    };
    
    const region = regionMap[regionString];
    if (!region) {
      throw new Error(`Unsupported region string: ${regionString}`);
    }
    
    return region;
  }

  /**
   * リージョン設定取得
   */
  static getConfig(region: Region): MultiRegionConfig {
    const config = this.REGION_CONFIGS[region];
    if (!config) {
      throw new Error(`Unsupported region: ${region}`);
    }
    
    // CIDR自動計算が有効な場合は計算実行
    if (config.regionConfig.vpcCidr.autoCalculate) {
      const calculatedCidr = VpcCidrCalculator.generateVpcCidr(region);
      return {
        ...config,
        networking: {
          ...config.networking,
          vpc: {
            ...config.networking.vpc,
            cidr: calculatedCidr,
          },
        },
      };
    }
    
    return config;
  }

  /**
   * 利用可能リージョン一覧取得
   */
  static getAvailableRegions(): Region[] {
    return Object.keys(this.REGION_CONFIGS) as Region[];
  }

  /**
   * 地域別リージョン取得
   */
  static getRegionsByArea(): Record<string, Region[]> {
    return {
      japan: [Region.TOKYO, Region.OSAKA],
      apac: [Region.SINGAPORE, Region.SYDNEY, Region.MUMBAI, Region.SEOUL],
      eu: [Region.IRELAND, Region.FRANKFURT, Region.LONDON, Region.PARIS],
      us: [Region.VIRGINIA, Region.OREGON, Region.OHIO],
      southAmerica: [Region.SAO_PAULO],
    };
  }

  /**
   * 設定バリデーション
   */
  static validateConfig(config: MultiRegionConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 基本設定チェック
    if (!config.primaryRegion) {
      errors.push('Primary region is required');
    }

    if (!config.regionConfig) {
      errors.push('Region configuration is required');
    }

    // CIDR競合チェック
    const cidrs = [config.networking.vpc.cidr];
    if (config.secondaryRegion) {
      const secondaryConfig = this.getConfig(config.secondaryRegion);
      cidrs.push(secondaryConfig.networking.vpc.cidr);
    }

    if (VpcCidrCalculator.checkCidrConflicts(cidrs)) {
      errors.push('VPC CIDR conflicts detected');
    }

    // コンプライアンス要件チェック
    if (config.regionConfig.compliance.dataResidency && config.secondaryRegion) {
      const primaryArea = this.getRegionArea(config.primaryRegion);
      const secondaryArea = this.getRegionArea(config.secondaryRegion);
      
      if (primaryArea !== secondaryArea) {
        warnings.push('Cross-region data residency requirements may be violated');
      }
    }

    // 機能可用性チェック
    if (config.storage.fsx.enabled && !config.regionConfig.features.fsxOntap) {
      errors.push(`FSx ONTAP is not available in region: ${config.primaryRegion}`);
    }

    if (config.ai.bedrock.enabled && !config.regionConfig.features.bedrock) {
      errors.push(`Amazon Bedrock is not available in region: ${config.primaryRegion}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * リージョンの地域取得
   */
  private static getRegionArea(region: Region): string {
    const regionsByArea = this.getRegionsByArea();
    
    for (const [area, regions] of Object.entries(regionsByArea)) {
      if (regions.includes(region)) {
        return area;
      }
    }
    
    return 'unknown';
  }

  /**
   * カスタム設定作成
   */
  static createCustomConfig(
    baseRegion: Region,
    overrides: Partial<MultiRegionConfig>
  ): MultiRegionConfig {
    const baseConfig = this.getConfig(baseRegion);
    
    return {
      ...baseConfig,
      ...overrides,
      regionConfig: {
        ...baseConfig.regionConfig,
        ...overrides.regionConfig,
      },
    };
  }

  /**
   * 災害復旧ペア設定取得
   */
  static getDisasterRecoveryPairs(): Record<Region, Region | undefined> {
    return {
      // 日本
      [Region.TOKYO]: Region.OSAKA,
      [Region.OSAKA]: Region.TOKYO,
      
      // APAC
      [Region.SINGAPORE]: Region.SYDNEY,
      [Region.SYDNEY]: Region.SINGAPORE,
      [Region.MUMBAI]: undefined,
      [Region.SEOUL]: undefined,
      
      // EU
      [Region.IRELAND]: Region.FRANKFURT,
      [Region.FRANKFURT]: Region.IRELAND,
      [Region.LONDON]: undefined,
      [Region.PARIS]: undefined,
      
      // US
      [Region.VIRGINIA]: Region.OREGON,
      [Region.OREGON]: Region.VIRGINIA,
      [Region.OHIO]: undefined,
      
      // 南米
      [Region.SAO_PAULO]: undefined,
    };
  }

  /**
   * コンプライアンス要件サマリー取得
   */
  static getComplianceSummary(region: Region): string[] {
    const config = this.getConfig(region);
    const laws = config.regionConfig.compliance.applicableLaws;
    
    return laws.map(law => {
      switch (law) {
        case 'PIPA_JP': return '個人情報保護法（日本）';
        case 'FISC': return 'FISC安全対策基準';
        case 'PDPA_SG': return 'PDPA（シンガポール）';
        case 'PRIVACY_ACT_AU': return 'Privacy Act（オーストラリア）';
        case 'DPDP_ACT_IN': return 'DPDP Act（インド）';
        case 'PIPA_KR': return 'PIPA（韓国）';
        case 'GDPR': return 'GDPR（EU一般データ保護規則）';
        case 'BDSG': return 'BDSG（ドイツ連邦データ保護法）';
        case 'UK_GDPR': return 'UK-GDPR（英国GDPR）';
        case 'SOX': return 'SOX法（サーベンス・オクスリー法）';
        case 'HIPAA': return 'HIPAA（医療保険の相互運用性と説明責任に関する法律）';
        case 'CCPA': return 'CCPA（カリフォルニア州消費者プライバシー法）';
        case 'LGPD': return 'LGPD（ブラジル一般データ保護法）';
        default: return law;
      }
    });
  }
}