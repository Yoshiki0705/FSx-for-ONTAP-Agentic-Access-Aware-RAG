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
const bedrock_agent_core_gateway_construct_1 = require("../lib/modules/ai/constructs/bedrock-agent-core-gateway-construct");
const bedrock_agent_core_memory_construct_1 = require("../lib/modules/ai/constructs/bedrock-agent-core-memory-construct");
const app = new cdk.App();
const stack = new cdk.Stack(app, 'TokyoRegion-permission-aware-rag-prod-AgentCore-Lambda', {
    env: {
        account: '178625946981',
        region: 'ap-northeast-1',
    },
    description: 'AgentCore Lambda Functions Only',
});
// Runtime Construct
const runtime = new bedrock_agent_core_runtime_construct_1.BedrockAgentCoreRuntimeConstruct(stack, 'AgentCoreRuntime', {
    functionName: 'TokyoRegion-permission-aware-rag-prod-AgentCoreRuntime',
    description: 'Bedrock Agent Core Runtime Function',
});
// Gateway Construct
const gateway = new bedrock_agent_core_gateway_construct_1.BedrockAgentCoreGatewayConstruct(stack, 'AgentCoreGateway', {
    projectName: 'permission-aware-rag',
    environment: 'prod',
    restApiConversion: {
        openApiSpecPath: 's3://example-bucket/openapi.yaml',
    },
    lambdaFunctionConversion: {
        functionArns: [],
    },
    mcpServerIntegration: {
        serverEndpoint: 'https://example.com/mcp',
    },
});
// Memory Construct
const memory = new bedrock_agent_core_memory_construct_1.BedrockAgentCoreMemoryConstruct(stack, 'AgentCoreMemory', {});
// Outputs
new cdk.CfnOutput(stack, 'RuntimeFunctionArn', {
    value: runtime.lambdaFunction.functionArn,
    description: 'AgentCore Runtime Lambda Function ARN',
});
if (gateway.restApiConverterFunction) {
    new cdk.CfnOutput(stack, 'GatewayRestApiConverterArn', {
        value: gateway.restApiConverterFunction.functionArn,
        description: 'AgentCore Gateway REST API Converter ARN',
    });
}
if (gateway.lambdaConverterFunction) {
    new cdk.CfnOutput(stack, 'GatewayLambdaConverterArn', {
        value: gateway.lambdaConverterFunction.functionArn,
        description: 'AgentCore Gateway Lambda Converter ARN',
    });
}
if (gateway.mcpIntegrationFunction) {
    new cdk.CfnOutput(stack, 'GatewayMcpIntegrationArn', {
        value: gateway.mcpIntegrationFunction.functionArn,
        description: 'AgentCore Gateway MCP Integration ARN',
    });
}
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95LWFnZW50Y29yZS1vbmx5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGVwbG95LWFnZW50Y29yZS1vbmx5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsdUNBQXFDO0FBQ3JDLGlEQUFtQztBQUNuQyw0SEFBcUg7QUFDckgsNEhBQXFIO0FBQ3JILDBIQUFtSDtBQUVuSCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixNQUFNLEtBQUssR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLHdEQUF3RCxFQUFFO0lBQ3pGLEdBQUcsRUFBRTtRQUNILE9BQU8sRUFBRSxjQUFjO1FBQ3ZCLE1BQU0sRUFBRSxnQkFBZ0I7S0FDekI7SUFDRCxXQUFXLEVBQUUsaUNBQWlDO0NBQy9DLENBQUMsQ0FBQztBQUVILG9CQUFvQjtBQUNwQixNQUFNLE9BQU8sR0FBRyxJQUFJLHVFQUFnQyxDQUFDLEtBQUssRUFBRSxrQkFBa0IsRUFBRTtJQUM5RSxZQUFZLEVBQUUsd0RBQXdEO0lBQ3RFLFdBQVcsRUFBRSxxQ0FBcUM7Q0FDbkQsQ0FBQyxDQUFDO0FBRUgsb0JBQW9CO0FBQ3BCLE1BQU0sT0FBTyxHQUFHLElBQUksdUVBQWdDLENBQUMsS0FBSyxFQUFFLGtCQUFrQixFQUFFO0lBQzlFLFdBQVcsRUFBRSxzQkFBc0I7SUFDbkMsV0FBVyxFQUFFLE1BQU07SUFDbkIsaUJBQWlCLEVBQUU7UUFDakIsZUFBZSxFQUFFLGtDQUFrQztLQUNwRDtJQUNELHdCQUF3QixFQUFFO1FBQ3hCLFlBQVksRUFBRSxFQUFFO0tBQ2pCO0lBQ0Qsb0JBQW9CLEVBQUU7UUFDcEIsY0FBYyxFQUFFLHlCQUF5QjtLQUMxQztDQUNGLENBQUMsQ0FBQztBQUVILG1CQUFtQjtBQUNuQixNQUFNLE1BQU0sR0FBRyxJQUFJLHFFQUErQixDQUFDLEtBQUssRUFBRSxpQkFBaUIsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUVqRixVQUFVO0FBQ1YsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxvQkFBb0IsRUFBRTtJQUM3QyxLQUFLLEVBQUUsT0FBTyxDQUFDLGNBQWMsQ0FBQyxXQUFXO0lBQ3pDLFdBQVcsRUFBRSx1Q0FBdUM7Q0FDckQsQ0FBQyxDQUFDO0FBRUgsSUFBSSxPQUFPLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztJQUNyQyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLDRCQUE0QixFQUFFO1FBQ3JELEtBQUssRUFBRSxPQUFPLENBQUMsd0JBQXdCLENBQUMsV0FBVztRQUNuRCxXQUFXLEVBQUUsMENBQTBDO0tBQ3hELENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxJQUFJLE9BQU8sQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO0lBQ3BDLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsMkJBQTJCLEVBQUU7UUFDcEQsS0FBSyxFQUFFLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxXQUFXO1FBQ2xELFdBQVcsRUFBRSx3Q0FBd0M7S0FDdEQsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELElBQUksT0FBTyxDQUFDLHNCQUFzQixFQUFFLENBQUM7SUFDbkMsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSwwQkFBMEIsRUFBRTtRQUNuRCxLQUFLLEVBQUUsT0FBTyxDQUFDLHNCQUFzQixDQUFDLFdBQVc7UUFDakQsV0FBVyxFQUFFLHVDQUF1QztLQUNyRCxDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IEJlZHJvY2tBZ2VudENvcmVSdW50aW1lQ29uc3RydWN0IH0gZnJvbSAnLi4vbGliL21vZHVsZXMvYWkvY29uc3RydWN0cy9iZWRyb2NrLWFnZW50LWNvcmUtcnVudGltZS1jb25zdHJ1Y3QnO1xuaW1wb3J0IHsgQmVkcm9ja0FnZW50Q29yZUdhdGV3YXlDb25zdHJ1Y3QgfSBmcm9tICcuLi9saWIvbW9kdWxlcy9haS9jb25zdHJ1Y3RzL2JlZHJvY2stYWdlbnQtY29yZS1nYXRld2F5LWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBCZWRyb2NrQWdlbnRDb3JlTWVtb3J5Q29uc3RydWN0IH0gZnJvbSAnLi4vbGliL21vZHVsZXMvYWkvY29uc3RydWN0cy9iZWRyb2NrLWFnZW50LWNvcmUtbWVtb3J5LWNvbnN0cnVjdCc7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbmNvbnN0IHN0YWNrID0gbmV3IGNkay5TdGFjayhhcHAsICdUb2t5b1JlZ2lvbi1wZXJtaXNzaW9uLWF3YXJlLXJhZy1wcm9kLUFnZW50Q29yZS1MYW1iZGEnLCB7XG4gIGVudjoge1xuICAgIGFjY291bnQ6ICcxNzg2MjU5NDY5ODEnLFxuICAgIHJlZ2lvbjogJ2FwLW5vcnRoZWFzdC0xJyxcbiAgfSxcbiAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgTGFtYmRhIEZ1bmN0aW9ucyBPbmx5Jyxcbn0pO1xuXG4vLyBSdW50aW1lIENvbnN0cnVjdFxuY29uc3QgcnVudGltZSA9IG5ldyBCZWRyb2NrQWdlbnRDb3JlUnVudGltZUNvbnN0cnVjdChzdGFjaywgJ0FnZW50Q29yZVJ1bnRpbWUnLCB7XG4gIGZ1bmN0aW9uTmFtZTogJ1Rva3lvUmVnaW9uLXBlcm1pc3Npb24tYXdhcmUtcmFnLXByb2QtQWdlbnRDb3JlUnVudGltZScsXG4gIGRlc2NyaXB0aW9uOiAnQmVkcm9jayBBZ2VudCBDb3JlIFJ1bnRpbWUgRnVuY3Rpb24nLFxufSk7XG5cbi8vIEdhdGV3YXkgQ29uc3RydWN0XG5jb25zdCBnYXRld2F5ID0gbmV3IEJlZHJvY2tBZ2VudENvcmVHYXRld2F5Q29uc3RydWN0KHN0YWNrLCAnQWdlbnRDb3JlR2F0ZXdheScsIHtcbiAgcHJvamVjdE5hbWU6ICdwZXJtaXNzaW9uLWF3YXJlLXJhZycsXG4gIGVudmlyb25tZW50OiAncHJvZCcsXG4gIHJlc3RBcGlDb252ZXJzaW9uOiB7XG4gICAgb3BlbkFwaVNwZWNQYXRoOiAnczM6Ly9leGFtcGxlLWJ1Y2tldC9vcGVuYXBpLnlhbWwnLFxuICB9LFxuICBsYW1iZGFGdW5jdGlvbkNvbnZlcnNpb246IHtcbiAgICBmdW5jdGlvbkFybnM6IFtdLFxuICB9LFxuICBtY3BTZXJ2ZXJJbnRlZ3JhdGlvbjoge1xuICAgIHNlcnZlckVuZHBvaW50OiAnaHR0cHM6Ly9leGFtcGxlLmNvbS9tY3AnLFxuICB9LFxufSk7XG5cbi8vIE1lbW9yeSBDb25zdHJ1Y3RcbmNvbnN0IG1lbW9yeSA9IG5ldyBCZWRyb2NrQWdlbnRDb3JlTWVtb3J5Q29uc3RydWN0KHN0YWNrLCAnQWdlbnRDb3JlTWVtb3J5Jywge30pO1xuXG4vLyBPdXRwdXRzXG5uZXcgY2RrLkNmbk91dHB1dChzdGFjaywgJ1J1bnRpbWVGdW5jdGlvbkFybicsIHtcbiAgdmFsdWU6IHJ1bnRpbWUubGFtYmRhRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIFJ1bnRpbWUgTGFtYmRhIEZ1bmN0aW9uIEFSTicsXG59KTtcblxuaWYgKGdhdGV3YXkucmVzdEFwaUNvbnZlcnRlckZ1bmN0aW9uKSB7XG4gIG5ldyBjZGsuQ2ZuT3V0cHV0KHN0YWNrLCAnR2F0ZXdheVJlc3RBcGlDb252ZXJ0ZXJBcm4nLCB7XG4gICAgdmFsdWU6IGdhdGV3YXkucmVzdEFwaUNvbnZlcnRlckZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIEdhdGV3YXkgUkVTVCBBUEkgQ29udmVydGVyIEFSTicsXG4gIH0pO1xufVxuXG5pZiAoZ2F0ZXdheS5sYW1iZGFDb252ZXJ0ZXJGdW5jdGlvbikge1xuICBuZXcgY2RrLkNmbk91dHB1dChzdGFjaywgJ0dhdGV3YXlMYW1iZGFDb252ZXJ0ZXJBcm4nLCB7XG4gICAgdmFsdWU6IGdhdGV3YXkubGFtYmRhQ29udmVydGVyRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgR2F0ZXdheSBMYW1iZGEgQ29udmVydGVyIEFSTicsXG4gIH0pO1xufVxuXG5pZiAoZ2F0ZXdheS5tY3BJbnRlZ3JhdGlvbkZ1bmN0aW9uKSB7XG4gIG5ldyBjZGsuQ2ZuT3V0cHV0KHN0YWNrLCAnR2F0ZXdheU1jcEludGVncmF0aW9uQXJuJywge1xuICAgIHZhbHVlOiBnYXRld2F5Lm1jcEludGVncmF0aW9uRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgR2F0ZXdheSBNQ1AgSW50ZWdyYXRpb24gQVJOJyxcbiAgfSk7XG59XG5cbmFwcC5zeW50aCgpO1xuIl19