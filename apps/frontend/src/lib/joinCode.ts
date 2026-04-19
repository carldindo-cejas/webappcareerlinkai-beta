const JOIN_CODE_REGEX = /^[A-HJ-NP-Z2-9]{6}$/;

export function normalizeJoinCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]/g, '');
}

export function isValidJoinCode(code: string): boolean {
  return JOIN_CODE_REGEX.test(code);
}
