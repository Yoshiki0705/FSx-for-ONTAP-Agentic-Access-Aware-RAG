#!/usr/bin/env node
"use strict";
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
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
/**
 * 最小限のCDKアプリケーション
 * エラーのないスタックのみを含む
 */
const app = new cdk.App();
// 環境設定
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT || '123456789012',
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1'
};
console.log('🚀 最小限のCDKアプリケーション初期化...');
console.log(`   アカウント: ${env.account}`);
console.log(`   リージョン: ${env.region}`);
// 空のスタック（テンプレート生成テスト用）
class MinimalStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // 最小限のリソース: S3バケット
        const bucket = new cdk.aws_s3.Bucket(this, 'TestBucket', {
            bucketName: `minimal-test-${env.account}-${env.region}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true
        });
        // 出力
        new cdk.CfnOutput(this, 'BucketName', {
            value: bucket.bucketName,
            description: 'Test bucket name'
        });
    }
}
// スタック作成
new MinimalStack(app, 'MinimalTestStack', { env });
console.log('✅ 最小限のCDKアプリケーション初期化完了');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWluaW1hbC1hcHAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJtaW5pbWFsLWFwcC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFFbkM7OztHQUdHO0FBRUgsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsT0FBTztBQUNQLE1BQU0sR0FBRyxHQUFHO0lBQ1YsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLElBQUksY0FBYztJQUMxRCxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxnQkFBZ0I7Q0FDM0QsQ0FBQztBQUVGLE9BQU8sQ0FBQyxHQUFHLENBQUMsMEJBQTBCLENBQUMsQ0FBQztBQUN4QyxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDeEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBRXZDLHVCQUF1QjtBQUN2QixNQUFNLFlBQWEsU0FBUSxHQUFHLENBQUMsS0FBSztJQUNsQyxZQUFZLEtBQWMsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDNUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsbUJBQW1CO1FBQ25CLE1BQU0sTUFBTSxHQUFHLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUN2RCxVQUFVLEVBQUUsZ0JBQWdCLEdBQUcsQ0FBQyxPQUFPLElBQUksR0FBRyxDQUFDLE1BQU0sRUFBRTtZQUN2RCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1lBQ3hDLGlCQUFpQixFQUFFLElBQUk7U0FDeEIsQ0FBQyxDQUFDO1FBRUgsS0FBSztRQUNMLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ3BDLEtBQUssRUFBRSxNQUFNLENBQUMsVUFBVTtZQUN4QixXQUFXLEVBQUUsa0JBQWtCO1NBQ2hDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQUVELFNBQVM7QUFDVCxJQUFJLFlBQVksQ0FBQyxHQUFHLEVBQUUsa0JBQWtCLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0FBRW5ELE9BQU8sQ0FBQyxHQUFHLENBQUMsd0JBQXdCLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5cbi8qKlxuICog5pyA5bCP6ZmQ44GuQ0RL44Ki44OX44Oq44Kx44O844K344On44OzXG4gKiDjgqjjg6njg7zjga7jgarjgYTjgrnjgr/jg4Pjgq/jga7jgb/jgpLlkKvjgoBcbiAqL1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG4vLyDnkrDlooPoqK3lrppcbmNvbnN0IGVudiA9IHtcbiAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCB8fCAnMTIzNDU2Nzg5MDEyJyxcbiAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgJ2FwLW5vcnRoZWFzdC0xJ1xufTtcblxuY29uc29sZS5sb2coJ/CfmoAg5pyA5bCP6ZmQ44GuQ0RL44Ki44OX44Oq44Kx44O844K344On44Oz5Yid5pyf5YyWLi4uJyk7XG5jb25zb2xlLmxvZyhgICAg44Ki44Kr44Km44Oz44OIOiAke2Vudi5hY2NvdW50fWApO1xuY29uc29sZS5sb2coYCAgIOODquODvOOCuOODp+ODszogJHtlbnYucmVnaW9ufWApO1xuXG4vLyDnqbrjga7jgrnjgr/jg4Pjgq/vvIjjg4bjg7Pjg5fjg6zjg7zjg4jnlJ/miJDjg4bjgrnjg4jnlKjvvIlcbmNsYXNzIE1pbmltYWxTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQXBwLCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG4gICAgXG4gICAgLy8g5pyA5bCP6ZmQ44Gu44Oq44K944O844K5OiBTM+ODkOOCseODg+ODiFxuICAgIGNvbnN0IGJ1Y2tldCA9IG5ldyBjZGsuYXdzX3MzLkJ1Y2tldCh0aGlzLCAnVGVzdEJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBtaW5pbWFsLXRlc3QtJHtlbnYuYWNjb3VudH0tJHtlbnYucmVnaW9ufWAsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWVcbiAgICB9KTtcbiAgICBcbiAgICAvLyDlh7rliptcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiBidWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVGVzdCBidWNrZXQgbmFtZSdcbiAgICB9KTtcbiAgfVxufVxuXG4vLyDjgrnjgr/jg4Pjgq/kvZzmiJBcbm5ldyBNaW5pbWFsU3RhY2soYXBwLCAnTWluaW1hbFRlc3RTdGFjaycsIHsgZW52IH0pO1xuXG5jb25zb2xlLmxvZygn4pyFIOacgOWwj+mZkOOBrkNES+OCouODl+ODquOCseODvOOCt+ODp+ODs+WIneacn+WMluWujOS6hicpO1xuIl19