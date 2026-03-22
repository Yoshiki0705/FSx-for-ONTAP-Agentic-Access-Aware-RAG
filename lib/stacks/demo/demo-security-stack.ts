/**
 * DemoSecurityStack
 * 
 * デモ環境用Cognito User Pool・User Pool Clientを作成する。
 * selfSignUpDisabled、email認証、userPassword + userSrp認証フロー。
 */

import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface DemoSecurityStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
}

export class DemoSecurityStack extends cdk.Stack {
  /** Cognito User Pool */
  public readonly userPool: cognito.UserPool;
  /** Cognito User Pool Client */
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: DemoSecurityStackProps) {
    super(scope, id, props);

    const { projectName, environment } = props;
    const prefix = `${projectName}-${environment}`;

    // Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${prefix}-user-pool`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // User Pool Client
    this.userPoolClient = this.userPool.addClient('WebAppClient', {
      userPoolClientName: `${prefix}-webapp-client`,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      preventUserExistenceErrors: true,
    });

    // CloudFormation出力
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: `${prefix}-UserPoolId`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      exportName: `${prefix}-UserPoolClientId`,
    });

    cdk.Tags.of(this).add('Project', projectName);
    cdk.Tags.of(this).add('Environment', environment);
  }
}
