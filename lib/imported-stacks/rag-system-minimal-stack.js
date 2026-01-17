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
exports.RagSystemMinimalStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
class RagSystemMinimalStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // DynamoDB Tables のみをImport（Lambda関数は後で追加）
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
        new cdk.CfnOutput(this, "RagSystemTablesCount", {
            value: "3",
            description: "Number of RAG system DynamoDB tables imported",
        });
        new cdk.CfnOutput(this, "DocumentMetadataTableName", {
            value: documentMetadata.tableName,
            description: "RAG system document metadata table name",
        });
        new cdk.CfnOutput(this, "SessionsTableName", {
            value: sessions.tableName,
            description: "RAG system sessions table name",
        });
        new cdk.CfnOutput(this, "UserAccessTableName", {
            value: userAccess.tableName,
            description: "RAG system user access table name",
        });
    }
}
exports.RagSystemMinimalStack = RagSystemMinimalStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmFnLXN5c3RlbS1taW5pbWFsLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicmFnLXN5c3RlbS1taW5pbWFsLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLG1FQUFxRDtBQUdyRCxNQUFhLHFCQUFzQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ2xELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsMkNBQTJDO1FBQzNDLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUNwRSxTQUFTLEVBQUUsMENBQTBDO1lBQ3JELFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsWUFBWTtnQkFDbEIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtZQUN2QyxnQ0FBZ0MsRUFBRTtnQkFDaEMsMEJBQTBCLEVBQUUsSUFBSTthQUNqQztTQUNGLENBQUMsQ0FBQztRQUVILE1BQU0sUUFBUSxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFO1lBQ3BELFNBQVMsRUFBRSxpQ0FBaUM7WUFDNUMsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxXQUFXO2dCQUNqQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxXQUFXO2dCQUNqQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxNQUFNO1lBQ3ZDLGdDQUFnQyxFQUFFO2dCQUNoQywwQkFBMEIsRUFBRSxJQUFJO2FBQ2pDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsTUFBTSxVQUFVLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDeEQsU0FBUyxFQUFFLG9DQUFvQztZQUMvQyxZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELE9BQU8sRUFBRTtnQkFDUCxJQUFJLEVBQUUsWUFBWTtnQkFDbEIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtZQUN2QyxnQ0FBZ0MsRUFBRTtnQkFDaEMsMEJBQTBCLEVBQUUsSUFBSTthQUNqQztTQUNGLENBQUMsQ0FBQztRQUVILEtBQUs7UUFDTCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQzlDLEtBQUssRUFBRSxHQUFHO1lBQ1YsV0FBVyxFQUFFLCtDQUErQztTQUM3RCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLDJCQUEyQixFQUFFO1lBQ25ELEtBQUssRUFBRSxnQkFBZ0IsQ0FBQyxTQUFTO1lBQ2pDLFdBQVcsRUFBRSx5Q0FBeUM7U0FDdkQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUMzQyxLQUFLLEVBQUUsUUFBUSxDQUFDLFNBQVM7WUFDekIsV0FBVyxFQUFFLGdDQUFnQztTQUM5QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzdDLEtBQUssRUFBRSxVQUFVLENBQUMsU0FBUztZQUMzQixXQUFXLEVBQUUsbUNBQW1DO1NBQ2pELENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXpFRCxzREF5RUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSBcImF3cy1jZGstbGliXCI7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiXCI7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xuXG5leHBvcnQgY2xhc3MgUmFnU3lzdGVtTWluaW1hbFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gRHluYW1vREIgVGFibGVzIOOBruOBv+OCkkltcG9ydO+8iExhbWJkYemWouaVsOOBr+W+jOOBp+i/veWKoO+8iVxuICAgIGNvbnN0IGRvY3VtZW50TWV0YWRhdGEgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJEb2N1bWVudE1ldGFkYXRhXCIsIHtcbiAgICAgIHRhYmxlTmFtZTogXCJyYWctc3lzdGVtLWRldmVsb3BtZW50LWRvY3VtZW50LW1ldGFkYXRhXCIsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogXCJkb2N1bWVudElkXCIsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5U3BlY2lmaWNhdGlvbjoge1xuICAgICAgICBwb2ludEluVGltZVJlY292ZXJ5RW5hYmxlZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBzZXNzaW9ucyA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCBcIlNlc3Npb25zXCIsIHtcbiAgICAgIHRhYmxlTmFtZTogXCJyYWctc3lzdGVtLWRldmVsb3BtZW50LXNlc3Npb25zXCIsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogXCJzZXNzaW9uSWRcIixcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiBcInRpbWVzdGFtcFwiLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUixcbiAgICAgIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeVNwZWNpZmljYXRpb246IHtcbiAgICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeUVuYWJsZWQ6IHRydWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgdXNlckFjY2VzcyA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCBcIlVzZXJBY2Nlc3NcIiwge1xuICAgICAgdGFibGVOYW1lOiBcInJhZy1zeXN0ZW0tZGV2ZWxvcG1lbnQtdXNlci1hY2Nlc3NcIixcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiBcInVzZXJJZFwiLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6IFwicmVzb3VyY2VJZFwiLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeVNwZWNpZmljYXRpb246IHtcbiAgICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeUVuYWJsZWQ6IHRydWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8g5Ye65YqbXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJSYWdTeXN0ZW1UYWJsZXNDb3VudFwiLCB7XG4gICAgICB2YWx1ZTogXCIzXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJOdW1iZXIgb2YgUkFHIHN5c3RlbSBEeW5hbW9EQiB0YWJsZXMgaW1wb3J0ZWRcIixcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiRG9jdW1lbnRNZXRhZGF0YVRhYmxlTmFtZVwiLCB7XG4gICAgICB2YWx1ZTogZG9jdW1lbnRNZXRhZGF0YS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogXCJSQUcgc3lzdGVtIGRvY3VtZW50IG1ldGFkYXRhIHRhYmxlIG5hbWVcIixcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiU2Vzc2lvbnNUYWJsZU5hbWVcIiwge1xuICAgICAgdmFsdWU6IHNlc3Npb25zLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlJBRyBzeXN0ZW0gc2Vzc2lvbnMgdGFibGUgbmFtZVwiLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJVc2VyQWNjZXNzVGFibGVOYW1lXCIsIHtcbiAgICAgIHZhbHVlOiB1c2VyQWNjZXNzLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlJBRyBzeXN0ZW0gdXNlciBhY2Nlc3MgdGFibGUgbmFtZVwiLFxuICAgIH0pO1xuICB9XG59Il19