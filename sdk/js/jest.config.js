export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.+(spec|test).ts'],
  transform: {
    // ESM transform so source using `import.meta` (resolver.ts, registry.ts)
    // compiles. Requires running jest with NODE_OPTIONS=--experimental-vm-modules
    // (see the `test` npm script). isolatedModules silences the hybrid-module warning.
    '^.+\\.ts$': ['ts-jest', { useESM: true, isolatedModules: true }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
