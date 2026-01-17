"use strict";
/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ECR = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_ecr_1 = require("aws-cdk-lib/aws-ecr");
const constructs_1 = require("constructs");
const cdk_docker_image_deployment_1 = require("cdk-docker-image-deployment");
const cdk_nag_1 = require("cdk-nag");
class ECR extends constructs_1.Construct {
    repository;
    constructor(scope, id, props) {
        super(scope, id);
        this.repository = new aws_ecr_1.Repository(this, "Repository", {
            imageScanOnPush: true,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            emptyOnDelete: true,
        });
        const dockerImageDeployment = new cdk_docker_image_deployment_1.DockerImageDeployment(this, "deployDockerImage", {
            source: cdk_docker_image_deployment_1.Source.directory(props.path),
            destination: cdk_docker_image_deployment_1.Destination.ecr(this.repository, {
                tag: props.tag,
            }),
        });
        cdk_nag_1.NagSuppressions.addResourceSuppressions(dockerImageDeployment, [
            {
                id: "AwsSolutions-IAM5",
                reason: "Create the Lambda and codebuild iam role for this automatically",
            },
            { id: "AwsSolutions-SF1", reason: "Create Sfn automatically" },
            { id: "AwsSolutions-SF2", reason: "Create Sfn automatically" },
            { id: "AwsSolutions-CB4", reason: "Create Codebuild automatically" },
            {
                id: "AwsSolutions-IAM4",
                reason: "Create the Lambda automatically",
            },
            {
                id: "AwsSolutions-L1",
                reason: "Create the Lambda automatically",
            },
        ], true);
    }
}
exports.ECR = ECR;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVwb3NpdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInJlcG9zaXRvcnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7OztBQUVILDZDQUE0QztBQUM1QyxpREFBaUQ7QUFDakQsMkNBQXVDO0FBRXZDLDZFQUlxQztBQUNyQyxxQ0FBMEM7QUFNMUMsTUFBYSxHQUFJLFNBQVEsc0JBQVM7SUFDaEIsVUFBVSxDQUFhO0lBQ3ZDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZTtRQUN2RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ2pCLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxvQkFBVSxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDbkQsZUFBZSxFQUFFLElBQUk7WUFDckIsYUFBYSxFQUFFLDJCQUFhLENBQUMsT0FBTztZQUNwQyxhQUFhLEVBQUUsSUFBSTtTQUNwQixDQUFDLENBQUM7UUFFSCxNQUFNLHFCQUFxQixHQUFHLElBQUksbURBQXFCLENBQ3JELElBQUksRUFDSixtQkFBbUIsRUFDbkI7WUFDRSxNQUFNLEVBQUUsb0NBQU0sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztZQUNwQyxXQUFXLEVBQUUseUNBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRTtnQkFDNUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxHQUFHO2FBQ2YsQ0FBQztTQUNILENBQ0YsQ0FBQztRQUNGLHlCQUFlLENBQUMsdUJBQXVCLENBQ3JDLHFCQUFxQixFQUNyQjtZQUNFO2dCQUNFLEVBQUUsRUFBRSxtQkFBbUI7Z0JBQ3ZCLE1BQU0sRUFDSixpRUFBaUU7YUFDcEU7WUFDRCxFQUFFLEVBQUUsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLEVBQUUsMEJBQTBCLEVBQUU7WUFDOUQsRUFBRSxFQUFFLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxFQUFFLDBCQUEwQixFQUFFO1lBQzlELEVBQUUsRUFBRSxFQUFFLGtCQUFrQixFQUFFLE1BQU0sRUFBRSxnQ0FBZ0MsRUFBRTtZQUNwRTtnQkFDRSxFQUFFLEVBQUUsbUJBQW1CO2dCQUN2QixNQUFNLEVBQUUsaUNBQWlDO2FBQzFDO1lBQ0Q7Z0JBQ0UsRUFBRSxFQUFFLGlCQUFpQjtnQkFDckIsTUFBTSxFQUFFLGlDQUFpQzthQUMxQztTQUNGLEVBQ0QsSUFBSSxDQUNMLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUEzQ0Qsa0JBMkNDIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqICBDb3B5cmlnaHQgMjAyNSBBbWF6b24uY29tLCBJbmMuIG9yIGl0cyBhZmZpbGlhdGVzLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICogIFNQRFgtTGljZW5zZS1JZGVudGlmaWVyOiBMaWNlbnNlUmVmLS5hbWF6b24uY29tLi1BbXpuU0wtMS4wXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIEFtYXpvbiBTb2Z0d2FyZSBMaWNlbnNlICBodHRwOi8vYXdzLmFtYXpvbi5jb20vYXNsL1xuICovXG5cbmltcG9ydCB7IFJlbW92YWxQb2xpY3kgfSBmcm9tIFwiYXdzLWNkay1saWJcIjtcbmltcG9ydCB7IFJlcG9zaXRvcnkgfSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWVjclwiO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcblxuaW1wb3J0IHtcbiAgRG9ja2VySW1hZ2VEZXBsb3ltZW50LFxuICBTb3VyY2UsXG4gIERlc3RpbmF0aW9uLFxufSBmcm9tIFwiY2RrLWRvY2tlci1pbWFnZS1kZXBsb3ltZW50XCI7XG5pbXBvcnQgeyBOYWdTdXBwcmVzc2lvbnMgfSBmcm9tIFwiY2RrLW5hZ1wiO1xuXG5pbnRlcmZhY2UgRWNyUHJvcHMge1xuICBwYXRoOiBzdHJpbmc7XG4gIHRhZzogc3RyaW5nO1xufVxuZXhwb3J0IGNsYXNzIEVDUiBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyByZWFkb25seSByZXBvc2l0b3J5OiBSZXBvc2l0b3J5O1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogRWNyUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuICAgIHRoaXMucmVwb3NpdG9yeSA9IG5ldyBSZXBvc2l0b3J5KHRoaXMsIFwiUmVwb3NpdG9yeVwiLCB7XG4gICAgICBpbWFnZVNjYW5PblB1c2g6IHRydWUsXG4gICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBlbXB0eU9uRGVsZXRlOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZG9ja2VySW1hZ2VEZXBsb3ltZW50ID0gbmV3IERvY2tlckltYWdlRGVwbG95bWVudChcbiAgICAgIHRoaXMsXG4gICAgICBcImRlcGxveURvY2tlckltYWdlXCIsXG4gICAgICB7XG4gICAgICAgIHNvdXJjZTogU291cmNlLmRpcmVjdG9yeShwcm9wcy5wYXRoKSxcbiAgICAgICAgZGVzdGluYXRpb246IERlc3RpbmF0aW9uLmVjcih0aGlzLnJlcG9zaXRvcnksIHtcbiAgICAgICAgICB0YWc6IHByb3BzLnRhZyxcbiAgICAgICAgfSksXG4gICAgICB9XG4gICAgKTtcbiAgICBOYWdTdXBwcmVzc2lvbnMuYWRkUmVzb3VyY2VTdXBwcmVzc2lvbnMoXG4gICAgICBkb2NrZXJJbWFnZURlcGxveW1lbnQsXG4gICAgICBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogXCJBd3NTb2x1dGlvbnMtSUFNNVwiLFxuICAgICAgICAgIHJlYXNvbjpcbiAgICAgICAgICAgIFwiQ3JlYXRlIHRoZSBMYW1iZGEgYW5kIGNvZGVidWlsZCBpYW0gcm9sZSBmb3IgdGhpcyBhdXRvbWF0aWNhbGx5XCIsXG4gICAgICAgIH0sXG4gICAgICAgIHsgaWQ6IFwiQXdzU29sdXRpb25zLVNGMVwiLCByZWFzb246IFwiQ3JlYXRlIFNmbiBhdXRvbWF0aWNhbGx5XCIgfSxcbiAgICAgICAgeyBpZDogXCJBd3NTb2x1dGlvbnMtU0YyXCIsIHJlYXNvbjogXCJDcmVhdGUgU2ZuIGF1dG9tYXRpY2FsbHlcIiB9LFxuICAgICAgICB7IGlkOiBcIkF3c1NvbHV0aW9ucy1DQjRcIiwgcmVhc29uOiBcIkNyZWF0ZSBDb2RlYnVpbGQgYXV0b21hdGljYWxseVwiIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogXCJBd3NTb2x1dGlvbnMtSUFNNFwiLFxuICAgICAgICAgIHJlYXNvbjogXCJDcmVhdGUgdGhlIExhbWJkYSBhdXRvbWF0aWNhbGx5XCIsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogXCJBd3NTb2x1dGlvbnMtTDFcIixcbiAgICAgICAgICByZWFzb246IFwiQ3JlYXRlIHRoZSBMYW1iZGEgYXV0b21hdGljYWxseVwiLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIHRydWVcbiAgICApO1xuICB9XG59XG4iXX0=