import { RegionConfig, RegionalDeploymentConfig } from './regional-deployment-manager';

/**
 * 地域別設定ファクトリー
 * 
 * 各地域の特性に応じた設定を提供
 */
export class RegionalConfigFactory {
  /**
   * 日本地域設定
   */
  public static createJapanRegionConfigs(): RegionConfig[] {
    return [
      {
        region: 'ap-northeast-1',
        displayName: '東京',
        priority: 1,
        complianceRequirements: ['PDPA-Japan', 'FISC', 'Personal-Information-Protection-Act'],
        dataResidencyRestrictions: true,
        availabilityZones: 3,
        environmentConfig: {
          instanceTypes: ['t3.medium', 't3.large', 'm5.large', 'm5.xlarge'],
          storageTypes: ['gp3', 'io2'],
          networkConfig: {
            vpcCidr: '10.1.0.0/16',
            publicSubnets: ['10.1.1.0/24', '10.1.2.0/24', '10.1.3.0/24'],
            privateSubnets: ['10.1.11.0/24', '10.1.12.0/24', '10.1.13.0/24']
          }
        }
      },
      {
        region: 'ap-northeast-3',
        displayName: '大阪',
        priority: 2,
        complianceRequirements: ['PDPA-Japan', 'FISC', 'Personal-Information-Protection-Act'],
        dataResidencyRestrictions: true,
        availabilityZones: 3,
        environmentConfig: {
          instanceTypes: ['t3.medium', 't3.large', 'm5.large'],
          storageTypes: ['gp3', 'io2'],
          networkConfig: {
            vpcCidr: '10.2.0.0/16',
            publicSubnets: ['10.2.1.0/24', '10.2.2.0/24', '10.2.3.0/24'],
            privateSubnets: ['10.2.11.0/24', '10.2.12.0/24', '10.2.13.0/24']
          }
        }
      }
    ];
  }

  /**
   * APAC地域設定
   */
  public static createApacRegionConfigs(): RegionConfig[] {
    return [
      {
        region: 'ap-southeast-1',
        displayName: 'シンガポール',
        priority: 3,
        complianceRequirements: ['PDPA-Singapore', 'MAS-Technology-Risk-Management'],
        dataResidencyRestrictions: true,
        availabilityZones: 3,
        environmentConfig: {
          instanceTypes: ['t3.medium', 't3.large', 'm5.large', 'm5.xlarge'],
          storageTypes: ['gp3', 'io2'],
          networkConfig: {
            vpcCidr: '10.3.0.0/16',
            publicSubnets: ['10.3.1.0/24', '10.3.2.0/24', '10.3.3.0/24'],
            privateSubnets: ['10.3.11.0/24', '10.3.12.0/24', '10.3.13.0/24']
          }
        }
      },
      {
        region: 'ap-southeast-2',
        displayName: 'シドニー',
        priority: 4,
        complianceRequirements: ['Privacy-Act-Australia', 'APRA-Prudential-Standards'],
        dataResidencyRestrictions: true,
        availabilityZones: 3,
        environmentConfig: {
          instanceTypes: ['t3.medium', 't3.large', 'm5.large'],
          storageTypes: ['gp3', 'io2'],
          networkConfig: {
            vpcCidr: '10.4.0.0/16',
            publicSubnets: ['10.4.1.0/24', '10.4.2.0/24', '10.4.3.0/24'],
            privateSubnets: ['10.4.11.0/24', '10.4.12.0/24', '10.4.13.0/24']
          }
        }
      },
      {
        region: 'ap-south-1',
        displayName: 'ムンバイ',
        priority: 5,
        complianceRequirements: ['DPDP-India', 'RBI-Guidelines'],
        dataResidencyRestrictions: true,
        availabilityZones: 3,
        environmentConfig: {
          instanceTypes: ['t3.medium', 't3.large', 'm5.large'],
          storageTypes: ['gp3', 'io2'],
          networkConfig: {
            vpcCidr: '10.5.0.0/16',
            publicSubnets: ['10.5.1.0/24', '10.5.2.0/24', '10.5.3.0/24'],
            privateSubnets: ['10.5.11.0/24', '10.5.12.0/24', '10.5.13.0/24']
          }
        }
      },
      {
        region: 'ap-northeast-2',
        displayName: 'ソウル',
        priority: 6,
        complianceRequirements: ['PIPA-Korea', 'K-ISMS'],
        dataResidencyRestrictions: true,
        availabilityZones: 4,
        environmentConfig: {
          instanceTypes: ['t3.medium', 't3.large', 'm5.large'],
          storageTypes: ['gp3', 'io2'],
          networkConfig: {
            vpcCidr: '10.6.0.0/16',
            publicSubnets: ['10.6.1.0/24', '10.6.2.0/24', '10.6.3.0/24', '10.6.4.0/24'],
            privateSubnets: ['10.6.11.0/24', '10.6.12.0/24', '10.6.13.0/24', '10.6.14.0/24']
          }
        }
      }
    ];
  }

