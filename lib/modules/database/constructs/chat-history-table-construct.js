"use strict";
/**
 * チャット履歴テーブルコンストラクト
 * チャット履歴管理用DynamoDBテーブル
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatHistoryTableConstruct = void 0;
const constructs_1 = require("constructs");
const aws_dynamodb_1 = require("aws-cdk-lib/aws-dynamodb");
const aws_cdk_lib_1 = require("aws-cdk-lib");
/**
 * チャット履歴管理用DynamoDBテーブル
 *
 * 機能:
 * - ユーザー別チャット履歴の管理
 * - 時系列でのチャット検索
 * - メッセージ内容の永続化
 * - 検索・フィルタリング機能のサポート
 */
class ChatHistoryTableConstruct extends constructs_1.Construct {
    table;
    constructor(scope, id, props) {
        super(scope, id);
        this.table = new aws_dynamodb_1.Table(this, 'ChatHistoryTable', {
            tableName: props.tableName,
            // 複合キー: ユーザーID + チャットID
            partitionKey: {
                name: 'userId',
                type: aws_dynamodb_1.AttributeType.STRING
            },
            sortKey: {
                name: 'chatId',
                type: aws_dynamodb_1.AttributeType.STRING
            },
            billingMode: aws_dynamodb_1.BillingMode.PAY_PER_REQUEST,
            removalPolicy: props.environment === 'prod'
                ? aws_cdk_lib_1.RemovalPolicy.RETAIN
                : aws_cdk_lib_1.RemovalPolicy.DESTROY,
            pointInTimeRecovery: props.environment === 'prod',
            encryption: aws_dynamodb_1.TableEncryption.AWS_MANAGED,
        });
        // GSI: 時系列でのチャット検索用
        this.table.addGlobalSecondaryIndex({
            indexName: 'TimeIndex',
            partitionKey: {
                name: 'userId',
                type: aws_dynamodb_1.AttributeType.STRING
            },
            sortKey: {
                name: 'updatedAt',
                type: aws_dynamodb_1.AttributeType.NUMBER
            },
            projectionType: aws_dynamodb_1.ProjectionType.ALL
        });
        // GSI: モデル別チャット検索用
        this.table.addGlobalSecondaryIndex({
            indexName: 'ModelIndex',
            partitionKey: {
                name: 'userId',
                type: aws_dynamodb_1.AttributeType.STRING
            },
            sortKey: {
                name: 'modelId',
                type: aws_dynamodb_1.AttributeType.STRING
            },
            projectionType: aws_dynamodb_1.ProjectionType.KEYS_ONLY
        });
    }
}
exports.ChatHistoryTableConstruct = ChatHistoryTableConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdC1oaXN0b3J5LXRhYmxlLWNvbnN0cnVjdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNoYXQtaGlzdG9yeS10YWJsZS1jb25zdHJ1Y3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7O0FBRUgsMkNBQXVDO0FBQ3ZDLDJEQU1rQztBQUNsQyw2Q0FBNEM7QUFPNUM7Ozs7Ozs7O0dBUUc7QUFDSCxNQUFhLHlCQUEwQixTQUFRLHNCQUFTO0lBQ3RDLEtBQUssQ0FBUTtJQUU3QixZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXFDO1FBQzdFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLG9CQUFLLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQy9DLFNBQVMsRUFBRSxLQUFLLENBQUMsU0FBUztZQUUxQix3QkFBd0I7WUFDeEIsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxRQUFRO2dCQUNkLElBQUksRUFBRSw0QkFBYSxDQUFDLE1BQU07YUFDM0I7WUFDRCxPQUFPLEVBQUU7Z0JBQ1AsSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsSUFBSSxFQUFFLDRCQUFhLENBQUMsTUFBTTthQUMzQjtZQUVELFdBQVcsRUFBRSwwQkFBVyxDQUFDLGVBQWU7WUFFeEMsYUFBYSxFQUFFLEtBQUssQ0FBQyxXQUFXLEtBQUssTUFBTTtnQkFDekMsQ0FBQyxDQUFDLDJCQUFhLENBQUMsTUFBTTtnQkFDdEIsQ0FBQyxDQUFDLDJCQUFhLENBQUMsT0FBTztZQUV6QixtQkFBbUIsRUFBRSxLQUFLLENBQUMsV0FBVyxLQUFLLE1BQU07WUFDakQsVUFBVSxFQUFFLDhCQUFlLENBQUMsV0FBVztTQUN4QyxDQUFDLENBQUM7UUFFSCxvQkFBb0I7UUFDcEIsSUFBSSxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQztZQUNqQyxTQUFTLEVBQUUsV0FBVztZQUN0QixZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsSUFBSSxFQUFFLDRCQUFhLENBQUMsTUFBTTthQUMzQjtZQUNELE9BQU8sRUFBRTtnQkFDUCxJQUFJLEVBQUUsV0FBVztnQkFDakIsSUFBSSxFQUFFLDRCQUFhLENBQUMsTUFBTTthQUMzQjtZQUNELGNBQWMsRUFBRSw2QkFBYyxDQUFDLEdBQUc7U0FDbkMsQ0FBQyxDQUFDO1FBRUgsbUJBQW1CO1FBQ25CLElBQUksQ0FBQyxLQUFLLENBQUMsdUJBQXVCLENBQUM7WUFDakMsU0FBUyxFQUFFLFlBQVk7WUFDdkIsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxRQUFRO2dCQUNkLElBQUksRUFBRSw0QkFBYSxDQUFDLE1BQU07YUFDM0I7WUFDRCxPQUFPLEVBQUU7Z0JBQ1AsSUFBSSxFQUFFLFNBQVM7Z0JBQ2YsSUFBSSxFQUFFLDRCQUFhLENBQUMsTUFBTTthQUMzQjtZQUNELGNBQWMsRUFBRSw2QkFBYyxDQUFDLFNBQVM7U0FDekMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBekRELDhEQXlEQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog44OB44Oj44OD44OI5bGl5q2044OG44O844OW44Or44Kz44Oz44K544OI44Op44Kv44OIXG4gKiDjg4Hjg6Pjg4Pjg4jlsaXmrbTnrqHnkIbnlKhEeW5hbW9EQuODhuODvOODluODq1xuICovXG5cbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgXG4gIFRhYmxlLCBcbiAgQXR0cmlidXRlVHlwZSwgXG4gIEJpbGxpbmdNb2RlLCBcbiAgUHJvamVjdGlvblR5cGUsXG4gIFRhYmxlRW5jcnlwdGlvbiBcbn0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCB7IFJlbW92YWxQb2xpY3kgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2hhdEhpc3RvcnlUYWJsZUNvbnN0cnVjdFByb3BzIHtcbiAgdGFibGVOYW1lOiBzdHJpbmc7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG59XG5cbi8qKlxuICog44OB44Oj44OD44OI5bGl5q20566h55CG55SoRHluYW1vRELjg4bjg7zjg5bjg6tcbiAqIFxuICog5qmf6IO9OlxuICogLSDjg6bjg7zjgrbjg7zliKXjg4Hjg6Pjg4Pjg4jlsaXmrbTjga7nrqHnkIZcbiAqIC0g5pmC57O75YiX44Gn44Gu44OB44Oj44OD44OI5qSc57SiXG4gKiAtIOODoeODg+OCu+ODvOOCuOWGheWuueOBruawuOe2muWMllxuICogLSDmpJzntKLjg7vjg5XjgqPjg6vjgr/jg6rjg7PjgrDmqZ/og73jga7jgrXjg53jg7zjg4hcbiAqL1xuZXhwb3J0IGNsYXNzIENoYXRIaXN0b3J5VGFibGVDb25zdHJ1Y3QgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgdGFibGU6IFRhYmxlO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBDaGF0SGlzdG9yeVRhYmxlQ29uc3RydWN0UHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgdGhpcy50YWJsZSA9IG5ldyBUYWJsZSh0aGlzLCAnQ2hhdEhpc3RvcnlUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogcHJvcHMudGFibGVOYW1lLFxuICAgICAgXG4gICAgICAvLyDopIflkIjjgq3jg7w6IOODpuODvOOCtuODvElEICsg44OB44Oj44OD44OISURcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAndXNlcklkJyxcbiAgICAgICAgdHlwZTogQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICdjaGF0SWQnLFxuICAgICAgICB0eXBlOiBBdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIFxuICAgICAgYmlsbGluZ01vZGU6IEJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIFxuICAgICAgcmVtb3ZhbFBvbGljeTogcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJyBcbiAgICAgICAgPyBSZW1vdmFsUG9saWN5LlJFVEFJTiBcbiAgICAgICAgOiBSZW1vdmFsUG9saWN5LkRFU1RST1ksXG5cbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IHByb3BzLmVudmlyb25tZW50ID09PSAncHJvZCcsXG4gICAgICBlbmNyeXB0aW9uOiBUYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgfSk7XG5cbiAgICAvLyBHU0k6IOaZguezu+WIl+OBp+OBruODgeODo+ODg+ODiOaknOe0oueUqFxuICAgIHRoaXMudGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnVGltZUluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAndXNlcklkJyxcbiAgICAgICAgdHlwZTogQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICd1cGRhdGVkQXQnLFxuICAgICAgICB0eXBlOiBBdHRyaWJ1dGVUeXBlLk5VTUJFUlxuICAgICAgfSxcbiAgICAgIHByb2plY3Rpb25UeXBlOiBQcm9qZWN0aW9uVHlwZS5BTExcbiAgICB9KTtcblxuICAgIC8vIEdTSTog44Oi44OH44Or5Yil44OB44Oj44OD44OI5qSc57Si55SoXG4gICAgdGhpcy50YWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdNb2RlbEluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAndXNlcklkJyxcbiAgICAgICAgdHlwZTogQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICdtb2RlbElkJyxcbiAgICAgICAgdHlwZTogQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogUHJvamVjdGlvblR5cGUuS0VZU19PTkxZXG4gICAgfSk7XG4gIH1cbn0iXX0=