"use strict";
/**
 * シンプルなOpenSearchスタック
 *
 * 開発環境用の最小構成OpenSearchドメイン
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
exports.SimpleOpenSearchStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const es = __importStar(require("aws-cdk-lib/aws-elasticsearch"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
class SimpleOpenSearchStack extends cdk.Stack {
    domain;
    constructor(scope, id, props) {
        super(scope, id, props);
        // ドメイン名生成（短縮版）
        const domainName = `${props.projectName}-${props.environment}`.substring(0, 28);
        // ElasticSearchドメイン作成
        this.domain = new es.Domain(this, 'OpenSearchDomain', {
            domainName: domainName,
            version: es.ElasticsearchVersion.V7_10,
            // 開発環境用最小構成
            capacity: {
                dataNodes: 1,
                dataNodeInstanceType: 't3.small.elasticsearch',
            },
            // ストレージ設定
            ebs: {
                enabled: true,
                volumeType: cdk.aws_ec2.EbsDeviceVolumeType.GP3,
                volumeSize: 20,
            },
            // セキュリティ設定
            encryptionAtRest: {
                enabled: true,
            },
            nodeToNodeEncryption: true,
            enforceHttps: true,
            // パブリックアクセス（開発環境用）
            vpc: undefined,
            // 削除ポリシー
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // アクセスポリシー設定
        this.domain.addAccessPolicies(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ['es:*'],
            resources: [this.domain.domainArn + '/*'],
        }));
        // CloudFormation出力
        new cdk.CfnOutput(this, 'OpenSearchDomainEndpoint', {
            value: this.domain.domainEndpoint,
            description: 'OpenSearch domain endpoint',
            exportName: `${this.stackName}-DomainEndpoint`,
        });
        new cdk.CfnOutput(this, 'OpenSearchDomainName', {
            value: this.domain.domainName,
            description: 'OpenSearch domain name',
            exportName: `${this.stackName}-DomainName`,
        });
        new cdk.CfnOutput(this, 'OpenSearchKibanaEndpoint', {
            value: `${this.domain.domainEndpoint}/_dashboards/`,
            description: 'OpenSearch Kibana endpoint',
            exportName: `${this.stackName}-KibanaEndpoint`,
        });
        // タグ設定
        cdk.Tags.of(this).add('Environment', props.environment);
        cdk.Tags.of(this).add('ProjectName', props.projectName);
        cdk.Tags.of(this).add('Component', 'OpenSearch');
        cdk.Tags.of(this).add('Purpose', 'MultimodalEmbedding');
    }
}
exports.SimpleOpenSearchStack = SimpleOpenSearchStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2ltcGxlLW9wZW5zZWFyY2gtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzaW1wbGUtb3BlbnNlYXJjaC1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7R0FJRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFFbkMsa0VBQW9EO0FBQ3BELHlEQUEyQztBQVczQyxNQUFhLHFCQUFzQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ2xDLE1BQU0sQ0FBWTtJQUVsQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWlDO1FBQ3pFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGVBQWU7UUFDZixNQUFNLFVBQVUsR0FBRyxHQUFHLEtBQUssQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDLFdBQVcsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFaEYsc0JBQXNCO1FBQ3RCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUNwRCxVQUFVLEVBQUUsVUFBVTtZQUN0QixPQUFPLEVBQUUsRUFBRSxDQUFDLG9CQUFvQixDQUFDLEtBQUs7WUFFdEMsWUFBWTtZQUNaLFFBQVEsRUFBRTtnQkFDUixTQUFTLEVBQUUsQ0FBQztnQkFDWixvQkFBb0IsRUFBRSx3QkFBd0I7YUFDL0M7WUFFRCxVQUFVO1lBQ1YsR0FBRyxFQUFFO2dCQUNILE9BQU8sRUFBRSxJQUFJO2dCQUNiLFVBQVUsRUFBRSxHQUFHLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLEdBQUc7Z0JBQy9DLFVBQVUsRUFBRSxFQUFFO2FBQ2Y7WUFFRCxXQUFXO1lBQ1gsZ0JBQWdCLEVBQUU7Z0JBQ2hCLE9BQU8sRUFBRSxJQUFJO2FBQ2Q7WUFDRCxvQkFBb0IsRUFBRSxJQUFJO1lBQzFCLFlBQVksRUFBRSxJQUFJO1lBRWxCLG1CQUFtQjtZQUNuQixHQUFHLEVBQUUsU0FBUztZQUVkLFNBQVM7WUFDVCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1NBQ3pDLENBQUMsQ0FBQztRQUVILGFBQWE7UUFDYixJQUFJLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUMzQixJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDdEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztZQUN4QixVQUFVLEVBQUUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1lBQzVDLE9BQU8sRUFBRSxDQUFDLE1BQU0sQ0FBQztZQUNqQixTQUFTLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7U0FDMUMsQ0FBQyxDQUNILENBQUM7UUFFRixtQkFBbUI7UUFDbkIsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSwwQkFBMEIsRUFBRTtZQUNsRCxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjO1lBQ2pDLFdBQVcsRUFBRSw0QkFBNEI7WUFDekMsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsaUJBQWlCO1NBQy9DLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDOUMsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVTtZQUM3QixXQUFXLEVBQUUsd0JBQXdCO1lBQ3JDLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLGFBQWE7U0FDM0MsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSwwQkFBMEIsRUFBRTtZQUNsRCxLQUFLLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLGNBQWMsZUFBZTtZQUNuRCxXQUFXLEVBQUUsNEJBQTRCO1lBQ3pDLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLGlCQUFpQjtTQUMvQyxDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDeEQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDeEQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUNqRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLHFCQUFxQixDQUFDLENBQUM7SUFDMUQsQ0FBQztDQUNGO0FBNUVELHNEQTRFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog44K344Oz44OX44Or44GqT3BlblNlYXJjaOOCueOCv+ODg+OCr1xuICogXG4gKiDplovnmbrnkrDlooPnlKjjga7mnIDlsI/mp4vmiJBPcGVuU2VhcmNo44OJ44Oh44Kk44OzXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIG9wZW5zZWFyY2ggZnJvbSAnYXdzLWNkay1saWIvYXdzLW9wZW5zZWFyY2hzZXJ2ZXJsZXNzJztcbmltcG9ydCAqIGFzIGVzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lbGFzdGljc2VhcmNoJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNpbXBsZU9wZW5TZWFyY2hTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICAvKiog55Kw5aKD5ZCNICovXG4gIHJlYWRvbmx5IGVudmlyb25tZW50OiBzdHJpbmc7XG4gIFxuICAvKiog44OX44Ot44K444Kn44Kv44OI5ZCNICovXG4gIHJlYWRvbmx5IHByb2plY3ROYW1lOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBTaW1wbGVPcGVuU2VhcmNoU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgZG9tYWluOiBlcy5Eb21haW47XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFNpbXBsZU9wZW5TZWFyY2hTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyDjg4njg6HjgqTjg7PlkI3nlJ/miJDvvIjnn63nuK7niYjvvIlcbiAgICBjb25zdCBkb21haW5OYW1lID0gYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9YC5zdWJzdHJpbmcoMCwgMjgpO1xuXG4gICAgLy8gRWxhc3RpY1NlYXJjaOODieODoeOCpOODs+S9nOaIkFxuICAgIHRoaXMuZG9tYWluID0gbmV3IGVzLkRvbWFpbih0aGlzLCAnT3BlblNlYXJjaERvbWFpbicsIHtcbiAgICAgIGRvbWFpbk5hbWU6IGRvbWFpbk5hbWUsXG4gICAgICB2ZXJzaW9uOiBlcy5FbGFzdGljc2VhcmNoVmVyc2lvbi5WN18xMCxcbiAgICAgIFxuICAgICAgLy8g6ZaL55m655Kw5aKD55So5pyA5bCP5qeL5oiQXG4gICAgICBjYXBhY2l0eToge1xuICAgICAgICBkYXRhTm9kZXM6IDEsXG4gICAgICAgIGRhdGFOb2RlSW5zdGFuY2VUeXBlOiAndDMuc21hbGwuZWxhc3RpY3NlYXJjaCcsXG4gICAgICB9LFxuXG4gICAgICAvLyDjgrnjg4jjg6zjg7zjgrjoqK3lrppcbiAgICAgIGViczoge1xuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICB2b2x1bWVUeXBlOiBjZGsuYXdzX2VjMi5FYnNEZXZpY2VWb2x1bWVUeXBlLkdQMyxcbiAgICAgICAgdm9sdW1lU2l6ZTogMjAsXG4gICAgICB9LFxuXG4gICAgICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPoqK3lrppcbiAgICAgIGVuY3J5cHRpb25BdFJlc3Q6IHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBub2RlVG9Ob2RlRW5jcnlwdGlvbjogdHJ1ZSxcbiAgICAgIGVuZm9yY2VIdHRwczogdHJ1ZSxcblxuICAgICAgLy8g44OR44OW44Oq44OD44Kv44Ki44Kv44K744K577yI6ZaL55m655Kw5aKD55So77yJXG4gICAgICB2cGM6IHVuZGVmaW5lZCxcblxuICAgICAgLy8g5YmK6Zmk44Od44Oq44K344O8XG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8g44Ki44Kv44K744K544Od44Oq44K344O86Kit5a6aXG4gICAgdGhpcy5kb21haW4uYWRkQWNjZXNzUG9saWNpZXMoXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcHJpbmNpcGFsczogW25ldyBpYW0uQWNjb3VudFJvb3RQcmluY2lwYWwoKV0sXG4gICAgICAgIGFjdGlvbnM6IFsnZXM6KiddLFxuICAgICAgICByZXNvdXJjZXM6IFt0aGlzLmRvbWFpbi5kb21haW5Bcm4gKyAnLyonXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIENsb3VkRm9ybWF0aW9u5Ye65YqbXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ09wZW5TZWFyY2hEb21haW5FbmRwb2ludCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmRvbWFpbi5kb21haW5FbmRwb2ludCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnT3BlblNlYXJjaCBkb21haW4gZW5kcG9pbnQnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LURvbWFpbkVuZHBvaW50YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdPcGVuU2VhcmNoRG9tYWluTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmRvbWFpbi5kb21haW5OYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdPcGVuU2VhcmNoIGRvbWFpbiBuYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Eb21haW5OYW1lYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdPcGVuU2VhcmNoS2liYW5hRW5kcG9pbnQnLCB7XG4gICAgICB2YWx1ZTogYCR7dGhpcy5kb21haW4uZG9tYWluRW5kcG9pbnR9L19kYXNoYm9hcmRzL2AsXG4gICAgICBkZXNjcmlwdGlvbjogJ09wZW5TZWFyY2ggS2liYW5hIGVuZHBvaW50JyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1LaWJhbmFFbmRwb2ludGAsXG4gICAgfSk7XG5cbiAgICAvLyDjgr/jgrDoqK3lrppcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50JywgcHJvcHMuZW52aXJvbm1lbnQpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnUHJvamVjdE5hbWUnLCBwcm9wcy5wcm9qZWN0TmFtZSk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdDb21wb25lbnQnLCAnT3BlblNlYXJjaCcpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnUHVycG9zZScsICdNdWx0aW1vZGFsRW1iZWRkaW5nJyk7XG4gIH1cbn0iXX0=