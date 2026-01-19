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
exports.ImportedStorageStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const opensearch = __importStar(require("aws-cdk-lib/aws-opensearchserverless"));
class ImportedStorageStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // S3バケット（インポート用）
        const documentsBucket = new s3.Bucket(this, "ImportedDocumentsBucket", {
            bucketName: `imported-documents-bucket-${cdk.Aws.ACCOUNT_ID}`,
            versioned: true,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            lifecycleRules: [
                {
                    id: "DeleteOldVersions",
                    enabled: true,
                    noncurrentVersionExpiration: cdk.Duration.days(30),
                },
            ],
        });
        // OpenSearch Serverlessコレクション（インポート用）
        const vectorCollection = new opensearch.CfnCollection(this, "ImportedVectorCollection", {
            name: "imported-vector-collection",
            type: "VECTORSEARCH",
            description: "Imported vector search collection for RAG system",
        });
        // FSx for NetApp ONTAPファイルシステム（プレースホルダー）
        // 実際のインポート時には既存のFSxリソースを取り込む
        // 出力
        new cdk.CfnOutput(this, "DocumentsBucketName", {
            value: documentsBucket.bucketName,
            description: "Imported documents bucket name",
            exportName: `${this.stackName}-DocumentsBucketName`,
        });
        new cdk.CfnOutput(this, "VectorCollectionArn", {
            value: vectorCollection.attrArn,
            description: "Imported vector collection ARN",
            exportName: `${this.stackName}-VectorCollectionArn`,
        });
        new cdk.CfnOutput(this, "VectorCollectionEndpoint", {
            value: vectorCollection.attrCollectionEndpoint,
            description: "Imported vector collection endpoint",
            exportName: `${this.stackName}-VectorCollectionEndpoint`,
        });
    }
}
exports.ImportedStorageStack = ImportedStorageStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1wb3J0ZWQtc3RvcmFnZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImltcG9ydGVkLXN0b3JhZ2Utc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsdURBQXlDO0FBQ3pDLGlGQUFtRTtBQVFuRSxNQUFhLG9CQUFxQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ2pELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0M7UUFDeEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsaUJBQWlCO1FBQ2pCLE1BQU0sZUFBZSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUseUJBQXlCLEVBQUU7WUFDckUsVUFBVSxFQUFFLDZCQUE2QixHQUFHLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRTtZQUM3RCxTQUFTLEVBQUUsSUFBSTtZQUNmLFVBQVUsRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsVUFBVTtZQUMxQyxpQkFBaUIsRUFBRSxFQUFFLENBQUMsaUJBQWlCLENBQUMsU0FBUztZQUNqRCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxNQUFNO1lBQ3ZDLGNBQWMsRUFBRTtnQkFDZDtvQkFDRSxFQUFFLEVBQUUsbUJBQW1CO29CQUN2QixPQUFPLEVBQUUsSUFBSTtvQkFDYiwyQkFBMkIsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7aUJBQ25EO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCxzQ0FBc0M7UUFDdEMsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLFVBQVUsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLDBCQUEwQixFQUFFO1lBQ3RGLElBQUksRUFBRSw0QkFBNEI7WUFDbEMsSUFBSSxFQUFFLGNBQWM7WUFDcEIsV0FBVyxFQUFFLGtEQUFrRDtTQUNoRSxDQUFDLENBQUM7UUFFSCx5Q0FBeUM7UUFDekMsNkJBQTZCO1FBRTdCLEtBQUs7UUFDTCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzdDLEtBQUssRUFBRSxlQUFlLENBQUMsVUFBVTtZQUNqQyxXQUFXLEVBQUUsZ0NBQWdDO1lBQzdDLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLHNCQUFzQjtTQUNwRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzdDLEtBQUssRUFBRSxnQkFBZ0IsQ0FBQyxPQUFPO1lBQy9CLFdBQVcsRUFBRSxnQ0FBZ0M7WUFDN0MsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsc0JBQXNCO1NBQ3BELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsMEJBQTBCLEVBQUU7WUFDbEQsS0FBSyxFQUFFLGdCQUFnQixDQUFDLHNCQUFzQjtZQUM5QyxXQUFXLEVBQUUscUNBQXFDO1lBQ2xELFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLDJCQUEyQjtTQUN6RCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFqREQsb0RBaURDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gXCJhd3MtY2RrLWxpYlwiO1xuaW1wb3J0ICogYXMgczMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1zM1wiO1xuaW1wb3J0ICogYXMgb3BlbnNlYXJjaCBmcm9tIFwiYXdzLWNkay1saWIvYXdzLW9wZW5zZWFyY2hzZXJ2ZXJsZXNzXCI7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSBcImF3cy1jZGstbGliL2F3cy1lYzJcIjtcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gXCJjb25zdHJ1Y3RzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW1wb3J0ZWRTdG9yYWdlU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgdnBjOiBlYzIuSVZwYztcbn1cblxuZXhwb3J0IGNsYXNzIEltcG9ydGVkU3RvcmFnZVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEltcG9ydGVkU3RvcmFnZVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIFMz44OQ44Kx44OD44OI77yI44Kk44Oz44Od44O844OI55So77yJXG4gICAgY29uc3QgZG9jdW1lbnRzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCBcIkltcG9ydGVkRG9jdW1lbnRzQnVja2V0XCIsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBpbXBvcnRlZC1kb2N1bWVudHMtYnVja2V0LSR7Y2RrLkF3cy5BQ0NPVU5UX0lEfWAsXG4gICAgICB2ZXJzaW9uZWQ6IHRydWUsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiBcIkRlbGV0ZU9sZFZlcnNpb25zXCIsXG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBub25jdXJyZW50VmVyc2lvbkV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBPcGVuU2VhcmNoIFNlcnZlcmxlc3PjgrPjg6zjgq/jgrfjg6fjg7PvvIjjgqTjg7Pjg53jg7zjg4jnlKjvvIlcbiAgICBjb25zdCB2ZWN0b3JDb2xsZWN0aW9uID0gbmV3IG9wZW5zZWFyY2guQ2ZuQ29sbGVjdGlvbih0aGlzLCBcIkltcG9ydGVkVmVjdG9yQ29sbGVjdGlvblwiLCB7XG4gICAgICBuYW1lOiBcImltcG9ydGVkLXZlY3Rvci1jb2xsZWN0aW9uXCIsXG4gICAgICB0eXBlOiBcIlZFQ1RPUlNFQVJDSFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiSW1wb3J0ZWQgdmVjdG9yIHNlYXJjaCBjb2xsZWN0aW9uIGZvciBSQUcgc3lzdGVtXCIsXG4gICAgfSk7XG5cbiAgICAvLyBGU3ggZm9yIE5ldEFwcCBPTlRBUOODleOCoeOCpOODq+OCt+OCueODhuODoO+8iOODl+ODrOODvOOCueODm+ODq+ODgOODvO+8iVxuICAgIC8vIOWun+mam+OBruOCpOODs+ODneODvOODiOaZguOBq+OBr+aXouWtmOOBrkZTeOODquOCveODvOOCueOCkuWPluOCiui+vOOCgFxuICAgIFxuICAgIC8vIOWHuuWKm1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiRG9jdW1lbnRzQnVja2V0TmFtZVwiLCB7XG4gICAgICB2YWx1ZTogZG9jdW1lbnRzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogXCJJbXBvcnRlZCBkb2N1bWVudHMgYnVja2V0IG5hbWVcIixcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Eb2N1bWVudHNCdWNrZXROYW1lYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiVmVjdG9yQ29sbGVjdGlvbkFyblwiLCB7XG4gICAgICB2YWx1ZTogdmVjdG9yQ29sbGVjdGlvbi5hdHRyQXJuLFxuICAgICAgZGVzY3JpcHRpb246IFwiSW1wb3J0ZWQgdmVjdG9yIGNvbGxlY3Rpb24gQVJOXCIsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tVmVjdG9yQ29sbGVjdGlvbkFybmAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlZlY3RvckNvbGxlY3Rpb25FbmRwb2ludFwiLCB7XG4gICAgICB2YWx1ZTogdmVjdG9yQ29sbGVjdGlvbi5hdHRyQ29sbGVjdGlvbkVuZHBvaW50LFxuICAgICAgZGVzY3JpcHRpb246IFwiSW1wb3J0ZWQgdmVjdG9yIGNvbGxlY3Rpb24gZW5kcG9pbnRcIixcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1WZWN0b3JDb2xsZWN0aW9uRW5kcG9pbnRgLFxuICAgIH0pO1xuICB9XG59Il19