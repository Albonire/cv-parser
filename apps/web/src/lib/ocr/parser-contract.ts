import { ContractFormData, ContractType, PaymentFrequency } from '../../types/contract';
import { DocumentLayout, layoutFromPlainText } from './layout';
import { findLabeledValue, normalize } from './text-utils';

/**
 * Parsea el texto de un contrato de trabajo y completa el Formulario 5.2
 * sin valores ficticios o quemados.
 *
 * A diferencia del parser anterior (regex sobre texto plano), este parser es
 * consciente del `DocumentLayout`: trabaja renglon a renglon con
 * `findLabeledValue` y `splitLabeledPairs` (el mismo patron que el parser de CV)
 * para no cruzar una etiqueta de una linea con el valor de otra seccion. Eso
 * corrige las fechas en contratos de dos columnas, donde la etiqueta
 * "Fecha de inicio" caia en la columna izquierda y el valor en la derecha.
 */

const ETIQUETAS_EMPLEADOR = ['empleador', 'empresa', 'razon social', 'empleadora', 'employer'];
const ETIQUETAS_NIT = ['nit', 'rut', 'tax id', 'nit del empleador', 'identificacion tributaria'];
const ETIQUETAS_TRABAJADOR = [
  'trabajador', 'empleado', 'contratista', 'nombre del trabajador',
  'nombre del empleado', 'nombre del contratista', 'worker', 'employee',
];
const ETIQUETAS_CEDULA = [
  'cedula', 'cedula de ciudadania', 'cc', 'c c', 'documento', 'documento de identidad',
  'numero de documento', 'identificacion', 'no de identificacion', 'id',
  'cedula del trabajador', 'documento del trabajador', 'cc del trabajador',
];
const ETIQUETAS_CARGO = [
  'cargo', 'puesto', 'funcion a desempenar', 'labor', 'cargo a desempenar',
  'ocupacion', 'position', 'job title', 'cargo del trabajador',
];
const ETIQUETAS_SALARIO = [
  'salario', 'sueldo', 'remuneracion', 'salario mensual', 'salario basico',
  'asalario', 'salary', 'wage', 'honorarios', 'salario integral',
];
const ETIQUETAS_INICIO = [
  'fecha de iniciacion', 'inicia el', 'desde el', 'fecha de inicio',
  'fecha inicial', 'fecha de celebracion', 'start date', 'inicio del contrato',
  'inicio', 'fecha de inicio del contrato',
];
const ETIQUETAS_FIN = [
  'fecha de vencimiento', 'termina el', 'hasta el', 'fecha de finalizacion',
  'finalizacion', 'end date', 'expiration date', 'fecha de terminacion',
  'fecha de corte', 'terminacion del contrato', 'vencimiento',
];
const ETIQUETAS_PRUEBA = [
  'periodo de prueba', 'periodo probatorio', 'prueba', 'probationary period', 'probation period',
];
const ETIQUETAS_LUGAR = [
  'lugar de ejecucion', 'ciudad de trabajo', 'domicilio contractual',
  'lugar de trabajo', 'lugar de ejecucion del contrato', 'location', 'workplace',
  'ciudad de ejecucion',
];

export function parseContractText(text: string, layout?: DocumentLayout): ContractFormData {
  const documento = layout ?? layoutFromPlainText(text);
  const lineas = documento.lines.map((l) => l.text);

  // Con DAFT de bloques: se construye un texto global para los patrones de
  // deteccion de tipo/pago (que son de barrido) y se usan las etiquetas para
  // los campos etiquetados (con valor en la misma linea).
  const todas = lineas.join('\n');

  // 1. Empleador
  const employerName = limpiarValor(findLabeledValue(lineas, ETIQUETAS_EMPLEADOR)) ?? '';
  const employerNit = limpiarNit(findLabeledValue(lineas, ETIQUETAS_NIT)) ?? '';

  // 2. Trabajador y Documento
  const workerName = limpiarValor(findLabeledValue(lineas, ETIQUETAS_TRABAJADOR)) ?? '';
  const workerDocumentRaw = findLabeledValue(lineas, ETIQUETAS_CEDULA);
  const workerDocumentNumber = workerDocumentRaw
    ? workerDocumentRaw.replace(/[.\s-]/g, '').replace(/\D/g, '')
    : '';

  // 4. Cargo / Posicion
  const position = limpiarValor(findLabeledValue(lineas, ETIQUETAS_CARGO)) ?? '';

  // 5. Salario
  const salary = extraerSalario(findLabeledValue(lineas, ETIQUETAS_SALARIO) ?? textoSalario(todas));

  // 6/7. Tipo de contrato y periodo de prueba
  const contractType = detectarTipoContrato(todas);
  const trialPeriodDays = extraerPrueba(findLabeledValue(lineas, ETIQUETAS_PRUEBA) ?? todas);

  // 8. Forma de pago
  const paymentFrequency: PaymentFrequency = /quincenal|bi-weekly|biweekly/i.test(todas)
    ? 'quincenal'
    : 'mensual';

  // 9. Fechas de inicio y vencimiento
  const inicioTexto = findLabeledValue(lineas, ETIQUETAS_INICIO);
  const finTexto = findLabeledValue(lineas, ETIQUETAS_FIN);
  const startDate = inicioTexto
    ? normalizarFecha(inicioTexto)
    : buscarFechaCercana(documento, ETIQUETAS_INICIO);
  let endDate = finTexto
    ? normalizarFecha(finTexto)
    : buscarFechaCercana(documento, ETIQUETAS_FIN);;

  // Si no hay fecha de fin explicita pero hay "por el termino de N meses",
  // se deriva la fecha de fin a partir del inicio (contratos a termino fijo).
  if (!endDate && startDate && contractType === 'termino_fijo') {
    const meses = extraerMesesDeTermino(todas);
    if (meses) endDate = sumarMeses(startDate, meses);
  }

  // 10. Lugar de ejecucion y preaviso
  const executionPlace = limpiarValor(findLabeledValue(lineas, ETIQUETAS_LUGAR)) ?? '';
  const noticeDays = extraerPreaviso(todas);

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
    noticeDays,
    executionPlace,
    status: 'vigente',
  };
}

