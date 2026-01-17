"use strict";
/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebACLAssociation = exports.WAF = exports.RegionalWaf = void 0;
const lodash_1 = require("lodash");
const aws_wafv2_1 = require("aws-cdk-lib/aws-wafv2");
const constructs_1 = require("constructs");
// For cross regional reference
class RegionalWaf extends constructs_1.Construct {
    webAcl;
    constructor(scope, id, props) {
        super(scope, id);
        let ipset = null;
        const distScope = "REGIONAL";
        if (!(0, lodash_1.isEmpty)(props.allowedIps)) {
            ipset = new aws_wafv2_1.CfnIPSet(this, `${id}-ipset`, {
                addresses: props.allowedIps,
                ipAddressVersion: "IPV4",
                scope: distScope,
                description: "App allowed IPV4",
                name: `${id}-app-ip-list`,
            });
        }
        // AWS WAF
        this.webAcl = new WAF(this, `${id}-WAFv2`, ipset, distScope, props.extraRules);
        if (props.webACLResourceArn) {
            // Create an association, not needed for cloudfront
            new WebACLAssociation(this, `${id}-acl-Association`, {
                resourceArn: props.webACLResourceArn,
                webAclArn: this.webAcl.attrArn,
            });
        }
    }
}
exports.RegionalWaf = RegionalWaf;
// AWS WAF rules
let wafRules = [
    // Rate Filter
    {
        name: "web-rate-filter",
        rule: {
            name: "web-rate-filter",
            priority: 100,
            statement: {
                rateBasedStatement: {
                    limit: 3000,
                    aggregateKeyType: "IP",
                },
            },
            action: {
                block: {},
            },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: "web-rate-filter",
            },
        },
    },
    // AWS IP Reputation list includes known malicious actors/bots and is regularly updated
    {
        name: "AWS-AWSManagedRulesAmazonIpReputationList",
        rule: {
            name: "AWS-AWSManagedRulesAmazonIpReputationList",
            priority: 200,
            statement: {
                managedRuleGroupStatement: {
                    vendorName: "AWS",
                    name: "AWSManagedRulesAmazonIpReputationList",
                },
            },
            overrideAction: {
                none: {},
            },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: "AWSManagedRulesAmazonIpReputationList",
            },
        },
    },
    // Common Rule Set aligns with major portions of OWASP Core Rule Set
    {
        name: "AWS-AWSManagedRulesCommonRuleSet",
        rule: {
            name: "AWS-AWSManagedRulesCommonRuleSet",
            priority: 300,
            statement: {
                managedRuleGroupStatement: {
                    vendorName: "AWS",
                    name: "AWSManagedRulesCommonRuleSet",
                    // Excluding generic RFI body rule for sns notifications
                    // https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-list.html
                    excludedRules: [
                        { name: "GenericRFI_BODY" },
                        { name: "SizeRestrictions_BODY" },
                        { name: "CrossSiteScripting_BODY" },
                    ],
                },
            },
            overrideAction: {
                none: {},
            },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: "AWS-AWSManagedRulesCommonRuleSet",
            },
        },
    },
    {
        name: "AWS-AWSManagedRulesKnownBadInputsRuleSet",
        rule: {
            name: "AWS-AWSManagedRulesKnownBadInputsRuleSet",
            priority: 400,
            statement: {
                managedRuleGroupStatement: {
                    vendorName: "AWS",
                    name: "AWSManagedRulesKnownBadInputsRuleSet",
                },
            },
            overrideAction: {
                none: {},
            },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: "AWS-AWSManagedRulesKnownBadInputsRuleSet",
            },
        },
    },
    {
        name: "AWS-AWSManagedRulesSQLiRuleSet",
        rule: {
            name: "AWS-AWSManagedRulesSQLiRuleSet",
            priority: 500,
            statement: {
                managedRuleGroupStatement: {
                    vendorName: "AWS",
                    name: "AWSManagedRulesSQLiRuleSet",
                },
            },
            overrideAction: {
                none: {},
            },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: "AWS-AWSManagedRulesSQLiRuleSet",
            },
        },
    },
];
class WAF extends aws_wafv2_1.CfnWebACL {
    constructor(scope, id, ipset, distScope, extraRules) {
        if (extraRules && !(0, lodash_1.isEmpty)(extraRules)) {
            wafRules = (0, lodash_1.uniqBy)((0, lodash_1.concat)(wafRules, extraRules), "name");
        }
        if (ipset) {
            wafRules.push({
                name: "custom-web-ipfilter",
                rule: {
                    name: "custom-web-ipfilter",
                    priority: 600,
                    statement: {
                        notStatement: {
                            statement: {
                                ipSetReferenceStatement: {
                                    arn: ipset.attrArn,
                                },
                            },
                        },
                    },
                    action: {
                        block: {
                            customResponse: {
                                responseCode: 403,
                                customResponseBodyKey: "response",
                            },
                        },
                    },
                    visibilityConfig: {
                        sampledRequestsEnabled: true,
                        cloudWatchMetricsEnabled: true,
                        metricName: "custom-web-ipfilter",
                    },
                },
            });
        }
        super(scope, id, {
            defaultAction: { allow: {} },
            visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: `${id}-metric`,
                sampledRequestsEnabled: false,
            },
            customResponseBodies: {
                response: {
                    contentType: "TEXT_HTML",
                    content: "<div> Access denied </div>",
                },
            },
            scope: distScope,
            name: `${id}-waf`,
            rules: wafRules.map((wafRule) => wafRule.rule),
        });
    }
}
exports.WAF = WAF;
class WebACLAssociation extends aws_wafv2_1.CfnWebACLAssociation {
    constructor(scope, id, props) {
        super(scope, id, {
            resourceArn: props.resourceArn,
            webAclArn: props.webAclArn,
        });
    }
}
exports.WebACLAssociation = WebACLAssociation;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVnaW9uYWwtd2FmLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicmVnaW9uYWwtd2FmLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7OztHQUlHOzs7QUFFSCxtQ0FBaUQ7QUFHakQscURBSytCO0FBRS9CLDJDQUF1QztBQU92QywrQkFBK0I7QUFDL0IsTUFBYSxXQUFZLFNBQVEsc0JBQVM7SUFDeEIsTUFBTSxDQUFZO0lBQ2xDLFlBQ0UsS0FBZ0IsRUFDaEIsRUFBVSxFQUNWLEtBSUM7UUFFRCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQztRQUNqQixNQUFNLFNBQVMsR0FBRyxVQUFVLENBQUM7UUFFN0IsSUFBSSxDQUFDLElBQUEsZ0JBQU8sRUFBQyxLQUFLLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztZQUMvQixLQUFLLEdBQUcsSUFBSSxvQkFBUSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFO2dCQUN4QyxTQUFTLEVBQUUsS0FBSyxDQUFDLFVBQVU7Z0JBQzNCLGdCQUFnQixFQUFFLE1BQU07Z0JBQ3hCLEtBQUssRUFBRSxTQUFTO2dCQUNoQixXQUFXLEVBQUUsa0JBQWtCO2dCQUMvQixJQUFJLEVBQUUsR0FBRyxFQUFFLGNBQWM7YUFDMUIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELFVBQVU7UUFDVixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksR0FBRyxDQUNuQixJQUFJLEVBQ0osR0FBRyxFQUFFLFFBQVEsRUFDYixLQUFLLEVBQ0wsU0FBUyxFQUNULEtBQUssQ0FBQyxVQUFVLENBQ2pCLENBQUM7UUFFRixJQUFJLEtBQUssQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1lBQzVCLG1EQUFtRDtZQUNuRCxJQUFJLGlCQUFpQixDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsa0JBQWtCLEVBQUU7Z0JBQ25ELFdBQVcsRUFBRSxLQUFLLENBQUMs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S0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUU7WUFDZixhQUFhLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFO1lBQzVCLGdCQUFnQixFQUFFO2dCQUNoQix3QkFBd0IsRUFBRSxJQUFJO2dCQUM5QixVQUFVLEVBQUUsR0FBRyxFQUFFLFNBQVM7Z0JBQzFCLHNCQUFzQixFQUFFLEtBQUs7YUFDOUI7WUFDRCxvQkFBb0IsRUFBRTtnQkFDcEIsUUFBUSxFQUFFO29CQUNSLFdBQVcsRUFBRSxXQUFXO29CQUN4QixPQUFPLEVBQUUsNEJBQTRCO2lCQUN0QzthQUNGO1lBQ0QsS0FBSyxFQUFFLFNBQVM7WUFDaEIsSUFBSSxFQUFFLEdBQUcsRUFBRSxNQUFNO1lBQ2pCLEtBQUssRUFBRSxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO1NBQy9DLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTVERCxrQkE0REM7QUFFRCxNQUFhLGlCQUFrQixTQUFRLGdDQUFvQjtJQUN6RCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWdDO1FBQ3hFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFO1lBQ2YsV0FBVyxFQUFFLEtBQUssQ0FBQyxXQUFXO1lBQzlCLFNBQVMsRUFBRSxLQUFLLENBQUMsU0FBUztTQUMzQixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFQRCw4Q0FPQyIsInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiAgQ29weXJpZ2h0IDIwMjUgQW1hem9uLmNvbSwgSW5jLiBvciBpdHMgYWZmaWxpYXRlcy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqICBTUERYLUxpY2Vuc2UtSWRlbnRpZmllcjogTGljZW5zZVJlZi0uYW1hem9uLmNvbS4tQW16blNMLTEuMFxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBBbWF6b24gU29mdHdhcmUgTGljZW5zZSAgaHR0cDovL2F3cy5hbWF6b24uY29tL2FzbC9cbiAqL1xuXG5pbXBvcnQgeyBjb25jYXQsIGlzRW1wdHksIHVuaXFCeSB9IGZyb20gXCJsb2Rhc2hcIjtcblxuaW1wb3J0ICogYXMgY2RrIGZyb20gXCJhd3MtY2RrLWxpYlwiO1xuaW1wb3J0IHtcbiAgQ2ZuSVBTZXQsXG4gIENmbldlYkFDTCxcbiAgQ2ZuV2ViQUNMQXNzb2NpYXRpb24sXG4gIENmbldlYkFDTEFzc29jaWF0aW9uUHJvcHMsXG59IGZyb20gXCJhd3MtY2RrLWxpYi9hd3Mtd2FmdjJcIjtcblxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBXYWZSdWxlIHtcbiAgbmFtZTogc3RyaW5nO1xuICBydWxlOiBDZm5XZWJBQ0wuUnVsZVByb3BlcnR5O1xufVxuXG4vLyBGb3IgY3Jvc3MgcmVnaW9uYWwgcmVmZXJlbmNlXG5leHBvcnQgY2xhc3MgUmVnaW9uYWxXYWYgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgd2ViQWNsOiBDZm5XZWJBQ0w7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHNjb3BlOiBDb25zdHJ1Y3QsXG4gICAgaWQ6IHN0cmluZyxcbiAgICBwcm9wczoge1xuICAgICAgd2ViQUNMUmVzb3VyY2VBcm4/OiBzdHJpbmc7XG4gICAgICBleHRyYVJ1bGVzPzogQXJyYXk8V2FmUnVsZT47XG4gICAgICBhbGxvd2VkSXBzOiBBcnJheTxzdHJpbmc+O1xuICAgIH1cbiAgKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIGxldCBpcHNldCA9IG51bGw7XG4gICAgY29uc3QgZGlzdFNjb3BlID0gXCJSRUdJT05BTFwiO1xuXG4gICAgaWYgKCFpc0VtcHR5KHByb3BzLmFsbG93ZWRJcHMpKSB7XG4gICAgICBpcHNldCA9IG5ldyBDZm5JUFNldCh0aGlzLCBgJHtpZH0taXBzZXRgLCB7XG4gICAgICAgIGFkZHJlc3NlczogcHJvcHMuYWxsb3dlZElwcyxcbiAgICAgICAgaXBBZGRyZXNzVmVyc2lvbjogXCJJUFY0XCIsXG4gICAgICAgIHNjb3BlOiBkaXN0U2NvcGUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIkFwcCBhbGxvd2VkIElQVjRcIixcbiAgICAgICAgbmFtZTogYCR7aWR9LWFwcC1pcC1saXN0YCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEFXUyBXQUZcbiAgICB0aGlzLndlYkFjbCA9IG5ldyBXQUYoXG4gICAgICB0aGlzLFxuICAgICAgYCR7aWR9LVdBRnYyYCxcbiAgICAgIGlwc2V0LFxuICAgICAgZGlzdFNjb3BlLFxuICAgICAgcHJvcHMuZXh0cmFSdWxlc1xuICAgICk7XG5cbiAgICBpZiAocHJvcHMud2ViQUNMUmVzb3VyY2VBcm4pIHtcbiAgICAgIC8vIENyZWF0ZSBhbiBhc3NvY2lhdGlvbiwgbm90IG5lZWRlZCBmb3IgY2xvdWRmcm9udFxuICAgICAgbmV3IFdlYkFDTEFzc29jaWF0aW9uKHRoaXMsIGAke2lkfS1hY2wtQXNzb2NpYXRpb25gLCB7XG4gICAgICAgIHJlc291cmNlQXJuOiBwcm9wcy53ZWJBQ0xSZXNvdXJjZUFybixcbiAgICAgICAgd2ViQWNsQXJuOiB0aGlzLndlYkFjbC5hdHRyQXJuLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG5cbi8vIEFXUyBXQUYgcnVsZXNcbmxldCB3YWZSdWxlczogV2FmUnVsZVtdID0gW1xuICAvLyBSYXRlIEZpbHRlclxuICB7XG4gICAgbmFtZTogXCJ3ZWItcmF0ZS1maWx0ZXJcIixcbiAgICBydWxlOiB7XG4gICAgICBuYW1lOiBcIndlYi1yYXRlLWZpbHRlclwiLFxuICAgICAgcHJpb3JpdHk6IDEwMCxcbiAgICAgIHN0YXRlbWVudDoge1xuICAgICAgICByYXRlQmFzZWRTdGF0ZW1lbnQ6IHtcbiAgICAgICAgICBsaW1pdDogMzAwMCxcbiAgICAgICAgICBhZ2dyZWdhdGVLZXlUeXBlOiBcIklQXCIsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgYWN0aW9uOiB7XG4gICAgICAgIGJsb2NrOiB7fSxcbiAgICAgIH0sXG4gICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgIHNhbXBsZWRSZXF1ZXN0c0VuYWJsZWQ6IHRydWUsXG4gICAgICAgIGNsb3VkV2F0Y2hNZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgbWV0cmljTmFtZTogXCJ3ZWItcmF0ZS1maWx0ZXJcIixcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgLy8gQVdTIElQIFJlcHV0YXRpb24gbGlzdCBpbmNsdWRlcyBrbm93biBtYWxpY2lvdXMgYWN0b3JzL2JvdHMgYW5kIGlzIHJlZ3VsYXJseSB1cGRhdGVkXG4gIHtcbiAgICBuYW1lOiBcIkFXUy1BV1NNYW5hZ2VkUnVsZXNBbWF6b25JcFJlcHV0YXRpb25MaXN0XCIsXG4gICAgcnVsZToge1xuICAgICAgbmFtZTogXCJBV1MtQVdTTWFuYWdlZFJ1bGVzQW1hem9uSXBSZXB1dGF0aW9uTGlzdFwiLFxuICAgICAgcHJpb3JpdHk6IDIwMCxcbiAgICAgIHN0YXRlbWVudDoge1xuICAgICAgICBtYW5hZ2VkUnVsZUdyb3VwU3RhdGVtZW50OiB7XG4gICAgICAgICAgdmVuZG9yTmFtZTogXCJBV1NcIixcbiAgICAgICAgICBuYW1lOiBcIkFXU01hbmFnZWRSdWxlc0FtYXpvbklwUmVwdXRhdGlvbkxpc3RcIixcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBvdmVycmlkZUFjdGlvbjoge1xuICAgICAgICBub25lOiB7fSxcbiAgICAgIH0sXG4gICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgIHNhbXBsZWRSZXF1ZXN0c0VuYWJsZWQ6IHRydWUsXG4gICAgICAgIGNsb3VkV2F0Y2hNZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgbWV0cmljTmFtZTogXCJBV1NNYW5hZ2VkUnVsZXNBbWF6b25JcFJlcHV0YXRpb25MaXN0XCIsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIC8vIENvbW1vbiBSdWxlIFNldCBhbGlnbnMgd2l0aCBtYWpvciBwb3J0aW9ucyBvZiBPV0FTUCBDb3JlIFJ1bGUgU2V0XG4gIHtcbiAgICBuYW1lOiBcIkFXUy1BV1NNYW5hZ2VkUnVsZXNDb21tb25SdWxlU2V0XCIsXG4gICAgcnVsZToge1xuICAgICAgbmFtZTogXCJBV1MtQVdTTWFuYWdlZFJ1bGVzQ29tbW9uUnVsZVNldFwiLFxuICAgICAgcHJpb3JpdHk6IDMwMCxcbiAgICAgIHN0YXRlbWVudDoge1xuICAgICAgICBtYW5hZ2VkUnVsZUdyb3VwU3RhdGVtZW50OiB7XG4gICAgICAgICAgdmVuZG9yTmFtZTogXCJBV1NcIixcbiAgICAgICAgICBuYW1lOiBcIkFXU01hbmFnZWRSdWxlc0NvbW1vblJ1bGVTZXRcIixcbiAgICAgICAgICAvLyBFeGNsdWRpbmcgZ2VuZXJpYyBSRkkgYm9keSBydWxlIGZvciBzbnMgbm90aWZpY2F0aW9uc1xuICAgICAgICAgIC8vIGh0dHBzOi8vZG9jcy5hd3MuYW1hem9uLmNvbS93YWYvbGF0ZXN0L2RldmVsb3Blcmd1aWRlL2F3cy1tYW5hZ2VkLXJ1bGUtZ3JvdXBzLWxpc3QuaHRtbFxuICAgICAgICAgIGV4Y2x1ZGVkUnVsZXM6IFtcbiAgICAgICAgICAgIHsgbmFtZTogXCJHZW5lcmljUkZJX0JPRFlcIiB9LFxuICAgICAgICAgICAgeyBuYW1lOiBcIlNpemVSZXN0cmljdGlvbnNfQk9EWVwiIH0sXG4gICAgICAgICAgICB7IG5hbWU6IFwiQ3Jvc3NTaXRlU2NyaXB0aW5nX0JPRFlcIiB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgb3ZlcnJpZGVBY3Rpb246IHtcbiAgICAgICAgbm9uZToge30sXG4gICAgICB9LFxuICAgICAgdmlzaWJpbGl0eUNvbmZpZzoge1xuICAgICAgICBzYW1wbGVkUmVxdWVzdHNFbmFibGVkOiB0cnVlLFxuICAgICAgICBjbG91ZFdhdGNoTWV0cmljc0VuYWJsZWQ6IHRydWUsXG4gICAgICAgIG1ldHJpY05hbWU6IFwiQVdTLUFXU01hbmFnZWRSdWxlc0NvbW1vblJ1bGVTZXRcIixcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAge1xuICAgIG5hbWU6IFwiQVdTLUFXU01hbmFnZWRSdWxlc0tub3duQmFkSW5wdXRzUnVsZVNldFwiLFxuICAgIHJ1bGU6IHtcbiAgICAgIG5hbWU6IFwiQVdTLUFXU01hbmFnZWRSdWxlc0tub3duQmFkSW5wdXRzUnVsZVNldFwiLFxuICAgICAgcHJpb3JpdHk6IDQwMCxcbiAgICAgIHN0YXRlbWVudDoge1xuICAgICAgICBtYW5hZ2VkUnVsZUdyb3VwU3RhdGVtZW50OiB7XG4gICAgICAgICAgdmVuZG9yTmFtZTogXCJBV1NcIixcbiAgICAgICAgICBuYW1lOiBcIkFXU01hbmFnZWRSdWxlc0tub3duQmFkSW5wdXRzUnVsZVNldFwiLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIG92ZXJyaWRlQWN0aW9uOiB7XG4gICAgICAgIG5vbmU6IHt9LFxuICAgICAgfSxcbiAgICAgIHZpc2liaWxpdHlDb25maWc6IHtcbiAgICAgICAgc2FtcGxlZFJlcXVlc3RzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgY2xvdWRXYXRjaE1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgICBtZXRyaWNOYW1lOiBcIkFXUy1BV1NNYW5hZ2VkUnVsZXNLbm93bkJhZElucHV0c1J1bGVTZXRcIixcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAge1xuICAgIG5hbWU6IFwiQVdTLUFXU01hbmFnZWRSdWxlc1NRTGlSdWxlU2V0XCIsXG4gICAgcnVsZToge1xuICAgICAgbmFtZTogXCJBV1MtQVdTTWFuYWdlZFJ1bGVzU1FMaVJ1bGVTZXRcIixcbiAgICAgIHByaW9yaXR5OiA1MDAsXG4gICAgICBzdGF0ZW1lbnQ6IHtcbiAgICAgICAgbWFuYWdlZFJ1bGVHcm91cFN0YXRlbWVudDoge1xuICAgICAgICAgIHZlbmRvck5hbWU6IFwiQVdTXCIsXG4gICAgICAgICAgbmFtZTogXCJBV1NNYW5hZ2VkUnVsZXNTUUxpUnVsZVNldFwiLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIG92ZXJyaWRlQWN0aW9uOiB7XG4gICAgICAgIG5vbmU6IHt9LFxuICAgICAgfSxcbiAgICAgIHZpc2liaWxpdHlDb25maWc6IHtcbiAgICAgICAgc2FtcGxlZFJlcXVlc3RzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgY2xvdWRXYXRjaE1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgICBtZXRyaWNOYW1lOiBcIkFXUy1BV1NNYW5hZ2VkUnVsZXNTUUxpUnVsZVNldFwiLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuXTtcblxuZXhwb3J0IGNsYXNzIFdBRiBleHRlbmRzIENmbldlYkFDTCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHNjb3BlOiBDb25zdHJ1Y3QsXG4gICAgaWQ6IHN0cmluZyxcbiAgICBpcHNldDogY2RrLmF3c193YWZ2Mi5DZm5JUFNldCB8IG51bGwsXG4gICAgZGlzdFNjb3BlOiBzdHJpbmcsXG4gICAgZXh0cmFSdWxlcz86IEFycmF5PFdhZlJ1bGU+XG4gICkge1xuICAgIGlmIChleHRyYVJ1bGVzICYmICFpc0VtcHR5KGV4dHJhUnVsZXMpKSB7XG4gICAgICB3YWZSdWxlcyA9IHVuaXFCeShjb25jYXQod2FmUnVsZXMsIGV4dHJhUnVsZXMpLCBcIm5hbWVcIik7XG4gICAgfVxuICAgIGlmIChpcHNldCkge1xuICAgICAgd2FmUnVsZXMucHVzaCh7XG4gICAgICAgIG5hbWU6IFwiY3VzdG9tLXdlYi1pcGZpbHRlclwiLFxuICAgICAgICBydWxlOiB7XG4gICAgICAgICAgbmFtZTogXCJjdXN0b20td2ViLWlwZmlsdGVyXCIsXG4gICAgICAgICAgcHJpb3JpdHk6IDYwMCxcbiAgICAgICAgICBzdGF0ZW1lbnQ6IHtcbiAgICAgICAgICAgIG5vdFN0YXRlbWVudDoge1xuICAgICAgICAgICAgICBzdGF0ZW1lbnQ6IHtcbiAgICAgICAgICAgICAgICBpcFNldFJlZmVyZW5jZVN0YXRlbWVudDoge1xuICAgICAgICAgICAgICAgICAgYXJuOiBpcHNldC5hdHRyQXJuLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICBibG9jazoge1xuICAgICAgICAgICAgICBjdXN0b21SZXNwb25zZToge1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlQ29kZTogNDAzLFxuICAgICAgICAgICAgICAgIGN1c3RvbVJlc3BvbnNlQm9keUtleTogXCJyZXNwb25zZVwiLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHZpc2liaWxpdHlDb25maWc6IHtcbiAgICAgICAgICAgIHNhbXBsZWRSZXF1ZXN0c0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBjbG91ZFdhdGNoTWV0cmljc0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiBcImN1c3RvbS13ZWItaXBmaWx0ZXJcIixcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfVxuICAgIHN1cGVyKHNjb3BlLCBpZCwge1xuICAgICAgZGVmYXVsdEFjdGlvbjogeyBhbGxvdzoge30gfSxcbiAgICAgIHZpc2liaWxpdHlDb25maWc6IHtcbiAgICAgICAgY2xvdWRXYXRjaE1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgICBtZXRyaWNOYW1lOiBgJHtpZH0tbWV0cmljYCxcbiAgICAgICAgc2FtcGxlZFJlcXVlc3RzRW5hYmxlZDogZmFsc2UsXG4gICAgICB9LFxuICAgICAgY3VzdG9tUmVzcG9uc2VCb2RpZXM6IHtcbiAgICAgICAgcmVzcG9uc2U6IHtcbiAgICAgICAgICBjb250ZW50VHlwZTogXCJURVhUX0hUTUxcIixcbiAgICAgICAgICBjb250ZW50OiBcIjxkaXY+IEFjY2VzcyBkZW5pZWQgPC9kaXY+XCIsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgc2NvcGU6IGRpc3RTY29wZSxcbiAgICAgIG5hbWU6IGAke2lkfS13YWZgLFxuICAgICAgcnVsZXM6IHdhZlJ1bGVzLm1hcCgod2FmUnVsZSkgPT4gd2FmUnVsZS5ydWxlKSxcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgV2ViQUNMQXNzb2NpYXRpb24gZXh0ZW5kcyBDZm5XZWJBQ0xBc3NvY2lhdGlvbiB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBDZm5XZWJBQ0xBc3NvY2lhdGlvblByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCB7XG4gICAgICByZXNvdXJjZUFybjogcHJvcHMucmVzb3VyY2VBcm4sXG4gICAgICB3ZWJBY2xBcm46IHByb3BzLndlYkFjbEFybixcbiAgICB9KTtcbiAgfVxufVxuIl19