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
const bedrock_agent_core_runtime_construct_1 = require("../lib/modules/ai/constructs/bedrock-agent-core-runtime-construct");
const app = new cdk.App();
const stack = new cdk.Stack(app, 'TokyoRegion-permission-aware-rag-prod-AgentCore-Runtime', {
    env: {
        account: '178625946981',
        region: 'ap-northeast-1',
    },
    description: 'AgentCore Runtime Lambda Function Only',
});
// Runtime Construct
const runtime = new bedrock_agent_core_runtime_construct_1.BedrockAgentCoreRuntimeConstruct(stack, 'AgentCoreRuntime', {
    functionName: 'TokyoRegion-permission-aware-rag-prod-AgentCoreRuntime',
    description: 'Bedrock Agent Core Runtime Function',
});
// Outputs
new cdk.CfnOutput(stack, 'RuntimeFunctionArn', {
    value: runtime.lambdaFunction.functionArn,
    description: 'AgentCore Runtime Lambda Function ARN',
});
new cdk.CfnOutput(stack, 'RuntimeFunctionName', {
    value: runtime.lambdaFunction.functionName,
    description: 'AgentCore Runtime Lambda Function Name',
});
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95LWFnZW50Y29yZS1ydW50aW1lLW9ubHkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkZXBsb3ktYWdlbnRjb3JlLXJ1bnRpbWUtb25seS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsNEhBQXFIO0FBRXJILE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLE1BQU0sS0FBSyxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUseURBQXlELEVBQUU7SUFDMUYsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLGNBQWM7UUFDdkIsTUFBTSxFQUFFLGdCQUFnQjtLQUN6QjtJQUNELFdBQVcsRUFBRSx3Q0FBd0M7Q0FDdEQsQ0FBQyxDQUFDO0FBRUgsb0JBQW9CO0FBQ3BCLE1BQU0sT0FBTyxHQUFHLElBQUksdUVBQWdDLENBQUMsS0FBSyxFQUFFLGtCQUFrQixFQUFFO0lBQzlFLFlBQVksRUFBRSx3REFBd0Q7SUFDdEUsV0FBVyxFQUFFLHFDQUFxQztDQUNuRCxDQUFDLENBQUM7QUFFSCxVQUFVO0FBQ1YsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxvQkFBb0IsRUFBRTtJQUM3QyxLQUFLLEVBQUUsT0FBTyxDQUFDLGNBQWMsQ0FBQyxXQUFXO0lBQ3pDLFdBQVcsRUFBRSx1Q0FBdUM7Q0FDckQsQ0FBQyxDQUFDO0FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxxQkFBcUIsRUFBRTtJQUM5QyxLQUFLLEVBQUUsT0FBTyxDQUFDLGNBQWMsQ0FBQyxZQUFZO0lBQzFDLFdBQVcsRUFBRSx3Q0FBd0M7Q0FDdEQsQ0FBQyxDQUFDO0FBRUgsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IEJlZHJvY2tBZ2VudENvcmVSdW50aW1lQ29uc3RydWN0IH0gZnJvbSAnLi4vbGliL21vZHVsZXMvYWkvY29uc3RydWN0cy9iZWRyb2NrLWFnZW50LWNvcmUtcnVudGltZS1jb25zdHJ1Y3QnO1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG5jb25zdCBzdGFjayA9IG5ldyBjZGsuU3RhY2soYXBwLCAnVG9reW9SZWdpb24tcGVybWlzc2lvbi1hd2FyZS1yYWctcHJvZC1BZ2VudENvcmUtUnVudGltZScsIHtcbiAgZW52OiB7XG4gICAgYWNjb3VudDogJzE3ODYyNTk0Njk4MScsXG4gICAgcmVnaW9uOiAnYXAtbm9ydGhlYXN0LTEnLFxuICB9LFxuICBkZXNjcmlwdGlvbjogJ0FnZW50Q29yZSBSdW50aW1lIExhbWJkYSBGdW5jdGlvbiBPbmx5Jyxcbn0pO1xuXG4vLyBSdW50aW1lIENvbnN0cnVjdFxuY29uc3QgcnVudGltZSA9IG5ldyBCZWRyb2NrQWdlbnRDb3JlUnVudGltZUNvbnN0cnVjdChzdGFjaywgJ0FnZW50Q29yZVJ1bnRpbWUnLCB7XG4gIGZ1bmN0aW9uTmFtZTogJ1Rva3lvUmVnaW9uLXBlcm1pc3Npb24tYXdhcmUtcmFnLXByb2QtQWdlbnRDb3JlUnVudGltZScsXG4gIGRlc2NyaXB0aW9uOiAnQmVkcm9jayBBZ2VudCBDb3JlIFJ1bnRpbWUgRnVuY3Rpb24nLFxufSk7XG5cbi8vIE91dHB1dHNcbm5ldyBjZGsuQ2ZuT3V0cHV0KHN0YWNrLCAnUnVudGltZUZ1bmN0aW9uQXJuJywge1xuICB2YWx1ZTogcnVudGltZS5sYW1iZGFGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgUnVudGltZSBMYW1iZGEgRnVuY3Rpb24gQVJOJyxcbn0pO1xuXG5uZXcgY2RrLkNmbk91dHB1dChzdGFjaywgJ1J1bnRpbWVGdW5jdGlvbk5hbWUnLCB7XG4gIHZhbHVlOiBydW50aW1lLmxhbWJkYUZ1bmN0aW9uLmZ1bmN0aW9uTmFtZSxcbiAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgUnVudGltZSBMYW1iZGEgRnVuY3Rpb24gTmFtZScsXG59KTtcblxuYXBwLnN5bnRoKCk7XG4iXX0=