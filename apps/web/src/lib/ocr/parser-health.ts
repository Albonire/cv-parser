import { HealthFormData } from '../../types/health';

const KNOWN_EPS = [
  'Sanitas', 'SURA', 'Nueva EPS', 'Famisanar', 'Salud Total', 'Compensar',
  'Coosalud', 'Mutual Ser', 'Mutualser', 'Savia Salud', 'Asmet Salud', 'Emssanar', 'Capital Salud'
];

const KNOWN_ARL = [
  'ARL SURA', 'Positiva', 'Colmena Seguros', 'Seguros Bolívar', 'AXA Colpatria', 'La Equidad Seguros'
];

const KNOWN_PENSION = [
  'Porvenir', 'Protección', 'Colpensiones', 'Skandia', 'Old Mutual'
];

const KNOWN_COMPENSATION = [
  'Comfaoriente', 'Comfanorte', 'Comfenalco', 'Compensar', 'Cafam', 'Colsubsidio', 'Comfandi', 'Comfama', 'Combarranquilla', 'Comfamiliar', 'Comfasucre'
];

/**
 * Parsea el texto de un certificado de salud/afiliacion sin datos quemados.
 */
export function parseHealthText(text: string): HealthFormData {
  // 1. Detectar EPS
  let epsName = '';
  for (const eps of KNOWN_EPS) {
    if (new RegExp(`\\b${eps}\\b`, 'i').test(text)) {
      epsName = eps;
      break;
    }
  }

  // 2. Detectar ARL
  let arlName = '';
  for (const arl of KNOWN_ARL) {
    if (new RegExp(`\\b${arl.replace('ARL ', '')}\\b`, 'i').test(text)) {
      arlName = arl.startsWith('ARL') ? arl : `ARL ${arl}`;
      break;
    }
  }

  // 3. Detectar Fondo de Pensiones
  let pensionFund = '';
  for (const pen of KNOWN_PENSION) {
    if (new RegExp(`\\b${pen}\\b`, 'i').test(text)) {
      pensionFund = pen;
      break;
    }
  }

  // 4. Detectar Caja de Compensacion
  let compensationBox = '';
  for (const box of KNOWN_COMPENSATION) {
    if (new RegExp(`\\b${box}\\b`, 'i').test(text)) {
      compensationBox = box;
      break;
    }
  }

  // 5. Nombre y Documento del Afiliado
  let workerName = '';
  const nameMatch = text.match(/(?:afiliado|cotizante|beneficiario|nombre|worker|name)\s*[:#.-]?\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{4,60})(?=\n|$)/i);
  if (nameMatch) {
    workerName = nameMatch[1].trim();
  }

  let documentNumber = '';
  const ccMatch = text.match(/(?:c\.?c\.?|c[eé]dula|identificaci[oó]n|documento|id\s+no)\s*[:#.-]?\s*([0-9.,]{6,12})/i);
  if (ccMatch) {
    documentNumber = ccMatch[1].replace(/[.,]/g, '').trim();
  }

  return {
    epsName,
    epsRegime: /subsidiado/i.test(text) ? 'Subsidiado' : 'Contributivo',
    arlName,
    pensionFund,
    compensationBox,
    workerName,
    documentNumber,
    rawText: text,
  };
}
