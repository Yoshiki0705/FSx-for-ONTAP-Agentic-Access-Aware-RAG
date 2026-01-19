"use strict";
/**
 * OpenSearch Multimodal Embeddingスタック
 *
 * Titan Multimodal Embedding用に最適化されたOpenSearchクラスターをデプロイ
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
exports.OpenSearchMultimodalStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const kms = __importStar(require("aws-cdk-lib/aws-kms"));
const opensearch_multimodal_construct_1 = require("../modules/database/constructs/opensearch-multimodal-construct");
const opensearch_multimodal_config_1 = require("../modules/database/configs/opensearch-multimodal-config");
class OpenSearchMultimodalStack extends cdk.Stack {
    openSearchConstruct;
    vpc;
    kmsKey;
    constructor(scope, id, props) {
        super(scope, id, props);
        // 基本設定取得
        const baseConfig = (0, opensearch_multimodal_config_1.getOpenSearchMultimodalConfig)(props.environment, props.performanceTier);
        // VPC設定
        if (props.useVpc) {
            this.vpc = this.setupVpc(props.existingVpcId);
        }
        // KMS暗号化設定
        if (props.enableKmsEncryption) {
            this.kmsKey = this.createKmsKey();
        }
        // OpenSearchクラスター設定
        const openSearchConfig = {
            ...baseConfig,
            domainName: this.generateDomainName(props.projectName, props.environment),
            networkConfig: {
                ...baseConfig.networkConfig,
                vpcEnabled: props.useVpc || false,
                vpc: this.vpc,
                subnets: this.vpc ? this.vpc.privateSubnets : undefined,
            },
            securityConfig: {
                ...baseConfig.securityConfig,
                kmsKey: this.kmsKey,
            },
            tags: {
                ...baseConfig.tags,
                ...props.tags,
                ProjectName: props.projectName,
                StackName: this.stackName,
            },
        };
        // OpenSearchクラスター作成
        this.openSearchConstruct = new opensearch_multimodal_construct_1.OpenSearchMultimodalConstruct(this, 'OpenSearchMultimodal', openSearchConfig);
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
            description: 'KMS key for OpenSearch multimodal embedding encryption',
            enableKeyRotation: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
    }
    /**
     * ドメイン名生成（28文字以内）
     */
    generateDomainName(projectName, environment) {
        const baseName = `${projectName}-${environment}`;
        const suffix = '-search';
        const maxLength = 28;
        // 長すぎる場合は短縮
        if (baseName.length + suffix.length > maxLength) {
            const availableLength = maxLength - suffix.length;
            const shortBaseName = baseName.substring(0, availableLength);
            return shortBaseName + suffix;
        }
        return baseName + suffix;
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
            value: this.openSearchConstruct.createMultimodalIndex(),
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
    /**
     * インデックス作成用のLambda関数作成（オプション）
     */
    createIndexSetupFunction() {
        // 将来的にインデックス自動作成用のLambda関数を追加可能
        // 現在はマニュアル作成を想定
    }
}
exports.OpenSearchMultimodalStack = OpenSearchMultimodalStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlbnNlYXJjaC1tdWx0aW1vZGFsLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsib3BlbnNlYXJjaC1tdWx0aW1vZGFsLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7OztHQUlHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQyx5REFBMkM7QUFDM0MseURBQTJDO0FBRTNDLG9IQUErRztBQUMvRywyR0FBeUc7QUF5QnpHLE1BQWEseUJBQTBCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDdEMsbUJBQW1CLENBQWdDO0lBQ25ELEdBQUcsQ0FBWTtJQUNmLE1BQU0sQ0FBVztJQUVqQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXFDO1FBQzdFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLFNBQVM7UUFDVCxNQUFNLFVBQVUsR0FBRyxJQUFBLDREQUE2QixFQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBRTNGLFFBQVE7UUFDUixJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNqQixJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQ2hELENBQUM7UUFFRCxXQUFXO1FBQ1gsSUFBSSxLQUFLLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztZQUM5QixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUNwQyxDQUFDO1FBRUQsb0JBQW9CO1FBQ3BCLE1BQU0sZ0JBQWdCLEdBQUc7WUFDdkIsR0FBRyxVQUFVO1lBQ2IsVUFBVSxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUM7WUFDekUsYUFBYSxFQUFFO2dCQUNiLEdB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O1lBQ3ZCLE9BQU8sRUFBRSxxQkFBcUI7WUFDOUIsU0FBUyxFQUFFLEtBQUs7WUFDaEIsVUFBVSxFQUFFLEtBQUssQ0FBQyxXQUFXLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLGFBQWE7U0FDeEUsQ0FBQztRQUVGLE1BQU0sT0FBTyxHQUFHLEVBQUUsR0FBRyxXQUFXLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7UUFFbEQsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFO1lBQy9DLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDcEMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSSx3QkFBd0I7UUFDN0IsZ0NBQWdDO1FBQ2hDLGdCQUFnQjtJQUNsQixDQUFDO0NBQ0Y7QUE1TUQsOERBNE1DIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBPcGVuU2VhcmNoIE11bHRpbW9kYWwgRW1iZWRkaW5n44K544K/44OD44KvXG4gKiBcbiAqIFRpdGFuIE11bHRpbW9kYWwgRW1iZWRkaW5n55So44Gr5pyA6YGp5YyW44GV44KM44GfT3BlblNlYXJjaOOCr+ODqeOCueOCv+ODvOOCkuODh+ODl+ODreOCpFxuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgKiBhcyBrbXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWttcyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IE9wZW5TZWFyY2hNdWx0aW1vZGFsQ29uc3RydWN0IH0gZnJvbSAnLi4vbW9kdWxlcy9kYXRhYmFzZS9jb25zdHJ1Y3RzL29wZW5zZWFyY2gtbXVsdGltb2RhbC1jb25zdHJ1Y3QnO1xuaW1wb3J0IHsgZ2V0T3BlblNlYXJjaE11bHRpbW9kYWxDb25maWcgfSBmcm9tICcuLi9tb2R1bGVzL2RhdGFiYXNlL2NvbmZpZ3Mvb3BlbnNlYXJjaC1tdWx0aW1vZGFsLWNvbmZpZyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgT3BlblNlYXJjaE11bHRpbW9kYWxTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICAvKiog55Kw5aKD5ZCNICovXG4gIHJlYWRvbmx5IGVudmlyb25tZW50OiBzdHJpbmc7XG4gIFxuICAvKiog44OX44Ot44K444Kn44Kv44OI5ZCNICovXG4gIHJlYWRvbmx5IHByb2plY3ROYW1lOiBzdHJpbmc7XG4gIFxuICAvKiog44OR44OV44Kp44O844Oe44Oz44K544OG44Kj44KiICovXG4gIHJlYWRvbmx5IHBlcmZvcm1hbmNlVGllcj86ICdzdGFuZGFyZCcgfCAnaGlnaCc7XG4gIFxuICAvKiogVlBD5L2/55So44OV44Op44KwICovXG4gIHJlYWRvbmx5IHVzZVZwYz86IGJvb2xlYW47XG4gIFxuICAvKiog5pei5a2YVlBDIElEICovXG4gIHJlYWRvbmx5IGV4aXN0aW5nVnBjSWQ/OiBzdHJpbmc7XG4gIFxuICAvKiogS01T5pqX5Y+35YyW5pyJ5Yq55YyWICovXG4gIHJlYWRvbmx5IGVuYWJsZUttc0VuY3J5cHRpb24/OiBib29sZWFuO1xuICBcbiAgLyoqIOOCv+OCsCAqL1xuICByZWFkb25seSB0YWdzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbn1cblxuZXhwb3J0IGNsYXNzIE9wZW5TZWFyY2hNdWx0aW1vZGFsU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgb3BlblNlYXJjaENvbnN0cnVjdDogT3BlblNlYXJjaE11bHRpbW9kYWxDb25zdHJ1Y3Q7XG4gIHB1YmxpYyByZWFkb25seSB2cGM/OiBlYzIuSVZwYztcbiAgcHVibGljIHJlYWRvbmx5IGttc0tleT86IGttcy5LZXk7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IE9wZW5TZWFyY2hNdWx0aW1vZGFsU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8g5Z+65pys6Kit5a6a5Y+W5b6XXG4gICAgY29uc3QgYmFzZUNvbmZpZyA9IGdldE9wZW5TZWFyY2hNdWx0aW1vZGFsQ29uZmlnKHByb3BzLmVudmlyb25tZW50LCBwcm9wcy5wZXJmb3JtYW5jZVRpZXIpO1xuXG4gICAgLy8gVlBD6Kit5a6aXG4gICAgaWYgKHByb3BzLnVzZVZwYykge1xuICAgICAgdGhpcy52cGMgPSB0aGlzLnNldHVwVnBjKHByb3BzLmV4aXN0aW5nVnBjSWQpO1xuICAgIH1cblxuICAgIC8vIEtNU+aal+WPt+WMluioreWumlxuICAgIGlmIChwcm9wcy5lbmFibGVLbXNFbmNyeXB0aW9uKSB7XG4gICAgICB0aGlzLmttc0tleSA9IHRoaXMuY3JlYXRlS21zS2V5KCk7XG4gICAgfVxuXG4gICAgLy8gT3BlblNlYXJjaOOCr+ODqeOCueOCv+ODvOioreWumlxuICAgIGNvbnN0IG9wZW5TZWFyY2hDb25maWcgPSB7XG4gICAgICAuLi5iYXNlQ29uZmlnLFxuICAgICAgZG9tYWluTmFtZTogdGhpcy5nZW5lcmF0ZURvbWFpbk5hbWUocHJvcHMucHJvamVjdE5hbWUsIHByb3BzLmVudmlyb25tZW50KSxcbiAgICAgIG5ldHdvcmtDb25maWc6IHtcbiAgICAgICAgLi4uYmFzZUNvbmZpZy5uZXR3b3JrQ29uZmlnLFxuICAgICAgICB2cGNFbmFibGVkOiBwcm9wcy51c2VWcGMgfHwgZmFsc2UsXG4gICAgICAgIHZwYzogdGhpcy52cGMsXG4gICAgICAgIHN1Ym5ldHM6IHRoaXMudnBjID8gdGhpcy52cGMucHJpdmF0ZVN1Ym5ldHMgOiB1bmRlZmluZWQsXG4gICAgICB9LFxuICAgICAgc2VjdXJpdHlDb25maWc6IHtcbiAgICAgICAgLi4uYmFzZUNvbmZpZy5zZWN1cml0eUNvbmZpZyxcbiAgICAgICAga21zS2V5OiB0aGlzLmttc0tleSxcbiAgICAgIH0sXG4gICAgICB0YWdzOiB7XG4gICAgICAgIC4uLmJhc2VDb25maWcudGFncyxcbiAgICAgICAgLi4ucHJvcHMudGFncyxcbiAgICAgICAgUHJvamVjdE5hbWU6IHByb3BzLnByb2plY3ROYW1lLFxuICAgICAgICBTdGFja05hbWU6IHRoaXMuc3RhY2tOYW1lLFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgLy8gT3BlblNlYXJjaOOCr+ODqeOCueOCv+ODvOS9nOaIkFxuICAgIHRoaXMub3BlblNlYXJjaENvbnN0cnVjdCA9IG5ldyBPcGVuU2VhcmNoTXVsdGltb2RhbENvbnN0cnVjdChcbiAgICAgIHRoaXMsXG4gICAgICAnT3BlblNlYXJjaE11bHRpbW9kYWwnLFxuICAgICAgb3BlblNlYXJjaENvbmZpZ1xuICAgICk7XG5cbiAgICAvLyBDbG91ZEZvcm1hdGlvbuWHuuWKm1xuICAgIHRoaXMuY3JlYXRlT3V0cHV0cygpO1xuXG4gICAgLy8g44K544K/44OD44Kv44Os44OZ44Or44K/44KwXG4gICAgdGhpcy5hcHBseVN0YWNrVGFncyhwcm9wcyk7XG4gIH1cblxuICAvKipcbiAgICogVlBD6Kit5a6aXG4gICAqL1xuICBwcml2YXRlIHNldHVwVnBjKGV4aXN0aW5nVnBjSWQ/OiBzdHJpbmcpOiBlYzIuSVZwYyB7XG4gICAgaWYgKGV4aXN0aW5nVnBjSWQpIHtcbiAgICAgIC8vIOaXouWtmFZQQ+OCkuS9v+eUqFxuICAgICAgcmV0dXJuIGVjMi5WcGMuZnJvbUxvb2t1cCh0aGlzLCAnRXhpc3RpbmdWcGMnLCB7XG4gICAgICAgIHZwY0lkOiBleGlzdGluZ1ZwY0lkLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIOaWsOOBl+OBhFZQQ+OCkuS9nOaIkFxuICAgICAgcmV0dXJuIG5ldyBlYzIuVnBjKHRoaXMsICdPcGVuU2VhcmNoVnBjJywge1xuICAgICAgICBtYXhBenM6IDMsXG4gICAgICAgIG5hdEdhdGV3YXlzOiAxLFxuICAgICAgICBzdWJuZXRDb25maWd1cmF0aW9uOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICAgICAgbmFtZTogJ1B1YmxpYycsXG4gICAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QVUJMSUMsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBjaWRyTWFzazogMjQsXG4gICAgICAgICAgICBuYW1lOiAnUHJpdmF0ZScsXG4gICAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIGVuYWJsZURuc0hvc3RuYW1lczogdHJ1ZSxcbiAgICAgICAgZW5hYmxlRG5zU3VwcG9ydDogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBLTVPjgq3jg7zkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlS21zS2V5KCk6IGttcy5LZXkge1xuICAgIHJldHVybiBuZXcga21zLktleSh0aGlzLCAnT3BlblNlYXJjaEttc0tleScsIHtcbiAgICAgIGRlc2NyaXB0aW9uOiAnS01TIGtleSBmb3IgT3BlblNlYXJjaCBtdWx0aW1vZGFsIGVtYmVkZGluZyBlbmNyeXB0aW9uJyxcbiAgICAgIGVuYWJsZUtleVJvdGF0aW9uOiB0cnVlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg4njg6HjgqTjg7PlkI3nlJ/miJDvvIgyOOaWh+Wtl+S7peWGhe+8iVxuICAgKi9cbiAgcHJpdmF0ZSBnZW5lcmF0ZURvbWFpbk5hbWUocHJvamVjdE5hbWU6IHN0cmluZywgZW52aXJvbm1lbnQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgYmFzZU5hbWUgPSBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH1gO1xuICAgIGNvbnN0IHN1ZmZpeCA9ICctc2VhcmNoJztcbiAgICBjb25zdCBtYXhMZW5ndGggPSAyODtcbiAgICBcbiAgICAvLyDplbfjgZnjgY7jgovloLTlkIjjga/nn63nuK5cbiAgICBpZiAoYmFzZU5hbWUubGVuZ3RoICsgc3VmZml4Lmxlbmd0aCA+IG1heExlbmd0aCkge1xuICAgICAgY29uc3QgYXZhaWxhYmxlTGVuZ3RoID0gbWF4TGVuZ3RoIC0gc3VmZml4Lmxlbmd0aDtcbiAgICAgIGNvbnN0IHNob3J0QmFzZU5hbWUgPSBiYXNlTmFtZS5zdWJzdHJpbmcoMCwgYXZhaWxhYmxlTGVuZ3RoKTtcbiAgICAgIHJldHVybiBzaG9ydEJhc2VOYW1lICsgc3VmZml4O1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gYmFzZU5hbWUgKyBzdWZmaXg7XG4gIH1cblxuICAvKipcbiAgICogQ2xvdWRGb3JtYXRpb27lh7rlipvkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlT3V0cHV0cygpOiB2b2lkIHtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnT3BlblNlYXJjaERvbWFpbkFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLm9wZW5TZWFyY2hDb25zdHJ1Y3Qub3V0cHV0cy5kb21haW5Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ09wZW5TZWFyY2ggZG9tYWluIEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tRG9tYWluQXJuYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdPcGVuU2VhcmNoRG9tYWluRW5kcG9pbnQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5vcGVuU2VhcmNoQ29uc3RydWN0Lm91dHB1dHMuZG9tYWluRW5kcG9pbnQsXG4gICAgICBkZXNjcmlwdGlvbjogJ09wZW5TZWFyY2ggZG9tYWluIGVuZHBvaW50JyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Eb21haW5FbmRwb2ludGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnT3BlblNlYXJjaEtpYmFuYUVuZHBvaW50Jywge1xuICAgICAgdmFsdWU6IHRoaXMub3BlblNlYXJjaENvbnN0cnVjdC5vdXRwdXRzLmtpYmFuYUVuZHBvaW50LFxuICAgICAgZGVzY3JpcHRpb246ICdPcGVuU2VhcmNoIEtpYmFuYSBlbmRwb2ludCcsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tS2liYW5hRW5kcG9pbnRgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ09wZW5TZWFyY2hEb21haW5OYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMub3BlblNlYXJjaENvbnN0cnVjdC5vdXRwdXRzLmRvbWFpbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ09wZW5TZWFyY2ggZG9tYWluIG5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LURvbWFpbk5hbWVgLFxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMub3BlblNlYXJjaENvbnN0cnVjdC5vdXRwdXRzLnNlY3VyaXR5R3JvdXBJZCkge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ09wZW5TZWFyY2hTZWN1cml0eUdyb3VwSWQnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLm9wZW5TZWFyY2hDb25zdHJ1Y3Qub3V0cHV0cy5zZWN1cml0eUdyb3VwSWQsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnT3BlblNlYXJjaCBzZWN1cml0eSBncm91cCBJRCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1TZWN1cml0eUdyb3VwSWRgLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMudnBjKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVnBjSWQnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLnZwYy52cGNJZCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdWUEMgSUQnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tVnBjSWRgLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMua21zS2V5KSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnS21zS2V5SWQnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmttc0tleS5rZXlJZCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdLTVMga2V5IElEJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUttc0tleUlkYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFRpdGFuIE11bHRpbW9kYWwgRW1iZWRkaW5n44Kk44Oz44OH44OD44Kv44K544OG44Oz44OX44Os44O844OI5Ye65YqbXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ011bHRpbW9kYWxJbmRleFRlbXBsYXRlJywge1xuICAgICAgdmFsdWU6IHRoaXMub3BlblNlYXJjaENvbnN0cnVjdC5jcmVhdGVNdWx0aW1vZGFsSW5kZXgoKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVGl0YW4gTXVsdGltb2RhbCBFbWJlZGRpbmcgaW5kZXggdGVtcGxhdGUgKEpTT04pJyxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrnjgr/jg4Pjgq/jg6zjg5njg6vjgr/jgrDpgannlKhcbiAgICovXG4gIHByaXZhdGUgYXBwbHlTdGFja1RhZ3MocHJvcHM6IE9wZW5TZWFyY2hNdWx0aW1vZGFsU3RhY2tQcm9wcyk6IHZvaWQge1xuICAgIGNvbnN0IGRlZmF1bHRUYWdzID0ge1xuICAgICAgRW52aXJvbm1lbnQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgUHJvamVjdE5hbWU6IHByb3BzLnByb2plY3ROYW1lLFxuICAgICAgQ29tcG9uZW50OiAnT3BlblNlYXJjaCcsXG4gICAgICBQdXJwb3NlOiAnTXVsdGltb2RhbEVtYmVkZGluZycsXG4gICAgICBNYW5hZ2VkQnk6ICdDREsnLFxuICAgICAgQ29zdENlbnRlcjogcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/ICdQcm9kdWN0aW9uJyA6ICdEZXZlbG9wbWVudCcsXG4gICAgfTtcblxuICAgIGNvbnN0IGFsbFRhZ3MgPSB7IC4uLmRlZmF1bHRUYWdzLCAuLi5wcm9wcy50YWdzIH07XG5cbiAgICBPYmplY3QuZW50cmllcyhhbGxUYWdzKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZChrZXksIHZhbHVlKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgqTjg7Pjg4fjg4Pjgq/jgrnkvZzmiJDnlKjjga5MYW1iZGHplqLmlbDkvZzmiJDvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICovXG4gIHB1YmxpYyBjcmVhdGVJbmRleFNldHVwRnVuY3Rpb24oKTogdm9pZCB7XG4gICAgLy8g5bCG5p2l55qE44Gr44Kk44Oz44OH44OD44Kv44K56Ieq5YuV5L2c5oiQ55So44GuTGFtYmRh6Zai5pWw44KS6L+95Yqg5Y+v6IO9XG4gICAgLy8g54++5Zyo44Gv44Oe44OL44Ol44Ki44Or5L2c5oiQ44KS5oOz5a6aXG4gIH1cbn0iXX0=