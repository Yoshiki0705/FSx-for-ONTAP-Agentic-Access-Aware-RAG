/**
 * セキュリティメトリクスダッシュボード
 * VPC Endpoint、Cognito認証、Lambda VPC接続のメトリクスを可視化
 */

import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface SecurityMetricsDashboardProps {
  /**
   * ダッシュボード名
   */
  dashboardName: string;

  /**
   * プロジェクト名
   */
  projectName: string;

  /**
   * 環境名
   */
  environment: string;

  /**
   * VPC Endpoint（オプション）
   */
  vpcEndpoint?: ec2.IInterfaceVpcEndpoint;

  /**
   * Lambda関数リスト（オプション）
   */
  lambdaFunctions?: lambda.IFunction[];

  /**
   * Cognito User Pool ID（オプション）
   */
  cognitoUserPoolId?: string;

  /**
   * リージョン
   */
  region: string;
}

export class SecurityMetricsDashboard extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: SecurityMetricsDashboardProps) {
    super(scope, id);

    // CloudWatchダッシュボード作成
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: props.dashboardName,
    });

    // ウィジェット配列
    const widgets: cloudwatch.IWidget[] = [];

    // タイトルウィジェット
    widgets.push(
      new cloudwatch.TextWidget({
        markdown: `# ${props.projectName} セキュリティメトリクス\n環境: ${props.environment}\n更新: ${new Date().toISOString()}`,
        width: 24,
        height: 2,
      })
    );

    // VPC Endpointメトリクス（存在する場合）
    if (props.vpcEndpoint) {
      widgets.push(...this.createVpcEndpointWidgets(props));
    }

    // Cognitoメトリクス（User Pool IDが指定されている場合）
    if (props.cognitoUserPoolId) {
      widgets.push(...this.createCognitoWidgets(props));
    }

    // Lambda VPC接続メトリクス（Lambda関数が指定されている場合）
    if (props.lambdaFunctions && props.lambdaFunctions.length > 0) {
      widgets.push(...this.createLambdaVpcWidgets(props));
    }

    // 全ウィジェットをダッシュボードに追加
    widgets.forEach((widget) => {
      this.dashboard.addWidgets(widget);
    });
  }

  /**
   * VPC Endpointメトリクスウィジェット作成
   */
  private createVpcEndpointWidgets(props: SecurityMetricsDashboardProps): cloudwatch.IWidget[] {
    const widgets: cloudwatch.IWidget[] = [];

    // セクションタイトル
    widgets.push(
      new cloudwatch.TextWidget({
        markdown: '## VPC Endpoint メトリクス',
        width: 24,
        height: 1,
      })
    );

    // VPC Endpoint接続数
    const connectionMetric = new cloudwatch.Metric({
      namespace: 'AWS/PrivateLink',
      metricName: 'ActiveConnections',
      dimensionsMap: {
        VpcEndpointId: props.vpcEndpoint!.vpcEndpointId,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // VPC Endpointバイト数（送信）
    const bytesOutMetric = new cloudwatch.Metric({
      namespace: 'AWS/PrivateLink',
      metricName: 'BytesProcessed',
      dimensionsMap: {
        VpcEndpointId: props.vpcEndpoint!.vpcEndpointId,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // VPC Endpointパケット数
    const packetsMetric = new cloudwatch.Metric({
      namespace: 'AWS/PrivateLink',
      metricName: 'PacketsProcessed',
      dimensionsMap: {
        VpcEndpointId: props.vpcEndpoint!.vpcEndpointId,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // グラフウィジェット
    widgets.push(
      new cloudwatch.GraphWidget({
        title: 'VPC Endpoint - アクティブ接続数',
        left: [connectionMetric],
        width: 12,
        height: 6,
        leftYAxis: {
          label: '接続数',
          showUnits: false,
        },
      })
    );

    widgets.push(
      new cloudwatch.GraphWidget({
        title: 'VPC Endpoint - データ転送量',
        left: [bytesOutMetric],
        width: 12,
        height: 6,
        leftYAxis: {
          label: 'バイト',
          showUnits: false,
        },
      })
    );

    widgets.push(
      new cloudwatch.GraphWidget({
        title: 'VPC Endpoint - パケット数',
        left: [packetsMetric],
        width: 12,
        height: 6,
        leftYAxis: {
          label: 'パケット',
          showUnits: false,
        },
      })
    );

    return widgets;
  }

  /**
   * Cognitoメトリクスウィジェット作成
   */
  private createCognitoWidgets(props: SecurityMetricsDashboardProps): cloudwatch.IWidget[] {
    const widgets: cloudwatch.IWidget[] = [];

    // セクションタイトル
    widgets.push(
      new cloudwatch.TextWidget({
        markdown: '## Cognito 認証メトリクス',
        width: 24,
        height: 1,
      })
    );

    // サインイン成功数
    const signInSuccessMetric = new cloudwatch.Metric({
      namespace: 'AWS/Cognito',
      metricName: 'UserAuthentication',
      dimensionsMap: {
        UserPool: props.cognitoUserPoolId!,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // サインイン失敗数
    const signInFailureMetric = new cloudwatch.Metric({
      namespace: 'AWS/Cognito',
      metricName: 'UserAuthenticationFailure',
      dimensionsMap: {
        UserPool: props.cognitoUserPoolId!,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // トークンリフレッシュ数
    const tokenRefreshMetric = new cloudwatch.Metric({
      namespace: 'AWS/Cognito',
      metricName: 'TokenRefreshSuccesses',
      dimensionsMap: {
        UserPool: props.cognitoUserPoolId!,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // グラフウィジェット
    widgets.push(
      new cloudwatch.GraphWidget({
        title: 'Cognito - 認証成功/失敗',
        left: [signInSuccessMetric, signInFailureMetric],
        width: 12,
        height: 6,
        leftYAxis: {
          label: '回数',
          showUnits: false,
        },
      })
    );

    widgets.push(
      new cloudwatch.GraphWidget({
        title: 'Cognito - トークンリフレッシュ',
        left: [tokenRefreshMetric],
        width: 12,
        height: 6,
        leftYAxis: {
          label: '回数',
          showUnits: false,
        },
      })
    );

    // 認証失敗率の計算メトリクス
    const failureRateMetric = new cloudwatch.MathExpression({
      expression: '(m2 / (m1 + m2)) * 100',
      usingMetrics: {
        m1: signInSuccessMetric,
        m2: signInFailureMetric,
      },
      label: '認証失敗率 (%)',
      period: cdk.Duration.minutes(5),
    });

    widgets.push(
      new cloudwatch.GraphWidget({
        title: 'Cognito - 認証失敗率',
        left: [failureRateMetric],
        width: 12,
        height: 6,
        leftYAxis: {
          label: '失敗率 (%)',
          showUnits: false,
        },
      })
    );

    return widgets;
  }

  /**
   * Lambda VPC接続メトリクスウィジェット作成
   */
  private createLambdaVpcWidgets(props: SecurityMetricsDashboardProps): cloudwatch.IWidget[] {
    const widgets: cloudwatch.IWidget[] = [];

    // セクションタイトル
    widgets.push(
      new cloudwatch.TextWidget({
        markdown: '## Lambda VPC 接続メトリクス',
        width: 24,
        height: 1,
      })
    );

    props.lambdaFunctions!.forEach((fn, index) => {
      // Lambda実行時間
      const durationMetric = fn.metricDuration({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      });

      // Lambda エラー数
      const errorsMetric = fn.metricErrors({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Lambda スロットル数
      const throttlesMetric = fn.metricThrottles({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Lambda 同時実行数
      const concurrentExecutionsMetric = fn.metricInvocations({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // グラフウィジェット
      widgets.push(
        new cloudwatch.GraphWidget({
          title: `Lambda - ${fn.functionName} - 実行時間`,
          left: [durationMetric],
          width: 12,
          height: 6,
          leftYAxis: {
            label: 'ミリ秒',
            showUnits: false,
          },
        })
      );

      widgets.push(
        new cloudwatch.GraphWidget({
          title: `Lambda - ${fn.functionName} - エラー/スロットル`,
          left: [errorsMetric, throttlesMetric],
          width: 12,
          height: 6,
          leftYAxis: {
            label: '回数',
            showUnits: false,
          },
        })
      );
    });

    return widgets;
  }
}
