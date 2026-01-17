"use strict";
/**
 * 最小統合スタック
 *
 * セキュリティとネットワーキングのみの最小構成
 * スタック間参照の問題を回避し、段階的な実装を可能にする
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
exports.MinimalIntegratedStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const security_construct_1 = require("../../modules/security/constructs/security-construct");
const networking_construct_1 = require("../../modules/networking/constructs/networking-construct");
class MinimalIntegratedStack extends cdk.Stack {
    securityConstruct;
    networkingConstruct;
    kmsKey;
    vpc;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { projectName, environment } = props;
        // 1. セキュリティコンストラクト
        const securityConfig = {
            kms: {
                enableKeyRotation: true,
                keySpec: 'SYMMETRIC_DEFAULT',
                keyUsage: 'ENCRYPT_DECRYPT',
            },
            waf: {
                enabled: true,
                scope: 'REGIONAL',
                rules: {
                    enableAWSManagedRules: true,
                    enableRateLimiting: true,
                    rateLimit: 2000,
                    enableGeoBlocking: false,
                    blockedCountries: [],
                },
            },
            cloudTrail: {
                enabled: true,
                s3BucketName: `${projectName}-${environment}-cloudtrail`,
                includeGlobalServiceEvents: true,
                isMultiRegionTrail: true,
                enableLogFileValidation: true,
            },
            tags: {
                SecurityLevel: 'High',
                EncryptionRequired: true,
                ComplianceFramework: 'SOC2',
                DataClassification: 'Confidential',
            },
        };
        this.securityConstruct = new security_construct_1.SecurityConstruct(this, 'Security', {
            config: securityConfig,
            projectName,
            environment,
        });
        this.kmsKey = this.securityConstruct.kmsKey;
        // 2. ネットワーキングコンストラクト
        const networkingConfig = {
            vpcCidr: '10.0.0.0/16',
            maxAzs: 3,
            enablePublicSubnets: true,
            enablePrivateSubnets: true,
            enableIsolatedSubnets: true,
            enableNatGateway: true,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            enableFlowLogs: true,
            vpcEndpoints: {
                s3: true,
                dynamodb: true,
                lambda: true,
                opensearch: true,
            },
            securityGroups: {
                web: true,
                api: true,
                database: true,
                lambda: true,
            },
        };
        this.networkingConstruct = new networking_construct_1.NetworkingConstruct(this, 'Networking', {
            config: networkingConfig,
            projectName,
            environment,
        });
        this.vpc = this.networkingConstruct.vpc;
        // CloudFormation出力
        this.createOutputs();
        // スタックレベルのタグ設定
        this.applyStackTags(projectName, environment);
    }
    /**
     * CloudFormation出力の作成
     */
    createOutputs() {
        // セキュリティ出力
        new cdk.CfnOutput(this, 'KmsKeyId', {
            value: this.kmsKey.keyId,
            description: 'KMS Key ID',
            exportName: `${this.stackName}-KmsKeyId`,
        });
        new cdk.CfnOutput(this, 'KmsKeyArn', {
            value: this.kmsKey.keyArn,
            description: 'KMS Key ARN',
            exportName: `${this.stackName}-KmsKeyArn`,
        });
        if (this.securityConstruct.wafWebAcl) {
            new cdk.CfnOutput(this, 'WafWebAclArn', {
                value: this.securityConstruct.wafWebAcl.attrArn,
                description: 'WAF WebACL ARN',
                exportName: `${this.stackName}-WafWebAclArn`,
            });
        }
        // ネットワーキング出力
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
        // サブネット出力
        this.networkingConstruct.publicSubnets.forEach((subnet, index) => {
            new cdk.CfnOutput(this, `PublicSubnet${index + 1}Id`, {
                value: subnet.subnetId,
                description: `Public Subnet ${index + 1} ID`,
                exportName: `${this.stackName}-PublicSubnet${index + 1}Id`,
            });
        });
        this.networkingConstruct.privateSubnets.forEach((subnet, index) => {
            new cdk.CfnOutput(this, `PrivateSubnet${index + 1}Id`, {
                value: subnet.subnetId,
                description: `Private Subnet ${index + 1} ID`,
                exportName: `${this.stackName}-PrivateSubnet${index + 1}Id`,
            });
        });
        // アベイラビリティゾーン
        new cdk.CfnOutput(this, 'AvailabilityZones', {
            value: this.vpc.availabilityZones.join(','),
            description: 'Availability Zones',
            exportName: `${this.stackName}-AvailabilityZones`,
        });
    }
    /**
     * スタックレベルのタグ設定
     */
    applyStackTags(projectName, environment) {
        cdk.Tags.of(this).add('Project', projectName);
        cdk.Tags.of(this).add('Environment', environment);
        cdk.Tags.of(this).add('Stack', 'MinimalIntegratedStack');
        cdk.Tags.of(this).add('Component', 'Infrastructure');
        cdk.Tags.of(this).add('ManagedBy', 'CDK');
        cdk.Tags.of(this).add('Architecture', 'Minimal');
        cdk.Tags.of(this).add('CostCenter', `${projectName}-${environment}-minimal`);
    }
    /**
     * システム情報の取得
     */
    getSystemInfo() {
        return {
            stackName: this.stackName,
            region: this.region,
            account: this.account,
            components: {
                security: true,
                networking: true,
            },
            resources: {
                kmsKey: this.kmsKey.keyArn,
                vpc: this.vpc.vpcId,
                wafWebAcl: this.securityConstruct.wafWebAcl?.attrArn || null,
            },
        };
    }
    /**
     * セキュリティリソースの取得
     */
    getSecurityResources() {
        return {
            kmsKey: this.kmsKey,
            wafWebAcl: this.securityConstruct.wafWebAcl,
            securityConstruct: this.securityConstruct,
        };
    }
    /**
     * ネットワークリソースの取得
     */
    getNetworkResources() {
        return {
            vpc: this.vpc,
            publicSubnets: this.networkingConstruct.publicSubnets,
            privateSubnets: this.networkingConstruct.privateSubnets,
            isolatedSubnets: this.networkingConstruct.isolatedSubnets,
            securityGroups: this.networkingConstruct.securityGroups,
            networkingConstruct: this.networkingConstruct,
        };
    }
}
exports.MinimalIntegratedStack = MinimalIntegratedStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWluaW1hbC1pbnRlZ3JhdGVkLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibWluaW1hbC1pbnRlZ3JhdGVkLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7R0FLRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFFbkMsNkZBQXlGO0FBQ3pGLG1HQUErRjtBQVMvRixNQUFhLHNCQUF1QixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ25DLGlCQUFpQixDQUFvQjtJQUNyQyxtQkFBbUIsQ0FBc0I7SUFDekMsTUFBTSxDQUFrQjtJQUN4QixHQUFHLENBQWtCO0lBRXJDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBa0M7UUFDMUUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFM0MsbUJBQW1CO1FBQ25CLE1BQU0sY0FBYyxHQUFtQjtZQUNyQyxHQUFHLEVBQUU7Z0JBQ0gsaUJBQWlCLEVBQUUsSUFBSTtnQkFDdkIsT0FBTyxFQUFFLG1CQUFtQjtnQkFDNUIsUUFBUSxFQUFFLGlCQUFpQjthQUM1QjtZQUNELEdBQUcsRUFBRTtnQkFDSCxPQUFPLEVBQUUsSUFBSTtnQkFDYixLQUFLLEVBQUUsVUFBVTtnQkFDakIsS0FBSyxFQUFFO29CQUNMLHFCQUFxQixFQUFFLElBQUk7b0JBQzNCLGtCQUFrQixFQUFFLElBQUk7b0JBQ3hCLFNBQVMsRUFBRSxJQUFJO29CQUNmLGlCQUFpQixFQUFFLEtBQUs7b0JBQ3hCLGdCQUFnQixFQUFFLEVBQUU7aUJBQ3JCO2FBQ0Y7WUFDRCxVQUFVLEVBQUU7Z0JBQ1YsT0FBTyxFQUFFLElBQUk7Z0JBQ2IsWUFBWSxFQUFFLEdBQUcsV0FBVyxJQUFJLFdBQVcsYUFBYTtnQkFDeEQsMEJBQTBCLEVBQUUsSUFBSTtnQkFDaEMsa0JB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IOacgOWwj+e1seWQiOOCueOCv+ODg+OCr1xuICogXG4gKiDjgrvjgq3jg6Xjg6rjg4bjgqPjgajjg43jg4Pjg4jjg6/jg7zjgq3jg7PjgrDjga7jgb/jga7mnIDlsI/mp4vmiJBcbiAqIOOCueOCv+ODg+OCr+mWk+WPgueFp+OBruWVj+mhjOOCkuWbnumBv+OBl+OAgeautemajueahOOBquWun+ijheOCkuWPr+iDveOBq+OBmeOCi1xuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IFNlY3VyaXR5Q29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9zZWN1cml0eS9jb25zdHJ1Y3RzL3NlY3VyaXR5LWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBOZXR3b3JraW5nQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9uZXR3b3JraW5nL2NvbnN0cnVjdHMvbmV0d29ya2luZy1jb25zdHJ1Y3QnO1xuaW1wb3J0IHsgU2VjdXJpdHlDb25maWcgfSBmcm9tICcuLi8uLi9tb2R1bGVzL3NlY3VyaXR5L2ludGVyZmFjZXMvc2VjdXJpdHktY29uZmlnJztcbmltcG9ydCB7IE5ldHdvcmtpbmdDb25maWcgfSBmcm9tICcuLi8uLi9tb2R1bGVzL25ldHdvcmtpbmcvaW50ZXJmYWNlcy9uZXR3b3JraW5nLWNvbmZpZyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWluaW1hbEludGVncmF0ZWRTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBwcm9qZWN0TmFtZTogc3RyaW5nO1xuICBlbnZpcm9ubWVudDogJ2RldicgfCAnc3RhZ2luZycgfCAncHJvZCcgfCAndGVzdCc7XG59XG5cbmV4cG9ydCBjbGFzcyBNaW5pbWFsSW50ZWdyYXRlZFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHNlY3VyaXR5Q29uc3RydWN0OiBTZWN1cml0eUNvbnN0cnVjdDtcbiAgcHVibGljIHJlYWRvbmx5IG5ldHdvcmtpbmdDb25zdHJ1Y3Q6IE5ldHdvcmtpbmdDb25zdHJ1Y3Q7XG4gIHB1YmxpYyByZWFkb25seSBrbXNLZXk6IGNkay5hd3Nfa21zLktleTtcbiAgcHVibGljIHJlYWRvbmx5IHZwYzogY2RrLmF3c19lYzIuVnBjO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBNaW5pbWFsSW50ZWdyYXRlZFN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgcHJvamVjdE5hbWUsIGVudmlyb25tZW50IH0gPSBwcm9wcztcblxuICAgIC8vIDEuIOOCu+OCreODpeODquODhuOCo+OCs+ODs+OCueODiOODqeOCr+ODiFxuICAgIGNvbnN0IHNlY3VyaXR5Q29uZmlnOiBTZWN1cml0eUNvbmZpZyA9IHtcbiAgICAgIGttczoge1xuICAgICAgICBlbmFibGVLZXlSb3RhdGlvbjogdHJ1ZSxcbiAgICAgICAga2V5U3BlYzogJ1NZTU1FVFJJQ19ERUZBVUxUJyxcbiAgICAgICAga2V5VXNhZ2U6ICdFTkNSWVBUX0RFQ1JZUFQnLFxuICAgICAgfSxcbiAgICAgIHdhZjoge1xuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICBzY29wZTogJ1JFR0lPTkFMJyxcbiAgICAgICAgcnVsZXM6IHtcbiAgICAgICAgICBlbmFibGVBV1NNYW5hZ2VkUnVsZXM6IHRydWUsXG4gICAgICAgICAgZW5hYmxlUmF0ZUxpbWl0aW5nOiB0cnVlLFxuICAgICAgICAgIHJhdGVMaW1pdDogMjAwMCxcbiAgICAgICAgICBlbmFibGVHZW9CbG9ja2luZzogZmFsc2UsXG4gICAgICAgICAgYmxvY2tlZENvdW50cmllczogW10sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgY2xvdWRUcmFpbDoge1xuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICBzM0J1Y2tldE5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1jbG91ZHRyYWlsYCxcbiAgICAgICAgaW5jbHVkZUdsb2JhbFNlcnZpY2VFdmVudHM6IHRydWUsXG4gICAgICAgIGlzTXVsdGlSZWdpb25UcmFpbDogdHJ1ZSxcbiAgICAgICAgZW5hYmxlTG9nRmlsZVZhbGlkYXRpb246IHRydWUsXG4gICAgICB9LFxuICAgICAgdGFnczoge1xuICAgICAgICBTZWN1cml0eUxldmVsOiAnSGlnaCcsXG4gICAgICAgIEVuY3J5cHRpb25SZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgQ29tcGxpYW5jZUZyYW1ld29yazogJ1NPQzInLFxuICAgICAgICBEYXRhQ2xhc3NpZmljYXRpb246ICdDb25maWRlbnRpYWwnLFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgdGhpcy5zZWN1cml0eUNvbnN0cnVjdCA9IG5ldyBTZWN1cml0eUNvbnN0cnVjdCh0aGlzLCAnU2VjdXJpdHknLCB7XG4gICAgICBjb25maWc6IHNlY3VyaXR5Q29uZmlnLFxuICAgICAgcHJvamVjdE5hbWUsXG4gICAgICBlbnZpcm9ubWVudCxcbiAgICB9KTtcblxuICAgIHRoaXMua21zS2V5ID0gdGhpcy5zZWN1cml0eUNvbnN0cnVjdC5rbXNLZXk7XG5cbiAgICAvLyAyLiDjg43jg4Pjg4jjg6/jg7zjgq3jg7PjgrDjgrPjg7Pjgrnjg4jjg6njgq/jg4hcbiAgICBjb25zdCBuZXR3b3JraW5nQ29uZmlnOiBOZXR3b3JraW5nQ29uZmlnID0ge1xuICAgICAgdnBjQ2lkcjogJzEwLjAuMC4wLzE2JyxcbiAgICAgIG1heEF6czogMyxcbiAgICAgIGVuYWJsZVB1YmxpY1N1Ym5ldHM6IHRydWUsXG4gICAgICBlbmFibGVQcml2YXRlU3VibmV0czogdHJ1ZSxcbiAgICAgIGVuYWJsZUlzb2xhdGVkU3VibmV0czogdHJ1ZSxcbiAgICAgIGVuYWJsZU5hdEdhdGV3YXk6IHRydWUsXG4gICAgICBlbmFibGVEbnNIb3N0bmFtZXM6IHRydWUsXG4gICAgICBlbmFibGVEbnNTdXBwb3J0OiB0cnVlLFxuICAgICAgZW5hYmxlRmxvd0xvZ3M6IHRydWUsXG4gICAgICB2cGNFbmRwb2ludHM6IHtcbiAgICAgICAgczM6IHRydWUsXG4gICAgICAgIGR5bmFtb2RiOiB0cnVlLFxuICAgICAgICBsYW1iZGE6IHRydWUsXG4gICAgICAgIG9wZW5zZWFyY2g6IHRydWUsXG4gICAgICB9LFxuICAgICAgc2VjdXJpdHlHcm91cHM6IHtcbiAgICAgICAgd2ViOiB0cnVlLFxuICAgICAgICBhcGk6IHRydWUsXG4gICAgICAgIGRhdGFiYXNlOiB0cnVlLFxuICAgICAgICBsYW1iZGE6IHRydWUsXG4gICAgICB9LFxuICAgIH07XG5cbiAgICB0aGlzLm5ldHdvcmtpbmdDb25zdHJ1Y3QgPSBuZXcgTmV0d29ya2luZ0NvbnN0cnVjdCh0aGlzLCAnTmV0d29ya2luZycsIHtcbiAgICAgIGNvbmZpZzogbmV0d29ya2luZ0NvbmZpZyxcbiAgICAgIHByb2plY3ROYW1lLFxuICAgICAgZW52aXJvbm1lbnQsXG4gICAgfSk7XG5cbiAgICB0aGlzLnZwYyA9IHRoaXMubmV0d29ya2luZ0NvbnN0cnVjdC52cGM7XG5cbiAgICAvLyBDbG91ZEZvcm1hdGlvbuWHuuWKm1xuICAgIHRoaXMuY3JlYXRlT3V0cHV0cygpO1xuXG4gICAgLy8g44K544K/44OD44Kv44Os44OZ44Or44Gu44K/44Kw6Kit5a6aXG4gICAgdGhpcy5hcHBseVN0YWNrVGFncyhwcm9qZWN0TmFtZSwgZW52aXJvbm1lbnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIENsb3VkRm9ybWF0aW9u5Ye65Yqb44Gu5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZU91dHB1dHMoKTogdm9pZCB7XG4gICAgLy8g44K744Kt44Ol44Oq44OG44Kj5Ye65YqbXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0ttc0tleUlkJywge1xuICAgICAgdmFsdWU6IHRoaXMua21zS2V5LmtleUlkLFxuICAgICAgZGVzY3JpcHRpb246ICdLTVMgS2V5IElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1LbXNLZXlJZGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnS21zS2V5QXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMua21zS2V5LmtleUFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnS01TIEtleSBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUttc0tleUFybmAsXG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5zZWN1cml0eUNvbnN0cnVjdC53YWZXZWJBY2wpIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXYWZXZWJBY2xBcm4nLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLnNlY3VyaXR5Q29uc3RydWN0LndhZldlYkFjbC5hdHRyQXJuLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1dBRiBXZWJBQ0wgQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVdhZldlYkFjbEFybmAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyDjg43jg4Pjg4jjg6/jg7zjgq3jg7PjgrDlh7rliptcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVnBjSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy52cGMudnBjSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ1ZQQyBJRCcsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tVnBjSWRgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ZwY0NpZHInLCB7XG4gICAgICB2YWx1ZTogdGhpcy52cGMudnBjQ2lkckJsb2NrLFxuICAgICAgZGVzY3JpcHRpb246ICdWUEMgQ0lEUiBCbG9jaycsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tVnBjQ2lkcmAsXG4gICAgfSk7XG5cbiAgICAvLyDjgrXjg5bjg43jg4Pjg4jlh7rliptcbiAgICB0aGlzLm5ldHdvcmtpbmdDb25zdHJ1Y3QucHVibGljU3VibmV0cy5mb3JFYWNoKChzdWJuZXQsIGluZGV4KSA9PiB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgUHVibGljU3VibmV0JHtpbmRleCArIDF9SWRgLCB7XG4gICAgICAgIHZhbHVlOiBzdWJuZXQuc3VibmV0SWQsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgUHVibGljIFN1Ym5ldCAke2luZGV4ICsgMX0gSURgLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tUHVibGljU3VibmV0JHtpbmRleCArIDF9SWRgLFxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICB0aGlzLm5ldHdvcmtpbmdDb25zdHJ1Y3QucHJpdmF0ZVN1Ym5ldHMuZm9yRWFjaCgoc3VibmV0LCBpbmRleCkgPT4ge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYFByaXZhdGVTdWJuZXQke2luZGV4ICsgMX1JZGAsIHtcbiAgICAgICAgdmFsdWU6IHN1Ym5ldC5zdWJuZXRJZCxcbiAgICAgICAgZGVzY3JpcHRpb246IGBQcml2YXRlIFN1Ym5ldCAke2luZGV4ICsgMX0gSURgLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tUHJpdmF0ZVN1Ym5ldCR7aW5kZXggKyAxfUlkYCxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgLy8g44Ki44OZ44Kk44Op44OT44Oq44OG44Kj44K+44O844OzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0F2YWlsYWJpbGl0eVpvbmVzJywge1xuICAgICAgdmFsdWU6IHRoaXMudnBjLmF2YWlsYWJpbGl0eVpvbmVzLmpvaW4oJywnKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQXZhaWxhYmlsaXR5IFpvbmVzJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BdmFpbGFiaWxpdHlab25lc2AsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog44K544K/44OD44Kv44Os44OZ44Or44Gu44K/44Kw6Kit5a6aXG4gICAqL1xuICBwcml2YXRlIGFwcGx5U3RhY2tUYWdzKHByb2plY3ROYW1lOiBzdHJpbmcsIGVudmlyb25tZW50OiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1Byb2plY3QnLCBwcm9qZWN0TmFtZSk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdFbnZpcm9ubWVudCcsIGVudmlyb25tZW50KTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1N0YWNrJywgJ01pbmltYWxJbnRlZ3JhdGVkU3RhY2snKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0NvbXBvbmVudCcsICdJbmZyYXN0cnVjdHVyZScpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnTWFuYWdlZEJ5JywgJ0NESycpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQXJjaGl0ZWN0dXJlJywgJ01pbmltYWwnKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Nvc3RDZW50ZXInLCBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tbWluaW1hbGApO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCt+OCueODhuODoOaDheWgseOBruWPluW+l1xuICAgKi9cbiAgcHVibGljIGdldFN5c3RlbUluZm8oKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YWNrTmFtZTogdGhpcy5zdGFja05hbWUsXG4gICAgICByZWdpb246IHRoaXMucmVnaW9uLFxuICAgICAgYWNjb3VudDogdGhpcy5hY2NvdW50LFxuICAgICAgY29tcG9uZW50czoge1xuICAgICAgICBzZWN1cml0eTogdHJ1ZSxcbiAgICAgICAgbmV0d29ya2luZzogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICByZXNvdXJjZXM6IHtcbiAgICAgICAga21zS2V5OiB0aGlzLmttc0tleS5rZXlBcm4sXG4gICAgICAgIHZwYzogdGhpcy52cGMudnBjSWQsXG4gICAgICAgIHdhZldlYkFjbDogdGhpcy5zZWN1cml0eUNvbnN0cnVjdC53YWZXZWJBY2w/LmF0dHJBcm4gfHwgbnVsbCxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrvjgq3jg6Xjg6rjg4bjgqPjg6rjgr3jg7zjgrnjga7lj5blvpdcbiAgICovXG4gIHB1YmxpYyBnZXRTZWN1cml0eVJlc291cmNlcygpIHtcbiAgICByZXR1cm4ge1xuICAgICAga21zS2V5OiB0aGlzLmttc0tleSxcbiAgICAgIHdhZldlYkFjbDogdGhpcy5zZWN1cml0eUNvbnN0cnVjdC53YWZXZWJBY2wsXG4gICAgICBzZWN1cml0eUNvbnN0cnVjdDogdGhpcy5zZWN1cml0eUNvbnN0cnVjdCxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOODjeODg+ODiOODr+ODvOOCr+ODquOCveODvOOCueOBruWPluW+l1xuICAgKi9cbiAgcHVibGljIGdldE5ldHdvcmtSZXNvdXJjZXMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHZwYzogdGhpcy52cGMsXG4gICAgICBwdWJsaWNTdWJuZXRzOiB0aGlzLm5ldHdvcmtpbmdDb25zdHJ1Y3QucHVibGljU3VibmV0cyxcbiAgICAgIHByaXZhdGVTdWJuZXRzOiB0aGlzLm5ldHdvcmtpbmdDb25zdHJ1Y3QucHJpdmF0ZVN1Ym5ldHMsXG4gICAgICBpc29sYXRlZFN1Ym5ldHM6IHRoaXMubmV0d29ya2luZ0NvbnN0cnVjdC5pc29sYXRlZFN1Ym5ldHMsXG4gICAgICBzZWN1cml0eUdyb3VwczogdGhpcy5uZXR3b3JraW5nQ29uc3RydWN0LnNlY3VyaXR5R3JvdXBzLFxuICAgICAgbmV0d29ya2luZ0NvbnN0cnVjdDogdGhpcy5uZXR3b3JraW5nQ29uc3RydWN0LFxuICAgIH07XG4gIH1cbn0iXX0=