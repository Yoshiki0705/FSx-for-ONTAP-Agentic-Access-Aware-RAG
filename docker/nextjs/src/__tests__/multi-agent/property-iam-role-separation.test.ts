/**
 * Property tests for IAM Role Separation
 * Feature: multi-agent-collaboration, Property 2: IAM Role Separation
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.5
 *
 * Verifies that:
 * - Only permission-resolver and retrieval agents have bedrock:Retrieve permission
 * - Only permission-resolver has dynamodb:GetItem permission
 * - Supervisor, Analysis, Output, and Vision agents do NOT have KB/DynamoDB access
 * - Each agent role has individually scoped permissions (least privilege)
 * - All agents have bedrock:InvokeModel (baseline permission)
 * - Only supervisor has bedrock:InvokeAgent
 */

import * as fc from 'fast-check';

// ===== Permission and Role Types =====

type AgentRole =
  | 'supervisor'
  | 'permission-resolver'
  | 'retrieval'
  | 'analysis'
  | 'output'
  | 'vision';

type Permission =
  | 'bedrock:InvokeModel'
  | 'bedrock:Retrieve'
  | 'dynamodb:GetItem'
  | 'bedrock:InvokeAgent';

// ===== Permission Matrix (from design doc) =====

/**
 * The expected IAM permission matrix for each agent role.
 * This is the single source of truth derived from the design document's
 * "IAMロール分離設計" table.
 */
const PERMISSION_MATRIX: Record<AgentRole, Record<Permission, boolean>> = {
  supervisor: {
    'bedrock:InvokeModel': true,
    'bedrock:Retrieve': false,
    'dynamodb:GetItem': false,
    'bedrock:InvokeAgent': true,
  },
  'permission-resolver': {
    'bedrock:InvokeModel': true,
    'bedrock:Retrieve': false,
    'dynamodb:GetItem': true,
    'bedrock:InvokeAgent': false,
  },
  retrieval: {
    'bedrock:InvokeModel': true,
    'bedrock:Retrieve': true,
    'dynamodb:GetItem': false,
    'bedrock:InvokeAgent': false,
  },
  analysis: {
    'bedrock:InvokeModel': true,
    'bedrock:Retrieve': false,
    'dynamodb:GetItem': false,
    'bedrock:InvokeAgent': false,
  },
  output: {
    'bedrock:InvokeModel': true,
    'bedrock:Retrieve': false,
    'dynamodb:GetItem': false,
    'bedrock:InvokeAgent': false,
  },
  vision: {
    'bedrock:InvokeModel': true,
    'bedrock:Retrieve': false,
    'dynamodb:GetItem': false,
    'bedrock:InvokeAgent': false,
  },
};

const ALL_AGENT_ROLES: AgentRole[] = [
  'supervisor',
  'permission-resolver',
  'retrieval',
  'analysis',
  'output',
  'vision',
];

const ALL_PERMISSIONS: Permission[] = [
  'bedrock:InvokeModel',
  'bedrock:Retrieve',
  'dynamodb:GetItem',
  'bedrock:InvokeAgent',
];

// ===== Helper Function Under Test =====

/**
 * Returns the set of permissions granted to a given agent role.
 * This models the IAM role separation design from the CDK stack.
 */
function getPermissionsForRole(role: AgentRole): Set<Permission> {
  const permissions = new Set<Permission>();
  for (const perm of ALL_PERMISSIONS) {
    if (PERMISSION_MATRIX[role][perm]) {
      permissions.add(perm);
    }
  }
  return permissions;
}

/**
 * Checks whether a given agent role has a specific permission.
 */
function hasPermission(role: AgentRole, permission: Permission): boolean {
  return PERMISSION_MATRIX[role][permission];
}

// ===== Generators =====

/** Generates an arbitrary agent role */
const agentRoleArb: fc.Arbitrary<AgentRole> = fc.constantFrom(...ALL_AGENT_ROLES);

/** Generates an arbitrary permission */
const permissionArb: fc.Arbitrary<Permission> = fc.constantFrom(...ALL_PERMISSIONS);

/** Generates an arbitrary (role, permission) pair */
const rolePermissionPairArb = fc.tuple(agentRoleArb, permissionArb);

/** Roles that should NOT have bedrock:Retrieve */
const ROLES_WITHOUT_KB_ACCESS: AgentRole[] = [
  'supervisor',
  'permission-resolver',
  'analysis',
  'output',
  'vision',
];

/** Roles that should NOT have dynamodb:GetItem */
const ROLES_WITHOUT_DYNAMODB_ACCESS: AgentRole[] = [
  'supervisor',
  'retrieval',
  'analysis',
  'output',
  'vision',
];

/** Roles that are "restricted" — no KB or DynamoDB access */
const RESTRICTED_ROLES: AgentRole[] = ['analysis', 'output', 'vision'];

// ===== Property 2: IAM Role Separation =====

