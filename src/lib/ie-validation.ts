// Inscrição Estadual validation by UF (Brazilian states)
// Each state has its own IE format and validation rules

interface IEValidation {
  mask: (value: string) => string;
  validate: (value: string) => boolean;
  placeholder: string;
  maxLength: number;
}

// Validation rules by state
const ieRules: Record<string, IEValidation> = {
  AC: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 13),
    validate: (v) => /^01\d{11}$/.test(v.replace(/\D/g, '')),
    placeholder: '01.XXX.XXX/XXX-XX',
    maxLength: 13,
  },
  AL: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 9),
    validate: (v) => /^24\d{7}$/.test(v.replace(/\D/g, '')),
    placeholder: '24XXXXXXX',
    maxLength: 9,
  },
  AP: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 9),
    validate: (v) => /^03\d{7}$/.test(v.replace(/\D/g, '')),
    placeholder: '03XXXXXXX',
    maxLength: 9,
  },
  AM: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 9),
    validate: (v) => v.replace(/\D/g, '').length === 9,
    placeholder: 'XX.XXX.XXX-X',
    maxLength: 9,
  },
  BA: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 9),
    validate: (v) => v.replace(/\D/g, '').length >= 8 && v.replace(/\D/g, '').length <= 9,
    placeholder: 'XXXXXX-XX',
    maxLength: 9,
  },
  CE: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 9),
    validate: (v) => v.replace(/\D/g, '').length === 9,
    placeholder: 'XXXXXXXX-X',
    maxLength: 9,
  },
  DF: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 13),
    validate: (v) => /^07\d{11}$/.test(v.replace(/\D/g, '')),
    placeholder: '07XXXXXXXXXXX',
    maxLength: 13,
  },
  ES: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 9),
    validate: (v) => v.replace(/\D/g, '').length === 9,
    placeholder: 'XXXXXXXXX',
    maxLength: 9,
  },
  GO: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 9),
    validate: (v) => /^(10|11|15|20|29)\d{7}$/.test(v.replace(/\D/g, '')),
    placeholder: 'XX.XXX.XXX-X',
    maxLength: 9,
  },
  MA: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 9),
    validate: (v) => /^12\d{7}$/.test(v.replace(/\D/g, '')),
    placeholder: '12XXXXXXX',
    maxLength: 9,
  },
  MT: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 11),
    validate: (v) => v.replace(/\D/g, '').length === 11,
    placeholder: 'XXXXXXXXXXX',
    maxLength: 11,
  },
  MS: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 9),
    validate: (v) => /^28\d{7}$/.test(v.replace(/\D/g, '')),
    placeholder: '28XXXXXXX',
    maxLength: 9,
  },
  MG: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 13),
    validate: (v) => v.replace(/\D/g, '').length === 13,
    placeholder: 'XXX.XXX.XXX/XXXX',
    maxLength: 13,
  },
  PA: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 9),
    validate: (v) => /^15\d{7}$/.test(v.replace(/\D/g, '')),
    placeholder: '15-XXXXXX-X',
    maxLength: 9,
  },
  PB: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 9),
    validate: (v) => /^16\d{7}$/.test(v.replace(/\D/g, '')),
    placeholder: '16XXXXXXX',
    maxLength: 9,
  },
  PR: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 10),
    validate: (v) => v.replace(/\D/g, '').length === 10,
    placeholder: 'XXXXXXXX-XX',
    maxLength: 10,
  },
  PE: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 14),
    validate: (v) => v.replace(/\D/g, '').length >= 9 && v.replace(/\D/g, '').length <= 14,
    placeholder: 'XXXXXXX-XX ou antigo',
    maxLength: 14,
  },
  PI: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 9),
    validate: (v) => /^19\d{7}$/.test(v.replace(/\D/g, '')),
    placeholder: '19XXXXXXX',
    maxLength: 9,
  },
  RJ: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 8),
    validate: (v) => v.replace(/\D/g, '').length === 8,
    placeholder: 'XX.XXX.XX-X',
    maxLength: 8,
  },
  RN: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 10),
    validate: (v) => /^20\d{7,8}$/.test(v.replace(/\D/g, '')),
    placeholder: '20.XXX.XXX-X',
    maxLength: 10,
  },
  RS: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 10),
    validate: (v) => v.replace(/\D/g, '').length === 10,
    placeholder: 'XXX/XXXXXXX',
    maxLength: 10,
  },
  RO: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 14),
    validate: (v) => v.replace(/\D/g, '').length >= 9 && v.replace(/\D/g, '').length <= 14,
    placeholder: 'XXXXXXXXXXXXX-X',
    maxLength: 14,
  },
  RR: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 9),
    validate: (v) => /^24\d{7}$/.test(v.replace(/\D/g, '')),
    placeholder: '24XXXXXX-X',
    maxLength: 9,
  },
  SC: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 9),
    validate: (v) => v.replace(/\D/g, '').length === 9,
    placeholder: 'XXX.XXX.XXX',
    maxLength: 9,
  },
  SP: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 12),
    validate: (v) => v.replace(/\D/g, '').length === 12,
    placeholder: 'XXX.XXX.XXX.XXX',
    maxLength: 12,
  },
  SE: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 9),
    validate: (v) => v.replace(/\D/g, '').length === 9,
    placeholder: 'XXXXXXXXX',
    maxLength: 9,
  },
  TO: {
    mask: (v) => v.replace(/\D/g, '').slice(0, 11),
    validate: (v) => v.replace(/\D/g, '').length === 11,
    placeholder: 'XXXXXXXXXXX',
    maxLength: 11,
  },
};

// Default rule for unknown states
const defaultRule: IEValidation = {
  mask: (v) => v.replace(/\D/g, '').slice(0, 14),
  validate: (v) => v.replace(/\D/g, '').length >= 8,
  placeholder: 'Inscrição Estadual',
  maxLength: 14,
};

export function getIEValidation(uf: string): IEValidation {
  return ieRules[uf?.toUpperCase()] || defaultRule;
}

export function maskIE(value: string, uf: string): string {
  const rule = getIEValidation(uf);
  return rule.mask(value);
}

export function validateIE(value: string, uf: string): boolean {
  if (!value || value.trim() === '' || value.toUpperCase() === 'ISENTO') {
    return true; // Empty or ISENTO is always valid
  }
  const rule = getIEValidation(uf);
  return rule.validate(value);
}

export function getIEPlaceholder(uf: string): string {
  const rule = getIEValidation(uf);
  return rule.placeholder;
}

export function getIEMaxLength(uf: string): number {
  const rule = getIEValidation(uf);
  return rule.maxLength;
}

// Inscrição Municipal - simpler validation (varies by city)
export function validateIM(value: string): boolean {
  if (!value || value.trim() === '') return true;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 15;
}

export function maskIM(value: string): string {
  return value.replace(/\D/g, '').slice(0, 15);
}
