/**
 * DemoEmbeddingStack（オプション）
 * 
 * FlexCache CacheボリュームをCIFSマウントしてEmbeddingを実行するEC2サーバー。
 * S3 Access Pointが利用できない場合の代替パス。
 * 
 * 有効化:
 *   npx cdk deploy ${stackPrefix}-Embedding \
 *     -c enableEmbeddingServer=true \
 *     -c embeddingAdSecretArn=arn:aws:secretsmanager:... \
 *     -c cifsdataVolName=smb_share \
 *     -c ragdbVolPath=/smb_share/ragdb
 * 
 * または環境変数:
 *   CIFSDATA_VOL_NAME=smb_share RAGDB_VOL_PATH=/smb_share/ragdb \
 *     npx cdk deploy ${stackPrefix}-Embedding -c enableEmbeddingServer=true \
 *     -c embeddingAdSecretArn=arn:aws:secretsmanager:...
 * 
 * デプロイ後、docker/embed/ のDockerイメージをECRにプッシュする必要がある。
 * CodeBuildまたはDocker環境からビルド・プッシュ:
 *   aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin <ACCOUNT>.dkr.ecr.ap-northeast-1.amazonaws.com
 *   docker build -t <REPO_URI>:latest docker/embed/
 *   docker push <REPO_URI>:latest
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as fsx from 'aws-cdk-lib/aws-fsx';
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';

export interface DemoEmbeddingStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  vpc: ec2.IVpc;
  privateSubnets: ec2.ISubnet[];
  /** OpenSearch Serverless コレクション（AIStackから） */
  ossCollection: opensearchserverless.CfnCollection;
  /** FSx ONTAP SVM（StorageStackから） */
  svm: fsx.CfnStorageVirtualMachine;
  /** AD管理者パスワードのSecrets Manager ARN */
  adSecretArn: string;
  /** ADサービスアカウントユーザー名 */
  adUserName: string;
  /** ADドメイン名 */
  adDomain: string;
  /** CIFSデータボリューム名（FlexCache Cacheボリューム名） */
  cifsdataVolName: string;
  /** ragdbボリュームパス（CIFSマウント内の相対パス） */
  ragdbVolPath: string;
}

export class DemoEmbeddingStack extends cdk.Stack {
  public readonly instance: ec2.Instance;
  public readonly ecrRepository: ecr.Repository;