/**
 * Busca la fecha asociada a una etiqueta cuando el valor cae en un renglon
 * distinto del de la etiqueta (formato tabular / dos columnas). Recorre las
 * lineas en orden de lectura, localiza la linea que contiene la etiqueta y
 * devuelve la primera fecha de esa misma linea o de la(s) siguiente(s).
 */
function buscarFechaCercana(documento: DocumentLayout, etiquetas: string[]): string {
  const wanted = etiquetas.map(normalize).filter((e) => e.length >= 3);
  const lines = documento.lines;

  for (let i = 0; i < lines.length; i++) {
    const linea = lines[i];
    if (!lineaCoincideEtiqueta(linea.text, wanted)) continue;

    // Busca la fecha en la misma linea primero.
    const propia = extraerFechaDeLinea(linea.text);
    if (propia) return propia;

    // Si no, en los siguientes renglones (misma pagina/columna) hasta 3 lineas.
    const siguientes = lines.slice(i + 1, i + 4).filter(
      (l) => l.page === linea.page && l.column === linea.column
    );
    for (const sig of siguientes) {
      const fecha = extraerFechaDeLinea(sig.text);
      if (fecha) return fecha;
      // Deja de buscar si el siguiente renglon ya es otra etiqueta de seccion.
      if (/fecha|vencimiento|iniciaci|finalizaci|terminaci/i.test(sig.text)) break;
    }
  }

  return '';
}

function lineaCoincideEtiqueta(texto: string, wanted: string[]): boolean {
  const norm = normalize(texto);
  return wanted.some((w) => norm.includes(w));
}

function extraerFechaDeLinea(texto: string): string {
  // Prueba primero los formatos textuales espanoles, luego numericos.
  const candidatos = texto.match(
    /(\d{1,2}|primero|primera|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|quince|veinte|treinta)\s+de\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+de\s+\d{4}/i
  );
  if (candidatos) {
    const n = normalizarTextoCompleto(candidatos[0]);
    if (n) return n;
  }
  const numerica = texto.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b/);
  if (numerica) return normalizarFecha(numerica[0]);
  return '';
}

/** Normaliza una fecha en texto espanol completa ("primero de septiembre de 2023"). */
function normalizarTextoCompleto(texto: string): string {
  return normalizarFecha(texto);
}

/** Detecta el tipo de contrato por barrido global, tolerante a ruido. */
function detectarTipoContrato(texto: string): ContractType {
  const lower = texto.toLowerCase();
  if (/indefinid[oa]|indefinite/i.test(lower)) return 'indefinido';
  if (/(?:obra\s+(?:o\s+)?labor|labor\s+contratada)/i.test(lower)) return 'obra_labor';
  if (/aprendizaje|internship|trainee|sena/i.test(lower)) return 'aprendizaje';
  if (/tiempo\s+parcial|part-time|medio\s+tiempo/i.test(lower)) return 'tiempo_parcial';
  return 'termino_fijo';
}

function extraerSalario(texto: string): number {
  // El valor ya puede venir aislado (" $ 1.600.000 COP") o con la etiqueta.
  const match = texto.match(/\$?\s*([0-9][0-9.,\s]{3,15})/);
  if (!match) return 0;
  const numero = match[1].match(/[0-9][0-9.,]{3,14}/);
  if (!numero) return 0;
  const valor = parseInt(numero[0].replace(/[.,\s]/g, ''), 10);
  return !isNaN(valor) && valor > 1000 ? valor : 0;
}

function textoSalario(todas: string): string {
  return todas;
}

function extraerPrueba(texto: string): number {
  const match = texto.match(/(\d{1,3})\s*(d[ií]as?|meses?|days?|months?|m)/i);
  if (!match) return 0;
  const num = parseInt(match[1], 10);
  if (isNaN(num)) return 0;
  const sufijo = match[2].toLowerCase();
  const meses = /mes|month/.test(sufijo);
  return meses ? num * 30 : num;
}

