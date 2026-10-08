module.exports = {
  preset: 'jest-expo',
  // React Native uses the npm polyfill, not Node's built-in Buffer.
  moduleNameMapper: { '^buffer$': require.resolve('buffer/') },
  testMatch: ['<rootDir>/__tests__/**/*.test.ts', '<rootDir>/__tests__/**/*.test.tsx'],
  collectCoverageFrom: [
    'lib/gps/nmea.ts',
    'lib/gps/ntrip-protocol.ts',
    'lib/gps/ntrip-chunk-decoder.ts',
    'lib/gps/rtcm3-inspector.ts',
    'lib/gps/ntrip-connection.ts',
  ],
};
