import { DetectedDocumentType } from '../../types/reader';

/**
 * Clasifica automaticamente el tipo de documento basandose en palabras clave
 */
export function classifyDocumentType(text: string): DetectedDocumentType {
  const lower = text.toLowerCase();

  // 1. Deteccion de Contrato Laboral
  const contractScore =
    (lower.includes('contrato') ? 3 : 0) +
    (lower.includes('empleador') ? 2 : 0) +
    (lower.includes('trabajador') ? 2 : 0) +
    (lower.includes('salario') ? 1 : 0) +
    (lower.includes('periodo de prueba') ? 3 : 0) +
    (lower.includes('clausula') ? 2 : 0);

  if (contractScore >= 5) {
    return 'contract';
  }

  // 2. Deteccion de Certificado de Salud / EPS / ARL
  const healthScore =
    (lower.includes('afiliaci') ? 2 : 0) +
    (lower.includes('eps') ? 2 : 0) +
    (lower.includes('arl') ? 2 : 0) +
    (lower.includes('pensiones') ? 2 : 0) +
    (lower.includes('cotizante') ? 2 : 0) +
    (lower.includes('compensacion') ? 1 : 0);

  if (healthScore >= 5) {
    return 'health';
  }

  // 3. Deteccion de Cedula de Ciudadania
  const idScore =
    (lower.includes('cedula') ? 3 : 0) +
    (lower.includes('republica de colombia') ? 4 : 0) +
    (lower.includes('lugar de expedicion') ? 3 : 0) +
    (lower.includes('tarjeta de identidad') ? 3 : 0);

  if (idScore >= 4 && text.length < 500) {
    return 'id_card';
  }

  // 4. Por defecto se asume Hoja de Vida / CV
  return 'cv';
}
