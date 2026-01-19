"use strict";
// CDK Construct for Session Management DynamoDB Table
// セッション管理用DynamoDBテーブルのCDKコンストラクト
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionTableConstruct = void 0;
const constructs_1 = require("constructs");
const aws_dynamodb_1 = require("aws-cdk-lib/aws-dynamodb");
const aws_cdk_lib_1 = require("aws-cdk-lib");
/**
 * セッション管理用DynamoDBテーブルコンストラクト
 *
 * 機能:
 * - セッションIDをパーティションキーとした高速アクセス
 * - ユーザーIDによる全セッション検索（GSI）
 * - TTLによる自動期限切れセッション削除
 * - 本番環境での暗号化とバックアップ
 *
 * 使用例:
 * ```typescript
 * const sessionTable = new SessionTableConstruct(this, 'SessionTable', {
 *   tableName: 'TokyoRegion-permission-aware-rag-prod-Sessions',
 *   environment: 'prod'
 * });
 * ```
 */
class SessionTableConstruct extends constructs_1.Construct {
    /** DynamoDBテーブルインスタンス */
    table;
    constructor(scope, id, props) {
        super(scope, id);
        // セッション管理用DynamoDBテーブル
        this.table = new aws_dynamodb_1.Table(this, 'SessionTable', {
            tableName: props.tableName,
            // パーティションキー: セッションID
            partitionKey: {
                name: 'sessionId',
                type: aws_dynamodb_1.AttributeType.STRING
            },
            // オンデマンド課金（トラフィック変動に対応）
            billingMode: aws_dynamodb_1.BillingMode.PAY_PER_REQUEST,
            // TTL設定（自動削除）- 設計文書に準拠
            timeToLiveAttribute: 'expiresAt',
            // 削除ポリシー: 本番環境では保持
            removalPolicy: props.environment === 'prod'
                ? aws_cdk_lib_1.RemovalPolicy.RETAIN
                : aws_cdk_lib_1.RemovalPolicy.DESTROY,
            // ポイントインタイムリカバリ（本番環境のみ）
            pointInTimeRecovery: props.environment === 'prod',
            // AWS管理キーによる暗号化（全環境で必須）
            encryption: aws_dynamodb_1.TableEncryption.AWS_MANAGED,
        });
        /**
         * GSI: ユーザーIDでの検索用
         * 用途: 特定ユーザーの全セッション取得
         * クエリ例: userId = "user123"
         * パフォーマンス: O(1) - ユーザーIDでの直接アクセス
         */
        this.table.addGlobalSecondaryIndex({
            indexName: 'UserIdIndex',
            partitionKey: {
                name: 'userId',
                type: aws_dynamodb_1.AttributeType.STRING
            },
            sortKey: {
                name: 'createdAt',
                type: aws_dynamodb_1.AttributeType.NUMBER // Unix timestamp
            },
            projectionType: aws_dynamodb_1.ProjectionType.ALL
        });
        /**
         * GSI: 有効期限での検索用
         * 用途: 期限切れセッションのクリーンアップ・監視
         * クエリ例: expiresAt < currentTimestamp
         * 注意: TTLによる自動削除があるため、主に監視目的
         */
        this.table.addGlobalSecondaryIndex({
            indexName: 'ExpiresAtIndex',
            partitionKey: {
                name: 'expiresAt',
                type: aws_dynamodb_1.AttributeType.NUMBER // Unix timestamp（数値型に変更）
            },
            projectionType: aws_dynamodb_1.ProjectionType.KEYS_ONLY // 最小限の投影
        });
    }
}
exports.SessionTableConstruct = SessionTableConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Vzc2lvbi10YWJsZS1jb25zdHJ1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZXNzaW9uLXRhYmxlLWNvbnN0cnVjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsc0RBQXNEO0FBQ3RELGtDQUFrQzs7O0FBRWxDLDJDQUF1QztBQUN2QywyREFNa0M7QUFDbEMsNkNBQTRDO0FBZ0I1Qzs7Ozs7Ozs7Ozs7Ozs7OztHQWdCRztBQUNILE1BQWEscUJBQXNCLFNBQVEsc0JBQVM7SUFDbEQseUJBQXlCO0lBQ1QsS0FBSyxDQUFRO0lBRTdCLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBaUM7UUFDekUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQix1QkFBdUI7UUFDdkIsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLG9CQUFLLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUMzQyxTQUFTLEVBQUUsS0FBSyxDQUFDLFNBQVM7WUFFMUIscUJBQXFCO1lBQ3JCLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsV0FBVztnQkFDakIsSUFBSSxFQUFFLDRCQUFhLENBQUMsTUFBTTthQUMzQjtZQUVELHdCQUF3QjtZQUN4QixXQUFXLEVBQUUsMEJBQVcsQ0FBQyxlQUFlO1lBRXhDLHVCQUF1QjtZQUN2QixtQkFBbUIsRUFBRSxXQUFXO1lBRWhDLG1CQUFtQjtZQUNuQixhQUFhLEVBQUUsS0FBSyxDQUFDLFdBQVcsS0FBSyxNQUFNO2dCQUN6QyxDQUFDLENBQUMsMkJBQWEsQ0FBQyxNQUFNO2dCQUN0QixDQUFDLENBQUMsMkJBQWEsQ0FBQyxPQUFPO1lBRXpCLHdCQUF3QjtZQUN4QixtQkFBbUIsRUFBRSxLQUFLLENBQUMsV0FBVyxLQUFLLE1BQU07WUFFakQsd0JBQXdCO1lBQ3hCLFVBQVUsRUFBRSw4QkFBZSxDQUFDLFdBQVc7U0FDeEMsQ0FBQyxDQUFDO1FBRUg7Ozs7O1dBS0c7UUFDSCxJQUFJLENBQUMsS0FBSyxDQUFDLHVCQUF1QixDQUFDO1lBQ2pDLFNBQVMsRUFBRSxhQUFhO1lBQ3hCLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsUUFBUTtnQkFDZCxJQUFJLEVBQUUsNEJBQWEsQ0FBQyxNQUFNO2FBQzNCO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxXQUFXO2dCQUNqQixJQUFJLEVBQUUsNEJBQWEsQ0FBQyxNQUFNLENBQUUsaUJBQWlCO2FBQzlDO1lBQ0QsY0FBYyxFQUFFLDZCQUFjLENBQUMsR0FBRztTQUNuQyxDQUFDLENBQUM7UUFFSDs7Ozs7V0FLRztRQUNILElBQUksQ0FBQyxLQUFLLENBQUMsdUJBQXVCLENBQUM7WUFDakMsU0FBUyxFQUFFLGdCQUFnQjtZQUMzQixZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLFdBQVc7Z0JBQ2pCLElBQUksRUFBRSw0QkFBYSxDQUFDLE1BQU0sQ0FBRSx5QkFBeUI7YUFDdEQ7WUFDRCxjQUFjLEVBQUUsNkJBQWMsQ0FBQyxTQUFTLENBQUUsU0FBUztTQUNwRCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFyRUQsc0RBcUVDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ0RLIENvbnN0cnVjdCBmb3IgU2Vzc2lvbiBNYW5hZ2VtZW50IER5bmFtb0RCIFRhYmxlXG4vLyDjgrvjg4Pjgrfjg6fjg7PnrqHnkIbnlKhEeW5hbW9EQuODhuODvOODluODq+OBrkNES+OCs+ODs+OCueODiOODqeOCr+ODiFxuXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IFxuICBUYWJsZSwgXG4gIEF0dHJpYnV0ZVR5cGUsIFxuICBCaWxsaW5nTW9kZSwgXG4gIFByb2plY3Rpb25UeXBlLFxuICBUYWJsZUVuY3J5cHRpb24gXG59IGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgeyBSZW1vdmFsUG9saWN5IH0gZnJvbSAnYXdzLWNkay1saWInO1xuXG4vKipcbiAqIOOCu+ODg+OCt+ODp+ODs+ODhuODvOODluODq+OCs+ODs+OCueODiOODqeOCr+ODiOOBruODl+ODreODkeODhuOCo1xuICovXG5leHBvcnQgaW50ZXJmYWNlIFNlc3Npb25UYWJsZUNvbnN0cnVjdFByb3BzIHtcbiAgLyoqIOODhuODvOODluODq+WQje+8iOWRveWQjeimj+WJh+OBq+a6luaLoO+8iSAqL1xuICB0YWJsZU5hbWU6IHN0cmluZztcbiAgXG4gIC8qKiDnkrDlooPlkI3vvIhwcm9kLCBkZXYsIHN0YWdpbmfnrYnvvIkgKi9cbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgXG4gIC8qKiBUVEzmnInlirnmnJ/pmZDvvIjnp5LvvInjg4fjg5Xjgqnjg6vjg4g6IDI05pmC6ZaTICovXG4gIGRlZmF1bHRUdGxTZWNvbmRzPzogbnVtYmVyO1xufVxuXG4vKipcbiAqIOOCu+ODg+OCt+ODp+ODs+euoeeQhueUqER5bmFtb0RC44OG44O844OW44Or44Kz44Oz44K544OI44Op44Kv44OIXG4gKiBcbiAqIOapn+iDvTpcbiAqIC0g44K744OD44K344On44OzSUTjgpLjg5Hjg7zjg4bjgqPjgrfjg6fjg7Pjgq3jg7zjgajjgZfjgZ/pq5jpgJ/jgqLjgq/jgrvjgrlcbiAqIC0g44Om44O844K244O8SUTjgavjgojjgovlhajjgrvjg4Pjgrfjg6fjg7PmpJzntKLvvIhHU0nvvIlcbiAqIC0gVFRM44Gr44KI44KL6Ieq5YuV5pyf6ZmQ5YiH44KM44K744OD44K344On44Oz5YmK6ZmkXG4gKiAtIOacrOeVqueSsOWig+OBp+OBruaal+WPt+WMluOBqOODkOODg+OCr+OCouODg+ODl1xuICogXG4gKiDkvb/nlKjkvos6XG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBjb25zdCBzZXNzaW9uVGFibGUgPSBuZXcgU2Vzc2lvblRhYmxlQ29uc3RydWN0KHRoaXMsICdTZXNzaW9uVGFibGUnLCB7XG4gKiAgIHRhYmxlTmFtZTogJ1Rva3lvUmVnaW9uLXBlcm1pc3Npb24tYXdhcmUtcmFnLXByb2QtU2Vzc2lvbnMnLFxuICogICBlbnZpcm9ubWVudDogJ3Byb2QnXG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgU2Vzc2lvblRhYmxlQ29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgLyoqIER5bmFtb0RC44OG44O844OW44Or44Kk44Oz44K544K/44Oz44K5ICovXG4gIHB1YmxpYyByZWFkb25seSB0YWJsZTogVGFibGU7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFNlc3Npb25UYWJsZUNvbnN0cnVjdFByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIC8vIOOCu+ODg+OCt+ODp+ODs+euoeeQhueUqER5bmFtb0RC44OG44O844OW44OrXG4gICAgdGhpcy50YWJsZSA9IG5ldyBUYWJsZSh0aGlzLCAnU2Vzc2lvblRhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBwcm9wcy50YWJsZU5hbWUsXG4gICAgICBcbiAgICAgIC8vIOODkeODvOODhuOCo+OCt+ODp+ODs+OCreODvDog44K744OD44K344On44OzSURcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnc2Vzc2lvbklkJyxcbiAgICAgICAgdHlwZTogQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBcbiAgICAgIC8vIOOCquODs+ODh+ODnuODs+ODieiqsumHke+8iOODiOODqeODleOCo+ODg+OCr+WkieWLleOBq+WvvuW/nO+8iVxuICAgICAgYmlsbGluZ01vZGU6IEJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIFxuICAgICAgLy8gVFRM6Kit5a6a77yI6Ieq5YuV5YmK6Zmk77yJLSDoqK3oqIjmlofmm7jjgavmupbmi6BcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICdleHBpcmVzQXQnLFxuICAgICAgXG4gICAgICAvLyDliYrpmaTjg53jg6rjgrfjg7w6IOacrOeVqueSsOWig+OBp+OBr+S/neaMgVxuICAgICAgcmVtb3ZhbFBvbGljeTogcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJyBcbiAgICAgICAgPyBSZW1vdmFsUG9saWN5LlJFVEFJTiBcbiAgICAgICAgOiBSZW1vdmFsUG9saWN5LkRFU1RST1ksXG5cbiAgICAgIC8vIOODneOCpOODs+ODiOOCpOODs+OCv+OCpOODoOODquOCq+ODkOODqu+8iOacrOeVqueSsOWig+OBruOBv++8iVxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJyxcblxuICAgICAgLy8gQVdT566h55CG44Kt44O844Gr44KI44KL5pqX5Y+35YyW77yI5YWo55Kw5aKD44Gn5b+F6aCI77yJXG4gICAgICBlbmNyeXB0aW9uOiBUYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgfSk7XG5cbiAgICAvKipcbiAgICAgKiBHU0k6IOODpuODvOOCtuODvElE44Gn44Gu5qSc57Si55SoXG4gICAgICog55So6YCUOiDnibnlrprjg6bjg7zjgrbjg7zjga7lhajjgrvjg4Pjgrfjg6fjg7Plj5blvpdcbiAgICAgKiDjgq/jgqjjg6rkvos6IHVzZXJJZCA9IFwidXNlcjEyM1wiXG4gICAgICog44OR44OV44Kp44O844Oe44Oz44K5OiBPKDEpIC0g44Om44O844K244O8SUTjgafjga7nm7TmjqXjgqLjgq/jgrvjgrlcbiAgICAgKi9cbiAgICB0aGlzLnRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ1VzZXJJZEluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAndXNlcklkJyxcbiAgICAgICAgdHlwZTogQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICdjcmVhdGVkQXQnLFxuICAgICAgICB0eXBlOiBBdHRyaWJ1dGVUeXBlLk5VTUJFUiAgLy8gVW5peCB0aW1lc3RhbXBcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogUHJvamVjdGlvblR5cGUuQUxMXG4gICAgfSk7XG5cbiAgICAvKipcbiAgICAgKiBHU0k6IOacieWKueacn+mZkOOBp+OBruaknOe0oueUqFxuICAgICAqIOeUqOmAlDog5pyf6ZmQ5YiH44KM44K744OD44K344On44Oz44Gu44Kv44Oq44O844Oz44Ki44OD44OX44O755uj6KaWXG4gICAgICog44Kv44Ko44Oq5L6LOiBleHBpcmVzQXQgPCBjdXJyZW50VGltZXN0YW1wXG4gICAgICog5rOo5oSPOiBUVEzjgavjgojjgovoh6rli5XliYrpmaTjgYzjgYLjgovjgZ/jgoHjgIHkuLvjgavnm6Poppbnm67nmoRcbiAgICAgKi9cbiAgICB0aGlzLnRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ0V4cGlyZXNBdEluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnZXhwaXJlc0F0JyxcbiAgICAgICAgdHlwZTogQXR0cmlidXRlVHlwZS5OVU1CRVIgIC8vIFVuaXggdGltZXN0YW1w77yI5pWw5YCk5Z6L44Gr5aSJ5pu077yJXG4gICAgICB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IFByb2plY3Rpb25UeXBlLktFWVNfT05MWSAgLy8g5pyA5bCP6ZmQ44Gu5oqV5b2xXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==