export default {
  preset: null,
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  testEnvironment: 'node',
  collectCoverageFrom: [
    'services/**/*.js',
    'routes/**/*.js',
    '!node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
}