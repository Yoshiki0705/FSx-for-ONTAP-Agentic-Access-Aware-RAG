# Video Tutorial Script - English Version

## Introduction (2 minutes)

Hello and welcome to this comprehensive tutorial on deploying the Embedding Batch Workload template. This template provides a complete solution for running embedding generation workloads using AWS Batch, FSx for NetApp ONTAP, and Amazon Bedrock.

In this tutorial, we'll cover:
- Overview of the architecture and key components
- Multiple deployment methods: CDK and CloudFormation
- Configuration options for different use cases
- Testing and validation procedures
- Best practices and troubleshooting
- Production deployment considerations

## Architecture Overview (4 minutes)

Let me show you the high-level architecture of this solution.

[Screen: Architecture diagram]

The Embedding Batch Workload consists of several key components:

1. **AWS Batch**: Manages compute resources and job execution with auto-scaling capabilities
2. **FSx for NetApp ONTAP**: Provides high-performance shared storage with NFS access
3. **Amazon Bedrock**: Powers embedding generation using Titan and Claude models
4. **S3 and DynamoDB**: Store embeddings, metadata, and provide vector search capabilities
5. **CloudWatch and SNS**: Comprehensive monitoring, alerting, and auto-remediation
6. **Lambda Functions**: Handle document processing triggers and workflow orchestration

The enhanced workflow includes:
1. Documents are uploaded to FSx file system or S3
2. Lambda triggers initiate batch processing jobs
3. Batch jobs process documents and generate embeddings using Bedrock
4. Embeddings are stored in S3 with metadata in DynamoDB
5. Vector similarity search enables RAG query processing
6. Monitoring system tracks performance and triggers alerts
7. Auto-remediation handles common failure scenarios

This architecture provides enterprise-grade scalability, security, and reliability for production workloads.

## Prerequisites (3 minutes)

Before we begin, make sure you have:

1. **AWS CLI** installed and configured with appropriate permissions
2. **Node.js** (version 18 or later) for CDK deployment
3. **AWS CDK** installed globally: `npm install -g aws-cdk`
4. **jq** for JSON processing
5. **Appropriate AWS permissions** including:
   - IAM role creation and management
   - VPC and networking resources
   - Batch, Lambda, and Bedrock access
   - S3 and DynamoDB permissions

Let's verify these prerequisites:

```bash
aws --version
aws sts get-caller-identity
node --version
cdk --version
jq --version
```

You should also ensure that Amazon Bedrock is available in your target region and that you have the necessary model access permissions.

## Deployment Method 1: CDK (10 minutes)

### Step 1: Project Setup (2 minutes)

First, let's set up the CDK project:

```bash
cd embedding-batch-workload-template/cdk
npm install
npm run build
```

The CDK approach gives you the flexibility of programmatic infrastructure definition with TypeScript, making it ideal for developers who want to customize and extend the solution.

### Step 2: Configuration Options (4 minutes)

The template supports multiple configuration scenarios to meet different requirements:

#### Minimal Configuration (Development)
[Screen: Show minimal-config.json]

This configuration is perfect for development and testing:

```json
{
  "projectName": "embedding-workload",
  "environment": "dev",
  "region": "us-east-1",
  "vpc": {
    "create": true,
    "cidr": "10.0.0.0/16"
  },
  "fsx": {
    "create": true,
    "storageCapacity": 1024,
    "throughputCapacity": 128
  },
  "bedrock": {
    "region": "us-east-1",
    "embeddingModel": {
      "modelId": "amazon.titan-embed-text-v1"
    }
  },
  "monitoring": {
    "enableAlerts": false,
    "logRetentionDays": 7
  }
}
```

#### Production Configuration
[Screen: Show production-config.json]

For production environments, you'll want more robust settings:

```json
{
  "projectName": "embedding-workload",
  "environment": "prod",
  "vpc": {
    "create": false,
    "vpcId": "vpc-existing123",
    "privateSubnetIds": ["subnet-123", "subnet-456"]
  },
  "fsx": {
    "create": false,
    "fileSystemId": "fs-existing123"
  },
  "bedrock": {
    "embeddingModel": {
      "modelId": "amazon.titan-embed-text-v2"
    },
    "textModel": {
      "modelId": "amazon.nova-pro-v1:0"
    }
  },
  "monitoring": {
    "enableAlerts": true,
    "enableAutoRemediation": true,
    "alerting": {
      "contacts": [
        {
          "name": "Operations Team",
          "email": "ops@company.com",
          "severity": ["CRITICAL", "HIGH"]
        }
      ]
    }
  }
}
```

#### Multi-Account Enterprise Configuration
[Screen: Show multi-account-config.json]