  /**
   * EU地域設定
   */
  public static createEuRegionConfigs(): RegionConfig[] {
    return [
      {
        region: 'eu-central-1',
        displayName: 'フランクフルト',
        priority: 7,
        complianceRequirements: ['GDPR', 'BDSG', 'BSI-IT-Grundschutz'],
        dataResidencyRestrictions: true,
        availabilityZones: 3,
        environmentConfig: {
          instanceTypes: ['t3.medium', 't3.large', 'm5.large', 'm5.xlarge'],
          storageTypes: ['gp3', 'io2'],
          networkConfig: {
            vpcCidr: '10.7.0.0/16',
            publicSubnets: ['10.7.1.0/24', '10.7.2.0/24', '10.7.3.0/24'],
            privateSubnets: ['10.7.11.0/24', '10.7.12.0/24', '10.7.13.0/24']
          }
        }
      },
      {
        region: 'eu-west-1',
        displayName: 'アイルランド',
        priority: 8,
        complianceRequirements: ['GDPR', 'DPA-Ireland'],
        dataResidencyRestrictions: true,
        availabilityZones: 3,
        environmentConfig: {
          instanceTypes: ['t3.medium', 't3.large', 'm5.large', 'm5.xlarge'],
          storageTypes: ['gp3', 'io2'],
          networkConfig: {
            vpcCidr: '10.8.0.0/16',
            publicSubnets: ['10.8.1.0/24', '10.8.2.0/24', '10.8.3.0/24'],
            privateSubnets: ['10.8.11.0/24', '10.8.12.0/24', '10.8.13.0/24']
          }
        }
      },
      {
        region: 'eu-west-2',
        displayName: 'ロンドン',
        priority: 9,
        complianceRequirements: ['GDPR', 'UK-GDPR', 'DPA-UK'],
        dataResidencyRestrictions: true,
        availabilityZones: 3,
        environmentConfig: {
          instanceTypes: ['t3.medium', 't3.large', 'm5.large'],
          storageTypes: ['gp3', 'io2'],
          networkConfig: {
            vpcCidr: '10.9.0.0/16',
            publicSubnets: ['10.9.1.0/24', '10.9.2.0/24', '10.9.3.0/24'],
            privateSubnets: ['10.9.11.0/24', '10.9.12.0/24', '10.9.13.0/24']
          }
        }
      }
    ];
  }

