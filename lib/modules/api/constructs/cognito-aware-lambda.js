"use strict";
/**
 * Cognito認識型Lambda関数コンストラクト
 *
 * Cognito VPC Endpoint有効時のみLambda関数をVPC内に配置
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
exports.CognitoAwareLambda = void 0;
exports.createCognitoAwareLambda = createCognitoAwareLambda;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const constructs_1 = require("constructs");
/**
 * Cognito認識型Lambda関数コンストラクト
 *
 * Cognito VPC Endpoint有効時のみLambda関数をVPC内に配置し、
 * 環境変数で接続モードを通知します。
 *
 * 使用例:
 * ```typescript
 * const authFunction = new CognitoAwareLambda(this, 'AuthFunction', {
 *   functionName: 'auth-function',
 *   code: lambda.Code.fromAsset('lambda/auth'),
 *   handler: 'index.handler',
 *   vpc,
 *   cognitoPrivateEndpointEnabled: true,
 *   projectName: 'my-project',
 *   environment: 'prod',
 * });
 * ```
 */
class CognitoAwareLambda extends constructs_1.Construct {
    /**
     * 作成されたLambda関数
     */
    function;
    /**
     * Cognito接続モード
     * - 'private': VPC Endpoint経由
     * - 'public': インターネット経由
     */
    connectionMode;
    constructor(scope, id, props) {
        super(scope, id);
        // Cognito接続モードの決定
        this.connectionMode = props.cognitoPrivateEndpointEnabled ? 'private' : 'public';
        // 環境変数の準備
        const environment = { ...props.environment };
        // VPC設定の準備（Private接続モードの場合のみ）
        const vpcConfig = this.connectionMode === 'private' && props.vpc ? {
            vpc: props.vpc,
            vpcSubnets: props.vpcSubnets ?? {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
            securityGroups: props.securityGroups,
        } : {};
        // Lambda関数作成
        this.function = new lambda.Function(this, 'Function', {
            functionName: `${props.projectName}-${props.environment}-${props.functionName}`,
            code: props.code,
            handler: props.handler,
            runtime: props.runtime ?? lambda.Runtime.NODEJS_20_X,
            timeout: props.timeout ?? cdk.Duration.seconds(30),
            memorySize: props.memorySize ?? 512,
            environment,
            ...vpcConfig,
        });
        // Private接続モードの場合、VPC Endpointアクセス用IAMポリシー追加
        if (this.connectionMode === 'private') {
            this.addVpcEndpointAccessPolicy();
        }
        // タグ設定
        cdk.Tags.of(this.function).add('ConnectionMode', this.connectionMode);
        cdk.Tags.of(this.function).add('Project', props.projectName);
        // ログ出力
        console.log(`✅ Lambda関数作成: ${this.function.functionName}`);
        console.log(`   接続モード: ${this.connectionMode}`);
        console.log(`   VPC配置: ${this.connectionMode === 'private' ? 'Yes' : 'No'}`);
    }
    /**
     * VPC Endpointアクセス用IAMポリシー追加
     */
    addVpcEndpointAccessPolicy() {
        // Cognito User Pools APIへのアクセス権限
        this.function.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'cognito-idp:AdminInitiateAuth',
                'cognito-idp:AdminGetUser',
                'cognito-idp:AdminCreateUser',
                'cognito-idp:AdminSetUserPassword',
                'cognito-idp:AdminUpdateUserAttributes',
                'cognito-idp:AdminDeleteUser',
                'cognito-idp:ListUsers',
                'cognito-idp:GetUser',
            ],
            resources: [
                `arn:aws:cognito-idp:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:userpool/*`,
            ],
        }));
        // VPC Endpointへのネットワークアクセス権限（暗黙的に付与される）
        console.log('   IAMポリシー追加: Cognito User Pools API アクセス権限');
    }
    /**
     * Lambda関数に環境変数を追加
     */
    addEnvironment(key, value) {
        this.function.addEnvironment(key, value);
    }
    /**
     * Lambda関数にIAMポリシーを追加
     */
    addToRolePolicy(statement) {
        this.function.addToRolePolicy(statement);
    }
    /**
     * Lambda関数に実行権限を付与
     */
    grantInvoke(grantee) {
        return this.function.grantInvoke(grantee);
    }
}
exports.CognitoAwareLambda = CognitoAwareLambda;
/**
 * Cognito認識型Lambda関数を作成するヘルパー関数
 *
 * @param scope コンストラクトスコープ
 * @param id コンストラクトID
 * @param props Lambda関数プロパティ
 * @returns 作成されたLambda関数
 */
