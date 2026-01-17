module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/lib', '<rootDir>/lambda', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
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
    '/backups/'
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/backup-.*',
    '<rootDir>/archive/',
    '<rootDir>/backups/'
  ]
};