  /**
   * US地域設定
   */
  public static createUsRegionConfigs(): RegionConfig[] {
    return [
      {
        region: 'us-east-1',
        displayName: 'バージニア北部',
        priority: 10,
        complianceRequirements: ['SOX', 'HIPAA', 'PCI-DSS', 'FedRAMP'],
        dataResidencyRestrictions: false,
        availabilityZones: 6,
        environmentConfig: {
          instanceTypes: ['t3.medium', 't3.large', 'm5.large', 'm5.xlarge', 'm5.2xlarge'],
          storageTypes: ['gp3', 'io2', 'st1'],
          networkConfig: {
            vpcCidr: '10.10.0.0/16',
            publicSubnets: ['10.10.1.0/24', '10.10.2.0/24', '10.10.3.0/24'],
            privateSubnets: ['10.10.11.0/24', '10.10.12.0/24', '10.10.13.0/24']
          }
        }
      },
      {
        region: 'us-west-2',
        displayName: 'オレゴン',
        priority: 11,
        complianceRequirements: ['SOX', 'CCPA', 'HIPAA', 'PCI-DSS'],
        dataResidencyRestrictions: false,
        availabilityZones: 4,
        environmentConfig: {
          instanceTypes: ['t3.medium', 't3.large', 'm5.large', 'm5.xlarge'],
          storageTypes: ['gp3', 'io2'],
          networkConfig: {
            vpcCidr: '10.11.0.0/16',
            publicSubnets: ['10.11.1.0/24', '10.11.2.0/24', '10.11.3.0/24', '10.11.4.0/24'],
            privateSubnets: ['10.11.11.0/24', '10.11.12.0/24', '10.11.13.0/24', '10.11.14.0/24']
          }
        }
      }
    ];
  }

  /**
   * 南米地域設定
   */
  public static createSouthAmericaRegionConfigs(): RegionConfig[] {
    return [
      {
        region: 'sa-east-1',
        displayName: 'サンパウロ',
        priority: 12,
        complianceRequirements: ['LGPD', 'Marco-Civil-da-Internet'],
        dataResidencyRestrictions: true,
        availabilityZones: 3,
        environmentConfig: {
          instanceTypes: ['t3.medium', 't3.large', 'm5.large'],
          storageTypes: ['gp3', 'io2'],
          networkConfig: {
            vpcCidr: '10.12.0.0/16',
            publicSubnets: ['10.12.1.0/24', '10.12.2.0/24', '10.12.3.0/24'],
            privateSubnets: ['10.12.11.0/24', '10.12.12.0/24', '10.12.13.0/24']
          }
        }
      }
    ];
  }

  /**
   * デプロイメント戦略設定
   */
  public static createDeploymentStrategies(): {
    [key: string]: RegionalDeploymentConfig
  } {
    return {
      // 保守的戦略（金融機関向け）
      conservative: {
        targetRegions: this.createJapanRegionConfigs(),
        deploymentStrategy: 'BLUE_GREEN',
        rollbackConfig: {
          enabled: true,
          healthCheckThreshold: 95,
          rollbackTimeoutMinutes: 5
        },
        crossRegionReplication: true,
        disasterRecovery: {
          enabled: true,
          rtoMinutes: 15,
          rpoMinutes: 5
        }
      },

      // 積極的戦略（スタートアップ向け）
      aggressive: {
        targetRegions: [
          ...this.createJapanRegionConfigs(),
          ...this.createUsRegionConfigs()
        ],
        deploymentStrategy: 'ROLLING',
        rollbackConfig: {
          enabled: true,
          healthCheckThreshold: 80,
          rollbackTimeoutMinutes: 10
        },
        crossRegionReplication: false,
        disasterRecovery: {
          enabled: false,
          rtoMinutes: 60,
          rpoMinutes: 30
        }
      },

      // グローバル戦略（多国籍企業向け）
      global: {
        targetRegions: [
          ...this.createJapanRegionConfigs(),
          ...this.createApacRegionConfigs(),
          ...this.createEuRegionConfigs(),
          ...this.createUsRegionConfigs(),
          ...this.createSouthAmericaRegionConfigs()
        ],
        deploymentStrategy: 'CANARY',
        rollbackConfig: {
          enabled: true,
          healthCheckThreshold: 90,
          rollbackTimeoutMinutes: 8
        },
        crossRegionReplication: true,
        disasterRecovery: {
          enabled: true,
          rtoMinutes: 30,
          rpoMinutes: 15
        }
      },

      // 日本専用戦略
      japanOnly: {
        targetRegions: this.createJapanRegionConfigs(),
        deploymentStrategy: 'BLUE_GREEN',
        rollbackConfig: {
          enabled: true,
          healthCheckThreshold: 92,
          rollbackTimeoutMinutes: 7
        },
        crossRegionReplication: true,
        disasterRecovery: {
          enabled: true,
          rtoMinutes: 10,
          rpoMinutes: 2
        }
      },

      // APAC戦略
      apac: {
        targetRegions: [
          ...this.createJapanRegionConfigs(),
          ...this.createApacRegionConfigs()
        ],
        deploymentStrategy: 'CANARY',
        rollbackConfig: {
          enabled: true,
          healthCheckThreshold: 88,
          rollbackTimeoutMinutes: 12
        },
        crossRegionReplication: true,
        disasterRecovery: {
          enabled: true,
          rtoMinutes: 20,
          rpoMinutes: 10
        }
      }
    };
  }

