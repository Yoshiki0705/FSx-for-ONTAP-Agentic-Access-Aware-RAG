/**
 * DemoStorageStack
 * 
 * FSx for ONTAP（SINGLE_AZ_1）+ SVM + Volume + S3 Access Point、
 * データ同期用S3バケット、権限キャッシュDynamoDBテーブルを作成する。
 * 
 * FSx ONTAP S3 Access Pointsにより、Bedrock KBがFSx上のデータを
 * S3 API経由で直接読み取り可能。
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as fsx from 'aws-cdk-lib/aws-fsx';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as directoryservice from 'aws-cdk-lib/aws-directoryservice';
import { Construct } from 'constructs';

export interface DemoStorageStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  vpc: ec2.IVpc;
  privateSubnets: ec2.ISubnet[];
  fsxSg: ec2.ISecurityGroup;
  /** AD管理者パスワード（cdk.context.jsonのadPasswordから取得） */
  adPassword?: string;
  /** ADドメイン名（デフォルト: demo.local） */
  adDomainName?: string;
  /** KMS暗号化を有効化するか（デフォルト: false） */
  enableKmsEncryption?: boolean;
  /** CloudTrail監査ログを有効化するか（デフォルト: false） */
  enableCloudTrail?: boolean;
}

export class DemoStorageStack extends cdk.Stack {
  /** FSx for ONTAP ファイルシステム */
  public readonly fileSystem: fsx.CfnFileSystem;
  /** Storage Virtual Machine */
  public readonly svm: fsx.CfnStorageVirtualMachine;
  /** FSx Volume */
  public readonly volume: fsx.CfnVolume;
  /** データ同期用S3バケット（Bedrock KBデータソース） */
  public readonly dataBucket: s3.Bucket;
  /** 権限キャッシュDynamoDBテーブル */
  public readonly permissionCacheTable: dynamodb.Table;
  /** ユーザーアクセステーブル（SID→ユーザーマッピング） */
  public readonly userAccessTable: dynamodb.Table;
  /** AWS Managed Microsoft AD */
  public readonly managedAd?: directoryservice.CfnMicrosoftAD;
  /** KMS暗号化キー（enableKmsEncryption=trueの場合） */
  public readonly encryptionKey?: kms.Key;

