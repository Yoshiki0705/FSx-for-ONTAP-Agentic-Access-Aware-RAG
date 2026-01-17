import { Construct } from 'constructs';
import { ApiConfig } from '../interfaces/api-config';
export interface ApiConstructProps {
    config: ApiConfig;
}
export declare class ApiConstruct extends Construct {
    constructor(scope: Construct, id: string, props: ApiConstructProps);
}
