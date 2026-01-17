"use strict";
/**
 * OpenSearch Domainスタック
 *
 * 通常のOpenSearchクラスター（非Serverless）をデプロイ
 * Titan Multimodal Embedding用に最適化
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
exports.OpenSearchDomainStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const kms = __importStar(require("aws-cdk-lib/aws-kms"));
const opensearch_domain_construct_1 = require("../modules/database/constructs/opensearch-domain-construct");
const opensearch_domain_config_1 = require("../modules/database/configs/opensearch-domain-config");
class OpenSearchDomainStack extends cdk.Stack {
    openSearchConstruct;
    vpc;
    kmsKey;
    constructor(scope, id, props) {
        super(scope, id, props);
        // 基本設定取得
        const baseConfig = (0, opensearch_domain_config_1.getOpenSearchDomainConfig)(props.environment, props.projectName);
        // VPC設定
        if (props.useVpc) {
            this.vpc = this.setupVpc(props.existingVpcId);
        }
        // KMS暗号化設定
        if (props.enableKmsEncryption) {
            this.kmsKey = this.createKmsKey();
        }
        // OpenSearchドメイン設定
        const openSearchConfig = {
            ...baseConfig,
            domainName: this.generateDomainName(props.projectName, props.environment),
            networkConfig: {
                ...baseConfig.networkConfig,
                vpcEnabled: props.useVpc || baseConfig.networkConfig.vpcEnabled,
                vpc: this.vpc || baseConfig.networkConfig.vpc,
                subnets: this.vpc ? this.vpc.privateSubnets : baseConfig.networkConfig.subnets,
            },
            securityConfig: {
                ...baseConfig.securityConfig,
                kmsKey: this.kmsKey || baseConfig.securityConfig.kmsKey,
            },
            tags: {
                ...baseConfig.tags,
                ...props.tags,
                ProjectName: props.projectName,
                StackName: this.stackName,
            },
            // カスタム設定の上書き
            ...props.customConfig,
        };
        // OpenSearchドメイン作成
        this.openSearchConstruct = new opensearch_domain_construct_1.OpenSearchDomainConstruct(this, 'OpenSearchDomain', openSearchConfig);
        // CloudFormation出力
        this.createOutputs();
        // スタックレベルタグ
        this.applyStackTags(props);
    }
    /**
     * VPC設定
     */
    setupVpc(existingVpcId) {
        if (existingVpcId) {
            // 既存VPCを使用
            return ec2.Vpc.fromLookup(this, 'ExistingVpc', {
                vpcId: existingVpcId,
            });
        }
        else {
            // 新しいVPCを作成
            return new ec2.Vpc(this, 'OpenSearchVpc', {
                maxAzs: 3,
                natGateways: 1,
                subnetConfiguration: [
                    {
                        cidrMask: 24,
                        name: 'Public',
                        subnetType: ec2.SubnetType.PUBLIC,
                    },
                    {
                        cidrMask: 24,
                        name: 'Private',
                        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    },
                ],
                enableDnsHostnames: true,
                enableDnsSupport: true,
            });
        }
    }
    /**
     * KMSキー作成
     */
    createKmsKey() {
        return new kms.Key(this, 'OpenSearchKmsKey', {
            description: 'KMS key for OpenSearch domain encryption',
            enableKeyRotation: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
    }
    /**
     * ドメイン名生成（28文字以内）
     * Agent Steering命名規則準拠
     */
    generateDomainName(projectName, environment) {
        // External Vector DB用の短縮名
        const baseName = `${projectName}-${environment}-vectordb`;
        const maxLength = 28;
        // 長すぎる場合は短縮
        if (baseName.length > maxLength) {
            const availableLength = maxLength;
            return baseName.substring(0, availableLength);
        }
        return baseName;
    }
    /**
     * CloudFormation出力作成
     */
    createOutputs() {
        new cdk.CfnOutput(this, 'OpenSearchDomainArn', {
            value: this.openSearchConstruct.outputs.domainArn,
            description: 'OpenSearch domain ARN',
            exportName: `${this.stackName}-DomainArn`,
        });
        new cdk.CfnOutput(this, 'OpenSearchDomainEndpoint', {
            value: this.openSearchConstruct.outputs.domainEndpoint,
            description: 'OpenSearch domain endpoint',
            exportName: `${this.stackName}-DomainEndpoint`,
        });
        new cdk.CfnOutput(this, 'OpenSearchKibanaEndpoint', {
            value: this.openSearchConstruct.outputs.kibanaEndpoint,
            description: 'OpenSearch Kibana endpoint',
            exportName: `${this.stackName}-KibanaEndpoint`,
        });
        new cdk.CfnOutput(this, 'OpenSearchDomainName', {
            value: this.openSearchConstruct.outputs.domainName,
            description: 'OpenSearch domain name',
            exportName: `${this.stackName}-DomainName`,
        });
        if (this.openSearchConstruct.outputs.securityGroupId) {
            new cdk.CfnOutput(this, 'OpenSearchSecurityGroupId', {
                value: this.openSearchConstruct.outputs.securityGroupId,
                description: 'OpenSearch security group ID',
                exportName: `${this.stackName}-SecurityGroupId`,
            });
        }
        if (this.vpc) {
            new cdk.CfnOutput(this, 'VpcId', {
                value: this.vpc.vpcId,
                description: 'VPC ID',
                exportName: `${this.stackName}-VpcId`,
            });
        }
        if (this.kmsKey) {
            new cdk.CfnOutput(this, 'KmsKeyId', {
                value: this.kmsKey.keyId,
                description: 'KMS key ID',
                exportName: `${this.stackName}-KmsKeyId`,
            });
        }
        // Titan Multimodal Embeddingインデックステンプレート出力
        new cdk.CfnOutput(this, 'MultimodalIndexTemplate', {
            value: this.openSearchConstruct.createMultimodalIndexTemplate(),
            description: 'Titan Multimodal Embedding index template (JSON)',
        });
    }
    /**
     * スタックレベルタグ適用
     */
    applyStackTags(props) {
        const defaultTags = {
            Environment: props.environment,
            ProjectName: props.projectName,
            Component: 'OpenSearch',
            Purpose: 'MultimodalEmbedding',
            ManagedBy: 'CDK',
            CostCenter: props.environment === 'prod' ? 'Production' : 'Development',
        };
        const allTags = { ...defaultTags, ...props.tags };
        Object.entries(allTags).forEach(([key, value]) => {
            cdk.Tags.of(this).add(key, value);
        });
    }
}
exports.OpenSearchDomainStack = OpenSearchDomainStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlbnNlYXJjaC1kb21haW4tc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJvcGVuc2VhcmNoLWRvbWFpbi1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7O0dBS0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLHlEQUEyQztBQUMzQyx5REFBMkM7QUFFM0MsNEdBQXVHO0FBQ3ZHLG1HQUFpRztBQXlCakcsTUFBYSxxQkFBc0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUNsQyxtQkFBbUIsQ0FBNEI7SUFDL0MsR0FBRyxDQUFZO0lBQ2YsTUFBTSxDQUFXO0lBRWpDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBaUM7UUFDekUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsU0FBUztRQUNULE1BQU0sVUFBVSxHQUFHLElBQUEsb0RBQXlCLEVBQUMsS0FBSyxDQUFDLFdBQVcsRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFbkYsUUFBUTtRQUNSLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2pCLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDaEQsQ0FBQztRQUVELFdBQVc7UUFDWCxJQUFJLEtBQUssQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1lBQzlCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ3BDLENBQUM7UUFFRCxtQkFBbUI7UUFDbkIsTUFBTSxnQkFBZ0IsR0FBRztZQUN2QixHQUFHLFVBQVU7WUFDYixVQUFVLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsS0FBSyxDQUFDLFdBQVcsQ0FBQztZQUN6RSxhQUFhLEVBQUU7Z0JBQ2IsR0FBRyxVQUFVLENBQUMsYUFBYTtnQkFDM0IsVUFBVSxFQUFFLEtBQUssQ0FBQyxNQUFNLElBQUksVUFBVSxDQUFDLGFBQWEsQ0FBQyxVQUFVO2dCQUMvRCxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsSUFBSSxVQUFVLENBQUMsYUFBYSxDQUFDLEdBQUc7Z0JBQzdDLE9BQU8sRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxPQUFPO2FBQy9FO1lBQ0QsY0FBYyxFQUFFO2dCQUNkLEdBQUcsVUFBVSxDQUFDLGNBQWM7Z0JBQzVCLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxJQUFJLFVBQVUsQ0FBQyxjQUFjLENBQUMsTUFBTTthQUN4RDtZQUNELElBQUksRUFBRTtnQkFDSixHQUFHLFVBQVUsQ0FBQyxJQUFJO2dCQUNsQixHQUFHLEtBQUssQ0FBQyxJQUFJO2dCQUNiLFdBQVcsRUFBRSxLQUFLLENBQUMsV0FBVztnQkFDOUIsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTO2FBQzFCO1lBQ0QsYUFBYTtZQUNiLEdBQUcsS0FBSyxDQUFDLFlBQVk7U0FDdEIsQ0FBQztRQUVGLG1CQUFtQjtRQUNuQixJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSx1REFBeUIsQ0FDdEQsSUFBSSxFQUNKLGtCQUFrQixFQUNsQixnQkFBZ0IsQ0FDakIsQ0FBQztRQUVGLG1CQUFtQjtRQUNuQixJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7UUFFckIsWUFBWTtRQUNaLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDN0IsQ0FBQztJQUVEOztPQUVHO0lBQ0ssUUFBUSxDQUFDLGFBQXNCO1FBQ3JDLElBQUksYUFBYSxFQUFFLENBQUM7WUFDbEIsV0FBVztZQUNYLE9BQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtnQkFDN0MsS0FBSyxFQUFFLGFBQWE7YUFDckIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQzthQUFNLENBQUM7WUFDTixZQUFZO1lBQ1osT0FBTyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtnQkFDeEMsTUFBTSxFQUFFLENBQUM7Z0JBQ1QsV0FBVyxFQUFFLENBQUM7Z0JBQ2QsbUJBQW1CLEVBQUU7b0JBQ25CO3dCQUNFLFFBQVEsRUFBRSxFQUFFO3dCQUNaLElBQUksRUFBRSxRQUFRO3dCQUNkLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLE1BQU07cUJBQ2xDO29CQUNEO3dCQUNFLFFBQVEsRUFBRSxFQUFFO3dCQUNaLElBQUksRUFBRSxTQUFTO3dCQUNmLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLG1CQUFtQjtxQkFDL0M7aUJBQ0Y7Z0JBQ0Qsa0JBQWtCLEVBQUUsSUFBSTtnQkFDeEIsZ0JBQWdCLEVBQUUsSUFBSTthQUN2QixDQUFDLENBQUM7UUFDTCxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0ssWUFBWTtRQUNsQixPQUFPLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDM0MsV0FBVyxFQUFFLDBDQUEwQztZQUN2RCxpQkFBaUIsRUFBRSxJQUFJO1lBQ3ZCLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7T0FHRztJQUNLLGtCQUFrQixDQUFDLFdBQW1CLEVBQUUsV0FBbUI7UUFDakUsMEJBQTBCO1FBQzFCLE1BQU0sUUFBUSxHQUFHLEdBQUcsV0FBVyxJQUFJLFdBQVcsV0FBVyxDQUFDO1FBQzFELE1BQU0sU0FBUyxHQUFHLEVBQUUsQ0FBQztRQUVyQixZQUFZO1FBQ1osSUFBSSxRQUFRLENBQUMsTUFBTSxHQUFHLFNBQVMsRUFBRSxDQUFDO1lBQ2hDLE1BQU0sZUFBZSxHQUFHLFNBQVMsQ0FBQztZQUNsQyxPQUFPLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBQ2hELENBQUM7UUFFRCxPQUFPLFFBQVEsQ0FBQztJQUNsQixDQUFDO0lBRUQ7O09BRUc7SUFDSyxhQUFhO1FBQ25CLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDN0MsS0FBSyxFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsU0FBUztZQUNqRCxXQUFXLEVBQUUsdUJBQXVCO1lBQ3BDLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLFlBQVk7U0FDMUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSwwQkFBMEIsRUFBRTtZQUNsRCxLQUFLLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxjQUFjO1lBQ3RELFdBQVcsRUFBRSw0QkFBNEI7WUFDekMsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsaUJBQWlCO1NBQy9DLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsMEJBQTBCLEVBQUU7WUFDbEQsS0FBSyxFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsY0FBYztZQUN0RCxXQUFXLEVBQUUsNEJBQTRCO1lBQ3pDLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLGlCQUFpQjtTQUMvQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQzlDLEtBQUssRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLFVBQVU7WUFDbEQsV0FBVyxFQUFFLHdCQUF3QjtZQUNyQyxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyxhQUFhO1NBQzNDLENBQUMsQ0FBQztRQUVILElBQUksSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUNyRCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLDJCQUEyQixFQUFFO2dCQUNuRCxLQUFLLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxlQUFlO2dCQUN2RCxXQUFXLEVBQUUsOEJBQThCO2dCQUMzQyxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyxrQkFBa0I7YUFDaEQsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ2IsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUU7Z0JBQy9CLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUs7Z0JBQ3JCLFdBQVcsRUFBRSxRQUFRO2dCQUNyQixVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyxRQUFRO2FBQ3RDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNoQixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtnQkFDbEMsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSztnQkFDeEIsV0FBVyxFQUFFLFlBQVk7Z0JBQ3pCLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLFdBQVc7YUFDekMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELDJDQUEyQztRQUMzQyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHlCQUF5QixFQUFFO1lBQ2pELEtBQUssRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsNkJBQTZCLEVBQUU7WUFDL0QsV0FBVyxFQUFFLGtEQUFrRDtTQUNoRSxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSyxjQUFjLENBQUMsS0FBaUM7UUFDdEQsTUFBTSxXQUFXLEdBQUc7WUFDbEIsV0FBVyxFQUFFLEtBQUssQ0FBQyxXQUFXO1lBQzlCLFdBQVcsRUFBRSxLQUFLLENBQUMsV0FBVztZQUM5QixTQUFTLEVBQUUsWUFBWTtZQUN2QixPQUFPLEVBQUUscUJBQXFCO1lBQzlCLFNBQVMsRUFBRSxLQUFLO1lBQ2hCLFVBQVUsRUFBRSxLQUFLLENBQUMsV0FBVyxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxhQUFhO1NBQ3hFLENBQUM7UUFFRixNQUFNLE9BQU8sR0FBRyxFQUFFLEdBQUcsV0FBVyxFQUFFLEdBQUcsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO1FBRWxELE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRTtZQUMvQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3BDLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBdE1ELHNEQXNNQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogT3BlblNlYXJjaCBEb21haW7jgrnjgr/jg4Pjgq9cbiAqIFxuICog6YCa5bi444GuT3BlblNlYXJjaOOCr+ODqeOCueOCv+ODvO+8iOmdnlNlcnZlcmxlc3PvvInjgpLjg4fjg5fjg63jgqRcbiAqIFRpdGFuIE11bHRpbW9kYWwgRW1iZWRkaW5n55So44Gr5pyA6YGp5YyWXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIGttcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mta21zJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgT3BlblNlYXJjaERvbWFpbkNvbnN0cnVjdCB9IGZyb20gJy4uL21vZHVsZXMvZGF0YWJhc2UvY29uc3RydWN0cy9vcGVuc2VhcmNoLWRvbWFpbi1jb25zdHJ1Y3QnO1xuaW1wb3J0IHsgZ2V0T3BlblNlYXJjaERvbWFpbkNvbmZpZyB9IGZyb20gJy4uL21vZHVsZXMvZGF0YWJhc2UvY29uZmlncy9vcGVuc2VhcmNoLWRvbWFpbi1jb25maWcnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE9wZW5TZWFyY2hEb21haW5TdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICAvKiog55Kw5aKD5ZCNICovXG4gIHJlYWRvbmx5IGVudmlyb25tZW50OiBzdHJpbmc7XG4gIFxuICAvKiog44OX44Ot44K444Kn44Kv44OI5ZCNICovXG4gIHJlYWRvbmx5IHByb2plY3ROYW1lOiBzdHJpbmc7XG4gIFxuICAvKiogVlBD5L2/55So44OV44Op44KwICovXG4gIHJlYWRvbmx5IHVzZVZwYz86IGJvb2xlYW47XG4gIFxuICAvKiog5pei5a2YVlBDIElEICovXG4gIHJlYWRvbmx5IGV4aXN0aW5nVnBjSWQ/OiBzdHJpbmc7XG4gIFxuICAvKiogS01T5pqX5Y+35YyW5pyJ5Yq55YyWICovXG4gIHJlYWRvbmx5IGVuYWJsZUttc0VuY3J5cHRpb24/OiBib29sZWFuO1xuICBcbiAgLyoqIOOCq+OCueOCv+ODoOioreWumuS4iuabuOOBjSAqL1xuICByZWFkb25seSBjdXN0b21Db25maWc/OiBQYXJ0aWFsPGFueT47XG4gIFxuICAvKiog44K/44KwICovXG4gIHJlYWRvbmx5IHRhZ3M/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xufVxuXG5leHBvcnQgY2xhc3MgT3BlblNlYXJjaERvbWFpblN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IG9wZW5TZWFyY2hDb25zdHJ1Y3Q6IE9wZW5TZWFyY2hEb21haW5Db25zdHJ1Y3Q7XG4gIHB1YmxpYyByZWFkb25seSB2cGM/OiBlYzIuSVZwYztcbiAgcHVibGljIHJlYWRvbmx5IGttc0tleT86IGttcy5LZXk7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IE9wZW5TZWFyY2hEb21haW5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyDln7rmnKzoqK3lrprlj5blvpdcbiAgICBjb25zdCBiYXNlQ29uZmlnID0gZ2V0T3BlblNlYXJjaERvbWFpbkNvbmZpZyhwcm9wcy5lbnZpcm9ubWVudCwgcHJvcHMucHJvamVjdE5hbWUpO1xuXG4gICAgLy8gVlBD6Kit5a6aXG4gICAgaWYgKHByb3BzLnVzZVZwYykge1xuICAgICAgdGhpcy52cGMgPSB0aGlzLnNldHVwVnBjKHByb3BzLmV4aXN0aW5nVnBjSWQpO1xuICAgIH1cblxuICAgIC8vIEtNU+aal+WPt+WMluioreWumlxuICAgIGlmIChwcm9wcy5lbmFibGVLbXNFbmNyeXB0aW9uKSB7XG4gICAgICB0aGlzLmttc0tleSA9IHRoaXMuY3JlYXRlS21zS2V5KCk7XG4gICAgfVxuXG4gICAgLy8gT3BlblNlYXJjaOODieODoeOCpOODs+ioreWumlxuICAgIGNvbnN0IG9wZW5TZWFyY2hDb25maWcgPSB7XG4gICAgICAuLi5iYXNlQ29uZmlnLFxuICAgICAgZG9tYWluTmFtZTogdGhpcy5nZW5lcmF0ZURvbWFpbk5hbWUocHJvcHMucHJvamVjdE5hbWUsIHByb3BzLmVudmlyb25tZW50KSxcbiAgICAgIG5ldHdvcmtDb25maWc6IHtcbiAgICAgICAgLi4uYmFzZUNvbmZpZy5uZXR3b3JrQ29uZmlnLFxuICAgICAgICB2cGNFbmFibGVkOiBwcm9wcy51c2VWcGMgfHwgYmFzZUNvbmZpZy5uZXR3b3JrQ29uZmlnLnZwY0VuYWJsZWQsXG4gICAgICAgIHZwYzogdGhpcy52cGMgfHwgYmFzZUNvbmZpZy5uZXR3b3JrQ29uZmlnLnZwYyxcbiAgICAgICAgc3VibmV0czogdGhpcy52cGMgPyB0aGlzLnZwYy5wcml2YXRlU3VibmV0cyA6IGJhc2VDb25maWcubmV0d29ya0NvbmZpZy5zdWJuZXRzLFxuICAgICAgfSxcbiAgICAgIHNlY3VyaXR5Q29uZmlnOiB7XG4gICAgICAgIC4uLmJhc2VDb25maWcuc2VjdXJpdHlDb25maWcsXG4gICAgICAgIGttc0tleTogdGhpcy5rbXNLZXkgfHwgYmFzZUNvbmZpZy5zZWN1cml0eUNvbmZpZy5rbXNLZXksXG4gICAgICB9LFxuICAgICAgdGFnczoge1xuICAgICAgICAuLi5iYXNlQ29uZmlnLnRhZ3MsXG4gICAgICAgIC4uLnByb3BzLnRhZ3MsXG4gICAgICAgIFByb2plY3ROYW1lOiBwcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgICAgU3RhY2tOYW1lOiB0aGlzLnN0YWNrTmFtZSxcbiAgICAgIH0sXG4gICAgICAvLyDjgqvjgrnjgr/jg6DoqK3lrprjga7kuIrmm7jjgY1cbiAgICAgIC4uLnByb3BzLmN1c3RvbUNvbmZpZyxcbiAgICB9O1xuXG4gICAgLy8gT3BlblNlYXJjaOODieODoeOCpOODs+S9nOaIkFxuICAgIHRoaXMub3BlblNlYXJjaENvbnN0cnVjdCA9IG5ldyBPcGVuU2VhcmNoRG9tYWluQ29uc3RydWN0KFxuICAgICAgdGhpcyxcbiAgICAgICdPcGVuU2VhcmNoRG9tYWluJyxcbiAgICAgIG9wZW5TZWFyY2hDb25maWdcbiAgICApO1xuXG4gICAgLy8gQ2xvdWRGb3JtYXRpb27lh7rliptcbiAgICB0aGlzLmNyZWF0ZU91dHB1dHMoKTtcblxuICAgIC8vIOOCueOCv+ODg+OCr+ODrOODmeODq+OCv+OCsFxuICAgIHRoaXMuYXBwbHlTdGFja1RhZ3MocHJvcHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFZQQ+ioreWumlxuICAgKi9cbiAgcHJpdmF0ZSBzZXR1cFZwYyhleGlzdGluZ1ZwY0lkPzogc3RyaW5nKTogZWMyLklWcGMge1xuICAgIGlmIChleGlzdGluZ1ZwY0lkKSB7XG4gICAgICAvLyDml6LlrZhWUEPjgpLkvb/nlKhcbiAgICAgIHJldHVybiBlYzIuVnBjLmZyb21Mb29rdXAodGhpcywgJ0V4aXN0aW5nVnBjJywge1xuICAgICAgICB2cGNJZDogZXhpc3RpbmdWcGNJZCxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyDmlrDjgZfjgYRWUEPjgpLkvZzmiJBcbiAgICAgIHJldHVybiBuZXcgZWMyLlZwYyh0aGlzLCAnT3BlblNlYXJjaFZwYycsIHtcbiAgICAgICAgbWF4QXpzOiAzLFxuICAgICAgICBuYXRHYXRld2F5czogMSxcbiAgICAgICAgc3VibmV0Q29uZmlndXJhdGlvbjogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGNpZHJNYXNrOiAyNCxcbiAgICAgICAgICAgIG5hbWU6ICdQdWJsaWMnLFxuICAgICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFVCTElDLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICAgICAgbmFtZTogJ1ByaXZhdGUnLFxuICAgICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBlbmFibGVEbnNIb3N0bmFtZXM6IHRydWUsXG4gICAgICAgIGVuYWJsZURuc1N1cHBvcnQ6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogS01T44Kt44O85L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUttc0tleSgpOiBrbXMuS2V5IHtcbiAgICByZXR1cm4gbmV3IGttcy5LZXkodGhpcywgJ09wZW5TZWFyY2hLbXNLZXknLCB7XG4gICAgICBkZXNjcmlwdGlvbjogJ0tNUyBrZXkgZm9yIE9wZW5TZWFyY2ggZG9tYWluIGVuY3J5cHRpb24nLFxuICAgICAgZW5hYmxlS2V5Um90YXRpb246IHRydWUsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOODieODoeOCpOODs+WQjeeUn+aIkO+8iDI45paH5a2X5Lul5YaF77yJXG4gICAqIEFnZW50IFN0ZWVyaW5n5ZG95ZCN6KaP5YmH5rqW5ougXG4gICAqL1xuICBwcml2YXRlIGdlbmVyYXRlRG9tYWluTmFtZShwcm9qZWN0TmFtZTogc3RyaW5nLCBlbnZpcm9ubWVudDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAvLyBFeHRlcm5hbCBWZWN0b3IgRELnlKjjga7nn63nuK7lkI1cbiAgICBjb25zdCBiYXNlTmFtZSA9IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS12ZWN0b3JkYmA7XG4gICAgY29uc3QgbWF4TGVuZ3RoID0gMjg7XG4gICAgXG4gICAgLy8g6ZW344GZ44GO44KL5aC05ZCI44Gv55+t57iuXG4gICAgaWYgKGJhc2VOYW1lLmxlbmd0aCA+IG1heExlbmd0aCkge1xuICAgICAgY29uc3QgYXZhaWxhYmxlTGVuZ3RoID0gbWF4TGVuZ3RoO1xuICAgICAgcmV0dXJuIGJhc2VOYW1lLnN1YnN0cmluZygwLCBhdmFpbGFibGVMZW5ndGgpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gYmFzZU5hbWU7XG4gIH1cblxuICAvKipcbiAgICogQ2xvdWRGb3JtYXRpb27lh7rlipvkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlT3V0cHV0cygpOiB2b2lkIHtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnT3BlblNlYXJjaERvbWFpbkFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLm9wZW5TZWFyY2hDb25zdHJ1Y3Qub3V0cHV0cy5kb21haW5Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ09wZW5TZWFyY2ggZG9tYWluIEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tRG9tYWluQXJuYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdPcGVuU2VhcmNoRG9tYWluRW5kcG9pbnQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5vcGVuU2VhcmNoQ29uc3RydWN0Lm91dHB1dHMuZG9tYWluRW5kcG9pbnQsXG4gICAgICBkZXNjcmlwdGlvbjogJ09wZW5TZWFyY2ggZG9tYWluIGVuZHBvaW50JyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Eb21haW5FbmRwb2ludGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnT3BlblNlYXJjaEtpYmFuYUVuZHBvaW50Jywge1xuICAgICAgdmFsdWU6IHRoaXMub3BlblNlYXJjaENvbnN0cnVjdC5vdXRwdXRzLmtpYmFuYUVuZHBvaW50LFxuICAgICAgZGVzY3JpcHRpb246ICdPcGVuU2VhcmNoIEtpYmFuYSBlbmRwb2ludCcsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tS2liYW5hRW5kcG9pbnRgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ09wZW5TZWFyY2hEb21haW5OYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMub3BlblNlYXJjaENvbnN0cnVjdC5vdXRwdXRzLmRvbWFpbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ09wZW5TZWFyY2ggZG9tYWluIG5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LURvbWFpbk5hbWVgLFxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMub3BlblNlYXJjaENvbnN0cnVjdC5vdXRwdXRzLnNlY3VyaXR5R3JvdXBJZCkge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ09wZW5TZWFyY2hTZWN1cml0eUdyb3VwSWQnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLm9wZW5TZWFyY2hDb25zdHJ1Y3Qub3V0cHV0cy5zZWN1cml0eUdyb3VwSWQsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnT3BlblNlYXJjaCBzZWN1cml0eSBncm91cCBJRCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1TZWN1cml0eUdyb3VwSWRgLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMudnBjKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVnBjSWQnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLnZwYy52cGNJZCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdWUEMgSUQnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tVnBjSWRgLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMua21zS2V5KSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnS21zS2V5SWQnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmttc0tleS5rZXlJZCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdLTVMga2V5IElEJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUttc0tleUlkYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFRpdGFuIE11bHRpbW9kYWwgRW1iZWRkaW5n44Kk44Oz44OH44OD44Kv44K544OG44Oz44OX44Os44O844OI5Ye65YqbXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ011bHRpbW9kYWxJbmRleFRlbXBsYXRlJywge1xuICAgICAgdmFsdWU6IHRoaXMub3BlblNlYXJjaENvbnN0cnVjdC5jcmVhdGVNdWx0aW1vZGFsSW5kZXhUZW1wbGF0ZSgpLFxuICAgICAgZGVzY3JpcHRpb246ICdUaXRhbiBNdWx0aW1vZGFsIEVtYmVkZGluZyBpbmRleCB0ZW1wbGF0ZSAoSlNPTiknLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCueOCv+ODg+OCr+ODrOODmeODq+OCv+OCsOmBqeeUqFxuICAgKi9cbiAgcHJpdmF0ZSBhcHBseVN0YWNrVGFncyhwcm9wczogT3BlblNlYXJjaERvbWFpblN0YWNrUHJvcHMpOiB2b2lkIHtcbiAgICBjb25zdCBkZWZhdWx0VGFncyA9IHtcbiAgICAgIEVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgIFByb2plY3ROYW1lOiBwcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgIENvbXBvbmVudDogJ09wZW5TZWFyY2gnLFxuICAgICAgUHVycG9zZTogJ011bHRpbW9kYWxFbWJlZGRpbmcnLFxuICAgICAgTWFuYWdlZEJ5OiAnQ0RLJyxcbiAgICAgIENvc3RDZW50ZXI6IHByb3BzLmVudmlyb25tZW50ID09PSAncHJvZCcgPyAnUHJvZHVjdGlvbicgOiAnRGV2ZWxvcG1lbnQnLFxuICAgIH07XG5cbiAgICBjb25zdCBhbGxUYWdzID0geyAuLi5kZWZhdWx0VGFncywgLi4ucHJvcHMudGFncyB9O1xuXG4gICAgT2JqZWN0LmVudHJpZXMoYWxsVGFncykuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoa2V5LCB2YWx1ZSk7XG4gICAgfSk7XG4gIH1cbn0iXX0=