/** Extrae el preaviso del contrato (si no se menciona, 30 por defecto RP-3). */
function extraerPreaviso(texto: string): number {
  const match = texto.match(/(?:preaviso|aviso\s+previo|notice)\s*[:#.-]?\s*(\d{1,3})\s*(?:d[ií]as)?/i);
  if (match) {
    const n = parseInt(match[1], 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return 30;
}

/** Detecta "por el termino de N meses" para derivar la fecha de fin. */
function extraerMesesDeTermino(texto: string): number | null {
  const match = texto.match(/termino\s+de\s+(\d{1,3})\s*(?:meses|mes|month|months)/i);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return !isNaN(n) && n > 0 && n <= 120 ? n : null;
}

/** Suma N meses a una fecha ISO (YYYY-MM-DD) y devuelve la fecha resultante. */
function sumarMeses(iso: string, meses: number): string {
  const partes = iso.split('-').map(Number);
  if (partes.length !== 3 || partes.some(isNaN)) return '';
  const fecha = new Date(partes[0], partes[1] - 1, partes[2]);
  fecha.setMonth(fecha.getMonth() + meses);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(
    fecha.getDate()
  ).padStart(2, '0')}`;
}

/**
 * Normaliza una fecha a ISO `YYYY-MM-DD`, soportando:
 *   - DD/MM/YYYY o DD-MM-YYYY (yaño de 2 digitos asume 20xx)
 *   - YYYY/MM/DD o YYYY-MM-DD
 *   - "1 de septiembre de 2023"
 *   - "primero de septiembre de 2023"
 * Devuelve '' si no reconoce el formato o la fecha es invalida.
 */
export function normalizarFecha(valor: string): string {
  if (!valor) return '';

  // DD/MM/YYYY o DD-MM-YYYY (o YYYY/MM/DD). En Colombia el formato habitual
  // es DD/MM/AAAA, asi que el primer numero es dia y el segundo mes.
  const ddmm = valor.match(/\b(\d{1,2})\s*[/-]\s*(\d{1,2})\s*[/-]\s*(\d{2,4})\b/);
  if (ddmm) {
    let y = Number(ddmm[3]);
    if (ddmm[3].length === 2) y += 2000;
    const m = Number(ddmm[2]);
    const d = Number(ddmm[1]);
    if (mesValido(m) && diaValido(d, m, y)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // YYYY/MM/DD o YYYY-MM-DD (solo cuando el bloque de 4 digitos va primero).
  const ymd = valor.match(/\b(\d{4})\s*[/-]\s*(\d{1,2})\s*[/-]\s*(\d{1,2})\b/);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]);
    const d = Number(ymd[3]);
    if (mesValido(m) && diaValido(d, m, y)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // "primero de septiembre de 2023" / "1 de septiembre de 2023"
  const textual = valor.match(
    /(\d{1,2}|primero|primera|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|quince|veinte|treinta)\s+de\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/i
  );
  if (textual) {
    const dia = numeroEnTexto(textual[1]);
    const mes = indiceMes(textual[2]);
    const y = Number(textual[3]);
    if (dia && mes && diaValido(dia, mes, y)) {
      return `${y}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }
  }

  return '';
}

function mesValido(m: string): boolean {
  const n = Number(m);
  return !isNaN(n) && n >= 1 && n <= 12;
}
function diaValido(d: string, m: string, y: number): boolean {
  const dn = Number(d);
  if (isNaN(dn) || dn < 1 || dn > 31) return false;
  const mn = Number(m);
  const maxDias = new Date(y, mn, 0).getDate();
  return dn <= maxDias;
}

function numeroEnTexto(palabra: string): number | null {
  const mapa: Record<string, number> = {
    primero: 1, primera: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
    seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
    trece: 13, catorce: 14, quince: 15, veinte: 20, veintiuno: 21, veintidos: 22,
    veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27,
    veintiocho: 28, veintinueve: 29, treinta: 30, treinta_y_uno: 31,
  };
  if (/^\d+$/.test(palabra)) {
    const n = Number(palabra);
    return n >= 1 && n <= 31 ? n : null;
  }
  const clave = normalizeSinAcentos(palabra);
  return mapa[clave] ?? null;
}

function indiceMes(nombre: string): number | null {
  const mapa: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
    noviembre: 11, diciembre: 12,
  };
  return mapa[normalizeSinAcentos(nombre)] ?? null;
}

function normalizeSinAcentos(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function limpiarValor(valor: string | null): string | undefined {
  if (!valor) return undefined;
  const limpio = valor.replace(/[\s|•*]+$/g, '').trim();
  return limpio.length >= 2 ? limpio : undefined;
}

function limpiarNit(valor: string | null): string | undefined {
  if (!valor) return undefined;
  // Conserva el formato del NIT (p. ej. 900.123.456-7) quitando solo el ruido
  // que pueda traer al final del valor etiquetado.
  return valor.replace(/[\s|•*]+$/g, '').trim();
}
