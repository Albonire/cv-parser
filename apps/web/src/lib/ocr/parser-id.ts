import { IdCardFormData } from '../../types/id-card';

/**
 * Parsea el texto extraido de un documento de identidad sin datos quemados.
 */
export function parseIdCardText(text: string): IdCardFormData {
  // 1. Numero de Documento
  let documentNumber = '';
  const numMatch = text.match(
    /(?:c[eé]dula|n[uú]mero|identificaci[oó]n|no\.?|nro\.?|num\.?|id\s+no)\s*[:#.-]?\s*([0-9.,]{6,15})/i
  );
  if (numMatch) {
    documentNumber = numMatch[1].replace(/[.,]/g, '').trim();
  } else {
    const rawNumberMatch = text.match(/\b([1-9]\d{6,9})\b/);
    if (rawNumberMatch) {
      documentNumber = rawNumberMatch[1];
    }
  }

  // 2. Nombres y Apellidos
  let firstNames = '';
  let lastNames = '';

  const firstNameMatch = text.match(/nombres?\s*[:#.-]?\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+?)(?=\n|apellidos|nacionalidad|$)/i);
  const lastNameMatch = text.match(/apellidos?\s*[:#.-]?\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+?)(?=\n|nombres|$)/i);

  if (firstNameMatch) {
    firstNames = firstNameMatch[1].trim();
  }
  if (lastNameMatch) {
    lastNames = lastNameMatch[1].trim();
  }

  if (!firstNames && !lastNames) {
    const nameMatch = text.match(/(?:nombre\s+completo|titular|full\s+name)\s*[:#.-]?\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+?)(?=\n|$)/i);
    if (nameMatch) {
      const parts = nameMatch[1].trim().split(/\s+/);
      if (parts.length >= 2) {
        firstNames = parts[0];
        lastNames = parts.slice(1).join(' ');
      }
    }
  }

  // 3. Fecha de Nacimiento
  let birthDate: string | undefined;
  const monthNames = '(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC|JAN|APR|AUG|DEC|Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)';
  const birthMatch = text.match(
    new RegExp(`(?:fecha\\s+de\\s+nacimiento|nacimiento|date\\s+of\\s+birth|dob)\\s*[:#.-]?\\s*(\\d{1,2}[/-](?:\\d{1,2}|${monthNames})[/-]\\d{2,4}|\\d{4}[/-]\\d{1,2}[/-]\\d{1,2})`, 'i')
  );
  if (birthMatch) {
    birthDate = birthMatch[1];
  }

  // 4. Lugar de Expedicion
  let expeditionPlace = '';
  const expMatch = text.match(
    /(?:lugar\s+de\s+expedici[oó]n|expedida\s+en|expedici[oó]n|place\s+of\s+issue)\s*[:#.-]?\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ\s,.-]+?)(?=\n|fecha|$)/i
  );
  if (expMatch) {
    expeditionPlace = expMatch[1].replace(/\(.*\)/, '').trim();
  }

  return {
    documentType: 'CC',
    documentNumber,
    firstNames,
    lastNames,
    birthDate,
    expeditionPlace,
    rawText: text,
  };
}