This configuration supports cross-account deployments, advanced security, and compliance features for large enterprises.

### Step 3: Bootstrap and Deploy (4 minutes)

Bootstrap CDK (first time only):

```bash
cdk bootstrap
```

Deploy with your chosen configuration:

```bash
# Minimal deployment
cdk deploy --context configFile="../examples/cdk/minimal-config.json"

# Production deployment
cdk deploy --context configFile="../examples/cdk/production-config.json"

# Multi-account deployment
cdk deploy --context configFile="../examples/cdk/multi-account-config.json"
```

[Screen: Show deployment progress with resource creation]

The deployment creates:
- VPC and networking (if new)
- Batch compute environment and job queue
- Lambda functions for processing
- S3 buckets and DynamoDB tables
- Monitoring and alerting infrastructure
- IAM roles with least-privilege access

## Deployment Method 2: CloudFormation (8 minutes)

### Step 1: Template Overview (2 minutes)

For CloudFormation users, we provide comprehensive templates:

[Screen: Show cloudformation directory structure]

```
cloudformation/
├── templates/
│   ├── embedding-workload-stack.template.json
│   └── embedding-workload-stack-parameterized.template.json
├── parameters/
│   ├── dev-parameters.json
│   ├── prod-parameters.json
│   └── minimal-parameters.json
├── nested/
│   ├── master-stack.template.json
│   ├── networking-stack.template.json
│   └── embedding-stack.template.json
└── scripts/
    ├── deploy-cloudformation.sh
    └── deploy-nested-stacks.sh
```

### Step 2: Parameter Configuration (3 minutes)

#### Basic Parameters
[Screen: Show minimal-parameters.json]

```json
[
  {
    "ParameterKey": "ProjectName",
    "ParameterValue": "embedding-workload"
  },
  {
    "ParameterKey": "Environment",
    "ParameterValue": "dev"
  },
  {
    "ParameterKey": "BedrockModelId",
    "ParameterValue": "amazon.titan-embed-text-v1"
  },
  {
    "ParameterKey": "EnableAutoRemediation",
    "ParameterValue": "false"
  }
]
```

#### Existing Infrastructure Parameters
[Screen: Show existing-infrastructure-parameters.json]

When you have existing AWS infrastructure, you can integrate seamlessly:

```json
[
  {
    "ParameterKey": "VpcId",
    "ParameterValue": "vpc-0123456789abcdef0"
  },
  {
    "ParameterKey": "PrivateSubnetIds",
    "ParameterValue": "subnet-123,subnet-456"
  },
  {
    "ParameterKey": "FsxFileSystemId",
    "ParameterValue": "fs-0123456789abcdef0"
  }
]
```

### Step 3: Deployment Options (3 minutes)

#### Option 1: Basic Deployment Script
```bash
./cloudformation/scripts/deploy-cloudformation.sh \
  embedding-workload-dev \
  templates/embedding-workload-stack.template.json \
  dev
```

#### Option 2: AWS CLI Direct
```bash
aws cloudformation deploy \
  --template-file cloudformation/templates/embedding-workload-stack.template.json \
  --stack-name embedding-workload-dev \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --parameters file://cloudformation/parameters/dev-parameters.json
```

#### Option 3: Nested Stacks (Enterprise)
For large-scale deployments, use nested stacks:

```bash
./cloudformation/scripts/deploy-nested-stacks.sh \
  --create-bucket \
  embedding-workload-master \
  my-cloudformation-bucket \
  prod
```

[Screen: Show CloudFormation console with stack creation progress]

## Testing and Validation (6 minutes)

### Step 1: Resource Verification (2 minutes)

Let's verify all resources were created successfully:

```bash
# Batch resources
aws batch describe-job-queues --query 'jobQueues[?starts_with(jobQueueName, `embedding-workload`)]'
aws batch describe-compute-environments --query 'computeEnvironments[?starts_with(computeEnvironmentName, `embedding-workload`)]'

# Storage resources
aws s3 ls | grep embedding-workload
aws dynamodb list-tables --query 'TableNames[?starts_with(@, `embedding-workload`)]'

# Lambda functions
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `embedding-workload`)]'

# Monitoring resources
aws sns list-topics --query 'Topics[?contains(TopicArn, `embedding-workload`)]'
aws cloudwatch describe-alarms --query 'MetricAlarms[?starts_with(AlarmName, `embedding-workload`)]'
```

### Step 2: Functional Testing (2 minutes)

Submit a test document processing job:

