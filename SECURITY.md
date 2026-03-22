# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |
| 1.x.x   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please open a GitHub issue with the label `security`. All security vulnerabilities will be promptly addressed.

Please include the following information in your report:

- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

## Security Update Process

1. The security report is received and assigned to a primary handler
2. The problem is confirmed and a list of affected versions is determined
3. Code is audited to find any similar problems
4. Fixes are prepared for all supported releases
5. New versions are released and announcements are made

## Known Security Considerations

### Development Dependencies

This project uses several development dependencies (jest, ts-node, aws-sdk-client-mock) that may have known vulnerabilities. These dependencies are:

- Only used in development and testing environments
- Not included in production deployments
- Regularly updated through Dependabot

### AWS SDK v2 in cdk-docker-image-deployment

The `cdk-docker-image-deployment` package includes AWS SDK v2 as a bundled dependency. This is a known issue:

- **Risk Level**: Low (development-time only)
- **Mitigation**: The package is only used during CDK deployment, not in runtime
- **Recommendation**: Validate region parameters when using this package
- **Future Action**: Monitor for package updates or consider alternative solutions

### diff Package in Testing Tools

The `diff` package has a known DoS vulnerability in parsePatch and applyPatch:

- **Risk Level**: Low (testing environment only)
- **Mitigation**: Only used in unit/integration tests, not in production
- **Recommendation**: Keep jest and ts-node updated to latest versions

## Security Best Practices

When deploying this solution:

1. **Use AWS Secrets Manager** for sensitive credentials
2. **Enable VPC endpoints** for AWS services
3. **Implement least privilege IAM policies**
4. **Enable CloudTrail logging** for audit trails
5. **Use AWS WAF** for CloudFront distributions
6. **Enable encryption at rest** for all data stores
7. **Regularly rotate credentials** and access keys
8. **Monitor CloudWatch alarms** for security events

## Compliance

This project follows AWS Well-Architected Framework security best practices and includes:

- Encryption at rest and in transit
- Network isolation with VPC
- IAM role-based access control
- CloudWatch monitoring and alerting
- AWS Secrets Manager integration
- CDK Nag security checks

## Contact

For security concerns, please open a GitHub issue with the label `security`.
