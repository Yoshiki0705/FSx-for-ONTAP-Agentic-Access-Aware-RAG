module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/lib', '<rootDir>/lambda', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  // AWS SDK の解決先を root の 1 コピーに固定する。
  //
  // lambda/*/node_modules が存在すると、実装はそちらのコピーを解決し、テストが
  // mockClient で差し替えるのは root のコピーになる。クラスが別物になるため
  // コマンドの照合が外れ、mock が素通りして send() が undefined を返す。
  // CI は入れ子の node_modules を作らないので通り、手元で `npm install` した
  // 開発者だけが 26 件の失敗を見る（原因を 2026-09 に特定）。
  moduleNameMapper: {
    '^@aws-sdk/(.*)$': '<rootDir>/node_modules/@aws-sdk/$1',
    '^@smithy/(.*)$': '<rootDir>/node_modules/@smithy/$1'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'lib/**/*.ts',
    '!lib/**/*.d.ts',
    '!lib/**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/docker/',
    '/.next/',
    '/backup-.*/',
    '/archive/',
    '/backups/',
    '/e2e-.*\\.test\\.ts$'
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/backup-.*',
    '<rootDir>/archive/',
    '<rootDir>/backups/'
  ]
};
