"use strict";
/**
 * NetworkingConfig アダプター
 *
 * EnvironmentConfigのnetworking設定をNetworkingConfigインターフェースに変換
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.adaptNetworkingConfig = adaptNetworkingConfig;
/**
 * EnvironmentConfigからNetworkingConfigを生成
 */
function adaptNetworkingConfig(envConfig) {
    const networking = envConfig.networking || {};
    return {
        vpcCidr: networking.vpcCidr || '10.0.0.0/16',
        maxAzs: networking.availabilityZones || 3,
        enablePublicSubnets: true, // デフォルトで有効
        enablePrivateSubnets: true, // デフォルトで有効
        enableIsolatedSubnets: false, // デフォルトで無効
        enableNatGateway: networking.natGateways?.enabled ?? true,
        vpcEndpoints: {
            s3: true,
            dynamodb: true,
            lambda: true,
            opensearch: true
        },
        securityGroups: {
            web: true,
            api: true,
            database: true,
            lambda: true
        },
        enableDnsHostnames: networking.enableDnsHostnames ?? true,
        enableDnsSupport: networking.enableDnsSupport ?? true,
        enableFlowLogs: networking.enableVpcFlowLogs ?? true
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV0d29ya2luZy1jb25maWctYWRhcHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm5ldHdvcmtpbmctY29uZmlnLWFkYXB0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7O0FBT0gsc0RBMEJDO0FBN0JEOztHQUVHO0FBQ0gsU0FBZ0IscUJBQXFCLENBQUMsU0FBYztJQUNsRCxNQUFNLFVBQVUsR0FBRyxTQUFTLENBQUMsVUFBVSxJQUFJLEVBQUUsQ0FBQztJQUU5QyxPQUFPO1FBQ0wsT0FBTyxFQUFFLFVBQVUsQ0FBQyxPQUFPLElBQUksYUFBYTtRQUM1QyxNQUFNLEVBQUUsVUFBVSxDQUFDLGlCQUFpQixJQUFJLENBQUM7UUFDekMsbUJBQW1CLEVBQUUsSUFBSSxFQUFFLFdBQVc7UUFDdEMsb0JBQW9CLEVBQUUsSUFBSSxFQUFFLFdBQVc7UUFDdkMscUJBQXFCLEVBQUUsS0FBSyxFQUFFLFdBQVc7UUFDekMsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLFdBQVcsRUFBRSxPQUFPLElBQUksSUFBSTtRQUN6RCxZQUFZLEVBQUU7WUFDWixFQUFFLEVBQUUsSUFBSTtZQUNSLFFBQVEsRUFBRSxJQUFJO1lBQ2QsTUFBTSxFQUFFLElBQUk7WUFDWixVQUFVLEVBQUUsSUFBSTtTQUNqQjtRQUNELGNBQWMsRUFBRTtZQUNkLEdBQUcsRUFBRSxJQUFJO1lBQ1QsR0FBRyxFQUFFLElBQUk7WUFDVCxRQUFRLEVBQUUsSUFBSTtZQUNkLE1BQU0sRUFBRSxJQUFJO1NBQ2I7UUFDRCxrQkFBa0IsRUFBRSxVQUFVLENBQUMsa0JBQWtCLElBQUksSUFBSTtRQUN6RCxnQkFBZ0IsRUFBRSxVQUFVLENBQUMsZ0JBQWdCLElBQUksSUFBSTtRQUNyRCxjQUFjLEVBQUUsVUFBVSxDQUFDLGlCQUFpQixJQUFJLElBQUk7S0FDckQsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIE5ldHdvcmtpbmdDb25maWcg44Ki44OA44OX44K/44O8XG4gKiBcbiAqIEVudmlyb25tZW50Q29uZmln44GubmV0d29ya2luZ+ioreWumuOCkk5ldHdvcmtpbmdDb25maWfjgqTjg7Pjgr/jg7zjg5Xjgqfjg7zjgrnjgavlpInmj5tcbiAqL1xuXG5pbXBvcnQgeyBOZXR3b3JraW5nQ29uZmlnIH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9uZXR3b3JraW5nL2ludGVyZmFjZXMvbmV0d29ya2luZy1jb25maWcnO1xuXG4vKipcbiAqIEVudmlyb25tZW50Q29uZmln44GL44KJTmV0d29ya2luZ0NvbmZpZ+OCkueUn+aIkFxuICovXG5leHBvcnQgZnVuY3Rpb24gYWRhcHROZXR3b3JraW5nQ29uZmlnKGVudkNvbmZpZzogYW55KTogTmV0d29ya2luZ0NvbmZpZyB7XG4gIGNvbnN0IG5ldHdvcmtpbmcgPSBlbnZDb25maWcubmV0d29ya2luZyB8fCB7fTtcbiAgXG4gIHJldHVybiB7XG4gICAgdnBjQ2lkcjogbmV0d29ya2luZy52cGNDaWRyIHx8ICcxMC4wLjAuMC8xNicsXG4gICAgbWF4QXpzOiBuZXR3b3JraW5nLmF2YWlsYWJpbGl0eVpvbmVzIHx8IDMsXG4gICAgZW5hYmxlUHVibGljU3VibmV0czogdHJ1ZSwgLy8g44OH44OV44Kp44Or44OI44Gn5pyJ5Yq5XG4gICAgZW5hYmxlUHJpdmF0ZVN1Ym5ldHM6IHRydWUsIC8vIOODh+ODleOCqeODq+ODiOOBp+acieWKuVxuICAgIGVuYWJsZUlzb2xhdGVkU3VibmV0czogZmFsc2UsIC8vIOODh+ODleOCqeODq+ODiOOBp+eEoeWKuVxuICAgIGVuYWJsZU5hdEdhdGV3YXk6IG5ldHdvcmtpbmcubmF0R2F0ZXdheXM/LmVuYWJsZWQgPz8gdHJ1ZSxcbiAgICB2cGNFbmRwb2ludHM6IHtcbiAgICAgIHMzOiB0cnVlLFxuICAgICAgZHluYW1vZGI6IHRydWUsXG4gICAgICBsYW1iZGE6IHRydWUsXG4gICAgICBvcGVuc2VhcmNoOiB0cnVlXG4gICAgfSxcbiAgICBzZWN1cml0eUdyb3Vwczoge1xuICAgICAgd2ViOiB0cnVlLFxuICAgICAgYXBpOiB0cnVlLFxuICAgICAgZGF0YWJhc2U6IHRydWUsXG4gICAgICBsYW1iZGE6IHRydWVcbiAgICB9LFxuICAgIGVuYWJsZURuc0hvc3RuYW1lczogbmV0d29ya2luZy5lbmFibGVEbnNIb3N0bmFtZXMgPz8gdHJ1ZSxcbiAgICBlbmFibGVEbnNTdXBwb3J0OiBuZXR3b3JraW5nLmVuYWJsZURuc1N1cHBvcnQgPz8gdHJ1ZSxcbiAgICBlbmFibGVGbG93TG9nczogbmV0d29ya2luZy5lbmFibGVWcGNGbG93TG9ncyA/PyB0cnVlXG4gIH07XG59XG4iXX0=