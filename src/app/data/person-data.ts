export const GENDERS = ['Masculino', 'Femenino', 'Otro'] as const;
export const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as const;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 11;
export const PHONE_DIGITS = 10;
/** Registraduría NUIP: 10 digits. Older IDs may be shorter. */
export const ID_MAX = 10;

export function digitsOnly(value: string, max = PHONE_DIGITS): string {
  return (value || '').replace(/\D/g, '').slice(0, max);
}

export function idDigitsOnly(value: string): string {
  return (value || '').replace(/\D/g, '').slice(0, ID_MAX);
}

/** Colombian mobile (starts with 3) or national landline (starts with 60), always 10 digits. Empty is allowed. */
export function isColombianPhone(value: string): boolean {
  const digits = digitsOnly(value);
  if (!digits) return true;
  return digits.length === PHONE_DIGITS && (digits.startsWith('3') || digits.startsWith('60'));
}

export function phoneMessage(label: string): string {
  return `${label} debe tener 10 dígitos: un celular empieza por 3 y un fijo por 60.`;
}

export function normalizeGender(value: string): string {
  const text = (value || '').trim().toLowerCase();
  if (!text) return '';
  if (text.startsWith('masc') || text === 'm' || text === 'hombre') return 'Masculino';
  if (text.startsWith('fem') || text === 'f' || text === 'mujer') return 'Femenino';
  if (text.startsWith('otr') || text === 'otro' || text === 'otra') return 'Otro';
  return GENDERS.find(gender => gender.toLowerCase() === text) ?? '';
}

export function normalizeBloodType(value: string): string {
  const text = (value || '').trim().toUpperCase().replace(/0/g, 'O').replace(/\s/g, '');
  return (BLOOD_TYPES as readonly string[]).includes(text) ? text : '';
}
