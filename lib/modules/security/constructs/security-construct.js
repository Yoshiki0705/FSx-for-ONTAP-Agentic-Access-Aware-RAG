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
        // 注: GuardDutyは既にアカウントレベルで有効化されているため、
        // 新しいDetectorを作成せず、既存のDetectorを使用します。
        // AWSアカウントには1つのGuardDuty Detectorしか存在できません。
        // 既存Detector ID: febec3337a92143ed91b9956114465c9
        /*
        if (config.guardDuty.enabled) {
          this.guardDutyDetector = new guardduty.CfnDetector(this, 'GuardDutyDetector', {
            enable: true,
            findingPublishingFrequency: config.guardDuty.findingPublishingFrequency
          });
        }
        */
        console.log('SecurityConstruct initialized (complete)');
    }
}
exports.SecurityConstruct = SecurityConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJpdHktY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VjdXJpdHktY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsMkNBQXVDO0FBQ3ZDLGlEQUFtQztBQUNuQyx5REFBMkM7QUFDM0MsNkRBQStDO0FBZS9DLE1BQWEsaUJBQWtCLFNBQVEsc0JBQVM7SUFDOUIsTUFBTSxDQUFVO0lBQ2hCLFNBQVMsQ0FBbUI7SUFDNUIsaUJBQWlCLENBQXlCO0lBQzFDLFVBQVUsQ0FBb0I7SUFFOUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE2QjtRQUNyRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLE1BQU0sRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxHQUFHLEtBQUssQ0FBQztRQUVuRCxjQUFjO1FBQ2QsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRTtZQUN4QyxpQkFBaUIsRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLFdBQVc7WUFDekMsV0FBVyxFQUFFLGVBQWUsV0FBVyxJQUFJLHNCQUFzQixJQUFJLFdBQVcsSUFBSSxNQUFNLEVBQUU7WUFDNUYsS0FBSyxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSztZQUN2QixhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxNQUFNO1lBQ3ZDLGFBQWEsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLGFBQWEsSUFBSSxFQUFFLENBQUM7U0FDakUsQ0FBQyxDQUFDO1FBRUgsc0JBQXNCO1FBQ3RCLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN2QixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFO2dCQUNuRCxLQUFLLEVBQUUsVUFBVTtnQkFDakIsYUFBYSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRTtnQkFDNUIsZ0JBQWdCLEVBQUU7b0JBQ2hCLHdCQUF3QixFQUFFLElBQUk7b0JBQzlCLFVBQVUsRUFBRSxHQUFHLFdBQVcsSUFBSSxLQUFLLGNBQWM7b0JBQ2pELHNCQUFzQixFQUFFLElBQUk7aUJBQzdCO2dCQUNELEtBQUssRUFBRTtvQkFDTDt3QkFDRSxJQUFJLEVBQUUsa0NBQWtDO3dCQUN4QyxRQUFRLEVBQUUsQ0FBQzt3QkFDWCxTQUFTLEVBQUU7NEJBQ1QseUJBQXlCLEVBQUU7Z0NBQ3pCLFVBQVUsRUFBRSxLQUFLO2dDQUNqQixJQUFJLEVBQUUsOEJBQThCOzZCQUNyQzt5QkFDRjt3QkFDRCxjQUFjLEVBQUUsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFO3dCQUM1QixnQkFBZ0IsRUFBRTs0QkFDaEIsd0JBQXdCLEVBQUUsSUFBSTs0QkFDOUIsVUFBVSxFQUFFLG9DQUFvQzs0QkFDaEQsc0JBQXNCLEVBQUUsSUFBSTt5QkFDN0I7cUJBQ0Y7b0JBQ0Q7d0JBQ0UsSUFBSSxFQUFFLGVBQWU7d0JBQ3JCLFFBQVEsRUFBRSxDQUFDO3dCQUNYLFNBQVMsRUFBRTs0QkFDVCxrQkFBa0IsRUFBRTtnQ0FDbEIsS0FBSyxFQUFFLElBQUk7Z0NBQ1gsZ0JBQWdCLEVBQUUsSUFBSTs2QkFDdkI7eUJBQ0Y7d0JBQ0QsTUFBTSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRTt3QkFDckIsZ0JBQWdCLEVBQUU7NEJBQ2hCLHdCQUF3QixFQUFFLElBQUk7NEJBQzlCLFVBQVUsRUFBRSxxQkFBcUI7NEJBQ2pDLHNCQUFzQixFQUFFLElBQUk7eUJBQzdCO3FCQUNGO2lCQUNGO2FBQ0YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELDhCQUE4QjtRQUM5QixzQ0FBc0M7UUFDdEMsc0NBQXNDO1FBQ3RDLDRDQUE0QztRQUM1QyxrREFBa0Q7UUFDbEQ7Ozs7Ozs7VUFPRTtRQUVGLE9BQU8sQ0FBQyxHQUFHLENBQUMsMENBQTBDLENBQUMsQ0FBQztJQUMxRCxDQUFDO0NBQ0Y7QUFuRkQsOENBbUZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMga21zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1rbXMnO1xuaW1wb3J0ICogYXMgd2FmdjIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXdhZnYyJztcbmltcG9ydCAqIGFzIGd1YXJkZHV0eSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZ3VhcmRkdXR5JztcbmltcG9ydCAqIGFzIGNsb3VkdHJhaWwgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkdHJhaWwnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0IHsgU2VjdXJpdHlDb25maWcgfSBmcm9tICcuLi9pbnRlcmZhY2VzL3NlY3VyaXR5LWNvbmZpZyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2VjdXJpdHlDb25zdHJ1Y3RQcm9wcyB7XG4gIGNvbmZpZzogU2VjdXJpdHlDb25maWc7XG4gIHByb2plY3ROYW1lPzogc3RyaW5nO1xuICBlbnZpcm9ubWVudD86IHN0cmluZztcbiAgdnBjPzogYW55O1xuICBwcml2YXRlU3VibmV0SWRzPzogc3RyaW5nW107XG4gIG5hbWluZ0dlbmVyYXRvcj86IGFueTtcbn1cblxuZXhwb3J0IGNsYXNzIFNlY3VyaXR5Q29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IGttc0tleToga21zLktleTtcbiAgcHVibGljIHJlYWRvbmx5IHdhZldlYkFjbD86IHdhZnYyLkNmbldlYkFDTDtcbiAgcHVibGljIHJlYWRvbmx5IGd1YXJkRHV0eURldGVjdG9yPzogZ3VhcmRkdXR5LkNmbkRldGVjdG9yO1xuICBwdWJsaWMgcmVhZG9ubHkgY2xvdWRUcmFpbD86IGNsb3VkdHJhaWwuVHJhaWw7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFNlY3VyaXR5Q29uc3RydWN0UHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuICAgIFxuICAgIGNvbnN0IHsgY29uZmlnLCBwcm9qZWN0TmFtZSwgZW52aXJvbm1lbnQgfSA9IHByb3BzO1xuICAgIFxuICAgIC8vIEtNU+OCreODvOS9nOaIkO+8iOW/hemgiO+8iVxuICAgIHRoaXMua21zS2V5ID0gbmV3IGttcy5LZXkodGhpcywgJ0ttc0tleScsIHtcbiAgICAgIGVuYWJsZUtleVJvdGF0aW9uOiBjb25maWcua21zLmtleVJvdGF0aW9uLFxuICAgICAgZGVzY3JpcHRpb246IGBLTVMga2V5IGZvciAke3Byb2plY3ROYW1lIHx8ICdwZXJtaXNzaW9uLWF3YXJlLXJhZyd9ICR7ZW52aXJvbm1lbnQgfHwgJ3Byb2QnfWAsXG4gICAgICBhbGlhczogY29uZmlnLmttcy5hbGlhcyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgIHBlbmRpbmdXaW5kb3c6IGNkay5EdXJhdGlvbi5kYXlzKGNvbmZpZy5rbXMucGVuZGluZ1dpbmRvdyB8fCAzMClcbiAgICB9KTtcbiAgICBcbiAgICAvLyBXQUYgV2ViQUNM5L2c5oiQ77yI44Kq44OX44K344On44Oz77yJXG4gICAgaWYgKGNvbmZpZy53YWYuZW5hYmxlZCkge1xuICAgICAgdGhpcy53YWZXZWJBY2wgPSBuZXcgd2FmdjIuQ2ZuV2ViQUNMKHRoaXMsICdXZWJBY2wnLCB7XG4gICAgICAgIHNjb3BlOiAnUkVHSU9OQUwnLFxuICAgICAgICBkZWZhdWx0QWN0aW9uOiB7IGFsbG93OiB7fSB9LFxuICAgICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgICAgY2xvdWRXYXRjaE1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgICAgIG1ldHJpY05hbWU6IGAke3Byb2plY3ROYW1lIHx8ICdyYWcnfS13YWYtbWV0cmljc2AsXG4gICAgICAgICAgc2FtcGxlZFJlcXVlc3RzRW5hYmxlZDogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBydWxlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdBV1MtQVdTTWFuYWdlZFJ1bGVzQ29tbW9uUnVsZVNldCcsXG4gICAgICAgICAgICBwcmlvcml0eTogMSxcbiAgICAgICAgICAgIHN0YXRlbWVudDoge1xuICAgICAgICAgICAgICBtYW5hZ2VkUnVsZUdyb3VwU3RhdGVtZW50OiB7XG4gICAgICAgICAgICAgICAgdmVuZG9yTmFtZTogJ0FXUycsXG4gICAgICAgICAgICAgICAgbmFtZTogJ0FXU01hbmFnZWRSdWxlc0NvbW1vblJ1bGVTZXQnXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBvdmVycmlkZUFjdGlvbjogeyBub25lOiB7fSB9LFxuICAgICAgICAgICAgdmlzaWJpbGl0eUNvbmZpZzoge1xuICAgICAgICAgICAgICBjbG91ZFdhdGNoTWV0cmljc0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICAgIG1ldHJpY05hbWU6ICdBV1NNYW5hZ2VkUnVsZXNDb21tb25SdWxlU2V0TWV0cmljJyxcbiAgICAgICAgICAgICAgc2FtcGxlZFJlcXVlc3RzRW5hYmxlZDogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ1JhdGVMaW1pdFJ1bGUnLFxuICAgICAgICAgICAgcHJpb3JpdHk6IDIsXG4gICAgICAgICAgICBzdGF0ZW1lbnQ6IHtcbiAgICAgICAgICAgICAgcmF0ZUJhc2VkU3RhdGVtZW50OiB7XG4gICAgICAgICAgICAgICAgbGltaXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgYWdncmVnYXRlS2V5VHlwZTogJ0lQJ1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYWN0aW9uOiB7IGJsb2NrOiB7fSB9LFxuICAgICAgICAgICAgdmlzaWJpbGl0eUNvbmZpZzoge1xuICAgICAgICAgICAgICBjbG91ZFdhdGNoTWV0cmljc0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICAgIG1ldHJpY05hbWU6ICdSYXRlTGltaXRSdWxlTWV0cmljJyxcbiAgICAgICAgICAgICAgc2FtcGxlZFJlcXVlc3RzRW5hYmxlZDogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIEd1YXJkRHV0eSBEZXRlY3RvcuS9nOaIkO+8iOOCquODl+OCt+ODp+ODs++8iVxuICAgIC8vIOazqDogR3VhcmREdXR544Gv5pei44Gr44Ki44Kr44Km44Oz44OI44Os44OZ44Or44Gn5pyJ5Yq55YyW44GV44KM44Gm44GE44KL44Gf44KB44CBXG4gICAgLy8g5paw44GX44GERGV0ZWN0b3LjgpLkvZzmiJDjgZvjgZrjgIHml6LlrZjjga5EZXRlY3RvcuOCkuS9v+eUqOOBl+OBvuOBmeOAglxuICAgIC8vIEFXU+OCouOCq+OCpuODs+ODiOOBq+OBrzHjgaTjga5HdWFyZER1dHkgRGV0ZWN0b3LjgZfjgYvlrZjlnKjjgafjgY3jgb7jgZvjgpPjgIJcbiAgICAvLyDml6LlrZhEZXRlY3RvciBJRDogZmViZWMzMzM3YTkyMTQzZWQ5MWI5OTU2MTE0NDY1YzlcbiAgICAvKlxuICAgIGlmIChjb25maWcuZ3VhcmREdXR5LmVuYWJsZWQpIHtcbiAgICAgIHRoaXMuZ3VhcmREdXR5RGV0ZWN0b3IgPSBuZXcgZ3VhcmRkdXR5LkNmbkRldGVjdG9yKHRoaXMsICdHdWFyZER1dHlEZXRlY3RvcicsIHtcbiAgICAgICAgZW5hYmxlOiB0cnVlLFxuICAgICAgICBmaW5kaW5nUHVibGlzaGluZ0ZyZXF1ZW5jeTogY29uZmlnLmd1YXJkRHV0eS5maW5kaW5nUHVibGlzaGluZ0ZyZXF1ZW5jeVxuICAgICAgfSk7XG4gICAgfVxuICAgICovXG4gICAgXG4gICAgY29uc29sZS5sb2coJ1NlY3VyaXR5Q29uc3RydWN0IGluaXRpYWxpemVkIChjb21wbGV0ZSknKTtcbiAgfVxufVxuIl19