function createCognitoAwareLambda(scope, id, props) {
    const cognitoAwareLambda = new CognitoAwareLambda(scope, id, props);
    return cognitoAwareLambda.function;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29nbml0by1hd2FyZS1sYW1iZGEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjb2duaXRvLWF3YXJlLWxhbWJkYS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7R0FJRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUEyTkgsNERBT0M7QUFoT0QsaURBQW1DO0FBQ25DLCtEQUFpRDtBQUNqRCx5REFBMkM7QUFDM0MseURBQTJDO0FBQzNDLDJDQUF1QztBQWdGdkM7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQWtCRztBQUNILE1BQWEsa0JBQW1CLFNBQVEsc0JBQVM7SUFDL0M7O09BRUc7SUFDYSxRQUFRLENBQWtCO0lBRTFDOzs7O09BSUc7SUFDYSxjQUFjLENBQXVCO0lBRXJELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBOEI7UUFDdEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixrQkFBa0I7UUFDbEIsSUFBSSxDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUMsNkJBQTZCLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDO1FBRWpGLFVBQVU7UUFDVixNQUFNLFdBQVcsR0FBRyxFQUFFLEdBQUcsS0FBSyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBRTdDLDhCQUE4QjtRQUM5QixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsY0FBYyxLQUFLLFNBQVMsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNqRSxHQUFHLEVBQUUsS0FBSyxDQUFDLEdBQUc7WUFDZCxVQUFVLEVBQUUsS0FBSyxDQUFDLFVBQVUsSUFBSTtnQkFDOUIsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsbUJBQW1CO2FBQy9DO1lBQ0QsY0FBYyxFQUFFLEtBQUssQ0FBQyxjQUFjO1NBQ3JDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUVQLGFBQWE7UUFDYixJQUFJLENBQUMsUUFB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O0lBQzVDLENBQUM7Q0FDRjtBQXhHRCxnREF3R0M7QUFFRDs7Ozs7OztHQU9HO0FBQ0gsU0FBZ0Isd0JBQXdCLENBQ3RDLEtBQWdCLEVBQ2hCLEVBQVUsRUFDVixLQUE4QjtJQUU5QixNQUFNLGtCQUFrQixHQUFHLElBQUksa0JBQWtCLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNwRSxPQUFPLGtCQUFrQixDQUFDLFFBQVEsQ0FBQztBQUNyQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDb2duaXRv6KqN6K2Y5Z6LTGFtYmRh6Zai5pWw44Kz44Oz44K544OI44Op44Kv44OIXG4gKiBcbiAqIENvZ25pdG8gVlBDIEVuZHBvaW505pyJ5Yq55pmC44Gu44G/TGFtYmRh6Zai5pWw44KSVlBD5YaF44Gr6YWN572uXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG4vKipcbiAqIENvZ25pdG/oqo3orZjlnotMYW1iZGHplqLmlbDjga7jg5fjg63jg5Hjg4bjgqNcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDb2duaXRvQXdhcmVMYW1iZGFQcm9wcyB7XG4gIC8qKlxuICAgKiBMYW1iZGHplqLmlbDlkI1cbiAgICovXG4gIGZ1bmN0aW9uTmFtZTogc3RyaW5nO1xuICBcbiAgLyoqXG4gICAqIExhbWJkYemWouaVsOOCs+ODvOODiVxuICAgKi9cbiAgY29kZTogbGFtYmRhLkNvZGU7XG4gIFxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw44OP44Oz44OJ44Op44O8XG4gICAqL1xuICBoYW5kbGVyOiBzdHJpbmc7XG4gIFxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw44Op44Oz44K/44Kk44OgXG4gICAqIEBkZWZhdWx0IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YXG4gICAqL1xuICBydW50aW1lPzogbGFtYmRhLlJ1bnRpbWU7XG4gIFxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw44K/44Kk44Og44Ki44Km44OIXG4gICAqIEBkZWZhdWx0IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKVxuICAgKi9cbiAgdGltZW91dD86IGNkay5EdXJhdGlvbjtcbiAgXG4gIC8qKlxuICAgKiBMYW1iZGHplqLmlbDjg6Hjg6Ljg6rjgrXjgqTjgrpcbiAgICogQGRlZmF1bHQgNTEyXG4gICAqL1xuICBtZW1vcnlTaXplPzogbnVtYmVyO1xuICBcbiAgLyoqXG4gICAqIOeSsOWig+WkieaVsFxuICAgKi9cbiAgZW52aXJvbm1lbnQ/OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9O1xuICBcbiAgLyoqXG4gICAqIFZQQ++8iENvZ25pdG8gUHJpdmF0ZSBFbmRwb2ludOacieWKueaZguOBq+S9v+eUqO+8iVxuICAgKi9cbiAgdnBjPzogZWMyLklWcGM7XG4gIFxuICAvKipcbiAgICogVlBD5YaF44Gr6YWN572u44GZ44KL44K144OW44ON44OD44OI6YG45oqeXG4gICAqIEBkZWZhdWx0IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9XG4gICAqL1xuICB2cGNTdWJuZXRzPzogZWMyLlN1Ym5ldFNlbGVjdGlvbjtcbiAgXG4gIC8qKlxuICAgKiDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5dcbiAgICovXG4gIHNlY3VyaXR5R3JvdXBzPzogZWMyLklTZWN1cml0eUdyb3VwW107XG4gIFxuICAvKipcbiAgICogQ29nbml0byBWUEMgRW5kcG9pbnTjgYzmnInlirnjgYvjganjgYbjgYtcbiAgICogXG4gICAqIC0gdHJ1ZTogTGFtYmRh6Zai5pWw44KSVlBD5YaF44Gr6YWN572uXG4gICAqIC0gZmFsc2U6IExhbWJkYemWouaVsOOCklZQQ+WkluOBq+mFjee9ru+8iOODh+ODleOCqeODq+ODiO+8iVxuICAgKiBcbiAgICogQGRlZmF1bHQgZmFsc2VcbiAgICovXG4gIGNvZ25pdG9Qcml2YXRlRW5kcG9pbnRFbmFibGVkPzogYm9vbGVhbjtcbiAgXG4gIC8qKlxuICAgKiDjg5fjg63jgrjjgqfjgq/jg4jlkI1cbiAgICovXG4gIHByb2plY3ROYW1lOiBzdHJpbmc7XG4gIFxuICAvKipcbiAgICog55Kw5aKD5ZCNXG4gICAqL1xufVxuXG4vKipcbiAqIENvZ25pdG/oqo3orZjlnotMYW1iZGHplqLmlbDjgrPjg7Pjgrnjg4jjg6njgq/jg4hcbiAqIFxuICogQ29nbml0byBWUEMgRW5kcG9pbnTmnInlirnmmYLjga7jgb9MYW1iZGHplqLmlbDjgpJWUEPlhoXjgavphY3nva7jgZfjgIFcbiAqIOeSsOWig+WkieaVsOOBp+aOpee2muODouODvOODieOCkumAmuefpeOBl+OBvuOBmeOAglxuICogXG4gKiDkvb/nlKjkvos6XG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBjb25zdCBhdXRoRnVuY3Rpb24gPSBuZXcgQ29nbml0b0F3YXJlTGFtYmRhKHRoaXMsICdBdXRoRnVuY3Rpb24nLCB7XG4gKiAgIGZ1bmN0aW9uTmFtZTogJ2F1dGgtZnVuY3Rpb24nLFxuICogICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9hdXRoJyksXG4gKiAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAqICAgdnBjLFxuICogICBjb2duaXRvUHJpdmF0ZUVuZHBvaW50RW5hYmxlZDogdHJ1ZSxcbiAqICAgcHJvamVjdE5hbWU6ICdteS1wcm9qZWN0JyxcbiAqICAgZW52aXJvbm1lbnQ6ICdwcm9kJyxcbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBDb2duaXRvQXdhcmVMYW1iZGEgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICAvKipcbiAgICog5L2c5oiQ44GV44KM44GfTGFtYmRh6Zai5pWwXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgZnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgXG4gIC8qKlxuICAgKiBDb2duaXRv5o6l57aa44Oi44O844OJXG4gICAqIC0gJ3ByaXZhdGUnOiBWUEMgRW5kcG9pbnTntYznlLFcbiAgICogLSAncHVibGljJzog44Kk44Oz44K/44O844ON44OD44OI57WM55SxXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgY29ubmVjdGlvbk1vZGU6ICdwcml2YXRlJyB8ICdwdWJsaWMnO1xuICBcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IENvZ25pdG9Bd2FyZUxhbWJkYVByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcbiAgICBcbiAgICAvLyBDb2duaXRv5o6l57aa44Oi44O844OJ44Gu5rG65a6aXG4gICAgdGhpcy5jb25uZWN0aW9uTW9kZSA9IHByb3BzLmNvZ25pdG9Qcml2YXRlRW5kcG9pbnRFbmFibGVkID8gJ3ByaXZhdGUnIDogJ3B1YmxpYyc7XG4gICAgXG4gICAgLy8g55Kw5aKD5aSJ5pWw44Gu5rqW5YKZXG4gICAgY29uc3QgZW52aXJvbm1lbnQgPSB7IC4uLnByb3BzLmVudmlyb25tZW50IH07XG4gICAgXG4gICAgLy8gVlBD6Kit5a6a44Gu5rqW5YKZ77yIUHJpdmF0ZeaOpee2muODouODvOODieOBruWgtOWQiOOBruOBv++8iVxuICAgIGNvbnN0IHZwY0NvbmZpZyA9IHRoaXMuY29ubmVjdGlvbk1vZGUgPT09ICdwcml2YXRlJyAmJiBwcm9wcy52cGMgPyB7XG4gICAgICB2cGM6IHByb3BzLnZwYyxcbiAgICAgIHZwY1N1Ym5ldHM6IHByb3BzLnZwY1N1Ym5ldHMgPz8ge1xuICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgfSxcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBwcm9wcy5zZWN1cml0eUdyb3VwcyxcbiAgICB9IDoge307XG4gICAgXG4gICAgLy8gTGFtYmRh6Zai5pWw5L2c5oiQXG4gICAgdGhpcy5mdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0Z1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tJHtwcm9wcy5mdW5jdGlvbk5hbWV9YCxcbiAgICAgIGNvZGU6IHByb3BzLmNvZGUsXG4gICAgICBoYW5kbGVyOiBwcm9wcy5oYW5kbGVyLFxuICAgICAgcnVudGltZTogcHJvcHMucnVudGltZSA/PyBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcbiAgICAgIHRpbWVvdXQ6IHByb3BzLnRpbWVvdXQgPz8gY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogcHJvcHMubWVtb3J5U2l6ZSA/PyA1MTIsXG4gICAgICBlbnZpcm9ubWVudCxcbiAgICAgIC4uLnZwY0NvbmZpZyxcbiAgICB9KTtcbiAgICBcbiAgICAvLyBQcml2YXRl5o6l57aa44Oi44O844OJ44Gu5aC05ZCI44CBVlBDIEVuZHBvaW5044Ki44Kv44K744K555SoSUFN44Od44Oq44K344O86L+95YqgXG4gICAgaWYgKHRoaXMuY29ubmVjdGlvbk1vZGUgPT09ICdwcml2YXRlJykge1xuICAgICAgdGhpcy5hZGRWcGNFbmRwb2ludEFjY2Vzc1BvbGljeSgpO1xuICAgIH1cbiAgICBcbiAgICAvLyDjgr/jgrDoqK3lrppcbiAgICBjZGsuVGFncy5vZih0aGlzLmZ1bmN0aW9uKS5hZGQoJ0Nvbm5lY3Rpb25Nb2RlJywgdGhpcy5jb25uZWN0aW9uTW9kZSk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcy5mdW5jdGlvbikuYWRkKCdQcm9qZWN0JywgcHJvcHMucHJvamVjdE5hbWUpO1xuICAgIFxuICAgIC8vIOODreOCsOWHuuWKm1xuICAgIGNvbnNvbGUubG9nKGDinIUgTGFtYmRh6Zai5pWw5L2c5oiQOiAke3RoaXMuZnVuY3Rpb24uZnVuY3Rpb25OYW1lfWApO1xuICAgIGNvbnNvbGUubG9nKGAgICDmjqXntprjg6Ljg7zjg4k6ICR7dGhpcy5jb25uZWN0aW9uTW9kZX1gKTtcbiAgICBjb25zb2xlLmxvZyhgICAgVlBD6YWN572uOiAke3RoaXMuY29ubmVjdGlvbk1vZGUgPT09ICdwcml2YXRlJyA/ICdZZXMnIDogJ05vJ31gKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIFZQQyBFbmRwb2ludOOCouOCr+OCu+OCueeUqElBTeODneODquOCt+ODvOi/veWKoFxuICAgKi9cbiAgcHJpdmF0ZSBhZGRWcGNFbmRwb2ludEFjY2Vzc1BvbGljeSgpOiB2b2lkIHtcbiAgICAvLyBDb2duaXRvIFVzZXIgUG9vbHMgQVBJ44G444Gu44Ki44Kv44K744K55qip6ZmQXG4gICAgdGhpcy5mdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5Jbml0aWF0ZUF1dGgnLFxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5HZXRVc2VyJyxcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluQ3JlYXRlVXNlcicsXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pblNldFVzZXJQYXNzd29yZCcsXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pblVwZGF0ZVVzZXJBdHRyaWJ1dGVzJyxcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluRGVsZXRlVXNlcicsXG4gICAgICAgICdjb2duaXRvLWlkcDpMaXN0VXNlcnMnLFxuICAgICAgICAnY29nbml0by1pZHA6R2V0VXNlcicsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmNvZ25pdG8taWRwOiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06dXNlcnBvb2wvKmAsXG4gICAgICBdLFxuICAgIH0pKTtcbiAgICBcbiAgICAvLyBWUEMgRW5kcG9pbnTjgbjjga7jg43jg4Pjg4jjg6/jg7zjgq/jgqLjgq/jgrvjgrnmqKnpmZDvvIjmmpfpu5nnmoTjgavku5jkuI7jgZXjgozjgovvvIlcbiAgICBjb25zb2xlLmxvZygnICAgSUFN44Od44Oq44K344O86L+95YqgOiBDb2duaXRvIFVzZXIgUG9vbHMgQVBJIOOCouOCr+OCu+OCueaoqemZkCcpO1xuICB9XG4gIFxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw44Gr55Kw5aKD5aSJ5pWw44KS6L+95YqgXG4gICAqL1xuICBwdWJsaWMgYWRkRW52aXJvbm1lbnQoa2V5OiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLmZ1bmN0aW9uLmFkZEVudmlyb25tZW50KGtleSwgdmFsdWUpO1xuICB9XG4gIFxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw44GrSUFN44Od44Oq44K344O844KS6L+95YqgXG4gICAqL1xuICBwdWJsaWMgYWRkVG9Sb2xlUG9saWN5KHN0YXRlbWVudDogaWFtLlBvbGljeVN0YXRlbWVudCk6IHZvaWQge1xuICAgIHRoaXMuZnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KHN0YXRlbWVudCk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBMYW1iZGHplqLmlbDjgavlrp/ooYzmqKnpmZDjgpLku5jkuI5cbiAgICovXG4gIHB1YmxpYyBncmFudEludm9rZShncmFudGVlOiBpYW0uSUdyYW50YWJsZSk6IGlhbS5HcmFudCB7XG4gICAgcmV0dXJuIHRoaXMuZnVuY3Rpb24uZ3JhbnRJbnZva2UoZ3JhbnRlZSk7XG4gIH1cbn1cblxuLyoqXG4gKiBDb2duaXRv6KqN6K2Y5Z6LTGFtYmRh6Zai5pWw44KS5L2c5oiQ44GZ44KL44OY44Or44OR44O86Zai5pWwXG4gKiBcbiAqIEBwYXJhbSBzY29wZSDjgrPjg7Pjgrnjg4jjg6njgq/jg4jjgrnjgrPjg7zjg5dcbiAqIEBwYXJhbSBpZCDjgrPjg7Pjgrnjg4jjg6njgq/jg4hJRFxuICogQHBhcmFtIHByb3BzIExhbWJkYemWouaVsOODl+ODreODkeODhuOCo1xuICogQHJldHVybnMg5L2c5oiQ44GV44KM44GfTGFtYmRh6Zai5pWwXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDb2duaXRvQXdhcmVMYW1iZGEoXG4gIHNjb3BlOiBDb25zdHJ1Y3QsXG4gIGlkOiBzdHJpbmcsXG4gIHByb3BzOiBDb2duaXRvQXdhcmVMYW1iZGFQcm9wc1xuKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgY29uc3QgY29nbml0b0F3YXJlTGFtYmRhID0gbmV3IENvZ25pdG9Bd2FyZUxhbWJkYShzY29wZSwgaWQsIHByb3BzKTtcbiAgcmV0dXJuIGNvZ25pdG9Bd2FyZUxhbWJkYS5mdW5jdGlvbjtcbn1cbiJdfQ==