/**
 * Security Stack
 * セキュリティ統合スタック
 *
 * 統合機能:
 * - 認証、認可、WAF、暗号化
 */
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SecurityConfig } from '../modules/security/interfaces';
export interface SecurityStackProps extends StackProps {
    config: SecurityConfig;
    projectName: string;
    environment: string;
}
export declare class SecurityStack extends Stack {
    readonly userPool?: any;
    readonly identityPool?: any;
    readonly webAcl?: any;
    readonly kmsKey?: any;
    constructor(scope: Construct, id: string, props: SecurityStackProps);
    private createCognitoAuth;
    private createWaf;
    private createKmsKey;
    private applyComplianceSettings;
}
