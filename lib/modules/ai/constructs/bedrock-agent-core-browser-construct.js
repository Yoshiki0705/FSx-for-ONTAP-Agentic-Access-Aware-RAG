"use strict";
/**
 * Amazon Bedrock AgentCore Browser Construct
 *
 * Headless Chromeによるブラウザ自動化機能を提供します。
 *
 * 主要機能:
 * - Headless Chrome統合（Puppeteer）
 * - Webスクレイピング（Cheerio）
 * - スクリーンショット撮影
 * - FSx for ONTAP + S3 Access Points統合
 *
 * @author Kiro AI
 * @date 2026-01-04
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
exports.BedrockAgentCoreBrowserConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const kms = __importStar(require("aws-cdk-lib/aws-kms"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const constructs_1 = require("constructs");
/**
 * Amazon Bedrock AgentCore Browser Construct
 *
 * Headless Chromeによるブラウザ自動化機能を提供します。
 */
class BedrockAgentCoreBrowserConstruct extends constructs_1.Construct {
    /**
     * Browser Lambda関数
     */
    browserFunction;
    /**
     * スクリーンショット保存用S3バケット
     */
    screenshotBucket;
    /**
     * KMS暗号化キー
     */
    encryptionKey;
    /**
     * IAM実行ロール
     */
    executionRole;
    constructor(scope, id, props) {
        super(scope, id);
        // 機能が無効化されている場合は何もしない
        if (!props.enabled) {
            return;
        }
        // KMS暗号化キーの作成または使用
        this.encryptionKey = props.encryptionKey || this.createEncryptionKey(props);
        // スクリーンショット保存用S3バケットの作成または使用
        this.screenshotBucket = props.screenshotBucket || this.createScreenshotBucket(props);
        // IAM実行ロールの作成
        this.executionRole = this.createExecutionRole(props);
        // Browser Lambda関数の作成
        this.browserFunction = this.createBrowserFunction(props);
        // タグ付け
        this.applyTags(props);
    }
    /**
     * KMS暗号化キーを作成
     */
    createEncryptionKey(props) {
        return new kms.Key(this, 'EncryptionKey', {
            description: `${props.projectName}-${props.environment}-agent-core-browser-key`,
            enableKeyRotation: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
    }
    /**
     * スクリーンショット保存用S3バケットを作成
     */
    createScreenshotBucket(props) {
        const retentionDays = props.screenshotConfig?.retentionDays || 7;
        return new s3.Bucket(this, 'ScreenshotBucket', {
            bucketName: `${props.projectName}-${props.environment}-browser-screenshots`.toLowerCase(),
            encryption: s3.BucketEncryption.KMS,
            encryptionKey: this.encryptionKey,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            versioned: false,
            lifecycleRules: [
                {
                    id: 'DeleteOldScreenshots',
                    enabled: true,
                    expiration: cdk.Duration.days(retentionDays),
                },
            ],
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
    }
    /**
     * IAM実行ロールを作成
     */
    createExecutionRole(props) {
        const role = new iam.Role(this, 'ExecutionRole', {
            roleName: `${props.projectName}-${props.environment}-browser-execution-role`,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Execution role for AgentCore Browser Lambda function',
        });
        // CloudWatch Logs権限
        role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));
        // VPC統合権限（VPCが指定されている場合）
        if (props.vpc) {
            role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'));
        }
        // S3アクセス権限
        if (this.screenshotBucket) {
            this.screenshotBucket.grantReadWrite(role);
        }
        // FSx for ONTAP S3 Access Point権限
        if (props.fsxS3AccessPointArn) {
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    's3:GetObject',
                    's3:PutObject',
                    's3:DeleteObject',
                    's3:ListBucket',
                ],
                resources: [
                    props.fsxS3AccessPointArn,
                    `${props.fsxS3AccessPointArn}/*`,
                ],
            }));
        }
        // KMS権限
        if (this.encryptionKey) {
            this.encryptionKey.grantEncryptDecrypt(role);
        }
        return role;
    }
    /**
     * Browser Lambda関数を作成
     */
    createBrowserFunction(props) {
        const memorySize = props.lambdaConfig?.memorySize || 2048;
        const timeout = props.lambdaConfig?.timeout || 300;
        const ephemeralStorageSize = props.lambdaConfig?.ephemeralStorageSize || 2048;
        const func = new lambda.Function(this, 'BrowserFunction', {
            functionName: `${props.projectName}-${props.environment}-agent-core-browser`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/agent-core-browser'),
            role: this.executionRole,
            memorySize,
            timeout: cdk.Duration.seconds(timeout),
            ephemeralStorageSize: cdk.Size.mebibytes(ephemeralStorageSize),
            reservedConcurrentExecutions: props.lambdaConfig?.reservedConcurrentExecutions,
            vpc: props.vpc,
            vpcSubnets: props.vpc ? { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS } : undefined,
            securityGroups: props.securityGroup ? [props.securityGroup] : undefined,
            environment: {
                PROJECT_NAME: props.projectName,
                ENVIRONMENT: props.environment,
                SCREENSHOT_BUCKET: this.screenshotBucket?.bucketName || '',
                FSX_S3_ACCESS_POINT_ARN: props.fsxS3AccessPointArn || '',
                SCREENSHOT_FORMAT: props.screenshotConfig?.format || 'png',
                GENERATE_THUMBNAIL: String(props.screenshotConfig?.generateThumbnail ?? true),
                RATE_LIMIT: String(props.scrapingConfig?.rateLimit || 10),
                RESPECT_ROBOTS_TXT: String(props.scrapingConfig?.respectRobotsTxt ?? true),
                USER_AGENT: props.scrapingConfig?.userAgent || 'BedrockAgentCore-Browser/1.0',
            },
            logRetention: logs.RetentionDays.ONE_WEEK,
        });
        return func;
    }
    /**
     * タグを適用
     */
    applyTags(props) {
        const tags = {
            Project: props.projectName,
            Environment: props.environment,
            Component: 'AgentCore-Browser',
            ManagedBy: 'CDK',
        };
        Object.entries(tags).forEach(([key, value]) => {
            cdk.Tags.of(this).add(key, value);
        });
    }
}
exports.BedrockAgentCoreBrowserConstruct = BedrockAgentCoreBrowserConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1hZ2VudC1jb3JlLWJyb3dzZXItY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYmVkcm9jay1hZ2VudC1jb3JlLWJyb3dzZXItY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7OztHQWFHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQywrREFBaUQ7QUFDakQseURBQTJDO0FBQzNDLHVEQUF5QztBQUN6Qyx5REFBMkM7QUFDM0MsMkRBQTZDO0FBQzdDLHlEQUEyQztBQUMzQywyQ0FBdUM7QUEySHZDOzs7O0dBSUc7QUFDSCxNQUFhLGdDQUFpQyxTQUFRLHNCQUFTO0lBQzdEOztPQUVHO0lBQ2EsZUFBZSxDQUFtQjtJQUVsRDs7T0FFRztJQUNhLGdCQUFnQixDQUFhO0lBRTdDOztPQUVHO0lBQ2EsYUFBYSxDQUFXO0lBRXhDOztPQUVHO0lBQ2EsYUFBYSxDQUFZO0lBRXpDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBNEM7UUFDcEYsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixzQkFBc0I7UUFDdEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNuQixPQUFPO1FBQ1QsQ0FBQztRQUVELG1CQUFtQjtRQUNuQixJQUFJLENBQUMsYUFBYSxHQUFHLEtBQUssQ0FBQyxhQUFvQyxJQUFJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUVuRyw2QkFBNkI7UUFDN0IsSUFBSSxDQUFDLGdCQUFnQixHQUFHLEtBQUssQ0FBQyxnQkFBeUMsSUFBSSxJQUFJLENBQUMsc0JBQXNCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFOUcsY0FBYztRQUNkLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRXJELHNCQUFzQjtRQUN0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VyxFQUFFLEtBQUssQ0FBQyxXQUFXO1lBQzlCLFNBQVMsRUFBRSxtQkFBbUI7WUFDOUIsU0FBUyxFQUFFLEtBQUs7U0FDakIsQ0FBQztRQUVGLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRTtZQUM1QyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3BDLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBMUxELDRFQTBMQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQW1hem9uIEJlZHJvY2sgQWdlbnRDb3JlIEJyb3dzZXIgQ29uc3RydWN0XG4gKiBcbiAqIEhlYWRsZXNzIENocm9tZeOBq+OCiOOCi+ODluODqeOCpuOCtuiHquWLleWMluapn+iDveOCkuaPkOS+m+OBl+OBvuOBmeOAglxuICogXG4gKiDkuLvopoHmqZ/og706XG4gKiAtIEhlYWRsZXNzIENocm9tZee1seWQiO+8iFB1cHBldGVlcu+8iVxuICogLSBXZWLjgrnjgq/jg6zjgqTjg5Tjg7PjgrDvvIhDaGVlcmlv77yJXG4gKiAtIOOCueOCr+ODquODvOODs+OCt+ODp+ODg+ODiOaSruW9sVxuICogLSBGU3ggZm9yIE9OVEFQICsgUzMgQWNjZXNzIFBvaW50c+e1seWQiFxuICogXG4gKiBAYXV0aG9yIEtpcm8gQUlcbiAqIEBkYXRlIDIwMjYtMDEtMDRcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGttcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mta21zJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbi8qKlxuICogQnJvd3NlciBDb25zdHJ1Y3ToqK3lrprjgqTjg7Pjgr/jg7zjg5Xjgqfjg7zjgrlcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBCZWRyb2NrQWdlbnRDb3JlQnJvd3NlckNvbnN0cnVjdFByb3BzIHtcbiAgLyoqXG4gICAqIOapn+iDveOBruacieWKueWMluODleODqeOCsFxuICAgKi9cbiAgcmVhZG9ubHkgZW5hYmxlZDogYm9vbGVhbjtcblxuICAvKipcbiAgICog44OX44Ot44K444Kn44Kv44OI5ZCNXG4gICAqL1xuICByZWFkb25seSBwcm9qZWN0TmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiDnkrDlooPlkI3vvIhwcm9kLCBkZXbnrYnvvIlcbiAgICovXG4gIHJlYWRvbmx5IGVudmlyb25tZW50OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFZQQ+ioreWumu+8iOOCquODl+OCt+ODp+ODs++8iVxuICAgKi9cbiAgcmVhZG9ubHkgdnBjPzogZWMyLklWcGM7XG5cbiAgLyoqXG4gICAqIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl++8iOOCquODl+OCt+ODp+ODs++8iVxuICAgKi9cbiAgcmVhZG9ubHkgc2VjdXJpdHlHcm91cD86IGVjMi5JU2VjdXJpdHlHcm91cDtcblxuICAvKipcbiAgICog44K544Kv44Oq44O844Oz44K344On44OD44OI5L+d5a2Y55SoUzPjg5DjgrHjg4Pjg4jvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICovXG4gIHJlYWRvbmx5IHNjcmVlbnNob3RCdWNrZXQ/OiBzMy5JQnVja2V0O1xuXG4gIC8qKlxuICAgKiBGU3ggZm9yIE9OVEFQIFMzIEFjY2VzcyBQb2ludCBBUk7vvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICog5oyH5a6a44GV44KM44Gf5aC05ZCI44CBUzPjg5DjgrHjg4Pjg4jjga7ku6Pjgo/jgorjgatGU3ggZm9yIE9OVEFQ44KS5L2/55SoXG4gICAqL1xuICByZWFkb25seSBmc3hTM0FjY2Vzc1BvaW50QXJuPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBLTVPmmpflj7fljJbjgq3jg7zvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICovXG4gIHJlYWRvbmx5IGVuY3J5cHRpb25LZXk/OiBrbXMuSUtleTtcblxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw6Kit5a6a77yI44Kq44OX44K344On44Oz77yJXG4gICAqL1xuICByZWFkb25seSBsYW1iZGFDb25maWc/OiB7XG4gICAgLyoqXG4gICAgICog44Oh44Oi44Oq44K144Kk44K677yITULvvIlcbiAgICAgKiBAZGVmYXVsdCAyMDQ4XG4gICAgICovXG4gICAgbWVtb3J5U2l6ZT86IG51bWJlcjtcblxuICAgIC8qKlxuICAgICAqIOOCv+OCpOODoOOCouOCpuODiO+8iOenku+8iVxuICAgICAqIEBkZWZhdWx0IDMwMFxuICAgICAqL1xuICAgIHRpbWVvdXQ/OiBudW1iZXI7XG5cbiAgICAvKipcbiAgICAgKiBFcGhlbWVyYWwgU3RvcmFnZe+8iE1C77yJXG4gICAgICogQGRlZmF1bHQgMjA0OFxuICAgICAqL1xuICAgIGVwaGVtZXJhbFN0b3JhZ2VTaXplPzogbnVtYmVyO1xuXG4gICAgLyoqXG4gICAgICogUmVzZXJ2ZWQgQ29uY3VycmVuY3lcbiAgICAgKiBAZGVmYXVsdCB1bmRlZmluZWTvvIjnhKHliLbpmZDvvIlcbiAgICAgKi9cbiAgICByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zPzogbnVtYmVyO1xuICB9O1xuXG4gIC8qKlxuICAgKiDjgrnjgq/jg6rjg7zjg7Pjgrfjg6fjg4Pjg4joqK3lrprvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICovXG4gIHJlYWRvbmx5IHNjcmVlbnNob3RDb25maWc/OiB7XG4gICAgLyoqXG4gICAgICog55S75YOP44OV44Kp44O844Oe44OD44OIXG4gICAgICogQGRlZmF1bHQgJ3BuZydcbiAgICAgKi9cbiAgICBmb3JtYXQ/OiAncG5nJyB8ICdqcGVnJyB8ICd3ZWJwJztcblxuICAgIC8qKlxuICAgICAqIOS/neWtmOacn+mWk++8iOaXpe+8iVxuICAgICAqIEBkZWZhdWx0IDdcbiAgICAgKi9cbiAgICByZXRlbnRpb25EYXlzPzogbnVtYmVyO1xuXG4gICAgLyoqXG4gICAgICog44K144Og44ON44Kk44Or55Sf5oiQXG4gICAgICogQGRlZmF1bHQgdHJ1ZVxuICAgICAqL1xuICAgIGdlbmVyYXRlVGh1bWJuYWlsPzogYm9vbGVhbjtcbiAgfTtcblxuICAvKipcbiAgICogV2Vi44K544Kv44Os44Kk44OU44Oz44Kw6Kit5a6a77yI44Kq44OX44K344On44Oz77yJXG4gICAqL1xuICByZWFkb25seSBzY3JhcGluZ0NvbmZpZz86IHtcbiAgICAvKipcbiAgICAgKiDjg6zjg7zjg4jliLbpmZDvvIjjg6rjgq/jgqjjgrnjg4gv5YiGL+ODieODoeOCpOODs++8iVxuICAgICAqIEBkZWZhdWx0IDEwXG4gICAgICovXG4gICAgcmF0ZUxpbWl0PzogbnVtYmVyO1xuXG4gICAgLyoqXG4gICAgICogcm9ib3RzLnR4dOWwiumHjVxuICAgICAqIEBkZWZhdWx0IHRydWVcbiAgICAgKi9cbiAgICByZXNwZWN0Um9ib3RzVHh0PzogYm9vbGVhbjtcblxuICAgIC8qKlxuICAgICAqIOODpuODvOOCtuODvOOCqOODvOOCuOOCp+ODs+ODiFxuICAgICAqIEBkZWZhdWx0ICdCZWRyb2NrQWdlbnRDb3JlLUJyb3dzZXIvMS4wJ1xuICAgICAqL1xuICAgIHVzZXJBZ2VudD86IHN0cmluZztcbiAgfTtcbn1cblxuLyoqXG4gKiBBbWF6b24gQmVkcm9jayBBZ2VudENvcmUgQnJvd3NlciBDb25zdHJ1Y3RcbiAqIFxuICogSGVhZGxlc3MgQ2hyb21l44Gr44KI44KL44OW44Op44Km44K26Ieq5YuV5YyW5qmf6IO944KS5o+Q5L6b44GX44G+44GZ44CCXG4gKi9cbmV4cG9ydCBjbGFzcyBCZWRyb2NrQWdlbnRDb3JlQnJvd3NlckNvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XG4gIC8qKlxuICAgKiBCcm93c2VyIExhbWJkYemWouaVsFxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGJyb3dzZXJGdW5jdGlvbj86IGxhbWJkYS5GdW5jdGlvbjtcblxuICAvKipcbiAgICog44K544Kv44Oq44O844Oz44K344On44OD44OI5L+d5a2Y55SoUzPjg5DjgrHjg4Pjg4hcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBzY3JlZW5zaG90QnVja2V0PzogczMuQnVja2V0O1xuXG4gIC8qKlxuICAgKiBLTVPmmpflj7fljJbjgq3jg7xcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBlbmNyeXB0aW9uS2V5Pzoga21zLktleTtcblxuICAvKipcbiAgICogSUFN5a6f6KGM44Ot44O844OrXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgZXhlY3V0aW9uUm9sZT86IGlhbS5Sb2xlO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlQnJvd3NlckNvbnN0cnVjdFByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIC8vIOapn+iDveOBjOeEoeWKueWMluOBleOCjOOBpuOBhOOCi+WgtOWQiOOBr+S9leOCguOBl+OBquOBhFxuICAgIGlmICghcHJvcHMuZW5hYmxlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEtNU+aal+WPt+WMluOCreODvOOBruS9nOaIkOOBvuOBn+OBr+S9v+eUqFxuICAgIHRoaXMuZW5jcnlwdGlvbktleSA9IHByb3BzLmVuY3J5cHRpb25LZXkgYXMga21zLktleSB8IHVuZGVmaW5lZCB8fCB0aGlzLmNyZWF0ZUVuY3J5cHRpb25LZXkocHJvcHMpO1xuXG4gICAgLy8g44K544Kv44Oq44O844Oz44K344On44OD44OI5L+d5a2Y55SoUzPjg5DjgrHjg4Pjg4jjga7kvZzmiJDjgb7jgZ/jga/kvb/nlKhcbiAgICB0aGlzLnNjcmVlbnNob3RCdWNrZXQgPSBwcm9wcy5zY3JlZW5zaG90QnVja2V0IGFzIHMzLkJ1Y2tldCB8IHVuZGVmaW5lZCB8fCB0aGlzLmNyZWF0ZVNjcmVlbnNob3RCdWNrZXQocHJvcHMpO1xuXG4gICAgLy8gSUFN5a6f6KGM44Ot44O844Or44Gu5L2c5oiQXG4gICAgdGhpcy5leGVjdXRpb25Sb2xlID0gdGhpcy5jcmVhdGVFeGVjdXRpb25Sb2xlKHByb3BzKTtcblxuICAgIC8vIEJyb3dzZXIgTGFtYmRh6Zai5pWw44Gu5L2c5oiQXG4gICAgdGhpcy5icm93c2VyRnVuY3Rpb24gPSB0aGlzLmNyZWF0ZUJyb3dzZXJGdW5jdGlvbihwcm9wcyk7XG5cbiAgICAvLyDjgr/jgrDku5jjgZFcbiAgICB0aGlzLmFwcGx5VGFncyhwcm9wcyk7XG4gIH1cblxuICAvKipcbiAgICogS01T5pqX5Y+35YyW44Kt44O844KS5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUVuY3J5cHRpb25LZXkocHJvcHM6IEJlZHJvY2tBZ2VudENvcmVCcm93c2VyQ29uc3RydWN0UHJvcHMpOiBrbXMuS2V5IHtcbiAgICByZXR1cm4gbmV3IGttcy5LZXkodGhpcywgJ0VuY3J5cHRpb25LZXknLCB7XG4gICAgICBkZXNjcmlwdGlvbjogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWFnZW50LWNvcmUtYnJvd3Nlci1rZXlgLFxuICAgICAgZW5hYmxlS2V5Um90YXRpb246IHRydWUsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog44K544Kv44Oq44O844Oz44K344On44OD44OI5L+d5a2Y55SoUzPjg5DjgrHjg4Pjg4jjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlU2NyZWVuc2hvdEJ1Y2tldChwcm9wczogQmVkcm9ja0FnZW50Q29yZUJyb3dzZXJDb25zdHJ1Y3RQcm9wcyk6IHMzLkJ1Y2tldCB7XG4gICAgY29uc3QgcmV0ZW50aW9uRGF5cyA9IHByb3BzLnNjcmVlbnNob3RDb25maWc/LnJldGVudGlvbkRheXMgfHwgNztcblxuICAgIHJldHVybiBuZXcgczMuQnVja2V0KHRoaXMsICdTY3JlZW5zaG90QnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWJyb3dzZXItc2NyZWVuc2hvdHNgLnRvTG93ZXJDYXNlKCksXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLktNUyxcbiAgICAgIGVuY3J5cHRpb25LZXk6IHRoaXMuZW5jcnlwdGlvbktleSxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICB2ZXJzaW9uZWQ6IGZhbHNlLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnRGVsZXRlT2xkU2NyZWVuc2hvdHMnLFxuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMocmV0ZW50aW9uRGF5cyksXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIElBTeWun+ihjOODreODvOODq+OCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVFeGVjdXRpb25Sb2xlKHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlQnJvd3NlckNvbnN0cnVjdFByb3BzKTogaWFtLlJvbGUge1xuICAgIGNvbnN0IHJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0V4ZWN1dGlvblJvbGUnLCB7XG4gICAgICByb2xlTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWJyb3dzZXItZXhlY3V0aW9uLXJvbGVgLFxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ0V4ZWN1dGlvbiByb2xlIGZvciBBZ2VudENvcmUgQnJvd3NlciBMYW1iZGEgZnVuY3Rpb24nLFxuICAgIH0pO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBMb2dz5qip6ZmQXG4gICAgcm9sZS5hZGRNYW5hZ2VkUG9saWN5KFxuICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlJylcbiAgICApO1xuXG4gICAgLy8gVlBD57Wx5ZCI5qip6ZmQ77yIVlBD44GM5oyH5a6a44GV44KM44Gm44GE44KL5aC05ZCI77yJXG4gICAgaWYgKHByb3BzLnZwYykge1xuICAgICAgcm9sZS5hZGRNYW5hZ2VkUG9saWN5KFxuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFWUENBY2Nlc3NFeGVjdXRpb25Sb2xlJylcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gUzPjgqLjgq/jgrvjgrnmqKnpmZBcbiAgICBpZiAodGhpcy5zY3JlZW5zaG90QnVja2V0KSB7XG4gICAgICB0aGlzLnNjcmVlbnNob3RCdWNrZXQuZ3JhbnRSZWFkV3JpdGUocm9sZSk7XG4gICAgfVxuXG4gICAgLy8gRlN4IGZvciBPTlRBUCBTMyBBY2Nlc3MgUG9pbnTmqKnpmZBcbiAgICBpZiAocHJvcHMuZnN4UzNBY2Nlc3NQb2ludEFybikge1xuICAgICAgcm9sZS5hZGRUb1BvbGljeShcbiAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAnczM6R2V0T2JqZWN0JyxcbiAgICAgICAgICAgICdzMzpQdXRPYmplY3QnLFxuICAgICAgICAgICAgJ3MzOkRlbGV0ZU9iamVjdCcsXG4gICAgICAgICAgICAnczM6TGlzdEJ1Y2tldCcsXG4gICAgICAgICAgXSxcbiAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgIHByb3BzLmZzeFMzQWNjZXNzUG9pbnRBcm4sXG4gICAgICAgICAgICBgJHtwcm9wcy5mc3hTM0FjY2Vzc1BvaW50QXJufS8qYCxcbiAgICAgICAgICBdLFxuICAgICAgICB9KVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBLTVPmqKnpmZBcbiAgICBpZiAodGhpcy5lbmNyeXB0aW9uS2V5KSB7XG4gICAgICB0aGlzLmVuY3J5cHRpb25LZXkuZ3JhbnRFbmNyeXB0RGVjcnlwdChyb2xlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcm9sZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBCcm93c2VyIExhbWJkYemWouaVsOOCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVCcm93c2VyRnVuY3Rpb24ocHJvcHM6IEJlZHJvY2tBZ2VudENvcmVCcm93c2VyQ29uc3RydWN0UHJvcHMpOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIGNvbnN0IG1lbW9yeVNpemUgPSBwcm9wcy5sYW1iZGFDb25maWc/Lm1lbW9yeVNpemUgfHwgMjA0ODtcbiAgICBjb25zdCB0aW1lb3V0ID0gcHJvcHMubGFtYmRhQ29uZmlnPy50aW1lb3V0IHx8IDMwMDtcbiAgICBjb25zdCBlcGhlbWVyYWxTdG9yYWdlU2l6ZSA9IHByb3BzLmxhbWJkYUNvbmZpZz8uZXBoZW1lcmFsU3RvcmFnZVNpemUgfHwgMjA0ODtcblxuICAgIGNvbnN0IGZ1bmMgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdCcm93c2VyRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1hZ2VudC1jb3JlLWJyb3dzZXJgLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9hZ2VudC1jb3JlLWJyb3dzZXInKSxcbiAgICAgIHJvbGU6IHRoaXMuZXhlY3V0aW9uUm9sZSxcbiAgICAgIG1lbW9yeVNpemUsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyh0aW1lb3V0KSxcbiAgICAgIGVwaGVtZXJhbFN0b3JhZ2VTaXplOiBjZGsuU2l6ZS5tZWJpYnl0ZXMoZXBoZW1lcmFsU3RvcmFnZVNpemUpLFxuICAgICAgcmVzZXJ2ZWRDb25jdXJyZW50RXhlY3V0aW9uczogcHJvcHMubGFtYmRhQ29uZmlnPy5yZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zLFxuICAgICAgdnBjOiBwcm9wcy52cGMsXG4gICAgICB2cGNTdWJuZXRzOiBwcm9wcy52cGMgPyB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSA6IHVuZGVmaW5lZCxcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBwcm9wcy5zZWN1cml0eUdyb3VwID8gW3Byb3BzLnNlY3VyaXR5R3JvdXBdIDogdW5kZWZpbmVkLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgUFJPSkVDVF9OQU1FOiBwcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgICAgRU5WSVJPTk1FTlQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgICBTQ1JFRU5TSE9UX0JVQ0tFVDogdGhpcy5zY3JlZW5zaG90QnVja2V0Py5idWNrZXROYW1lIHx8ICcnLFxuICAgICAgICBGU1hfUzNfQUNDRVNTX1BPSU5UX0FSTjogcHJvcHMuZnN4UzNBY2Nlc3NQb2ludEFybiB8fCAnJyxcbiAgICAgICAgU0NSRUVOU0hPVF9GT1JNQVQ6IHByb3BzLnNjcmVlbnNob3RDb25maWc/LmZvcm1hdCB8fCAncG5nJyxcbiAgICAgICAgR0VORVJBVEVfVEhVTUJOQUlMOiBTdHJpbmcocHJvcHMuc2NyZWVuc2hvdENvbmZpZz8uZ2VuZXJhdGVUaHVtYm5haWwgPz8gdHJ1ZSksXG4gICAgICAgIFJBVEVfTElNSVQ6IFN0cmluZyhwcm9wcy5zY3JhcGluZ0NvbmZpZz8ucmF0ZUxpbWl0IHx8IDEwKSxcbiAgICAgICAgUkVTUEVDVF9ST0JPVFNfVFhUOiBTdHJpbmcocHJvcHMuc2NyYXBpbmdDb25maWc/LnJlc3BlY3RSb2JvdHNUeHQgPz8gdHJ1ZSksXG4gICAgICAgIFVTRVJfQUdFTlQ6IHByb3BzLnNjcmFwaW5nQ29uZmlnPy51c2VyQWdlbnQgfHwgJ0JlZHJvY2tBZ2VudENvcmUtQnJvd3Nlci8xLjAnLFxuICAgICAgfSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGZ1bmM7XG4gIH1cblxuICAvKipcbiAgICog44K/44Kw44KS6YGp55SoXG4gICAqL1xuICBwcml2YXRlIGFwcGx5VGFncyhwcm9wczogQmVkcm9ja0FnZW50Q29yZUJyb3dzZXJDb25zdHJ1Y3RQcm9wcyk6IHZvaWQge1xuICAgIGNvbnN0IHRhZ3MgPSB7XG4gICAgICBQcm9qZWN0OiBwcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgIEVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgIENvbXBvbmVudDogJ0FnZW50Q29yZS1Ccm93c2VyJyxcbiAgICAgIE1hbmFnZWRCeTogJ0NESycsXG4gICAgfTtcblxuICAgIE9iamVjdC5lbnRyaWVzKHRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKGtleSwgdmFsdWUpO1xuICAgIH0pO1xuICB9XG59XG4iXX0=