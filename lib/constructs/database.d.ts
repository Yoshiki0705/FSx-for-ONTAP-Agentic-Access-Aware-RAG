import { TableV2 } from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import { DatabaseConfig } from "../../types/type";
export declare class Database extends Construct {
    readonly dynamo: TableV2;
    constructor(scope: Construct, id: string, props: DatabaseConfig);
}
