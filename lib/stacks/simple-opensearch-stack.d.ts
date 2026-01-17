/**
 * シンプルなOpenSearchスタック
 *
 * 開発環境用の最小構成OpenSearchドメイン
 */
import * as cdk from 'aws-cdk-lib';
import * as es from 'aws-cdk-lib/aws-elasticsearch';
import { Construct } from 'constructs';
export interface SimpleOpenSearchStackProps extends cdk.StackProps {
    /** 環境名 */
    readonly environment: string;
    /** プロジェクト名 */
    readonly projectName: string;
}
export declare class SimpleOpenSearchStack extends cdk.Stack {
    readonly domain: es.Domain;
    constructor(scope: Construct, id: string, props: SimpleOpenSearchStackProps);
}
