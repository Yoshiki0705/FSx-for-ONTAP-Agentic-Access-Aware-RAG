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
exports.AgentCoreIntegrationStackV2 = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
class AgentCoreIntegrationStackV2 extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        console.log('🚧 AgentCoreIntegrationStackV2: Temporarily disabled for deployment');
        // Add a simple output to indicate the stack is disabled
        new cdk.CfnOutput(this, 'AgentCoreV2Status', {
            value: 'Temporarily disabled',
            description: 'AgentCore V2 integration status'
        });
    }
}
exports.AgentCoreIntegrationStackV2 = AgentCoreIntegrationStackV2;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWdlbnRjb3JlLWludGVncmF0aW9uLXN0YWNrLXYyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYWdlbnRjb3JlLWludGVncmF0aW9uLXN0YWNrLXYyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsaURBQW1DO0FBT25DLE1BQWEsMkJBQTRCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDeEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF1QztRQUMvRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixPQUFPLENBQUMsR0FBRyxDQUFDLHFFQUFxRSxDQUFDLENBQUM7UUFFbkYsd0RBQXdEO1FBQ3hELElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDM0MsS0FBSyxFQUFFLHNCQUFzQjtZQUM3QixXQUFXLEVBQUUsaUNBQWlDO1NBQy9DLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQVpELGtFQVlDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQWdlbnRDb3JlSW50ZWdyYXRpb25Db25maWcgfSBmcm9tICcuLi8uLi9jb25maWcvaW50ZXJmYWNlcy9lbnZpcm9ubWVudC1jb25maWcnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEFnZW50Q29yZUludGVncmF0aW9uU3RhY2tWMlByb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBjb25maWc6IEFnZW50Q29yZUludGVncmF0aW9uQ29uZmlnO1xufVxuXG5leHBvcnQgY2xhc3MgQWdlbnRDb3JlSW50ZWdyYXRpb25TdGFja1YyIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEFnZW50Q29yZUludGVncmF0aW9uU3RhY2tWMlByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zb2xlLmxvZygn8J+apyBBZ2VudENvcmVJbnRlZ3JhdGlvblN0YWNrVjI6IFRlbXBvcmFyaWx5IGRpc2FibGVkIGZvciBkZXBsb3ltZW50Jyk7XG4gICAgXG4gICAgLy8gQWRkIGEgc2ltcGxlIG91dHB1dCB0byBpbmRpY2F0ZSB0aGUgc3RhY2sgaXMgZGlzYWJsZWRcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWdlbnRDb3JlVjJTdGF0dXMnLCB7XG4gICAgICB2YWx1ZTogJ1RlbXBvcmFyaWx5IGRpc2FibGVkJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIFYyIGludGVncmF0aW9uIHN0YXR1cydcbiAgICB9KTtcbiAgfVxufVxuIl19