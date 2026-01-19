"use strict";
/**
 * Windows Active Directory EC2 Construct
 *
 * AD SID自動取得システム用のWindows Server EC2インスタンスを作成
 *
 * Features:
 * - Windows Server 2022
 * - Active Directory Domain Services
 * - SSM Run Command対応
 * - PowerShell実行環境
 * - セキュアな認証情報管理（Secrets Manager）
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
exports.WindowsAdConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const constructs_1 = require("constructs");
/**
 * Windows Active Directory EC2 Construct
 */
class WindowsAdConstruct extends constructs_1.Construct {
    /** EC2インスタンス */
    instance;
    /** セキュリティグループ */
    securityGroup;
    /** Adminパスワードシークレット */
    adminPasswordSecret;
    /** インスタンスID */
    instanceId;
    constructor(scope, id, props) {
        super(scope, id);
        console.log('🪟 WindowsAdConstruct初期化開始...');
        // Adminパスワードシークレット作成または使用
        this.adminPasswordSecret = props.adminPasswordSecret || new secretsmanager.Secret(this, 'AdminPassword', {
            secretName: `${props.projectName}-${props.environment}-ad-admin-password`,
            description: 'Windows AD Administrator Password',
            generateSecretString: {
                passwordLength: 32,
                excludePunctuation: true,
                requireEachIncludedType: true,
            },
        });
        // セキュリティグループ作成または使用
        this.securityGroup = props.securityGroup || new ec2.SecurityGroup(this, 'SecurityGroup', {
            vpc: props.vpc,
            description: `${props.projectName}-${props.environment} Windows AD Security Group`,
            allowAllOutbound: true,
        });
        // SSM Session Manager用のインバウンドルール（不要だが明示的に記載）
        // SSM Session Managerはアウトバウンド接続のみ使用
        // 最新のWindows Server 2022 AMI取得
        const windowsAmi = ec2.MachineImage.latestWindows(ec2.WindowsVersion.WINDOWS_SERVER_2022_ENGLISH_FULL_BASE);
        // IAMロール作成
        const role = new iam.Role(this, 'InstanceRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            description: `${props.projectName}-${props.environment} Windows AD Instance Role`,
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
            ],
        });
        // Secrets Manager読み取り権限
        this.adminPasswordSecret.grantRead(role);
        // EC2インスタンス作成
        const instanceProps = {
            vpc: props.vpc,
            vpcSubnets: props.privateSubnets || { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
            instanceType: props.instanceType || ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
            machineImage: windowsAmi,
            securityGroup: this.securityGroup,
            role: role,
            blockDevices: [
                {
                    deviceName: '/dev/sda1',
                    volume: ec2.BlockDeviceVolume.ebs(50, {
                        volumeType: ec2.EbsDeviceVolumeType.GP3,
                        encrypted: true,
                    }),
                },
            ],
        };
        // KeyNameが指定されている場合のみ追加（nullは許可されない）
        if (props.keyName) {
            instanceProps.keyName = props.keyName;
        }
        this.instance = new ec2.Instance(this, 'Instance', instanceProps);
        // インスタンスID取得
        this.instanceId = this.instance.instanceId;
        // ユーザーデータスクリプト作成
        this.instance.addUserData(this.generateUserDataScript(props.domainName));
        // タグ設定
        cdk.Tags.of(this.instance).add('Name', `${props.projectName}-${props.environment}-ad-server`);
        cdk.Tags.of(this.instance).add('Purpose', 'Active Directory');
        cdk.Tags.of(this.instance).add('ManagedBy', 'CDK');
        console.log('✅ WindowsAdConstruct初期化完了');
        console.log(`   - Instance ID: ${this.instanceId}`);
        console.log(`   - Domain Name: ${props.domainName}`);
    }
    /**
     * ユーザーデータスクリプト生成
     */
    generateUserDataScript(domainName) {
        return `<powershell>
# Windows AD Setup Script
# This script installs and configures Active Directory Domain Services

# ログ設定
$LogFile = "C:\\ADSetup.log"
function Write-Log {
    param([string]$Message)
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$Timestamp - $Message" | Out-File -FilePath $LogFile -Append
    Write-Host $Message
}

Write-Log "=== AD Setup Started ==="

try {
    # 1. Active Directory Domain Services インストール
    Write-Log "Installing AD-Domain-Services..."
    Install-WindowsFeature -Name AD-Domain-Services -IncludeManagementTools
    Write-Log "AD-Domain-Services installed successfully"

    # 2. ドメインコントローラーのプロモート（初回のみ）
    Write-Log "Checking if domain controller is already configured..."
    $isDC = (Get-WmiObject -Class Win32_ComputerSystem).DomainRole -ge 4
    
    if (-not $isDC) {
        Write-Log "Promoting to domain controller..."
        Write-Log "Domain Name: ${domainName}"
        
        # セーフモードパスワード生成（Secrets Managerから取得する場合は別途実装）
        $SafeModePassword = ConvertTo-SecureString "TempP@ssw0rd123!" -AsPlainText -Force
        
        # ドメインコントローラーのプロモート
        Install-ADDSForest \`
            -DomainName "${domainName}" \`
            -DomainNetbiosName (${domainName}.Split('.')[0].ToUpper()) \`
            -ForestMode "WinThreshold" \`
            -DomainMode "WinThreshold" \`
            -InstallDns \`
            -SafeModeAdministratorPassword $SafeModePassword \`
            -Force \`
            -NoRebootOnCompletion
        
        Write-Log "Domain controller promotion completed"
        Write-Log "Reboot required - will reboot in 60 seconds"
        
        # 再起動
        Start-Sleep -Seconds 60
        Restart-Computer -Force
    } else {
        Write-Log "Already configured as domain controller"
    }

    # 3. テストユーザー作成（ドメインコントローラー再起動後に実行される）
    Write-Log "Creating test users..."
    
    # ドメインコントローラーが完全に起動するまで待機
    Start-Sleep -Seconds 120
    
    # テストユーザー作成
    $TestUsers = @("testuser", "admin", "testuser0")
    foreach ($User in $TestUsers) {
        try {
            $UserExists = Get-ADUser -Filter "SamAccountName -eq '$User'" -ErrorAction SilentlyContinue
            if (-not $UserExists) {
                $Password = ConvertTo-SecureString "P@ssw0rd123!" -AsPlainText -Force
                New-ADUser \`
                    -Name $User \`
                    -SamAccountName $User \`
                    -UserPrincipalName "$User@${domainName}" \`
                    -AccountPassword $Password \`
                    -Enabled $true \`
                    -PasswordNeverExpires $true
                Write-Log "Created user: $User"
            } else {
                Write-Log "User already exists: $User"
            }
        } catch {
            Write-Log "Error creating user $User: $_"
        }
    }

    Write-Log "=== AD Setup Completed Successfully ==="
} catch {
    Write-Log "ERROR: $_"
    Write-Log "=== AD Setup Failed ==="
    exit 1
}
</powershell>
`;
    }
    /**
     * SSM Run Command実行権限を付与
     */
    grantSsmRunCommand(grantee) {
        grantee.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'ssm:SendCommand',
                'ssm:GetCommandInvocation',
            ],
            resources: [
                `arn:aws:ec2:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:instance/${this.instanceId}`,
                `arn:aws:ssm:${cdk.Stack.of(this).region}::document/AWS-RunPowerShellScript`,
            ],
        }));
    }
}
exports.WindowsAdConstruct = WindowsAdConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2luZG93cy1hZC1jb25zdHJ1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ3aW5kb3dzLWFkLWNvbnN0cnVjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7O0dBV0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MsK0VBQWlFO0FBQ2pFLDJDQUF1QztBQStCdkM7O0dBRUc7QUFDSCxNQUFhLGtCQUFtQixTQUFRLHNCQUFTO0lBQy9DLGdCQUFnQjtJQUNBLFFBQVEsQ0FBZTtJQUV2QyxpQkFBaUI7SUFDRCxhQUFhLENBQXFCO0lBRWxELHVCQUF1QjtJQUNQLG1CQUFtQixDQUF5QjtJQUU1RCxlQUFlO0lBQ0MsVUFBVSxDQUFTO0lBRW5DLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBOEI7UUFDdEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixPQUFPLENBQUMsR0FBRyxDQUFDLCtCQUErQixDQUFDLENBQUM7UUFFN0MsMEJBQTBCO1FBQzFCLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxLQUFLLENBQUMsbUJBQW1CLElBQUksSUFBSSxjQUFjLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDdkcsVUFBVSxFQUFFLEdBQUcsS0FBSyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMsV0FBVyxvQkFBb0I7WUFDekUsV0FBVyxFQUFFLG1DQUFtQztZQUNoRCxvQkFBb0IsRUFBRTtnQkFDcEIsY0FBYyxFQUFFLEVBQUU7Z0JBQ2xCLGtCQUFrQixFQUFFLElBQUk7Z0JBQ3hCLHVCQUF1QixFQUFFLElBQUk7YUFDOUI7U0FDRixDQUFDLENBQUM7UUFFSCxvQkFBb0I7UUFDcEIsSUFBSSxDQUFDLGFBQWEsR0FBRyxLQUFLLENBQUMsYUFBYSxJQUFJLElBQUksR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3ZGLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRztZQUNkLFdBQVcsRUFBRSxHQUFHLEtBQUssQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDLFdBQVcsNEJBQTRCO1lBQ2xGLGdCQUFnQixFQUFFLElBQUk7U0FDdkIsQ0FBQyxDQUFDO1FBRUgsNkNBQTZDO1FBQzdDLG9DQUFvQztRQUVwQywrQkFBK0I7UUFDL0IsTUFBTSxVQUFVLEdBQUcsR0FBRyxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQy9DLEdBQUcsQ0FBQyxjQUFjLENBQUMscUNBQXFDLENBQ3pELENBQUM7UUFFRixXQUFXO1FBQ1gsTUFBTSxJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDOUMsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLG1CQUFtQixDQUFDO1lBQ3hELFdBQVcsRUFBRSxHQUFHLEtBQUssQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDLFdBQVcsMkJBQTJCO1lBQ2pGLGVBQWUsRUFBRTtnQkFDZixHQUFHLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLDhCQUE4QixDQUFDO2dCQUMxRSxHQUFHLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLDZCQUE2QixDQUFDO2FBQzFFO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsd0JBQXdCO1FBQ3hCLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFekMsY0FBYztRQUNkLE1BQU0sYUFBYSxHQUFRO1lBQ3pCLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRztZQUNkLFVBQVUsRUFBRSxLQUFLLENBQUMsY0FBYyxJQUFJLEVBQUUsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsbUJBQW1CLEVBQUU7WUFDdEYsWUFBWSxFQUFFLEtBQUssQ0FBQyxZQUFZLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUM7WUFDdEcsWUFBWSxFQUFFLFVBQVU7WUFDeEIsYUFBYSxFQUFFLElBQUksQ0FBQyxhQUFhO1lBQ2pDLElBQUksRUFBRSxJQUFJO1lBQ1YsWUFBWSxFQUFFO2dCQUNaO29CQUNFLFVBQVUsRUFBRSxXQUFXO29CQUN2QixNQUFNLEVBQUUsR0FBRyxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUU7d0JBQ3BDLFVBQVUsRUFBRSxHQUFHLENBQUMsbUJBQW1CLENBQUMsR0FBRzt3QkFDdkMsU0FBUyxFQUFFLElBQUk7cUJBQ2hCLENBQUM7aUJBQ0g7YUFDRjtTQUNGLENBQUM7UUFFRixxQ0FBcUM7UUFDckMsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbEIsYUFBYSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDO1FBQ3hDLENBQUM7UUFFRCxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBRWxFLGFBQWE7UUFDYixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDO1FBRTNDLGlCQUFpQjtRQUNqQixJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FDdkIsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FDOUMsQ0FBQztRQUVGLE9BQU87UUFDUCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDLFdBQVcsWUFBWSxDQUFDLENBQUM7UUFDOUYsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUM5RCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUVuRCxPQUFPLENBQUMsR0FBRyxDQUFDLDJCQUEyQixDQUFDLENBQUM7UUFDekMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7UUFDcEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDdkQsQ0FBQztJQUVEOztPQUVHO0lBQ0ssc0JBQXNCLENBQUMsVUFBa0I7UUFDL0MsT0FBTzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O2tDQTJCdUIsVUFBVTs7Ozs7OzsyQkFPakIsVUFBVTtrQ0FDSCxVQUFVOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O2dEQWtDSSxVQUFVOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQW9CekQsQ0FBQztJQUNBLENBQUM7SUFFRDs7T0FFRztJQUNJLGtCQUFrQixDQUFDLE9BQXVCO1FBQy9DLE9BQU8sQ0FBQyxjQUFjLENBQUMsb0JBQW9CLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ2xFLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDeEIsT0FBTyxFQUFFO2dCQUNQLGlCQUFpQjtnQkFDakIsMEJBQTBCO2FBQzNCO1lBQ0QsU0FBUyxFQUFFO2dCQUNULGVBQWUsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sYUFBYSxJQUFJLENBQUMsVUFBVSxFQUFFO2dCQUNwRyxlQUFlLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sb0NBQW9DO2FBQzdFO1NBQ0YsQ0FBQyxDQUFDLENBQUM7SUFDTixDQUFDO0NBQ0Y7QUFyTkQsZ0RBcU5DIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBXaW5kb3dzIEFjdGl2ZSBEaXJlY3RvcnkgRUMyIENvbnN0cnVjdFxuICogXG4gKiBBRCBTSUToh6rli5Xlj5blvpfjgrfjgrnjg4bjg6DnlKjjga5XaW5kb3dzIFNlcnZlciBFQzLjgqTjg7Pjgrnjgr/jg7PjgrnjgpLkvZzmiJBcbiAqIFxuICogRmVhdHVyZXM6XG4gKiAtIFdpbmRvd3MgU2VydmVyIDIwMjJcbiAqIC0gQWN0aXZlIERpcmVjdG9yeSBEb21haW4gU2VydmljZXNcbiAqIC0gU1NNIFJ1biBDb21tYW5k5a++5b+cXG4gKiAtIFBvd2VyU2hlbGzlrp/ooYznkrDlooNcbiAqIC0g44K744Kt44Ol44Ki44Gq6KqN6Ki85oOF5aCx566h55CG77yIU2VjcmV0cyBNYW5hZ2Vy77yJXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIHNlY3JldHNtYW5hZ2VyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zZWNyZXRzbWFuYWdlcic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBXaW5kb3dzQWRDb25zdHJ1Y3RQcm9wcyB7XG4gIC8qKiBWUEMgKi9cbiAgcmVhZG9ubHkgdnBjOiBlYzIuSVZwYztcbiAgXG4gIC8qKiDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fvvIjjgqrjg5fjgrfjg6fjg7PvvIkgKi9cbiAgcmVhZG9ubHkgc2VjdXJpdHlHcm91cD86IGVjMi5JU2VjdXJpdHlHcm91cDtcbiAgXG4gIC8qKiDjg5fjg6njgqTjg5njg7zjg4jjgrXjg5bjg43jg4Pjg4ggKi9cbiAgcmVhZG9ubHkgcHJpdmF0ZVN1Ym5ldHM/OiBlYzIuU3VibmV0U2VsZWN0aW9uO1xuICBcbiAgLyoqIOODl+ODreOCuOOCp+OCr+ODiOWQjSAqL1xuICByZWFkb25seSBwcm9qZWN0TmFtZTogc3RyaW5nO1xuICBcbiAgLyoqIOeSsOWig+WQjSAqL1xuICByZWFkb25seSBlbnZpcm9ubWVudDogc3RyaW5nO1xuICBcbiAgLyoqIOODieODoeOCpOODs+WQjSAqL1xuICByZWFkb25seSBkb21haW5OYW1lOiBzdHJpbmc7XG4gIFxuICAvKiog44Kk44Oz44K544K/44Oz44K544K/44Kk44OX77yI44OH44OV44Kp44Or44OIOiB0My5tZWRpdW3vvIkgKi9cbiAgcmVhZG9ubHkgaW5zdGFuY2VUeXBlPzogZWMyLkluc3RhbmNlVHlwZTtcbiAgXG4gIC8qKiDjgq3jg7zjg5rjgqLlkI3vvIjjgqrjg5fjgrfjg6fjg7PvvIkgKi9cbiAgcmVhZG9ubHkga2V5TmFtZT86IHN0cmluZztcbiAgXG4gIC8qKiDml6LlrZjjga5BZG1pbuODkeOCueODr+ODvOODieOCt+ODvOOCr+ODrOODg+ODiO+8iOOCquODl+OCt+ODp+ODs++8iSAqL1xuICByZWFkb25seSBhZG1pblBhc3N3b3JkU2VjcmV0Pzogc2VjcmV0c21hbmFnZXIuSVNlY3JldDtcbn1cblxuLyoqXG4gKiBXaW5kb3dzIEFjdGl2ZSBEaXJlY3RvcnkgRUMyIENvbnN0cnVjdFxuICovXG5leHBvcnQgY2xhc3MgV2luZG93c0FkQ29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgLyoqIEVDMuOCpOODs+OCueOCv+ODs+OCuSAqL1xuICBwdWJsaWMgcmVhZG9ubHkgaW5zdGFuY2U6IGVjMi5JbnN0YW5jZTtcbiAgXG4gIC8qKiDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5cgKi9cbiAgcHVibGljIHJlYWRvbmx5IHNlY3VyaXR5R3JvdXA6IGVjMi5JU2VjdXJpdHlHcm91cDtcbiAgXG4gIC8qKiBBZG1pbuODkeOCueODr+ODvOODieOCt+ODvOOCr+ODrOODg+ODiCAqL1xuICBwdWJsaWMgcmVhZG9ubHkgYWRtaW5QYXNzd29yZFNlY3JldDogc2VjcmV0c21hbmFnZXIuSVNlY3JldDtcbiAgXG4gIC8qKiDjgqTjg7Pjgrnjgr/jg7PjgrlJRCAqL1xuICBwdWJsaWMgcmVhZG9ubHkgaW5zdGFuY2VJZDogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBXaW5kb3dzQWRDb25zdHJ1Y3RQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICBjb25zb2xlLmxvZygn8J+qnyBXaW5kb3dzQWRDb25zdHJ1Y3TliJ3mnJ/ljJbplovlp4suLi4nKTtcblxuICAgIC8vIEFkbWlu44OR44K544Ov44O844OJ44K344O844Kv44Os44OD44OI5L2c5oiQ44G+44Gf44Gv5L2/55SoXG4gICAgdGhpcy5hZG1pblBhc3N3b3JkU2VjcmV0ID0gcHJvcHMuYWRtaW5QYXNzd29yZFNlY3JldCB8fCBuZXcgc2VjcmV0c21hbmFnZXIuU2VjcmV0KHRoaXMsICdBZG1pblBhc3N3b3JkJywge1xuICAgICAgc2VjcmV0TmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWFkLWFkbWluLXBhc3N3b3JkYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV2luZG93cyBBRCBBZG1pbmlzdHJhdG9yIFBhc3N3b3JkJyxcbiAgICAgIGdlbmVyYXRlU2VjcmV0U3RyaW5nOiB7XG4gICAgICAgIHBhc3N3b3JkTGVuZ3RoOiAzMixcbiAgICAgICAgZXhjbHVkZVB1bmN0dWF0aW9uOiB0cnVlLFxuICAgICAgICByZXF1aXJlRWFjaEluY2x1ZGVkVHlwZTogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fkvZzmiJDjgb7jgZ/jga/kvb/nlKhcbiAgICB0aGlzLnNlY3VyaXR5R3JvdXAgPSBwcm9wcy5zZWN1cml0eUdyb3VwIHx8IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnU2VjdXJpdHlHcm91cCcsIHtcbiAgICAgIHZwYzogcHJvcHMudnBjLFxuICAgICAgZGVzY3JpcHRpb246IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fSBXaW5kb3dzIEFEIFNlY3VyaXR5IEdyb3VwYCxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBTU00gU2Vzc2lvbiBNYW5hZ2Vy55So44Gu44Kk44Oz44OQ44Km44Oz44OJ44Or44O844Or77yI5LiN6KaB44Gg44GM5piO56S655qE44Gr6KiY6LyJ77yJXG4gICAgLy8gU1NNIFNlc3Npb24gTWFuYWdlcuOBr+OCouOCpuODiOODkOOCpuODs+ODieaOpee2muOBruOBv+S9v+eUqFxuXG4gICAgLy8g5pyA5paw44GuV2luZG93cyBTZXJ2ZXIgMjAyMiBBTUnlj5blvpdcbiAgICBjb25zdCB3aW5kb3dzQW1pID0gZWMyLk1hY2hpbmVJbWFnZS5sYXRlc3RXaW5kb3dzKFxuICAgICAgZWMyLldpbmRvd3NWZXJzaW9uLldJTkRPV1NfU0VSVkVSXzIwMjJfRU5HTElTSF9GVUxMX0JBU0VcbiAgICApO1xuXG4gICAgLy8gSUFN44Ot44O844Or5L2c5oiQXG4gICAgY29uc3Qgcm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnSW5zdGFuY2VSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2VjMi5hbWF6b25hd3MuY29tJyksXG4gICAgICBkZXNjcmlwdGlvbjogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9IFdpbmRvd3MgQUQgSW5zdGFuY2UgUm9sZWAsXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdBbWF6b25TU01NYW5hZ2VkSW5zdGFuY2VDb3JlJyksXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQ2xvdWRXYXRjaEFnZW50U2VydmVyUG9saWN5JyksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gU2VjcmV0cyBNYW5hZ2Vy6Kqt44G/5Y+W44KK5qip6ZmQXG4gICAgdGhpcy5hZG1pblBhc3N3b3JkU2VjcmV0LmdyYW50UmVhZChyb2xlKTtcblxuICAgIC8vIEVDMuOCpOODs+OCueOCv+ODs+OCueS9nOaIkFxuICAgIGNvbnN0IGluc3RhbmNlUHJvcHM6IGFueSA9IHtcbiAgICAgIHZwYzogcHJvcHMudnBjLFxuICAgICAgdnBjU3VibmV0czogcHJvcHMucHJpdmF0ZVN1Ym5ldHMgfHwgeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXG4gICAgICBpbnN0YW5jZVR5cGU6IHByb3BzLmluc3RhbmNlVHlwZSB8fCBlYzIuSW5zdGFuY2VUeXBlLm9mKGVjMi5JbnN0YW5jZUNsYXNzLlQzLCBlYzIuSW5zdGFuY2VTaXplLk1FRElVTSksXG4gICAgICBtYWNoaW5lSW1hZ2U6IHdpbmRvd3NBbWksXG4gICAgICBzZWN1cml0eUdyb3VwOiB0aGlzLnNlY3VyaXR5R3JvdXAsXG4gICAgICByb2xlOiByb2xlLFxuICAgICAgYmxvY2tEZXZpY2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBkZXZpY2VOYW1lOiAnL2Rldi9zZGExJyxcbiAgICAgICAgICB2b2x1bWU6IGVjMi5CbG9ja0RldmljZVZvbHVtZS5lYnMoNTAsIHtcbiAgICAgICAgICAgIHZvbHVtZVR5cGU6IGVjMi5FYnNEZXZpY2VWb2x1bWVUeXBlLkdQMyxcbiAgICAgICAgICAgIGVuY3J5cHRlZDogdHJ1ZSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfTtcblxuICAgIC8vIEtleU5hbWXjgYzmjIflrprjgZXjgozjgabjgYTjgovloLTlkIjjga7jgb/ov73liqDvvIhudWxs44Gv6Kix5Y+v44GV44KM44Gq44GE77yJXG4gICAgaWYgKHByb3BzLmtleU5hbWUpIHtcbiAgICAgIGluc3RhbmNlUHJvcHMua2V5TmFtZSA9IHByb3BzLmtleU5hbWU7XG4gICAgfVxuXG4gICAgdGhpcy5pbnN0YW5jZSA9IG5ldyBlYzIuSW5zdGFuY2UodGhpcywgJ0luc3RhbmNlJywgaW5zdGFuY2VQcm9wcyk7XG5cbiAgICAvLyDjgqTjg7Pjgrnjgr/jg7PjgrlJROWPluW+l1xuICAgIHRoaXMuaW5zdGFuY2VJZCA9IHRoaXMuaW5zdGFuY2UuaW5zdGFuY2VJZDtcblxuICAgIC8vIOODpuODvOOCtuODvOODh+ODvOOCv+OCueOCr+ODquODl+ODiOS9nOaIkFxuICAgIHRoaXMuaW5zdGFuY2UuYWRkVXNlckRhdGEoXG4gICAgICB0aGlzLmdlbmVyYXRlVXNlckRhdGFTY3JpcHQocHJvcHMuZG9tYWluTmFtZSlcbiAgICApO1xuXG4gICAgLy8g44K/44Kw6Kit5a6aXG4gICAgY2RrLlRhZ3Mub2YodGhpcy5pbnN0YW5jZSkuYWRkKCdOYW1lJywgYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWFkLXNlcnZlcmApO1xuICAgIGNkay5UYWdzLm9mKHRoaXMuaW5zdGFuY2UpLmFkZCgnUHVycG9zZScsICdBY3RpdmUgRGlyZWN0b3J5Jyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcy5pbnN0YW5jZSkuYWRkKCdNYW5hZ2VkQnknLCAnQ0RLJyk7XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIFdpbmRvd3NBZENvbnN0cnVjdOWIneacn+WMluWujOS6hicpO1xuICAgIGNvbnNvbGUubG9nKGAgICAtIEluc3RhbmNlIElEOiAke3RoaXMuaW5zdGFuY2VJZH1gKTtcbiAgICBjb25zb2xlLmxvZyhgICAgLSBEb21haW4gTmFtZTogJHtwcm9wcy5kb21haW5OYW1lfWApO1xuICB9XG5cbiAgLyoqXG4gICAqIOODpuODvOOCtuODvOODh+ODvOOCv+OCueOCr+ODquODl+ODiOeUn+aIkFxuICAgKi9cbiAgcHJpdmF0ZSBnZW5lcmF0ZVVzZXJEYXRhU2NyaXB0KGRvbWFpbk5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGA8cG93ZXJzaGVsbD5cbiMgV2luZG93cyBBRCBTZXR1cCBTY3JpcHRcbiMgVGhpcyBzY3JpcHQgaW5zdGFsbHMgYW5kIGNvbmZpZ3VyZXMgQWN0aXZlIERpcmVjdG9yeSBEb21haW4gU2VydmljZXNcblxuIyDjg63jgrDoqK3lrppcbiRMb2dGaWxlID0gXCJDOlxcXFxBRFNldHVwLmxvZ1wiXG5mdW5jdGlvbiBXcml0ZS1Mb2cge1xuICAgIHBhcmFtKFtzdHJpbmddJE1lc3NhZ2UpXG4gICAgJFRpbWVzdGFtcCA9IEdldC1EYXRlIC1Gb3JtYXQgXCJ5eXl5LU1NLWRkIEhIOm1tOnNzXCJcbiAgICBcIiRUaW1lc3RhbXAgLSAkTWVzc2FnZVwiIHwgT3V0LUZpbGUgLUZpbGVQYXRoICRMb2dGaWxlIC1BcHBlbmRcbiAgICBXcml0ZS1Ib3N0ICRNZXNzYWdlXG59XG5cbldyaXRlLUxvZyBcIj09PSBBRCBTZXR1cCBTdGFydGVkID09PVwiXG5cbnRyeSB7XG4gICAgIyAxLiBBY3RpdmUgRGlyZWN0b3J5IERvbWFpbiBTZXJ2aWNlcyDjgqTjg7Pjgrnjg4jjg7zjg6tcbiAgICBXcml0ZS1Mb2cgXCJJbnN0YWxsaW5nIEFELURvbWFpbi1TZXJ2aWNlcy4uLlwiXG4gICAgSW5zdGFsbC1XaW5kb3dzRmVhdHVyZSAtTmFtZSBBRC1Eb21haW4tU2VydmljZXMgLUluY2x1ZGVNYW5hZ2VtZW50VG9vbHNcbiAgICBXcml0ZS1Mb2cgXCJBRC1Eb21haW4tU2VydmljZXMgaW5zdGFsbGVkIHN1Y2Nlc3NmdWxseVwiXG5cbiAgICAjIDIuIOODieODoeOCpOODs+OCs+ODs+ODiOODreODvOODqeODvOOBruODl+ODreODouODvOODiO+8iOWIneWbnuOBruOBv++8iVxuICAgIFdyaXRlLUxvZyBcIkNoZWNraW5nIGlmIGRvbWFpbiBjb250cm9sbGVyIGlzIGFscmVhZHkgY29uZmlndXJlZC4uLlwiXG4gICAgJGlzREMgPSAoR2V0LVdtaU9iamVjdCAtQ2xhc3MgV2luMzJfQ29tcHV0ZXJTeXN0ZW0pLkRvbWFpblJvbGUgLWdlIDRcbiAgICBcbiAgICBpZiAoLW5vdCAkaXNEQykge1xuICAgICAgICBXcml0ZS1Mb2cgXCJQcm9tb3RpbmcgdG8gZG9tYWluIGNvbnRyb2xsZXIuLi5cIlxuICAgICAgICBXcml0ZS1Mb2cgXCJEb21haW4gTmFtZTogJHtkb21haW5OYW1lfVwiXG4gICAgICAgIFxuICAgICAgICAjIOOCu+ODvOODleODouODvOODieODkeOCueODr+ODvOODieeUn+aIkO+8iFNlY3JldHMgTWFuYWdlcuOBi+OCieWPluW+l+OBmeOCi+WgtOWQiOOBr+WIpemAlOWun+ijhe+8iVxuICAgICAgICAkU2FmZU1vZGVQYXNzd29yZCA9IENvbnZlcnRUby1TZWN1cmVTdHJpbmcgXCJUZW1wUEBzc3cwcmQxMjMhXCIgLUFzUGxhaW5UZXh0IC1Gb3JjZVxuICAgICAgICBcbiAgICAgICAgIyDjg4njg6HjgqTjg7PjgrPjg7Pjg4jjg63jg7zjg6njg7zjga7jg5fjg63jg6Ljg7zjg4hcbiAgICAgICAgSW5zdGFsbC1BRERTRm9yZXN0IFxcYFxuICAgICAgICAgICAgLURvbWFpbk5hbWUgXCIke2RvbWFpbk5hbWV9XCIgXFxgXG4gICAgICAgICAgICAtRG9tYWluTmV0Ymlvc05hbWUgKCR7ZG9tYWluTmFtZX0uU3BsaXQoJy4nKVswXS5Ub1VwcGVyKCkpIFxcYFxuICAgICAgICAgICAgLUZvcmVzdE1vZGUgXCJXaW5UaHJlc2hvbGRcIiBcXGBcbiAgICAgICAgICAgIC1Eb21haW5Nb2RlIFwiV2luVGhyZXNob2xkXCIgXFxgXG4gICAgICAgICAgICAtSW5zdGFsbERucyBcXGBcbiAgICAgICAgICAgIC1TYWZlTW9kZUFkbWluaXN0cmF0b3JQYXNzd29yZCAkU2FmZU1vZGVQYXNzd29yZCBcXGBcbiAgICAgICAgICAgIC1Gb3JjZSBcXGBcbiAgICAgICAgICAgIC1Ob1JlYm9vdE9uQ29tcGxldGlvblxuICAgICAgICBcbiAgICAgICAgV3JpdGUtTG9nIFwiRG9tYWluIGNvbnRyb2xsZXIgcHJvbW90aW9uIGNvbXBsZXRlZFwiXG4gICAgICAgIFdyaXRlLUxvZyBcIlJlYm9vdCByZXF1aXJlZCAtIHdpbGwgcmVib290IGluIDYwIHNlY29uZHNcIlxuICAgICAgICBcbiAgICAgICAgIyDlho3otbfli5VcbiAgICAgICAgU3RhcnQtU2xlZXAgLVNlY29uZHMgNjBcbiAgICAgICAgUmVzdGFydC1Db21wdXRlciAtRm9yY2VcbiAgICB9IGVsc2Uge1xuICAgICAgICBXcml0ZS1Mb2cgXCJBbHJlYWR5IGNvbmZpZ3VyZWQgYXMgZG9tYWluIGNvbnRyb2xsZXJcIlxuICAgIH1cblxuICAgICMgMy4g44OG44K544OI44Om44O844K244O85L2c5oiQ77yI44OJ44Oh44Kk44Oz44Kz44Oz44OI44Ot44O844Op44O85YaN6LW35YuV5b6M44Gr5a6f6KGM44GV44KM44KL77yJXG4gICAgV3JpdGUtTG9nIFwiQ3JlYXRpbmcgdGVzdCB1c2Vycy4uLlwiXG4gICAgXG4gICAgIyDjg4njg6HjgqTjg7PjgrPjg7Pjg4jjg63jg7zjg6njg7zjgYzlrozlhajjgavotbfli5XjgZnjgovjgb7jgaflvoXmqZ9cbiAgICBTdGFydC1TbGVlcCAtU2Vjb25kcyAxMjBcbiAgICBcbiAgICAjIOODhuOCueODiOODpuODvOOCtuODvOS9nOaIkFxuICAgICRUZXN0VXNlcnMgPSBAKFwidGVzdHVzZXJcIiwgXCJhZG1pblwiLCBcInRlc3R1c2VyMFwiKVxuICAgIGZvcmVhY2ggKCRVc2VyIGluICRUZXN0VXNlcnMpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICRVc2VyRXhpc3RzID0gR2V0LUFEVXNlciAtRmlsdGVyIFwiU2FtQWNjb3VudE5hbWUgLWVxICckVXNlcidcIiAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZVxuICAgICAgICAgICAgaWYgKC1ub3QgJFVzZXJFeGlzdHMpIHtcbiAgICAgICAgICAgICAgICAkUGFzc3dvcmQgPSBDb252ZXJ0VG8tU2VjdXJlU3RyaW5nIFwiUEBzc3cwcmQxMjMhXCIgLUFzUGxhaW5UZXh0IC1Gb3JjZVxuICAgICAgICAgICAgICAgIE5ldy1BRFVzZXIgXFxgXG4gICAgICAgICAgICAgICAgICAgIC1OYW1lICRVc2VyIFxcYFxuICAgICAgICAgICAgICAgICAgICAtU2FtQWNjb3VudE5hbWUgJFVzZXIgXFxgXG4gICAgICAgICAgICAgICAgICAgIC1Vc2VyUHJpbmNpcGFsTmFtZSBcIiRVc2VyQCR7ZG9tYWluTmFtZX1cIiBcXGBcbiAgICAgICAgICAgICAgICAgICAgLUFjY291bnRQYXNzd29yZCAkUGFzc3dvcmQgXFxgXG4gICAgICAgICAgICAgICAgICAgIC1FbmFibGVkICR0cnVlIFxcYFxuICAgICAgICAgICAgICAgICAgICAtUGFzc3dvcmROZXZlckV4cGlyZXMgJHRydWVcbiAgICAgICAgICAgICAgICBXcml0ZS1Mb2cgXCJDcmVhdGVkIHVzZXI6ICRVc2VyXCJcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgV3JpdGUtTG9nIFwiVXNlciBhbHJlYWR5IGV4aXN0czogJFVzZXJcIlxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIFdyaXRlLUxvZyBcIkVycm9yIGNyZWF0aW5nIHVzZXIgJFVzZXI6ICRfXCJcbiAgICAgICAgfVxuICAgIH1cblxuICAgIFdyaXRlLUxvZyBcIj09PSBBRCBTZXR1cCBDb21wbGV0ZWQgU3VjY2Vzc2Z1bGx5ID09PVwiXG59IGNhdGNoIHtcbiAgICBXcml0ZS1Mb2cgXCJFUlJPUjogJF9cIlxuICAgIFdyaXRlLUxvZyBcIj09PSBBRCBTZXR1cCBGYWlsZWQgPT09XCJcbiAgICBleGl0IDFcbn1cbjwvcG93ZXJzaGVsbD5cbmA7XG4gIH1cblxuICAvKipcbiAgICogU1NNIFJ1biBDb21tYW5k5a6f6KGM5qip6ZmQ44KS5LuY5LiOXG4gICAqL1xuICBwdWJsaWMgZ3JhbnRTc21SdW5Db21tYW5kKGdyYW50ZWU6IGlhbS5JR3JhbnRhYmxlKTogdm9pZCB7XG4gICAgZ3JhbnRlZS5ncmFudFByaW5jaXBhbC5hZGRUb1ByaW5jaXBhbFBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdzc206U2VuZENvbW1hbmQnLFxuICAgICAgICAnc3NtOkdldENvbW1hbmRJbnZvY2F0aW9uJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6ZWMyOiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06aW5zdGFuY2UvJHt0aGlzLmluc3RhbmNlSWR9YCxcbiAgICAgICAgYGFybjphd3M6c3NtOiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06OmRvY3VtZW50L0FXUy1SdW5Qb3dlclNoZWxsU2NyaXB0YCxcbiAgICAgIF0sXG4gICAgfSkpO1xuICB9XG59XG4iXX0=