  constructor(scope: Construct, id: string, props: DemoEmbeddingStackProps) {
    super(scope, id, props);

    const {
      projectName, environment, vpc, privateSubnets,
      ossCollection, svm, adSecretArn, adUserName, adDomain,
      cifsdataVolName, ragdbVolPath,
    } = props;
    const prefix = `${projectName}-${environment}`;

    // ========================================
    // ECRリポジトリ（イメージは別途ビルド・プッシュ）
    // ========================================
    // DockerImageDeploymentはローカルDocker不要環境では使えないため、
    // ECRリポジトリのみ作成し、イメージはCodeBuild等で別途プッシュする。
    this.ecrRepository = new ecr.Repository(this, 'EmbedEcr', {
      repositoryName: `${prefix}-embedding`,
      imageScanOnPush: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });

    // ========================================
    // セキュリティグループ
    // ========================================
    const sg = new ec2.SecurityGroup(this, 'EmbeddingSg', {
      vpc,
      securityGroupName: `${prefix}-embedding-sg`,
      description: 'Security group for Embedding Server',
      allowAllOutbound: true,
    });
    sg.addIngressRule(
      ec2.Peer.ipv4('10.0.0.0/8'),
      ec2.Port.allTraffic(),
      'Allow all traffic from private network',
    );

    // ========================================
    // IAMロール
    // ========================================
    const instanceRole = new iam.Role(this, 'EmbeddingRole', {
      roleName: `${prefix}-embedding-role`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    // SSM（Session Manager）
    instanceRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: [
        'ssm:DescribeAssociation', 'ssm:GetDeployablePatchSnapshotForInstance',
        'ssm:GetDocument', 'ssm:DescribeDocument', 'ssm:GetManifest',
        'ssm:GetParameter', 'ssm:GetParameters', 'ssm:ListAssociations',
        'ssm:ListInstanceAssociations', 'ssm:PutInventory',
        'ssm:PutComplianceItems', 'ssm:PutConfigurePackageResult',
        'ssm:UpdateAssociationStatus', 'ssm:UpdateInstanceAssociationStatus',
        'ssm:UpdateInstanceInformation',
      ],
      resources: ['*'],
    }));
    instanceRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: [
        'ssmmessages:CreateControlChannel', 'ssmmessages:CreateDataChannel',
        'ssmmessages:OpenControlChannel', 'ssmmessages:OpenDataChannel',
      ],
      resources: ['*'],
    }));
    instanceRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: [
        'ec2messages:AcknowledgeMessage', 'ec2messages:DeleteMessage',
        'ec2messages:FailMessage', 'ec2messages:GetEndpoint',
        'ec2messages:GetMessages', 'ec2messages:SendReply',
      ],
      resources: ['*'],
    }));
    instanceRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMDirectoryServiceAccess'),
    );

    // FSx API
    instanceRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['fsx:DescribeStorageVirtualMachines', 'fsx:DescribeFileSystems'],
      resources: ['*'],
    }));

    // OpenSearch Serverless
    instanceRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['aoss:APIAccessAll', 'aoss:CreateAccessPolicy', 'aoss:CreateSecurityPolicy', 'aoss:CreateCollection'],
      resources: [ossCollection.attrArn],
    }));
    instanceRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['aoss:ListCollections', 'aoss:BatchGetCollection'],
      resources: ['*'],
    }));

    // Bedrock（Embedding model）
    instanceRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:GetFoundationModel', 'bedrock:InvokeModel'],
      resources: [
        `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/*`,
        'arn:aws:bedrock:us-east-1::foundation-model/*',
      ],
    }));

    // ECR
    instanceRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
      resources: [this.ecrRepository.repositoryArn],
    }));
    instanceRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ecr:GetAuthorizationToken', 'sts:GetCallerIdentity'],
      resources: ['*'],
    }));

    // Secrets Manager（ADパスワード取得）
    instanceRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [adSecretArn],
    }));

    // ========================================
    // キーペア
    // ========================================
    const key = new ec2.KeyPair(this, 'EmbeddingKey');
    key.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // ========================================
    // UserData（CIFS マウント + Docker実行）
    // ========================================
    const svmRef = svm.ref;
    const region = cdk.Aws.REGION;
    const account = cdk.Aws.ACCOUNT_ID;
    const ecrRepoUri = this.ecrRepository.repositoryUri;

    const userData = ec2.UserData.forLinux({ shebang: '#!/bin/sh' });
    userData.addCommands(
      'set -ex',
      'sudo yum update -y',
      'sudo yum install -y cifs-utils python3-pip jq',
      'sudo amazon-linux-extras install docker -y',
      'sudo service docker start',
      'sudo usermod -a -G docker ec2-user',
      'sudo mkdir -p /tmp/data',
      'sudo mkdir -p /tmp/db',
      'pip3 install boto3',
    );

    // ADパスワード取得スクリプト
    userData.addCommands(
      `cat > /tmp/get_password.py << 'PYEOF'
import boto3, json
def get_secret():
    sm = boto3.client("secretsmanager", region_name="${region}")
    resp = sm.get_secret_value(SecretId="${adSecretArn}")
    secret = json.loads(resp["SecretString"])
    return secret["password"]
print(get_secret())
PYEOF`,
      'chmod +x /tmp/get_password.py',
      'AD_PASSWORD=$(python3 /tmp/get_password.py)',
      'echo "AD password retrieved"',
    );

    // SVM SMBエンドポイント取得スクリプト
    userData.addCommands(
      `cat > /tmp/get_svm_endpoint.py << 'PYEOF'
import boto3
fsx = boto3.client("fsx", region_name="${region}")
resp = fsx.describe_storage_virtual_machines(StorageVirtualMachineIds=["${svmRef}"])
print(resp["StorageVirtualMachines"][0]["Endpoints"]["Smb"]["IpAddresses"][0])
PYEOF`,
      'chmod +x /tmp/get_svm_endpoint.py',
      'SMB_IP=$(python3 /tmp/get_svm_endpoint.py)',
      'echo "SVM SMB endpoint: $SMB_IP"',
    );

    // CIFSマウント
    userData.addCommands(
      `sudo mount -t cifs //$SMB_IP/c$/${cifsdataVolName} /tmp/data -o user=${adUserName},password="$AD_PASSWORD",domain=${adDomain},iocharset=utf8,mapchars,mfsymlinks`,
      `sudo mount -t cifs //$SMB_IP/c$/${ragdbVolPath} /tmp/db -o user=${adUserName},password="$AD_PASSWORD",domain=${adDomain},iocharset=utf8,mapchars,mfsymlinks || (sudo mkdir -p /tmp/data/ragdb && sudo mount --bind /tmp/data/ragdb /tmp/db)`,
    );

    // ECR認証 + Docker実行
    userData.addCommands(
      `sudo aws ecr get-login-password --region ${region} | sudo docker login --username AWS --password-stdin ${account}.dkr.ecr.${region}.amazonaws.com`,
      [
        'sudo docker run --restart always -d',
        '-v /tmp/data:/opt/netapp/ai/data',
        '-v /tmp/db:/opt/netapp/ai/db',
        `-e ENV_REGION="${region}"`,
        `-e ENV_OPEN_SEARCH_SERVERLESS_COLLECTION_NAME="${ossCollection.name}"`,
        `${ecrRepoUri}:latest`,
      ].join(' '),
      'docker logs $(docker ps -aq | head -n1)',
    );

    // ========================================
    // EC2インスタンス
    // ========================================
    this.instance = new ec2.Instance(this, 'EmbeddingInstance', {
      vpc,
      vpcSubnets: { subnets: privateSubnets },
      securityGroup: sg,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE),
      machineImage: ec2.MachineImage.fromSsmParameter(
        '/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-ebs',
      ),
      role: instanceRole,
      keyPair: key,
      userData,
    });

    // IMDSv2を強制
    const launchTemplate = new ec2.LaunchTemplate(this, 'MetadataTemplate', {
      httpTokens: ec2.LaunchTemplateHttpTokens.REQUIRED,
      httpPutResponseHopLimit: 2,
      requireImdsv2: true,
    });
    this.instance.instance.launchTemplate = {
      version: launchTemplate.versionNumber,
      launchTemplateId: launchTemplate.launchTemplateId,
    };

    // ========================================
    // CloudFormation出力
    // ========================================
    new cdk.CfnOutput(this, 'EmbeddingInstanceId', {
      value: this.instance.instanceId,
      exportName: `${prefix}-EmbeddingInstanceId`,
    });
    new cdk.CfnOutput(this, 'EmbeddingEcrRepoUri', {
      value: this.ecrRepository.repositoryUri,
      exportName: `${prefix}-EmbeddingEcrRepoUri`,
    });
    new cdk.CfnOutput(this, 'CifsDataVolName', {
      value: cifsdataVolName,
      description: 'CIFS data volume name mounted on embedding server',
    });
    new cdk.CfnOutput(this, 'RagdbVolPath', {
      value: ragdbVolPath,
      description: 'Ragdb volume path mounted on embedding server',
    });

    // ========================================
    // cdk-nag suppressions
    // ========================================
    NagSuppressions.addResourceSuppressions(instanceRole, [
      { id: 'AwsSolutions-IAM4', reason: 'SSM managed policy required for Fleet Manager' },
      { id: 'AwsSolutions-IAM5', reason: 'Wildcard needed for SSM, ECR auth, FSx describe' },
    ], true);
    NagSuppressions.addResourceSuppressions(this.instance, [
      { id: 'AwsSolutions-EC26', reason: 'EBS encryption not required for embedding temp data' },
      { id: 'AwsSolutions-EC28', reason: 'Detailed monitoring not needed for batch embedding job' },
      { id: 'AwsSolutions-EC29', reason: 'ASG not needed for single embedding server' },
    ]);

    cdk.Tags.of(this).add('Project', projectName);
    cdk.Tags.of(this).add('Environment', environment);
  }
}
