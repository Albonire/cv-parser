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

/**
 * Convierte a "YYYY-MM-DD" los formatos habituales del OCR de fotos:
 * "12/05/2024", "2024-05-12", "12-5-2024", "1 de septiembre de 2023",
 * "primero de septiembre de 2023" (con o sin acentos).
 * Devuelve undefined si no reconoce ningun formato de fecha.
 */
export function normalizarFecha(fecha?: string): string | undefined {
  if (!fecha) return undefined;
  const f = fecha.trim();
  if (!f) return undefined;

  // "1 de septiembre de 2023" / "primero de septiembre de 2023" / "12 de mayo del 2024"
  const textual = f.match(
    /(\d{1,2}|primero|primera|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|quince|veinte|veintiuno|veintidos|veintitres|veinticuatro|veinticinco|veintiseis|veintisiete|veintiocho|veintinueve|treinta)\s+de\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+de\s+(?:del\s+)?(\d{4})/i
  );
  if (textual) {
    const dia = numeroEnTexto(textual[1]);
    const mes = indiceMes(textual[2]);
    const anio = Number(textual[3]);
    if (dia && mes && anio && diaValido(dia, mes, anio)) {
      return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }
  }

  // dd/MM/yyyy, dd-MM-yyyy, yyyy/MM/dd (solo si el bloque encaja completo).
  const m = f.match(/^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})$/);
  if (m) {
    const a = m[1].length === 1 ? `0${m[1]}` : m[1];
    const b = m[2].length === 1 ? `0${m[2]}` : m[2];
    const c = m[3].length === 1 ? `0${m[3]}` : m[3];
    if (a.length === 4) return `${a}-${b}-${c}`; // YYYY-MM-DD
    // dd/MM/yyyy o dd/MM/yy (formato colombiano).
    const year = c.length === 4 ? c : `20${c}`;
    const dia = Number(a);
    const mes = Number(b);
    const anio = Number(year);
    if (mesValid(mes) && diaValido(dia, mes, anio)) return `${year}-${b}-${a}`;
  }

  return undefined;
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
};

function indiceMes(nombre: string): number | undefined {
  const clave = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return MESES[clave];
}

function numeroEnTexto(palabra: string): number | undefined {
  const mapa: Record<string, number> = {
    primero: 1, primera: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
    seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
    trece: 13, catorce: 14, quince: 15, veinte: 20, veintiuno: 21,
    veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
    veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30,
  };
  if (/^\d+$/.test(palabra)) return Number(palabra);
  return mapa[palabra.toLowerCase()];
}

function mesValid(m: number): boolean {
  return !isNaN(m) && m >= 1 && m <= 12;
}

function diaValido(d: number, m: number, y: number): boolean {
  if (isNaN(d) || d < 1 || d > 31 || !mesValid(m)) return false;
  const maxDias = new Date(y, m, 0).getDate();
  return d <= maxDias;
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
