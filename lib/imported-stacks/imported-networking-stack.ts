import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import { Construct } from "constructs";

export class ImportedNetworkingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // API Gateway（インポート用）
    const api = new apigateway.RestApi(this, "ImportedRagApi", {
      restApiName: "imported-rag-api",
      description: "Imported RAG API Gateway",
      deployOptions: {
        stageName: "prod",
        throttlingBurstLimit: 1000,
        throttlingRateLimit: 500,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["Content-Type", "X-Amz-Date", "Authorization", "X-Api-Key"],
      },
    });

    // CloudFrontディストリビューション（インポート用）
    const distribution = new cloudfront.Distribution(this, "ImportedRagDistribution", {
      defaultBehavior: {
        origin: new origins.RestApiOrigin(api),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      enabled: true,
      comment: "Imported RAG system CloudFront distribution",
    });

    // 出力
    new cdk.CfnOutput(this, "ApiGatewayUrl", {
      value: api.url,
      description: "Imported API Gateway URL",
      exportName: `${this.stackName}-ApiGatewayUrl`,
    });

    new cdk.CfnOutput(this, "CloudFrontDomainName", {
      value: distribution.distributionDomainName,
      description: "Imported CloudFront domain name",
      exportName: `${this.stackName}-CloudFrontDomainName`,
    });

    new cdk.CfnOutput(this, "CloudFrontDistributionId", {
      value: distribution.distributionId,
      description: "Imported CloudFront distribution ID",
      exportName: `${this.stackName}-CloudFrontDistributionId`,
    });
  }
}