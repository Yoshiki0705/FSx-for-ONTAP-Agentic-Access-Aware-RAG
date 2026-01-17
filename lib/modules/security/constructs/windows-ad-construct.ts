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

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface WindowsAdConstructProps {
  /** VPC */
  readonly vpc: ec2.IVpc;
  
  /** セキュリティグループ（オプション） */
  readonly securityGroup?: ec2.ISecurityGroup;
  
  /** プライベートサブネット */
  readonly privateSubnets?: ec2.SubnetSelection;
  
  /** プロジェクト名 */
  readonly projectName: string;
  
  /** 環境名 */
  readonly environment: string;
  
  /** ドメイン名 */
  readonly domainName: string;
  
  /** インスタンスタイプ（デフォルト: t3.medium） */
  readonly instanceType?: ec2.InstanceType;
  
  /** キーペア名（オプション） */
  readonly keyName?: string;
  
  /** 既存のAdminパスワードシークレット（オプション） */
  readonly adminPasswordSecret?: secretsmanager.ISecret;
}

/**
 * Windows Active Directory EC2 Construct
 */
export class WindowsAdConstruct extends Construct {
  /** EC2インスタンス */
  public readonly instance: ec2.Instance;
  
  /** セキュリティグループ */
  public readonly securityGroup: ec2.ISecurityGroup;
  
  /** Adminパスワードシークレット */
  public readonly adminPasswordSecret: secretsmanager.ISecret;
  
  /** インスタンスID */
  public readonly instanceId: string;

  constructor(scope: Construct, id: string, props: WindowsAdConstructProps) {
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
    const windowsAmi = ec2.MachineImage.latestWindows(
      ec2.WindowsVersion.WINDOWS_SERVER_2022_ENGLISH_FULL_BASE
    );

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
    const instanceProps: any = {
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
    this.instance.addUserData(
      this.generateUserDataScript(props.domainName)
    );

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
  private generateUserDataScript(domainName: string): string {
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
  public grantSsmRunCommand(grantee: iam.IGrantable): void {
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
