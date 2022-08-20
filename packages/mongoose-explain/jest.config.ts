/* eslint-disable */
export default {
  displayName: 'mongoose-explain',

  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
  },
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/packages/mongoose-explain',
  preset: '../../jest.preset.js',
  resolver: './jest.resolver.js',
};
