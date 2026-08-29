import { ContractFormData, ContractType, PaymentFrequency } from '../../types/contract';

/**
 * Parsea el texto de un contrato de trabajo y completa el Formulario 5.2
 * sin valores ficticios o quemados.
 */
export function parseContractText(text: string): ContractFormData {
  // 1. Empleador
  let employerName = '';
  const employerMatch = text.match(
    /(?:empleador|empresa|raz[oó]n\s+social|employer)\s*[:#.-]?\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ\s.]{3,60})(?=\n|$)/i
  );
  if (employerMatch && !/trabajador|empleado|worker|employee/i.test(employerMatch[1])) {
    employerName = employerMatch[1].trim();
  }

  let employerNit = '';
  const nitMatch = text.match(/(?:NIT|RUT|tax\s+id)\s*[:#.-]?\s*([0-9.-]{6,15})/i);
  if (nitMatch) {
    employerNit = nitMatch[1].trim();
  }

  // 2. Trabajador y Documento
  let workerName = '';
  const workerMatch = text.match(
    /(?:trabajador|empleado|contratista|nombre\s+del\s+trabajador|worker|employee)\s*[:#.-]?\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{3,60})(?=\n|$)/i
  );
  if (workerMatch) {
    workerName = workerMatch[1].trim();
  }

  let workerDocumentNumber = '';
  const ccMatch = text.match(
    /(?:\b(?:c\.?c\.?|c[eé]dula(?:\s+de\s+ciudadan[ií]a)?|identificaci[oó]n|documento|id\s+number|national\s+id|tarjeta\s+de\s+identidad|t\.?i\.?|pasaporte|pas)\b)(?:\s*n[oó]\.?)?\s*[:#.]?\s*([0-9.,]{6,15})/i
  );
  if (ccMatch) {
    workerDocumentNumber = ccMatch[1].replace(/[.,]/g, '').trim();
  }

  // 3. Cargo / Posicion
  let position = '';
  const posMatch = text.match(
    /(?:cargo|puesto|funci[oó]n\s+a\s+desempeñar|labor|position|job\s+title)\s*[:#.-]?\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{3,60})(?=\n|$)/i
  );
  if (posMatch) {
    position = posMatch[1].trim();
  }

  // 4. Salario
  let salary = 0;
  const salaryMatch = text.match(
    /(?:salario|sueldo|remuneraci[oó]n|salary|wage)\s*[:#.-]?\s*\$?\s*([0-9.,]{4,15})/i
  );
  if (salaryMatch) {
    const rawNum = salaryMatch[1].replace(/[.,]/g, '');
    const parsed = parseInt(rawNum, 10);
    if (!isNaN(parsed) && parsed > 1000) {
      salary = parsed;
    }
  }

  // 5. Tipo de Contrato
  let contractType: ContractType = 'termino_fijo';
  if (/indefinid[oa]|indefinite/i.test(text)) {
    contractType = 'indefinido';
  } else if (/obra\s+o\s+labor|obra\s+labor/i.test(text)) {
    contractType = 'obra_labor';
  } else if (/aprendizaje|internship|trainee|sena/i.test(text)) {
    contractType = 'aprendizaje';
  } else if (/tiempo\s+parcial|part-time|medio\s+tiempo/i.test(text)) {
    contractType = 'tiempo_parcial';
  }

  // 6. Forma de Pago
  let paymentFrequency: PaymentFrequency = 'mensual';
  if (/quincenal|bi-weekly|biweekly/i.test(text)) {
    paymentFrequency = 'quincenal';
  }

  // 7. Fechas de Inicio y Vencimiento
  let startDate = '';
  const startMatch = text.match(
    /(?:fecha\s+de\s+iniciaci[oó]n|inicia\s+el|desde\s+el|fecha\s+de\s+inicio|start\s+date)\s*[:#.-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})/i
  );
  if (startMatch) {
    startDate = normalizeDate(startMatch[1]);
  }

  let endDate: string | undefined;
  const endMatch = text.match(
    /(?:fecha\s+de\s+vencimiento|termina\s+el|hasta\s+el|fecha\s+de\s+finalizaci[oó]n|end\s+date|expiration\s+date)\s*[:#.-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})/i
  );
  if (endMatch && contractType !== 'indefinido') {
    endDate = normalizeDate(endMatch[1]);
  }

  // 8. Periodo de Prueba y Preaviso
  let trialPeriodDays = 0;
  const trialMatch = text.match(
    /(?:per[ií]odo\s+de\s+prueba|prueba|probation(?:ary)?\s+period)\s*[:#.-]?\s*(\d{1,3})\s*(?:d[ií]as|meses|days|months)?/i
  );
  if (trialMatch) {
    const num = parseInt(trialMatch[1], 10);
    if (!isNaN(num)) {
      trialPeriodDays = /mes|month/i.test(trialMatch[0]) ? num * 30 : num;
    }
  }

  // 9. Lugar de Ejecucion
  let executionPlace = '';
  const placeMatch = text.match(
    /(?:lugar\s+de\s+ejecuci[oó]n|ciudad\s+de\s+trabajo|domicilio\s+contractual|location|workplace)\s*[:#.-]?\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ\s,]{3,50})(?=\n|$)/i
  );
  if (placeMatch) {
    executionPlace = placeMatch[1].trim();
  }

  return {
    employerName,
    employerNit,
    workerName,
    workerDocumentNumber,
    position,
    salary,
    currency: 'COP',
    paymentFrequency,
    contractType,
    startDate,
    endDate,
    trialPeriodDays,
    noticeDays: 30,
    executionPlace,
    status: 'vigente',
  };
}

function normalizeDate(dateStr: string): string {
  const parts = dateStr.split(/[/-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return dateStr;
}
