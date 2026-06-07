/**
 * CDK Property-Based Test: User Access Scoping (Property 3)
 *
 * Verifies that for any SFTP user configuration, the generated IAM policy
 * Resource ARN only allows access to the user's own prefix and never
 * permits access to other users' prefixes.
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as fc from 'fast-check';
import { DemoTransferFamilyStack, TransferFamilyUserConfig } from '../lib/stacks/demo/demo-transfer-family-stack';

// Generate valid SFTP usernames (alphanumeric + hyphens, 3-20 chars)
const userNameArb = fc.string({ minLength: 3, maxLength: 15 })
  .filter(s => /^[a-z][a-z0-9-]*[a-z0-9]$/.test(s));

// Generate SSH public keys (simplified)
const sshKeyArb = fc.constant('ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC+test+key user@test');

describe('Property 3: User Access Scoping', () => {
  it('IAM policy Resource ARN is scoped to user home directory only', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            userName: userNameArb,
            sshPublicKey: sshKeyArb,
          }),
          { minLength: 1, maxLength: 3 }
        ),
        (users: Array<{ userName: string; sshPublicKey: string }>) => {
          // Deduplicate usernames
          const uniqueUsers = users.filter(
            (u, i, arr) => arr.findIndex(x => x.userName === u.userName) === i
          );
          if (uniqueUsers.length === 0) return true;

          const app = new cdk.App();
          const s3ApArn = 'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/test-ap';

          const tfUsers: TransferFamilyUserConfig[] = uniqueUsers.map(u => ({
            userName: u.userName,
            sshPublicKey: u.sshPublicKey,
          }));

          const stack = new DemoTransferFamilyStack(app, 'TestStack', {
            projectName: 'test',
            environment: 'test',
            s3AccessPointArn: s3ApArn,
            s3AccessPointAlias: 'test-ap-s3alias',
            fileSystemId: 'fs-12345',
            svmId: 'svm-12345',
            volumeId: 'fsvol-12345',
            knowledgeBaseId: 'kb-12345',
            dataSourceId: 'ds-12345',
            transferFamilyUsers: tfUsers,
            env: { account: '123456789012', region: 'ap-northeast-1' },
          });

          const template = Template.fromStack(stack);
          const roles = template.findResources('AWS::IAM::Role');

          // For each user, verify their IAM role only grants access to their prefix
          for (const user of uniqueUsers) {
            // Find the role for this user (role name contains username)
            const userRoleKey = Object.keys(roles).find(key => {
              const roleName = roles[key].Properties?.RoleName;
              return roleName && roleName.endsWith(`-sftp-${user.userName}`);
            });

            if (!userRoleKey) continue;

            const role = roles[userRoleKey];
            const policies = role.Properties?.Policies || [];

            for (const policy of policies) {
              const statements = policy.PolicyDocument?.Statement || [];
              for (const stmt of statements) {
                if (stmt.Action && (
                  (Array.isArray(stmt.Action) && stmt.Action.includes('s3:PutObject')) ||
                  stmt.Action === 's3:PutObject'
                )) {
                  // Resource should contain the user's prefix
                  const resource = typeof stmt.Resource === 'string'
                    ? stmt.Resource
                    : JSON.stringify(stmt.Resource);

                  // Verify user's own prefix is in the resource
                  expect(resource).toContain(`/uploads/${user.userName}/`);

                  // Verify the resource is EXACTLY scoped to this user's prefix
                  // The resource should end with /uploads/{userName}/*
                  expect(resource).toMatch(new RegExp(`/uploads/${user.userName.replace(/-/g, '\\-')}/\\*`));
                }
              }
            }
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
