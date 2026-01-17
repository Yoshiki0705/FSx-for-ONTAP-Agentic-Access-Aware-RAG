/**
 * シンプルなOpenSearchスタック
 * 
 * 開発環境用の最小構成OpenSearchドメイン
 */

import * as cdk from 'aws-cdk-lib';
import * as opensearch from 'aws-cdk-lib/aws-opensearchserverless';
import * as es from 'aws-cdk-lib/aws-elasticsearch';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface SimpleOpenSearchStackProps extends cdk.StackProps {
  /** 環境名 */
  readonly environment: string;
  
  /** プロジェクト名 */
  readonly projectName: string;
}

export class SimpleOpenSearchStack extends cdk.Stack {
  public readonly domain: es.Domain;

  constructor(scope: Construct, id: string, props: SimpleOpenSearchStackProps) {
    super(scope, id, props);

    // ドメイン名生成（短縮版）
    const domainName = `${props.projectName}-${props.environment}`.substring(0, 28);

    // ElasticSearchドメイン作成
    this.domain = new es.Domain(this, 'OpenSearchDomain', {
      domainName: domainName,
      version: es.ElasticsearchVersion.V7_10,
      
      // 開発環境用最小構成
      capacity: {
        dataNodes: 1,
        dataNodeInstanceType: 't3.small.elasticsearch',
      },

      // ストレージ設定
      ebs: {
        enabled: true,
        volumeType: cdk.aws_ec2.EbsDeviceVolumeType.GP3,
        volumeSize: 20,
      },

      // セキュリティ設定
      encryptionAtRest: {
        enabled: true,
      },
      nodeToNodeEncryption: true,
      enforceHttps: true,

      // パブリックアクセス（開発環境用）
      vpc: undefined,

      // 削除ポリシー
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // アクセスポリシー設定
    this.domain.addAccessPolicies(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.AccountRootPrincipal()],
        actions: ['es:*'],
        resources: [this.domain.domainArn + '/*'],
      })
    );

    // CloudFormation出力
    new cdk.CfnOutput(this, 'OpenSearchDomainEndpoint', {
      value: this.domain.domainEndpoint,
      description: 'OpenSearch domain endpoint',
      exportName: `${this.stackName}-DomainEndpoint`,
    });

    new cdk.CfnOutput(this, 'OpenSearchDomainName', {
      value: this.domain.domainName,
      description: 'OpenSearch domain name',
      exportName: `${this.stackName}-DomainName`,
    });

    new cdk.CfnOutput(this, 'OpenSearchKibanaEndpoint', {
      value: `${this.domain.domainEndpoint}/_dashboards/`,
      description: 'OpenSearch Kibana endpoint',
      exportName: `${this.stackName}-KibanaEndpoint`,
    });

    // タグ設定
    cdk.Tags.of(this).add('Environment', props.environment);
    cdk.Tags.of(this).add('ProjectName', props.projectName);
    cdk.Tags.of(this).add('Component', 'OpenSearch');
    cdk.Tags.of(this).add('Purpose', 'MultimodalEmbedding');
  }
}