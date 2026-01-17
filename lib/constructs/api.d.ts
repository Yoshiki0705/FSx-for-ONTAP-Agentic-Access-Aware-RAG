import { LambdaRestApi } from "aws-cdk-lib/aws-apigateway";
import { Function } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { TableV2 } from "aws-cdk-lib/aws-dynamodb";
import { ChatAppConfig } from "../../types/type";
interface ApiProps extends ChatAppConfig {
    db: TableV2;
    collectionName: string;
}
export declare class Api extends Construct {
    readonly restApi: LambdaRestApi;
    readonly lambda: Function;
    constructor(scope: Construct, id: string, props: ApiProps);
}
export {};
