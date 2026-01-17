"use strict";
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
exports.SecurityConstruct = void 0;
const constructs_1 = require("constructs");
const cdk = __importStar(require("aws-cdk-lib"));
const kms = __importStar(require("aws-cdk-lib/aws-kms"));
const wafv2 = __importStar(require("aws-cdk-lib/aws-wafv2"));
const guardduty = __importStar(require("aws-cdk-lib/aws-guardduty"));
class SecurityConstruct extends constructs_1.Construct {
    kmsKey;
    wafWebAcl;
    guardDutyDetector;
    cloudTrail;
    constructor(scope, id, props) {
        super(scope, id);
        const { config, projectName, environment } = props;
        // KMSキー作成（必須）
        this.kmsKey = new kms.Key(this, 'KmsKey', {
            enableKeyRotation: config.kms.keyRotation,
            description: `KMS key for ${projectName || 'permission-aware-rag'} ${environment || 'prod'}`,
            alias: config.kms.alias,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pendingWindow: cdk.Duration.days(config.kms.pendingWindow || 30)
        });
        // WAF WebACL作成（オプション）
        if (config.waf.enabled) {
            this.wafWebAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
                scope: 'REGIONAL',
                defaultAction: { allow: {} },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: `${projectName || 'rag'}-waf-metrics`,
                    sampledRequestsEnabled: true
                },
                rules: [
                    {
                        name: 'AWS-AWSManagedRulesCommonRuleSet',
                        priority: 1,
                        statement: {
                            managedRuleGroupStatement: {
                                vendorName: 'AWS',
                                name: 'AWSManagedRulesCommonRuleSet'
                            }
                        },
                        overrideAction: { none: {} },
                        visibilityConfig: {
                            cloudWatchMetricsEnabled: true,
                            metricName: 'AWSManagedRulesCommonRuleSetMetric',
                            sampledRequestsEnabled: true
                        }
                    },
                    {
                        name: 'RateLimitRule',
                        priority: 2,
                        statement: {
                            rateBasedStatement: {
                                limit: 2000,
                                aggregateKeyType: 'IP'
                            }
                        },
                        action: { block: {} },
                        visibilityConfig: {
                            cloudWatchMetricsEnabled: true,
                            metricName: 'RateLimitRuleMetric',
                            sampledRequestsEnabled: true
                        }
                    }
                ]
            });
        }
        // GuardDuty Detector作成（オプション）
        if (config.guardDuty.enabled) {
            this.guardDutyDetector = new guardduty.CfnDetector(this, 'GuardDutyDetector', {
                enable: true,
                findingPublishingFrequency: config.guardDuty.findingPublishingFrequency
            });
        }
        console.log('SecurityConstruct initialized (complete)');
    }
}
exports.SecurityConstruct = SecurityConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJpdHktY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VjdXJpdHktY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsMkNBQXVDO0FBQ3ZDLGlEQUFtQztBQUNuQyx5REFBMkM7QUFDM0MsNkRBQStDO0FBQy9DLHFFQUF1RDtBQWN2RCxNQUFhLGlCQUFrQixTQUFRLHNCQUFTO0lBQzlCLE1BQU0sQ0FBVTtJQUNoQixTQUFTLENBQW1CO0lBQzVCLGlCQUFpQixDQUF5QjtJQUMxQyxVQUFVLENBQW9CO0lBRTlDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBNkI7UUFDckUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixNQUFNLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFbkQsY0FBYztRQUNkLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUU7WUFDeEMsaUJBQWlCLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxXQUFXO1lBQ3pDLFdBQVcsRUFBRSxlQUFlLFdBQVcsSUFBSSxzQkFBc0IsSUFBSSxXQUFXLElBQUksTUFBTSxFQUFFO1lBQzVGLEtBQUssRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUs7WUFDdkIsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtZQUN2QyxhQUFhLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxhQUFhLElBQUksRUFBRSxDQUFDO1NBQ2pFLENBQUMsQ0FBQztRQUVILHNCQUFzQjtRQUN0QixJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDdkIsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRTtnQkFDbkQsS0FBSyxFQUFFLFVBQVU7Z0JBQ2pCLGFBQWEsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUU7Z0JBQzVCLGdCQUFnQixFQUFFO29CQUNoQix3QkFBd0IsRUFBRSxJQUFJO29CQUM5QixVQUFVLEVBQUUsR0FBRyxXQUFXLElBQUksS0FBSyxjQUFjO29CQUNqRCxzQkFBc0IsRUFBRSxJQUFJO2lCQUM3QjtnQkFDRCxLQUFLLEVBQUU7b0JBQ0w7d0JBQ0UsSUFBSSxFQUFFLGtDQUFrQzt3QkFDeEMsUUFBUSxFQUFFLENBQUM7d0JBQ1gsU0FBUyxFQUFFOzRCQUNULHlCQUF5QixFQUFFO2dDQUN6QixVQUFVLEVBQUUsS0FBSztnQ0FDakIsSUFBSSxFQUFFLDhCQUE4Qjs2QkFDckM7eUJBQ0Y7d0JBQ0QsY0FBYyxFQUFFLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRTt3QkFDNUIsZ0JBQWdCLEVBQUU7NEJBQ2hCLHdCQUF3QixFQUFFLElBQUk7NEJBQzlCLFVBQVUsRUFBRSxvQ0FBb0M7NEJBQ2hELHNCQUFzQixFQUFFLElBQUk7eUJBQzdCO3FCQUNGO29CQUNEO3dCQUNFLElBQUksRUFBRSxlQUFlO3dCQUNyQixRQUFRLEVBQUUsQ0FBQzt3QkFDWCxTQUFTLEVBQUU7NEJBQ1Qsa0JBQWtCLEVBQUU7Z0NBQ2xCLEtBQUssRUFBRSxJQUFJO2dDQUNYLGdCQUFnQixFQUFFLElBQUk7NkJBQ3ZCO3lCQUNGO3dCQUNELE1BQU0sRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUU7d0JBQ3JCLGdCQUFnQixFQUFFOzRCQUNoQix3QkFBd0IsRUFBRSxJQUFJOzRCQUM5QixVQUFVLEVBQUUscUJBQXFCOzRCQUNqQyxzQkFBc0IsRUFBRSxJQUFJO3lCQUM3QjtxQkFDRjtpQkFDRjthQUNGLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCw4QkFBOEI7UUFDOUIsSUFBSSxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQzdCLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLFNBQVMsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO2dCQUM1RSxNQUFNLEVBQUUsSUFBSTtnQkFDWiwwQkFBMEIsRUFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLDBCQUEwQjthQUN4RSxDQUFDLENBQUM7UUFDTCxDQUFDO1FBRUQsT0FBTyxDQUFDLEdBQUcsQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO0lBQzFELENBQUM7Q0FDRjtBQTdFRCw4Q0E2RUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBrbXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWttcyc7XG5pbXBvcnQgKiBhcyB3YWZ2MiBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtd2FmdjInO1xuaW1wb3J0ICogYXMgZ3VhcmRkdXR5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1ndWFyZGR1dHknO1xuaW1wb3J0ICogYXMgY2xvdWR0cmFpbCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR0cmFpbCc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBTZWN1cml0eUNvbmZpZyB9IGZyb20gJy4uL2ludGVyZmFjZXMvc2VjdXJpdHktY29uZmlnJztcblxuZXhwb3J0IGludGVyZmFjZSBTZWN1cml0eUNvbnN0cnVjdFByb3BzIHtcbiAgY29uZmlnOiBTZWN1cml0eUNvbmZpZztcbiAgcHJvamVjdE5hbWU/OiBzdHJpbmc7XG4gIGVudmlyb25tZW50Pzogc3RyaW5nO1xuICB2cGM/OiBhbnk7XG4gIHByaXZhdGVTdWJuZXRJZHM/OiBzdHJpbmdbXTtcbiAgbmFtaW5nR2VuZXJhdG9yPzogYW55O1xufVxuXG5leHBvcnQgY2xhc3MgU2VjdXJpdHlDb25zdHJ1Y3QgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkga21zS2V5OiBrbXMuS2V5O1xuICBwdWJsaWMgcmVhZG9ubHkgd2FmV2ViQWNsPzogd2FmdjIuQ2ZuV2ViQUNMO1xuICBwdWJsaWMgcmVhZG9ubHkgZ3VhcmREdXR5RGV0ZWN0b3I/OiBndWFyZGR1dHkuQ2ZuRGV0ZWN0b3I7XG4gIHB1YmxpYyByZWFkb25seSBjbG91ZFRyYWlsPzogY2xvdWR0cmFpbC5UcmFpbDtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogU2VjdXJpdHlDb25zdHJ1Y3RQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG4gICAgXG4gICAgY29uc3QgeyBjb25maWcsIHByb2plY3ROYW1lLCBlbnZpcm9ubWVudCB9ID0gcHJvcHM7XG4gICAgXG4gICAgLy8gS01T44Kt44O85L2c5oiQ77yI5b+F6aCI77yJXG4gICAgdGhpcy5rbXNLZXkgPSBuZXcga21zLktleSh0aGlzLCAnS21zS2V5Jywge1xuICAgICAgZW5hYmxlS2V5Um90YXRpb246IGNvbmZpZy5rbXMua2V5Um90YXRpb24sXG4gICAgICBkZXNjcmlwdGlvbjogYEtNUyBrZXkgZm9yICR7cHJvamVjdE5hbWUgfHwgJ3Blcm1pc3Npb24tYXdhcmUtcmFnJ30gJHtlbnZpcm9ubWVudCB8fCAncHJvZCd9YCxcbiAgICAgIGFsaWFzOiBjb25maWcua21zLmFsaWFzLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgcGVuZGluZ1dpbmRvdzogY2RrLkR1cmF0aW9uLmRheXMoY29uZmlnLmttcy5wZW5kaW5nV2luZG93IHx8IDMwKVxuICAgIH0pO1xuICAgIFxuICAgIC8vIFdBRiBXZWJBQ0zkvZzmiJDvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICBpZiAoY29uZmlnLndhZi5lbmFibGVkKSB7XG4gICAgICB0aGlzLndhZldlYkFjbCA9IG5ldyB3YWZ2Mi5DZm5XZWJBQ0wodGhpcywgJ1dlYkFjbCcsIHtcbiAgICAgICAgc2NvcGU6ICdSRUdJT05BTCcsXG4gICAgICAgIGRlZmF1bHRBY3Rpb246IHsgYWxsb3c6IHt9IH0sXG4gICAgICAgIHZpc2liaWxpdHlDb25maWc6IHtcbiAgICAgICAgICBjbG91ZFdhdGNoTWV0cmljc0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgbWV0cmljTmFtZTogYCR7cHJvamVjdE5hbWUgfHwgJ3JhZyd9LXdhZi1tZXRyaWNzYCxcbiAgICAgICAgICBzYW1wbGVkUmVxdWVzdHNFbmFibGVkOiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIHJ1bGVzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ0FXUy1BV1NNYW5hZ2VkUnVsZXNDb21tb25SdWxlU2V0JyxcbiAgICAgICAgICAgIHByaW9yaXR5OiAxLFxuICAgICAgICAgICAgc3RhdGVtZW50OiB7XG4gICAgICAgICAgICAgIG1hbmFnZWRSdWxlR3JvdXBTdGF0ZW1lbnQ6IHtcbiAgICAgICAgICAgICAgICB2ZW5kb3JOYW1lOiAnQVdTJyxcbiAgICAgICAgICAgICAgICBuYW1lOiAnQVdTTWFuYWdlZFJ1bGVzQ29tbW9uUnVsZVNldCdcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG92ZXJyaWRlQWN0aW9uOiB7IG5vbmU6IHt9IH0sXG4gICAgICAgICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgICAgICAgIGNsb3VkV2F0Y2hNZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ0FXU01hbmFnZWRSdWxlc0NvbW1vblJ1bGVTZXRNZXRyaWMnLFxuICAgICAgICAgICAgICBzYW1wbGVkUmVxdWVzdHNFbmFibGVkOiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnUmF0ZUxpbWl0UnVsZScsXG4gICAgICAgICAgICBwcmlvcml0eTogMixcbiAgICAgICAgICAgIHN0YXRlbWVudDoge1xuICAgICAgICAgICAgICByYXRlQmFzZWRTdGF0ZW1lbnQ6IHtcbiAgICAgICAgICAgICAgICBsaW1pdDogMjAwMCxcbiAgICAgICAgICAgICAgICBhZ2dyZWdhdGVLZXlUeXBlOiAnSVAnXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBhY3Rpb246IHsgYmxvY2s6IHt9IH0sXG4gICAgICAgICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgICAgICAgIGNsb3VkV2F0Y2hNZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ1JhdGVMaW1pdFJ1bGVNZXRyaWMnLFxuICAgICAgICAgICAgICBzYW1wbGVkUmVxdWVzdHNFbmFibGVkOiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICBdXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8gR3VhcmREdXR5IERldGVjdG9y5L2c5oiQ77yI44Kq44OX44K344On44Oz77yJXG4gICAgaWYgKGNvbmZpZy5ndWFyZER1dHkuZW5hYmxlZCkge1xuICAgICAgdGhpcy5ndWFyZER1dHlEZXRlY3RvciA9IG5ldyBndWFyZGR1dHkuQ2ZuRGV0ZWN0b3IodGhpcywgJ0d1YXJkRHV0eURldGVjdG9yJywge1xuICAgICAgICBlbmFibGU6IHRydWUsXG4gICAgICAgIGZpbmRpbmdQdWJsaXNoaW5nRnJlcXVlbmN5OiBjb25maWcuZ3VhcmREdXR5LmZpbmRpbmdQdWJsaXNoaW5nRnJlcXVlbmN5XG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgY29uc29sZS5sb2coJ1NlY3VyaXR5Q29uc3RydWN0IGluaXRpYWxpemVkIChjb21wbGV0ZSknKTtcbiAgfVxufVxuIl19