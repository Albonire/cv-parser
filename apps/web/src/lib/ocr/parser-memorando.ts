import { MemorandoOCR } from '../../types/reader';
import { normalizarOCR, normalizarFecha } from './parse-helpers';

/**
 * Parsea el texto de un MEMORANDO o LLAMADO DE ATENCION y estructura el asunto,
 * la descripcion, el tipo, la fecha y las partes, para poder registrarlo en la
 * tabla de memorandos del empleado (RN-2) en lugar de dejarlo solo como texto
 * crudo. Ningun valor se inventa: solo lo que el OCR logre reconocer.
 *
 * Formato comun (fotos de WhatsApp):
 *   MEMORANDO No. 026
 *   PARA: JUAN PEREZ
 *   DE: GERENCIA GENERAL
 *   ASUNTO: LLAMADO DE ATENCION POR RETRASOS
 *   FECHA: 12/05/2024
 *   ...cuerpo...
 */
export function parseMemorandoText(text: string): MemorandoOCR {
  const lower = normalizarOCR(text);
  const lineas = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  const subject = extraerEtiqueta(lineas, /^asunto\s*[:#.-]/i);
  const para = extraerEtiqueta(lineas, /^para\s*[:#.-]/i);
  const de = extraerEtiqueta(lineas, /^de\s*[:#.-]/i);
  const memoDate = extraerFechaMemo(lower);

  return {
    workerName: para || (lower.match(/\b(?:emplead[oa]|trabajad[oa]r)\s*[:#.-]?\s*([a-z\u00e0-\u00ff\u00f1\s.'-]{3,50})/i)?.[1] ?? undefined),
    workerDocumentNumber: extraerDocumento(lower),
    subject,
    description: extraerDescripcion(text, lower, subject),
    memoType: inferirTipo(lower),
    memoDate,
    responsiblePerson: de,
  };
}

/** Lee el valor de una etiqueta de cabecera como "PARA: <valor>". */
function extraerEtiqueta(lineas: string[], re: RegExp): string | undefined {
  for (const l of lineas) {
    const m = l.match(re);
    if (m) {
      const valor = l.slice(m[0].length - 1).replace(/^:\s*|\s*:\s*$/g, '').trim();
      if (valor && !/^\W+$/.test(valor)) return cap(valor);
    }
  }
  return undefined;
}

/**
 * Fecha del memorando. Se prefiere la etiqueta "FECHA:" venga donde venga en la
 * linea (el OCR de fotos suele desplazarla del inicio) y en formato numerico o
 * textual ("12/05/2024", "12 de mayo de 2024"). De no haber etiqueta, se intenta
 * la fecha libre del encabezado ("Bogota D.C., 12 de mayo de 2024").
 */
function extraerFechaMemo(lower: string): string | undefined {
  const etiquetada = lower.match(
    /fecha\s*[:#.-]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{4})/i
  );
  if (etiquetada) return normalizarFecha(etiquetada[1]);

  const libre = lower.match(
    /\b(\d{1,2}\s+de\s+(?:de\s+)?[a-z]+\s+de\s+(?:del\s+)?\d{4})\b/i
  );
  const numerica = lower.match(/\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/);
  return normalizarFecha(libre?.[1] ?? numerica?.[0]);
}

/** Cuerpo del memorando: lineas posteriores a ASUNTO/FECHA, sin encabezados. */
function extraerDescripcion(
  raw: string,
  lower: string,
  subject?: string
): string | undefined {
  const idx = lower.search(/\b(asunto|descripcion)\s*[:#.-]/i);
  if (idx === -1) return undefined;
  let cuerpo = raw.slice(Math.min(idx, raw.length)).replace(/^.*?asunto\s*[:#.-].*?$/im, '');
  // Quita encabezados iniciales no deseados.
  cuerpo = cuerpo
    .split(/\n+/)
    .filter((l) => !/^\s*(para|de|fecha|memorando|llamado|no[ºo]?\.?\s*\d)\b[:#.-]?/i.test(l))
    .join('\n')
    .trim();
  if (!cuerpo) return subject ? `${subject}` : undefined;
  return cuerpo.slice(0, 2000);
}

/** Tipo de memorando segun su clasificacion de texto. */
function inferirTipo(lower: string): MemorandoOCR['memoType'] {
  if (lower.includes('llamado de atencion')) return 'llamado_atencion';
  if (lower.includes('amonestacion disciplinaria')) return 'amonestacion_disciplinaria';
  if (lower.includes('amonestacion') || lower.includes('amonestaci')) return 'amonestacion_preventiva';
  return 'otro';
}

function extraerDocumento(lower: string): string | undefined {
  const etiquetada = lower.match(
    /(?:cc|cedula|identificacion|documento)\s*(?:n[oº]?\b|no\.?)?\s*[:#.-]?\s*(\d[\d.\s-]{4,})/
  );
  if (etiquetada) {
    const digito = etiquetada[1].replace(/[.\s-]/g, '');
    if (digito.length >= 7 && digito.length <= 11) return digito;
  }
  const grupos = lower.match(/(?<![\d.])\d{8,10}(?![\d.])/g) ?? [];
  return grupos.find((n) => !n.startsWith('3'));
}

function cap(valor: string): string {
  return valor
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}
