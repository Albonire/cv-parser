/**
 * Utilidades compartidas de parseo de OCR para los formularios estructurados
 * (contrato, liquidacion). Centralizan la normalizacion de fechas y montos para
 * que todos los parsers usen las mismas reglas y soporten el OCR degradado de
 * fotos (acentos, palabras pegadas, formatos de fecha y moneda variados).
 */

/** Minusculas y sin acentos: hace robusta la busqueda ante el OCR real. */
export function normalizarOCR(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Convierte "12/05/2024", "2024-05-12" o "12-5-2024" a "YYYY-MM-DD". */
export function normalizarFecha(fecha?: string): string | undefined {
  if (!fecha) return undefined;
  const m = fecha.trim().match(/^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})$/);
  if (!m) return fecha.trim();
  let [, a, b, c] = m.map((x) => (x.length === 1 ? `0${x}` : x));
  if (a.length === 4) return `${a}-${b}-${c}`; // YYYY-MM-DD
  // dd/MM/yyyy o dd/MM/yy (formato colombiano).
  const year = c.length === 4 ? c : `20${c}`;
  return `${year}-${b}-${a}`;
}

/**
 * Interpreta un monto en pesos colombianos escrito por OCR. Tolera
 * "$1.234.567", "1,234,567", "1234567" y ruido de caracteres. Devuelve el
 * numero entero, o undefined si no parece un monto coherente.
 */
export function parsearMonto(txt: string): number | undefined {
  if (!txt) return undefined;
  const limpio = txt
    .replace(/[^\d,.]/g, '')
    .replace(/,/g, (_, __, offset, s) => (/,/.test(s.slice(offset - 3, offset)) ? '' : _))
    .replace(/,/g, '.');
  // 1.234.567 -> 1234567  (punto separador de miles)
  if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) {
    return parseInt(limpio.replace(/\./g, ''), 10);
  }
  // 1234.56 -> tratado como decimal (no suele ocurrir en pesos) -> entero
  const sinPuntos = limpio.replace(/\./g, '');
  if (/^\d{4,}$/.test(sinPuntos)) return parseInt(sinPuntos, 10);
  return undefined;
}

/** Reconstruye un valor monetario a partir de un texto crudo con etiquetas. */
export function capturarMonto(
  texto: string,
  regex: RegExp
): number | undefined {
  const m = texto.match(regex);
  if (!m) return undefined;
  const valor = parsearMonto(m[1]);
  return valor && valor > 0 ? valor : undefined;
}
