"use strict";
/**
 * FSx for ONTAP オプショナルコンストラクト
 *
 * 現在のFsxOntapConfigインターフェースに合わせて簡素化
 * 複雑な設定は将来のバージョンで実装予定
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
exports.FSxONTAPOptionalConstruct = void 0;
const constructs_1 = require("constructs");
const fsx = __importStar(require("aws-cdk-lib/aws-fsx"));
const aws_cdk_lib_1 = require("aws-cdk-lib");
/**
 * FSx for ONTAP オプショナルコンストラクト（簡素化版）
 */
class FSxONTAPOptionalConstruct extends constructs_1.Construct {
    fileSystem;
    dnsName;
    constructor(scope, id, props) {
        super(scope, id);
        // FSx機能が無効化されている場合はスキップ
        if (!props.config.enabled) {
            console.log('⏭️  FSx for ONTAP機能が無効化されています');
            return;
        }
        console.log('🗄️ FSx for ONTAPファイルシステム作成開始（簡素化版）...');
        // 基本的なFSx for ONTAPファイルシステムの作成
        if (props.vpc && props.subnetIds && props.subnetIds.length > 0) {
            this.createBasicFsxFileSystem(props);
        }
        else {
            console.log('⚠️  VPCまたはサブネット情報が不足しています。FSx作成をスキップします。');
        }
        console.log('✅ FSx for ONTAPコンストラクト初期化完了');
    }
    createBasicFsxFileSystem(props) {
        // 基本的なFSx for ONTAPファイルシステム
        const fileSystem = new fsx.CfnFileSystem(this, 'FSxONTAPFileSystem', {
            fileSystemType: 'ONTAP',
            storageCapacity: props.config.storageCapacity,
            subnetIds: [props.subnetIds[0]], // 単一AZデプロイメント
            ontapConfiguration: {
                deploymentType: props.config.deploymentType,
                throughputCapacity: props.config.throughputCapacity,
                preferredSubnetId: props.subnetIds[0],
                automaticBackupRetentionDays: props.config.automaticBackupRetentionDays,
                weeklyMaintenanceStartTime: '7:09:00',
                diskIopsConfiguration: {
                    mode: 'AUTOMATIC'
                }
            },
            tags: [
                {
                    key: 'Name',
                    value: `${props.projectName}-${props.environment}-fsx-ontap`
                },
                {
                    key: 'Environment',
                    value: props.environment
                },
                {
                    key: 'Project',
                    value: props.projectName
                },
                ...(props.tags ? Object.entries(props.tags).map(([key, value]) => ({ key, value })) : [])
            ]
        });
        // readonlyプロパティに代入するため、型アサーションを使用
        this.fileSystem = fileSystem;
        this.dnsName = fileSystem.attrDnsName;
        // CloudFormation出力
        new aws_cdk_lib_1.CfnOutput(this, 'FSxONTAPFileSystemId', {
            value: fileSystem.ref,
            description: 'FSx for ONTAP File System ID'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'FSxONTAPDnsName', {
            value: fileSystem.attrDnsName,
            description: 'FSx for ONTAP DNS Name'
        });
        console.log('✅ 基本的なFSx for ONTAPファイルシステム作成完了');
    }
    /**
     * FSx機能が有効かどうかを確認
     */
    isEnabled() {
        return this.fileSystem !== undefined;
    }
    /**
     * 接続情報を取得
     */
    getConnectionInfo() {
        return {
            fileSystemId: this.fileSystem?.ref,
            dnsName: this.dnsName
        };
    }
}
exports.FSxONTAPOptionalConstruct = FSxONTAPOptionalConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnN4LW9udGFwLW9wdGlvbmFsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZnN4LW9udGFwLW9wdGlvbmFsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7R0FLRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCwyQ0FBdUM7QUFDdkMseURBQTJDO0FBRTNDLDZDQUF3QztBQVl4Qzs7R0FFRztBQUNILE1BQWEseUJBQTBCLFNBQVEsc0JBQVM7SUFDdEMsVUFBVSxDQUFxQjtJQUMvQixPQUFPLENBQVU7SUFFakMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE0QjtRQUNwRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLHdCQUF3QjtRQUN4QixJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUMxQixPQUFPLENBQUMsR0FBRyxDQUFDLCtCQUErQixDQUFDLENBQUM7WUFDN0MsT0FBTztRQUNULENBQUM7UUFFRCxPQUFPLENBQUMsR0FBRyxDQUFDLHdDQUF3QyxDQUFDLENBQUM7UUFFdEQsK0JBQStCO1FBQy9CLElBQUksS0FBSyxDQUFDLEdBQUcsSUFBSSxLQUFLLENBQUMsU0FBUyxJQUFJLEtBQUssQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQy9ELElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN2QyxDQUFDO2FBQU0sQ0FBQztZQUNOLE9BQU8sQ0FBQyxHQUFHLENBQUMsMENBQTBDLENBQUMsQ0FBQztRQUMxRCxDQUFDO1FBRUQsT0FBTyxDQUFDLEdBQUcsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFTyx3QkFBd0IsQ0FBQyxLQUE0QjtRQUMzRCw0QkFBNEI7UUFDNUIsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUNuRSxjQUFjLEVBQUUsT0FBTztZQUN2QixlQUFlLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxlQUFlO1lBQzdDLFNBQVMsRUFBRSxDQUFDLEtBQUssQ0FBQyxTQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxjQUFjO1lBRWhELGtCQUFrQixFQUFFO2dCQUNsQixjQUFjLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxjQUE4QztnQkFDM0Usa0JBQWtCLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxrQkFBa0I7Z0JBQ25ELGlCQUFpQixFQUFFLEtBQUssQ0FBQyxTQUFVLENBQUMsQ0FBQyxDQUFDO2dCQUN0Qyw0QkFBNEIsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLDRCQUE0QjtnQkFDdkUsMEJBQTBCLEVBQUUsU0FBUztnQkFDckMscUJBQXFCLEVBQUU7b0JBQ3JCLElBQUksRUFBRSxXQUFXO2lCQUNsQjthQUNGO1lBRUQsSUFBSSxFQUFFO2dCQUNKO29CQUNFLEdBQUcsRUFBRSxNQUFNO29CQUNYLEtBQUssRUFBRSxHQUFHLEtBQUssQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDLFdBQVcsWUFBWTtpQkFDN0Q7Z0JBQ0Q7b0JBQ0UsR0FBRyxFQUFFLGFBQWE7b0JBQ2xCLEtBQUssRUFBRSxLQUFLLENBQUMsV0FBVztpQkFDekI7Z0JBQ0Q7b0JBQ0UsR0FBRyxFQUFFLFNBQVM7b0JBQ2QsS0FBSyxFQUFFLEtBQUssQ0FBQyxXQUFXO2lCQUN6QjtnQkFDRCxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7YUFDMUY7U0FDRixDQUFDLENBQUM7UUFFSCxrQ0FBa0M7UUFDakMsSUFBWSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7UUFDckMsSUFBWSxDQUFDLE9BQU8sR0FBRyxVQUFVLENBQUMsV0FBVyxDQUFDO1FBRS9DLG1CQUFtQjtRQUNuQixJQUFJLHVCQUFTLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQzFDLEtBQUssRUFBRSxVQUFVLENBQUMsR0FBRztZQUNyQixXQUFXLEVBQUUsOEJBQThCO1NBQzVDLENBQUMsQ0FBQztRQUVILElBQUksdUJBQVMsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDckMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxXQUFXO1lBQzdCLFdBQVcsRUFBRSx3QkFBd0I7U0FDdEMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO0lBQ2pELENBQUM7SUFFRDs7T0FFRztJQUNJLFNBQVM7UUFDZCxPQUFPLElBQUksQ0FBQyxVQUFVLEtBQUssU0FBUyxDQUFDO0lBQ3ZDLENBQUM7SUFFRDs7T0FFRztJQUNJLGlCQUFpQjtRQUl0QixPQUFPO1lBQ0wsWUFBWSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsR0FBRztZQUNsQyxPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU87U0FDdEIsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQWpHRCw4REFpR0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEZTeCBmb3IgT05UQVAg44Kq44OX44K344On44OK44Or44Kz44Oz44K544OI44Op44Kv44OIXG4gKiBcbiAqIOePvuWcqOOBrkZzeE9udGFwQ29uZmln44Kk44Oz44K/44O844OV44Kn44O844K544Gr5ZCI44KP44Gb44Gm57Ch57Sg5YyWXG4gKiDopIfpm5HjgaroqK3lrprjga/lsIbmnaXjga7jg5Djg7zjgrjjg6fjg7Pjgaflrp/oo4XkuojlrppcbiAqL1xuXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGZzeCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZnN4JztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCB7IENmbk91dHB1dCB9IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IEZzeE9udGFwQ29uZmlnIH0gZnJvbSAnLi4vLi4vLi4vY29uZmlnL2ludGVyZmFjZXMvZW52aXJvbm1lbnQtY29uZmlnJztcblxuZXhwb3J0IGludGVyZmFjZSBGU3hPTlRBUE9wdGlvbmFsUHJvcHMge1xuICByZWFkb25seSBjb25maWc6IEZzeE9udGFwQ29uZmlnO1xuICByZWFkb25seSBwcm9qZWN0TmFtZTogc3RyaW5nO1xuICByZWFkb25seSBlbnZpcm9ubWVudDogc3RyaW5nO1xuICByZWFkb25seSB2cGM/OiBlYzIuSVZwYztcbiAgcmVhZG9ubHkgc3VibmV0SWRzPzogc3RyaW5nW107XG4gIHJlYWRvbmx5IHRhZ3M/OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9O1xufVxuXG4vKipcbiAqIEZTeCBmb3IgT05UQVAg44Kq44OX44K344On44OK44Or44Kz44Oz44K544OI44Op44Kv44OI77yI57Ch57Sg5YyW54mI77yJXG4gKi9cbmV4cG9ydCBjbGFzcyBGU3hPTlRBUE9wdGlvbmFsQ29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IGZpbGVTeXN0ZW0/OiBmc3guQ2ZuRmlsZVN5c3RlbTtcbiAgcHVibGljIHJlYWRvbmx5IGRuc05hbWU/OiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEZTeE9OVEFQT3B0aW9uYWxQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyBGU3jmqZ/og73jgYznhKHlirnljJbjgZXjgozjgabjgYTjgovloLTlkIjjga/jgrnjgq3jg4Pjg5dcbiAgICBpZiAoIXByb3BzLmNvbmZpZy5lbmFibGVkKSB7XG4gICAgICBjb25zb2xlLmxvZygn4o+t77iPICBGU3ggZm9yIE9OVEFQ5qmf6IO944GM54Sh5Yq55YyW44GV44KM44Gm44GE44G+44GZJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ/Cfl4TvuI8gRlN4IGZvciBPTlRBUOODleOCoeOCpOODq+OCt+OCueODhuODoOS9nOaIkOmWi+Wni++8iOewoee0oOWMlueJiO+8iS4uLicpO1xuXG4gICAgLy8g5Z+65pys55qE44GqRlN4IGZvciBPTlRBUOODleOCoeOCpOODq+OCt+OCueODhuODoOOBruS9nOaIkFxuICAgIGlmIChwcm9wcy52cGMgJiYgcHJvcHMuc3VibmV0SWRzICYmIHByb3BzLnN1Ym5ldElkcy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLmNyZWF0ZUJhc2ljRnN4RmlsZVN5c3RlbShwcm9wcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCfimqDvuI8gIFZQQ+OBvuOBn+OBr+OCteODluODjeODg+ODiOaDheWgseOBjOS4jei2s+OBl+OBpuOBhOOBvuOBmeOAgkZTeOS9nOaIkOOCkuOCueOCreODg+ODl+OBl+OBvuOBmeOAgicpO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCfinIUgRlN4IGZvciBPTlRBUOOCs+ODs+OCueODiOODqeOCr+ODiOWIneacn+WMluWujOS6hicpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVCYXNpY0ZzeEZpbGVTeXN0ZW0ocHJvcHM6IEZTeE9OVEFQT3B0aW9uYWxQcm9wcyk6IHZvaWQge1xuICAgIC8vIOWfuuacrOeahOOBqkZTeCBmb3IgT05UQVDjg5XjgqHjgqTjg6vjgrfjgrnjg4bjg6BcbiAgICBjb25zdCBmaWxlU3lzdGVtID0gbmV3IGZzeC5DZm5GaWxlU3lzdGVtKHRoaXMsICdGU3hPTlRBUEZpbGVTeXN0ZW0nLCB7XG4gICAgICBmaWxlU3lzdGVtVHlwZTogJ09OVEFQJyxcbiAgICAgIHN0b3JhZ2VDYXBhY2l0eTogcHJvcHMuY29uZmlnLnN0b3JhZ2VDYXBhY2l0eSxcbiAgICAgIHN1Ym5ldElkczogW3Byb3BzLnN1Ym5ldElkcyFbMF1dLCAvLyDljZjkuIBBWuODh+ODl+ODreOCpOODoeODs+ODiFxuXG4gICAgICBvbnRhcENvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgZGVwbG95bWVudFR5cGU6IHByb3BzLmNvbmZpZy5kZXBsb3ltZW50VHlwZSBhcyAnU0lOR0xFX0FaXzEnIHwgJ01VTFRJX0FaXzEnLFxuICAgICAgICB0aHJvdWdocHV0Q2FwYWNpdHk6IHByb3BzLmNvbmZpZy50aHJvdWdocHV0Q2FwYWNpdHksXG4gICAgICAgIHByZWZlcnJlZFN1Ym5ldElkOiBwcm9wcy5zdWJuZXRJZHMhWzBdLFxuICAgICAgICBhdXRvbWF0aWNCYWNrdXBSZXRlbnRpb25EYXlzOiBwcm9wcy5jb25maWcuYXV0b21hdGljQmFja3VwUmV0ZW50aW9uRGF5cyxcbiAgICAgICAgd2Vla2x5TWFpbnRlbmFuY2VTdGFydFRpbWU6ICc3OjA5OjAwJyxcbiAgICAgICAgZGlza0lvcHNDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgbW9kZTogJ0FVVE9NQVRJQydcbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgdGFnczogW1xuICAgICAgICB7XG4gICAgICAgICAga2V5OiAnTmFtZScsXG4gICAgICAgICAgdmFsdWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1mc3gtb250YXBgXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBrZXk6ICdFbnZpcm9ubWVudCcsXG4gICAgICAgICAgdmFsdWU6IHByb3BzLmVudmlyb25tZW50XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBrZXk6ICdQcm9qZWN0JyxcbiAgICAgICAgICB2YWx1ZTogcHJvcHMucHJvamVjdE5hbWVcbiAgICAgICAgfSxcbiAgICAgICAgLi4uKHByb3BzLnRhZ3MgPyBPYmplY3QuZW50cmllcyhwcm9wcy50YWdzKS5tYXAoKFtrZXksIHZhbHVlXSkgPT4gKHsga2V5LCB2YWx1ZSB9KSkgOiBbXSlcbiAgICAgIF1cbiAgICB9KTtcblxuICAgIC8vIHJlYWRvbmx544OX44Ot44OR44OG44Kj44Gr5Luj5YWl44GZ44KL44Gf44KB44CB5Z6L44Ki44K144O844K344On44Oz44KS5L2/55SoXG4gICAgKHRoaXMgYXMgYW55KS5maWxlU3lzdGVtID0gZmlsZVN5c3RlbTtcbiAgICAodGhpcyBhcyBhbnkpLmRuc05hbWUgPSBmaWxlU3lzdGVtLmF0dHJEbnNOYW1lO1xuXG4gICAgLy8gQ2xvdWRGb3JtYXRpb27lh7rliptcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdGU3hPTlRBUEZpbGVTeXN0ZW1JZCcsIHtcbiAgICAgIHZhbHVlOiBmaWxlU3lzdGVtLnJlZixcbiAgICAgIGRlc2NyaXB0aW9uOiAnRlN4IGZvciBPTlRBUCBGaWxlIFN5c3RlbSBJRCdcbiAgICB9KTtcblxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ0ZTeE9OVEFQRG5zTmFtZScsIHtcbiAgICAgIHZhbHVlOiBmaWxlU3lzdGVtLmF0dHJEbnNOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdGU3ggZm9yIE9OVEFQIEROUyBOYW1lJ1xuICAgIH0pO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSDln7rmnKznmoTjgapGU3ggZm9yIE9OVEFQ44OV44Kh44Kk44Or44K344K544OG44Og5L2c5oiQ5a6M5LqGJyk7XG4gIH1cblxuICAvKipcbiAgICogRlN45qmf6IO944GM5pyJ5Yq544GL44Gp44GG44GL44KS56K66KqNXG4gICAqL1xuICBwdWJsaWMgaXNFbmFibGVkKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmZpbGVTeXN0ZW0gIT09IHVuZGVmaW5lZDtcbiAgfVxuXG4gIC8qKlxuICAgKiDmjqXntprmg4XloLHjgpLlj5blvpdcbiAgICovXG4gIHB1YmxpYyBnZXRDb25uZWN0aW9uSW5mbygpOiB7XG4gICAgZmlsZVN5c3RlbUlkPzogc3RyaW5nO1xuICAgIGRuc05hbWU/OiBzdHJpbmc7XG4gIH0ge1xuICAgIHJldHVybiB7XG4gICAgICBmaWxlU3lzdGVtSWQ6IHRoaXMuZmlsZVN5c3RlbT8ucmVmLFxuICAgICAgZG5zTmFtZTogdGhpcy5kbnNOYW1lXG4gICAgfTtcbiAgfVxufSJdfQ==