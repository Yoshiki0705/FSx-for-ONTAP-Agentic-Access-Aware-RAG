"use strict";
/**
 * 動的設定キャッシュテーブルコンストラクト
 * モデル・プロバイダー・リージョン情報の動的キャッシュ用DynamoDBテーブル
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscoveryCacheTableConstruct = void 0;
const constructs_1 = require("constructs");
const aws_dynamodb_1 = require("aws-cdk-lib/aws-dynamodb");
const aws_cdk_lib_1 = require("aws-cdk-lib");
/**
 * 動的設定キャッシュ用DynamoDBテーブル
 *
 * 機能:
 * - Bedrockモデル情報の動的キャッシュ
 * - プロバイダー情報の動的生成・キャッシュ
 * - リージョン可用性情報のキャッシュ
 * - TTLによる自動キャッシュ更新
 */
class DiscoveryCacheTableConstruct extends constructs_1.Construct {
    table;
    constructor(scope, id, props) {
        super(scope, id);
        this.table = new aws_dynamodb_1.Table(this, 'DiscoveryCacheTable', {
            tableName: props.tableName,
            // パーティションキー: キャッシュキー
            partitionKey: {
                name: 'cacheKey',
                type: aws_dynamodb_1.AttributeType.STRING
            },
            billingMode: aws_dynamodb_1.BillingMode.PAY_PER_REQUEST,
            // TTL設定（6時間でキャッシュ更新）
            timeToLiveAttribute: 'expiresAt',
            removalPolicy: props.environment === 'prod'
                ? aws_cdk_lib_1.RemovalPolicy.RETAIN
                : aws_cdk_lib_1.RemovalPolicy.DESTROY,
            pointInTimeRecovery: props.environment === 'prod',
            encryption: aws_dynamodb_1.TableEncryption.AWS_MANAGED,
        });
        // GSI: リージョン別キャッシュ検索用
        this.table.addGlobalSecondaryIndex({
            indexName: 'RegionIndex',
            partitionKey: {
                name: 'region',
                type: aws_dynamodb_1.AttributeType.STRING
            },
            sortKey: {
                name: 'createdAt',
                type: aws_dynamodb_1.AttributeType.NUMBER
            },
            projectionType: aws_dynamodb_1.ProjectionType.ALL
        });
        // GSI: データタイプ別キャッシュ検索用
        this.table.addGlobalSecondaryIndex({
            indexName: 'DataTypeIndex',
            partitionKey: {
                name: 'dataType',
                type: aws_dynamodb_1.AttributeType.STRING
            },
            sortKey: {
                name: 'createdAt',
                type: aws_dynamodb_1.AttributeType.NUMBER
            },
            projectionType: aws_dynamodb_1.ProjectionType.ALL
        });
    }
}
exports.DiscoveryCacheTableConstruct = DiscoveryCacheTableConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlzY292ZXJ5LWNhY2hlLXRhYmxlLWNvbnN0cnVjdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRpc2NvdmVyeS1jYWNoZS10YWJsZS1jb25zdHJ1Y3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7O0FBRUgsMkNBQXVDO0FBQ3ZDLDJEQU1rQztBQUNsQyw2Q0FBNEM7QUFPNUM7Ozs7Ozs7O0dBUUc7QUFDSCxNQUFhLDRCQUE2QixTQUFRLHNCQUFTO0lBQ3pDLEtBQUssQ0FBUTtJQUU3QixZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXdDO1FBQ2hGLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLG9CQUFLLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQ2xELFNBQVMsRUFBRSxLQUFLLENBQUMsU0FBUztZQUUxQixxQkFBcUI7WUFDckIsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxVQUFVO2dCQUNoQixJQUFJLEVBQUUsNEJBQWEsQ0FBQyxNQUFNO2FBQzNCO1lBRUQsV0FBVyxFQUFFLDBCQUFXLENBQUMsZUFBZTtZQUV4QyxxQkFBcUI7WUFDckIsbUJBQW1CLEVBQUUsV0FBVztZQUVoQyxhQUFhLEVBQUUsS0FBSyxDQUFDLFdBQVcsS0FBSyxNQUFNO2dCQUN6QyxDQUFDLENBQUMsMkJBQWEsQ0FBQyxNQUFNO2dCQUN0QixDQUFDLENBQUMsMkJBQWEsQ0FBQyxPQUFPO1lBRXpCLG1CQUFtQixFQUFFLEtBQUssQ0FBQyxXQUFXLEtBQUssTUFBTTtZQUNqRCxVQUFVLEVBQUUsOEJBQWUsQ0FBQyxXQUFXO1NBQ3hDLENBQUMsQ0FBQztRQUVILHNCQUFzQjtRQUN0QixJQUFJLENBQUMsS0FBSyxDQUFDLHVCQUF1QixDQUFDO1lBQ2pDLFNBQVMsRUFBRSxhQUFhO1lBQ3hCLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsUUFBUTtnQkFDZCxJQUFJLEVBQUUsNEJBQWEsQ0FBQyxNQUFNO2FBQzNCO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxXQUFXO2dCQUNqQixJQUFJLEVBQUUsNEJBQWEsQ0FBQyxNQUFNO2FBQzNCO1lBQ0QsY0FBYyxFQUFFLDZCQUFjLENBQUMsR0FBRztTQUNuQyxDQUFDLENBQUM7UUFFSCx1QkFBdUI7UUFDdkIsSUFBSSxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQztZQUNqQyxTQUFTLEVBQUUsZUFBZTtZQUMxQixZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLFVBQVU7Z0JBQ2hCLElBQUksRUFBRSw0QkFBYSxDQUFDLE1BQU07YUFDM0I7WUFDRCxPQUFPLEVBQUU7Z0JBQ1AsSUFBSSxFQUFFLFdBQVc7Z0JBQ2pCLElBQUksRUFBRSw0QkFBYSxDQUFDLE1BQU07YUFDM0I7WUFDRCxjQUFjLEVBQUUsNkJBQWMsQ0FBQyxHQUFHO1NBQ25DLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXhERCxvRUF3REMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOWLleeahOioreWumuOCreODo+ODg+OCt+ODpeODhuODvOODluODq+OCs+ODs+OCueODiOODqeOCr+ODiFxuICog44Oi44OH44Or44O744OX44Ot44OQ44Kk44OA44O844O744Oq44O844K444On44Oz5oOF5aCx44Gu5YuV55qE44Kt44Oj44OD44K344Ol55SoRHluYW1vRELjg4bjg7zjg5bjg6tcbiAqL1xuXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IFxuICBUYWJsZSwgXG4gIEF0dHJpYnV0ZVR5cGUsIFxuICBCaWxsaW5nTW9kZSwgXG4gIFByb2plY3Rpb25UeXBlLFxuICBUYWJsZUVuY3J5cHRpb24gXG59IGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgeyBSZW1vdmFsUG9saWN5IH0gZnJvbSAnYXdzLWNkay1saWInO1xuXG5leHBvcnQgaW50ZXJmYWNlIERpc2NvdmVyeUNhY2hlVGFibGVDb25zdHJ1Y3RQcm9wcyB7XG4gIHRhYmxlTmFtZTogc3RyaW5nO1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xufVxuXG4vKipcbiAqIOWLleeahOioreWumuOCreODo+ODg+OCt+ODpeeUqER5bmFtb0RC44OG44O844OW44OrXG4gKiBcbiAqIOapn+iDvTpcbiAqIC0gQmVkcm9ja+ODouODh+ODq+aDheWgseOBruWLleeahOOCreODo+ODg+OCt+ODpVxuICogLSDjg5fjg63jg5DjgqTjg4Djg7zmg4XloLHjga7li5XnmoTnlJ/miJDjg7vjgq3jg6Pjg4Pjgrfjg6VcbiAqIC0g44Oq44O844K444On44Oz5Y+v55So5oCn5oOF5aCx44Gu44Kt44Oj44OD44K344OlXG4gKiAtIFRUTOOBq+OCiOOCi+iHquWLleOCreODo+ODg+OCt+ODpeabtOaWsFxuICovXG5leHBvcnQgY2xhc3MgRGlzY292ZXJ5Q2FjaGVUYWJsZUNvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyByZWFkb25seSB0YWJsZTogVGFibGU7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IERpc2NvdmVyeUNhY2hlVGFibGVDb25zdHJ1Y3RQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICB0aGlzLnRhYmxlID0gbmV3IFRhYmxlKHRoaXMsICdEaXNjb3ZlcnlDYWNoZVRhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBwcm9wcy50YWJsZU5hbWUsXG4gICAgICBcbiAgICAgIC8vIOODkeODvOODhuOCo+OCt+ODp+ODs+OCreODvDog44Kt44Oj44OD44K344Ol44Kt44O8XG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ2NhY2hlS2V5JyxcbiAgICAgICAgdHlwZTogQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBcbiAgICAgIGJpbGxpbmdNb2RlOiBCaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBcbiAgICAgIC8vIFRUTOioreWumu+8iDbmmYLplpPjgafjgq3jg6Pjg4Pjgrfjg6Xmm7TmlrDvvIlcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICdleHBpcmVzQXQnLFxuICAgICAgXG4gICAgICByZW1vdmFsUG9saWN5OiBwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnIFxuICAgICAgICA/IFJlbW92YWxQb2xpY3kuUkVUQUlOIFxuICAgICAgICA6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcblxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJyxcbiAgICAgIGVuY3J5cHRpb246IFRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICB9KTtcblxuICAgIC8vIEdTSTog44Oq44O844K444On44Oz5Yil44Kt44Oj44OD44K344Ol5qSc57Si55SoXG4gICAgdGhpcy50YWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdSZWdpb25JbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3JlZ2lvbicsXG4gICAgICAgIHR5cGU6IEF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnY3JlYXRlZEF0JyxcbiAgICAgICAgdHlwZTogQXR0cmlidXRlVHlwZS5OVU1CRVJcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogUHJvamVjdGlvblR5cGUuQUxMXG4gICAgfSk7XG5cbiAgICAvLyBHU0k6IOODh+ODvOOCv+OCv+OCpOODl+WIpeOCreODo+ODg+OCt+ODpeaknOe0oueUqFxuICAgIHRoaXMudGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnRGF0YVR5cGVJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ2RhdGFUeXBlJyxcbiAgICAgICAgdHlwZTogQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICdjcmVhdGVkQXQnLFxuICAgICAgICB0eXBlOiBBdHRyaWJ1dGVUeXBlLk5VTUJFUlxuICAgICAgfSxcbiAgICAgIHByb2plY3Rpb25UeXBlOiBQcm9qZWN0aW9uVHlwZS5BTExcbiAgICB9KTtcbiAgfVxufSJdfQ==