/** Colombian ID and phone helpers used by forms. */

export const GENDERS = ['Masculino', 'Femenino', 'Otro'] as const;
export const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as const;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 12;
export const PHONE_DIGITS = 10;
/** Registraduría NUIP: 10 digits. Older IDs may be shorter. */
export const ID_MAX = 10;

export function withoutSpaces(value: string): string {
  return (value || '').replace(/\s/g, '');
}

export function blockSpace(event: Event) {
  const input = event as InputEvent;
  if (input.data && /\s/.test(input.data)) event.preventDefault();
}

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

/** Latest year a public signup can pick. Not 2022+, not a future day. */
export const BIRTH_YEAR_LATEST = 2021;
export const BIRTH_DATE_MIN = '1920-01-01';
export const BIRTH_DATE_MAX = `${BIRTH_YEAR_LATEST}-12-31`;

export function isAllowedBirthDate(value: string): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return value >= BIRTH_DATE_MIN && value <= BIRTH_DATE_MAX;
}

export function birthDateMessage(): string {
  return `La fecha de nacimiento no puede ser después de ${BIRTH_YEAR_LATEST}.`;
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
