/**
 * FSx for NetApp ONTAP SMB/CIFS統合レイヤー実装
 * Active Directory統合とWindows EC2アクセス機能の維持
 */

import { Construct } from 'constructs';
import { Stack, Duration, CfnOutput, SecretValue } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as directoryservice from 'aws-cdk-lib/aws-directoryservice';

/**
 * Active Directory設定
 */
export interface ActiveDirectoryConfig {
  /** ドメイン名 */
  domainName: string;
  /** NetBIOS名 */
  netBiosName: string;
  /** 管理者パスワード */
  adminPassword: SecretValue;
  /** DNS IPアドレス */
  dnsIpAddresses: string[];
  /** 組織単位（OU） */
  organizationalUnit?: string;
  /** ファイルシステム管理者グループ */
  fileSystemAdministratorsGroup: string;
  /** 既存ADの使用 */
  useExistingAD: boolean;
  /** 既存AD ID（使用する場合） */
  existingDirectoryId?: string;
}

/**
 * SMB/CIFS認証設定
 */
export interface SMBAuthConfig {
  /** ドメインユーザー名 */
  domainUsername: string;
  /** ドメインパスワード */
  domainPassword: SecretValue;
  /** サービスアカウント */
  serviceAccount: {
    username: string;
    password: SecretValue;
  };
  /** Kerberos設定 */
  kerberosConfig?: {
    realm: string;
    kdcServer: string;
    adminServer: string;
  };
}

/**
 * Windows EC2設定
 */
export interface WindowsEC2Config {
  /** インスタンスタイプ */
  instanceType: ec2.InstanceType;
  /** AMI ID */
  amiId?: string;
  /** キーペア名 */
  keyPairName: string;
  /** 自動ドメイン参加 */
  autoJoinDomain: boolean;
  /** 管理者パスワード */
  adminPassword: SecretValue;
}

/**
 * SMB/CIFS統合レイヤークラス
 */
export class SMBCIFSIntegrationLayer extends Construct {
  /** Active Directory */
  public readonly activeDirectory?: directoryservice.CfnMicrosoftAD;
  /** Windows EC2インスタンス */
  public readonly windowsInstance?: ec2.Instance;
  /** SMB認証設定 */
  public readonly smbAuthConfig: SMBAuthConfig;
  /** セキュリティグループ */
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: {
    vpc: ec2.IVpc;
    adConfig: ActiveDirectoryConfig;
    smbAuthConfig: SMBAuthConfig;
    windowsConfig?: WindowsEC2Config;
    createWindowsInstance?: boolean;
  }) {
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
      this.windowsInstance = this.createWindowsInstance(
        props.vpc, 
        props.windowsConfig, 
        props.adConfig
      );
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
  private createSecurityGroup(vpc: ec2.IVpc): ec2.SecurityGroup {
    const securityGroup = new ec2.SecurityGroup(this, 'SMBSecurityGroup', {
      vpc,
      description: 'SMB/CIFS統合レイヤー用セキュリティグループ',
      allowAllOutbound: true
    });

    // SMB/CIFS用ポート（445）
    securityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(445),
      'SMB/CIFS アクセス用'
    );

    // NetBIOS用ポート（137-139）
    securityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcpRange(137, 139),
      'NetBIOS アクセス用'
    );

    // Active Directory用ポート
    const adPorts = [53, 88, 135, 389, 445, 464, 636, 3268, 3269];
    adPorts.forEach(port => {
      securityGroup.addIngressRule(
        ec2.Peer.ipv4(vpc.vpcCidrBlock),
        ec2.Port.tcp(port),
        `Active Directory ポート ${port}`
      );
    });

    return securityGroup;
  }

  /**
   * Active Directoryの作成
   */
  private createActiveDirectory(
    vpc: ec2.IVpc, 
    config: ActiveDirectoryConfig
  ): directoryservice.CfnMicrosoftAD {
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
  private createWindowsInstance(
    vpc: ec2.IVpc,
    config: WindowsEC2Config,
    adConfig: ActiveDirectoryConfig
  ): ec2.Instance {
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
  private createWindowsInstanceRole(): iam.Role {
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
  private generateWindowsUserData(
    config: WindowsEC2Config,
    adConfig: ActiveDirectoryConfig
  ): ec2.UserData {
    const userData = ec2.UserData.forWindows();

    userData.addCommands(
      '# FSx ONTAP SMB/CIFS統合 - Windows EC2セットアップスクリプト',
      'Write-Output "FSx ONTAP SMB/CIFS統合セットアップ開始"',
      '',
      '# 必要な機能の有効化',
      'Enable-WindowsOptionalFeature -Online -FeatureName "SMB1Protocol" -All -NoRestart',
      '',
      '# FSx SMBマウント用スクリプトの作成',
      'New-Item -ItemType Directory -Path "C:\\Scripts" -Force | Out-Null',
      '$MountScript = @"',
      'param([string]$FSxDNSName, [string]$ShareName = "documents", [string]$DriveLetter = "Z")',
      'try {',
      '    if (Get-PSDrive -Name $DriveLetter -ErrorAction SilentlyContinue) {',
      '        Remove-PSDrive -Name $DriveLetter -Force',
      '    }',
      '    $UNCPath = "\\\\$FSxDNSName\\$ShareName"',
      '    New-PSDrive -Name $DriveLetter -PSProvider FileSystem -Root $UNCPath -Persist',
      '    Write-Output "SMB共有マッピング完了: $DriveLetter -> $UNCPath"',
      '} catch {',
      '    Write-Error "SMB共有マッピングエラー: $($_.Exception.Message)"',
      '}',
      '"@',
      '$MountScript | Out-File -FilePath "C:\\Scripts\\Mount-FSxSMB.ps1" -Encoding UTF8',
      '',
      'Write-Output "FSx ONTAP SMB/CIFS統合セットアップ完了"'
    );

    return userData;
  }

  /**
   * SMB認証情報の保存
   */
  private storeSMBCredentials(config: SMBAuthConfig): void {
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
  private createSMBMountScripts(adConfig: ActiveDirectoryConfig): void {
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
  private generateLinuxSMBScript(adConfig: ActiveDirectoryConfig): string {
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