/**
 * 本番環境リソースID管理
 */
export declare const ProductionResourceIds: {
    vpc: {
        id: string;
        cidr: string;
    };
    subnets: {
        public: string[];
        private: string[];
    };
    securityGroups: {
        lambda: string;
        fsx: string;
        opensearch: string;
    };
};
export type ProductionResourceIdsType = typeof ProductionResourceIds;
