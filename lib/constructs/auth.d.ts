import { Construct } from "constructs";
import { Duration, aws_cognito } from "aws-cdk-lib";
export interface AuthProps {
    userName: string;
    userEmail: string;
    refreshTokenValidity?: Duration;
}
export interface CognitoParams {
    userPoolId: string;
    userPoolClientId: string;
    identityPoolId: string;
}
export declare class Auth extends Construct {
    readonly cognitoParams: CognitoParams;
    readonly userPool: aws_cognito.UserPool;
    constructor(scope: Construct, id: string, props: AuthProps);
}
