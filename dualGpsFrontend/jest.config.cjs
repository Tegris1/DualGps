module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts', '<rootDir>/__tests__/**/*.test.tsx'],
  collectCoverageFrom: [
    'lib/gps/nmea.ts',
    'lib/gps/ntrip-protocol.ts',
    'lib/gps/ntrip-chunk-decoder.ts',
    'lib/gps/rtcm3-inspector.ts',
    'lib/gps/ntrip-connection.ts',
  ],
};
