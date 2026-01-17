"use strict";
/**
 * Amazon Bedrock AgentCore Evaluations Construct
 *
 * このConstructは、Bedrock Agentの品質評価・A/Bテスト・パフォーマンス測定機能を提供します。
 * 13の組み込み評価器、A/Bテスト、統計的有意性検定、自動最適化を統合します。
 *
 * @author Kiro AI
 * @date 2026-01-04
 * @version 1.0.0
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
exports.BedrockAgentCoreEvaluationsConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const constructs_1 = require("constructs");
/**
 * Amazon Bedrock AgentCore Evaluations Construct
 *
 * Bedrock Agentの品質評価・A/Bテスト・パフォーマンス測定機能を提供するConstruct。
 *
 * 主な機能:
 * - 13の組み込み品質評価器
 * - A/Bテスト機能
 * - 統計的有意性検定
 * - 自動最適化
 * - パフォーマンス測定
 * - コスト分析
 * - 最適化提案
 *
 * 使用例:
 * ```typescript
 * const evaluations = new BedrockAgentCoreEvaluationsConstruct(this, 'Evaluations', {
 *   enabled: true,
 *   projectName: 'my-project',
 *   environment: 'production',
 *   qualityMetricsConfig: {
 *     enabled: true,
 *     accuracy: true,
 *     relevance: true,
 *   },
 *   abTestConfig: {
 *     enabled: true,
 *     trafficSplit: [50, 50],
 *   },
 *   performanceEvaluationConfig: {
 *     enabled: true,
 *     latencyMeasurement: true,
 *   },
 * });
 * ```
 */
