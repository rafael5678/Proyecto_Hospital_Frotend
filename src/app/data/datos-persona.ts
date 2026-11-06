export const GENEROS = ['Masculino', 'Femenino', 'Otro'] as const;
export const TIPOS_SANGRE = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as const;
export const CLAVE_MIN = 6;
export const CLAVE_MAX = 11;
export const TELEFONO_DIGITOS = 10;
/** NUIP de la Registraduría: 10 dígitos. Las cédulas anteriores pueden ser más cortas. */
export const CEDULA_MAX = 10;

export function soloDigitos(valor: string, max = TELEFONO_DIGITOS): string {
  return (valor || '').replace(/\D/g, '').slice(0, max);
}

export function soloCedula(valor: string): string {
  return (valor || '').replace(/\D/g, '').slice(0, CEDULA_MAX);
}

/** Celular colombiano (empieza por 3) o fijo nacional (empieza por 60), siempre de 10 dígitos. Vacío se acepta. */
export function telefonoColombiano(valor: string): boolean {
  const d = soloDigitos(valor);
  if (!d) return true;
  return d.length === TELEFONO_DIGITOS && (d.startsWith('3') || d.startsWith('60'));
}

export function mensajeTelefono(etiqueta: string): string {
  return `${etiqueta} debe tener 10 dígitos: un celular empieza por 3 y un fijo por 60.`;
}

export function normalizarGenero(valor: string): string {
  const t = (valor || '').trim().toLowerCase();
  if (!t) return '';
  if (t.startsWith('masc') || t === 'm' || t === 'hombre') return 'Masculino';
  if (t.startsWith('fem') || t === 'f' || t === 'mujer') return 'Femenino';
  if (t.startsWith('otr') || t === 'otro' || t === 'otra') return 'Otro';
  return GENEROS.find(g => g.toLowerCase() === t) ?? '';
}

export function normalizarSangre(valor: string): string {
  const t = (valor || '').trim().toUpperCase().replace(/0/g, 'O').replace(/\s/g, '');
  return (TIPOS_SANGRE as readonly string[]).includes(t) ? t : '';
}
