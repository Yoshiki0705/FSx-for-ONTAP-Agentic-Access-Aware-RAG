"use strict";
/**
 * FSx for ONTAP + S3 Access Points統合Construct
 *
 * 目的:
 * - FSx for ONTAPボリュームへのS3 API経由アクセスを提供
 * - Lambda環境でのNFS/SMBマウント制限を解決
 * - Memory/Browser/Code Interpreter/Evaluations/Policy機能で共通使用
 *
 * 機能:
 * - S3 Access Point作成
 * - VPCエンドポイント作成
 * - IAMポリシー設定
 * - Lambda関数へのアクセス権限付与
 */
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
exports.FsxOntapS3AccessPointConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const constructs_1 = require("constructs");
/**
 * FSx for ONTAP + S3 Access Points Construct
 *
 * このConstructは、FSx for ONTAPボリュームへのS3 API経由アクセスを提供します。
 * Lambda環境ではNFS/SMBマウントができないため、S3 Access Pointsを使用します。
 */
class FsxOntapS3AccessPointConstruct extends constructs_1.Construct {
    /**
     * S3 Access Point ARN
     */
    accessPointArn;
    /**
     * S3 Access Point名
     */
    accessPointName;
    /**
     * VPCエンドポイント
     */
    vpcEndpoint;
    /**
     * IAMポリシー
     */
    accessPolicy;
    constructor(scope, id, props) {
        super(scope, id);
        // S3 Access Point名を生成
        this.accessPointName = `${props.projectName}-${props.environment}-${props.purpose}-access-point`;
        // VPCエンドポイント作成（S3 Gateway Endpoint）
        this.vpcEndpoint = new ec2.GatewayVpcEndpoint(this, 'S3VpcEndpoint', {
            vpc: props.vpc,
            service: ec2.GatewayVpcEndpointAwsService.S3,
            subnets: [
                {
                    subnets: props.privateSubnets,
                },
            ],
        });
        // S3 Access Point ARNを生成
        // 注意: 実際のS3 Access Pointは、FSx for ONTAPのS3 Access Points機能を使用して作成されます
        // ここでは、ARNのプレースホルダーを生成します
        // 実際のARNは、FSx for ONTAP管理コンソールまたはAWS CLIで取得する必要があります
        this.accessPointArn = `arn:aws:s3:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:accesspoint/${this.accessPointName}`;
        // IAMポリシーステートメント作成
        this.accessPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:ListBucket',
                's3:GetObjectVersion',
                's3:GetObjectAttributes',
                's3:PutObjectAcl',
            ],
            resources: [
                this.accessPointArn,
                `${this.accessPointArn}/*`,
            ],
        });
        // CloudFormation出力
        new cdk.CfnOutput(this, 'AccessPointArn', {
            value: this.accessPointArn,
            description: `S3 Access Point ARN for ${props.purpose}`,
            exportName: `${props.projectName}-${props.environment}-${props.purpose}-AccessPointArn`,
        });
        new cdk.CfnOutput(this, 'AccessPointName', {
            value: this.accessPointName,
            description: `S3 Access Point Name for ${props.purpose}`,
            exportName: `${props.projectName}-${props.environment}-${props.purpose}-AccessPointName`,
        });
        new cdk.CfnOutput(this, 'VpcEndpointId', {
            value: this.vpcEndpoint.vpcEndpointId,
            description: `VPC Endpoint ID for S3 Access Point (${props.purpose})`,
            exportName: `${props.projectName}-${props.environment}-${props.purpose}-VpcEndpointId`,
        });
        // タグ付け
        cdk.Tags.of(this).add('Purpose', props.purpose);
        cdk.Tags.of(this).add('FsxFileSystemId', props.fsxFileSystemId);
        cdk.Tags.of(this).add('VolumePath', props.volumePath);
    }
    /**
     * Lambda関数にアクセス権限を付与
     *
     * @param lambdaFunction Lambda関数
     */
    grantReadWrite(lambdaFunction) {
        lambdaFunction.addToRolePolicy(this.accessPolicy);
    }
    /**
     * Lambda関数に読み取り専用権限を付与
     *
     * @param lambdaFunction Lambda関数
     */
    grantRead(lambdaFunction) {
        const readOnlyPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                's3:GetObject',
                's3:ListBucket',
                's3:GetObjectVersion',
                's3:GetObjectAttributes',
            ],
            resources: [
                this.accessPointArn,
                `${this.accessPointArn}/*`,
            ],
        });
        lambdaFunction.addToRolePolicy(readOnlyPolicy);
    }
    /**
     * Lambda関数に書き込み専用権限を付与
     *
     * @param lambdaFunction Lambda関数
     */
    grantWrite(lambdaFunction) {
        const writeOnlyPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                's3:PutObject',
                's3:DeleteObject',
                's3:PutObjectAcl',
            ],
            resources: [
                this.accessPointArn,
                `${this.accessPointArn}/*`,
            ],
        });
        lambdaFunction.addToRolePolicy(writeOnlyPolicy);
    }
}
exports.FsxOntapS3AccessPointConstruct = FsxOntapS3AccessPointConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnN4LW9udGFwLXMzLWFjY2Vzcy1wb2ludC1jb25zdHJ1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJmc3gtb250YXAtczMtYWNjZXNzLXBvaW50LWNvbnN0cnVjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7R0FhRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFDbkMseURBQTJDO0FBRTNDLHlEQUEyQztBQUUzQywyQ0FBdUM7QUFpRHZDOzs7OztHQUtHO0FBQ0gsTUFBYSw4QkFBK0IsU0FBUSxzQkFBUztJQUMzRDs7T0FFRztJQUNhLGNBQWMsQ0FBUztJQUV2Qzs7T0FFRztJQUNhLGVBQWUsQ0FBUztJQUV4Qzs7T0FFRztJQUNhLFdBQVcsQ0FBbUI7SUFFOUM7O09BRUc7SUFDYSxZQUFZLENBQXNCO0lBRWxELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBMEM7UUFDbEYsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixzQkFBc0I7UUFDdEIsSUFBSSxDQUFDLGVBQWUsR0FBRyxHQUFHLEtBQUssQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMsT0FBTyxlQUFlLENBQUM7UUFFakcsb0NBQW9DO1FBQ3BDLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxHQUFHLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUNuRSxHQUFHLEVBQUUsS0FBSyxDQUFDLEdBQUc7WUFDZCxPQUFPLEVBQUUsR0FBRyxDQUFDLDRCQUE0QixDQUFDLEVBQUU7WUFDNUMsT0FBTyxFQUFFO2dCQUNQO29CQUNFLE9BQU8sRUFBRSxLQUFLLENBQUMsY0FBYztpQkFDOUI7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILHlCQUF5QjtRQUN6QixzRUFBc0U7UUFDdEUsMEJBQTBCO1FBQzFCLHFEQUFxRDtRQUNyRCxJQUFJLENBQUMs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QUksQ0FBQyxjQUFjLElBQUk7YUFDM0I7U0FDRixDQUFDLENBQUM7UUFFSCxjQUFjLENBQUMsZUFBZSxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQ2pELENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksVUFBVSxDQUFDLGNBQWdDO1FBQ2hELE1BQU0sZUFBZSxHQUFHLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUM5QyxNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sRUFBRTtnQkFDUCxjQUFjO2dCQUNkLGlCQUFpQjtnQkFDakIsaUJBQWlCO2FBQ2xCO1lBQ0QsU0FBUyxFQUFFO2dCQUNULElBQUksQ0FBQyxjQUFjO2dCQUNuQixHQUFHLElBQUksQ0FBQyxjQUFjLElBQUk7YUFDM0I7U0FDRixDQUFDLENBQUM7UUFFSCxjQUFjLENBQUMsZUFBZSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQ2xELENBQUM7Q0FDRjtBQTVJRCx3RUE0SUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEZTeCBmb3IgT05UQVAgKyBTMyBBY2Nlc3MgUG9pbnRz57Wx5ZCIQ29uc3RydWN0XG4gKiBcbiAqIOebrueahDpcbiAqIC0gRlN4IGZvciBPTlRBUOODnOODquODpeODvOODoOOBuOOBrlMzIEFQSee1jOeUseOCouOCr+OCu+OCueOCkuaPkOS+m1xuICogLSBMYW1iZGHnkrDlooPjgafjga5ORlMvU01C44Oe44Km44Oz44OI5Yi26ZmQ44KS6Kej5rG6XG4gKiAtIE1lbW9yeS9Ccm93c2VyL0NvZGUgSW50ZXJwcmV0ZXIvRXZhbHVhdGlvbnMvUG9saWN55qmf6IO944Gn5YWx6YCa5L2/55SoXG4gKiBcbiAqIOapn+iDvTpcbiAqIC0gUzMgQWNjZXNzIFBvaW505L2c5oiQXG4gKiAtIFZQQ+OCqOODs+ODieODneOCpOODs+ODiOS9nOaIkFxuICogLSBJQU3jg53jg6rjgrfjg7zoqK3lrppcbiAqIC0gTGFtYmRh6Zai5pWw44G444Gu44Ki44Kv44K744K55qip6ZmQ5LuY5LiOXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuLyoqXG4gKiBGU3ggZm9yIE9OVEFQICsgUzMgQWNjZXNzIFBvaW50cyBDb25zdHJ1Y3QgUHJvcHNcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBGc3hPbnRhcFMzQWNjZXNzUG9pbnRDb25zdHJ1Y3RQcm9wcyB7XG4gIC8qKlxuICAgKiBGU3ggZm9yIE9OVEFQ44OV44Kh44Kk44Or44K344K544OG44OgSURcbiAgICovXG4gIHJlYWRvbmx5IGZzeEZpbGVTeXN0ZW1JZDogc3RyaW5nO1xuICBcbiAgLyoqXG4gICAqIEZTeCBmb3IgT05UQVDjg5zjg6rjg6Xjg7zjg6Djg5HjgrlcbiAgICog5L6LOiAnL21lbW9yeS12b2x1bWUnLCAnL2Jyb3dzZXItdm9sdW1lJywgJy9jb2RlLWludGVycHJldGVyLXZvbHVtZSdcbiAgICovXG4gIHJlYWRvbmx5IHZvbHVtZVBhdGg6IHN0cmluZztcbiAgXG4gIC8qKlxuICAgKiDnlKjpgJTvvIjmqZ/og73lkI3vvIlcbiAgICog5L6LOiAnbWVtb3J5JywgJ2Jyb3dzZXInLCAnY29kZS1pbnRlcnByZXRlcicsICdldmFsdWF0aW9ucycsICdwb2xpY3knXG4gICAqL1xuICByZWFkb25seSBwdXJwb3NlOiBzdHJpbmc7XG4gIFxuICAvKipcbiAgICogVlBDXG4gICAqL1xuICByZWFkb25seSB2cGM6IGVjMi5JVnBjO1xuICBcbiAgLyoqXG4gICAqIOODl+ODqeOCpOODmeODvOODiOOCteODluODjeODg+ODiFxuICAgKi9cbiAgcmVhZG9ubHkgcHJpdmF0ZVN1Ym5ldHM6IGVjMi5JU3VibmV0W107XG4gIFxuICAvKipcbiAgICog44OX44Ot44K444Kn44Kv44OI5ZCNXG4gICAqL1xuICByZWFkb25seSBwcm9qZWN0TmFtZTogc3RyaW5nO1xuICBcbiAgLyoqXG4gICAqIOeSsOWig+WQjVxuICAgKi9cbiAgcmVhZG9ubHkgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgXG4gIC8qKlxuICAgKiBLTVPjgq3jg7zvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICovXG4gIHJlYWRvbmx5IGttc0tleT86IGFueTtcbn1cblxuLyoqXG4gKiBGU3ggZm9yIE9OVEFQICsgUzMgQWNjZXNzIFBvaW50cyBDb25zdHJ1Y3RcbiAqIFxuICog44GT44GuQ29uc3RydWN044Gv44CBRlN4IGZvciBPTlRBUOODnOODquODpeODvOODoOOBuOOBrlMzIEFQSee1jOeUseOCouOCr+OCu+OCueOCkuaPkOS+m+OBl+OBvuOBmeOAglxuICogTGFtYmRh55Kw5aKD44Gn44GvTkZTL1NNQuODnuOCpuODs+ODiOOBjOOBp+OBjeOBquOBhOOBn+OCgeOAgVMzIEFjY2VzcyBQb2ludHPjgpLkvb/nlKjjgZfjgb7jgZnjgIJcbiAqL1xuZXhwb3J0IGNsYXNzIEZzeE9udGFwUzNBY2Nlc3NQb2ludENvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XG4gIC8qKlxuICAgKiBTMyBBY2Nlc3MgUG9pbnQgQVJOXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgYWNjZXNzUG9pbnRBcm46IHN0cmluZztcbiAgXG4gIC8qKlxuICAgKiBTMyBBY2Nlc3MgUG9pbnTlkI1cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBhY2Nlc3NQb2ludE5hbWU6IHN0cmluZztcbiAgXG4gIC8qKlxuICAgKiBWUEPjgqjjg7Pjg4njg53jgqTjg7Pjg4hcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSB2cGNFbmRwb2ludDogZWMyLklWcGNFbmRwb2ludDtcbiAgXG4gIC8qKlxuICAgKiBJQU3jg53jg6rjgrfjg7xcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBhY2Nlc3NQb2xpY3k6IGlhbS5Qb2xpY3lTdGF0ZW1lbnQ7XG4gIFxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogRnN4T250YXBTM0FjY2Vzc1BvaW50Q29uc3RydWN0UHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuICAgIFxuICAgIC8vIFMzIEFjY2VzcyBQb2ludOWQjeOCkueUn+aIkFxuICAgIHRoaXMuYWNjZXNzUG9pbnROYW1lID0gYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LSR7cHJvcHMucHVycG9zZX0tYWNjZXNzLXBvaW50YDtcbiAgICBcbiAgICAvLyBWUEPjgqjjg7Pjg4njg53jgqTjg7Pjg4jkvZzmiJDvvIhTMyBHYXRld2F5IEVuZHBvaW5077yJXG4gICAgdGhpcy52cGNFbmRwb2ludCA9IG5ldyBlYzIuR2F0ZXdheVZwY0VuZHBvaW50KHRoaXMsICdTM1ZwY0VuZHBvaW50Jywge1xuICAgICAgdnBjOiBwcm9wcy52cGMsXG4gICAgICBzZXJ2aWNlOiBlYzIuR2F0ZXdheVZwY0VuZHBvaW50QXdzU2VydmljZS5TMyxcbiAgICAgIHN1Ym5ldHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHN1Ym5ldHM6IHByb3BzLnByaXZhdGVTdWJuZXRzLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcbiAgICBcbiAgICAvLyBTMyBBY2Nlc3MgUG9pbnQgQVJO44KS55Sf5oiQXG4gICAgLy8g5rOo5oSPOiDlrp/pmpvjga5TMyBBY2Nlc3MgUG9pbnTjga/jgIFGU3ggZm9yIE9OVEFQ44GuUzMgQWNjZXNzIFBvaW50c+apn+iDveOCkuS9v+eUqOOBl+OBpuS9nOaIkOOBleOCjOOBvuOBmVxuICAgIC8vIOOBk+OBk+OBp+OBr+OAgUFSTuOBruODl+ODrOODvOOCueODm+ODq+ODgOODvOOCkueUn+aIkOOBl+OBvuOBmVxuICAgIC8vIOWun+mam+OBrkFSTuOBr+OAgUZTeCBmb3IgT05UQVDnrqHnkIbjgrPjg7Pjgr3jg7zjg6vjgb7jgZ/jga9BV1MgQ0xJ44Gn5Y+W5b6X44GZ44KL5b+F6KaB44GM44GC44KK44G+44GZXG4gICAgdGhpcy5hY2Nlc3NQb2ludEFybiA9IGBhcm46YXdzOnMzOiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06YWNjZXNzcG9pbnQvJHt0aGlzLmFjY2Vzc1BvaW50TmFtZX1gO1xuICAgIFxuICAgIC8vIElBTeODneODquOCt+ODvOOCueODhuODvOODiOODoeODs+ODiOS9nOaIkFxuICAgIHRoaXMuYWNjZXNzUG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnczM6R2V0T2JqZWN0JyxcbiAgICAgICAgJ3MzOlB1dE9iamVjdCcsXG4gICAgICAgICdzMzpEZWxldGVPYmplY3QnLFxuICAgICAgICAnczM6TGlzdEJ1Y2tldCcsXG4gICAgICAgICdzMzpHZXRPYmplY3RWZXJzaW9uJyxcbiAgICAgICAgJ3MzOkdldE9iamVjdEF0dHJpYnV0ZXMnLFxuICAgICAgICAnczM6UHV0T2JqZWN0QWNsJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgdGhpcy5hY2Nlc3NQb2ludEFybixcbiAgICAgICAgYCR7dGhpcy5hY2Nlc3NQb2ludEFybn0vKmAsXG4gICAgICBdLFxuICAgIH0pO1xuICAgIFxuICAgIC8vIENsb3VkRm9ybWF0aW9u5Ye65YqbXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FjY2Vzc1BvaW50QXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuYWNjZXNzUG9pbnRBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogYFMzIEFjY2VzcyBQb2ludCBBUk4gZm9yICR7cHJvcHMucHVycG9zZX1gLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LSR7cHJvcHMucHVycG9zZX0tQWNjZXNzUG9pbnRBcm5gLFxuICAgIH0pO1xuICAgIFxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBY2Nlc3NQb2ludE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hY2Nlc3NQb2ludE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogYFMzIEFjY2VzcyBQb2ludCBOYW1lIGZvciAke3Byb3BzLnB1cnBvc2V9YCxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS0ke3Byb3BzLnB1cnBvc2V9LUFjY2Vzc1BvaW50TmFtZWAsXG4gICAgfSk7XG4gICAgXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ZwY0VuZHBvaW50SWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy52cGNFbmRwb2ludC52cGNFbmRwb2ludElkLFxuICAgICAgZGVzY3JpcHRpb246IGBWUEMgRW5kcG9pbnQgSUQgZm9yIFMzIEFjY2VzcyBQb2ludCAoJHtwcm9wcy5wdXJwb3NlfSlgLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LSR7cHJvcHMucHVycG9zZX0tVnBjRW5kcG9pbnRJZGAsXG4gICAgfSk7XG4gICAgXG4gICAgLy8g44K/44Kw5LuY44GRXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdQdXJwb3NlJywgcHJvcHMucHVycG9zZSk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdGc3hGaWxlU3lzdGVtSWQnLCBwcm9wcy5mc3hGaWxlU3lzdGVtSWQpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnVm9sdW1lUGF0aCcsIHByb3BzLnZvbHVtZVBhdGgpO1xuICB9XG4gIFxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw44Gr44Ki44Kv44K744K55qip6ZmQ44KS5LuY5LiOXG4gICAqIFxuICAgKiBAcGFyYW0gbGFtYmRhRnVuY3Rpb24gTGFtYmRh6Zai5pWwXG4gICAqL1xuICBwdWJsaWMgZ3JhbnRSZWFkV3JpdGUobGFtYmRhRnVuY3Rpb246IGxhbWJkYS5JRnVuY3Rpb24pOiB2b2lkIHtcbiAgICBsYW1iZGFGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kodGhpcy5hY2Nlc3NQb2xpY3kpO1xuICB9XG4gIFxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw44Gr6Kqt44G/5Y+W44KK5bCC55So5qip6ZmQ44KS5LuY5LiOXG4gICAqIFxuICAgKiBAcGFyYW0gbGFtYmRhRnVuY3Rpb24gTGFtYmRh6Zai5pWwXG4gICAqL1xuICBwdWJsaWMgZ3JhbnRSZWFkKGxhbWJkYUZ1bmN0aW9uOiBsYW1iZGEuSUZ1bmN0aW9uKTogdm9pZCB7XG4gICAgY29uc3QgcmVhZE9ubHlQb2xpY3kgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdzMzpHZXRPYmplY3QnLFxuICAgICAgICAnczM6TGlzdEJ1Y2tldCcsXG4gICAgICAgICdzMzpHZXRPYmplY3RWZXJzaW9uJyxcbiAgICAgICAgJ3MzOkdldE9iamVjdEF0dHJpYnV0ZXMnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICB0aGlzLmFjY2Vzc1BvaW50QXJuLFxuICAgICAgICBgJHt0aGlzLmFjY2Vzc1BvaW50QXJufS8qYCxcbiAgICAgIF0sXG4gICAgfSk7XG4gICAgXG4gICAgbGFtYmRhRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KHJlYWRPbmx5UG9saWN5KTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIExhbWJkYemWouaVsOOBq+abuOOBjei+vOOBv+WwgueUqOaoqemZkOOCkuS7mOS4jlxuICAgKiBcbiAgICogQHBhcmFtIGxhbWJkYUZ1bmN0aW9uIExhbWJkYemWouaVsFxuICAgKi9cbiAgcHVibGljIGdyYW50V3JpdGUobGFtYmRhRnVuY3Rpb246IGxhbWJkYS5JRnVuY3Rpb24pOiB2b2lkIHtcbiAgICBjb25zdCB3cml0ZU9ubHlQb2xpY3kgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdzMzpQdXRPYmplY3QnLFxuICAgICAgICAnczM6RGVsZXRlT2JqZWN0JyxcbiAgICAgICAgJ3MzOlB1dE9iamVjdEFjbCcsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIHRoaXMuYWNjZXNzUG9pbnRBcm4sXG4gICAgICAgIGAke3RoaXMuYWNjZXNzUG9pbnRBcm59LypgLFxuICAgICAgXSxcbiAgICB9KTtcbiAgICBcbiAgICBsYW1iZGFGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kod3JpdGVPbmx5UG9saWN5KTtcbiAgfVxufVxuIl19