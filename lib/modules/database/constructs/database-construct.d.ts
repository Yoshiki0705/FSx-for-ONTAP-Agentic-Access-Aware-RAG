import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { DatabaseConfig } from '../interfaces/database-config';
export interface DatabaseConstructProps {
    config: DatabaseConfig;
    projectName?: string;
    environment?: string;
    kmsKey?: any;
}
export interface DatabaseOutputs {
    dynamoDbTables?: {
        [key: string]: dynamodb.ITable;
    };
    openSearchEndpoint?: string;
    openSearchDomainArn?: string;
    openSearchDomainId?: string;
}
export declare class DatabaseConstruct extends Construct {
    readonly outputs: DatabaseOutputs;
    private openSearchConstruct?;
    constructor(scope: Construct, id: string, props: DatabaseConstructProps);
}
