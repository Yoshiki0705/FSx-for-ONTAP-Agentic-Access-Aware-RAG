"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseConstruct = void 0;
const constructs_1 = require("constructs");
const opensearch_multimodal_construct_1 = require("./opensearch-multimodal-construct");
class DatabaseConstruct extends constructs_1.Construct {
    outputs;
    openSearchConstruct;
    constructor(scope, id, props) {
        super(scope, id);
        console.log('DatabaseConstruct initialized');
        // OpenSearch Serverless作成（修正版）
        const openSearchConfig = {
            domainName: 'permission-aware-rag-vectors',
            environment: props.environment || 'prod',
            collectionConfig: {
                type: 'VECTORSEARCH',
                description: 'Vector search collection for RAG embeddings',
            },
            networkConfig: {
                vpcEnabled: false, // パブリックアクセス
            },
            securityConfig: {
                encryptionAtRest: true,
                nodeToNodeEncryption: true,
                enforceHttps: true,
                kmsKey: props.kmsKey,
                fineGrainedAccessControl: false,
            },
            monitoringConfig: {
                logsEnabled: true,
                slowLogsEnabled: false,
                appLogsEnabled: false,
                indexSlowLogsEnabled: false,
            },
        };
        this.openSearchConstruct = new opensearch_multimodal_construct_1.OpenSearchMultimodalConstruct(this, 'OpenSearch', openSearchConfig);
        // 出力を初期化
        this.outputs = {
            dynamoDbTables: {},
            openSearchEndpoint: this.openSearchConstruct?.outputs.domainEndpoint,
            openSearchDomainArn: this.openSearchConstruct?.outputs.domainArn,
            openSearchDomainId: this.openSearchConstruct?.outputs.domainName,
        };
    }
}
exports.DatabaseConstruct = DatabaseConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YWJhc2UtY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGF0YWJhc2UtY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDJDQUF1QztBQUl2Qyx1RkFBa0Y7QUFrQmxGLE1BQWEsaUJBQWtCLFNBQVEsc0JBQVM7SUFDOUIsT0FBTyxDQUFrQjtJQUNqQyxtQkFBbUIsQ0FBaUM7SUFFNUQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE2QjtRQUNyRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLE9BQU8sQ0FBQyxHQUFHLENBQUMsK0JBQStCLENBQUMsQ0FBQztRQUU3QywrQkFBK0I7UUFDL0IsTUFBTSxnQkFBZ0IsR0FBUTtZQUM1QixVQUFVLEVBQUUsOEJBQThCO1lBQzFDLFdBQVcsRUFBRSxLQUFLLENBQUMsV0FBVyxJQUFJLE1BQU07WUFDeEMsZ0JBQWdCLEVBQUU7Z0JBQ2hCLElBQUksRUFBRSxjQUFjO2dCQUNwQixXQUFXLEVBQUUsNkNBQTZDO2FBQzNEO1lBQ0QsYUFBYSxFQUFFO2dCQUNiLFVBQVUsRUFBRSxLQUFLLEVBQUUsWUFBWTthQUNoQztZQUNELGNBQWMsRUFBRTtnQkFDZCxnQkFBZ0IsRUFBRSxJQUFJO2dCQUN0QixvQkFBb0IsRUFBRSxJQUFJO2dCQUMxQixZQUFZLEVBQUUsSUFBSTtnQkFDbEIsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNO2dCQUNwQix3QkFBd0IsRUFBRSxLQUFLO2FBQ2hDO1lBQ0QsZ0JBQWdCLEVBQUU7Z0JBQ2hCLFdBQVcsRUFBRSxJQUFJO2dCQUNqQixlQUFlLEVBQUUsS0FBSztnQkFDdEIsY0FBYyxFQUFFLEtBQUs7Z0JBQ3JCLG9CQUFvQixFQUFFLEtBQUs7YUFDNUI7U0FDRixDQUFDO1FBRUYsSUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUksK0RBQTZCLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBRW5HLFNBQVM7UUFDVCxJQUFJLENBQUMsT0FBTyxHQUFHO1lBQ2IsY0FBYyxFQUFFLEVBQUU7WUFDbEIsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixFQUFFLE9BQU8sQ0FBQyxjQUFjO1lBQ3BFLG1CQUFtQixFQUFFLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxPQUFPLENBQUMsU0FBUztZQUNoRSxrQkFBa0IsRUFBRSxJQUFJLENBQUMsbUJBQW1CLEVBQUUsT0FBTyxDQUFDLFVBQVU7U0FDakUsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQTdDRCw4Q0E2Q0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0IHsgRGF0YWJhc2VDb25maWcgfSBmcm9tICcuLi9pbnRlcmZhY2VzL2RhdGFiYXNlLWNvbmZpZyc7XG5pbXBvcnQgeyBPcGVuU2VhcmNoTXVsdGltb2RhbENvbnN0cnVjdCB9IGZyb20gJy4vb3BlbnNlYXJjaC1tdWx0aW1vZGFsLWNvbnN0cnVjdCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGF0YWJhc2VDb25zdHJ1Y3RQcm9wcyB7XG4gIGNvbmZpZzogRGF0YWJhc2VDb25maWc7XG4gIHByb2plY3ROYW1lPzogc3RyaW5nO1xuICBlbnZpcm9ubWVudD86IHN0cmluZztcbiAga21zS2V5PzogYW55O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIERhdGFiYXNlT3V0cHV0cyB7XG4gIGR5bmFtb0RiVGFibGVzPzoge1xuICAgIFtrZXk6IHN0cmluZ106IGR5bmFtb2RiLklUYWJsZTtcbiAgfTtcbiAgb3BlblNlYXJjaEVuZHBvaW50Pzogc3RyaW5nO1xuICBvcGVuU2VhcmNoRG9tYWluQXJuPzogc3RyaW5nO1xuICBvcGVuU2VhcmNoRG9tYWluSWQ/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBEYXRhYmFzZUNvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyByZWFkb25seSBvdXRwdXRzOiBEYXRhYmFzZU91dHB1dHM7XG4gIHByaXZhdGUgb3BlblNlYXJjaENvbnN0cnVjdD86IE9wZW5TZWFyY2hNdWx0aW1vZGFsQ29uc3RydWN0O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBEYXRhYmFzZUNvbnN0cnVjdFByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcbiAgICBcbiAgICBjb25zb2xlLmxvZygnRGF0YWJhc2VDb25zdHJ1Y3QgaW5pdGlhbGl6ZWQnKTtcbiAgICBcbiAgICAvLyBPcGVuU2VhcmNoIFNlcnZlcmxlc3PkvZzmiJDvvIjkv67mraPniYjvvIlcbiAgICBjb25zdCBvcGVuU2VhcmNoQ29uZmlnOiBhbnkgPSB7XG4gICAgICBkb21haW5OYW1lOiAncGVybWlzc2lvbi1hd2FyZS1yYWctdmVjdG9ycycsXG4gICAgICBlbnZpcm9ubWVudDogcHJvcHMuZW52aXJvbm1lbnQgfHwgJ3Byb2QnLFxuICAgICAgY29sbGVjdGlvbkNvbmZpZzoge1xuICAgICAgICB0eXBlOiAnVkVDVE9SU0VBUkNIJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdWZWN0b3Igc2VhcmNoIGNvbGxlY3Rpb24gZm9yIFJBRyBlbWJlZGRpbmdzJyxcbiAgICAgIH0sXG4gICAgICBuZXR3b3JrQ29uZmlnOiB7XG4gICAgICAgIHZwY0VuYWJsZWQ6IGZhbHNlLCAvLyDjg5Hjg5bjg6rjg4Pjgq/jgqLjgq/jgrvjgrlcbiAgICAgIH0sXG4gICAgICBzZWN1cml0eUNvbmZpZzoge1xuICAgICAgICBlbmNyeXB0aW9uQXRSZXN0OiB0cnVlLFxuICAgICAgICBub2RlVG9Ob2RlRW5jcnlwdGlvbjogdHJ1ZSxcbiAgICAgICAgZW5mb3JjZUh0dHBzOiB0cnVlLFxuICAgICAgICBrbXNLZXk6IHByb3BzLmttc0tleSxcbiAgICAgICAgZmluZUdyYWluZWRBY2Nlc3NDb250cm9sOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBtb25pdG9yaW5nQ29uZmlnOiB7XG4gICAgICAgIGxvZ3NFbmFibGVkOiB0cnVlLFxuICAgICAgICBzbG93TG9nc0VuYWJsZWQ6IGZhbHNlLFxuICAgICAgICBhcHBMb2dzRW5hYmxlZDogZmFsc2UsXG4gICAgICAgIGluZGV4U2xvd0xvZ3NFbmFibGVkOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfTtcblxuICAgIHRoaXMub3BlblNlYXJjaENvbnN0cnVjdCA9IG5ldyBPcGVuU2VhcmNoTXVsdGltb2RhbENvbnN0cnVjdCh0aGlzLCAnT3BlblNlYXJjaCcsIG9wZW5TZWFyY2hDb25maWcpO1xuICAgIFxuICAgIC8vIOWHuuWKm+OCkuWIneacn+WMllxuICAgIHRoaXMub3V0cHV0cyA9IHtcbiAgICAgIGR5bmFtb0RiVGFibGVzOiB7fSxcbiAgICAgIG9wZW5TZWFyY2hFbmRwb2ludDogdGhpcy5vcGVuU2VhcmNoQ29uc3RydWN0Py5vdXRwdXRzLmRvbWFpbkVuZHBvaW50LFxuICAgICAgb3BlblNlYXJjaERvbWFpbkFybjogdGhpcy5vcGVuU2VhcmNoQ29uc3RydWN0Py5vdXRwdXRzLmRvbWFpbkFybixcbiAgICAgIG9wZW5TZWFyY2hEb21haW5JZDogdGhpcy5vcGVuU2VhcmNoQ29uc3RydWN0Py5vdXRwdXRzLmRvbWFpbk5hbWUsXG4gICAgfTtcbiAgfVxufVxuIl19