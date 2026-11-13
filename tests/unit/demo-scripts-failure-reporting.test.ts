/**
 * Demo scripts that failed silently or sent rejected requests in a real run (Issue #228).
 *
 * create-demo-users.sh runs against a stub `aws` placed first on PATH, so no AWS call is made.
 * setup-kb-datasource.sh needs a live knowledge base and access point, so only the request
 * shapes it builds are checked here.
 */
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPTS = path.join(__dirname, '../../demo-data/scripts');

function stubAws(dir: string): void {
  const stub = `#!/bin/bash
case "$*" in
  *admin-create-user*)
    [ "$STUB_MODE" = exists ] && { echo "An error occurred (UsernameExistsException) when calling the AdminCreateUser operation: User account already exists" >&2; exit 254; }
    [ "$STUB_MODE" = createfail ] && { echo "An error occurred (ResourceNotFoundException) when calling the AdminCreateUser operation: User pool does not exist" >&2; exit 254; }
    echo '{}';;
  *admin-set-user-password*)
    [ "$STUB_MODE" = setfail ] && { echo "An error occurred (ResourceNotFoundException) when calling the AdminSetUserPassword operation: User pool does not exist" >&2; exit 254; }
    echo '';;
  *) echo "unexpected aws call: $*" >&2; exit 99;;
esac
`;
  fs.writeFileSync(path.join(dir, 'aws'), stub, { mode: 0o755 });
}

function runCreateUsers(mode: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stub-aws-'));
  try {
    stubAws(dir);
    return spawnSync('bash', [path.join(SCRIPTS, 'create-demo-users.sh')], {
      env: {
        PATH: `${dir}:${process.env.PATH}`,
        STUB_MODE: mode,
        COGNITO_USER_POOL_ID: 'ap-northeast-1_TEST',
        AWS_REGION: 'ap-northeast-1',
      },
      encoding: 'utf8',
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const okLines = (out: string) => (out.match(/✅ \S+@example\.com/g) || []).length;

describe('create-demo-users.sh', () => {
  it('creates all five users', () => {
    const r = runCreateUsers('ok');
    expect(r.status).toBe(0);
    expect(okLines(r.stdout)).toBe(5);
  });

  it('accepts users that already exist', () => {
    const r = runCreateUsers('exists');
    expect(r.status).toBe(0);
    expect(okLines(r.stdout)).toBe(5);
    expect(r.stderr).not.toContain('❌');
  });

  it('stops with the cause when user creation fails for another reason', () => {
    const r = runCreateUsers('createfail');
    expect(r.status).not.toBe(0);
    expect(okLines(r.stdout)).toBe(0);
    expect(r.stderr).toContain('ResourceNotFoundException');
    expect(r.stderr).toMatch(/create-demo-users\.sh:\d+/);
  });

  it('stops instead of printing ✅ when setting the password fails', () => {
    const r = runCreateUsers('setfail');
    expect(r.status).not.toBe(0);
    expect(okLines(r.stdout)).toBe(0);
    expect(r.stderr).toContain('パスワード設定に失敗');
  });
});

describe('setup-kb-datasource.sh request shapes', () => {
  const src = fs.readFileSync(path.join(SCRIPTS, 'setup-kb-datasource.sh'), 'utf8');

  it('creates the access point with --type ONTAP and --ontap-configuration', () => {
    const create = src.slice(src.indexOf('aws fsx create-and-attach-s3-access-point'));
    const call = create.slice(0, create.indexOf('--output json'));
    expect(call).toContain('--type ONTAP');
    expect(call).toContain('--ontap-configuration');
    expect(call).not.toContain('--volume-id');
    expect(call).not.toContain('--file-system-identity');
  });

  it('passes the access point alias as a bucket ARN to the data source', () => {
    expect(src).toContain('\\"bucketArn\\": \\"arn:aws:s3:::${S3AP_ALIAS}\\"');
    expect(src).not.toContain('\\"bucketArn\\": \\"${S3AP_ARN}\\"');
  });
});