  constructor(scope: Construct, id: string, props: DemoStorageStackProps) {
    super(scope, id, props);

    const { projectName, environment, vpc, privateSubnets, fsxSg, adPassword, adDomainName, enableKmsEncryption, enableCloudTrail } = props;
    const prefix = `${projectName}-${environment}`;
    const domainName = adDomainName || 'demo.local';

    // ========================================
    // KMS暗号化キー（オプション）
    // ========================================
    let kmsKey: kms.Key | undefined;
    if (enableKmsEncryption) {
      kmsKey = new kms.Key(this, 'EncryptionKey', {
        alias: `${prefix}-encryption-key`,
        description: `Encryption key for ${projectName} data at rest`,
        enableKeyRotation: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
      this.encryptionKey = kmsKey;
    }

    // ========================================
    // AWS Managed Microsoft AD
    // ========================================
    // SVM をADに参加させるために必要。
    // Standard Edition（Small）で十分（検証用途）。
    // ADパスワードが設定されている場合のみ作成。
    if (adPassword) {
      this.managedAd = new directoryservice.CfnMicrosoftAD(this, 'ManagedAd', {
        name: domainName,
        password: adPassword,
        edition: 'Standard',
        vpcSettings: {
          vpcId: vpc.vpcId,
          subnetIds: privateSubnets.slice(0, 2).map(s => s.subnetId),
        },
      });
      cdk.Tags.of(this.managedAd).add('Name', `${prefix}-ad`);
    }

    // ========================================
    // FSx for ONTAP
    // ========================================

    // FSx for ONTAP ファイルシステム（SINGLE_AZ_1）
    this.fileSystem = new fsx.CfnFileSystem(this, 'OntapFs', {
      fileSystemType: 'ONTAP',
      storageCapacity: 1024,
      subnetIds: [privateSubnets[0].subnetId],
      securityGroupIds: [fsxSg.securityGroupId],
      ontapConfiguration: {
        deploymentType: 'SINGLE_AZ_1',
        throughputCapacity: 128,
        automaticBackupRetentionDays: 0,
      },
      tags: [
        { key: 'Name', value: `${prefix}-ontap` },
        { key: 'Project', value: projectName },
        { key: 'Environment', value: environment },
      ],
    });

    // Storage Virtual Machine（SVM）
    // AD参加はCDKデプロイ後にCLIで実行する（SVM更新のタイミング制御のため）。
    // 手順: aws fsx update-storage-virtual-machine --storage-virtual-machine-id <SVM_ID> \
    //       --active-directory-configuration '{...}'
    const svmConfig: Record<string, any> = {
      fileSystemId: this.fileSystem.ref,
      name: `${prefix.replace(/[^a-zA-Z0-9]/g, '')}svm`,
      rootVolumeSecurityStyle: 'NTFS',
    };

    this.svm = new fsx.CfnStorageVirtualMachine(this, 'Svm', svmConfig as fsx.CfnStorageVirtualMachineProps);
    if (this.managedAd) {
      this.svm.addDependency(this.managedAd);
    }

    // データボリューム
    this.volume = new fsx.CfnVolume(this, 'DataVolume', {
      name: `${prefix.replace(/[^a-zA-Z0-9]/g, '')}data`,
      volumeType: 'ONTAP',
      ontapConfiguration: {
        junctionPath: '/data',
        sizeInMegabytes: '102400', // 100GB
        storageVirtualMachineId: this.svm.ref,
        storageEfficiencyEnabled: 'true',
        securityStyle: 'NTFS',
        tieringPolicy: {
          coolingPeriod: 31,
          name: 'AUTO',
        },
      },
    });

    // ========================================
    // S3バケット（Bedrock KBデータソース / FSx S3 AP経由のフォールバック）
    // ========================================
    this.dataBucket = new s3.Bucket(this, 'DataBucket', {
      bucketName: `${prefix}-kb-data-${cdk.Aws.ACCOUNT_ID}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: kmsKey ? s3.BucketEncryption.KMS : s3.BucketEncryption.S3_MANAGED,
      encryptionKey: kmsKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
    });

    // ========================================
    // DynamoDB テーブル
    // ========================================

    // 権限キャッシュテーブル（TTL: 5分）
    this.permissionCacheTable = new dynamodb.Table(this, 'PermissionCacheTable', {
      tableName: `${prefix}-permission-cache`,
      partitionKey: { name: 'cacheKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
      ...(kmsKey ? { encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED, encryptionKey: kmsKey } : {}),
    });

    // ユーザーアクセステーブル（userId → SIDリストのマッピング）
    this.userAccessTable = new dynamodb.Table(this, 'UserAccessTable', {
      tableName: `${prefix}-user-access`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      ...(kmsKey ? { encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED, encryptionKey: kmsKey } : {}),
    });

    // ========================================
    // FSx ONTAP S3 Access Point（カスタムリソース）
    // ========================================
    // S3 Access PointはCloudFormation未対応のため、カスタムリソースで作成。
    //
    // 設計判断:
    //   - ユーザータイプ: WINDOWS（SVMがNTFSセキュリティスタイルのため）
    //     → NTFS ACLに基づくファイルレベル認可が有効になる
    //   - ネットワークアクセス: Internet（Bedrock KBがVPCエンドポイント経由ではなく
    //     パブリックAPIでアクセスするため。IAMポリシーで認可を制御）
    //   - アクセスポイント名: ${prefix}-s3ap（一意性を確保）
    //
    // 参考: https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/accessing-data-via-s3-access-points.html
    const s3ApCreatorRole = new iam.Role(this, 'S3ApCreatorRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        FsxS3AccessPoint: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                'fsx:CreateAndAttachS3AccessPoint',
                'fsx:DetachAndDeleteS3AccessPoint',
                'fsx:DescribeVolumes',
                'fsx:DescribeStorageVirtualMachines',
                'fsx:DescribeS3AccessPoints',
              ],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              actions: [
                's3:CreateAccessPoint',
                's3:GetAccessPoint',
                's3:GetAccessPointPolicy',
                's3:DeleteAccessPoint',
                's3:PutAccessPointPolicy',
              ],
              resources: [`arn:aws:s3:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:accesspoint/*`],
            }),
          ],
        }),
      },
    });

    const s3ApName = `${prefix}-s3ap`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const s3ApCreatorFn = new lambda.Function(this, 'S3ApCreatorFn', {
      functionName: `${prefix}-fsx-s3ap-creator`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(10),
      role: s3ApCreatorRole,
      code: lambda.Code.fromInline(this.getS3ApCreatorCode()),
    });

    const s3ApResource = new cdk.CustomResource(this, 'FsxS3AccessPoint', {
      serviceToken: s3ApCreatorFn.functionArn,
      properties: {
        VolumeId: this.volume.ref,
        AccessPointName: s3ApName,
        // WINDOWS: NTFS ACLベースの認可（SVMのセキュリティスタイルと一致）
        FileSystemUserType: 'WINDOWS',
        // Internet: Bedrock KBがパブリックAPI経由でアクセス（IAMポリシーで認可制御）
        NetworkOrigin: 'Internet',
        Timestamp: Date.now().toString(),
      },
    });
    s3ApResource.node.addDependency(this.volume);

    s3ApCreatorFn.addPermission('CfnInvoke', {
      principal: new iam.ServicePrincipal('cloudformation.amazonaws.com'),
    });

    // ========================================
    // CloudTrail監査ログ（オプション）
    // ========================================
    if (enableCloudTrail) {
      const trailBucket = new s3.Bucket(this, 'TrailBucket', {
        bucketName: `${prefix}-cloudtrail-${cdk.Aws.ACCOUNT_ID}`,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        encryption: kmsKey ? s3.BucketEncryption.KMS : s3.BucketEncryption.S3_MANAGED,
        encryptionKey: kmsKey,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        lifecycleRules: [{ expiration: cdk.Duration.days(90) }],
      });

      const trail = new cloudtrail.Trail(this, 'AuditTrail', {
        trailName: `${prefix}-audit-trail`,
        bucket: trailBucket,
        isMultiRegionTrail: false,
        includeGlobalServiceEvents: false,
        enableFileValidation: true,
      });

      // Bedrock API呼び出しの監査
      trail.addEventSelector(cloudtrail.DataResourceType.LAMBDA_FUNCTION, ['arn:aws:lambda']);

      // S3データアクセスの監査
      trail.addEventSelector(cloudtrail.DataResourceType.S3_OBJECT, [
        `${this.dataBucket.bucketArn}/`,
      ]);

      new cdk.CfnOutput(this, 'CloudTrailName', {
        value: trail.trailArn,
        description: 'CloudTrail audit trail ARN',
      });
    }

    // ========================================
    // CloudFormation出力
    // ========================================
    new cdk.CfnOutput(this, 'FileSystemId', {
      value: this.fileSystem.ref,
      exportName: `${prefix}-FileSystemId`,
    });

    new cdk.CfnOutput(this, 'SvmId', {
      value: this.svm.attrStorageVirtualMachineId,
      exportName: `${prefix}-SvmId`,
    });

    new cdk.CfnOutput(this, 'VolumeId', {
      value: this.volume.ref,
      exportName: `${prefix}-VolumeId`,
    });

    new cdk.CfnOutput(this, 'DataBucketName', {
      value: this.dataBucket.bucketName,
      exportName: `${prefix}-DataBucketName`,
    });

    new cdk.CfnOutput(this, 'DataBucketArn', {
      value: this.dataBucket.bucketArn,
      exportName: `${prefix}-DataBucketArn`,
    });

    new cdk.CfnOutput(this, 'PermissionCacheTableName', {
      value: this.permissionCacheTable.tableName,
      exportName: `${prefix}-PermissionCacheTableName`,
    });

    new cdk.CfnOutput(this, 'UserAccessTableName', {
      value: this.userAccessTable.tableName,
      exportName: `${prefix}-UserAccessTableName`,
    });

    new cdk.CfnOutput(this, 'S3AccessPointName', {
      value: s3ApName,
      description: 'FSx ONTAP S3 Access Point name',
      exportName: `${prefix}-S3AccessPointName`,
    });

    // S3 AP出力: 空文字列はCloudFormationエクスポートで拒否されるため、
    // exportNameを使わず、出力のみにする（参照が必要な場合はSSMパラメータを使用）
    new cdk.CfnOutput(this, 'S3AccessPointAlias', {
      value: s3ApResource.getAttString('AccessPointAlias'),
      description: 'S3 Access Point alias (use as S3 bucket name in Bedrock KB). May be empty if creation was deferred.',
    });

    new cdk.CfnOutput(this, 'S3AccessPointArn', {
      value: s3ApResource.getAttString('AccessPointArn'),
      description: 'S3 Access Point ARN. May be empty if creation was deferred.',
    });

    if (this.managedAd) {
      new cdk.CfnOutput(this, 'ManagedAdId', {
        value: this.managedAd.ref,
        description: 'AWS Managed Microsoft AD Directory ID',
        exportName: `${prefix}-ManagedAdId`,
      });

      new cdk.CfnOutput(this, 'AdDomainName', {
        value: domainName,
        description: 'Active Directory domain name',
        exportName: `${prefix}-AdDomainName`,
      });
    }

    cdk.Tags.of(this).add('Project', projectName);
    cdk.Tags.of(this).add('Environment', environment);
  }

  /**
   * S3 Access Point作成用Lambdaのインラインコード
   * 
   * FSx ONTAP S3 Access Pointを作成・削除するカスタムリソースハンドラー。
   * - Create: CreateAndAttachS3AccessPoint APIを呼び出し
   * - Delete: DetachAndDeleteS3AccessPoint APIを呼び出し（ベストエフォート）
   * - Update: 既存APを削除して再作成
   */
  private getS3ApCreatorCode(): string {
    return `
const { FSxClient, DescribeVolumesCommand } = require('@aws-sdk/client-fsx');
const https = require('https');
const crypto = require('crypto');

// ========================================
// CloudFormation レスポンス送信
// ========================================
async function sendCfnResponse(event, status, physicalId, data, reason) {
  const responseBody = JSON.stringify({
    Status: status,
    Reason: reason || '',
    PhysicalResourceId: physicalId || 'fsx-s3-ap',
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: data || {},
  });
  const parsedUrl = new URL(event.ResponseURL);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'PUT',
      headers: { 'Content-Type': '', 'Content-Length': Buffer.byteLength(responseBody) },
    }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
    req.on('error', reject);
    req.write(responseBody);
    req.end();
  });
}

// ========================================
// SigV4署名付きHTTPリクエスト（FSx API呼び出し用）
// ========================================
function hmac(key, data) { return crypto.createHmac('sha256', key).update(data).digest(); }
function sha256(data) { return crypto.createHash('sha256').update(data).digest('hex'); }

function getSignatureKey(key, dateStamp, region, service) {
  return hmac(hmac(hmac(hmac('AWS4' + key, dateStamp), region), service), 'aws4_request');
}

async function signedFsxRequest(method, action, body, region) {
  const host = 'fsx.' + region + '.amazonaws.com';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dateStamp = amzDate.substring(0, 8);
  const bodyStr = JSON.stringify(body);
  const payloadHash = sha256(bodyStr);
  const token = process.env.AWS_SESSION_TOKEN || '';
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;

  const hdrs = [
    ['content-type', 'application/x-amz-json-1.1'],
    ['host', host],
    ['x-amz-content-sha256', payloadHash],
    ['x-amz-date', amzDate],
    ['x-amz-target', 'AWSSimbaAPIService_v20180301.' + action],
  ];
  if (token) hdrs.push(['x-amz-security-token', token]);
  hdrs.sort((a, b) => a[0].localeCompare(b[0]));

  const canonicalHeaders = hdrs.map(h => h[0] + ':' + h[1] + '\\n').join('');
  const signedHeaders = hdrs.map(h => h[0]).join(';');
  const canonicalRequest = [method, '/', '', canonicalHeaders, signedHeaders, payloadHash].join('\\n');
  const scope = dateStamp + '/' + region + '/fsx/aws4_request';
  const stringToSign = 'AWS4-HMAC-SHA256\\n' + amzDate + '\\n' + scope + '\\n' + sha256(canonicalRequest);
  const sigKey = getSignatureKey(secretKey, dateStamp, region, 'fsx');
  const signature = crypto.createHmac('sha256', sigKey).update(stringToSign).digest('hex');

  const headers = {};
  hdrs.forEach(h => { headers[h[0]] = h[1]; });
  headers['Authorization'] = 'AWS4-HMAC-SHA256 Credential=' + accessKey + '/' + scope +
    ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;

  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: host, port: 443, path: '/', method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ statusCode: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// ========================================
// メインハンドラー
// ========================================
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));
  const region = process.env.AWS_REGION;
  const props = event.ResourceProperties;
  const volumeId = props.VolumeId;
  const apName = props.AccessPointName;
  const userType = props.FileSystemUserType || 'WINDOWS';
  const networkOrigin = props.NetworkOrigin || 'Internet';

  try {
    // ========================================
    // DELETE: S3 Access Pointの削除
    // ========================================
    if (event.RequestType === 'Delete') {
      console.log('Deleting S3 Access Point (best effort)...');
      try {
        // PhysicalResourceIdからAP ARNを取得
        const physicalId = event.PhysicalResourceId || '';
        if (physicalId.startsWith('arn:aws:s3:')) {
          const resp = await signedFsxRequest('POST', 'DetachAndDeleteS3AccessPoint', {
            S3AccessPointArn: physicalId,
          }, region);
          console.log('Delete response:', JSON.stringify(resp));
        }
      } catch (delErr) {
        console.warn('Delete failed (best effort):', delErr.message);
      }
      await sendCfnResponse(event, 'SUCCESS', event.PhysicalResourceId || 'fsx-s3-ap-deleted');
      return;
    }

    // ========================================
    // CREATE / UPDATE: S3 Access Pointの作成
    // ========================================
    console.log('Creating FSx ONTAP S3 Access Point:', {
      volumeId, apName, userType, networkOrigin,
    });

    // Updateの場合、既存APを削除してから再作成
    if (event.RequestType === 'Update' && event.PhysicalResourceId) {
      const oldPhysicalId = event.PhysicalResourceId;
      if (oldPhysicalId.startsWith('arn:aws:s3:')) {
        console.log('Update: deleting old AP:', oldPhysicalId);
        try {
          await signedFsxRequest('POST', 'DetachAndDeleteS3AccessPoint', {
            S3AccessPointArn: oldPhysicalId,
          }, region);
          // 削除完了を待機
          await new Promise(r => setTimeout(r, 10000));
        } catch (e) {
          console.warn('Old AP delete failed (continuing):', e.message);
        }
      }
    }

    // S3 Access Point作成
    const s3ApConfig = {
      Name: apName,
      FileSystemUserType: userType,
    };
    // VPCアクセスの場合はNetworkOriginを設定（Internetの場合は省略）
    if (networkOrigin === 'Vpc') {
      s3ApConfig.NetworkOrigin = 'Vpc';
    }

    const createResp = await signedFsxRequest('POST', 'CreateAndAttachS3AccessPoint', {
      VolumeId: volumeId,
      S3AccessPointConfiguration: s3ApConfig,
    }, region);

    console.log('Create response:', JSON.stringify(createResp));

    if (createResp.statusCode >= 200 && createResp.statusCode < 300) {
      const apArn = createResp.body?.S3AccessPointArn || '';
      const apAlias = createResp.body?.S3AccessPointAlias || '';
      console.log('S3 Access Point created:', { apArn, apAlias });

      await sendCfnResponse(event, 'SUCCESS', apArn, {
        AccessPointArn: apArn,
        AccessPointAlias: apAlias,
        AccessPointName: apName,
        VolumeId: volumeId,
        FileSystemUserType: userType,
        NetworkOrigin: networkOrigin,
      });
    } else {
      const errMsg = JSON.stringify(createResp.body);
      console.error('Create failed:', errMsg);

      // API未対応やリージョン制限の場合はフォールバック
      // （S3 AP作成失敗でもスタック全体は失敗させない）
      // 注意: CloudFormationは空文字列のOutputを拒否するため、プレースホルダー値を返す
      console.warn('Falling back: S3 AP creation deferred to post-deploy step');
      const fallbackId = 'fsx-s3-ap-deferred-' + volumeId;
      await sendCfnResponse(event, 'SUCCESS', fallbackId, {
        AccessPointArn: 'NOT_CREATED',
        AccessPointAlias: 'NOT_CREATED',
        AccessPointName: apName,
        VolumeId: volumeId,
        Message: 'S3 AP creation deferred. Use CLI: aws fsx create-and-attach-s3-access-point --volume-id ' + volumeId,
        Error: errMsg,
      });
    }
  } catch (err) {
    console.error('Handler error:', err);
    // スタック全体を失敗させないためSUCCESSを返す（S3 APは後から手動作成可能）
    // 注意: CloudFormationは空文字列のOutputを拒否するため、プレースホルダー値を返す
    const fallbackId = 'fsx-s3-ap-error-' + (volumeId || 'unknown');
    await sendCfnResponse(event, 'SUCCESS', fallbackId, {
      AccessPointArn: 'NOT_CREATED',
      AccessPointAlias: 'NOT_CREATED',
      Message: 'S3 AP creation failed: ' + err.message + '. Create manually post-deploy.',
    });
  }
};
    `;
  }

}
