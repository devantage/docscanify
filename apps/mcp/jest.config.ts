export default {
  displayName: 'mcp',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  clearMocks: true,
  testTimeout: 30000,
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        // The SDK needs node16 resolution, which ts-jest only warns about
        diagnostics: { ignoreCodes: [151002] },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/main.ts'],
  coverageDirectory: '../../coverage/apps/mcp',
};
