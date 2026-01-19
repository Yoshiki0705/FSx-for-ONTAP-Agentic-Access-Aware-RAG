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
exports.BedrockAgentCoreRuntimeConstruct = void 0;
const constructs_1 = require("constructs");
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class BedrockAgentCoreRuntimeConstruct extends constructs_1.Construct {
    lambdaFunction;
    executionRole;
    constructor(scope, id, props = {}) {
        super(scope, id);
        // Create execution role
        this.executionRole = new iam.Role(this, 'ExecutionRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });
        // Create Lambda function
        this.lambdaFunction = new lambda.Function(this, 'Function', {
            functionName: props.functionName,
            description: props.description || 'Bedrock Agent Core Runtime Function',
            runtime: props.lambdaConfig?.runtime || lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/agent-core-runtime'),
            timeout: props.lambdaConfig?.timeout || cdk.Duration.seconds(30),
            memorySize: props.lambdaConfig?.memorySize || 2048,
            environment: props.lambdaConfig?.environment,
            role: this.executionRole,
            logRetention: props.logRetention || logs.RetentionDays.ONE_WEEK,
        });
    }
}
exports.BedrockAgentCoreRuntimeConstruct = BedrockAgentCoreRuntimeConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1hZ2VudC1jb3JlLXJ1bnRpbWUtY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYmVkcm9jay1hZ2VudC1jb3JlLXJ1bnRpbWUtY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsMkNBQXVDO0FBQ3ZDLGlEQUFtQztBQUNuQywrREFBaUQ7QUFDakQseURBQTJDO0FBQzNDLDJEQUE2QztBQWdCN0MsTUFBYSxnQ0FBaUMsU0FBUSxzQkFBUztJQUM3QyxjQUFjLENBQWtCO0lBQ2hDLGFBQWEsQ0FBVztJQUV4QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLFFBQStDLEVBQUU7UUFDekYsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQix3QkFBd0I7UUFDeEIsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUN2RCxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsc0JBQXNCLENBQUM7WUFDM0QsZUFBZSxFQUFFO2dCQUNmLEdBQUcsQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsMENBQTBDLENBQUM7YUFDdkY7U0FDRixDQUFDLENBQUM7UUFFSCx5QkFBeUI7UUFDekIsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUMxRCxZQUFZLEVBQUUsS0FBSyxDQUFDLFlBQVk7WUFDaEMsV0FBVyxFQUFFLEtBQUssQ0FBQyxXQUFXLElBQUkscUNBQXFDO1lBQ3ZFLE9BQU8sRUFBRSxLQUFLLENBQUMsWUFBWSxFQUFFLE9BQU8sSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbEUsT0FBTyxFQUFFLGVBQWU7WUFDeEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLDJCQUEyQixDQUFDO1lBQ3hELE9BQU8sRUFBRSxLQUFLLENBQUMsWUFBWSxFQUFFLE9BQU8sSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDaEUsVUFBVSxFQUFFLEtBQUssQ0FBQyxZQUFZLEVBQUUsVUFBVSxJQUFJLElBQUk7WUFDbEQsV0FBVyxFQUFFLEtBQUssQ0FBQyxZQUFZLEVBQUUsV0FBVztZQUM1QyxJQUFJLEVBQUUsSUFBSSxDQUFDLGFBQWE7WUFDeEIsWUFBWSxFQUFFLEtBQUssQ0FBQyxZQUFZLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRO1NBQ2hFLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTdCRCw0RUE2QkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcblxuZXhwb3J0IGludGVyZmFjZSBMYW1iZGFDb25maWcge1xuICByZWFkb25seSBydW50aW1lPzogbGFtYmRhLlJ1bnRpbWU7XG4gIHJlYWRvbmx5IHRpbWVvdXQ/OiBjZGsuRHVyYXRpb247XG4gIHJlYWRvbmx5IG1lbW9yeVNpemU/OiBudW1iZXI7XG4gIHJlYWRvbmx5IGVudmlyb25tZW50PzogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCZWRyb2NrQWdlbnRDb3JlUnVudGltZUNvbnN0cnVjdFByb3BzIHtcbiAgcmVhZG9ubHkgZnVuY3Rpb25OYW1lPzogc3RyaW5nO1xuICByZWFkb25seSBkZXNjcmlwdGlvbj86IHN0cmluZztcbiAgcmVhZG9ubHkgbGFtYmRhQ29uZmlnPzogTGFtYmRhQ29uZmlnO1xuICByZWFkb25seSBsb2dSZXRlbnRpb24/OiBsb2dzLlJldGVudGlvbkRheXM7XG59XG5cbmV4cG9ydCBjbGFzcyBCZWRyb2NrQWdlbnRDb3JlUnVudGltZUNvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyByZWFkb25seSBsYW1iZGFGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgZXhlY3V0aW9uUm9sZTogaWFtLlJvbGU7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEJlZHJvY2tBZ2VudENvcmVSdW50aW1lQ29uc3RydWN0UHJvcHMgPSB7fSkge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyBDcmVhdGUgZXhlY3V0aW9uIHJvbGVcbiAgICB0aGlzLmV4ZWN1dGlvblJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0V4ZWN1dGlvblJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgTGFtYmRhIGZ1bmN0aW9uXG4gICAgdGhpcy5sYW1iZGFGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0Z1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiBwcm9wcy5mdW5jdGlvbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogcHJvcHMuZGVzY3JpcHRpb24gfHwgJ0JlZHJvY2sgQWdlbnQgQ29yZSBSdW50aW1lIEZ1bmN0aW9uJyxcbiAgICAgIHJ1bnRpbWU6IHByb3BzLmxhbWJkYUNvbmZpZz8ucnVudGltZSB8fCBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2FnZW50LWNvcmUtcnVudGltZScpLFxuICAgICAgdGltZW91dDogcHJvcHMubGFtYmRhQ29uZmlnPy50aW1lb3V0IHx8IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IHByb3BzLmxhbWJkYUNvbmZpZz8ubWVtb3J5U2l6ZSB8fCAyMDQ4LFxuICAgICAgZW52aXJvbm1lbnQ6IHByb3BzLmxhbWJkYUNvbmZpZz8uZW52aXJvbm1lbnQsXG4gICAgICByb2xlOiB0aGlzLmV4ZWN1dGlvblJvbGUsXG4gICAgICBsb2dSZXRlbnRpb246IHByb3BzLmxvZ1JldGVudGlvbiB8fCBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==