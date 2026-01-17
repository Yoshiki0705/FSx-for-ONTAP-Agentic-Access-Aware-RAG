/**
 * Networking Module Interfaces
 * ネットワークモジュール インターフェース定義
 */
export interface NetworkingConfig {
    vpc: VpcConfig;
    loadBalancer?: LoadBalancerConfig;
    cdn?: CdnConfig;
    customDomain?: string;
}
export interface VpcConfig {
    cidr: string;
    maxAzs: number;
    enableNatGateway: boolean;
    enableVpnGateway?: boolean;
    enableDnsHostnames: boolean;
    enableDnsSupport: boolean;
}
export interface LoadBalancerConfig {
    type: 'application' | 'network';
    internetFacing: boolean;
    enableLogging?: boolean;
    deletionProtection?: boolean;
}
export interface CdnConfig {
    enabled: boolean;
    priceClass: 'PriceClass_All' | 'PriceClass_100' | 'PriceClass_200';
    geoRestriction?: {
        restrictionType: 'whitelist' | 'blacklist';
        locations: string[];
    };
    cacheBehaviors?: CacheBehaviorConfig[];
}
export interface CacheBehaviorConfig {
    pathPattern: string;
    targetOriginId: string;
    viewerProtocolPolicy: 'allow-all' | 'redirect-to-https' | 'https-only';
    cachePolicyId?: string;
    originRequestPolicyId?: string;
}
