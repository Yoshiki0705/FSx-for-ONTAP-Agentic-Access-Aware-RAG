"use strict";
/**
 * AIスタック（削除予定 - EmbeddingStackに統合）
 *
 * 注意: このスタックは独立したスタックとしては使用されません。
 * Bedrock Agent機能はEmbeddingStackに統合されています。
 *
 * モジュラーアーキテクチャの6つの統合スタック:
 * 1. NetworkingStack - ネットワーク基盤
 * 2. SecurityStack - セキュリティ統合
 * 3. DataStack - データ・ストレージ統合
 * 4. EmbeddingStack - Embedding処理・バッチワークロード・AI統合（Bedrock Agent含む）
 * 5. WebAppStack - API・フロントエンド統合
 * 6. OperationsStack - 監視・エンタープライズ統合
 *
 * @deprecated EmbeddingStackを使用してください
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
exports.AIStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
/**
 * @deprecated このスタックは使用されません。EmbeddingStackを使用してください。
 */
class AIStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // 警告メッセージ
        new cdk.CfnOutput(this, 'DeprecationWarning', {
            value: 'このスタックは非推奨です。EmbeddingStackを使用してください。',
            description: 'Deprecation Warning',
        });
    }
}
exports.AIStack = AIStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWktc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhaS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7OztHQWVHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQVFuQzs7R0FFRztBQUNILE1BQWEsT0FBUSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3BDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBbUI7UUFDM0QsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsVUFBVTtRQUNWLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDNUMsS0FBSyxFQUFFLHVDQUF1QztZQUM5QyxXQUFXLEVBQUUscUJBQXFCO1NBQ25DLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQVZELDBCQVVDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBSeOCueOCv+ODg+OCr++8iOWJiumZpOS6iOWumiAtIEVtYmVkZGluZ1N0YWNr44Gr57Wx5ZCI77yJXG4gKiBcbiAqIOazqOaEjzog44GT44Gu44K544K/44OD44Kv44Gv54us56uL44GX44Gf44K544K/44OD44Kv44Go44GX44Gm44Gv5L2/55So44GV44KM44G+44Gb44KT44CCXG4gKiBCZWRyb2NrIEFnZW505qmf6IO944GvRW1iZWRkaW5nU3RhY2vjgavntbHlkIjjgZXjgozjgabjgYTjgb7jgZnjgIJcbiAqIFxuICog44Oi44K444Ol44Op44O844Ki44O844Kt44OG44Kv44OB44Oj44GuNuOBpOOBrue1seWQiOOCueOCv+ODg+OCrzpcbiAqIDEuIE5ldHdvcmtpbmdTdGFjayAtIOODjeODg+ODiOODr+ODvOOCr+WfuuebpFxuICogMi4gU2VjdXJpdHlTdGFjayAtIOOCu+OCreODpeODquODhuOCo+e1seWQiFxuICogMy4gRGF0YVN0YWNrIC0g44OH44O844K/44O744K544OI44Os44O844K457Wx5ZCIXG4gKiA0LiBFbWJlZGRpbmdTdGFjayAtIEVtYmVkZGluZ+WHpueQhuODu+ODkOODg+ODgeODr+ODvOOCr+ODreODvOODieODu0FJ57Wx5ZCI77yIQmVkcm9jayBBZ2VudOWQq+OCgO+8iVxuICogNS4gV2ViQXBwU3RhY2sgLSBBUEnjg7vjg5Xjg63jg7Pjg4jjgqjjg7Pjg4nntbHlkIhcbiAqIDYuIE9wZXJhdGlvbnNTdGFjayAtIOebo+imluODu+OCqOODs+OCv+ODvOODl+ODqeOCpOOCuue1seWQiFxuICogXG4gKiBAZGVwcmVjYXRlZCBFbWJlZGRpbmdTdGFja+OCkuS9v+eUqOOBl+OBpuOBj+OBoOOBleOBhFxuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBBSVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHByb2plY3ROYW1lOiBzdHJpbmc7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG59XG5cbi8qKlxuICogQGRlcHJlY2F0ZWQg44GT44Gu44K544K/44OD44Kv44Gv5L2/55So44GV44KM44G+44Gb44KT44CCRW1iZWRkaW5nU3RhY2vjgpLkvb/nlKjjgZfjgabjgY/jgaDjgZXjgYTjgIJcbiAqL1xuZXhwb3J0IGNsYXNzIEFJU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQUlTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyDorablkYrjg6Hjg4Pjgrvjg7zjgrhcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGVwcmVjYXRpb25XYXJuaW5nJywge1xuICAgICAgdmFsdWU6ICfjgZPjga7jgrnjgr/jg4Pjgq/jga/pnZ7mjqjlpajjgafjgZnjgIJFbWJlZGRpbmdTdGFja+OCkuS9v+eUqOOBl+OBpuOBj+OBoOOBleOBhOOAgicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0RlcHJlY2F0aW9uIFdhcm5pbmcnLFxuICAgIH0pO1xuICB9XG59XG4iXX0=