```bash
# Create test document
echo "This is a test document for embedding generation using Amazon Bedrock." > test-document.txt

# Upload to S3 (triggers processing)
aws s3 cp test-document.txt s3://embedding-workload-dev-embeddings-123456789012/documents/

# Monitor job execution
aws batch list-jobs --job-queue embedding-workload-dev-job-queue --job-status RUNNING

# Check job logs
aws logs tail /aws/batch/job --follow
```

### Step 3: Monitoring Dashboard (2 minutes)

[Screen: Show CloudWatch dashboard]

The monitoring dashboard displays:
- Job execution metrics and success rates
- System resource utilization
- Error rates and latency metrics
- Cost tracking and optimization insights
- Alert status and escalation paths

Access the dashboard:
```bash
aws cloudwatch get-dashboard --dashboard-name embedding-workload-dev-dashboard
```

## Advanced Configuration and Customization (5 minutes)

### Multi-Region Deployment (2 minutes)

For global deployments, configure multiple regions:

```json
{
  "multiRegion": {
    "enabled": true,
    "primaryRegion": "us-east-1",
    "secondaryRegions": ["us-west-2", "eu-west-1"],
    "crossRegionReplication": true,
    "failoverStrategy": "automatic"
  }
}
```

This enables disaster recovery and improved global performance.

### Security Enhancements (2 minutes)

Production security features:

```json
{
  "security": {
    "enableVpcEndpoints": true,
    "enableCloudTrail": true,
    "enableGuardDuty": true,
    "iamRoles": {
      "crossAccountAccess": {
        "enabled": true,
        "trustedAccounts": ["123456789012"]
      }
    },
    "encryption": {
      "s3": "aws:kms",
      "dynamodb": "aws:kms",
      "kmsKeyId": "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012"
    }
  }
}
```

### Auto-Scaling Configuration (1 minute)

Configure dynamic scaling based on workload:

```json
{
  "batch": {
    "computeEnvironment": {
      "minvCpus": 0,
      "maxvCpus": 1000,
      "desiredvCpus": 10,
      "instanceTypes": ["optimal"],
      "spotFleetRequestRole": "arn:aws:iam::123456789012:role/aws-ec2-spot-fleet-tagging-role",
      "bidPercentage": 80
    }
  }
}
```

## Monitoring and Alerting Deep Dive (4 minutes)

### Alert Configuration (2 minutes)

[Screen: Show alert management interface]

The system includes comprehensive alerting:

- **Critical Alerts**: System down, high failure rates, data loss risks
- **High Priority**: Resource exhaustion, performance degradation
- **Medium Priority**: Long-running jobs, capacity warnings
- **Low Priority**: Informational metrics, usage patterns

Configure alert contacts:

```json
{
  "alerting": {
    "contacts": [
      {
        "name": "Primary Operations",
        "email": "ops-primary@company.com",
        "sms": "+1234567890",
        "severity": ["CRITICAL", "HIGH"],
        "schedule": {
          "businessHours": {
            "start": "09:00",
            "end": "17:00",
            "days": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
          }
        }
      }
    ],
    "integrations": {
      "slack": {
        "enabled": true,
        "webhookUrl": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
      },
      "pagerDuty": {
        "enabled": true,
        "integrationKey": "your-pagerduty-key"
      }
    }
  }
}
```

### Auto-Remediation (2 minutes)

The system can automatically respond to common issues:

- Scale up compute resources during high load
- Restart failed services and clear temporary issues
- Clear disk space and optimize resource usage
- Rebalance workloads across availability zones

[Screen: Show auto-remediation logs and actions]

## Best Practices and Optimization (4 minutes)

### Cost Optimization (2 minutes)

1. **Use Spot Instances**: Configure Spot Fleet for batch processing to reduce costs by up to 90%
2. **Right-Size Resources**: Monitor utilization and adjust instance types based on actual usage
3. **Lifecycle Policies**: Implement S3 lifecycle rules for automatic data archival
4. **Reserved Capacity**: Use Reserved Instances for predictable workloads

```json
{
  "storage": {
    "s3": {
      "lifecycleRules": [
        {
          "id": "EmbeddingsLifecycle",
          "transitions": [
            {"days": 30, "storageClass": "STANDARD_IA"},
            {"days": 90, "storageClass": "GLACIER"},
            {"days": 365, "storageClass": "DEEP_ARCHIVE"}
          ]
        }
      ]
    }
  }
}
```

### Performance Optimization (2 minutes)

1. **Batch Job Optimization**: Tune job parallelism and resource allocation
2. **FSx Performance**: Configure appropriate throughput capacity for your workload
3. **DynamoDB Optimization**: Use on-demand billing and global secondary indexes
4. **Bedrock Model Selection**: Choose appropriate models for your specific use case

