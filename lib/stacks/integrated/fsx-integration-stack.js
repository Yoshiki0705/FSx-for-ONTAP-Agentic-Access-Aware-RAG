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
exports.FsxIntegrationStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
class FsxIntegrationStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        console.log('🚧 FsxIntegrationStack: Temporarily disabled for deployment');
        // Add a simple output to indicate the stack is disabled
        new cdk.CfnOutput(this, 'FsxIntegrationStatus', {
            value: 'Temporarily disabled',
            description: 'FSx integration status'
        });
    }
}
exports.FsxIntegrationStack = FsxIntegrationStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnN4LWludGVncmF0aW9uLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZnN4LWludGVncmF0aW9uLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsaURBQW1DO0FBU25DLE1BQWEsbUJBQW9CLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDaEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUErQjtRQUN2RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixPQUFPLENBQUMsR0FBRyxDQUFDLDZEQUE2RCxDQUFDLENBQUM7UUFFM0Usd0RBQXdEO1FBQ3hELElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDOUMsS0FBSyxFQUFFLHNCQUFzQjtZQUM3QixXQUFXLEVBQUUsd0JBQXdCO1NBQ3RDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQVpELGtEQVlDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgRW52aXJvbm1lbnRDb25maWcgfSBmcm9tICcuLi8uLi9jb25maWcvaW50ZXJmYWNlcy9lbnZpcm9ubWVudC1jb25maWcnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEZzeEludGVncmF0aW9uU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgY29uZmlnOiBFbnZpcm9ubWVudENvbmZpZztcbiAgdnBjSWQ/OiBzdHJpbmc7XG4gIHByaXZhdGVTdWJuZXRJZHM/OiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGNsYXNzIEZzeEludGVncmF0aW9uU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogRnN4SW50ZWdyYXRpb25TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zb2xlLmxvZygn8J+apyBGc3hJbnRlZ3JhdGlvblN0YWNrOiBUZW1wb3JhcmlseSBkaXNhYmxlZCBmb3IgZGVwbG95bWVudCcpO1xuICAgIFxuICAgIC8vIEFkZCBhIHNpbXBsZSBvdXRwdXQgdG8gaW5kaWNhdGUgdGhlIHN0YWNrIGlzIGRpc2FibGVkXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0ZzeEludGVncmF0aW9uU3RhdHVzJywge1xuICAgICAgdmFsdWU6ICdUZW1wb3JhcmlseSBkaXNhYmxlZCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ0ZTeCBpbnRlZ3JhdGlvbiBzdGF0dXMnXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==