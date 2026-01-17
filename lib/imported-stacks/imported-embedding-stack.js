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
exports.ImportedEmbeddingStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
class ImportedEmbeddingStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Embedding Lambda関数（インポート用）
        // 実際のインポート時には既存のEmbedding Lambda関数を取り込む
        const ragFunction = new lambda.Function(this, "ImportedEmbeddingRagFunction", {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: "index.handler",
            code: lambda.Code.fromInline(`
def handler(event, context):
    return {
        'statusCode': 200,
        'body': 'Embedding RAG function placeholder for import'
    }
      `),
            vpc: props.vpc,
            timeout: cdk.Duration.minutes(15),
            memorySize: 1024,
            environment: {
                DYNAMODB_TABLE_NAME: "imported-sessions-table",
                OPENSEARCH_ENDPOINT: "imported-opensearch-endpoint",
            },
        });
        const embeddingFunction = new lambda.Function(this, "ImportedEmbeddingFunction", {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: "index.handler",
            code: lambda.Code.fromInline(`
def handler(event, context):
    return {
        'statusCode': 200,
        'body': 'Embedding function placeholder for import'
    }
      `),
            vpc: props.vpc,
            timeout: cdk.Duration.minutes(15),
            memorySize: 2048,
        });
        // 出力
        new cdk.CfnOutput(this, "RagFunctionArn", {
            value: ragFunction.functionArn,
            description: "Imported RAG function ARN",
            exportName: `${this.stackName}-RagFunctionArn`,
        });
        new cdk.CfnOutput(this, "EmbeddingFunctionArn", {
            value: embeddingFunction.functionArn,
            description: "Imported embedding function ARN",
            exportName: `${this.stackName}-EmbeddingFunctionArn`,
        });
    }
}
exports.ImportedEmbeddingStack = ImportedEmbeddingStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1wb3J0ZWQtZW1iZWRkaW5nLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiaW1wb3J0ZWQtZW1iZWRkaW5nLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLCtEQUFpRDtBQVFqRCxNQUFhLHNCQUF1QixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ25ELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBa0M7UUFDMUUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsNkJBQTZCO1FBQzdCLHdDQUF3QztRQUN4QyxNQUFNLFdBQVcsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLDhCQUE4QixFQUFFO1lBQzVFLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLGVBQWU7WUFDeEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDOzs7Ozs7T0FNNUIsQ0FBQztZQUNGLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRztZQUNkLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsVUFBVSxFQUFFLElBQUk7WUFDaEIsV0FBVyxFQUFFO2dCQUNYLG1CQUFtQixFQUFFLHlCQUF5QjtnQkFDOUMsbUJBQW1CLEVBQUUsOEJBQThCO2FBQ3BEO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLDJCQUEyQixFQUFFO1lBQy9FLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLGVBQWU7WUFDeEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDOzs7Ozs7T0FNNUIsQ0FBQztZQUNGLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRztZQUNkLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsVUFBVSxFQUFFLElBQUk7U0FDakIsQ0FBQyxDQUFDO1FBRUgsS0FBSztRQUNMLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDeEMsS0FBSyxFQUFFLFdBQVcsQ0FBQyxXQUFXO1lBQzlCLFdBQVcsRUFBRSwyQkFBMkI7WUFDeEMsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsaUJBQWlCO1NBQy9DLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDOUMsS0FBSyxFQUFFLGlCQUFpQixDQUFDLFdBQVc7WUFDcEMsV0FBVyxFQUFFLGlDQUFpQztZQUM5QyxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyx1QkFBdUI7U0FDckQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBckRELHdEQXFEQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWxhbWJkYVwiO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtZWMyXCI7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIEltcG9ydGVkRW1iZWRkaW5nU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgdnBjOiBlYzIuSVZwYztcbn1cblxuZXhwb3J0IGNsYXNzIEltcG9ydGVkRW1iZWRkaW5nU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogSW1wb3J0ZWRFbWJlZGRpbmdTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBFbWJlZGRpbmcgTGFtYmRh6Zai5pWw77yI44Kk44Oz44Od44O844OI55So77yJXG4gICAgLy8g5a6f6Zqb44Gu44Kk44Oz44Od44O844OI5pmC44Gr44Gv5pei5a2Y44GuRW1iZWRkaW5nIExhbWJkYemWouaVsOOCkuWPluOCiui+vOOCgFxuICAgIGNvbnN0IHJhZ0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcIkltcG9ydGVkRW1iZWRkaW5nUmFnRnVuY3Rpb25cIiwge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXG4gICAgICBoYW5kbGVyOiBcImluZGV4LmhhbmRsZXJcIixcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuZGVmIGhhbmRsZXIoZXZlbnQsIGNvbnRleHQpOlxuICAgIHJldHVybiB7XG4gICAgICAgICdzdGF0dXNDb2RlJzogMjAwLFxuICAgICAgICAnYm9keSc6ICdFbWJlZGRpbmcgUkFHIGZ1bmN0aW9uIHBsYWNlaG9sZGVyIGZvciBpbXBvcnQnXG4gICAgfVxuICAgICAgYCksXG4gICAgICB2cGM6IHByb3BzLnZwYyxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICAgIG1lbW9yeVNpemU6IDEwMjQsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBEWU5BTU9EQl9UQUJMRV9OQU1FOiBcImltcG9ydGVkLXNlc3Npb25zLXRhYmxlXCIsXG4gICAgICAgIE9QRU5TRUFSQ0hfRU5EUE9JTlQ6IFwiaW1wb3J0ZWQtb3BlbnNlYXJjaC1lbmRwb2ludFwiLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGVtYmVkZGluZ0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcIkltcG9ydGVkRW1iZWRkaW5nRnVuY3Rpb25cIiwge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXG4gICAgICBoYW5kbGVyOiBcImluZGV4LmhhbmRsZXJcIixcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuZGVmIGhhbmRsZXIoZXZlbnQsIGNvbnRleHQpOlxuICAgIHJldHVybiB7XG4gICAgICAgICdzdGF0dXNDb2RlJzogMjAwLFxuICAgICAgICAnYm9keSc6ICdFbWJlZGRpbmcgZnVuY3Rpb24gcGxhY2Vob2xkZXIgZm9yIGltcG9ydCdcbiAgICB9XG4gICAgICBgKSxcbiAgICAgIHZwYzogcHJvcHMudnBjLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTUpLFxuICAgICAgbWVtb3J5U2l6ZTogMjA0OCxcbiAgICB9KTtcblxuICAgIC8vIOWHuuWKm1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiUmFnRnVuY3Rpb25Bcm5cIiwge1xuICAgICAgdmFsdWU6IHJhZ0Z1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgZGVzY3JpcHRpb246IFwiSW1wb3J0ZWQgUkFHIGZ1bmN0aW9uIEFSTlwiLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVJhZ0Z1bmN0aW9uQXJuYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiRW1iZWRkaW5nRnVuY3Rpb25Bcm5cIiwge1xuICAgICAgdmFsdWU6IGVtYmVkZGluZ0Z1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgZGVzY3JpcHRpb246IFwiSW1wb3J0ZWQgZW1iZWRkaW5nIGZ1bmN0aW9uIEFSTlwiLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUVtYmVkZGluZ0Z1bmN0aW9uQXJuYCxcbiAgICB9KTtcbiAgfVxufSJdfQ==