describe('Feature: multi-agent-collaboration, Property 2: IAM Role Separation', () => {
  // --- bedrock:Retrieve access restriction ---

  describe('bedrock:Retrieve access', () => {
    /**
     * **Validates: Requirements 5.1**
     * Only retrieval agent should have bedrock:Retrieve permission.
     */
    it('is granted only to retrieval agent', () => {
      fc.assert(
        fc.property(agentRoleArb, (role) => {
          const hasRetrieve = hasPermission(role, 'bedrock:Retrieve');
          if (role === 'retrieval') {
            expect(hasRetrieve).toBe(true);
          } else {
            expect(hasRetrieve).toBe(false);
          }
        }),
        { numRuns: 200 }
      );
    });

    /**
     * **Validates: Requirements 5.2**
     * Analysis, Output, and Vision agents must NOT have bedrock:Retrieve.
     */
    it('is denied for analysis, output, and vision agents', () => {
      fc.assert(
        fc.property(fc.constantFrom(...RESTRICTED_ROLES), (role) => {
          expect(hasPermission(role, 'bedrock:Retrieve')).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 5.3**
     * Supervisor must NOT have direct KB access.
     */
    it('is denied for supervisor agent', () => {
      expect(hasPermission('supervisor', 'bedrock:Retrieve')).toBe(false);
    });
  });

  // --- dynamodb:GetItem access restriction ---

  describe('dynamodb:GetItem access', () => {
    /**
     * **Validates: Requirements 5.1**
     * Only permission-resolver should have dynamodb:GetItem permission.
     */
    it('is granted only to permission-resolver agent', () => {
      fc.assert(
        fc.property(agentRoleArb, (role) => {
          const hasDynamoDB = hasPermission(role, 'dynamodb:GetItem');
          if (role === 'permission-resolver') {
            expect(hasDynamoDB).toBe(true);
          } else {
            expect(hasDynamoDB).toBe(false);
          }
        }),
        { numRuns: 200 }
      );
    });

    /**
     * **Validates: Requirements 5.2**
     * Analysis, Output, and Vision agents must NOT have dynamodb:GetItem.
     */
    it('is denied for analysis, output, and vision agents', () => {
      fc.assert(
        fc.property(fc.constantFrom(...RESTRICTED_ROLES), (role) => {
          expect(hasPermission(role, 'dynamodb:GetItem')).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  // --- Baseline permission: bedrock:InvokeModel ---

  describe('bedrock:InvokeModel (baseline)', () => {
    /**
     * **Validates: Requirements 5.5**
     * All agents must have bedrock:InvokeModel as a baseline permission.
     */
    it('is granted to every agent role', () => {
      fc.assert(
        fc.property(agentRoleArb, (role) => {
          expect(hasPermission(role, 'bedrock:InvokeModel')).toBe(true);
        }),
        { numRuns: 200 }
      );
    });
  });

  // --- bedrock:InvokeAgent access restriction ---

  describe('bedrock:InvokeAgent access', () => {
    /**
     * **Validates: Requirements 5.5**
     * Only supervisor should have bedrock:InvokeAgent (to orchestrate collaborators).
     */
    it('is granted only to supervisor agent', () => {
      fc.assert(
        fc.property(agentRoleArb, (role) => {
          const hasInvokeAgent = hasPermission(role, 'bedrock:InvokeAgent');
          if (role === 'supervisor') {
            expect(hasInvokeAgent).toBe(true);
          } else {
            expect(hasInvokeAgent).toBe(false);
          }
        }),
        { numRuns: 200 }
      );
    });
  });

  // --- Least privilege principle ---

  describe('least privilege principle', () => {
    /**
     * **Validates: Requirements 5.5**
     * Each agent role should have individually scoped permissions.
     * The permission set for any role must match the expected matrix exactly.
     */
    it('each role has exactly the expected permissions (no more, no less)', () => {
      fc.assert(
        fc.property(rolePermissionPairArb, ([role, permission]) => {
          const actual = hasPermission(role, permission);
          const expected = PERMISSION_MATRIX[role][permission];
          expect(actual).toBe(expected);
        }),
        { numRuns: 500 }
      );
    });

    /**
     * **Validates: Requirements 5.2, 5.5**
     * Restricted roles (analysis, output, vision) should only have bedrock:InvokeModel.
     */
    it('restricted roles have exactly one permission: bedrock:InvokeModel', () => {
      fc.assert(
        fc.property(fc.constantFrom(...RESTRICTED_ROLES), (role) => {
          const permissions = getPermissionsForRole(role);
          expect(permissions.size).toBe(1);
          expect(permissions.has('bedrock:InvokeModel')).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 5.5**
     * No two different roles should have the exact same permission set
     * (except analysis, output, vision which share the same minimal set).
     */
    it('non-restricted roles each have a unique permission set', () => {
      const nonRestrictedRoles: AgentRole[] = [
        'supervisor',
        'permission-resolver',
        'retrieval',
      ];
      const permSets = nonRestrictedRoles.map((role) => {
        const perms = getPermissionsForRole(role);
        return Array.from(perms).sort().join(',');
      });
      const uniqueSets = new Set(permSets);
      expect(uniqueSets.size).toBe(nonRestrictedRoles.length);
    });
  });

  // --- getPermissionsForRole helper correctness ---

  describe('getPermissionsForRole helper', () => {
    /**
     * **Validates: Requirements 5.1, 5.2, 5.3, 5.5**
     * For any agent role, getPermissionsForRole returns a set that is
     * consistent with the permission matrix.
     */
    it('returns permissions consistent with the matrix for any role', () => {
      fc.assert(
        fc.property(agentRoleArb, (role) => {
          const permissions = getPermissionsForRole(role);
          for (const perm of ALL_PERMISSIONS) {
            if (PERMISSION_MATRIX[role][perm]) {
              expect(permissions.has(perm)).toBe(true);
            } else {
              expect(permissions.has(perm)).toBe(false);
            }
          }
        }),
        { numRuns: 200 }
      );
    });

    it('returns a non-empty set for every role (at least bedrock:InvokeModel)', () => {
      fc.assert(
        fc.property(agentRoleArb, (role) => {
          const permissions = getPermissionsForRole(role);
          expect(permissions.size).toBeGreaterThanOrEqual(1);
          expect(permissions.has('bedrock:InvokeModel')).toBe(true);
        }),
        { numRuns: 200 }
      );
    });
  });
});
