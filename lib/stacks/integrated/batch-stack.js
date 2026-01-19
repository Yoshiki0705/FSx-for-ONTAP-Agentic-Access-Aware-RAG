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
exports.BatchStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const batch_compute_1 = require("../../modules/embedding/batch-compute");
/**
 * AWS Batch Stack
 *
 * SQLite Embedding処理用のBatch環境を構築
 *
 * 主な機能:
 * - AWS Batch Compute Environment
 * - Job Queue
 * - Job Definition
 * - IAM Roles
 */
class BatchStack extends cdk.Stack {
    batchEnvironment;
    constructor(scope, id, props) {
        super(scope, id, props);
        // 既存VPCの取得
        const vpc = props.vpcId
            ? ec2.Vpc.fromLookup(this, 'Vpc', { vpcId: props.vpcId })
            : ec2.Vpc.fromLookup(this, 'Vpc', { isDefault: false });
        // セキュリティグループの作成
        const securityGroup = new ec2.SecurityGroup(this, 'BatchSecurityGroup', {
            vpc,
            securityGroupName: `${props.projectName}-${props.environment}-batch-sg`,
            description: 'Security group for AWS Batch compute environment',
            allowAllOutbound: true,
        });
        // Batch環境の作成
        this.batchEnvironment = new batch_compute_1.BatchComputeEnvironment(this, 'BatchEnvironment', {
            projectName: props.projectName,
            environment: props.environment,
            vpc,
            securityGroup,
            minvCpus: props.minvCpus,
            maxvCpus: props.maxvCpus,
            desiredvCpus: props.desiredvCpus,
            containerImageUri: props.containerImageUri,
        });
        // Stack Outputs
        new cdk.CfnOutput(this, 'StackName', {
            value: this.stackName,
            description: 'Batch Stack Name',
        });
        new cdk.CfnOutput(this, 'VpcId', {
            value: vpc.vpcId,
            description: 'VPC ID',
        });
        new cdk.CfnOutput(this, 'SecurityGroupId', {
            value: securityGroup.securityGroupId,
            description: 'Security Group ID',
        });
    }
}
exports.BatchStack = BatchStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF0Y2gtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJiYXRjaC1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx5REFBMkM7QUFFM0MseUVBQWdGO0FBc0JoRjs7Ozs7Ozs7OztHQVVHO0FBQ0gsTUFBYSxVQUFXLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDdkIsZ0JBQWdCLENBQTBCO0lBRTFELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsV0FBVztRQUNYLE1BQU0sR0FBRyxHQUFHLEtBQUssQ0FBQyxLQUFLO1lBQ3JCLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUN6RCxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBRTFELGdCQUFnQjtRQUNoQixNQUFNLGFBQWEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQ3RFLEdBQUc7WUFDSCxpQkFBaUIsRUFBRSxHQUFHLEtBQUssQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDLFdBQVcsV0FBVztZQUN2RSxXQUFXLEVBQUUsa0RBQWtEO1lBQy9ELGdCQUFnQixFQUFFLElBQUk7U0FDdkIsQ0FBQyxDQUFDO1FBRUgsYUFBYTtRQUNiLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLHVDQUF1QixDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUM1RSxXQUFXLEVBQUUsS0FBSyxDQUFDLFdBQVc7WUFDOUIsV0FBVyxFQUFFLEtBQUssQ0FBQyxXQUFXO1lBQzlCLEdBQUc7WUFDSCxhQUFhO1lBQ2IsUUFBUSxFQUFFLEtBQUssQ0FBQyxRQUFRO1lBQ3hCLFFBQVEsRUFBRSxLQUFLLENBQUMsUUFBUTtZQUN4QixZQUFZLEVBQUUsS0FBSyxDQUFDLFlBQVk7WUFDaEMsaUJBQWlCLEVBQUUsS0FBSyxDQUFDLGlCQUFpQjtTQUMzQyxDQUFDLENBQUM7UUFFSCxnQkFBZ0I7UUFDaEIsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUU7WUFDbkMsS0FBSyxFQUFFLElBQUksQ0FBQyxTQUFTO1lBQ3JCLFdBQVcsRUFBRSxrQkFBa0I7U0FDaEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUU7WUFDL0IsS0FBSyxFQUFFLEdBQUcsQ0FBQyxLQUFLO1lBQ2hCLFdBQVcsRUFBRSxRQUFRO1NBQ3RCLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDekMsS0FBSyxFQUFFLGFBQWEsQ0FBQyxlQUFlO1lBQ3BDLFdBQVcsRUFBRSxtQkFBbUI7U0FDakMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBL0NELGdDQStDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IEJhdGNoQ29tcHV0ZUVudmlyb25tZW50IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9lbWJlZGRpbmcvYmF0Y2gtY29tcHV0ZSc7XG5cbi8qKlxuICogQmF0Y2ggU3RhY2sgQ29uZmlndXJhdGlvblxuICovXG5leHBvcnQgaW50ZXJmYWNlIEJhdGNoU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgLyoqIOODl+ODreOCuOOCp+OCr+ODiOWQjSAqL1xuICBwcm9qZWN0TmFtZTogc3RyaW5nO1xuICAvKiog55Kw5aKD5ZCNICovXG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG4gIC8qKiBWUEMgSUTvvIjml6LlrZhWUEPjgpLkvb/nlKjvvIkgKi9cbiAgdnBjSWQ/OiBzdHJpbmc7XG4gIC8qKiDmnIDlsI92Q1BV5pWwICovXG4gIG1pbnZDcHVzPzogbnVtYmVyO1xuICAvKiog5pyA5aSndkNQVeaVsCAqL1xuICBtYXh2Q3B1cz86IG51bWJlcjtcbiAgLyoqIOW4jOacm3ZDUFXmlbAgKi9cbiAgZGVzaXJlZHZDcHVzPzogbnVtYmVyO1xuICAvKiog44Kz44Oz44OG44OK44Kk44Oh44O844K4VVJJICovXG4gIGNvbnRhaW5lckltYWdlVXJpPzogc3RyaW5nO1xufVxuXG4vKipcbiAqIEFXUyBCYXRjaCBTdGFja1xuICogXG4gKiBTUUxpdGUgRW1iZWRkaW5n5Yem55CG55So44GuQmF0Y2jnkrDlooPjgpLmp4vnr4lcbiAqIFxuICog5Li744Gq5qmf6IO9OlxuICogLSBBV1MgQmF0Y2ggQ29tcHV0ZSBFbnZpcm9ubWVudFxuICogLSBKb2IgUXVldWVcbiAqIC0gSm9iIERlZmluaXRpb25cbiAqIC0gSUFNIFJvbGVzXG4gKi9cbmV4cG9ydCBjbGFzcyBCYXRjaFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGJhdGNoRW52aXJvbm1lbnQ6IEJhdGNoQ29tcHV0ZUVudmlyb25tZW50O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBCYXRjaFN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIOaXouWtmFZQQ+OBruWPluW+l1xuICAgIGNvbnN0IHZwYyA9IHByb3BzLnZwY0lkXG4gICAgICA/IGVjMi5WcGMuZnJvbUxvb2t1cCh0aGlzLCAnVnBjJywgeyB2cGNJZDogcHJvcHMudnBjSWQgfSlcbiAgICAgIDogZWMyLlZwYy5mcm9tTG9va3VwKHRoaXMsICdWcGMnLCB7IGlzRGVmYXVsdDogZmFsc2UgfSk7XG5cbiAgICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fjga7kvZzmiJBcbiAgICBjb25zdCBzZWN1cml0eUdyb3VwID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdCYXRjaFNlY3VyaXR5R3JvdXAnLCB7XG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWJhdGNoLXNnYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgZ3JvdXAgZm9yIEFXUyBCYXRjaCBjb21wdXRlIGVudmlyb25tZW50JyxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBCYXRjaOeSsOWig+OBruS9nOaIkFxuICAgIHRoaXMuYmF0Y2hFbnZpcm9ubWVudCA9IG5ldyBCYXRjaENvbXB1dGVFbnZpcm9ubWVudCh0aGlzLCAnQmF0Y2hFbnZpcm9ubWVudCcsIHtcbiAgICAgIHByb2plY3ROYW1lOiBwcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgIGVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXAsXG4gICAgICBtaW52Q3B1czogcHJvcHMubWludkNwdXMsXG4gICAgICBtYXh2Q3B1czogcHJvcHMubWF4dkNwdXMsXG4gICAgICBkZXNpcmVkdkNwdXM6IHByb3BzLmRlc2lyZWR2Q3B1cyxcbiAgICAgIGNvbnRhaW5lckltYWdlVXJpOiBwcm9wcy5jb250YWluZXJJbWFnZVVyaSxcbiAgICB9KTtcblxuICAgIC8vIFN0YWNrIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU3RhY2tOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuc3RhY2tOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdCYXRjaCBTdGFjayBOYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWcGNJZCcsIHtcbiAgICAgIHZhbHVlOiB2cGMudnBjSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ1ZQQyBJRCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2VjdXJpdHlHcm91cElkJywge1xuICAgICAgdmFsdWU6IHNlY3VyaXR5R3JvdXAuc2VjdXJpdHlHcm91cElkLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBHcm91cCBJRCcsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==