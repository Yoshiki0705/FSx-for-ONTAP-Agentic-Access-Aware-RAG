"use strict";
/**
 * 統合ネットワーキングスタック
 *
 * モジュラーアーキテクチャに基づくネットワーク基盤統合管理
 * - VPC・サブネット構成
 * - インターネットゲートウェイ・NATゲートウェイ
 * - セキュリティグループ・NACL
 * - VPCエンドポイント
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkingStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const networking_1 = require("../../modules/networking");
// Windows AD Construct
const windows_ad_construct_1 = require("../../modules/security/constructs/windows-ad-construct");
// タグ設定
const tagging_config_1 = require("../../config/tagging-config");
class NetworkingStack extends cdk.Stack {
    networkingConstruct;
    vpc; // ✅ IVpc型に変更（既存VPCインポート対応）
    publicSubnets;
    privateSubnets;
    isolatedSubnets;
    securityGroups;
    /** Windows AD EC2（オプション） */
    windowsAd;
    constructor(scope, id, props) {
        super(scope, id, props);
        // コスト配布タグの適用
        const taggingConfig = tagging_config_1.PermissionAwareRAGTags.getStandardConfig(props.projectName, (props.environment === 'test' ? 'dev' : props.environment));
        tagging_config_1.TaggingStrategy.applyTagsToStack(this, taggingConfig);
        try {
            // 入力値の検証
            this.validateProps(props);
            const { config, projectName, environment } = props;
            // 既存VPCをインポートする場合
            if (props.existingVpcId) {
                console.log(`🔄 既存VPCをインポート中: ${props.existingVpcId}`);
                // VPC情報を取得（cdk.context.jsonから）
                const vpcInfo = this.node.tryGetContext(`vpc-provider:account=${this.account}:filter.vpc-id=${props.existingVpcId}:region=${this.region}:returnAsymmetricSubnets=true`);
                if (!vpcInfo) {
                    throw new Error(`VPC情報が見つかりません: ${props.existingVpcId}. cdk.context.jsonを確認してください。`);
                }
                // VPCをインポート
                this.vpc = ec2.Vpc.fromVpcAttributes(this, 'ImportedVpc', {
                    vpcId: props.existingVpcId,
                    vpcCidrBlock: props.existingVpcCidr || vpcInfo.vpcCidrBlock || '10.21.0.0/16', // ✅ vpcCidrBlockを明示的に設定
                    availabilityZones: vpcInfo.availabilityZones.length > 0
                        ? vpcInfo.availabilityZones
                        : ['ap-northeast-1a', 'ap-northeast-1c', 'ap-northeast-1d'],
                    publicSubnetIds: vpcInfo.subnetGroups.find((g) => g.type === 'Public')?.subnets.map((s) => s.subnetId) || [],
                    privateSubnetIds: vpcInfo.subnetGroups.find((g) => g.type === 'Private')?.subnets.map((s) => s.subnetId) || [],
                    isolatedSubnetIds: vpcInfo.subnetGroups.find((g) => g.type === 'Isolated')?.subnets.map((s) => s.subnetId) || [],
                });
                // サブネット参照を設定
                const publicSubnetGroup = vpcInfo.subnetGroups.find((g) => g.type === 'Public');
                const privateSubnetGroup = vpcInfo.subnetGroups.find((g) => g.type === 'Private');
                const isolatedSubnetGroup = vpcInfo.subnetGroups.find((g) => g.type === 'Isolated');
                this.publicSubnets = publicSubnetGroup?.subnets.map((s) => ec2.Subnet.fromSubnetAttributes(this, `PublicSubnet-${s.subnetId}`, {
                    subnetId: s.subnetId,
                    availabilityZone: s.availabilityZone,
                    routeTableId: s.routeTableId,
                })) || [];
                this.privateSubnets = privateSubnetGroup?.subnets.map((s) => ec2.Subnet.fromSubnetAttributes(this, `PrivateSubnet-${s.subnetId}`, {
                    subnetId: s.subnetId,
                    availabilityZone: s.availabilityZone,
                    routeTableId: s.routeTableId,
                })) || [];
                this.isolatedSubnets = isolatedSubnetGroup?.subnets.map((s) => ec2.Subnet.fromSubnetAttributes(this, `IsolatedSubnet-${s.subnetId}`, {
                    subnetId: s.subnetId,
                    availabilityZone: s.availabilityZone,
                    routeTableId: s.routeTableId,
                })) || [];
                // Security Groupsを作成（既存VPCに新規作成、名前の重複を動的に回避）
                this.securityGroups = this.createSecurityGroupsForImportedVpc(config);
                console.log(`✅ 既存VPCインポート完了: ${props.existingVpcId}`);
                console.log(`   - Public Subnets: ${this.publicSubnets.length}個`);
                console.log(`   - Private Subnets: ${this.privateSubnets.length}個`);
                console.log(`   - Isolated Subnets: ${this.isolatedSubnets.length}個`);
            }
            else {
                // 新規VPCを作成する場合（既存の動作）
                console.log('🆕 新規VPCを作成中...');
                // ネットワーキングコンストラクト作成
                this.networkingConstruct = new networking_1.NetworkingConstruct(this, 'NetworkingConstruct', {
                    config,
                    projectName,
                    environment,
                });
                // 主要リソースの参照を設定
                this.vpc = this.networkingConstruct.vpc;
                this.publicSubnets = this.networkingConstruct.publicSubnets;
                this.privateSubnets = this.networkingConstruct.privateSubnets;
                this.isolatedSubnets = this.networkingConstruct.isolatedSubnets;
                this.securityGroups = this.networkingConstruct.securityGroups;
                console.log('✅ 新規VPC作成完了');
            }
            // Windows AD EC2作成（オプション）
            if (props.windowsAdConfig?.enabled) {
                console.log('🪟 Windows AD EC2作成中...');
                this.windowsAd = new windows_ad_construct_1.WindowsAdConstruct(this, 'WindowsAd', {
                    vpc: this.vpc,
                    privateSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
                    projectName: props.projectName,
                    environment: props.environment,
                    domainName: props.windowsAdConfig.domainName,
                    instanceType: props.windowsAdConfig.instanceType,
                    keyName: props.windowsAdConfig.keyName,
                });
                console.log('✅ Windows AD EC2作成完了');
                console.log(`   - Instance ID: ${this.windowsAd.instanceId}`);
                console.log(`   - Domain Name: ${props.windowsAdConfig.domainName}`);
            }
            // CloudFormation出力
            this.createOutputs();
            // スタックレベルのタグ設定
            this.applyStackTags(projectName, environment);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`NetworkingStack初期化エラー: ${errorMessage}`);
        }
    }
    /**
     * プロパティの検証
     */
    validateProps(props) {
        const { config, projectName, environment } = props;
        if (!projectName || projectName.trim().length === 0) {
            throw new Error('プロジェクト名が設定されていません');
        }
        if (!environment || environment.trim().length === 0) {
            throw new Error('環境名が設定されていません');
        }
        if (!config) {
            throw new Error('ネットワーキング設定が設定されていません');
        }
        // プロジェクト名の長さ制限（AWS リソース名制限を考慮）
        if (projectName.length > 50) {
            throw new Error('プロジェクト名は50文字以内で設定してください');
        }
        // 環境名の検証
        const validEnvironments = ['dev', 'staging', 'prod', 'test'];
        if (!validEnvironments.includes(environment)) {
            throw new Error(`環境名は次のいずれかを指定してください: ${validEnvironments.join(', ')}`);
        }
    }
    /**
     * CloudFormation出力の作成
     */
    createOutputs() {
        // VPC情報
        new cdk.CfnOutput(this, 'VpcId', {
            value: this.vpc.vpcId,
            description: 'VPC ID',
            exportName: `${this.stackName}-VpcId`,
        });
        new cdk.CfnOutput(this, 'VpcCidr', {
            value: this.vpc.vpcCidrBlock,
            description: 'VPC CIDR Block',
            exportName: `${this.stackName}-VpcCidr`,
        });
        new cdk.CfnOutput(this, 'VpcAvailabilityZones', {
            value: cdk.Fn.join(',', this.vpc.availabilityZones),
            description: 'VPC Availability Zones',
            exportName: `${this.stackName}-AvailabilityZones`,
        });
        // サブネット情報
        this.publicSubnets.forEach((subnet, index) => {
            new cdk.CfnOutput(this, `PublicSubnet${index + 1}Id`, {
                value: subnet.subnetId,
                description: `Public Subnet ${index + 1} ID`,
                exportName: `${this.stackName}-PublicSubnet${index + 1}Id`,
            });
        });
        this.privateSubnets.forEach((subnet, index) => {
            new cdk.CfnOutput(this, `PrivateSubnet${index + 1}Id`, {
                value: subnet.subnetId,
                description: `Private Subnet ${index + 1} ID`,
                exportName: `${this.stackName}-PrivateSubnet${index + 1}Id`,
            });
        });
        this.isolatedSubnets.forEach((subnet, index) => {
            new cdk.CfnOutput(this, `IsolatedSubnet${index + 1}Id`, {
                value: subnet.subnetId,
                description: `Isolated Subnet ${index + 1} ID`,
                exportName: `${this.stackName}-IsolatedSubnet${index + 1}Id`,
            });
        });
        // セキュリティグループ情報
        Object.entries(this.securityGroups).forEach(([name, sg]) => {
            new cdk.CfnOutput(this, `SecurityGroup${name}Id`, {
                value: sg.securityGroupId,
                description: `Security Group ${name} ID`,
                exportName: `${this.stackName}-SecurityGroup${name}Id`,
            });
        });
        // Windows AD情報（存在する場合のみ）
        if (this.windowsAd) {
            new cdk.CfnOutput(this, 'WindowsAdInstanceId', {
                value: this.windowsAd.instanceId,
                description: 'Windows AD EC2 Instance ID',
                exportName: `${this.stackName}-WindowsAdInstanceId`,
            });
            new cdk.CfnOutput(this, 'WindowsAdSecurityGroupId', {
                value: this.windowsAd.securityGroup.securityGroupId,
                description: 'Windows AD Security Group ID',
                exportName: `${this.stackName}-WindowsAdSecurityGroupId`,
            });
            new cdk.CfnOutput(this, 'WindowsAdAdminPasswordSecretArn', {
                value: this.windowsAd.adminPasswordSecret.secretArn,
                description: 'Windows AD Admin Password Secret ARN',
                exportName: `${this.stackName}-WindowsAdAdminPasswordSecretArn`,
            });
        }
    }
    /**
     * スタックレベルのタグ設定
     */
    applyStackTags(projectName, environment) {
        // タグ値のサニタイズ（セキュリティ対策）
        const sanitizedProjectName = this.sanitizeTagValue(projectName);
        const sanitizedEnvironment = this.sanitizeTagValue(environment);
        cdk.Tags.of(this).add('Project', sanitizedProjectName);
        cdk.Tags.of(this).add('Environment', sanitizedEnvironment);
        cdk.Tags.of(this).add('Stack', 'NetworkingStack');
        cdk.Tags.of(this).add('Component', 'Infrastructure');
        cdk.Tags.of(this).add('ManagedBy', 'CDK');
        cdk.Tags.of(this).add('CostCenter', `${sanitizedProjectName}-${sanitizedEnvironment}-networking`);
        cdk.Tags.of(this).add('CreatedAt', new Date().toISOString().split('T')[0]);
    }
    /**
     * 既存VPC用のSecurity Groupsを作成（名前の重複を動的に回避）
     */
    createSecurityGroupsForImportedVpc(config) {
        const securityGroups = {};
        const timestamp = Date.now().toString().slice(-6); // 最後の6桁のタイムスタンプ
        if (config.securityGroups?.web) {
            securityGroups['web'] = new ec2.SecurityGroup(this, 'WebSecurityGroup', {
                vpc: this.vpc,
                securityGroupName: `${this.stackName}-web-sg-${timestamp}`,
                description: 'Security Group for Web tier (imported VPC)',
                allowAllOutbound: true,
            });
            securityGroups['web'].addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS from anywhere');
            securityGroups['web'].addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP from anywhere');
        }
        if (config.securityGroups?.api) {
            securityGroups['api'] = new ec2.SecurityGroup(this, 'ApiSecurityGroup', {
                vpc: this.vpc,
                securityGroupName: `${this.stackName}-api-sg-${timestamp}`,
                description: 'Security Group for API tier (imported VPC)',
                allowAllOutbound: true,
            });
            if (securityGroups['web']) {
                securityGroups['api'].addIngressRule(securityGroups['web'], ec2.Port.tcp(443), 'Allow HTTPS from Web tier');
            }
        }
        if (config.securityGroups?.database) {
            securityGroups['database'] = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
                vpc: this.vpc,
                securityGroupName: `${this.stackName}-db-sg-${timestamp}`,
                description: 'Security Group for Database tier (imported VPC)',
                allowAllOutbound: false,
            });
            if (securityGroups['api']) {
                securityGroups['database'].addIngressRule(securityGroups['api'], ec2.Port.tcp(3306), 'Allow MySQL from API tier');
                securityGroups['database'].addIngressRule(securityGroups['api'], ec2.Port.tcp(5432), 'Allow PostgreSQL from API tier');
            }
        }
        if (config.securityGroups?.lambda) {
            securityGroups['lambda'] = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
                vpc: this.vpc,
                securityGroupName: `${this.stackName}-lambda-sg-${timestamp}`,
                description: 'Security Group for Lambda functions (imported VPC)',
                allowAllOutbound: true,
            });
        }
        console.log(`✅ Security Groups作成完了（タイムスタンプ: ${timestamp}）`);
        return securityGroups;
    }
    /**
     * タグ値のサニタイズ
     */
    sanitizeTagValue(value) {
        // 不正な文字を除去し、長さを制限
        return value
            .replace(/[<>\"'&]/g, '') // XSS対策
            .substring(0, 256) // AWS タグ値の最大長制限
            .trim();
    }
    /**
     * 他のスタックで使用するためのネットワーク情報を取得
     */
    getNetworkingInfo() {
        return {
            vpc: this.vpc,
            publicSubnets: this.publicSubnets,
            privateSubnets: this.privateSubnets,
            isolatedSubnets: this.isolatedSubnets,
            securityGroups: this.securityGroups,
            availabilityZones: this.vpc.availabilityZones,
        };
    }
    /**
     * 特定のセキュリティグループを取得
     */
    getSecurityGroup(name) {
        return this.securityGroups[name];
    }
    /**
     * VPCエンドポイント情報を取得
     */
    getVpcEndpoints() {
        return this.networkingConstruct.vpcEndpoints || {};
    }
}
exports.NetworkingStack = NetworkingStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV0d29ya2luZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm5ldHdvcmtpbmctc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7OztHQVFHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQyx5REFBMkM7QUFFM0MseURBQStEO0FBRy9ELHVCQUF1QjtBQUN2QixpR0FBNEY7QUFFNUYsT0FBTztBQUNQLGdFQUFzRjtBQWtDdEYsTUFBYSxlQUFnQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzVCLG1CQUFtQixDQUFzQjtJQUN6QyxHQUFHLENBQW1CLENBQUMsMkJBQTJCO0lBQ2xELGFBQWEsQ0FBd0I7SUFDckMsY0FBYyxDQUF3QjtJQUN0QyxlQUFlLENBQXdCO0lBQ3ZDLGNBQWMsQ0FBK0M7SUFFN0UsNEJBQTRCO0lBQ1osU0FBUyxDQUFzQjtJQUUvQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTJCO1FBQ25FLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGFBQWE7UUFDYixNQUFNLGFBQWEsR0FBRyx1Q0FBc0IsQ0FBQyxpQkFBaUIsQ0FDNUQsS0FBSyxDQUFDLFdBQVcsRUFDakIsQ0FBQyxLQUFLLENBQUMsV0FBVyxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUErQixDQUN6RixDQUFDO1FBQ0YsZ0NBQWUsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFFdEQsSUFBSSxDQUFDO1lBQ0gsU0FBUztZQUNULElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7WUFFMUIsTUFBTSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLEdBQUcsS0FBSyxDQUFDO1lBRW5ELGtCQUFrQjtZQUNsQixJQUFJLEtBQUss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QUMsV0FBVyxFQUFFLEVBQUUsQ0FBQyxDQUFDLFFBQVE7YUFDakMsU0FBUyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxnQkFBZ0I7YUFDbEMsSUFBSSxFQUFFLENBQUM7SUFDWixDQUFDO0lBRUQ7O09BRUc7SUFDSSxpQkFBaUI7UUFRdEIsT0FBTztZQUNMLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRztZQUNiLGFBQWEsRUFBRSxJQUFJLENBQUMsYUFBYTtZQUNqQyxjQUFjLEVBQUUsSUFBSSxDQUFDLGNBQWM7WUFDbkMsZUFBZSxFQUFFLElBQUksQ0FBQyxlQUFlO1lBQ3JDLGNBQWMsRUFBRSxJQUFJLENBQUMsY0FBYztZQUNuQyxpQkFBaUIsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLGlCQUFpQjtTQUM5QyxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0ksZ0JBQWdCLENBQUMsSUFBWTtRQUNsQyxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbkMsQ0FBQztJQUVEOztPQUVHO0lBQ0ksZUFBZTtRQUNwQixPQUFPLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxZQUFZLElBQUksRUFBRSxDQUFDO0lBQ3JELENBQUM7Q0FDRjtBQWpZRCwwQ0FpWUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOe1seWQiOODjeODg+ODiOODr+ODvOOCreODs+OCsOOCueOCv+ODg+OCr1xuICogXG4gKiDjg6Ljgrjjg6Xjg6njg7zjgqLjg7zjgq3jg4bjgq/jg4Hjg6Pjgavln7rjgaXjgY/jg43jg4Pjg4jjg6/jg7zjgq/ln7rnm6TntbHlkIjnrqHnkIZcbiAqIC0gVlBD44O744K144OW44ON44OD44OI5qeL5oiQXG4gKiAtIOOCpOODs+OCv+ODvOODjeODg+ODiOOCsuODvOODiOOCpuOCp+OCpOODu05BVOOCsuODvOODiOOCpuOCp+OCpFxuICogLSDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fjg7tOQUNMXG4gKiAtIFZQQ+OCqOODs+ODieODneOCpOODs+ODiFxuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IE5ldHdvcmtpbmdDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi9tb2R1bGVzL25ldHdvcmtpbmcnO1xuaW1wb3J0IHsgTmV0d29ya2luZ0NvbmZpZyB9IGZyb20gJy4uLy4uL21vZHVsZXMvbmV0d29ya2luZyc7XG5cbi8vIFdpbmRvd3MgQUQgQ29uc3RydWN0XG5pbXBvcnQgeyBXaW5kb3dzQWRDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi9tb2R1bGVzL3NlY3VyaXR5L2NvbnN0cnVjdHMvd2luZG93cy1hZC1jb25zdHJ1Y3QnO1xuXG4vLyDjgr/jgrDoqK3lrppcbmltcG9ydCB7IFRhZ2dpbmdTdHJhdGVneSwgUGVybWlzc2lvbkF3YXJlUkFHVGFncyB9IGZyb20gJy4uLy4uL2NvbmZpZy90YWdnaW5nLWNvbmZpZyc7XG5cbi8qKlxuICogV2luZG93cyBBROioreWumlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFdpbmRvd3NBZENvbmZpZyB7XG4gIC8qKiBXaW5kb3dzIEFE5qmf6IO944KS5pyJ5Yq55YyW44GZ44KL44GL44Gp44GG44GLICovXG4gIGVuYWJsZWQ6IGJvb2xlYW47XG4gIC8qKiBBY3RpdmUgRGlyZWN0b3J5IERvbWFpbiBOYW1lICovXG4gIGRvbWFpbk5hbWU6IHN0cmluZztcbiAgLyoqIEFEIEVDMuOCpOODs+OCueOCv+ODs+OCueOCv+OCpOODlyAqL1xuICBpbnN0YW5jZVR5cGU/OiBlYzIuSW5zdGFuY2VUeXBlO1xuICAvKiogQUQgRUMy44GuU1NIIEtleSBOYW1l77yIbnVsbOOBruWgtOWQiOOBr1NTTSBTZXNzaW9uIE1hbmFnZXLjgpLkvb/nlKjvvIkgKi9cbiAga2V5TmFtZT86IHN0cmluZyB8IG51bGw7XG59XG5cbi8qKlxuICogTmV0d29ya2luZ1N0YWNrIOOBruODl+ODreODkeODhuOCo1xuICovXG5leHBvcnQgaW50ZXJmYWNlIE5ldHdvcmtpbmdTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICAvKiog44ON44OD44OI44Ov44O844Kt44Oz44Kw6Kit5a6aICovXG4gIGNvbmZpZzogTmV0d29ya2luZ0NvbmZpZztcbiAgLyoqIOODl+ODreOCuOOCp+OCr+ODiOWQje+8iDUw5paH5a2X5Lul5YaF77yJICovXG4gIHByb2plY3ROYW1lOiBzdHJpbmc7XG4gIC8qKiDnkrDlooPlkI3vvIhkZXYvc3RhZ2luZy9wcm9kL3Rlc3TvvIkgKi9cbiAgZW52aXJvbm1lbnQ6ICdkZXYnIHwgJ3N0YWdpbmcnIHwgJ3Byb2QnIHwgJ3Rlc3QnO1xuICAvKiogV2luZG93cyBBROioreWumu+8iOOCquODl+OCt+ODp+ODs++8iSAqL1xuICB3aW5kb3dzQWRDb25maWc/OiBXaW5kb3dzQWRDb25maWc7XG4gIC8qKiDml6LlrZhWUEPjgpLjgqTjg7Pjg53jg7zjg4jjgZnjgovloLTlkIjjga5WUEMgSUTvvIjjgqrjg5fjgrfjg6fjg7PvvIkgKi9cbiAgZXhpc3RpbmdWcGNJZD86IHN0cmluZztcbiAgLyoqIOaXouWtmFZQQ+OCkuOCpOODs+ODneODvOODiOOBmeOCi+WgtOWQiOOBrlZQQyBDSURS77yI44Kq44OX44K344On44Oz77yJICovXG4gIGV4aXN0aW5nVnBjQ2lkcj86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIE5ldHdvcmtpbmdTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBuZXR3b3JraW5nQ29uc3RydWN0OiBOZXR3b3JraW5nQ29uc3RydWN0O1xuICBwdWJsaWMgcmVhZG9ubHkgdnBjOiBjZGsuYXdzX2VjMi5JVnBjOyAvLyDinIUgSVZwY+Wei+OBq+WkieabtO+8iOaXouWtmFZQQ+OCpOODs+ODneODvOODiOWvvuW/nO+8iVxuICBwdWJsaWMgcmVhZG9ubHkgcHVibGljU3VibmV0czogY2RrLmF3c19lYzIuSVN1Ym5ldFtdO1xuICBwdWJsaWMgcmVhZG9ubHkgcHJpdmF0ZVN1Ym5ldHM6IGNkay5hd3NfZWMyLklTdWJuZXRbXTtcbiAgcHVibGljIHJlYWRvbmx5IGlzb2xhdGVkU3VibmV0czogY2RrLmF3c19lYzIuSVN1Ym5ldFtdO1xuICBwdWJsaWMgcmVhZG9ubHkgc2VjdXJpdHlHcm91cHM6IHsgW2tleTogc3RyaW5nXTogY2RrLmF3c19lYzIuU2VjdXJpdHlHcm91cCB9O1xuICBcbiAgLyoqIFdpbmRvd3MgQUQgRUMy77yI44Kq44OX44K344On44Oz77yJICovXG4gIHB1YmxpYyByZWFkb25seSB3aW5kb3dzQWQ/OiBXaW5kb3dzQWRDb25zdHJ1Y3Q7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IE5ldHdvcmtpbmdTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyDjgrPjgrnjg4jphY3luIPjgr/jgrDjga7pgannlKhcbiAgICBjb25zdCB0YWdnaW5nQ29uZmlnID0gUGVybWlzc2lvbkF3YXJlUkFHVGFncy5nZXRTdGFuZGFyZENvbmZpZyhcbiAgICAgIHByb3BzLnByb2plY3ROYW1lLFxuICAgICAgKHByb3BzLmVudmlyb25tZW50ID09PSAndGVzdCcgPyAnZGV2JyA6IHByb3BzLmVudmlyb25tZW50KSBhcyAnZGV2JyB8ICdzdGFnaW5nJyB8ICdwcm9kJ1xuICAgICk7XG4gICAgVGFnZ2luZ1N0cmF0ZWd5LmFwcGx5VGFnc1RvU3RhY2sodGhpcywgdGFnZ2luZ0NvbmZpZyk7XG5cbiAgICB0cnkge1xuICAgICAgLy8g5YWl5Yqb5YCk44Gu5qSc6Ki8XG4gICAgICB0aGlzLnZhbGlkYXRlUHJvcHMocHJvcHMpO1xuXG4gICAgICBjb25zdCB7IGNvbmZpZywgcHJvamVjdE5hbWUsIGVudmlyb25tZW50IH0gPSBwcm9wcztcblxuICAgICAgLy8g5pei5a2YVlBD44KS44Kk44Oz44Od44O844OI44GZ44KL5aC05ZCIXG4gICAgICBpZiAocHJvcHMuZXhpc3RpbmdWcGNJZCkge1xuICAgICAgICBjb25zb2xlLmxvZyhg8J+UhCDml6LlrZhWUEPjgpLjgqTjg7Pjg53jg7zjg4jkuK06ICR7cHJvcHMuZXhpc3RpbmdWcGNJZH1gKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFZQQ+aDheWgseOCkuWPluW+l++8iGNkay5jb250ZXh0Lmpzb27jgYvjgonvvIlcbiAgICAgICAgY29uc3QgdnBjSW5mbyA9IHRoaXMubm9kZS50cnlHZXRDb250ZXh0KGB2cGMtcHJvdmlkZXI6YWNjb3VudD0ke3RoaXMuYWNjb3VudH06ZmlsdGVyLnZwYy1pZD0ke3Byb3BzLmV4aXN0aW5nVnBjSWR9OnJlZ2lvbj0ke3RoaXMucmVnaW9ufTpyZXR1cm5Bc3ltbWV0cmljU3VibmV0cz10cnVlYCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIXZwY0luZm8pIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFZQQ+aDheWgseOBjOimi+OBpOOBi+OCiuOBvuOBm+OCkzogJHtwcm9wcy5leGlzdGluZ1ZwY0lkfS4gY2RrLmNvbnRleHQuanNvbuOCkueiuuiqjeOBl+OBpuOBj+OBoOOBleOBhOOAgmApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVlBD44KS44Kk44Oz44Od44O844OIXG4gICAgICAgIHRoaXMudnBjID0gZWMyLlZwYy5mcm9tVnBjQXR0cmlidXRlcyh0aGlzLCAnSW1wb3J0ZWRWcGMnLCB7XG4gICAgICAgICAgdnBjSWQ6IHByb3BzLmV4aXN0aW5nVnBjSWQsXG4gICAgICAgICAgdnBjQ2lkckJsb2NrOiBwcm9wcy5leGlzdGluZ1ZwY0NpZHIgfHwgdnBjSW5mby52cGNDaWRyQmxvY2sgfHwgJzEwLjIxLjAuMC8xNicsIC8vIOKchSB2cGNDaWRyQmxvY2vjgpLmmI7npLrnmoTjgavoqK3lrppcbiAgICAgICAgICBhdmFpbGFiaWxpdHlab25lczogdnBjSW5mby5hdmFpbGFiaWxpdHlab25lcy5sZW5ndGggPiAwIFxuICAgICAgICAgICAgPyB2cGNJbmZvLmF2YWlsYWJpbGl0eVpvbmVzIFxuICAgICAgICAgICAgOiBbJ2FwLW5vcnRoZWFzdC0xYScsICdhcC1ub3J0aGVhc3QtMWMnLCAnYXAtbm9ydGhlYXN0LTFkJ10sXG4gICAgICAgICAgcHVibGljU3VibmV0SWRzOiB2cGNJbmZvLnN1Ym5ldEdyb3Vwcy5maW5kKChnOiBhbnkpID0+IGcudHlwZSA9PT0gJ1B1YmxpYycpPy5zdWJuZXRzLm1hcCgoczogYW55KSA9PiBzLnN1Ym5ldElkKSB8fCBbXSxcbiAgICAgICAgICBwcml2YXRlU3VibmV0SWRzOiB2cGNJbmZvLnN1Ym5ldEdyb3Vwcy5maW5kKChnOiBhbnkpID0+IGcudHlwZSA9PT0gJ1ByaXZhdGUnKT8uc3VibmV0cy5tYXAoKHM6IGFueSkgPT4gcy5zdWJuZXRJZCkgfHwgW10sXG4gICAgICAgICAgaXNvbGF0ZWRTdWJuZXRJZHM6IHZwY0luZm8uc3VibmV0R3JvdXBzLmZpbmQoKGc6IGFueSkgPT4gZy50eXBlID09PSAnSXNvbGF0ZWQnKT8uc3VibmV0cy5tYXAoKHM6IGFueSkgPT4gcy5zdWJuZXRJZCkgfHwgW10sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIOOCteODluODjeODg+ODiOWPgueFp+OCkuioreWumlxuICAgICAgICBjb25zdCBwdWJsaWNTdWJuZXRHcm91cCA9IHZwY0luZm8uc3VibmV0R3JvdXBzLmZpbmQoKGc6IGFueSkgPT4gZy50eXBlID09PSAnUHVibGljJyk7XG4gICAgICAgIGNvbnN0IHByaXZhdGVTdWJuZXRHcm91cCA9IHZwY0luZm8uc3VibmV0R3JvdXBzLmZpbmQoKGc6IGFueSkgPT4gZy50eXBlID09PSAnUHJpdmF0ZScpO1xuICAgICAgICBjb25zdCBpc29sYXRlZFN1Ym5ldEdyb3VwID0gdnBjSW5mby5zdWJuZXRHcm91cHMuZmluZCgoZzogYW55KSA9PiBnLnR5cGUgPT09ICdJc29sYXRlZCcpO1xuXG4gICAgICAgIHRoaXMucHVibGljU3VibmV0cyA9IHB1YmxpY1N1Ym5ldEdyb3VwPy5zdWJuZXRzLm1hcCgoczogYW55KSA9PiBcbiAgICAgICAgICBlYzIuU3VibmV0LmZyb21TdWJuZXRBdHRyaWJ1dGVzKHRoaXMsIGBQdWJsaWNTdWJuZXQtJHtzLnN1Ym5ldElkfWAsIHtcbiAgICAgICAgICAgIHN1Ym5ldElkOiBzLnN1Ym5ldElkLFxuICAgICAgICAgICAgYXZhaWxhYmlsaXR5Wm9uZTogcy5hdmFpbGFiaWxpdHlab25lLFxuICAgICAgICAgICAgcm91dGVUYWJsZUlkOiBzLnJvdXRlVGFibGVJZCxcbiAgICAgICAgICB9KVxuICAgICAgICApIHx8IFtdO1xuXG4gICAgICAgIHRoaXMucHJpdmF0ZVN1Ym5ldHMgPSBwcml2YXRlU3VibmV0R3JvdXA/LnN1Ym5ldHMubWFwKChzOiBhbnkpID0+IFxuICAgICAgICAgIGVjMi5TdWJuZXQuZnJvbVN1Ym5ldEF0dHJpYnV0ZXModGhpcywgYFByaXZhdGVTdWJuZXQtJHtzLnN1Ym5ldElkfWAsIHtcbiAgICAgICAgICAgIHN1Ym5ldElkOiBzLnN1Ym5ldElkLFxuICAgICAgICAgICAgYXZhaWxhYmlsaXR5Wm9uZTogcy5hdmFpbGFiaWxpdHlab25lLFxuICAgICAgICAgICAgcm91dGVUYWJsZUlkOiBzLnJvdXRlVGFibGVJZCxcbiAgICAgICAgICB9KVxuICAgICAgICApIHx8IFtdO1xuXG4gICAgICAgIHRoaXMuaXNvbGF0ZWRTdWJuZXRzID0gaXNvbGF0ZWRTdWJuZXRHcm91cD8uc3VibmV0cy5tYXAoKHM6IGFueSkgPT4gXG4gICAgICAgICAgZWMyLlN1Ym5ldC5mcm9tU3VibmV0QXR0cmlidXRlcyh0aGlzLCBgSXNvbGF0ZWRTdWJuZXQtJHtzLnN1Ym5ldElkfWAsIHtcbiAgICAgICAgICAgIHN1Ym5ldElkOiBzLnN1Ym5ldElkLFxuICAgICAgICAgICAgYXZhaWxhYmlsaXR5Wm9uZTogcy5hdmFpbGFiaWxpdHlab25lLFxuICAgICAgICAgICAgcm91dGVUYWJsZUlkOiBzLnJvdXRlVGFibGVJZCxcbiAgICAgICAgICB9KVxuICAgICAgICApIHx8IFtdO1xuXG4gICAgICAgIC8vIFNlY3VyaXR5IEdyb3Vwc+OCkuS9nOaIkO+8iOaXouWtmFZQQ+OBq+aWsOimj+S9nOaIkOOAgeWQjeWJjeOBrumHjeikh+OCkuWLleeahOOBq+WbnumBv++8iVxuICAgICAgICB0aGlzLnNlY3VyaXR5R3JvdXBzID0gdGhpcy5jcmVhdGVTZWN1cml0eUdyb3Vwc0ZvckltcG9ydGVkVnBjKGNvbmZpZyk7XG5cbiAgICAgICAgY29uc29sZS5sb2coYOKchSDml6LlrZhWUEPjgqTjg7Pjg53jg7zjg4jlrozkuoY6ICR7cHJvcHMuZXhpc3RpbmdWcGNJZH1gKTtcbiAgICAgICAgY29uc29sZS5sb2coYCAgIC0gUHVibGljIFN1Ym5ldHM6ICR7dGhpcy5wdWJsaWNTdWJuZXRzLmxlbmd0aH3lgItgKTtcbiAgICAgICAgY29uc29sZS5sb2coYCAgIC0gUHJpdmF0ZSBTdWJuZXRzOiAke3RoaXMucHJpdmF0ZVN1Ym5ldHMubGVuZ3RofeWAi2ApO1xuICAgICAgICBjb25zb2xlLmxvZyhgICAgLSBJc29sYXRlZCBTdWJuZXRzOiAke3RoaXMuaXNvbGF0ZWRTdWJuZXRzLmxlbmd0aH3lgItgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIOaWsOimj1ZQQ+OCkuS9nOaIkOOBmeOCi+WgtOWQiO+8iOaXouWtmOOBruWLleS9nO+8iVxuICAgICAgICBjb25zb2xlLmxvZygn8J+GlSDmlrDopo9WUEPjgpLkvZzmiJDkuK0uLi4nKTtcbiAgICAgICAgXG4gICAgICAgIC8vIOODjeODg+ODiOODr+ODvOOCreODs+OCsOOCs+ODs+OCueODiOODqeOCr+ODiOS9nOaIkFxuICAgICAgICB0aGlzLm5ldHdvcmtpbmdDb25zdHJ1Y3QgPSBuZXcgTmV0d29ya2luZ0NvbnN0cnVjdCh0aGlzLCAnTmV0d29ya2luZ0NvbnN0cnVjdCcsIHtcbiAgICAgICAgICBjb25maWcsXG4gICAgICAgICAgcHJvamVjdE5hbWUsXG4gICAgICAgICAgZW52aXJvbm1lbnQsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIOS4u+imgeODquOCveODvOOCueOBruWPgueFp+OCkuioreWumlxuICAgICAgICB0aGlzLnZwYyA9IHRoaXMubmV0d29ya2luZ0NvbnN0cnVjdC52cGM7XG4gICAgICAgIHRoaXMucHVibGljU3VibmV0cyA9IHRoaXMubmV0d29ya2luZ0NvbnN0cnVjdC5wdWJsaWNTdWJuZXRzO1xuICAgICAgICB0aGlzLnByaXZhdGVTdWJuZXRzID0gdGhpcy5uZXR3b3JraW5nQ29uc3RydWN0LnByaXZhdGVTdWJuZXRzO1xuICAgICAgICB0aGlzLmlzb2xhdGVkU3VibmV0cyA9IHRoaXMubmV0d29ya2luZ0NvbnN0cnVjdC5pc29sYXRlZFN1Ym5ldHM7XG4gICAgICAgIHRoaXMuc2VjdXJpdHlHcm91cHMgPSB0aGlzLm5ldHdvcmtpbmdDb25zdHJ1Y3Quc2VjdXJpdHlHcm91cHM7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZygn4pyFIOaWsOimj1ZQQ+S9nOaIkOWujOS6hicpO1xuICAgICAgfVxuXG4gICAgICAvLyBXaW5kb3dzIEFEIEVDMuS9nOaIkO+8iOOCquODl+OCt+ODp+ODs++8iVxuICAgICAgaWYgKHByb3BzLndpbmRvd3NBZENvbmZpZz8uZW5hYmxlZCkge1xuICAgICAgICBjb25zb2xlLmxvZygn8J+qnyBXaW5kb3dzIEFEIEVDMuS9nOaIkOS4rS4uLicpO1xuICAgICAgICBcbiAgICAgICAgdGhpcy53aW5kb3dzQWQgPSBuZXcgV2luZG93c0FkQ29uc3RydWN0KHRoaXMsICdXaW5kb3dzQWQnLCB7XG4gICAgICAgICAgdnBjOiB0aGlzLnZwYyxcbiAgICAgICAgICBwcml2YXRlU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXG4gICAgICAgICAgcHJvamVjdE5hbWU6IHByb3BzLnByb2plY3ROYW1lLFxuICAgICAgICAgIGVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgICAgICBkb21haW5OYW1lOiBwcm9wcy53aW5kb3dzQWRDb25maWcuZG9tYWluTmFtZSxcbiAgICAgICAgICBpbnN0YW5jZVR5cGU6IHByb3BzLndpbmRvd3NBZENvbmZpZy5pbnN0YW5jZVR5cGUsXG4gICAgICAgICAga2V5TmFtZTogcHJvcHMud2luZG93c0FkQ29uZmlnLmtleU5hbWUsXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coJ+KchSBXaW5kb3dzIEFEIEVDMuS9nOaIkOWujOS6hicpO1xuICAgICAgICBjb25zb2xlLmxvZyhgICAgLSBJbnN0YW5jZSBJRDogJHt0aGlzLndpbmRvd3NBZC5pbnN0YW5jZUlkfWApO1xuICAgICAgICBjb25zb2xlLmxvZyhgICAgLSBEb21haW4gTmFtZTogJHtwcm9wcy53aW5kb3dzQWRDb25maWcuZG9tYWluTmFtZX1gKTtcbiAgICAgIH1cblxuICAgICAgLy8gQ2xvdWRGb3JtYXRpb27lh7rliptcbiAgICAgIHRoaXMuY3JlYXRlT3V0cHV0cygpO1xuXG4gICAgICAvLyDjgrnjgr/jg4Pjgq/jg6zjg5njg6vjga7jgr/jgrDoqK3lrppcbiAgICAgIHRoaXMuYXBwbHlTdGFja1RhZ3MocHJvamVjdE5hbWUsIGVudmlyb25tZW50KTtcblxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zdCBlcnJvck1lc3NhZ2UgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE5ldHdvcmtpbmdTdGFja+WIneacn+WMluOCqOODqeODvDogJHtlcnJvck1lc3NhZ2V9YCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODl+ODreODkeODhuOCo+OBruaknOiovFxuICAgKi9cbiAgcHJpdmF0ZSB2YWxpZGF0ZVByb3BzKHByb3BzOiBOZXR3b3JraW5nU3RhY2tQcm9wcyk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29uZmlnLCBwcm9qZWN0TmFtZSwgZW52aXJvbm1lbnQgfSA9IHByb3BzO1xuXG4gICAgaWYgKCFwcm9qZWN0TmFtZSB8fCBwcm9qZWN0TmFtZS50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+ODl+ODreOCuOOCp+OCr+ODiOWQjeOBjOioreWumuOBleOCjOOBpuOBhOOBvuOBm+OCkycpO1xuICAgIH1cblxuICAgIGlmICghZW52aXJvbm1lbnQgfHwgZW52aXJvbm1lbnQudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCfnkrDlooPlkI3jgYzoqK3lrprjgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICB9XG5cbiAgICBpZiAoIWNvbmZpZykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCfjg43jg4Pjg4jjg6/jg7zjgq3jg7PjgrDoqK3lrprjgYzoqK3lrprjgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICB9XG5cbiAgICAvLyDjg5fjg63jgrjjgqfjgq/jg4jlkI3jga7plbfjgZXliLbpmZDvvIhBV1Mg44Oq44K944O844K55ZCN5Yi26ZmQ44KS6ICD5oWu77yJXG4gICAgaWYgKHByb2plY3ROYW1lLmxlbmd0aCA+IDUwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+ODl+ODreOCuOOCp+OCr+ODiOWQjeOBrzUw5paH5a2X5Lul5YaF44Gn6Kit5a6a44GX44Gm44GP44Gg44GV44GEJyk7XG4gICAgfVxuXG4gICAgLy8g55Kw5aKD5ZCN44Gu5qSc6Ki8XG4gICAgY29uc3QgdmFsaWRFbnZpcm9ubWVudHMgPSBbJ2RldicsICdzdGFnaW5nJywgJ3Byb2QnLCAndGVzdCddO1xuICAgIGlmICghdmFsaWRFbnZpcm9ubWVudHMuaW5jbHVkZXMoZW52aXJvbm1lbnQpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYOeSsOWig+WQjeOBr+asoeOBruOBhOOBmuOCjOOBi+OCkuaMh+WumuOBl+OBpuOBj+OBoOOBleOBhDogJHt2YWxpZEVudmlyb25tZW50cy5qb2luKCcsICcpfWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDbG91ZEZvcm1hdGlvbuWHuuWKm+OBruS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVPdXRwdXRzKCk6IHZvaWQge1xuICAgIC8vIFZQQ+aDheWgsVxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWcGNJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnZwYy52cGNJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVlBDIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1WcGNJZGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVnBjQ2lkcicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnZwYy52cGNDaWRyQmxvY2ssXG4gICAgICBkZXNjcmlwdGlvbjogJ1ZQQyBDSURSIEJsb2NrJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1WcGNDaWRyYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWcGNBdmFpbGFiaWxpdHlab25lcycsIHtcbiAgICAgIHZhbHVlOiBjZGsuRm4uam9pbignLCcsIHRoaXMudnBjLmF2YWlsYWJpbGl0eVpvbmVzKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVlBDIEF2YWlsYWJpbGl0eSBab25lcycsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQXZhaWxhYmlsaXR5Wm9uZXNgLFxuICAgIH0pO1xuXG4gICAgLy8g44K144OW44ON44OD44OI5oOF5aCxXG4gICAgdGhpcy5wdWJsaWNTdWJuZXRzLmZvckVhY2goKHN1Ym5ldCwgaW5kZXgpID0+IHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBQdWJsaWNTdWJuZXQke2luZGV4ICsgMX1JZGAsIHtcbiAgICAgICAgdmFsdWU6IHN1Ym5ldC5zdWJuZXRJZCxcbiAgICAgICAgZGVzY3JpcHRpb246IGBQdWJsaWMgU3VibmV0ICR7aW5kZXggKyAxfSBJRGAsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1QdWJsaWNTdWJuZXQke2luZGV4ICsgMX1JZGAsXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHRoaXMucHJpdmF0ZVN1Ym5ldHMuZm9yRWFjaCgoc3VibmV0LCBpbmRleCkgPT4ge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYFByaXZhdGVTdWJuZXQke2luZGV4ICsgMX1JZGAsIHtcbiAgICAgICAgdmFsdWU6IHN1Ym5ldC5zdWJuZXRJZCxcbiAgICAgICAgZGVzY3JpcHRpb246IGBQcml2YXRlIFN1Ym5ldCAke2luZGV4ICsgMX0gSURgLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tUHJpdmF0ZVN1Ym5ldCR7aW5kZXggKyAxfUlkYCxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdGhpcy5pc29sYXRlZFN1Ym5ldHMuZm9yRWFjaCgoc3VibmV0LCBpbmRleCkgPT4ge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYElzb2xhdGVkU3VibmV0JHtpbmRleCArIDF9SWRgLCB7XG4gICAgICAgIHZhbHVlOiBzdWJuZXQuc3VibmV0SWQsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgSXNvbGF0ZWQgU3VibmV0ICR7aW5kZXggKyAxfSBJRGAsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Jc29sYXRlZFN1Ym5ldCR7aW5kZXggKyAxfUlkYCxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgLy8g44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX5oOF5aCxXG4gICAgT2JqZWN0LmVudHJpZXModGhpcy5zZWN1cml0eUdyb3VwcykuZm9yRWFjaCgoW25hbWUsIHNnXSkgPT4ge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYFNlY3VyaXR5R3JvdXAke25hbWV9SWRgLCB7XG4gICAgICAgIHZhbHVlOiBzZy5zZWN1cml0eUdyb3VwSWQsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgU2VjdXJpdHkgR3JvdXAgJHtuYW1lfSBJRGAsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1TZWN1cml0eUdyb3VwJHtuYW1lfUlkYCxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgLy8gV2luZG93cyBBROaDheWgse+8iOWtmOWcqOOBmeOCi+WgtOWQiOOBruOBv++8iVxuICAgIGlmICh0aGlzLndpbmRvd3NBZCkge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dpbmRvd3NBZEluc3RhbmNlSWQnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLndpbmRvd3NBZC5pbnN0YW5jZUlkLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1dpbmRvd3MgQUQgRUMyIEluc3RhbmNlIElEJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVdpbmRvd3NBZEluc3RhbmNlSWRgLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXaW5kb3dzQWRTZWN1cml0eUdyb3VwSWQnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLndpbmRvd3NBZC5zZWN1cml0eUdyb3VwLnNlY3VyaXR5R3JvdXBJZCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdXaW5kb3dzIEFEIFNlY3VyaXR5IEdyb3VwIElEJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVdpbmRvd3NBZFNlY3VyaXR5R3JvdXBJZGAsXG4gICAgICB9KTtcblxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dpbmRvd3NBZEFkbWluUGFzc3dvcmRTZWNyZXRBcm4nLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLndpbmRvd3NBZC5hZG1pblBhc3N3b3JkU2VjcmV0LnNlY3JldEFybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdXaW5kb3dzIEFEIEFkbWluIFBhc3N3b3JkIFNlY3JldCBBUk4nLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tV2luZG93c0FkQWRtaW5QYXNzd29yZFNlY3JldEFybmAsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44K544K/44OD44Kv44Os44OZ44Or44Gu44K/44Kw6Kit5a6aXG4gICAqL1xuICBwcml2YXRlIGFwcGx5U3RhY2tUYWdzKHByb2plY3ROYW1lOiBzdHJpbmcsIGVudmlyb25tZW50OiBzdHJpbmcpOiB2b2lkIHtcbiAgICAvLyDjgr/jgrDlgKTjga7jgrXjg4vjgr/jgqTjgrrvvIjjgrvjgq3jg6Xjg6rjg4bjgqPlr77nrZbvvIlcbiAgICBjb25zdCBzYW5pdGl6ZWRQcm9qZWN0TmFtZSA9IHRoaXMuc2FuaXRpemVUYWdWYWx1ZShwcm9qZWN0TmFtZSk7XG4gICAgY29uc3Qgc2FuaXRpemVkRW52aXJvbm1lbnQgPSB0aGlzLnNhbml0aXplVGFnVmFsdWUoZW52aXJvbm1lbnQpO1xuICAgIFxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnUHJvamVjdCcsIHNhbml0aXplZFByb2plY3ROYW1lKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50Jywgc2FuaXRpemVkRW52aXJvbm1lbnQpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnU3RhY2snLCAnTmV0d29ya2luZ1N0YWNrJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdDb21wb25lbnQnLCAnSW5mcmFzdHJ1Y3R1cmUnKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ01hbmFnZWRCeScsICdDREsnKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Nvc3RDZW50ZXInLCBgJHtzYW5pdGl6ZWRQcm9qZWN0TmFtZX0tJHtzYW5pdGl6ZWRFbnZpcm9ubWVudH0tbmV0d29ya2luZ2ApO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQ3JlYXRlZEF0JywgbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNwbGl0KCdUJylbMF0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOaXouWtmFZQQ+eUqOOBrlNlY3VyaXR5IEdyb3Vwc+OCkuS9nOaIkO+8iOWQjeWJjeOBrumHjeikh+OCkuWLleeahOOBq+WbnumBv++8iVxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVTZWN1cml0eUdyb3Vwc0ZvckltcG9ydGVkVnBjKGNvbmZpZzogTmV0d29ya2luZ0NvbmZpZyk6IHsgW2tleTogc3RyaW5nXTogY2RrLmF3c19lYzIuU2VjdXJpdHlHcm91cCB9IHtcbiAgICBjb25zdCBzZWN1cml0eUdyb3VwczogeyBba2V5OiBzdHJpbmddOiBjZGsuYXdzX2VjMi5TZWN1cml0eUdyb3VwIH0gPSB7fTtcbiAgICBjb25zdCB0aW1lc3RhbXAgPSBEYXRlLm5vdygpLnRvU3RyaW5nKCkuc2xpY2UoLTYpOyAvLyDmnIDlvozjga425qGB44Gu44K/44Kk44Og44K544K/44Oz44OXXG5cbiAgICBpZiAoY29uZmlnLnNlY3VyaXR5R3JvdXBzPy53ZWIpIHtcbiAgICAgIHNlY3VyaXR5R3JvdXBzWyd3ZWInXSA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnV2ViU2VjdXJpdHlHcm91cCcsIHtcbiAgICAgICAgdnBjOiB0aGlzLnZwYyxcbiAgICAgICAgc2VjdXJpdHlHcm91cE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS13ZWItc2ctJHt0aW1lc3RhbXB9YCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBHcm91cCBmb3IgV2ViIHRpZXIgKGltcG9ydGVkIFZQQyknLFxuICAgICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLFxuICAgICAgfSk7XG4gICAgICBzZWN1cml0eUdyb3Vwc1snd2ViJ10uYWRkSW5ncmVzc1J1bGUoXG4gICAgICAgIGVjMi5QZWVyLmFueUlwdjQoKSxcbiAgICAgICAgZWMyLlBvcnQudGNwKDQ0MyksXG4gICAgICAgICdBbGxvdyBIVFRQUyBmcm9tIGFueXdoZXJlJ1xuICAgICAgKTtcbiAgICAgIHNlY3VyaXR5R3JvdXBzWyd3ZWInXS5hZGRJbmdyZXNzUnVsZShcbiAgICAgICAgZWMyLlBlZXIuYW55SXB2NCgpLFxuICAgICAgICBlYzIuUG9ydC50Y3AoODApLFxuICAgICAgICAnQWxsb3cgSFRUUCBmcm9tIGFueXdoZXJlJ1xuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAoY29uZmlnLnNlY3VyaXR5R3JvdXBzPy5hcGkpIHtcbiAgICAgIHNlY3VyaXR5R3JvdXBzWydhcGknXSA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnQXBpU2VjdXJpdHlHcm91cCcsIHtcbiAgICAgICAgdnBjOiB0aGlzLnZwYyxcbiAgICAgICAgc2VjdXJpdHlHcm91cE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1hcGktc2ctJHt0aW1lc3RhbXB9YCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBHcm91cCBmb3IgQVBJIHRpZXIgKGltcG9ydGVkIFZQQyknLFxuICAgICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLFxuICAgICAgfSk7XG4gICAgICBpZiAoc2VjdXJpdHlHcm91cHNbJ3dlYiddKSB7XG4gICAgICAgIHNlY3VyaXR5R3JvdXBzWydhcGknXS5hZGRJbmdyZXNzUnVsZShcbiAgICAgICAgICBzZWN1cml0eUdyb3Vwc1snd2ViJ10sXG4gICAgICAgICAgZWMyLlBvcnQudGNwKDQ0MyksXG4gICAgICAgICAgJ0FsbG93IEhUVFBTIGZyb20gV2ViIHRpZXInXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGNvbmZpZy5zZWN1cml0eUdyb3Vwcz8uZGF0YWJhc2UpIHtcbiAgICAgIHNlY3VyaXR5R3JvdXBzWydkYXRhYmFzZSddID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdEYXRhYmFzZVNlY3VyaXR5R3JvdXAnLCB7XG4gICAgICAgIHZwYzogdGhpcy52cGMsXG4gICAgICAgIHNlY3VyaXR5R3JvdXBOYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tZGItc2ctJHt0aW1lc3RhbXB9YCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBHcm91cCBmb3IgRGF0YWJhc2UgdGllciAoaW1wb3J0ZWQgVlBDKScsXG4gICAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IGZhbHNlLFxuICAgICAgfSk7XG4gICAgICBpZiAoc2VjdXJpdHlHcm91cHNbJ2FwaSddKSB7XG4gICAgICAgIHNlY3VyaXR5R3JvdXBzWydkYXRhYmFzZSddLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgICAgIHNlY3VyaXR5R3JvdXBzWydhcGknXSxcbiAgICAgICAgICBlYzIuUG9ydC50Y3AoMzMwNiksXG4gICAgICAgICAgJ0FsbG93IE15U1FMIGZyb20gQVBJIHRpZXInXG4gICAgICAgICk7XG4gICAgICAgIHNlY3VyaXR5R3JvdXBzWydkYXRhYmFzZSddLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgICAgIHNlY3VyaXR5R3JvdXBzWydhcGknXSxcbiAgICAgICAgICBlYzIuUG9ydC50Y3AoNTQzMiksXG4gICAgICAgICAgJ0FsbG93IFBvc3RncmVTUUwgZnJvbSBBUEkgdGllcidcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY29uZmlnLnNlY3VyaXR5R3JvdXBzPy5sYW1iZGEpIHtcbiAgICAgIHNlY3VyaXR5R3JvdXBzWydsYW1iZGEnXSA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnTGFtYmRhU2VjdXJpdHlHcm91cCcsIHtcbiAgICAgICAgdnBjOiB0aGlzLnZwYyxcbiAgICAgICAgc2VjdXJpdHlHcm91cE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1sYW1iZGEtc2ctJHt0aW1lc3RhbXB9YCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBHcm91cCBmb3IgTGFtYmRhIGZ1bmN0aW9ucyAoaW1wb3J0ZWQgVlBDKScsXG4gICAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZyhg4pyFIFNlY3VyaXR5IEdyb3Vwc+S9nOaIkOWujOS6hu+8iOOCv+OCpOODoOOCueOCv+ODs+ODlzogJHt0aW1lc3RhbXB977yJYCk7XG4gICAgcmV0dXJuIHNlY3VyaXR5R3JvdXBzO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCv+OCsOWApOOBruOCteODi+OCv+OCpOOCulxuICAgKi9cbiAgcHJpdmF0ZSBzYW5pdGl6ZVRhZ1ZhbHVlKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIC8vIOS4jeato+OBquaWh+Wtl+OCkumZpOWOu+OBl+OAgemVt+OBleOCkuWItumZkFxuICAgIHJldHVybiB2YWx1ZVxuICAgICAgLnJlcGxhY2UoL1s8PlxcXCInJl0vZywgJycpIC8vIFhTU+WvvuetllxuICAgICAgLnN1YnN0cmluZygwLCAyNTYpIC8vIEFXUyDjgr/jgrDlgKTjga7mnIDlpKfplbfliLbpmZBcbiAgICAgIC50cmltKCk7XG4gIH1cblxuICAvKipcbiAgICog5LuW44Gu44K544K/44OD44Kv44Gn5L2/55So44GZ44KL44Gf44KB44Gu44ON44OD44OI44Ov44O844Kv5oOF5aCx44KS5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgZ2V0TmV0d29ya2luZ0luZm8oKToge1xuICAgIHZwYzogY2RrLmF3c19lYzIuSVZwYzsgLy8g4pyFIElWcGPlnovjgavlpInmm7RcbiAgICBwdWJsaWNTdWJuZXRzOiBjZGsuYXdzX2VjMi5JU3VibmV0W107XG4gICAgcHJpdmF0ZVN1Ym5ldHM6IGNkay5hd3NfZWMyLklTdWJuZXRbXTtcbiAgICBpc29sYXRlZFN1Ym5ldHM6IGNkay5hd3NfZWMyLklTdWJuZXRbXTtcbiAgICBzZWN1cml0eUdyb3VwczogeyBba2V5OiBzdHJpbmddOiBjZGsuYXdzX2VjMi5TZWN1cml0eUdyb3VwIH07XG4gICAgYXZhaWxhYmlsaXR5Wm9uZXM6IHN0cmluZ1tdO1xuICB9IHtcbiAgICByZXR1cm4ge1xuICAgICAgdnBjOiB0aGlzLnZwYyxcbiAgICAgIHB1YmxpY1N1Ym5ldHM6IHRoaXMucHVibGljU3VibmV0cyxcbiAgICAgIHByaXZhdGVTdWJuZXRzOiB0aGlzLnByaXZhdGVTdWJuZXRzLFxuICAgICAgaXNvbGF0ZWRTdWJuZXRzOiB0aGlzLmlzb2xhdGVkU3VibmV0cyxcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiB0aGlzLnNlY3VyaXR5R3JvdXBzLFxuICAgICAgYXZhaWxhYmlsaXR5Wm9uZXM6IHRoaXMudnBjLmF2YWlsYWJpbGl0eVpvbmVzLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog54m55a6a44Gu44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX44KS5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgZ2V0U2VjdXJpdHlHcm91cChuYW1lOiBzdHJpbmcpOiBjZGsuYXdzX2VjMi5TZWN1cml0eUdyb3VwIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5zZWN1cml0eUdyb3Vwc1tuYW1lXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBWUEPjgqjjg7Pjg4njg53jgqTjg7Pjg4jmg4XloLHjgpLlj5blvpdcbiAgICovXG4gIHB1YmxpYyBnZXRWcGNFbmRwb2ludHMoKTogeyBba2V5OiBzdHJpbmddOiBjZGsuYXdzX2VjMi5JbnRlcmZhY2VWcGNFbmRwb2ludCB8IGNkay5hd3NfZWMyLkdhdGV3YXlWcGNFbmRwb2ludCB9IHtcbiAgICByZXR1cm4gdGhpcy5uZXR3b3JraW5nQ29uc3RydWN0LnZwY0VuZHBvaW50cyB8fCB7fTtcbiAgfVxufSJdfQ==