import { describe, expect, it } from '@jest/globals';

import { fixLabel, parseGgaSentence, parseGsaSentence } from '../../lib/gps/nmea';
import { gga, gsa, sentence } from '../fixtures/nmea';

describe('GGA position parsing', () => {
  it('parses an independently known NMEA example into decimal degrees', () => {
    const input = '$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47';
    const fix = parseGgaSentence(` ${input}\r\n`, 123);
    expect(fix).toMatchObject({
      sentence: input, receivedAt: 123, utcTime: '123519',
      quality: 1, satellites: 8, hdop: 0.9, altitude: 545.4,
    });
    expect(fix?.latitude).toBeCloseTo(48.1173, 8);
    expect(fix?.longitude).toBeCloseTo(11.5166666667, 8);
  });

  it('makes southern and western coordinates negative', () => {
    const fix = parseGgaSentence(gga({ 3: 'S', 5: 'W' }));
    expect(fix?.latitude).toBeCloseTo(-48.1173, 8);
    expect(fix?.longitude).toBeCloseTo(-11.5166666667, 8);
  });

  it('accepts GN talker IDs and reports RTK fixed and float separately', () => {
    expect(parseGgaSentence(gga({ 0: 'GNGGA' }))?.quality).toBe(4);
    expect(fixLabel(4)).toBe('RTK FIXED');
    expect(fixLabel(parseGgaSentence(gga({ 6: '5' }))!.quality)).toBe('RTK FLOAT');
  });

  it('reports no fix without exposing coordinates from stale fields', () => {
    const fix = parseGgaSentence(gga({ 6: '0' }), 456);
    expect(fix).toMatchObject({ quality: 0, receivedAt: 456 });
    expect(fix?.latitude).toBeUndefined();
    expect(fix?.longitude).toBeUndefined();
    expect(fix?.altitude).toBeUndefined();
    expect(fixLabel(0)).toBe('NO FIX');
  });

  it.each([
    { 2: '4860.000' }, { 2: '9100.000' }, { 2: '9000.001' },
    { 4: '18100.000' }, { 4: '18000.001' }, { 3: 'E' }, { 5: 'N' },
    { 2: '' }, { 6: '9' }, { 6: '' }, { 6: '1.5' },
  ])('rejects invalid coordinates or fix quality: %j', (overrides) => {
    expect(parseGgaSentence(gga(overrides))).toBeNull();
  });

  it('accepts exact geographic boundaries', () => {
    expect(parseGgaSentence(gga({ 2: '9000.000', 4: '18000.000' })))
      .toMatchObject({ latitude: 90, longitude: 180 });
  });

  it.each([
    '', '$GPGGA,123519', gga().replace('4807.038', '4807.039'),
    gga().slice(0, -2) + 'ZZ', sentence('GPGGA,123519'),
    sentence('GPGGA,' + 'a'.repeat(1024)), sentence('GPGGA,\u0001'),
  ])('rejects malformed or checksum-invalid sentences', (input) => {
    expect(parseGgaSentence(input)).toBeNull();
  });

  it('does not substitute zero for invalid optional measurements', () => {
    const fix = parseGgaSentence(gga({ 7: '1.5', 8: '-1', 9: 'NaN' }));
    expect(fix).not.toBeNull();
    expect(fix?.satellites).toBeUndefined();
    expect(fix?.hdop).toBeUndefined();
    expect(fix?.altitude).toBeUndefined();
  });

  it('does not interpret non-metre altitude as metres', () => {
    expect(parseGgaSentence(gga({ 10: 'F' }))?.altitude).toBeUndefined();
  });
});

describe('GSA dilution of precision', () => {
  it('extracts PDOP, HDOP and VDOP with the supplied receive time', () => {
    expect(parseGsaSentence(gsa({ 0: 'GNGSA' }), 123))
      .toEqual({ receivedAt: 123, pdop: 1.8, hdop: 1, vdop: 1.5 });
  });

  it('clears DOP values when the receiver reports no fix', () => {
    expect(parseGsaSentence(gsa({ 2: '1' }), 123)).toEqual({ receivedAt: 123 });
  });

  it('leaves missing, negative and nonnumeric DOP values undefined', () => {
    expect(parseGsaSentence(gsa({ 15: '', 16: '-1', 17: 'invalid' }), 123))
      .toEqual({ receivedAt: 123, pdop: undefined, hdop: undefined, vdop: undefined });
  });

  it.each([gga(), sentence('GPGSA,A,3'), gsa().slice(0, -2) + 'ZZ'])
    ('rejects the wrong sentence type, truncated data and invalid checksums', (input) => {
      expect(parseGsaSentence(input)).toBeNull();
    });
});
