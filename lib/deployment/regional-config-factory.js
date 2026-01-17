"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegionalConfigFactory = void 0;
/**
 * 地域別設定ファクトリー
 *
 * 各地域の特性に応じた設定を提供
 */
class RegionalConfigFactory {
    /**
     * 日本地域設定
     */
    static createJapanRegionConfigs() {
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
    static createApacRegionConfigs() {
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
    static createEuRegionConfigs() {
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
    static createUsRegionConfigs() {
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
    static createSouthAmericaRegionConfigs() {
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
    static createDeploymentStrategies() {
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
    static getComplianceRequirements() {
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
exports.RegionalConfigFactory = RegionalConfigFactory;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVnaW9uYWwtY29uZmlnLWZhY3RvcnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyZWdpb25hbC1jb25maWctZmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFQTs7OztHQUlHO0FBQ0gsTUFBYSxxQkFBcUI7SUFDaEM7O09BRUc7SUFDSSxNQUFNLENBQUMsd0JBQXdCO1FBQ3BDLE9BQU87WUFDTDtnQkFDRSxNQUFNLEVBQUUsZ0JBQWdCO2dCQUN4QixXQUFXLEVBQUUsSUFBSTtnQkFDakIsUUFBUSxFQUFFLENBQUM7Z0JBQ1gsc0JBQXNCLEVBQUUsQ0FBQyxZQUFZLEVBQUUsTUFBTSxFQUFFLHFDQUFxQyxDQUFDO2dCQUNyRix5QkFBeUIsRUFBRSxJQUFJO2dCQUMvQixpQkFBaUIsRUFBRSxDQUFDO2dCQUNwQixpQkFBaUIsRUFBRTtvQkFDakIsYUFBYSxFQUFFLENBQUMsV0FBVyxFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsV0FBVyxDQUFDO29CQUNqRSxZQUFZLEVBQUUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDO29CQUM1QixhQUFhLEVBQUU7d0JBQ2IsT0FBTyxFQUFFLGFBQWE7d0JBQ3RCLGFBQWEsRUFBRSxDQUFDLGFBQWEsRUFBRSxhQUFhLEVBQUUsYUFBYSxDQUFDO3dCQUM1RCxjQUFjLEVBQUUsQ0FBQyxjQUFjLEVBQUUsY0FBYyxFQUFFLGNBQWMsQ0FBQztxQkFDakU7aUJBQ0Y7YUFDRjtZQUNEO2dCQUNFLE1BQU0sRUFBRSxnQkFBZ0I7Z0JBQ3hCLFdBQVcsRUFBRSxJQUFJO2dCQUNqQixRQUFRLEVBQUUsQ0FBQztnQkFDWCxzQkFBc0IsRUFBRSxDQUFDLFlBQVksRUFBRSxNQUFNLEVBQUUscUNBQXFDLENBQUM7Z0JBQ3JGLHlCQUF5QixFQUFFLElBQUk7Z0JBQy9CLGlCQUFpQixFQUFFLENBQUM7Z0JBQ3BCLGlCQUFpQixFQUFFO29CQUNqQixhQUFhLEVBQUUsQ0FBQyxXQUFXLEVBQUUsVUFBVSxFQUFF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O0FBbGNELHNEQWtjQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFJlZ2lvbkNvbmZpZywgUmVnaW9uYWxEZXBsb3ltZW50Q29uZmlnIH0gZnJvbSAnLi9yZWdpb25hbC1kZXBsb3ltZW50LW1hbmFnZXInO1xuXG4vKipcbiAqIOWcsOWfn+WIpeioreWumuODleOCoeOCr+ODiOODquODvFxuICogXG4gKiDlkITlnLDln5/jga7nibnmgKfjgavlv5zjgZjjgZ/oqK3lrprjgpLmj5DkvptcbiAqL1xuZXhwb3J0IGNsYXNzIFJlZ2lvbmFsQ29uZmlnRmFjdG9yeSB7XG4gIC8qKlxuICAgKiDml6XmnKzlnLDln5/oqK3lrppcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgY3JlYXRlSmFwYW5SZWdpb25Db25maWdzKCk6IFJlZ2lvbkNvbmZpZ1tdIHtcbiAgICByZXR1cm4gW1xuICAgICAge1xuICAgICAgICByZWdpb246ICdhcC1ub3J0aGVhc3QtMScsXG4gICAgICAgIGRpc3BsYXlOYW1lOiAn5p2x5LqsJyxcbiAgICAgICAgcHJpb3JpdHk6IDEsXG4gICAgICAgIGNvbXBsaWFuY2VSZXF1aXJlbWVudHM6IFsnUERQQS1KYXBhbicsICdGSVNDJywgJ1BlcnNvbmFsLUluZm9ybWF0aW9uLVByb3RlY3Rpb24tQWN0J10sXG4gICAgICAgIGRhdGFSZXNpZGVuY3lSZXN0cmljdGlvbnM6IHRydWUsXG4gICAgICAgIGF2YWlsYWJpbGl0eVpvbmVzOiAzLFxuICAgICAgICBlbnZpcm9ubWVudENvbmZpZzoge1xuICAgICAgICAgIGluc3RhbmNlVHlwZXM6IFsndDMubWVkaXVtJywgJ3QzLmxhcmdlJywgJ201LmxhcmdlJywgJ201LnhsYXJnZSddLFxuICAgICAgICAgIHN0b3JhZ2VUeXBlczogWydncDMnLCAnaW8yJ10sXG4gICAgICAgICAgbmV0d29ya0NvbmZpZzoge1xuICAgICAgICAgICAgdnBjQ2lkcjogJzEwLjEuMC4wLzE2JyxcbiAgICAgICAgICAgIHB1YmxpY1N1Ym5ldHM6IFsnMTAuMS4xLjAvMjQnLCAnMTAuMS4yLjAvMjQnLCAnMTAuMS4zLjAvMjQnXSxcbiAgICAgICAgICAgIHByaXZhdGVTdWJuZXRzOiBbJzEwLjEuMTEuMC8yNCcsICcxMC4xLjEyLjAvMjQnLCAnMTAuMS4xMy4wLzI0J11cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHJlZ2lvbjogJ2FwLW5vcnRoZWFzdC0zJyxcbiAgICAgICAgZGlzcGxheU5hbWU6ICflpKfpmKonLFxuICAgICAgICBwcmlvcml0eTogMixcbiAgICAgICAgY29tcGxpYW5jZVJlcXVpcmVtZW50czogWydQRFBBLUphcGFuJywgJ0ZJU0MnLCAnUGVyc29uYWwtSW5mb3JtYXRpb24tUHJvdGVjdGlvbi1BY3QnXSxcbiAgICAgICAgZGF0YVJlc2lkZW5jeVJlc3RyaWN0aW9uczogdHJ1ZSxcbiAgICAgICAgYXZhaWxhYmlsaXR5Wm9uZXM6IDMsXG4gICAgICAgIGVudmlyb25tZW50Q29uZmlnOiB7XG4gICAgICAgICAgaW5zdGFuY2VUeXBlczogWyd0My5tZWRpdW0nLCAndDMubGFyZ2UnLCAnbTUubGFyZ2UnXSxcbiAgICAgICAgICBzdG9yYWdlVHlwZXM6IFsnZ3AzJywgJ2lvMiddLFxuICAgICAgICAgIG5ldHdvcmtDb25maWc6IHtcbiAgICAgICAgICAgIHZwY0NpZHI6ICcxMC4yLjAuMC8xNicsXG4gICAgICAgICAgICBwdWJsaWNTdWJuZXRzOiBbJzEwLjIuMS4wLzI0JywgJzEwLjIuMi4wLzI0JywgJzEwLjIuMy4wLzI0J10sXG4gICAgICAgICAgICBwcml2YXRlU3VibmV0czogWycxMC4yLjExLjAvMjQnLCAnMTAuMi4xMi4wLzI0JywgJzEwLjIuMTMuMC8yNCddXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBUEFD5Zyw5Z+f6Kit5a6aXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGNyZWF0ZUFwYWNSZWdpb25Db25maWdzKCk6IFJlZ2lvbkNvbmZpZ1tdIHtcbiAgICByZXR1cm4gW1xuICAgICAge1xuICAgICAgICByZWdpb246ICdhcC1zb3V0aGVhc3QtMScsXG4gICAgICAgIGRpc3BsYXlOYW1lOiAn44K344Oz44Ks44Od44O844OrJyxcbiAgICAgICAgcHJpb3JpdHk6IDMsXG4gICAgICAgIGNvbXBsaWFuY2VSZXF1aXJlbWVudHM6IFsnUERQQS1TaW5nYXBvcmUnLCAnTUFTLVRlY2hub2xvZ3ktUmlzay1NYW5hZ2VtZW50J10sXG4gICAgICAgIGRhdGFSZXNpZGVuY3lSZXN0cmljdGlvbnM6IHRydWUsXG4gICAgICAgIGF2YWlsYWJpbGl0eVpvbmVzOiAzLFxuICAgICAgICBlbnZpcm9ubWVudENvbmZpZzoge1xuICAgICAgICAgIGluc3RhbmNlVHlwZXM6IFsndDMubWVkaXVtJywgJ3QzLmxhcmdlJywgJ201LmxhcmdlJywgJ201LnhsYXJnZSddLFxuICAgICAgICAgIHN0b3JhZ2VUeXBlczogWydncDMnLCAnaW8yJ10sXG4gICAgICAgICAgbmV0d29ya0NvbmZpZzoge1xuICAgICAgICAgICAgdnBjQ2lkcjogJzEwLjMuMC4wLzE2JyxcbiAgICAgICAgICAgIHB1YmxpY1N1Ym5ldHM6IFsnMTAuMy4xLjAvMjQnLCAnMTAuMy4yLjAvMjQnLCAnMTAuMy4zLjAvMjQnXSxcbiAgICAgICAgICAgIHByaXZhdGVTdWJuZXRzOiBbJzEwLjMuMTEuMC8yNCcsICcxMC4zLjEyLjAvMjQnLCAnMTAuMy4xMy4wLzI0J11cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHJlZ2lvbjogJ2FwLXNvdXRoZWFzdC0yJyxcbiAgICAgICAgZGlzcGxheU5hbWU6ICfjgrfjg4njg4vjg7wnLFxuICAgICAgICBwcmlvcml0eTogNCxcbiAgICAgICAgY29tcGxpYW5jZVJlcXVpcmVtZW50czogWydQcml2YWN5LUFjdC1BdXN0cmFsaWEnLCAnQVBSQS1QcnVkZW50aWFsLVN0YW5kYXJkcyddLFxuICAgICAgICBkYXRhUmVzaWRlbmN5UmVzdHJpY3Rpb25zOiB0cnVlLFxuICAgICAgICBhdmFpbGFiaWxpdHlab25lczogMyxcbiAgICAgICAgZW52aXJvbm1lbnRDb25maWc6IHtcbiAgICAgICAgICBpbnN0YW5jZVR5cGVzOiBbJ3QzLm1lZGl1bScsICd0My5sYXJnZScsICdtNS5sYXJnZSddLFxuICAgICAgICAgIHN0b3JhZ2VUeXBlczogWydncDMnLCAnaW8yJ10sXG4gICAgICAgICAgbmV0d29ya0NvbmZpZzoge1xuICAgICAgICAgICAgdnBjQ2lkcjogJzEwLjQuMC4wLzE2JyxcbiAgICAgICAgICAgIHB1YmxpY1N1Ym5ldHM6IFsnMTAuNC4xLjAvMjQnLCAnMTAuNC4yLjAvMjQnLCAnMTAuNC4zLjAvMjQnXSxcbiAgICAgICAgICAgIHByaXZhdGVTdWJuZXRzOiBbJzEwLjQuMTEuMC8yNCcsICcxMC40LjEyLjAvMjQnLCAnMTAuNC4xMy4wLzI0J11cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHJlZ2lvbjogJ2FwLXNvdXRoLTEnLFxuICAgICAgICBkaXNwbGF5TmFtZTogJ+ODoOODs+ODkOOCpCcsXG4gICAgICAgIHByaW9yaXR5OiA1LFxuICAgICAgICBjb21wbGlhbmNlUmVxdWlyZW1lbnRzOiBbJ0RQRFAtSW5kaWEnLCAnUkJJLUd1aWRlbGluZXMnXSxcbiAgICAgICAgZGF0YVJlc2lkZW5jeVJlc3RyaWN0aW9uczogdHJ1ZSxcbiAgICAgICAgYXZhaWxhYmlsaXR5Wm9uZXM6IDMsXG4gICAgICAgIGVudmlyb25tZW50Q29uZmlnOiB7XG4gICAgICAgICAgaW5zdGFuY2VUeXBlczogWyd0My5tZWRpdW0nLCAndDMubGFyZ2UnLCAnbTUubGFyZ2UnXSxcbiAgICAgICAgICBzdG9yYWdlVHlwZXM6IFsnZ3AzJywgJ2lvMiddLFxuICAgICAgICAgIG5ldHdvcmtDb25maWc6IHtcbiAgICAgICAgICAgIHZwY0NpZHI6ICcxMC41LjAuMC8xNicsXG4gICAgICAgICAgICBwdWJsaWNTdWJuZXRzOiBbJzEwLjUuMS4wLzI0JywgJzEwLjUuMi4wLzI0JywgJzEwLjUuMy4wLzI0J10sXG4gICAgICAgICAgICBwcml2YXRlU3VibmV0czogWycxMC41LjExLjAvMjQnLCAnMTAuNS4xMi4wLzI0JywgJzEwLjUuMTMuMC8yNCddXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICByZWdpb246ICdhcC1ub3J0aGVhc3QtMicsXG4gICAgICAgIGRpc3BsYXlOYW1lOiAn44K944Km44OrJyxcbiAgICAgICAgcHJpb3JpdHk6IDYsXG4gICAgICAgIGNvbXBsaWFuY2VSZXF1aXJlbWVudHM6IFsnUElQQS1Lb3JlYScsICdLLUlTTVMnXSxcbiAgICAgICAgZGF0YVJlc2lkZW5jeVJlc3RyaWN0aW9uczogdHJ1ZSxcbiAgICAgICAgYXZhaWxhYmlsaXR5Wm9uZXM6IDQsXG4gICAgICAgIGVudmlyb25tZW50Q29uZmlnOiB7XG4gICAgICAgICAgaW5zdGFuY2VUeXBlczogWyd0My5tZWRpdW0nLCAndDMubGFyZ2UnLCAnbTUubGFyZ2UnXSxcbiAgICAgICAgICBzdG9yYWdlVHlwZXM6IFsnZ3AzJywgJ2lvMiddLFxuICAgICAgICAgIG5ldHdvcmtDb25maWc6IHtcbiAgICAgICAgICAgIHZwY0NpZHI6ICcxMC42LjAuMC8xNicsXG4gICAgICAgICAgICBwdWJsaWNTdWJuZXRzOiBbJzEwLjYuMS4wLzI0JywgJzEwLjYuMi4wLzI0JywgJzEwLjYuMy4wLzI0JywgJzEwLjYuNC4wLzI0J10sXG4gICAgICAgICAgICBwcml2YXRlU3VibmV0czogWycxMC42LjExLjAvMjQnLCAnMTAuNi4xMi4wLzI0JywgJzEwLjYuMTMuMC8yNCcsICcxMC42LjE0LjAvMjQnXVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIF07XG4gIH1cblxuICAvKipcbiAgICogRVXlnLDln5/oqK3lrppcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgY3JlYXRlRXVSZWdpb25Db25maWdzKCk6IFJlZ2lvbkNvbmZpZ1tdIHtcbiAgICByZXR1cm4gW1xuICAgICAge1xuICAgICAgICByZWdpb246ICdldS1jZW50cmFsLTEnLFxuICAgICAgICBkaXNwbGF5TmFtZTogJ+ODleODqeODs+OCr+ODleODq+ODiCcsXG4gICAgICAgIHByaW9yaXR5OiA3LFxuICAgICAgICBjb21wbGlhbmNlUmVxdWlyZW1lbnRzOiBbJ0dEUFInLCAnQkRTRycsICdCU0ktSVQtR3J1bmRzY2h1dHonXSxcbiAgICAgICAgZGF0YVJlc2lkZW5jeVJlc3RyaWN0aW9uczogdHJ1ZSxcbiAgICAgICAgYXZhaWxhYmlsaXR5Wm9uZXM6IDMsXG4gICAgICAgIGVudmlyb25tZW50Q29uZmlnOiB7XG4gICAgICAgICAgaW5zdGFuY2VUeXBlczogWyd0My5tZWRpdW0nLCAndDMubGFyZ2UnLCAnbTUubGFyZ2UnLCAnbTUueGxhcmdlJ10sXG4gICAgICAgICAgc3RvcmFnZVR5cGVzOiBbJ2dwMycsICdpbzInXSxcbiAgICAgICAgICBuZXR3b3JrQ29uZmlnOiB7XG4gICAgICAgICAgICB2cGNDaWRyOiAnMTAuNy4wLjAvMTYnLFxuICAgICAgICAgICAgcHVibGljU3VibmV0czogWycxMC43LjEuMC8yNCcsICcxMC43LjIuMC8yNCcsICcxMC43LjMuMC8yNCddLFxuICAgICAgICAgICAgcHJpdmF0ZVN1Ym5ldHM6IFsnMTAuNy4xMS4wLzI0JywgJzEwLjcuMTIuMC8yNCcsICcxMC43LjEzLjAvMjQnXVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgcmVnaW9uOiAnZXUtd2VzdC0xJyxcbiAgICAgICAgZGlzcGxheU5hbWU6ICfjgqLjgqTjg6vjg6njg7Pjg4knLFxuICAgICAgICBwcmlvcml0eTogOCxcbiAgICAgICAgY29tcGxpYW5jZVJlcXVpcmVtZW50czogWydHRFBSJywgJ0RQQS1JcmVsYW5kJ10sXG4gICAgICAgIGRhdGFSZXNpZGVuY3lSZXN0cmljdGlvbnM6IHRydWUsXG4gICAgICAgIGF2YWlsYWJpbGl0eVpvbmVzOiAzLFxuICAgICAgICBlbnZpcm9ubWVudENvbmZpZzoge1xuICAgICAgICAgIGluc3RhbmNlVHlwZXM6IFsndDMubWVkaXVtJywgJ3QzLmxhcmdlJywgJ201LmxhcmdlJywgJ201LnhsYXJnZSddLFxuICAgICAgICAgIHN0b3JhZ2VUeXBlczogWydncDMnLCAnaW8yJ10sXG4gICAgICAgICAgbmV0d29ya0NvbmZpZzoge1xuICAgICAgICAgICAgdnBjQ2lkcjogJzEwLjguMC4wLzE2JyxcbiAgICAgICAgICAgIHB1YmxpY1N1Ym5ldHM6IFsnMTAuOC4xLjAvMjQnLCAnMTAuOC4yLjAvMjQnLCAnMTAuOC4zLjAvMjQnXSxcbiAgICAgICAgICAgIHByaXZhdGVTdWJuZXRzOiBbJzEwLjguMTEuMC8yNCcsICcxMC44LjEyLjAvMjQnLCAnMTAuOC4xMy4wLzI0J11cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHJlZ2lvbjogJ2V1LXdlc3QtMicsXG4gICAgICAgIGRpc3BsYXlOYW1lOiAn44Ot44Oz44OJ44OzJyxcbiAgICAgICAgcHJpb3JpdHk6IDksXG4gICAgICAgIGNvbXBsaWFuY2VSZXF1aXJlbWVudHM6IFsnR0RQUicsICdVSy1HRFBSJywgJ0RQQS1VSyddLFxuICAgICAgICBkYXRhUmVzaWRlbmN5UmVzdHJpY3Rpb25zOiB0cnVlLFxuICAgICAgICBhdmFpbGFiaWxpdHlab25lczogMyxcbiAgICAgICAgZW52aXJvbm1lbnRDb25maWc6IHtcbiAgICAgICAgICBpbnN0YW5jZVR5cGVzOiBbJ3QzLm1lZGl1bScsICd0My5sYXJnZScsICdtNS5sYXJnZSddLFxuICAgICAgICAgIHN0b3JhZ2VUeXBlczogWydncDMnLCAnaW8yJ10sXG4gICAgICAgICAgbmV0d29ya0NvbmZpZzoge1xuICAgICAgICAgICAgdnBjQ2lkcjogJzEwLjkuMC4wLzE2JyxcbiAgICAgICAgICAgIHB1YmxpY1N1Ym5ldHM6IFsnMTAuOS4xLjAvMjQnLCAnMTAuOS4yLjAvMjQnLCAnMTAuOS4zLjAvMjQnXSxcbiAgICAgICAgICAgIHByaXZhdGVTdWJuZXRzOiBbJzEwLjkuMTEuMC8yNCcsICcxMC45LjEyLjAvMjQnLCAnMTAuOS4xMy4wLzI0J11cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICBdO1xuICB9XG5cbiAgLyoqXG4gICAqIFVT5Zyw5Z+f6Kit5a6aXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGNyZWF0ZVVzUmVnaW9uQ29uZmlncygpOiBSZWdpb25Db25maWdbXSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIHtcbiAgICAgICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICAgICAgZGlzcGxheU5hbWU6ICfjg5Djg7zjgrjjg4vjgqLljJfpg6gnLFxuICAgICAgICBwcmlvcml0eTogMTAsXG4gICAgICAgIGNvbXBsaWFuY2VSZXF1aXJlbWVudHM6IFsnU09YJywgJ0hJUEFBJywgJ1BDSS1EU1MnLCAnRmVkUkFNUCddLFxuICAgICAgICBkYXRhUmVzaWRlbmN5UmVzdHJpY3Rpb25zOiBmYWxzZSxcbiAgICAgICAgYXZhaWxhYmlsaXR5Wm9uZXM6IDYsXG4gICAgICAgIGVudmlyb25tZW50Q29uZmlnOiB7XG4gICAgICAgICAgaW5zdGFuY2VUeXBlczogWyd0My5tZWRpdW0nLCAndDMubGFyZ2UnLCAnbTUubGFyZ2UnLCAnbTUueGxhcmdlJywgJ201LjJ4bGFyZ2UnXSxcbiAgICAgICAgICBzdG9yYWdlVHlwZXM6IFsnZ3AzJywgJ2lvMicsICdzdDEnXSxcbiAgICAgICAgICBuZXR3b3JrQ29uZmlnOiB7XG4gICAgICAgICAgICB2cGNDaWRyOiAnMTAuMTAuMC4wLzE2JyxcbiAgICAgICAgICAgIHB1YmxpY1N1Ym5ldHM6IFsnMTAuMTAuMS4wLzI0JywgJzEwLjEwLjIuMC8yNCcsICcxMC4xMC4zLjAvMjQnXSxcbiAgICAgICAgICAgIHByaXZhdGVTdWJuZXRzOiBbJzEwLjEwLjExLjAvMjQnLCAnMTAuMTAuMTIuMC8yNCcsICcxMC4xMC4xMy4wLzI0J11cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHJlZ2lvbjogJ3VzLXdlc3QtMicsXG4gICAgICAgIGRpc3BsYXlOYW1lOiAn44Kq44Os44K044OzJyxcbiAgICAgICAgcHJpb3JpdHk6IDExLFxuICAgICAgICBjb21wbGlhbmNlUmVxdWlyZW1lbnRzOiBbJ1NPWCcsICdDQ1BBJywgJ0hJUEFBJywgJ1BDSS1EU1MnXSxcbiAgICAgICAgZGF0YVJlc2lkZW5jeVJlc3RyaWN0aW9uczogZmFsc2UsXG4gICAgICAgIGF2YWlsYWJpbGl0eVpvbmVzOiA0LFxuICAgICAgICBlbnZpcm9ubWVudENvbmZpZzoge1xuICAgICAgICAgIGluc3RhbmNlVHlwZXM6IFsndDMubWVkaXVtJywgJ3QzLmxhcmdlJywgJ201LmxhcmdlJywgJ201LnhsYXJnZSddLFxuICAgICAgICAgIHN0b3JhZ2VUeXBlczogWydncDMnLCAnaW8yJ10sXG4gICAgICAgICAgbmV0d29ya0NvbmZpZzoge1xuICAgICAgICAgICAgdnBjQ2lkcjogJzEwLjExLjAuMC8xNicsXG4gICAgICAgICAgICBwdWJsaWNTdWJuZXRzOiBbJzEwLjExLjEuMC8yNCcsICcxMC4xMS4yLjAvMjQnLCAnMTAuMTEuMy4wLzI0JywgJzEwLjExLjQuMC8yNCddLFxuICAgICAgICAgICAgcHJpdmF0ZVN1Ym5ldHM6IFsnMTAuMTEuMTEuMC8yNCcsICcxMC4xMS4xMi4wLzI0JywgJzEwLjExLjEzLjAvMjQnLCAnMTAuMTEuMTQuMC8yNCddXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgXTtcbiAgfVxuXG4gIC8qKlxuICAgKiDljZfnsbPlnLDln5/oqK3lrppcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgY3JlYXRlU291dGhBbWVyaWNhUmVnaW9uQ29uZmlncygpOiBSZWdpb25Db25maWdbXSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIHtcbiAgICAgICAgcmVnaW9uOiAnc2EtZWFzdC0xJyxcbiAgICAgICAgZGlzcGxheU5hbWU6ICfjgrXjg7Pjg5Hjgqbjg60nLFxuICAgICAgICBwcmlvcml0eTogMTIsXG4gICAgICAgIGNvbXBsaWFuY2VSZXF1aXJlbWVudHM6IFsnTEdQRCcsICdNYXJjby1DaXZpbC1kYS1JbnRlcm5ldCddLFxuICAgICAgICBkYXRhUmVzaWRlbmN5UmVzdHJpY3Rpb25zOiB0cnVlLFxuICAgICAgICBhdmFpbGFiaWxpdHlab25lczogMyxcbiAgICAgICAgZW52aXJvbm1lbnRDb25maWc6IHtcbiAgICAgICAgICBpbnN0YW5jZVR5cGVzOiBbJ3QzLm1lZGl1bScsICd0My5sYXJnZScsICdtNS5sYXJnZSddLFxuICAgICAgICAgIHN0b3JhZ2VUeXBlczogWydncDMnLCAnaW8yJ10sXG4gICAgICAgICAgbmV0d29ya0NvbmZpZzoge1xuICAgICAgICAgICAgdnBjQ2lkcjogJzEwLjEyLjAuMC8xNicsXG4gICAgICAgICAgICBwdWJsaWNTdWJuZXRzOiBbJzEwLjEyLjEuMC8yNCcsICcxMC4xMi4yLjAvMjQnLCAnMTAuMTIuMy4wLzI0J10sXG4gICAgICAgICAgICBwcml2YXRlU3VibmV0czogWycxMC4xMi4xMS4wLzI0JywgJzEwLjEyLjEyLjAvMjQnLCAnMTAuMTIuMTMuMC8yNCddXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgXTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg4fjg5fjg63jgqTjg6Hjg7Pjg4jmiKbnlaXoqK3lrppcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgY3JlYXRlRGVwbG95bWVudFN0cmF0ZWdpZXMoKToge1xuICAgIFtrZXk6IHN0cmluZ106IFJlZ2lvbmFsRGVwbG95bWVudENvbmZpZ1xuICB9IHtcbiAgICByZXR1cm4ge1xuICAgICAgLy8g5L+d5a6I55qE5oim55Wl77yI6YeR6J6N5qmf6Zai5ZCR44GR77yJXG4gICAgICBjb25zZXJ2YXRpdmU6IHtcbiAgICAgICAgdGFyZ2V0UmVnaW9uczogdGhpcy5jcmVhdGVKYXBhblJlZ2lvbkNvbmZpZ3MoKSxcbiAgICAgICAgZGVwbG95bWVudFN0cmF0ZWd5OiAnQkxVRV9HUkVFTicsXG4gICAgICAgIHJvbGxiYWNrQ29uZmlnOiB7XG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBoZWFsdGhDaGVja1RocmVzaG9sZDogOTUsXG4gICAgICAgICAgcm9sbGJhY2tUaW1lb3V0TWludXRlczogNVxuICAgICAgICB9LFxuICAgICAgICBjcm9zc1JlZ2lvblJlcGxpY2F0aW9uOiB0cnVlLFxuICAgICAgICBkaXNhc3RlclJlY292ZXJ5OiB7XG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBydG9NaW51dGVzOiAxNSxcbiAgICAgICAgICBycG9NaW51dGVzOiA1XG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgIC8vIOepjealteeahOaIpueVpe+8iOOCueOCv+ODvOODiOOCouODg+ODl+WQkeOBke+8iVxuICAgICAgYWdncmVzc2l2ZToge1xuICAgICAgICB0YXJnZXRSZWdpb25zOiBbXG4gICAgICAgICAgLi4udGhpcy5jcmVhdGVKYXBhblJlZ2lvbkNvbmZpZ3MoKSxcbiAgICAgICAgICAuLi50aGlzLmNyZWF0ZVVzUmVnaW9uQ29uZmlncygpXG4gICAgICAgIF0sXG4gICAgICAgIGRlcGxveW1lbnRTdHJhdGVneTogJ1JPTExJTkcnLFxuICAgICAgICByb2xsYmFja0NvbmZpZzoge1xuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgaGVhbHRoQ2hlY2tUaHJlc2hvbGQ6IDgwLFxuICAgICAgICAgIHJvbGxiYWNrVGltZW91dE1pbnV0ZXM6IDEwXG4gICAgICAgIH0sXG4gICAgICAgIGNyb3NzUmVnaW9uUmVwbGljYXRpb246IGZhbHNlLFxuICAgICAgICBkaXNhc3RlclJlY292ZXJ5OiB7XG4gICAgICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgICAgICAgcnRvTWludXRlczogNjAsXG4gICAgICAgICAgcnBvTWludXRlczogMzBcbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgLy8g44Kw44Ot44O844OQ44Or5oim55Wl77yI5aSa5Zu957GN5LyB5qWt5ZCR44GR77yJXG4gICAgICBnbG9iYWw6IHtcbiAgICAgICAgdGFyZ2V0UmVnaW9uczogW1xuICAgICAgICAgIC4uLnRoaXMuY3JlYXRlSmFwYW5SZWdpb25Db25maWdzKCksXG4gICAgICAgICAgLi4udGhpcy5jcmVhdGVBcGFjUmVnaW9uQ29uZmlncygpLFxuICAgICAgICAgIC4uLnRoaXMuY3JlYXRlRXVSZWdpb25Db25maWdzKCksXG4gICAgICAgICAgLi4udGhpcy5jcmVhdGVVc1JlZ2lvbkNvbmZpZ3MoKSxcbiAgICAgICAgICAuLi50aGlzLmNyZWF0ZVNvdXRoQW1lcmljYVJlZ2lvbkNvbmZpZ3MoKVxuICAgICAgICBdLFxuICAgICAgICBkZXBsb3ltZW50U3RyYXRlZ3k6ICdDQU5BUlknLFxuICAgICAgICByb2xsYmFja0NvbmZpZzoge1xuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgaGVhbHRoQ2hlY2tUaHJlc2hvbGQ6IDkwLFxuICAgICAgICAgIHJvbGxiYWNrVGltZW91dE1pbnV0ZXM6IDhcbiAgICAgICAgfSxcbiAgICAgICAgY3Jvc3NSZWdpb25SZXBsaWNhdGlvbjogdHJ1ZSxcbiAgICAgICAgZGlzYXN0ZXJSZWNvdmVyeToge1xuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgcnRvTWludXRlczogMzAsXG4gICAgICAgICAgcnBvTWludXRlczogMTVcbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgLy8g5pel5pys5bCC55So5oim55WlXG4gICAgICBqYXBhbk9ubHk6IHtcbiAgICAgICAgdGFyZ2V0UmVnaW9uczogdGhpcy5jcmVhdGVKYXBhblJlZ2lvbkNvbmZpZ3MoKSxcbiAgICAgICAgZGVwbG95bWVudFN0cmF0ZWd5OiAnQkxVRV9HUkVFTicsXG4gICAgICAgIHJvbGxiYWNrQ29uZmlnOiB7XG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBoZWFsdGhDaGVja1RocmVzaG9sZDogOTIsXG4gICAgICAgICAgcm9sbGJhY2tUaW1lb3V0TWludXRlczogN1xuICAgICAgICB9LFxuICAgICAgICBjcm9zc1JlZ2lvblJlcGxpY2F0aW9uOiB0cnVlLFxuICAgICAgICBkaXNhc3RlclJlY292ZXJ5OiB7XG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBydG9NaW51dGVzOiAxMCxcbiAgICAgICAgICBycG9NaW51dGVzOiAyXG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgIC8vIEFQQUPmiKbnlaVcbiAgICAgIGFwYWM6IHtcbiAgICAgICAgdGFyZ2V0UmVnaW9uczogW1xuICAgICAgICAgIC4uLnRoaXMuY3JlYXRlSmFwYW5SZWdpb25Db25maWdzKCksXG4gICAgICAgICAgLi4udGhpcy5jcmVhdGVBcGFjUmVnaW9uQ29uZmlncygpXG4gICAgICAgIF0sXG4gICAgICAgIGRlcGxveW1lbnRTdHJhdGVneTogJ0NBTkFSWScsXG4gICAgICAgIHJvbGxiYWNrQ29uZmlnOiB7XG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBoZWFsdGhDaGVja1RocmVzaG9sZDogODgsXG4gICAgICAgICAgcm9sbGJhY2tUaW1lb3V0TWludXRlczogMTJcbiAgICAgICAgfSxcbiAgICAgICAgY3Jvc3NSZWdpb25SZXBsaWNhdGlvbjogdHJ1ZSxcbiAgICAgICAgZGlzYXN0ZXJSZWNvdmVyeToge1xuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgcnRvTWludXRlczogMjAsXG4gICAgICAgICAgcnBvTWludXRlczogMTBcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog5Zyw5Z+f5Yil44Kz44Oz44OX44Op44Kk44Ki44Oz44K56KaB5Lu244Oe44OD44OU44Oz44KwXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGdldENvbXBsaWFuY2VSZXF1aXJlbWVudHMoKToge1xuICAgIFtyZWdpb246IHN0cmluZ106IHtcbiAgICAgIHJlZ3VsYXRpb25zOiBzdHJpbmdbXTtcbiAgICAgIGRhdGFSZXNpZGVuY3k6IGJvb2xlYW47XG4gICAgICBlbmNyeXB0aW9uUmVxdWlyZWQ6IGJvb2xlYW47XG4gICAgICBhdWRpdExvZ1JldGVudGlvbjogbnVtYmVyOyAvLyBkYXlzXG4gICAgICBhY2Nlc3NDb250cm9sTGV2ZWw6ICdCQVNJQycgfCAnRU5IQU5DRUQnIHwgJ1NUUklDVCc7XG4gICAgfVxuICB9IHtcbiAgICByZXR1cm4ge1xuICAgICAgJ2FwLW5vcnRoZWFzdC0xJzoge1xuICAgICAgICByZWd1bGF0aW9uczogWydQRFBBLUphcGFuJywgJ0ZJU0MnLCAnUGVyc29uYWwtSW5mb3JtYXRpb24tUHJvdGVjdGlvbi1BY3QnXSxcbiAgICAgICAgZGF0YVJlc2lkZW5jeTogdHJ1ZSxcbiAgICAgICAgZW5jcnlwdGlvblJlcXVpcmVkOiB0cnVlLFxuICAgICAgICBhdWRpdExvZ1JldGVudGlvbjogMjU1NSwgLy8gN+W5tFxuICAgICAgICBhY2Nlc3NDb250cm9sTGV2ZWw6ICdTVFJJQ1QnXG4gICAgICB9LFxuICAgICAgJ2FwLW5vcnRoZWFzdC0zJzoge1xuICAgICAgICByZWd1bGF0aW9uczogWydQRFBBLUphcGFuJywgJ0ZJU0MnLCAnUGVyc29uYWwtSW5mb3JtYXRpb24tUHJvdGVjdGlvbi1BY3QnXSxcbiAgICAgICAgZGF0YVJlc2lkZW5jeTogdHJ1ZSxcbiAgICAgICAgZW5jcnlwdGlvblJlcXVpcmVkOiB0cnVlLFxuICAgICAgICBhdWRpdExvZ1JldGVudGlvbjogMjU1NSwgLy8gN+W5tFxuICAgICAgICBhY2Nlc3NDb250cm9sTGV2ZWw6ICdTVFJJQ1QnXG4gICAgICB9LFxuICAgICAgJ2FwLXNvdXRoZWFzdC0xJzoge1xuICAgICAgICByZWd1bGF0aW9uczogWydQRFBBLVNpbmdhcG9yZScsICdNQVMtVGVjaG5vbG9neS1SaXNrLU1hbmFnZW1lbnQnXSxcbiAgICAgICAgZGF0YVJlc2lkZW5jeTogdHJ1ZSxcbiAgICAgICAgZW5jcnlwdGlvblJlcXVpcmVkOiB0cnVlLFxuICAgICAgICBhdWRpdExvZ1JldGVudGlvbjogMjE5MCwgLy8gNuW5tFxuICAgICAgICBhY2Nlc3NDb250cm9sTGV2ZWw6ICdFTkhBTkNFRCdcbiAgICAgIH0sXG4gICAgICAnYXAtc291dGhlYXN0LTInOiB7XG4gICAgICAgIHJlZ3VsYXRpb25zOiBbJ1ByaXZhY3ktQWN0LUF1c3RyYWxpYScsICdBUFJBLVBydWRlbnRpYWwtU3RhbmRhcmRzJ10sXG4gICAgICAgIGRhdGFSZXNpZGVuY3k6IHRydWUsXG4gICAgICAgIGVuY3J5cHRpb25SZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgYXVkaXRMb2dSZXRlbnRpb246IDI1NTUsIC8vIDflubRcbiAgICAgICAgYWNjZXNzQ29udHJvbExldmVsOiAnRU5IQU5DRUQnXG4gICAgICB9LFxuICAgICAgJ2FwLXNvdXRoLTEnOiB7XG4gICAgICAgIHJlZ3VsYXRpb25zOiBbJ0RQRFAtSW5kaWEnLCAnUkJJLUd1aWRlbGluZXMnXSxcbiAgICAgICAgZGF0YVJlc2lkZW5jeTogdHJ1ZSxcbiAgICAgICAgZW5jcnlwdGlvblJlcXVpcmVkOiB0cnVlLFxuICAgICAgICBhdWRpdExvZ1JldGVudGlvbjogMTgyNSwgLy8gNeW5tFxuICAgICAgICBhY2Nlc3NDb250cm9sTGV2ZWw6ICdFTkhBTkNFRCdcbiAgICAgIH0sXG4gICAgICAnYXAtbm9ydGhlYXN0LTInOiB7XG4gICAgICAgIHJlZ3VsYXRpb25zOiBbJ1BJUEEtS29yZWEnLCAnSy1JU01TJ10sXG4gICAgICAgIGRhdGFSZXNpZGVuY3k6IHRydWUsXG4gICAgICAgIGVuY3J5cHRpb25SZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgYXVkaXRMb2dSZXRlbnRpb246IDIxOTAsIC8vIDblubRcbiAgICAgICAgYWNjZXNzQ29udHJvbExldmVsOiAnRU5IQU5DRUQnXG4gICAgICB9LFxuICAgICAgJ2V1LWNlbnRyYWwtMSc6IHtcbiAgICAgICAgcmVndWxhdGlvbnM6IFsnR0RQUicsICdCRFNHJywgJ0JTSS1JVC1HcnVuZHNjaHV0eiddLFxuICAgICAgICBkYXRhUmVzaWRlbmN5OiB0cnVlLFxuICAgICAgICBlbmNyeXB0aW9uUmVxdWlyZWQ6IHRydWUsXG4gICAgICAgIGF1ZGl0TG9nUmV0ZW50aW9uOiAyNTU1LCAvLyA35bm0XG4gICAgICAgIGFjY2Vzc0NvbnRyb2xMZXZlbDogJ1NUUklDVCdcbiAgICAgIH0sXG4gICAgICAnZXUtd2VzdC0xJzoge1xuICAgICAgICByZWd1bGF0aW9uczogWydHRFBSJywgJ0RQQS1JcmVsYW5kJ10sXG4gICAgICAgIGRhdGFSZXNpZGVuY3k6IHRydWUsXG4gICAgICAgIGVuY3J5cHRpb25SZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgYXVkaXRMb2dSZXRlbnRpb246IDI1NTUsIC8vIDflubRcbiAgICAgICAgYWNjZXNzQ29udHJvbExldmVsOiAnU1RSSUNUJ1xuICAgICAgfSxcbiAgICAgICdldS13ZXN0LTInOiB7XG4gICAgICAgIHJlZ3VsYXRpb25zOiBbJ0dEUFInLCAnVUstR0RQUicsICdEUEEtVUsnXSxcbiAgICAgICAgZGF0YVJlc2lkZW5jeTogdHJ1ZSxcbiAgICAgICAgZW5jcnlwdGlvblJlcXVpcmVkOiB0cnVlLFxuICAgICAgICBhdWRpdExvZ1JldGVudGlvbjogMjU1NSwgLy8gN+W5tFxuICAgICAgICBhY2Nlc3NDb250cm9sTGV2ZWw6ICdTVFJJQ1QnXG4gICAgICB9LFxuICAgICAgJ3VzLWVhc3QtMSc6IHtcbiAgICAgICAgcmVndWxhdGlvbnM6IFsnU09YJywgJ0hJUEFBJywgJ1BDSS1EU1MnLCAnRmVkUkFNUCddLFxuICAgICAgICBkYXRhUmVzaWRlbmN5OiBmYWxzZSxcbiAgICAgICAgZW5jcnlwdGlvblJlcXVpcmVkOiB0cnVlLFxuICAgICAgICBhdWRpdExvZ1JldGVudGlvbjogMjU1NSwgLy8gN+W5tFxuICAgICAgICBhY2Nlc3NDb250cm9sTGV2ZWw6ICdFTkhBTkNFRCdcbiAgICAgIH0sXG4gICAgICAndXMtd2VzdC0yJzoge1xuICAgICAgICByZWd1bGF0aW9uczogWydTT1gnLCAnQ0NQQScsICdISVBBQScsICdQQ0ktRFNTJ10sXG4gICAgICAgIGRhdGFSZXNpZGVuY3k6IGZhbHNlLFxuICAgICAgICBlbmNyeXB0aW9uUmVxdWlyZWQ6IHRydWUsXG4gICAgICAgIGF1ZGl0TG9nUmV0ZW50aW9uOiAyNTU1LCAvLyA35bm0XG4gICAgICAgIGFjY2Vzc0NvbnRyb2xMZXZlbDogJ0VOSEFOQ0VEJ1xuICAgICAgfSxcbiAgICAgICdzYS1lYXN0LTEnOiB7XG4gICAgICAgIHJlZ3VsYXRpb25zOiBbJ0xHUEQnLCAnTWFyY28tQ2l2aWwtZGEtSW50ZXJuZXQnXSxcbiAgICAgICAgZGF0YVJlc2lkZW5jeTogdHJ1ZSxcbiAgICAgICAgZW5jcnlwdGlvblJlcXVpcmVkOiB0cnVlLFxuICAgICAgICBhdWRpdExvZ1JldGVudGlvbjogMTgyNSwgLy8gNeW5tFxuICAgICAgICBhY2Nlc3NDb250cm9sTGV2ZWw6ICdFTkhBTkNFRCdcbiAgICAgIH1cbiAgICB9O1xuICB9XG59Il19