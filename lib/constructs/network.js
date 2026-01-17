"use strict";
/**
 * Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Network = void 0;
const constructs_1 = require("constructs");
const aws_ec2_1 = require("aws-cdk-lib/aws-ec2");
class Network extends constructs_1.Construct {
    vpc;
    constructor(scope, id, props) {
        super(scope, id);
        if (props.existingVpc && props.vpcId) {
            // 既存VPCを参照
            console.log(`Using existing VPC: ${props.vpcId}`);
            this.vpc = aws_ec2_1.Vpc.fromLookup(this, "ExistingVpc", {
                vpcId: props.vpcId,
            });
        }
        else {
            // 新しいVPCを作成
            console.log("Creating new VPC");
            this.vpc = new aws_ec2_1.Vpc(this, "Vpc", {
                ipAddresses: aws_ec2_1.IpAddresses.cidr(props.cidr),
                maxAzs: props.maxAzs,
                subnetConfiguration: [
                    ...(props.publicSubnet
                        ? [
                            {
                                cidrMask: props.subnetCidrMask,
                                name: "Public",
                                subnetType: aws_ec2_1.SubnetType.PUBLIC,
                            },
                        ]
                        : []),
                    ...(props.natSubnet
                        ? [
                            {
                                cidrMask: props.subnetCidrMask,
                                name: "Private",
                                subnetType: aws_ec2_1.SubnetType.PRIVATE_WITH_EGRESS,
                            },
                        ]
                        : []),
                    ...(props.isolatedSubnet
                        ? [
                            {
                                cidrMask: props.subnetCidrMask,
                                name: "Isolated",
                                subnetType: aws_ec2_1.SubnetType.PRIVATE_ISOLATED,
                            },
                        ]
                        : []),
                ],
            });
        }
    }
}
exports.Network = Network;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV0d29yay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm5ldHdvcmsudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7OztBQUVILDJDQUF1QztBQUV2QyxpREFLNkI7QUFHN0IsTUFBYSxPQUFRLFNBQVEsc0JBQVM7SUFDcEIsR0FBRyxDQUFhO0lBRWhDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBb0I7UUFDNUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixJQUFJLEtBQUssQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ3JDLFdBQVc7WUFDWCxPQUFPLENBQUMsR0FBRyxDQUFDLHVCQUF1QixLQUFLLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztZQUNsRCxJQUFJLENBQUMsR0FBRyxHQUFHLGFBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtnQkFDN0MsS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLO2FBQ25CLENBQUMsQ0FBQztRQUNMLENBQUM7YUFBTSxDQUFDO1lBQ04sWUFBWTtZQUNaLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztZQUNoQyxJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksYUFBRyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUU7Z0JBQzlCLFdBQVcsRUFBRSxxQkFBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO2dCQUN6QyxNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU07Z0JBQ3BCLG1CQUFtQixFQUFFO29CQUNuQixHQUFHLENBQUMsS0FBSyxDQUFDLFlBQVk7d0JBQ3BCLENBQUMsQ0FBQzs0QkFDRTtnQ0FDRSxRQUFRLEVBQUUsS0FBSyxDQUFDLGNBQWM7Z0NBQzlCLElBQUksRUFBRSxRQUFRO2dDQUNkLFVBQVUsRUFBRSxvQkFBVSxDQUFDLE1BQU07NkJBQzlCO3lCQUNGO3dCQUNILENBQUMsQ0FBQyxFQUFFLENBQUM7b0JBQ1AsR0FBRyxDQUFDLEtBQUssQ0FBQyxTQUFTO3dCQUNqQixDQUFDLENBQUM7NEJBQ0U7Z0NBQ0UsUUFBUSxFQUFFLEtBQUssQ0FBQyxjQUFjO2dDQUM5QixJQUFJLEVBQUUsU0FBUztnQ0FDZixVQUFVLEVBQUUsb0JBQVUsQ0FBQyxtQkFBbUI7NkJBQzNDO3lCQUNGO3dCQUNILENBQUMsQ0FBQyxFQUFFLENBQUM7b0JBQ1AsR0FBRyxDQUFDLEtBQUssQ0FBQyxjQUFjO3dCQUN0QixDQUFDLENBQUM7NEJBQ0U7Z0NBQ0UsUUFBUSxFQUFFLEtBQUssQ0FBQyxjQUFjO2dDQUM5QixJQUFJLEVBQUUsVUFBVTtnQ0FDaEIsVUFBVSxFQUFFLG9CQUFVLENBQUMsZ0JBQWdCOzZCQUN4Qzt5QkFDRjt3QkFDSCxDQUFDLENBQUMsRUFBRSxDQUFDO2lCQUNSO2FBQ0YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztJQUNILENBQUM7Q0FDRjtBQWxERCwwQkFrREMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENvcHlyaWdodCAyMDI1IEFtYXpvbi5jb20sIEluYy4gb3IgaXRzIGFmZmlsaWF0ZXMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKiBTUERYLUxpY2Vuc2UtSWRlbnRpZmllcjogTGljZW5zZVJlZi0uYW1hem9uLmNvbS4tQW16blNMLTEuMFxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFtYXpvbiBTb2Z0d2FyZSBMaWNlbnNlICBodHRwOi8vYXdzLmFtYXpvbi5jb20vYXNsL1xuICovXG5cbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gXCJjb25zdHJ1Y3RzXCI7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSBcImF3cy1jZGstbGliXCI7XG5pbXBvcnQge1xuICBJVnBjLFxuICBWcGMsXG4gIFN1Ym5ldFR5cGUsXG4gIElwQWRkcmVzc2VzLFxufSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWVjMlwiO1xuaW1wb3J0IHsgTmV0d29ya0NvbmZpZyB9IGZyb20gXCIuLi8uLi9jb25maWdcIjtcblxuZXhwb3J0IGNsYXNzIE5ldHdvcmsgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgdnBjOiBWcGMgfCBJVnBjO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBOZXR3b3JrQ29uZmlnKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIGlmIChwcm9wcy5leGlzdGluZ1ZwYyAmJiBwcm9wcy52cGNJZCkge1xuICAgICAgLy8g5pei5a2YVlBD44KS5Y+C54WnXG4gICAgICBjb25zb2xlLmxvZyhgVXNpbmcgZXhpc3RpbmcgVlBDOiAke3Byb3BzLnZwY0lkfWApO1xuICAgICAgdGhpcy52cGMgPSBWcGMuZnJvbUxvb2t1cCh0aGlzLCBcIkV4aXN0aW5nVnBjXCIsIHtcbiAgICAgICAgdnBjSWQ6IHByb3BzLnZwY0lkLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIOaWsOOBl+OBhFZQQ+OCkuS9nOaIkFxuICAgICAgY29uc29sZS5sb2coXCJDcmVhdGluZyBuZXcgVlBDXCIpO1xuICAgICAgdGhpcy52cGMgPSBuZXcgVnBjKHRoaXMsIFwiVnBjXCIsIHtcbiAgICAgICAgaXBBZGRyZXNzZXM6IElwQWRkcmVzc2VzLmNpZHIocHJvcHMuY2lkciksXG4gICAgICAgIG1heEF6czogcHJvcHMubWF4QXpzLFxuICAgICAgICBzdWJuZXRDb25maWd1cmF0aW9uOiBbXG4gICAgICAgICAgLi4uKHByb3BzLnB1YmxpY1N1Ym5ldFxuICAgICAgICAgICAgPyBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgY2lkck1hc2s6IHByb3BzLnN1Ym5ldENpZHJNYXNrLFxuICAgICAgICAgICAgICAgICAgbmFtZTogXCJQdWJsaWNcIixcbiAgICAgICAgICAgICAgICAgIHN1Ym5ldFR5cGU6IFN1Ym5ldFR5cGUuUFVCTElDLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIDogW10pLFxuICAgICAgICAgIC4uLihwcm9wcy5uYXRTdWJuZXRcbiAgICAgICAgICAgID8gW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIGNpZHJNYXNrOiBwcm9wcy5zdWJuZXRDaWRyTWFzayxcbiAgICAgICAgICAgICAgICAgIG5hbWU6IFwiUHJpdmF0ZVwiLFxuICAgICAgICAgICAgICAgICAgc3VibmV0VHlwZTogU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIDogW10pLFxuICAgICAgICAgIC4uLihwcm9wcy5pc29sYXRlZFN1Ym5ldFxuICAgICAgICAgICAgPyBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgY2lkck1hc2s6IHByb3BzLnN1Ym5ldENpZHJNYXNrLFxuICAgICAgICAgICAgICAgICAgbmFtZTogXCJJc29sYXRlZFwiLFxuICAgICAgICAgICAgICAgICAgc3VibmV0VHlwZTogU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVELFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIDogW10pLFxuICAgICAgICBdLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG4iXX0=