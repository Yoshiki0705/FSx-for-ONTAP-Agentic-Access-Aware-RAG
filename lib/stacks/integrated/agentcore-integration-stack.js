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
exports.AgentCoreIntegrationStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
class AgentCoreIntegrationStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        console.log('🚧 AgentCoreIntegrationStack: Temporarily disabled for deployment');
        // Add a simple output to indicate the stack is disabled
        new cdk.CfnOutput(this, 'AgentCoreStatus', {
            value: 'Temporarily disabled',
            description: 'AgentCore integration status'
        });
    }
}
exports.AgentCoreIntegrationStack = AgentCoreIntegrationStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWdlbnRjb3JlLWludGVncmF0aW9uLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYWdlbnRjb3JlLWludGVncmF0aW9uLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsaURBQW1DO0FBT25DLE1BQWEseUJBQTBCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDdEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFxQztRQUM3RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixPQUFPLENBQUMsR0FBRyxDQUFDLG1FQUFtRSxDQUFDLENBQUM7UUFFakYsd0RBQXdEO1FBQ3hELElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDekMsS0FBSyxFQUFFLHNCQUFzQjtZQUM3QixXQUFXLEVBQUUsOEJBQThCO1NBQzVDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQVpELDhEQVlDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQWdlbnRDb3JlSW50ZWdyYXRpb25Db25maWcgfSBmcm9tICcuLi8uLi9jb25maWcvaW50ZXJmYWNlcy9lbnZpcm9ubWVudC1jb25maWcnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEFnZW50Q29yZUludGVncmF0aW9uU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgY29uZmlnOiBBZ2VudENvcmVJbnRlZ3JhdGlvbkNvbmZpZztcbn1cblxuZXhwb3J0IGNsYXNzIEFnZW50Q29yZUludGVncmF0aW9uU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQWdlbnRDb3JlSW50ZWdyYXRpb25TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zb2xlLmxvZygn8J+apyBBZ2VudENvcmVJbnRlZ3JhdGlvblN0YWNrOiBUZW1wb3JhcmlseSBkaXNhYmxlZCBmb3IgZGVwbG95bWVudCcpO1xuICAgIFxuICAgIC8vIEFkZCBhIHNpbXBsZSBvdXRwdXQgdG8gaW5kaWNhdGUgdGhlIHN0YWNrIGlzIGRpc2FibGVkXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50Q29yZVN0YXR1cycsIHtcbiAgICAgIHZhbHVlOiAnVGVtcG9yYXJpbHkgZGlzYWJsZWQnLFxuICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgaW50ZWdyYXRpb24gc3RhdHVzJ1xuICAgIH0pO1xuICB9XG59XG4iXX0=