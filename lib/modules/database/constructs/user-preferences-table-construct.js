"use strict";
/**
 * ユーザー設定テーブルコンストラクト
 * 設定永続化システム用DynamoDBテーブル
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserPreferencesTableConstruct = void 0;
const constructs_1 = require("constructs");
const aws_dynamodb_1 = require("aws-cdk-lib/aws-dynamodb");
const aws_cdk_lib_1 = require("aws-cdk-lib");
/**
 * ユーザー設定永続化用DynamoDBテーブル
 *
 * 機能:
 * - ユーザーIDとカテゴリによる設定管理
 * - テーマ、言語、リージョン、モデル設定の永続化
 * - カテゴリ別設定の効率的な取得
 */
class UserPreferencesTableConstruct extends constructs_1.Construct {
    table;
    constructor(scope, id, props) {
        super(scope, id);
        this.table = new aws_dynamodb_1.Table(this, 'UserPreferencesTable', {
            tableName: props.tableName,
            // 複合キー: ユーザーID + カテゴリ
            partitionKey: {
                name: 'userId',
                type: aws_dynamodb_1.AttributeType.STRING
            },
            sortKey: {
                name: 'category',
                type: aws_dynamodb_1.AttributeType.STRING
            },
            billingMode: aws_dynamodb_1.BillingMode.PAY_PER_REQUEST,
            removalPolicy: props.environment === 'prod'
                ? aws_cdk_lib_1.RemovalPolicy.RETAIN
                : aws_cdk_lib_1.RemovalPolicy.DESTROY,
            pointInTimeRecovery: props.environment === 'prod',
            encryption: aws_dynamodb_1.TableEncryption.AWS_MANAGED,
        });
        // GSI: カテゴリ別設定の一括取得用
        this.table.addGlobalSecondaryIndex({
            indexName: 'CategoryIndex',
            partitionKey: {
                name: 'category',
                type: aws_dynamodb_1.AttributeType.STRING
            },
            sortKey: {
                name: 'updatedAt',
                type: aws_dynamodb_1.AttributeType.NUMBER
            },
            projectionType: aws_dynamodb_1.ProjectionType.ALL
        });
    }
}
exports.UserPreferencesTableConstruct = UserPreferencesTableConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlci1wcmVmZXJlbmNlcy10YWJsZS1jb25zdHJ1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ1c2VyLXByZWZlcmVuY2VzLXRhYmxlLWNvbnN0cnVjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7QUFFSCwyQ0FBdUM7QUFDdkMsMkRBTWtDO0FBQ2xDLDZDQUE0QztBQU81Qzs7Ozs7OztHQU9HO0FBQ0gsTUFBYSw2QkFBOEIsU0FBUSxzQkFBUztJQUMxQyxLQUFLLENBQVE7SUFFN0IsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF5QztRQUNqRixLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxvQkFBSyxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUNuRCxTQUFTLEVBQUUsS0FBSyxDQUFDLFNBQVM7WUFFMUIsc0JBQXNCO1lBQ3RCLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsUUFBUTtnQkFDZCxJQUFJLEVBQUUsNEJBQWEsQ0FBQyxNQUFNO2FBQzNCO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxVQUFVO2dCQUNoQixJQUFJLEVBQUUsNEJBQWEsQ0FBQyxNQUFNO2FBQzNCO1lBRUQsV0FBVyxFQUFFLDBCQUFXLENBQUMsZUFBZTtZQUV4QyxhQUFhLEVBQUUsS0FBSyxDQUFDLFdBQVcsS0FBSyxNQUFNO2dCQUN6QyxDQUFDLENBQUMsMkJBQWEsQ0FBQyxNQUFNO2dCQUN0QixDQUFDLENBQUMsMkJBQWEsQ0FBQyxPQUFPO1lBRXpCLG1CQUFtQixFQUFFLEtBQUssQ0FBQyxXQUFXLEtBQUssTUFBTTtZQUNqRCxVQUFVLEVBQUUsOEJBQWUsQ0FBQyxXQUFXO1NBQ3hDLENBQUMsQ0FBQztRQUVILHFCQUFxQjtRQUNyQixJQUFJLENBQUMsS0FBSyxDQUFDLHVCQUF1QixDQUFDO1lBQ2pDLFNBQVMsRUFBRSxlQUFlO1lBQzFCLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsVUFBVTtnQkFDaEIsSUFBSSxFQUFFLDRCQUFhLENBQUMsTUFBTTthQUMzQjtZQUNELE9BQU8sRUFBRTtnQkFDUCxJQUFJLEVBQUUsV0FBVztnQkFDakIsSUFBSSxFQUFFLDRCQUFhLENBQUMsTUFBTTthQUMzQjtZQUNELGNBQWMsRUFBRSw2QkFBYyxDQUFDLEdBQUc7U0FDbkMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBM0NELHNFQTJDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog44Om44O844K244O86Kit5a6a44OG44O844OW44Or44Kz44Oz44K544OI44Op44Kv44OIXG4gKiDoqK3lrprmsLjntprljJbjgrfjgrnjg4bjg6DnlKhEeW5hbW9EQuODhuODvOODluODq1xuICovXG5cbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgXG4gIFRhYmxlLCBcbiAgQXR0cmlidXRlVHlwZSwgXG4gIEJpbGxpbmdNb2RlLCBcbiAgUHJvamVjdGlvblR5cGUsXG4gIFRhYmxlRW5jcnlwdGlvbiBcbn0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCB7IFJlbW92YWxQb2xpY3kgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVXNlclByZWZlcmVuY2VzVGFibGVDb25zdHJ1Y3RQcm9wcyB7XG4gIHRhYmxlTmFtZTogc3RyaW5nO1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xufVxuXG4vKipcbiAqIOODpuODvOOCtuODvOioreWumuawuOe2muWMlueUqER5bmFtb0RC44OG44O844OW44OrXG4gKiBcbiAqIOapn+iDvTpcbiAqIC0g44Om44O844K244O8SUTjgajjgqvjg4bjgrTjg6rjgavjgojjgovoqK3lrprnrqHnkIZcbiAqIC0g44OG44O844Oe44CB6KiA6Kqe44CB44Oq44O844K444On44Oz44CB44Oi44OH44Or6Kit5a6a44Gu5rC457aa5YyWXG4gKiAtIOOCq+ODhuOCtOODquWIpeioreWumuOBruWKueeOh+eahOOBquWPluW+l1xuICovXG5leHBvcnQgY2xhc3MgVXNlclByZWZlcmVuY2VzVGFibGVDb25zdHJ1Y3QgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgdGFibGU6IFRhYmxlO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBVc2VyUHJlZmVyZW5jZXNUYWJsZUNvbnN0cnVjdFByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIHRoaXMudGFibGUgPSBuZXcgVGFibGUodGhpcywgJ1VzZXJQcmVmZXJlbmNlc1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBwcm9wcy50YWJsZU5hbWUsXG4gICAgICBcbiAgICAgIC8vIOikh+WQiOOCreODvDog44Om44O844K244O8SUQgKyDjgqvjg4bjgrTjg6pcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAndXNlcklkJyxcbiAgICAgICAgdHlwZTogQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICdjYXRlZ29yeScsXG4gICAgICAgIHR5cGU6IEF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgXG4gICAgICBiaWxsaW5nTW9kZTogQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgXG4gICAgICByZW1vdmFsUG9saWN5OiBwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnIFxuICAgICAgICA/IFJlbW92YWxQb2xpY3kuUkVUQUlOIFxuICAgICAgICA6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcblxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJyxcbiAgICAgIGVuY3J5cHRpb246IFRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICB9KTtcblxuICAgIC8vIEdTSTog44Kr44OG44K044Oq5Yil6Kit5a6a44Gu5LiA5ous5Y+W5b6X55SoXG4gICAgdGhpcy50YWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdDYXRlZ29yeUluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnY2F0ZWdvcnknLFxuICAgICAgICB0eXBlOiBBdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ3VwZGF0ZWRBdCcsXG4gICAgICAgIHR5cGU6IEF0dHJpYnV0ZVR5cGUuTlVNQkVSXG4gICAgICB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IFByb2plY3Rpb25UeXBlLkFMTFxuICAgIH0pO1xuICB9XG59Il19