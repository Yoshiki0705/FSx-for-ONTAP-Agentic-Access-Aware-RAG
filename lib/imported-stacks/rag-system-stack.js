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
exports.RagSystemStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
class RagSystemStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // RAG System Lambda Functions (実際のImport時に既存リソースを取り込む)
        // Core RAG Functions
        const cleanupScheduler = new lambda.Function(this, "CleanupScheduler", {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: "index.handler",
            code: lambda.Code.fromInline("# Placeholder for import"),
            functionName: "rag-system-dev-cleanup-scheduler",
            timeout: cdk.Duration.minutes(15),
            memorySize: 512,
            // ServiceRoleは既存のものを使用するため、CDK管理外とする
            role: undefined,
        });
        const healthCheck = new lambda.Function(this, "HealthCheck", {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: "index.handler",
            code: lambda.Code.fromInline("# Placeholder for import"),
            functionName: "rag-system-dev-health-check",
            timeout: cdk.Duration.minutes(5),
            memorySize: 256,
        });
        const indexUpdater = new lambda.Function(this, "IndexUpdater", {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: "index.handler",
            code: lambda.Code.fromInline("# Placeholder for import"),
            functionName: "rag-system-dev-index-updater",
            timeout: cdk.Duration.minutes(15),
            memorySize: 1024,
        });
        const documentProcessor = new lambda.Function(this, "DocumentProcessor", {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: "index.handler",
            code: lambda.Code.fromInline("# Placeholder for import"),
            functionName: "rag-system-dev-document-processor",
            timeout: cdk.Duration.minutes(15),
            memorySize: 1024,
        });
        const authHandler = new lambda.Function(this, "AuthHandler", {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: "index.handler",
            code: lambda.Code.fromInline("# Placeholder for import"),
            functionName: "rag-system-dev-auth-handler",
            timeout: cdk.Duration.minutes(5),
            memorySize: 512,
        });
        const userSession = new lambda.Function(this, "UserSession", {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: "index.handler",
            code: lambda.Code.fromInline("# Placeholder for import"),
            functionName: "rag-system-dev-user-session",
            timeout: cdk.Duration.minutes(5),
            memorySize: 512,
        });
        const documentSearch = new lambda.Function(this, "DocumentSearch", {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: "index.handler",
            code: lambda.Code.fromInline("# Placeholder for import"),
            functionName: "rag-system-dev-document-search",
            timeout: cdk.Duration.minutes(10),
            memorySize: 1024,
        });
        const embeddingGenerator = new lambda.Function(this, "EmbeddingGenerator", {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: "index.handler",
            code: lambda.Code.fromInline("# Placeholder for import"),
            functionName: "rag-system-dev-embedding-generator",
            timeout: cdk.Duration.minutes(15),
            memorySize: 2048,
        });
        const permissionCheck = new lambda.Function(this, "PermissionCheck", {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: "index.handler",
            code: lambda.Code.fromInline("# Placeholder for import"),
            functionName: "rag-system-dev-permission-check",
            timeout: cdk.Duration.minutes(5),
            memorySize: 512,
        });
        const metricsCollector = new lambda.Function(this, "MetricsCollector", {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: "index.handler",
            code: lambda.Code.fromInline("# Placeholder for import"),
            functionName: "rag-system-dev-metrics-collector",
            timeout: cdk.Duration.minutes(10),
            memorySize: 512,
        });
        const logProcessor = new lambda.Function(this, "LogProcessor", {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: "index.handler",
            code: lambda.Code.fromInline("# Placeholder for import"),
            functionName: "rag-system-dev-log-processor",
            timeout: cdk.Duration.minutes(10),
            memorySize: 512,
        });
        // DynamoDB Tables
        const documentMetadata = new dynamodb.Table(this, "DocumentMetadata", {
            tableName: "rag-system-development-document-metadata",
            partitionKey: {
                name: "documentId",
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecoverySpecification: {
                pointInTimeRecoveryEnabled: true,
            },
        });
        const sessions = new dynamodb.Table(this, "Sessions", {
            tableName: "rag-system-development-sessions",
            partitionKey: {
                name: "sessionId",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: "timestamp",
                type: dynamodb.AttributeType.NUMBER,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecoverySpecification: {
                pointInTimeRecoveryEnabled: true,
            },
        });
        const userAccess = new dynamodb.Table(this, "UserAccess", {
            tableName: "rag-system-development-user-access",
            partitionKey: {
                name: "userId",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: "resourceId",
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecoverySpecification: {
                pointInTimeRecoveryEnabled: true,
            },
        });
        // 出力
        new cdk.CfnOutput(this, "RagSystemFunctionsCount", {
            value: "11",
            description: "Number of RAG system Lambda functions",
        });
        new cdk.CfnOutput(this, "RagSystemTablesCount", {
            value: "3",
            description: "Number of RAG system DynamoDB tables",
        });
    }
}
exports.RagSystemStack = RagSystemStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmFnLXN5c3RlbS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInJhZy1zeXN0ZW0tc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsK0RBQWlEO0FBQ2pELG1FQUFxRDtBQVFyRCxNQUFhLGNBQWUsU0FBUSxHQUFHLENBQUMsS0FBSztJQUMzQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTJCO1FBQ25FLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLHVEQUF1RDtRQUV2RCxxQkFBcUI7UUFDckIsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQ3JFLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLGVBQWU7WUFDeEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLDBCQUEwQixDQUFDO1lBQ3hELFlBQVksRUFBRSxrQ0FBa0M7WUFDaEQsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxVQUFVLEVBQUUsR0FBRztZQUNmLHFDQUFxQztZQUNyQyxJQUFJLEVBQUUsU0FBUztTQUNoQixDQUFDLENBQUM7UUFFSCxNQUFNLFdBQVcsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUMzRCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxlQUFlO1lBQ3hCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQywwQkFBMEIsQ0FBQztZQUN4RCxZQUFZLEVBQUUsNkJBQTZCO1lBQzNDLE9BQU8sRUFBRSxHQUFHLENB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LFNBQVMsRUFBRSxvQ0FBb0M7WUFDL0MsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxRQUFRO2dCQUNkLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxPQUFPLEVBQUU7Z0JBQ1AsSUFBSSxFQUFFLFlBQVk7Z0JBQ2xCLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU07WUFDdkMsZ0NBQWdDLEVBQUU7Z0JBQ2hDLDBCQUEwQixFQUFFLElBQUk7YUFDakM7U0FDRixDQUFDLENBQUM7UUFFSCxLQUFLO1FBQ0wsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSx5QkFBeUIsRUFBRTtZQUNqRCxLQUFLLEVBQUUsSUFBSTtZQUNYLFdBQVcsRUFBRSx1Q0FBdUM7U0FDckQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUM5QyxLQUFLLEVBQUUsR0FBRztZQUNWLFdBQVcsRUFBRSxzQ0FBc0M7U0FDcEQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBdktELHdDQXVLQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWxhbWJkYVwiO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSBcImF3cy1jZGstbGliL2F3cy1keW5hbW9kYlwiO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtZWMyXCI7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJhZ1N5c3RlbVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHZwYz86IGVjMi5JVnBjO1xufVxuXG5leHBvcnQgY2xhc3MgUmFnU3lzdGVtU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IFJhZ1N5c3RlbVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIFJBRyBTeXN0ZW0gTGFtYmRhIEZ1bmN0aW9ucyAo5a6f6Zqb44GuSW1wb3J05pmC44Gr5pei5a2Y44Oq44K944O844K544KS5Y+W44KK6L6844KAKVxuICAgIFxuICAgIC8vIENvcmUgUkFHIEZ1bmN0aW9uc1xuICAgIGNvbnN0IGNsZWFudXBTY2hlZHVsZXIgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwiQ2xlYW51cFNjaGVkdWxlclwiLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcbiAgICAgIGhhbmRsZXI6IFwiaW5kZXguaGFuZGxlclwiLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShcIiMgUGxhY2Vob2xkZXIgZm9yIGltcG9ydFwiKSxcbiAgICAgIGZ1bmN0aW9uTmFtZTogXCJyYWctc3lzdGVtLWRldi1jbGVhbnVwLXNjaGVkdWxlclwiLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTUpLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgLy8gU2VydmljZVJvbGXjga/ml6LlrZjjga7jgoLjga7jgpLkvb/nlKjjgZnjgovjgZ/jgoHjgIFDREvnrqHnkIblpJbjgajjgZnjgotcbiAgICAgIHJvbGU6IHVuZGVmaW5lZCxcbiAgICB9KTtcblxuICAgIGNvbnN0IGhlYWx0aENoZWNrID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcIkhlYWx0aENoZWNrXCIsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxuICAgICAgaGFuZGxlcjogXCJpbmRleC5oYW5kbGVyXCIsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKFwiIyBQbGFjZWhvbGRlciBmb3IgaW1wb3J0XCIpLFxuICAgICAgZnVuY3Rpb25OYW1lOiBcInJhZy1zeXN0ZW0tZGV2LWhlYWx0aC1jaGVja1wiLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgfSk7XG5cbiAgICBjb25zdCBpbmRleFVwZGF0ZXIgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwiSW5kZXhVcGRhdGVyXCIsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxuICAgICAgaGFuZGxlcjogXCJpbmRleC5oYW5kbGVyXCIsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKFwiIyBQbGFjZWhvbGRlciBmb3IgaW1wb3J0XCIpLFxuICAgICAgZnVuY3Rpb25OYW1lOiBcInJhZy1zeXN0ZW0tZGV2LWluZGV4LXVwZGF0ZXJcIixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICAgIG1lbW9yeVNpemU6IDEwMjQsXG4gICAgfSk7XG5cbiAgICBjb25zdCBkb2N1bWVudFByb2Nlc3NvciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJEb2N1bWVudFByb2Nlc3NvclwiLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcbiAgICAgIGhhbmRsZXI6IFwiaW5kZXguaGFuZGxlclwiLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShcIiMgUGxhY2Vob2xkZXIgZm9yIGltcG9ydFwiKSxcbiAgICAgIGZ1bmN0aW9uTmFtZTogXCJyYWctc3lzdGVtLWRldi1kb2N1bWVudC1wcm9jZXNzb3JcIixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICAgIG1lbW9yeVNpemU6IDEwMjQsXG4gICAgfSk7XG5cbiAgICBjb25zdCBhdXRoSGFuZGxlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJBdXRoSGFuZGxlclwiLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcbiAgICAgIGhhbmRsZXI6IFwiaW5kZXguaGFuZGxlclwiLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShcIiMgUGxhY2Vob2xkZXIgZm9yIGltcG9ydFwiKSxcbiAgICAgIGZ1bmN0aW9uTmFtZTogXCJyYWctc3lzdGVtLWRldi1hdXRoLWhhbmRsZXJcIixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdXNlclNlc3Npb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwiVXNlclNlc3Npb25cIiwge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXG4gICAgICBoYW5kbGVyOiBcImluZGV4LmhhbmRsZXJcIixcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoXCIjIFBsYWNlaG9sZGVyIGZvciBpbXBvcnRcIiksXG4gICAgICBmdW5jdGlvbk5hbWU6IFwicmFnLXN5c3RlbS1kZXYtdXNlci1zZXNzaW9uXCIsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICB9KTtcblxuICAgIGNvbnN0IGRvY3VtZW50U2VhcmNoID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcIkRvY3VtZW50U2VhcmNoXCIsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxuICAgICAgaGFuZGxlcjogXCJpbmRleC5oYW5kbGVyXCIsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKFwiIyBQbGFjZWhvbGRlciBmb3IgaW1wb3J0XCIpLFxuICAgICAgZnVuY3Rpb25OYW1lOiBcInJhZy1zeXN0ZW0tZGV2LWRvY3VtZW50LXNlYXJjaFwiLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTApLFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcbiAgICB9KTtcblxuICAgIGNvbnN0IGVtYmVkZGluZ0dlbmVyYXRvciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJFbWJlZGRpbmdHZW5lcmF0b3JcIiwge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXG4gICAgICBoYW5kbGVyOiBcImluZGV4LmhhbmRsZXJcIixcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoXCIjIFBsYWNlaG9sZGVyIGZvciBpbXBvcnRcIiksXG4gICAgICBmdW5jdGlvbk5hbWU6IFwicmFnLXN5c3RlbS1kZXYtZW1iZWRkaW5nLWdlbmVyYXRvclwiLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTUpLFxuICAgICAgbWVtb3J5U2l6ZTogMjA0OCxcbiAgICB9KTtcblxuICAgIGNvbnN0IHBlcm1pc3Npb25DaGVjayA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJQZXJtaXNzaW9uQ2hlY2tcIiwge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXG4gICAgICBoYW5kbGVyOiBcImluZGV4LmhhbmRsZXJcIixcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoXCIjIFBsYWNlaG9sZGVyIGZvciBpbXBvcnRcIiksXG4gICAgICBmdW5jdGlvbk5hbWU6IFwicmFnLXN5c3RlbS1kZXYtcGVybWlzc2lvbi1jaGVja1wiLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgfSk7XG5cbiAgICBjb25zdCBtZXRyaWNzQ29sbGVjdG9yID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcIk1ldHJpY3NDb2xsZWN0b3JcIiwge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXG4gICAgICBoYW5kbGVyOiBcImluZGV4LmhhbmRsZXJcIixcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoXCIjIFBsYWNlaG9sZGVyIGZvciBpbXBvcnRcIiksXG4gICAgICBmdW5jdGlvbk5hbWU6IFwicmFnLXN5c3RlbS1kZXYtbWV0cmljcy1jb2xsZWN0b3JcIixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDEwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICB9KTtcblxuICAgIGNvbnN0IGxvZ1Byb2Nlc3NvciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJMb2dQcm9jZXNzb3JcIiwge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXG4gICAgICBoYW5kbGVyOiBcImluZGV4LmhhbmRsZXJcIixcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoXCIjIFBsYWNlaG9sZGVyIGZvciBpbXBvcnRcIiksXG4gICAgICBmdW5jdGlvbk5hbWU6IFwicmFnLXN5c3RlbS1kZXYtbG9nLXByb2Nlc3NvclwiLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTApLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgIH0pO1xuXG4gICAgLy8gRHluYW1vREIgVGFibGVzXG4gICAgY29uc3QgZG9jdW1lbnRNZXRhZGF0YSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCBcIkRvY3VtZW50TWV0YWRhdGFcIiwge1xuICAgICAgdGFibGVOYW1lOiBcInJhZy1zeXN0ZW0tZGV2ZWxvcG1lbnQtZG9jdW1lbnQtbWV0YWRhdGFcIixcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiBcImRvY3VtZW50SWRcIixcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgIHBvaW50SW5UaW1lUmVjb3ZlcnlTcGVjaWZpY2F0aW9uOiB7XG4gICAgICAgIHBvaW50SW5UaW1lUmVjb3ZlcnlFbmFibGVkOiB0cnVlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHNlc3Npb25zID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsIFwiU2Vzc2lvbnNcIiwge1xuICAgICAgdGFibGVOYW1lOiBcInJhZy1zeXN0ZW0tZGV2ZWxvcG1lbnQtc2Vzc2lvbnNcIixcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiBcInNlc3Npb25JZFwiLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6IFwidGltZXN0YW1wXCIsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSLFxuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5U3BlY2lmaWNhdGlvbjoge1xuICAgICAgICBwb2ludEluVGltZVJlY292ZXJ5RW5hYmxlZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCB1c2VyQWNjZXNzID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsIFwiVXNlckFjY2Vzc1wiLCB7XG4gICAgICB0YWJsZU5hbWU6IFwicmFnLXN5c3RlbS1kZXZlbG9wbWVudC11c2VyLWFjY2Vzc1wiLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6IFwidXNlcklkXCIsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogXCJyZXNvdXJjZUlkXCIsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5U3BlY2lmaWNhdGlvbjoge1xuICAgICAgICBwb2ludEluVGltZVJlY292ZXJ5RW5hYmxlZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyDlh7rliptcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlJhZ1N5c3RlbUZ1bmN0aW9uc0NvdW50XCIsIHtcbiAgICAgIHZhbHVlOiBcIjExXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJOdW1iZXIgb2YgUkFHIHN5c3RlbSBMYW1iZGEgZnVuY3Rpb25zXCIsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlJhZ1N5c3RlbVRhYmxlc0NvdW50XCIsIHtcbiAgICAgIHZhbHVlOiBcIjNcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIk51bWJlciBvZiBSQUcgc3lzdGVtIER5bmFtb0RCIHRhYmxlc1wiLFxuICAgIH0pO1xuICB9XG59Il19