  /**
   * 地域別コンプライアンス要件マッピング
   */
  public static getComplianceRequirements(): {
    [region: string]: {
      regulations: string[];
      dataResidency: boolean;
      encryptionRequired: boolean;
      auditLogRetention: number; // days
      accessControlLevel: 'BASIC' | 'ENHANCED' | 'STRICT';
    }
  } {
    return {
      'ap-northeast-1': {
        regulations: ['PDPA-Japan', 'FISC', 'Personal-Information-Protection-Act'],
        dataResidency: true,
        encryptionRequired: true,
        auditLogRetention: 2555, // 7年
        accessControlLevel: 'STRICT'
      },
      'ap-northeast-3': {
        regulations: ['PDPA-Japan', 'FISC', 'Personal-Information-Protection-Act'],
        dataResidency: true,
        encryptionRequired: true,
        auditLogRetention: 2555, // 7年
        accessControlLevel: 'STRICT'
      },
      'ap-southeast-1': {
        regulations: ['PDPA-Singapore', 'MAS-Technology-Risk-Management'],
        dataResidency: true,
        encryptionRequired: true,
        auditLogRetention: 2190, // 6年
        accessControlLevel: 'ENHANCED'
      },
      'ap-southeast-2': {
        regulations: ['Privacy-Act-Australia', 'APRA-Prudential-Standards'],
        dataResidency: true,
        encryptionRequired: true,
        auditLogRetention: 2555, // 7年
        accessControlLevel: 'ENHANCED'
      },
      'ap-south-1': {
        regulations: ['DPDP-India', 'RBI-Guidelines'],
        dataResidency: true,
        encryptionRequired: true,
        auditLogRetention: 1825, // 5年
        accessControlLevel: 'ENHANCED'
      },
      'ap-northeast-2': {
        regulations: ['PIPA-Korea', 'K-ISMS'],
        dataResidency: true,
        encryptionRequired: true,
        auditLogRetention: 2190, // 6年
        accessControlLevel: 'ENHANCED'
      },
      'eu-central-1': {
        regulations: ['GDPR', 'BDSG', 'BSI-IT-Grundschutz'],
        dataResidency: true,
        encryptionRequired: true,
        auditLogRetention: 2555, // 7年
        accessControlLevel: 'STRICT'
      },
      'eu-west-1': {
        regulations: ['GDPR', 'DPA-Ireland'],
        dataResidency: true,
        encryptionRequired: true,
        auditLogRetention: 2555, // 7年
        accessControlLevel: 'STRICT'
      },
      'eu-west-2': {
        regulations: ['GDPR', 'UK-GDPR', 'DPA-UK'],
        dataResidency: true,
        encryptionRequired: true,
        auditLogRetention: 2555, // 7年
        accessControlLevel: 'STRICT'
      },
      'us-east-1': {
        regulations: ['SOX', 'HIPAA', 'PCI-DSS', 'FedRAMP'],
        dataResidency: false,
        encryptionRequired: true,
        auditLogRetention: 2555, // 7年
        accessControlLevel: 'ENHANCED'
      },
      'us-west-2': {
        regulations: ['SOX', 'CCPA', 'HIPAA', 'PCI-DSS'],
        dataResidency: false,
        encryptionRequired: true,
        auditLogRetention: 2555, // 7年
        accessControlLevel: 'ENHANCED'
      },
      'sa-east-1': {
        regulations: ['LGPD', 'Marco-Civil-da-Internet'],
        dataResidency: true,
        encryptionRequired: true,
        auditLogRetention: 1825, // 5年
        accessControlLevel: 'ENHANCED'
      }
    };
  }
}