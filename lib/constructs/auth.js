"use strict";
/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Auth = void 0;
const constructs_1 = require("constructs");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const custom_resources_1 = require("aws-cdk-lib/custom-resources");
const aws_cognito_identitypool_alpha_1 = require("@aws-cdk/aws-cognito-identitypool-alpha");
const cdk_nag_1 = require("cdk-nag");
class Auth extends constructs_1.Construct {
    cognitoParams;
    userPool;
    constructor(scope, id, props) {
        super(scope, id);
        this.userPool = new aws_cdk_lib_1.aws_cognito.UserPool(this, "userpool", {
            userPoolName: `${id}-app-userpool`,
            signInAliases: {
                username: true,
                email: true,
            },
            accountRecovery: aws_cdk_lib_1.aws_cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            selfSignUpEnabled: false,
            autoVerify: {
                email: true,
            },
            passwordPolicy: {
                minLength: 8,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
            },
        });
        const userPoolClient = this.userPool.addClient("webappClient", {
            authFlows: {
                adminUserPassword: true,
            },
            preventUserExistenceErrors: true,
            refreshTokenValidity: props.refreshTokenValidity,
        });
        const identityPool = new aws_cognito_identitypool_alpha_1.IdentityPool(this, "identityPool", {
            allowUnauthenticatedIdentities: false,
            authenticationProviders: {
                userPools: [
                    new aws_cognito_identitypool_alpha_1.UserPoolAuthenticationProvider({
                        userPool: this.userPool,
                        userPoolClient,
                    }),
                ],
            },
        });
        this.cognitoParams = {
            userPoolId: this.userPool.userPoolId,
            userPoolClientId: userPoolClient.userPoolClientId,
            identityPoolId: identityPool.identityPoolId,
        };
        new aws_cdk_lib_1.CfnOutput(this, "UserPoolId", {
            value: this.userPool.userPoolId,
        });
        new aws_cdk_lib_1.CfnOutput(this, "UserPoolClientId", {
            value: userPoolClient.userPoolClientId,
        });
        new aws_cdk_lib_1.CfnOutput(this, "IdentityPoolId", {
            value: identityPool.identityPoolId,
        });
        new CreatePoolUser(this, "admin-user", {
            email: props.userEmail,
            username: props.userName,
            userPool: this.userPool,
        });
        // Suppressions
        cdk_nag_1.NagSuppressions.addResourceSuppressions(this.userPool, [
            {
                id: "AwsSolutions-COG2",
                reason: "No need MFA for sample",
            },
            {
                id: "AwsSolutions-COG3",
                reason: "Deprecated",
            },
        ]);
    }
}
exports.Auth = Auth;
class CreatePoolUser extends constructs_1.Construct {
    username;
    constructor(scope, id, props) {
        super(scope, id);
        const statement = new aws_cdk_lib_1.aws_iam.PolicyStatement({
            actions: ["cognito-idp:AdminDeleteUser", "cognito-idp:AdminCreateUser"],
            resources: [props.userPool.userPoolArn],
        });
        // TempパスはNetapp1!を利用
        new custom_resources_1.AwsCustomResource(this, `CreateUser-${id}`, {
            onCreate: {
                service: "CognitoIdentityServiceProvider",
                action: "adminCreateUser",
                parameters: {
                    UserPoolId: props.userPool.userPoolId,
                    Username: props.username,
                    TemporaryPassword: "Netapp1!",
                    UserAttributes: [
                        {
                            Name: "email",
                            Value: props.email,
                        },
                        {
                            Name: "email_verified",
                            Value: "true",
                        },
                    ],
                },
                physicalResourceId: custom_resources_1.PhysicalResourceId.of(`CreateUser-${id}-${props.username}`),
            },
            onDelete: {
                service: "CognitoIdentityServiceProvider",
                action: "adminDeleteUser",
                parameters: {
                    UserPoolId: props.userPool.userPoolId,
                    Username: props.username,
                },
            },
            policy: custom_resources_1.AwsCustomResourcePolicy.fromStatements([statement]),
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImF1dGgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7OztBQUVILDJDQUF1QztBQUN2Qyw2Q0FNcUI7QUFFckIsbUVBSXNDO0FBRXRDLDRGQUdpRDtBQUNqRCxxQ0FBMEM7QUFjMUMsTUFBYSxJQUFLLFNBQVEsc0JBQVM7SUFDakIsYUFBYSxDQUFnQjtJQUM3QixRQUFRLENBQXVCO0lBQy9DLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0I7UUFDeEQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUkseUJBQVcsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUN6RCxZQUFZLEVBQUUsR0FBRyxFQUFFLGVBQWU7WUFDbEMsYUFBYSxFQUFFO2dCQUNiLFFBQVEsRUFBRSxJQUFJO2dCQUNkLEtBQUssRUFBRSxJQUFJO2FBQ1o7WUFDRCxlQUFlLEVBQUUseUJBQVcsQ0FBQyxlQUFlLENBQUMsVUFBVTtZQUN2RCxhQUFhLEVBQUUsMkJBQWEsQ0FBQyxPQUFPO1lBQ3BDLGlCQUFpQixFQUFFLEtBQUs7WUFDeEIsVUFBVSxFQUFFO2dCQUNWLEtBQUssRUFBRSxJQUFJO2FBQ1o7WUFDRCxjQUFjLEVBQUU7Z0JBQ2QsU0FBUyxFQUFFLENBQUM7Z0JBQ1osZ0JBQWdCLEVBQUUsSUFBSTtnQkFDdEIsYUFBYSxFQUFFLElBQUk7Z0JBQ25CLGNBQWMsRUFBRSxJQUFJO2FBQ3JCO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsY0FBYyxFQUFFO1lBQzdELFNBQVMsRUFBRTtnQkFDVCxpQkFBaUIsRUFBRSxJQUFJO2FBQ3hCO1lBQ0QsMEJBQTBCLEVBQUUsSUFBSTtZQUNoQyxvQkFBb0IsRUFBRSxLQUFLLENBQUMsb0JBQW9C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QUNSLE9BQU8sRUFBRSxnQ0FBZ0M7Z0JBQ3pDLE1BQU0sRUFBRSxpQkFBaUI7Z0JBQ3pCLFVBQVUsRUFBRTtvQkFDVixVQUFVLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxVQUFVO29CQUNyQyxRQUFRLEVBQUUsS0FBSyxDQUFDLFFBQVE7aUJBQ3pCO2FBQ0Y7WUFDRCxNQUFNLEVBQUUsMENBQXVCLENBQUMsY0FBYyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDNUQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqICBDb3B5cmlnaHQgMjAyNSBBbWF6b24uY29tLCBJbmMuIG9yIGl0cyBhZmZpbGlhdGVzLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICogIFNQRFgtTGljZW5zZS1JZGVudGlmaWVyOiBMaWNlbnNlUmVmLS5hbWF6b24uY29tLi1BbXpuU0wtMS4wXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIEFtYXpvbiBTb2Z0d2FyZSBMaWNlbnNlICBodHRwOi8vYXdzLmFtYXpvbi5jb20vYXNsL1xuICovXG5cbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gXCJjb25zdHJ1Y3RzXCI7XG5pbXBvcnQge1xuICBEdXJhdGlvbixcbiAgUmVtb3ZhbFBvbGljeSxcbiAgYXdzX2NvZ25pdG8sXG4gIGF3c19pYW0sXG4gIENmbk91dHB1dCxcbn0gZnJvbSBcImF3cy1jZGstbGliXCI7XG5cbmltcG9ydCB7XG4gIEF3c0N1c3RvbVJlc291cmNlLFxuICBBd3NDdXN0b21SZXNvdXJjZVBvbGljeSxcbiAgUGh5c2ljYWxSZXNvdXJjZUlkLFxufSBmcm9tIFwiYXdzLWNkay1saWIvY3VzdG9tLXJlc291cmNlc1wiO1xuXG5pbXBvcnQge1xuICBJZGVudGl0eVBvb2wsXG4gIFVzZXJQb29sQXV0aGVudGljYXRpb25Qcm92aWRlcixcbn0gZnJvbSBcIkBhd3MtY2RrL2F3cy1jb2duaXRvLWlkZW50aXR5cG9vbC1hbHBoYVwiO1xuaW1wb3J0IHsgTmFnU3VwcHJlc3Npb25zIH0gZnJvbSBcImNkay1uYWdcIjtcblxuZXhwb3J0IGludGVyZmFjZSBBdXRoUHJvcHMge1xuICB1c2VyTmFtZTogc3RyaW5nO1xuICB1c2VyRW1haWw6IHN0cmluZztcbiAgcmVmcmVzaFRva2VuVmFsaWRpdHk/OiBEdXJhdGlvbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb2duaXRvUGFyYW1zIHtcbiAgdXNlclBvb2xJZDogc3RyaW5nO1xuICB1c2VyUG9vbENsaWVudElkOiBzdHJpbmc7XG4gIGlkZW50aXR5UG9vbElkOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBBdXRoIGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IGNvZ25pdG9QYXJhbXM6IENvZ25pdG9QYXJhbXM7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbDogYXdzX2NvZ25pdG8uVXNlclBvb2w7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBdXRoUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgdGhpcy51c2VyUG9vbCA9IG5ldyBhd3NfY29nbml0by5Vc2VyUG9vbCh0aGlzLCBcInVzZXJwb29sXCIsIHtcbiAgICAgIHVzZXJQb29sTmFtZTogYCR7aWR9LWFwcC11c2VycG9vbGAsXG4gICAgICBzaWduSW5BbGlhc2VzOiB7XG4gICAgICAgIHVzZXJuYW1lOiB0cnVlLFxuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBhY2NvdW50UmVjb3Zlcnk6IGF3c19jb2duaXRvLkFjY291bnRSZWNvdmVyeS5FTUFJTF9PTkxZLFxuICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IGZhbHNlLFxuICAgICAgYXV0b1ZlcmlmeToge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5MZW5ndGg6IDgsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiB0cnVlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHVzZXJQb29sQ2xpZW50ID0gdGhpcy51c2VyUG9vbC5hZGRDbGllbnQoXCJ3ZWJhcHBDbGllbnRcIiwge1xuICAgICAgYXV0aEZsb3dzOiB7XG4gICAgICAgIGFkbWluVXNlclBhc3N3b3JkOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIHByZXZlbnRVc2VyRXhpc3RlbmNlRXJyb3JzOiB0cnVlLFxuICAgICAgcmVmcmVzaFRva2VuVmFsaWRpdHk6IHByb3BzLnJlZnJlc2hUb2tlblZhbGlkaXR5LFxuICAgIH0pO1xuXG4gICAgY29uc3QgaWRlbnRpdHlQb29sID0gbmV3IElkZW50aXR5UG9vbCh0aGlzLCBcImlkZW50aXR5UG9vbFwiLCB7XG4gICAgICBhbGxvd1VuYXV0aGVudGljYXRlZElkZW50aXRpZXM6IGZhbHNlLFxuICAgICAgYXV0aGVudGljYXRpb25Qcm92aWRlcnM6IHtcbiAgICAgICAgdXNlclBvb2xzOiBbXG4gICAgICAgICAgbmV3IFVzZXJQb29sQXV0aGVudGljYXRpb25Qcm92aWRlcih7XG4gICAgICAgICAgICB1c2VyUG9vbDogdGhpcy51c2VyUG9vbCxcbiAgICAgICAgICAgIHVzZXJQb29sQ2xpZW50LFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHRoaXMuY29nbml0b1BhcmFtcyA9IHtcbiAgICAgIHVzZXJQb29sSWQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIHVzZXJQb29sQ2xpZW50SWQ6IHVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICBpZGVudGl0eVBvb2xJZDogaWRlbnRpdHlQb29sLmlkZW50aXR5UG9vbElkLFxuICAgIH07XG5cbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIFwiVXNlclBvb2xJZFwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgIH0pO1xuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgXCJVc2VyUG9vbENsaWVudElkXCIsIHtcbiAgICAgIHZhbHVlOiB1c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgIH0pO1xuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgXCJJZGVudGl0eVBvb2xJZFwiLCB7XG4gICAgICB2YWx1ZTogaWRlbnRpdHlQb29sLmlkZW50aXR5UG9vbElkLFxuICAgIH0pO1xuXG4gICAgbmV3IENyZWF0ZVBvb2xVc2VyKHRoaXMsIFwiYWRtaW4tdXNlclwiLCB7XG4gICAgICBlbWFpbDogcHJvcHMudXNlckVtYWlsLFxuICAgICAgdXNlcm5hbWU6IHByb3BzLnVzZXJOYW1lLFxuICAgICAgdXNlclBvb2w6IHRoaXMudXNlclBvb2wsXG4gICAgfSk7XG5cbiAgICAvLyBTdXBwcmVzc2lvbnNcbiAgICBOYWdTdXBwcmVzc2lvbnMuYWRkUmVzb3VyY2VTdXBwcmVzc2lvbnModGhpcy51c2VyUG9vbCwgW1xuICAgICAge1xuICAgICAgICBpZDogXCJBd3NTb2x1dGlvbnMtQ09HMlwiLFxuICAgICAgICByZWFzb246IFwiTm8gbmVlZCBNRkEgZm9yIHNhbXBsZVwiLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IFwiQXdzU29sdXRpb25zLUNPRzNcIixcbiAgICAgICAgcmVhc29uOiBcIkRlcHJlY2F0ZWRcIixcbiAgICAgIH0sXG4gICAgXSk7XG4gIH1cbn1cblxuY2xhc3MgQ3JlYXRlUG9vbFVzZXIgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlcm5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgY29uc3RydWN0b3IoXG4gICAgc2NvcGU6IENvbnN0cnVjdCxcbiAgICBpZDogc3RyaW5nLFxuICAgIHByb3BzOiB7XG4gICAgICB1c2VyUG9vbDogYXdzX2NvZ25pdG8uSVVzZXJQb29sO1xuICAgICAgdXNlcm5hbWU6IHN0cmluZztcbiAgICAgIGVtYWlsOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgfVxuICApIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgY29uc3Qgc3RhdGVtZW50ID0gbmV3IGF3c19pYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFtcImNvZ25pdG8taWRwOkFkbWluRGVsZXRlVXNlclwiLCBcImNvZ25pdG8taWRwOkFkbWluQ3JlYXRlVXNlclwiXSxcbiAgICAgIHJlc291cmNlczogW3Byb3BzLnVzZXJQb29sLnVzZXJQb29sQXJuXSxcbiAgICB9KTtcblxuICAgIC8vIFRlbXDjg5Hjgrnjga9OZXRhcHAxIeOCkuWIqeeUqFxuICAgIG5ldyBBd3NDdXN0b21SZXNvdXJjZSh0aGlzLCBgQ3JlYXRlVXNlci0ke2lkfWAsIHtcbiAgICAgIG9uQ3JlYXRlOiB7XG4gICAgICAgIHNlcnZpY2U6IFwiQ29nbml0b0lkZW50aXR5U2VydmljZVByb3ZpZGVyXCIsXG4gICAgICAgIGFjdGlvbjogXCJhZG1pbkNyZWF0ZVVzZXJcIixcbiAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgIFVzZXJQb29sSWQ6IHByb3BzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgICAgVXNlcm5hbWU6IHByb3BzLnVzZXJuYW1lLFxuICAgICAgICAgIFRlbXBvcmFyeVBhc3N3b3JkOiBcIk5ldGFwcDEhXCIsXG4gICAgICAgICAgVXNlckF0dHJpYnV0ZXM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgTmFtZTogXCJlbWFpbFwiLFxuICAgICAgICAgICAgICBWYWx1ZTogcHJvcHMuZW1haWwsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBOYW1lOiBcImVtYWlsX3ZlcmlmaWVkXCIsXG4gICAgICAgICAgICAgIFZhbHVlOiBcInRydWVcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAgcGh5c2ljYWxSZXNvdXJjZUlkOiBQaHlzaWNhbFJlc291cmNlSWQub2YoXG4gICAgICAgICAgYENyZWF0ZVVzZXItJHtpZH0tJHtwcm9wcy51c2VybmFtZX1gXG4gICAgICAgICksXG4gICAgICB9LFxuICAgICAgb25EZWxldGU6IHtcbiAgICAgICAgc2VydmljZTogXCJDb2duaXRvSWRlbnRpdHlTZXJ2aWNlUHJvdmlkZXJcIixcbiAgICAgICAgYWN0aW9uOiBcImFkbWluRGVsZXRlVXNlclwiLFxuICAgICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgVXNlclBvb2xJZDogcHJvcHMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgICAgICBVc2VybmFtZTogcHJvcHMudXNlcm5hbWUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgcG9saWN5OiBBd3NDdXN0b21SZXNvdXJjZVBvbGljeS5mcm9tU3RhdGVtZW50cyhbc3RhdGVtZW50XSksXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==