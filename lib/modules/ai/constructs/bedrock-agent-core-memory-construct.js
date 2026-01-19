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
exports.BedrockAgentCoreMemoryConstruct = void 0;
const constructs_1 = require("constructs");
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
class BedrockAgentCoreMemoryConstruct extends constructs_1.Construct {
    memoryTable;
    memoryResourceArn;
    memoryResourceId;
    constructor(scope, id, props = {}) {
        super(scope, id);
        // Create DynamoDB table for agent memory
        this.memoryTable = new dynamodb.Table(this, 'MemoryTable', {
            tableName: props.tableName,
            partitionKey: {
                name: 'sessionId',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: 'timestamp',
                type: dynamodb.AttributeType.NUMBER,
            },
            billingMode: props.billingMode || dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: props.removalPolicy || cdk.RemovalPolicy.DESTROY,
            pointInTimeRecovery: true,
        });
        // Add GSI for querying by user
        this.memoryTable.addGlobalSecondaryIndex({
            indexName: 'UserIndex',
            partitionKey: {
                name: 'userId',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: 'timestamp',
                type: dynamodb.AttributeType.NUMBER,
            },
        });
        // Set resource properties
        this.memoryResourceArn = this.memoryTable.tableArn;
        this.memoryResourceId = this.memoryTable.tableName;
    }
}
exports.BedrockAgentCoreMemoryConstruct = BedrockAgentCoreMemoryConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1hZ2VudC1jb3JlLW1lbW9yeS1jb25zdHJ1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJiZWRyb2NrLWFnZW50LWNvcmUtbWVtb3J5LWNvbnN0cnVjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDJDQUF1QztBQUN2QyxpREFBbUM7QUFDbkMsbUVBQXFEO0FBVXJELE1BQWEsK0JBQWdDLFNBQVEsc0JBQVM7SUFDNUMsV0FBVyxDQUFpQjtJQUM1QixpQkFBaUIsQ0FBUztJQUMxQixnQkFBZ0IsQ0FBUztJQUV6QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLFFBQThDLEVBQUU7UUFDeEYsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQix5Q0FBeUM7UUFDekMsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUN6RCxTQUFTLEVBQUUsS0FBSyxDQUFDLFNBQVM7WUFDMUIsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxXQUFXO2dCQUNqQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxXQUFXO2dCQUNqQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsV0FBVyxFQUFFLEtBQUssQ0FBQyxXQUFXLElBQUksUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ3RFLGFBQWEsRUFBRSxLQUFLLENBQUMsYUFBYSxJQUFJLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztZQUMvRCxtQkFBbUIsRUFBRSxJQUFJO1NBQzFCLENBQUMsQ0FBQztRQUVILCtCQUErQjtRQUMvQixJQUFJLENBQUMsV0FBVyxDQUFDLHVCQUF1QixDQUFDO1lBQ3ZDLFNBQVMsRUFBRSxXQUFXO1lBQ3RCLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsUUFBUTtnQkFDZCxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxXQUFXO2dCQUNqQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsMEJBQTBCO1FBQzFCLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQztRQUNuRCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUM7SUFDckQsQ0FBQztDQUNGO0FBekNELDBFQXlDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQmVkcm9ja0FnZW50Q29yZU1lbW9yeUNvbnN0cnVjdFByb3BzIHtcbiAgcmVhZG9ubHkgdGFibGVOYW1lPzogc3RyaW5nO1xuICByZWFkb25seSBiaWxsaW5nTW9kZT86IGR5bmFtb2RiLkJpbGxpbmdNb2RlO1xuICByZWFkb25seSByZW1vdmFsUG9saWN5PzogY2RrLlJlbW92YWxQb2xpY3k7XG4gIHJlYWRvbmx5IGVuYWJsZWQ/OiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgQmVkcm9ja0FnZW50Q29yZU1lbW9yeUNvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyByZWFkb25seSBtZW1vcnlUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSBtZW1vcnlSZXNvdXJjZUFybjogc3RyaW5nO1xuICBwdWJsaWMgcmVhZG9ubHkgbWVtb3J5UmVzb3VyY2VJZDogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlTWVtb3J5Q29uc3RydWN0UHJvcHMgPSB7fSkge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyBDcmVhdGUgRHluYW1vREIgdGFibGUgZm9yIGFnZW50IG1lbW9yeVxuICAgIHRoaXMubWVtb3J5VGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ01lbW9yeVRhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBwcm9wcy50YWJsZU5hbWUsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3Nlc3Npb25JZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ3RpbWVzdGFtcCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSLFxuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBwcm9wcy5iaWxsaW5nTW9kZSB8fCBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBwcm9wcy5yZW1vdmFsUG9saWN5IHx8IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdTSSBmb3IgcXVlcnlpbmcgYnkgdXNlclxuICAgIHRoaXMubWVtb3J5VGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnVXNlckluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAndXNlcklkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAndGltZXN0YW1wJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gU2V0IHJlc291cmNlIHByb3BlcnRpZXNcbiAgICB0aGlzLm1lbW9yeVJlc291cmNlQXJuID0gdGhpcy5tZW1vcnlUYWJsZS50YWJsZUFybjtcbiAgICB0aGlzLm1lbW9yeVJlc291cmNlSWQgPSB0aGlzLm1lbW9yeVRhYmxlLnRhYmxlTmFtZTtcbiAgfVxufVxuIl19