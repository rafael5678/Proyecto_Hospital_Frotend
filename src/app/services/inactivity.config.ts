/** Tiempos de inactividad antes de cerrar sesión (IA + máxima seguridad) */
export const INACTIVITY_TIMEOUT_MS = {
  MEDICO: 5 * 60 * 1000,
  ADMIN: 10 * 60 * 1000
} as const;
