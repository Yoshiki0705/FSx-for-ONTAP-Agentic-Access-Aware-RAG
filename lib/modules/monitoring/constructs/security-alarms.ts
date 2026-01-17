/**
 * セキュリティアラーム設定
 * VPC Endpoint、Cognito認証、Lambda VPC接続のアラームを設定
 */

import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface SecurityAlarmsProps {
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
   * アラーム通知先SNSトピック（オプション）
   */
  alarmTopic?: sns.ITopic;

  /**
   * リージョン
   */
  region: string;
}

export class SecurityAlarms extends Construct {
  public readonly alarms: cloudwatch.Alarm[] = [];

  constructor(scope: Construct, id: string, props: SecurityAlarmsProps) {
    super(scope, id);

    // VPC Endpointアラーム（存在する場合）
    if (props.vpcEndpoint) {
      this.alarms.push(...this.createVpcEndpointAlarms(props));
    }

    // Cognitoアラーム（User Pool IDが指定されている場合）
    if (props.cognitoUserPoolId) {
      this.alarms.push(...this.createCognitoAlarms(props));
    }

    // Lambda VPC接続アラーム（Lambda関数が指定されている場合）
    if (props.lambdaFunctions && props.lambdaFunctions.length > 0) {
      this.alarms.push(...this.createLambdaVpcAlarms(props));
    }

    // SNSトピックが指定されている場合、全アラームにアクション追加
    if (props.alarmTopic) {
      this.alarms.forEach((alarm) => {
        alarm.addAlarmAction(new cloudwatch_actions.SnsAction(props.alarmTopic!));
      });
    }
  }

  /**
   * VPC Endpointアラーム作成
   */
  private createVpcEndpointAlarms(props: SecurityAlarmsProps): cloudwatch.Alarm[] {
    const alarms: cloudwatch.Alarm[] = [];

    // VPC Endpoint接続エラーアラーム
    // 注: PrivateLinkには直接的なエラーメトリクスがないため、
    // 接続数の急激な減少を検知
    const connectionMetric = new cloudwatch.Metric({
      namespace: 'AWS/PrivateLink',
      metricName: 'ActiveConnections',
      dimensionsMap: {
        VpcEndpointId: props.vpcEndpoint!.vpcEndpointId,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const connectionAlarm = new cloudwatch.Alarm(this, 'VpcEndpointConnectionAlarm', {
      alarmName: `${props.projectName}-${props.environment}-vpc-endpoint-connection-low`,
      alarmDescription: 'VPC Endpoint接続数が異常に低下しています',
      metric: connectionMetric,
      threshold: 1,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });

    alarms.push(connectionAlarm);

    return alarms;
  }

  /**
   * Cognitoアラーム作成
   */
  private createCognitoAlarms(props: SecurityAlarmsProps): cloudwatch.Alarm[] {
    const alarms: cloudwatch.Alarm[] = [];

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

    // 認証失敗率アラーム（20%以上）
    const failureRateMetric = new cloudwatch.MathExpression({
      expression: '(m2 / (m1 + m2)) * 100',
      usingMetrics: {
        m1: signInSuccessMetric,
        m2: signInFailureMetric,
      },
      label: '認証失敗率 (%)',
      period: cdk.Duration.minutes(5),
    });

    const failureRateAlarm = new cloudwatch.Alarm(this, 'CognitoFailureRateAlarm', {
      alarmName: `${props.projectName}-${props.environment}-cognito-failure-rate-high`,
      alarmDescription: 'Cognito認証失敗率が20%を超えています',
      metric: failureRateMetric,
      threshold: 20,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    alarms.push(failureRateAlarm);

    // 認証失敗数アラーム（絶対数：10回以上/5分）
    const failureCountAlarm = new cloudwatch.Alarm(this, 'CognitoFailureCountAlarm', {
      alarmName: `${props.projectName}-${props.environment}-cognito-failure-count-high`,
      alarmDescription: 'Cognito認証失敗数が異常に多くなっています（潜在的な攻撃の可能性）',
      metric: signInFailureMetric,
      threshold: 10,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    alarms.push(failureCountAlarm);

    return alarms;
  }

  /**
   * Lambda VPC接続アラーム作成
   */
  private createLambdaVpcAlarms(props: SecurityAlarmsProps): cloudwatch.Alarm[] {
    const alarms: cloudwatch.Alarm[] = [];

    props.lambdaFunctions!.forEach((fn) => {
      // Lambda VPC接続タイムアウトアラーム
      const durationMetric = fn.metricDuration({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      });

      // タイムアウトの80%を超えた場合にアラーム
      // 注: Lambda関数のタイムアウト設定を取得できないため、
      // 一般的な閾値（25秒 = 30秒タイムアウトの83%）を使用
      const durationAlarm = new cloudwatch.Alarm(this, `LambdaDurationAlarm-${fn.functionName}`, {
        alarmName: `${props.projectName}-${props.environment}-lambda-${fn.functionName}-duration-high`,
        alarmDescription: `Lambda関数 ${fn.functionName} の実行時間が長くなっています（VPC接続の問題の可能性）`,
        metric: durationMetric,
        threshold: 25000, // 25秒（ミリ秒）
        evaluationPeriods: 2,
        datapointsToAlarm: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      alarms.push(durationAlarm);

      // Lambda エラー率アラーム（5%以上）
      const errorsMetric = fn.metricErrors({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      const invocationsMetric = fn.metricInvocations({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      const errorRateMetric = new cloudwatch.MathExpression({
        expression: '(m1 / m2) * 100',
        usingMetrics: {
          m1: errorsMetric,
          m2: invocationsMetric,
        },
        label: 'エラー率 (%)',
        period: cdk.Duration.minutes(5),
      });

      const errorRateAlarm = new cloudwatch.Alarm(this, `LambdaErrorRateAlarm-${fn.functionName}`, {
        alarmName: `${props.projectName}-${props.environment}-lambda-${fn.functionName}-error-rate-high`,
        alarmDescription: `Lambda関数 ${fn.functionName} のエラー率が5%を超えています`,
        metric: errorRateMetric,
        threshold: 5,
        evaluationPeriods: 2,
        datapointsToAlarm: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      alarms.push(errorRateAlarm);

      // Lambda スロットルアラーム
      const throttlesMetric = fn.metricThrottles({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      const throttleAlarm = new cloudwatch.Alarm(this, `LambdaThrottleAlarm-${fn.functionName}`, {
        alarmName: `${props.projectName}-${props.environment}-lambda-${fn.functionName}-throttled`,
        alarmDescription: `Lambda関数 ${fn.functionName} がスロットルされています`,
        metric: throttlesMetric,
        threshold: 1,
        evaluationPeriods: 1,
        datapointsToAlarm: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      alarms.push(throttleAlarm);
    });

    return alarms;
  }
}
