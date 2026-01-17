"use strict";
/**
 * FSx for NetApp ONTAP SMB/CIFS統合レイヤー実装
 * Active Directory統合とWindows EC2アクセス機能の維持
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
exports.SMBCIFSIntegrationLayer = void 0;
const constructs_1 = require("constructs");
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const ssm = __importStar(require("aws-cdk-lib/aws-ssm"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const directoryservice = __importStar(require("aws-cdk-lib/aws-directoryservice"));
/**
 * SMB/CIFS統合レイヤークラス
 */
class SMBCIFSIntegrationLayer extends constructs_1.Construct {
    /** Active Directory */
    activeDirectory;
    /** Windows EC2インスタンス */
    windowsInstance;
    /** SMB認証設定 */
    smbAuthConfig;
    /** セキュリティグループ */
    securityGroup;
    constructor(scope, id, props) {
        super(scope, id);
        this.smbAuthConfig = props.smbAuthConfig;
        // セキュリティグループの作成
        this.securityGroup = this.createSecurityGroup(props.vpc);
        // Active Directoryの設定
        if (!props.adConfig.useExistingAD) {
            this.activeDirectory = this.createActiveDirectory(props.vpc, props.adConfig);
        }
        // Windows EC2インスタンスの作成（オプション）
        if (props.createWindowsInstance && props.windowsConfig) {
            this.windowsInstance = this.createWindowsInstance(props.vpc, props.windowsConfig, props.adConfig);
        }
        // SMB認証情報の保存
        this.storeSMBCredentials(props.smbAuthConfig);
        // SMB/CIFSマウントスクリプトの生成
        this.createSMBMountScripts(props.adConfig);
        // 出力の作成
        this.createOutputs(props.adConfig);
    }
    /**
     * セキュリティグループの作成
     */
    createSecurityGroup(vpc) {
        const securityGroup = new ec2.SecurityGroup(this, 'SMBSecurityGroup', {
            vpc,
            description: 'SMB/CIFS統合レイヤー用セキュリティグループ',
            allowAllOutbound: true
        });
        // SMB/CIFS用ポート（445）
        securityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(445), 'SMB/CIFS アクセス用');
        // NetBIOS用ポート（137-139）
        securityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcpRange(137, 139), 'NetBIOS アクセス用');
        // Active Directory用ポート
        const adPorts = [53, 88, 135, 389, 445, 464, 636, 3268, 3269];
        adPorts.forEach(port => {
            securityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(port), `Active Directory ポート ${port}`);
        });
        return securityGroup;
    }
    /**
     * Active Directoryの作成
     */
    createActiveDirectory(vpc, config) {
        const subnets = vpc.privateSubnets.slice(0, 2).map(subnet => subnet.subnetId);
        return new directoryservice.CfnMicrosoftAD(this, 'ActiveDirectory', {
            name: config.domainName,
            password: config.adminPassword.unsafeUnwrap(),
            vpcSettings: {
                subnetIds: subnets,
                vpcId: vpc.vpcId
            },
            edition: 'Standard',
            shortName: config.netBiosName,
            description: 'FSx ONTAP統合用Active Directory'
        });
    }
    /**
     * Windows EC2インスタンスの作成
     */
    createWindowsInstance(vpc, config, adConfig) {
        const windowsAmi = config.amiId
            ? ec2.MachineImage.genericWindows({ 'us-east-1': config.amiId })
            : ec2.MachineImage.latestWindows(ec2.WindowsVersion.WINDOWS_SERVER_2022_JAPANESE_FULL_BASE);
        const userData = this.generateWindowsUserData(config, adConfig);
        return new ec2.Instance(this, 'WindowsInstance', {
            vpc,
            instanceType: config.instanceType,
            machineImage: windowsAmi,
            securityGroup: this.securityGroup,
            keyName: config.keyPairName,
            userData: userData,
            role: this.createWindowsInstanceRole(),
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
            }
        });
    }
    /**
     * Windows EC2用IAMロールの作成
     */
    createWindowsInstanceRole() {
        const role = new iam.Role(this, 'WindowsInstanceRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            description: 'Windows EC2インスタンス用IAMロール',
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMDirectoryServiceAccess')
            ]
        });
        // Secrets Manager読み取り権限
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'secretsmanager:GetSecretValue',
                'secretsmanager:DescribeSecret'
            ],
            resources: ['*']
        }));
        return role;
    }
    /**
     * Windows User Dataスクリプトの生成
     */
    generateWindowsUserData(config, adConfig) {
        const userData = ec2.UserData.forWindows();
        userData.addCommands('# FSx ONTAP SMB/CIFS統合 - Windows EC2セットアップスクリプト', 'Write-Output "FSx ONTAP SMB/CIFS統合セットアップ開始"', '', '# 必要な機能の有効化', 'Enable-WindowsOptionalFeature -Online -FeatureName "SMB1Protocol" -All -NoRestart', '', '# FSx SMBマウント用スクリプトの作成', 'New-Item -ItemType Directory -Path "C:\\Scripts" -Force | Out-Null', '$MountScript = @"', 'param([string]$FSxDNSName, [string]$ShareName = "documents", [string]$DriveLetter = "Z")', 'try {', '    if (Get-PSDrive -Name $DriveLetter -ErrorAction SilentlyContinue) {', '        Remove-PSDrive -Name $DriveLetter -Force', '    }', '    $UNCPath = "\\\\$FSxDNSName\\$ShareName"', '    New-PSDrive -Name $DriveLetter -PSProvider FileSystem -Root $UNCPath -Persist', '    Write-Output "SMB共有マッピング完了: $DriveLetter -> $UNCPath"', '} catch {', '    Write-Error "SMB共有マッピングエラー: $($_.Exception.Message)"', '}', '"@', '$MountScript | Out-File -FilePath "C:\\Scripts\\Mount-FSxSMB.ps1" -Encoding UTF8', '', 'Write-Output "FSx ONTAP SMB/CIFS統合セットアップ完了"');
        return userData;
    }
    /**
     * SMB認証情報の保存
     */
    storeSMBCredentials(config) {
        new secretsmanager.Secret(this, 'SMBCredentials', {
            secretName: 'fsx-ontap/smb-credentials',
            description: 'FSx ONTAP SMB/CIFS認証情報',
            secretObjectValue: {
                username: config.domainUsername,
                password: config.domainPassword,
                serviceUsername: config.serviceAccount.username,
                servicePassword: config.serviceAccount.password
            }
        });
    }
    /**
     * SMB/CIFSマウントスクリプトの生成
     */
    createSMBMountScripts(adConfig) {
        const linuxSMBScript = this.generateLinuxSMBScript(adConfig);
        new ssm.StringParameter(this, 'LinuxSMBMountScript', {
            parameterName: '/fsx-ontap/smb/linux-mount-script',
            stringValue: linuxSMBScript,
            description: 'Linux用SMB/CIFSマウントスクリプト',
            tier: ssm.ParameterTier.ADVANCED
        });
        const windowsSMBScript = this.generateWindowsSMBScript();
        new ssm.StringParameter(this, 'WindowsSMBMountScript', {
            parameterName: '/fsx-ontap/smb/windows-mount-script',
            stringValue: windowsSMBScript,
            description: 'Windows用SMB/CIFSマウントスクリプト',
            tier: ssm.ParameterTier.ADVANCED
        });
    }
    /**
     * Linux用SMBマウントスクリプトの生成
     */
    generateLinuxSMBScript(adConfig) {
        return `#!/bin/bash
# FSx ONTAP SMB/CIFS マウントスクリプト（Linux用）
set -e
echo "=== FSx ONTAP SMB/CIFS マウント開始 ==="

DOMAIN_NAME="${adConfig.domainName}"
FSX_DNS_NAME="\${FSX_DNS_NAME:-}"
SHARE_NAME="\${SHARE_NAME:-documents}"
MOUNT_POINT="\${MOUNT_POINT:-/mnt/documents}"
CREDENTIALS_FILE="/etc/cifs-credentials"

# 必要なパッケージのインストール
sudo apt-get update -q
sudo apt-get install -y cifs-utils krb5-user jq

# 認証情報の取得
SECRET_VALUE=$(aws secretsmanager get-secret-value --secret-id "fsx-ontap/smb-credentials" --query SecretString --output text)
USERNAME=$(echo $SECRET_VALUE | jq -r .username)
PASSWORD=$(echo $SECRET_VALUE | jq -r .password)

# 認証情報ファイルの作成
sudo tee $CREDENTIALS_FILE > /dev/null << EOF
username=$USERNAME
password=$PASSWORD
domain=$DOMAIN_NAME
EOF`;
        return script;
    }
}
exports.SMBCIFSIntegrationLayer = SMBCIFSIntegrationLayer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic21iX2NpZnNfaW50ZWdyYXRpb25fbGF5ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzbWJfY2lmc19pbnRlZ3JhdGlvbl9sYXllci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDJDQUF1QztBQUV2Qyx5REFBMkM7QUFDM0MseURBQTJDO0FBQzNDLHlEQUEyQztBQUMzQywrRUFBaUU7QUFDakUsbUZBQXFFO0FBNkRyRTs7R0FFRztBQUNILE1BQWEsdUJBQXdCLFNBQVEsc0JBQVM7SUFDcEQsdUJBQXVCO0lBQ1AsZUFBZSxDQUFtQztJQUNsRSx3QkFBd0I7SUFDUixlQUFlLENBQWdCO0lBQy9DLGNBQWM7SUFDRSxhQUFhLENBQWdCO0lBQzdDLGlCQUFpQjtJQUNELGFBQWEsQ0FBb0I7SUFFakQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQU16QztRQUNDLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsSUFBSSxDQUFDLGFBQWEsR0FBRyxLQUFLLENBQUMsYUFBYSxDQUFDO1FBRXpDLGdCQUFnQjtRQUNoQixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFekQsc0JBQXNCO1FBQ3RCLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ2xDLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQy9FLENBQUM7UUFFRCw4QkFBOEI7UUFDOUIsSUFBSSxLQUFLLENBQUMscUJBQXFCLElBQUksS0FBSyxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3ZELElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUMv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QUNoRDtTQUNGLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNLLHFCQUFxQixDQUFDLFFBQStCO1FBQzNELE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUU3RCxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQ25ELGFBQWEsRUFBRSxtQ0FBbUM7WUFDbEQsV0FBVyxFQUFFLGNBQWM7WUFDM0IsV0FBVyxFQUFFLHlCQUF5QjtZQUN0QyxJQUFJLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxRQUFRO1NBQ2pDLENBQUMsQ0FBQztRQUVILE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLHdCQUF3QixFQUFFLENBQUM7UUFFekQsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUNyRCxhQUFhLEVBQUUscUNBQXFDO1lBQ3BELFdBQVcsRUFBRSxnQkFBZ0I7WUFDN0IsV0FBVyxFQUFFLDJCQUEyQjtZQUN4QyxJQUFJLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxRQUFRO1NBQ2pDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNLLHNCQUFzQixDQUFDLFFBQStCO1FBQzVELE9BQU87Ozs7O2VBS0ksUUFBUSxDQUFDLFVBQVU7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBb0I5QixDQUFDO1FBRUQsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztDQUNGO0FBaFJELDBEQWdSQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRlN4IGZvciBOZXRBcHAgT05UQVAgU01CL0NJRlPntbHlkIjjg6zjgqTjg6Tjg7zlrp/oo4VcbiAqIEFjdGl2ZSBEaXJlY3RvcnnntbHlkIjjgahXaW5kb3dzIEVDMuOCouOCr+OCu+OCueapn+iDveOBrue2reaMgVxuICovXG5cbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgU3RhY2ssIER1cmF0aW9uLCBDZm5PdXRwdXQsIFNlY3JldFZhbHVlIH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgc3NtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zc20nO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGRpcmVjdG9yeXNlcnZpY2UgZnJvbSAnYXdzLWNkay1saWIvYXdzLWRpcmVjdG9yeXNlcnZpY2UnO1xuXG4vKipcbiAqIEFjdGl2ZSBEaXJlY3RvcnnoqK3lrppcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBBY3RpdmVEaXJlY3RvcnlDb25maWcge1xuICAvKiog44OJ44Oh44Kk44Oz5ZCNICovXG4gIGRvbWFpbk5hbWU6IHN0cmluZztcbiAgLyoqIE5ldEJJT1PlkI0gKi9cbiAgbmV0Qmlvc05hbWU6IHN0cmluZztcbiAgLyoqIOeuoeeQhuiAheODkeOCueODr+ODvOODiSAqL1xuICBhZG1pblBhc3N3b3JkOiBTZWNyZXRWYWx1ZTtcbiAgLyoqIEROUyBJUOOCouODieODrOOCuSAqL1xuICBkbnNJcEFkZHJlc3Nlczogc3RyaW5nW107XG4gIC8qKiDntYTnuZTljZjkvY3vvIhPVe+8iSAqL1xuICBvcmdhbml6YXRpb25hbFVuaXQ/OiBzdHJpbmc7XG4gIC8qKiDjg5XjgqHjgqTjg6vjgrfjgrnjg4bjg6DnrqHnkIbogIXjgrDjg6vjg7zjg5cgKi9cbiAgZmlsZVN5c3RlbUFkbWluaXN0cmF0b3JzR3JvdXA6IHN0cmluZztcbiAgLyoqIOaXouWtmEFE44Gu5L2/55SoICovXG4gIHVzZUV4aXN0aW5nQUQ6IGJvb2xlYW47XG4gIC8qKiDml6LlrZhBRCBJRO+8iOS9v+eUqOOBmeOCi+WgtOWQiO+8iSAqL1xuICBleGlzdGluZ0RpcmVjdG9yeUlkPzogc3RyaW5nO1xufVxuXG4vKipcbiAqIFNNQi9DSUZT6KqN6Ki86Kit5a6aXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU01CQXV0aENvbmZpZyB7XG4gIC8qKiDjg4njg6HjgqTjg7Pjg6bjg7zjgrbjg7zlkI0gKi9cbiAgZG9tYWluVXNlcm5hbWU6IHN0cmluZztcbiAgLyoqIOODieODoeOCpOODs+ODkeOCueODr+ODvOODiSAqL1xuICBkb21haW5QYXNzd29yZDogU2VjcmV0VmFsdWU7XG4gIC8qKiDjgrXjg7zjg5PjgrnjgqLjgqvjgqbjg7Pjg4ggKi9cbiAgc2VydmljZUFjY291bnQ6IHtcbiAgICB1c2VybmFtZTogc3RyaW5nO1xuICAgIHBhc3N3b3JkOiBTZWNyZXRWYWx1ZTtcbiAgfTtcbiAgLyoqIEtlcmJlcm9z6Kit5a6aICovXG4gIGtlcmJlcm9zQ29uZmlnPzoge1xuICAgIHJlYWxtOiBzdHJpbmc7XG4gICAga2RjU2VydmVyOiBzdHJpbmc7XG4gICAgYWRtaW5TZXJ2ZXI6IHN0cmluZztcbiAgfTtcbn1cblxuLyoqXG4gKiBXaW5kb3dzIEVDMuioreWumlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFdpbmRvd3NFQzJDb25maWcge1xuICAvKiog44Kk44Oz44K544K/44Oz44K544K/44Kk44OXICovXG4gIGluc3RhbmNlVHlwZTogZWMyLkluc3RhbmNlVHlwZTtcbiAgLyoqIEFNSSBJRCAqL1xuICBhbWlJZD86IHN0cmluZztcbiAgLyoqIOOCreODvOODmuOCouWQjSAqL1xuICBrZXlQYWlyTmFtZTogc3RyaW5nO1xuICAvKiog6Ieq5YuV44OJ44Oh44Kk44Oz5Y+C5YqgICovXG4gIGF1dG9Kb2luRG9tYWluOiBib29sZWFuO1xuICAvKiog566h55CG6ICF44OR44K544Ov44O844OJICovXG4gIGFkbWluUGFzc3dvcmQ6IFNlY3JldFZhbHVlO1xufVxuXG4vKipcbiAqIFNNQi9DSUZT57Wx5ZCI44Os44Kk44Ok44O844Kv44Op44K5XG4gKi9cbmV4cG9ydCBjbGFzcyBTTUJDSUZTSW50ZWdyYXRpb25MYXllciBleHRlbmRzIENvbnN0cnVjdCB7XG4gIC8qKiBBY3RpdmUgRGlyZWN0b3J5ICovXG4gIHB1YmxpYyByZWFkb25seSBhY3RpdmVEaXJlY3Rvcnk/OiBkaXJlY3RvcnlzZXJ2aWNlLkNmbk1pY3Jvc29mdEFEO1xuICAvKiogV2luZG93cyBFQzLjgqTjg7Pjgrnjgr/jg7PjgrkgKi9cbiAgcHVibGljIHJlYWRvbmx5IHdpbmRvd3NJbnN0YW5jZT86IGVjMi5JbnN0YW5jZTtcbiAgLyoqIFNNQuiqjeiovOioreWumiAqL1xuICBwdWJsaWMgcmVhZG9ubHkgc21iQXV0aENvbmZpZzogU01CQXV0aENvbmZpZztcbiAgLyoqIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODlyAqL1xuICBwdWJsaWMgcmVhZG9ubHkgc2VjdXJpdHlHcm91cDogZWMyLlNlY3VyaXR5R3JvdXA7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IHtcbiAgICB2cGM6IGVjMi5JVnBjO1xuICAgIGFkQ29uZmlnOiBBY3RpdmVEaXJlY3RvcnlDb25maWc7XG4gICAgc21iQXV0aENvbmZpZzogU01CQXV0aENvbmZpZztcbiAgICB3aW5kb3dzQ29uZmlnPzogV2luZG93c0VDMkNvbmZpZztcbiAgICBjcmVhdGVXaW5kb3dzSW5zdGFuY2U/OiBib29sZWFuO1xuICB9KSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIHRoaXMuc21iQXV0aENvbmZpZyA9IHByb3BzLnNtYkF1dGhDb25maWc7XG5cbiAgICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fjga7kvZzmiJBcbiAgICB0aGlzLnNlY3VyaXR5R3JvdXAgPSB0aGlzLmNyZWF0ZVNlY3VyaXR5R3JvdXAocHJvcHMudnBjKTtcblxuICAgIC8vIEFjdGl2ZSBEaXJlY3Rvcnnjga7oqK3lrppcbiAgICBpZiAoIXByb3BzLmFkQ29uZmlnLnVzZUV4aXN0aW5nQUQpIHtcbiAgICAgIHRoaXMuYWN0aXZlRGlyZWN0b3J5ID0gdGhpcy5jcmVhdGVBY3RpdmVEaXJlY3RvcnkocHJvcHMudnBjLCBwcm9wcy5hZENvbmZpZyk7XG4gICAgfVxuXG4gICAgLy8gV2luZG93cyBFQzLjgqTjg7Pjgrnjgr/jg7Pjgrnjga7kvZzmiJDvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICBpZiAocHJvcHMuY3JlYXRlV2luZG93c0luc3RhbmNlICYmIHByb3BzLndpbmRvd3NDb25maWcpIHtcbiAgICAgIHRoaXMud2luZG93c0luc3RhbmNlID0gdGhpcy5jcmVhdGVXaW5kb3dzSW5zdGFuY2UoXG4gICAgICAgIHByb3BzLnZwYywgXG4gICAgICAgIHByb3BzLndpbmRvd3NDb25maWcsIFxuICAgICAgICBwcm9wcy5hZENvbmZpZ1xuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBTTULoqo3oqLzmg4XloLHjga7kv53lrZhcbiAgICB0aGlzLnN0b3JlU01CQ3JlZGVudGlhbHMocHJvcHMuc21iQXV0aENvbmZpZyk7XG5cbiAgICAvLyBTTUIvQ0lGU+ODnuOCpuODs+ODiOOCueOCr+ODquODl+ODiOOBrueUn+aIkFxuICAgIHRoaXMuY3JlYXRlU01CTW91bnRTY3JpcHRzKHByb3BzLmFkQ29uZmlnKTtcblxuICAgIC8vIOWHuuWKm+OBruS9nOaIkFxuICAgIHRoaXMuY3JlYXRlT3V0cHV0cyhwcm9wcy5hZENvbmZpZyk7XG4gIH1cblxuICAvKipcbiAgICog44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX44Gu5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVNlY3VyaXR5R3JvdXAodnBjOiBlYzIuSVZwYyk6IGVjMi5TZWN1cml0eUdyb3VwIHtcbiAgICBjb25zdCBzZWN1cml0eUdyb3VwID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdTTUJTZWN1cml0eUdyb3VwJywge1xuICAgICAgdnBjLFxuICAgICAgZGVzY3JpcHRpb246ICdTTUIvQ0lGU+e1seWQiOODrOOCpOODpOODvOeUqOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODlycsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlXG4gICAgfSk7XG5cbiAgICAvLyBTTUIvQ0lGU+eUqOODneODvOODiO+8iDQ0Ne+8iVxuICAgIHNlY3VyaXR5R3JvdXAuYWRkSW5ncmVzc1J1bGUoXG4gICAgICBlYzIuUGVlci5pcHY0KHZwYy52cGNDaWRyQmxvY2spLFxuICAgICAgZWMyLlBvcnQudGNwKDQ0NSksXG4gICAgICAnU01CL0NJRlMg44Ki44Kv44K744K555SoJ1xuICAgICk7XG5cbiAgICAvLyBOZXRCSU9T55So44Od44O844OI77yIMTM3LTEzOe+8iVxuICAgIHNlY3VyaXR5R3JvdXAuYWRkSW5ncmVzc1J1bGUoXG4gICAgICBlYzIuUGVlci5pcHY0KHZwYy52cGNDaWRyQmxvY2spLFxuICAgICAgZWMyLlBvcnQudGNwUmFuZ2UoMTM3LCAxMzkpLFxuICAgICAgJ05ldEJJT1Mg44Ki44Kv44K744K555SoJ1xuICAgICk7XG5cbiAgICAvLyBBY3RpdmUgRGlyZWN0b3J555So44Od44O844OIXG4gICAgY29uc3QgYWRQb3J0cyA9IFs1MywgODgsIDEzNSwgMzg5LCA0NDUsIDQ2NCwgNjM2LCAzMjY4LCAzMjY5XTtcbiAgICBhZFBvcnRzLmZvckVhY2gocG9ydCA9PiB7XG4gICAgICBzZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgICBlYzIuUGVlci5pcHY0KHZwYy52cGNDaWRyQmxvY2spLFxuICAgICAgICBlYzIuUG9ydC50Y3AocG9ydCksXG4gICAgICAgIGBBY3RpdmUgRGlyZWN0b3J5IOODneODvOODiCAke3BvcnR9YFxuICAgICAgKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBzZWN1cml0eUdyb3VwO1xuICB9XG5cbiAgLyoqXG4gICAqIEFjdGl2ZSBEaXJlY3Rvcnnjga7kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQWN0aXZlRGlyZWN0b3J5KFxuICAgIHZwYzogZWMyLklWcGMsIFxuICAgIGNvbmZpZzogQWN0aXZlRGlyZWN0b3J5Q29uZmlnXG4gICk6IGRpcmVjdG9yeXNlcnZpY2UuQ2ZuTWljcm9zb2Z0QUQge1xuICAgIGNvbnN0IHN1Ym5ldHMgPSB2cGMucHJpdmF0ZVN1Ym5ldHMuc2xpY2UoMCwgMikubWFwKHN1Ym5ldCA9PiBzdWJuZXQuc3VibmV0SWQpO1xuXG4gICAgcmV0dXJuIG5ldyBkaXJlY3RvcnlzZXJ2aWNlLkNmbk1pY3Jvc29mdEFEKHRoaXMsICdBY3RpdmVEaXJlY3RvcnknLCB7XG4gICAgICBuYW1lOiBjb25maWcuZG9tYWluTmFtZSxcbiAgICAgIHBhc3N3b3JkOiBjb25maWcuYWRtaW5QYXNzd29yZC51bnNhZmVVbndyYXAoKSxcbiAgICAgIHZwY1NldHRpbmdzOiB7XG4gICAgICAgIHN1Ym5ldElkczogc3VibmV0cyxcbiAgICAgICAgdnBjSWQ6IHZwYy52cGNJZFxuICAgICAgfSxcbiAgICAgIGVkaXRpb246ICdTdGFuZGFyZCcsXG4gICAgICBzaG9ydE5hbWU6IGNvbmZpZy5uZXRCaW9zTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRlN4IE9OVEFQ57Wx5ZCI55SoQWN0aXZlIERpcmVjdG9yeSdcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBXaW5kb3dzIEVDMuOCpOODs+OCueOCv+ODs+OCueOBruS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVXaW5kb3dzSW5zdGFuY2UoXG4gICAgdnBjOiBlYzIuSVZwYyxcbiAgICBjb25maWc6IFdpbmRvd3NFQzJDb25maWcsXG4gICAgYWRDb25maWc6IEFjdGl2ZURpcmVjdG9yeUNvbmZpZ1xuICApOiBlYzIuSW5zdGFuY2Uge1xuICAgIGNvbnN0IHdpbmRvd3NBbWkgPSBjb25maWcuYW1pSWQgXG4gICAgICA/IGVjMi5NYWNoaW5lSW1hZ2UuZ2VuZXJpY1dpbmRvd3MoeyAndXMtZWFzdC0xJzogY29uZmlnLmFtaUlkIH0pXG4gICAgICA6IGVjMi5NYWNoaW5lSW1hZ2UubGF0ZXN0V2luZG93cyhlYzIuV2luZG93c1ZlcnNpb24uV0lORE9XU19TRVJWRVJfMjAyMl9KQVBBTkVTRV9GVUxMX0JBU0UpO1xuXG4gICAgY29uc3QgdXNlckRhdGEgPSB0aGlzLmdlbmVyYXRlV2luZG93c1VzZXJEYXRhKGNvbmZpZywgYWRDb25maWcpO1xuXG4gICAgcmV0dXJuIG5ldyBlYzIuSW5zdGFuY2UodGhpcywgJ1dpbmRvd3NJbnN0YW5jZScsIHtcbiAgICAgIHZwYyxcbiAgICAgIGluc3RhbmNlVHlwZTogY29uZmlnLmluc3RhbmNlVHlwZSxcbiAgICAgIG1hY2hpbmVJbWFnZTogd2luZG93c0FtaSxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IHRoaXMuc2VjdXJpdHlHcm91cCxcbiAgICAgIGtleU5hbWU6IGNvbmZpZy5rZXlQYWlyTmFtZSxcbiAgICAgIHVzZXJEYXRhOiB1c2VyRGF0YSxcbiAgICAgIHJvbGU6IHRoaXMuY3JlYXRlV2luZG93c0luc3RhbmNlUm9sZSgpLFxuICAgICAgdnBjU3VibmV0czoge1xuICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTXG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogV2luZG93cyBFQzLnlKhJQU3jg63jg7zjg6vjga7kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlV2luZG93c0luc3RhbmNlUm9sZSgpOiBpYW0uUm9sZSB7XG4gICAgY29uc3Qgcm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnV2luZG93c0luc3RhbmNlUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdlYzIuYW1hem9uYXdzLmNvbScpLFxuICAgICAgZGVzY3JpcHRpb246ICdXaW5kb3dzIEVDMuOCpOODs+OCueOCv+ODs+OCueeUqElBTeODreODvOODqycsXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdBbWF6b25TU01NYW5hZ2VkSW5zdGFuY2VDb3JlJyksXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQW1hem9uU1NNRGlyZWN0b3J5U2VydmljZUFjY2VzcycpXG4gICAgICBdXG4gICAgfSk7XG5cbiAgICAvLyBTZWNyZXRzIE1hbmFnZXLoqq3jgb/lj5bjgormqKnpmZBcbiAgICByb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ3NlY3JldHNtYW5hZ2VyOkdldFNlY3JldFZhbHVlJyxcbiAgICAgICAgJ3NlY3JldHNtYW5hZ2VyOkRlc2NyaWJlU2VjcmV0J1xuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ11cbiAgICB9KSk7XG5cbiAgICByZXR1cm4gcm9sZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBXaW5kb3dzIFVzZXIgRGF0YeOCueOCr+ODquODl+ODiOOBrueUn+aIkFxuICAgKi9cbiAgcHJpdmF0ZSBnZW5lcmF0ZVdpbmRvd3NVc2VyRGF0YShcbiAgICBjb25maWc6IFdpbmRvd3NFQzJDb25maWcsXG4gICAgYWRDb25maWc6IEFjdGl2ZURpcmVjdG9yeUNvbmZpZ1xuICApOiBlYzIuVXNlckRhdGEge1xuICAgIGNvbnN0IHVzZXJEYXRhID0gZWMyLlVzZXJEYXRhLmZvcldpbmRvd3MoKTtcblxuICAgIHVzZXJEYXRhLmFkZENvbW1hbmRzKFxuICAgICAgJyMgRlN4IE9OVEFQIFNNQi9DSUZT57Wx5ZCIIC0gV2luZG93cyBFQzLjgrvjg4Pjg4jjgqLjg4Pjg5fjgrnjgq/jg6rjg5fjg4gnLFxuICAgICAgJ1dyaXRlLU91dHB1dCBcIkZTeCBPTlRBUCBTTUIvQ0lGU+e1seWQiOOCu+ODg+ODiOOCouODg+ODl+mWi+Wni1wiJyxcbiAgICAgICcnLFxuICAgICAgJyMg5b+F6KaB44Gq5qmf6IO944Gu5pyJ5Yq55YyWJyxcbiAgICAgICdFbmFibGUtV2luZG93c09wdGlvbmFsRmVhdHVyZSAtT25saW5lIC1GZWF0dXJlTmFtZSBcIlNNQjFQcm90b2NvbFwiIC1BbGwgLU5vUmVzdGFydCcsXG4gICAgICAnJyxcbiAgICAgICcjIEZTeCBTTULjg57jgqbjg7Pjg4jnlKjjgrnjgq/jg6rjg5fjg4jjga7kvZzmiJAnLFxuICAgICAgJ05ldy1JdGVtIC1JdGVtVHlwZSBEaXJlY3RvcnkgLVBhdGggXCJDOlxcXFxTY3JpcHRzXCIgLUZvcmNlIHwgT3V0LU51bGwnLFxuICAgICAgJyRNb3VudFNjcmlwdCA9IEBcIicsXG4gICAgICAncGFyYW0oW3N0cmluZ10kRlN4RE5TTmFtZSwgW3N0cmluZ10kU2hhcmVOYW1lID0gXCJkb2N1bWVudHNcIiwgW3N0cmluZ10kRHJpdmVMZXR0ZXIgPSBcIlpcIiknLFxuICAgICAgJ3RyeSB7JyxcbiAgICAgICcgICAgaWYgKEdldC1QU0RyaXZlIC1OYW1lICREcml2ZUxldHRlciAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZSkgeycsXG4gICAgICAnICAgICAgICBSZW1vdmUtUFNEcml2ZSAtTmFtZSAkRHJpdmVMZXR0ZXIgLUZvcmNlJyxcbiAgICAgICcgICAgfScsXG4gICAgICAnICAgICRVTkNQYXRoID0gXCJcXFxcXFxcXCRGU3hETlNOYW1lXFxcXCRTaGFyZU5hbWVcIicsXG4gICAgICAnICAgIE5ldy1QU0RyaXZlIC1OYW1lICREcml2ZUxldHRlciAtUFNQcm92aWRlciBGaWxlU3lzdGVtIC1Sb290ICRVTkNQYXRoIC1QZXJzaXN0JyxcbiAgICAgICcgICAgV3JpdGUtT3V0cHV0IFwiU01C5YWx5pyJ44Oe44OD44OU44Oz44Kw5a6M5LqGOiAkRHJpdmVMZXR0ZXIgLT4gJFVOQ1BhdGhcIicsXG4gICAgICAnfSBjYXRjaCB7JyxcbiAgICAgICcgICAgV3JpdGUtRXJyb3IgXCJTTULlhbHmnInjg57jg4Pjg5Tjg7PjgrDjgqjjg6njg7w6ICQoJF8uRXhjZXB0aW9uLk1lc3NhZ2UpXCInLFxuICAgICAgJ30nLFxuICAgICAgJ1wiQCcsXG4gICAgICAnJE1vdW50U2NyaXB0IHwgT3V0LUZpbGUgLUZpbGVQYXRoIFwiQzpcXFxcU2NyaXB0c1xcXFxNb3VudC1GU3hTTUIucHMxXCIgLUVuY29kaW5nIFVURjgnLFxuICAgICAgJycsXG4gICAgICAnV3JpdGUtT3V0cHV0IFwiRlN4IE9OVEFQIFNNQi9DSUZT57Wx5ZCI44K744OD44OI44Ki44OD44OX5a6M5LqGXCInXG4gICAgKTtcblxuICAgIHJldHVybiB1c2VyRGF0YTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTTULoqo3oqLzmg4XloLHjga7kv53lrZhcbiAgICovXG4gIHByaXZhdGUgc3RvcmVTTUJDcmVkZW50aWFscyhjb25maWc6IFNNQkF1dGhDb25maWcpOiB2b2lkIHtcbiAgICBuZXcgc2VjcmV0c21hbmFnZXIuU2VjcmV0KHRoaXMsICdTTUJDcmVkZW50aWFscycsIHtcbiAgICAgIHNlY3JldE5hbWU6ICdmc3gtb250YXAvc21iLWNyZWRlbnRpYWxzJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRlN4IE9OVEFQIFNNQi9DSUZT6KqN6Ki85oOF5aCxJyxcbiAgICAgIHNlY3JldE9iamVjdFZhbHVlOiB7XG4gICAgICAgIHVzZXJuYW1lOiBjb25maWcuZG9tYWluVXNlcm5hbWUsXG4gICAgICAgIHBhc3N3b3JkOiBjb25maWcuZG9tYWluUGFzc3dvcmQsXG4gICAgICAgIHNlcnZpY2VVc2VybmFtZTogY29uZmlnLnNlcnZpY2VBY2NvdW50LnVzZXJuYW1lLFxuICAgICAgICBzZXJ2aWNlUGFzc3dvcmQ6IGNvbmZpZy5zZXJ2aWNlQWNjb3VudC5wYXNzd29yZFxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFNNQi9DSUZT44Oe44Km44Oz44OI44K544Kv44Oq44OX44OI44Gu55Sf5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVNNQk1vdW50U2NyaXB0cyhhZENvbmZpZzogQWN0aXZlRGlyZWN0b3J5Q29uZmlnKTogdm9pZCB7XG4gICAgY29uc3QgbGludXhTTUJTY3JpcHQgPSB0aGlzLmdlbmVyYXRlTGludXhTTUJTY3JpcHQoYWRDb25maWcpO1xuICAgIFxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdMaW51eFNNQk1vdW50U2NyaXB0Jywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogJy9mc3gtb250YXAvc21iL2xpbnV4LW1vdW50LXNjcmlwdCcsXG4gICAgICBzdHJpbmdWYWx1ZTogbGludXhTTUJTY3JpcHQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0xpbnV455SoU01CL0NJRlPjg57jgqbjg7Pjg4jjgrnjgq/jg6rjg5fjg4gnLFxuICAgICAgdGllcjogc3NtLlBhcmFtZXRlclRpZXIuQURWQU5DRURcbiAgICB9KTtcblxuICAgIGNvbnN0IHdpbmRvd3NTTUJTY3JpcHQgPSB0aGlzLmdlbmVyYXRlV2luZG93c1NNQlNjcmlwdCgpO1xuICAgIFxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdXaW5kb3dzU01CTW91bnRTY3JpcHQnLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnL2ZzeC1vbnRhcC9zbWIvd2luZG93cy1tb3VudC1zY3JpcHQnLFxuICAgICAgc3RyaW5nVmFsdWU6IHdpbmRvd3NTTUJTY3JpcHQsXG4gICAgICBkZXNjcmlwdGlvbjogJ1dpbmRvd3PnlKhTTUIvQ0lGU+ODnuOCpuODs+ODiOOCueOCr+ODquODl+ODiCcsXG4gICAgICB0aWVyOiBzc20uUGFyYW1ldGVyVGllci5BRFZBTkNFRFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIExpbnV455SoU01C44Oe44Km44Oz44OI44K544Kv44Oq44OX44OI44Gu55Sf5oiQXG4gICAqL1xuICBwcml2YXRlIGdlbmVyYXRlTGludXhTTUJTY3JpcHQoYWRDb25maWc6IEFjdGl2ZURpcmVjdG9yeUNvbmZpZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGAjIS9iaW4vYmFzaFxuIyBGU3ggT05UQVAgU01CL0NJRlMg44Oe44Km44Oz44OI44K544Kv44Oq44OX44OI77yITGludXjnlKjvvIlcbnNldCAtZVxuZWNobyBcIj09PSBGU3ggT05UQVAgU01CL0NJRlMg44Oe44Km44Oz44OI6ZaL5aeLID09PVwiXG5cbkRPTUFJTl9OQU1FPVwiJHthZENvbmZpZy5kb21haW5OYW1lfVwiXG5GU1hfRE5TX05BTUU9XCJcXCR7RlNYX0ROU19OQU1FOi19XCJcblNIQVJFX05BTUU9XCJcXCR7U0hBUkVfTkFNRTotZG9jdW1lbnRzfVwiXG5NT1VOVF9QT0lOVD1cIlxcJHtNT1VOVF9QT0lOVDotL21udC9kb2N1bWVudHN9XCJcbkNSRURFTlRJQUxTX0ZJTEU9XCIvZXRjL2NpZnMtY3JlZGVudGlhbHNcIlxuXG4jIOW/heimgeOBquODkeODg+OCseODvOOCuOOBruOCpOODs+OCueODiOODvOODq1xuc3VkbyBhcHQtZ2V0IHVwZGF0ZSAtcVxuc3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgY2lmcy11dGlscyBrcmI1LXVzZXIganFcblxuIyDoqo3oqLzmg4XloLHjga7lj5blvpdcblNFQ1JFVF9WQUxVRT0kKGF3cyBzZWNyZXRzbWFuYWdlciBnZXQtc2VjcmV0LXZhbHVlIC0tc2VjcmV0LWlkIFwiZnN4LW9udGFwL3NtYi1jcmVkZW50aWFsc1wiIC0tcXVlcnkgU2VjcmV0U3RyaW5nIC0tb3V0cHV0IHRleHQpXG5VU0VSTkFNRT0kKGVjaG8gJFNFQ1JFVF9WQUxVRSB8IGpxIC1yIC51c2VybmFtZSlcblBBU1NXT1JEPSQoZWNobyAkU0VDUkVUX1ZBTFVFIHwganEgLXIgLnBhc3N3b3JkKVxuXG4jIOiqjeiovOaDheWgseODleOCoeOCpOODq+OBruS9nOaIkFxuc3VkbyB0ZWUgJENSRURFTlRJQUxTX0ZJTEUgPiAvZGV2L251bGwgPDwgRU9GXG51c2VybmFtZT0kVVNFUk5BTUVcbnBhc3N3b3JkPSRQQVNTV09SRFxuZG9tYWluPSRET01BSU5fTkFNRVxuRU9GYDtcblxuICAgIHJldHVybiBzY3JpcHQ7XG4gIH1cbn0iXX0=