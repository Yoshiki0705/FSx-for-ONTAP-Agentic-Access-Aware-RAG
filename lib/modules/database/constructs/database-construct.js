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
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔍 DatabaseConstruct initialized');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 Full config:', JSON.stringify(props.config, null, 2));
        console.log('📋 OpenSearch config:', JSON.stringify(props.config.openSearch, null, 2));
        console.log('📋 OpenSearch enabled:', props.config.openSearch?.enabled);
        console.log('📋 Type of enabled:', typeof props.config.openSearch?.enabled);
        console.log('📋 Strict equality check (=== false):', props.config.openSearch?.enabled === false);
        console.log('📋 Strict equality check (=== true):', props.config.openSearch?.enabled === true);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        // 出力を初期化
        this.outputs = {
            dynamoDbTables: {},
        };
        // OpenSearch Serverless作成（条件付き）
        // 明示的に enabled === true をチェック
        if (props.config.openSearch?.enabled === true) {
            console.log('Creating OpenSearch Serverless...');
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
            // OpenSearch出力を追加
            this.outputs.openSearchEndpoint = this.openSearchConstruct?.outputs.domainEndpoint;
            this.outputs.openSearchDomainArn = this.openSearchConstruct?.outputs.domainArn;
            this.outputs.openSearchDomainId = this.openSearchConstruct?.outputs.domainName;
            console.log('OpenSearch Serverless created successfully');
        }
        else {
            console.log('OpenSearch Serverless is disabled, skipping creation');
        }
    }
}
exports.DatabaseConstruct = DatabaseConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YWJhc2UtY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGF0YWJhc2UtY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDJDQUF1QztBQUl2Qyx1RkFBa0Y7QUFrQmxGLE1BQWEsaUJBQWtCLFNBQVEsc0JBQVM7SUFDOUIsT0FBTyxDQUFrQjtJQUNqQyxtQkFBbUIsQ0FBaUM7SUFFNUQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE2QjtRQUNyRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLE9BQU8sQ0FBQyxHQUFHLENBQUMsOERBQThELENBQUMsQ0FBQztRQUM1RSxPQUFPLENBQUMsR0FBRyxDQUFDLGtDQUFrQyxDQUFDLENBQUM7UUFDaEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyw4REFBOEQsQ0FBQyxDQUFDO1FBQzVFLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3RFLE9BQU8sQ0FBQyxHQUFHLENBQUMsdUJBQXVCLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN2RixPQUFPLENBQUMsR0FBRyxDQUFDLHdCQUF3QixFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3hFLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLEVBQUUsT0FBTyxLQUFLLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM1RSxPQUFPLENBQUMsR0FBRyxDQUFDLHVDQUF1QyxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLE9BQU8sS0FBSyxLQUFLLENBQUMsQ0FBQztRQUNqRyxPQUFPLENBQUMsR0FBRyxDQUFDLHNDQUFzQyxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLE9BQU8sS0FBSyxJQUFJLENBQUMsQ0FBQztRQUMvRixPQUFPLENBQUMsR0FBRyxDQUFDLDhEQUE4RCxDQUFDLENBQUM7UUFFNUUsU0FBUztRQUNULElBQUksQ0FBQyxPQUFPLEdBQUc7WUFDYixjQUFjLEVBQUUsRUFBRTtTQUNuQixDQUFDO1FBRUYsZ0NBQWdDO1FBQ2hDLDhCQUE4QjtRQUM5QixJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLE9BQU8sS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUM5QyxPQUFPLENBQUMsR0FBRyxDQUFDLG1DQUFtQyxDQUFDLENBQUM7WUFFakQsTUFBTSxnQkFBZ0IsR0FBUTtnQkFDNUIsVUFBVSxFQUFFLDhCQUE4QjtnQkFDMUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxXQUFXLElBQUksTUFBTTtnQkFDeEMsZ0JBQWdCLEVBQUU7b0JBQ2hCLElBQUksRUFBRSxjQUFjO29CQUNwQixXQUFXLEVBQUUsNkNBQTZDO2lCQUMzRDtnQkFDRCxhQUFhLEVBQUU7b0JBQ2IsVUFBVSxFQUFFLEtBQUssRUFBRSxZQUFZO2lCQUNoQztnQkFDRCxjQUFjLEVBQUU7b0JBQ2QsZ0JBQWdCLEVBQUUsSUFBSTtvQkFDdEIsb0JBQW9CLEVBQUUsSUFBSTtvQkFDMUIsWUFBWSxFQUFFLElBQUk7b0JBQ2xCLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTTtvQkFDcEIsd0JBQXdCLEVBQUUsS0FBSztpQkFDaEM7Z0JBQ0QsZ0JBQWdCLEVBQUU7b0JBQ2hCLFdBQVcsRUFBRSxJQUFJO29CQUNqQixlQUFlLEVBQUUsS0FBSztvQkFDdEIsY0FBYyxFQUFFLEtBQUs7b0JBQ3JCLG9CQUFvQixFQUFFLEtBQUs7aUJBQzVCO2FBQ0YsQ0FBQztZQUVGLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxJQUFJLCtEQUE2QixDQUFDLElBQUksRUFBRSxZQUFZLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztZQUVuRyxrQkFBa0I7WUFDbEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsT0FBTyxDQUFDLGNBQWMsQ0FBQztZQUNuRixJQUFJLENBQUMsT0FBTyxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxPQUFPLENBQUMsU0FBUyxDQUFDO1lBQy9FLElBQUksQ0FBQyxPQUFPLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUM7WUFFL0UsT0FBTyxDQUFDLEdBQUcsQ0FBQyw0Q0FBNEMsQ0FBQyxDQUFDO1FBQzVELENBQUM7YUFBTSxDQUFDO1lBQ04sT0FBTyxDQUFDLEdBQUcsQ0FBQyxzREFBc0QsQ0FBQyxDQUFDO1FBQ3RFLENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUFqRUQsOENBaUVDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCB7IERhdGFiYXNlQ29uZmlnIH0gZnJvbSAnLi4vaW50ZXJmYWNlcy9kYXRhYmFzZS1jb25maWcnO1xuaW1wb3J0IHsgT3BlblNlYXJjaE11bHRpbW9kYWxDb25zdHJ1Y3QgfSBmcm9tICcuL29wZW5zZWFyY2gtbXVsdGltb2RhbC1jb25zdHJ1Y3QnO1xuXG5leHBvcnQgaW50ZXJmYWNlIERhdGFiYXNlQ29uc3RydWN0UHJvcHMge1xuICBjb25maWc6IERhdGFiYXNlQ29uZmlnO1xuICBwcm9qZWN0TmFtZT86IHN0cmluZztcbiAgZW52aXJvbm1lbnQ/OiBzdHJpbmc7XG4gIGttc0tleT86IGFueTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBEYXRhYmFzZU91dHB1dHMge1xuICBkeW5hbW9EYlRhYmxlcz86IHtcbiAgICBba2V5OiBzdHJpbmddOiBkeW5hbW9kYi5JVGFibGU7XG4gIH07XG4gIG9wZW5TZWFyY2hFbmRwb2ludD86IHN0cmluZztcbiAgb3BlblNlYXJjaERvbWFpbkFybj86IHN0cmluZztcbiAgb3BlblNlYXJjaERvbWFpbklkPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgRGF0YWJhc2VDb25zdHJ1Y3QgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgb3V0cHV0czogRGF0YWJhc2VPdXRwdXRzO1xuICBwcml2YXRlIG9wZW5TZWFyY2hDb25zdHJ1Y3Q/OiBPcGVuU2VhcmNoTXVsdGltb2RhbENvbnN0cnVjdDtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogRGF0YWJhc2VDb25zdHJ1Y3RQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG4gICAgXG4gICAgY29uc29sZS5sb2coJ+KUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgScpO1xuICAgIGNvbnNvbGUubG9nKCfwn5SNIERhdGFiYXNlQ29uc3RydWN0IGluaXRpYWxpemVkJyk7XG4gICAgY29uc29sZS5sb2coJ+KUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgScpO1xuICAgIGNvbnNvbGUubG9nKCfwn5OLIEZ1bGwgY29uZmlnOicsIEpTT04uc3RyaW5naWZ5KHByb3BzLmNvbmZpZywgbnVsbCwgMikpO1xuICAgIGNvbnNvbGUubG9nKCfwn5OLIE9wZW5TZWFyY2ggY29uZmlnOicsIEpTT04uc3RyaW5naWZ5KHByb3BzLmNvbmZpZy5vcGVuU2VhcmNoLCBudWxsLCAyKSk7XG4gICAgY29uc29sZS5sb2coJ/Cfk4sgT3BlblNlYXJjaCBlbmFibGVkOicsIHByb3BzLmNvbmZpZy5vcGVuU2VhcmNoPy5lbmFibGVkKTtcbiAgICBjb25zb2xlLmxvZygn8J+TiyBUeXBlIG9mIGVuYWJsZWQ6JywgdHlwZW9mIHByb3BzLmNvbmZpZy5vcGVuU2VhcmNoPy5lbmFibGVkKTtcbiAgICBjb25zb2xlLmxvZygn8J+TiyBTdHJpY3QgZXF1YWxpdHkgY2hlY2sgKD09PSBmYWxzZSk6JywgcHJvcHMuY29uZmlnLm9wZW5TZWFyY2g/LmVuYWJsZWQgPT09IGZhbHNlKTtcbiAgICBjb25zb2xlLmxvZygn8J+TiyBTdHJpY3QgZXF1YWxpdHkgY2hlY2sgKD09PSB0cnVlKTonLCBwcm9wcy5jb25maWcub3BlblNlYXJjaD8uZW5hYmxlZCA9PT0gdHJ1ZSk7XG4gICAgY29uc29sZS5sb2coJ+KUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgeKUgScpO1xuICAgIFxuICAgIC8vIOWHuuWKm+OCkuWIneacn+WMllxuICAgIHRoaXMub3V0cHV0cyA9IHtcbiAgICAgIGR5bmFtb0RiVGFibGVzOiB7fSxcbiAgICB9O1xuICAgIFxuICAgIC8vIE9wZW5TZWFyY2ggU2VydmVybGVzc+S9nOaIkO+8iOadoeS7tuS7mOOBje+8iVxuICAgIC8vIOaYjuekuueahOOBqyBlbmFibGVkID09PSB0cnVlIOOCkuODgeOCp+ODg+OCr1xuICAgIGlmIChwcm9wcy5jb25maWcub3BlblNlYXJjaD8uZW5hYmxlZCA9PT0gdHJ1ZSkge1xuICAgICAgY29uc29sZS5sb2coJ0NyZWF0aW5nIE9wZW5TZWFyY2ggU2VydmVybGVzcy4uLicpO1xuICAgICAgXG4gICAgICBjb25zdCBvcGVuU2VhcmNoQ29uZmlnOiBhbnkgPSB7XG4gICAgICAgIGRvbWFpbk5hbWU6ICdwZXJtaXNzaW9uLWF3YXJlLXJhZy12ZWN0b3JzJyxcbiAgICAgICAgZW52aXJvbm1lbnQ6IHByb3BzLmVudmlyb25tZW50IHx8ICdwcm9kJyxcbiAgICAgICAgY29sbGVjdGlvbkNvbmZpZzoge1xuICAgICAgICAgIHR5cGU6ICdWRUNUT1JTRUFSQ0gnLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnVmVjdG9yIHNlYXJjaCBjb2xsZWN0aW9uIGZvciBSQUcgZW1iZWRkaW5ncycsXG4gICAgICAgIH0sXG4gICAgICAgIG5ldHdvcmtDb25maWc6IHtcbiAgICAgICAgICB2cGNFbmFibGVkOiBmYWxzZSwgLy8g44OR44OW44Oq44OD44Kv44Ki44Kv44K744K5XG4gICAgICAgIH0sXG4gICAgICAgIHNlY3VyaXR5Q29uZmlnOiB7XG4gICAgICAgICAgZW5jcnlwdGlvbkF0UmVzdDogdHJ1ZSxcbiAgICAgICAgICBub2RlVG9Ob2RlRW5jcnlwdGlvbjogdHJ1ZSxcbiAgICAgICAgICBlbmZvcmNlSHR0cHM6IHRydWUsXG4gICAgICAgICAga21zS2V5OiBwcm9wcy5rbXNLZXksXG4gICAgICAgICAgZmluZUdyYWluZWRBY2Nlc3NDb250cm9sOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAgbW9uaXRvcmluZ0NvbmZpZzoge1xuICAgICAgICAgIGxvZ3NFbmFibGVkOiB0cnVlLFxuICAgICAgICAgIHNsb3dMb2dzRW5hYmxlZDogZmFsc2UsXG4gICAgICAgICAgYXBwTG9nc0VuYWJsZWQ6IGZhbHNlLFxuICAgICAgICAgIGluZGV4U2xvd0xvZ3NFbmFibGVkOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgIH07XG5cbiAgICAgIHRoaXMub3BlblNlYXJjaENvbnN0cnVjdCA9IG5ldyBPcGVuU2VhcmNoTXVsdGltb2RhbENvbnN0cnVjdCh0aGlzLCAnT3BlblNlYXJjaCcsIG9wZW5TZWFyY2hDb25maWcpO1xuICAgICAgXG4gICAgICAvLyBPcGVuU2VhcmNo5Ye65Yqb44KS6L+95YqgXG4gICAgICB0aGlzLm91dHB1dHMub3BlblNlYXJjaEVuZHBvaW50ID0gdGhpcy5vcGVuU2VhcmNoQ29uc3RydWN0Py5vdXRwdXRzLmRvbWFpbkVuZHBvaW50O1xuICAgICAgdGhpcy5vdXRwdXRzLm9wZW5TZWFyY2hEb21haW5Bcm4gPSB0aGlzLm9wZW5TZWFyY2hDb25zdHJ1Y3Q/Lm91dHB1dHMuZG9tYWluQXJuO1xuICAgICAgdGhpcy5vdXRwdXRzLm9wZW5TZWFyY2hEb21haW5JZCA9IHRoaXMub3BlblNlYXJjaENvbnN0cnVjdD8ub3V0cHV0cy5kb21haW5OYW1lO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZygnT3BlblNlYXJjaCBTZXJ2ZXJsZXNzIGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCdPcGVuU2VhcmNoIFNlcnZlcmxlc3MgaXMgZGlzYWJsZWQsIHNraXBwaW5nIGNyZWF0aW9uJyk7XG4gICAgfVxuICB9XG59XG4iXX0=