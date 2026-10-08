// Generates checksummed inputs without depending on the production parser.
export function sentence(body: string): string {
  const checksum = Array.from(body).reduce(
    (value, character) => value ^ character.charCodeAt(0),
    0,
  );
  return `$${body}*${checksum.toString(16).padStart(2, '0').toUpperCase()}`;
}

export function gga(overrides: Partial<Record<number, string>> = {}): string {
  const fields = [
    'GPGGA', '123519', '4807.038', 'N', '01131.000', 'E',
    '4', '08', '0.9', '545.4', 'M', '46.9', 'M', '', '',
  ];
  for (const [index, value] of Object.entries(overrides)) {
    if (value !== undefined) fields[Number(index)] = value;
  }
  return sentence(fields.join(','));
}

export function gsa(overrides: Partial<Record<number, string>> = {}): string {
  const fields = ['GPGSA', 'A', '3', ...Array<string>(12).fill(''), '1.8', '1.0', '1.5'];
  for (const [index, value] of Object.entries(overrides)) {
    if (value !== undefined) fields[Number(index)] = value;
  }
  return sentence(fields.join(','));
}