Monitor key performance metrics:
- Job completion time
- Resource utilization rates
- Error rates and retry patterns
- Cost per processed document

## Troubleshooting Common Issues (3 minutes)

### Deployment Issues (1 minute)

1. **IAM Permissions**: Ensure comprehensive permissions for resource creation
   ```bash
   aws iam simulate-principal-policy --policy-source-arn arn:aws:iam::123456789012:user/username --action-names iam:CreateRole --resource-arns "*"
   ```

2. **Service Quotas**: Check and request quota increases if needed
   ```bash
   aws service-quotas get-service-quota --service-code batch --quota-code L-34E4B009
   ```

3. **Region Availability**: Verify all services are available in your region
4. **Resource Naming**: Avoid conflicts with existing resources

### Runtime Issues (1 minute)

1. **Job Failures**: Check CloudWatch logs for detailed error messages
2. **Performance Issues**: Monitor resource utilization and scaling metrics
3. **Network Connectivity**: Verify VPC configuration and security groups
4. **Bedrock Throttling**: Implement retry logic and rate limiting

### Monitoring and Debugging (1 minute)

Use the comprehensive logging and monitoring:

```bash
# Check job logs
aws logs describe-log-groups --log-group-name-prefix "/aws/batch/job"

# Monitor system metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Batch \
  --metric-name RunningJobs \
  --dimensions Name=JobQueue,Value=embedding-workload-dev-job-queue \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-01T23:59:59Z \
  --period 3600 \
  --statistics Average
```

## Cleanup and Resource Management (2 minutes)

### CDK Cleanup
```bash
cdk destroy --context configFile="../examples/cdk/minimal-config.json"
```

### CloudFormation Cleanup
```bash
aws cloudformation delete-stack --stack-name embedding-workload-dev
aws cloudformation wait stack-delete-complete --stack-name embedding-workload-dev
```

### Manual Cleanup (if needed)
Some resources may require manual cleanup:
- S3 buckets with objects
- FSx file systems (if using existing)
- CloudWatch log groups
- Custom KMS keys

Always verify that all resources have been properly cleaned up to avoid unexpected charges.

## Next Steps and Advanced Topics (2 minutes)

### Integration Opportunities
- CI/CD pipeline integration with AWS CodePipeline
- Multi-environment promotion strategies
- Custom model training with Amazon Bedrock
- Advanced RAG implementations with vector databases

### Scaling Considerations
- Multi-region deployments for global applications
- Cross-account architectures for enterprise governance
- Advanced security and compliance requirements
- Performance optimization for large-scale workloads

### Community and Support
- GitHub repository for issues and contributions
- Documentation updates and community examples
- Best practices sharing and case studies
- Regular updates and new feature announcements

## Conclusion (1 minute)

In this comprehensive tutorial, we've covered:
- Multiple deployment methods (CDK and CloudFormation)
- Various configuration scenarios from minimal to enterprise
- Testing and validation procedures
- Advanced monitoring and alerting capabilities
- Best practices for production deployments
- Troubleshooting common issues and optimization techniques

The Embedding Batch Workload template provides a robust, scalable foundation for building production-grade RAG applications. The template is designed to grow with your needs, from simple development setups to complex multi-account enterprise deployments.

This solution leverages the power of AWS managed services to provide:
- Scalable compute with AWS Batch
- High-performance storage with FSx for NetApp ONTAP
- Advanced AI capabilities with Amazon Bedrock
- Comprehensive monitoring and alerting
- Enterprise-grade security and compliance

For additional resources, check out:
- Complete documentation in the repository
- Configuration examples for different use cases
- Best practices guides and troubleshooting documentation
- Community contributions and real-world examples

Thank you for watching, and happy building with AWS!

---

## Video Production Notes

### Screen Recordings Needed:
1. Architecture diagram with detailed component explanations
2. CDK deployment process with real-time progress
3. CloudFormation console navigation and stack creation
4. AWS Batch job execution and monitoring
5. Configuration file comparisons and explanations
6. Resource verification commands and outputs
7. CloudWatch dashboard walkthrough
8. Alert configuration and testing
9. Troubleshooting scenarios and solutions
10. Cost optimization examples

### Duration: Approximately 50 minutes

### Recommended Format:
- 1080p resolution minimum, 4K preferred
- Clear, professional audio narration
- Highlighted cursor movements and UI elements
- Smooth transitions between sections
- Picture-in-picture for presenter during complex operations
- Pause points for complex operations with clear explanations
- Chapter markers for easy navigation
- Closed captions for accessibility

### Additional Materials:
- Downloadable configuration files
- Command reference sheet
- Troubleshooting checklist
- Resource cleanup script
- Cost estimation worksheet