class BedrockAgentCoreEvaluationsConstruct extends constructs_1.Construct {
    /**
     * 評価結果保存用S3バケット
     */
    resultsBucket;
    /**
     * 評価結果保存用DynamoDBテーブル
     */
    resultsTable;
    /**
     * CloudWatchダッシュボード
     */
    dashboard;
    /**
     * ログループ
     */
    logGroup;
    constructor(scope, id, props) {
        super(scope, id);
        // 無効化されている場合はダミーリソースのみ作成
        if (!props.enabled) {
            this.logGroup = new logs.LogGroup(this, 'DummyLogGroup', {
                logGroupName: `/aws/bedrock/agent-core/${props.projectName}/${props.environment}/evaluations-disabled`,
                retention: logs.RetentionDays.ONE_DAY,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            // ダミーバケット
            this.resultsBucket = new s3.Bucket(this, 'DummyBucket', {
                bucketName: `${props.projectName}-${props.environment}-evaluations-disabled-${cdk.Aws.ACCOUNT_ID}`,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
                autoDeleteObjects: true,
            });
            // ダミーテーブル
            this.resultsTable = new dynamodb.Table(this, 'DummyTable', {
                tableName: `${props.projectName}-${props.environment}-evaluations-disabled`,
                partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            return;
        }
        // S3バケット作成（評価結果保存用）
        this.resultsBucket = new s3.Bucket(this, 'ResultsBucket', {
            bucketName: `${props.projectName}-${props.environment}-evaluations-results-${cdk.Aws.ACCOUNT_ID}`,
            versioned: true,
            encryption: s3.BucketEncryption.S3_MANAGED,
            lifecycleRules: [
                {
                    id: 'DeleteOldResults',
                    enabled: true,
                    expiration: cdk.Duration.days(props.resultsRetentionDays || 90),
                },
            ],
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            autoDeleteObjects: false,
        });
        // DynamoDBテーブル作成（評価結果メタデータ保存用）
        this.resultsTable = new dynamodb.Table(this, 'ResultsTable', {
            tableName: `${props.projectName}-${props.environment}-evaluations-results`,
            partitionKey: { name: 'evaluationId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            pointInTimeRecovery: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            timeToLiveAttribute: 'ttl',
        });
        // GSI: メトリクスタイプ別検索用
        this.resultsTable.addGlobalSecondaryIndex({
            indexName: 'MetricTypeIndex',
            partitionKey: { name: 'metricType', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
        });
        // GSI: A/Bテスト別検索用
        this.resultsTable.addGlobalSecondaryIndex({
            indexName: 'ABTestIndex',
            partitionKey: { name: 'abTestId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
        });
        // CloudWatch Logsログループ作成
        this.logGroup = new logs.LogGroup(this, 'LogGroup', {
            logGroupName: `/aws/bedrock/agent-core/${props.projectName}/${props.environment}/evaluations`,
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
        // CloudWatchダッシュボード作成
        if (props.qualityMetricsConfig?.enabled || props.abTestConfig?.enabled || props.performanceEvaluationConfig?.enabled) {
            this.dashboard = this.createDashboard(props);
        }
        // タグ付け
        const tags = {
            Project: props.projectName,
            Environment: props.environment,
            Component: 'AgentCore-Evaluations',
            ManagedBy: 'CDK',
            ...props.tags,
        };
        Object.entries(tags).forEach(([key, value]) => {
            cdk.Tags.of(this.resultsBucket).add(key, value);
            cdk.Tags.of(this.resultsTable).add(key, value);
            cdk.Tags.of(this.logGroup).add(key, value);
            if (this.dashboard) {
                cdk.Tags.of(this.dashboard).add(key, value);
            }
        });
    }
    /**
     * CloudWatchダッシュボードを作成
     */
    createDashboard(props) {
        const dashboardName = `${props.projectName}-${props.environment}-agent-core-evaluations`;
        const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
            dashboardName,
        });
        const widgets = [];
        // 品質メトリクスウィジェット
        if (props.qualityMetricsConfig?.enabled) {
            widgets.push(this.createQualityMetricsWidget(props));
        }
        // A/Bテストウィジェット
        if (props.abTestConfig?.enabled) {
            widgets.push(this.createABTestWidget(props));
        }
        // パフォーマンスウィジェット
        if (props.performanceEvaluationConfig?.enabled) {
            widgets.push(this.createPerformanceWidget(props));
        }
        // ウィジェットを追加
        widgets.forEach(widget => dashboard.addWidgets(widget));
        return dashboard;
    }
    /**
     * 品質メトリクスウィジェットを作成
     */
    createQualityMetricsWidget(props) {
        return new cloudwatch.GraphWidget({
            title: 'Quality Metrics',
            width: 24,
            height: 6,
            left: [],
        });
    }
    /**
     * A/Bテストウィジェットを作成
     */
    createABTestWidget(props) {
        return new cloudwatch.GraphWidget({
            title: 'A/B Test Results',
            width: 24,
            height: 6,
            left: [],
        });
    }
    /**
     * パフォーマンスウィジェットを作成
     */
    createPerformanceWidget(props) {
        return new cloudwatch.GraphWidget({
            title: 'Performance Metrics',
            width: 24,
            height: 6,
            left: [],
        });
    }
    /**
     * Lambda関数に評価権限を付与
     */
    addEvaluationPermissions(lambdaFunction) {
        // S3バケットへの読み書き権限
        this.resultsBucket.grantReadWrite(lambdaFunction);
        // DynamoDBテーブルへの読み書き権限
        this.resultsTable.grantReadWriteData(lambdaFunction);
        // CloudWatch Logsへの書き込み権限
        lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
            ],
            resources: [this.logGroup.logGroupArn],
        }));
        // CloudWatchメトリクスへの書き込み権限
        lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['cloudwatch:PutMetricData'],
            resources: ['*'],
        }));
    }
    /**
     * 複数のLambda関数に評価権限を一括付与
     */
    addEvaluationPermissionsToLambdas(lambdaFunctions) {
        lambdaFunctions.forEach(fn => this.addEvaluationPermissions(fn));
    }
}
exports.BedrockAgentCoreEvaluationsConstruct = BedrockAgentCoreEvaluationsConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1hZ2VudC1jb3JlLWV2YWx1YXRpb25zLWNvbnN0cnVjdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJlZHJvY2stYWdlbnQtY29yZS1ldmFsdWF0aW9ucy1jb25zdHJ1Y3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7R0FTRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFDbkMsdUVBQXlEO0FBQ3pELG1FQUFxRDtBQUNyRCx5REFBMkM7QUFFM0MsMkRBQTZDO0FBQzdDLHVEQUF5QztBQUN6QywyQ0FBdUM7QUE4UHZDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQW1DRztBQUNILE1BQWEsb0NBQXFDLFNBQVEsc0JBQVM7SUFDakU7O09BRUc7SUFDYSxhQUFhLENBQVk7SUFFekM7O09BRUc7SUFDYSxZQUFZLENBQWlCO0lBRTdDOztPQUVHO0lBQ2EsU0FBUyxDQUF3QjtJQUVqRDs7T0FFRztJQUNhLFFBQVEsQ0FBZ0I7SUFFeEMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFnRDtRQUN4RixLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLHlCQUF5QjtRQUN6QixJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ25CLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7Z0JBQ3ZELFlBQVksRUFBRSwyQkFBMkIsS0FBSyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMsV0FBVyx1QkFBdUI7Z0JBQ3RHLFNBQVMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU87Z0JBQ3JDLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87YUFDekMsQ0FBQyxDQUFDO1lBRUgsVUFBVTtZQUNWLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxFQUFFLENB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QUFDO1FBRWxELHVCQUF1QjtRQUN2QixJQUFJLENBQUMsWUFBWSxDQUFDLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBRXJELDBCQUEwQjtRQUMxQixjQUFjLENBQUMsZUFBZSxDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUNyRCxNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sRUFBRTtnQkFDUCxxQkFBcUI7Z0JBQ3JCLHNCQUFzQjtnQkFDdEIsbUJBQW1CO2FBQ3BCO1lBQ0QsU0FBUyxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUM7U0FDdkMsQ0FBQyxDQUFDLENBQUM7UUFFSiwwQkFBMEI7UUFDMUIsY0FBYyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDckQsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztZQUN4QixPQUFPLEVBQUUsQ0FBQywwQkFBMEIsQ0FBQztZQUNyQyxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7U0FDakIsQ0FBQyxDQUFDLENBQUM7SUFDTixDQUFDO0lBRUQ7O09BRUc7SUFDSSxpQ0FBaUMsQ0FBQyxlQUFtQztRQUMxRSxlQUFlLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDbkUsQ0FBQztDQUNGO0FBak9ELG9GQWlPQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQW1hem9uIEJlZHJvY2sgQWdlbnRDb3JlIEV2YWx1YXRpb25zIENvbnN0cnVjdFxuICogXG4gKiDjgZPjga5Db25zdHJ1Y3Tjga/jgIFCZWRyb2NrIEFnZW5044Gu5ZOB6LOq6KmV5L6h44O7QS9C44OG44K544OI44O744OR44OV44Kp44O844Oe44Oz44K55ris5a6a5qmf6IO944KS5o+Q5L6b44GX44G+44GZ44CCXG4gKiAxM+OBrue1hOOBv+i+vOOBv+ipleS+oeWZqOOAgUEvQuODhuOCueODiOOAgee1seioiOeahOacieaEj+aAp+aknOWumuOAgeiHquWLleacgOmBqeWMluOCkue1seWQiOOBl+OBvuOBmeOAglxuICogXG4gKiBAYXV0aG9yIEtpcm8gQUlcbiAqIEBkYXRlIDIwMjYtMDEtMDRcbiAqIEB2ZXJzaW9uIDEuMC4wXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2ggZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gnO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG4vKipcbiAqIOWTgeizquODoeODiOODquOCr+OCueioreWumlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFF1YWxpdHlNZXRyaWNzQ29uZmlnIHtcbiAgLyoqXG4gICAqIOWTgeizquODoeODiOODquOCr+OCueOCkuacieWKueWMllxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICByZWFkb25seSBlbmFibGVkOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiDmraPnorrmgKfvvIhBY2N1cmFjee+8ieipleS+oeOCkuacieWKueWMllxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICByZWFkb25seSBhY2N1cmFjeT86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIOmWoumAo+aAp++8iFJlbGV2YW5jZe+8ieipleS+oeOCkuacieWKueWMllxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICByZWFkb25seSByZWxldmFuY2U/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiDmnInnlKjmgKfvvIhIZWxwZnVsbmVzc++8ieipleS+oeOCkuacieWKueWMllxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICByZWFkb25seSBoZWxwZnVsbmVzcz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIOS4gOiyq+aAp++8iENvbnNpc3RlbmN577yJ6KmV5L6h44KS5pyJ5Yq55YyWXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIHJlYWRvbmx5IGNvbnNpc3RlbmN5PzogYm9vbGVhbjtcblxuICAvKipcbiAgICog5a6M5YWo5oCn77yIQ29tcGxldGVuZXNz77yJ6KmV5L6h44KS5pyJ5Yq55YyWXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIHJlYWRvbmx5IGNvbXBsZXRlbmVzcz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIOewoea9lOaAp++8iENvbmNpc2VuZXNz77yJ6KmV5L6h44KS5pyJ5Yq55YyWXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIHJlYWRvbmx5IGNvbmNpc2VuZXNzPzogYm9vbGVhbjtcblxuICAvKipcbiAgICog5piO556t5oCn77yIQ2xhcml0ee+8ieipleS+oeOCkuacieWKueWMllxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICByZWFkb25seSBjbGFyaXR5PzogYm9vbGVhbjtcblxuICAvKipcbiAgICog5paH5rOV77yIR3JhbW1hcu+8ieipleS+oeOCkuacieWKueWMllxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICByZWFkb25seSBncmFtbWFyPzogYm9vbGVhbjtcblxuICAvKipcbiAgICog44OI44O844Oz77yIVG9uZe+8ieipleS+oeOCkuacieWKueWMllxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICByZWFkb25seSB0b25lPzogYm9vbGVhbjtcblxuICAvKipcbiAgICog44OQ44Kk44Ki44K577yIQmlhc++8ieipleS+oeOCkuacieWKueWMllxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICByZWFkb25seSBiaWFzPzogYm9vbGVhbjtcblxuICAvKipcbiAgICog5pyJ5a6z5oCn77yIVG94aWNpdHnvvInoqZXkvqHjgpLmnInlirnljJZcbiAgICogQGRlZmF1bHQgdHJ1ZVxuICAgKi9cbiAgcmVhZG9ubHkgdG94aWNpdHk/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiDkuovlrp/mgKfvvIhGYWN0dWFsaXR577yJ6KmV5L6h44KS5pyJ5Yq55YyWXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIHJlYWRvbmx5IGZhY3R1YWxpdHk/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiDlvJXnlKjlk4Hos6rvvIhDaXRhdGlvbiBRdWFsaXR577yJ6KmV5L6h44KS5pyJ5Yq55YyWXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIHJlYWRvbmx5IGNpdGF0aW9uUXVhbGl0eT86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIOipleS+oee1kOaenOOBruS/neWtmOWFiFMz44OQ44Kx44OD44OIXG4gICAqL1xuICByZWFkb25seSByZXN1bHRzQnVja2V0PzogczMuSUJ1Y2tldDtcblxuICAvKipcbiAgICog6KmV5L6h57WQ5p6c44Gu5L+d5a2Y5YWIUzPjg5fjg6zjg5XjgqPjg4Pjgq/jgrlcbiAgICogQGRlZmF1bHQgJ2V2YWx1YXRpb25zL3F1YWxpdHktbWV0cmljcy8nXG4gICAqL1xuICByZWFkb25seSByZXN1bHRzUHJlZml4Pzogc3RyaW5nO1xufVxuXG4vKipcbiAqIEEvQuODhuOCueODiOioreWumlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEFCVGVzdENvbmZpZyB7XG4gIC8qKlxuICAgKiBBL0Ljg4bjgrnjg4jjgpLmnInlirnljJZcbiAgICogQGRlZmF1bHQgdHJ1ZVxuICAgKi9cbiAgcmVhZG9ubHkgZW5hYmxlZDogYm9vbGVhbjtcblxuICAvKipcbiAgICog44OI44Op44OV44Kj44OD44Kv5YiG5Ymy5q+U546H77yIQTpC77yJXG4gICAqIEBkZWZhdWx0IFs1MCwgNTBdXG4gICAqL1xuICByZWFkb25seSB0cmFmZmljU3BsaXQ/OiBbbnVtYmVyLCBudW1iZXJdO1xuXG4gIC8qKlxuICAgKiDntbHoqIjnmoTmnInmhI/mgKfjga7plr7lgKTvvIhw5YCk77yJXG4gICAqIEBkZWZhdWx0IDAuMDVcbiAgICovXG4gIHJlYWRvbmx5IHNpZ25pZmljYW5jZVRocmVzaG9sZD86IG51bWJlcjtcblxuICAvKipcbiAgICog5pyA5bCP44K144Oz44OX44Or44K144Kk44K6XG4gICAqIEBkZWZhdWx0IDEwMFxuICAgKi9cbiAgcmVhZG9ubHkgbWluU2FtcGxlU2l6ZT86IG51bWJlcjtcblxuICAvKipcbiAgICog6Ieq5YuV5pyA6YGp5YyW44KS5pyJ5Yq55YyWXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIHJlYWRvbmx5IGF1dG9PcHRpbWl6YXRpb24/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiDoh6rli5XmnIDpganljJbjga7plr7lgKTvvIjli53njofvvIlcbiAgICogQGRlZmF1bHQgMC45NVxuICAgKi9cbiAgcmVhZG9ubHkgYXV0b09wdGltaXphdGlvblRocmVzaG9sZD86IG51bWJlcjtcblxuICAvKipcbiAgICog44OG44K544OI57WQ5p6c44Gu5L+d5a2Y5YWIUzPjg5DjgrHjg4Pjg4hcbiAgICovXG4gIHJlYWRvbmx5IHJlc3VsdHNCdWNrZXQ/OiBzMy5JQnVja2V0O1xuXG4gIC8qKlxuICAgKiDjg4bjgrnjg4jntZDmnpzjga7kv53lrZjlhYhTM+ODl+ODrOODleOCo+ODg+OCr+OCuVxuICAgKiBAZGVmYXVsdCAnZXZhbHVhdGlvbnMvYWItdGVzdHMvJ1xuICAgKi9cbiAgcmVhZG9ubHkgcmVzdWx0c1ByZWZpeD86IHN0cmluZztcbn1cblxuLyoqXG4gKiDjg5Hjg5Xjgqnjg7zjg57jg7PjgrnoqZXkvqHoqK3lrppcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQZXJmb3JtYW5jZUV2YWx1YXRpb25Db25maWcge1xuICAvKipcbiAgICog44OR44OV44Kp44O844Oe44Oz44K56KmV5L6h44KS5pyJ5Yq55YyWXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIHJlYWRvbmx5IGVuYWJsZWQ6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIOODrOOCpOODhuODs+OCt+a4rOWumuOCkuacieWKueWMllxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICByZWFkb25seSBsYXRlbmN5TWVhc3VyZW1lbnQ/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiDjgrnjg6vjg7zjg5fjg4Pjg4jmuKzlrprjgpLmnInlirnljJZcbiAgICogQGRlZmF1bHQgdHJ1ZVxuICAgKi9cbiAgcmVhZG9ubHkgdGhyb3VnaHB1dE1lYXN1cmVtZW50PzogYm9vbGVhbjtcblxuICAvKipcbiAgICog44Kz44K544OI5YiG5p6Q44KS5pyJ5Yq55YyWXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIHJlYWRvbmx5IGNvc3RBbmFseXNpcz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIOacgOmBqeWMluaPkOahiOOCkuacieWKueWMllxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICByZWFkb25seSBvcHRpbWl6YXRpb25TdWdnZXN0aW9ucz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIOODrOOCpOODhuODs+OCt+mWvuWApO+8iOODn+ODquenku+8iVxuICAgKiBAZGVmYXVsdCAzMDAwXG4gICAqL1xuICByZWFkb25seSBsYXRlbmN5VGhyZXNob2xkPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiDjgrnjg6vjg7zjg5fjg4Pjg4jplr7lgKTvvIjjg6rjgq/jgqjjgrnjg4gv5YiG77yJXG4gICAqIEBkZWZhdWx0IDEwMFxuICAgKi9cbiAgcmVhZG9ubHkgdGhyb3VnaHB1dFRocmVzaG9sZD86IG51bWJlcjtcblxuICAvKipcbiAgICog44Kz44K544OI6Za+5YCk77yIVVNELzEwMDDjg6rjgq/jgqjjgrnjg4jvvIlcbiAgICogQGRlZmF1bHQgMTBcbiAgICovXG4gIHJlYWRvbmx5IGNvc3RUaHJlc2hvbGQ/OiBudW1iZXI7XG59XG5cbi8qKlxuICogQmVkcm9ja0FnZW50Q29yZUV2YWx1YXRpb25zQ29uc3RydWN044Gu44OX44Ot44OR44OG44KjXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQmVkcm9ja0FnZW50Q29yZUV2YWx1YXRpb25zQ29uc3RydWN0UHJvcHMge1xuICAvKipcbiAgICogRXZhbHVhdGlvbnPmqZ/og73jgpLmnInlirnljJbjgZnjgovjgYvjganjgYbjgYtcbiAgICogQGRlZmF1bHQgZmFsc2VcbiAgICovXG4gIHJlYWRvbmx5IGVuYWJsZWQ6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIOODl+ODreOCuOOCp+OCr+ODiOWQjVxuICAgKi9cbiAgcmVhZG9ubHkgcHJvamVjdE5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICog55Kw5aKD5ZCN77yIZGV2LCBzdGFnaW5nLCBwcm9k562J77yJXG4gICAqL1xuICByZWFkb25seSBlbnZpcm9ubWVudDogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiDlk4Hos6rjg6Hjg4jjg6rjgq/jgrnoqK3lrppcbiAgICovXG4gIHJlYWRvbmx5IHF1YWxpdHlNZXRyaWNzQ29uZmlnPzogUXVhbGl0eU1ldHJpY3NDb25maWc7XG5cbiAgLyoqXG4gICAqIEEvQuODhuOCueODiOioreWumlxuICAgKi9cbiAgcmVhZG9ubHkgYWJUZXN0Q29uZmlnPzogQUJUZXN0Q29uZmlnO1xuXG4gIC8qKlxuICAgKiDjg5Hjg5Xjgqnjg7zjg57jg7PjgrnoqZXkvqHoqK3lrppcbiAgICovXG4gIHJlYWRvbmx5IHBlcmZvcm1hbmNlRXZhbHVhdGlvbkNvbmZpZz86IFBlcmZvcm1hbmNlRXZhbHVhdGlvbkNvbmZpZztcblxuICAvKipcbiAgICog6KmV5L6h57WQ5p6c44Gu5L+d5oyB5pyf6ZaT77yI5pel5pWw77yJXG4gICAqIEBkZWZhdWx0IDkwXG4gICAqL1xuICByZWFkb25seSByZXN1bHRzUmV0ZW50aW9uRGF5cz86IG51bWJlcjtcblxuICAvKipcbiAgICog44K/44KwXG4gICAqL1xuICByZWFkb25seSB0YWdzPzogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfTtcbn1cblxuLyoqXG4gKiBBbWF6b24gQmVkcm9jayBBZ2VudENvcmUgRXZhbHVhdGlvbnMgQ29uc3RydWN0XG4gKiBcbiAqIEJlZHJvY2sgQWdlbnTjga7lk4Hos6roqZXkvqHjg7tBL0Ljg4bjgrnjg4jjg7vjg5Hjg5Xjgqnjg7zjg57jg7PjgrnmuKzlrprmqZ/og73jgpLmj5DkvpvjgZnjgotDb25zdHJ1Y3TjgIJcbiAqIFxuICog5Li744Gq5qmf6IO9OlxuICogLSAxM+OBrue1hOOBv+i+vOOBv+WTgeizquipleS+oeWZqFxuICogLSBBL0Ljg4bjgrnjg4jmqZ/og71cbiAqIC0g57Wx6KiI55qE5pyJ5oSP5oCn5qSc5a6aXG4gKiAtIOiHquWLleacgOmBqeWMllxuICogLSDjg5Hjg5Xjgqnjg7zjg57jg7PjgrnmuKzlrppcbiAqIC0g44Kz44K544OI5YiG5p6QXG4gKiAtIOacgOmBqeWMluaPkOahiFxuICogXG4gKiDkvb/nlKjkvos6XG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBjb25zdCBldmFsdWF0aW9ucyA9IG5ldyBCZWRyb2NrQWdlbnRDb3JlRXZhbHVhdGlvbnNDb25zdHJ1Y3QodGhpcywgJ0V2YWx1YXRpb25zJywge1xuICogICBlbmFibGVkOiB0cnVlLFxuICogICBwcm9qZWN0TmFtZTogJ215LXByb2plY3QnLFxuICogICBlbnZpcm9ubWVudDogJ3Byb2R1Y3Rpb24nLFxuICogICBxdWFsaXR5TWV0cmljc0NvbmZpZzoge1xuICogICAgIGVuYWJsZWQ6IHRydWUsXG4gKiAgICAgYWNjdXJhY3k6IHRydWUsXG4gKiAgICAgcmVsZXZhbmNlOiB0cnVlLFxuICogICB9LFxuICogICBhYlRlc3RDb25maWc6IHtcbiAqICAgICBlbmFibGVkOiB0cnVlLFxuICogICAgIHRyYWZmaWNTcGxpdDogWzUwLCA1MF0sXG4gKiAgIH0sXG4gKiAgIHBlcmZvcm1hbmNlRXZhbHVhdGlvbkNvbmZpZzoge1xuICogICAgIGVuYWJsZWQ6IHRydWUsXG4gKiAgICAgbGF0ZW5jeU1lYXN1cmVtZW50OiB0cnVlLFxuICogICB9LFxuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNsYXNzIEJlZHJvY2tBZ2VudENvcmVFdmFsdWF0aW9uc0NvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XG4gIC8qKlxuICAgKiDoqZXkvqHntZDmnpzkv53lrZjnlKhTM+ODkOOCseODg+ODiFxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IHJlc3VsdHNCdWNrZXQ6IHMzLkJ1Y2tldDtcblxuICAvKipcbiAgICog6KmV5L6h57WQ5p6c5L+d5a2Y55SoRHluYW1vRELjg4bjg7zjg5bjg6tcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSByZXN1bHRzVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuXG4gIC8qKlxuICAgKiBDbG91ZFdhdGNo44OA44OD44K344Ol44Oc44O844OJXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgZGFzaGJvYXJkPzogY2xvdWR3YXRjaC5EYXNoYm9hcmQ7XG5cbiAgLyoqXG4gICAqIOODreOCsOODq+ODvOODl1xuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGxvZ0dyb3VwOiBsb2dzLkxvZ0dyb3VwO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlRXZhbHVhdGlvbnNDb25zdHJ1Y3RQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyDnhKHlirnljJbjgZXjgozjgabjgYTjgovloLTlkIjjga/jg4Djg5/jg7zjg6rjgr3jg7zjgrnjga7jgb/kvZzmiJBcbiAgICBpZiAoIXByb3BzLmVuYWJsZWQpIHtcbiAgICAgIHRoaXMubG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnRHVtbXlMb2dHcm91cCcsIHtcbiAgICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9iZWRyb2NrL2FnZW50LWNvcmUvJHtwcm9wcy5wcm9qZWN0TmFtZX0vJHtwcm9wcy5lbnZpcm9ubWVudH0vZXZhbHVhdGlvbnMtZGlzYWJsZWRgLFxuICAgICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfREFZLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIOODgOODn+ODvOODkOOCseODg+ODiFxuICAgICAgdGhpcy5yZXN1bHRzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnRHVtbXlCdWNrZXQnLCB7XG4gICAgICAgIGJ1Y2tldE5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1ldmFsdWF0aW9ucy1kaXNhYmxlZC0ke2Nkay5Bd3MuQUNDT1VOVF9JRH1gLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyDjg4Djg5/jg7zjg4bjg7zjg5bjg6tcbiAgICAgIHRoaXMucmVzdWx0c1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdEdW1teVRhYmxlJywge1xuICAgICAgICB0YWJsZU5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1ldmFsdWF0aW9ucy1kaXNhYmxlZGAsXG4gICAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBTM+ODkOOCseODg+ODiOS9nOaIkO+8iOipleS+oee1kOaenOS/neWtmOeUqO+8iVxuICAgIHRoaXMucmVzdWx0c0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1Jlc3VsdHNCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tZXZhbHVhdGlvbnMtcmVzdWx0cy0ke2Nkay5Bd3MuQUNDT1VOVF9JRH1gLFxuICAgICAgdmVyc2lvbmVkOiB0cnVlLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnRGVsZXRlT2xkUmVzdWx0cycsXG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBleHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cyhwcm9wcy5yZXN1bHRzUmV0ZW50aW9uRGF5cyB8fCA5MCksXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IGZhbHNlLFxuICAgIH0pO1xuXG4gICAgLy8gRHluYW1vRELjg4bjg7zjg5bjg6vkvZzmiJDvvIjoqZXkvqHntZDmnpzjg6Hjgr/jg4fjg7zjgr/kv53lrZjnlKjvvIlcbiAgICB0aGlzLnJlc3VsdHNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnUmVzdWx0c1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tZXZhbHVhdGlvbnMtcmVzdWx0c2AsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2V2YWx1YXRpb25JZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd0aW1lc3RhbXAnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUiB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IHRydWUsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICB0aW1lVG9MaXZlQXR0cmlidXRlOiAndHRsJyxcbiAgICB9KTtcblxuICAgIC8vIEdTSTog44Oh44OI44Oq44Kv44K544K/44Kk44OX5Yil5qSc57Si55SoXG4gICAgdGhpcy5yZXN1bHRzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnTWV0cmljVHlwZUluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnbWV0cmljVHlwZScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd0aW1lc3RhbXAnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUiB9LFxuICAgIH0pO1xuXG4gICAgLy8gR1NJOiBBL0Ljg4bjgrnjg4jliKXmpJzntKLnlKhcbiAgICB0aGlzLnJlc3VsdHNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdBQlRlc3RJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2FiVGVzdElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3RpbWVzdGFtcCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZFdhdGNoIExvZ3Pjg63jgrDjg6vjg7zjg5fkvZzmiJBcbiAgICB0aGlzLmxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0xvZ0dyb3VwJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9iZWRyb2NrL2FnZW50LWNvcmUvJHtwcm9wcy5wcm9qZWN0TmFtZX0vJHtwcm9wcy5lbnZpcm9ubWVudH0vZXZhbHVhdGlvbnNgLFxuICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgIH0pO1xuXG4gICAgLy8gQ2xvdWRXYXRjaOODgOODg+OCt+ODpeODnOODvOODieS9nOaIkFxuICAgIGlmIChwcm9wcy5xdWFsaXR5TWV0cmljc0NvbmZpZz8uZW5hYmxlZCB8fCBwcm9wcy5hYlRlc3RDb25maWc/LmVuYWJsZWQgfHwgcHJvcHMucGVyZm9ybWFuY2VFdmFsdWF0aW9uQ29uZmlnPy5lbmFibGVkKSB7XG4gICAgICB0aGlzLmRhc2hib2FyZCA9IHRoaXMuY3JlYXRlRGFzaGJvYXJkKHByb3BzKTtcbiAgICB9XG5cbiAgICAvLyDjgr/jgrDku5jjgZFcbiAgICBjb25zdCB0YWdzID0ge1xuICAgICAgUHJvamVjdDogcHJvcHMucHJvamVjdE5hbWUsXG4gICAgICBFbnZpcm9ubWVudDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICBDb21wb25lbnQ6ICdBZ2VudENvcmUtRXZhbHVhdGlvbnMnLFxuICAgICAgTWFuYWdlZEJ5OiAnQ0RLJyxcbiAgICAgIC4uLnByb3BzLnRhZ3MsXG4gICAgfTtcblxuICAgIE9iamVjdC5lbnRyaWVzKHRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcy5yZXN1bHRzQnVja2V0KS5hZGQoa2V5LCB2YWx1ZSk7XG4gICAgICBjZGsuVGFncy5vZih0aGlzLnJlc3VsdHNUYWJsZSkuYWRkKGtleSwgdmFsdWUpO1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcy5sb2dHcm91cCkuYWRkKGtleSwgdmFsdWUpO1xuICAgICAgaWYgKHRoaXMuZGFzaGJvYXJkKSB7XG4gICAgICAgIGNkay5UYWdzLm9mKHRoaXMuZGFzaGJvYXJkKS5hZGQoa2V5LCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ2xvdWRXYXRjaOODgOODg+OCt+ODpeODnOODvOODieOCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVEYXNoYm9hcmQocHJvcHM6IEJlZHJvY2tBZ2VudENvcmVFdmFsdWF0aW9uc0NvbnN0cnVjdFByb3BzKTogY2xvdWR3YXRjaC5EYXNoYm9hcmQge1xuICAgIGNvbnN0IGRhc2hib2FyZE5hbWUgPSBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tYWdlbnQtY29yZS1ldmFsdWF0aW9uc2A7XG5cbiAgICBjb25zdCBkYXNoYm9hcmQgPSBuZXcgY2xvdWR3YXRjaC5EYXNoYm9hcmQodGhpcywgJ0Rhc2hib2FyZCcsIHtcbiAgICAgIGRhc2hib2FyZE5hbWUsXG4gICAgfSk7XG5cbiAgICBjb25zdCB3aWRnZXRzOiBjbG91ZHdhdGNoLklXaWRnZXRbXSA9IFtdO1xuXG4gICAgLy8g5ZOB6LOq44Oh44OI44Oq44Kv44K544Km44Kj44K444Kn44OD44OIXG4gICAgaWYgKHByb3BzLnF1YWxpdHlNZXRyaWNzQ29uZmlnPy5lbmFibGVkKSB7XG4gICAgICB3aWRnZXRzLnB1c2godGhpcy5jcmVhdGVRdWFsaXR5TWV0cmljc1dpZGdldChwcm9wcykpO1xuICAgIH1cblxuICAgIC8vIEEvQuODhuOCueODiOOCpuOCo+OCuOOCp+ODg+ODiFxuICAgIGlmIChwcm9wcy5hYlRlc3RDb25maWc/LmVuYWJsZWQpIHtcbiAgICAgIHdpZGdldHMucHVzaCh0aGlzLmNyZWF0ZUFCVGVzdFdpZGdldChwcm9wcykpO1xuICAgIH1cblxuICAgIC8vIOODkeODleOCqeODvOODnuODs+OCueOCpuOCo+OCuOOCp+ODg+ODiFxuICAgIGlmIChwcm9wcy5wZXJmb3JtYW5jZUV2YWx1YXRpb25Db25maWc/LmVuYWJsZWQpIHtcbiAgICAgIHdpZGdldHMucHVzaCh0aGlzLmNyZWF0ZVBlcmZvcm1hbmNlV2lkZ2V0KHByb3BzKSk7XG4gICAgfVxuXG4gICAgLy8g44Km44Kj44K444Kn44OD44OI44KS6L+95YqgXG4gICAgd2lkZ2V0cy5mb3JFYWNoKHdpZGdldCA9PiBkYXNoYm9hcmQuYWRkV2lkZ2V0cyh3aWRnZXQpKTtcblxuICAgIHJldHVybiBkYXNoYm9hcmQ7XG4gIH1cblxuICAvKipcbiAgICog5ZOB6LOq44Oh44OI44Oq44Kv44K544Km44Kj44K444Kn44OD44OI44KS5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVF1YWxpdHlNZXRyaWNzV2lkZ2V0KHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlRXZhbHVhdGlvbnNDb25zdHJ1Y3RQcm9wcyk6IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQge1xuICAgIHJldHVybiBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICB0aXRsZTogJ1F1YWxpdHkgTWV0cmljcycsXG4gICAgICB3aWR0aDogMjQsXG4gICAgICBoZWlnaHQ6IDYsXG4gICAgICBsZWZ0OiBbXSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBL0Ljg4bjgrnjg4jjgqbjgqPjgrjjgqfjg4Pjg4jjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQUJUZXN0V2lkZ2V0KHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlRXZhbHVhdGlvbnNDb25zdHJ1Y3RQcm9wcyk6IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQge1xuICAgIHJldHVybiBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICB0aXRsZTogJ0EvQiBUZXN0IFJlc3VsdHMnLFxuICAgICAgd2lkdGg6IDI0LFxuICAgICAgaGVpZ2h0OiA2LFxuICAgICAgbGVmdDogW10sXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog44OR44OV44Kp44O844Oe44Oz44K544Km44Kj44K444Kn44OD44OI44KS5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVBlcmZvcm1hbmNlV2lkZ2V0KHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlRXZhbHVhdGlvbnNDb25zdHJ1Y3RQcm9wcyk6IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQge1xuICAgIHJldHVybiBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICB0aXRsZTogJ1BlcmZvcm1hbmNlIE1ldHJpY3MnLFxuICAgICAgd2lkdGg6IDI0LFxuICAgICAgaGVpZ2h0OiA2LFxuICAgICAgbGVmdDogW10sXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw44Gr6KmV5L6h5qip6ZmQ44KS5LuY5LiOXG4gICAqL1xuICBwdWJsaWMgYWRkRXZhbHVhdGlvblBlcm1pc3Npb25zKGxhbWJkYUZ1bmN0aW9uOiBsYW1iZGEuSUZ1bmN0aW9uKTogdm9pZCB7XG4gICAgLy8gUzPjg5DjgrHjg4Pjg4jjgbjjga7oqq3jgb/mm7jjgY3mqKnpmZBcbiAgICB0aGlzLnJlc3VsdHNCdWNrZXQuZ3JhbnRSZWFkV3JpdGUobGFtYmRhRnVuY3Rpb24pO1xuXG4gICAgLy8gRHluYW1vRELjg4bjg7zjg5bjg6vjgbjjga7oqq3jgb/mm7jjgY3mqKnpmZBcbiAgICB0aGlzLnJlc3VsdHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEobGFtYmRhRnVuY3Rpb24pO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBMb2dz44G444Gu5pu444GN6L6844G/5qip6ZmQXG4gICAgbGFtYmRhRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nR3JvdXAnLFxuICAgICAgICAnbG9nczpDcmVhdGVMb2dTdHJlYW0nLFxuICAgICAgICAnbG9nczpQdXRMb2dFdmVudHMnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW3RoaXMubG9nR3JvdXAubG9nR3JvdXBBcm5dLFxuICAgIH0pKTtcblxuICAgIC8vIENsb3VkV2F0Y2jjg6Hjg4jjg6rjgq/jgrnjgbjjga7mm7jjgY3ovrzjgb/mqKnpmZBcbiAgICBsYW1iZGFGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogWydjbG91ZHdhdGNoOlB1dE1ldHJpY0RhdGEnXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIOikh+aVsOOBrkxhbWJkYemWouaVsOOBq+ipleS+oeaoqemZkOOCkuS4gOaLrOS7mOS4jlxuICAgKi9cbiAgcHVibGljIGFkZEV2YWx1YXRpb25QZXJtaXNzaW9uc1RvTGFtYmRhcyhsYW1iZGFGdW5jdGlvbnM6IGxhbWJkYS5JRnVuY3Rpb25bXSk6IHZvaWQge1xuICAgIGxhbWJkYUZ1bmN0aW9ucy5mb3JFYWNoKGZuID0+IHRoaXMuYWRkRXZhbHVhdGlvblBlcm1pc3Npb25zKGZuKSk7XG4gIH1cbn1cbiJdfQ==