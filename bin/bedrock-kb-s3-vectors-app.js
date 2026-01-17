#!/usr/bin/env node
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
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const bedrock_kb_s3_vectors_stack_1 = require("../lib/stacks/integrated/bedrock-kb-s3-vectors-stack");
/**
 * Bedrock Knowledge Base（S3 Vectors）デプロイメントアプリケーション
 *
 * 使用方法:
 *   npx cdk deploy -a "npx ts-node bin/bedrock-kb-s3-vectors-app.ts" --region us-east-1
 *
 * 環境変数:
 *   FSX_S3_ACCESS_POINT_ALIAS: FSx for ONTAP S3 Access Pointのエイリアス
 */
const app = new cdk.App();
// スタックの作成
new bedrock_kb_s3_vectors_stack_1.BedrockKnowledgeBaseS3VectorsStack(app, 'BedrockKnowledgeBaseS3VectorsStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: 'us-east-1', // Bedrock Knowledge Baseはus-east-1で作成
    },
    description: 'FSx for ONTAP S3 Access Point用のBedrock Knowledge Base（S3 Vectors使用）',
    tags: {
        Project: 'Permission-aware-RAG',
        Component: 'Bedrock-KB-S3Vectors',
        ManagedBy: 'CDK',
    },
});
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1rYi1zMy12ZWN0b3JzLWFwcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJlZHJvY2sta2ItczMtdmVjdG9ycy1hcHAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSx1Q0FBcUM7QUFDckMsaURBQW1DO0FBQ25DLHNHQUEwRztBQUUxRzs7Ozs7Ozs7R0FRRztBQUVILE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLFVBQVU7QUFDVixJQUFJLGdFQUFrQyxDQUFDLEdBQUcsRUFBRSxvQ0FBb0MsRUFBRTtJQUNoRixHQUFHLEVBQUU7UUFDSCxPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUI7UUFDeEMsTUFBTSxFQUFFLFdBQVcsRUFBRSxzQ0FBc0M7S0FDNUQ7SUFDRCxXQUFXLEVBQUUscUVBQXFFO0lBQ2xGLElBQUksRUFBRTtRQUNKLE9BQU8sRUFBRSxzQkFBc0I7UUFDL0IsU0FBUyxFQUFFLHNCQUFzQjtRQUNqQyxTQUFTLEVBQUUsS0FBSztLQUNqQjtDQUNGLENBQUMsQ0FBQztBQUVILEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBCZWRyb2NrS25vd2xlZGdlQmFzZVMzVmVjdG9yc1N0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy9pbnRlZ3JhdGVkL2JlZHJvY2sta2ItczMtdmVjdG9ycy1zdGFjayc7XG5cbi8qKlxuICogQmVkcm9jayBLbm93bGVkZ2UgQmFzZe+8iFMzIFZlY3RvcnPvvInjg4fjg5fjg63jgqTjg6Hjg7Pjg4jjgqLjg5fjg6rjgrHjg7zjgrfjg6fjg7NcbiAqIFxuICog5L2/55So5pa55rOVOlxuICogICBucHggY2RrIGRlcGxveSAtYSBcIm5weCB0cy1ub2RlIGJpbi9iZWRyb2NrLWtiLXMzLXZlY3RvcnMtYXBwLnRzXCIgLS1yZWdpb24gdXMtZWFzdC0xXG4gKiBcbiAqIOeSsOWig+WkieaVsDpcbiAqICAgRlNYX1MzX0FDQ0VTU19QT0lOVF9BTElBUzogRlN4IGZvciBPTlRBUCBTMyBBY2Nlc3MgUG9pbnTjga7jgqjjgqTjg6rjgqLjgrlcbiAqL1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG4vLyDjgrnjgr/jg4Pjgq/jga7kvZzmiJBcbm5ldyBCZWRyb2NrS25vd2xlZGdlQmFzZVMzVmVjdG9yc1N0YWNrKGFwcCwgJ0JlZHJvY2tLbm93bGVkZ2VCYXNlUzNWZWN0b3JzU3RhY2snLCB7XG4gIGVudjoge1xuICAgIGFjY291bnQ6IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQsXG4gICAgcmVnaW9uOiAndXMtZWFzdC0xJywgLy8gQmVkcm9jayBLbm93bGVkZ2UgQmFzZeOBr3VzLWVhc3QtMeOBp+S9nOaIkFxuICB9LFxuICBkZXNjcmlwdGlvbjogJ0ZTeCBmb3IgT05UQVAgUzMgQWNjZXNzIFBvaW5055So44GuQmVkcm9jayBLbm93bGVkZ2UgQmFzZe+8iFMzIFZlY3RvcnPkvb/nlKjvvIknLFxuICB0YWdzOiB7XG4gICAgUHJvamVjdDogJ1Blcm1pc3Npb24tYXdhcmUtUkFHJyxcbiAgICBDb21wb25lbnQ6ICdCZWRyb2NrLUtCLVMzVmVjdG9ycycsXG4gICAgTWFuYWdlZEJ5OiAnQ0RLJyxcbiAgfSxcbn0pO1xuXG5hcHAuc3ludGgoKTtcbiJdfQ==