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
exports.BedrockAgentCoreIdentityConstruct = void 0;
const constructs_1 = require("constructs");
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
class BedrockAgentCoreIdentityConstruct extends constructs_1.Construct {
    lambdaFunction;
    executionRole;
    identityTable;
    constructor(scope, id, props = {}) {
        super(scope, id);
        // Create identity table
        this.identityTable = new dynamodb.Table(this, 'IdentityTable', {
            partitionKey: {
                name: 'userId',
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Create execution role
        this.executionRole = new iam.Role(this, 'ExecutionRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });
        // Grant DynamoDB permissions
        this.identityTable.grantReadWriteData(this.executionRole);
        // Create Lambda function
        this.lambdaFunction = new lambda.Function(this, 'Function', {
            functionName: props.functionName,
            description: props.description || 'Bedrock Agent Core Identity Function',
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Bedrock Agent Core Identity Function' })
          };
        };
      `),
            timeout: props.timeout || cdk.Duration.seconds(30),
            memorySize: props.memorySize || 128,
            environment: {
                ...props.environment,
                IDENTITY_TABLE_NAME: this.identityTable.tableName,
            },
            role: this.executionRole,
            logRetention: props.logRetention || logs.RetentionDays.ONE_WEEK,
        });
    }
}
exports.BedrockAgentCoreIdentityConstruct = BedrockAgentCoreIdentityConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1hZ2VudC1jb3JlLWlkZW50aXR5LWNvbnN0cnVjdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJlZHJvY2stYWdlbnQtY29yZS1pZGVudGl0eS1jb25zdHJ1Y3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwyQ0FBdUM7QUFDdkMsaURBQW1DO0FBQ25DLCtEQUFpRDtBQUNqRCx5REFBMkM7QUFDM0MsMkRBQTZDO0FBQzdDLG1FQUFxRDtBQVdyRCxNQUFhLGlDQUFrQyxTQUFRLHNCQUFTO0lBQzlDLGNBQWMsQ0FBa0I7SUFDaEMsYUFBYSxDQUFXO0lBQ3hCLGFBQWEsQ0FBaUI7SUFFOUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxRQUFnRCxFQUFFO1FBQzFGLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsd0JBQXdCO1FBQ3hCLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDN0QsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxRQUFRO2dCQUNkLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO1FBRUgsd0JBQXdCO1FBQ3hCLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDdkQsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLHNCQUFzQixDQUFDO1lBQzNELGVBQWUsRUFBRTtnQkFDZixHQUFHLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLDBDQUEwQyxDQUFDO2FBQ3ZGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsNkJBQTZCO1FBQzdCLElBQUksQ0FBQyxhQUFhLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBRTFELHlCQUF5QjtRQUN6QixJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFO1lBQzFELFlBQVksRUFBRSxLQUFLLENBQUMsWUFBWTtZQUNoQyxXQUFXLEVBQUUsS0FBSyxDQUFDLFdBQVcsSUFBSSxzQ0FBc0M7WUFDeEUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsZUFBZTtZQUN4QixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7Ozs7Ozs7O09BUTVCLENBQUM7WUFDRixPQUFPLEVBQUUsS0FBSyxDQUFDLE9BQU8sSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDbEQsVUFBVSxFQUFFLEtBQUssQ0FBQyxVQUFVLElBQUksR0FBRztZQUNuQyxXQUFXLEVBQUU7Z0JBQ1gsR0FBRyxLQUFLLENBQUMsV0FBVztnQkFDcEIsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTO2FBQ2xEO1lBQ0QsSUFBSSxFQUFFLElBQUksQ0FBQyxhQUFhO1lBQ3hCLFlBQVksRUFBRSxLQUFLLENBQUMsWUFBWSxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUTtTQUNoRSxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF0REQsOEVBc0RDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuXG5leHBvcnQgaW50ZXJmYWNlIEJlZHJvY2tBZ2VudENvcmVJZGVudGl0eUNvbnN0cnVjdFByb3BzIHtcbiAgcmVhZG9ubHkgZnVuY3Rpb25OYW1lPzogc3RyaW5nO1xuICByZWFkb25seSBkZXNjcmlwdGlvbj86IHN0cmluZztcbiAgcmVhZG9ubHkgdGltZW91dD86IGNkay5EdXJhdGlvbjtcbiAgcmVhZG9ubHkgbWVtb3J5U2l6ZT86IG51bWJlcjtcbiAgcmVhZG9ubHkgZW52aXJvbm1lbnQ/OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9O1xuICByZWFkb25seSBsb2dSZXRlbnRpb24/OiBsb2dzLlJldGVudGlvbkRheXM7XG59XG5cbmV4cG9ydCBjbGFzcyBCZWRyb2NrQWdlbnRDb3JlSWRlbnRpdHlDb25zdHJ1Y3QgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgbGFtYmRhRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGV4ZWN1dGlvblJvbGU6IGlhbS5Sb2xlO1xuICBwdWJsaWMgcmVhZG9ubHkgaWRlbnRpdHlUYWJsZTogZHluYW1vZGIuVGFibGU7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEJlZHJvY2tBZ2VudENvcmVJZGVudGl0eUNvbnN0cnVjdFByb3BzID0ge30pIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgLy8gQ3JlYXRlIGlkZW50aXR5IHRhYmxlXG4gICAgdGhpcy5pZGVudGl0eVRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdJZGVudGl0eVRhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICd1c2VySWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBleGVjdXRpb24gcm9sZVxuICAgIHRoaXMuZXhlY3V0aW9uUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnRXhlY3V0aW9uUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IER5bmFtb0RCIHBlcm1pc3Npb25zXG4gICAgdGhpcy5pZGVudGl0eVRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh0aGlzLmV4ZWN1dGlvblJvbGUpO1xuXG4gICAgLy8gQ3JlYXRlIExhbWJkYSBmdW5jdGlvblxuICAgIHRoaXMubGFtYmRhRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogcHJvcHMuZnVuY3Rpb25OYW1lLFxuICAgICAgZGVzY3JpcHRpb246IHByb3BzLmRlc2NyaXB0aW9uIHx8ICdCZWRyb2NrIEFnZW50IENvcmUgSWRlbnRpdHkgRnVuY3Rpb24nLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ0V2ZW50OicsIEpTT04uc3RyaW5naWZ5KGV2ZW50LCBudWxsLCAyKSk7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgbWVzc2FnZTogJ0JlZHJvY2sgQWdlbnQgQ29yZSBJZGVudGl0eSBGdW5jdGlvbicgfSlcbiAgICAgICAgICB9O1xuICAgICAgICB9O1xuICAgICAgYCksXG4gICAgICB0aW1lb3V0OiBwcm9wcy50aW1lb3V0IHx8IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IHByb3BzLm1lbW9yeVNpemUgfHwgMTI4LFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4ucHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICAgIElERU5USVRZX1RBQkxFX05BTUU6IHRoaXMuaWRlbnRpdHlUYWJsZS50YWJsZU5hbWUsXG4gICAgICB9LFxuICAgICAgcm9sZTogdGhpcy5leGVjdXRpb25Sb2xlLFxuICAgICAgbG9nUmV0ZW50aW9uOiBwcm9wcy5sb2dSZXRlbnRpb24gfHwgbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuICB9XG59XG4iXX0=