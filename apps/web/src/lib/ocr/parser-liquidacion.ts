import { LiquidacionFormData, LiquidacionConcepto } from '../../types/liquidacion';
import {
  normalizarOCR,
  normalizarFecha,
  capturarMonto,
} from './parse-helpers';

/**
 * Parsea el texto de una LIQUIDACION final de contrato y completa el formulario
 * de liquidacion. Ningun valor se inventa: solo lo que el OCR logre reconocer.
 * Calibrado para texto real de fotos (palabras pegadas, acentos, formato de
 * moneda colombiano "$1.234.567") y listo para que RRHH corrija cualquier error
 * de lectura antes de guardar (RN-7).
 */
export function parseLiquidacionText(text: string): LiquidacionFormData {
  const lower = normalizarOCR(text);

  const data: LiquidacionFormData = {
    workerName: extraerTrabajador(lower),
    workerDocumentNumber: extraerDocumento(lower),
    employerName: extraerEmpleador(lower),
    cargo: extraerCargo(lower),
    fechaIngreso: normalizarFecha(capturarFecha(lower, 'ingreso')),
    fechaRetiro: normalizarFecha(capturarFecha(lower, 'retiro|salida|terminacion')),
    fechaPago: normalizarFecha(capturarFecha(lower, 'pago')),
    diasTrabajados: capturarEntero(lower, /(?:dias\s+trabajados|tiempo\s+de\s+servicios?)\s*[:#.-]?\s*(\d{1,4})/),
    salarioBase: capturarMonto(lower, /salario\s*(?:base|promedio\s+pendiente)?\s*[:#.-]?\s*\$?\s*([\d.,]{4,})/),
    cesantias: capturarMonto(lower, /cesantias\s*(?:consolidadas|definitivas|finales)?\s*[:#.-]?\s*\$?\s*([\d.,]{4,})/),
    interesesCesantias: capturarMonto(lower, /intereses?\s*(?:sobre\s+cesantias|de\s+cesantias)?\s*[:#.-]?\s*\$?\s*([\d.,]{4,})/),
    prima: capturarMonto(lower, /prima\s+(?:de\s+servicios?|de\s+navidad)?\s*[:#.-]?\s*\$?\s*([\d.,]{4,})/),
    vacaciones: capturarMonto(lower, /vacaciones\s*(?:consolidadas|proporcionales)?\s*[:#.-]?\s*\$?\s*([\d.,]{4,})/),
    indemnizacion: capturarMonto(lower, /indemnizacion\s*[:#.-]?\s*\$?\s*([\d.,]{4,})/),
    totalLiquidacion: capturarTotal(lower),
    otrosConceptos: capturarConceptos(lower),
    rawText: text,
  };

  return data;
}

function extraerTrabajador(lower: string): string | undefined {
  const m = lower.match(
    /(?:trabajador|empleado|nombre\s+(?:del\s+)?trabajador|pagado\s+a|a\s+la\s+orden\s+de|beneficiario)\s*[:#.-]?\s*([a-z\u00e0-\u00ff\u00f1]{3,}(?:[ \t]+[a-z\u00e0-\u00ff\u00f1]{2,}){1,4})/i
  );
  if (!m) return undefined;
  return m[1]
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function extraerDocumento(lower: string): string | undefined {
  const regexEtiquetada =
    /(?:\bcc\b|c\.?\s*[co0]\.?|cedula(?:\s+de\s+ciudadania)?|identificacion|documento)\s*(?:n[oº]\b|no\.?)?\s*[:#.-]?\s*(\d[\d.\s-]{4,})/gi;
  for (const m of lower.matchAll(regexEtiquetada)) {
    const digito = m[1].replace(/[.\s-]/g, '');
    if (digito.length >= 7 && digito.length <= 11 && !digito.startsWith('901167')) return digito;
  }
  const conPuntos = lower.matchAll(/\b\d{1,3}(?:\.\d{3}){2,3}\b/g);
  for (const m of conPuntos) {
    const digito = m[0].replace(/\./g, '');
    if (digito.length >= 7 && digito.length <= 11 && !digito.startsWith('3') && !digito.startsWith('901167')) {
      return digito;
    }
  }
  const grupos = lower.match(/(?<![\d.])\d{8,10}(?![\d.])/g) ?? [];
  return grupos.find((n) => !n.startsWith('3') && !n.startsWith('901167') && n !== '901167955');
}

function extraerEmpleador(lower: string): string | undefined {
  const m = lower.match(
    /(?:empleador|empresa|razon\s+social)\s*[:#.-]?\s*([a-z\u00e0-\u00ff\u00f1\s.]{3,60})/i
  );
  if (!m) return undefined;
  // Corta en el salto de linea o en los encabezados del trabajador para que la
  // captura no se trague el bloque completo (p. ej. "... ROSIMAR S.A.S. trabajador...").
  const valor = m[1].split(/\n|trabajador|empleado/i)[0].replace(/\.{2,}$/, '').trim();
  if (!valor) return undefined;
  return valor
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function extraerCargo(lower: string): string | undefined {
  const m = lower.match(
    /(?:cargo|puesto|labor\s+desempenada)\s*[:#.-]?\s*([a-z\u00e0-\u00ff\u00f1 \t]{3,60})/i
  );
  if (!m) return undefined;
  return m[1]
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function capturarFecha(lower: string, etiquetas: string): string | undefined {
  const m = lower.match(
    new RegExp(
      `(?:fecha\\s+(?:de\\s+)?(?:${etiquetas})|(?:${etiquetas})\\s*[:#.-]?\\s*)\\s*(\\d{1,4}[/-]\\d{1,2}[/-]\\d{1,4})`,
      'i'
    )
  );
  return m ? m[1] : undefined;
}

function capturarEntero(lower: string, re: RegExp): number | undefined {
  const m = lower.match(re);
  return m ? parseInt(m[1].replace(/\D/g, ''), 10) || undefined : undefined;
}

function capturarTotal(lower: string): number | undefined {
  return (
    capturarMonto(
      lower,
      /total\s+(?:de\s+)?(?:a\s+pagar|a\s+liquidar|liquidacion\s+(?:a\s+pagar)?|pagar)[\s\S]{0,30}?\$?\s*([\d.,]{4,})/
    ) ??
    capturarMonto(
      lower,
      /(?:la\s+suma\s+de|por\s+concepto\s+de|\bpor\b|valor\s+neto|neto\s+a\s+pagar)\s*[:#.-]?\s*\$?\s*([\d.,]{4,})/i
    ) ??
    capturarMonto(
      lower,
      /(?:liquidacion\s+y\s+pago\s+total|total\s+por\s+concepto\s+de\s+retiro|pago\s+total)\s+(?:por\s+valor\s+de\s+|de\s+|:)\s*\$?\s*([\d.,]{4,})/i
    ) ??
    // Fallback: total señalado como "por valor de $X" en una liquidacion real.
    capturarMonto(
      lower,
      /(?:por\s+valor\s+(?:total\s+)?de|valor\s+total)\s*\$?\s*([\d.,]{4,})/i
    )
  );
}

function capturarConceptos(lower: string): LiquidacionConcepto[] {
  const conceptos: LiquidacionConcepto[] = [];
  const desglose = lower.match(
    /(?:desglose|detalle\s+de\s+liquidacion|conceptos?)\s*[:#.-]?([\s\S]*?)(?:total|firma|recibo)/i
  );
  const bloque = (desglose ? desglose[1] : lower).split(/\n/);
  for (const linea of bloque) {
    const m = linea.match(/([a-z\u00e0-\u00ff\u00f1\s]{4,60})\s*[:#.-]?\s*\$?\s*([\d.,]{4,})/i);
    if (!m) continue;
    const concepto = m[1].trim();
    const valor = capturarMonto(m[0], /\$?([\d.,]{4,})/);
    if (
      valor &&
      !/total|cesantias|intereses|prima|vacaciones|indemnizacion|salario/.test(concepto)
    ) {
      conceptos.push({ concepto, valor });
    }
  }
  return conceptos;
}
