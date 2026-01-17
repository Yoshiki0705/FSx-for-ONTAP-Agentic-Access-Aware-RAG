"use strict";
/**
 * シンプル統合スタック
 *
 * 実装済みモジュールのみを使用した統合スタック
 * - SecurityStack: KMS、WAF、CloudTrail、GuardDuty
 * - NetworkingStack: VPC、サブネット、セキュリティグループ
 *
 * @version 1.0.0
 * @author NetApp Japan Technology Team
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
exports.SimpleIntegratedStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const security_stack_1 = require("./security-stack");
const networking_stack_1 = require("./networking-stack");
class SimpleIntegratedStack extends cdk.Stack {
    securityStack;
    networkingStack;
    constructor(scope, id, props) {
        super(scope, id, props);
        // 入力値検証
        this.validateProps(props);
        const { projectName, environment, enableSecurity = true, enableNetworking = true } = props;
        // 1. SecurityStack のデプロイ
        if (enableSecurity) {
            try {
                this.securityStack = new security_stack_1.SecurityStack(this, 'SecurityStack', {
                    config: {
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
                            SecurityLevel: 'Medium',
                            EncryptionRequired: true,
                            ComplianceFramework: 'SOC2',
                            DataClassification: 'Internal',
                        },
                    },
                    projectName,
                    environment,
                });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`SecurityStack の作成に失敗しました: ${errorMessage}`);
            }
        }
        // 2. NetworkingStack のデプロイ
        if (enableNetworking) {
            try {
                this.networkingStack = new networking_stack_1.NetworkingStack(this, 'NetworkingStack', {
                    config: {
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
                    },
                    projectName,
                    environment,
                });
                // SecurityStack への依存関係設定
                if (this.securityStack) {
                    this.networkingStack.addDependency(this.securityStack);
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`NetworkingStack の作成に失敗しました: ${errorMessage}`);
            }
        }
        // CloudFormation出力
        this.createOutputs();
        // スタックレベルのタグ設定
        this.applyStackTags(projectName, environment);
    }
    /**
     * プロパティの検証
     */
    validateProps(props) {
        const { projectName, environment } = props;
        // プロジェクト名の検証
        if (!projectName || typeof projectName !== 'string') {
            throw new Error('プロジェクト名が設定されていません');
        }
        if (projectName.trim().length === 0) {
            throw new Error('プロジェクト名が空文字です');
        }
        if (projectName.length > 50) {
            throw new Error('プロジェクト名は50文字以内で設定してください');
        }
        // 安全な文字のみ許可（英数字、ハイフン、アンダースコア）
        if (!/^[a-zA-Z0-9\-_]+$/.test(projectName)) {
            throw new Error('プロジェクト名に不正な文字が含まれています（英数字、ハイフン、アンダースコアのみ許可）');
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
        // セキュリティ情報
        if (this.securityStack) {
            new cdk.CfnOutput(this, 'KmsKeyId', {
                value: this.securityStack.kmsKey.keyId,
                description: 'KMS Key ID',
                exportName: `${this.stackName}-KmsKeyId`,
            });
            new cdk.CfnOutput(this, 'KmsKeyArn', {
                value: this.securityStack.kmsKey.keyArn,
                description: 'KMS Key ARN',
                exportName: `${this.stackName}-KmsKeyArn`,
            });
            if (this.securityStack.wafWebAcl) {
                new cdk.CfnOutput(this, 'WafWebAclArn', {
                    value: this.securityStack.wafWebAcl.attrArn,
                    description: 'WAF WebACL ARN',
                    exportName: `${this.stackName}-WafWebAclArn`,
                });
            }
        }
        // ネットワーク情報
        if (this.networkingStack) {
            new cdk.CfnOutput(this, 'VpcId', {
                value: this.networkingStack.vpc.vpcId,
                description: 'VPC ID',
                exportName: `${this.stackName}-VpcId`,
            });
            new cdk.CfnOutput(this, 'VpcCidr', {
                value: this.networkingStack.vpc.vpcCidrBlock,
                description: 'VPC CIDR Block',
                exportName: `${this.stackName}-VpcCidr`,
            });
            // サブネット情報
            this.networkingStack.publicSubnets.forEach((subnet, index) => {
                new cdk.CfnOutput(this, `PublicSubnet${index + 1}Id`, {
                    value: subnet.subnetId,
                    description: `Public Subnet ${index + 1} ID`,
                    exportName: `${this.stackName}-PublicSubnet${index + 1}Id`,
                });
            });
            this.networkingStack.privateSubnets.forEach((subnet, index) => {
                new cdk.CfnOutput(this, `PrivateSubnet${index + 1}Id`, {
                    value: subnet.subnetId,
                    description: `Private Subnet ${index + 1} ID`,
                    exportName: `${this.stackName}-PrivateSubnet${index + 1}Id`,
                });
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
        cdk.Tags.of(this).add('Stack', 'SimpleIntegratedStack');
        cdk.Tags.of(this).add('Component', 'Integration');
        cdk.Tags.of(this).add('ManagedBy', 'CDK');
        cdk.Tags.of(this).add('CostCenter', `${sanitizedProjectName}-${sanitizedEnvironment}-integrated`);
        cdk.Tags.of(this).add('CreatedAt', new Date().toISOString().split('T')[0]);
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
     * システム情報の取得
     */
    getSystemInfo() {
        return {
            projectName: this.stackName,
            region: this.region,
            account: this.account,
            enabledStacks: {
                security: !!this.securityStack,
                networking: !!this.networkingStack,
            },
            endpoints: {
                vpc: this.networkingStack?.vpc.vpcId || null,
                kmsKey: this.securityStack?.kmsKey.keyArn || null,
            },
        };
    }
    /**
     * セキュリティ情報の取得
     */
    getSecurityInfo() {
        if (!this.securityStack) {
            return null;
        }
        return {
            kmsKey: this.securityStack.kmsKey,
            wafWebAcl: this.securityStack.wafWebAcl,
        };
    }
    /**
     * ネットワーク情報の取得
     */
    getNetworkingInfo() {
        if (!this.networkingStack) {
            return null;
        }
        return {
            vpc: this.networkingStack.vpc,
            publicSubnets: this.networkingStack.publicSubnets,
            privateSubnets: this.networkingStack.privateSubnets,
            isolatedSubnets: this.networkingStack.isolatedSubnets,
            securityGroups: this.networkingStack.securityGroups,
        };
    }
}
exports.SimpleIntegratedStack = SimpleIntegratedStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2ltcGxlLWludGVncmF0ZWQtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzaW1wbGUtaW50ZWdyYXRlZC1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7OztHQVNHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUVuQyxxREFBaUQ7QUFDakQseURBQXFEO0FBZ0JyRCxNQUFhLHFCQUFzQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ2xDLGFBQWEsQ0FBaUI7SUFDOUIsZUFBZSxDQUFtQjtJQUVsRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWlDO1FBQ3pFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLFFBQVE7UUFDUixJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRTFCLE1BQU0sRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLGNBQWMsR0FBRyxJQUFJLEVBQUUsZ0JBQWdCLEdBQUcsSUFBSSxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRTNGLHlCQUF5QjtRQUN6QixJQUFJLGNBQWMsRUFBRSxDQUFDO1lBQ25CLElBQUksQ0FBQztnQkFDSCxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksOEJBQWEsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO29CQUM5RCxNQUFNLEVBQUU7d0JBQ04sR0FBRyxFQUFFOzRCQUNILGlCQUFpQixFQUFFLElBQUk7NEJBQ3ZCLE9BQU8sRUFBRSxtQkFBbUI7NEJBQzVCLFFBQVEsRUFBRSxpQkFBaUI7eUJBQzVCO3dCQUNELEdBQUcsRUFBRTs0QkFDSCxPQUFPLEVBQUUsSUFBSTs0QkFDYixLQUFLLEVBQUUsVUFBVTs0QkFDakIsS0FBSyxFQUFFO2dDQUNMLHFCQUFxQixFQUFFLElBQUk7Z0NBQzNCLGtCQUFrQixFQUFFLElBQUk7Z0NBQ3hCLFNBQVMsRUFBRSxJQUFJO2dDQUNmLGlCQUFp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RUFBRTtnQkFDYixRQUFRLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhO2dCQUM5QixVQUFVLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlO2FBQ25DO1lBQ0QsU0FBUyxFQUFFO2dCQUNULEdBQUcsRUFBRSxJQUFJLENBQUMsZUFBZSxFQUFFLEdBQUcsQ0FBQyxLQUFLLElBQUksSUFBSTtnQkFDNUMsTUFBTSxFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUUsTUFBTSxDQUFDLE1BQU0sSUFBSSxJQUFJO2FBQ2xEO1NBQ0YsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNJLGVBQWU7UUFDcEIsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUN4QixPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFFRCxPQUFPO1lBQ0wsTUFBTSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTTtZQUNqQyxTQUFTLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTO1NBQ3hDLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSSxpQkFBaUI7UUFDdEIsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUMxQixPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFFRCxPQUFPO1lBQ0wsR0FBRyxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRztZQUM3QixhQUFhLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxhQUFhO1lBQ2pELGNBQWMsRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLGNBQWM7WUFDbkQsZUFBZSxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsZUFBZTtZQUNyRCxjQUFjLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxjQUFjO1NBQ3BELENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFoUkQsc0RBZ1JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiDjgrfjg7Pjg5fjg6vntbHlkIjjgrnjgr/jg4Pjgq9cbiAqIFxuICog5a6f6KOF5riI44G/44Oi44K444Ol44O844Or44Gu44G/44KS5L2/55So44GX44Gf57Wx5ZCI44K544K/44OD44KvXG4gKiAtIFNlY3VyaXR5U3RhY2s6IEtNU+OAgVdBRuOAgUNsb3VkVHJhaWzjgIFHdWFyZER1dHlcbiAqIC0gTmV0d29ya2luZ1N0YWNrOiBWUEPjgIHjgrXjg5bjg43jg4Pjg4jjgIHjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5dcbiAqIFxuICogQHZlcnNpb24gMS4wLjBcbiAqIEBhdXRob3IgTmV0QXBwIEphcGFuIFRlY2hub2xvZ3kgVGVhbVxuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IFNlY3VyaXR5U3RhY2sgfSBmcm9tICcuL3NlY3VyaXR5LXN0YWNrJztcbmltcG9ydCB7IE5ldHdvcmtpbmdTdGFjayB9IGZyb20gJy4vbmV0d29ya2luZy1zdGFjayc7XG5cbi8qKlxuICogU2ltcGxlSW50ZWdyYXRlZFN0YWNrIOOBruODl+ODreODkeODhuOCo1xuICovXG5leHBvcnQgaW50ZXJmYWNlIFNpbXBsZUludGVncmF0ZWRTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICAvKiog44OX44Ot44K444Kn44Kv44OI5ZCN77yINTDmloflrZfku6XlhoXjgIHoi7HmlbDlrZfjg7vjg4/jgqTjg5Xjg7Pjg7vjgqLjg7Pjg4Djg7zjgrnjgrPjgqLjga7jgb/vvIkgKi9cbiAgcHJvamVjdE5hbWU6IHN0cmluZztcbiAgLyoqIOeSsOWig+WQje+8iGRldi9zdGFnaW5nL3Byb2QvdGVzdO+8iSAqL1xuICBlbnZpcm9ubWVudDogJ2RldicgfCAnc3RhZ2luZycgfCAncHJvZCcgfCAndGVzdCc7XG4gIC8qKiDjgrvjgq3jg6Xjg6rjg4bjgqPjgrnjgr/jg4Pjgq/jgpLmnInlirnjgavjgZnjgovjgYvvvIjjg4fjg5Xjgqnjg6vjg4g6IHRydWXvvIkgKi9cbiAgZW5hYmxlU2VjdXJpdHk/OiBib29sZWFuO1xuICAvKiog44ON44OD44OI44Ov44O844Kt44Oz44Kw44K544K/44OD44Kv44KS5pyJ5Yq544Gr44GZ44KL44GL77yI44OH44OV44Kp44Or44OIOiB0cnVl77yJICovXG4gIGVuYWJsZU5ldHdvcmtpbmc/OiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgU2ltcGxlSW50ZWdyYXRlZFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHNlY3VyaXR5U3RhY2s/OiBTZWN1cml0eVN0YWNrO1xuICBwdWJsaWMgcmVhZG9ubHkgbmV0d29ya2luZ1N0YWNrPzogTmV0d29ya2luZ1N0YWNrO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBTaW1wbGVJbnRlZ3JhdGVkU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8g5YWl5Yqb5YCk5qSc6Ki8XG4gICAgdGhpcy52YWxpZGF0ZVByb3BzKHByb3BzKTtcblxuICAgIGNvbnN0IHsgcHJvamVjdE5hbWUsIGVudmlyb25tZW50LCBlbmFibGVTZWN1cml0eSA9IHRydWUsIGVuYWJsZU5ldHdvcmtpbmcgPSB0cnVlIH0gPSBwcm9wcztcblxuICAgIC8vIDEuIFNlY3VyaXR5U3RhY2sg44Gu44OH44OX44Ot44KkXG4gICAgaWYgKGVuYWJsZVNlY3VyaXR5KSB7XG4gICAgICB0cnkge1xuICAgICAgICB0aGlzLnNlY3VyaXR5U3RhY2sgPSBuZXcgU2VjdXJpdHlTdGFjayh0aGlzLCAnU2VjdXJpdHlTdGFjaycsIHtcbiAgICAgICAgY29uZmlnOiB7XG4gICAgICAgICAga21zOiB7XG4gICAgICAgICAgICBlbmFibGVLZXlSb3RhdGlvbjogdHJ1ZSxcbiAgICAgICAgICAgIGtleVNwZWM6ICdTWU1NRVRSSUNfREVGQVVMVCcsXG4gICAgICAgICAgICBrZXlVc2FnZTogJ0VOQ1JZUFRfREVDUllQVCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB3YWY6IHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBzY29wZTogJ1JFR0lPTkFMJyxcbiAgICAgICAgICAgIHJ1bGVzOiB7XG4gICAgICAgICAgICAgIGVuYWJsZUFXU01hbmFnZWRSdWxlczogdHJ1ZSxcbiAgICAgICAgICAgICAgZW5hYmxlUmF0ZUxpbWl0aW5nOiB0cnVlLFxuICAgICAgICAgICAgICByYXRlTGltaXQ6IDIwMDAsXG4gICAgICAgICAgICAgIGVuYWJsZUdlb0Jsb2NraW5nOiBmYWxzZSxcbiAgICAgICAgICAgICAgYmxvY2tlZENvdW50cmllczogW10sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY2xvdWRUcmFpbDoge1xuICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIHMzQnVja2V0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWNsb3VkdHJhaWxgLFxuICAgICAgICAgICAgaW5jbHVkZUdsb2JhbFNlcnZpY2VFdmVudHM6IHRydWUsXG4gICAgICAgICAgICBpc011bHRpUmVnaW9uVHJhaWw6IHRydWUsXG4gICAgICAgICAgICBlbmFibGVMb2dGaWxlVmFsaWRhdGlvbjogdHJ1ZSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRhZ3M6IHtcbiAgICAgICAgICAgIFNlY3VyaXR5TGV2ZWw6ICdNZWRpdW0nLFxuICAgICAgICAgICAgRW5jcnlwdGlvblJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgICAgQ29tcGxpYW5jZUZyYW1ld29yazogJ1NPQzInLFxuICAgICAgICAgICAgRGF0YUNsYXNzaWZpY2F0aW9uOiAnSW50ZXJuYWwnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgICAgcHJvamVjdE5hbWUsXG4gICAgICAgICAgZW52aXJvbm1lbnQsXG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc3QgZXJyb3JNZXNzYWdlID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNlY3VyaXR5U3RhY2sg44Gu5L2c5oiQ44Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yTWVzc2FnZX1gKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyAyLiBOZXR3b3JraW5nU3RhY2sg44Gu44OH44OX44Ot44KkXG4gICAgaWYgKGVuYWJsZU5ldHdvcmtpbmcpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRoaXMubmV0d29ya2luZ1N0YWNrID0gbmV3IE5ldHdvcmtpbmdTdGFjayh0aGlzLCAnTmV0d29ya2luZ1N0YWNrJywge1xuICAgICAgICBjb25maWc6IHtcbiAgICAgICAgICB2cGNDaWRyOiAnMTAuMC4wLjAvMTYnLFxuICAgICAgICAgIG1heEF6czogMyxcbiAgICAgICAgICBlbmFibGVQdWJsaWNTdWJuZXRzOiB0cnVlLFxuICAgICAgICAgIGVuYWJsZVByaXZhdGVTdWJuZXRzOiB0cnVlLFxuICAgICAgICAgIGVuYWJsZUlzb2xhdGVkU3VibmV0czogdHJ1ZSxcbiAgICAgICAgICBlbmFibGVOYXRHYXRld2F5OiB0cnVlLFxuICAgICAgICAgIGVuYWJsZURuc0hvc3RuYW1lczogdHJ1ZSxcbiAgICAgICAgICBlbmFibGVEbnNTdXBwb3J0OiB0cnVlLFxuICAgICAgICAgIGVuYWJsZUZsb3dMb2dzOiB0cnVlLFxuICAgICAgICAgIHZwY0VuZHBvaW50czoge1xuICAgICAgICAgICAgczM6IHRydWUsXG4gICAgICAgICAgICBkeW5hbW9kYjogdHJ1ZSxcbiAgICAgICAgICAgIGxhbWJkYTogdHJ1ZSxcbiAgICAgICAgICAgIG9wZW5zZWFyY2g6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzZWN1cml0eUdyb3Vwczoge1xuICAgICAgICAgICAgd2ViOiB0cnVlLFxuICAgICAgICAgICAgYXBpOiB0cnVlLFxuICAgICAgICAgICAgZGF0YWJhc2U6IHRydWUsXG4gICAgICAgICAgICBsYW1iZGE6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgICBwcm9qZWN0TmFtZSxcbiAgICAgICAgICBlbnZpcm9ubWVudCxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gU2VjdXJpdHlTdGFjayDjgbjjga7kvp3lrZjplqLkv4LoqK3lrppcbiAgICAgICAgaWYgKHRoaXMuc2VjdXJpdHlTdGFjaykge1xuICAgICAgICAgIHRoaXMubmV0d29ya2luZ1N0YWNrLmFkZERlcGVuZGVuY3kodGhpcy5zZWN1cml0eVN0YWNrKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc3QgZXJyb3JNZXNzYWdlID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5ldHdvcmtpbmdTdGFjayDjga7kvZzmiJDjgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3JNZXNzYWdlfWApO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIENsb3VkRm9ybWF0aW9u5Ye65YqbXG4gICAgdGhpcy5jcmVhdGVPdXRwdXRzKCk7XG5cbiAgICAvLyDjgrnjgr/jg4Pjgq/jg6zjg5njg6vjga7jgr/jgrDoqK3lrppcbiAgICB0aGlzLmFwcGx5U3RhY2tUYWdzKHByb2plY3ROYW1lLCBlbnZpcm9ubWVudCk7XG4gIH1cblxuICAvKipcbiAgICog44OX44Ot44OR44OG44Kj44Gu5qSc6Ki8XG4gICAqL1xuICBwcml2YXRlIHZhbGlkYXRlUHJvcHMocHJvcHM6IFNpbXBsZUludGVncmF0ZWRTdGFja1Byb3BzKTogdm9pZCB7XG4gICAgY29uc3QgeyBwcm9qZWN0TmFtZSwgZW52aXJvbm1lbnQgfSA9IHByb3BzO1xuXG4gICAgLy8g44OX44Ot44K444Kn44Kv44OI5ZCN44Gu5qSc6Ki8XG4gICAgaWYgKCFwcm9qZWN0TmFtZSB8fCB0eXBlb2YgcHJvamVjdE5hbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+ODl+ODreOCuOOCp+OCr+ODiOWQjeOBjOioreWumuOBleOCjOOBpuOBhOOBvuOBm+OCkycpO1xuICAgIH1cblxuICAgIGlmIChwcm9qZWN0TmFtZS50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+ODl+ODreOCuOOCp+OCr+ODiOWQjeOBjOepuuaWh+Wtl+OBp+OBmScpO1xuICAgIH1cblxuICAgIGlmIChwcm9qZWN0TmFtZS5sZW5ndGggPiA1MCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCfjg5fjg63jgrjjgqfjgq/jg4jlkI3jga81MOaWh+Wtl+S7peWGheOBp+ioreWumuOBl+OBpuOBj+OBoOOBleOBhCcpO1xuICAgIH1cblxuICAgIC8vIOWuieWFqOOBquaWh+Wtl+OBruOBv+ioseWPr++8iOiLseaVsOWtl+OAgeODj+OCpOODleODs+OAgeOCouODs+ODgOODvOOCueOCs+OCou+8iVxuICAgIGlmICghL15bYS16QS1aMC05XFwtX10rJC8udGVzdChwcm9qZWN0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcign44OX44Ot44K444Kn44Kv44OI5ZCN44Gr5LiN5q2j44Gq5paH5a2X44GM5ZCr44G+44KM44Gm44GE44G+44GZ77yI6Iux5pWw5a2X44CB44OP44Kk44OV44Oz44CB44Ki44Oz44OA44O844K544Kz44Ki44Gu44G/6Kix5Y+v77yJJyk7XG4gICAgfVxuXG4gICAgLy8g55Kw5aKD5ZCN44Gu5qSc6Ki8XG4gICAgY29uc3QgdmFsaWRFbnZpcm9ubWVudHMgPSBbJ2RldicsICdzdGFnaW5nJywgJ3Byb2QnLCAndGVzdCddO1xuICAgIGlmICghdmFsaWRFbnZpcm9ubWVudHMuaW5jbHVkZXMoZW52aXJvbm1lbnQpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYOeSsOWig+WQjeOBr+asoeOBruOBhOOBmuOCjOOBi+OCkuaMh+WumuOBl+OBpuOBj+OBoOOBleOBhDogJHt2YWxpZEVudmlyb25tZW50cy5qb2luKCcsICcpfWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDbG91ZEZvcm1hdGlvbuWHuuWKm+OBruS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVPdXRwdXRzKCk6IHZvaWQge1xuICAgIC8vIOOCu+OCreODpeODquODhuOCo+aDheWgsVxuICAgIGlmICh0aGlzLnNlY3VyaXR5U3RhY2spIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdLbXNLZXlJZCcsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuc2VjdXJpdHlTdGFjay5rbXNLZXkua2V5SWQsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnS01TIEtleSBJRCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1LbXNLZXlJZGAsXG4gICAgICB9KTtcblxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0ttc0tleUFybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuc2VjdXJpdHlTdGFjay5rbXNLZXkua2V5QXJuLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0tNUyBLZXkgQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUttc0tleUFybmAsXG4gICAgICB9KTtcblxuICAgICAgaWYgKHRoaXMuc2VjdXJpdHlTdGFjay53YWZXZWJBY2wpIHtcbiAgICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dhZldlYkFjbEFybicsIHtcbiAgICAgICAgICB2YWx1ZTogdGhpcy5zZWN1cml0eVN0YWNrLndhZldlYkFjbC5hdHRyQXJuLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnV0FGIFdlYkFDTCBBUk4nLFxuICAgICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1XYWZXZWJBY2xBcm5gLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyDjg43jg4Pjg4jjg6/jg7zjgq/mg4XloLFcbiAgICBpZiAodGhpcy5uZXR3b3JraW5nU3RhY2spIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWcGNJZCcsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMubmV0d29ya2luZ1N0YWNrLnZwYy52cGNJZCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdWUEMgSUQnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tVnBjSWRgLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWcGNDaWRyJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5uZXR3b3JraW5nU3RhY2sudnBjLnZwY0NpZHJCbG9jayxcbiAgICAgICAgZGVzY3JpcHRpb246ICdWUEMgQ0lEUiBCbG9jaycsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1WcGNDaWRyYCxcbiAgICAgIH0pO1xuXG4gICAgICAvLyDjgrXjg5bjg43jg4Pjg4jmg4XloLFcbiAgICAgIHRoaXMubmV0d29ya2luZ1N0YWNrLnB1YmxpY1N1Ym5ldHMuZm9yRWFjaCgoc3VibmV0LCBpbmRleCkgPT4ge1xuICAgICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgUHVibGljU3VibmV0JHtpbmRleCArIDF9SWRgLCB7XG4gICAgICAgICAgdmFsdWU6IHN1Ym5ldC5zdWJuZXRJZCxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogYFB1YmxpYyBTdWJuZXQgJHtpbmRleCArIDF9IElEYCxcbiAgICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tUHVibGljU3VibmV0JHtpbmRleCArIDF9SWRgLFxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLm5ldHdvcmtpbmdTdGFjay5wcml2YXRlU3VibmV0cy5mb3JFYWNoKChzdWJuZXQsIGluZGV4KSA9PiB7XG4gICAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBQcml2YXRlU3VibmV0JHtpbmRleCArIDF9SWRgLCB7XG4gICAgICAgICAgdmFsdWU6IHN1Ym5ldC5zdWJuZXRJZCxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogYFByaXZhdGUgU3VibmV0ICR7aW5kZXggKyAxfSBJRGAsXG4gICAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVByaXZhdGVTdWJuZXQke2luZGV4ICsgMX1JZGAsXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOOCueOCv+ODg+OCr+ODrOODmeODq+OBruOCv+OCsOioreWumlxuICAgKi9cbiAgcHJpdmF0ZSBhcHBseVN0YWNrVGFncyhwcm9qZWN0TmFtZTogc3RyaW5nLCBlbnZpcm9ubWVudDogc3RyaW5nKTogdm9pZCB7XG4gICAgLy8g44K/44Kw5YCk44Gu44K144OL44K/44Kk44K677yI44K744Kt44Ol44Oq44OG44Kj5a++562W77yJXG4gICAgY29uc3Qgc2FuaXRpemVkUHJvamVjdE5hbWUgPSB0aGlzLnNhbml0aXplVGFnVmFsdWUocHJvamVjdE5hbWUpO1xuICAgIGNvbnN0IHNhbml0aXplZEVudmlyb25tZW50ID0gdGhpcy5zYW5pdGl6ZVRhZ1ZhbHVlKGVudmlyb25tZW50KTtcbiAgICBcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1Byb2plY3QnLCBzYW5pdGl6ZWRQcm9qZWN0TmFtZSk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdFbnZpcm9ubWVudCcsIHNhbml0aXplZEVudmlyb25tZW50KTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1N0YWNrJywgJ1NpbXBsZUludGVncmF0ZWRTdGFjaycpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQ29tcG9uZW50JywgJ0ludGVncmF0aW9uJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdNYW5hZ2VkQnknLCAnQ0RLJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdDb3N0Q2VudGVyJywgYCR7c2FuaXRpemVkUHJvamVjdE5hbWV9LSR7c2FuaXRpemVkRW52aXJvbm1lbnR9LWludGVncmF0ZWRgKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0NyZWF0ZWRBdCcsIG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zcGxpdCgnVCcpWzBdKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgr/jgrDlgKTjga7jgrXjg4vjgr/jgqTjgrpcbiAgICovXG4gIHByaXZhdGUgc2FuaXRpemVUYWdWYWx1ZSh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAvLyDkuI3mraPjgarmloflrZfjgpLpmaTljrvjgZfjgIHplbfjgZXjgpLliLbpmZBcbiAgICByZXR1cm4gdmFsdWVcbiAgICAgIC5yZXBsYWNlKC9bPD5cXFwiJyZdL2csICcnKSAvLyBYU1Plr77nrZZcbiAgICAgIC5zdWJzdHJpbmcoMCwgMjU2KSAvLyBBV1Mg44K/44Kw5YCk44Gu5pyA5aSn6ZW35Yi26ZmQXG4gICAgICAudHJpbSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCt+OCueODhuODoOaDheWgseOBruWPluW+l1xuICAgKi9cbiAgcHVibGljIGdldFN5c3RlbUluZm8oKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHByb2plY3ROYW1lOiB0aGlzLnN0YWNrTmFtZSxcbiAgICAgIHJlZ2lvbjogdGhpcy5yZWdpb24sXG4gICAgICBhY2NvdW50OiB0aGlzLmFjY291bnQsXG4gICAgICBlbmFibGVkU3RhY2tzOiB7XG4gICAgICAgIHNlY3VyaXR5OiAhIXRoaXMuc2VjdXJpdHlTdGFjayxcbiAgICAgICAgbmV0d29ya2luZzogISF0aGlzLm5ldHdvcmtpbmdTdGFjayxcbiAgICAgIH0sXG4gICAgICBlbmRwb2ludHM6IHtcbiAgICAgICAgdnBjOiB0aGlzLm5ldHdvcmtpbmdTdGFjaz8udnBjLnZwY0lkIHx8IG51bGwsXG4gICAgICAgIGttc0tleTogdGhpcy5zZWN1cml0eVN0YWNrPy5rbXNLZXkua2V5QXJuIHx8IG51bGwsXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog44K744Kt44Ol44Oq44OG44Kj5oOF5aCx44Gu5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgZ2V0U2VjdXJpdHlJbmZvKCkge1xuICAgIGlmICghdGhpcy5zZWN1cml0eVN0YWNrKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAga21zS2V5OiB0aGlzLnNlY3VyaXR5U3RhY2sua21zS2V5LFxuICAgICAgd2FmV2ViQWNsOiB0aGlzLnNlY3VyaXR5U3RhY2sud2FmV2ViQWNsLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog44ON44OD44OI44Ov44O844Kv5oOF5aCx44Gu5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgZ2V0TmV0d29ya2luZ0luZm8oKSB7XG4gICAgaWYgKCF0aGlzLm5ldHdvcmtpbmdTdGFjaykge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHZwYzogdGhpcy5uZXR3b3JraW5nU3RhY2sudnBjLFxuICAgICAgcHVibGljU3VibmV0czogdGhpcy5uZXR3b3JraW5nU3RhY2sucHVibGljU3VibmV0cyxcbiAgICAgIHByaXZhdGVTdWJuZXRzOiB0aGlzLm5ldHdvcmtpbmdTdGFjay5wcml2YXRlU3VibmV0cyxcbiAgICAgIGlzb2xhdGVkU3VibmV0czogdGhpcy5uZXR3b3JraW5nU3RhY2suaXNvbGF0ZWRTdWJuZXRzLFxuICAgICAgc2VjdXJpdHlHcm91cHM6IHRoaXMubmV0d29ya2luZ1N0YWNrLnNlY3VyaXR5R3JvdXBzLFxuICAgIH07XG4gIH1cbn0iXX0=