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
const bedrock_agent_core_gateway_construct_1 = require("../lib/modules/ai/constructs/bedrock-agent-core-gateway-construct");
const bedrock_agent_core_memory_construct_1 = require("../lib/modules/ai/constructs/bedrock-agent-core-memory-construct");
const app = new cdk.App();
const stack = new cdk.Stack(app, 'TokyoRegion-permission-aware-rag-prod-AgentCore-Gateway', {
    env: {
        account: '178625946981',
        region: 'ap-northeast-1',
    },
    description: 'AgentCore Gateway Lambda Functions Only',
});
// Gateway Construct（機能を無効化してデプロイ）
const gateway = new bedrock_agent_core_gateway_construct_1.BedrockAgentCoreGatewayConstruct(stack, 'AgentCoreGateway', {
    projectName: 'permission-aware-rag',
    environment: 'prod',
    // 全ての機能を無効化（リソースが未提供のため）
    // restApiConversion: undefined,  // gatewaySpecsBucketが未提供
    // lambdaFunctionConversion: undefined,  // functionArnsが空
    // mcpServerIntegration: undefined,  // serverEndpointのみでは不十分
});
// Memory Construct
const memory = new bedrock_agent_core_memory_construct_1.BedrockAgentCoreMemoryConstruct(stack, 'AgentCoreMemory', {});
// Outputs
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95LWFnZW50Y29yZS1nYXRld2F5LW9ubHkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkZXBsb3ktYWdlbnRjb3JlLWdhdGV3YXktb25seS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsNEhBQXFIO0FBQ3JILDBIQUFtSDtBQUVuSCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixNQUFNLEtBQUssR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLHlEQUF5RCxFQUFFO0lBQzFGLEdBQUcsRUFBRTtRQUNILE9BQU8sRUFBRSxjQUFjO1FBQ3ZCLE1BQU0sRUFBRSxnQkFBZ0I7S0FDekI7SUFDRCxXQUFXLEVBQUUseUNBQXlDO0NBQ3ZELENBQUMsQ0FBQztBQUVILGtDQUFrQztBQUNsQyxNQUFNLE9BQU8sR0FBRyxJQUFJLHVFQUFnQyxDQUFDLEtBQUssRUFBRSxrQkFBa0IsRUFBRTtJQUM5RSxXQUFXLEVBQUUsc0JBQXNCO0lBQ25DLFdBQVcsRUFBRSxNQUFNO0lBQ25CLHlCQUF5QjtJQUN6QiwyREFBMkQ7SUFDM0QsMERBQTBEO0lBQzFELDZEQUE2RDtDQUM5RCxDQUFDLENBQUM7QUFFSCxtQkFBbUI7QUFDbkIsTUFBTSxNQUFNLEdBQUcsSUFBSSxxRUFBK0IsQ0FBQyxLQUFLLEVBQUUsaUJBQWlCLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFFakYsVUFBVTtBQUNWLElBQUksT0FBTyxDQUFDLHdCQUF3QixFQUFFLENBQUM7SUFDckMsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSw0QkFBNEIsRUFBRTtRQUNyRCxLQUFLLEVBQUUsT0FBTyxDQUFDLHdCQUF3QixDQUFDLFdBQVc7UUFDbkQsV0FBVyxFQUFFLDBDQUEwQztLQUN4RCxDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQsSUFBSSxPQUFPLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztJQUNwQyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLDJCQUEyQixFQUFFO1FBQ3BELEtBQUssRUFBRSxPQUFPLENBQUMsdUJBQXVCLENBQUMsV0FBVztRQUNsRCxXQUFXLEVBQUUsd0NBQXdDO0tBQ3RELENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxJQUFJLE9BQU8sQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO0lBQ25DLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsMEJBQTBCLEVBQUU7UUFDbkQsS0FBSyxFQUFFLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxXQUFXO1FBQ2pELFdBQVcsRUFBRSx1Q0FBdUM7S0FDckQsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBCZWRyb2NrQWdlbnRDb3JlR2F0ZXdheUNvbnN0cnVjdCB9IGZyb20gJy4uL2xpYi9tb2R1bGVzL2FpL2NvbnN0cnVjdHMvYmVkcm9jay1hZ2VudC1jb3JlLWdhdGV3YXktY29uc3RydWN0JztcbmltcG9ydCB7IEJlZHJvY2tBZ2VudENvcmVNZW1vcnlDb25zdHJ1Y3QgfSBmcm9tICcuLi9saWIvbW9kdWxlcy9haS9jb25zdHJ1Y3RzL2JlZHJvY2stYWdlbnQtY29yZS1tZW1vcnktY29uc3RydWN0JztcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxuY29uc3Qgc3RhY2sgPSBuZXcgY2RrLlN0YWNrKGFwcCwgJ1Rva3lvUmVnaW9uLXBlcm1pc3Npb24tYXdhcmUtcmFnLXByb2QtQWdlbnRDb3JlLUdhdGV3YXknLCB7XG4gIGVudjoge1xuICAgIGFjY291bnQ6ICcxNzg2MjU5NDY5ODEnLFxuICAgIHJlZ2lvbjogJ2FwLW5vcnRoZWFzdC0xJyxcbiAgfSxcbiAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgR2F0ZXdheSBMYW1iZGEgRnVuY3Rpb25zIE9ubHknLFxufSk7XG5cbi8vIEdhdGV3YXkgQ29uc3RydWN077yI5qmf6IO944KS54Sh5Yq55YyW44GX44Gm44OH44OX44Ot44Kk77yJXG5jb25zdCBnYXRld2F5ID0gbmV3IEJlZHJvY2tBZ2VudENvcmVHYXRld2F5Q29uc3RydWN0KHN0YWNrLCAnQWdlbnRDb3JlR2F0ZXdheScsIHtcbiAgcHJvamVjdE5hbWU6ICdwZXJtaXNzaW9uLWF3YXJlLXJhZycsXG4gIGVudmlyb25tZW50OiAncHJvZCcsXG4gIC8vIOWFqOOBpuOBruapn+iDveOCkueEoeWKueWMlu+8iOODquOCveODvOOCueOBjOacquaPkOS+m+OBruOBn+OCge+8iVxuICAvLyByZXN0QXBpQ29udmVyc2lvbjogdW5kZWZpbmVkLCAgLy8gZ2F0ZXdheVNwZWNzQnVja2V044GM5pyq5o+Q5L6bXG4gIC8vIGxhbWJkYUZ1bmN0aW9uQ29udmVyc2lvbjogdW5kZWZpbmVkLCAgLy8gZnVuY3Rpb25Bcm5z44GM56m6XG4gIC8vIG1jcFNlcnZlckludGVncmF0aW9uOiB1bmRlZmluZWQsICAvLyBzZXJ2ZXJFbmRwb2ludOOBruOBv+OBp+OBr+S4jeWNgeWIhlxufSk7XG5cbi8vIE1lbW9yeSBDb25zdHJ1Y3RcbmNvbnN0IG1lbW9yeSA9IG5ldyBCZWRyb2NrQWdlbnRDb3JlTWVtb3J5Q29uc3RydWN0KHN0YWNrLCAnQWdlbnRDb3JlTWVtb3J5Jywge30pO1xuXG4vLyBPdXRwdXRzXG5pZiAoZ2F0ZXdheS5yZXN0QXBpQ29udmVydGVyRnVuY3Rpb24pIHtcbiAgbmV3IGNkay5DZm5PdXRwdXQoc3RhY2ssICdHYXRld2F5UmVzdEFwaUNvbnZlcnRlckFybicsIHtcbiAgICB2YWx1ZTogZ2F0ZXdheS5yZXN0QXBpQ29udmVydGVyRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgR2F0ZXdheSBSRVNUIEFQSSBDb252ZXJ0ZXIgQVJOJyxcbiAgfSk7XG59XG5cbmlmIChnYXRld2F5LmxhbWJkYUNvbnZlcnRlckZ1bmN0aW9uKSB7XG4gIG5ldyBjZGsuQ2ZuT3V0cHV0KHN0YWNrLCAnR2F0ZXdheUxhbWJkYUNvbnZlcnRlckFybicsIHtcbiAgICB2YWx1ZTogZ2F0ZXdheS5sYW1iZGFDb252ZXJ0ZXJGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICBkZXNjcmlwdGlvbjogJ0FnZW50Q29yZSBHYXRld2F5IExhbWJkYSBDb252ZXJ0ZXIgQVJOJyxcbiAgfSk7XG59XG5cbmlmIChnYXRld2F5Lm1jcEludGVncmF0aW9uRnVuY3Rpb24pIHtcbiAgbmV3IGNkay5DZm5PdXRwdXQoc3RhY2ssICdHYXRld2F5TWNwSW50ZWdyYXRpb25Bcm4nLCB7XG4gICAgdmFsdWU6IGdhdGV3YXkubWNwSW50ZWdyYXRpb25GdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICBkZXNjcmlwdGlvbjogJ0FnZW50Q29yZSBHYXRld2F5IE1DUCBJbnRlZ3JhdGlvbiBBUk4nLFxuICB9KTtcbn1cblxuYXBwLnN5bnRoKCk7XG4iXX0=