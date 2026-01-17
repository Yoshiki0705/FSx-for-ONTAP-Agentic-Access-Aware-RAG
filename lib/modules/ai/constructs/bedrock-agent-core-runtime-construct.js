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
            code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Bedrock Agent Core Runtime Function' })
          };
        };
      `),
            timeout: props.lambdaConfig?.timeout || cdk.Duration.seconds(30),
            memorySize: props.lambdaConfig?.memorySize || 128,
            environment: props.lambdaConfig?.environment,
            role: this.executionRole,
            logRetention: props.logRetention || logs.RetentionDays.ONE_WEEK,
        });
    }
}
exports.BedrockAgentCoreRuntimeConstruct = BedrockAgentCoreRuntimeConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1hZ2VudC1jb3JlLXJ1bnRpbWUtY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYmVkcm9jay1hZ2VudC1jb3JlLXJ1bnRpbWUtY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsMkNBQXVDO0FBQ3ZDLGlEQUFtQztBQUNuQywrREFBaUQ7QUFDakQseURBQTJDO0FBQzNDLDJEQUE2QztBQWdCN0MsTUFBYSxnQ0FBaUMsU0FBUSxzQkFBUztJQUM3QyxjQUFjLENBQWtCO0lBQ2hDLGFBQWEsQ0FBVztJQUV4QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLFFBQStDLEVBQUU7UUFDekYsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQix3QkFBd0I7UUFDeEIsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUN2RCxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsc0JBQXNCLENBQUM7WUFDM0QsZUFBZSxFQUFFO2dCQUNmLEdBQUcsQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsMENBQTBDLENBQUM7YUFDdkY7U0FDRixDQUFDLENBQUM7UUFFSCx5QkFBeUI7UUFDekIsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUMxRCxZQUFZLEVBQUUsS0FBSyxDQUFDLFlBQVk7WUFDaEMsV0FBVyxFQUFFLEtBQUssQ0FBQyxXQUFXLElBQUkscUNBQXFDO1lBQ3ZFLE9BQU8sRUFBRSxLQUFLLENBQUMsWUFBWSxFQUFFLE9BQU8sSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbEUsT0FBTyxFQUFFLGVBQWU7WUFDeEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDOzs7Ozs7OztPQVE1QixDQUFDO1lBQ0YsT0FBTyxFQUFFLEtBQUssQ0FBQyxZQUFZLEVBQUUsT0FBTyxJQUFJLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNoRSxVQUFVLEVBQUUsS0FBSyxDQUFDLFlBQVksRUFBRSxVQUFVLElBQUksR0FBRztZQUNqRCxXQUFXLEVBQUUsS0FBSyxDQUFDLFlBQVksRUFBRSxXQUFXO1lBQzVDLElBQUksRUFBRSxJQUFJLENBQUMsYUFBYTtZQUN4QixZQUFZLEVBQUUsS0FBSyxDQUFDLFlBQVksSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVE7U0FDaEUsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBckNELDRFQXFDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuXG5leHBvcnQgaW50ZXJmYWNlIExhbWJkYUNvbmZpZyB7XG4gIHJlYWRvbmx5IHJ1bnRpbWU/OiBsYW1iZGEuUnVudGltZTtcbiAgcmVhZG9ubHkgdGltZW91dD86IGNkay5EdXJhdGlvbjtcbiAgcmVhZG9ubHkgbWVtb3J5U2l6ZT86IG51bWJlcjtcbiAgcmVhZG9ubHkgZW52aXJvbm1lbnQ/OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJlZHJvY2tBZ2VudENvcmVSdW50aW1lQ29uc3RydWN0UHJvcHMge1xuICByZWFkb25seSBmdW5jdGlvbk5hbWU/OiBzdHJpbmc7XG4gIHJlYWRvbmx5IGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuICByZWFkb25seSBsYW1iZGFDb25maWc/OiBMYW1iZGFDb25maWc7XG4gIHJlYWRvbmx5IGxvZ1JldGVudGlvbj86IGxvZ3MuUmV0ZW50aW9uRGF5cztcbn1cblxuZXhwb3J0IGNsYXNzIEJlZHJvY2tBZ2VudENvcmVSdW50aW1lQ29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IGxhbWJkYUZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBleGVjdXRpb25Sb2xlOiBpYW0uUm9sZTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQmVkcm9ja0FnZW50Q29yZVJ1bnRpbWVDb25zdHJ1Y3RQcm9wcyA9IHt9KSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIC8vIENyZWF0ZSBleGVjdXRpb24gcm9sZVxuICAgIHRoaXMuZXhlY3V0aW9uUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnRXhlY3V0aW9uUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBMYW1iZGEgZnVuY3Rpb25cbiAgICB0aGlzLmxhbWJkYUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IHByb3BzLmZ1bmN0aW9uTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBwcm9wcy5kZXNjcmlwdGlvbiB8fCAnQmVkcm9jayBBZ2VudCBDb3JlIFJ1bnRpbWUgRnVuY3Rpb24nLFxuICAgICAgcnVudGltZTogcHJvcHMubGFtYmRhQ29uZmlnPy5ydW50aW1lIHx8IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdFdmVudDonLCBKU09OLnN0cmluZ2lmeShldmVudCwgbnVsbCwgMikpO1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IG1lc3NhZ2U6ICdCZWRyb2NrIEFnZW50IENvcmUgUnVudGltZSBGdW5jdGlvbicgfSlcbiAgICAgICAgICB9O1xuICAgICAgICB9O1xuICAgICAgYCksXG4gICAgICB0aW1lb3V0OiBwcm9wcy5sYW1iZGFDb25maWc/LnRpbWVvdXQgfHwgY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogcHJvcHMubGFtYmRhQ29uZmlnPy5tZW1vcnlTaXplIHx8IDEyOCxcbiAgICAgIGVudmlyb25tZW50OiBwcm9wcy5sYW1iZGFDb25maWc/LmVudmlyb25tZW50LFxuICAgICAgcm9sZTogdGhpcy5leGVjdXRpb25Sb2xlLFxuICAgICAgbG9nUmV0ZW50aW9uOiBwcm9wcy5sb2dSZXRlbnRpb24gfHwgbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuICB9XG59XG4iXX0=