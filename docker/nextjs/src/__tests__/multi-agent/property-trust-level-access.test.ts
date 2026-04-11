/**
 * Property tests for Trust Level Access Control
 * Feature: multi-agent-collaboration, Property 6: Trust Level Access Control
 *
 * Validates: Requirements 6.5
 *
 * Verifies that:
 * - For any Trust Level and user role pair, admin-only Agent operations
 *   by non-admin users are rejected
 * - admin-only agents: only 'admin' role can edit/delete/use-in-chat. All roles can view.
 * - team-safe agents: 'team-admin' and 'admin' can edit/delete/use-in-chat. All roles can view.
 * - user-safe agents: all roles can perform all operations.
 */

import * as fc from 'fast-check';
import type { TrustLevel } from '@/types/multi-agent';

// ===== Types =====

type UserRole = 'user' | 'team-admin' | 'admin';
type AgentOperation = 'view' | 'edit' | 'delete' | 'use-in-chat';

// ===== Pure function under test =====

/**
 * Determines whether a user with the given role can perform the specified
 * operation on an agent with the given trust level.
 *
 * Rules:
 * - admin-only agents: only 'admin' role can edit/delete/use-in-chat. All roles can view.
 * - team-safe agents: 'team-admin' and 'admin' can edit/delete/use-in-chat. All roles can view.
 * - user-safe agents: all roles can perform all operations.
 */
function canUserOperateAgent(
  agentTrustLevel: TrustLevel,
  userRole: UserRole,
  operation: AgentOperation,
): boolean {
  // All roles can always view any agent
  if (operation === 'view') {
    return true;
  }

  // Mutating operations: edit, delete, use-in-chat
  switch (agentTrustLevel) {
    case 'admin-only':
      return userRole === 'admin';
    case 'team-safe':
      return userRole === 'team-admin' || userRole === 'admin';
    case 'user-safe':
      return true;
    default:
      return false;
  }
}

// ===== Generators =====

const trustLevelArb = fc.constantFrom<TrustLevel>('user-safe', 'team-safe', 'admin-only');
const userRoleArb = fc.constantFrom<UserRole>('user', 'team-admin', 'admin');
const operationArb = fc.constantFrom<AgentOperation>('view', 'edit', 'delete', 'use-in-chat');
const mutatingOperationArb = fc.constantFrom<AgentOperation>('edit', 'delete', 'use-in-chat');

// ===== Property 6: Trust Level Access Control =====

describe('Feature: multi-agent-collaboration, Property 6: Trust Level Access Control', () => {
  /**
   * **Validates: Requirements 6.5**
   * Core invariant: admin-only agents reject mutating operations from non-admin users.
   */
  it('rejects edit/delete/use-in-chat on admin-only agents by non-admin users', () => {
    const nonAdminRoleArb = fc.constantFrom<UserRole>('user', 'team-admin');

    fc.assert(
      fc.property(nonAdminRoleArb, mutatingOperationArb, (role, operation) => {
        expect(canUserOperateAgent('admin-only', role, operation)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 6.5**
   * admin-only agents: admin role CAN perform all operations.
   */
  it('allows admin role to perform any operation on admin-only agents', () => {
    fc.assert(
      fc.property(operationArb, (operation) => {
        expect(canUserOperateAgent('admin-only', 'admin', operation)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 6.5**
   * team-safe agents: plain 'user' role cannot edit/delete/use-in-chat.
   */
  it('rejects edit/delete/use-in-chat on team-safe agents by plain user role', () => {
    fc.assert(
      fc.property(mutatingOperationArb, (operation) => {
        expect(canUserOperateAgent('team-safe', 'user', operation)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 6.5**
   * team-safe agents: team-admin and admin CAN perform all operations.
   */
  it('allows team-admin and admin to perform any operation on team-safe agents', () => {
    const privilegedRoleArb = fc.constantFrom<UserRole>('team-admin', 'admin');

    fc.assert(
      fc.property(privilegedRoleArb, operationArb, (role, operation) => {
        expect(canUserOperateAgent('team-safe', role, operation)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 6.5**
   * user-safe agents: all roles can perform all operations.
   */
  it('allows any role to perform any operation on user-safe agents', () => {
    fc.assert(
      fc.property(userRoleArb, operationArb, (role, operation) => {
        expect(canUserOperateAgent('user-safe', role, operation)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 6.5**
   * Universal invariant: view operation is always allowed regardless of trust level or role.
   */
  it('always allows view operation for any trust level and role combination', () => {
    fc.assert(
      fc.property(trustLevelArb, userRoleArb, (trustLevel, role) => {
        expect(canUserOperateAgent(trustLevel, role, 'view')).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 6.5**
   * Monotonicity: if a lower-privilege role can operate, then a higher-privilege role can too.
   * Privilege order: user < team-admin < admin
   */
  it('satisfies privilege monotonicity: higher roles inherit lower role permissions', () => {
    const roleHierarchy: UserRole[] = ['user', 'team-admin', 'admin'];

    fc.assert(
      fc.property(trustLevelArb, operationArb, (trustLevel, operation) => {
        const results = roleHierarchy.map((role) =>
          canUserOperateAgent(trustLevel, role, operation),
        );
        // Once a role is allowed, all higher roles must also be allowed
        let seenAllowed = false;
        for (const result of results) {
          if (seenAllowed) {
            expect(result).toBe(true);
          }
          if (result) {
            seenAllowed = true;
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
