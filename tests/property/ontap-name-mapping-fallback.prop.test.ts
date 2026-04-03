// Feature: oidc-ldap-permission-mapping, Property 16: ONTAP name-mappingフォールバック
/**
 * Property 16: ONTAP name-mappingフォールバック
 *
 * For any ONTAP REST API failure, Permission Resolver continues
 * without name-mapping and logs the error.
 *
 * **Validates: Requirements 7.3**
 */

import * as fc from 'fast-check';
import {
  applyNameMapping,
  PermissionResolutionStrategy,
  UserAccessRecord,
} from '../../lambda/permissions/metadata-filter-handler';

// We need to mock the ONTAP client
jest.mock('../../lambda/permissions/ontap-rest-api-client', () => {
  const original = jest.requireActual('../../lambda/permissions/ontap-rest-api-client');
  return {
    ...original,
    getOntapClient: jest.fn(),
    resolveWindowsUser: original.resolveWindowsUser,
  };
});

import { getOntapClient } from '../../lambda/permissions/ontap-rest-api-client';

const mockedGetOntapClient = getOntapClient as jest.MockedFunction<typeof getOntapClient>;

// ========================================
// Generators
// ========================================

const uidArb = fc.integer({ min: 1000, max: 65534 });
const gidArb = fc.integer({ min: 1000, max: 65534 });

const errorArb = fc.constantFrom(
  new Error('ONTAP API request timed out after 10000ms'),
  new Error('ONTAP API error: 503 Service Unavailable'),
  new Error('connect ECONNREFUSED 10.0.0.1:443'),
  new Error('Failed to retrieve ONTAP credentials'),
  new Error('Network timeout'),
  new Error('Invalid name-mapping response format'),
);

describe('Property 16: ONTAP name-mappingフォールバック', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it('ONTAP API failure → returns original strategy unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        uidArb,
        gidArb,
        errorArb,
        async (uid, gid, error) => {
          // Enable ONTAP name-mapping
          process.env.ONTAP_NAME_MAPPING_ENABLED = 'true';
          process.env.SVM_UUID = 'test-svm-uuid';

          // Mock ONTAP client to throw
          mockedGetOntapClient.mockReturnValue({
            getNameMappingRules: jest.fn().mockRejectedValue(error),
          } as any);

          const strategy: PermissionResolutionStrategy = {
            type: 'uid-gid',
            uid,
            gid,
          };

          const userRecord: UserAccessRecord = {
            userId: 'testuser',
            userSID: '',
            groupSIDs: [],
            uid,
            gid,
          };

          const result = await applyNameMapping(strategy, userRecord);

          // Property: original strategy is returned unchanged
          expect(result.type).toBe('uid-gid');
          expect(result.uid).toBe(uid);
          expect(result.gid).toBe(gid);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('ONTAP disabled → returns original strategy without calling API', async () => {
    await fc.assert(
      fc.asyncProperty(uidArb, gidArb, async (uid, gid) => {
        // Disable ONTAP name-mapping
        process.env.ONTAP_NAME_MAPPING_ENABLED = 'false';
        process.env.SVM_UUID = '';

        const strategy: PermissionResolutionStrategy = {
          type: 'uid-gid',
          uid,
          gid,
        };

        const userRecord: UserAccessRecord = {
          userId: 'testuser',
          userSID: '',
          groupSIDs: [],
          uid,
          gid,
        };

        const result = await applyNameMapping(strategy, userRecord);

        // Property: strategy unchanged, no API call
        expect(result.type).toBe('uid-gid');
        expect(result.uid).toBe(uid);
        expect(result.gid).toBe(gid);
        expect(mockedGetOntapClient).not.toHaveBeenCalled();
      }),
      { numRuns: 20 }
    );
  });

  it('SID strategy → skips name-mapping entirely', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^S-1-5-21-\d{1,10}-\d{1,10}-\d{1,10}-\d{1,5}$/),
        async (userSID) => {
          process.env.ONTAP_NAME_MAPPING_ENABLED = 'true';
          process.env.SVM_UUID = 'test-svm-uuid';

          const strategy: PermissionResolutionStrategy = {
            type: 'sid',
            userSIDs: [userSID],
          };

          const userRecord: UserAccessRecord = {
            userId: 'testuser',
            userSID,
            groupSIDs: [],
          };

          const result = await applyNameMapping(strategy, userRecord);

          // SID strategy doesn't need name-mapping
          expect(result.type).toBe('sid');
          expect(result.userSIDs).toContain(userSID);
        }
      ),
      { numRuns: 20 }
    );
  });
});
