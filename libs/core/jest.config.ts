export default {
  displayName: 'docscanify',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  clearMocks: true,
  testTimeout: 30000,
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/index.ts'],
  coverageDirectory: '../../coverage/libs/core',
};
