import { Repository } from "aws-cdk-lib/aws-ecr";
import { Construct } from "constructs";
interface EcrProps {
    path: string;
    tag: string;
}
export declare class ECR extends Construct {
    readonly repository: Repository;
    constructor(scope: Construct, id: string, props: EcrProps);
}
export {};
